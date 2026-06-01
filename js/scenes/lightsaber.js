// Pantalla 4: duelo final con perspectiva vertical cenital.
// Kike Vader arriba, Pedrito abajo, Marian observando desde pasarela lateral.
//
// Movimiento únicamente lateral (izquierda / derecha) y un botón de ataque
// (estocada vertical hacia el rival). Hay impacto si en el instante del hit
// los ejes X de ambos están suficientemente alineados (THRUST_RANGE_X).
//
// Controles (3 botones grandes pensados para móvil):
//   ←   bottom-left    mover a la izquierda
//   ATAC bottom-center  estocada hacia el rival
//   →   bottom-right   mover a la derecha
//
// Teclado: ←/A izquierda, →/D derecha, Z/Espacio atacar.
(function () {
  'use strict';

  const W = 360, H = 640;

  // --- Posiciones fijas en pantalla ---
  const PED_FEET_Y  = 470;
  const KIKE_FEET_Y = 200;
  const PED_SCALE   = 2.6;
  const KIKE_SCALE  = 2.0;

  // Rangos laterales en los que cada uno se puede mover
  const PED_X_MIN  = 40;
  const PED_X_MAX  = W - 40;
  const KIKE_X_MIN = 64;
  const KIKE_X_MAX = W - 64;

  const PED_SPEED  = 160;   // px/s
  const KIKE_SPEED = 100;

  // Reglas del ataque
  const THRUST_RANGE_X = 42;     // alineación lateral para que toque
  const THRUST_DUR     = 0.42;
  const THRUST_HIT0    = 0.14;
  const THRUST_HIT1    = 0.30;
  const THRUST_COOLDOWN = 0.55;

  const PED_MAX_HP  = 6;
  const KIKE_MAX_HP = 8;

  // Plataforma de Marian (sigue siendo lateral izquierda, profundidad media)
  const MARIAN = { x: 12, feetY: 332, scale: 1.5 };

  // --- Botones ---
  const BTN_W = 100, BTN_H = 92;
  const BTN_Y = H - BTN_H - 8;
  const BTN_LEFT  = { id: 'left',  x: 8,              y: BTN_Y, w: BTN_W, h: BTN_H, label: '←' };
  const BTN_ATK   = { id: 'atk',   x: (W - BTN_W) / 2, y: BTN_Y, w: BTN_W, h: BTN_H, label: 'ATAC' };
  const BTN_RIGHT = { id: 'right', x: W - BTN_W - 8,  y: BTN_Y, w: BTN_W, h: BTN_H, label: '→' };
  const BUTTONS = [BTN_LEFT, BTN_ATK, BTN_RIGHT];

  // --- Estado ---
  let ped, kike;
  let stars, plasmaT, bobT;
  let hitFlash;
  let ended;
  let prevAttack = false;

  function enter() {
    plasmaT = 0; bobT = 0;
    hitFlash = 0;
    ended = false;
    prevAttack = false;
    ped  = makeFighter(W / 2, PED_MAX_HP);
    kike = makeFighter(W / 2, KIKE_MAX_HP);
    kike.aiNext = 0.7 + Math.random() * 0.4;
    stars = window.Stars.createField({ width: W, height: 90, count: 18, speed: 3 });
    window.Effects.reset();
  }

  function makeFighter(x, hp) {
    return {
      x, hp, maxHp: hp,
      state: 'idle',
      thrustT: 0,
      thrustHit: false,
      thrustCd: 0,
      stun: 0,
      shake: 0,
      aiTimer: 0,
      aiNext: 0.6,
      aiDir: Math.random() < 0.5 ? -1 : 1,
    };
  }

  function held(btn) { return window.Input.anyPointerInside(btn); }

  // --- Update ---
  function update(dt) {
    plasmaT += dt; bobT += dt;
    stars.update(dt);
    window.Effects.update(dt);
    hitFlash = Math.max(0, hitFlash - dt);

    if (ended) return;

    advanceFighter(ped, dt);
    advanceFighter(kike, dt);

    const wantLeft  = held(BTN_LEFT)  || window.Input.isKey('ArrowLeft')  || window.Input.isKey('KeyA');
    const wantRight = held(BTN_RIGHT) || window.Input.isKey('ArrowRight') || window.Input.isKey('KeyD');
    const atk = held(BTN_ATK) || window.Input.isKey('KeyZ') || window.Input.isKey('Space');
    const atkTap = atk && !prevAttack;
    prevAttack = atk;

    if (ped.stun <= 0) {
      let speed = PED_SPEED;
      if (ped.state === 'thrusting') speed *= 0.2;
      if (wantLeft)  ped.x -= speed * dt;
      if (wantRight) ped.x += speed * dt;
      ped.x = Math.max(PED_X_MIN, Math.min(PED_X_MAX, ped.x));

      if (atkTap && canAttack(ped)) startThrust(ped);
    }

    updateAI(dt);

    resolveThrust(ped, kike);
    resolveThrust(kike, ped);

    if (kike.hp <= 0 && !ended) {
      ended = true;
      window.Audio8.sfx('win');
      window.Effects.explosion(kike.x, KIKE_FEET_Y - 20, { count: 30, speed: 130 });
      setTimeout(() => window.Loop.setScene('VICTORY'), 1100);
    }
    if (ped.hp <= 0 && !ended && !window.GameState.state.infiniteLives) {
      ended = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 900);
    } else if (ped.hp <= 0) {
      ped.hp = PED_MAX_HP; // vidas infinitas
    }
  }

  function advanceFighter(f, dt) {
    f.thrustCd = Math.max(0, f.thrustCd - dt);
    f.stun     = Math.max(0, f.stun     - dt);
    f.shake    = Math.max(0, f.shake    - dt);
    if (f.state === 'thrusting') {
      f.thrustT += dt;
      if (f.thrustT >= THRUST_DUR) { f.state = 'idle'; f.thrustT = 0; f.thrustHit = false; }
    }
  }

  function canAttack(f) { return f.state === 'idle' && f.thrustCd <= 0; }

  function startThrust(f) {
    f.state = 'thrusting';
    f.thrustT = 0;
    f.thrustHit = false;
    f.thrustCd = THRUST_COOLDOWN;
    window.Audio8.sfx('saber');
  }

  function resolveThrust(attacker, target) {
    if (attacker.state !== 'thrusting' || attacker.thrustHit) return;
    if (attacker.thrustT < THRUST_HIT0 || attacker.thrustT > THRUST_HIT1) return;
    if (Math.abs(attacker.x - target.x) > THRUST_RANGE_X) return;

    attacker.thrustHit = true;
    target.hp -= 1;
    target.stun = 0.32;
    target.shake = 0.3;
    hitFlash = target === ped ? 0.35 : 0.18;
    window.Audio8.sfx('hit');
    if (target === ped) window.GameState.loseLife();

    const sx = (attacker.x + target.x) / 2;
    const sy = target === ped ? PED_FEET_Y - 30 : KIKE_FEET_Y - 30;
    window.Effects.sparks(sx, sy, { count: 14, color: '#ff9090', colorAlt: '#ffe080', speed: 110, life: 0.4 });
    window.Effects.dust(target.x, target === ped ? PED_FEET_Y : KIKE_FEET_Y,
      { count: 6, color: '#3a2840', colorAlt: '#5a4060', speed: 36 });
  }

  // --- IA de Kike ---
  // 1) Persigue lateralmente a Pedrito (con un pequeño offset aleatorio)
  // 2) Ataca cuando está aproximadamente alineado y el cooldown lo permite
  function updateAI(dt) {
    const k = kike;
    if (k.stun > 0) return;
    k.aiTimer += dt;

    const dx = ped.x - k.x;
    const absDx = Math.abs(dx);
    let move = 0;
    if (k.state === 'idle') {
      if (absDx > THRUST_RANGE_X * 0.7) move = Math.sign(dx);
      else move = k.aiDir * 0.6;  // pequeño zig-zag cerca del jugador
    } else if (k.state === 'thrusting') {
      move = Math.sign(dx) * 0.2;
    }
    k.x += move * KIKE_SPEED * dt;
    k.x = Math.max(KIKE_X_MIN, Math.min(KIKE_X_MAX, k.x));

    if (k.aiTimer >= k.aiNext) {
      k.aiTimer = 0;
      k.aiNext = 0.45 + Math.random() * 0.55;
      // cambia ocasionalmente la dirección del zig-zag
      if (Math.random() < 0.5) k.aiDir = -k.aiDir;
      // ataque si en rango
      if (absDx < THRUST_RANGE_X * 1.1 && canAttack(k)) startThrust(k);
    }
  }

  // --- Render ---
  function render(ctx) {
    drawBackground(ctx);
    drawCorridorFloor(ctx);
    drawAlignmentLine(ctx);
    drawMarianBalcony(ctx);
    drawKikeFighter(ctx);
    drawPedFighter(ctx);
    window.Effects.render(ctx);
    drawHUD(ctx);
    drawButtons(ctx);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${(hitFlash * 0.55).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (ended && kike.hp <= 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 250, W, 50);
      ctx.fillStyle = '#3aff60';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡VICTORIA!', W / 2, 282);
      ctx.textAlign = 'left';
    }
  }

  function drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#0f0a26');
    g.addColorStop(0.35, '#070716');
    g.addColorStop(1,    '#03030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Ventanal al fondo con estrellas
    const winX = 110, winY = 30, winW = 140, winH = 64;
    ctx.fillStyle = '#06061a';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();
    stars.render(ctx);
    ctx.restore();
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(winX + winW / 2 - 1, winY, 2, winH);

    // Banda horizontal donde está Kike (suelo elevado)
    ctx.fillStyle = '#13131e';
    ctx.fillRect(0, winY + winH, W, KIKE_FEET_Y - (winY + winH) + 8);
    ctx.fillStyle = '#22222e';
    ctx.fillRect(0, KIKE_FEET_Y + 6, W, 4);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, KIKE_FEET_Y + 9, W, 1);

    // Luces rojas decorativas a los lados
    for (let i = 0; i < 4; i++) {
      const y = 230 + i * 70;
      drawSideLight(ctx, 6,     y, plasmaT + i);
      drawSideLight(ctx, W - 12, y, plasmaT + i + 0.5);
    }
  }

  function drawSideLight(ctx, x, y, phase) {
    const flicker = 0.7 + Math.sin(phase * 6) * 0.25;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 20);
    grad.addColorStop(0, `rgba(255,60,60,${(flicker * 0.7).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 20, y - 20, 40, 40);
    ctx.fillStyle = `rgba(255,80,80,${flicker.toFixed(2)})`;
    ctx.fillRect(x - 2, y - 3, 4, 6);
  }

  function drawCorridorFloor(ctx) {
    // Suelo de baldosas en el área inferior donde está Pedrito.
    const floorTopY = 360;
    const floorBottomY = H - BTN_H - 16; // hasta justo encima de los botones
    ctx.fillStyle = '#1c1c2a';
    ctx.fillRect(0, floorTopY, W, floorBottomY - floorTopY);

    // banda decorativa superior
    ctx.fillStyle = '#22222e';
    ctx.fillRect(0, floorTopY, W, 4);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, floorTopY + 3, W, 1);

    // baldosas
    ctx.fillStyle = '#2a2a3a';
    for (let y = floorTopY + 16; y < floorBottomY - 4; y += 24) {
      for (let x = 6; x < W - 6; x += 30) {
        ctx.fillRect(x, y, 22, 2);
      }
    }
  }

  // Línea vertical sutil entre Pedrito y Kike que se ilumina cuando están
  // laterales-alineados (visualización del "en rango" para el jugador).
  function drawAlignmentLine(ctx) {
    const dx = Math.abs(ped.x - kike.x);
    const inRange = dx < THRUST_RANGE_X;
    const closeness = Math.max(0, 1 - dx / (THRUST_RANGE_X * 1.6));
    const pulse = 0.4 + Math.sin(plasmaT * 6) * 0.4;
    ctx.save();
    ctx.globalAlpha = (inRange ? 0.55 : 0.18) * (0.6 + closeness * 0.4 * pulse);
    ctx.strokeStyle = inRange ? '#5acbff' : '#3a4858';
    ctx.lineWidth = inRange ? 2 : 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(ped.x, KIKE_FEET_Y - 6);
    ctx.lineTo(ped.x, PED_FEET_Y - 50);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMarianBalcony(ctx) {
    const x = MARIAN.x, fy = MARIAN.feetY, s = MARIAN.scale;
    // soporte/pasarela
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(0, fy - 4, 64, 8);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, fy - 4, 64, 2);
    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(0, fy + 4, 64, 4);
    // barandilla
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(60, fy - 14, 2, 14);
    ctx.fillRect(32, fy - 12, 2, 12);
    ctx.fillRect(4,  fy - 14, 2, 14);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, fy - 14, 64, 2);

    const sprH = 20 * s;
    window.Characters.drawMarian(ctx, x, fy - sprH, s, { facing: 1 });

    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MARIAN', x - 2, fy + 18);
  }

  function drawPedFighter(ctx) {
    const sc = PED_SCALE;
    const sprW = 14 * sc;
    const sprH = 20 * sc;
    const baseX = ped.x - sprW / 2;
    const baseY = PED_FEET_Y - sprH;

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(ped.x, PED_FEET_Y + 4, sprW * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (ped.shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    const bobOffset = ped.state === 'idle' ? Math.sin(bobT * 4) * 1 : 0;
    window.Characters.drawPedrito(ctx, baseX, baseY + bobOffset, sc, 'idle');
    drawThrustingSaber(ctx, ped, baseX + sprW * 0.78, baseY + sprH * 0.42 + bobOffset, '#3aff60', /*upward*/ true);
    ctx.restore();
  }

  function drawKikeFighter(ctx) {
    const sc = KIKE_SCALE;
    const sprW = 14 * sc;
    const sprH = 20 * sc;
    const baseX = kike.x - sprW / 2;
    const baseY = KIKE_FEET_Y - sprH;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(kike.x, KIKE_FEET_Y + 3, sprW * 0.55, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (kike.shake > 0) ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    const bobOffset = kike.state === 'idle' ? Math.sin(bobT * 4 + 1.2) * 1 : 0;
    window.Characters.drawKikeVader(ctx, baseX, baseY + bobOffset, sc);
    drawThrustingSaber(ctx, kike, baseX + sprW * 0.22, baseY + sprH * 0.42 + bobOffset, '#ff3a3a', /*upward*/ false);
    ctx.restore();
  }

  // Sable con longitud fija + extensión brusca en thrust. La punta apunta
  // hacia el rival (arriba para Pedrito, abajo para Kike).
  function drawThrustingSaber(ctx, f, hx, hy, color, upward) {
    let len = 50;
    let lateral = 0;
    if (f.state === 'thrusting') {
      const p = Math.min(1, f.thrustT / THRUST_DUR);
      const env = p < 0.35 ? (p / 0.35) : (1 - (p - 0.35) / 0.65);
      len = len + env * 150;
    } else {
      lateral = Math.sin(bobT * 3 + (f === kike ? 0.7 : 0)) * 3;
    }
    const dir = upward ? -1 : 1;
    window.Characters.drawSaber(ctx, hx, hy, hx + lateral, hy + dir * len, color);
  }

  // --- HUD + botones ---
  function drawHUD(ctx) {
    drawHpBar(ctx, 16, 14, 130, 10, ped.hp / ped.maxHp, '#3aff60', 'PEDRITO');
    drawHpBar(ctx, W - 146, 14, 130, 10, kike.hp / kike.maxHp, '#ff3a3a', 'K. VADER', true);
    window.NarrativeHUD.drawLives(ctx, W / 2 - 18, 30);
  }

  function drawHpBar(ctx, x, y, w, h, pct, color, label, alignRight) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(x, y, w, h);
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
    ctx.globalAlpha = isHeld ? 1 : 0.82;
    // base
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // highlight superior
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(b.x, b.y, b.w, 6);
    // borde grueso
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // texto
    ctx.fillStyle = color;
    ctx.font = (b.label.length <= 2 ? '34px' : '14px') + ' "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.label.length <= 2 ? 14 : 6));
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function colorFor(b, isHeld) {
    switch (b.id) {
      case 'left':  return isHeld ? '#ffffff' : '#cdcdd8';
      case 'right': return isHeld ? '#ffffff' : '#cdcdd8';
      case 'atk':   return isHeld ? '#ffe080' : '#c89020';
    }
    return '#fff';
  }

  window.Loop.register('LIGHTSABER', { enter, update, render });
})();
