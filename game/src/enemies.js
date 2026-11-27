import * as THREE from '../vendor/three.min.js';

export const ENEMY_ARCHETYPES = {
  kestrel: {
    type: 'kestrel',
    name: 'Kestrel Scout',
    shortName: 'KESTREL',
    maxHp: 55,
    speed: 48,
    turnRate: 1.75,
    radius: 6.8,
    hitHalfLength: 0,
    points: 400,
    isBoss: false,
    isAce: false,
    fireInterval: 1.45,
    fireDmg: 6,
  },
  komodo: {
    type: 'komodo',
    name: 'Komodo Gunship',
    shortName: 'KOMODO',
    maxHp: 130,
    speed: 38,
    turnRate: 1.18,
    radius: 9.2,
    hitHalfLength: 0,
    points: 750,
    isBoss: false,
    isAce: false,
    fireInterval: 1.05,
    fireDmg: 9,
  },
  elang: {
    type: 'elang',
    name: 'Elang Merah',
    shortName: 'ELANG MERAH',
    maxHp: 215,
    speed: 57,
    turnRate: 2.25,
    radius: 7.4,
    hitHalfLength: 0,
    points: 1500,
    isBoss: true,
    isAce: true,
    fireInterval: 0.85,
    fireDmg: 9,
  },
  naga: {
    type: 'naga',
    name: 'Naga Langit',
    shortName: 'NAGA LANGIT',
    maxHp: 620,
    speed: 19,
    turnRate: 0.35,
    radius: 22,
    hitHalfLength: 34,
    points: 2500,
    isBoss: true,
    isAce: false,
    fireInterval: 2.2,
    fireDmg: 14,
  },
};

function makeRaiderMaterials() {
  return {
    charcoal: new THREE.MeshStandardMaterial({ color: '#262b33', roughness: 0.5, metalness: 0.38 }),
    slate: new THREE.MeshStandardMaterial({ color: '#3b4452', roughness: 0.48, metalness: 0.35 }),
    crimson: new THREE.MeshStandardMaterial({ color: '#cf242a', roughness: 0.38, metalness: 0.22 }),
    obsidian: new THREE.MeshStandardMaterial({ color: '#14171d', roughness: 0.45, metalness: 0.45 }),
    amber: new THREE.MeshStandardMaterial({ color: '#f5a524', roughness: 0.35, metalness: 0.3 }),
    canopy: new THREE.MeshBasicMaterial({ color: '#ffbb38' }),
    furnace: new THREE.MeshBasicMaterial({ color: '#ff6f1c' }),
    prop: new THREE.MeshBasicMaterial({ color: '#dce4ec', transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
  };
}

function buildKestrelMesh(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 5.2), mats.charcoal.clone());
  g.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.8, 8), mats.crimson.clone());
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.45;
  g.add(nose);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.48, 1.55), mats.canopy);
  canopy.position.set(0, 0.52, -0.55);
  g.add(canopy);

  // Swept crimson-tipped wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.22, 1.55), mats.slate.clone());
  wing.position.set(0, 0.05, -0.4);
  g.add(wing);

  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.58), mats.crimson.clone());
    tip.position.set(s * 4.35, 0.06, -0.4);
    g.add(tip);

    // Twin tail booms
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 4.2), mats.charcoal.clone());
    boom.position.set(s * 1.45, 0.1, 2.5);
    g.add(boom);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 1.0), mats.crimson.clone());
    fin.position.set(s * 1.45, 0.72, 4.25);
    g.add(fin);
  }
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.8), mats.amber.clone());
  hTail.position.set(0, 0.65, 4.35);
  g.add(hTail);

  const prop = new THREE.Mesh(new THREE.RingGeometry(0.2, 1.15, 16), mats.prop);
  prop.position.z = -4.45;
  g.add(prop);

  return { group: g, props: [prop], turrets: [], hitMat: body.material };
}

function buildKomodoMesh(mats) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.65, 8.8), mats.charcoal.clone());
  g.add(hull);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.35, 2.2), mats.slate.clone());
  nose.position.set(0, -0.1, -5.1);
  g.add(nose);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.65, 2.2), mats.canopy);
  canopy.position.set(0, 0.92, -2.5);
  g.add(canopy);

  // Dorsal gun blister
  const blister = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), mats.crimson.clone());
  blister.position.set(0, 1.05, 0.8);
  g.add(blister);

  // Armored wings + twin engine nacelles
  const wing = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.36, 2.5), mats.slate.clone());
  wing.position.set(0, 0.25, -0.6);
  g.add(wing);

  const props = [];
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.39, 2.55), mats.amber.clone());
    stripe.position.set(s * 6.1, 0.26, -0.6);
    g.add(stripe);

    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 3.3, 10), mats.obsidian.clone());
    nac.rotation.x = Math.PI / 2;
    nac.position.set(s * 3.35, 0.02, -1.75);
    g.add(nac);

    const prop = new THREE.Mesh(new THREE.RingGeometry(0.25, 1.38, 16), mats.prop);
    prop.position.set(s * 3.35, 0.02, -3.5);
    g.add(prop);
    props.push(prop);
  }

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.6, 1.9), mats.crimson.clone());
  tailFin.position.set(0, 1.55, 4.1);
  g.add(tailFin);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 1.25), mats.charcoal.clone());
  hStab.position.set(0, 0.55, 4.2);
  g.add(hStab);

  return { group: g, props, turrets: [], hitMat: hull.material };
}

function buildElangMesh(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.96, 6.4), mats.obsidian.clone());
  g.add(body);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.3, 6.2), mats.crimson.clone());
  stripe.position.y = 0.2;
  g.add(stripe);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.4, 10), mats.amber.clone());
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.35;
  g.add(nose);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.52, 1.85), mats.canopy);
  canopy.position.set(0, 0.6, -0.4);
  g.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.24, 1.85), mats.crimson.clone());
  wing.position.set(0, 0.02, -0.35);
  g.add(wing);

  for (const s of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 1.9), mats.obsidian.clone());
    band.position.set(s * 2.8, 0.03, -0.35);
    g.add(band);

    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff3030' }));
    glow.position.set(s * 5.75, 0.05, 0.2);
    g.add(glow);
  }

  const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.25, 1.65), mats.crimson.clone());
  vFin.position.set(0, 1.22, 2.95);
  g.add(vFin);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.95), mats.obsidian.clone());
  hStab.position.set(0, 0.25, 3.0);
  g.add(hStab);

  const prop = new THREE.Mesh(new THREE.RingGeometry(0.22, 1.32, 18), mats.prop);
  prop.position.z = -5.6;
  g.add(prop);

  return { group: g, props: [prop], turrets: [], hitMat: wing.material };
}

function buildNagaAirshipMesh(mats) {
  const g = new THREE.Group();

  // Colossal 76-meter ribbed armored dirigible hull
  const hullMat = mats.slate.clone();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), hullMat);
  hull.scale.set(13.5, 12.2, 38.0);
  g.add(hull);

  // Armored dorsal spine and dark steel ribs
  const spine = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 62), mats.obsidian.clone());
  spine.position.y = 11.4;
  g.add(spine);

  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(12.6 - Math.abs(i) * 1.4, 0.65, 8, 22), mats.charcoal.clone());
    rib.position.z = i * 11.5;
    g.add(rib);
  }

  // Crimson war-band across hull & nose cap
  const warBand = new THREE.Mesh(new THREE.CylinderGeometry(12.8, 12.8, 7.5, 18, 1, true), mats.crimson.clone());
  warBand.rotation.x = Math.PI / 2;
  warBand.position.z = -12;
  g.add(warBand);

  const noseRam = new THREE.Mesh(new THREE.ConeGeometry(5.5, 9.5, 10), mats.amber.clone());
  noseRam.rotation.x = -Math.PI / 2;
  noseRam.position.z = -40.5;
  g.add(noseRam);

  // Four huge crimson tail stabilizer fins
  for (const ang of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const finWrap = new THREE.Group();
    finWrap.rotation.z = ang;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 13.5, 14.5), mats.crimson.clone());
    fin.position.set(0, 12.2, 27.5);
    finWrap.add(fin);
    g.add(finWrap);
  }

  // Underslung command gondola + glowing furnace cores
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(6.8, 5.2, 24), mats.obsidian.clone());
  gondola.position.set(0, -13.2, -3.5);
  g.add(gondola);

  const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.5, 3.2), mats.canopy);
  bridgeWin.position.set(0, -12.6, -15.2);
  g.add(bridgeWin);

  for (const fz of [-8, 0, 8]) {
    const furnace = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 4.4), mats.furnace);
    furnace.position.set(0, -14.2, fz);
    g.add(furnace);
  }

  // Four spinning lift/drive engine pods
  const props = [];
  for (const s of [-1, 1]) {
    for (const pz of [-10, 12]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 6.2, 10), mats.charcoal.clone());
      pod.rotation.x = Math.PI / 2;
      pod.position.set(s * 14.8, -4.2, pz);
      g.add(pod);

      const prop = new THREE.Mesh(new THREE.RingGeometry(0.5, 3.2, 18), mats.prop);
      prop.position.set(s * 14.8, -4.2, pz - 3.3);
      g.add(prop);
      props.push(prop);
    }
  }

  // Two rotating dorsal flak turrets
  const turrets = [];
  for (const tz of [-14, 12]) {
    const turret = new THREE.Group();
    turret.position.set(0, 13.2, tz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 10, 8), mats.crimson.clone());
    turret.add(dome);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 6.2, 8), mats.obsidian.clone());
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.5, -3.2);
    turret.add(barrel);
    g.add(turret);
    turrets.push(turret);
  }

  return { group: g, props, turrets, hitMat: hullMat };
}

/**
 * Create the procedural 3D enemy aircraft & boss manager plus autonomous squadron AI.
 */
export function createEnemyManager(scene, world, effects) {
  const root = new THREE.Group();
  scene.add(root);

  const mats = makeRaiderMaterials();
  const active = [];
  let nextId = 1;

  const toTarget = new THREE.Vector3();
  const desiredDir = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const lookMat = new THREE.Matrix4();
  const targetQuat = new THREE.Quaternion();
  const bankQuat = new THREE.Quaternion();
  const upWorld = new THREE.Vector3(0, 1, 0);

  function spawnEnemy(type, opts = {}) {
    const spec = ENEMY_ARCHETYPES[type] || ENEMY_ARCHETYPES.kestrel;
    let built;
    if (type === 'komodo') built = buildKomodoMesh(mats);
    else if (type === 'elang') built = buildElangMesh(mats);
    else if (type === 'naga') built = buildNagaAirshipMesh(mats);
    else built = buildKestrelMesh(mats);

    const pos = new THREE.Vector3(opts.x ?? 0, opts.y ?? 140, opts.z ?? 0);
    const hdgRad = ((opts.headingDeg ?? 0) * Math.PI) / 180;
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(((opts.pitchDeg ?? 0) * Math.PI) / 180, -hdgRad, ((opts.rollDeg ?? 0) * Math.PI) / 180, 'YXZ')
    );
    const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).multiplyScalar(spec.speed);

    built.group.position.copy(pos);
    built.group.quaternion.copy(quat);
    root.add(built.group);

    const enemy = {
      id: nextId++,
      type: spec.type,
      name: spec.name,
      shortName: spec.shortName,
      isBoss: spec.isBoss,
      isAce: spec.isAce,
      points: spec.points,
      mesh: built.group,
      props: built.props,
      turrets: built.turrets,
      hitMat: built.hitMat,
      baseEmissive: built.hitMat.emissive ? built.hitMat.emissive.clone() : new THREE.Color('#000000'),
      pos,
      vel,
      quat,
      speed: spec.speed,
      turnRate: spec.turnRate,
      hp: opts.hp ?? spec.maxHp,
      maxHp: spec.maxHp,
      radius: spec.radius,
      hitHalfLength: spec.hitHalfLength,
      fireInterval: spec.fireInterval,
      fireDmg: spec.fireDmg,
      aiState: opts.aiState || 'patrol',
      aiTimer: 2 + Math.random() * 2,
      fireCooldown: 1.0 + Math.random() * 1.2,
      evadeTimer: 0,
      smokeTimer: 0,
      hitFlash: 0,
      dying: false,
      dyingTimer: 0,
      dyingRollDir: Math.random() > 0.5 ? 1 : -1,
      bossPhase: 1,
      orbitCenter: opts.orbitCenter ? opts.orbitCenter.clone() : new THREE.Vector3(pos.x, pos.y, pos.z),
      orbitRadius: opts.orbitRadius ?? (type === 'naga' ? 320 : 210),
      orbitAngle: opts.orbitAngle ?? Math.random() * Math.PI * 2,
      orbitAlt: opts.orbitAlt ?? pos.y,
      alive: true,
    };

    active.push(enemy);
    return enemy;
  }

  function damageEnemy(enemy, amount) {
    if (!enemy || !enemy.alive || enemy.dying) {
      return { hit: false, killed: false, bossPhaseChanged: false };
    }
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlash = 0.16;

    let bossPhaseChanged = false;
    let newPhase = enemy.bossPhase;
    if (enemy.type === 'naga') {
      const ratio = enemy.hp / enemy.maxHp;
      if (ratio <= 0.35 && enemy.bossPhase < 3) {
        enemy.bossPhase = 3;
        bossPhaseChanged = true;
        newPhase = 3;
        effects.spawnExplosion(enemy.pos.clone().add(new THREE.Vector3(0, -10, 6)), 1.35, false);
      } else if (ratio <= 0.7 && enemy.bossPhase < 2) {
        enemy.bossPhase = 2;
        bossPhaseChanged = true;
        newPhase = 2;
        effects.spawnExplosion(enemy.pos.clone().add(new THREE.Vector3(0, -10, -8)), 1.15, false);
      }
    } else if (enemy.hp > 0 && Math.random() < 0.32) {
      // Damaged fighters execute evasive break turns
      enemy.aiState = 'evade';
      enemy.evadeTimer = 1.6 + Math.random() * 1.1;
    }

    if (enemy.hp <= 0) {
      if (enemy.type === 'naga') {
        enemy.alive = false;
        effects.spawnExplosion(enemy.pos, 2.2, true);
        root.remove(enemy.mesh);
      } else {
        enemy.dying = true;
        enemy.dyingTimer = 1.65;
        effects.spawnExplosion(enemy.pos, 0.75, false);
      }
      return {
        hit: true,
        killed: true,
        bossPhaseChanged,
        newPhase,
        points: enemy.points,
        isBoss: enemy.isBoss,
        isAce: enemy.isAce,
        type: enemy.type,
        name: enemy.name,
      };
    }

    return { hit: true, killed: false, bossPhaseChanged, newPhase };
  }

  function steerToward(e, targetPoint, dt, desiredSpeed) {
    toTarget.subVectors(targetPoint, e.pos);
    const dist = toTarget.length();
    if (dist > 0.01) desiredDir.copy(toTarget).divideScalar(dist);
    else desiredDir.set(0, 0, -1);

    // Terrain avoidance floor
    const g = world.sampleTerrain(e.pos.x + desiredDir.x * 80, e.pos.z + desiredDir.z * 80);
    const minSafeY = Math.max(36, g.height + 34);
    if (e.pos.y < minSafeY) {
      desiredDir.y = Math.max(desiredDir.y, 0.42);
      desiredDir.normalize();
    }

    lookMat.lookAt(new THREE.Vector3(0, 0, 0), desiredDir, upWorld);
    targetQuat.setFromRotationMatrix(lookMat);

    // Smooth bank into turns for authentic dogfight silhouettes
    fwd.set(0, 0, -1).applyQuaternion(e.quat);
    right.set(1, 0, 0).applyQuaternion(e.quat);
    const turnSide = desiredDir.dot(right);
    const bankAngle = e.type === 'naga' ? -turnSide * 0.14 : Math.max(-1.05, Math.min(1.05, -turnSide * 1.45));
    bankQuat.setFromAxisAngle(new THREE.Vector3(0, 0, -1), bankAngle);
    targetQuat.multiply(bankQuat);

    e.quat.slerp(targetQuat, Math.min(1, dt * e.turnRate));
    fwd.set(0, 0, -1).applyQuaternion(e.quat);
    e.vel.copy(fwd).multiplyScalar(desiredSpeed);
    e.pos.addScaledVector(e.vel, dt);
  }

  function update(dt, elapsed, playerState, flareActive, fireCallbacks) {
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      if (!e.alive) {
        active.splice(i, 1);
        continue;
      }

      // Spin propellers
      for (const p of e.props) {
        p.rotation.z += dt * 36;
      }

      // Hit flash decay
      if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        if (e.hitMat.emissive) {
          e.hitMat.emissive.set(e.hitFlash > 0 ? '#ff9944' : '#000000');
          e.hitMat.emissiveIntensity = e.hitFlash > 0 ? 0.9 : 0;
        }
      }

      // Corkscrew death spiral for fatally damaged fighters
      if (e.dying) {
        e.dyingTimer -= dt;
        e.vel.y -= 14 * dt;
        e.pos.addScaledVector(e.vel, dt);
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 * dt, 0.7 * dt * e.dyingRollDir, 4.4 * dt * e.dyingRollDir));
        e.quat.multiply(spin).normalize();
        e.mesh.position.copy(e.pos);
        e.mesh.quaternion.copy(e.quat);

        e.smokeTimer -= dt;
        if (e.smokeTimer <= 0) {
          e.smokeTimer = 0.07;
          effects.spawnOilSmoke(e.pos, 1.35);
        }

        const g = world.sampleTerrain(e.pos.x, e.pos.z);
        if (e.dyingTimer <= 0 || e.pos.y <= g.height + 4) {
          effects.spawnExplosion(e.pos, e.isAce ? 1.65 : 1.25, false);
          root.remove(e.mesh);
          e.alive = false;
          active.splice(i, 1);
        }
        continue;
      }

      // Damaged smoke trail below 55% HP
      if (e.hp < e.maxHp * 0.55) {
        e.smokeTimer -= dt;
        if (e.smokeTimer <= 0) {
          e.smokeTimer = e.type === 'naga' ? 0.14 : 0.12;
          const smokePos = e.type === 'naga'
            ? e.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, -10, (Math.random() - 0.5) * 20))
            : e.pos.clone();
          effects.spawnOilSmoke(smokePos, e.type === 'naga' ? 1.85 : 1.0);
        }
      }

      const distToPlayer = e.pos.distanceTo(playerState.position);

      if (e.type === 'naga') {
        // Stately high-altitude command airship circuit
        e.orbitAngle += dt * (e.speed / Math.max(120, e.orbitRadius));
        const goal = new THREE.Vector3(
          e.orbitCenter.x + Math.cos(e.orbitAngle) * e.orbitRadius,
          e.orbitAlt + Math.sin(elapsed * 0.4) * 10,
          e.orbitCenter.z + Math.sin(e.orbitAngle) * e.orbitRadius
        );
        steerToward(e, goal, dt, e.speed);

        for (const t of e.turrets) {
          t.lookAt(playerState.position);
        }

        e.fireCooldown -= dt;
        const rateMul = e.bossPhase === 3 ? 0.62 : e.bossPhase === 2 ? 0.78 : 1.0;
        if (e.fireCooldown <= 0 && distToPlayer < 950 && !playerState.crashed) {
          e.fireCooldown = e.fireInterval * rateMul;
          if (!flareActive && fireCallbacks) {
            const leadPos = playerState.position.clone().addScaledVector(playerState.velocity, 1.35);
            leadPos.x += (Math.random() - 0.5) * 22;
            leadPos.y += (Math.random() - 0.5) * 14;
            leadPos.z += (Math.random() - 0.5) * 22;
            const muzzle = e.pos.clone().add(new THREE.Vector3(0, 14, 0));
            fireCallbacks.fireBossFlak(muzzle, leadPos, 1.45);
            if (distToPlayer < 560) {
              const tDir = leadPos.clone().sub(muzzle).normalize();
              fireCallbacks.fireEnemyTracer(muzzle, tDir.multiplyScalar(175), 8);
            }
          }
        }
      } else {
        // Fighter multi-state AI: patrol, intercept, pursuit, evade
        if (flareActive && distToPlayer < 460 && e.aiState === 'pursuit') {
          e.aiState = 'evade';
          e.evadeTimer = 2.0;
        }

        if (e.aiState === 'evade') {
          e.evadeTimer -= dt;
          const away = e.pos.clone().sub(playerState.position).normalize();
          const evadePt = e.pos.clone().addScaledVector(away, 260).add(new THREE.Vector3(0, 75, 0));
          steerToward(e, evadePt, dt, e.speed * 1.12);
          if (e.evadeTimer <= 0) e.aiState = 'intercept';
        } else if (distToPlayer < 105) {
          e.aiState = 'evade';
          e.evadeTimer = 1.9;
        } else if (distToPlayer < 680) {
          e.aiState = 'pursuit';
          const leadTime = Math.min(1.1, distToPlayer / 170);
          const aimPt = playerState.position.clone().addScaledVector(playerState.velocity, leadTime);
          aimPt.y = Math.max(aimPt.y, 48);
          steerToward(e, aimPt, dt, e.speed);

          e.fireCooldown -= dt;
          fwd.set(0, 0, -1).applyQuaternion(e.quat);
          toTarget.subVectors(aimPt, e.pos).normalize();
          const coneDot = fwd.dot(toTarget);

          if (e.fireCooldown <= 0 && distToPlayer < 520 && coneDot > 0.86 && !flareActive && !playerState.crashed) {
            e.fireCooldown = e.fireInterval * (0.85 + Math.random() * 0.35);
            if (fireCallbacks) {
              const muzzle = e.pos.clone().addScaledVector(fwd, 5.2);
              const shotDir = toTarget.clone();
              shotDir.x += (Math.random() - 0.5) * 0.06;
              shotDir.y += (Math.random() - 0.5) * 0.05;
              shotDir.z += (Math.random() - 0.5) * 0.06;
              shotDir.normalize();
              fireCallbacks.fireEnemyTracer(muzzle, shotDir.multiplyScalar(168), e.fireDmg);
            }
          }
        } else if (distToPlayer < 1350) {
          e.aiState = 'intercept';
          steerToward(e, playerState.position, dt, e.speed * 1.06);
        } else {
          e.aiState = 'patrol';
          e.orbitAngle += dt * (e.speed / Math.max(120, e.orbitRadius));
          const orbitPt = new THREE.Vector3(
            e.orbitCenter.x + Math.cos(e.orbitAngle) * e.orbitRadius,
            e.orbitAlt,
            e.orbitCenter.z + Math.sin(e.orbitAngle) * e.orbitRadius
          );
          steerToward(e, orbitPt, dt, e.speed * 0.9);
        }
      }

      e.mesh.position.copy(e.pos);
      e.mesh.quaternion.copy(e.quat);
    }
  }

  function clear() {
    while (active.length > 0) {
      const e = active.pop();
      root.remove(e.mesh);
    }
  }

  function getEnemies() {
    return active.filter((e) => e.alive && !e.dying);
  }

  function getActiveBoss() {
    return active.find((e) => e.alive && !e.dying && e.isBoss) || null;
  }

  return {
    spawnEnemy,
    damageEnemy,
    update,
    clear,
    getEnemies,
    getActiveBoss,
    getAllActive: () => active,
  };
}
