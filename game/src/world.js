import * as THREE from '../vendor/three.min.js';

/**
 * Airstrip definitions across the Nusantara archipelago.
 * Heading is in degrees clockwise from North (-Z).
 */
export const AIRSTRIPS = [
  {
    id: 'pelabuhan',
    name: 'Pelabuhan Utama',
    code: 'RWY 03',
    x: -640,
    z: 620,
    elevation: 14,
    headingDeg: 28,
    length: 340,
    width: 28,
  },
  {
    id: 'hijau',
    name: 'Pulau Hijau',
    code: 'RWY 04',
    x: -140,
    z: -280,
    elevation: 18,
    headingDeg: 40,
    length: 320,
    width: 26,
  },
  {
    id: 'timur',
    name: 'Kampung Timur',
    code: 'RWY 34',
    x: 720,
    z: 120,
    elevation: 20,
    headingDeg: 345,
    length: 310,
    width: 26,
  },
  {
    id: 'barat',
    name: 'Teluk Barat',
    code: 'RWY 15',
    x: -1020,
    z: -460,
    elevation: 24,
    headingDeg: 152,
    length: 300,
    width: 26,
  },
];

export const VOLCANO_POS = { x: 760, z: -560, peakHeight: 435 };

const ISLAND_BLOBS = [
  // Pelabuhan Utama (South-West Harbor Island)
  { x: -720, z: 680, rx: 430, rz: 360, h: 118, ridge: 1.0 },
  { x: -940, z: 790, rx: 220, rz: 200, h: 165, ridge: 1.2 },
  { x: -500, z: 540, rx: 210, rz: 190, h: 42, ridge: 0.4 },
  // Pulau Hijau (Central Emerald Island)
  { x: -120, z: -340, rx: 370, rz: 330, h: 128, ridge: 0.9 },
  { x: 40, z: -470, rx: 190, rz: 180, h: 158, ridge: 1.1 },
  { x: -270, z: -180, rx: 180, rz: 160, h: 45, ridge: 0.5 },
  // Gunung Api & Kampung Timur (Volcanic East Island)
  { x: 760, z: -560, rx: 520, rz: 520, h: 445, volcano: true },
  { x: 740, z: 100, rx: 340, rz: 310, h: 78, ridge: 0.7 },
  { x: 960, z: -180, rx: 260, rz: 290, h: 195, ridge: 1.1 },
  // Teluk Barat (West Bay & Karst Lagoon Island)
  { x: -1080, z: -480, rx: 380, rz: 340, h: 138, ridge: 1.0 },
  { x: -1240, z: -310, rx: 210, rz: 220, h: 175, ridge: 1.2 },
  // Decorative Karst Islets & Coral Atolls along flight corridors
  { x: -410, z: 150, rx: 115, rz: 95, h: 64, ridge: 1.4 },
  { x: -340, z: 220, rx: 75, rz: 70, h: 38, ridge: 0.8 },
  { x: 250, z: 320, rx: 135, rz: 110, h: 72, ridge: 1.3 },
  { x: 310, z: -150, rx: 110, rz: 95, h: 58, ridge: 1.2 },
  { x: -590, z: -560, rx: 125, rz: 105, h: 82, ridge: 1.5 },
  { x: -660, z: -120, rx: 95, rz: 85, h: 52, ridge: 1.3 },
  { x: 180, z: -760, rx: 130, rz: 110, h: 90, ridge: 1.4 },
  { x: -240, z: 520, rx: 90, rz: 85, h: 34, ridge: 0.7 },
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function terrainNoise(x, z) {
  return (
    Math.sin(x * 0.0085 + z * 0.0042) * 14 +
    Math.cos(x * 0.017 - z * 0.015) * 7.5 +
    Math.sin(x * 0.033 + z * 0.029) * 3.2 +
    Math.cos(x * 0.062 - z * 0.055) * 1.4
  );
}

export function getAirstripById(id) {
  return AIRSTRIPS.find((s) => s.id === id) || AIRSTRIPS[0];
}

export function getRunwayBasis(strip) {
  const rad = (strip.headingDeg * Math.PI) / 180;
  const fwdX = Math.sin(rad);
  const fwdZ = -Math.cos(rad);
  const rightX = Math.cos(rad);
  const rightZ = Math.sin(rad);
  return { rad, fwdX, fwdZ, rightX, rightZ };
}

/**
 * Sample terrain elevation, water flag, and runway occupancy at world (x, z).
 */
export function sampleTerrain(x, z) {
  let h = -18;
  let volcanoFactor = 0;

  for (let i = 0; i < ISLAND_BLOBS.length; i++) {
    const b = ISLAND_BLOBS[i];
    const dx = (x - b.x) / b.rx;
    const dz = (z - b.z) / b.rz;
    const d2 = dx * dx + dz * dz;
    if (d2 > 5.5) continue;

    if (b.volcano) {
      const dist = Math.sqrt(d2);
      const cone = Math.max(0, 1 - dist * 0.76);
      const shaped = Math.pow(cone, 1.55) * b.h;
      const crater = dist < 0.16 ? (1 - dist / 0.16) * 52 : 0;
      const candidate = shaped - crater - 14;
      if (candidate > h) {
        h = candidate;
        volcanoFactor = Math.max(volcanoFactor, cone);
      }
    } else {
      const gauss = Math.exp(-d2 * 1.45);
      const candidate = gauss * b.h - 14;
      if (candidate > h) {
        h = candidate;
      }
    }
  }

  if (h > -12) {
    const landWeight = smoothstep(-12, 18, h);
    h += terrainNoise(x, z) * landWeight * (1 - volcanoFactor * 0.45);
    // Subtle terraced slopes on lush Indonesian hills
    if (h > 16 && h < 120 && volcanoFactor < 0.35) {
      const step = Math.sin(h * 0.42) * 1.1;
      h += step;
    }
  }

  // Smoothly flatten airstrip terraces
  let onRunway = null;
  let runwayAlong = 0;
  let runwayCross = 0;

  for (let i = 0; i < AIRSTRIPS.length; i++) {
    const strip = AIRSTRIPS[i];
    const { fwdX, fwdZ, rightX, rightZ } = getRunwayBasis(strip);
    const rx = x - strip.x;
    const rz = z - strip.z;
    const along = rx * fwdX + rz * fwdZ;
    const cross = rx * rightX + rz * rightZ;

    const halfL = strip.length * 0.5;
    const halfW = strip.width * 0.5;

    const padAlong = Math.max(0, Math.abs(along) - (halfL + 26));
    const padCross = Math.max(0, Math.abs(cross) - (halfW + 30));
    const padDist = Math.hypot(padAlong, padCross);

    if (padDist < 120) {
      const blend = 1 - smoothstep(0, 120, padDist);
      h = h * (1 - blend) + strip.elevation * blend;
    }

    if (Math.abs(along) <= halfL + 10 && Math.abs(cross) <= halfW + 4) {
      onRunway = strip.id;
      runwayAlong = along;
      runwayCross = cross;
    }
  }

  const isWater = h <= 0.05 && !onRunway;
  return {
    height: isWater ? 0 : h,
    rawHeight: h,
    isWater,
    onRunway,
    runwayAlong,
    runwayCross,
    volcanoFactor,
  };
}

function createSkyDome() {
  const skyGeo = new THREE.SphereGeometry(9000, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color('#195898') },
      uMidColor: { value: new THREE.Color('#66b6dc') },
      uHorizonColor: { value: new THREE.Color('#f9cba0') },
      uSunDir: { value: new THREE.Vector3(0.68, 0.25, -0.69).normalize() },
      uSunColor: { value: new THREE.Color('#fff2c6') },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWorldDir;
      void main() {
        vec3 d = normalize(vWorldDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.24, h));
        col = mix(col, uTopColor, smoothstep(0.22, 0.78, h));
        float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.78, 0.45) * pow(sunAmt, 10.0) * 0.42;
        col += uSunColor * smoothstep(0.9965, 0.9992, sunAmt) * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(skyGeo, skyMat);
}

function createOcean() {
  const geo = new THREE.PlaneGeometry(18000, 18000, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color('#0c4f7a') },
      uShallowColor: { value: new THREE.Color('#18a4a8') },
      uSunDir: { value: new THREE.Vector3(0.68, 0.25, -0.69).normalize() },
      uFogColor: { value: new THREE.Color('#e9cda8') },
      uFogDensity: { value: 0.00018 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.025 + uTime * 1.3) * 0.35 + cos(p.z * 0.022 - uTime * 1.0) * 0.35;
        p.y += w;
        vWave = w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float n1 = sin(vWorldPos.x * 0.075 + uTime * 1.8) * cos(vWorldPos.z * 0.068 - uTime * 1.4);
        float n2 = sin((vWorldPos.x + vWorldPos.z) * 0.14 - uTime * 2.1);
        vec3 normal = normalize(vec3((n1 + n2 * 0.5) * 0.09, 1.0, (n1 - n2 * 0.5) * 0.09));

        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
        float lagoonBand = 0.5 + 0.5 * sin(vWorldPos.x * 0.0022) * cos(vWorldPos.z * 0.0021);
        vec3 baseCol = mix(uDeepColor, uShallowColor, 0.32 + lagoonBand * 0.28 + fresnel * 0.25);

        vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(dot(normal, halfVec), 0.0), 96.0);
        vec3 col = baseCol + vec3(1.0, 0.88, 0.65) * spec * 1.15;
        col += vec3(0.88, 0.96, 1.0) * smoothstep(0.45, 0.72, vWave + n1 * 0.2) * 0.08;

        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 0.92));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  return { mesh, material: mat };
}

function createTerrainMesh() {
  const size = 3400;
  const segs = 210;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const sample = sampleTerrain(x, z);
    const y = sample.rawHeight;
    pos.setY(i, y);

    if (y < -2.0) {
      col.set('#1aa3a4'); // shallow coral turquoise reef
    } else if (y < 3.6) {
      col.set('#e4cda0'); // warm sandy beach
    } else if (sample.onRunway) {
      col.set('#4c7b43'); // manicured airstrip verge
    } else if (sample.volcanoFactor > 0.56 && y > 180) {
      if (y > 392) {
        col.set('#8f3c25'); // warm volcanic caldera rim
      } else {
        col.set('#4c4746'); // dark volcanic basalt slope
      }
    } else if (y < 42) {
      const t = (y - 3.6) / 38.4;
      col.set('#5fa449').lerp(new THREE.Color('#39803f'), t);
    } else if (y < 140) {
      const t = (y - 42) / 98;
      col.set('#39803f').lerp(new THREE.Color('#285e36'), t);
    } else {
      const t = Math.min(1, (y - 140) / 140);
      col.set('#285e36').lerp(new THREE.Color('#5a534a'), t);
    }

    // Subtle organic variation
    const v = 0.94 + 0.12 * Math.sin(x * 0.045 + z * 0.037);
    colors[i * 3] = Math.min(1, col.r * v);
    colors[i * 3 + 1] = Math.min(1, col.g * v);
    colors[i * 3 + 2] = Math.min(1, col.b * v);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function createRunwayTexture(code) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Weathered tropical asphalt base
  ctx.fillStyle = '#333840';
  ctx.fillRect(0, 0, 256, 1024);

  // Subtle tire rubber & texture bands
  ctx.fillStyle = 'rgba(20, 23, 28, 0.35)';
  ctx.fillRect(88, 130, 80, 760);

  // Edge lines
  ctx.fillStyle = '#e7e2d3';
  ctx.fillRect(14, 16, 6, 992);
  ctx.fillRect(236, 16, 6, 992);

  // Threshold piano keys (both ends)
  for (let i = 0; i < 6; i++) {
    const x = 32 + i * 33;
    ctx.fillRect(x, 26, 18, 56);
    ctx.fillRect(x, 942, 18, 56);
  }

  // Centerline dashes
  for (let y = 170; y < 840; y += 64) {
    ctx.fillRect(123, y, 10, 34);
  }

  // Aiming point blocks
  ctx.fillRect(46, 160, 30, 74);
  ctx.fillRect(180, 160, 30, 74);
  ctx.fillRect(46, 790, 30, 74);
  ctx.fillRect(180, 790, 30, 74);

  // Runway number
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  const num = code.replace(/[^0-9]/g, '') || '03';
  ctx.fillText(num, 128, 138);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function buildAirstripProps(strip, windsocks, papiGroups, beacons) {
  const group = new THREE.Group();
  const { rad } = getRunwayBasis(strip);
  group.position.set(strip.x, strip.elevation + 0.14, strip.z);
  group.rotation.y = -rad;

  // Main asphalt strip
  const rwyTex = createRunwayTexture(strip.code);
  const rwyMat = new THREE.MeshStandardMaterial({
    map: rwyTex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const rwyMesh = new THREE.Mesh(new THREE.PlaneGeometry(strip.width, strip.length), rwyMat);
  rwyMesh.rotation.x = -Math.PI / 2;
  rwyMesh.receiveShadow = true;
  group.add(rwyMesh);

  // Gravel shoulders
  const shoulderMat = new THREE.MeshStandardMaterial({ color: '#786e5c', roughness: 0.95 });
  const shoulder = new THREE.Mesh(
    new THREE.PlaneGeometry(strip.width + 12, strip.length + 14),
    shoulderMat
  );
  shoulder.rotation.x = -Math.PI / 2;
  shoulder.position.y = -0.05;
  group.add(shoulder);

  // Runway edge lights
  const edgeGeo = new THREE.SphereGeometry(0.55, 8, 8);
  const whiteEmissive = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
  const greenEmissive = new THREE.MeshBasicMaterial({ color: '#39f08a' });
  const redEmissive = new THREE.MeshBasicMaterial({ color: '#ff4b4b' });

  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const z = -strip.length * 0.5 + (strip.length * i) / steps;
    const mat = i === 0 || i === steps ? greenEmissive : whiteEmissive;
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(edgeGeo, mat);
      lamp.position.set(side * (strip.width * 0.5 + 1.4), 0.5, z);
      group.add(lamp);
    }
  }

  // PAPI glideslope lights (left of approach end, +Z threshold)
  const papiLights = [];
  for (let i = 0; i < 4; i++) {
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: '#20262e', roughness: 0.7 })
    );
    const px = -(strip.width * 0.5 + 6 + i * 2.5);
    const pz = strip.length * 0.34;
    housing.position.set(px, 0.55, pz);
    group.add(housing);

    const bulbMat = new THREE.MeshBasicMaterial({ color: i < 2 ? '#ffffff' : '#ff3c3c' });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), bulbMat);
    bulb.position.set(px, 0.65, pz + 0.5);
    group.add(bulb);
    papiLights.push(bulbMat);
  }
  papiGroups.push({ strip, lights: papiLights });

  // Rustic Bush Hangar beside apron
  const hangar = new THREE.Group();
  hangar.position.set(strip.width * 0.5 + 24, 0, -24);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#dfd6c2', roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#b83c2d', roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1b242c', roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(20, 7.5, 16), wallMat);
  body.position.y = 3.75;
  hangar.add(body);

  const doorOpening = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), darkMat);
  doorOpening.position.set(-10.05, 2.8, 0);
  doorOpening.rotation.y = -Math.PI / 2;
  hangar.add(doorOpening);

  // Corrugated pitched tropical hangar roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(14.5, 4.2, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.06, 1, 0.88);
  roof.position.y = 9.5;
  hangar.add(roof);
  group.add(hangar);

  // Control Shack & Blinking Aviation Beacon Mast
  const tower = new THREE.Group();
  tower.position.set(strip.width * 0.5 + 20, 0, 18);
  const shack = new THREE.Mesh(new THREE.BoxGeometry(7, 5.5, 7), wallMat);
  shack.position.y = 2.75;
  tower.add(shack);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 2.4, 7.6),
    new THREE.MeshStandardMaterial({ color: '#274860', roughness: 0.25, metalness: 0.4 })
  );
  cab.position.y = 6.6;
  tower.add(cab);
  const capRoof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.2, 4), roofMat);
  capRoof.position.y = 8.9;
  capRoof.rotation.y = Math.PI / 4;
  tower.add(capRoof);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 10, 6),
    new THREE.MeshStandardMaterial({ color: '#e8e4da' })
  );
  mast.position.set(3.5, 10, 0);
  tower.add(mast);

  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), beaconMat);
  beacon.position.set(3.5, 15.2, 0);
  tower.add(beacon);
  beacons.push(beaconMat);
  group.add(tower);

  // Animated Windsock
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 7.5, 6),
    new THREE.MeshStandardMaterial({ color: '#ececec' })
  );
  pole.position.set(-(strip.width * 0.5 + 11), 3.75, 6);
  group.add(pole);

  const sockPivot = new THREE.Group();
  sockPivot.position.set(-(strip.width * 0.5 + 11), 7.2, 6);
  const sockMatOrange = new THREE.MeshStandardMaterial({ color: '#ff6328', roughness: 0.6 });
  const sockMatWhite = new THREE.MeshStandardMaterial({ color: '#f6f3ea', roughness: 0.6 });
  for (let s = 0; s < 4; s++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56 - s * 0.09, 0.65 - s * 0.09, 1.15, 8, 1, true),
      s % 2 === 0 ? sockMatOrange : sockMatWhite
    );
    seg.rotation.z = Math.PI / 2;
    seg.position.x = 0.7 + s * 1.1;
    sockPivot.add(seg);
  }
  group.add(sockPivot);
  windsocks.push(sockPivot);

  return group;
}

function buildArchipelagoProps(scene) {
  const group = new THREE.Group();

  // Deterministic pseudo-random helper
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // --- Instanced Coconut Palms ---
  const palmPositions = [];
  for (let i = 0; i < 420; i++) {
    const x = (rand() - 0.5) * 2800;
    const z = (rand() - 0.5) * 2300;
    const s = sampleTerrain(x, z);
    if (s.isWater || s.onRunway || s.height < 2.2 || s.height > 88 || s.volcanoFactor > 0.45) continue;

    // Keep clear of runway approaches
    let tooClose = false;
    for (const strip of AIRSTRIPS) {
      const { fwdX, fwdZ, rightX, rightZ } = getRunwayBasis(strip);
      const along = (x - strip.x) * fwdX + (z - strip.z) * fwdZ;
      const cross = (x - strip.x) * rightX + (z - strip.z) * rightZ;
      if (Math.abs(along) < strip.length * 0.72 && Math.abs(cross) < strip.width * 1.95) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    palmPositions.push({ x, y: s.height, z, scale: 0.8 + rand() * 0.65, rot: rand() * Math.PI * 2 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.48, 8.5, 6);
  trunkGeo.translate(0, 4.25, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.92 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);

  const crownGeo = new THREE.ConeGeometry(4.2, 3.2, 7);
  crownGeo.translate(0, 8.8, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: '#2f8a3c', roughness: 0.85 });
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, palmPositions.length);

  const dummy = new THREE.Object3D();
  palmPositions.forEach((p, idx) => {
    dummy.position.set(p.x, p.y - 0.2, p.z);
    dummy.rotation.set((rand() - 0.5) * 0.14, p.rot, (rand() - 0.5) * 0.14);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    crownInst.setMatrixAt(idx, dummy.matrix);
  });
  group.add(trunkInst, crownInst);

  // --- Kampong Village Clusters (Terracotta Indonesian Roofs) ---
  const villageCenters = [
    { x: -535, z: 720, count: 18 },
    { x: -790, z: 540, count: 14 },
    { x: -245, z: -200, count: 16 },
    { x: -10, z: -210, count: 14 },
    { x: 830, z: 180, count: 18 },
    { x: -910, z: -510, count: 16 },
  ];

  const houseWallGeo = new THREE.BoxGeometry(7.2, 4.2, 6.2);
  houseWallGeo.translate(0, 2.1, 0);
  const houseRoofGeo = new THREE.ConeGeometry(5.6, 3.4, 4);
  houseRoofGeo.rotateY(Math.PI / 4);
  houseRoofGeo.translate(0, 5.7, 0);

  const houseWallMat = new THREE.MeshStandardMaterial({ color: '#f2ead8', roughness: 0.85 });
  const houseRoofMat = new THREE.MeshStandardMaterial({ color: '#c4492d', roughness: 0.78 });

  const houseList = [];
  for (const vc of villageCenters) {
    for (let i = 0; i < vc.count; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 16 + rand() * 88;
      const hx = vc.x + Math.cos(ang) * dist;
      const hz = vc.z + Math.sin(ang) * dist;
      const s = sampleTerrain(hx, hz);
      if (s.isWater || s.onRunway || s.height < 2.5 || s.height > 70) continue;
      houseList.push({ x: hx, y: s.height, z: hz, rot: rand() * Math.PI * 2, sc: 0.8 + rand() * 0.45 });
    }
  }

  const wallInst = new THREE.InstancedMesh(houseWallGeo, houseWallMat, houseList.length);
  const roofInst = new THREE.InstancedMesh(houseRoofGeo, houseRoofMat, houseList.length);
  houseList.forEach((h, idx) => {
    dummy.position.set(h.x, h.y - 0.3, h.z);
    dummy.rotation.set(0, h.rot, 0);
    dummy.scale.setScalar(h.sc);
    dummy.updateMatrix();
    wallInst.setMatrixAt(idx, dummy.matrix);
    roofInst.setMatrixAt(idx, dummy.matrix);
  });
  group.add(wallInst, roofInst);

  // --- Wooden Outrigger Perahu Boats in Turquoise Bays ---
  const boatCoords = [
    [-470, 460], [-510, 410], [-360, -80], [-210, -40],
    [520, 220], [580, 310], [-820, -340], [-760, -290],
    [-260, 290], [110, 140], [420, -260], [-490, -360],
  ];
  const hullMat = new THREE.MeshStandardMaterial({ color: '#5c3b24', roughness: 0.8 });
  const sailMat = new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.7, side: THREE.DoubleSide });

  for (let i = 0; i < boatCoords.length; i++) {
    const [bx, bz] = boatCoords[i];
    const boat = new THREE.Group();
    boat.position.set(bx, 0.6, bz);
    boat.rotation.y = (i * 1.1) % (Math.PI * 2);

    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 10.5), hullMat);
    boat.add(hull);
    const outrigger = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.28, 0.45), hullMat);
    outrigger.position.y = 0.25;
    boat.add(outrigger);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 7.5, 5), hullMat);
    mast.position.y = 3.8;
    boat.add(mast);
    const sailGeo = new THREE.ConeGeometry(3.2, 6.2, 3);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.5, 4.1, 0.4);
    sail.scale.set(0.2, 1, 1);
    boat.add(sail);
    group.add(boat);
  }

  // --- Sunlit Cumulus Clouds ---
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#fffbf2',
    emissive: '#6e5c4a',
    emissiveIntensity: 0.42,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
  });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let c = 0; c < 34; c++) {
    const cx = (rand() - 0.5) * 4400;
    const cz = (rand() - 0.5) * 4000;
    const cy = 285 + rand() * 140;
    const cluster = new THREE.Group();
    cluster.position.set(cx, cy, cz);
    const puffs = 3 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(puffGeo, cloudMat);
      const r = 24 + rand() * 26;
      m.scale.set(r * 1.4, r * 0.68, r * 1.15);
      m.position.set((p - puffs * 0.5) * 26, (rand() - 0.3) * 10, (rand() - 0.5) * 24);
      cluster.add(m);
    }
    cloudGroup.add(cluster);
  }
  group.add(cloudGroup);

  // --- Gunung Api Volcanic Ash/Steam Plume ---
  const plumePuffs = [];
  const plumeMat = new THREE.MeshStandardMaterial({
    color: '#eae0d6',
    emissive: '#584b44',
    emissiveIntensity: 0.36,
    roughness: 1,
    transparent: true,
    opacity: 0.52,
  });
  for (let i = 0; i < 16; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(16 + i * 3.8, 10, 8), plumeMat);
    group.add(puff);
    plumePuffs.push({ mesh: puff, phase: i / 16 });
  }

  // --- Glowing Caldera Core ---
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(32, 16),
    new THREE.MeshBasicMaterial({ color: '#ff6e26' })
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(VOLCANO_POS.x, 386, VOLCANO_POS.z);
  group.add(lava);

  scene.add(group);
  return { cloudGroup, plumePuffs };
}

/**
 * Create the complete Indonesian archipelago world, lighting, ocean, terrain, airstrips, and props.
 */
export function createWorld(scene) {
  scene.fog = new THREE.FogExp2('#e9cda8', 0.00018);

  // Golden-hour Indonesian sunlit lighting
  const hemiLight = new THREE.HemisphereLight('#a7dbff', '#3a6646', 1.05);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#ffe4b5', 2.05);
  sunLight.position.set(900, 360, -900);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 100;
  sunLight.shadow.camera.far = 2800;
  const d = 900;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  scene.add(sunLight);

  const sky = createSkyDome();
  scene.add(sky);

  const ocean = createOcean();
  scene.add(ocean.mesh);

  const terrain = createTerrainMesh();
  scene.add(terrain);

  const windsocks = [];
  const papiGroups = [];
  const beacons = [];
  for (const strip of AIRSTRIPS) {
    scene.add(buildAirstripProps(strip, windsocks, papiGroups, beacons));
  }

  const { cloudGroup, plumePuffs } = buildArchipelagoProps(scene);

  function update(elapsed, dt, planePos, windDirRad) {
    ocean.material.uniforms.uTime.value = elapsed;

    // Gentle cloud drift
    cloudGroup.position.x = Math.sin(elapsed * 0.006) * 45;

    // Rising Gunung Api volcanic plume
    for (let i = 0; i < plumePuffs.length; i++) {
      const p = plumePuffs[i];
      const t = (p.phase + elapsed * 0.045) % 1;
      p.mesh.position.set(
        VOLCANO_POS.x + Math.sin(windDirRad) * t * 230 + Math.sin(elapsed + i) * 8,
        405 + t * 220,
        VOLCANO_POS.z - Math.cos(windDirRad) * t * 230 + Math.cos(elapsed * 0.8 + i) * 8
      );
      const s = 0.7 + t * 1.9;
      p.mesh.scale.set(s, s * 0.75, s);
    }

    // Swaying windsocks aligned to wind
    for (let i = 0; i < windsocks.length; i++) {
      windsocks[i].rotation.y = windDirRad + Math.sin(elapsed * 4.2 + i) * 0.14;
    }

    // Blinking red radio beacons
    const blink = Math.sin(elapsed * 5.0) > 0.25;
    for (let i = 0; i < beacons.length; i++) {
      beacons[i].color.set(blink ? '#ff3838' : '#551212');
    }

    // Dynamic PAPI glideslope feedback relative to aircraft position
    if (planePos) {
      for (const pg of papiGroups) {
        const s = pg.strip;
        const dist = Math.hypot(planePos.x - s.x, planePos.z - s.z);
        if (dist > 1400) continue;
        const altAboveStrip = Math.max(0, planePos.y - s.elevation);
        const angleDeg = (Math.atan2(altAboveStrip, Math.max(30, dist - s.length * 0.3)) * 180) / Math.PI;
        // 4 lights: optimal ~4.5 deg => 2 white, 2 red
        const thresholds = [2.6, 3.8, 5.2, 6.6];
        for (let k = 0; k < 4; k++) {
          pg.lights[k].color.set(angleDeg >= thresholds[k] ? '#fffbe6' : '#ff3030');
        }
      }
    }
  }

  return {
    airstrips: AIRSTRIPS,
    sampleTerrain,
    getAirstripById,
    getRunwayBasis,
    update,
  };
}
