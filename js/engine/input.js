// Abstracción de input: touch (multi) + ratón + teclado.
// - Input.pointer       : puntero primario (la última posición conocida).
// - Input.touches (Map) : todos los puntos activos {x, y} indexados por id
//                         (los touches usan su identifier nativo; el ratón usa -1).
//                         Útil para escenas que necesitan pulsar dos botones
//                         a la vez (p.ej. el duelo final).
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

  const touches = new Map();

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

  function setTouch(id, x, y) {
    let t = touches.get(id);
    if (!t) {
      t = { x, y };
      touches.set(id, t);
    } else {
      t.x = x; t.y = y;
    }
  }

  function clearTouch(id) {
    touches.delete(id);
  }

  function refreshPointerFromTouches() {
    if (touches.size === 0) {
      if (pointer.isDown) pointer.justReleased = true;
      pointer.isDown = false;
    }
  }

  function onTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const p = localFromClient(t.clientX, t.clientY);
      setTouch(t.identifier, p.x, p.y);
    }
    const t = e.changedTouches[0];
    const p = localFromClient(t.clientX, t.clientY);
    if (!pointer.isDown) {
      pointer.justPressed = true;
      pointer.tapStartTime = performance.now();
    }
    pointer.isDown = true;
    pointer.x = p.x; pointer.y = p.y;
  }

  function onTouchMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const p = localFromClient(t.clientX, t.clientY);
      if (touches.has(t.identifier)) setTouch(t.identifier, p.x, p.y);
      pointer.x = p.x; pointer.y = p.y;
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      clearTouch(e.changedTouches[i].identifier);
    }
    refreshPointerFromTouches();
  }

  function onMouseDown(e) {
    const p = localFromClient(e.clientX, e.clientY);
    setTouch(-1, p.x, p.y);
    if (!pointer.isDown) {
      pointer.justPressed = true;
      pointer.tapStartTime = performance.now();
    }
    pointer.isDown = true;
    pointer.x = p.x; pointer.y = p.y;
  }
  function onMouseMove(e) {
    const p = localFromClient(e.clientX, e.clientY);
    if (touches.has(-1)) setTouch(-1, p.x, p.y);
    pointer.x = p.x; pointer.y = p.y;
  }
  function onMouseUp() {
    clearTouch(-1);
    refreshPointerFromTouches();
  }

  function onKeyDown(e) {
    if (!keys[e.code]) keysJustPressed[e.code] = true;
    keys[e.code] = true;
  }
  function onKeyUp(e) { keys[e.code] = false; }

  function endFrame() {
    pointer.justPressed = false;
    pointer.justReleased = false;
    for (const k in keysJustPressed) keysJustPressed[k] = false;
  }

  function isKey(code) { return !!keys[code]; }
  function isKeyJustPressed(code) { return !!keysJustPressed[code]; }

  // Util: ¿hay algún touch (o ratón) dentro de un rect {x,y,w,h}?
  function anyPointerInside(rect) {
    for (const t of touches.values()) {
      if (t.x >= rect.x && t.x <= rect.x + rect.w &&
          t.y >= rect.y && t.y <= rect.y + rect.h) {
        return true;
      }
    }
    return false;
  }

  // Acción "continuar / saltar": tap o tecla Espacio/Enter.
  function actionJustPressed() {
    return pointer.justPressed
      || !!keysJustPressed['Space']
      || !!keysJustPressed['Enter']
      || !!keysJustPressed['NumpadEnter'];
  }

  window.Input = {
    bind,
    pointer,
    touches,
    endFrame,
    isKey,
    isKeyJustPressed,
    anyPointerInside,
    actionJustPressed,
  };
})();
