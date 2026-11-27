import * as THREE from '../vendor/three.min.js';

/**
 * Mission combat wave tables matching all four Nusantara combat-courier sorties.
 */
const MISSION_WAVES = [
  // Mission 0: Nusa Indah Mail Run (Rookie) — 3 Kestrel Scouts in 2 forgiving waves
  [
    {
      triggerRing: 0,
      triggerSec: 0,
      alert: 'BANDA RAIDERS DETECTED — 2 KESTREL SCOUTS OVER LAGOON',
      units: [
        { type: 'kestrel', x: -460, y: 120, z: 120, headingDeg: 210, orbitAlt: 120 },
        { type: 'kestrel', x: -320, y: 145, z: -40, headingDeg: 225, orbitAlt: 135 },
      ],
    },
    {
      triggerRing: 2,
      triggerSec: 26,
      alert: 'INCOMING REINFORCEMENT — KESTREL INTERCEPTOR',
      units: [
        { type: 'kestrel', x: -240, y: 155, z: -220, headingDeg: 205, orbitAlt: 140 },
      ],
    },
  ],
  // Mission 1: Gunung Api Medical Express (Intermediate) — 2 Kestrels + 2 Komodo Gunships
  [
    {
      triggerRing: 0,
      triggerSec: 0,
      alert: 'HOSTILE PATROL OVER VOLCANO APPROACH — 2 KESTRELS',
      units: [
        { type: 'kestrel', x: 240, y: 195, z: -610, headingDeg: 240, orbitAlt: 200 },
        { type: 'kestrel', x: 520, y: 270, z: -740, headingDeg: 265, orbitAlt: 270 },
      ],
    },
    {
      triggerRing: 2,
      triggerSec: 22,
      alert: 'AMBUSH AT GUNUNG API — 2 KOMODO GUNSHIPS',
      units: [
        { type: 'komodo', x: 840, y: 315, z: -620, headingDeg: 290, orbitAlt: 300 },
        { type: 'komodo', x: 960, y: 230, z: -210, headingDeg: 340, orbitAlt: 230 },
      ],
    },
  ],
  // Mission 2: Karang Reef Island Hopper (Veteran) — 2 Kestrels, 1 Komodo, Ace Elang Merah
  [
    {
      triggerRing: 0,
      triggerSec: 0,
      alert: 'REEF BLOCKADE — 2 KESTRELS & 1 KOMODO GUNSHIP',
      units: [
        { type: 'kestrel', x: 290, y: 130, z: -310, headingDeg: 110, orbitAlt: 130 },
        { type: 'kestrel', x: -160, y: 140, z: -290, headingDeg: 90, orbitAlt: 140 },
        { type: 'komodo', x: -460, y: 155, z: -430, headingDeg: 95, orbitAlt: 155 },
      ],
    },
    {
      triggerRing: 2,
      triggerSec: 20,
      alert: 'WARNING: CRIMSON ACE ELANG MERAH ENTERING AIRSPACE!',
      isBossWave: true,
      units: [
        { type: 'elang', x: -780, y: 190, z: -560, headingDeg: 105, orbitAlt: 185 },
      ],
    },
  ],
  // Mission 3: Nusantara Grand Circuit (Ace) — 2 Kestrels, 2 Komodos, Naga Langit Command Airship Boss
  [
    {
      triggerRing: 0,
      triggerSec: 0,
      alert: 'BOSS ALERT: NAGA LANGIT COMMAND AIRSHIP BLOCKADING ARCHIPELAGO!',
      isBossWave: true,
      units: [
        { type: 'naga', x: -120, y: 215, z: 60, headingDeg: 75, orbitCenter: new THREE.Vector3(-80, 215, 40), orbitRadius: 340, orbitAlt: 215 },
        { type: 'kestrel', x: -560, y: 145, z: 20, headingDeg: 315, orbitAlt: 145 },
        { type: 'kestrel', x: 180, y: 165, z: 210, headingDeg: 270, orbitAlt: 160 },
      ],
    },
    {
      triggerRing: 3,
      triggerSec: 32,
      alert: 'NAGA LANGIT LAUNCHING ESCORTS — 2 KOMODO GUNSHIPS!',
      units: [
        { type: 'komodo', x: 240, y: 185, z: 460, headingDeg: 245, orbitAlt: 185 },
        { type: 'komodo', x: -340, y: 175, z: 680, headingDeg: 35, orbitAlt: 175 },
      ],
    },
  ],
];

/**
 * Central combat director coordinating mission waves, radar lock-on,
 * damage attribution, boss phases, touch-and-go resupply, and scoring.
 */
export function createCombatDirector(enemies, weapons, effects, audio) {
  const state = {
    missionIdx: 0,
    spawnedWaveMask: [],
    kills: 0,
    kestrelKills: 0,
    gunshipKills: 0,
    aceKills: 0,
    bossKills: 0,
    totalMissionHostiles: 0,
    hostilesRemaining: 0,
    lockedEnemy: null,
    lockProgress: 0,
    lockAcquired: false,
    lockToneTimer: 0,
    killStreak: 0,
    killStreakTimer: 0,
    hitMarkerTimer: 0,
    damageVignette: { alpha: 0, angleRad: 0 },
    killFeed: [],
    resuppliedStrips: new Set(),
    combatPoints: 0,
    bossBounty: 0,
    events: [],
  };

  const fwd = new THREE.Vector3();
  const toEnemy = new THREE.Vector3();

  function pushKillFeed(text, tone = 'kill') {
    state.killFeed.unshift({ text, tone, ttl: 4.5 });
    if (state.killFeed.length > 4) state.killFeed.pop();
  }

  function spawnWave(waveIdx) {
    const waves = MISSION_WAVES[state.missionIdx] || MISSION_WAVES[0];
    if (waveIdx >= waves.length || state.spawnedWaveMask[waveIdx]) return;
    state.spawnedWaveMask[waveIdx] = true;
    const wave = waves[waveIdx];
    for (const u of wave.units) {
      enemies.spawnEnemy(u.type, u);
    }
    if (wave.isBossWave) {
      audio.playBossKlaxon();
      state.events.push({ type: 'alert', text: wave.alert, tone: 'warn', duration: 3.8 });
    } else {
      state.events.push({ type: 'alert', text: wave.alert, tone: 'gold', duration: 3.0 });
    }
  }

  function resetForMission(missionIdx) {
    enemies.clear();
    weapons.reset();
    effects.clear();

    state.missionIdx = missionIdx % MISSION_WAVES.length;
    const waves = MISSION_WAVES[state.missionIdx];
    state.spawnedWaveMask = waves.map(() => false);
    state.totalMissionHostiles = waves.reduce((sum, w) => sum + w.units.length, 0);
    state.hostilesRemaining = state.totalMissionHostiles;
    state.kills = 0;
    state.kestrelKills = 0;
    state.gunshipKills = 0;
    state.aceKills = 0;
    state.bossKills = 0;
    state.lockedEnemy = null;
    state.lockProgress = 0;
    state.lockAcquired = false;
    state.lockToneTimer = 0;
    state.killStreak = 0;
    state.killStreakTimer = 0;
    state.hitMarkerTimer = 0;
    state.damageVignette.alpha = 0;
    state.killFeed.length = 0;
    state.resuppliedStrips.clear();
    state.combatPoints = 0;
    state.bossBounty = 0;
    state.events.length = 0;

    // Seed initial enemy wave immediately
    spawnWave(0);
  }

  function pickBestTarget(flightState) {
    const living = enemies.getEnemies();
    if (living.length === 0) return null;
    fwd.set(0, 0, -1).applyQuaternion(flightState.quaternion);
    let best = null;
    let bestScore = Infinity;
    for (const e of living) {
      const dist = e.pos.distanceTo(flightState.position);
      toEnemy.subVectors(e.pos, flightState.position).normalize();
      const align = Math.max(0.15, fwd.dot(toEnemy));
      const score = dist / (0.6 + align * 1.4) - (e.isBoss ? 140 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  function cycleTarget() {
    const living = enemies.getEnemies();
    if (living.length === 0) {
      state.lockedEnemy = null;
      state.lockProgress = 0;
      state.lockAcquired = false;
      return null;
    }
    const curIdx = living.indexOf(state.lockedEnemy);
    state.lockedEnemy = living[(curIdx + 1) % living.length];
    state.lockProgress = 0;
    state.lockAcquired = false;
    return state.lockedEnemy;
  }

  function triggerMissile(planeObj, flightState) {
    const target = state.lockAcquired && state.lockedEnemy && state.lockedEnemy.alive && !state.lockedEnemy.dying
      ? state.lockedEnemy
      : null;
    const res = weapons.fireMissile(planeObj, flightState, target);
    if (res.fired) {
      audio.playMissileLaunch();
      if (res.locked) {
        state.events.push({ type: 'alert', text: `FOX-2 SURYA-2 TRACKING ${target.shortName}!`, tone: 'info', duration: 1.6 });
      }
    }
    return res.fired;
  }

  function triggerFlares(flightState) {
    if (weapons.deployFlares(flightState)) {
      audio.playFlarePop();
      state.events.push({ type: 'alert', text: 'CHAFF & FLARES DEPLOYED — EVASION WINDOW', tone: 'gold', duration: 1.8 });
      return true;
    }
    return false;
  }

  function handleTouchAndGoResupply(stripId, stripName, flight) {
    if (state.resuppliedStrips.has(stripId)) return false;
    state.resuppliedStrips.add(stripId);
    flight.state.fuel = Math.min(100, flight.state.fuel + 30);
    flight.state.damage = Math.max(0, flight.state.damage - 25);
    weapons.resupply();
    audio.playRingChime(true);
    pushKillFeed(`RESUPPLY AT ${stripName.toUpperCase()}`, 'resupply');
    state.events.push({
      type: 'alert',
      text: `TOUCH-AND-GO RESUPPLY AT ${stripName.toUpperCase()} (+30% FUEL, +25% HULL, AMMO & MISSILES)`,
      tone: 'gold',
      duration: 3.4,
    });
    return true;
  }

  function handleEnemyHit(enemy, dmg) {
    const res = enemies.damageEnemy(enemy, dmg);
    if (!res.hit) return;
    state.hitMarkerTimer = 0.16;
    audio.playHitConfirm();

    if (res.bossPhaseChanged) {
      audio.playBossKlaxon();
      const msg = res.newPhase === 3
        ? 'NAGA LANGIT CRITICAL — FULL FLAK BARRAGE!'
        : 'NAGA LANGIT GONDOLA BREACHED — ESCORTS INBOUND!';
      state.events.push({ type: 'alert', text: msg, tone: 'warn', duration: 3.2 });
      if (state.missionIdx === 3) spawnWave(1);
    }

    if (res.killed) {
      state.kills += 1;
      state.killStreak += 1;
      state.killStreakTimer = 10;

      if (res.type === 'kestrel') {
        state.kestrelKills += 1;
        state.combatPoints += res.points;
      } else if (res.type === 'komodo') {
        state.gunshipKills += 1;
        state.combatPoints += res.points;
      } else if (res.isAce) {
        state.aceKills += 1;
        state.bossBounty += res.points;
      } else if (res.isBoss) {
        state.bossKills += 1;
        state.bossBounty += res.points;
      }

      audio.playExplosion(res.isBoss);
      pushKillFeed(`${res.name.toUpperCase()} DESTROYED +${res.points}`, res.isBoss ? 'boss' : 'kill');
      if (state.lockedEnemy === enemy) {
        state.lockedEnemy = null;
        state.lockProgress = 0;
        state.lockAcquired = false;
      }
      if (state.kills >= state.totalMissionHostiles) {
        state.events.push({
          type: 'alert',
          text: 'AIRSPACE CLEAR — PROCEED TO DESTINATION RUNWAY!',
          tone: 'gold',
          duration: 3.4,
        });
      }
    }
  }

  function handlePlayerHit(dmg, hitDirWorld, sourceLabel, flight) {
    const flareMitigation = weapons.state.flareActiveTimer > 0 ? 0.35 : 1.0;
    const finalDmg = Math.max(1, Math.round(dmg * flareMitigation));

    // Compute directional angle for HUD damage arc relative to player heading
    const hitBearing = Math.atan2(hitDirWorld.x, -hitDirWorld.z);
    state.damageVignette.angleRad = hitBearing - flight.state.headingRad;
    state.damageVignette.alpha = 0.88;

    audio.playHullImpact();
    effects.addTrauma(0.32);
    flight.applyCombatDamage(finalDmg, sourceLabel);
  }

  function update(dt, elapsed, flight, planeObj, missionInfo, ctrl) {
    state.events.length = 0;

    // Trigger subsequent waves on ring progress or mission timer
    const waves = MISSION_WAVES[state.missionIdx] || [];
    for (let i = 1; i < waves.length; i++) {
      if (!state.spawnedWaveMask[i]) {
        if (missionInfo.ringsHit >= waves[i].triggerRing || missionInfo.elapsedSec >= waves[i].triggerSec) {
          spawnWave(i);
        }
      }
    }

    // Primary autocannon fire while held
    if (ctrl.fireCannon && !flight.state.crashed) {
      if (weapons.fireCannon(planeObj, flight.state)) {
        audio.playCannonShot();
      }
    }

    // Decay HUD timers
    state.hitMarkerTimer = Math.max(0, state.hitMarkerTimer - dt);
    state.damageVignette.alpha = Math.max(0, state.damageVignette.alpha - dt * 1.9);
    if (state.killStreakTimer > 0) {
      state.killStreakTimer -= dt;
      if (state.killStreakTimer <= 0) state.killStreak = 0;
    }
    for (let i = state.killFeed.length - 1; i >= 0; i--) {
      state.killFeed[i].ttl -= dt;
      if (state.killFeed[i].ttl <= 0) state.killFeed.splice(i, 1);
    }

    // Step enemy AI & allow them to shoot
    const flareActive = weapons.state.flareActiveTimer > 0;
    enemies.update(dt, elapsed, flight.state, flareActive, {
      fireEnemyTracer: (pos, vel, dmg) => weapons.fireEnemyTracer(pos, vel, dmg),
      fireBossFlak: (pos, targetPos, fuse) => weapons.fireBossFlak(pos, targetPos, fuse),
    });

    // Step weapons & resolve swept hits
    const living = enemies.getEnemies();
    weapons.update(dt, flight.state, living, {
      onEnemyHit: (enemy, dmg) => handleEnemyHit(enemy, dmg),
      onPlayerHit: (dmg, dir, label) => handlePlayerHit(dmg, dir, label, flight),
    });

    // Update target lock & infrared seeker acquisition
    if (!state.lockedEnemy || !state.lockedEnemy.alive || state.lockedEnemy.dying) {
      state.lockedEnemy = pickBestTarget(flight.state);
      state.lockProgress = 0;
      state.lockAcquired = false;
    }

    if (state.lockedEnemy) {
      fwd.set(0, 0, -1).applyQuaternion(flight.state.quaternion);
      toEnemy.subVectors(state.lockedEnemy.pos, flight.state.position);
      const dist = toEnemy.length();
      toEnemy.divideScalar(Math.max(0.01, dist));
      const inCone = fwd.dot(toEnemy) > 0.89 && dist < 960;

      if (inCone) {
        state.lockProgress = Math.min(1, state.lockProgress + dt / 1.4);
        const nowLocked = state.lockProgress >= 0.995;
        state.lockToneTimer -= dt;
        if (state.lockToneTimer <= 0) {
          state.lockToneTimer = nowLocked ? 0.34 : 0.24;
          audio.playLockTone(nowLocked);
        }
        state.lockAcquired = nowLocked;
      } else {
        state.lockProgress = Math.max(0, state.lockProgress - dt * 1.6);
        state.lockAcquired = false;
      }
    }

    // Count remaining hostiles (unspawned + living)
    let unspawned = 0;
    for (let i = 0; i < waves.length; i++) {
      if (!state.spawnedWaveMask[i]) unspawned += waves[i].units.length;
    }
    state.hostilesRemaining = unspawned + living.length;
  }

  function isCombatComplete() {
    return state.hostilesRemaining === 0;
  }

  function getLockedBearingDeg(playerPos) {
    if (!state.lockedEnemy || !state.lockedEnemy.alive || state.lockedEnemy.dying) return null;
    const dx = state.lockedEnemy.pos.x - playerPos.x;
    const dz = state.lockedEnemy.pos.z - playerPos.z;
    let deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }

  function getCombatScore(flightState) {
    const accuracyPct = weapons.state.shotsFired > 0
      ? Math.min(100, Math.round((weapons.state.shotsHit / weapons.state.shotsFired) * 100))
      : 0;
    const accuracyBonus = Math.round(accuracyPct * 4);
    const survivalBonus = flightState.damage < 45 ? 350 : 150;
    const totalCombatScore = state.combatPoints + state.bossBounty + accuracyBonus + survivalBonus;
    return {
      kills: state.kills,
      kestrelKills: state.kestrelKills,
      gunshipKills: state.gunshipKills,
      aceKills: state.aceKills,
      bossKills: state.bossKills,
      raiderScore: state.combatPoints,
      bossBounty: state.bossBounty,
      accuracyPct,
      accuracyBonus,
      survivalBonus,
      totalCombatScore,
      shotsFired: weapons.state.shotsFired,
      shotsHit: weapons.state.shotsHit,
      missilesFired: weapons.state.missilesFired,
    };
  }

  function setStagedState({ kills, kestrelKills, gunshipKills, aceKills, bossKills, lockedEnemy, lockProgress, hitMarkerTimer, killFeedEntries }) {
    state.kills = kills ?? 0;
    state.kestrelKills = kestrelKills ?? 0;
    state.gunshipKills = gunshipKills ?? 0;
    state.aceKills = aceKills ?? 0;
    state.bossKills = bossKills ?? 0;
    state.combatPoints = state.kestrelKills * 400 + state.gunshipKills * 750;
    state.bossBounty = state.aceKills * 1500 + state.bossKills * 2500;
    state.lockedEnemy = lockedEnemy ?? null;
    state.lockProgress = lockProgress ?? 0;
    state.lockAcquired = state.lockProgress >= 0.99;
    state.hitMarkerTimer = hitMarkerTimer ?? 0;
    state.hostilesRemaining = enemies.getEnemies().length;
    state.killFeed.length = 0;
    if (killFeedEntries) {
      for (const e of killFeedEntries) state.killFeed.push({ text: e.text, tone: e.tone || 'kill', ttl: 4.5 });
    }
  }

  return {
    state,
    resetForMission,
    cycleTarget,
    triggerMissile,
    triggerFlares,
    handleTouchAndGoResupply,
    update,
    isCombatComplete,
    getLockedBearingDeg,
    getCombatScore,
    setStagedState,
  };
}
