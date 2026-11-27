import * as THREE from '../vendor/three.min.js';

const GRAVITY = 9.81;
const GEAR_HEIGHT = 1.32;
const MPS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;
const MPS_TO_FPM = 196.85;

/**
 * Combat-tuned 3D STOL flight dynamics for Merpati D-7B Stormbird.
 * Combines authentic bush-plane takeoffs, landings, crosswinds, and volcanic thermals
 * with wide dogfight pitch/roll agility, high-G turn energy bleed, War Emergency Power
 * overdrive, hostile hit jolts, and friendly airstrip touch-and-go resupply detection.
 */
export function createFlightModel(world) {
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  const state = {
    position,
    velocity,
    quaternion,
    throttle: 0,
    wepActive: false,
    rpm: 0.18,
    flaps: 0,
    brakes: 0,
    fuel: 100,
    damage: 0,
    onGround: true,
    onRunway: null,
    stalling: false,
    overspeed: false,
    airspeed: 0,
    verticalSpeed: 0,
    headingDeg: 0,
    headingRad: 0,
    pitchRad: 0,
    rollRad: 0,
    controlSurfaces: { pitch: 0, roll: 0, yaw: 0 },
    windVec: new THREE.Vector3(2, 0, 0),
    windSpeedKt: 4,
    windDirRad: 1.2,
    crashed: false,
    crashReason: '',
    landedMissionRunway: false,
    landingRecord: {
      touchedDown: false,
      touchdownVsi: 0,
      touchdownRollDeg: 0,
      bounceCount: 0,
      grade: 'SMOOTH',
    },
    events: [],
  };

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const relVel = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const qDelta = new THREE.Quaternion();
  const eulerDelta = new THREE.Euler(0, 0, 0, 'YXZ');

  function syncAngles() {
    euler.setFromQuaternion(quaternion, 'YXZ');
    state.pitchRad = euler.x;
    state.rollRad = euler.z;
    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    let hdg = (Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI;
    if (hdg < 0) hdg += 360;
    state.headingDeg = hdg;
    state.headingRad = (hdg * Math.PI) / 180;
  }

  function resetOnRunway(stripId, startFuel = 100, windSpeedKt = 4, windDirDeg = 70) {
    const strip = world.getAirstripById(stripId);
    const { rad, fwdX, fwdZ } = world.getRunwayBasis(strip);
    const startBack = strip.length * 0.38;

    position.set(
      strip.x - fwdX * startBack,
      strip.elevation + GEAR_HEIGHT,
      strip.z - fwdZ * startBack
    );
    velocity.set(0, 0, 0);
    quaternion.setFromEuler(new THREE.Euler(0, -rad, 0, 'YXZ'));

    state.throttle = 0.22;
    state.wepActive = false;
    state.rpm = 0.25;
    state.flaps = 1;
    state.brakes = 0;
    state.fuel = startFuel;
    state.damage = 0;
    state.onGround = true;
    state.onRunway = strip.id;
    state.stalling = false;
    state.overspeed = false;
    state.airspeed = 0;
    state.verticalSpeed = 0;
    state.crashed = false;
    state.crashReason = '';
    state.landedMissionRunway = false;
    state.controlSurfaces = { pitch: 0, roll: 0, yaw: 0 };
    state.landingRecord = {
      touchedDown: false,
      touchdownVsi: 0,
      touchdownRollDeg: 0,
      bounceCount: 0,
      grade: 'SMOOTH',
    };
    state.events.length = 0;

    state.windSpeedKt = windSpeedKt;
    state.windDirRad = (windDirDeg * Math.PI) / 180;
    const windMps = windSpeedKt / MPS_TO_KT;
    state.windVec.set(Math.sin(state.windDirRad) * windMps, 0, -Math.cos(state.windDirRad) * windMps);
    syncAngles();
  }

  function setPose({
    x,
    y,
    z,
    headingDeg,
    pitchDeg = 0,
    rollDeg = 0,
    speedKt = 88,
    throttle = 0.78,
    flaps = 0,
    fuel = 80,
    damage = 0,
    onGround = false,
    onRunway = null,
  }) {
    position.set(x, y, z);
    const hRad = (headingDeg * Math.PI) / 180;
    const pRad = (pitchDeg * Math.PI) / 180;
    const rRad = (rollDeg * Math.PI) / 180;
    quaternion.setFromEuler(new THREE.Euler(pRad, -hRad, rRad, 'YXZ'));

    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    velocity.copy(fwd).multiplyScalar(speedKt / MPS_TO_KT);

    state.throttle = throttle;
    state.wepActive = throttle > 0.9;
    state.rpm = Math.max(0.22, throttle);
    state.flaps = flaps;
    state.fuel = fuel;
    state.damage = damage;
    state.onGround = onGround;
    state.onRunway = onRunway;
    state.airspeed = speedKt / MPS_TO_KT;
    state.verticalSpeed = velocity.y;
    state.crashed = false;
    state.crashReason = '';
    state.stalling = false;
    state.overspeed = false;
    state.events.length = 0;
    syncAngles();
  }

  /**
   * Apply hostile gunfire or flak damage plus subtle rotational impact jolt.
   */
  function applyCombatDamage(dmg, sourceLabel = 'Enemy fire') {
    if (state.crashed) return;
    state.damage = Math.min(100, state.damage + dmg);

    // Subtle rotational jolt on hit
    const jolt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.08)
    );
    quaternion.multiply(jolt).normalize();
    syncAngles();

    if (state.damage >= 100) {
      state.crashed = true;
      state.crashReason = `Shot down by ${sourceLabel} — use flares (F) and break turns to evade.`;
      state.events.push({ type: 'crash', reason: state.crashReason, combatLoss: true });
    }
  }

  function classifyLanding(sinkMps, rollDeg, bounceCount) {
    if (sinkMps < 1.5 && rollDeg < 7 && bounceCount === 0) return 'BUTTER';
    if (sinkMps < 2.6 && rollDeg < 12 && bounceCount <= 1) return 'SMOOTH';
    if (sinkMps < 4.0) return 'FIRM';
    return 'HARD';
  }

  function step(dt, input, destRunwayId, combatComplete = true) {
    state.events.length = 0;
    if (state.crashed) {
      velocity.multiplyScalar(Math.max(0, 1 - dt * 3.5));
      return;
    }

    if (input.throttleDelta !== 0) {
      state.throttle = Math.max(0, Math.min(1, state.throttle + input.throttleDelta * dt * 0.68));
    }
    state.brakes = input.brake ? 1 : 0;

    // War Emergency Power engages above 90% throttle for combat pursuit at higher fuel burn
    const fuelAvailable = state.fuel > 0.01;
    state.wepActive = fuelAvailable && state.throttle > 0.9;
    const targetRpm = fuelAvailable ? 0.14 + state.throttle * (state.wepActive ? 0.94 : 0.86) : 0.04;
    state.rpm += (targetRpm - state.rpm) * Math.min(1, dt * 5.0);

    if (fuelAvailable && (!state.onGround || state.throttle > 0.25)) {
      const wepBurn = state.wepActive ? 0.62 : 0;
      const burnRate = 0.11 + Math.pow(state.throttle, 1.85) * 0.84 + wepBurn;
      state.fuel = Math.max(0, state.fuel - burnRate * dt);
      if (state.fuel <= 0.01) {
        state.events.push({ type: 'fuel_empty' });
      }
    }

    // Crisp combat-tuned control surface response
    const smooth = Math.min(1, dt * 11.5);
    state.controlSurfaces.pitch += (input.pitch - state.controlSurfaces.pitch) * smooth;
    state.controlSurfaces.roll += (input.roll - state.controlSurfaces.roll) * smooth;
    state.controlSurfaces.yaw += (input.yaw - state.controlSurfaces.yaw) * smooth;

    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    right.set(1, 0, 0).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);

    relVel.copy(velocity).sub(state.windVec);
    const speed = relVel.length();
    const forwardSpeed = Math.max(0, relVel.dot(fwd));
    state.airspeed = speed;
    const speedKt = speed * MPS_TO_KT;

    const stallKt = state.flaps === 2 ? 25 : state.flaps === 1 ? 29 : 34;
    state.stalling = !state.onGround && speedKt < stallKt;
    state.overspeed = speedKt > 148;

    const aeroAuthority = Math.min(1.35, 0.42 + (forwardSpeed / 36) * 0.92 + state.rpm * 0.18);

    if (state.onGround) {
      const steerRate = state.controlSurfaces.yaw * 1.2 - state.controlSurfaces.roll * 0.45;
      const yawStep = steerRate * Math.min(1, 0.35 + speed / 18) * dt;
      const canRotate = forwardSpeed > 13.5;
      const pitchStep = canRotate ? Math.max(0, state.controlSurfaces.pitch) * 0.92 * dt : 0;

      euler.setFromQuaternion(quaternion, 'YXZ');
      euler.y += yawStep;
      euler.x = Math.max(-0.04, Math.min(0.32, euler.x + pitchStep));
      euler.z *= Math.max(0, 1 - dt * 8);
      quaternion.setFromEuler(euler);
    } else {
      // Wide combat flight envelope for steep dives, climbs, and aggressive dogfight break turns
      const pitchRate = state.controlSurfaces.pitch * 1.18 * aeroAuthority;
      const rollRate = -state.controlSurfaces.roll * 2.15 * aeroAuthority;
      const yawRate = state.controlSurfaces.yaw * 0.88 * aeroAuthority;

      const stallDrop = state.stalling ? -0.35 * dt : 0;
      const buffetRoll = state.stalling ? Math.sin(performance.now() * 0.025) * 0.014 : 0;

      let pitchStep = pitchRate * dt + stallDrop;
      if (state.pitchRad > 1.05 && pitchStep > 0) pitchStep *= Math.max(0, 1 - (state.pitchRad - 1.05) * 3.2);
      if (state.pitchRad < -1.08 && pitchStep < 0) pitchStep *= Math.max(0, 1 - (-1.08 - state.pitchRad) * 3.2);

      // Very light wing-leveling assist only when pilot centers stick
      let rollStep = rollRate * dt + buffetRoll;
      if (Math.abs(state.controlSurfaces.roll) < 0.04 && Math.abs(state.rollRad) < 0.45) {
        rollStep += -state.rollRad * 0.32 * dt;
      }

      eulerDelta.set(pitchStep, yawRate * dt, rollStep, 'YXZ');
      qDelta.setFromEuler(eulerDelta);
      quaternion.multiply(qDelta).normalize();

      syncAngles();
      const bankTurn = Math.sin(state.rollRad) * 0.68 * Math.min(1.2, forwardSpeed / 28) * dt;
      if (Math.abs(bankTurn) > 0.00001) {
        qDelta.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bankTurn);
        quaternion.premultiply(qDelta).normalize();
      }
    }

    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    right.set(1, 0, 0).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);
    syncAngles();

    // ===== FORCES =====
    const acc = new THREE.Vector3(0, -GRAVITY, 0);

    // 1. Engine Thrust + War Emergency Power surge
    const maxThrustAcc = state.wepActive ? 19.6 : 15.6;
    const thrust = fuelAvailable ? state.rpm * maxThrustAcc : 0;
    acc.addScaledVector(fwd, thrust);

    // 2. Aerodynamic Lift & Flaps
    const flapLiftBonus = state.flaps === 2 ? 0.36 : state.flaps === 1 ? 0.18 : 0;
    const flapDragBonus = state.flaps === 2 ? 0.0032 : state.flaps === 1 ? 0.001 : 0;

    const velUp = relVel.dot(up);
    const aoa = forwardSpeed > 3 ? Math.atan2(-velUp, forwardSpeed) : 0;
    const clampedAoa = Math.max(-0.36, Math.min(0.4, aoa));

    const stallFactor = state.stalling ? Math.max(0.42, speedKt / stallKt) : 1.0;
    const liftCoeff = (0.31 + flapLiftBonus + clampedAoa * 2.55) * stallFactor;
    const liftAcc = Math.min(28, 0.0155 * forwardSpeed * forwardSpeed * liftCoeff);
    acc.addScaledVector(up, liftAcc);

    // 3. Parasitic, Flap, High-G Turn Bleed & Airbrake Drag
    const highGTurnDrag = !state.onGround
      ? (Math.abs(Math.sin(state.rollRad)) * 0.0014 + Math.abs(state.controlSurfaces.pitch) * 0.0016)
      : 0;
    const baseDrag = 0.002 + flapDragBonus + highGTurnDrag + Math.abs(clampedAoa) * 0.0026;
    const brakeAirDrag = !state.onGround && state.brakes > 0 ? 0.0052 : 0;
    const dragMag = (baseDrag + brakeAirDrag) * speed * speed;
    if (speed > 0.1) {
      acc.addScaledVector(relVel, -dragMag / speed);
    }

    // 4. Lateral & Vertical Flight Path Tracking
    if (!state.onGround && speed > 5) {
      const sideSlip = relVel.dot(right);
      acc.addScaledVector(right, -sideSlip * 1.55);
      const vertSlip = relVel.dot(up);
      acc.addScaledVector(up, -vertSlip * 0.92);
    }

    // 5. Gunung Api Volcanic Caldera Thermal Updraft
    const distVolcano = Math.hypot(position.x - 760, position.z + 560);
    if (!state.onGround && distVolcano < 340 && position.y > 180) {
      acc.y += (1 - distVolcano / 340) * 3.6;
    }

    velocity.addScaledVector(acc, dt);
    const maxMps = state.wepActive ? 84 : 76;
    if (velocity.length() > maxMps) {
      velocity.setLength(maxMps);
    }

    position.addScaledVector(velocity, dt);
    state.verticalSpeed = velocity.y;

    const maxBound = 2400;
    if (Math.abs(position.x) > maxBound) position.x = Math.sign(position.x) * maxBound;
    if (Math.abs(position.z) > maxBound) position.z = Math.sign(position.z) * maxBound;
    if (position.y > 980) {
      position.y = 980;
      if (velocity.y > 0) velocity.y = 0;
    }

    // ===== TERRAIN & RUNWAY CONTACT / TOUCH-AND-GO RESUPPLY / LANDING =====
    const ground = world.sampleTerrain(position.x, position.z);
    const groundY = ground.height + GEAR_HEIGHT;

    if (position.y <= groundY) {
      if (ground.isWater) {
        position.y = 0.4;
        velocity.multiplyScalar(0.15);
        state.damage = 100;
        state.crashed = true;
        state.crashReason = 'Ditched into the Banda Sea — keep altitude over open water.';
        state.events.push({ type: 'crash', reason: state.crashReason });
        return;
      }

      const sinkMps = -velocity.y;
      const rollDeg = Math.abs((state.rollRad * 180) / Math.PI);
      const pitchDeg = (state.pitchRad * 180) / Math.PI;
      const wasAirborne = !state.onGround;

      if (wasAirborne) {
        if (sinkMps > 7.8 || rollDeg > 36 || pitchDeg < -24 || (!ground.onRunway && speed > 44 && sinkMps > 4.2)) {
          position.y = groundY - 0.35;
          velocity.multiplyScalar(0.1);
          state.damage = 100;
          state.crashed = true;
          if (rollDeg > 36) state.crashReason = `Wing strike on touchdown (${Math.round(rollDeg)}° bank angle).`;
          else if (pitchDeg < -24) state.crashReason = 'Nose-down impact — flare gently before touching down.';
          else if (!ground.onRunway) state.crashReason = `Off-runway terrain impact (${sinkMps.toFixed(1)} m/s sink rate).`;
          else state.crashReason = `Severe hard landing (${sinkMps.toFixed(1)} m/s sink rate — flare before touchdown).`;
          state.events.push({ type: 'crash', reason: state.crashReason });
          return;
        }

        if (sinkMps > 3.6 || rollDeg > 18) {
          position.y = groundY + 0.15;
          velocity.y = Math.max(2.2, sinkMps * 0.44);
          const dmg = Math.round(10 + sinkMps * 3.0 + Math.max(0, rollDeg - 12) * 0.6);
          state.damage = Math.min(100, state.damage + dmg);
          state.landingRecord.bounceCount += 1;
          state.events.push({ type: 'bounce', sinkMps, dmg, pos: position.clone() });

          if (state.damage >= 100) {
            state.crashed = true;
            state.crashReason = 'Airframe structural failure from repeated hard bounces.';
            state.events.push({ type: 'crash', reason: state.crashReason });
            return;
          }
          return;
        }

        state.landingRecord.touchedDown = true;
        state.landingRecord.touchdownVsi = sinkMps;
        state.landingRecord.touchdownRollDeg = rollDeg;
        state.landingRecord.grade = classifyLanding(sinkMps, rollDeg, state.landingRecord.bounceCount);
        if (sinkMps > 2.4) {
          state.damage = Math.min(95, state.damage + Math.round((sinkMps - 2.2) * 5));
        }
        state.events.push({
          type: 'touchdown',
          sinkMps,
          grade: state.landingRecord.grade,
          onRunway: ground.onRunway,
          pos: position.clone(),
        });

        // Non-destination friendly airstrip touch-and-go field resupply
        if (ground.onRunway && ground.onRunway !== destRunwayId) {
          const strip = world.getAirstripById(ground.onRunway);
          state.events.push({ type: 'resupply', stripId: strip.id, stripName: strip.name });
        }
      }

      position.y = groundY;
      if (velocity.y < 0) velocity.y = 0;
      state.onGround = true;
      state.onRunway = ground.onRunway;

      const groundSpeed = Math.hypot(velocity.x, velocity.z);
      const rollingFric = ground.onRunway ? 0.32 : 1.45;
      const brakeFric = state.brakes > 0 ? 8.2 : state.throttle < 0.08 ? 1.8 : 0;
      const nextGroundSpeed = Math.max(0, groundSpeed - (rollingFric + brakeFric) * dt);

      const hFwdX = Math.sin(state.headingRad);
      const hFwdZ = -Math.cos(state.headingRad);
      velocity.x = hFwdX * nextGroundSpeed;
      velocity.z = hFwdZ * nextGroundSpeed;

      if (!ground.onRunway && nextGroundSpeed > 18) {
        state.damage = Math.min(100, state.damage + dt * 6.5);
        if (state.damage >= 100) {
          state.crashed = true;
          state.crashReason = 'Landing gear collapsed on rough off-runway terrain.';
          state.events.push({ type: 'crash', reason: state.crashReason });
          return;
        }
      }

      if (liftAcc > GRAVITY * 1.03 && state.pitchRad > 0.04 && forwardSpeed > 16.5) {
        state.onGround = false;
        velocity.y = Math.max(velocity.y, 2.0);
      }

      if (ground.onRunway === destRunwayId && nextGroundSpeed < 3.6 && state.landingRecord.touchedDown) {
        if (combatComplete) {
          state.landedMissionRunway = true;
          state.events.push({ type: 'mission_landed', stripId: destRunwayId });
        } else {
          state.events.push({ type: 'hostiles_remain', stripId: destRunwayId });
        }
      }
    } else {
      state.onGround = false;
      state.onRunway = null;
    }
  }

  function getTelemetry(missionInfo) {
    return {
      pos: position,
      airspeedKt: state.airspeed * MPS_TO_KT,
      altitudeFt: Math.max(0, position.y * M_TO_FT),
      vsiFpm: state.verticalSpeed * MPS_TO_FPM,
      headingDeg: state.headingDeg,
      headingRad: state.headingRad,
      pitchRad: state.pitchRad,
      rollRad: state.rollRad,
      throttle: state.throttle,
      wepActive: state.wepActive,
      rpm: state.rpm,
      flapsDeg: state.flaps === 0 ? 0 : state.flaps === 1 ? 15 : 30,
      fuel: state.fuel,
      damage: state.damage,
      stalling: state.stalling,
      overspeed: state.overspeed,
      onGround: state.onGround,
      onRunway: state.onRunway,
      windSpeedKt: state.windSpeedKt,
      targetPos: missionInfo ? missionInfo.targetPos : null,
      targetDist: missionInfo ? missionInfo.targetDist : 0,
      destRunwayId: missionInfo ? missionInfo.destRunwayId : null,
    };
  }

  return {
    state,
    resetOnRunway,
    setPose,
    applyCombatDamage,
    step,
    getTelemetry,
  };
}
