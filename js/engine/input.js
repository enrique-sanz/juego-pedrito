// Abstracción de input: touch + ratón + teclado. Expone Input.pointer y helpers.
(function () {
  'use strict';

  const pointer = {
    x: 0,
    y: 0,
    isDown: false,
    justPressed: false,
    justReleased: false,
    tapStartTime: 0,
  };

  const keys = Object.create(null);
  const keysJustPressed = Object.create(null);

  let canvas = null;
  let internalWidth = 360;
  let internalHeight = 640;

  function bind(canvasEl, w, h) {
    canvas = canvasEl;
    internalWidth = w;
    internalHeight = h;

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function localFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = internalWidth / rect.width;
    const sy = internalHeight / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  function press(x, y) {
    pointer.x = x;
    pointer.y = y;
    if (!pointer.isDown) {
      pointer.justPressed = true;
      pointer.tapStartTime = performance.now();
    }
    pointer.isDown = true;
  }

  function move(x, y) {
    pointer.x = x;
    pointer.y = y;
  }

  function release() {
    if (pointer.isDown) pointer.justReleased = true;
    pointer.isDown = false;
  }

  function onTouchStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = localFromClient(t.clientX, t.clientY);
    press(p.x, p.y);
  }
  function onTouchMove(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = localFromClient(t.clientX, t.clientY);
    move(p.x, p.y);
  }
  function onTouchEnd(e) {
    e.preventDefault();
    release();
  }

  function onMouseDown(e) {
    const p = localFromClient(e.clientX, e.clientY);
    press(p.x, p.y);
  }
  function onMouseMove(e) {
    const p = localFromClient(e.clientX, e.clientY);
    move(p.x, p.y);
  }
  function onMouseUp() { release(); }

  function onKeyDown(e) {
    if (!keys[e.code]) keysJustPressed[e.code] = true;
    keys[e.code] = true;
  }
  function onKeyUp(e) { keys[e.code] = false; }

  // Llamar al final de cada frame para resetear los "just" flags.
  function endFrame() {
    pointer.justPressed = false;
    pointer.justReleased = false;
    for (const k in keysJustPressed) keysJustPressed[k] = false;
  }

  function isKey(code) { return !!keys[code]; }
  function isKeyJustPressed(code) { return !!keysJustPressed[code]; }

  window.Input = {
    bind,
    pointer,
    endFrame,
    isKey,
    isKeyJustPressed,
  };
})();
