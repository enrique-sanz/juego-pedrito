// Bootstrap: vincula el canvas, inicializa motor + debug, y arranca el juego
// tras la primera interacción del usuario (necesario para WebAudio en iOS).
(function () {
  'use strict';

  function boot() {
    const canvas = document.getElementById('game');
    const overlay = document.getElementById('start-overlay');

    window.Input.bind(canvas, canvas.width, canvas.height);
    window.Debug.init(canvas);
    window.Loop.start(canvas);

    // Por defecto arrancamos en una "pantalla de espera" mostrando estrellas.
    // Hasta que el usuario toque el overlay, no se desbloquea el audio ni se
    // entra en la intro (Safari/iOS lo exige).
    window.Loop.setScene('INTRO_CRAWL'); // se renderiza detrás del overlay

    const startGame = () => {
      window.Audio8.init();
      overlay.classList.add('hidden');
      overlay.style.display = 'none';
      // Forzar reentrada para que la melodía arranque limpia
      window.GameState.reset();
      window.Loop.setScene('INTRO_CRAWL');
    };

    overlay.addEventListener('click', startGame, { once: true });
    overlay.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); }, { once: true, passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
