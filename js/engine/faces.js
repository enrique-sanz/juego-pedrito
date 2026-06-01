// Carga las fotos de Pedrito, Marian y Kike y las usa TAL CUAL (sin filtros ni
// retoques sobre la cara). Lo único que se hace es eliminar el FONDO de estudio:
//
//   1) Se muestrea el color medio del marco (el fondo siempre toca los bordes).
//   2) Flood-fill desde los bordes que borra los píxeles conectados y parecidos
//      al fondo (paso suave entre vecinos + distancia máxima al color de fondo),
//      deteniéndose en el sujeto. Sirve para fondos blancos, crema o grises.
//   3) Se conserva solo el componente conectado más grande (la cabeza), lo que
//      elimina motas sueltas como marcas de agua en las esquinas.
//
// Si la imagen no tiene un fondo uniforme en los bordes, no se borra apenas
// nada y se muestra entera.
(function () {
  'use strict';

  const DEFS = {
    pedrito: { src: 'assets/faces/pedrito.png' },
    marian:  { src: 'assets/faces/marian.png' },
    kike:    { src: 'assets/faces/kike.png' },
  };

  const STEP = 26;       // diferencia L1 máxima entre vecinos para seguir el fondo
  const MAXDIST = 72;    // distancia L1 máxima al color de fondo muestreado

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
        try { cache[who] = buildImage(img); }
        catch (_) { cache[who] = { canvas: null, ready: false }; }
        loaded++; if (loaded === total) ready = true;
      };
      img.onerror = () => { loaded++; if (loaded === total) ready = true; };
      img.src = def.src;
    }
  }

  function buildImage(img) {
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    const work = document.createElement('canvas');
    work.width = W; work.height = H;
    const wx = work.getContext('2d', { willReadFrequently: true });
    wx.drawImage(img, 0, 0);
    const id = wx.getImageData(0, 0, W, H);
    const d = id.data;

    // 1) Color de fondo = media de los píxeles del marco.
    let sr = 0, sg = 0, sb = 0, n = 0;
    function accum(x, y) { const p = (y * W + x) * 4; sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; n++; }
    for (let x = 0; x < W; x++) { accum(x, 0); accum(x, H - 1); }
    for (let y = 0; y < H; y++) { accum(0, y); accum(W - 1, y); }
    const br = sr / n, bg_ = sg / n, bb = sb / n;

    function distBg(p) {
      return Math.abs(d[p] - br) + Math.abs(d[p + 1] - bg_) + Math.abs(d[p + 2] - bb);
    }

    // 2) Flood-fill de fondo desde los bordes.
    const bg = new Uint8Array(W * H);
    const qx = new Int32Array(W * H);
    const qy = new Int32Array(W * H);
    let qLen = 0;
    function seed(x, y) {
      const idx = y * W + x;
      if (bg[idx]) return;
      if (distBg(idx * 4) > MAXDIST) return;
      bg[idx] = 1; qx[qLen] = x; qy[qLen] = y; qLen++;
    }
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
    for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }

    let head = 0;
    while (head < qLen) {
      const x = qx[head];
      const y = qy[head++];
      const p = (y * W + x) * 4;
      const r = d[p], g = d[p + 1], b = d[p + 2];
      for (let nn = 0; nn < 4; nn++) {
        let nx = x, ny = y;
        if (nn === 0) nx = x + 1;
        else if (nn === 1) nx = x - 1;
        else if (nn === 2) ny = y + 1;
        else ny = y - 1;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nidx = ny * W + nx;
        if (bg[nidx]) continue;
        const np = nidx * 4;
        if (Math.abs(d[np] - r) + Math.abs(d[np + 1] - g) + Math.abs(d[np + 2] - b) > STEP) continue;
        if (distBg(np) > MAXDIST) continue;
        bg[nidx] = 1; qx[qLen] = nx; qy[qLen] = ny; qLen++;
      }
    }

    // 3) Conserva solo el mayor componente conectado de primer plano.
    keepLargestForeground(bg, qx, qy, W, H);

    // Aplica transparencia.
    let removed = 0;
    for (let i = 0, p = 0; i < bg.length; i++, p += 4) {
      if (bg[i]) { d[p + 3] = 0; removed++; }
    }
    wx.putImageData(id, 0, 0);

    // 4) Recorte al bbox visible (si no se quitó nada, imagen entera).
    let minX = 0, minY = 0, maxX = W - 1, maxY = H - 1;
    if (removed > 0) {
      minX = W; minY = H; maxX = -1; maxY = -1;
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
    }

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    const ox = out.getContext('2d');
    ox.drawImage(work, minX, minY, cw, ch, 0, 0, cw, ch);
    return { canvas: out, ready: true, w: cw, h: ch };
  }

  // Marca como fondo cualquier primer plano que NO pertenezca al mayor
  // componente conectado (elimina motas: marcas de agua, brillos sueltos...).
  // Etiquetado por componentes con un Int32Array (sin arrays por componente,
  // para que funcione bien también a resolución alta).
  function keepLargestForeground(bg, qx, qy, W, H) {
    const N = W * H;
    const label = new Int32Array(N);   // 0 = fondo / sin visitar
    let cur = 0, bestLabel = 0, bestSize = 0;
    for (let s = 0; s < N; s++) {
      if (bg[s] || label[s]) continue;
      cur++;
      let ql = 0, hd = 0;
      qx[0] = s % W; qy[0] = (s / W) | 0; ql = 1; label[s] = cur;
      let size = 0;
      while (hd < ql) {
        const x = qx[hd], y = qy[hd]; hd++; size++;
        for (let nn = 0; nn < 4; nn++) {
          let nx = x, ny = y;
          if (nn === 0) nx = x + 1;
          else if (nn === 1) nx = x - 1;
          else if (nn === 2) ny = y + 1;
          else ny = y - 1;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nidx = ny * W + nx;
          if (bg[nidx] || label[nidx]) continue;
          label[nidx] = cur;
          qx[ql] = nx; qy[ql] = ny; ql++;
        }
      }
      if (size > bestSize) { bestSize = size; bestLabel = cur; }
    }
    if (!bestLabel) return;
    for (let i = 0; i < N; i++) if (!bg[i] && label[i] !== bestLabel) bg[i] = 1;
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
