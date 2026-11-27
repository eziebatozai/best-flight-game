import * as THREE from '../vendor/three.min.js';

/**
 * Deterministic screenshot staging module for Merpati Run: Storm Interceptor.
 * Configures reproducible combat-courier scenes using the live Three.js engine,
 * enemies, weapons, VFX, cockpit instruments, and HUD modules.
 */
export function applyCombatShot(shotName, ctx) {
  const { missionMgr, flight, combat, enemies, weapons, effects, camCtrl, hud, plane } = ctx;

  if (shotName === 'cover') {
    // 1-cover.jpg: Explosive mid-air dogfight over Pulau Hijau & Gunung Api with Naga Langit boss
    missionMgr.loadMission(3);
    missionMgr.setProgressForShot(4, 62);
    combat.resetForMission(3);
    enemies.clear();
    weapons.reset();
    effects.clear();

    camCtrl.setMode('chase');
    hud.showTitle(false);
    hud.hideResult();

    flight.setPose({
      x: -445,
      y: 128,
      z: 118,
      headingDeg: 40,
      pitchDeg: -4,
      rollDeg: -16,
      speedKt: 108,
      throttle: 0.94,
      flaps: 0,
      fuel: 78,
      damage: 12,
      onGround: false,
    });
    plane.root.position.copy(flight.state.position);
    plane.root.quaternion.copy(flight.state.quaternion);
    plane.root.updateMatrixWorld(true);

    // Glowing courier ring ahead along the Pulau Hijau island corridor
    missionMgr.setActiveRingPoseForShot(-295, 86, -68, 40);

    // Massive Naga Langit Command Airship Boss dominating upper-right sunlit sky (clear of sun glare so crimson fins & furnaces pop!)
    enemies.spawnEnemy('naga', {
      x: -72,
      y: 196,
      z: -168,
      headingDeg: 118,
      hp: 422,
    });

    // Komodo Gunship ahead right-of-center locked in crimson diamond with predictive lead pipper
    const lockedGunship = enemies.spawnEnemy('komodo', {
      x: -302,
      y: 125,
      z: -42,
      headingDeg: 78,
      rollDeg: -26,
      hp: 68,
    });
    lockedGunship.vel.set(34, -3, -12);

    // Kestrel Scout ahead left-of-center erupting in a vivid multi-layered mid-air fireball explosion
    effects.spawnStagedExplosion(new THREE.Vector3(-406, 134, -18), 1.32);

    // Aerial flak burst near boss corridor
    effects.spawnFlakBurst(new THREE.Vector3(-228, 166, -112), 1.15);

    // Luminous twin 20mm tracer streams leaving both underwing gun pods toward the Komodo Gunship
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(flight.state.quaternion);
    const leftMuzzle = plane.getGunMuzzleWorldPos(-1);
    const rightMuzzle = plane.getGunMuzzleWorldPos(1);
    const aimDir = lockedGunship.pos.clone().sub(flight.state.position).normalize();
    for (const dist of [12, 32, 54, 78, 104, 130]) {
      weapons.spawnStagedTracer(leftMuzzle.clone().addScaledVector(aimDir, dist), aimDir, false);
      weapons.spawnStagedTracer(rightMuzzle.clone().addScaledVector(aimDir, dist + 8), aimDir, false);
    }
    effects.spawnMuzzleFlash(leftMuzzle, fwd);
    effects.spawnMuzzleFlash(rightMuzzle, fwd);

    // Surya-2 homing missile arcing ahead trailing a crisp sunlit white contrail ribbon
    const missilePos = flight.state.position.clone().add(new THREE.Vector3(44, 6, -54));
    const missileDir = lockedGunship.pos.clone().sub(missilePos).normalize();
    weapons.spawnStagedMissile(missilePos, missileDir, 12);

    weapons.state.ammo = 224;
    weapons.state.heat = 0.56;
    weapons.state.missiles = 4;
    combat.setStagedState({
      kills: 3,
      kestrelKills: 2,
      gunshipKills: 1,
      lockedEnemy: lockedGunship,
      lockProgress: 1.0,
      hitMarkerTimer: 0.14,
      killFeedEntries: [{ text: 'KESTREL SCOUT DESTROYED +400', tone: 'kill' }],
    });
    return { gameState: 'flying', elapsed: 7.4 };
  }

  if (shotName === 'gameplay') {
    // 2-gameplay.jpg: Mission 3 centered dogfight vs Elang Merah Ace over coastal reefs & Pulau Hijau
    missionMgr.loadMission(2);
    missionMgr.setProgressForShot(4, 68);
    combat.resetForMission(2);
    enemies.clear();
    weapons.reset();
    effects.clear();

    camCtrl.setMode('chase');
    hud.showTitle(false);
    hud.hideResult();

    flight.setPose({
      x: -440,
      y: 112,
      z: -480,
      headingDeg: 256,
      pitchDeg: -2,
      rollDeg: 16,
      speedKt: 114,
      throttle: 0.96,
      flaps: 0,
      fuel: 62,
      damage: 18,
      onGround: false,
    });
    plane.root.position.copy(flight.state.position);
    plane.root.quaternion.copy(flight.state.quaternion);
    plane.root.updateMatrixWorld(true);

    // Glowing golden courier ring framed cleanly ahead-center over karst islets & Teluk Barat bay
    missionMgr.setActiveRingPoseForShot(-645, 96, -530, 256);

    // Crimson Ace Elang Merah centered cleanly ahead inside pulsing red LOCK bracket with lead pipper
    const ace = enemies.spawnEnemy('elang', {
      x: -578,
      y: 118,
      z: -514,
      headingDeg: 295,
      rollDeg: -42,
      hp: 124,
    });
    ace.vel.set(-48, 8, -24);

    // Damaged smoking Komodo Gunship visible in left-center sky trailing dark oil smoke
    const gunship = enemies.spawnEnemy('komodo', {
      x: -582,
      y: 132,
      z: -456,
      headingDeg: 215,
      rollDeg: 18,
      hp: 54,
    });
    for (let i = 0; i < 6; i++) {
      effects.spawnOilSmoke(gunship.pos.clone().add(new THREE.Vector3(i * 6, i * 1.8, -i * 5)), 1.25);
    }

    // Twin 20mm tracer burst connecting with bright hit sparks on Elang Merah + aerial flak puffs
    const leftMuzzle = plane.getGunMuzzleWorldPos(-1);
    const rightMuzzle = plane.getGunMuzzleWorldPos(1);
    const toAce = ace.pos.clone().sub(flight.state.position).normalize();
    for (const d of [14, 38, 64, 92, 118]) {
      weapons.spawnStagedTracer(leftMuzzle.clone().addScaledVector(toAce, d), toAce, false);
      weapons.spawnStagedTracer(rightMuzzle.clone().addScaledVector(toAce, d + 9), toAce, false);
    }
    effects.spawnHitSparks(ace.pos.clone().add(new THREE.Vector3(2, 1, 1)), 14);
    effects.spawnFlakBurst(new THREE.Vector3(-625, 142, -558), 1.15);
    effects.spawnFlakBurst(new THREE.Vector3(-560, 146, -445), 0.95);

    weapons.state.ammo = 178;
    weapons.state.heat = 0.72;
    weapons.state.missiles = 3;
    combat.setStagedState({
      kills: 2,
      kestrelKills: 2,
      lockedEnemy: ace,
      lockProgress: 1.0,
      hitMarkerTimer: 0.16,
      killFeedEntries: [
        { text: 'KESTREL SCOUT DESTROYED +400', tone: 'kill' },
        { text: 'ACE ELANG MERAH LOCKED', tone: 'boss' },
      ],
    });
    return { gameState: 'flying', elapsed: 8.2 };
  }

  if (shotName === 'cockpit') {
    // 3-cockpit.jpg: First-person cockpit view with lit gauges, Nav MFD, green reflex gunsight on enemy & runway
    missionMgr.loadMission(0);
    missionMgr.setProgressForShot(5, 66);
    combat.resetForMission(0);
    enemies.clear();
    weapons.reset();
    effects.clear();

    camCtrl.setMode('cockpit');
    hud.showTitle(false);
    hud.hideResult();

    // Positioned cleanly on final approach to Pulau Hijau paved runway so runway, ring, and enemy all align!
    flight.setPose({
      x: -312,
      y: 72,
      z: -74,
      headingDeg: 40,
      pitchDeg: -6.5,
      rollDeg: -2.5,
      speedKt: 86,
      throttle: 0.76,
      flaps: 1,
      fuel: 71,
      damage: 10,
      onGround: false,
    });
    plane.root.position.copy(flight.state.position);
    plane.root.quaternion.copy(flight.state.quaternion);
    plane.root.updateMatrixWorld(true);

    // Golden courier approach ring & Pulau Hijau coastal runway visible straight over the nose cowling
    missionMgr.setActiveRingPoseForShot(-222, 42, -182, 40);

    // Enemy Kestrel Scout centered right inside the green holographic reflex gunsight
    const targetRaider = enemies.spawnEnemy('kestrel', {
      x: -248,
      y: 62,
      z: -152,
      headingDeg: 64,
      rollDeg: -24,
      hp: 26,
    });
    targetRaider.vel.set(32, -2, -14);

    // Second raider on tactical MFD + bright fiery explosion off port wing
    enemies.spawnEnemy('komodo', {
      x: -160,
      y: 112,
      z: -210,
      headingDeg: 215,
      hp: 95,
    });
    effects.spawnStagedExplosion(new THREE.Vector3(-292, 76, -162), 0.92);

    const leftMuzzle = plane.getGunMuzzleWorldPos(-1);
    const rightMuzzle = plane.getGunMuzzleWorldPos(1);
    const toTarget = targetRaider.pos.clone().sub(flight.state.position).normalize();
    for (const d of [14, 34, 56, 78]) {
      weapons.spawnStagedTracer(leftMuzzle.clone().addScaledVector(toTarget, d), toTarget, false);
      weapons.spawnStagedTracer(rightMuzzle.clone().addScaledVector(toTarget, d + 6), toTarget, false);
    }
    effects.spawnHitSparks(targetRaider.pos, 10);

    weapons.state.ammo = 212;
    weapons.state.heat = 0.44;
    weapons.state.missiles = 4;
    combat.setStagedState({
      kills: 2,
      kestrelKills: 2,
      lockedEnemy: targetRaider,
      lockProgress: 1.0,
      hitMarkerTimer: 0.14,
      killFeedEntries: [{ text: 'KESTREL SCOUT DESTROYED +400', tone: 'kill' }],
    });
    return { gameState: 'flying', elapsed: 6.8 };
  }

  if (shotName === 'debrief') {
    // 4-debrief.jpg: Victorious armed Stormbird parked cleanly left-of-center on Pelabuhan Utama destination runway
    missionMgr.loadMission(3);
    missionMgr.setProgressForShot(8, 118);
    combat.resetForMission(3);
    enemies.clear();
    weapons.reset();
    effects.clear();

    camCtrl.setMode('chase');
    hud.showTitle(false);

    flight.setPose({
      x: -640,
      y: 15.32,
      z: 620,
      headingDeg: 28,
      pitchDeg: 0,
      rollDeg: 0,
      speedKt: 0,
      throttle: 0.14,
      flaps: 2,
      fuel: 64,
      damage: 14,
      onGround: true,
      onRunway: 'pelabuhan',
    });
    flight.state.landingRecord = {
      touchedDown: true,
      touchdownVsi: 1.0,
      touchdownRollDeg: 1.8,
      bounceCount: 0,
      grade: 'BUTTER',
    };

    // Distant victory smoke columns drifting across the golden-monsoon archipelago bay
    for (let i = 0; i < 6; i++) {
      effects.spawnOilSmoke(new THREE.Vector3(-420 + i * 16, 44 + i * 20, 220 - i * 12), 2.2);
      effects.spawnOilSmoke(new THREE.Vector3(-860 - i * 12, 36 + i * 18, 280 - i * 10), 1.8);
    }

    weapons.state.ammo = 114;
    weapons.state.missiles = 2;
    weapons.state.shotsFired = 186;
    weapons.state.shotsHit = 132;
    combat.setStagedState({
      kills: 5,
      kestrelKills: 2,
      gunshipKills: 2,
      bossKills: 1,
      lockedEnemy: null,
      lockProgress: 0,
      hitMarkerTimer: 0,
    });

    const combatScore = combat.getCombatScore(flight.state);
    const totalScore = missionMgr.calculateScore(flight.state, combatScore);
    hud.showLandingResult(totalScore);
    return { gameState: 'landed', elapsed: 6.4 };
  }

  return null;
}
