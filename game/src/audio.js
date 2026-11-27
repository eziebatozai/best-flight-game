/**
 * Expanded procedural WebAudio flight + aerial combat soundscape.
 * Synthesizes radial prop hum, airflow wind rush, stall warning, flaps, chimes,
 * touchdowns, crashes, 20mm autocannon bursts, Surya-2 missile launches,
 * infrared lock-on seeker tones, hit confirmations, explosions, hull impacts,
 * decoy flare pops, and boss klaxon alerts with zero external audio assets.
 */
export function createAudioEngine() {
  let ctx = null;
  let muted = false;
  let started = false;
  let noiseBuf = null;

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

      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 245;

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

      // Shared white-noise buffer for wind, gunfire transients, missiles & explosions
      const bufferSize = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
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

  function playNoiseBurst(duration, filterType, freq, vol = 0.14, endFreq = null) {
    if (!started || muted || !ctx || !noiseBuf) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  // ===== FLIGHT SFX =====
  function playRingChime(bullseye = false) {
    ensureStarted();
    playTone(587.33, 0.18, 'triangle', 0.14);
    setTimeout(() => playTone(880, 0.24, 'triangle', 0.14), 70);
    if (bullseye) setTimeout(() => playTone(1174.66, 0.3, 'sine', 0.14), 140);
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
    playExplosion(true);
    playTone(105, 0.6, 'sawtooth', 0.2, 24);
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

  // ===== COMBAT SFX =====
  function playCannonShot() {
    ensureStarted();
    playTone(165, 0.075, 'sawtooth', 0.12, 58);
    playNoiseBurst(0.055, 'bandpass', 1450, 0.1, 480);
  }

  function playMissileLaunch() {
    ensureStarted();
    playNoiseBurst(0.55, 'bandpass', 520, 0.18, 2200);
    playTone(220, 0.38, 'sawtooth', 0.11, 780);
  }

  function playLockTone(locked) {
    ensureStarted();
    if (locked) {
      playTone(1380, 0.14, 'square', 0.075);
    } else {
      playTone(860, 0.08, 'triangle', 0.06, 980);
    }
  }

  function playHitConfirm() {
    ensureStarted();
    playTone(1640, 0.055, 'triangle', 0.1, 1180);
  }

  function playExplosion(isBoss = false) {
    ensureStarted();
    const dur = isBoss ? 1.35 : 0.72;
    playNoiseBurst(dur, 'lowpass', isBoss ? 440 : 620, isBoss ? 0.26 : 0.18, 65);
    playTone(isBoss ? 86 : 112, dur * 0.85, 'sawtooth', isBoss ? 0.22 : 0.16, 22);
  }

  function playHullImpact() {
    ensureStarted();
    playNoiseBurst(0.14, 'bandpass', 920, 0.18, 220);
    playTone(148, 0.16, 'square', 0.16, 52);
  }

  function playFlarePop() {
    ensureStarted();
    playNoiseBurst(0.16, 'highpass', 1800, 0.14, 900);
    playTone(640, 0.11, 'sine', 0.09, 280);
  }

  function playBossKlaxon() {
    ensureStarted();
    playTone(440, 0.24, 'sawtooth', 0.13, 380);
    setTimeout(() => playTone(360, 0.28, 'sawtooth', 0.13, 290), 260);
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
    const baseFreq = 44 + rpm * 88;
    engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
    engineOsc2.frequency.setTargetAtTime(baseFreq * 2.02, now, 0.06);
    const engVol = gameState === 'title' ? 0.08 : 0.16 + rpm * 0.25;
    engineGain.gain.setTargetAtTime(engVol, now, 0.08);

    const windVol = Math.min(0.28, (telemetry.airspeedKt / 140) * 0.25);
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
    playCannonShot,
    playMissileLaunch,
    playLockTone,
    playHitConfirm,
    playExplosion,
    playHullImpact,
    playFlarePop,
    playBossKlaxon,
  };
}
