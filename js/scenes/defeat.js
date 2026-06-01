// Pantalla final de derrota: sala oscura con luces rojas, Kike Vader avanza
// hacia Marian, beso fatídico, mensaje GAME OVER.
(function () {
  'use strict';

  const W = 360, H = 640;

  let t, phase, stars;

  function enter() {
    t = 0;
    phase = 0;
    stars = window.Stars.createField({ width: W, height: H, count: 50, speed: 4 });
    window.Audio8.sfx('lose');
    window.Effects.reset();
  }

  function update(dt) {
    t += dt;
    stars.update(dt);
    window.Effects.update(dt);

    if (t > 1.5 && phase === 0) phase = 1;
    if (t > 3.5 && phase === 1) phase = 2;

    if (phase === 2 && window.Input.actionJustPressed()) {
      window.GameState.reset();
      window.Loop.setScene('INTRO_CRAWL');
    }
  }

  function render(ctx) {
    // Gradiente oscuro púrpura/rojo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0008');
    g.addColorStop(0.5, '#1a0010');
    g.addColorStop(1, '#2a0418');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Estrellas tenues por una ventana arriba
    ctx.save();
    ctx.beginPath();
    ctx.rect(30, 30, W - 60, 80);
    ctx.clip();
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, W, 200);
    stars.render(ctx);
    ctx.restore();
    ctx.strokeStyle = '#3a1a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, W - 60, 80);

    // Lámparas rojas a los lados
    drawLamp(ctx, 20, 160, t);
    drawLamp(ctx, W - 30, 160, t + 0.5);

    // Suelo
    ctx.fillStyle = '#2a0a18';
    ctx.fillRect(0, H - 200, W, 200);
    ctx.fillStyle = '#5a1828';
    ctx.fillRect(0, H - 200, W, 3);
    // baldosas
    ctx.fillStyle = '#1a0610';
    for (let x = 0; x < W; x += 28) ctx.fillRect(x, H - 200, 24, 2);

    // Marian (estática, a la izquierda)
    const marianX = 100;
    const marianY = H - 240;
    window.Characters.drawMarian(ctx, marianX, marianY, 2);

    // Kike avanza desde la derecha
    const kikeXBase = W - 100;
    const kikeX = Math.max(marianX + 38, kikeXBase - Math.min(70, t * 28));
    window.Characters.drawKikeVader(ctx, kikeX, marianY, 2);

    // Beso
    if (phase >= 1) {
      ctx.save();
      ctx.fillStyle = '#ff3a6a';
      ctx.font = '22px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const bx = (marianX + 16 + kikeX + 16) / 2;
      const by = marianY - 6 + Math.sin(t * 8) * 2;
      // halo
      ctx.shadowColor = '#ff80a0';
      ctx.shadowBlur = 14;
      ctx.fillText('♥', bx, by);
      ctx.restore();
    }

    if (phase >= 1) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#aa1030';
      ctx.shadowColor = '#ff4060';
      ctx.shadowBlur = 8;
      ctx.font = '52px serif';
      ctx.textAlign = 'center';
      ctx.fillText('💔', W / 2, 250);
      ctx.restore();
    }

    // GAME OVER
    ctx.fillStyle = '#ffe81f';
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText('GAME OVER', W / 2, 140);
    ctx.shadowBlur = 0;

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    if (phase >= 1) ctx.fillText('KIKE VADER BESÓ A MARIAN', W / 2, 170);
    if (phase >= 2) {
      ctx.fillStyle = '#ffe81f';
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillText('TOCA O ENTER PARA REINTENTAR', W / 2, H - 60);
      }
    }
    ctx.textAlign = 'left';

    window.Effects.render(ctx);
  }

  function drawLamp(ctx, x, y, phase) {
    const flicker = 0.7 + Math.sin(phase * 8) * 0.3;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 26);
    grad.addColorStop(0, `rgba(255,80,80,${(flicker * 0.85).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 26, y - 26, 52, 52);
    ctx.fillStyle = '#3a0808';
    ctx.fillRect(x - 4, y - 2, 8, 6);
    ctx.fillStyle = `rgba(255,80,80,${flicker.toFixed(2)})`;
    ctx.fillRect(x - 3, y, 6, 3);
  }

  window.Loop.register('DEFEAT', { enter, update, render });
})();
