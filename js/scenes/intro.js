// Crawl introductorio estilo Star Wars: texto subiendo con perspectiva sobre
// un fondo estrellado. Se carga el texto desde story/intro.txt.
(function () {
  'use strict';

  const W = 360, H = 640;
  let stars, lines, scrollY, finished, fetchedOnce;
  let logoAlpha, logoScale;

  const FALLBACK = [
    'Hace mucho tiempo, en una galaxia',
    'muy, muy lejana...',
    '',
    'EPISODIO PEDRITO',
    '',
    'KIKE VADER amenaza con besar a',
    'MARIAN si no es detenido. Solo',
    'PEDRITO puede salvarla.',
    '',
    'Que la Fuerza le acompañe.',
  ];

  function enter() {
    stars = window.Stars.createField({ width: W, height: H, count: 80, speed: 12 });
    lines = FALLBACK.slice();
    scrollY = H + 40;
    finished = false;
    logoAlpha = 1;
    logoScale = 1;
    fetchedOnce = false;
    loadStory();
    window.Audio8.startTheme();
  }

  function exit() {
    // El tema sigue sonando durante NARRATIVE_1 hasta el primer minijuego,
    // pero lo cortamos aquí para evitar solaparlo con SFX en gameplay.
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

  function update(dt) {
    stars.update(dt);

    // Logo se desvanece tras un par de segundos
    if (logoAlpha > 0) logoAlpha = Math.max(0, logoAlpha - dt * 0.5);

    // Velocidad del crawl
    const speed = 22;
    scrollY -= speed * dt;
    const totalHeight = lines.length * 22;
    if (scrollY < -totalHeight - 50) {
      finished = true;
    }

    // Permitir saltarse la intro con tap o tecla
    if (window.Input.actionJustPressed()) {
      finished = true;
    }

    if (finished) {
      window.Loop.setScene('NARRATIVE_1');
    }
  }

  function render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    stars.render(ctx);

    // Logo amarillo "EPISODIO PEDRITO"
    if (logoAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = logoAlpha;
      ctx.fillStyle = '#ffe81f';
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('UNA GALAXIA', W / 2, H / 2 - 24);
      ctx.fillText('LEJANA...', W / 2, H / 2 + 8);
      ctx.restore();
    }

    // Crawl con perspectiva: las líneas más cercanas a la cima se hacen más
    // pequeñas. Usamos un transform de tipo "1 / (1 + y/k)".
    ctx.save();
    ctx.fillStyle = '#ffe81f';
    ctx.textAlign = 'center';

    const lineH = 22;
    for (let i = 0; i < lines.length; i++) {
      const baseY = scrollY + i * lineH;
      if (baseY < -lineH || baseY > H + lineH) continue;

      // Coordenada normalizada respecto al horizonte (alto = H * 0.35)
      const horizon = H * 0.4;
      const rel = (baseY - horizon) / (H - horizon);
      if (rel <= 0.02) continue;
      const scale = Math.min(1.2, Math.max(0.1, rel));

      ctx.save();
      ctx.translate(W / 2, baseY);
      ctx.scale(scale, scale * 0.9);
      ctx.globalAlpha = Math.min(1, rel * 1.6);
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffe81f';
      ctx.fillText(lines[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Sugerencia de tap
    ctx.save();
    ctx.fillStyle = 'rgba(255,232,31,0.6)';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TOCA PARA SALTAR', W / 2, H - 16);
    ctx.restore();
  }

  window.Loop.register('INTRO_CRAWL', { enter, exit, update, render });
})();
