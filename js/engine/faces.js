// Carga las fotos reales de Pedrito, Marian y Kike y las recorta a su silueta
// real con:
//   1) Un polígono trazado a mano sobre cada PNG fuente (densidad ~30-36
//      puntos siguiendo pelo, mejillas, mentón y barba).
//   2) Para Marian, un color-key conservador adicional dentro del polígono
//      que limpia el fondo morado oscuro entre los rizos del pelo (donde la
//      línea recta del polígono no puede seguir cada bucle).
//
// El motor renderiza con imageSmoothingEnabled=false (look pixel-art). En el
// draw activamos suavizado temporal para que la cara no salga blocky al
// reescalar.
(function () {
  'use strict';

  // Polígonos en coordenadas de la PNG fuente (orden horario, cierre implícito).
  const DEFS = {
    pedrito: {
      src: 'assets/faces/pedrito.png',
      poly: [
        [55, 14], [68, 8], [82, 4], [95, 3], [108, 4], [122, 8], [135, 13],
        [146, 19], [155, 28],
        [162, 42], [167, 58], [170, 76], [170, 92], [168, 108],
        [165, 125], [160, 142],
        [152, 160], [140, 178], [125, 192], [108, 200], [95, 202],
        [82, 200], [68, 192], [50, 178], [38, 160],
        [30, 142], [25, 125], [22, 108], [20, 92], [22, 76], [25, 58],
        [30, 42], [37, 28], [44, 19],
      ],
      colorKey: null,
    },
    marian: {
      src: 'assets/faces/marian.png',
      // Polígono ligeramente generoso. El colorKey limpia el morado oscuro
      // entre los rizos del pelo.
      poly: [
        [113, 8], [125, 5], [138, 7], [150, 12], [162, 18],
        [172, 28], [180, 42], [186, 58], [190, 76],
        [193, 96], [191, 116], [186, 138], [180, 158],
        [170, 176], [158, 190],
        [142, 200], [125, 207], [113, 210], [100, 207], [85, 200],
        [70, 190], [58, 176], [48, 158], [40, 138],
        [35, 116], [33, 96], [36, 76], [40, 58], [46, 42],
        [54, 28], [64, 18], [75, 12], [87, 7], [100, 5],
      ],
      colorKey: 'purple',
    },
    kike: {
      src: 'assets/faces/kike.png',
      poly: [
        [78, 3], [95, 3], [110, 5], [125, 10], [138, 15],
        [150, 22], [158, 35],
        [163, 55], [165, 72],
        [162, 86], [155, 94],
        [150, 108], [153, 125], [150, 145],
        [140, 170], [133, 190], [120, 210],
        [105, 222], [88, 228], [70, 222],
        [52, 210], [38, 190], [30, 170],
        [20, 145], [15, 125], [18, 108],
        [10, 94], [3, 86],
        [3, 72], [5, 55],
        [12, 35], [20, 22],
        [30, 13], [45, 7], [62, 3],
      ],
      colorKey: null,
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
        try { cache[who] = buildSilhouette(img, def.poly, def.colorKey); }
        catch (_) { cache[who] = { canvas: null, ready: false }; }
        loaded++; if (loaded === total) ready = true;
      };
      img.onerror = () => { loaded++; if (loaded === total) ready = true; };
      img.src = def.src;
    }
  }

  function buildSilhouette(img, poly, colorKey) {
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

    // Aplica clip del polígono y dibuja la imagen trasladada al origen del bbox
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
    cx.drawImage(img, -minX, -minY);
    cx.restore();

    // Color-key opcional para limpiar bleed dentro del polígono
    if (colorKey) {
      const id = cx.getImageData(0, 0, cw, ch);
      const d = id.data;
      const test = colorKey === 'purple' ? isPurpleBg : null;
      if (test) {
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          if (test(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
        }
        cx.putImageData(id, 0, 0);
      }
    }

    return { canvas: c, ready: true, w: cw, h: ch };
  }

  // Morado MUY oscuro y desaturado del fondo de la foto de Marian. Muy
  // restrictivo para no comerse piel rosada ni pelo castaño.
  function isPurpleBg(r, g, b) {
    if (r < 90 && g < 75 && b > g + 12) return true;
    if (r < 60 && g < 50 && b > 30)     return true;
    return false;
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
