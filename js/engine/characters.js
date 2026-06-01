// Dibujo por código de personajes, vehículos y elementos retro estilo 16-bit
// (SNES/Genesis). Paletas más amplias con sombreados, fotogramas alternativos
// para animar idle/walk. Centralizado para sustituir por sprites importados
// el día que el usuario aporte imágenes.
(function () {
  'use strict';

  function fillRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w, h);
  }

  // Dibuja una matriz de píxeles (array de strings). '.' = transparente.
  // Cualquier otro caracter usa el mapeo `palette[char]`.
  function drawPixels(ctx, x, y, scale, lines, palette) {
    for (let row = 0; row < lines.length; row++) {
      const line = lines[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = palette[ch] || '#fff';
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }

  // ============ PEDRITO ============
  // Sprite 14×20. Paleta amplia: piel base + highlight + shadow, pelo en dos
  // tonos, túnica Jedi en tres tonos, cinturón y botas. Variaciones de
  // piernas para una pequeña animación de paso.
  const PEDRITO_PALETTE = {
    o: '#2a1408',  // outline oscuro
    h: '#3a1f0a',  // pelo base
    H: '#6c3a18',  // pelo highlight
    c: '#f1c27d',  // piel base
    C: '#fad6a0',  // piel highlight
    s: '#bf8a4a',  // piel sombra
    F: '#0c0c0c',  // pupila
    W: '#ffffff',  // blanco ojo
    m: '#8a2a1e',  // boca
    M: '#c44a35',  // boca highlight
    t: '#a76a3a',  // túnica mid
    T: '#cc8a52',  // túnica highlight
    b: '#6e3f1a',  // túnica shadow
    g: '#3a2a14',  // cinturón
    G: '#d8a830',  // hebilla cinturón
    B: '#1d1208',  // bota
  };

  const PEDRITO_IDLE = [
    '....oooooo....',
    '...oHHHHHHo...',
    '..oHhcccchHo..',
    '..oHccccccHo..',
    '..ocCCCCCCco..',
    '..ocFWccWFco..',
    '..occsccsccc..',
    '..occcmMmccc..',
    '...occccccco..',
    '..ogtttttto...',
    '..otTTtTTTto..',
    '..otTbtbTtto..',
    '..otTbtbTtto..',
    '..ogggGGgggo..',
    '..otTbbbbTto..',
    '..otTbbbbTto..',
    '...tt....tt...',
    '...tt....tt...',
    '...BB....BB...',
    '..oBBo..oBBo..',
  ];

  const PEDRITO_WALK = [
    '....oooooo....',
    '...oHHHHHHo...',
    '..oHhcccchHo..',
    '..oHccccccHo..',
    '..ocCCCCCCco..',
    '..ocFWccWFco..',
    '..occsccsccc..',
    '..occcmMmccc..',
    '...occccccco..',
    '..ogtttttto...',
    '..otTTtTTTto..',
    '..otTbtbTtto..',
    '..otTbtbTtto..',
    '..ogggGGgggo..',
    '..otTbbbbTto..',
    '...tTbbbbTt...',
    '..ttt....tt...',
    '..tt......tt..',
    '..BB......BB..',
    '.oBBo....oBBo.',
  ];

  // Filas 0..8 de cada sprite son la cabeza pixel-art; cuando la foto real
  // está cargada, se omiten esas filas (solo se pinta cuerpo) y se superpone
  // la foto enmascarada con Faces.drawHead. La constante HEAD_BODY_ROW es la
  // primera fila del sprite que pertenece al cuerpo.
  const HEAD_BODY_ROW = 9;

  function drawFaceOver(ctx, who, x, y, scale, wCols, cyRows, opts) {
    if (!window.Faces || !window.Faces.isReady(who)) return false;
    const cx = x + 7 * scale;          // centro horizontal del sprite 14 wide
    const cy = y + cyRows * scale;
    return window.Faces.drawHead(ctx, who, cx, cy, wCols * scale, opts);
  }

  function drawPedrito(ctx, x, y, scale, frame, opts) {
    const lines = frame === 'walk' ? PEDRITO_WALK : PEDRITO_IDLE;
    if (window.Faces && window.Faces.isReady('pedrito')) {
      const body = lines.slice(HEAD_BODY_ROW);
      drawPixels(ctx, x, y + HEAD_BODY_ROW * scale, scale, body, PEDRITO_PALETTE);
      drawFaceOver(ctx, 'pedrito', x, y, scale, 26, 3, opts);
    } else {
      drawPixels(ctx, x, y, scale, lines, PEDRITO_PALETTE);
    }
  }

  // ============ MARIAN ============
  // Pelo rubio largo, vestido azul con detalle dorado. Misma altura.
  const MARIAN_PALETTE = {
    o: '#241510',
    g: '#a07a30',  // pelo sombra
    G: '#e6c060',  // pelo base
    Y: '#fae08a',  // pelo highlight
    c: '#fad0a8',
    C: '#ffe7c8',
    s: '#c98a64',
    F: '#0c0c0c',
    W: '#ffffff',
    m: '#b04050',
    M: '#e06070',
    a: '#3866b8',  // vestido mid
    A: '#6a96e0',  // vestido highlight
    b: '#244a92',  // vestido shadow
    d: '#e8c248',  // detalle dorado
    L: '#fff0a8',  // collar
  };

  const MARIAN_IDLE = [
    '...oGGGGGGo...',
    '..oGYYYYYYGo..',
    '.oGYccccccYGo.',
    '.oGcccccccYGo.',
    '.oGcCCCCcccGo.',
    '.oGcFWccWFcGo.',
    '.oGccsccsccGo.',
    '.oGcccmMmccGo.',
    '..GccccccccG..',
    '..oLLLLLLLLo..',
    '..oAAaaaaAAo..',
    '..oAabbbbaAo..',
    '..oAabddbaAo..',
    '..oAabddbaAo..',
    '..oAaabaaaAo..',
    '..oAaabaaaAo..',
    '..oaaabaaaao..',
    '..oaaabaaaao..',
    '...aaa..aaa...',
    '....a....a....',
  ];

  function drawMarian(ctx, x, y, scale, opts) {
    if (window.Faces && window.Faces.isReady('marian')) {
      const body = MARIAN_IDLE.slice(HEAD_BODY_ROW);
      drawPixels(ctx, x, y + HEAD_BODY_ROW * scale, scale, body, MARIAN_PALETTE);
      drawFaceOver(ctx, 'marian', x, y, scale, 28, 3, opts);
    } else {
      drawPixels(ctx, x, y, scale, MARIAN_IDLE, MARIAN_PALETTE);
    }
  }

  // ============ KIKE VADER ============
  // Casco al estilo Vader con visor, capa con sombras, botas.
  const KIKE_PALETTE = {
    o: '#000000',
    k: '#1a1a1a',  // casco base
    K: '#3a3a3a',  // casco highlight
    r: '#ff2a2a',  // visor
    R: '#ff7070',  // visor brillo
    w: '#9a9a9a',  // detalle metálico
    c: '#101010',  // capa
    C: '#2a2a2a',  // capa highlight
    b: '#5a1a1a',  // detalle rojo
    B: '#1a0810',
  };

  const KIKE_IDLE = [
    '....oookooo...',
    '...okKKKKKKko.',
    '..okKKKKKKKKo.',
    '..okKKrrrrKKo.',
    '..okrrRRRRrro.',
    '..okrrRRRRrro.',
    '..oKKKKwwKKKo.',
    '..okwkwwwwkwo.',
    '...oKKKKKKKo..',
    '..ocKKKKKKKco.',
    '.oCcKKKKKKcCo.',
    '.oCccKKKKccCo.',
    '.oCccbbbbccCo.',
    '.oCcCcccccCCo.',
    '.oCCCccccCCCo.',
    '..oCcccccCo...',
    '..oCcc..cCo...',
    '..ocBc..cBco..',
    '..oBBo..oBBo..',
    '..oBBo..oBBo..',
  ];

  function drawKikeVader(ctx, x, y, scale, opts) {
    if (window.Faces && window.Faces.isReady('kike')) {
      const body = KIKE_IDLE.slice(HEAD_BODY_ROW);
      drawPixels(ctx, x, y + HEAD_BODY_ROW * scale, scale, body, KIKE_PALETTE);
      drawFaceOver(ctx, 'kike', x, y, scale, 28, 3, opts);
    } else {
      drawPixels(ctx, x, y, scale, KIKE_IDLE, KIKE_PALETTE);
    }
  }

  // ============ SABLE LÁSER ============
  function drawSaber(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.lineCap = 'round';

    // Glow exterior amplio (2 pasadas para halo)
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();

    // Hoja coloreada
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();

    // Núcleo blanco
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();

    // Empuñadura metálica
    const dx = x1 - x2, dy = y1 - y2;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * 8, y1 + uy * 8);
    ctx.stroke();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + ux * 8, y1 + uy * 8);
    ctx.lineTo(x1 + ux * 12, y1 + uy * 12);
    ctx.stroke();

    ctx.restore();
  }

  // ============ X-WING (Pedrito) ============
  // 12×10 con detalles de cañones, cabina y motores.
  const XWING_PALETTE = {
    o: '#000000',
    w: '#d6d6d6',
    W: '#ffffff',
    g: '#7a7a7a',
    G: '#a0a0a0',
    b: '#ff4040',  // marcas rebeldes
    c: '#3aa0ff',  // cabina
    C: '#9adcff',  // cabina brillo
    e: '#ffae40',  // motor
    E: '#ffe080',  // motor highlight
  };

  const XWING_FRAME = [
    '....oWWo....',
    '....oWWo....',
    '..oogWWgoo..',
    '.oggWWWWggo.',
    'oggGcCcGggo.',
    'oggGWWWWGggo',
    'oeegWWWWgee.',
    '.oeggWWggeo.',
    '..oewwwweo..',
    '....oEEo....',
  ];

  function drawXwing(ctx, x, y, scale) {
    drawPixels(ctx, x, y, scale, XWING_FRAME, XWING_PALETTE);
  }

  // ============ CAZA TIE ============
  const TIE_PALETTE = {
    o: '#000000',
    h: '#3a3a3a',
    H: '#5a5a5a',
    w: '#9d9d9d',
    W: '#cdcdcd',
    c: '#ff3030',
    g: '#2a2a2a',
  };

  const TIE_FRAME = [
    'o.....o',
    'hH...Hh',
    'hHwWWwHh',
    'HwWcWwH',
    'hHwWWwHh',
    'hH...Hh',
    'o.....o',
  ];

  function drawTie(ctx, x, y, scale) {
    drawPixels(ctx, x, y, scale, TIE_FRAME, TIE_PALETTE);
  }

  // ============ HEART (vidas) ============
  function drawHeart(ctx, x, y, scale, full) {
    const palette = full
      ? { r: '#ff3a4a', R: '#ff8a8a', d: '#8a1828', o: '#3a0612' }
      : { r: '#3a2030', R: '#5a3848', d: '#1a1018', o: '#0a0006' };
    const lines = [
      '.orro.orro.',
      'oRrRroRrRro',
      'oRrrrrrrrRo',
      'oRrrrrrrrRo',
      '.oRrrrrrRo.',
      '..oRrrrRo..',
      '...oRRo....',
      '....oo.....',
    ];
    drawPixels(ctx, x, y, scale, lines, palette);
  }

  // ============ MANITOU (mini-excavadora) ============
  // Cabina amarilla, brazo articulado en dos segmentos según armAngle.
  function drawManitou(ctx, x, y, scale, armAngle) {
    const s = scale;

    // Chasis
    fillRect(ctx, x,            y + 18 * s, 30 * s, 6 * s, '#1a1a1a');
    fillRect(ctx, x,            y + 24 * s, 30 * s, 2 * s, '#000000');

    // Sombras debajo del chasis
    fillRect(ctx, x - 2 * s,    y + 26 * s, 34 * s, 2 * s, 'rgba(0,0,0,0.35)');

    // Ruedas (3 pequeñas)
    drawWheel(ctx, x + 2 * s,  y + 22 * s, s);
    drawWheel(ctx, x + 13 * s, y + 22 * s, s);
    drawWheel(ctx, x + 24 * s, y + 22 * s, s);

    // Cabina (amarilla brillante)
    fillRect(ctx, x + 5 * s, y + 6 * s,  18 * s, 12 * s, '#f5c518');
    fillRect(ctx, x + 5 * s, y + 6 * s,  18 * s, 2 * s,  '#fce370'); // highlight superior
    fillRect(ctx, x + 5 * s, y + 17 * s, 18 * s, 1 * s,  '#a0780c'); // sombra inferior
    // Cristal
    fillRect(ctx, x + 8 * s,  y + 8 * s,  11 * s, 6 * s, '#52b8d8');
    fillRect(ctx, x + 8 * s,  y + 8 * s,  11 * s, 1 * s, '#a8e8ff'); // reflejo
    // Marco cristal
    fillRect(ctx, x + 8 * s,  y + 8 * s,  1 * s, 6 * s, '#1c1c1c');
    fillRect(ctx, x + 18 * s, y + 8 * s,  1 * s, 6 * s, '#1c1c1c');
    fillRect(ctx, x + 8 * s,  y + 14 * s, 11 * s, 1 * s, '#1c1c1c');
    // "MANITOU"
    fillRect(ctx, x + 7 * s,  y + 16 * s, 14 * s, 1 * s, '#000000');

    // Brazo articulado
    ctx.save();
    ctx.translate(x + 22 * s, y + 12 * s);
    ctx.rotate(-armAngle);
    fillRect(ctx, 0, -1 * s, 18 * s, 3 * s, '#f5c518');
    fillRect(ctx, 0, -1 * s, 18 * s, 1 * s, '#fce370');
    fillRect(ctx, 0, 2 * s,  18 * s, 1 * s, '#a0780c');

    ctx.translate(18 * s, 0);
    // pivote
    fillRect(ctx, -1 * s, -2 * s, 3 * s, 4 * s, '#222');
    ctx.rotate(armAngle * 1.3);
    fillRect(ctx, 0, -1 * s, 12 * s, 3 * s, '#f5c518');
    fillRect(ctx, 0, -1 * s, 12 * s, 1 * s, '#fce370');
    fillRect(ctx, 0, 2 * s,  12 * s, 1 * s, '#a0780c');

    ctx.translate(12 * s, 0);
    // Pala/cuchara
    fillRect(ctx, -1 * s, -3 * s, 6 * s, 7 * s, '#9a9a9a');
    fillRect(ctx, -1 * s, -3 * s, 6 * s, 1 * s, '#d0d0d0');
    fillRect(ctx, -1 * s,  3 * s, 6 * s, 1 * s, '#5a5a5a');
    fillRect(ctx,  4 * s, -3 * s, 1 * s, 7 * s, '#5a5a5a');

    ctx.restore();
  }

  function drawWheel(ctx, cx, cy, s) {
    fillRect(ctx, cx - 3 * s, cy - 3 * s, 6 * s, 6 * s, '#1a1a1a');
    fillRect(ctx, cx - 2 * s, cy - 2 * s, 4 * s, 4 * s, '#3a3a3a');
    fillRect(ctx, cx - 1 * s, cy - 1 * s, 2 * s, 2 * s, '#1a1a1a');
  }

  window.Characters = {
    drawPedrito,
    drawMarian,
    drawKikeVader,
    drawSaber,
    drawXwing,
    drawTie,
    drawManitou,
    drawHeart,
    drawPixels,
  };
})();
