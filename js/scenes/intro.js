// Crawl introductorio estilo Star Wars con punto de fuga real en el borde
// superior, fondo de nebulosa y estrellas en parallax (2 capas).
(function () {
  'use strict';

  const W = 360, H = 640;

  let starsFar, starsNear;
  let nebula;
  let lines, scrollY, finished, fetchedOnce;
  let logoAlpha, t;

  const FALLBACK = [
    'Hace mucho tiempo, en una galaxia',
    'muy, muy lejana...',
    '',
    'EPISODIO PEDRITO',
    '',
    'KIKE VADER amenaza con besar a',
    'MARIAN si nadie es capaz de',
    'detenerlo. Solo PEDRITO puede',
    'salvar a su amada.',
    '',
    'Armado con su sable y un corazón',
    'valiente, cruzará flotas enemigas,',
    'trincheras imposibles y trampas',
    'mortales para enfrentarse cara',
    'a cara con el villano.',
    '',
    'Que la Fuerza... y un buen Manitou,',
    'le acompañen.',
  ];

  function enter() {
    starsFar  = window.Stars.createField({ width: W, height: H, count: 60, speed: 4 });
    starsNear = window.Stars.createField({ width: W, height: H, count: 25, speed: 14 });
    nebula = buildNebula();
    lines = FALLBACK.slice();
    // El crawl arranca con todas las líneas debajo del borde inferior.
    scrollY = H + 80;
    finished = false;
    logoAlpha = 1;
    t = 0;
    fetchedOnce = false;
    loadStory();
    window.Audio8.startTheme();
  }

  function exit() {
    window.Audio8.stopTheme();
  }

  function loadStory() {
    fetch('story/intro.txt')
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        const parsed = text.replace(/\r/g, '').split('\n');
        if (parsed.length) lines = parsed;
        fetchedOnce = true;
      })
      .catch(() => { /* fallback ya cargado */ });
  }

  function buildNebula() {
    // Manchas de nebulosa estáticas (precomputadas) para no allocate en runtime
    const blobs = [];
    const palette = ['#1b1042', '#3a1660', '#7a2255', '#2b1a55'];
    for (let i = 0; i < 8; i++) {
      blobs.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 80 + Math.random() * 160,
        c: palette[(Math.random() * palette.length) | 0],
        a: 0.10 + Math.random() * 0.12,
      });
    }
    return blobs;
  }

  function update(dt) {
    t += dt;
    starsFar.update(dt);
    starsNear.update(dt);

    if (logoAlpha > 0) logoAlpha = Math.max(0, logoAlpha - dt * 0.4);

    // Velocidad del crawl: lo suficientemente lenta para leer
    const speed = 26;
    scrollY -= speed * dt;

    // El crawl termina cuando la ÚLTIMA línea ha pasado por el punto de fuga.
    const lastBaseY = scrollY + (lines.length - 1) * BASE_LINE_H;
    if (lastBaseY < VP_Y - 4) {
      finished = true;
    }

    if (window.Input.actionJustPressed()) {
      finished = true;
    }

    if (finished) {
      window.Loop.setScene('NARRATIVE_1');
    }
  }

  const VP_Y = -24;          // punto de fuga (encima del borde superior)
  const BOTTOM_REF = H;       // posición de referencia para escala 1.0
  const BASE_LINE_H = 26;

  function render(ctx) {
    // Fondo negro espacial
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, W, H);

    // Nebulosa difusa
    ctx.save();
    for (const b of nebula) {
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grad.addColorStop(0, b.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = b.a;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // Estrellas (parallax)
    starsFar.render(ctx);
    starsNear.render(ctx);

    // Logo inicial: "Una galaxia lejana..."
    if (logoAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = logoAlpha;
      ctx.fillStyle = '#71b8ff';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Hace mucho tiempo, en una', W / 2, H / 2 - 8);
      ctx.fillText('galaxia muy, muy lejana...', W / 2, H / 2 + 12);
      ctx.restore();
    }

    // Crawl con perspectiva real: punto de fuga en VP_Y, escala = (y-VP)/(BOTTOM-VP).
    // Las líneas se renderizan desde la más cercana (abajo) a la más lejana
    // (arriba), por lo que al llegar al punto de fuga quedan minúsculas pero
    // siguen visibles hasta desaparecer.
    ctx.save();
    ctx.textAlign = 'center';

    for (let i = 0; i < lines.length; i++) {
      const baseY = scrollY + i * BASE_LINE_H;
      if (baseY > H + BASE_LINE_H) continue;
      const rel = (baseY - VP_Y) / (BOTTOM_REF - VP_Y);
      if (rel <= 0.02) continue;
      const scale = Math.min(1.25, rel);
      const alpha = Math.min(1, rel * 1.6);

      ctx.save();
      ctx.translate(W / 2, baseY);
      ctx.scale(scale, scale * 0.92);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffe81f';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText(lines[i] || ' ', 0, 0);
      // Sombra suave bajo el texto para dar volumen
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = '#7a6a10';
      ctx.fillText(lines[i] || ' ', 0, 2);
      ctx.restore();
    }
    ctx.restore();

    // Marca para saltar la intro (apenas visible, no estorba)
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    if (Math.floor(t * 1.4) % 2 === 0) {
      ctx.fillText('TOCA O ENTER PARA SALTAR', W / 2, H - 10);
    }
    ctx.restore();
  }

  window.Loop.register('INTRO_CRAWL', { enter, exit, update, render });
})();
