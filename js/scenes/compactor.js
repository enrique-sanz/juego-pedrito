// Pantalla 3: huida del compactador de basura. Las paredes laterales se
// acercan; aparecen puntos débiles que el jugador debe golpear para detenerlas
// temporalmente. Sobrevivir el tiempo total => victoria.
(function () {
  'use strict';

  const W = 360, H = 640;
  const DURATION = 14;     // seg necesarios
  const WALL_LIMIT = 120;  // distancia mínima entre paredes antes de morir
  const START_GAP = 220;

  let gap, timer, weakPoints, spawnTimer, hitFlash, lose, win, shakeT;

  function enter() {
    gap = START_GAP;
    timer = 0;
    weakPoints = [];
    spawnTimer = 0;
    hitFlash = 0;
    shakeT = 0;
    lose = false;
    win = false;
  }

  function update(dt) {
    timer += dt;

    // Paredes se acercan, más rápido cuanto más tiempo pasa
    const closeSpeed = 4 + timer * 0.6;
    gap -= closeSpeed * dt;

    // Spawnear puntos débiles ocasionalmente
    spawnTimer -= dt;
    if (spawnTimer <= 0 && weakPoints.length < 3) {
      const margin = 60;
      weakPoints.push({
        x: margin + Math.random() * (W - margin * 2),
        y: 120 + Math.random() * (H - 240),
        r: 18,
        life: 2.5,
        max: 2.5,
      });
      spawnTimer = 0.9 + Math.random() * 0.5;
    }

    // Animar puntos débiles
    for (let i = weakPoints.length - 1; i >= 0; i--) {
      const w = weakPoints[i];
      w.life -= dt;
      if (w.life <= 0) weakPoints.splice(i, 1);
    }

    // Detección de tap → golpear punto débil más cercano
    if (window.Input.pointer.justPressed) {
      const p = window.Input.pointer;
      let hitIdx = -1;
      for (let i = 0; i < weakPoints.length; i++) {
        const w = weakPoints[i];
        const dx = p.x - w.x, dy = p.y - w.y;
        if (dx * dx + dy * dy < w.r * w.r * 1.4) {
          hitIdx = i;
          break;
        }
      }
      if (hitIdx >= 0) {
        weakPoints.splice(hitIdx, 1);
        gap += 22;            // ¡las paredes retroceden!
        if (gap > START_GAP) gap = START_GAP;
        window.Audio8.sfx('hit');
        shakeT = 0.2;
      }
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
      setTimeout(() => {
        if (window.GameState.state.infiniteLives) {
          // No mata: solo reinicia escena
          enter();
          lose = false;
        } else {
          window.Loop.setScene('DEFEAT');
        }
      }, 700);
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

    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, W, H);

    // Suelo lleno de basura tipo manchas
    ctx.fillStyle = '#2a2615';
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillStyle = '#3a3220';
    for (let i = 0; i < 20; i++) {
      const x = (i * 47 + (timer * 30)) % W;
      ctx.fillRect(x, H - 60 + (i * 13) % 50, 8, 6);
    }

    // Paredes laterales
    const wallW = (W - gap) / 2;
    const wallColor = '#5a4a2a';
    const stripe = '#7a6534';
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, wallW, H);
    ctx.fillRect(W - wallW, 0, wallW, H);
    ctx.fillStyle = stripe;
    for (let y = 0; y < H; y += 24) {
      ctx.fillRect(wallW - 6, y + 4, 6, 14);
      ctx.fillRect(W - wallW, y + 4, 6, 14);
    }
    // Tornillos
    ctx.fillStyle = '#221c0e';
    for (let y = 0; y < H; y += 60) {
      ctx.fillRect(wallW - 14, y + 8, 4, 4);
      ctx.fillRect(W - wallW + 10, y + 8, 4, 4);
    }

    // Puntos débiles
    for (const w of weakPoints) {
      const a = Math.max(0.2, w.life / w.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + Math.sin(timer * 8) * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3030';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd060';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', w.x, w.y + 4);
      ctx.restore();
    }

    // Pedrito atrapado en el centro
    window.Characters.drawPedrito(ctx, W / 2 - 10, H - 130, 2);

    // HUD
    window.NarrativeHUD.drawLives(ctx);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PARED: ' + Math.max(0, Math.round((gap - WALL_LIMIT))), W / 2, 18);
    ctx.fillText('PULSA LOS PUNTOS ROJOS', W / 2, 38);

    // Barra de tiempo restante
    const pw = (W - 80) * Math.min(1, timer / DURATION);
    ctx.fillStyle = '#222';
    ctx.fillRect(40, H - 20, W - 80, 5);
    ctx.fillStyle = '#7af0a8';
    ctx.fillRect(40, H - 20, pw, 5);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${hitFlash.toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  window.Loop.register('COMPACTOR', { enter, update, render });
})();
