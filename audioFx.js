// Audio module: short synthesized sound effects via the Web Audio API — no
// external audio files needed. Browsers block audio until a user gesture
// on the page, so call unlock() from a click/keydown handler.
function createAudioFx() {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContextClass();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playWhoosh() {
    const ac = ensureCtx();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  function playPop(pitch = 1) {
    const ac = ensureCtx();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(700 * pitch, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  function playExplosion() {
    const ac = ensureCtx();
    const now = ac.currentTime;
    const duration = 0.4;
    const bufferSize = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ac.createBufferSource();
    noise.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + duration);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter).connect(gain).connect(ac.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  return { playWhoosh, playPop, playExplosion, unlock: ensureCtx };
}
