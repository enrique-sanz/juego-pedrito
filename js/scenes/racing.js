// Pantalla 2: carrera por la trinchera de la Estrella enemiga. Scroll vertical,
// el jugador esquiva obstáculos arrastrando el dedo a izquierda/derecha.
(function () {
  'use strict';

  const W = 360, H = 640;
  const DURATION = 22; // seg necesarios para completar

  let player, obstacles, timer, scroll, lose, win, hitFlash, stars;
  let spawnTimer;

  function enter() {
    player = { x: W / 2 - 10, y: H - 90, w: 20, h: 16 };
    obstacles = [];
    timer = 0;
    scroll = 0;
    lose = false;
    win = false;
    hitFlash = 0;
    spawnTimer = 0;
    stars = window.Stars.createField({ width: W, height: H, count: 40, speed: 60 });
  }

  function update(dt) {
    timer += dt;
    scroll += 240 * dt;
    stars.update(dt * 6);

    // Control: arrastra horizontalmente
    const p = window.Input.pointer;
    if (p.isDown) {
      player.x += (p.x - player.w / 2 - player.x) * Math.min(1, dt * 14);
    }
    if (window.Input.isKey('ArrowLeft')) player.x -= 220 * dt;
    if (window.Input.isKey('ArrowRight')) player.x += 220 * dt;
    player.x = Math.max(20, Math.min(W - 20 - player.w, player.x));

    // Spawnear obstáculos: paneles a izquierda o derecha, torretas, columnas
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const variant = Math.random();
      if (variant < 0.5) {
        // panel lateral pequeño
        const side = Math.random() < 0.5 ? 'L' : 'R';
        const width = 40 + Math.random() * 30;
        obstacles.push({
          type: 'panel',
          x: side === 'L' ? 20 : W - 20 - width,
          y: -40,
          w: width,
          h: 16,
        });
      } else if (variant < 0.85) {
        // columna central pequeña
        obstacles.push({
          type: 'pillar',
          x: 40 + Math.random() * (W - 100),
          y: -30,
          w: 24,
          h: 24,
        });
      } else {
        // par de columnas con hueco
        const gap = 90;
        const gapX = 40 + Math.random() * (W - 80 - gap);
        obstacles.push({ type: 'wall', x: 20, y: -20, w: gapX - 20, h: 14 });
        obstacles.push({ type: 'wall', x: gapX + gap, y: -20, w: W - 20 - (gapX + gap), h: 14 });
      }
      spawnTimer = 0.45 - Math.min(0.25, timer / 60);
    }

    // Mover y limpiar
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += 240 * dt;
      if (o.y > H + 20) {
        obstacles.splice(i, 1);
        continue;
      }
      if (intersects(o, player)) {
        obstacles.splice(i, 1);
        hit();
      }
    }

    if (hitFlash > 0) hitFlash -= dt;

    if (timer >= DURATION && !win) {
      win = true;
      window.Audio8.sfx('win');
      setTimeout(() => window.Loop.setScene('NARRATIVE_3'), 900);
    }
    if (window.GameState.state.lives <= 0 && !lose && !window.GameState.state.infiniteLives) {
      lose = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 700);
    }
  }

  function intersects(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  function hit() {
    if (hitFlash > 0) return;
    hitFlash = 0.45;
    window.Audio8.sfx('hit');
    window.GameState.loseLife();
  }

  function render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Paredes de la trinchera: bandas grises a izquierda y derecha con marcas
    // de movimiento. Animadas con scroll para dar sensación de velocidad.
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, 20, H);
    ctx.fillRect(W - 20, 0, 20, H);
    ctx.fillStyle = '#2a2a2a';
    const segH = 40;
    const offset = scroll % segH;
    for (let y = -segH + offset; y < H; y += segH) {
      ctx.fillRect(2, y, 16, 6);
      ctx.fillRect(W - 18, y, 16, 6);
    }

    // Estrellas dan profundidad en el "cielo" estrecho del centro
    stars.render(ctx);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${(hitFlash * 0.7).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Obstáculos
    for (const o of obstacles) {
      ctx.fillStyle = o.type === 'pillar' ? '#666' : '#4a4a4a';
      ctx.fillRect(o.x | 0, o.y | 0, o.w, o.h);
      ctx.fillStyle = '#222';
      ctx.fillRect(o.x | 0, (o.y + o.h - 3) | 0, o.w, 3);
    }

    // Jugador
    window.Characters.drawXwing(ctx, player.x, player.y, 2);

    // HUD
    window.NarrativeHUD.drawLives(ctx);

    // Barra de progreso
    const pw = (W - 80) * Math.min(1, timer / DURATION);
    ctx.fillStyle = '#222';
    ctx.fillRect(40, H - 18, W - 80, 6);
    ctx.fillStyle = '#ffe81f';
    ctx.fillRect(40, H - 18, pw, 6);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NÚCLEO', W / 2, H - 24);
    ctx.textAlign = 'left';
  }

  window.Loop.register('RACING', { enter, update, render });
})();
