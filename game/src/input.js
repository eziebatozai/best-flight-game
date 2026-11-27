/**
 * Unified desktop keyboard + mouse flight-and-combat input controller.
 * - Flight: W/S (or Up/Down) pitch, A/D (or Left/Right) roll, Q/E yaw,
 *   Shift/Ctrl or +/- or Wheel throttle, G flaps, B brake/airbrake.
 * - Combat: Space / Left Mouse primary 20mm autocannons, X / Right Mouse Surya-2 missile,
 *   Tab / T cycle locked target, F decoy flares.
 * - Mouse Aim: optional gentle cursor-guided deflection assist outside center deadzone,
 *   with instant keyboard priority so controls never conflict.
 * - Free-look: Middle Mouse drag or Alt+Drag with smooth auto-recentering.
 */
export function createInputController(canvas, actions) {
  const keys = new Set();
  const mouseLook = {
    yaw: 0,
    pitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  const mouseAim = {
    x: 0,
    y: 0,
    active: false,
    idleTimer: 0,
  };

  let mousePrimaryDown = false;
  let wheelThrottleQueue = 0;

  function onKeyDown(e) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) {
      e.preventDefault();
    }

    if (!keys.has(code)) {
      if (code === 'KeyC' || code === 'KeyV') actions.onToggleCamera();
      if (code === 'KeyG') actions.onCycleFlaps();
      if (code === 'KeyM') actions.onToggleMute();
      if (code === 'KeyX') actions.onFireMissile();
      if (code === 'Tab' || code === 'KeyT') actions.onCycleTarget();
      if (code === 'KeyF') actions.onDeployFlares();
      if (code === 'Enter') actions.onConfirm();
      if (code === 'KeyR' && e.altKey) actions.onRestart();
      if (code === 'Escape') actions.onMenu();
      if (code === 'Digit1') actions.onQuickMission(0);
      if (code === 'Digit2') actions.onQuickMission(1);
      if (code === 'Digit3') actions.onQuickMission(2);
      if (code === 'Digit4') actions.onQuickMission(3);
    }

    keys.add(code);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onBlur() {
    keys.clear();
    mousePrimaryDown = false;
    mouseLook.dragging = false;
    mouseAim.active = false;
  }

  function onMouseDown(e) {
    if (e.target !== canvas) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      mouseLook.dragging = true;
      mouseLook.lastX = e.clientX;
      mouseLook.lastY = e.clientY;
    } else if (e.button === 0) {
      mousePrimaryDown = true;
    } else if (e.button === 2) {
      e.preventDefault();
      actions.onFireMissile();
    }
  }

  function onMouseMove(e) {
    if (mouseLook.dragging) {
      const dx = e.clientX - mouseLook.lastX;
      const dy = e.clientY - mouseLook.lastY;
      mouseLook.lastX = e.clientX;
      mouseLook.lastY = e.clientY;
      mouseLook.yaw = Math.max(-1.45, Math.min(1.45, mouseLook.yaw - dx * 0.0045));
      mouseLook.pitch = Math.max(-0.55, Math.min(0.65, mouseLook.pitch - dy * 0.0038));
      return;
    }

    if (e.target === canvas) {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      mouseAim.x = Math.max(-1, Math.min(1, nx));
      mouseAim.y = Math.max(-1, Math.min(1, ny));
      mouseAim.active = true;
      mouseAim.idleTimer = 1.6;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mousePrimaryDown = false;
    if (e.button === 1 || e.button === 0) mouseLook.dragging = false;
  }

  function onContextMenu(e) {
    if (e.target === canvas) e.preventDefault();
  }

  function onWheel(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    wheelThrottleQueue += e.deltaY < 0 ? 0.07 : -0.07;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function sample(dt) {
    const pitchUp = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
    const pitchDown = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
    const rollRight = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
    const rollLeft = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0;
    const yawLeft = keys.has('KeyQ') ? 1 : 0;
    const yawRight = keys.has('KeyE') ? 1 : 0;

    let pitch = pitchUp - pitchDown;
    let roll = rollRight - rollLeft;

    // Optional gentle mouse-aim assist outside small center deadzone when keyboard stick is neutral
    if (mouseAim.active) {
      mouseAim.idleTimer -= dt;
      if (mouseAim.idleTimer <= 0) {
        mouseAim.x *= Math.exp(-dt * 4);
        mouseAim.y *= Math.exp(-dt * 4);
        if (Math.hypot(mouseAim.x, mouseAim.y) < 0.02) mouseAim.active = false;
      }
      if (pitch === 0 && roll === 0) {
        const dz = 0.14;
        if (Math.abs(mouseAim.x) > dz) {
          roll = Math.sign(mouseAim.x) * Math.min(0.65, (Math.abs(mouseAim.x) - dz) * 0.9);
        }
        if (Math.abs(mouseAim.y) > dz) {
          pitch = Math.sign(mouseAim.y) * Math.min(0.55, (Math.abs(mouseAim.y) - dz) * 0.8);
        }
      }
    }

    const thrUp = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal') ? 1 : 0;
    const thrDown = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus') ? 1 : 0;

    let throttleDelta = thrUp - thrDown;
    if (wheelThrottleQueue !== 0 && dt > 0) {
      throttleDelta += wheelThrottleQueue / Math.max(0.016, dt * 0.68);
      wheelThrottleQueue = 0;
    }

    if (!mouseLook.dragging) {
      const decay = Math.exp(-dt * 4.4);
      mouseLook.yaw *= decay;
      mouseLook.pitch *= decay;
      if (Math.abs(mouseLook.yaw) < 0.002) mouseLook.yaw = 0;
      if (Math.abs(mouseLook.pitch) < 0.002) mouseLook.pitch = 0;
    }

    return {
      pitch,
      roll,
      yaw: yawLeft - yawRight,
      throttleDelta,
      brake: keys.has('KeyB'),
      fireCannon: keys.has('Space') || mousePrimaryDown,
    };
  }

  return {
    mouseLook,
    mouseAim,
    sample,
  };
}
