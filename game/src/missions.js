import * as THREE from '../vendor/three.min.js';
import { getAirstripById, getRunwayBasis } from './world.js';

export const MISSIONS = [
  {
    id: 'nusa-mail',
    name: 'Nusa Indah Mail Run',
    difficulty: 'ROOKIE',
    description: 'Pelabuhan Utama → Pulau Hijau • 6 lagoon rings • Calm sea breeze',
    startStrip: 'pelabuhan',
    destStrip: 'hijau',
    startFuel: 100,
    windSpeedKt: 4,
    windDirDeg: 68,
    parTimeSec: 75,
    rings: [
      { x: -515, y: 50, z: 385, headingDeg: 28 },
      { x: -545, y: 86, z: 265, headingDeg: 5 },
      { x: -513, y: 98, z: 165, headingDeg: 34 },
      { x: -423, y: 76, z: 57, headingDeg: 40 },
      { x: -346, y: 52, z: -34, headingDeg: 40 },
      { x: -288, y: 34, z: -103, headingDeg: 40 },
    ],
  },
  {
    id: 'gunung-api',
    name: 'Gunung Api Medical Express',
    difficulty: 'INTERMEDIATE',
    description: 'Pulau Hijau → Kampung Timur • Climb the smoking volcano • Tight fuel',
    startStrip: 'hijau',
    destStrip: 'timur',
    startFuel: 84,
    windSpeedKt: 7,
    windDirDeg: 112,
    parTimeSec: 120,
    rings: [
      { x: 50, y: 74, z: -505, headingDeg: 46 },
      { x: 260, y: 174, z: -640, headingDeg: 66 },
      { x: 510, y: 292, z: -760, headingDeg: 95 },
      { x: 860, y: 342, z: -740, headingDeg: 145 },
      { x: 1040, y: 210, z: -240, headingDeg: 185 },
      { x: 935, y: 118, z: 245, headingDeg: 215 },
      { x: 805, y: 52, z: 430, headingDeg: 345 },
    ],
  },
  {
    id: 'karang-slalom',
    name: 'Karang Reef Island Hopper',
    difficulty: 'VETERAN',
    description: 'Kampung Timur → Teluk Barat • Low karst slalom • 10 kt crosswind',
    startStrip: 'timur',
    destStrip: 'barat',
    startFuel: 80,
    windSpeedKt: 10,
    windDirDeg: 215,
    parTimeSec: 125,
    rings: [
      { x: 560, y: 74, z: -220, headingDeg: 315 },
      { x: 290, y: 98, z: -330, headingDeg: 270 },
      { x: 10, y: 88, z: -220, headingDeg: 265 },
      { x: -360, y: 78, z: -340, headingDeg: 255 },
      { x: -740, y: 96, z: -590, headingDeg: 265 },
      { x: -1190, y: 84, z: -775, headingDeg: 152 },
      { x: -1135, y: 50, z: -675, headingDeg: 152 },
    ],
  },
  {
    id: 'grand-circuit',
    name: 'Nusantara Grand Circuit',
    difficulty: 'ACE',
    description: 'Teluk Barat → Pelabuhan Utama • 8-ring archipelago sprint • Fuel discipline',
    startStrip: 'barat',
    destStrip: 'pelabuhan',
    startFuel: 76,
    windSpeedKt: 9,
    windDirDeg: 310,
    parTimeSec: 145,
    rings: [
      { x: -840, y: 76, z: -150, headingDeg: 145 },
      { x: -640, y: 108, z: 10, headingDeg: 105 },
      { x: -240, y: 118, z: 160, headingDeg: 90 },
      { x: 220, y: 132, z: 240, headingDeg: 115 },
      { x: 340, y: 116, z: 550, headingDeg: 215 },
      { x: -160, y: 98, z: 840, headingDeg: 260 },
      { x: -825, y: 76, z: 965, headingDeg: 28 },
      { x: -765, y: 42, z: 855, headingDeg: 28 },
    ],
  },
];

/**
 * Create the 3D target ring manager, runway approach marker, and sortie scoring engine.
 */
export function createMissionManager(scene) {
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const activeOuterMat = new THREE.MeshBasicMaterial({ color: '#ffd34d' });
  const activeInnerMat = new THREE.MeshBasicMaterial({
    color: '#4fe3d8',
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  const upcomingOuterMat = new THREE.MeshBasicMaterial({
    color: '#5ec9e8',
    transparent: true,
    opacity: 0.52,
  });
  const passedOuterMat = new THREE.MeshBasicMaterial({
    color: '#3ee08e',
    transparent: true,
    opacity: 0.18,
  });

  // Floating runway landing beacon above destination strip
  const landingBeaconGroup = new THREE.Group();
  const beaconConeMat = new THREE.MeshBasicMaterial({
    color: '#3ee08e',
    transparent: true,
    opacity: 0.85,
  });
  const beaconCone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 16, 4), beaconConeMat);
  beaconCone.rotation.x = Math.PI;
  landingBeaconGroup.add(beaconCone);

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(12, 16, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd34d', side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = -12;
  landingBeaconGroup.add(beaconRing);
  scene.add(landingBeaconGroup);

  let currentMission = MISSIONS[0];
  let ringMeshes = [];
  let currentRingIdx = 0;
  let ringsHit = 0;
  let bullseyes = 0;
  let elapsedSec = 0;
  let prevPlanePos = new THREE.Vector3();
  let hasPrevPos = false;

  function clearRings() {
    while (ringGroup.children.length > 0) {
      ringGroup.remove(ringGroup.children[0]);
    }
    ringMeshes = [];
  }

  function buildRingMesh(spec) {
    const wrap = new THREE.Group();
    wrap.position.set(spec.x, spec.y, spec.z);
    wrap.rotation.y = -(spec.headingDeg * Math.PI) / 180;

    // Bold glowing outer torus
    const outer = new THREE.Mesh(new THREE.TorusGeometry(20, 1.35, 12, 36), activeOuterMat);
    wrap.add(outer);

    // Translucent cyan inner energy hoop
    const inner = new THREE.Mesh(new THREE.TorusGeometry(16.6, 0.55, 8, 32), activeInnerMat);
    wrap.add(inner);

    // Four glowing directional chevrons around the ring rim
    const chevGeo = new THREE.ConeGeometry(2.3, 4.6, 4);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const chev = new THREE.Mesh(chevGeo, activeInnerMat);
      chev.position.set(Math.cos(ang) * 23.2, Math.sin(ang) * 23.2, 0);
      chev.rotation.z = ang + Math.PI / 2;
      wrap.add(chev);
    }

    return { wrap, outer, inner, passed: false, pos: new THREE.Vector3(spec.x, spec.y, spec.z) };
  }

  function refreshRingStyles() {
    for (let i = 0; i < ringMeshes.length; i++) {
      const r = ringMeshes[i];
      if (i < currentRingIdx) {
        r.outer.material = passedOuterMat;
        r.inner.visible = false;
        r.wrap.scale.setScalar(0.85);
      } else if (i === currentRingIdx) {
        r.outer.material = activeOuterMat;
        r.inner.visible = true;
        r.wrap.scale.setScalar(1.0);
      } else {
        r.outer.material = upcomingOuterMat;
        r.inner.visible = false;
        r.wrap.scale.setScalar(0.88);
      }
    }
  }

  function loadMission(missionIndex) {
    currentMission = MISSIONS[missionIndex % MISSIONS.length];
    clearRings();
    currentRingIdx = 0;
    ringsHit = 0;
    bullseyes = 0;
    elapsedSec = 0;
    hasPrevPos = false;

    for (const spec of currentMission.rings) {
      const rm = buildRingMesh(spec);
      ringGroup.add(rm.wrap);
      ringMeshes.push(rm);
    }
    refreshRingStyles();

    const dest = getAirstripById(currentMission.destStrip);
    const { fwdX, fwdZ } = getRunwayBasis(dest);
    landingBeaconGroup.position.set(
      dest.x - fwdX * (dest.length * 0.35),
      dest.elevation + 24,
      dest.z - fwdZ * (dest.length * 0.35)
    );
    return currentMission;
  }

  function setProgressForShot(completedRings, timeSec) {
    currentRingIdx = Math.min(ringMeshes.length, completedRings);
    ringsHit = currentRingIdx;
    elapsedSec = timeSec;
    refreshRingStyles();
  }

  function getActiveTarget() {
    const dest = getAirstripById(currentMission.destStrip);
    if (currentRingIdx < ringMeshes.length) {
      return {
        type: 'ring',
        index: currentRingIdx,
        total: ringMeshes.length,
        pos: ringMeshes[currentRingIdx].pos,
        destStrip: dest,
      };
    }
    return {
      type: 'runway',
      index: ringMeshes.length,
      total: ringMeshes.length,
      pos: new THREE.Vector3(dest.x, dest.elevation + 5, dest.z),
      destStrip: dest,
    };
  }

  /**
   * Update ring animations, timer, and check if the plane flew through the active ring.
   */
  function update(dt, elapsed, planePos, isFlying) {
    let event = null;
    if (isFlying) {
      elapsedSec += dt;
    }

    // Animate active ring & destination landing beacon
    if (currentRingIdx < ringMeshes.length) {
      const active = ringMeshes[currentRingIdx];
      active.inner.rotation.z = elapsed * 1.6;
      const pulse = 1 + Math.sin(elapsed * 4.5) * 0.04;
      active.wrap.scale.setScalar(pulse);
    }

    const dest = getAirstripById(currentMission.destStrip);
    const { fwdX, fwdZ } = getRunwayBasis(dest);
    const allRingsDone = currentRingIdx >= ringMeshes.length;
    landingBeaconGroup.visible = true;
    landingBeaconGroup.position.set(
      dest.x - fwdX * (dest.length * 0.35),
      dest.elevation + (allRingsDone ? 22 : 34) + Math.sin(elapsed * 3.2) * 3.2,
      dest.z - fwdZ * (dest.length * 0.35)
    );
    beaconCone.rotation.y = elapsed * 2.1;

    // Gate passage detection (checks segment from prevPos to planePos for reliability at high speed!)
    if (isFlying && currentRingIdx < ringMeshes.length) {
      const active = ringMeshes[currentRingIdx];
      const distNow = planePos.distanceTo(active.pos);
      let closestDist = distNow;
      if (hasPrevPos) {
        const seg = new THREE.Vector3().subVectors(planePos, prevPlanePos);
        const segLenSq = seg.lengthSq();
        if (segLenSq > 0.001) {
          const t = Math.max(
            0,
            Math.min(1, new THREE.Vector3().subVectors(active.pos, prevPlanePos).dot(seg) / segLenSq)
          );
          const closestPt = prevPlanePos.clone().addScaledVector(seg, t);
          closestDist = closestPt.distanceTo(active.pos);
        }
      }

      if (closestDist <= 28) {
        const bullseye = closestDist <= 10.5;
        ringsHit += 1;
        if (bullseye) bullseyes += 1;
        currentRingIdx += 1;
        refreshRingStyles();
        event = {
          type: 'ring_hit',
          ringsHit,
          totalRings: ringMeshes.length,
          bullseye,
          allRingsDone: currentRingIdx >= ringMeshes.length,
        };
      }
    }

    prevPlanePos.copy(planePos);
    hasPrevPos = true;

    const target = getActiveTarget();
    const targetDist = planePos.distanceTo(target.pos);
    const dx = target.pos.x - planePos.x;
    const dz = target.pos.z - planePos.z;
    let targetBearingDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    if (targetBearingDeg < 0) targetBearingDeg += 360;

    return {
      event,
      mission: currentMission,
      targetType: target.type,
      targetPos: target.pos,
      targetDist,
      targetBearingDeg,
      destRunwayId: currentMission.destStrip,
      destName: dest.name,
      ringsHit,
      totalRings: ringMeshes.length,
      elapsedSec,
    };
  }

  /**
   * Compute full courier sortie score breakdown on successful runway landing.
   */
  function calculateScore(flightState) {
    const ringScore = ringsHit * 250 + bullseyes * 75;
    const parDiff = Math.max(0, currentMission.parTimeSec - elapsedSec);
    const timeBonus = Math.round(350 + Math.min(900, parDiff * 16));

    const grade = flightState.landingRecord.grade || 'SMOOTH';
    const landingTable = { BUTTER: 1500, SMOOTH: 1050, FIRM: 650, HARD: 250 };
    const landingBonus = landingTable[grade] ?? 650;

    const fuelBonus = Math.round(flightState.fuel * 10);
    const hullPct = Math.max(0, Math.round(100 - flightState.damage));
    const hullBonus = hullPct * 5;

    const total = ringScore + timeBonus + landingBonus + fuelBonus + hullBonus;
    const rank = total >= 3900 ? 'S' : total >= 3100 ? 'A' : total >= 2300 ? 'B' : 'C';

    return {
      missionName: currentMission.name,
      destName: getAirstripById(currentMission.destStrip).name,
      ringsHit,
      totalRings: ringMeshes.length,
      bullseyes,
      ringScore,
      elapsedSec,
      timeBonus,
      grade,
      touchdownVsi: flightState.landingRecord.touchdownVsi,
      bounceCount: flightState.landingRecord.bounceCount,
      landingBonus,
      fuelPct: Math.round(flightState.fuel),
      fuelBonus,
      hullPct,
      hullBonus,
      total,
      rank,
    };
  }

  return {
    missions: MISSIONS,
    loadMission,
    setProgressForShot,
    update,
    calculateScore,
  };
}
