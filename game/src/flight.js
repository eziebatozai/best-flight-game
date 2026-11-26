import * as THREE from '../vendor/three.min.js';

const GRAVITY = 9.81;
const GEAR_HEIGHT = 1.32;
const MPS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;
const MPS_TO_FPM = 196.85;

/**
 * Create the 3D STOL bush-plane flight dynamics simulation.
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
    rpm: 0.18,
    flaps: 0, // 0=0deg, 1=15deg, 2=30deg
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

  // Reusable scratch vectors to avoid GC churn
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
    // Heading 0 = North (-Z), 90 = East (+X)
    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    let hdg = (Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI;
    if (hdg < 0) hdg += 360;
    state.headingDeg = hdg;
    state.headingRad = (hdg * Math.PI) / 180;
  }

  /**
   * Place the aircraft cleanly at the departure end of a runway.
   */
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
    state.rpm = 0.25;
    state.flaps = 1; // 15 deg takeoff flaps preset
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

  /**
   * Place the aircraft directly in flight for deterministic screenshot/preview poses.
   */
  function setPose({ x, y, z, headingDeg, pitchDeg = 0, rollDeg = 0, speedKt = 80, throttle = 0.72, flaps = 0, fuel = 82, damage = 0, onGround = false, onRunway = null }) {
    position.set(x, y, z);
    const hRad = (headingDeg * Math.PI) / 180;
    const pRad = (pitchDeg * Math.PI) / 180;
    const rRad = (rollDeg * Math.PI) / 180;
    quaternion.setFromEuler(new THREE.Euler(pRad, -hRad, rRad, 'YXZ'));

    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    velocity.copy(fwd).multiplyScalar(speedKt / MPS_TO_KT);

    state.throttle = throttle;
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

  function classifyLanding(sinkMps, rollDeg, bounceCount) {
    if (sinkMps < 1.5 && rollDeg < 7 && bounceCount === 0) return 'BUTTER';
    if (sinkMps < 2.6 && rollDeg < 12 && bounceCount <= 1) return 'SMOOTH';
    if (sinkMps < 4.0) return 'FIRM';
    return 'HARD';
  }

  /**
   * Step flight physics forward by dt seconds.
   */
  function step(dt, input, destRunwayId) {
    state.events.length = 0;
    if (state.crashed) {
      velocity.multiplyScalar(Math.max(0, 1 - dt * 3.5));
      return;
    }

    // Throttle control
    if (input.throttleDelta !== 0) {
      state.throttle = Math.max(0, Math.min(1, state.throttle + input.throttleDelta * dt * 0.65));
    }
    state.brakes = input.brake ? 1 : 0;

    // Fuel consumption (nonlinear curve rewards throttle discipline!)
    const fuelAvailable = state.fuel > 0.01;
    const targetRpm = fuelAvailable ? 0.14 + state.throttle * 0.86 : 0.04;
    state.rpm += (targetRpm - state.rpm) * Math.min(1, dt * 4.5);

    if (fuelAvailable && (!state.onGround || state.throttle > 0.25)) {
      const burnRate = 0.12 + Math.pow(state.throttle, 1.85) * 0.88;
      state.fuel = Math.max(0, state.fuel - burnRate * dt);
      if (state.fuel <= 0.01) {
        state.events.push({ type: 'fuel_empty' });
      }
    }

    // Smooth control surface deflection
    const smooth = Math.min(1, dt * 9.5);
    state.controlSurfaces.pitch += (input.pitch - state.controlSurfaces.pitch) * smooth;
    state.controlSurfaces.roll += (input.roll - state.controlSurfaces.roll) * smooth;
    state.controlSurfaces.yaw += (input.yaw - state.controlSurfaces.yaw) * smooth;

    // Basis vectors
    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    right.set(1, 0, 0).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);

    // Relative airflow (aircraft velocity minus gentle ambient wind)
    relVel.copy(velocity).sub(state.windVec);
    const speed = relVel.length();
    const forwardSpeed = Math.max(0, relVel.dot(fwd));
    state.airspeed = speed;
    const speedKt = speed * MPS_TO_KT;

    // Stall & overspeed checks
    const stallKt = state.flaps === 2 ? 25 : state.flaps === 1 ? 29 : 34;
    state.stalling = !state.onGround && speedKt < stallKt;
    state.overspeed = speedKt > 130;

    // Control authority scales smoothly with airflow + prop slipstream so controls ALWAYS respond
    const aeroAuthority = Math.min(1.2, 0.34 + (forwardSpeed / 36) * 0.86 + state.rpm * 0.18);

    if (state.onGround) {
      // Ground steering & takeoff rotation
      const steerRate = state.controlSurfaces.yaw * 1.15 - state.controlSurfaces.roll * 0.45;
      const yawStep = steerRate * Math.min(1, 0.35 + speed / 18) * dt;
      const canRotate = forwardSpeed > 14;
      const pitchStep = canRotate ? Math.max(0, state.controlSurfaces.pitch) * 0.82 * dt : 0;

      euler.setFromQuaternion(quaternion, 'YXZ');
      euler.y += yawStep;
      euler.x = Math.max(-0.04, Math.min(0.28, euler.x + pitchStep));
      // Keep wings level while wheels are planted
      euler.z *= Math.max(0, 1 - dt * 8);
      quaternion.setFromEuler(euler);
    } else {
      // Full 3D flight rotation with coordinated bank-turn feel and utility-plane pitch stability
      const pitchRate = state.controlSurfaces.pitch * 0.82 * aeroAuthority;
      const rollRate = -state.controlSurfaces.roll * 1.55 * aeroAuthority;
      const yawRate = state.controlSurfaces.yaw * 0.78 * aeroAuthority;

      // Subtle stall nose-drop & buffet when below stall speed
      const stallDrop = state.stalling ? -0.38 * dt : 0;
      const buffetRoll = state.stalling ? Math.sin(performance.now() * 0.025) * 0.014 : 0;

      // Aerodynamic pitch envelope damping (prevents unintentional loops in a STOL bush plane)
      let pitchStep = pitchRate * dt + stallDrop;
      if (state.pitchRad > 0.48 && pitchStep > 0) pitchStep *= Math.max(0, 1 - (state.pitchRad - 0.48) * 4.5);
      if (state.pitchRad < -0.62 && pitchStep < 0) pitchStep *= Math.max(0, 1 - (-0.62 - state.pitchRad) * 4.5);

      // Gentle dihedral wing-leveling stability when pilot releases roll input
      let rollStep = rollRate * dt + buffetRoll;
      if (Math.abs(state.controlSurfaces.roll) < 0.05) {
        rollStep += -state.rollRad * 0.65 * dt;
      }

      eulerDelta.set(pitchStep, yawRate * dt, rollStep, 'YXZ');
      qDelta.setFromEuler(eulerDelta);
      quaternion.multiply(qDelta).normalize();

      // Gentle coordinated turn: banking naturally induces a smooth heading turn
      syncAngles();
      const bankTurn = Math.sin(state.rollRad) * 0.52 * Math.min(1, forwardSpeed / 28) * dt;
      if (Math.abs(bankTurn) > 0.00001) {
        qDelta.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bankTurn);
        quaternion.premultiply(qDelta).normalize();
      }
    }

    // Recompute basis after rotation
    fwd.set(0, 0, -1).applyQuaternion(quaternion);
    right.set(1, 0, 0).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);
    syncAngles();

    // ===== FORCES =====
    const acc = new THREE.Vector3(0, -GRAVITY, 0);

    // 1. Engine Thrust (STOL bush plane: crisp climb & takeoff power)
    const maxThrustAcc = 14.5;
    const thrust = fuelAvailable ? state.rpm * maxThrustAcc : 0;
    acc.addScaledVector(fwd, thrust);

    // 2. Aerodynamic Lift & Flaps
    const flapLiftBonus = state.flaps === 2 ? 0.36 : state.flaps === 1 ? 0.18 : 0;
    const flapDragBonus = state.flaps === 2 ? 0.0032 : state.flaps === 1 ? 0.001 : 0;

    // Angle of attack approximation from nose pitch relative to flight path
    const velUp = relVel.dot(up);
    const aoa = forwardSpeed > 3 ? Math.atan2(-velUp, forwardSpeed) : 0;
    const clampedAoa = Math.max(-0.32, Math.min(0.36, aoa));

    // Stall lift loss when airspeed below stall threshold
    const stallFactor = state.stalling ? Math.max(0.4, speedKt / stallKt) : 1.0;
    const liftCoeff = (0.31 + flapLiftBonus + clampedAoa * 2.5) * stallFactor;
    const liftAcc = Math.min(24, 0.0155 * forwardSpeed * forwardSpeed * liftCoeff);
    acc.addScaledVector(up, liftAcc);

    // 3. Parasitic, Flap & Induced Drag
    const baseDrag = 0.0022 + flapDragBonus + Math.abs(clampedAoa) * 0.0028;
    const brakeAirDrag = !state.onGround && state.brakes > 0 ? 0.0042 : 0;
    const dragMag = (baseDrag + brakeAirDrag) * speed * speed;
    if (speed > 0.1) {
      acc.addScaledVector(relVel, -dragMag / speed);
    }

    // 4. Lateral keel stability (keeps flight path tracking aircraft heading cleanly)
    if (!state.onGround && speed > 5) {
      const sideSlip = relVel.dot(right);
      acc.addScaledVector(right, -sideSlip * 1.45);
      // Dampen excessive vertical bobbing so pitch response feels crisp
      const vertSlip = relVel.dot(up);
      acc.addScaledVector(up, -vertSlip * 0.85);
    }

    // 5. Volcano thermal updraft near Gunung Api caldera
    const distVolcano = Math.hypot(position.x - 760, position.z + 560);
    if (!state.onGround && distVolcano < 340 && position.y > 180) {
      const thermal = (1 - distVolcano / 340) * 3.4;
      acc.y += thermal;
    }

    // Integrate velocity & position
    velocity.addScaledVector(acc, dt);

    // Clamp top overspeed slightly for playability
    const maxMps = 74;
    if (velocity.length() > maxMps) {
      velocity.setLength(maxMps);
    }

    position.addScaledVector(velocity, dt);
    state.verticalSpeed = velocity.y;

    // Keep within archipelago bounds (gentle soft nudge far beyond islands)
    const maxBound = 2400;
    if (Math.abs(position.x) > maxBound) position.x = Math.sign(position.x) * maxBound;
    if (Math.abs(position.z) > maxBound) position.z = Math.sign(position.z) * maxBound;
    if (position.y > 950) {
      position.y = 950;
      if (velocity.y > 0) velocity.y = 0;
    }

    // ===== TERRAIN & RUNWAY CONTACT / LANDING / BOUNCE / CRASH =====
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
        // Hard crash check
        if (sinkMps > 7.6 || rollDeg > 36 || pitchDeg < -22 || (!ground.onRunway && speed > 44 && sinkMps > 4.2)) {
          position.y = groundY - 0.35;
          velocity.multiplyScalar(0.1);
          state.damage = 100;
          state.crashed = true;
          if (rollDeg > 36) {
            state.crashReason = `Wing strike on touchdown (${Math.round(rollDeg)}° bank angle).`;
          } else if (pitchDeg < -22) {
            state.crashReason = 'Nose-down impact — flare gently before touching down.';
          } else if (!ground.onRunway) {
            state.crashReason = `Off-runway terrain impact (${sinkMps.toFixed(1)} m/s sink rate).`;
          } else {
            state.crashReason = `Severe hard landing (${sinkMps.toFixed(1)} m/s sink rate — flare before touchdown).`;
          }
          state.events.push({ type: 'crash', reason: state.crashReason });
          return;
        }

        // Bounce check (medium-hard touchdown!)
        if (sinkMps > 3.5 || rollDeg > 18) {
          position.y = groundY + 0.15;
          velocity.y = Math.max(2.2, sinkMps * 0.44);
          const dmg = Math.round(10 + sinkMps * 3.2 + Math.max(0, rollDeg - 12) * 0.6);
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

        // Clean touchdown!
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
      }

      // Ground rolling physics
      position.y = groundY;
      if (velocity.y < 0) velocity.y = 0;
      state.onGround = true;
      state.onRunway = ground.onRunway;

      // Align ground velocity with nose heading (tires grip the tarmac)
      const groundSpeed = Math.hypot(velocity.x, velocity.z);
      const rollingFric = ground.onRunway ? 0.32 : 1.45;
      const brakeFric = state.brakes > 0 ? 7.8 : state.throttle < 0.08 ? 1.8 : 0;
      const nextGroundSpeed = Math.max(0, groundSpeed - (rollingFric + brakeFric) * dt);

      const hFwdX = Math.sin(state.headingRad);
      const hFwdZ = -Math.cos(state.headingRad);
      velocity.x = hFwdX * nextGroundSpeed;
      velocity.z = hFwdZ * nextGroundSpeed;

      // Rough off-runway bumps at high speed
      if (!ground.onRunway && nextGroundSpeed > 18) {
        state.damage = Math.min(100, state.damage + dt * 6.5);
        if (state.damage >= 100) {
          state.crashed = true;
          state.crashReason = 'Landing gear collapsed on rough off-runway terrain.';
          state.events.push({ type: 'crash', reason: state.crashReason });
          return;
        }
      }

      // Lift-off transition if lift exceeds gravity during takeoff roll
      if (liftAcc > GRAVITY * 1.03 && state.pitchRad > 0.04 && forwardSpeed > 17) {
        state.onGround = false;
        velocity.y = Math.max(velocity.y, 1.8);
      }

      // Detect mission completion rollout stop on destination runway
      if (ground.onRunway === destRunwayId && nextGroundSpeed < 3.6 && state.landingRecord.touchedDown) {
        state.landedMissionRunway = true;
        state.events.push({ type: 'mission_landed', stripId: destRunwayId });
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
    step,
    getTelemetry,
  };
}
