// Pantalla 2 (rediseñada): Pedrito conduce su Manitou Milenaria entre los
// pasillos de un gran almacén de materiales de construcción y debe esquivar
// los obstáculos típicos del sector: palets apilados, agujeros en el suelo,
// pilas de ladrillos, sacos de cemento, paquetes de varillas (rebar),
// bidones, etc.
//
// Mecánica:
//   - Vista cenital. La Manitou se desliza horizontalmente con touch o ←/→.
//   - El "suelo" se desplaza hacia abajo dando sensación de avance.
//   - Los obstáculos aparecen arriba y bajan; chocar resta una vida.
//   - Tras DURATION segundos, el almacén termina y pasa a NARRATIVE_3.
(function () {
  'use strict';

  const W = 360, H = 640;
  const DURATION = 22;
  const PLAYER_W = 24, PLAYER_H = 20;

  // Limites del pasillo (queda hueco para mostrar paredes/estanterías)
  const LANE_X0 = 36;
  const LANE_X1 = W - 36;
  const SCROLL_SPEED = 280;

  let player, obstacles, timer, scroll, lose, win, hitFlash;
  let shelves, ceilLamps, floorStripeOffset;
  let spawnTimer, thrustT;

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
    floorStripeOffset = 0;

    shelves = [];
    for (let i = 0; i < 8; i++) {
      shelves.push({ side: i % 2 === 0 ? 'L' : 'R', y: -i * 120 });
    }
    ceilLamps = [];
    for (let i = 0; i < 10; i++) {
      ceilLamps.push({ y: -i * 90, on: Math.random() < 0.85 });
    }

    window.Effects.reset();
  }

  function update(dt) {
    timer += dt;
    scroll += SCROLL_SPEED * dt;
    thrustT += dt;
    floorStripeOffset = (floorStripeOffset + SCROLL_SPEED * dt) % 40;
    window.Effects.update(dt);

    // Parallax fondos
    for (const sh of shelves)   { sh.y += 200 * dt; if (sh.y > H + 80) sh.y -= H + 200; }
    for (const lp of ceilLamps) { lp.y += 240 * dt; if (lp.y > H + 20) { lp.y -= H + 80; lp.on = Math.random() < 0.8; } }

    // Control
    const p = window.Input.pointer;
    if (p.isDown) {
      player.x += (p.x - PLAYER_W / 2 - player.x) * Math.min(1, dt * 14);
    }
    if (window.Input.isKey('ArrowLeft'))  player.x -= 220 * dt;
    if (window.Input.isKey('ArrowRight')) player.x += 220 * dt;
    player.x = Math.max(LANE_X0 - 4, Math.min(LANE_X1 - PLAYER_W + 4, player.x));

    if (thrustT > 0.02) {
      thrustT = 0;
      window.Effects.thrust(player.x + 6,            player.y + PLAYER_H, '#ffae40');
      window.Effects.thrust(player.x + PLAYER_W - 6, player.y + PLAYER_H, '#ffae40');
    }

    // Spawn obstáculos
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 1.10 - Math.min(0.45, timer / 50);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += SCROLL_SPEED * dt;
      if (o.y > H + 40) { obstacles.splice(i, 1); continue; }
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

  // ------- Obstáculos: tipo, dimensiones y dibujo ------
  // Cada obstáculo tiene un hitbox AABB (x,y,w,h) y un drawer.
  const OBSTACLE_TYPES = [
    { kind: 'pallet', w: 60, h: 38 },
    { kind: 'hole',   w: 78, h: 78 },
    { kind: 'bricks', w: 50, h: 38 },
    { kind: 'cement', w: 96, h: 28 },
    { kind: 'rebar',  w: 120, h: 16 },
    { kind: 'bucket', w: 32, h: 38 },
  ];

  function spawnObstacle() {
    // Mezcla aleatoria con pesos para distribución natural
    const roll = Math.random();
    let t;
    if      (roll < 0.30) t = OBSTACLE_TYPES[0]; // pallet
    else if (roll < 0.45) t = OBSTACLE_TYPES[1]; // hole
    else if (roll < 0.65) t = OBSTACLE_TYPES[2]; // bricks
    else if (roll < 0.80) t = OBSTACLE_TYPES[3]; // cement
    else if (roll < 0.92) t = OBSTACLE_TYPES[4]; // rebar
    else                  t = OBSTACLE_TYPES[5]; // bucket

    const minX = LANE_X0 + 2;
    const maxX = LANE_X1 - t.w - 2;
    const x = minX + Math.random() * Math.max(1, maxX - minX);
    obstacles.push({
      kind: t.kind,
      x, y: -t.h,
      w: t.w, h: t.h,
      seed: Math.random() * 1000,
    });
  }

  function drawPlayer(ctx) {
    if (window.Vehicles && window.Vehicles.isReady()) {
      const w = 48;
      const h = w * window.Vehicles.aspect();
      const cx = player.x + PLAYER_W / 2;
      const cy = player.y + PLAYER_H - h / 2;
      window.Vehicles.drawManitouTop(ctx, cx, cy, w);
    } else {
      window.Characters.drawXwing(ctx, player.x, player.y, 2);
    }
  }

  function intersects(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x ||
             a.y + a.h < b.y || b.y + b.h < a.y);
  }

  function hit() {
    if (hitFlash > 0) return;
    hitFlash = 0.45;
    window.Audio8.sfx('hit');
    window.Effects.explosion(player.x + PLAYER_W / 2, player.y, { count: 14, speed: 70 });
    window.GameState.loseLife();
  }

  // ============================== RENDER ==============================

  function render(ctx) {
    // Suelo gris hormigón
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, W, H);

    drawWarehouseFloor(ctx);
    drawWalls(ctx);
    drawShelvesParallax(ctx);
    drawCeilLamps(ctx);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${(hitFlash * 0.55).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Obstáculos
    for (const o of obstacles) {
      drawObstacle(ctx, o);
    }

    drawPlayer(ctx);
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
    ctx.fillText('ALMACÉN', W / 2, H - 26);
    ctx.textAlign = 'left';
  }

  function drawWarehouseFloor(ctx) {
    // Marcas amarillas de pasillo (líneas discontinuas a los lados)
    ctx.fillStyle = '#d6b020';
    const stripeH = 24, gap = 16, segH = stripeH + gap;
    for (let y = -segH + floorStripeOffset; y < H; y += segH) {
      ctx.fillRect(LANE_X0 - 2, y, 4, stripeH);
      ctx.fillRect(LANE_X1 - 2, y, 4, stripeH);
    }
    // Sombras del techo (atmósfera)
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = -60 + floorStripeOffset * 0.3; y < H; y += 80) {
      ctx.fillRect(LANE_X0, y, LANE_X1 - LANE_X0, 18);
    }
  }

  function drawWalls(ctx) {
    // Paredes laterales de hormigón con franjas de seguridad amarillas/negras
    drawWall(ctx, 0, 0, LANE_X0, H, 'L');
    drawWall(ctx, LANE_X1, 0, W - LANE_X1, H, 'R');
  }

  function drawWall(ctx, x, y, w, h, side) {
    const grad = side === 'L'
      ? ctx.createLinearGradient(x, 0, x + w, 0)
      : ctx.createLinearGradient(x + w, 0, x, 0);
    grad.addColorStop(0,   '#1a1a1e');
    grad.addColorStop(0.6, '#3a3a40');
    grad.addColorStop(1,   '#5a5a60');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Franja de aviso amarillo/negro junto al pasillo
    const stripeX = side === 'L' ? x + w - 10 : x;
    const stripeW = 10;
    const stripeH = 14;
    const off = (scroll * 0.5) % (stripeH * 2);
    for (let yy = -stripeH * 2 + off; yy < h; yy += stripeH) {
      ctx.fillStyle = ((Math.floor(yy / stripeH) + Math.floor(off)) % 2 === 0) ? '#ffd040' : '#1a1a1a';
      ctx.fillRect(stripeX, yy, stripeW, stripeH);
    }
  }

  function drawShelvesParallax(ctx) {
    for (const sh of shelves) {
      drawShelf(ctx, sh.side, sh.y);
    }
  }

  function drawShelf(ctx, side, yTop) {
    const x = side === 'L' ? 6 : W - 24;
    // Estantería metálica vertical con balda y cajas
    ctx.fillStyle = '#888';
    ctx.fillRect(x, yTop, 18, 80);
    ctx.fillStyle = '#5a5a60';
    ctx.fillRect(x, yTop, 18, 2);
    ctx.fillRect(x, yTop + 78, 18, 2);
    ctx.fillRect(x, yTop + 38, 18, 2);
    // Cajas en estantes
    ctx.fillStyle = '#a06030';
    ctx.fillRect(x + 2, yTop + 4,  14, 30);
    ctx.fillStyle = '#c07840';
    ctx.fillRect(x + 2, yTop + 4,  14, 4);
    ctx.fillStyle = '#a06030';
    ctx.fillRect(x + 2, yTop + 42, 14, 32);
    ctx.fillStyle = '#c07840';
    ctx.fillRect(x + 2, yTop + 42, 14, 4);
  }

  function drawCeilLamps(ctx) {
    for (const lp of ceilLamps) {
      const cx = W / 2;
      ctx.fillStyle = lp.on ? '#fff5c0' : '#403820';
      ctx.fillRect(cx - 18, lp.y, 36, 4);
      if (lp.on) {
        const grad = ctx.createRadialGradient(cx, lp.y + 2, 2, cx, lp.y + 2, 60);
        grad.addColorStop(0, 'rgba(255,240,160,0.18)');
        grad.addColorStop(1, 'rgba(255,240,160,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 60, lp.y - 40, 120, 100);
      }
      // soporte
      ctx.fillStyle = '#5a5a60';
      ctx.fillRect(cx - 1, lp.y - 6, 2, 6);
    }
  }

  // ----------------------------- OBSTÁCULOS ---------------------------

  function drawObstacle(ctx, o) {
    switch (o.kind) {
      case 'pallet':  drawPalletObs(ctx, o); break;
      case 'hole':    drawHole(ctx, o); break;
      case 'bricks':  drawBrickStack(ctx, o); break;
      case 'cement':  drawCementBag(ctx, o); break;
      case 'rebar':   drawRebar(ctx, o); break;
      case 'bucket':  drawBucket(ctx, o); break;
    }
  }

  function drawPalletObs(ctx, o) {
    // Palet visto desde arriba: tablones rojo madera con separaciones
    ctx.fillStyle = '#5a2410';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#9a4020';
    const slatH = 6, gap = 3;
    for (let yy = 2; yy < o.h - 2; yy += slatH + gap) {
      ctx.fillRect(o.x + 2, o.y + yy, o.w - 4, slatH);
    }
    // sombras
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(o.x, o.y + o.h - 3, o.w, 3);
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(o.x, o.y, o.w, 2);
  }

  function drawHole(ctx, o) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const r = Math.min(o.w, o.h) / 2;
    // Halo del borde (asfalto roto)
    ctx.fillStyle = '#1a1a1c';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Profundidad (gradiente negro)
    const grad = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy, r - 4);
    grad.addColorStop(0, '#000');
    grad.addColorStop(1, '#1a1a1c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.fill();
    // bordes desconchados
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + o.seed * 0.01;
      const rr = r - 1;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // cono naranja de seguridad al borde
    ctx.fillStyle = '#ff8030';
    ctx.beginPath();
    ctx.moveTo(o.x + 6, o.y + 6);
    ctx.lineTo(o.x + 14, o.y);
    ctx.lineTo(o.x + 18, o.y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(o.x + 8, o.y + 5, 8, 1);
  }

  function drawBrickStack(ctx, o) {
    // Filas de ladrillos alternados (apilados)
    const brickH = 8;
    const brickW = 16;
    const cols = Math.floor(o.w / brickW);
    const rows = Math.floor(o.h / brickH);
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2 === 0) ? 0 : brickW / 2;
      for (let c = -1; c <= cols; c++) {
        const bx = o.x + c * brickW + offset;
        const by = o.y + r * brickH;
        if (bx < o.x - 1 || bx + brickW > o.x + o.w + 1) continue;
        ctx.fillStyle = '#c04a28';
        ctx.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);
        ctx.fillStyle = '#7a2a14';
        ctx.fillRect(bx, by, brickW, 1);
        ctx.fillRect(bx, by, 1, brickH);
      }
    }
    // sombra base
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(o.x, o.y + o.h - 3, o.w, 3);
  }

  function drawCementBag(ctx, o) {
    // Saco rectangular gris con etiqueta blanca
    ctx.fillStyle = '#7a7a78';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#9a9a98';
    ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 4);
    ctx.fillStyle = '#5a5a58';
    ctx.fillRect(o.x, o.y + o.h - 4, o.w, 4);
    // Etiqueta
    ctx.fillStyle = '#ffffff';
    const lx = o.x + o.w / 2 - 24;
    const ly = o.y + o.h / 2 - 6;
    ctx.fillRect(lx, ly, 48, 12);
    ctx.fillStyle = '#3a3a3a';
    ctx.font = 'bold 8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CEM', o.x + o.w / 2, o.y + o.h / 2);
  }

  function drawRebar(ctx, o) {
    // Haz de varillas: rectángulos finos oxidados con bandas
    ctx.fillStyle = '#6a4818';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#9a6a20';
    const barH = 3;
    for (let yy = 2; yy < o.h - 2; yy += barH + 1) {
      ctx.fillRect(o.x + 2, o.y + yy, o.w - 4, barH);
    }
    // amarres rojos
    ctx.fillStyle = '#c02020';
    ctx.fillRect(o.x + 14,        o.y - 1, 4, o.h + 2);
    ctx.fillRect(o.x + o.w - 18,  o.y - 1, 4, o.h + 2);
    // brillos punta
    ctx.fillStyle = '#dca850';
    ctx.fillRect(o.x,           o.y + o.h / 2 - 1, 3, 2);
    ctx.fillRect(o.x + o.w - 3, o.y + o.h / 2 - 1, 3, 2);
  }

  function drawBucket(ctx, o) {
    // Bidón / cubo de obra azul con asa
    const cx = o.x + o.w / 2;
    ctx.fillStyle = '#1a4ea0';
    ctx.fillRect(o.x + 2, o.y + 4, o.w - 4, o.h - 4);
    ctx.fillStyle = '#3a78d8';
    ctx.fillRect(o.x + 2, o.y + 4, o.w - 4, 4);
    ctx.fillStyle = '#0a2a60';
    ctx.fillRect(o.x + 2, o.y + o.h - 6, o.w - 4, 2);
    // asa
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(o.x + 4,        o.y, 2, 6);
    ctx.fillRect(o.x + o.w - 6,  o.y, 2, 6);
    ctx.fillRect(o.x + 4,        o.y, o.w - 8, 2);
    // etiqueta blanca
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(o.x + 8, o.y + 14, o.w - 16, 8);
  }

  window.Loop.register('RACING', { enter, update, render });
})();
