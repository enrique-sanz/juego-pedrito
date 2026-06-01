// Pantalla final de derrota: cinemática corta donde Kike Vader se acerca a
// Marian y la besa con un gran corazón roto sobre la escena.
(function () {
  'use strict';

  const W = 360, H = 640;

  let t, phase, stars;

  function enter() {
    t = 0;
    phase = 0;
    stars = window.Stars.createField({ width: W, height: H, count: 40, speed: 6 });
    window.Audio8.sfx('lose');
  }

  function update(dt) {
    t += dt;
    stars.update(dt);

    if (t > 1.5 && phase === 0) phase = 1;
    if (t > 3.5 && phase === 1) phase = 2;

    if (phase === 2 && window.Input.pointer.justPressed) {
      window.GameState.reset();
      window.Loop.setScene('INTRO_CRAWL');
    }
  }

  function render(ctx) {
    ctx.fillStyle = '#1a0010';
    ctx.fillRect(0, 0, W, H);
    stars.render(ctx);

    // Suelo
    ctx.fillStyle = '#2a1020';
    ctx.fillRect(0, H - 200, W, 200);

    // Marian a la izquierda
    const marianX = 100;
    const marianY = H - 260;
    window.Characters.drawMarian(ctx, marianX, marianY, 2);

    // Kike avanza desde la derecha hacia Marian con el tiempo
    const kikeX = Math.max(160, W - 80 - Math.min(80, t * 30));
    window.Characters.drawKikeVader(ctx, kikeX, marianY, 2);

    // Beso (fase 1+)
    if (phase >= 1) {
      ctx.fillStyle = '#ff3a6a';
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const bx = (marianX + 10 + kikeX + 10) / 2;
      const by = marianY - 6 + Math.sin(t * 8) * 2;
      ctx.fillText('♥', bx, by);
      ctx.textAlign = 'left';
    }

    // Corazón roto
    if (phase >= 1) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#aa1030';
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.fillText('💔', W / 2, 200);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // Texto
    ctx.fillStyle = '#ffe81f';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, 80);

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    if (phase >= 1) ctx.fillText('KIKE VADER BESÓ A MARIAN', W / 2, 110);
    if (phase >= 2) {
      ctx.fillStyle = '#ffe81f';
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillText('TOCA PARA REINTENTAR', W / 2, H - 60);
      }
    }
    ctx.textAlign = 'left';
  }

  window.Loop.register('DEFEAT', { enter, update, render });
})();
