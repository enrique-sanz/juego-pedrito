// Sistema simple de partículas: chispas (sables), explosiones (cazas TIE),
// polvo (suelos, manitou cavando) y destellos (HUD). Pool fijo para evitar
// allocations en el bucle.
(function () {
  'use strict';

  const POOL_SIZE = 240;
  const pool = new Array(POOL_SIZE);
  for (let i = 0; i < POOL_SIZE; i++) {
    pool[i] = makeParticle();
  }
  let activeCount = 0;

  function makeParticle() {
    return {
      active: false,
      type: 'spark',
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 0, maxLife: 0,
      size: 1,
      color: '#fff',
      gravity: 0,
      drag: 0,
    };
  }

  function alloc() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = pool[i];
      if (!p.active) {
        p.active = true;
        activeCount++;
        return p;
      }
    }
    return null; // pool agotado
  }

  function reset() {
    for (let i = 0; i < POOL_SIZE; i++) pool[i].active = false;
    activeCount = 0;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Chispas (choque de sables, impactos)
  function sparks(x, y, opts) {
    const cfg = Object.assign({
      count: 12,
      color: '#fff8c0',
      colorAlt: '#ffc060',
      speed: 110,
      life: 0.45,
      size: 2,
      cone: Math.PI * 2,
      dir: -Math.PI / 2,
    }, opts || {});
    for (let i = 0; i < cfg.count; i++) {
      const p = alloc(); if (!p) return;
      const ang = cfg.dir + (Math.random() - 0.5) * cfg.cone;
      const sp = cfg.speed * (0.5 + Math.random());
      p.type = 'spark';
      p.x = x; p.y = y;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
      p.life = p.maxLife = cfg.life * (0.7 + Math.random() * 0.6);
      p.size = cfg.size;
      p.color = Math.random() < 0.5 ? cfg.color : cfg.colorAlt;
      p.gravity = 220;
      p.drag = 0.92;
    }
  }

  // Explosión
  function explosion(x, y, opts) {
    const cfg = Object.assign({
      count: 18,
      color: '#ff8030',
      colorAlt: '#ffd060',
      life: 0.6,
      size: 3,
      speed: 90,
    }, opts || {});
    for (let i = 0; i < cfg.count; i++) {
      const p = alloc(); if (!p) return;
      const ang = Math.random() * Math.PI * 2;
      const sp = cfg.speed * (0.4 + Math.random());
      p.type = 'explosion';
      p.x = x; p.y = y;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
      p.life = p.maxLife = cfg.life * (0.6 + Math.random() * 0.8);
      p.size = cfg.size;
      p.color = Math.random() < 0.5 ? cfg.color : cfg.colorAlt;
      p.gravity = 0;
      p.drag = 0.88;
    }
    // núcleo blanco breve
    for (let i = 0; i < 5; i++) {
      const p = alloc(); if (!p) return;
      const ang = Math.random() * Math.PI * 2;
      p.type = 'explosion';
      p.x = x; p.y = y;
      p.vx = Math.cos(ang) * 40;
      p.vy = Math.sin(ang) * 40;
      p.life = p.maxLife = 0.18;
      p.size = 4;
      p.color = '#ffffff';
      p.gravity = 0;
      p.drag = 0.92;
    }
  }

  // Polvo (cavar)
  function dust(x, y, opts) {
    const cfg = Object.assign({
      count: 6,
      color: '#a07845',
      colorAlt: '#7a4f24',
      life: 0.6,
      speed: 50,
      size: 2,
    }, opts || {});
    for (let i = 0; i < cfg.count; i++) {
      const p = alloc(); if (!p) return;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const sp = cfg.speed * (0.4 + Math.random());
      p.type = 'dust';
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
      p.life = p.maxLife = cfg.life * (0.8 + Math.random() * 0.5);
      p.size = cfg.size;
      p.color = Math.random() < 0.5 ? cfg.color : cfg.colorAlt;
      p.gravity = 180;
      p.drag = 0.94;
    }
  }

  // Trazo de propulsor (X-wing)
  function thrust(x, y, color) {
    const p = alloc(); if (!p) return;
    p.type = 'thrust';
    p.x = x + rand(-1, 1);
    p.y = y;
    p.vx = rand(-15, 15);
    p.vy = 80 + rand(-10, 30);
    p.life = p.maxLife = 0.32;
    p.size = 2;
    p.color = color || '#ffae40';
    p.gravity = 0;
    p.drag = 0.94;
  }

  function update(dt) {
    if (activeCount === 0) return;
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        activeCount--;
        continue;
      }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function render(ctx) {
    if (activeCount === 0) return;
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = pool[i];
      if (!p.active) continue;
      const lifePct = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, lifePct * 1.2);
      const s = p.type === 'thrust'
        ? Math.max(1, p.size * lifePct)
        : p.size;
      ctx.fillRect(p.x | 0, p.y | 0, s, s);
    }
    ctx.globalAlpha = 1;
  }

  window.Effects = { sparks, explosion, dust, thrust, update, render, reset, get active() { return activeCount; } };
})();
