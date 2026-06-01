// Pantallas narrativas entre minijuegos. Texto puente con tono de historia.
(function () {
  'use strict';

  const W = 360, H = 640;

  const SCRIPTS = {
    NARRATIVE_1: {
      next: 'INVADERS',
      title: 'CAPÍTULO I',
      lines: [
        'Pedrito surca el espacio',
        'rumbo a la Estrella de Kike.',
        'De pronto, una flota de',
        'cazas TIE le cierra el paso.',
        '',
        'Solo su nave y sus reflejos',
        'pueden abrirle camino.',
      ],
    },
    NARRATIVE_2: {
      next: 'RACING',
      title: 'CAPÍTULO II',
      lines: [
        'Tras la batalla, Pedrito',
        'se cuela en la trinchera',
        'de la Estrella enemiga.',
        '',
        'Hay que volar rápido,',
        'esquivar el fuego enemigo',
        'y llegar al núcleo.',
      ],
    },
    NARRATIVE_3: {
      next: 'COMPACTOR',
      title: 'CAPÍTULO III',
      lines: [
        'Algo falla. Pedrito cae',
        'en un compactador de basura.',
        '',
        'Las paredes se acercan.',
        'Hay que golpear los puntos',
        'débiles antes del aplastamiento.',
      ],
    },
    NARRATIVE_4: {
      next: 'LIGHTSABER',
      title: 'CAPÍTULO IV',
      lines: [
        'Por fin, frente a frente.',
        'Kike Vader y su sable rojo.',
        'Marian observa, atrapada.',
        '',
        'Si Pedrito pierde, ella',
        'será besada por el villano.',
        '',
        'Que la Fuerza le acompañe.',
      ],
    },
  };

  function createNarrative(key) {
    let timer, alpha;
    let stars;

    function enter() {
      timer = 0;
      alpha = 0;
      stars = window.Stars.createField({ width: W, height: H, count: 50, speed: 10 });
    }

    function update(dt) {
      timer += dt;
      alpha = Math.min(1, timer / 0.8);
      stars.update(dt);

      if (timer > 1.0 && window.Input.pointer.justPressed) {
        window.Loop.setScene(SCRIPTS[key].next);
      }
    }

    function render(ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      stars.render(ctx);

      const cfg = SCRIPTS[key];

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.fillStyle = '#ffe81f';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.title, W / 2, 80);

      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#fff';
      for (let i = 0; i < cfg.lines.length; i++) {
        ctx.fillText(cfg.lines[i], W / 2, 140 + i * 22);
      }

      // Llamada a la acción parpadeante
      if (Math.floor(timer * 2) % 2 === 0 && timer > 1.0) {
        ctx.fillStyle = '#ffe81f';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText('TOCA PARA CONTINUAR', W / 2, H - 60);
      }

      // HUD de vidas
      drawLives(ctx);

      ctx.restore();
    }

    return { enter, update, render };
  }

  function drawLives(ctx) {
    const s = window.GameState.state;
    for (let i = 0; i < s.maxLives; i++) {
      window.Characters.drawHeart(ctx, 10 + i * 12, 12, 1.5, i < s.lives);
    }
    if (s.infiniteLives) {
      ctx.fillStyle = '#ffe81f';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('∞', 10 + s.maxLives * 12 + 2, 24);
    }
  }

  Object.keys(SCRIPTS).forEach(key => {
    window.Loop.register(key, createNarrative(key));
  });

  window.NarrativeHUD = { drawLives };
})();
