import * as THREE from '../vendor/three.min.js';
import { AIRSTRIPS, VOLCANO_POS } from './world.js';

function createWingMarkingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Cream STOL wing surface
  ctx.fillStyle = '#f3eee2';
  ctx.fillRect(0, 0, 512, 128);

  // Crimson & gold courier stripes near tips
  ctx.fillStyle = '#c62828';
  ctx.fillRect(0, 0, 58, 128);
  ctx.fillRect(454, 0, 58, 128);
  ctx.fillStyle = '#f2b12c';
  ctx.fillRect(58, 0, 14, 128);
  ctx.fillRect(440, 0, 14, 128);

  // Leading-edge trim
  ctx.fillStyle = '#c62828';
  ctx.fillRect(0, 0, 512, 14);

  // Registration code PK-MRP
  ctx.fillStyle = '#1b2836';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PK-MRP', 175, 84);
  ctx.fillText('MERPATI', 345, 84);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Draw a realistic illuminated circular aircraft gauge.
 */
function drawDial(ctx, cx, cy, r, label, valueText, angleRad, colorArcs) {
  ctx.save();
  // Metallic bezel
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#2d3743';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#68798a';
  ctx.stroke();

  // Backlit dial face
  const grad = ctx.createRadialGradient(cx, cy - r * 0.25, 4, cx, cy, r);
  grad.addColorStop(0, '#162535');
  grad.addColorStop(1, '#0a121b');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Optional colored speed/rpm arcs
  if (colorArcs) {
    for (const arc of colorArcs) {
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6, arc.start, arc.end);
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }

  // Tick marks
  ctx.strokeStyle = '#d9e6f2';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 3 === 0 ? r - 12 : r - 8;
    ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
    ctx.stroke();
  }

  // Label & digital readout
  ctx.fillStyle = '#8eb3cc';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - r * 0.36);

  ctx.fillStyle = '#ffd66e';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(valueText, cx, cy + r * 0.56);

  // Glowing needle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.strokeStyle = '#ff9d3b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(r - 10, 0);
  ctx.stroke();
  ctx.restore();

  // Center cap
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#c5d3df';
  ctx.fill();
  ctx.restore();
}

/**
 * Draw an artificial horizon (attitude indicator) inside a clipped circle.
 */
function drawAttitudeGauge(ctx, cx, cy, r, pitchRad, rollRad) {
  ctx.save();
  // Bezel
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#2d3743';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#73889c';
  ctx.stroke();

  // Clip inner sphere
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rollRad);
  const pitchPx = Math.max(-r * 0.85, Math.min(r * 0.85, pitchRad * 78));

  // Sky half
  ctx.fillStyle = '#1f7cc4';
  ctx.fillRect(-r * 1.6, -r * 1.8 + pitchPx, r * 3.2, r * 1.8);
  // Earth half
  ctx.fillStyle = '#7c4c26';
  ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.8);

  // Horizon line & pitch ladder
  ctx.strokeStyle = '#fff5dc';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();

  ctx.lineWidth = 1.4;
  for (const deg of [-20, -10, 10, 20]) {
    const dy = pitchPx - (deg * Math.PI) / 180 * 78;
    const w = Math.abs(deg) === 10 ? 14 : 22;
    ctx.beginPath();
    ctx.moveTo(-w, dy);
    ctx.lineTo(w, dy);
    ctx.stroke();
  }
  ctx.restore();

  // Fixed orange aircraft wing bars
  ctx.strokeStyle = '#ffb32c';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.lineTo(cx - 8, cy + 5);
  ctx.moveTo(cx + 26, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx + 8, cy + 5);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb32c';
  ctx.fill();
  ctx.restore();
}

/**
 * Draw the illuminated archipelago navigation MFD screen.
 */
function drawNavMfd(ctx, x, y, w, h, telemetry) {
  ctx.save();
  ctx.fillStyle = '#071822';
  ctx.strokeStyle = '#3dc8c2';
  ctx.lineWidth = 2.2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();

  const cx = x + w * 0.5;
  const cy = y + h * 0.54;
  const scale = 0.044;

  // Range rings
  ctx.strokeStyle = 'rgba(79, 227, 216, 0.22)';
  ctx.lineWidth = 1;
  for (const rad of [24, 48, 72]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Transform world coordinates into aircraft-up radar frame
  const hdg = telemetry.headingRad;
  const toRadar = (wx, wz) => {
    const dx = wx - telemetry.pos.x;
    const dz = wz - telemetry.pos.z;
    const cos = Math.cos(hdg);
    const sin = Math.sin(hdg);
    const rx = dx * cos + dz * sin;
    const ry = -dx * sin + dz * cos;
    return [cx + rx * scale, cy + ry * scale];
  };

  // Volcano marker
  const [vx, vy] = toRadar(VOLCANO_POS.x, VOLCANO_POS.z);
  ctx.fillStyle = 'rgba(255, 110, 56, 0.45)';
  ctx.beginPath();
  ctx.arc(vx, vy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff985e';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('G.API', vx, vy + 3);

  // Airstrips
  for (const strip of AIRSTRIPS) {
    const [sx, sy] = toRadar(strip.x, strip.z);
    ctx.fillStyle = strip.id === telemetry.destRunwayId ? '#3ee08e' : '#7ec5d9';
    ctx.fillRect(sx - 4, sy - 4, 8, 8);
  }

  // Target waypoint line & pulsing diamond
  if (telemetry.targetPos) {
    const [tx, ty] = toRadar(telemetry.targetPos.x, telemetry.targetPos.z);
    ctx.strokeStyle = 'rgba(255, 211, 107, 0.75)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 6);
    ctx.lineTo(tx + 6, ty);
    ctx.lineTo(tx, ty + 6);
    ctx.lineTo(tx - 6, ty);
    ctx.closePath();
    ctx.fill();
  }

  // Own aircraft triangle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.lineTo(cx, cy + 3);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.closePath();
  ctx.fill();

  // Header label
  ctx.fillStyle = '#4fe3d8';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('NUSANTARA NAV', x + 7, y + 13);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd36b';
  ctx.fillText(`${Math.round(telemetry.targetDist)}m`, x + w - 7, y + 13);
  ctx.restore();
}

/**
 * Create the 3D Merpati D-7 bush plane model with moving control surfaces,
 * spinning propeller, nav lights, cockpit interior, and live backlit instrument panel.
 */
export function createPlane() {
  const root = new THREE.Group();
  const airframe = new THREE.Group();
  root.add(airframe);

  // Materials
  const creamMat = new THREE.MeshStandardMaterial({ color: '#f3eee2', roughness: 0.42, metalness: 0.14 });
  const redMat = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.38, metalness: 0.18 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f2b12c', roughness: 0.36, metalness: 0.25 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#242c36', roughness: 0.55, metalness: 0.5 });
  const strutMat = new THREE.MeshStandardMaterial({ color: '#45515e', roughness: 0.45, metalness: 0.6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1b1e22', roughness: 0.92 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#9fd8f0',
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  // ===== FUSELAGE (aircraft nose points toward -Z!) =====
  // Cabin mid-body (hollowed visually with side walls & floor so cockpit view looks clean)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.18, 2.5), darkMetal);
  floor.position.set(0, -0.32, -0.2);
  airframe.add(floor);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.36, 2.7), creamMat);
  belly.position.set(0, -0.5, -0.15);
  airframe.add(belly);

  // Lower cabin side panels (below windows)
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 2.45), creamMat);
    sideWall.position.set(side * 0.65, -0.14, -0.2);
    airframe.add(sideWall);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.16, 2.48), redMat);
    stripe.position.set(side * 0.655, -0.2, -0.2);
    airframe.add(stripe);

    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 2.48), goldMat);
    goldTrim.position.set(side * 0.656, -0.09, -0.2);
    airframe.add(goldTrim);
  }

  // Forward engine cowling (tapered nose)
  const cowlMain = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.96, 1.55), creamMat);
  cowlMain.position.set(0, -0.16, -2.18);
  airframe.add(cowlMain);

  const cowlTopRed = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.16, 1.5), redMat);
  cowlTopRed.position.set(0, 0.34, -2.18);
  airframe.add(cowlTopRed);

  const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.62, 0.65, 10), redMat);
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.set(0, -0.14, -3.22);
  airframe.add(noseCone);

  // Engine intake scoop under nose
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.55), darkMetal);
  intake.position.set(0, -0.62, -2.75);
  airframe.add(intake);

  // Tapered aft tailcone (+Y rotates to +Z aft, so topRadius=0.18 at tail, bottomRadius=0.62 at cabin!)
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.62, 3.6, 12), creamMat);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.0, 2.75);
  airframe.add(tailCone);

  const tailStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.635, 3.4, 12, 1, true), redMat);
  tailStripe.rotation.x = Math.PI / 2;
  tailStripe.scale.set(1, 1, 0.26);
  tailStripe.position.set(0, -0.06, 2.7);
  airframe.add(tailStripe);

  // ===== GLAZED CANOPY & WINDSHIELD FRAME =====
  const canopyGroup = new THREE.Group();
  // Windshield A-pillars & center post (visible from cockpit!)
  const pillarGeo = new THREE.CylinderGeometry(0.032, 0.036, 1.08, 6);
  const leftPillar = new THREE.Mesh(pillarGeo, darkMetal);
  leftPillar.position.set(-0.62, 0.52, -1.16);
  leftPillar.rotation.set(0.56, 0, -0.1);
  canopyGroup.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, darkMetal);
  rightPillar.position.set(0.62, 0.52, -1.16);
  rightPillar.rotation.set(0.56, 0, 0.1);
  canopyGroup.add(rightPillar);

  const centerPost = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 1.02, 6), darkMetal);
  centerPost.position.set(0, 0.54, -1.24);
  centerPost.rotation.x = 0.58;
  canopyGroup.add(centerPost);

  // Standby magnetic compass mounted at top of center windshield post
  const compassHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.1), darkMetal);
  compassHousing.position.set(0, 0.8, -1.04);
  canopyGroup.add(compassHousing);

  // Rear cabin pillars & roof header
  for (const side of [-1, 1]) {
    const rearPost = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.08), creamMat);
    rearPost.position.set(side * 0.62, 0.48, 0.9);
    canopyGroup.add(rearPost);

    const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 1.85), darkMetal);
    sideFrame.position.set(side * 0.62, 0.88, -0.02);
    canopyGroup.add(sideFrame);
  }

  // Translucent windshield glass pane (hidden in cockpit view if needed, subtle tint)
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.96), glassMat);
  windshield.position.set(0, 0.53, -1.2);
  windshield.rotation.x = -0.96;
  canopyGroup.add(windshield);

  airframe.add(canopyGroup);

  // ===== HIGH STOL WING + STRUTS + CONTROL SURFACES =====
  const wingTex = createWingMarkingTexture();
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex, roughness: 0.45, metalness: 0.12 });
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 1.82), wingMat);
  mainWing.position.set(0, 0.92, -0.25);
  mainWing.castShadow = true;
  airframe.add(mainWing);

  // Wingtip fairings & Navigation Lights
  const navLights = [];
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 1.55), redMat);
    tip.position.set(side * 5.82, 0.94, -0.22);
    airframe.add(tip);

    // Diagonal STOL wing strut
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.25, 6), strutMat);
    strut.position.set(side * 2.05, 0.18, -0.28);
    strut.rotation.z = side * -1.04;
    airframe.add(strut);

    // Wingtip Navigation Light (red left, green right)
    const lightMat = new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff3333' : '#2aff76' });
    const navBulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lightMat);
    navBulb.position.set(side * 5.98, 0.95, -0.82);
    airframe.add(navBulb);
    navLights.push(navBulb);

    // Leading-edge landing light
    const landingBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#fff7d4' })
    );
    landingBulb.position.set(side * 2.35, 0.92, -1.16);
    airframe.add(landingBulb);
  }

  // Animated Ailerons (outer trailing edge)
  const leftAileronPivot = new THREE.Group();
  leftAileronPivot.position.set(-4.1, 0.9, 0.66);
  const leftAileron = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.34), redMat);
  leftAileron.position.z = 0.17;
  leftAileronPivot.add(leftAileron);
  airframe.add(leftAileronPivot);

  const rightAileronPivot = new THREE.Group();
  rightAileronPivot.position.set(4.1, 0.9, 0.66);
  const rightAileron = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.34), redMat);
  rightAileron.position.z = 0.17;
  rightAileronPivot.add(rightAileron);
  airframe.add(rightAileronPivot);

  // Animated Flaps (inner trailing edge)
  const leftFlapPivot = new THREE.Group();
  leftFlapPivot.position.set(-1.75, 0.88, 0.66);
  const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.38), goldMat);
  leftFlap.position.z = 0.19;
  leftFlapPivot.add(leftFlap);
  airframe.add(leftFlapPivot);

  const rightFlapPivot = new THREE.Group();
  rightFlapPivot.position.set(1.75, 0.88, 0.66);
  const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.38), goldMat);
  rightFlap.position.z = 0.19;
  rightFlapPivot.add(rightFlap);
  airframe.add(rightFlapPivot);

  // ===== EMPENNAGE (TAIL FIN, RUDDER, ELEVATOR) =====
  const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.85, 1.35), redMat);
  vFin.position.set(0, 0.98, 4.05);
  airframe.add(vFin);

  const vFinStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.38), goldMat);
  vFinStripe.position.set(0, 1.48, 4.05);
  airframe.add(vFinStripe);

  const rudderPivot = new THREE.Group();
  rudderPivot.position.set(0, 0.98, 4.72);
  const rudderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.75, 0.56), creamMat);
  rudderMesh.position.z = 0.28;
  rudderPivot.add(rudderMesh);
  airframe.add(rudderPivot);

  // White tail strobe light
  const strobeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const strobeBulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), strobeMat);
  strobeBulb.position.set(0, 1.95, 4.15);
  airframe.add(strobeBulb);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 0.86), creamMat);
  hStab.position.set(0, 0.22, 4.15);
  airframe.add(hStab);

  const elevatorPivot = new THREE.Group();
  elevatorPivot.position.set(0, 0.22, 4.58);
  const elevatorMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.42), redMat);
  elevatorMesh.position.z = 0.21;
  elevatorPivot.add(elevatorMesh);
  airframe.add(elevatorPivot);

  // ===== RUGGED STOL LANDING GEAR =====
  const gearGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 1.15, 6), strutMat);
    leg.position.set(side * 0.95, -0.82, -0.45);
    leg.rotation.z = side * 0.42;
    gearGroup.add(leg);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.24, -1.16, -0.45);
    gearGroup.add(wheel);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 10), goldMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 1.24, -1.16, -0.45);
    gearGroup.add(hub);
  }
  // Nose gear
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.95, 6), strutMat);
  noseLeg.position.set(0, -0.88, -2.55);
  gearGroup.add(noseLeg);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), tireMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, -1.18, -2.55);
  gearGroup.add(noseWheel);
  airframe.add(gearGroup);

  // ===== SPINNING 3-BLADE PROPELLER + BLUR DISC =====
  const propGroup = new THREE.Group();
  propGroup.position.set(0, -0.14, -3.58);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.48, 12), redMat);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.18;
  propGroup.add(spinner);

  const bladeMat = new THREE.MeshStandardMaterial({ color: '#1b1f26', roughness: 0.4, metalness: 0.45 });
  for (let b = 0; b < 3; b++) {
    const bladeWrap = new THREE.Group();
    bladeWrap.rotation.z = (b * Math.PI * 2) / 3;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.08, 0.03), bladeMat);
    blade.position.y = 0.56;
    bladeWrap.add(blade);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.18, 0.034), goldMat);
    tip.position.y = 1.02;
    bladeWrap.add(tip);
    propGroup.add(bladeWrap);
  }

  const propDiscMat = new THREE.MeshBasicMaterial({
    color: '#d8e4ec',
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propDisc = new THREE.Mesh(new THREE.RingGeometry(0.24, 1.12, 24), propDiscMat);
  propDisc.position.z = -0.02;
  propGroup.add(propDisc);
  airframe.add(propGroup);

  // ===== 3D COCKPIT INTERIOR & LIVE BACKLIT INSTRUMENT PANEL =====
  const cockpitGroup = new THREE.Group();

  // Pilot seat backrest (visible in chase view)
  const seatMat = new THREE.MeshStandardMaterial({ color: '#3b2b20', roughness: 0.85 });
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.14), seatMat);
  seatBack.position.set(-0.22, 0.18, 0.35);
  cockpitGroup.add(seatBack);
  const coSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.14), seatMat);
  coSeatBack.position.set(0.28, 0.18, 0.35);
  cockpitGroup.add(coSeatBack);

  // Glare shield (sleek low-profile dashboard hood that doesn't obstruct windshield or annunciators)
  const glareShield = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.045, 0.42), darkMetal);
  glareShield.position.set(0, 0.365, -1.12);
  cockpitGroup.add(glareShield);

  // Live CanvasTexture Instrument Panel
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 768;
  panelCanvas.height = 288;
  const panelCtx = panelCanvas.getContext('2d');
  const panelTexture = new THREE.CanvasTexture(panelCanvas);

  const panelMat = new THREE.MeshBasicMaterial({ map: panelTexture });
  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.44), panelMat);
  panelMesh.position.set(0, 0.125, -0.98);
  panelMesh.rotation.x = -0.12;
  cockpitGroup.add(panelMesh);

  // Animated 3D Control Yoke (positioned low-left so all 6 gauges stay crisp and legible!)
  const yokeColumn = new THREE.Group();
  yokeColumn.position.set(-0.27, -0.09, -0.74);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8), strutMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.14;
  yokeColumn.add(shaft);

  const yokeWheel = new THREE.Group();
  const hubBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.036, 0.035), darkMetal);
  yokeWheel.add(hubBar);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.14, 8), darkMetal);
    grip.position.set(s * 0.14, 0.045, 0);
    yokeWheel.add(grip);
  }
  yokeColumn.add(yokeWheel);
  cockpitGroup.add(yokeColumn);

  // Throttle Lever Quadrant (center-low console)
  const throttlePivot = new THREE.Group();
  throttlePivot.position.set(0.04, -0.14, -0.82);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.17, 6), strutMat);
  leverArm.position.y = 0.08;
  throttlePivot.add(leverArm);
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), redMat);
  leverKnob.position.y = 0.17;
  throttlePivot.add(leverKnob);
  cockpitGroup.add(throttlePivot);

  airframe.add(cockpitGroup);

  // ===== TOUCHDOWN SMOKE / WINGTIP TRAIL PARTICLES =====
  const smokePool = [];
  const smokeGeo = new THREE.SphereGeometry(0.65, 8, 6);
  const smokeMat = new THREE.MeshBasicMaterial({ color: '#f3eee4', transparent: true, opacity: 0.65 });
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
    p.visible = false;
    smokePool.push({ mesh: p, life: 0, maxLife: 1, vel: new THREE.Vector3() });
  }
  let smokeIdx = 0;

  function spawnSmoke(worldPos, count = 4, dark = false) {
    for (let i = 0; i < count; i++) {
      const slot = smokePool[smokeIdx % smokePool.length];
      smokeIdx++;
      slot.mesh.visible = true;
      slot.mesh.position.copy(worldPos);
      slot.mesh.position.x += (Math.random() - 0.5) * 1.4;
      slot.mesh.position.z += (Math.random() - 0.5) * 1.4;
      slot.mesh.material.color.set(dark ? '#3c3836' : '#f4f0e8');
      slot.mesh.scale.setScalar(0.6);
      slot.life = 0;
      slot.maxLife = 0.85 + Math.random() * 0.5;
      slot.vel.set((Math.random() - 0.5) * 2.5, 1.4 + Math.random() * 1.8, (Math.random() - 0.5) * 2.5);
    }
  }

  function renderInstrumentPanel(telemetry) {
    const ctx = panelCtx;
    const W = panelCanvas.width;
    const H = panelCanvas.height;

    // Brushed slate-black cockpit fascia
    ctx.fillStyle = '#141c24';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#384858';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    // Top warning annunciator strip
    const warnings = [
      { label: 'STALL', active: telemetry.stalling, color: '#ff3b3b' },
      { label: 'LOW FUEL', active: telemetry.fuel < 22, color: '#ffb020' },
      { label: `FLAPS ${telemetry.flapsDeg}°`, active: telemetry.flapsDeg > 0, color: '#3ee08e' },
      { label: 'GEAR DN', active: true, color: '#3ee08e' },
      { label: 'OVERSPD', active: telemetry.overspeed, color: '#ff3b3b' },
      { label: 'DMG', active: telemetry.damage > 25, color: '#ff5252' },
    ];
    warnings.forEach((w, idx) => {
      const bx = 22 + idx * 122;
      ctx.fillStyle = w.active ? w.color : '#1b2632';
      ctx.fillRect(bx, 12, 110, 22);
      ctx.strokeStyle = w.active ? '#ffffff' : '#2d3d4d';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx, 12, 110, 22);
      ctx.fillStyle = w.active ? '#0a121a' : '#4a6275';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(w.label, bx + 55, 27);
    });

    // Row 1: ASI, Attitude Indicator, Altimeter
    const kts = telemetry.airspeedKt;
    const asiAngle = -Math.PI * 0.75 + Math.min(1.5, kts / 140) * Math.PI * 1.1;
    drawDial(ctx, 84, 108, 54, 'AIRSPEED', `${Math.round(kts)} KT`, asiAngle, [
      { start: -Math.PI * 0.45, end: Math.PI * 0.1, color: '#3ee08e' },
      { start: Math.PI * 0.1, end: Math.PI * 0.35, color: '#f7b733' },
      { start: Math.PI * 0.35, end: Math.PI * 0.48, color: '#ff4848' },
    ]);

    drawAttitudeGauge(ctx, 212, 108, 56, telemetry.pitchRad, telemetry.rollRad);

    const altFt = telemetry.altitudeFt;
    const altAngle = ((altFt % 1000) / 1000) * Math.PI * 2 - Math.PI / 2;
    drawDial(ctx, 340, 108, 54, 'ALTITUDE', `${Math.round(altFt)} FT`, altAngle, null);

    // Row 2: Heading Gyro, VSI, RPM / Fuel
    const hdgDeg = telemetry.headingDeg;
    const hdgAngle = ((hdgDeg - 90) * Math.PI) / 180;
    drawDial(ctx, 84, 224, 50, 'HEADING', `${String(Math.round(hdgDeg)).padStart(3, '0')}°`, hdgAngle, null);

    const vsiFpm = telemetry.vsiFpm;
    const vsiClamped = Math.max(-2000, Math.min(2000, vsiFpm));
    const vsiAngle = Math.PI + (vsiClamped / 2000) * (Math.PI * 0.75);
    drawDial(ctx, 212, 224, 50, 'VERT SPD', `${vsiFpm >= 0 ? '+' : ''}${Math.round(vsiFpm / 10) * 10}`, vsiAngle, null);

    const rpmPct = Math.round(telemetry.rpm * 100);
    const rpmAngle = -Math.PI * 0.75 + telemetry.rpm * Math.PI * 1.4;
    drawDial(ctx, 340, 224, 50, 'ENG RPM', `${rpmPct}%`, rpmAngle, [
      { start: -Math.PI * 0.3, end: Math.PI * 0.45, color: '#3ee08e' },
      { start: Math.PI * 0.45, end: Math.PI * 0.7, color: '#f7b733' },
    ]);

    // Right side: Live Archipelago Nav MFD + Fuel/Hull status bars
    drawNavMfd(ctx, 418, 50, 206, 224, telemetry);

    // Fuel & Hull vertical illuminated bars on far right
    const drawVBar = (bx, label, pct, col) => {
      ctx.fillStyle = '#0a141f';
      ctx.fillRect(bx, 68, 48, 178);
      ctx.strokeStyle = '#385168';
      ctx.strokeRect(bx, 68, 48, 178);
      const fillH = Math.max(0, Math.min(1, pct / 100)) * 172;
      ctx.fillStyle = col;
      ctx.fillRect(bx + 3, 243 - fillH, 42, fillH);
      ctx.fillStyle = '#cbe0ef';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, bx + 24, 60);
      ctx.fillStyle = '#ffd36b';
      ctx.fillText(`${Math.round(pct)}%`, bx + 24, 266);
    };

    const fuelCol = telemetry.fuel < 22 ? '#ff4b4b' : telemetry.fuel < 45 ? '#f7b733' : '#3ee08e';
    const hullPct = Math.max(0, 100 - telemetry.damage);
    const hullCol = hullPct < 40 ? '#ff4b4b' : hullPct < 75 ? '#f7b733' : '#4fe3d8';
    drawVBar(642, 'FUEL', telemetry.fuel, fuelCol);
    drawVBar(704, 'HULL', hullPct, hullCol);

    panelTexture.needsUpdate = true;
  }

  let propAngle = 0;

  function updateVisuals(dt, elapsed, flight, telemetry, isCockpitView) {
    // Sync transform
    root.position.copy(flight.position);
    root.quaternion.copy(flight.quaternion);

    // Subtle gear compression when resting on runway
    gearGroup.position.y = flight.onGround ? 0.08 : 0;

    // Propeller spin & blur disc opacity
    const rpm = Math.max(0.16, flight.rpm);
    propAngle += dt * (18 + rpm * 65);
    propGroup.rotation.z = propAngle;
    propDiscMat.opacity = Math.min(0.42, 0.08 + rpm * 0.32);

    // Animated control surfaces
    const pitchCmd = flight.controlSurfaces.pitch;
    const rollCmd = flight.controlSurfaces.roll;
    const yawCmd = flight.controlSurfaces.yaw;

    elevatorPivot.rotation.x = pitchCmd * 0.42;
    leftAileronPivot.rotation.x = -rollCmd * 0.45;
    rightAileronPivot.rotation.x = rollCmd * 0.45;
    rudderPivot.rotation.y = yawCmd * 0.48;

    const flapAngle = flight.flaps === 0 ? 0 : flight.flaps === 1 ? 0.34 : 0.68;
    leftFlapPivot.rotation.x = flapAngle;
    rightFlapPivot.rotation.x = flapAngle;

    // Cockpit yoke & throttle animation
    yokeWheel.rotation.z = -rollCmd * 0.65;
    yokeColumn.position.z = -0.78 + pitchCmd * 0.08;
    throttlePivot.rotation.x = -0.45 + flight.throttle * 0.9;

    // Hide windshield glare glass slightly in cockpit view for crisp runway clarity
    windshield.visible = !isCockpitView;

    // Blinking dorsal strobe
    strobeMat.color.set(Math.sin(elapsed * 8.5) > 0.72 ? '#ffffff' : '#4a5562');

    // Update smoke particles
    for (const s of smokePool) {
      if (!s.mesh.visible) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.mesh.visible = false;
        continue;
      }
      const k = s.life / s.maxLife;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.scale.setScalar(0.6 + k * 2.8);
      s.mesh.material.opacity = (1 - k) * 0.6;
    }

    // Update backlit instrument panel texture
    renderInstrumentPanel(telemetry);
  }

  function attachParticlesToScene(scene) {
    for (const s of smokePool) scene.add(s.mesh);
  }

  return {
    root,
    attachParticlesToScene,
    spawnSmoke,
    updateVisuals,
    renderInstrumentPanel,
  };
}
