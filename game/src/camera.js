import * as THREE from '../vendor/three.min.js';

/**
 * Combat-ready 3D camera controller supporting Chase View, Cockpit View,
 * explosion/gunfire trauma shake, dynamic War Emergency Power FOV kick,
 * auto-recentering mouse free-look, and runway showcase cameras.
 */
export function createCameraController(camera) {
  let mode = 'chase';
  const smoothPos = new THREE.Vector3();
  const smoothLook = new THREE.Vector3();
  let currentFov = 60;
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

  function update(dt, elapsed, gameState, flight, mouseLook, shakeOffset, snapImmediate = false) {
    const pos = flight.position;
    const quat = flight.quaternion;
    const shake = shakeOffset || { x: 0, y: 0, z: 0, roll: 0 };

    fwd.set(0, 0, -1).applyQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    right.set(1, 0, 0).applyQuaternion(quat);

    if (gameState === 'title') {
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
      // Showcase view placing the whole armed Stormbird proudly on the left-center of the runway beside the debrief panel
      const horizFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const horizRight = new THREE.Vector3(-horizFwd.z, 0, horizFwd.x).normalize();
      const angle = 0.42 + Math.sin(elapsed * 0.25) * 0.08;

      desiredPos
        .copy(pos)
        .addScaledVector(horizFwd, Math.cos(angle) * 19.5)
        .addScaledVector(horizRight, -Math.sin(angle) * 15.5)
        .add(new THREE.Vector3(0, 4.9, 0));

      // Camera looks back from front-port, so -horizRight shifts gaze right and frames aircraft cleanly left-of-center
      desiredLook
        .copy(pos)
        .addScaledVector(horizRight, -4.4)
        .add(new THREE.Vector3(0, 1.35, 0));

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
      // First-person pilot eye aligned cleanly behind the slimmed glare shield & holographic reflex gunsight
      const targetFov = flight.wepActive ? 67 : 65;
      currentFov += (targetFov - currentFov) * (snapImmediate ? 1 : Math.min(1, dt * 6));
      camera.fov = currentFov;
      camera.updateProjectionMatrix();

      const eyeLocal = new THREE.Vector3(-0.04 + shake.x * 0.05, 0.515 + shake.y * 0.05, -0.06);
      desiredPos.copy(eyeLocal).applyQuaternion(quat).add(pos);

      const lookYaw = mouseLook.yaw;
      const lookPitch = mouseLook.pitch;
      const localLookDir = new THREE.Vector3(
        Math.sin(lookYaw) * Math.cos(lookPitch),
        Math.sin(lookPitch) - 0.115,
        -Math.cos(lookYaw) * Math.cos(lookPitch)
      );
      desiredLook.copy(localLookDir).applyQuaternion(quat).multiplyScalar(32).add(desiredPos);

      camera.position.copy(desiredPos);
      camera.up.copy(up);
      camera.lookAt(desiredLook);
      return;
    }

    // ===== COMBAT CHASE VIEW =====
    const speedBonusFov = Math.max(0, (flight.airspeed - 42) * 0.18) + (flight.wepActive ? 4.2 : 0);
    const targetFov = Math.min(69, 60 + speedBonusFov);
    currentFov += (targetFov - currentFov) * (snapImmediate ? 1 : Math.min(1, dt * 5));
    camera.fov = currentFov;
    camera.updateProjectionMatrix();

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

    const chaseDist = 14.6 + Math.min(3.6, flight.airspeed * 0.052);
    const chaseHeight = 4.35 + orbitPitch * 9.0 - Math.sin(flight.pitchRad) * 2.2;

    desiredPos
      .copy(pos)
      .addScaledVector(rotFwd, -chaseDist)
      .add(new THREE.Vector3(0, chaseHeight, 0));
    desiredPos.y = Math.max(2.5, desiredPos.y);

    desiredLook
      .copy(pos)
      .addScaledVector(fwd, 24)
      .add(new THREE.Vector3(0, 1.2, 0));

    if (!initialized || snapImmediate) {
      smoothPos.copy(desiredPos);
      smoothLook.copy(desiredLook);
      initialized = true;
    } else {
      const kPos = 1 - Math.exp(-dt * 7.2);
      const kLook = 1 - Math.exp(-dt * 11.2);
      smoothPos.lerp(desiredPos, kPos);
      smoothLook.lerp(desiredLook, kLook);
    }

    camera.position.copy(smoothPos).add(new THREE.Vector3(shake.x, shake.y, shake.z));
    const bankHint = Math.sin(flight.rollRad) * 0.16 + shake.roll;
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
