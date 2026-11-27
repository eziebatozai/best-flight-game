import * as THREE from '../vendor/three.min.js';
import { createCombatDirector } from './combat.js';
import { createEnemyManager } from './enemies.js';
import { createWeaponsSystem } from './weapons.js';
import { createEffectsEngine } from './effects.js';
import { createCombatHud } from './combat-hud.js';
import { applyCombatShot } from './shots.js';
import { createFlightModel } from './flight.js';
import { createMissionManager } from './missions.js';
import { createCameraController } from './camera.js';
import { createInputController } from './input.js';
import { createAudioEngine } from './audio.js';
import { createHud } from './hud.js';
import { createPlane } from './plane.js';
import { createWorld } from './world.js';

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.15, 16000);

const world = createWorld(scene);
const plane = createPlane();
scene.add(plane.root);
plane.attachParticlesToScene(scene);

const flight = createFlightModel(world);
const missionMgr = createMissionManager(scene);
const camCtrl = createCameraController(camera);
const audio = createAudioEngine();

const effects = createEffectsEngine(scene);
const enemies = createEnemyManager(scene, world, effects);
const weapons = createWeaponsSystem(scene, world, effects);
const combat = createCombatDirector(enemies, weapons, effects, audio);
const combatHud = createCombatHud();

let selectedMissionIdx = 0;
let gameState = 'title'; // 'title' | 'flying' | 'landed' | 'crashed'
let lastMissionInfo = null;
let shotMode = null;

function setResultBodyClass(open) {
  document.body.classList.toggle('result-open', open);
}

function selectMission(idx) {
  selectedMissionIdx = ((idx % missionMgr.missions.length) + missionMgr.missions.length) % missionMgr.missions.length;
  const mission = missionMgr.loadMission(selectedMissionIdx);
  flight.resetOnRunway(mission.startStrip, mission.startFuel, mission.windSpeedKt, mission.windDirDeg);
  combat.resetForMission(selectedMissionIdx);
  hud.renderMissionCards(missionMgr.missions, selectedMissionIdx);
  camCtrl.snap();
}

function launchMission() {
  audio.ensureStarted();
  const mission = missionMgr.loadMission(selectedMissionIdx);
  flight.resetOnRunway(mission.startStrip, mission.startFuel, mission.windSpeedKt, mission.windDirDeg);
  combat.resetForMission(selectedMissionIdx);
  flight.state.throttle = 0.8;
  gameState = 'flying';
  hud.showTitle(false);
  hud.hideResult();
  setResultBodyClass(false);
  hud.pushAlert(`SCRAMBLE — ${mission.name.toUpperCase()} (${mission.threatSummary.toUpperCase()})`, 'info', 3.0);
  camCtrl.snap();
}

function returnToMenu() {
  gameState = 'title';
  hud.hideResult();
  setResultBodyClass(false);
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
    hud.pushAlert(next === 'cockpit' ? 'COCKPIT VIEW — REFLEX GUNSIGHT ACTIVE' : 'CHASE VIEW', 'info', 1.5);
  },
  onCycleFlaps: () => {
    flight.state.flaps = (flight.state.flaps + 1) % 3;
    audio.playFlaps();
    const deg = flight.state.flaps === 0 ? 0 : flight.state.flaps === 1 ? 15 : 30;
    hud.pushAlert(`FLAPS ${deg}°`, 'info', 1.3);
  },
  onFireMissile: () => {
    if (gameState === 'flying') {
      combat.triggerMissile(plane, flight.state);
    }
  },
  onCycleTarget: () => {
    if (gameState === 'flying') {
      const target = combat.cycleTarget();
      if (target) hud.pushAlert(`TARGET LOCKED: ${target.name.toUpperCase()}`, 'info', 1.4);
    }
  },
  onDeployFlares: () => {
    if (gameState === 'flying') {
      combat.triggerFlares(flight.state);
    }
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
  combatHud.resize();
});

function processEvents(missionInfo) {
  if (missionInfo.event && missionInfo.event.type === 'ring_hit') {
    audio.playRingChime(missionInfo.event.bullseye);
    if (missionInfo.event.allRingsDone) {
      hud.pushAlert(`ALL RINGS CLEARED! CLEAR RAIDERS & LAND AT ${missionInfo.destName.toUpperCase()}`, 'gold', 3.4);
    } else if (missionInfo.event.bullseye) {
      hud.pushAlert(`BULLSEYE RING ${missionInfo.event.ringsHit}/${missionInfo.event.totalRings} (+325)`, 'gold', 1.8);
    } else {
      hud.pushAlert(`RING ${missionInfo.event.ringsHit}/${missionInfo.event.totalRings} (+250)`, 'info', 1.6);
    }
  }

  for (const cev of combat.state.events) {
    if (cev.type === 'alert') {
      hud.pushAlert(cev.text, cev.tone, cev.duration);
    }
  }

  for (const ev of flight.state.events) {
    if (ev.type === 'touchdown') {
      audio.playTouchdown();
      plane.spawnSmoke(ev.pos, 6, false);
      hud.pushAlert(
        `${ev.grade} TOUCHDOWN (${ev.sinkMps.toFixed(1)} m/s) — HOLD B TO BRAKE`,
        ev.grade === 'BUTTER' || ev.grade === 'SMOOTH' ? 'gold' : 'info',
        3.0
      );
    } else if (ev.type === 'resupply') {
      combat.handleTouchAndGoResupply(ev.stripId, ev.stripName, flight);
    } else if (ev.type === 'hostiles_remain') {
      hud.pushAlert(`HOSTILES STILL AIRBORNE (${combat.state.hostilesRemaining}) — TAKE OFF TO ENGAGE!`, 'warn', 3.0);
    } else if (ev.type === 'bounce') {
      audio.playBounce();
      plane.spawnSmoke(ev.pos, 5, false);
      hud.pushAlert(`HARD BOUNCE! -${ev.dmg}% HULL — FLARE GENTLY`, 'warn', 2.4);
    } else if (ev.type === 'crash') {
      audio.playCrash();
      effects.spawnExplosion(flight.state.position, 1.5, false);
      plane.spawnSmoke(flight.state.position, 10, true);
      gameState = 'crashed';
      setResultBodyClass(true);
      hud.showCrashResult(ev.reason, missionInfo, flight.state, combat.state);
    } else if (ev.type === 'mission_landed') {
      audio.playMissionComplete();
      gameState = 'landed';
      setResultBodyClass(true);
      const score = missionMgr.calculateScore(flight.state, combat.getCombatScore(flight.state));
      hud.showLandingResult(score);
    }
  }
}

let lastNow = performance.now();
let elapsed = 0;

// Initialize deterministic screenshot scene or normal Mission Select title screen
const params = new URLSearchParams(window.location.search);
const requestedShot = params.get('shot');
if (requestedShot && ['cover', 'gameplay', 'cockpit', 'debrief'].includes(requestedShot)) {
  shotMode = requestedShot;
  const staged = applyCombatShot(requestedShot, {
    missionMgr,
    flight,
    combat,
    enemies,
    weapons,
    effects,
    camCtrl,
    hud,
    plane,
  });
  if (staged) {
    gameState = staged.gameState;
    elapsed = staged.elapsed;
    setResultBodyClass(gameState === 'landed' || gameState === 'crashed');
  }
} else {
  selectMission(0);
  hud.showTitle(true);
  setResultBodyClass(false);
}

function tick(now) {
  requestAnimationFrame(tick);
  const rawDt = (now - lastNow) / 1000;
  lastNow = now;
  const dt = Math.min(0.05, Math.max(0.001, rawDt));

  let ctrl = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brake: false, fireCannon: false };
  if (!shotMode) {
    elapsed += dt;
    ctrl = input.sample(dt);
    if (gameState === 'flying') {
      const destId = missionMgr.missions[selectedMissionIdx].destStrip;
      flight.step(dt, ctrl, destId, combat.isCombatComplete());
    }
  }

  const missionInfo = missionMgr.update(shotMode ? 0 : dt, elapsed, flight.state.position, gameState === 'flying' && !shotMode);
  lastMissionInfo = missionInfo;

  if (!shotMode && gameState === 'flying') {
    combat.update(dt, elapsed, flight, plane, missionInfo, ctrl);
    effects.update(dt);
    processEvents(missionInfo);
  } else if (!shotMode) {
    effects.update(dt);
  }

  const livingEnemies = enemies.getEnemies();
  const activeBoss = enemies.getActiveBoss();
  const telemetry = flight.getTelemetry(missionInfo);
  const shakeOffset = shotMode ? { x: 0, y: 0, z: 0, roll: 0 } : effects.getShakeOffset(elapsed);
  const lockedBearing = combat.getLockedBearingDeg(flight.state.position);
  document.body.classList.toggle('cockpit-view', camCtrl.getMode() === 'cockpit');

  world.update(elapsed, shotMode ? 0 : dt, flight.state.position, flight.state.windDirRad);
  plane.updateVisuals(
    shotMode ? 0.016 : dt,
    elapsed,
    flight.state,
    telemetry,
    camCtrl.getMode() === 'cockpit',
    combat.state,
    weapons.state,
    livingEnemies
  );
  camCtrl.update(shotMode ? 0.016 : dt, elapsed, gameState, flight.state, input.mouseLook, shakeOffset, Boolean(shotMode));
  hud.update(shotMode ? 0 : dt, telemetry, missionInfo, camCtrl.getMode(), gameState, combat.state, livingEnemies, lockedBearing);
  combatHud.update(
    elapsed,
    camera,
    flight.state,
    livingEnemies,
    activeBoss,
    combat.state,
    weapons.state,
    camCtrl.getMode(),
    gameState,
    input.mouseAim
  );
  audio.update(telemetry, gameState, elapsed);

  renderer.render(scene, camera);
}

// Render initial frame immediately
(function renderInitialFrame() {
  const livingEnemies = enemies.getEnemies();
  const activeBoss = enemies.getActiveBoss();
  const missionInfo = missionMgr.update(0, elapsed, flight.state.position, false);
  lastMissionInfo = missionInfo;
  const telemetry = flight.getTelemetry(missionInfo);
  const lockedBearing = combat.getLockedBearingDeg(flight.state.position);
  document.body.classList.toggle('cockpit-view', camCtrl.getMode() === 'cockpit');
  world.update(elapsed, 0, flight.state.position, flight.state.windDirRad);
  plane.updateVisuals(0.016, elapsed, flight.state, telemetry, camCtrl.getMode() === 'cockpit', combat.state, weapons.state, livingEnemies);
  camCtrl.update(0.016, elapsed, gameState, flight.state, input.mouseLook, { x: 0, y: 0, z: 0, roll: 0 }, true);
  hud.update(0, telemetry, missionInfo, camCtrl.getMode(), gameState, combat.state, livingEnemies, lockedBearing);
  combatHud.update(elapsed, camera, flight.state, livingEnemies, activeBoss, combat.state, weapons.state, camCtrl.getMode(), gameState, input.mouseAim);
  renderer.render(scene, camera);
})();

// Inspection & deterministic simulation stepping handle for automated verification
window.__MERPATI__ = {
  getState: () => {
    const living = enemies.getEnemies();
    const boss = enemies.getActiveBoss();
    return {
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
      wepActive: flight.state.wepActive,
      fuel: Math.round(flight.state.fuel),
      damage: Math.round(flight.state.damage),
      onGround: flight.state.onGround,
      onRunway: flight.state.onRunway,
      crashed: flight.state.crashed,
      ammo: weapons.state.ammo,
      heat: Number(weapons.state.heat.toFixed(2)),
      missiles: weapons.state.missiles,
      flareCooldown: Number(weapons.state.flareCooldown.toFixed(2)),
      kills: combat.state.kills,
      hostilesRemaining: combat.state.hostilesRemaining,
      livingEnemyCount: living.length,
      lockedTarget: combat.state.lockedEnemy ? combat.state.lockedEnemy.shortName : null,
      lockProgress: Number(combat.state.lockProgress.toFixed(2)),
      boss: boss ? { name: boss.shortName, hp: boss.hp, maxHp: boss.maxHp, phase: boss.bossPhase } : null,
    };
  },
  selectMission: (idx) => selectMission(idx),
  launch: () => launchMission(),
  setCameraMode: (mode) => camCtrl.setMode(mode),
  fireMissile: () => combat.triggerMissile(plane, flight.state),
  deployFlares: () => combat.triggerFlares(flight.state),
  cycleTarget: () => combat.cycleTarget(),
  damageLockedEnemy: (dmg) => {
    const target = combat.state.lockedEnemy || enemies.getEnemies()[0];
    if (!target) return null;
    const res = enemies.damageEnemy(target, dmg);
    if (res.killed) {
      combat.state.kills += 1;
      combat.state.hostilesRemaining = Math.max(0, combat.state.hostilesRemaining - 1);
    }
    return res;
  },
  applyPlayerDamage: (dmg, label) => {
    flight.applyCombatDamage(dmg, label || 'Test flak');
    if (lastMissionInfo) processEvents(lastMissionInfo);
    return window.__MERPATI__.getState();
  },
  stepSimulation: (seconds, ctrlOverride) => {
    const destId = missionMgr.missions[selectedMissionIdx].destStrip;
    const steps = Math.max(1, Math.round(seconds / 0.02));
    const ctrl = Object.assign({ pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brake: false, fireCannon: false }, ctrlOverride || {});
    for (let i = 0; i < steps; i++) {
      elapsed += 0.02;
      flight.step(0.02, ctrl, destId, combat.isCombatComplete());
      const mi = missionMgr.update(0.02, elapsed, flight.state.position, gameState === 'flying');
      lastMissionInfo = mi;
      combat.update(0.02, elapsed, flight, plane, mi, ctrl);
      effects.update(0.02);
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
