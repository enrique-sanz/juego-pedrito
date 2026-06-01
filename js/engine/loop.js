// Bucle principal con timestep fijo a 60 fps. Despacha a la escena activa.
(function () {
  'use strict';

  const STEP = 1000 / 60;
  const MAX_DT = 250; // si pasa más, descartamos para evitar espirales.

  const scenes = Object.create(null);
  let currentKey = null;
  let current = null;

  let canvas, ctx;
  let lastTime = 0;
  let accumulator = 0;

  function register(key, scene) {
    scenes[key] = scene;
  }

  function setScene(key) {
    if (current && typeof current.exit === 'function') current.exit();
    current = scenes[key];
    currentKey = key;
    window.GameState.state.sceneKey = key;
    if (current && typeof current.enter === 'function') {
      current.enter({ canvas, ctx });
    }
  }

  function start(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    let dt = now - lastTime;
    lastTime = now;
    if (dt > MAX_DT) dt = MAX_DT;
    accumulator += dt;

    while (accumulator >= STEP) {
      if (current && typeof current.update === 'function') {
        current.update(STEP / 1000);
      }
      window.Input.endFrame();
      accumulator -= STEP;
    }

    if (current && typeof current.render === 'function') {
      current.render(ctx);
    }

    requestAnimationFrame(frame);
  }

  window.Loop = { register, setScene, start, get currentKey() { return currentKey; } };
})();
