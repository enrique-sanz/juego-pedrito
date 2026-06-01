// Pantalla 3 (puzle): dentro de la compactadora del centro de residuos.
// Pedrito conduce una Manitou con HORQUILLA (carretilla elevadora) y debe
// apilar los escombros para montar una rampa y escapar por el hueco de la
// pared derecha antes de que el techo lo aplaste.
//
// Reglas:
//   - Hay dos tipos de escombro: palets CUADRADOS y palets RAMPA (cuña).
//   - La Manitou se sitúa SOBRE su columna y opera la columna que tiene
//     DELANTE (según hacia dónde mira): COGE el escombro de arriba del vecino,
//     o lo SUELTA encima del vecino. Nunca opera la columna en la que está.
//   - Desde el suelo solo se puede apilar hasta altura 2. Para apilar más alto
//     hay que SUBIRSE a un escalón más alto (por la rampa) y apilar desde allí
//     (alcance = nivel actual + 2).
//   - Solo se sube un escalón si está rematado con una rampa.
//   - Cuando la rampa llega al hueco, se sube a mano y se escapa.
(function () {
  'use strict';

  const W = 360, H = 640;

  // Geometría
  const C_X = 20;
  const C_W = 320;
  const FLOOR_Y = 540;
  const C_TOP_LIMIT = 80;
  const COLS = 5;
  const COL_W = C_W / COLS;          // 64
  const PAL_H = 30;
  const PAL_W = 52;
  const REACH = 2;                   // alcance de apilado por encima del nivel

  const EXIT_COL = COLS - 1;         // 4
  const EXIT_LEVEL = 4;
  const EXIT_DOOR_BOT = FLOOR_Y - EXIT_LEVEL * PAL_H;
  const EXIT_DOOR_TOP = EXIT_DOOR_BOT - 52;

  const CEIL_SPEED = 3.2;            // px/s (lento: es un puzle de pensar)
  const CEIL_LOSE_Y = FLOOR_Y - EXIT_LEVEL * PAL_H - 8;

  // Estado
  let cols;            // array[COLS] de arrays ('sq'|'ramp')
  let manitouCol;
  let facing;          // -1 | +1 (hacia dónde apunta la horquilla)
  let holding;         // null | 'sq' | 'ramp'
  let ceilY;
  let lose, win;
  let outcomeT;
  let liftAnim, dropAnim;
  let shakeT;
  let timer;
  let started;
  let exiting, exitT;
  let manitouXVisual, manitouYVisual;

  // Botones
  const BTN_SIZE = 78;
  const BTN_Y = H - BTN_SIZE - 44;
  const BTN_LEFT_X = 12;
  const BTN_RIGHT_X = W - BTN_SIZE - 12;
  const BTN_ACT_X = (W - BTN_SIZE) / 2;

  let prevL = false, prevR = false, prevAct = false;

  function enter() {
    cols = [
      ['ramp', 'sq'],          // rampa enterrada: hay que retirar el cuadrado de encima
      ['sq'],
      ['sq', 'ramp'],
      ['sq', 'ramp'],
      ['sq', 'sq', 'ramp'],
    ];
    manitouCol = 1;
    facing = 1;
    holding = null;
    ceilY = C_TOP_LIMIT;
    lose = false; win = false;
    outcomeT = 0;
    liftAnim = 0; dropAnim = 0;
    shakeT = 0;
    timer = 0;
    started = false;
    exiting = false; exitT = 0;
    manitouXVisual = colCenterX(manitouCol);
    manitouYVisual = surfaceY(manitouCol);
    prevL = prevR = prevAct = false;
    window.Effects.reset();
  }

  // ----- helpers de pila -----
  function colCenterX(c) { return C_X + c * COL_W + COL_W / 2; }
  function height(c) { return cols[c].length; }
  function topItem(c) { return cols[c].length ? cols[c][cols[c].length - 1] : null; }
  function topIsRamp(c) { return topItem(c) === 'ramp'; }
  function level() { return height(manitouCol); }
  function surfaceY(c) { return FLOOR_Y - height(c) * PAL_H; }

  // Objetivo: rampa continua hasta la salida.
  function rampComplete() {
    if (height(0) !== 0) return false;
    for (let c = 1; c <= EXIT_COL; c++) {
      if (height(c) !== height(c - 1) + 1) return false;
      if (!topIsRamp(c)) return false;
    }
    return height(EXIT_COL) === EXIT_LEVEL;
  }

  // ============================== UPDATE ==============================

  function update(dt) {
    timer += dt;
    window.Effects.update(dt);

    if (!started) {
      animManitou(dt);
      if (timer > 0.5 && window.Input.actionJustPressed()) { started = true; prevAct = true; }
      return;
    }

    if (exiting) {
      exitT += dt;
      manitouXVisual += (C_X + C_W + 70 - manitouXVisual) * Math.min(1, dt * 4);
      if (exitT > 1.2) { win = true; window.Loop.setScene('NARRATIVE_4'); }
      return;
    }

    if (lose) {
      outcomeT += dt;
      if (outcomeT > 1.3) {
        if (window.GameState.state.infiniteLives || window.GameState.state.lives > 0) enter();
        else window.Loop.setScene('DEFEAT');
      }
      return;
    }

    handleInput();
    animManitou(dt);
    if (liftAnim > 0) liftAnim = Math.max(0, liftAnim - dt * 3);
    if (dropAnim > 0) dropAnim = Math.max(0, dropAnim - dt * 3);

    ceilY += CEIL_SPEED * dt;
    if (ceilY >= CEIL_LOSE_Y) {
      lose = true; outcomeT = 0; shakeT = 0.45;
      window.Audio8.sfx('explosion');
      window.GameState.loseLife();
      window.Effects.explosion(manitouXVisual, FLOOR_Y - 24, { count: 22, speed: 90 });
    }

    if (shakeT > 0) shakeT -= dt;
  }

  function animManitou(dt) {
    manitouXVisual += (colCenterX(manitouCol) - manitouXVisual) * Math.min(1, dt * 12);
    manitouYVisual += (surfaceY(manitouCol) - manitouYVisual) * Math.min(1, dt * 12);
  }

  // ----------------------- input / acciones -----------------------

  function handleInput() {
    const p = window.Input.pointer;
    const left  = pressedLeft(p);
    const right = pressedRight(p);
    const act   = pressedAct(p);
    if (left && !prevL) press(-1);
    if (right && !prevR) press(+1);
    if (act && !prevAct) doAction();
    prevL = left; prevR = right; prevAct = act;
  }

  function inBtn(p, bx) {
    return p.isDown && p.x >= bx && p.x <= bx + BTN_SIZE && p.y >= BTN_Y && p.y <= BTN_Y + BTN_SIZE;
  }
  function pressedLeft(p)  { return inBtn(p, BTN_LEFT_X)  || window.Input.isKey('ArrowLeft'); }
  function pressedRight(p) { return inBtn(p, BTN_RIGHT_X) || window.Input.isKey('ArrowRight'); }
  function pressedAct(p) {
    return inBtn(p, BTN_ACT_X) || window.Input.isKey('Space') ||
           window.Input.isKey('Enter') || window.Input.isKey('NumpadEnter') ||
           window.Input.isKey('KeyZ');
  }

  // Pulsar en sentido contrario al que mira = girar (sin moverse). En el mismo
  // sentido = avanzar/subir/bajar una columna.
  function press(dir) {
    if (dir !== facing) { facing = dir; return; }
    const nc = manitouCol + dir;
    if (nc < 0 || nc >= COLS) return;
    const lvl = level();
    const hc = height(nc);
    let ok = false;
    if (hc <= lvl) ok = true;                                   // bajar / llano
    else if (hc === lvl + 1 && topIsRamp(nc)) ok = true;        // subir un escalón (rampa)
    if (!ok) return;
    manitouCol = nc;
    window.Audio8.sfx('hit');
    if (manitouCol === EXIT_COL && height(EXIT_COL) === EXIT_LEVEL) startExit();
  }

  // Operación sobre la columna de delante.
  function targetCol() { return manitouCol + facing; }

  function actionLabel() {
    const c = targetCol();
    if (c < 0 || c >= COLS) return '—';
    if (holding) {
      if (height(c) + 1 > level() + REACH) return '—';   // fuera de alcance
      return 'SOLTAR';
    }
    return height(c) > 0 ? 'COGER' : '—';
  }

  function doAction() {
    const c = targetCol();
    if (c < 0 || c >= COLS) return;
    if (holding) {
      if (height(c) + 1 > level() + REACH) return;
      cols[c].push(holding);
      holding = null;
      dropAnim = 1;
      window.Audio8.sfx('hit');
    } else {
      if (height(c) <= 0) return;
      holding = cols[c].pop();
      liftAnim = 1;
      window.Audio8.sfx('hit');
    }
  }

  function startExit() {
    exiting = true; exitT = 0; facing = 1;
    window.Audio8.sfx('win');
  }

  // ============================== RENDER ==============================

  function render(ctx) {
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

    ctx.fillStyle = '#0c0d12';
    ctx.fillRect(0, 0, W, H);

    drawChamber(ctx);
    drawExitDoor(ctx);
    drawTargetHighlight(ctx);
    drawStacks(ctx);
    drawCeiling(ctx);
    drawManitou(ctx);
    window.Effects.render(ctx);

    drawHUD(ctx);
    drawButtons(ctx);

    if (!started) drawIntro(ctx);
    if (lose) drawLoseOverlay(ctx);

    ctx.restore();
  }

  function drawChamber(ctx) {
    ctx.fillStyle = '#241a14';
    ctx.fillRect(C_X, FLOOR_Y, C_W, H - FLOOR_Y);
    ctx.fillStyle = '#3a2820';
    for (let i = 0; i < 14; i++) ctx.fillRect(C_X + ((i * 41) % C_W), FLOOR_Y + ((i * 7) % 60), 8, 4);

    drawWall(ctx, 0, C_X, 'L');
    drawWall(ctx, C_X + C_W, W - (C_X + C_W), 'R');

    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(C_X, 0, C_W, Math.max(0, ceilY));

    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(C_X, 0, C_W, 18);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!  COMPACTADORA  !', W / 2, 13);
  }

  function drawWall(ctx, x, w, side) {
    const g = side === 'L' ? ctx.createLinearGradient(x, 0, x + w, 0)
                           : ctx.createLinearGradient(x + w, 0, x, 0);
    g.addColorStop(0, '#3a2a18'); g.addColorStop(0.6, '#241a10'); g.addColorStop(1, '#120a04');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, H);
    ctx.fillStyle = '#5a4220';
    ctx.fillRect(x + (side === 'L' ? w - 4 : 0), 0, 4, H);
  }

  function drawExitDoor(ctx) {
    const dx = C_X + C_W;
    ctx.fillStyle = '#ffe81f';
    ctx.fillRect(dx - 6, EXIT_DOOR_TOP - 2, 14, EXIT_DOOR_BOT - EXIT_DOOR_TOP + 4);
    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(dx - 2, EXIT_DOOR_TOP, 12, EXIT_DOOR_BOT - EXIT_DOOR_TOP);
    const cy = (EXIT_DOOR_TOP + EXIT_DOOR_BOT) / 2;
    const ax = dx + 6 + Math.sin(timer * 2) * 3;
    ctx.fillStyle = '#7af0a8';
    ctx.beginPath();
    ctx.moveTo(ax, cy); ctx.lineTo(ax - 8, cy - 6); ctx.lineTo(ax - 8, cy + 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe81f';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SALIDA', dx + 2, EXIT_DOOR_TOP - 4);
  }

  // Resalta la columna que la horquilla tiene delante (la que va a operar).
  function drawTargetHighlight(ctx) {
    if (!started || exiting || lose) return;
    const c = targetCol();
    if (c < 0 || c >= COLS) return;
    const x = C_X + c * COL_W;
    ctx.save();
    ctx.globalAlpha = 0.12 + Math.sin(timer * 4) * 0.05;
    ctx.fillStyle = actionLabel() === '—' ? '#ff5050' : '#7af0a8';
    ctx.fillRect(x + 2, ceilY + 4, COL_W - 4, FLOOR_Y - ceilY - 4);
    ctx.restore();
  }

  function drawStacks(ctx) {
    for (let c = 0; c < COLS; c++) {
      const cx = colCenterX(c);
      for (let k = 0; k < cols[c].length; k++) {
        if (cols[c][k] === 'sq') drawSquare(ctx, cx, FLOOR_Y - (k + 1) * PAL_H);
        else drawRamp(ctx, cx, FLOOR_Y - k * PAL_H);
      }
    }
    if (holding) {
      const cx = manitouXVisual + facing * (COL_W * 0.5);
      const top = manitouYVisual - 18 - PAL_H;
      if (holding === 'sq') drawSquare(ctx, cx, top);
      else drawRamp(ctx, cx, top + PAL_H);
    }
  }

  function drawSquare(ctx, cx, top) {
    const x = cx - PAL_W / 2, y = top;
    ctx.fillStyle = '#8a3a1a';
    ctx.fillRect(x, y, PAL_W, PAL_H);
    ctx.fillStyle = '#a8501e';
    ctx.fillRect(x + 3, y + 3, PAL_W - 6, PAL_H - 6);
    ctx.fillStyle = '#5a2410';
    ctx.fillRect(x, y, PAL_W, 3);
    ctx.fillRect(x, y + PAL_H - 3, PAL_W, 3);
    ctx.fillRect(x, y, 4, PAL_H);
    ctx.fillRect(x + PAL_W - 4, y, 4, PAL_H);
    ctx.fillRect(x + PAL_W / 2 - 2, y, 4, PAL_H);
    ctx.fillStyle = '#2a0a04';
    ctx.fillRect(x, y, PAL_W, 1);
  }

  function drawRamp(ctx, cx, baseY) {
    const L = cx - COL_W / 2 + 6;
    const R = cx + COL_W / 2 - 6;
    const bottom = baseY;
    const top = baseY - PAL_H;
    ctx.fillStyle = '#b5641e';
    ctx.beginPath();
    ctx.moveTo(L, bottom); ctx.lineTo(R, bottom); ctx.lineTo(R, top);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a3e10';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const fx = L + (R - L) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(fx, bottom);
      ctx.lineTo(fx, bottom - (bottom - top) * (i / 4));
      ctx.stroke();
    }
    ctx.strokeStyle = '#e8a24a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L, bottom); ctx.lineTo(R, top);
    ctx.stroke();
  }

  function drawCeiling(ctx) {
    if (ceilY <= C_TOP_LIMIT - 20) return;
    const y0 = Math.max(-30, ceilY - 80);
    const g = ctx.createLinearGradient(0, y0, 0, ceilY);
    g.addColorStop(0, '#2a2a32'); g.addColorStop(0.7, '#5a5a68'); g.addColorStop(1, '#1a1a22');
    ctx.fillStyle = g;
    ctx.fillRect(C_X, y0, C_W, ceilY - y0);
    ctx.fillStyle = '#7a7a8a';
    ctx.fillRect(C_X + 6, 0, 6, ceilY);
    ctx.fillRect(C_X + C_W - 12, 0, 6, ceilY);
    ctx.fillStyle = '#cccccc';
    const tooth = 14;
    for (let x = C_X; x < C_X + C_W; x += tooth) {
      ctx.beginPath();
      ctx.moveTo(x, ceilY); ctx.lineTo(x + tooth / 2, ceilY + 10); ctx.lineTo(x + tooth, ceilY);
      ctx.closePath(); ctx.fill();
    }
  }

  // ---------- Manitou con HORQUILLA (carretilla elevadora roja) ----------
  function drawManitou(ctx) {
    const cx = manitouXVisual;
    const sY = manitouYVisual;          // superficie donde apoyan las ruedas
    drawForklift(ctx, cx, sY, facing);
    // Pedrito en la cabina
    window.Characters.drawPedrito(ctx, cx - 14, sY - 64, 1.3, 'idle');

    if (!exiting && rampComplete() && manitouCol === EXIT_COL - 1 &&
        Math.floor(timer * 2) % 2 === 0) {
      ctx.fillStyle = '#7af0a8';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('→', cx + 16, sY - 50);
    }
  }

  function drawForklift(ctx, cx, sY, dir) {
    const bodyW = 40, bodyH = 22;
    const bx = cx - bodyW / 2;
    const by = sY - 8 - bodyH;          // 8 = hueco de las ruedas
    // ruedas
    ctx.fillStyle = '#1a1a1a';
    for (const wx of [cx - 12, cx + 12]) {
      ctx.beginPath(); ctx.arc(wx, sY - 6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath(); ctx.arc(wx, sY - 6, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
    }
    // chasis rojo
    ctx.fillStyle = '#d62828';
    ctx.fillRect(bx, by, bodyW, bodyH);
    ctx.fillStyle = '#ff6a4a';
    ctx.fillRect(bx, by, bodyW, 3);
    ctx.fillStyle = '#8a1810';
    ctx.fillRect(bx, by + bodyH - 3, bodyW, 3);
    // cabina
    const cabX = dir > 0 ? bx + 6 : bx + bodyW - 22;
    ctx.fillStyle = '#d62828';
    ctx.fillRect(cabX, by - 14, 16, 16);
    ctx.fillStyle = '#52b8d8';
    ctx.fillRect(cabX + 2, by - 12, 12, 9);
    ctx.fillStyle = '#a8e8ff';
    ctx.fillRect(cabX + 2, by - 12, 12, 2);
    // mástil vertical y horquilla (en el sentido de 'dir')
    const mastX = dir > 0 ? bx + bodyW : bx;
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(mastX - 2, by - 16, 4, bodyH + 14);
    // dos uñas de la horquilla
    const forkLen = COL_W * 0.55;
    const forkBaseX = mastX;
    ctx.fillStyle = '#bdbdbd';
    for (const fy of [sY - 10, sY - 4]) {
      if (dir > 0) ctx.fillRect(forkBaseX, fy, forkLen, 3);
      else ctx.fillRect(forkBaseX - forkLen, fy, forkLen, 3);
    }
  }

  // ------------------------------- HUD -------------------------------
  function drawHUD(ctx) {
    window.NarrativeHUD.drawLives(ctx);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('APILA LOS ESCOMBROS Y ESCAPA', W / 2, 34);

    const pct = Math.max(0, Math.min(1, (ceilY - C_TOP_LIMIT) / (CEIL_LOSE_Y - C_TOP_LIMIT)));
    ctx.fillStyle = '#000';
    ctx.fillRect(38, BTN_Y - 16, W - 76, 10);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(40, BTN_Y - 14, W - 80, 6);
    ctx.fillStyle = pct > 0.7 ? '#ff3030' : pct > 0.4 ? '#ffae40' : '#7af0a8';
    ctx.fillRect(40, BTN_Y - 14, (W - 80) * pct, 6);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText('TECHO', W / 2, BTN_Y - 22);
  }

  function drawButtons(ctx) {
    drawBtn(ctx, BTN_LEFT_X, '←', false);
    drawBtn(ctx, BTN_RIGHT_X, '→', false);
    const label = actionLabel();
    drawBtn(ctx, BTN_ACT_X, label, label === '—');
  }

  function drawBtn(ctx, x, label, disabled) {
    ctx.save();
    ctx.globalAlpha = disabled ? 0.25 : 0.55;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, BTN_Y, BTN_SIZE, BTN_SIZE);
    ctx.globalAlpha = disabled ? 0.4 : 0.85;
    ctx.strokeStyle = '#ffe81f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, BTN_Y + 1, BTN_SIZE - 2, BTN_SIZE - 2);
    ctx.fillStyle = '#ffe81f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${label.length <= 2 ? 28 : 10}px "Press Start 2P", monospace`;
    ctx.fillText(label, x + BTN_SIZE / 2, BTN_Y + BTN_SIZE / 2);
    ctx.restore();
  }

  function drawIntro(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe81f';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText('¡ATRAPADO!', W / 2, 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P", monospace';
    const lines = [
      'El techo baja sobre Pedrito',
      'y las paredes lo encierran.',
      '',
      'Usa la Manitou para apilar',
      'los escombros del suelo de',
      'modo que pueda escapar por',
      'la salida de la pared.',
    ];
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, 150 + i * 18);
    if (Math.floor(timer * 2) % 2 === 0) {
      ctx.fillStyle = '#ffe81f';
      ctx.fillText('TOCA PARA EMPEZAR', W / 2, H - 90);
    }
    ctx.restore();
  }

  function drawLoseOverlay(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, outcomeT * 1.4);
    ctx.fillStyle = 'rgba(180,30,30,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('APLASTADO', W / 2, H / 2);
    ctx.restore();
  }

  window.Loop.register('COMPACTOR', { enter, update, render });
})();
