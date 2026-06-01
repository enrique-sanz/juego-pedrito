// Pantalla 1: Space Invaders vertical contra cazas TIE.
// Control táctil: arrastra para mover, tap para disparar (también dispara
// automáticamente cada 0.6s para que sea jugable con una sola mano).
(function () {
  'use strict';

  const W = 360, H = 640;
  const PLAYER_W = 22, PLAYER_H = 16;

  const COL = 6, ROW = 4;
  const ENEMY_W = 14, ENEMY_H = 10;

  let player, enemies, bullets, enemyBullets, dir, descend;
  let timeSinceShot, timeSinceEnemyShot, stars;
  let wave, scoreLeft, win, lose, hitFlash, autoFireCooldown;

  function enter() {
    stars = window.Stars.createField({ width: W, height: H, count: 60, speed: 18 });
    player = { x: W / 2 - PLAYER_W / 2, y: H - 60 };
    enemies = [];
    for (let r = 0; r < ROW; r++) {
      for (let c = 0; c < COL; c++) {
        enemies.push({
          x: 40 + c * 40,
          y: 70 + r * 26,
          alive: true,
        });
      }
    }
    bullets = [];
    enemyBullets = [];
    dir = 1;
    descend = false;
    timeSinceShot = 0;
    timeSinceEnemyShot = 0;
    wave = 1;
    win = false;
    lose = false;
    hitFlash = 0;
    autoFireCooldown = 0;
    scoreLeft = enemies.length;
  }

  function update(dt) {
    stars.update(dt);

    // Movimiento del jugador con el puntero
    const p = window.Input.pointer;
    if (p.isDown) {
      player.x += (p.x - PLAYER_W / 2 - player.x) * Math.min(1, dt * 12);
    }
    if (window.Input.isKey('ArrowLeft')) player.x -= 180 * dt;
    if (window.Input.isKey('ArrowRight')) player.x += 180 * dt;
    player.x = Math.max(4, Math.min(W - PLAYER_W - 4, player.x));

    // Auto-fire
    autoFireCooldown -= dt;
    if (autoFireCooldown <= 0) {
      shoot();
      autoFireCooldown = 0.5;
    }
    if (p.justPressed) {
      shoot();
      autoFireCooldown = 0.4;
    }
    if (window.Input.isKeyJustPressed('Space')) shoot();

    // Mover enemigos: lateral + descenso al chocar borde
    const speed = (30 + wave * 8) * dt;
    let minX = Infinity, maxX = -Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.x < minX) minX = e.x;
      if (e.x + ENEMY_W > maxX) maxX = e.x + ENEMY_W;
    }
    if (maxX + dir * speed > W - 4 || minX + dir * speed < 4) {
      dir *= -1;
      for (const e of enemies) if (e.alive) e.y += 12;
    } else {
      for (const e of enemies) if (e.alive) e.x += dir * speed;
    }

    // Enemigos disparan ocasionalmente
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

    // Mover balas
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

    // Colisiones: balas jugador → enemigos
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (const e of enemies) {
        if (!e.alive) continue;
        if (b.x > e.x && b.x < e.x + ENEMY_W && b.y > e.y && b.y < e.y + ENEMY_H) {
          e.alive = false;
          bullets.splice(i, 1);
          scoreLeft--;
          window.Audio8.sfx('explosion');
          break;
        }
      }
    }

    // Colisiones: balas enemigas → jugador
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.x > player.x && b.x < player.x + PLAYER_W &&
          b.y > player.y && b.y < player.y + PLAYER_H) {
        enemyBullets.splice(i, 1);
        hit();
      }
    }

    // Enemigo llega a la base
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
    window.GameState.loseLife();
  }

  function render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    stars.render(ctx);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${(hitFlash * 0.6).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Enemigos (TIE fighters)
    for (const e of enemies) {
      if (!e.alive) continue;
      window.Characters.drawTie(ctx, e.x, e.y, 2);
    }

    // Balas enemigas
    ctx.fillStyle = '#ff5050';
    for (const b of enemyBullets) ctx.fillRect(b.x, b.y, 2, 6);

    // Balas jugador
    ctx.fillStyle = '#a8ff60';
    for (const b of bullets) ctx.fillRect(b.x - 1, b.y, 2, 8);

    // Jugador (X-wing)
    window.Characters.drawXwing(ctx, player.x, player.y, 2);

    // HUD
    window.NarrativeHUD.drawLives(ctx);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('CAZAS: ' + scoreLeft, W - 8, 16);
    ctx.textAlign = 'left';
  }

  window.Loop.register('INVADERS', { enter, update, render });
})();
