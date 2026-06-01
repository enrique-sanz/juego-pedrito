// Pantalla 3 (rediseñada): puzle dentro de la compactadora del centro de
// residuos. Pedrito conduce su Manitou y debe apilar palets para formar una
// rampa que llegue a la puerta lateral antes de que el techo descienda y le
// aplaste.
//
// Mecánica:
//   - 4 columnas verticales. Cada columna puede contener una pila de palets.
//   - La Manitou se mueve entre columnas; solo puede pasar a una columna
//     adyacente si la diferencia de altura es <= 1 palet (un escalón).
//   - Las horquillas operan sobre la columna que tiene DELANTE (sentido de
//     mirada): el botón ACCIÓN LEVANTA el palet superior si va vacía, o
//     SUELTA el palet si la lleva.
//   - El techo desciende; si toca a la Manitou, Pedrito pierde una vida.
//   - La puerta de salida está en la pared derecha al nivel 2 de palets:
//     cuando la Manitou esté en la columna 3 sobre 2 palets apilados,
//     Pedrito escapa.
//
// Estado inicial diseñado para tener una solución corta y clara:
//   stacks = [2, 2, 1, 0]
//   Objetivo: stacks = [0, 1, 2, 2] (consume 3 movimientos de palet).
(function () {
  'use strict';

  const W = 360, H = 640;

  // Geometría del compactador
  const C_X = 20;
  const C_W = 320;
  const FLOOR_Y = 540;
  const C_TOP_LIMIT = 80;          // posición inicial del techo (arriba)
  const COLS = 4;
  const COL_W = C_W / COLS;        // 80
  const PAL_H = 32;
  const PAL_W = 70;
  const MAN_SCALE = 2;
  const MAN_W = 60;                // chasis dibujado por drawManitou con s=2
  const MAN_VISUAL_H = 58;         // altura visual aproximada con brazo bajo

  const EXIT_COL = COLS - 1;       // 3
  const EXIT_LEVEL = 2;            // altura de stack necesaria para escapar
  const EXIT_DOOR_BOT = FLOOR_Y - EXIT_LEVEL * PAL_H;
  const EXIT_DOOR_TOP = EXIT_DOOR_BOT - 56;

  const CEIL_SPEED = 6.4;          // px/s — calibrado para ~55s antes de aplastar

  // Estado
  let stacks;
  let manitouCol;
  let facing;
  let holding;
  let ceilY;
  let win, lose;
  let outcomeT;
  let liftAnim;       // 0..1, animación del brazo al levantar
  let dropAnim;       // 0..1
  let pedJumpT;       // animación de salida (Pedrito salta de la Manitou)
  let shakeT;
  let timer;
  let manitouXVisual; // para animación suave entre columnas

  // Botones (mobile)
  const BTN_SIZE = 78;
  const BTN_Y = H - BTN_SIZE - 14;
  const BTN_LEFT_X = 12;
  const BTN_RIGHT_X = W - BTN_SIZE - 12;
  const BTN_ACT_X = (W - BTN_SIZE) / 2;

  let prevL = false, prevR = false, prevAct = false;

  function enter() {
    stacks = [2, 2, 1, 0];
    manitouCol = 0;
    facing = 1;
    holding = false;
    ceilY = C_TOP_LIMIT;
    win = false; lose = false;
    outcomeT = 0;
    liftAnim = 0;
    dropAnim = 0;
    pedJumpT = 0;
    shakeT = 0;
    timer = 0;
    manitouXVisual = colCenterX(manitouCol);
    prevL = prevR = prevAct = false;
    window.Effects.reset();
  }

  function colCenterX(c) {
    return C_X + c * COL_W + COL_W / 2;
  }

  function manitouTopY() {
    // y de la parte alta de la Manitou cuando descansa sobre la pila de su col
    return FLOOR_Y - stacks[manitouCol] * PAL_H - MAN_VISUAL_H;
  }

  function update(dt) {
    timer += dt;

    if (!win && !lose) {
      ceilY += CEIL_SPEED * dt;
      handleInput();

      // Anim suave horizontal de la Manitou
      const tgtX = colCenterX(manitouCol);
      manitouXVisual += (tgtX - manitouXVisual) * Math.min(1, dt * 14);

      // Anim de brazo
      if (liftAnim > 0) liftAnim = Math.max(0, liftAnim - dt * 3);
      if (dropAnim > 0) dropAnim = Math.max(0, dropAnim - dt * 3);

      // Lose: techo aplasta a la Manitou
      const mTop = manitouTopY();
      if (ceilY >= mTop - 2) {
        lose = true;
        outcomeT = 0;
        shakeT = 0.45;
        window.Audio8.sfx('explosion');
        window.GameState.loseLife();
        window.Effects.explosion(manitouXVisual, mTop + MAN_VISUAL_H / 2,
                                 { count: 22, speed: 90 });
      }

      // Win: Manitou en exit col con stack >= exit level, no llevando palet
      if (manitouCol === EXIT_COL && stacks[EXIT_COL] >= EXIT_LEVEL && !holding) {
        win = true;
        outcomeT = 0;
        pedJumpT = 0;
        window.Audio8.sfx('win');
      }
    } else {
      outcomeT += dt;
      if (win) {
        pedJumpT = Math.min(1, pedJumpT + dt * 0.55);
        if (outcomeT > 2.2) window.Loop.setScene('NARRATIVE_4');
      } else {
        if (outcomeT > 1.3) {
          if (window.GameState.state.infiniteLives || window.GameState.state.lives > 0) {
            enter();
          } else {
            window.Loop.setScene('DEFEAT');
          }
        }
      }
    }

    if (shakeT > 0) shakeT -= dt;
    window.Effects.update(dt);
  }

  function handleInput() {
    const p = window.Input.pointer;
    const left  = isLeftPressed(p);
    const right = isRightPressed(p);
    const act   = isActPressed(p);

    if (left && !prevL) attemptMove(-1);
    if (right && !prevR) attemptMove(+1);
    if (act && !prevAct) doAction();

    prevL = left; prevR = right; prevAct = act;
  }

  function pointInBtn(p, bx, by) {
    return p.isDown && p.x >= bx && p.x <= bx + BTN_SIZE &&
           p.y >= by && p.y <= by + BTN_SIZE;
  }
  function isLeftPressed(p) {
    if (pointInBtn(p, BTN_LEFT_X, BTN_Y)) return true;
    return window.Input.isKey('ArrowLeft');
  }
  function isRightPressed(p) {
    if (pointInBtn(p, BTN_RIGHT_X, BTN_Y)) return true;
    return window.Input.isKey('ArrowRight');
  }
  function isActPressed(p) {
    if (pointInBtn(p, BTN_ACT_X, BTN_Y)) return true;
    return window.Input.isKey('Space') ||
           window.Input.isKey('Enter')  ||
           window.Input.isKey('NumpadEnter') ||
           window.Input.isKey('KeyZ');
  }

  function attemptMove(dir) {
    facing = dir;
    const nc = manitouCol + dir;
    if (nc < 0 || nc >= COLS) return;
    const diff = stacks[nc] - stacks[manitouCol];
    if (diff > 1) return;          // demasiado alto para escalar
    if (diff < -2) return;         // demasiada caída
    manitouCol = nc;
  }

  function doAction() {
    const tgt = manitouCol + facing;
    if (tgt < 0 || tgt >= COLS) return;
    if (holding) {
      stacks[tgt]++;
      holding = false;
      dropAnim = 1;
      window.Audio8.sfx('hit');
    } else {
      if (stacks[tgt] <= 0) return;
      stacks[tgt]--;
      holding = true;
      liftAnim = 1;
      window.Audio8.sfx('hit');
    }
  }

  // ============================== RENDER ==============================

  function render(ctx) {
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }

    // Fondo
    ctx.fillStyle = '#0c0d12';
    ctx.fillRect(0, 0, W, H);

    drawCompactorChamber(ctx);
    drawExitDoor(ctx);
    drawPallets(ctx);
    drawCeiling(ctx);
    drawManitouAndPedrito(ctx);
    window.Effects.render(ctx);

    drawHUD(ctx);
    drawButtons(ctx);

    if (win)  drawWinOverlay(ctx);
    if (lose) drawLoseOverlay(ctx);

    ctx.restore();
  }

  function drawCompactorChamber(ctx) {
    // Suelo (basura compactada)
    ctx.fillStyle = '#241a14';
    ctx.fillRect(C_X, FLOOR_Y, C_W, H - FLOOR_Y);
    // textura
    ctx.fillStyle = '#3a2820';
    for (let i = 0; i < 14; i++) {
      const x = C_X + ((i * 41) % C_W);
      const y = FLOOR_Y + ((i * 7) % 60);
      ctx.fillRect(x, y, 8, 4);
    }
    ctx.fillStyle = '#6a5018';
    for (let i = 0; i < 6; i++) {
      const x = C_X + 10 + ((i * 67) % (C_W - 30));
      const y = FLOOR_Y + 8 + ((i * 11) % 40);
      ctx.fillRect(x, y, 6, 3);
    }

    // Pared izquierda (industrial)
    drawIndustrialWall(ctx, 0, 0, C_X, H, 'L');
    // Pared derecha
    drawIndustrialWall(ctx, C_X + C_W, 0, W - (C_X + C_W), H, 'R');

    // Sombra del techo (parte ya tapada por el techo descendido)
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(C_X, 0, C_W, Math.max(0, ceilY));

    // Marco superior fijo (rieles donde corre el techo)
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(C_X, 0, C_W, 18);
    ctx.fillStyle = '#3a3a4a';
    for (let x = C_X; x < C_X + C_W; x += 16) {
      ctx.fillRect(x + 2, 4, 12, 2);
    }

    // Carteles de aviso
    ctx.save();
    ctx.fillStyle = '#ffe81f';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!  PRECAUCIÓN  !', W / 2, 14);
    ctx.restore();
  }

  function drawIndustrialWall(ctx, x, y, w, h, side) {
    const grad = side === 'L'
      ? ctx.createLinearGradient(x, 0, x + w, 0)
      : ctx.createLinearGradient(x + w, 0, x, 0);
    grad.addColorStop(0,   '#3a2a18');
    grad.addColorStop(0.6, '#241a10');
    grad.addColorStop(1,   '#120a04');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // bandas verticales
    ctx.fillStyle = '#5a4220';
    ctx.fillRect(x + (side === 'L' ? w - 4 : 0), y, 4, h);
    // tornillos
    ctx.fillStyle = '#1a0f06';
    for (let yy = 20; yy < h; yy += 80) {
      const sx = side === 'L' ? w - 10 : 4;
      ctx.fillRect(x + sx, yy, 4, 4);
    }
  }

  function drawExitDoor(ctx) {
    // Hueco en la pared derecha al nivel 2.
    const dx = C_X + C_W;
    // Marco
    ctx.fillStyle = '#ffe81f';
    ctx.fillRect(dx - 6, EXIT_DOOR_TOP - 2, 14, EXIT_DOOR_BOT - EXIT_DOOR_TOP + 4);
    // Hueco oscuro
    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(dx - 2, EXIT_DOOR_TOP, 12, EXIT_DOOR_BOT - EXIT_DOOR_TOP);
    // Flecha indicadora animada
    const tt = timer * 2;
    const arrowX = dx + 6 + Math.sin(tt) * 3;
    ctx.fillStyle = '#7af0a8';
    ctx.beginPath();
    ctx.moveTo(arrowX,      (EXIT_DOOR_TOP + EXIT_DOOR_BOT) / 2);
    ctx.lineTo(arrowX - 8,  (EXIT_DOOR_TOP + EXIT_DOOR_BOT) / 2 - 6);
    ctx.lineTo(arrowX - 8,  (EXIT_DOOR_TOP + EXIT_DOOR_BOT) / 2 + 6);
    ctx.closePath();
    ctx.fill();
    // texto SALIDA pequeño
    ctx.fillStyle = '#ffe81f';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SALIDA', dx + 2, EXIT_DOOR_TOP - 4);
  }

  function drawPallets(ctx) {
    for (let c = 0; c < COLS; c++) {
      const cx = colCenterX(c);
      for (let k = 0; k < stacks[c]; k++) {
        const by = FLOOR_Y - k * PAL_H - PAL_H;
        drawPallet(ctx, cx, by);
      }
    }
    // palet en horquillas
    if (holding) {
      const cx = manitouXVisual + facing * 18;
      const cy = manitouTopY() - 8;
      drawPallet(ctx, cx, cy);
    }
  }

  function drawPallet(ctx, cx, top) {
    const x = cx - PAL_W / 2;
    const y = top;
    // Cuerpo (madera rojiza, estilo palet industrial)
    ctx.fillStyle = '#8a3a1a';
    ctx.fillRect(x, y, PAL_W, PAL_H);
    // Tablones horizontales
    ctx.fillStyle = '#a04a1e';
    ctx.fillRect(x + 2, y + 2,  PAL_W - 4, 6);
    ctx.fillRect(x + 2, y + 12, PAL_W - 4, 6);
    ctx.fillRect(x + 2, y + 22, PAL_W - 4, 6);
    // Sombras entre tablones
    ctx.fillStyle = '#4a1a08';
    ctx.fillRect(x + 2, y + 8,  PAL_W - 4, 2);
    ctx.fillRect(x + 2, y + 18, PAL_W - 4, 2);
    // Patas (3 verticales en el frente)
    ctx.fillStyle = '#6a2a14';
    ctx.fillRect(x,             y, 6, PAL_H);
    ctx.fillRect(x + PAL_W / 2 - 3, y, 6, PAL_H);
    ctx.fillRect(x + PAL_W - 6, y, 6, PAL_H);
    // borde
    ctx.fillStyle = '#2a0a04';
    ctx.fillRect(x, y, PAL_W, 1);
    ctx.fillRect(x, y + PAL_H - 1, PAL_W, 1);
  }

  function drawCeiling(ctx) {
    if (ceilY <= C_TOP_LIMIT - 20) return;
    // Plancha metálica con dientes inferiores
    const y0 = Math.max(-30, ceilY - 80);
    // cuerpo
    const grad = ctx.createLinearGradient(0, y0, 0, ceilY);
    grad.addColorStop(0, '#2a2a32');
    grad.addColorStop(0.7, '#5a5a68');
    grad.addColorStop(1, '#1a1a22');
    ctx.fillStyle = grad;
    ctx.fillRect(C_X, y0, C_W, ceilY - y0);
    // remaches
    ctx.fillStyle = '#1a1a22';
    for (let x = C_X + 12; x < C_X + C_W - 8; x += 28) {
      ctx.fillRect(x, y0 + 8, 4, 4);
    }
    // pistones a los lados
    ctx.fillStyle = '#7a7a8a';
    ctx.fillRect(C_X + 6, 0, 6, ceilY);
    ctx.fillRect(C_X + C_W - 12, 0, 6, ceilY);
    // dientes inferiores (sierra)
    ctx.fillStyle = '#cccccc';
    const tooth = 14;
    for (let x = C_X; x < C_X + C_W; x += tooth) {
      ctx.beginPath();
      ctx.moveTo(x, ceilY);
      ctx.lineTo(x + tooth / 2, ceilY + 10);
      ctx.lineTo(x + tooth, ceilY);
      ctx.closePath();
      ctx.fill();
    }
    // sombra debajo del techo
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(C_X, ceilY + 10, C_W, 18);
  }

  function drawManitouAndPedrito(ctx) {
    if (win && pedJumpT > 0.2) {
      // Pedrito salta hacia la salida
      const px = manitouXVisual + lerp(0, EXIT_COL === manitouCol ? 60 : 0, pedJumpT);
      const py = manitouTopY() - lerp(0, 26, Math.sin(pedJumpT * Math.PI));
      // Manitou se queda
      drawManitouSprite(ctx, manitouXVisual, manitouTopY());
      window.Characters.drawPedrito(ctx, px - 14, py, 2);
      return;
    }
    drawManitouSprite(ctx, manitouXVisual, manitouTopY());
    // Pedrito sentado sobre la cabina
    const px = manitouXVisual - 14;
    const py = manitouTopY() - 22;
    window.Characters.drawPedrito(ctx, px, py, 1.5);
  }

  function drawManitouSprite(ctx, cx, topY) {
    // armAngle: 0..0.8. Sube cuando va con un palet en las horquillas o
    // durante la animación de levantar.
    const lifting = holding ? 1 : Math.max(liftAnim, dropAnim);
    const armAngle = 0.15 + lifting * 0.6;
    // El sprite se ancla por su esquina superior izquierda; chasis ~30 cells × scale 2 = 60w
    const x = cx - MAN_W / 2;
    // Manitou mira a 'facing'. drawManitou solo dibuja hacia la derecha;
    // si facing=-1 hacemos flip horizontal.
    ctx.save();
    if (facing < 0) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-cx, 0);
    }
    window.Characters.drawManitou(ctx, x - 2, topY, MAN_SCALE, armAngle);
    ctx.restore();
  }

  function drawHUD(ctx) {
    window.NarrativeHUD.drawLives(ctx);

    ctx.fillStyle = '#ffe81f';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('APILA PALETS Y ESCAPA', W / 2, 30);
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText('< MOVER >    ACCIÓN: LEVANTAR / SOLTAR', W / 2, 46);

    // Barra del techo
    const fall = (ceilY - C_TOP_LIMIT) / (FLOOR_Y - C_TOP_LIMIT - MAN_VISUAL_H);
    const pct = Math.max(0, Math.min(1, fall));
    ctx.fillStyle = '#000';
    ctx.fillRect(38, H - BTN_SIZE - 30, W - 76, 10);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(40, H - BTN_SIZE - 28, W - 80, 6);
    ctx.fillStyle = pct > 0.7 ? '#ff3030' : pct > 0.4 ? '#ffae40' : '#7af0a8';
    ctx.fillRect(40, H - BTN_SIZE - 28, (W - 80) * pct, 6);
    ctx.fillStyle = '#ffe81f';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TECHO', W / 2, H - BTN_SIZE - 36);
  }

  function drawButtons(ctx) {
    // Botones traslúcidos (no estorbar la vista)
    drawBtn(ctx, BTN_LEFT_X, BTN_Y, '←');
    drawBtn(ctx, BTN_RIGHT_X, BTN_Y, '→');
    let label;
    if (holding) label = 'SOLTAR';
    else {
      const tgt = manitouCol + facing;
      if (tgt < 0 || tgt >= COLS) label = '—';
      else label = stacks[tgt] > 0 ? 'COGER' : '—';
    }
    drawBtn(ctx, BTN_ACT_X, BTN_Y, label, label === '—');
  }

  function drawBtn(ctx, x, y, label, disabled) {
    ctx.save();
    ctx.globalAlpha = disabled ? 0.25 : 0.55;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, BTN_SIZE, BTN_SIZE);
    ctx.globalAlpha = disabled ? 0.4 : 0.85;
    ctx.strokeStyle = '#ffe81f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, BTN_SIZE - 2, BTN_SIZE - 2);
    ctx.fillStyle = '#ffe81f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = label.length <= 2 ? 28 : 10;
    ctx.font = `${fs}px "Press Start 2P", monospace`;
    ctx.fillText(label, x + BTN_SIZE / 2, y + BTN_SIZE / 2);
    ctx.restore();
  }

  function drawWinOverlay(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, outcomeT * 0.9);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7af0a8';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('¡ESCAPADO!', W / 2, H / 2);
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

  function lerp(a, b, t) { return a + (b - a) * t; }

  window.Loop.register('COMPACTOR', { enter, update, render });
})();
