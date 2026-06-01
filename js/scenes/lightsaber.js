// Pantalla 4: duelo final estilo Street Fighter contra Kike Vader.
// Estética: cámara de fortaleza imperial con ventanal estrellado al fondo,
// suelo de plasma, columnas de pared y Marian observando desde una pasarela.
// Chispas al chocar sables, polvo al recibir golpes.
(function () {
  'use strict';

  const W = 360, H = 640;

  const PED_SPEED = 70;
  const KIKE_SPEED = 55;
  const ATTACK_RANGE = 64;
  const ATTACK_DAMAGE = 1;
  const PED_MAX_HP = 6;
  const KIKE_MAX_HP = 8;
  const SWING_DURATION = 0.5;
  const SWING_HIT_AT = 0.22;

  const FIGHTER_SCALE = 2.4;
  const SPRITE_W = 14 * FIGHTER_SCALE;
  const SPRITE_H = 20 * FIGHTER_SCALE;
  const ARENA_Y = H - 220;  // y de los pies

  const BTN_BACK    = { id: 'back', x: 8,        y: H - 76, w: 68, h: 68, label: '←' };
  const BTN_FWD     = { id: 'fwd',  x: 80,       y: H - 76, w: 68, h: 68, label: '→' };
  const BTN_DEFEND  = { id: 'def',  x: W - 148,  y: H - 76, w: 68, h: 68, label: 'BLOQ' };
  const BTN_ATTACK  = { id: 'atk',  x: W - 76,   y: H - 76, w: 68, h: 68, label: 'ATAC' };
  const BUTTONS = [BTN_BACK, BTN_FWD, BTN_DEFEND, BTN_ATTACK];

  let ped, kike;
  let stars, hitFlash, ended;
  let prevAttackHeld = false;
  let bobT, plasmaT;
  let walkAnim;  // 0..1 alternancia para piernas

  function enter() {
    ped  = makeFighter({ x: 80,           hp: PED_MAX_HP,  facing:  1 });
    kike = makeFighter({ x: W - 80 - SPRITE_W, hp: KIKE_MAX_HP, facing: -1 });
    hitFlash = 0;
    ended = false;
    prevAttackHeld = false;
    bobT = 0; plasmaT = 0; walkAnim = 0;
    stars = window.Stars.createField({ width: W, height: 180, count: 26, speed: 4 });
    window.Effects.reset();
  }

  function makeFighter(cfg) {
    return {
      x: cfg.x,
      y: ARENA_Y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      facing: cfg.facing,
      state: 'idle',
      swingT: 0,
      swingHit: false,
      attackCooldown: 0,
      stunned: 0,
      defendT: 0,
      shake: 0,
      moving: false,
      aiTimer: 0,
      aiNext: 0.6 + Math.random() * 0.4,
    };
  }

  function held(btn) { return window.Input.anyPointerInside(btn); }

  function update(dt) {
    bobT += dt;
    plasmaT += dt;
    walkAnim += dt;
    stars.update(dt);
    window.Effects.update(dt);
    hitFlash = Math.max(0, hitFlash - dt);

    if (ended) return;

    ped.attackCooldown = Math.max(0, ped.attackCooldown - dt);
    kike.attackCooldown = Math.max(0, kike.attackCooldown - dt);
    ped.stunned = Math.max(0, ped.stunned - dt);
    kike.stunned = Math.max(0, kike.stunned - dt);
    ped.shake = Math.max(0, ped.shake - dt);
    kike.shake = Math.max(0, kike.shake - dt);

    const wantFwd  = held(BTN_FWD)  || window.Input.isKey('ArrowRight');
    const wantBack = held(BTN_BACK) || window.Input.isKey('ArrowLeft');
    const wantDef  = held(BTN_DEFEND) || window.Input.isKey('KeyX');
    const attackHeld = held(BTN_ATTACK) || window.Input.isKey('KeyZ') || window.Input.isKey('Space');
    const attackTap = attackHeld && !prevAttackHeld;
    prevAttackHeld = attackHeld;

    ped.moving = false;
    if (!ped.stunned) {
      if (ped.state !== 'swinging') {
        ped.state = wantDef ? 'defending' : 'idle';
      }
      if (attackTap && ped.attackCooldown <= 0 && ped.state !== 'swinging' && !wantDef) {
        startSwing(ped);
      }
      let speed = PED_SPEED;
      if (ped.state === 'defending') speed *= 0.4;
      if (ped.state === 'swinging')  speed *= 0.25;
      let dx = 0;
      if (wantFwd)  dx += ped.facing;
      if (wantBack) dx -= ped.facing;
      if (dx !== 0) ped.moving = true;
      ped.x += dx * speed * dt;
    }

    updateAI(kike, ped, dt);

    const minGap = 14;
    if (ped.x > kike.x - minGap) {
      const mid = (ped.x + kike.x) / 2;
      ped.x  = mid - minGap / 2;
      kike.x = mid + minGap / 2;
    }
    ped.x  = Math.max(16, Math.min(W - SPRITE_W - 16, ped.x));
    kike.x = Math.max(16, Math.min(W - SPRITE_W - 16, kike.x));

    advanceSwing(ped, dt);
    advanceSwing(kike, dt);
    resolveSwingHit(ped, kike);
    resolveSwingHit(kike, ped);

    if (ped.hp <= 0 && !ended && !window.GameState.state.infiniteLives) {
      ended = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 900);
    } else if (ped.hp <= 0) {
      ped.hp = PED_MAX_HP;
    }
    if (kike.hp <= 0 && !ended) {
      ended = true;
      window.Audio8.sfx('win');
      window.Effects.explosion(kike.x + SPRITE_W / 2, kike.y - SPRITE_H / 2, { count: 28, speed: 130 });
      setTimeout(() => window.Loop.setScene('VICTORY'), 1100);
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

    const midX = (attacker.x + target.x) / 2 + SPRITE_W / 2;
    const midY = attacker.y - SPRITE_H * 0.55;

    if (target.state === 'defending') {
      // Parada: chispas brillantes
      window.Audio8.sfx('saber');
      attacker.stunned = 0.18;
      attacker.shake = 0.15;
      target.shake = 0.1;
      target.x += -attacker.facing * 6;
      window.Effects.sparks(midX, midY, {
        count: 16, color: '#fff8c0', colorAlt: '#80e8ff', speed: 130, life: 0.4,
      });
      return;
    }

    target.hp -= ATTACK_DAMAGE;
    target.stunned = 0.35;
    target.shake = 0.3;
    hitFlash = 0.35;
    window.Audio8.sfx('hit');

    if (target === ped) window.GameState.loseLife();

    target.x += -attacker.facing * 10;
    // chispas + polvo
    window.Effects.sparks(midX, midY, { count: 14, color: '#ff9090', colorAlt: '#ffe080', speed: 110, life: 0.4 });
    window.Effects.dust(target.x + SPRITE_W / 2, target.y, { count: 6, color: '#3a2840', colorAlt: '#5a4060', speed: 40 });
  }

  function updateAI(k, p, dt) {
    if (k.stunned) return;
    k.aiTimer += dt;
    const dist = Math.abs(k.x - p.x);
    k.moving = false;

    if (dist > ATTACK_RANGE - 2) {
      if (k.state !== 'swinging') {
        k.state = 'idle';
        k.x += k.facing * KIKE_SPEED * dt;
        k.moving = true;
      }
      return;
    }

    if (k.state === 'defending') {
      k.defendT -= dt;
      if (k.defendT <= 0) k.state = 'idle';
    }

    if (k.state !== 'swinging' && k.aiTimer >= k.aiNext) {
      k.aiTimer = 0;
      k.aiNext = 0.7 + Math.random() * 0.6;
      const r = Math.random();
      if (p.state === 'swinging') {
        if (r < 0.55) { k.state = 'defending'; k.defendT = 0.45; }
        else { k.x -= k.facing * 20; }
        return;
      }
      if (r < 0.55 && k.attackCooldown <= 0) {
        startSwing(k);
      } else if (r < 0.8) {
        k.state = 'defending';
        k.defendT = 0.4;
      } else {
        k.x += k.facing * 14;
      }
    }
  }

  // ---------------- Render ----------------
  function render(ctx) {
    drawBackground(ctx);
    drawCharactersAndSabers(ctx);
    window.Effects.render(ctx);
    drawHUD(ctx);
    drawButtons(ctx);

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

  function drawBackground(ctx) {
    // Gradiente vertical: morado oscuro arriba, casi negro al medio
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#15102a');
    g.addColorStop(0.4, '#080812');
    g.addColorStop(1,   '#040408');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Ventanal estrellado al fondo (marco metálico)
    const winX = 30, winY = 28, winW = W - 60, winH = 160;
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();
    stars.render(ctx);
    ctx.restore();
    // marco
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(winX, winY, winW, winH);
    // travesaños verticales
    ctx.fillStyle = '#2a2a3a';
    for (let i = 1; i < 4; i++) {
      ctx.fillRect(winX + (winW / 4) * i - 1, winY, 2, winH);
    }
    ctx.fillRect(winX, winY + winH / 2 - 1, winW, 2);

    // Pasarela donde está Marian
    const wkX = W / 2 - 36;
    const wkW = 72;
    ctx.fillStyle = '#22222e';
    ctx.fillRect(wkX, winY + winH, wkW, 36);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(wkX, winY + winH, wkW, 4);
    // barandilla
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(wkX - 2,    winY + winH - 6, 2, 10);
    ctx.fillRect(wkX + wkW,  winY + winH - 6, 2, 10);

    // Marian sobre la pasarela (sprite 14×20 × 1.6 ≈ 22×32, pies en winY+winH)
    window.Characters.drawMarian(ctx, W / 2 - 7 * 1.6, winY + winH - 32, 1.6);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MARIAN', W / 2, winY + winH - 30);
    ctx.textAlign = 'left';

    // Pared / panel intermedio entre ventanal y suelo
    ctx.fillStyle = '#15151f';
    ctx.fillRect(0, winY + winH + 36, W, ARENA_Y - (winY + winH + 36) - 14);

    // Columnas decorativas
    ctx.fillStyle = '#22222e';
    ctx.fillRect(20, winY + winH + 36, 10, ARENA_Y - winY - winH - 50);
    ctx.fillRect(W - 30, winY + winH + 36, 10, ARENA_Y - winY - winH - 50);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(20, winY + winH + 36, 10, 3);
    ctx.fillRect(W - 30, winY + winH + 36, 10, 3);

    // Suelo de plasma (banda animada)
    const floorY = ARENA_Y + 4;
    ctx.fillStyle = '#1c1c2a';
    ctx.fillRect(0, floorY, W, H - floorY);
    // banda de plasma
    const plasmaH = 6;
    const plasmaY = floorY - 2;
    const grad = ctx.createLinearGradient(0, plasmaY, 0, plasmaY + plasmaH);
    const pulse = 0.5 + Math.sin(plasmaT * 4) * 0.2;
    grad.addColorStop(0, `rgba(120,220,255,${(0.4 * pulse).toFixed(2)})`);
    grad.addColorStop(0.5, '#5acbff');
    grad.addColorStop(1, `rgba(40,140,200,${(0.4 * pulse).toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, plasmaY, W, plasmaH);

    // baldosas
    ctx.fillStyle = '#2a2a3a';
    for (let x = 0; x < W; x += 20) {
      ctx.fillRect(x, floorY + 4, 14, 2);
      ctx.fillRect(x, floorY + 18, 14, 2);
    }
  }

  function drawCharactersAndSabers(ctx) {
    drawFighter(ctx, ped, '#3aff60', true);
    drawFighter(ctx, kike, '#ff3a3a', false);
  }

  function drawFighter(ctx, f, saberColor, isPed) {
    ctx.save();

    // Sombra elíptica bajo los pies
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(f.x + SPRITE_W / 2, f.y + 2, SPRITE_W * 0.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

    // Pequeño bob al estar idle
    const bobOffset = f.state === 'idle' && !f.moving ? Math.sin(bobT * 4) * 1 : 0;
    const drawY = f.y - SPRITE_H + bobOffset;

    // Frame: walk si se está moviendo
    const frame = f.moving ? (Math.floor(walkAnim * 7) % 2 === 0 ? 'walk' : 'idle') : 'idle';

    if (isPed) {
      window.Characters.drawPedrito(ctx, f.x, drawY, FIGHTER_SCALE, frame);
    } else {
      window.Characters.drawKikeVader(ctx, f.x, drawY, FIGHTER_SCALE);
    }

    // Mano que sostiene el sable (a la altura del torso)
    const handX = f.facing > 0 ? f.x + SPRITE_W - 4 : f.x + 4;
    const handY = drawY + SPRITE_H * 0.55;

    let theta;
    const baseUp = -Math.PI / 4;
    const fwd = 0;
    const up = -Math.PI / 2;
    if (f.state === 'defending') {
      theta = up;
    } else if (f.state === 'swinging') {
      const p = Math.min(1, f.swingT / SWING_DURATION);
      const k = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
      theta = baseUp + (fwd - baseUp) * k;
    } else {
      theta = baseUp + Math.sin(bobT * 4) * 0.04; // leve oscilación idle
    }

    const len = 72;
    let tipX, tipY;
    if (f.facing > 0) {
      tipX = handX + Math.cos(theta) * len;
      tipY = handY + Math.sin(theta) * len;
    } else {
      tipX = handX - Math.cos(theta) * len;
      tipY = handY + Math.sin(theta) * len;
    }
    window.Characters.drawSaber(ctx, handX, handY, tipX, tipY, saberColor);

    // Escudo aurora al defender
    if (f.state === 'defending') {
      ctx.save();
      const pulse = 0.5 + Math.sin(bobT * 10) * 0.2;
      ctx.globalAlpha = 0.5 * pulse;
      ctx.strokeStyle = saberColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x + SPRITE_W / 2, drawY + SPRITE_H / 2, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawHUD(ctx) {
    drawHpBar(ctx, 16, 14, 130, 10, ped.hp / ped.maxHp, '#3aff60', 'PEDRITO');
    drawHpBar(ctx, W - 146, 14, 130, 10, kike.hp / kike.maxHp, '#ff3a3a', 'K. VADER', true);
    window.NarrativeHUD.drawLives(ctx, W / 2 - 18, 30);
  }

  function drawHpBar(ctx, x, y, w, h, pct, color, label, alignRight) {
    // marco
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(x, y, w, h);
    // fill
    const fillW = Math.max(0, w * pct);
    if (alignRight) {
      ctx.fillStyle = color;
      ctx.fillRect(x + w - fillW, y, fillW, h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + w - fillW, y, fillW, 2);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, fillW, h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, fillW, 2);
    }
    // etiqueta
    ctx.fillStyle = '#fff';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.fillText(label, alignRight ? x + w : x, y + h + 10);
    ctx.textAlign = 'left';
  }

  function drawButtons(ctx) {
    for (const b of BUTTONS) drawButton(ctx, b);
  }

  function drawButton(ctx, b) {
    const isHeld = held(b);
    const color = colorFor(b, isHeld);
    ctx.save();
    ctx.globalAlpha = isHeld ? 1 : 0.78;
    // base oscura
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // highlight superior
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(b.x, b.y, b.w, 4);
    // borde grueso
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // segundo borde interno
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // texto
    ctx.fillStyle = color;
    ctx.font = (b.label.length <= 2 ? '22px' : '11px') + ' "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 8);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function colorFor(b, isHeld) {
    switch (b.id) {
      case 'back': return isHeld ? '#ffffff' : '#bbbbcc';
      case 'fwd':  return isHeld ? '#ffffff' : '#bbbbcc';
      case 'def':  return isHeld ? '#9ce8ff' : '#4a8fa8';
      case 'atk':  return isHeld ? '#ffe080' : '#a0801a';
    }
    return '#fff';
  }

  window.Loop.register('LIGHTSABER', { enter, update, render });
})();
