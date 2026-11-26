/**
 * Keyboard, mouse-look, and mouse-wheel input controller for Merpati Run.
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

  let wheelThrottleQueue = 0;

  function onKeyDown(e) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }

    if (!keys.has(code)) {
      if (code === 'KeyC' || code === 'KeyV') actions.onToggleCamera();
      if (code === 'KeyG' || code === 'KeyB') actions.onCycleFlaps();
      if (code === 'KeyM') actions.onToggleMute();
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
    mouseLook.dragging = false;
  }

  function onMouseDown(e) {
    if (e.target !== canvas) return;
    mouseLook.dragging = true;
    mouseLook.lastX = e.clientX;
    mouseLook.lastY = e.clientY;
  }

  function onMouseMove(e) {
    if (!mouseLook.dragging) return;
    const dx = e.clientX - mouseLook.lastX;
    const dy = e.clientY - mouseLook.lastY;
    mouseLook.lastX = e.clientX;
    mouseLook.lastY = e.clientY;
    mouseLook.yaw = Math.max(-1.45, Math.min(1.45, mouseLook.yaw - dx * 0.0045));
    mouseLook.pitch = Math.max(-0.55, Math.min(0.65, mouseLook.pitch - dy * 0.0038));
  }

  function onMouseUp() {
    mouseLook.dragging = false;
  }

  function onWheel(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    wheelThrottleQueue += e.deltaY < 0 ? 0.06 : -0.06;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function sample(dt) {
    // Pitch: S/ArrowDown pulls nose up (+1), W/ArrowUp pushes nose down (-1)
    const pitchUp = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
    const pitchDown = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;

    // Roll: D/ArrowRight banks right (+1), A/ArrowLeft banks left (-1)
    const rollRight = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
    const rollLeft = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0;

    // Yaw: Q yaws left (+1 around +Y), E yaws right (-1)
    const yawLeft = keys.has('KeyQ') ? 1 : 0;
    const yawRight = keys.has('KeyE') ? 1 : 0;

    // Throttle: Shift / R / Equal increases; Ctrl / F / Minus decreases
    const thrUp =
      keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal') || keys.has('KeyR') ? 1 : 0;
    const thrDown =
      keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus') || keys.has('KeyF') ? 1 : 0;

    let throttleDelta = thrUp - thrDown;
    if (wheelThrottleQueue !== 0 && dt > 0) {
      throttleDelta += wheelThrottleQueue / Math.max(0.016, dt * 0.65);
      wheelThrottleQueue = 0;
    }

    // Gentle auto-recenter for mouse look when not dragging so camera never fights pilot
    if (!mouseLook.dragging) {
      const decay = Math.exp(-dt * 4.2);
      mouseLook.yaw *= decay;
      mouseLook.pitch *= decay;
      if (Math.abs(mouseLook.yaw) < 0.002) mouseLook.yaw = 0;
      if (Math.abs(mouseLook.pitch) < 0.002) mouseLook.pitch = 0;
    }

    return {
      pitch: pitchUp - pitchDown,
      roll: rollRight - rollLeft,
      yaw: yawLeft - yawRight,
      throttleDelta,
      brake: keys.has('Space'),
    };
  }

  return {
    mouseLook,
    sample,
  };
}
