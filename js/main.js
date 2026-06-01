// Bootstrap: vincula el canvas, inicializa motor + debug y muestra una mini
// pantalla de inicio (título + "toca para empezar"). El audio web no puede
// sonar sin un gesto del usuario (política de autoplay / iOS), así que ese
// primer toque desbloquea el sonido y arranca el crawl con música desde el
// primer fotograma.
(function () {
  'use strict';

  function boot() {
    const canvas = document.getElementById('game');
    const overlay = document.getElementById('start-overlay');

    window.Input.bind(canvas, canvas.width, canvas.height);
    window.Faces.init();
    window.Vehicles.init();
    window.Debug.init(canvas);
    window.Loop.start(canvas);

    window.Audio8.init();
    // Se renderiza el crawl detrás del overlay (mudo); al tocar se reinicia
    // con la música ya desbloqueada.
    window.GameState.reset();
    window.Loop.setScene('INTRO_CRAWL');

    let started = false;
    const startGame = () => {
      if (started) return;
      started = true;
      overlay.classList.add('hidden');
      window.Audio8.unlock();
      window.GameState.reset();
      window.Loop.setScene('INTRO_CRAWL'); // reinicio limpio con música
    };

    overlay.addEventListener('click', startGame);
    overlay.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (started) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
        e.preventDefault();
        startGame();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
