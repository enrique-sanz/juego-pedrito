// Carga las fotos reales de Pedrito, Marian y Kike y las recorta a su silueta
// real usando un polígono trazado a mano sobre cada foto (en coordenadas de
// la PNG redimensionada). Es más fiable que un flood-fill porque las fotos
// reales tienen gradientes continuos piel↔fondo que hacen leakear el fill.
//
// El motor renderiza con imageSmoothingEnabled=false (look pixel-art). En el
// draw activamos suavizado temporal para que la cara no salga blocky al
// reescalar.
(function () {
  'use strict';

  // Polígonos en coords de la PNG fuente (orden horario). Capturan la
  // silueta exterior: pelo + cara + cuello donde aplique.
  const DEFS = {
    pedrito: {
      src: 'assets/faces/pedrito.png',
      poly: [
        [95, 12], [135, 18], [158, 38], [165, 75], [162, 115],
        [155, 145], [135, 178], [95, 200], [55, 178], [32, 145],
        [25, 115], [24, 75], [32, 38], [55, 18],
      ],
    },
    marian: {
      src: 'assets/faces/marian.png',
      poly: [
        [110, 10], [155, 15], [175, 35], [185, 70], [180, 110],
        [170, 145], [155, 175], [130, 195], [115, 200], [95, 195],
        [70, 175], [55, 145], [45, 110], [40, 70], [50, 35], [75, 15],
      ],
    },
    kike: {
      src: 'assets/faces/kike.png',
      poly: [
        [90, 5], [158, 25], [165, 60], [160, 90], [155, 125],
        [140, 155], [130, 185], [115, 210], [90, 222], [65, 210],
        [50, 185], [35, 155], [20, 125], [15, 90], [10, 60], [15, 25],
      ],
    },
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
        try { cache[who] = buildSilhouette(img, def.poly); }
        catch (_) { cache[who] = { canvas: null, ready: false }; }
        loaded++; if (loaded === total) ready = true;
      };
      img.onerror = () => { loaded++; if (loaded === total) ready = true; };
      img.src = def.src;
    }
  }

  // 1) Calcula bbox del polígono (con margen).
  // 2) Crea canvas de ese tamaño, traduce el contexto al origen del bbox,
  //    clipea con el polígono, y dibuja la imagen entera.
  // 3) Resultado: silueta limpia, recortada a su bounding box.
  function buildSilhouette(img, poly) {
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (const [x, y] of poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const pad = 1;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W, maxX + pad);
    maxY = Math.min(H, maxY + pad);

    const cw = maxX - minX;
    const ch = maxY - minY;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const cx = c.getContext('2d');

    // Polígono trasladado al origen del bbox
    cx.save();
    cx.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const px = poly[i][0] - minX;
      const py = poly[i][1] - minY;
      if (i === 0) cx.moveTo(px, py);
      else cx.lineTo(px, py);
    }
    cx.closePath();
    cx.clip();

    // Dibujo de la foto trasladada para que su (minX, minY) caiga en (0,0)
    cx.drawImage(img, -minX, -minY);
    cx.restore();

    return { canvas: c, ready: true, w: cw, h: ch };
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
