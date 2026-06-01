// Campo de estrellas reutilizable. Crear con createField(opts) y llamar update/render.
(function () {
  'use strict';

  function createField(opts) {
    const cfg = Object.assign({
      width: 360,
      height: 640,
      count: 70,
      speed: 30,        // px/seg
      twinkle: true,
    }, opts || {});

    const stars = new Array(cfg.count);
    for (let i = 0; i < cfg.count; i++) {
      stars[i] = makeStar(cfg);
    }

    function makeStar(c) {
      const s = {
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        size: Math.random() < 0.15 ? 2 : 1,
        speed: c.speed * (0.4 + Math.random() * 1.6),
        phase: Math.random() * Math.PI * 2,
      };
      return s;
    }

    function update(dt) {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y += s.speed * dt;
        if (s.y > cfg.height + 2) {
          s.y = -2;
          s.x = Math.random() * cfg.width;
        }
        if (cfg.twinkle) s.phase += dt * 4;
      }
    }

    function render(ctx) {
      ctx.save();
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = cfg.twinkle ? 0.55 + Math.sin(s.phase) * 0.35 : 0.85;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(s.x | 0, s.y | 0, s.size, s.size);
      }
      ctx.restore();
    }

    return { update, render, stars };
  }

  window.Stars = { createField };
})();
