// Pantalla 4: duelo final con perspectiva vertical diagonal-cenital.
// Kike Vader arriba (fondo), Pedrito abajo (primer plano), Marian observando
// desde una pasarela elevada a mitad de pantalla. La cámara mira la pelea
// desde encima del hombro de Pedrito, ligeramente picada.
//
// Controles:
//   ↑ avanzar (acerca Pedrito a Kike — reduce `distance`)
//   ↓ retroceder
//   ATAC: estocada/puñalada con el sable (movimiento recto hacia adelante)
//   ESQUIV: ladea la cabeza y desplaza el cuerpo a un lado (i-frames breves)
//
// Teclado equivalente:  ↑/W  ↓/S  Z|Space ataque  X esquivar
(function () {
  'use strict';

  const W = 360, H = 640;

  // --------- Geometría de la escena ---------
  // Suelo de "trinchera" con punto de fuga arriba-centro.
  const VP   = { x: W / 2, y: 96 };
  const FLOOR_TOP    = 110;      // y donde la profundidad es 1 (lejos)
  const FLOOR_BOTTOM = H + 20;   // y donde la profundidad es 0 (cerca)

  // Anchura aparente del pasillo a cada profundidad
  const NEAR_HALF_W = 200;       // semianchura al borde inferior
  const FAR_HALF_W  = 32;        // semianchura al fondo

  // Posición fija de Pedrito en pantalla (cámara le sigue)
  const PED_FEET_Y = 482;
  const PED_SCALE  = 2.6;

  // Profundidad de Kike: distance ∈ [0,1] → depth ∈ [NEAR, FAR].
  // NEAR debe ser claramente mayor que la "profundidad implícita" de Pedrito
  // (≈0.32 para PED_FEET_Y=482) para que Kike quede SIEMPRE más arriba en
  // pantalla que Pedrito, incluso cuando están al mínimo de distancia.
  const KIKE_DEPTH_NEAR = 0.52;
  const KIKE_DEPTH_FAR  = 0.94;

  // Plataforma de Marian (lateral izquierdo, profundidad media)
  const MARIAN = { x: 16, feetY: 248, scale: 1.5 };

  // --------- Reglas del duelo ---------
  const DIST_MIN = 0;
  const DIST_MAX = 1;
  const THRUST_RANGE = 0.22;        // distance ≤ esto = la estocada alcanza

  const PED_SPEED  = 0.55;          // unidades de distance por segundo
  const KIKE_SPEED = 0.42;

  const PED_MAX_HP  = 6;
  const KIKE_MAX_HP = 8;

  // Estocada: ext (sable sale) → hit-window → ret (sable vuelve)
  const THRUST_HIT0 = 0.14;
  const THRUST_HIT1 = 0.28;
  const THRUST_DUR  = 0.42;
  const THRUST_COOLDOWN = 0.55;

  // Esquiva: ladeo en arco. i-frames durante la mayor parte del movimiento.
  const DODGE_DUR    = 0.5;
  const DODGE_IFR_0  = 0.06;
  const DODGE_IFR_1  = 0.34;
  const DODGE_COOLDOWN = 0.65;

  // Botones
  const BTN_FWD    = { id: 'fwd',   x: 8,        y: H - 76, w: 68, h: 68, label: '↑' };
  const BTN_BACK   = { id: 'back',  x: 80,       y: H - 76, w: 68, h: 68, label: '↓' };
  const BTN_DODGE  = { id: 'dodge', x: W - 148,  y: H - 76, w: 68, h: 68, label: 'ESQUI' };
  const BTN_ATTACK = { id: 'atk',   x: W - 76,   y: H - 76, w: 68, h: 68, label: 'ATAC' };
  const BUTTONS = [BTN_FWD, BTN_BACK, BTN_DODGE, BTN_ATTACK];

  // --------- Estado ---------
  let ped, kike;
  let distance;
  let stars;
  let bobT, plasmaT;
  let hitFlash, missFlash;
  let ended;
  let prevAttack = false, prevDodge = false;
  let dodgeFlip = 1; // alterna lado al esquivar para variedad

  function enter() {
    distance = 0.85;
    bobT = 0; plasmaT = 0;
    hitFlash = 0; missFlash = 0;
    ended = false;
    prevAttack = false; prevDodge = false;
    dodgeFlip = 1;
    ped = makeFighter({ hp: PED_MAX_HP });
    kike = makeFighter({ hp: KIKE_MAX_HP });
    stars = window.Stars.createField({ width: W, height: 90, count: 18, speed: 3 });
    window.Effects.reset();
  }

  function makeFighter(cfg) {
    return {
      hp: cfg.hp,
      maxHp: cfg.hp,
      state: 'idle',          // 'idle' | 'thrusting' | 'dodging'
      thrustT: 0,
      thrustHit: false,
      thrustCd: 0,
      dodgeT: 0,
      dodgeDir: 1,
      dodgeCd: 0,
      stun: 0,
      shake: 0,
      aiTimer: 0,
      aiNext: 0.7 + Math.random() * 0.5,
    };
  }

  function held(btn) { return window.Input.anyPointerInside(btn); }

  // --------- Update ---------
  function update(dt) {
    bobT += dt; plasmaT += dt;
    stars.update(dt);
    window.Effects.update(dt);
    hitFlash = Math.max(0, hitFlash - dt);
    missFlash = Math.max(0, missFlash - dt);

    if (ended) return;

    advanceFighter(ped, dt);
    advanceFighter(kike, dt);

    // Input de Pedrito
    const wantFwd  = held(BTN_FWD)  || window.Input.isKey('ArrowUp')   || window.Input.isKey('KeyW');
    const wantBack = held(BTN_BACK) || window.Input.isKey('ArrowDown') || window.Input.isKey('KeyS');
    const atk  = held(BTN_ATTACK) || window.Input.isKey('KeyZ') || window.Input.isKey('Space');
    const dodge = held(BTN_DODGE) || window.Input.isKey('KeyX');
    const atkTap   = atk   && !prevAttack;
    const dodgeTap = dodge && !prevDodge;
    prevAttack = atk; prevDodge = dodge;

    if (ped.stun <= 0) {
      if (atkTap && canAttack(ped))   startThrust(ped);
      if (dodgeTap && canDodge(ped))  startDodge(ped);

      if (ped.state === 'idle') {
        const speed = PED_SPEED * (ped.state === 'idle' ? 1 : 0.4);
        if (wantFwd)  distance -= speed * dt;
        if (wantBack) distance += speed * dt;
      } else if (ped.state === 'thrusting') {
        // movimiento muy reducido durante estocada
        if (wantFwd)  distance -= PED_SPEED * 0.25 * dt;
        if (wantBack) distance += PED_SPEED * 0.25 * dt;
      }
    }

    updateAI(dt);

    distance = Math.max(DIST_MIN, Math.min(DIST_MAX, distance));

    resolveThrust(ped,  kike);
    resolveThrust(kike, ped);

    if (kike.hp <= 0 && !ended) {
      ended = true;
      window.Audio8.sfx('win');
      window.Effects.explosion(W / 2, 200, { count: 30, speed: 130 });
      setTimeout(() => window.Loop.setScene('VICTORY'), 1100);
    }
    if (ped.hp <= 0 && !ended && !window.GameState.state.infiniteLives) {
      ended = true;
      setTimeout(() => window.Loop.setScene('DEFEAT'), 900);
    } else if (ped.hp <= 0) {
      ped.hp = PED_MAX_HP;  // vidas infinitas: regen
    }
  }

  function advanceFighter(f, dt) {
    f.thrustCd = Math.max(0, f.thrustCd - dt);
    f.dodgeCd  = Math.max(0, f.dodgeCd  - dt);
    f.stun     = Math.max(0, f.stun     - dt);
    f.shake    = Math.max(0, f.shake    - dt);
    if (f.state === 'thrusting') {
      f.thrustT += dt;
      if (f.thrustT >= THRUST_DUR) { f.state = 'idle'; f.thrustT = 0; f.thrustHit = false; }
    }
    if (f.state === 'dodging') {
      f.dodgeT += dt;
      if (f.dodgeT >= DODGE_DUR) { f.state = 'idle'; f.dodgeT = 0; }
    }
  }

  function canAttack(f) { return f.state === 'idle' && f.thrustCd <= 0; }
  function canDodge(f)  { return f.state === 'idle' && f.dodgeCd  <= 0; }

  function startThrust(f) {
    f.state = 'thrusting';
    f.thrustT = 0;
    f.thrustHit = false;
    f.thrustCd = THRUST_COOLDOWN;
    window.Audio8.sfx('saber');
  }

  function startDodge(f) {
    f.state = 'dodging';
    f.dodgeT = 0;
    f.dodgeDir = dodgeFlip;
    dodgeFlip = -dodgeFlip;
    f.dodgeCd = DODGE_COOLDOWN;
  }

  // i-frames durante el pico del ladeo
  function inIFrames(f) {
    return f.state === 'dodging' && f.dodgeT >= DODGE_IFR_0 && f.dodgeT <= DODGE_IFR_1;
  }

  function resolveThrust(attacker, target) {
    if (attacker.state !== 'thrusting' || attacker.thrustHit) return;
    if (attacker.thrustT < THRUST_HIT0 || attacker.thrustT > THRUST_HIT1) return;
    if (distance > THRUST_RANGE) return;

    if (inIFrames(target)) {
      attacker.thrustHit = true;
      missFlash = 0.18;
      // chispas suaves al filo del esquive
      const screenPos = screenPosOf(target);
      window.Effects.sparks(screenPos.cx, screenPos.cy, {
        count: 10, color: '#9ce8ff', colorAlt: '#fff8c0', speed: 100, life: 0.32,
      });
      return;
    }

    attacker.thrustHit = true;
    target.hp -= 1;
    target.stun = 0.32;
    target.shake = 0.3;
    hitFlash = target === ped ? 0.35 : 0.18;
    window.Audio8.sfx('hit');

    if (target === ped) window.GameState.loseLife();

    const sp = screenPosOf(target);
    window.Effects.sparks(sp.cx, sp.cy, {
      count: 14, color: '#ff9090', colorAlt: '#ffe080', speed: 110, life: 0.4,
    });
    window.Effects.dust(sp.cx, sp.cy + 6, {
      count: 6, color: '#3a2840', colorAlt: '#5a4060', speed: 36,
    });
  }

  function updateAI(dt) {
    const k = kike;
    if (k.stun > 0) return;
    k.aiTimer += dt;

    if (distance > THRUST_RANGE * 0.95) {
      // Cierra distancia
      if (k.state === 'idle') distance -= KIKE_SPEED * dt;
      else if (k.state === 'thrusting') distance -= KIKE_SPEED * 0.25 * dt;
      // ocasionalmente esquiva cuando Pedrito ataca, incluso de lejos
      if (ped.state === 'thrusting' && canDodge(k) && Math.random() < 0.02) startDodge(k);
      return;
    }

    // En rango: decisiones cada aiNext
    if (k.state !== 'idle') return;
    if (k.aiTimer < k.aiNext) {
      // si Pedrito está atacando, sube prob. de esquivar de inmediato
      if (ped.state === 'thrusting' && ped.thrustT < THRUST_HIT1 && canDodge(k) && Math.random() < 0.18) {
        startDodge(k);
      }
      return;
    }
    k.aiTimer = 0;
    k.aiNext = 0.55 + Math.random() * 0.6;
    const r = Math.random();
    if (ped.state === 'thrusting') {
      if (r < 0.7 && canDodge(k)) startDodge(k);
      else if (canAttack(k)) startThrust(k);
      else distance += 0.06;
      return;
    }
    if (r < 0.55 && canAttack(k)) startThrust(k);
    else if (r < 0.78 && canDodge(k)) startDodge(k);
    else distance += 0.05; // pequeño retroceso
  }

  // --------- Posiciones en pantalla ---------
  // depth: 0 = primer plano (Pedrito), 1 = lejos (Kike a max distance)
  function depthToScreen(depth) {
    const t = Math.max(0, Math.min(1, depth));
    return FLOOR_BOTTOM + (FLOOR_TOP - FLOOR_BOTTOM) * t;
  }
  function depthToScale(depth) {
    const t = Math.max(0, Math.min(1, depth));
    return PED_SCALE * (1 - 0.62 * t);
  }

  function kikeDepth() {
    return KIKE_DEPTH_NEAR + distance * (KIKE_DEPTH_FAR - KIKE_DEPTH_NEAR);
  }

  function screenPosOf(f) {
    if (f === ped) {
      const off = fighterOffset(f);
      const sc = PED_SCALE;
      const cx = W / 2 + off.dx;
      const cy = PED_FEET_Y - 10 * sc + off.dy;
      return { cx, cy, sc, depth: 0, feetY: PED_FEET_Y };
    } else {
      const d = kikeDepth();
      const feetY = depthToScreen(d);
      const sc = depthToScale(d);
      const off = fighterOffset(f);
      const cx = W / 2 + off.dx;
      const cy = feetY - 10 * sc + off.dy;
      return { cx, cy, sc, depth: d, feetY };
    }
  }

  function fighterOffset(f) {
    if (f.state !== 'dodging') return { dx: 0, dy: 0, rot: 0 };
    const p = f.dodgeT / DODGE_DUR;
    const env = Math.sin(p * Math.PI);
    // ladeo visible: la cara rota fuerte (∼45°) y el cuerpo se inclina poco
    return {
      dx: f.dodgeDir * 8 * env,
      dy: 0,
      rot: f.dodgeDir * 0.75 * env,
    };
  }

  // --------- Render ---------
  function render(ctx) {
    drawBackground(ctx);
    drawCorridorFloor(ctx);
    drawMarianBalcony(ctx);

    // Kike (lejos) antes que Pedrito (cerca)
    drawKikeFighter(ctx);
    drawPedFighter(ctx);

    window.Effects.render(ctx);
    drawHUD(ctx);
    drawButtons(ctx);

    if (missFlash > 0) {
      ctx.fillStyle = `rgba(120,220,255,${(missFlash * 0.35).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${(hitFlash * 0.55).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (ended && kike.hp <= 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 220, W, 50);
      ctx.fillStyle = '#3aff60';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡VICTORIA!', W / 2, 252);
      ctx.textAlign = 'left';
    }
  }

  function drawBackground(ctx) {
    // Gradiente: morado profundo arriba, casi negro abajo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#0f0a26');
    g.addColorStop(0.35, '#070716');
    g.addColorStop(1,    '#03030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Ventanal en el fondo (encima del horizonte) con estrellas
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
    // travesaño central
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(winX + winW / 2 - 1, winY, 2, winH);

    // Pared bajo el ventanal hasta el inicio del suelo
    ctx.fillStyle = '#13131e';
    ctx.fillRect(0, winY + winH, W, FLOOR_TOP - (winY + winH));
    // banda metálica del horizonte
    ctx.fillStyle = '#22222e';
    ctx.fillRect(0, FLOOR_TOP - 4, W, 4);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, FLOOR_TOP - 1, W, 1);

    // Luces rojas decorativas a los lados
    for (let i = 0; i < 4; i++) {
      const y = FLOOR_TOP + 24 + i * 80;
      drawSideLight(ctx, 6,  y, plasmaT + i);
      drawSideLight(ctx, W - 12, y, plasmaT + i + 0.5);
    }
  }

  function drawSideLight(ctx, x, y, phase) {
    const flicker = 0.7 + Math.sin(phase * 6) * 0.25;
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 20);
    grad.addColorStop(0, `rgba(255,60,60,${(flicker * 0.7).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 20, y - 20, 40, 40);
    ctx.fillStyle = `rgba(255,80,80,${flicker.toFixed(2)})`;
    ctx.fillRect(x - 2, y - 3, 4, 6);
    ctx.restore();
  }

  function drawCorridorFloor(ctx) {
    // Pintar suelo: cuadrilátero entre punto de fuga y borde inferior
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W / 2 - FAR_HALF_W, FLOOR_TOP);
    ctx.lineTo(W / 2 + FAR_HALF_W, FLOOR_TOP);
    ctx.lineTo(W / 2 + NEAR_HALF_W, FLOOR_BOTTOM);
    ctx.lineTo(W / 2 - NEAR_HALF_W, FLOOR_BOTTOM);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, FLOOR_TOP, 0, FLOOR_BOTTOM);
    grad.addColorStop(0, '#0d0d18');
    grad.addColorStop(1, '#1c1c2a');
    ctx.fillStyle = grad;
    ctx.fill();
    // Paredes laterales
    ctx.fillStyle = '#0b0b16';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_TOP);
    ctx.lineTo(W / 2 - FAR_HALF_W, FLOOR_TOP);
    ctx.lineTo(W / 2 - NEAR_HALF_W, FLOOR_BOTTOM);
    ctx.lineTo(0, FLOOR_BOTTOM);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, FLOOR_TOP);
    ctx.lineTo(W / 2 + FAR_HALF_W, FLOOR_TOP);
    ctx.lineTo(W / 2 + NEAR_HALF_W, FLOOR_BOTTOM);
    ctx.lineTo(W, FLOOR_BOTTOM);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Líneas verticales del suelo (convergen al VP)
    ctx.strokeStyle = '#2a2a40';
    ctx.lineWidth = 1;
    for (const lane of [-0.66, -0.33, 0, 0.33, 0.66]) {
      const x0 = W / 2 + lane * NEAR_HALF_W * 2;
      const x1 = W / 2 + lane * FAR_HALF_W  * 2;
      ctx.beginPath();
      ctx.moveTo(x0, FLOOR_BOTTOM);
      ctx.lineTo(x1, FLOOR_TOP);
      ctx.stroke();
    }
    // Líneas horizontales (baldosas) — espaciado no uniforme para perspectiva
    ctx.strokeStyle = '#3a3a50';
    const STRIPES = [0.08, 0.18, 0.30, 0.45, 0.62, 0.82];
    for (const t of STRIPES) {
      const y = FLOOR_TOP + (FLOOR_BOTTOM - FLOOR_TOP) * t;
      const half = FAR_HALF_W + (NEAR_HALF_W - FAR_HALF_W) * t;
      ctx.beginPath();
      ctx.moveTo(W / 2 - half, y);
      ctx.lineTo(W / 2 + half, y);
      ctx.stroke();
    }

    // Línea de plasma que marca el rango de la estocada (a la "y" de Kike
    // cuando está justo en rango). Se ilumina al pulsar atacar.
    const rangeDepth = KIKE_DEPTH_NEAR + THRUST_RANGE * (KIKE_DEPTH_FAR - KIKE_DEPTH_NEAR);
    const rangeY = depthToScreen(rangeDepth);
    const inRange = distance <= THRUST_RANGE;
    const pulse = 0.5 + Math.sin(plasmaT * 5) * 0.5;
    const halfRange = FAR_HALF_W + (NEAR_HALF_W - FAR_HALF_W) * (1 - rangeDepth);
    ctx.save();
    ctx.globalAlpha = inRange ? 0.7 + 0.3 * pulse : 0.25 + 0.15 * pulse;
    ctx.strokeStyle = inRange ? '#5acbff' : '#2a4858';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfRange + 8, rangeY);
    ctx.lineTo(W / 2 + halfRange - 8, rangeY);
    ctx.stroke();
    ctx.restore();
  }

  function drawMarianBalcony(ctx) {
    // Pasarela suspendida al lateral izquierdo, profundidad media (entre
    // Pedrito y Kike). Vista frontal-ligeramente picada.
    const x = MARIAN.x, fy = MARIAN.feetY, s = MARIAN.scale;
    // soporte vertical
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(0, fy - 4, 56, 8);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, fy - 4, 56, 2);
    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(0, fy + 4, 56, 4);
    // barandilla
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(52, fy - 14, 2, 14);
    ctx.fillRect(28, fy - 12, 2, 12);
    ctx.fillRect(4,  fy - 14, 2, 14);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, fy - 14, 56, 2);

    // Marian sobre la pasarela
    const sprH = 20 * s;
    const sprX = x;
    const sprY = fy - sprH;
    // Cuerpo + foto (mirando levemente a su izquierda hacia el centro = facing 1)
    window.Characters.drawMarian(ctx, sprX, sprY, s, { facing: 1 });

    // Etiqueta
    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MARIAN', x - 2, fy + 18);
  }

  function drawPedFighter(ctx) {
    const sc = PED_SCALE;
    const sprW = 14 * sc;
    const sprH = 20 * sc;
    const baseX = W / 2 - sprW / 2;
    const baseY = PED_FEET_Y - sprH;
    const off = fighterOffset(ped);

    // sombra fija en el suelo (los pies no salen del sitio)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(W / 2, PED_FEET_Y + 4, sprW * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (ped.shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    ctx.translate(off.dx, off.dy);

    const bobOffset = ped.state === 'idle' ? Math.sin(bobT * 4) * 1 : 0;
    window.Characters.drawPedrito(ctx, baseX, baseY + bobOffset, sc, 'idle', { rotation: off.rot });
    drawThrustingSaber(ctx, ped, baseX + sprW * 0.78, baseY + sprH * 0.42 + bobOffset, sc, '#3aff60', /*upward*/ true);

    ctx.restore();
  }

  function drawKikeFighter(ctx) {
    const sp = screenPosOf(kike);
    const sc = sp.sc;
    const sprW = 14 * sc;
    const sprH = 20 * sc;
    const feetY = sp.feetY;
    const baseX = W / 2 - sprW / 2;
    const baseY = feetY - sprH;
    const off = fighterOffset(kike);

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(W / 2, feetY + 3, sprW * 0.55, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (kike.shake > 0) ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    ctx.translate(off.dx, off.dy);

    const bobOffset = kike.state === 'idle' ? Math.sin(bobT * 4 + 1.2) * 1 : 0;
    window.Characters.drawKikeVader(ctx, baseX, baseY + bobOffset, sc, { rotation: off.rot });
    drawThrustingSaber(ctx, kike, baseX + sprW * 0.22, baseY + sprH * 0.42 + bobOffset, sc, '#ff3a3a', /*upward*/ false);

    ctx.restore();
  }

  // Sable en perspectiva vertical: empuñadura en (hx, hy), hoja en dirección
  // upward(+ — hacia arriba) o downward(- — hacia abajo). En thrust, alargamos
  // bruscamente la hoja. En idle se mantiene una longitud relajada con leve
  // inclinación lateral.
  // El sable tiene longitud fija (no escala con la profundidad del cuerpo) —
  // Kike, aunque se vea más pequeño por estar lejos, conserva un sable largo,
  // como los de Star Wars. Así la estocada visualmente llega de un combatiente
  // al otro a pesar de la perspectiva.
  function drawThrustingSaber(ctx, f, hx, hy, scale, color, upward) {
    let len = 50;
    let lateral = 0;

    if (f.state === 'thrusting') {
      const p = Math.min(1, f.thrustT / THRUST_DUR);
      const env = p < 0.35 ? (p / 0.35) : (1 - (p - 0.35) / 0.65);
      len = len + env * 120;
    } else if (f.state === 'dodging') {
      len *= 0.7;
      lateral = f.dodgeDir * 10;
    } else {
      lateral = Math.sin(bobT * 3 + (f === kike ? 0.7 : 0)) * 3;
    }

    const dir = upward ? -1 : 1;
    const tipX = hx + lateral;
    const tipY = hy + dir * len;

    window.Characters.drawSaber(ctx, hx, hy, tipX, tipY, color);
  }

  // --------- HUD + botones ---------
  function drawHUD(ctx) {
    drawHpBar(ctx, 16, 14, 130, 10, ped.hp / ped.maxHp, '#3aff60', 'PEDRITO');
    drawHpBar(ctx, W - 146, 14, 130, 10, kike.hp / kike.maxHp, '#ff3a3a', 'K. VADER', true);
    window.NarrativeHUD.drawLives(ctx, W / 2 - 18, 30);

    // Indicador de distancia (columna derecha): arriba = en alcance (cerca de
    // Kike), abajo = lejos. Marca azul = umbral de la estocada.
    const barX = W - 18, barY = 50, barH = 200;
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, 8, barH + 2);
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(barX, barY, 6, barH);
    const rangeY = barY + barH * THRUST_RANGE;
    ctx.fillStyle = '#5acbff';
    ctx.fillRect(barX - 2, rangeY - 1, 10, 2);
    const cursorY = barY + distance * barH;
    ctx.fillStyle = '#ffe81f';
    ctx.fillRect(barX - 2, cursorY - 2, 10, 3);
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
    ctx.globalAlpha = isHeld ? 1 : 0.78;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(b.x, b.y, b.w, 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = color;
    ctx.font = (b.label.length <= 2 ? '24px' : '10px') + ' "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 8);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function colorFor(b, isHeld) {
    switch (b.id) {
      case 'fwd':   return isHeld ? '#ffffff' : '#bbbbcc';
      case 'back':  return isHeld ? '#ffffff' : '#bbbbcc';
      case 'dodge': return isHeld ? '#9ce8ff' : '#4a8fa8';
      case 'atk':   return isHeld ? '#ffe080' : '#a0801a';
    }
    return '#fff';
  }

  window.Loop.register('LIGHTSABER', { enter, update, render });
})();
