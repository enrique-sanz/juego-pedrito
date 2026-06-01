// Carga las fotos reales de Pedrito, Marian y Kike y construye una silueta
// pixel-perfect mediante segmentación automática:
//
//   1) Calcula un mapa de magnitud de gradiente (Sobel L1) sobre la imagen.
//   2) Lanza un flood-fill BFS desde TODOS los píxeles del borde del PNG
//      (que son fondo por definición). El BFS avanza a un vecino solo si:
//        - el gradiente en el vecino está por debajo de `edge` (no cruza
//          contornos fuertes como pelo / mejilla / gorra), Y
//        - la diferencia de color con el píxel actual es pequeña (permite
//          gradientes suaves de fondo, p.ej. cielo → césped).
//   3) Todos los píxeles alcanzados son fondo → alpha 0. El resto (cara,
//      pelo, gorra, hombros si están bien recortados) queda intacto.
//   4) Recorta al bbox del foreground.
//
// No hay polígonos a mano: el contorno sigue literalmente la silueta de cada
// foto. Si la segmentación falla (foreground < 8% del área), se devuelve
// canvas:null y characters.js dibuja la versión codificada como fallback.
(function () {
  'use strict';

  // Parámetros afinados por foto:
  //   edge:      umbral del gradiente que corta el flood-fill (más alto => más
  //              permisivo, más pintura quitada). Sobel L1 ≈ 0..1530.
  //   colorStep: máxima diferencia L1 RGB entre píxel y vecino para considerar
  //              que pertenecen al mismo "trozo" de fondo. Permite degradados
  //              suaves de fondo pero corta saltos bruscos.
  const DEFS = {
    pedrito: { src: 'assets/faces/pedrito.png', edge: 140, colorStep: 42 },
    marian:  { src: 'assets/faces/marian.png',  edge: 120, colorStep: 40 },
    kike:    { src: 'assets/faces/kike.png',    edge: 150, colorStep: 46 },
  };

  const cache = {};
  let ready = false;
  let total = 0, loaded = 0;

  function init() {
    const names = Object.keys(DEFS);
    total = names.length;
    loaded = 0;
    for (const who of names) {
      const def = DEFS[who];
      cache[who] = { canvas: null, ready: false };
      const img = new Image();
      img.onload = () => {
        try { cache[who] = buildSilhouette(img, def.edge, def.colorStep); }
        catch (_) { cache[who] = { canvas: null, ready: false }; }
        loaded++; if (loaded === total) ready = true;
      };
      img.onerror = () => { loaded++; if (loaded === total) ready = true; };
      img.src = def.src;
    }
  }

  function buildSilhouette(img, EDGE_T, COLOR_STEP) {
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    const work = document.createElement('canvas');
    work.width = W; work.height = H;
    const wx = work.getContext('2d', { willReadFrequently: true });
    wx.drawImage(img, 0, 0);
    const id = wx.getImageData(0, 0, W, H);
    const d = id.data;

    // Gradiente Sobel L1 por píxel.
    const edge = new Uint16Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const iL = (y * W + (x - 1)) * 4;
        const iR = (y * W + (x + 1)) * 4;
        const iU = ((y - 1) * W + x) * 4;
        const iD = ((y + 1) * W + x) * 4;
        const gx = Math.abs(d[iR]     - d[iL])     +
                   Math.abs(d[iR + 1] - d[iL + 1]) +
                   Math.abs(d[iR + 2] - d[iL + 2]);
        const gy = Math.abs(d[iD]     - d[iU])     +
                   Math.abs(d[iD + 1] - d[iU + 1]) +
                   Math.abs(d[iD + 2] - d[iU + 2]);
        edge[y * W + x] = gx + gy;
      }
    }

    // Flood-fill BFS desde todo el marco.
    const bg = new Uint8Array(W * H);
    const qx = new Int32Array(W * H);
    const qy = new Int32Array(W * H);
    let qLen = 0;
    function seed(x, y) {
      const idx = y * W + x;
      if (bg[idx]) return;
      bg[idx] = 1;
      qx[qLen] = x; qy[qLen] = y; qLen++;
    }
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
    for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }

    const COLOR_T = COLOR_STEP * 3; // suma RGB

    let head = 0;
    while (head < qLen) {
      const x = qx[head];
      const y = qy[head++];
      const i = (y * W + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // 4-vecinos
      for (let n = 0; n < 4; n++) {
        let nx = x, ny = y;
        if (n === 0) nx = x + 1;
        else if (n === 1) nx = x - 1;
        else if (n === 2) ny = y + 1;
        else ny = y - 1;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nidx = ny * W + nx;
        if (bg[nidx]) continue;
        if (edge[nidx] > EDGE_T) continue;
        const ni = nidx * 4;
        const dR = d[ni]     - r;
        const dG = d[ni + 1] - g;
        const dB = d[ni + 2] - b;
        const cd = (dR < 0 ? -dR : dR) +
                   (dG < 0 ? -dG : dG) +
                   (dB < 0 ? -dB : dB);
        if (cd > COLOR_T) continue;
        bg[nidx] = 1;
        qx[qLen] = nx; qy[qLen] = ny; qLen++;
      }
    }

    // Aplica alpha=0 en bg.
    let fgCount = 0;
    for (let i = 0, p = 0; i < bg.length; i++, p += 4) {
      if (bg[i]) d[p + 3] = 0;
      else fgCount++;
    }
    // Si el flood-fill se ha comido casi todo (parámetros mal afinados),
    // mejor abortar y caer al dibujo codificado.
    if (fgCount < (W * H) * 0.08) return { canvas: null, ready: false };

    wx.putImageData(id, 0, 0);

    // bbox del foreground.
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { canvas: null, ready: false };

    const pad = 1;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W - 1, maxX + pad);
    maxY = Math.min(H - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    const ox = out.getContext('2d');
    ox.drawImage(work, minX, minY, cw, ch, 0, 0, cw, ch);

    return { canvas: out, ready: true, w: cw, h: ch };
  }

  function drawHead(ctx, who, cx, cy, w, opts) {
    const entry = cache[who];
    if (!entry || !entry.ready || !entry.canvas) return false;
    const aspect = entry.h / entry.w;
    const h = w * aspect;
    const o = opts || {};
    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevQuality = ctx.imageSmoothingQuality;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(cx, cy);
    if (o.rotation) ctx.rotate(o.rotation);
    const fx = o.facing === -1 ? -1 : 1;
    ctx.scale(fx, 1);
    ctx.drawImage(entry.canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.imageSmoothingQuality = prevQuality;
    return true;
  }

  function isReady(who) {
    if (who) return !!(cache[who] && cache[who].ready);
    return ready;
  }

  function aspectOf(who) {
    const e = cache[who];
    if (!e || !e.ready) return 1.2;
    return e.h / e.w;
  }

  window.Faces = { init, drawHead, isReady, aspectOf };
})();
