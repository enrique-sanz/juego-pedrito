// Estado global del juego: vidas, escena, flags. Expuesto en window.GameState.
(function () {
  'use strict';

  const MAX_LIVES = 3;

  const SCENES = [
    'INTRO_CRAWL',
    'NARRATIVE_1',
    'INVADERS',
    'NARRATIVE_2',
    'RACING',
    'NARRATIVE_3',
    'COMPACTOR',
    'NARRATIVE_4',
    'LIGHTSABER',
    'VICTORY',
    'DEFEAT',
  ];

  const state = {
    sceneOrder: SCENES,
    sceneKey: 'INTRO_CRAWL',
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    infiniteLives: false,
    muted: false,
    audioReady: false,
  };

  function reset() {
    state.lives = state.maxLives;
    state.sceneKey = 'INTRO_CRAWL';
  }

  function loseLife() {
    if (state.infiniteLives) return state.lives;
    state.lives = Math.max(0, state.lives - 1);
    return state.lives;
  }

  function nextSceneKey() {
    const i = SCENES.indexOf(state.sceneKey);
    if (i < 0 || i >= SCENES.length - 1) return state.sceneKey;
    return SCENES[i + 1];
  }

  window.GameState = {
    SCENES,
    state,
    reset,
    loseLife,
    nextSceneKey,
  };
})();
