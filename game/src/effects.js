import * as THREE from '../vendor/three.min.js';

/**
 * Pooled 3D combat visual effects engine for Merpati Run: Storm Interceptor.
 * Handles multi-layered mid-air explosions, shockwave rings, smoke columns,
 * tumbling debris, muzzle flashes, missile contrails, flak bursts, sparks,
 * oil smoke, and camera trauma shake without runtime allocation stutter.
 */
export function createEffectsEngine(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const unitSphere = new THREE.SphereGeometry(1, 10, 8);
  const shockGeo = new THREE.TorusGeometry(1, 0.11, 8, 28);
  const shardGeo = new THREE.BoxGeometry(1.1, 0.28, 0.55);
  const flashGeo = new THREE.ConeGeometry(0.42, 2.2, 6);
  flashGeo.rotateX(-Math.PI / 2);
  const sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 1.8);

  function makePool(count, geo, matFactory) {
    const items = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, matFactory(i));
      mesh.visible = false;
      group.add(mesh);
      items.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 1,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        startScale: 1,
        endScale: 2,
        gravity: 0,
        kind: 'generic',
      });
    }
    return { items, cursor: 0 };
  }

  function acquire(pool) {
    for (let i = 0; i < pool.items.length; i++) {
      const idx = (pool.cursor + i) % pool.items.length;
      if (!pool.items[idx].active) {
        pool.cursor = (idx + 1) % pool.items.length;
        return pool.items[idx];
      }
    }
    const slot = pool.items[pool.cursor % pool.items.length];
    pool.cursor = (pool.cursor + 1) % pool.items.length;
    return slot;
  }

  const fireballs = makePool(30, unitSphere, () => new THREE.MeshBasicMaterial({
    color: '#fff6c8',
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  }));

  const shockwaves = makePool(14, shockGeo, () => new THREE.MeshBasicMaterial({
    color: '#ffae42',
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));

  const smokePuffs = makePool(96, unitSphere, () => new THREE.MeshStandardMaterial({
    color: '#2c2928',
    emissive: '#1e1612',
    emissiveIntensity: 0.35,
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  }));

  const debrisShards = makePool(64, shardGeo, () => new THREE.MeshBasicMaterial({
    color: '#ff7728',
    transparent: true,
    opacity: 1,
  }));

  const muzzleFlashes = makePool(10, flashGeo, () => new THREE.MeshBasicMaterial({
    color: '#ffdf78',
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  }));

  const hitSparks = makePool(48, sparkGeo, () => new THREE.MeshBasicMaterial({
    color: '#fff2a6',
    transparent: true,
    opacity: 1,
    depthWrite: false,
  }));

  const pendingChains = [];
  let trauma = 0;

  const colWhite = new THREE.Color('#fff9d6');
  const colOrange = new THREE.Color('#ff7b1c');
  const colCrimson = new THREE.Color('#8f180e');
  const tmpColor = new THREE.Color();

  function addTrauma(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  function spawnFireball(pos, startR, endR, duration, velY = 2.5) {
    const f = acquire(fireballs);
    f.active = true;
    f.life = 0;
    f.maxLife = duration;
    f.startScale = startR;
    f.endScale = endR;
    f.vel.set((Math.random() - 0.5) * 4, velY, (Math.random() - 0.5) * 4);
    f.mesh.position.copy(pos);
    f.mesh.scale.setScalar(startR);
    f.mesh.material.color.copy(colWhite);
    f.mesh.material.opacity = 0.98;
    f.mesh.visible = true;
  }

  function spawnShockwave(pos, startR, endR, duration) {
    const s = acquire(shockwaves);
    s.active = true;
    s.life = 0;
    s.maxLife = duration;
    s.startScale = startR;
    s.endScale = endR;
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(Math.random() * 0.9, Math.random() * Math.PI, Math.random() * 0.9);
    s.mesh.scale.setScalar(startR);
    s.mesh.material.opacity = 0.92;
    s.mesh.visible = true;
  }

  function spawnSmokePuff(pos, opts) {
    const p = acquire(smokePuffs);
    p.active = true;
    p.life = 0;
    p.maxLife = opts.duration || 2.4;
    p.startScale = opts.startScale || 1.6;
    p.endScale = opts.endScale || 5.4;
    p.vel.copy(opts.vel || new THREE.Vector3(0, 3, 0));
    p.kind = opts.kind || 'smoke';
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(p.startScale);
    p.mesh.material.color.set(opts.color || '#2c2a29');
    p.mesh.material.emissive.set(opts.emissive || '#18100c');
    p.mesh.material.emissiveIntensity = opts.emissiveIntensity ?? 0.3;
    p.mesh.material.opacity = opts.opacity ?? 0.72;
    p.mesh.visible = true;
  }

  /**
   * Trigger a coordinated multi-stage aerial explosion (core flash, fireball,
   * shockwave ring, billowing dark smoke clouds, tumbling glowing wreckage).
   */
  function spawnExplosion(pos, scale = 1.0, isBoss = false) {
    const p = pos.clone();
    spawnFireball(p, 2.2 * scale, 13.5 * scale, 0.72, 3.5);
    spawnFireball(
      p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3 * scale, 1.5 * scale, (Math.random() - 0.5) * 3 * scale)),
      1.6 * scale,
      10.5 * scale,
      0.92,
      5.0
    );
    spawnShockwave(p, 2.4 * scale, 22 * scale, 0.58);

    const smokeCount = isBoss ? 12 : 7;
    for (let i = 0; i < smokeCount; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 8 * scale,
        (Math.random() - 0.3) * 6 * scale,
        (Math.random() - 0.5) * 8 * scale
      );
      spawnSmokePuff(p.clone().add(offset), {
        startScale: (2.2 + Math.random() * 1.8) * scale,
        endScale: (7.5 + Math.random() * 4.5) * scale,
        duration: 2.4 + Math.random() * 1.8,
        vel: new THREE.Vector3((Math.random() - 0.5) * 7, 4 + Math.random() * 5, (Math.random() - 0.5) * 7),
        color: i % 3 === 0 ? '#4d2b1c' : '#252322',
        emissive: i % 3 === 0 ? '#7a2c0e' : '#120f0e',
        emissiveIntensity: i % 3 === 0 ? 0.65 : 0.2,
        opacity: 0.78,
      });
    }

    const shardCount = isBoss ? 18 : 10;
    for (let i = 0; i < shardCount; i++) {
      const d = acquire(debrisShards);
      d.active = true;
      d.life = 0;
      d.maxLife = 1.5 + Math.random() * 1.2;
      d.gravity = 16;
      d.mesh.position.copy(p);
      d.mesh.scale.setScalar((0.7 + Math.random() * 0.9) * Math.min(1.6, scale));
      d.mesh.material.color.set(i % 2 === 0 ? '#ff9138' : '#3a3e44');
      d.mesh.material.opacity = 1;
      d.vel.set(
        (Math.random() - 0.5) * 42 * scale,
        (Math.random() - 0.15) * 32 * scale,
        (Math.random() - 0.5) * 42 * scale
      );
      d.rotVel.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      d.mesh.visible = true;
    }

    addTrauma(isBoss ? 0.85 : 0.36 * Math.min(1.5, scale));

    if (isBoss) {
      for (let c = 1; c <= 4; c++) {
        pendingChains.push({
          delay: c * 0.34,
          pos: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 36, (Math.random() - 0.3) * 14, (Math.random() - 0.5) * 36)),
          scale: c === 4 ? 2.4 : 1.45,
        });
      }
    }
  }

  /**
   * Stage a frozen mid-bloom multi-layered explosion for deterministic screenshots.
   */
  function spawnStagedExplosion(pos, scale = 1.2) {
    const p = pos.clone();
    // Bright incandescent white-gold inner core
    const core = acquire(fireballs);
    core.active = true;
    core.life = 0.06;
    core.maxLife = 1.2;
    core.startScale = 4.6 * scale;
    core.endScale = 9 * scale;
    core.vel.set(0, 0, 0);
    core.mesh.position.copy(p);
    core.mesh.scale.setScalar(4.8 * scale);
    core.mesh.material.color.set('#fffbe0');
    core.mesh.material.opacity = 0.98;
    core.mesh.visible = true;

    // Sculpted layered fiery orange-crimson fireball lobes
    const lobeOffsets = [
      [3.4, 1.8, -1.2, 5.2, '#ffae2b', 0.92],
      [-3.2, -1.4, 1.8, 4.9, '#ff7318', 0.88],
      [1.5, -2.8, 2.2, 4.4, '#e63912', 0.84],
      [-2.1, 3.2, -1.6, 4.1, '#ffd04d', 0.9],
      [4.8, -0.6, 1.4, 3.4, '#ff5514', 0.8],
      [-4.2, 1.6, 0.8, 3.6, '#ff8e24', 0.82],
    ];
    for (const [ox, oy, oz, rad, hex, op] of lobeOffsets) {
      const f = acquire(fireballs);
      f.active = true;
      f.life = 0.3;
      f.maxLife = 1.2;
      f.startScale = rad * scale;
      f.endScale = rad * 1.15 * scale;
      f.vel.set(0, 0, 0);
      f.mesh.position.set(p.x + ox * scale, p.y + oy * scale, p.z + oz * scale);
      f.mesh.scale.setScalar(rad * scale);
      f.mesh.material.color.set(hex);
      f.mesh.material.opacity = op;
      f.mesh.visible = true;
    }

    // Crisp fiery shockwave ring angled cleanly toward viewer
    const ring = acquire(shockwaves);
    ring.active = true;
    ring.life = 0.2;
    ring.maxLife = 1.0;
    ring.startScale = 11.2 * scale;
    ring.endScale = 18 * scale;
    ring.mesh.position.copy(p);
    ring.mesh.rotation.set(0.45, 0.35, 0.15);
    ring.mesh.scale.set(11.2 * scale, 11.2 * scale, 5.5 * scale);
    ring.mesh.material.color.set('#ffd269');
    ring.mesh.material.opacity = 0.72;
    ring.mesh.visible = true;

    // Wispy rising charcoal-ember smoke trail (kept sleek so it never blocks the sky/HUD)
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      spawnSmokePuff(
        new THREE.Vector3(
          p.x - t * 14 * scale + Math.sin(i * 2.1) * 2.8 * scale,
          p.y + 3.2 * scale + t * 15 * scale,
          p.z + t * 8 * scale + Math.cos(i * 1.7) * 2.8 * scale
        ),
        {
          startScale: (2.8 + t * 3.2) * scale,
          endScale: (3.2 + t * 3.6) * scale,
          duration: 3.5,
          vel: new THREE.Vector3(0, 0, 0),
          color: i < 3 ? '#5a2d1a' : '#2a282b',
          emissive: i < 3 ? '#b84214' : '#181416',
          emissiveIntensity: i < 3 ? 0.75 : 0.2,
          opacity: 0.68 - t * 0.32,
        }
      );
    }

    // Flaming tumbling wreckage shards radiating outward
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.3;
      const dist = (7.5 + (i % 3) * 4.4) * scale;
      const d = acquire(debrisShards);
      d.active = true;
      d.life = 0.2;
      d.maxLife = 2.0;
      d.gravity = 0;
      d.vel.set(0, 0, 0);
      d.rotVel.set(0, 0, 0);
      d.mesh.position.set(
        p.x + Math.cos(ang) * dist,
        p.y + Math.sin(ang * 1.3) * dist * 0.68,
        p.z + Math.sin(ang) * dist * 0.65
      );
      d.mesh.rotation.set(i * 0.7, i * 1.1, i * 0.5);
      d.mesh.scale.setScalar((0.85 + (i % 3) * 0.3) * scale);
      d.mesh.material.color.set(i % 2 === 0 ? '#ffc456' : '#ff5a1f');
      d.mesh.material.opacity = 1;
      d.mesh.visible = true;
    }
  }

  function spawnMuzzleFlash(worldPos, forwardVec) {
    const m = acquire(muzzleFlashes);
    m.active = true;
    m.life = 0;
    m.maxLife = 0.065;
    m.mesh.position.copy(worldPos);
    m.mesh.lookAt(worldPos.clone().add(forwardVec));
    m.mesh.scale.setScalar(0.85 + Math.random() * 0.35);
    m.mesh.material.opacity = 0.94;
    m.mesh.visible = true;
  }

  function spawnMissileTrail(worldPos, radius = 0.9) {
    spawnSmokePuff(worldPos, {
      startScale: radius,
      endScale: radius * 3.1,
      duration: 1.5,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8, (Math.random() - 0.5) * 1.2),
      color: '#f7f4ee',
      emissive: '#e8d8be',
      emissiveIntensity: 0.45,
      opacity: 0.86,
      kind: 'contrail',
    });
  }

  function spawnOilSmoke(worldPos, intensity = 1) {
    spawnSmokePuff(worldPos, {
      startScale: 1.3 * intensity,
      endScale: 4.4 * intensity,
      duration: 1.9,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, 2.2, (Math.random() - 0.5) * 2.5),
      color: '#201e1f',
      emissive: intensity > 1.15 ? '#66240c' : '#111010',
      emissiveIntensity: intensity > 1.15 ? 0.55 : 0.12,
      opacity: 0.78,
    });
  }

  function spawnFlakBurst(worldPos, scale = 1.0) {
    spawnFireball(worldPos, 1.4 * scale, 6.2 * scale, 0.28, 0.6);
    for (let i = 0; i < 4; i++) {
      spawnSmokePuff(
        worldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6 * scale, (Math.random() - 0.5) * 5 * scale, (Math.random() - 0.5) * 6 * scale)),
        {
          startScale: 3.2 * scale,
          endScale: 7.4 * scale,
          duration: 2.8,
          vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.2, (Math.random() - 0.5) * 2),
          color: '#1f1d22',
          emissive: '#4c1e14',
          emissiveIntensity: 0.35,
          opacity: 0.82,
        }
      );
    }
    addTrauma(0.18);
  }

  function spawnHitSparks(worldPos, count = 7) {
    for (let i = 0; i < count; i++) {
      const s = acquire(hitSparks);
      s.active = true;
      s.life = 0;
      s.maxLife = 0.24 + Math.random() * 0.16;
      s.mesh.position.copy(worldPos);
      s.vel.set((Math.random() - 0.5) * 55, (Math.random() - 0.5) * 45, (Math.random() - 0.5) * 55);
      s.mesh.lookAt(worldPos.clone().add(s.vel));
      s.mesh.material.color.set(i % 2 === 0 ? '#fff6bd' : '#ff9830');
      s.mesh.material.opacity = 1;
      s.mesh.visible = true;
    }
  }

  function spawnFlareSmoke(worldPos) {
    spawnSmokePuff(worldPos, {
      startScale: 0.65,
      endScale: 2.2,
      duration: 0.85,
      vel: new THREE.Vector3(0, 0.5, 0),
      color: '#fff6de',
      emissive: '#ffcf6b',
      emissiveIntensity: 0.65,
      opacity: 0.85,
    });
  }

  function getShakeOffset(elapsed) {
    const mag = trauma * trauma;
    if (mag < 0.001) return { x: 0, y: 0, z: 0, roll: 0 };
    return {
      x: Math.sin(elapsed * 57.3) * 0.55 * mag,
      y: Math.cos(elapsed * 64.1) * 0.45 * mag,
      z: Math.sin(elapsed * 49.7) * 0.35 * mag,
      roll: Math.cos(elapsed * 43.2) * 0.045 * mag,
    };
  }

  function update(dt) {
    trauma = Math.max(0, trauma - dt * 1.85);

    for (let i = pendingChains.length - 1; i >= 0; i--) {
      pendingChains[i].delay -= dt;
      if (pendingChains[i].delay <= 0) {
        const c = pendingChains.splice(i, 1)[0];
        spawnExplosion(c.pos, c.scale, false);
      }
    }

    for (const f of fireballs.items) {
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.active = false;
        f.mesh.visible = false;
        continue;
      }
      const t = f.life / f.maxLife;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.scale.setScalar(f.startScale + (f.endScale - f.startScale) * Math.pow(t, 0.55));
      if (t < 0.35) {
        tmpColor.copy(colWhite).lerp(colOrange, t / 0.35);
      } else {
        tmpColor.copy(colOrange).lerp(colCrimson, (t - 0.35) / 0.65);
      }
      f.mesh.material.color.copy(tmpColor);
      f.mesh.material.opacity = (1 - t) * 0.96;
    }

    for (const s of shockwaves.items) {
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      const t = s.life / s.maxLife;
      s.mesh.scale.setScalar(s.startScale + (s.endScale - s.startScale) * Math.pow(t, 0.65));
      s.mesh.material.opacity = (1 - t) * 0.88;
    }

    for (const p of smokePuffs.items) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = p.life / p.maxLife;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(p.startScale + (p.endScale - p.startScale) * t);
      const baseOp = p.kind === 'contrail' ? 0.82 : 0.76;
      p.mesh.material.opacity = (1 - t) * baseOp;
    }

    for (const d of debrisShards.items) {
      if (!d.active) continue;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.vel.y -= d.gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;
      d.mesh.material.opacity = Math.max(0, 1 - d.life / d.maxLife);
    }

    for (const m of muzzleFlashes.items) {
      if (!m.active) continue;
      m.life += dt;
      if (m.life >= m.maxLife) {
        m.active = false;
        m.mesh.visible = false;
      }
    }

    for (const sp of hitSparks.items) {
      if (!sp.active) continue;
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.mesh.material.opacity = 1 - sp.life / sp.maxLife;
    }
  }

  function clear() {
    pendingChains.length = 0;
    trauma = 0;
    for (const pool of [fireballs, shockwaves, smokePuffs, debrisShards, muzzleFlashes, hitSparks]) {
      for (const item of pool.items) {
        item.active = false;
        item.mesh.visible = false;
      }
    }
  }

  return {
    spawnExplosion,
    spawnStagedExplosion,
    spawnMuzzleFlash,
    spawnMissileTrail,
    spawnOilSmoke,
    spawnFlakBurst,
    spawnHitSparks,
    spawnFlareSmoke,
    addTrauma,
    getShakeOffset,
    update,
    clear,
  };
}
