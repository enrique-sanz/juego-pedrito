// Dibujo por código de los personajes y vehículos. Centralizado para sustituir
// cómodamente por sprites/imágenes reales cuando el usuario las proporcione.
(function () {
  'use strict';

  function fillRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w, h);
  }

  // Pixel-art helper: dibuja una matriz de píxeles definida como string.
  // `.` = transparente. Cualquier otro caracter usa el mapeo `palette[char]`.
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

  // -------- PEDRITO --------
  // Cara redonda, pelo castaño, túnica Jedi marrón claro, sable verde.
  const PEDRITO_PIXELS = [
    '..hhhhhh..',
    '.hhcccchh.',
    '.hccccccc.',
    '.cffccffc.',  // ojos
    '.cccccccc.',
    '.cccmmccc.',  // boca
    '..cccccc..',
    'bbttttttbb',  // hombros túnica
    'btttttttbb',
    'btttbbtttb',
    'tttbbbbttt',
    '.tt.bb.tt.',
    '..t.bb.t..',
    '....bb....',
  ];
  const PEDRITO_PALETTE = {
    h: '#5a2f12', // pelo
    c: '#f1c27d', // piel
    f: '#1d1d1d', // ojos
    m: '#7a2c1e', // boca
    t: '#a76a3a', // túnica
    b: '#6e3f1a', // detalle túnica
  };

  function drawPedrito(ctx, x, y, scale = 2, facing = 'front') {
    drawPixels(ctx, x, y, scale, PEDRITO_PIXELS, PEDRITO_PALETTE);
  }

  // -------- MARIAN --------
  // Pelo largo claro, vestido azul, cara dulce.
  const MARIAN_PIXELS = [
    '..gggggg..',
    '.ggggcccg.',
    'gcccccccc.',
    'gcffccffcg',
    'gcccccccc.',
    'gcccmmccc.',
    '.gccccccg.',
    '.aaaaaaaa.',
    'aaaaaaaaaa',
    'aaaaaaaaaa',
    'aabbbbaaaa',  // detalle vestido
    '.aaaaaaaa.',
    '.aa....aa.',
    '..a....a..',
  ];
  const MARIAN_PALETTE = {
    g: '#d8b85e', // pelo rubio
    c: '#fcd8a8',
    f: '#1d1d1d',
    m: '#b03a52',
    a: '#3866b8', // vestido azul
    b: '#2147a2',
  };

  function drawMarian(ctx, x, y, scale = 2) {
    drawPixels(ctx, x, y, scale, MARIAN_PIXELS, MARIAN_PALETTE);
  }

  // -------- KIKE VADER --------
  // Casco oscuro estilo Vader, capa negra. Aún sin imagen real.
  const KIKE_PIXELS = [
    '..kkkkkk..',
    '.kkkkkkkk.',
    'kkkrrrrkkk',  // ojos rojos
    'kkrrrrrrkk',
    'kkkkkkkkkk',
    'kkkkkkkkkk',
    'kkkwkwwkwk',  // rejilla bucal
    '.kkkkkkkk.',
    'cckkkkkkcc',
    'ccckkkkccc',
    'ccccccccc.',
    '.ccc..ccc.',
    '..cc..cc..',
    '..cc..cc..',
  ];
  const KIKE_PALETTE = {
    k: '#161616',
    r: '#ff2a2a',
    w: '#999',
    c: '#2a2a2a',
  };

  function drawKikeVader(ctx, x, y, scale = 2) {
    drawPixels(ctx, x, y, scale, KIKE_PIXELS, KIKE_PALETTE);
  }

  // -------- SABLE LÁSER --------
  function drawSaber(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.lineCap = 'round';
    // Glow exterior
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    // Núcleo blanco
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    // Empuñadura
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const dx = x1 - x2, dy = y1 - y2;
    const len = Math.hypot(dx, dy) || 1;
    ctx.lineTo(x1 + dx / len * 8, y1 + dy / len * 8);
    ctx.stroke();
    ctx.restore();
  }

  // -------- NAVE DE PEDRITO (X-wing simplificado) --------
  function drawXwing(ctx, x, y, scale = 2) {
    const lines = [
      '....w....',
      '...www...',
      '..wwwww..',
      'g.wwbww.g',
      'gggwwwggg',
      'g.wwwww.g',
      '...www...',
      '..w.w.w..',
    ];
    const palette = { w: '#d6d6d6', g: '#888', b: '#ff4040' };
    drawPixels(ctx, x, y, scale, lines, palette);
  }

  // -------- CAZA TIE --------
  function drawTie(ctx, x, y, scale = 2) {
    const lines = [
      'h.....h',
      'h.www.h',
      'hwwwwwh',
      'h.www.h',
      'h.....h',
    ];
    const palette = { h: '#444', w: '#9d9d9d' };
    drawPixels(ctx, x, y, scale, lines, palette);
  }

  // -------- MANITOU (mini-excavadora) --------
  // Vista lateral muy simplificada con cabina amarilla, brazo articulado y pala.
  function drawManitou(ctx, x, y, scale = 2, armAngle = 0.4) {
    // Cuerpo / chasis
    fillRect(ctx, x, y + 18 * scale, 28 * scale, 6 * scale, '#1a1a1a');
    // Ruedas
    fillRect(ctx, x + 2 * scale, y + 24 * scale, 6 * scale, 4 * scale, '#222');
    fillRect(ctx, x + 20 * scale, y + 24 * scale, 6 * scale, 4 * scale, '#222');
    // Cabina amarilla
    fillRect(ctx, x + 6 * scale, y + 8 * scale, 16 * scale, 10 * scale, '#f5c518');
    // Cristal
    fillRect(ctx, x + 9 * scale, y + 10 * scale, 10 * scale, 5 * scale, '#7ad7f0');
    // Logo
    fillRect(ctx, x + 8 * scale, y + 16 * scale, 4 * scale, 1 * scale, '#000');

    // Brazo articulado: dos segmentos según armAngle
    ctx.save();
    ctx.translate(x + 22 * scale, y + 14 * scale);
    ctx.rotate(-armAngle);
    fillRect(ctx, 0, -1 * scale, 18 * scale, 2 * scale, '#f5c518');
    ctx.translate(18 * scale, 0);
    ctx.rotate(armAngle * 1.3);
    fillRect(ctx, 0, -1 * scale, 12 * scale, 2 * scale, '#f5c518');
    // Pala (cuchara) al final
    ctx.translate(12 * scale, 0);
    fillRect(ctx, -1 * scale, -2 * scale, 5 * scale, 6 * scale, '#a0a0a0');
    ctx.restore();
  }

  // -------- CORAZÓN (UI vidas) --------
  function drawHeart(ctx, x, y, scale = 1, full = true) {
    const color = full ? '#ff2a2a' : '#403030';
    const lines = [
      '.rr.rr.',
      'rrrrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..rrr..',
      '...r...',
    ];
    drawPixels(ctx, x, y, scale, lines, { r: color });
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
