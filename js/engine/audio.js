// Audio basado en WebAudio. Sintetiza la cabecera de Star Wars en 8-bit
// (osciladores cuadrados con envolvente ADSR rápida) y produce SFX puntuales.
//
// Se inicializa tras la primera interacción del usuario (requisito de iOS).
(function () {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let themeTimer = 0;
  let themePlaying = false;

  // Frecuencias en Hz, melodía simplificada de la cabecera de Star Wars
  // (Main Title), transportada para sonar correcta como chiptune.
  // Cada entrada: [freqHz o 0 para silencio, duración en segundos].
  const THEME = [
    // Triplete inicial
    [392.00, 0.18],  // G4
    [392.00, 0.18],  // G4
    [392.00, 0.18],  // G4
    // Largo + descenso
    [523.25, 0.62],  // C5  ▶ "DAAAA"
    [392.00, 0.62],  // G5 -> usamos G4 para mantener rango chip
    [349.23, 0.18],  // F4
    [329.63, 0.18],  // E4
    [293.66, 0.18],  // D4
    [523.25, 0.62],  // C5  ▶
    [392.00, 0.45],  // G4
    [349.23, 0.18],  // F4
    [329.63, 0.18],  // E4
    [293.66, 0.18],  // D4
    [523.25, 0.62],  // C5  ▶
    [392.00, 0.45],  // G4
    [349.23, 0.18],  // F4
    [329.63, 0.18],  // E4
    [349.23, 0.18],  // F4
    [293.66, 0.62],  // D4  ▶
    [0,      0.50],  // silencio
  ];

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
    window.GameState.state.audioReady = true;
  }

  // Desbloqueo de audio: crea el contexto, lo reanuda si el navegador lo dejó
  // suspendido (política de autoplay / iOS) y arranca la melodía. Idempotente.
  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(startTheme).catch(() => {});
    } else {
      startTheme();
    }
  }

  function isMuted() { return window.GameState.state.muted; }

  // Toca una sola nota con timbre 8-bit (square + leve sub-osc).
  function playNote(freq, duration, startTime, type = 'square', vol = 1) {
    if (!ctx || !freq) return;
    const t0 = startTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    // Envolvente ADSR cortita
    const peak = 0.5 * vol;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.setValueAtTime(peak, t0 + Math.max(0.02, duration - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function startTheme() {
    if (!ctx || themePlaying || isMuted()) return;
    themePlaying = true;
    scheduleTheme();
  }

  function scheduleTheme() {
    if (!themePlaying) return;
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < THEME.length; i++) {
      const [f, d] = THEME[i];
      if (f) {
        playNote(f, d * 0.95, t, 'square', 1);
        // armonía suave una octava abajo en notas largas
        if (d >= 0.4) playNote(f / 2, d * 0.95, t, 'triangle', 0.5);
      }
      t += d;
    }
    const total = (t - ctx.currentTime) * 1000;
    themeTimer = setTimeout(scheduleTheme, total - 100);
  }

  function stopTheme() {
    themePlaying = false;
    if (themeTimer) { clearTimeout(themeTimer); themeTimer = 0; }
  }

  // SFX cortos
  function sfx(name) {
    if (!ctx || isMuted()) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'laser': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(1200, t);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g).connect(masterGain);
        o.start(t); o.stop(t + 0.15);
        break;
      }
      case 'explosion': {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = 0.35;
        src.buffer = buffer;
        src.connect(g).connect(masterGain);
        src.start(t);
        break;
      }
      case 'saber': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, t);
        o.frequency.linearRampToValueAtTime(80, t + 0.18);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g).connect(masterGain);
        o.start(t); o.stop(t + 0.22);
        break;
      }
      case 'hit': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(80, t);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g).connect(masterGain);
        o.start(t); o.stop(t + 0.12);
        break;
      }
      case 'win': {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => playNote(f, 0.18, t + i * 0.12, 'square', 1));
        break;
      }
      case 'lose': {
        const notes = [392, 349.23, 293.66, 220];
        notes.forEach((f, i) => playNote(f, 0.25, t + i * 0.18, 'square', 1));
        break;
      }
    }
  }

  function setMuted(m) {
    window.GameState.state.muted = !!m;
    if (masterGain) masterGain.gain.value = m ? 0 : 0.18;
  }

  window.Audio8 = {
    init,
    unlock,
    startTheme,
    stopTheme,
    sfx,
    setMuted,
    get ready() { return !!ctx; },
    get running() { return !!ctx && ctx.state === 'running'; },
  };
})();
