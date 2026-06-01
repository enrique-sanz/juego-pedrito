// Pantalla 3: huida del compactador de basura. Paredes industriales que se
// cierran, agua/basura en el fondo, puntos débiles parpadeantes, chispas al
// golpear los puntos débiles.
(function () {
  'use strict';

  const W = 360, H = 640;
  const DURATION = 14;
  const WALL_LIMIT = 130;
  const START_GAP = 220;

  let gap, timer, weakPoints, spawnTimer, hitFlash, lose, win, shakeT;
  let waterT;
  let sparksOn;

  function enter() {
    gap = START_GAP;
    timer = 0;
    weakPoints = [];
    spawnTimer = 0;
    hitFlash = 0;
    shakeT = 0;
    lose = false; win = false;
    waterT = 0;
    sparksOn = 0;
    window.Effects.reset();
  }

  function update(dt) {
    timer += dt;
    waterT += dt;
    window.Effects.update(dt);

    const closeSpeed = 4 + timer * 0.6;
    gap -= closeSpeed * dt;

    spawnTimer -= dt;
    if (spawnTimer <= 0 && weakPoints.length < 3) {
      const margin = 70;
      weakPoints.push({
        x: margin + Math.random() * (W - margin * 2),
        y: 120 + Math.random() * (H - 280),
        r: 20,
        life: 2.5,
        max: 2.5,
      });
      spawnTimer = 0.9 + Math.random() * 0.5;
    }

    for (let i = weakPoints.length - 1; i >= 0; i--) {
      const w = weakPoints[i];
      w.life -= dt;
      if (w.life <= 0) weakPoints.splice(i, 1);
    }

    // Chispas aleatorias en las paredes (atmosféricas)
    sparksOn -= dt;
    if (sparksOn <= 0 && Math.random() < 0.1) {
      const sx = Math.random() < 0.5
        ? (W - gap) / 2 - 4
        : W - (W - gap) / 2 + 4;
      const sy = 100 + Math.random() * (H - 240);
      window.Effects.sparks(sx, sy, { count: 4, color: '#ffd060', colorAlt: '#ff8030', speed: 60, life: 0.3, cone: 0.6, dir: sx < W / 2 ? 0 : Math.PI });
      sparksOn = 0.6;
    }

    // Detección de tap → golpear punto débil
    let hitIdx = -1;
    if (window.Input.pointer.justPressed) {
      const p = window.Input.pointer;
      for (let i = 0; i < weakPoints.length; i++) {
        const w = weakPoints[i];
        const dx = p.x - w.x, dy = p.y - w.y;
        if (dx * dx + dy * dy < w.r * w.r * 1.4) { hitIdx = i; break; }
      }
    } else if (window.Input.isKeyJustPressed('Space') ||
               window.Input.isKeyJustPressed('Enter') ||
               window.Input.isKeyJustPressed('NumpadEnter')) {
      if (weakPoints.length) hitIdx = 0;
    }
    if (hitIdx >= 0) {
      const w = weakPoints[hitIdx];
      window.Effects.sparks(w.x, w.y, { count: 18, color: '#fff8c0', colorAlt: '#ffc060', speed: 120, life: 0.5 });
      weakPoints.splice(hitIdx, 1);
      gap += 22;
      if (gap > START_GAP) gap = START_GAP;
      window.Audio8.sfx('hit');
      shakeT = 0.2;
    }

    if (shakeT > 0) shakeT -= dt;
    if (hitFlash > 0) hitFlash -= dt;

    if (gap <= WALL_LIMIT && !lose) {
      lose = true;
      window.Audio8.sfx('explosion');
      window.GameState.loseLife();
      window.GameState.loseLife();
      window.GameState.loseLife();
      hitFlash = 1;
      window.Effects.explosion(W / 2, H / 2, { count: 26, speed: 110 });
      setTimeout(() => {
        if (window.GameState.state.infiniteLives) {
          enter();
          lose = false;
        } else {
          window.Loop.setScene('DEFEAT');
        }
      }, 800);
    }

    if (timer >= DURATION && !win && !lose) {
      win = true;
      window.Audio8.sfx('win');
      setTimeout(() => window.Loop.setScene('NARRATIVE_4'), 1000);
    }
  }

  function render(ctx) {
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }

    // Fondo cámara
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Suelo de líquido sucio con ripples animados
    const liquidY = H - 80;
    ctx.fillStyle = '#1a2a18';
    ctx.fillRect(0, liquidY, W, H - liquidY);
    // ripples
    ctx.fillStyle = 'rgba(120,180,80,0.25)';
    for (let i = 0; i < 6; i++) {
      const yy = liquidY + 6 + i * 12;
      const phase = Math.sin(waterT * 2 + i) * 6;
      ctx.fillRect(phase + 10, yy, W - 40, 2);
    }
    // basura
    ctx.fillStyle = '#3a3220';
    for (let i = 0; i < 10; i++) {
      const x = (i * 53 + (timer * 30)) % W;
      ctx.fillRect(x, liquidY + 12 + (i * 7) % 30, 10, 6);
      ctx.fillRect(x + 4, liquidY + 18 + (i * 11) % 28, 6, 4);
    }

    // Paredes laterales metálicas
    const wallW = (W - gap) / 2;
    drawMetalWall(ctx, 0, 0, wallW, H, 'L');
    drawMetalWall(ctx, W - wallW, 0, wallW, H, 'R');

    // Puntos débiles (con halo pulsante)
    for (const w of weakPoints) {
      const a = Math.max(0.3, w.life / w.max);
      const pulse = 0.6 + Math.sin(timer * 8) * 0.4;
      ctx.save();
      ctx.globalAlpha = a;
      // halo exterior
      const haloR = w.r * (1.6 + pulse * 0.4);
      const grad = ctx.createRadialGradient(w.x, w.y, w.r * 0.3, w.x, w.y, haloR);
      grad.addColorStop(0, 'rgba(255,80,80,0.65)');
      grad.addColorStop(1, 'rgba(255,80,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(w.x - haloR, w.y - haloR, haloR * 2, haloR * 2);
      // núcleo
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + Math.sin(timer * 8) * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3030';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd060';
      ctx.stroke();
      // exclamación
      ctx.fillStyle = '#fff';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', w.x, w.y + 5);
      ctx.restore();
    }

    // Pedrito atrapado en el centro
    window.Characters.drawPedrito(ctx, W / 2 - 14, liquidY - 40, 2);

    // Partículas
    window.Effects.render(ctx);

    // HUD
    window.NarrativeHUD.drawLives(ctx);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PARED: ' + Math.max(0, Math.round(gap - WALL_LIMIT)), W / 2, 20);
    ctx.fillText('PULSA LOS PUNTOS ROJOS', W / 2, 36);
    ctx.fillText('(o ESPACIO en desktop)', W / 2, 48);

    // Barra de tiempo restante
    const pw = (W - 80) * Math.min(1, timer / DURATION);
    ctx.fillStyle = '#000';
    ctx.fillRect(38, H - 22, W - 76, 8);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(40, H - 20, W - 80, 4);
    ctx.fillStyle = '#7af0a8';
    ctx.fillRect(40, H - 20, pw, 4);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${hitFlash.toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function drawMetalWall(ctx, x, y, w, h, side) {
    // Gradiente lateral según el lado
    const grad = side === 'L'
      ? ctx.createLinearGradient(x, 0, x + w, 0)
      : ctx.createLinearGradient(x + w, 0, x, 0);
    grad.addColorStop(0,   '#5a4824');
    grad.addColorStop(0.7, '#3a2c18');
    grad.addColorStop(1,   '#221608');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Bandas horizontales metálicas
    ctx.fillStyle = '#7a5e34';
    for (let yy = 0; yy < h; yy += 28) {
      ctx.fillRect(x + (side === 'L' ? w - 8 : 0), yy + 4, 8, 18);
    }
    ctx.fillStyle = '#1a0f06';
    for (let yy = 0; yy < h; yy += 28) {
      ctx.fillRect(x + (side === 'L' ? w - 12 : 8), yy + 24, 4, 2);
    }
    // tornillos
    ctx.fillStyle = '#221606';
    for (let yy = 0; yy < h; yy += 60) {
      const sx = side === 'L' ? w - 16 : 12;
      ctx.fillRect(x + sx, yy + 12, 4, 4);
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(x + sx + 1, yy + 13, 1, 1);
      ctx.fillStyle = '#221606';
    }
  }

  window.Loop.register('COMPACTOR', { enter, update, render });
})();
