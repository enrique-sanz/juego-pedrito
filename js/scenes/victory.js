// Pantalla final victoriosa: Pedrito sube al Manitou, cava un hoyo, empuja a
// Kike Vader y lo entierra. Finalmente se reúne con Marian.
(function () {
  'use strict';

  const W = 360, H = 640;

  // Fases:
  //  0: llegada del Manitou desde la izquierda
  //  1: cavar hoyo (brazo arriba-abajo varias veces)
  //  2: empujar a Kike al hoyo
  //  3: tapar el hoyo
  //  4: Pedrito baja, abraza a Marian
  //  5: fin con texto "¡Felicidades!"

  const PHASES = [
    { name: 'arrive',  dur: 3 },
    { name: 'dig',     dur: 4 },
    { name: 'push',    dur: 2.5 },
    { name: 'bury',    dur: 2.5 },
    { name: 'hug',     dur: 3 },
    { name: 'credits', dur: 999 },
  ];

  let t, phaseIdx, manitouX, armAngle, holeDepth, kikeX, kikeY, kikeInHole;
  let confetti, pedOnManitou, hugY;

  function enter() {
    t = 0;
    phaseIdx = 0;
    manitouX = -120;
    armAngle = 0.5;
    holeDepth = 0;
    kikeX = W * 0.6;
    kikeY = H - 220;
    kikeInHole = false;
    confetti = [];
    pedOnManitou = true;
    hugY = 0;
    window.Audio8.startTheme();
  }

  function exit() {
    window.Audio8.stopTheme();
  }

  function update(dt) {
    t += dt;
    const phase = PHASES[phaseIdx];
    const localT = t - sumPhasesBefore(phaseIdx);

    if (phase.name === 'arrive') {
      manitouX = lerp(-120, 80, easeOut(localT / phase.dur));
    } else if (phase.name === 'dig') {
      // brazo sube y baja
      armAngle = 0.5 + Math.sin(localT * 6) * 0.6;
      holeDepth = Math.min(40, holeDepth + 14 * dt);
      if (Math.floor(localT * 6) !== Math.floor((localT - dt) * 6)) {
        window.Audio8.sfx('hit');
      }
    } else if (phase.name === 'push') {
      manitouX = lerp(80, 150, easeOut(localT / phase.dur));
      // Kike es empujado hacia el hoyo (centro X ~ 200)
      kikeX = lerp(W * 0.6, 200, easeOut(localT / phase.dur));
      if (localT >= phase.dur - 0.05) {
        kikeInHole = true;
        kikeY = H - 180;
      }
    } else if (phase.name === 'bury') {
      // el brazo cubre con tierra
      armAngle = 0.5 + Math.sin(localT * 8) * 0.5;
      holeDepth = Math.max(0, holeDepth - 18 * dt);
      if (Math.floor(localT * 5) !== Math.floor((localT - dt) * 5)) {
        window.Audio8.sfx('hit');
      }
    } else if (phase.name === 'hug') {
      manitouX = lerp(150, 220, easeOut(localT / phase.dur));
      pedOnManitou = false;
      hugY = lerp(H - 220, H - 240, easeOut(localT / phase.dur));
      // confetti
      if (Math.random() < 0.5) {
        confetti.push({
          x: Math.random() * W,
          y: -10,
          vx: (Math.random() - 0.5) * 30,
          vy: 30 + Math.random() * 80,
          c: pickConfettiColor(),
          s: 2 + Math.random() * 2,
        });
      }
    } else if (phase.name === 'credits') {
      if (Math.random() < 0.4) {
        confetti.push({
          x: Math.random() * W, y: -10,
          vx: (Math.random() - 0.5) * 30,
          vy: 30 + Math.random() * 80,
          c: pickConfettiColor(),
          s: 2 + Math.random() * 2,
        });
      }
      // Cualquier tap o tecla reinicia
      if (window.Input.actionJustPressed()) {
        window.GameState.reset();
        window.Loop.setScene('INTRO_CRAWL');
        return;
      }
    }

    // Actualizar confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y > H + 8) confetti.splice(i, 1);
    }

    if (localT >= phase.dur && phaseIdx < PHASES.length - 1) {
      phaseIdx++;
    }
  }

  function sumPhasesBefore(idx) {
    let s = 0;
    for (let i = 0; i < idx; i++) s += PHASES[i].dur;
    return s;
  }

  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  function easeOut(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }

  function pickConfettiColor() {
    const palette = ['#ffe81f', '#3aff60', '#ff3a3a', '#3a8aff', '#fff'];
    return palette[(Math.random() * palette.length) | 0];
  }

  function render(ctx) {
    // Cielo atardecer
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1245');
    g.addColorStop(0.6, '#7a3a4a');
    g.addColorStop(1, '#e0985a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soles (sí, dos, estamos en Tatooine)
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.arc(W * 0.7, H * 0.35, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffc070';
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.42, 14, 0, Math.PI * 2);
    ctx.fill();

    // Suelo
    ctx.fillStyle = '#c87a3a';
    ctx.fillRect(0, H - 160, W, 160);
    ctx.fillStyle = '#8a4e1c';
    ctx.fillRect(0, H - 160, W, 4);

    // Hoyo
    if (holeDepth > 0 || kikeInHole) {
      ctx.fillStyle = '#3a1f0a';
      ctx.fillRect(180, H - 160, 50, 12 + holeDepth);
    }

    // Marian a la derecha
    window.Characters.drawMarian(ctx, W - 80, H - 240, 2);

    // Kike Vader
    if (!kikeInHole) {
      window.Characters.drawKikeVader(ctx, kikeX, kikeY, 2);
    } else if (holeDepth > 2) {
      // todavía visible en el hoyo
      ctx.save();
      ctx.beginPath();
      ctx.rect(180, H - 160, 50, 12 + holeDepth);
      ctx.clip();
      window.Characters.drawKikeVader(ctx, 188, H - 170, 1.8);
      ctx.restore();
    }

    // Manitou
    window.Characters.drawManitou(ctx, manitouX, H - 220, 2, armAngle);

    // Pedrito: subido al Manitou en fases 0-3, abrazando a Marian en 4-5
    if (pedOnManitou) {
      window.Characters.drawPedrito(ctx, manitouX + 18, H - 250, 1.6);
    } else {
      // Pedrito al lado de Marian
      window.Characters.drawPedrito(ctx, W - 100, hugY, 2);
      // corazoncito flotante entre ambos
      ctx.fillStyle = '#ff5a7a';
      const hy = hugY - 14 + Math.sin(t * 4) * 2;
      window.Characters.drawHeart(ctx, W - 90, hy, 1.5, true);
    }

    // Confetti
    for (const c of confetti) {
      ctx.fillStyle = c.c;
      ctx.fillRect(c.x | 0, c.y | 0, c.s, c.s);
    }

    // Mensaje final
    const phase = PHASES[phaseIdx];
    if (phase.name === 'credits') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 60, W, 110);
      ctx.fillStyle = '#ffe81f';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡FELICIDADES!', W / 2, 100);
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('PEDRITO HA SALVADO', W / 2, 130);
      ctx.fillText('A MARIAN', W / 2, 148);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('TOCA O PULSA ENTER', W / 2, 180);
      ctx.textAlign = 'left';
    }
  }

  window.Loop.register('VICTORY', { enter, exit, update, render });
})();
