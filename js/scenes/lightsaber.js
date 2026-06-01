// Pantalla 4: duelo final tipo Street Fighter contra Kike Vader.
// Controles:
//   - Izquierda: dos botones (← retroceder, → avanzar). Se pueden mantener.
//   - Derecha:   dos botones (BLOQ defender, ATAC atacar).
//   - Multi-touch: avanzar + atacar a la vez, etc.
//   - Teclado:   ← / → mueven, Z ataca, X defiende.
//
// Lógica:
//   - Los luchadores se mueven en eje X. Ambos miran al rival.
//   - Atacar genera un swing del sable durante ~0.5 s. En el "apex"
//     comprueba si el rival está en rango y aplica daño (o lo desvía si
//     está defendiendo).
//   - Defender bloquea el siguiente impacto. Mientras se defiende, te
//     mueves más lento.
//   - Kike Vader tiene IA: se acerca, alterna ataque / defensa / retroceso.
(function () {
  'use strict';

  const W = 360, H = 640;

  const PED_SPEED = 70;       // px/seg
  const KIKE_SPEED = 55;
  const ATTACK_RANGE = 56;    // distancia eje X entre cuerpos para que pegue
  const ATTACK_DAMAGE = 1;
  const PED_MAX_HP = 6;
  const KIKE_MAX_HP = 8;
  const SWING_DURATION = 0.5;
  const SWING_HIT_AT = 0.22;

  const ARENA_Y = H - 280;     // y de los pies de los luchadores

  // Botones (rects en coordenadas internas del canvas)
  const BTN_BACK    = { id: 'back', x: 8,        y: H - 76, w: 68, h: 68, label: '←' };
  const BTN_FWD     = { id: 'fwd',  x: 80,       y: H - 76, w: 68, h: 68, label: '→' };
  const BTN_DEFEND  = { id: 'def',  x: W - 148,  y: H - 76, w: 68, h: 68, label: 'BLOQ' };
  const BTN_ATTACK  = { id: 'atk',  x: W - 76,   y: H - 76, w: 68, h: 68, label: 'ATAC' };
  const BUTTONS = [BTN_BACK, BTN_FWD, BTN_DEFEND, BTN_ATTACK];

  let ped, kike;
  let stars, hitFlash, ended;
  let prevAttackHeld = false; // para edge detection del botón de ataque (tap único)

  function enter() {
    ped  = makeFighter({ x: 80,           hp: PED_MAX_HP,  facing:  1 });
    kike = makeFighter({ x: W - 80 - 22,  hp: KIKE_MAX_HP, facing: -1 });
    hitFlash = 0;
    ended = false;
    prevAttackHeld = false;
    stars = window.Stars.createField({ width: W, height: H, count: 30, speed: 6 });
  }

  function makeFighter(cfg) {
    return {
      x: cfg.x,
      y: ARENA_Y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      facing: cfg.facing,
      state: 'idle',       // 'idle' | 'swinging' | 'defending' | 'stunned'
      swingT: 0,
      swingHit: false,
      attackCooldown: 0,
      stunned: 0,
      defendT: 0,
      shake: 0,
      aiTimer: 0,
      aiNext: 0.6 + Math.random() * 0.4,
    };
  }

  // ¿Está pulsado un botón (touch o ratón)?
  function held(btn) {
    return window.Input.anyPointerInside(btn);
  }

  function update(dt) {
    stars.update(dt);
    hitFlash = Math.max(0, hitFlash - dt);

    if (ended) return;

    ped.attackCooldown = Math.max(0, ped.attackCooldown - dt);
    kike.attackCooldown = Math.max(0, kike.attackCooldown - dt);
    ped.stunned = Math.max(0, ped.stunned - dt);
    kike.stunned = Math.max(0, kike.stunned - dt);
    ped.shake = Math.max(0, ped.shake - dt);
    kike.shake = Math.max(0, kike.shake - dt);

    // --- Input del jugador (Pedrito) ---
    const wantFwd  = held(BTN_FWD)  || window.Input.isKey('ArrowRight');
    const wantBack = held(BTN_BACK) || window.Input.isKey('ArrowLeft');
    const wantDef  = held(BTN_DEFEND) || window.Input.isKey('KeyX');
    const attackHeld = held(BTN_ATTACK) || window.Input.isKey('KeyZ') || window.Input.isKey('Space');
    const attackTap = attackHeld && !prevAttackHeld;
    prevAttackHeld = attackHeld;

    if (!ped.stunned) {
      // Resolver estado base
      if (ped.state !== 'swinging') {
        ped.state = wantDef ? 'defending' : 'idle';
      }

      // Atacar (tap, no hold)
      if (attackTap && ped.attackCooldown <= 0 && ped.state !== 'swinging' && !wantDef) {
        startSwing(ped);
      }

      // Movimiento (limitado por estado)
      let speed = PED_SPEED;
      if (ped.state === 'defending') speed *= 0.4;
      if (ped.state === 'swinging')  speed *= 0.25;
      let dx = 0;
      if (wantFwd)  dx += ped.facing;
      if (wantBack) dx -= ped.facing;
      ped.x += dx * speed * dt;
    }

    // --- IA de Kike Vader ---
    updateAI(kike, ped, dt);

    // Mantener separación mínima y dentro del escenario
    const minGap = 14;
    if (ped.x > kike.x - minGap) {
      // Empuje suave: el que está atacando empuja, si no se reparte
      const mid = (ped.x + kike.x) / 2;
      ped.x  = mid - minGap / 2;
      kike.x = mid + minGap / 2;
    }
    ped.x  = Math.max(16, Math.min(W - 38, ped.x));
    kike.x = Math.max(16, Math.min(W - 38, kike.x));

    // --- Resolver swings ---
    advanceSwing(ped, dt);
    advanceSwing(kike, dt);
    resolveSwingHit(ped, kike);
    resolveSwingHit(kike, ped);

    // --- Final ---
    if (ped.hp <= 0 && !ended && !window.GameState.state.infiniteLives) {
      ended = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 800);
    } else if (ped.hp <= 0) {
      // vidas infinitas: regenerar para seguir jugando
      ped.hp = PED_MAX_HP;
    }
    if (kike.hp <= 0 && !ended) {
      ended = true;
      window.Audio8.sfx('win');
      setTimeout(() => window.Loop.setScene('VICTORY'), 800);
    }
  }

  function startSwing(f) {
    f.state = 'swinging';
    f.swingT = 0;
    f.swingHit = false;
    f.attackCooldown = 0.7;
    window.Audio8.sfx('saber');
  }

  function advanceSwing(f, dt) {
    if (f.state !== 'swinging') return;
    f.swingT += dt;
    if (f.swingT >= SWING_DURATION) {
      f.state = 'idle';
      f.swingT = 0;
      f.swingHit = false;
    }
  }

  function resolveSwingHit(attacker, target) {
    if (attacker.state !== 'swinging' || attacker.swingHit) return;
    if (attacker.swingT < SWING_HIT_AT) return;
    const dist = Math.abs(attacker.x - target.x);
    if (dist > ATTACK_RANGE) return;

    attacker.swingHit = true;

    if (target.state === 'defending') {
      // Parada: golpe metálico, sin daño, leve aturdimiento al atacante
      window.Audio8.sfx('saber');
      attacker.stunned = 0.18;
      attacker.shake = 0.15;
      target.shake = 0.1;
      // pequeño empuje al defensor
      target.x += -attacker.facing * 6;
      return;
    }

    // Daño limpio
    target.hp -= ATTACK_DAMAGE;
    target.stunned = 0.35;
    target.shake = 0.25;
    hitFlash = 0.35;
    window.Audio8.sfx('hit');

    if (target === ped) window.GameState.loseLife();

    // Pequeño retroceso del que recibe
    target.x += -attacker.facing * 10;
  }

  function updateAI(k, p, dt) {
    if (k.stunned) return;
    k.aiTimer += dt;
    const dist = Math.abs(k.x - p.x);

    // Lejos: acercarse
    if (dist > ATTACK_RANGE - 2) {
      if (k.state !== 'swinging') {
        k.state = 'idle';
        k.x += k.facing * KIKE_SPEED * dt; // facing = -1 → se mueve a la izquierda
      }
      return;
    }

    // En rango: decidir cada k.aiNext segundos
    if (k.state === 'defending') {
      k.defendT -= dt;
      if (k.defendT <= 0) k.state = 'idle';
    }

    if (k.state !== 'swinging' && k.aiTimer >= k.aiNext) {
      k.aiTimer = 0;
      k.aiNext = 0.7 + Math.random() * 0.6;
      const r = Math.random();
      // Si el jugador está atacando: 50% defender, 50% retroceder
      if (p.state === 'swinging') {
        if (r < 0.55) {
          k.state = 'defending';
          k.defendT = 0.45;
        } else {
          k.x -= k.facing * 20; // retrocede
        }
        return;
      }
      if (r < 0.55 && k.attackCooldown <= 0) {
        startSwing(k);
      } else if (r < 0.8) {
        k.state = 'defending';
        k.defendT = 0.4;
      } else {
        // pequeño paso adelante
        k.x += k.facing * 14;
      }
    }
  }

  function render(ctx) {
    // Fondo
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);
    stars.render(ctx);

    // Suelo metálico
    ctx.fillStyle = '#1c1c2a';
    ctx.fillRect(0, ARENA_Y + 30, W, H);
    ctx.fillStyle = '#2a2a3a';
    for (let x = 0; x < W; x += 16) ctx.fillRect(x, ARENA_Y + 30, 12, 2);
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, ARENA_Y + 30, W, 3);

    // Pasarela hacia el fondo donde está Marian
    ctx.fillStyle = '#202030';
    ctx.fillRect(W / 2 - 30, 80, 60, ARENA_Y - 50);
    ctx.fillStyle = '#3a3a55';
    for (let y = 90; y < ARENA_Y - 40; y += 22) ctx.fillRect(W / 2 - 28, y, 56, 3);

    // Marian al fondo
    window.Characters.drawMarian(ctx, W / 2 - 10, 60, 1.4);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MARIAN', W / 2, 52);
    ctx.textAlign = 'left';

    // Pedrito y Kike
    drawFighter(ctx, ped, '#3aff60', /*isPed*/true);
    drawFighter(ctx, kike, '#ff3a3a', false);

    // HUD: barras y nombres
    drawHpBar(ctx, 16, 14, 130, 8, ped.hp / ped.maxHp, '#3aff60', 'PEDRITO');
    drawHpBar(ctx, W - 146, 14, 130, 8, kike.hp / kike.maxHp, '#ff3a3a', 'K. VADER', /*alignRight*/true);

    // Vidas globales
    window.NarrativeHUD.drawLives(ctx, /*x*/W / 2 - 18, /*y*/30);

    // Botones de control
    for (const b of BUTTONS) drawButton(ctx, b);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${(hitFlash * 0.55).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (ended && kike.hp <= 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, ARENA_Y - 70, W, 50);
      ctx.fillStyle = '#3aff60';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡VICTORIA!', W / 2, ARENA_Y - 36);
      ctx.textAlign = 'left';
    }
  }

  function drawFighter(ctx, f, saberColor, isPed) {
    ctx.save();
    // Shake al ser golpeado
    if (f.shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

    const scale = 2.2;
    const spriteW = 10 * scale;
    const spriteH = 14 * scale;

    if (isPed) {
      window.Characters.drawPedrito(ctx, f.x, f.y - spriteH, scale);
    } else {
      window.Characters.drawKikeVader(ctx, f.x, f.y - spriteH, scale);
    }

    // Posición de la "mano" — siempre del lado que mira al rival
    const handX = f.facing > 0 ? f.x + spriteW - 2 : f.x + 2;
    const handY = f.y - spriteH + 18 * scale / 2;

    // Ángulo del sable según estado
    let theta;
    const baseUp = -Math.PI / 4; // up-forward (en Pedrito)
    const fwd = 0;
    const up  = -Math.PI / 2;
    if (f.state === 'defending') {
      theta = up;
    } else if (f.state === 'swinging') {
      const p = Math.min(1, f.swingT / SWING_DURATION);
      // De arriba (baseUp) al frente (fwd) y vuelta a baseUp
      const k = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
      theta = baseUp + (fwd - baseUp) * k;
    } else {
      theta = baseUp;
    }

    // Si mira a la izquierda, reflejar
    let tipX, tipY;
    const len = 60;
    if (f.facing > 0) {
      tipX = handX + Math.cos(theta) * len;
      tipY = handY + Math.sin(theta) * len;
    } else {
      tipX = handX - Math.cos(theta) * len;
      tipY = handY + Math.sin(theta) * len;
    }

    window.Characters.drawSaber(ctx, handX, handY, tipX, tipY, saberColor);

    // Indicador visual de defensa (escudo aurora)
    if (f.state === 'defending') {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = saberColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x + spriteW / 2, f.y - spriteH / 2, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawHpBar(ctx, x, y, w, h, pct, color, label, alignRight) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    if (alignRight) {
      ctx.fillStyle = color;
      const fillW = Math.max(0, w * pct);
      ctx.fillRect(x + w - fillW, y, fillW, h);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, Math.max(0, w * pct), h);
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.fillText(label, alignRight ? x + w : x, y + h + 8);
    ctx.textAlign = 'left';
  }

  function drawButton(ctx, b) {
    const isHeld = held(b);
    ctx.save();
    ctx.globalAlpha = isHeld ? 1 : 0.75;
    ctx.fillStyle = '#000';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = colorFor(b, isHeld);
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

    ctx.fillStyle = colorFor(b, isHeld);
    ctx.font = (b.label.length <= 2 ? '20px' : '11px') + ' "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  function colorFor(b, isHeld) {
    switch (b.id) {
      case 'back': return isHeld ? '#fff' : '#bbb';
      case 'fwd':  return isHeld ? '#fff' : '#bbb';
      case 'def':  return isHeld ? '#7ad7f0' : '#3a8aa0';
      case 'atk':  return isHeld ? '#ffd060' : '#a0801a';
    }
    return '#fff';
  }

  window.Loop.register('LIGHTSABER', { enter, update, render });
})();
