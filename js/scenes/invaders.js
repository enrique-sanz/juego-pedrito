// Pantalla 1: Space Invaders vertical contra cazas TIE.
// Estética 16-bit: nebulosa con planeta lejano, estela de propulsor,
// explosiones de partículas al destruir cazas.
(function () {
  'use strict';

  const W = 360, H = 640;
  const PLAYER_W = 24, PLAYER_H = 20;   // X-wing 12×10 @ scale 2
  const COL = 6, ROW = 4;
  const ENEMY_W = 14, ENEMY_H = 14;     // TIE 7×7 @ scale 2

  let player, enemies, bullets, enemyBullets, dir;
  let timeSinceEnemyShot, stars, starsFar;
  let wave, scoreLeft, win, lose, hitFlash, autoFireCooldown;
  let thrustT, planet, t;

  function enter() {
    starsFar = window.Stars.createField({ width: W, height: H, count: 40, speed: 6, twinkle: true });
    stars    = window.Stars.createField({ width: W, height: H, count: 35, speed: 22, twinkle: false });
    player = { x: W / 2 - PLAYER_W / 2, y: H - 70 };
    enemies = [];
    for (let r = 0; r < ROW; r++) {
      for (let c = 0; c < COL; c++) {
        enemies.push({
          x: 40 + c * 44,
          y: 80 + r * 30,
          alive: true,
          bob: Math.random() * Math.PI * 2,
        });
      }
    }
    bullets = []; enemyBullets = [];
    dir = 1;
    timeSinceEnemyShot = 0;
    wave = 1;
    win = false; lose = false;
    hitFlash = 0;
    autoFireCooldown = 0;
    scoreLeft = enemies.length;
    thrustT = 0; t = 0;

    // Planeta de fondo
    planet = {
      cx: 80, cy: 130, r: 50,
      coreColor: '#3a1d6a', glow: '#7a55c0',
      ringTilt: 0.3, ringColor: '#aa88ff',
    };

    window.Effects.reset();
  }

  function update(dt) {
    t += dt;
    thrustT += dt;
    starsFar.update(dt);
    stars.update(dt);
    window.Effects.update(dt);

    // Movimiento del jugador
    const p = window.Input.pointer;
    if (p.isDown) {
      player.x += (p.x - PLAYER_W / 2 - player.x) * Math.min(1, dt * 12);
    }
    if (window.Input.isKey('ArrowLeft'))  player.x -= 180 * dt;
    if (window.Input.isKey('ArrowRight')) player.x += 180 * dt;
    player.x = Math.max(4, Math.min(W - PLAYER_W - 4, player.x));

    // Estela de propulsor: dos partículas por frame
    if (thrustT > 0.02) {
      thrustT = 0;
      window.Effects.thrust(player.x + 5,            player.y + PLAYER_H - 2, '#ff8030');
      window.Effects.thrust(player.x + PLAYER_W - 6, player.y + PLAYER_H - 2, '#ff8030');
    }

    // Disparo automático + tap manual
    autoFireCooldown -= dt;
    if (autoFireCooldown <= 0) { shoot(); autoFireCooldown = 0.5; }
    if (p.justPressed) { shoot(); autoFireCooldown = 0.4; }
    if (window.Input.isKeyJustPressed('Space')) shoot();

    // Bob de enemigos
    for (const e of enemies) e.bob += dt * 3;

    // Movimiento de la formación
    const speed = (30 + wave * 8) * dt;
    let minX = Infinity, maxX = -Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.x < minX) minX = e.x;
      if (e.x + ENEMY_W > maxX) maxX = e.x + ENEMY_W;
    }
    if (maxX + dir * speed > W - 4 || minX + dir * speed < 4) {
      dir *= -1;
      for (const e of enemies) if (e.alive) e.y += 14;
    } else {
      for (const e of enemies) if (e.alive) e.x += dir * speed;
    }

    timeSinceEnemyShot += dt;
    const fireInterval = Math.max(0.4, 1.2 - wave * 0.15);
    if (timeSinceEnemyShot > fireInterval) {
      timeSinceEnemyShot = 0;
      const shooters = enemies.filter(e => e.alive);
      if (shooters.length) {
        const e = shooters[(Math.random() * shooters.length) | 0];
        enemyBullets.push({ x: e.x + ENEMY_W / 2 - 1, y: e.y + ENEMY_H, vy: 160 + wave * 20 });
      }
    }

    // Balas
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= 380 * dt;
      if (b.y < -8) bullets.splice(i, 1);
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.y += b.vy * dt;
      if (b.y > H + 8) enemyBullets.splice(i, 1);
    }

    // Colisiones
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (const e of enemies) {
        if (!e.alive) continue;
        if (b.x > e.x && b.x < e.x + ENEMY_W && b.y > e.y && b.y < e.y + ENEMY_H) {
          e.alive = false;
          bullets.splice(i, 1);
          scoreLeft--;
          window.Audio8.sfx('explosion');
          window.Effects.explosion(e.x + ENEMY_W / 2, e.y + ENEMY_H / 2);
          break;
        }
      }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.x > player.x && b.x < player.x + PLAYER_W &&
          b.y > player.y && b.y < player.y + PLAYER_H) {
        enemyBullets.splice(i, 1);
        hit();
      }
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.y + ENEMY_H >= player.y) {
        hit();
        e.alive = false;
        scoreLeft--;
      }
    }

    if (hitFlash > 0) hitFlash -= dt;

    if (scoreLeft <= 0 && !win) {
      win = true;
      window.Audio8.sfx('win');
      setTimeout(() => window.Loop.setScene('NARRATIVE_2'), 1100);
    }
    if (window.GameState.state.lives <= 0 && !lose && !window.GameState.state.infiniteLives) {
      lose = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 800);
    }
  }

  function shoot() {
    if (bullets.length > 4) return;
    bullets.push({ x: player.x + PLAYER_W / 2, y: player.y - 4 });
    window.Audio8.sfx('laser');
  }

  function hit() {
    if (hitFlash > 0) return;
    hitFlash = 0.5;
    window.Audio8.sfx('hit');
    window.Effects.explosion(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, { count: 22 });
    window.GameState.loseLife();
  }

  function render(ctx) {
    drawBackground(ctx);

    // Balas enemigas (rojas con halo)
    ctx.save();
    for (const b of enemyBullets) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ff5050';
      ctx.fillRect(b.x - 2, b.y - 2, 6, 10);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe080';
      ctx.fillRect(b.x, b.y, 2, 6);
    }
    ctx.restore();

    // Cazas TIE
    for (const e of enemies) {
      if (!e.alive) continue;
      const bob = Math.sin(e.bob) * 1;
      window.Characters.drawTie(ctx, e.x, e.y + bob, 2);
    }

    // Balas jugador (verde con halo)
    ctx.save();
    for (const b of bullets) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#a8ff60';
      ctx.fillRect(b.x - 2, b.y - 2, 5, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y, 2, 10);
    }
    ctx.restore();

    // X-wing
    window.Characters.drawXwing(ctx, player.x, player.y, 2);

    // Partículas (delante del jugador para ver thrust)
    window.Effects.render(ctx);

    // Flash de daño
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${(hitFlash * 0.6).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawHUD(ctx);
  }

  function drawBackground(ctx) {
    // Gradiente espacio profundo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#03030a');
    g.addColorStop(1, '#0a0820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    starsFar.render(ctx);

    // Planeta lejano (parte superior izquierda)
    drawPlanet(ctx, planet);

    stars.render(ctx);
  }

  function drawPlanet(ctx, p) {
    // halo
    const halo = ctx.createRadialGradient(p.cx, p.cy, p.r * 0.6, p.cx, p.cy, p.r * 1.6);
    halo.addColorStop(0, p.glow + 'aa');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * 1.6, 0, Math.PI * 2); ctx.fill();
    // cuerpo
    ctx.fillStyle = p.coreColor;
    ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2); ctx.fill();
    // bandas
    ctx.fillStyle = 'rgba(120,80,200,0.45)';
    ctx.fillRect(p.cx - p.r, p.cy - p.r * 0.45, p.r * 2, p.r * 0.18);
    ctx.fillStyle = 'rgba(80,40,160,0.4)';
    ctx.fillRect(p.cx - p.r, p.cy + p.r * 0.15, p.r * 2, p.r * 0.12);
    // brillo
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(p.cx - p.r * 0.35, p.cy - p.r * 0.4, p.r * 0.32, 0, Math.PI * 2); ctx.fill();
    // anillo
    ctx.strokeStyle = p.ringColor + '88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.r * 1.35, p.r * 0.35, p.ringTilt, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.r * 1.35, p.r * 0.35, p.ringTilt, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHUD(ctx) {
    window.NarrativeHUD.drawLives(ctx);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('CAZAS: ' + scoreLeft, W - 8, 18);
    ctx.textAlign = 'left';
  }

  window.Loop.register('INVADERS', { enter, update, render });
})();
