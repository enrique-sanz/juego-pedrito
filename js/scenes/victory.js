// Pantalla final victoriosa: atardecer Tatooine con dos soles, Pedrito a los
// mandos del Manitou cavando un hoyo y enterrando a Kike Vader, reunión con
// Marian y confeti. Estética 16-bit.
(function () {
  'use strict';

  const W = 360, H = 640;

  const PHASES = [
    { name: 'arrive',  dur: 3 },
    { name: 'dig',     dur: 4 },
    { name: 'push',    dur: 2.5 },
    { name: 'bury',    dur: 2.5 },
    { name: 'hug',     dur: 3 },
    { name: 'credits', dur: 999 },
  ];

  let t, phaseIdx, manitouX, armAngle, holeDepth, kikeX, kikeY, kikeInHole;
  let confetti, pedOnManitou, hugX, hugY, marianX, marianY;
  let dustT;

  function enter() {
    t = 0;
    phaseIdx = 0;
    manitouX = -130;
    armAngle = 0.5;
    holeDepth = 0;
    kikeX = W * 0.6;
    kikeY = H - 200;
    kikeInHole = false;
    confetti = [];
    pedOnManitou = true;
    marianX = W - 80;
    marianY = H - 200;
    hugX = marianX - 32;
    hugY = marianY;
    dustT = 0;
    window.Audio8.startTheme();
    window.Effects.reset();
  }

  function exit() { window.Audio8.stopTheme(); }

  function update(dt) {
    t += dt;
    window.Effects.update(dt);
    const phase = PHASES[phaseIdx];
    const localT = t - sumPhasesBefore(phaseIdx);

    if (phase.name === 'arrive') {
      manitouX = lerp(-130, 90, easeOut(localT / phase.dur));
    } else if (phase.name === 'dig') {
      armAngle = 0.5 + Math.sin(localT * 6) * 0.7;
      holeDepth = Math.min(46, holeDepth + 14 * dt);
      // golpes y polvo a cada bajada del brazo
      if (Math.floor(localT * 6) !== Math.floor((localT - dt) * 6)) {
        window.Audio8.sfx('hit');
        window.Effects.dust(W * 0.58, H - 162, { count: 10, speed: 60 });
      }
    } else if (phase.name === 'push') {
      manitouX = lerp(90, 170, easeOut(localT / phase.dur));
      kikeX = lerp(W * 0.6, W * 0.56, easeOut(localT / phase.dur));
      if (localT >= phase.dur - 0.05) {
        kikeInHole = true;
        kikeY = H - 160;
      }
    } else if (phase.name === 'bury') {
      armAngle = 0.5 + Math.sin(localT * 8) * 0.5;
      holeDepth = Math.max(0, holeDepth - 18 * dt);
      if (Math.floor(localT * 5) !== Math.floor((localT - dt) * 5)) {
        window.Audio8.sfx('hit');
        window.Effects.dust(W * 0.56, H - 152, { count: 8 });
      }
    } else if (phase.name === 'hug') {
      manitouX = lerp(170, 240, easeOut(localT / phase.dur));
      pedOnManitou = false;
      hugX = lerp(W * 0.5, marianX - 32, easeOut(localT / phase.dur));
      hugY = marianY;
      if (Math.random() < 0.6) confetti.push(makeConfetti());
    } else if (phase.name === 'credits') {
      if (Math.random() < 0.4) confetti.push(makeConfetti());
      if (window.Input.actionJustPressed()) {
        window.GameState.reset();
        window.Loop.setScene('INTRO_CRAWL');
        return;
      }
    }

    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vrot * dt;
      if (c.y > H + 8) confetti.splice(i, 1);
    }

    if (localT >= phase.dur && phaseIdx < PHASES.length - 1) {
      phaseIdx++;
    }
  }

  function makeConfetti() {
    return {
      x: Math.random() * W,
      y: -10,
      vx: (Math.random() - 0.5) * 40,
      vy: 50 + Math.random() * 90,
      rot: 0, vrot: (Math.random() - 0.5) * 6,
      c: pickConfettiColor(),
      s: 2 + Math.random() * 2,
    };
  }

  function sumPhasesBefore(idx) {
    let s = 0;
    for (let i = 0; i < idx; i++) s += PHASES[i].dur;
    return s;
  }

  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  function easeOut(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }

  function pickConfettiColor() {
    const palette = ['#ffe81f', '#3aff60', '#ff3a3a', '#3a8aff', '#fff', '#ff80c0'];
    return palette[(Math.random() * palette.length) | 0];
  }

  function render(ctx) {
    drawSky(ctx);
    drawSuns(ctx);
    drawHorizonDunes(ctx);
    drawGround(ctx);
    drawHole(ctx);

    // Marian
    window.Characters.drawMarian(ctx, marianX, marianY - 40, 2);

    // Kike Vader
    if (!kikeInHole) {
      window.Characters.drawKikeVader(ctx, kikeX, kikeY - 40, 2);
    } else if (holeDepth > 2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(W * 0.52, H - 160, 60, holeDepth + 14);
      ctx.clip();
      window.Characters.drawKikeVader(ctx, W * 0.52 + 4, H - 170, 1.8);
      ctx.restore();
    }

    // Manitou
    window.Characters.drawManitou(ctx, manitouX, H - 200, 2, armAngle);

    // Pedrito
    if (pedOnManitou) {
      window.Characters.drawPedrito(ctx, manitouX + 22, H - 240, 1.4, 'idle');
    } else {
      window.Characters.drawPedrito(ctx, hugX, hugY - 40, 2, 'idle');
      // corazoncito flotante
      const hy = hugY - 56 + Math.sin(t * 4) * 2;
      window.Characters.drawHeart(ctx, hugX + 26, hy, 1.6, true);
    }

    // Partículas
    window.Effects.render(ctx);

    // Confeti
    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.s, -c.s / 2, c.s * 2, c.s);
      ctx.restore();
    }

    // Texto final
    const phase = PHASES[phaseIdx];
    if (phase.name === 'credits') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 70, W, 120);
      ctx.fillStyle = '#ffe81f';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡FELICIDADES!', W / 2, 110);
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('PEDRITO HA SALVADO', W / 2, 140);
      ctx.fillText('A MARIAN', W / 2, 158);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#fff';
      if (Math.floor(t * 2) % 2 === 0) ctx.fillText('TOCA O ENTER PARA REPETIR', W / 2, 184);
      ctx.textAlign = 'left';
    }
  }

  function drawSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0,   '#1a0f3a');
    g.addColorStop(0.4, '#5a2858');
    g.addColorStop(0.7, '#c45a48');
    g.addColorStop(1,   '#e89858');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.7);
  }

  function drawSuns(ctx) {
    // Sol grande
    const s1x = W * 0.72, s1y = H * 0.32, s1r = 30;
    const halo1 = ctx.createRadialGradient(s1x, s1y, 0, s1x, s1y, s1r * 2);
    halo1.addColorStop(0, '#fff8a0');
    halo1.addColorStop(0.4, 'rgba(255,200,80,0.6)');
    halo1.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = halo1;
    ctx.fillRect(s1x - s1r * 2, s1y - s1r * 2, s1r * 4, s1r * 4);
    ctx.fillStyle = '#fff0a0';
    ctx.beginPath(); ctx.arc(s1x, s1y, s1r, 0, Math.PI * 2); ctx.fill();

    // Sol pequeño detrás
    const s2x = W * 0.82, s2y = H * 0.40, s2r = 18;
    const halo2 = ctx.createRadialGradient(s2x, s2y, 0, s2x, s2y, s2r * 2);
    halo2.addColorStop(0, '#ffd6a0');
    halo2.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = halo2;
    ctx.fillRect(s2x - s2r * 2, s2y - s2r * 2, s2r * 4, s2r * 4);
    ctx.fillStyle = '#ffc080';
    ctx.beginPath(); ctx.arc(s2x, s2y, s2r, 0, Math.PI * 2); ctx.fill();
  }

  function drawHorizonDunes(ctx) {
    // Tres capas de dunas con parallax estático
    ctx.fillStyle = '#7a3a28';
    drawDune(ctx, H * 0.55, 40, '#7a3a28');
    drawDune(ctx, H * 0.62, 28, '#9a4a30');
    drawDune(ctx, H * 0.68, 18, '#b85a3a');
  }

  function drawDune(ctx, baseY, amp, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 8) {
      const y = baseY - Math.sin(x * 0.03 + baseY * 0.01) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(ctx) {
    // Tierra principal
    ctx.fillStyle = '#c87a3a';
    ctx.fillRect(0, H - 160, W, 160);
    // sombra superior
    ctx.fillStyle = '#a06028';
    ctx.fillRect(0, H - 160, W, 4);
    // textura: piedras
    ctx.fillStyle = '#a06028';
    for (let i = 0; i < 30; i++) {
      const x = (i * 31) % W;
      const y = H - 160 + 12 + (i * 17) % 140;
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.fillStyle = '#e09858';
    for (let i = 0; i < 20; i++) {
      const x = (i * 41 + 13) % W;
      const y = H - 160 + 30 + (i * 23) % 120;
      ctx.fillRect(x, y, 2, 1);
    }
  }

  function drawHole(ctx) {
    if (holeDepth <= 0 && !kikeInHole) return;
    const hx = W * 0.52, hy = H - 160, hw = 60, hh = 14 + holeDepth;
    // sombra del hoyo
    ctx.fillStyle = '#1a0c04';
    ctx.fillRect(hx, hy, hw, hh);
    // borde superior
    ctx.fillStyle = '#7a3818';
    ctx.fillRect(hx, hy, hw, 3);
    // pequeño montón de tierra
    ctx.fillStyle = '#8a4820';
    ctx.fillRect(hx + hw + 2, hy - 4, 18, 4);
    ctx.fillStyle = '#a06028';
    ctx.fillRect(hx + hw + 4, hy - 5, 14, 1);
  }

  window.Loop.register('VICTORY', { enter, exit, update, render });
})();
