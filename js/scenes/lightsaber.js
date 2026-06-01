// Pantalla 4: duelo final con sables láser contra Kike Vader. Marian al fondo.
// Mecánica: aparecen indicadores de ataque del enemigo desde un lado;
// el jugador debe golpear el lado correcto a tiempo para parar y luego
// pulsar el botón ATACAR para devolver el golpe. Reducir HP de Kike → victoria.
(function () {
  'use strict';

  const W = 360, H = 640;

  let pedritoX, pedritoY, kikeX, kikeY;
  let pedHP, kikeHP;
  let phase;      // 'idle' | 'enemy_attack' | 'parry' | 'player_attack' | 'cooldown'
  let phaseT;     // tiempo dentro de la fase
  let arrowSide;  // 'L' o 'R' del próximo ataque enemigo
  let arrowTime;  // tiempo restante para parar
  let combo;
  let stars, sceneTime, ended, hitFlash;
  let pedSaberSwing, kikeSaberSwing;

  const ATTACK_BTN = { x: W / 2 - 50, y: H - 60, w: 100, h: 36 };
  const PARRY_BTN_L = { x: 20, y: H - 130, w: 100, h: 50 };
  const PARRY_BTN_R = { x: W - 120, y: H - 130, w: 100, h: 50 };

  function enter() {
    pedritoX = 60; pedritoY = H - 240;
    kikeX = W - 60 - 20; kikeY = H - 240;
    pedHP = 4;
    kikeHP = 6;
    phase = 'idle';
    phaseT = 0;
    combo = 0;
    sceneTime = 0;
    ended = false;
    hitFlash = 0;
    pedSaberSwing = 0;
    kikeSaberSwing = 0;
    stars = window.Stars.createField({ width: W, height: H, count: 30, speed: 8 });
    queueNextEnemyAttack(0.8);
  }

  function queueNextEnemyAttack(delay) {
    phase = 'cooldown';
    phaseT = 0;
    arrowSide = Math.random() < 0.5 ? 'L' : 'R';
    arrowTime = delay;
  }

  function update(dt) {
    sceneTime += dt;
    phaseT += dt;
    stars.update(dt);

    if (pedSaberSwing > 0) pedSaberSwing -= dt;
    if (kikeSaberSwing > 0) kikeSaberSwing -= dt;
    if (hitFlash > 0) hitFlash -= dt;

    if (ended) return;

    const p = window.Input.pointer;

    if (phase === 'cooldown') {
      arrowTime -= dt;
      if (arrowTime <= 0) {
        phase = 'enemy_attack';
        phaseT = 0;
      }
    } else if (phase === 'enemy_attack') {
      // Ventana de 0.7s para parar
      const window_ = 0.85;
      if (p.justPressed) {
        const ok = (arrowSide === 'L' && inside(p, PARRY_BTN_L)) ||
                   (arrowSide === 'R' && inside(p, PARRY_BTN_R));
        if (ok && phaseT < window_) {
          combo++;
          window.Audio8.sfx('saber');
          pedSaberSwing = 0.25;
          phase = 'player_attack';
          phaseT = 0;
        } else {
          // mal parada: recibe golpe
          enemyHits();
        }
      }
      if (phaseT > window_ && phase === 'enemy_attack') {
        enemyHits();
      }
    } else if (phase === 'player_attack') {
      // Ventana corta para pulsar ATACAR
      const window_ = 1.0;
      if (p.justPressed && inside(p, ATTACK_BTN)) {
        kikeHP--;
        combo++;
        window.Audio8.sfx('saber');
        pedSaberSwing = 0.3;
        if (kikeHP <= 0) {
          ended = true;
          window.Audio8.sfx('win');
          setTimeout(() => window.Loop.setScene('VICTORY'), 800);
          return;
        }
        queueNextEnemyAttack(0.6);
      }
      if (phaseT > window_) {
        combo = 0;
        queueNextEnemyAttack(0.5);
      }
    }
  }

  function enemyHits() {
    kikeSaberSwing = 0.3;
    pedHP--;
    combo = 0;
    hitFlash = 0.5;
    window.Audio8.sfx('hit');
    window.GameState.loseLife();
    if (pedHP <= 0) {
      ended = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 700);
      return;
    }
    queueNextEnemyAttack(0.6);
  }

  function inside(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function render(ctx) {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);
    stars.render(ctx);

    // Suelo / plataforma
    ctx.fillStyle = '#1c1c2a';
    ctx.fillRect(0, H - 200, W, 200);
    ctx.fillStyle = '#2a2a3a';
    for (let x = 0; x < W; x += 18) ctx.fillRect(x, H - 200, 12, 2);

    // Marian al fondo (cuanto más HP de Kike, más cerca queda en realidad)
    const marianX = W / 2 - 10;
    const marianY = H - 360;
    window.Characters.drawMarian(ctx, marianX, marianY, 1.6);

    // Indicador: "Marian observa"
    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MARIAN', W / 2, marianY - 8);
    ctx.textAlign = 'left';

    // Pedrito (izquierda) con sable verde
    window.Characters.drawPedrito(ctx, pedritoX, pedritoY, 2.2);
    const pedHandX = pedritoX + 22, pedHandY = pedritoY + 30;
    const pedSwingAngle = -0.6 + (pedSaberSwing > 0 ? 1.0 : 0);
    const saberLen = 70;
    window.Characters.drawSaber(
      ctx,
      pedHandX, pedHandY,
      pedHandX + Math.cos(pedSwingAngle) * saberLen,
      pedHandY + Math.sin(pedSwingAngle) * saberLen,
      '#3aff60',
    );

    // Kike Vader (derecha) con sable rojo
    window.Characters.drawKikeVader(ctx, kikeX, kikeY, 2.2);
    const kikeHandX = kikeX - 4, kikeHandY = kikeY + 30;
    const kikeSwingAngle = -Math.PI + 0.5 - (kikeSaberSwing > 0 ? 1.0 : 0);
    window.Characters.drawSaber(
      ctx,
      kikeHandX, kikeHandY,
      kikeHandX + Math.cos(kikeSwingAngle) * saberLen,
      kikeHandY + Math.sin(kikeSwingAngle) * saberLen,
      '#ff3a3a',
    );

    // Barras HP
    drawBar(ctx, 20, 16, 120, 8, pedHP / 4, '#3aff60', 'PEDRITO');
    drawBar(ctx, W - 140, 16, 120, 8, kikeHP / 6, '#ff3a3a', 'K. VADER');

    // Botón ATACAR
    if (phase === 'player_attack') {
      drawButton(ctx, ATTACK_BTN, '¡ATACA!', '#3aff60', true);
    } else {
      drawButton(ctx, ATTACK_BTN, 'ATACAR', '#3aff60', false);
    }

    // Botones PARAR (izquierda / derecha) - sólo activos cuando enemy_attack
    const activeL = phase === 'enemy_attack' && arrowSide === 'L';
    const activeR = phase === 'enemy_attack' && arrowSide === 'R';
    drawButton(ctx, PARRY_BTN_L, '← PARAR', activeL ? '#ffd060' : '#555', activeL);
    drawButton(ctx, PARRY_BTN_R, 'PARAR →', activeR ? '#ffd060' : '#555', activeR);

    // Indicador de combo
    if (combo >= 2) {
      ctx.fillStyle = '#ffe81f';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMBO x' + combo, W / 2, 40);
      ctx.textAlign = 'left';
    }

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${(hitFlash * 0.7).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBar(ctx, x, y, w, h, pct, color, label) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * pct), h);
    ctx.fillStyle = '#fff';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText(label, x, y + h + 8);
  }

  function drawButton(ctx, r, label, color, active) {
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.65;
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = color;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  window.Loop.register('LIGHTSABER', { enter, update, render });
})();
