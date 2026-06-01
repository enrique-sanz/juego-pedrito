// Carga y procesado de vehículos basados en imagen.
// Por ahora: el Manitou visto en cenital, que sustituye a la X-Wing en los
// minijuegos 1 y 2.
//
// La PNG original (96×192) trae el fondo de placa Lego gris. En init() la
// procesamos píxel a píxel y dejamos transparente cualquier color "gris
// desaturado" en el rango de la baseplate, conservando el rojo del Manitou,
// los neumáticos negros, el texto blanco y el conductor.
(function () {
  'use strict';

  const SRC = 'assets/vehicles/manitou-top.png';

  const state = {
    canvas: null,
    ready: false,
    w: 0,
    h: 0,
  };

  function init() {
    const img = new Image();
    img.onload = () => {
      try { state.canvas = buildKeyed(img); state.w = state.canvas.width; state.h = state.canvas.height; state.ready = true; }
      catch (_) { /* silencia: las escenas tienen fallback */ }
    };
    img.onerror = () => { /* fallback en escenas */ };
    img.src = SRC;
  }

  // Recorre la imagen y aplica un color-key sobre el gris de la baseplate.
  // Heurística: la baseplate es un gris desaturado en el rango medio de
  // luminancia. Los componentes del Manitou que NO se deben tocar:
  //   - rojo del chasis (alta saturación)
  //   - texto blanco (luminancia muy alta)
  //   - neumáticos / detalles negros (luminancia muy baja)
  //   - piel del conductor (algo de saturación + matiz cálido)
  function buildKeyed(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, c.width, c.height);
    const d = data.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];

      // Saturación aprox: max-min sobre max (Chroma normalizado).
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      const sat = max === 0 ? 0 : chroma / max;
      const lum = (max + min) / 2;  // 0..255

      // Detectar baseplate: poca saturación + brillo medio-alto.
      // - sat < 0.12 → desaturado
      // - lum entre 90 y 215 → ni demasiado oscuro (neumático) ni blanco puro
      if (sat < 0.12 && lum > 90 && lum < 215) {
        d[i + 3] = 0;
      }
    }

    ctx.putImageData(data, 0, 0);
    return c;
  }

  // Pinta el Manitou centrado en (cx, cy) con anchura w. La altura se deriva
  // del aspect ratio del recorte original (alto/ancho ≈ 2).
  // El bucle principal arranca con imageSmoothingEnabled=false para conservar
  // el look pixel-art; aquí lo habilitamos temporalmente para que el downscale
  // del PNG real preserve detalles finos (especialmente el texto "MANITOU").
  // El Manitou se estira un 25% en horizontal manteniendo el alto, para que
  // se vea más ancho/robusto sin alargarse.
  const WIDTH_STRETCH = 1.25;

  function drawManitouTop(ctx, cx, cy, w, opts) {
    if (!state.ready) return false;
    const aspect = state.h / state.w;
    const h = w * aspect;
    const dw = w * WIDTH_STRETCH;
    const o = opts || {};
    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevQuality = ctx.imageSmoothingQuality;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(cx, cy);
    if (o.rotation) ctx.rotate(o.rotation);
    ctx.drawImage(state.canvas, -dw / 2, -h / 2, dw, h);

    ctx.restore();
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.imageSmoothingQuality = prevQuality;
    return true;
  }

  function isReady() { return state.ready; }
  function aspect() { return state.h && state.w ? state.h / state.w : 2; }

  window.Vehicles = { init, drawManitouTop, isReady, aspect };
})();
