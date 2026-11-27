import * as THREE from '../vendor/three.min.js';
import { getAirstripById, getRunwayBasis } from './world.js';

export const MISSIONS = [
  {
    id: 'nusa-mail',
    name: 'Nusa Indah Mail Run',
    difficulty: 'ROOKIE',
    threatSummary: '3 Kestrel Scouts',
    description: 'Pelabuhan Utama → Pulau Hijau • 6 rings • Intercept 3 Kestrel Scouts',
    startStrip: 'pelabuhan',
    destStrip: 'hijau',
    startFuel: 100,
    windSpeedKt: 4,
    windDirDeg: 68,
    parTimeSec: 95,
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
    threatSummary: '2 Kestrels + 2 Komodo Gunships',
    description: 'Pulau Hijau → Kampung Timur • Volcano climb • 2 Kestrels & 2 Gunships',
    startStrip: 'hijau',
    destStrip: 'timur',
    startFuel: 88,
    windSpeedKt: 7,
    windDirDeg: 112,
    parTimeSec: 135,
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
    threatSummary: 'Raiders + Ace Elang Merah',
    description: 'Kampung Timur → Teluk Barat • Karst slalom • Defeat Ace Elang Merah',
    startStrip: 'timur',
    destStrip: 'barat',
    startFuel: 84,
    windSpeedKt: 10,
    windDirDeg: 215,
    parTimeSec: 145,
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
    threatSummary: 'Escorts + Boss Naga Langit',
    description: 'Teluk Barat → Pelabuhan Utama • 8 rings • Destroy Boss Naga Langit Airship',
    startStrip: 'barat',
    destStrip: 'pelabuhan',
    startFuel: 82,
    windSpeedKt: 9,
    windDirDeg: 310,
    parTimeSec: 175,
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
 * Create the 3D courier ring manager, runway approach marker, and combined
 * Combat + Courier sortie scoring engine.
 */
export function createMissionManager(scene) {
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const activeOuterMat = new THREE.MeshBasicMaterial({ color: '#ffd34d' });
  const activeInnerMat = new THREE.MeshBasicMaterial({
    color: '#4fe3d8',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const upcomingOuterMat = new THREE.MeshBasicMaterial({
    color: '#5ec9e8',
    transparent: true,
    opacity: 0.5,
  });
  const passedOuterMat = new THREE.MeshBasicMaterial({
    color: '#3ee08e',
    transparent: true,
    opacity: 0.16,
  });

  const landingBeaconGroup = new THREE.Group();
  const beaconCone = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 16, 4),
    new THREE.MeshBasicMaterial({ color: '#3ee08e', transparent: true, opacity: 0.85 })
  );
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
  const prevPlanePos = new THREE.Vector3();
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

    const outer = new THREE.Mesh(new THREE.TorusGeometry(20, 1.4, 12, 36), activeOuterMat);
    wrap.add(outer);

    const inner = new THREE.Mesh(new THREE.TorusGeometry(16.6, 0.58, 8, 32), activeInnerMat);
    wrap.add(inner);

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

  function setActiveRingPoseForShot(x, y, z, headingDeg) {
    if (currentRingIdx < ringMeshes.length) {
      const r = ringMeshes[currentRingIdx];
      r.pos.set(x, y, z);
      r.wrap.position.set(x, y, z);
      r.wrap.rotation.y = -(headingDeg * Math.PI) / 180;
    }
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

  function update(dt, elapsed, planePos, isFlying) {
    let event = null;
    if (isFlying) {
      elapsedSec += dt;
    }

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

    if (isFlying && currentRingIdx < ringMeshes.length) {
      const active = ringMeshes[currentRingIdx];
      let closestDist = planePos.distanceTo(active.pos);
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
   * Compute combined Combat + Courier sortie score breakdown on successful landing.
   */
  function calculateScore(flightState, combatScore) {
    const cs = combatScore || { kills: 0, raiderScore: 0, bossBounty: 0, totalCombatScore: 0, accuracyPct: 0 };
    const allRings = ringsHit >= ringMeshes.length;
    const ringScore = Math.round((ringsHit * 250 + bullseyes * 75) * (allRings ? 1.15 : 1.0));
    const parDiff = Math.max(0, currentMission.parTimeSec - elapsedSec);
    const timeBonus = Math.round(350 + Math.min(900, parDiff * 14));

    const grade = flightState.landingRecord.grade || 'SMOOTH';
    const landingTable = { BUTTER: 1500, SMOOTH: 1050, FIRM: 650, HARD: 250 };
    const landingBonus = landingTable[grade] ?? 650;

    const fuelBonus = Math.round(flightState.fuel * 10);
    const hullPct = Math.max(0, Math.round(100 - flightState.damage));
    const hullBonus = hullPct * 6;

    const total = cs.raiderScore + cs.bossBounty + ringScore + timeBonus + landingBonus + fuelBonus + hullBonus;
    const rank = total >= 5400 ? 'S' : total >= 4200 ? 'A' : total >= 3000 ? 'B' : 'C';

    return {
      missionName: currentMission.name,
      destName: getAirstripById(currentMission.destStrip).name,
      kills: cs.kills,
      raiderScore: cs.raiderScore,
      bossBounty: cs.bossBounty,
      accuracyPct: cs.accuracyPct,
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
    setActiveRingPoseForShot,
    update,
    calculateScore,
  };
}
