import * as THREE from '../vendor/three.min.js';

export const WEAPON_SPECS = {
  maxAmmo: 300,
  maxMissiles: 6,
  cannonSpeed: 300,
  cannonDmg: 15,
  cannonCooldown: 0.085,
  missileDmg: 95,
  missileSpeed: 155,
  missileCooldown: 0.65,
  flareCooldown: 6.0,
  flareDuration: 2.8,
};

/**
 * Compute shortest squared distance from point P to line segment AB.
 */
function distSqPointToSegment(p, a, b, outClosest) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const lenSq = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (lenSq > 0.00001) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const cz = a.z + abz * t;
  if (outClosest) outClosest.set(cx, cy, cz);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const dz = p.z - cz;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Create the airborne weapons, ordnance trajectory, flare countermeasure,
 * and swept-segment hit detection subsystem.
 */
export function createWeaponsSystem(scene, world, effects) {
  const group = new THREE.Group();
  scene.add(group);

  const state = {
    ammo: WEAPON_SPECS.maxAmmo,
    maxAmmo: WEAPON_SPECS.maxAmmo,
    heat: 0,
    overheated: false,
    missiles: WEAPON_SPECS.maxMissiles,
    maxMissiles: WEAPON_SPECS.maxMissiles,
    flareCooldown: 0,
    flareActiveTimer: 0,
    gunCooldown: 0,
    missileCooldown: 0,
    gunSide: 0,
    missileSide: 0,
    shotsFired: 0,
    shotsHit: 0,
    missilesFired: 0,
  };

  // Shared geometries & materials
  const playerBoltGeo = new THREE.BoxGeometry(0.24, 0.24, 8.8);
  const playerBoltMat = new THREE.MeshBasicMaterial({ color: '#ffd356' });
  const enemyBoltGeo = new THREE.BoxGeometry(0.26, 0.26, 7.6);
  const enemyBoltMat = new THREE.MeshBasicMaterial({ color: '#ff3d4d' });
  const flakGeo = new THREE.SphereGeometry(0.65, 6, 6);
  const flakMat = new THREE.MeshBasicMaterial({ color: '#ff6e2a' });
  const flareGeo = new THREE.SphereGeometry(0.55, 8, 8);
  const flareMat = new THREE.MeshBasicMaterial({ color: '#fffbe6' });

  const playerTracers = [];
  const enemyTracers = [];
  const missiles = [];
  const flakShells = [];
  const flares = [];

  const prevPos = new THREE.Vector3();
  const closestPt = new THREE.Vector3();
  const desiredDir = new THREE.Vector3();
  const currDir = new THREE.Vector3();
  const fwdVec = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const enemyFwd = new THREE.Vector3();
  const capsulePt = new THREE.Vector3();

  function buildMissileMesh() {
    const mGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.35 })
    );
    body.rotation.x = Math.PI / 2;
    mGroup.add(body);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.55, 8),
      new THREE.MeshBasicMaterial({ color: '#d92828' })
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.52;
    mGroup.add(nose);

    const finMat = new THREE.MeshBasicMaterial({ color: '#c62828' });
    const hFin = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.42), finMat);
    hFin.position.z = 0.95;
    mGroup.add(hFin);
    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.75, 0.42), finMat);
    vFin.position.z = 0.95;
    mGroup.add(vFin);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffae38' })
    );
    glow.position.z = 1.45;
    mGroup.add(glow);
    return mGroup;
  }

  function clearList(list) {
    while (list.length > 0) {
      group.remove(list.pop().mesh);
    }
  }

  function reset() {
    clearList(playerTracers);
    clearList(enemyTracers);
    clearList(missiles);
    clearList(flakShells);
    clearList(flares);
    state.ammo = WEAPON_SPECS.maxAmmo;
    state.heat = 0;
    state.overheated = false;
    state.missiles = WEAPON_SPECS.maxMissiles;
    state.flareCooldown = 0;
    state.flareActiveTimer = 0;
    state.gunCooldown = 0;
    state.missileCooldown = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.missilesFired = 0;
  }

  function resupply() {
    state.ammo = WEAPON_SPECS.maxAmmo;
    state.missiles = Math.min(WEAPON_SPECS.maxMissiles, state.missiles + 4);
    state.heat = 0;
    state.overheated = false;
  }

  function fireCannon(planeObj, flightState) {
    if (state.overheated || state.ammo <= 0 || state.gunCooldown > 0) return false;
    state.gunCooldown = WEAPON_SPECS.cannonCooldown;
    state.ammo -= 1;
    state.shotsFired += 1;
    state.heat = Math.min(1, state.heat + 0.042);
    if (state.heat >= 0.995) {
      state.overheated = true;
    }

    const side = state.gunSide === 0 ? -1 : 1;
    state.gunSide = 1 - state.gunSide;

    fwdVec.set(0, 0, -1).applyQuaternion(flightState.quaternion);
    const muzzle = planeObj.getGunMuzzleWorldPos(side);
    const spread = 0.008;
    const dir = fwdVec.clone();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    const vel = dir.clone().multiplyScalar(WEAPON_SPECS.cannonSpeed).add(flightState.velocity);
    const mesh = new THREE.Mesh(playerBoltGeo, playerBoltMat);
    mesh.position.copy(muzzle);
    mesh.lookAt(muzzle.clone().add(vel));
    group.add(mesh);

    playerTracers.push({ mesh, pos: muzzle.clone(), vel, life: 0, maxLife: 2.1, dmg: WEAPON_SPECS.cannonDmg });
    effects.spawnMuzzleFlash(muzzle, dir);
    effects.addTrauma(0.032);
    return true;
  }

  function fireMissile(planeObj, flightState, lockedEnemy) {
    if (state.missiles <= 0 || state.missileCooldown > 0) return { fired: false, locked: false };
    state.missiles -= 1;
    state.missilesFired += 1;
    state.missileCooldown = WEAPON_SPECS.missileCooldown;

    const side = state.missileSide === 0 ? -1 : 1;
    state.missileSide = 1 - state.missileSide;

    fwdVec.set(0, 0, -1).applyQuaternion(flightState.quaternion);
    const origin = planeObj.getMissilePylonWorldPos(side);
    const vel = fwdVec.clone().multiplyScalar(Math.max(70, flightState.airspeed + 45));
    const mesh = buildMissileMesh();
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(fwdVec));
    group.add(mesh);

    missiles.push({
      mesh,
      pos: origin.clone(),
      vel,
      target: lockedEnemy || null,
      life: 0,
      maxLife: 7.5,
      trailTimer: 0,
      dmg: WEAPON_SPECS.missileDmg,
    });
    effects.addTrauma(0.11);
    return { fired: true, locked: Boolean(lockedEnemy) };
  }

  function deployFlares(flightState) {
    if (state.flareCooldown > 0) return false;
    state.flareCooldown = WEAPON_SPECS.flareCooldown;
    state.flareActiveTimer = WEAPON_SPECS.flareDuration;

    fwdVec.set(0, 0, -1).applyQuaternion(flightState.quaternion);
    rightVec.set(1, 0, 0).applyQuaternion(flightState.quaternion);
    upVec.set(0, 1, 0).applyQuaternion(flightState.quaternion);

    for (let i = -1; i <= 1; i++) {
      const origin = flightState.position.clone().addScaledVector(fwdVec, -4.2).addScaledVector(upVec, -0.5);
      const vel = flightState.velocity
        .clone()
        .multiplyScalar(0.55)
        .addScaledVector(rightVec, i * 14)
        .addScaledVector(upVec, -8 - Math.abs(i) * 3);
      const mesh = new THREE.Mesh(flareGeo, flareMat);
      mesh.position.copy(origin);
      group.add(mesh);
      flares.push({ mesh, pos: origin, vel, life: 0, maxLife: 2.3, smokeTimer: 0 });
    }
    return true;
  }

  function fireEnemyTracer(origin, velocity, dmg = 7) {
    const mesh = new THREE.Mesh(enemyBoltGeo, enemyBoltMat);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(velocity));
    group.add(mesh);
    enemyTracers.push({ mesh, pos: origin.clone(), vel: velocity.clone(), life: 0, maxLife: 2.4, dmg });
  }

  function fireBossFlak(origin, targetPos, fuseTime = 1.65) {
    const vel = targetPos.clone().sub(origin).divideScalar(Math.max(0.5, fuseTime));
    const mesh = new THREE.Mesh(flakGeo, flakMat);
    mesh.position.copy(origin);
    group.add(mesh);
    flakShells.push({ mesh, pos: origin.clone(), vel, life: 0, maxLife: fuseTime, dmg: 16 });
  }

  function spawnStagedTracer(startPos, dir, isEnemy = false) {
    const mesh = new THREE.Mesh(isEnemy ? enemyBoltGeo : playerBoltGeo, isEnemy ? enemyBoltMat : playerBoltMat);
    mesh.position.copy(startPos);
    mesh.lookAt(startPos.clone().add(dir));
    mesh.scale.set(1.2, 1.2, 1.35);
    group.add(mesh);
    const list = isEnemy ? enemyTracers : playerTracers;
    list.push({ mesh, pos: startPos.clone(), vel: dir.clone().multiplyScalar(1), life: 0, maxLife: 99, dmg: 0 });
  }

  function spawnStagedMissile(pos, dir, trailCount = 12) {
    const d = dir.clone().normalize();
    const mesh = buildMissileMesh();
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(d));
    mesh.scale.setScalar(1.45);
    group.add(mesh);
    missiles.push({ mesh, pos: pos.clone(), vel: d.clone(), target: null, life: 0, maxLife: 99, trailTimer: 0, dmg: 0 });
    for (let i = 1; i <= trailCount; i++) {
      const tp = pos.clone().addScaledVector(d, -i * 3.8);
      tp.x += Math.sin(i * 1.3) * 0.45;
      tp.y += Math.cos(i * 1.1) * 0.35;
      effects.spawnMissileTrail(tp, 0.45 + i * 0.085);
    }
  }

  function testHitEnemy(segA, segB, enemy, padRadius = 0) {
    const r = enemy.radius + padRadius;
    const rSq = r * r;
    if (enemy.hitHalfLength > 1) {
      enemyFwd.set(0, 0, -1).applyQuaternion(enemy.quat);
      for (const frac of [-0.7, 0, 0.7]) {
        capsulePt.copy(enemy.pos).addScaledVector(enemyFwd, frac * enemy.hitHalfLength);
        if (distSqPointToSegment(capsulePt, segA, segB, closestPt) <= rSq) {
          return closestPt.clone();
        }
      }
      return null;
    }
    if (distSqPointToSegment(enemy.pos, segA, segB, closestPt) <= rSq) {
      return closestPt.clone();
    }
    return null;
  }

  function update(dt, flightState, livingEnemies, callbacks) {
    state.gunCooldown = Math.max(0, state.gunCooldown - dt);
    state.missileCooldown = Math.max(0, state.missileCooldown - dt);
    state.flareCooldown = Math.max(0, state.flareCooldown - dt);
    state.flareActiveTimer = Math.max(0, state.flareActiveTimer - dt);

    // Barrel cooling
    const coolRate = state.overheated ? 0.36 : 0.28;
    state.heat = Math.max(0, state.heat - coolRate * dt);
    if (state.overheated && state.heat <= 0.22) {
      state.overheated = false;
    }

    // 1. Player 20mm tracers
    for (let i = playerTracers.length - 1; i >= 0; i--) {
      const b = playerTracers[i];
      b.life += dt;
      prevPos.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);

      let hit = false;
      for (let j = 0; j < livingEnemies.length; j++) {
        const enemy = livingEnemies[j];
        const hitPt = testHitEnemy(prevPos, b.pos, enemy, 1.4);
        if (hitPt) {
          state.shotsHit += 1;
          effects.spawnHitSparks(hitPt, 6);
          if (callbacks && callbacks.onEnemyHit) {
            callbacks.onEnemyHit(enemy, b.dmg, hitPt, 'cannon');
          }
          hit = true;
          break;
        }
      }

      const ground = world.sampleTerrain(b.pos.x, b.pos.z);
      if (hit || b.life >= b.maxLife || b.pos.y <= ground.height) {
        group.remove(b.mesh);
        playerTracers.splice(i, 1);
      }
    }

    // 2. Surya-2 Homing Missiles (proportional-navigation steering)
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.life += dt;
      prevPos.copy(m.pos);

      const speed = Math.min(WEAPON_SPECS.missileSpeed, m.vel.length() + 145 * dt);
      currDir.copy(m.vel).normalize();

      if (m.target && m.target.alive && !m.target.dying) {
        const dist = m.pos.distanceTo(m.target.pos);
        const leadT = Math.min(1.1, dist / Math.max(60, speed));
        desiredDir
          .copy(m.target.pos)
          .addScaledVector(m.target.vel, leadT)
          .sub(m.pos)
          .normalize();
        const turnBlend = Math.min(1, dt * 4.8);
        currDir.lerp(desiredDir, turnBlend).normalize();
      }

      m.vel.copy(currDir).multiplyScalar(speed);
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      m.mesh.lookAt(m.pos.clone().add(currDir));

      m.trailTimer -= dt;
      if (m.trailTimer <= 0) {
        m.trailTimer = 0.028;
        effects.spawnMissileTrail(m.pos.clone().addScaledVector(currDir, -1.6), 0.78);
      }

      let exploded = false;
      for (let j = 0; j < livingEnemies.length; j++) {
        const enemy = livingEnemies[j];
        const hitPt = testHitEnemy(prevPos, m.pos, enemy, 4.2);
        if (hitPt) {
          effects.spawnExplosion(hitPt, 0.95, false);
          if (callbacks && callbacks.onEnemyHit) {
            callbacks.onEnemyHit(enemy, m.dmg, hitPt, 'missile');
          }
          exploded = true;
          break;
        }
      }

      const ground = world.sampleTerrain(m.pos.x, m.pos.z);
      if (exploded || m.life >= m.maxLife || m.pos.y <= ground.height) {
        if (!exploded && m.pos.y <= ground.height) {
          effects.spawnExplosion(m.pos, 0.7, false);
        }
        group.remove(m.mesh);
        missiles.splice(i, 1);
      }
    }

    // 3. Enemy crimson tracers
    for (let i = enemyTracers.length - 1; i >= 0; i--) {
      const b = enemyTracers[i];
      b.life += dt;
      prevPos.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);

      const d2 = distSqPointToSegment(flightState.position, prevPos, b.pos, closestPt);
      if (d2 <= 21 && !flightState.crashed) {
        effects.spawnHitSparks(closestPt, 5);
        if (callbacks && callbacks.onPlayerHit) {
          callbacks.onPlayerHit(b.dmg, prevPos.clone().sub(flightState.position), 'Raider gunfire');
        }
        group.remove(b.mesh);
        enemyTracers.splice(i, 1);
        continue;
      }

      const ground = world.sampleTerrain(b.pos.x, b.pos.z);
      if (b.life >= b.maxLife || b.pos.y <= ground.height) {
        group.remove(b.mesh);
        enemyTracers.splice(i, 1);
      }
    }

    // 4. Boss aerial flak shells
    for (let i = flakShells.length - 1; i >= 0; i--) {
      const f = flakShells[i];
      f.life += dt;
      f.pos.addScaledVector(f.vel, dt);
      f.mesh.position.copy(f.pos);

      const distPlayer = f.pos.distanceTo(flightState.position);
      if (f.life >= f.maxLife || distPlayer < 12) {
        effects.spawnFlakBurst(f.pos, 1.15);
        if (distPlayer < 26 && !flightState.crashed && callbacks && callbacks.onPlayerHit) {
          const splash = Math.round(f.dmg * (1 - distPlayer / 32));
          if (splash > 2) {
            callbacks.onPlayerHit(splash, f.pos.clone().sub(flightState.position), 'Naga Langit flak burst');
          }
        }
        group.remove(f.mesh);
        flakShells.splice(i, 1);
      }
    }

    // 5. Decoy flare canisters
    for (let i = flares.length - 1; i >= 0; i--) {
      const fl = flares[i];
      fl.life += dt;
      fl.vel.y -= 7.5 * dt;
      fl.pos.addScaledVector(fl.vel, dt);
      fl.mesh.position.copy(fl.pos);
      fl.smokeTimer -= dt;
      if (fl.smokeTimer <= 0) {
        fl.smokeTimer = 0.05;
        effects.spawnFlareSmoke(fl.pos);
      }
      if (fl.life >= fl.maxLife) {
        group.remove(fl.mesh);
        flares.splice(i, 1);
      }
    }
  }

  return {
    state,
    reset,
    resupply,
    fireCannon,
    fireMissile,
    deployFlares,
    fireEnemyTracer,
    fireBossFlak,
    spawnStagedTracer,
    spawnStagedMissile,
    update,
  };
}
