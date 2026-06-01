// Pantalla 2: carrera por la trinchera de la Estrella enemiga.
// Estética 16-bit: paredes con parallax, luces parpadeantes, tuberías y
// detalles industriales que pasan en distintas velocidades, propulsor.
(function () {
  'use strict';

  const W = 360, H = 640;
  const DURATION = 22;
  const PLAYER_W = 24, PLAYER_H = 20;

  let player, obstacles, timer, scroll, lose, win, hitFlash;
  let pipes, lights, spawnTimer, thrustT;

  function enter() {
    player = { x: W / 2 - PLAYER_W / 2, y: H - 100, w: PLAYER_W, h: PLAYER_H };
    obstacles = [];
    timer = 0;
    scroll = 0;
    lose = false;
    win = false;
    hitFlash = 0;
    spawnTimer = 0;
    thrustT = 0;

    // Tuberías de fondo (parallax lento) y luces (parallax medio)
    pipes = [];
    for (let i = 0; i < 8; i++) {
      pipes.push({ side: i % 2 === 0 ? 'L' : 'R', y: -i * 90, color: i % 3 === 0 ? '#3a3a4a' : '#2a2a3a' });
    }
    lights = [];
    for (let i = 0; i < 14; i++) {
      lights.push({ side: i % 2 === 0 ? 'L' : 'R', y: -i * 50, on: Math.random() < 0.5, t: Math.random() });
    }

    window.Effects.reset();
  }

  function update(dt) {
    timer += dt;
    scroll += 280 * dt;
    thrustT += dt;
    window.Effects.update(dt);

    // Avance del parallax
    for (const pp of pipes)  { pp.y += 160 * dt; if (pp.y > H + 60) pp.y -= H + 200; }
    for (const l of lights) { l.y += 240 * dt; l.t += dt; if (l.y > H + 20) { l.y -= H + 80; l.on = Math.random() < 0.6; } }

    // Control
    const p = window.Input.pointer;
    if (p.isDown) {
      player.x += (p.x - PLAYER_W / 2 - player.x) * Math.min(1, dt * 14);
    }
    if (window.Input.isKey('ArrowLeft'))  player.x -= 220 * dt;
    if (window.Input.isKey('ArrowRight')) player.x += 220 * dt;
    player.x = Math.max(28, Math.min(W - 28 - PLAYER_W, player.x));

    // Thrust
    if (thrustT > 0.02) {
      thrustT = 0;
      window.Effects.thrust(player.x + 6,            player.y + PLAYER_H - 2, '#ffae40');
      window.Effects.thrust(player.x + PLAYER_W - 7, player.y + PLAYER_H - 2, '#ffae40');
    }

    // Spawnear obstáculos
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const variant = Math.random();
      if (variant < 0.5) {
        const side = Math.random() < 0.5 ? 'L' : 'R';
        const width = 42 + Math.random() * 30;
        obstacles.push({ type: 'panel', x: side === 'L' ? 28 : W - 28 - width, y: -40, w: width, h: 18, hue: '#7a3a3a' });
      } else if (variant < 0.85) {
        obstacles.push({ type: 'pillar', x: 50 + Math.random() * (W - 130), y: -30, w: 26, h: 26, hue: '#6a6a78' });
      } else {
        const gap = 96;
        const gapX = 50 + Math.random() * (W - 100 - gap);
        obstacles.push({ type: 'wall', x: 28, y: -22, w: gapX - 28, h: 16, hue: '#555' });
        obstacles.push({ type: 'wall', x: gapX + gap, y: -22, w: W - 28 - (gapX + gap), h: 16, hue: '#555' });
      }
      spawnTimer = 0.45 - Math.min(0.25, timer / 60);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += 280 * dt;
      if (o.y > H + 22) { obstacles.splice(i, 1); continue; }
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
    window.Effects.explosion(player.x + PLAYER_W / 2, player.y, { count: 14, speed: 70 });
    window.GameState.loseLife();
  }

  function render(ctx) {
    // Fondo metálico oscuro
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, W, H);

    // Paredes laterales con perspectiva (más anchas en la base)
    drawWalls(ctx);

    // Tuberías parallax
    for (const pp of pipes) {
      if (pp.side === 'L') {
        ctx.fillStyle = pp.color;
        ctx.fillRect(20, pp.y, 8, 80);
        ctx.fillStyle = '#1a1a20';
        ctx.fillRect(20, pp.y + 75, 8, 5);
      } else {
        ctx.fillStyle = pp.color;
        ctx.fillRect(W - 28, pp.y, 8, 80);
        ctx.fillStyle = '#1a1a20';
        ctx.fillRect(W - 28, pp.y + 75, 8, 5);
      }
    }

    // Luces (parpadean)
    for (const l of lights) {
      const flicker = l.on ? 0.7 + Math.sin(l.t * 12) * 0.3 : 0.15;
      const c = `rgba(255,180,80,${flicker.toFixed(2)})`;
      if (l.side === 'L') {
        ctx.fillStyle = c; ctx.fillRect(8, l.y, 4, 6);
        // brillo
        ctx.fillStyle = `rgba(255,180,80,${(flicker * 0.3).toFixed(2)})`;
        ctx.fillRect(4, l.y - 2, 12, 10);
      } else {
        ctx.fillStyle = c; ctx.fillRect(W - 12, l.y, 4, 6);
        ctx.fillStyle = `rgba(255,180,80,${(flicker * 0.3).toFixed(2)})`;
        ctx.fillRect(W - 16, l.y - 2, 12, 10);
      }
    }

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${(hitFlash * 0.6).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Obstáculos
    for (const o of obstacles) {
      ctx.fillStyle = o.hue;
      ctx.fillRect(o.x | 0, o.y | 0, o.w, o.h);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(o.x | 0, (o.y + o.h - 3) | 0, o.w, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(o.x | 0, (o.y) | 0, o.w, 2);
    }

    // X-wing
    window.Characters.drawXwing(ctx, player.x, player.y, 2);

    window.Effects.render(ctx);

    window.NarrativeHUD.drawLives(ctx);

    // Barra de progreso
    const pw = (W - 80) * Math.min(1, timer / DURATION);
    ctx.fillStyle = '#000';
    ctx.fillRect(38, H - 20, W - 76, 8);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(40, H - 18, W - 80, 4);
    ctx.fillStyle = '#ffe81f';
    ctx.fillRect(40, H - 18, pw, 4);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NÚCLEO', W / 2, H - 26);
    ctx.textAlign = 'left';
  }

  function drawWalls(ctx) {
    // Paredes con un toque de perspectiva: más oscuras al fondo, más claras al frente.
    const top = '#1c1c28';
    const mid = '#2a2a38';
    const bot = '#3a3a4a';

    // Izquierda
    const lg = ctx.createLinearGradient(0, 0, 28, 0);
    lg.addColorStop(0, bot);
    lg.addColorStop(0.7, mid);
    lg.addColorStop(1, top);
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, 28, H);

    // Derecha
    const rg = ctx.createLinearGradient(W, 0, W - 28, 0);
    rg.addColorStop(0, bot);
    rg.addColorStop(0.7, mid);
    rg.addColorStop(1, top);
    ctx.fillStyle = rg;
    ctx.fillRect(W - 28, 0, 28, H);

    // Detalle: marcas largas verticales en el suelo central (efecto velocidad)
    ctx.fillStyle = '#101018';
    const segH = 50;
    const offset = scroll % segH;
    for (let y = -segH + offset; y < H; y += segH) {
      ctx.fillRect(W / 2 - 1, y, 2, 18);
    }
  }

  window.Loop.register('RACING', { enter, update, render });
})();
