import * as THREE from '../vendor/three.min.js';

/**
 * Pilot-friendly 3D camera controller supporting Chase View, Cockpit View,
 * gentle auto-recentering mouse look, and title/landing showcase cameras.
 */
export function createCameraController(camera) {
  let mode = 'chase'; // 'chase' | 'cockpit'
  const smoothPos = new THREE.Vector3();
  const smoothLook = new THREE.Vector3();
  let initialized = false;

  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desiredPos = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();

  function setMode(nextMode) {
    mode = nextMode === 'cockpit' ? 'cockpit' : 'chase';
    initialized = false;
  }

  function toggleMode() {
    setMode(mode === 'chase' ? 'cockpit' : 'chase');
    return mode;
  }

  function getMode() {
    return mode;
  }

  function snap() {
    initialized = false;
  }

  /**
   * Update active camera transform based on game state, aircraft pose, and mouse look.
   */
  function update(dt, elapsed, gameState, flight, mouseLook, snapImmediate = false) {
    const pos = flight.position;
    const quat = flight.quaternion;

    fwd.set(0, 0, -1).applyQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    right.set(1, 0, 0).applyQuaternion(quat);

    if (gameState === 'title') {
      // Heroic rear-3/4 runway view framing the whole Merpati D-7 cleanly right-of-center
      // so the left mission launcher never overlaps the plane, runway, ring ahead, or volcano!
      const horizFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const horizRight = new THREE.Vector3(-horizFwd.z, 0, horizFwd.x).normalize();
      const sway = Math.sin(elapsed * 0.35) * 0.35;

      desiredPos
        .copy(pos)
        .addScaledVector(horizFwd, -15.5)
        .addScaledVector(horizRight, -5.2 + sway)
        .add(new THREE.Vector3(0, 4.3, 0));

      desiredLook
        .copy(pos)
        .addScaledVector(horizFwd, 18)
        .addScaledVector(horizRight, -2.4)
        .add(new THREE.Vector3(0, 2.0, 0));

      camera.fov = 55;
      camera.updateProjectionMatrix();
      camera.position.copy(desiredPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(desiredLook);
      return;
    }

    if (gameState === 'landed') {
      // Celebratory front-quarter showcase view placing Merpati D-7 cleanly left-of-center beside the logbook
      const horizFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const horizRight = new THREE.Vector3(-horizFwd.z, 0, horizFwd.x).normalize();
      const angle = 0.46 + Math.sin(elapsed * 0.28) * 0.12;

      desiredPos
        .copy(pos)
        .addScaledVector(horizFwd, Math.cos(angle) * 16.0)
        .addScaledVector(horizRight, -Math.sin(angle) * 15.5)
        .add(new THREE.Vector3(0, 4.6, 0));

      desiredLook
        .copy(pos)
        .addScaledVector(horizRight, 4.2)
        .add(new THREE.Vector3(0, 1.2, 0));

      camera.fov = 54;
      camera.updateProjectionMatrix();
      camera.position.copy(desiredPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(desiredLook);
      return;
    }

    if (gameState === 'crashed') {
      const horizFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const horizRight = new THREE.Vector3(-horizFwd.z, 0, horizFwd.x).normalize();
      desiredPos
        .copy(pos)
        .addScaledVector(horizFwd, -15)
        .addScaledVector(horizRight, 9)
        .add(new THREE.Vector3(0, 6.2, 0));
      camera.fov = 56;
      camera.updateProjectionMatrix();
      camera.position.lerp(desiredPos, snapImmediate ? 1 : Math.min(1, dt * 3));
      camera.up.set(0, 1, 0);
      camera.lookAt(pos);
      return;
    }

    if (mode === 'cockpit') {
      // First-person seated pilot eye inside cabin, clear view of all backlit gauges + runway ahead
      camera.fov = 64;
      camera.updateProjectionMatrix();

      const eyeLocal = new THREE.Vector3(-0.04, 0.56, -0.18);
      desiredPos.copy(eyeLocal).applyQuaternion(quat).add(pos);

      const lookYaw = mouseLook.yaw;
      const lookPitch = mouseLook.pitch;
      const localLookDir = new THREE.Vector3(
        Math.sin(lookYaw) * Math.cos(lookPitch),
        Math.sin(lookPitch) - 0.14,
        -Math.cos(lookYaw) * Math.cos(lookPitch)
      );
      desiredLook.copy(localLookDir).applyQuaternion(quat).multiplyScalar(30).add(desiredPos);

      camera.position.copy(desiredPos);
      camera.up.copy(up);
      camera.lookAt(desiredLook);
      return;
    }

    // ===== CHASE VIEW (never fights the pilot!) =====
    camera.fov = 60;
    camera.updateProjectionMatrix();

    // Smoothly orbit with mouseLook yaw/pitch around the aircraft's heading
    const horizFwd = new THREE.Vector3(fwd.x, 0, fwd.z);
    if (horizFwd.lengthSq() < 0.001) horizFwd.set(0, 0, -1);
    horizFwd.normalize();

    const orbitYaw = mouseLook.yaw;
    const orbitPitch = Math.max(-0.35, Math.min(0.45, mouseLook.pitch));
    const cosY = Math.cos(orbitYaw);
    const sinY = Math.sin(orbitYaw);

    const rotFwd = new THREE.Vector3(
      horizFwd.x * cosY - horizFwd.z * sinY,
      0,
      horizFwd.x * sinY + horizFwd.z * cosY
    );

    const chaseDist = 15.2 + Math.min(3.5, flight.airspeed * 0.055);
    const chaseHeight = 4.6 + orbitPitch * 9.0 - Math.sin(flight.pitchRad) * 2.2;

    desiredPos
      .copy(pos)
      .addScaledVector(rotFwd, -chaseDist)
      .add(new THREE.Vector3(0, chaseHeight, 0));

    // Keep camera safely above water/ground
    desiredPos.y = Math.max(2.5, desiredPos.y);

    desiredLook
      .copy(pos)
      .addScaledVector(fwd, 20)
      .add(new THREE.Vector3(0, 1.3, 0));

    if (!initialized || snapImmediate) {
      smoothPos.copy(desiredPos);
      smoothLook.copy(desiredLook);
      initialized = true;
    } else {
      const kPos = 1 - Math.exp(-dt * 6.5);
      const kLook = 1 - Math.exp(-dt * 10.5);
      smoothPos.lerp(desiredPos, kPos);
      smoothLook.lerp(desiredLook, kLook);
    }

    camera.position.copy(smoothPos);
    // Keep world horizon mostly level with just a tiny hint of bank immersion so camera never disorients
    const bankHint = Math.sin(flight.rollRad) * 0.14;
    camera.up.set(-right.x * bankHint, 1, -right.z * bankHint).normalize();
    camera.lookAt(smoothLook);
  }

  return {
    setMode,
    toggleMode,
    getMode,
    snap,
    update,
  };
}
