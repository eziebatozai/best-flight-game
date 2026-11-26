import * as THREE from '../vendor/three.min.js';
import { createWorld } from './world.js';
import { createPlane } from './plane.js';
import { createFlightModel } from './flight.js';
import { createMissionManager } from './missions.js';
import { createCameraController } from './camera.js';
import { createHud } from './hud.js';
import { createInputController } from './input.js';
import { createAudioEngine } from './audio.js';

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.15, 16000);

const world = createWorld(scene);
const plane = createPlane();
scene.add(plane.root);
plane.attachParticlesToScene(scene);

const flight = createFlightModel(world);
const missionMgr = createMissionManager(scene);
const camCtrl = createCameraController(camera);
const audio = createAudioEngine();

let selectedMissionIdx = 0;
let gameState = 'title'; // 'title' | 'flying' | 'landed' | 'crashed'
let lastMissionInfo = null;
let shotMode = null;

function selectMission(idx) {
  selectedMissionIdx = ((idx % missionMgr.missions.length) + missionMgr.missions.length) % missionMgr.missions.length;
  const mission = missionMgr.loadMission(selectedMissionIdx);
  flight.resetOnRunway(mission.startStrip, mission.startFuel, mission.windSpeedKt, mission.windDirDeg);
  hud.renderMissionCards(missionMgr.missions, selectedMissionIdx);
  camCtrl.snap();
}

function launchMission() {
  audio.ensureStarted();
  const mission = missionMgr.loadMission(selectedMissionIdx);
  flight.resetOnRunway(mission.startStrip, mission.startFuel, mission.windSpeedKt, mission.windDirDeg);
  flight.state.throttle = 0.78;
  gameState = 'flying';
  hud.showTitle(false);
  hud.hideResult();
  hud.pushAlert(`CLEARED FOR TAKEOFF — ${mission.name.toUpperCase()}`, 'info', 2.8);
  camCtrl.snap();
}

function returnToMenu() {
  gameState = 'title';
  hud.hideResult();
  hud.showTitle(true);
  selectMission(selectedMissionIdx);
}

function nextMission() {
  selectedMissionIdx = (selectedMissionIdx + 1) % missionMgr.missions.length;
  launchMission();
}

const hud = createHud({
  onSelectMission: (idx) => selectMission(idx),
  onLaunch: () => launchMission(),
  onRetry: () => launchMission(),
  onNextMission: () => nextMission(),
  onMenu: () => returnToMenu(),
});

const input = createInputController(canvas, {
  onToggleCamera: () => {
    const next = camCtrl.toggleMode();
    hud.pushAlert(next === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', 'info', 1.4);
  },
  onCycleFlaps: () => {
    flight.state.flaps = (flight.state.flaps + 1) % 3;
    audio.playFlaps();
    const deg = flight.state.flaps === 0 ? 0 : flight.state.flaps === 1 ? 15 : 30;
    hud.pushAlert(`FLAPS ${deg}°`, 'info', 1.3);
  },
  onToggleMute: () => {
    const muted = audio.toggleMute();
    hud.pushAlert(muted ? 'AUDIO MUTED' : 'AUDIO ON', 'info', 1.3);
  },
  onConfirm: () => {
    if (gameState === 'title') launchMission();
    else if (gameState === 'landed') nextMission();
    else if (gameState === 'crashed') launchMission();
  },
  onRestart: () => launchMission(),
  onMenu: () => returnToMenu(),
  onQuickMission: (idx) => {
    if (gameState === 'title') selectMission(idx);
  },
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/**
 * Deterministic preview states for ?shot=start|flight|cockpit|landing screenshots.
 */
function applyShotMode(shot) {
  shotMode = shot;
  if (shot === 'start') {
    selectMission(0);
    gameState = 'title';
    camCtrl.setMode('chase');
    hud.showTitle(true);
    hud.hideResult();
    flight.state.throttle = 0.35;
    flight.state.rpm = 0.42;
    return;
  }

  if (shot === 'flight') {
    missionMgr.loadMission(0);
    missionMgr.setProgressForShot(3, 46);
    gameState = 'flying';
    camCtrl.setMode('chase');
    hud.showTitle(false);
    hud.hideResult();
    // Chase view flying gracefully toward glowing Ring 4 over turquoise islands with Gunung Api in background
    flight.setPose({
      x: -482,
      y: 94,
      z: 126,
      headingDeg: 40,
      pitchDeg: -3,
      rollDeg: -10,
      speedKt: 84,
      throttle: 0.74,
      flaps: 0,
      fuel: 81,
      damage: 0,
      onGround: false,
    });
    return;
  }

  if (shot === 'cockpit') {
    missionMgr.loadMission(0);
    missionMgr.setProgressForShot(5, 71);
    gameState = 'flying';
    camCtrl.setMode('cockpit');
    hud.showTitle(false);
    hud.hideResult();
    // Seated cockpit view on final approach to Pulau Hijau runway with lit gauges & approach ring ahead
    flight.setPose({
      x: -342,
      y: 50,
      z: -38,
      headingDeg: 40,
      pitchDeg: -5,
      rollDeg: 1.5,
      speedKt: 58,
      throttle: 0.36,
      flaps: 2,
      fuel: 72,
      damage: 0,
      onGround: false,
    });
    return;
  }

  if (shot === 'landing') {
    missionMgr.loadMission(0);
    missionMgr.setProgressForShot(6, 88);
    gameState = 'landed';
    camCtrl.setMode('chase');
    hud.showTitle(false);
    // Merpati D-7 parked victoriously on Pulau Hijau destination runway after a butter landing
    flight.setPose({
      x: -115,
      y: 19.32,
      z: -310,
      headingDeg: 40,
      pitchDeg: 0,
      rollDeg: 0,
      speedKt: 0,
      throttle: 0.14,
      flaps: 2,
      fuel: 68,
      damage: 0,
      onGround: true,
      onRunway: 'hijau',
    });
    flight.state.landingRecord = {
      touchedDown: true,
      touchdownVsi: 1.1,
      touchdownRollDeg: 2.1,
      bounceCount: 0,
      grade: 'BUTTER',
    };
    plane.spawnSmoke(new THREE.Vector3(-148, 18.6, -270), 6, false);
    const score = missionMgr.calculateScore(flight.state);
    hud.showLandingResult(score);
  }
}

// Initialize game or deterministic shot pose
const params = new URLSearchParams(window.location.search);
const requestedShot = params.get('shot');
if (requestedShot && ['start', 'flight', 'cockpit', 'landing'].includes(requestedShot)) {
  applyShotMode(requestedShot);
} else {
  selectMission(0);
  hud.showTitle(true);
}

// Handle physics & mission events
function processEvents(missionInfo) {
  if (missionInfo.event && missionInfo.event.type === 'ring_hit') {
    audio.playRingChime(missionInfo.event.bullseye);
    if (missionInfo.event.allRingsDone) {
      hud.pushAlert(`ALL RINGS CLEARED! LAND AT ${missionInfo.destName.toUpperCase()}`, 'gold', 3.4);
    } else if (missionInfo.event.bullseye) {
      hud.pushAlert(`BULLSEYE RING ${missionInfo.event.ringsHit}/${missionInfo.event.totalRings} (+325)`, 'gold', 1.8);
    } else {
      hud.pushAlert(`RING ${missionInfo.event.ringsHit}/${missionInfo.event.totalRings} (+250)`, 'info', 1.6);
    }
  }

  for (const ev of flight.state.events) {
    if (ev.type === 'touchdown') {
      audio.playTouchdown();
      plane.spawnSmoke(ev.pos, 6, false);
      hud.pushAlert(
        `${ev.grade} TOUCHDOWN (${ev.sinkMps.toFixed(1)} m/s) — HOLD SPACE TO BRAKE`,
        ev.grade === 'BUTTER' || ev.grade === 'SMOOTH' ? 'gold' : 'info',
        3.0
      );
    } else if (ev.type === 'bounce') {
      audio.playBounce();
      plane.spawnSmoke(ev.pos, 5, false);
      hud.pushAlert(`HARD BOUNCE! -${ev.dmg}% HULL — FLARE GENTLY`, 'warn', 2.4);
    } else if (ev.type === 'crash') {
      audio.playCrash();
      plane.spawnSmoke(flight.state.position, 10, true);
      gameState = 'crashed';
      hud.showCrashResult(ev.reason, missionInfo, flight.state);
    } else if (ev.type === 'mission_landed') {
      audio.playMissionComplete();
      gameState = 'landed';
      const score = missionMgr.calculateScore(flight.state);
      hud.showLandingResult(score);
    }
  }
}

let lastNow = performance.now();
let elapsed = shotMode ? 6.4 : 0;

function tick(now) {
  requestAnimationFrame(tick);
  const rawDt = (now - lastNow) / 1000;
  lastNow = now;
  const dt = Math.min(0.05, Math.max(0.001, rawDt));

  if (!shotMode) {
    elapsed += dt;
    const ctrl = input.sample(dt);
    if (gameState === 'flying') {
      const destId = missionMgr.missions[selectedMissionIdx].destStrip;
      flight.step(dt, ctrl, destId);
    }
  }

  const missionInfo = missionMgr.update(shotMode ? 0 : dt, elapsed, flight.state.position, gameState === 'flying' && !shotMode);
  lastMissionInfo = missionInfo;

  if (!shotMode && gameState === 'flying') {
    processEvents(missionInfo);
  }

  const telemetry = flight.getTelemetry(missionInfo);
  world.update(elapsed, shotMode ? 0 : dt, flight.state.position, flight.state.windDirRad);
  plane.updateVisuals(shotMode ? 0.016 : dt, elapsed, flight.state, telemetry, camCtrl.getMode() === 'cockpit');
  camCtrl.update(shotMode ? 0.016 : dt, elapsed, gameState, flight.state, input.mouseLook, Boolean(shotMode));
  hud.update(shotMode ? 0 : dt, telemetry, missionInfo, camCtrl.getMode(), gameState);
  audio.update(telemetry, gameState, elapsed);

  renderer.render(scene, camera);
}

// Render initial frame immediately and start animation loop
(function renderInitialFrame() {
  const missionInfo = missionMgr.update(0, elapsed, flight.state.position, false);
  lastMissionInfo = missionInfo;
  const telemetry = flight.getTelemetry(missionInfo);
  world.update(elapsed, 0, flight.state.position, flight.state.windDirRad);
  plane.updateVisuals(0.016, elapsed, flight.state, telemetry, camCtrl.getMode() === 'cockpit');
  camCtrl.update(0.016, elapsed, gameState, flight.state, input.mouseLook, true);
  hud.update(0, telemetry, missionInfo, camCtrl.getMode(), gameState);
  renderer.render(scene, camera);
})();

// Read-only inspection & testing handle for automated verification
window.__MERPATI__ = {
  getState: () => ({
    gameState,
    cameraMode: camCtrl.getMode(),
    mission: lastMissionInfo ? lastMissionInfo.mission.id : null,
    ringsHit: lastMissionInfo ? lastMissionInfo.ringsHit : 0,
    totalRings: lastMissionInfo ? lastMissionInfo.totalRings : 0,
    position: flight.state.position.toArray(),
    airspeedKt: Math.round(flight.state.airspeed * 1.94384),
    altitudeFt: Math.round(flight.state.position.y * 3.28084),
    headingDeg: Math.round(flight.state.headingDeg),
    throttle: Number(flight.state.throttle.toFixed(2)),
    fuel: Math.round(flight.state.fuel),
    damage: Math.round(flight.state.damage),
    onGround: flight.state.onGround,
    onRunway: flight.state.onRunway,
    crashed: flight.state.crashed,
  }),
  launch: () => launchMission(),
  stepSimulation: (seconds, ctrlOverride) => {
    const destId = missionMgr.missions[selectedMissionIdx].destStrip;
    const steps = Math.max(1, Math.round(seconds / 0.02));
    for (let i = 0; i < steps; i++) {
      elapsed += 0.02;
      flight.step(0.02, ctrlOverride || { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brake: false }, destId);
      const mi = missionMgr.update(0.02, elapsed, flight.state.position, gameState === 'flying');
      lastMissionInfo = mi;
      processEvents(mi);
      if (gameState !== 'flying') break;
    }
    return window.__MERPATI__.getState();
  },
  setPose: (pose) => {
    flight.setPose(pose);
    const mi = missionMgr.update(0.016, elapsed, flight.state.position, gameState === 'flying');
    lastMissionInfo = mi;
    processEvents(mi);
    return window.__MERPATI__.getState();
  },
};

requestAnimationFrame(tick);
