/**
 * Procedural WebAudio flight soundscape for Merpati Run:
 * propeller hum, wind rush, ring chime, stall warning, flaps servo, tire touchdown, bounce & crash.
 */
export function createAudioEngine() {
  let ctx = null;
  let muted = false;
  let started = false;

  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let stallOsc = null;
  let stallGain = null;

  function ensureStarted() {
    if (started || muted) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.24;
      master.connect(ctx.destination);

      // Single-prop radial engine hum (dual detuned sawtooth/triangle through warm low-pass filter)
      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 240;

      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;

      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 58;

      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'triangle';
      engineOsc2.frequency.value = 116;

      engineOsc1.connect(engFilter);
      engineOsc2.connect(engFilter);
      engFilter.connect(engineGain);
      engineGain.connect(master);

      engineOsc1.start();
      engineOsc2.start();

      // Filtered white-noise airflow wind rush
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 620;
      windFilter.Q.value = 0.9;

      windGain = ctx.createGain();
      windGain.gain.value = 0.0;

      noiseSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noiseSrc.start();

      // Stall horn oscillator
      stallOsc = ctx.createOscillator();
      stallOsc.type = 'square';
      stallOsc.frequency.value = 780;
      stallGain = ctx.createGain();
      stallGain.gain.value = 0.0;
      stallOsc.connect(stallGain);
      stallGain.connect(master);
      stallOsc.start();

      started = true;
    } catch {
      // Ignore if headless browser blocks WebAudio
    }
  }

  function playTone(freq, duration, type = 'sine', vol = 0.14, endFreq = null) {
    if (!started || muted || !ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playRingChime(bullseye = false) {
    ensureStarted();
    playTone(587.33, 0.18, 'triangle', 0.14);
    setTimeout(() => playTone(880, 0.24, 'triangle', 0.14), 70);
    if (bullseye) {
      setTimeout(() => playTone(1174.66, 0.3, 'sine', 0.14), 140);
    }
  }

  function playTouchdown() {
    ensureStarted();
    playTone(190, 0.14, 'sawtooth', 0.12, 85);
    playTone(960, 0.09, 'triangle', 0.07, 420);
  }

  function playBounce() {
    ensureStarted();
    playTone(125, 0.22, 'sawtooth', 0.18, 48);
  }

  function playCrash() {
    ensureStarted();
    playTone(110, 0.55, 'sawtooth', 0.22, 26);
    playTone(68, 0.65, 'square', 0.16, 22);
  }

  function playFlaps() {
    ensureStarted();
    playTone(320, 0.12, 'sine', 0.06, 440);
  }

  function playMissionComplete() {
    ensureStarted();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.32, 'triangle', 0.13), i * 110);
    });
  }

  function update(telemetry, gameState, elapsed) {
    if (!started || !ctx) return;
    const active = !muted && (gameState === 'flying' || gameState === 'title');
    const now = ctx.currentTime;

    if (!active) {
      engineGain.gain.setTargetAtTime(0, now, 0.08);
      windGain.gain.setTargetAtTime(0, now, 0.08);
      stallGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const rpm = telemetry.rpm;
    const baseFreq = 44 + rpm * 82;
    engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
    engineOsc2.frequency.setTargetAtTime(baseFreq * 2.02, now, 0.06);
    const engVol = gameState === 'title' ? 0.08 : 0.16 + rpm * 0.24;
    engineGain.gain.setTargetAtTime(engVol, now, 0.08);

    const windVol = Math.min(0.28, (telemetry.airspeedKt / 130) * 0.25);
    windGain.gain.setTargetAtTime(windVol, now, 0.1);

    const beep = telemetry.stalling && gameState === 'flying' && Math.sin(elapsed * 22) > 0;
    stallGain.gain.setTargetAtTime(beep ? 0.12 : 0, now, 0.02);
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return {
    ensureStarted,
    toggleMute,
    update,
    playRingChime,
    playTouchdown,
    playBounce,
    playCrash,
    playFlaps,
    playMissionComplete,
  };
}
