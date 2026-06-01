// Huevo de pascua: 3 taps en la esquina superior derecha (~10% × 10%) abren
// un panel autoescondible para saltar de escena y activar vidas infinitas/mute.
(function () {
  'use strict';

  const HIDE_AFTER_MS = 6000;
  const TRIPLE_WINDOW_MS = 1200;
  const CORNER_RATIO = 0.10;

  let panel, sceneSelect, goBtn, infBox, muteBox;
  let tapTimes = [];
  let hideTimer = 0;
  let canvas;

  function init(canvasEl) {
    canvas = canvasEl;
    panel = document.getElementById('debug-panel');
    sceneSelect = document.getElementById('debug-scene');
    goBtn = document.getElementById('debug-go');
    infBox = document.getElementById('debug-infinite');
    muteBox = document.getElementById('debug-mute');

    // Rellenar opciones con todas las escenas
    window.GameState.SCENES.forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key.replace(/_/g, ' ');
      sceneSelect.appendChild(opt);
    });

    canvas.addEventListener('pointerdown', onCornerTap);

    goBtn.addEventListener('click', () => {
      const key = sceneSelect.value;
      if (key) {
        window.GameState.reset();
        window.Loop.setScene(key);
        scheduleHide();
      }
    });

    infBox.addEventListener('change', () => {
      window.GameState.state.infiniteLives = infBox.checked;
      scheduleHide();
    });

    muteBox.addEventListener('change', () => {
      window.Audio8.setMuted(muteBox.checked);
      scheduleHide();
    });

    // Cualquier interacción dentro del panel reinicia el temporizador
    panel.addEventListener('pointerdown', scheduleHide);
  }

  function onCornerTap(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inCorner = (x > rect.width * (1 - CORNER_RATIO)) && (y < rect.height * CORNER_RATIO);
    if (!inCorner) return;

    const now = performance.now();
    tapTimes = tapTimes.filter(t => now - t < TRIPLE_WINDOW_MS);
    tapTimes.push(now);

    if (tapTimes.length >= 3) {
      tapTimes = [];
      togglePanel();
    }
  }

  function togglePanel() {
    if (panel.hidden) showPanel();
    else hidePanel();
  }

  function showPanel() {
    panel.hidden = false;
    sceneSelect.value = window.GameState.state.sceneKey;
    infBox.checked = window.GameState.state.infiniteLives;
    muteBox.checked = window.GameState.state.muted;
    scheduleHide();
  }

  function hidePanel() {
    panel.hidden = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
  }

  function scheduleHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePanel, HIDE_AFTER_MS);
  }

  window.Debug = { init, showPanel, hidePanel };
})();
