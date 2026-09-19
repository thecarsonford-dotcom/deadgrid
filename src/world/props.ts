// DEADGRID props — reusable modular environment assets. Every prop is a
// small builder returning a THREE.Group around a local origin (base on y=0,
// facing +Z). POIs compose them; roadside scatter and interiors reuse them.
// Shared module-level materials keep disposal cheap (geometry only).

import * as THREE from 'three';

// --- shared materials --------------------------------------------------------
export const MAT = {
  wood: new THREE.MeshStandardMaterial({ color: 0x6e5233, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x54402a, roughness: 0.95 }),
  plank: new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.85 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.4, metalness: 0.75 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.55, metalness: 0.6 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x7a4b2e, roughness: 0.85, metalness: 0.3 }),
  rust2: new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.9, metalness: 0.25 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x77787a, roughness: 0.95 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x5c5f63, roughness: 0.95 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x3b3d41, roughness: 0.92 }),
  paint: new THREE.MeshStandardMaterial({ color: 0xc9c4b4, roughness: 0.7 }),
  sandbag: new THREE.MeshStandardMaterial({ color: 0x7d7259, roughness: 1.0 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x2c3a44, roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.55 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x191a1c, roughness: 0.95 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x6b6250, roughness: 1.0 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.9, side: THREE.DoubleSide }),
  lampOn: new THREE.MeshStandardMaterial({ color: 0x33291a, emissive: 0xffd9a0, emissiveIntensity: 1.6 }),
  lampOff: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x0a130c, emissive: 0x2c6a40, emissiveIntensity: 0.45 }),
  red: new THREE.MeshStandardMaterial({ color: 0x5a1512, roughness: 0.8 }),
  hazard: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.8 }),
  green: new THREE.MeshStandardMaterial({ color: 0x2e4a38, roughness: 0.8 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x31445a, roughness: 0.7, metalness: 0.2 }),
};

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export interface Prop { group: THREE.Group; }

// --- crates / containers -----------------------------------------------------
export function crate(w = 0.75, h = 0.6, d = 0.75, mat: THREE.Material = MAT.plank): Prop {
  const g = new THREE.Group();
  g.add(box(w, h, d, mat, 0, h / 2, 0));
  // edge trim for a hand-built look
  const trim = MAT.woodDark;
  for (const sy of [0, h]) {
    g.add(box(w + 0.04, 0.05, d + 0.05, trim, 0, sy, 0));
  }
  g.add(box(w + 0.05, h, 0.06, trim, 0, h / 2, -d / 2));
  g.add(box(w + 0.05, h, 0.06, trim, 0, h / 2, d / 2));
  return { group: g };
}

export function barrel(mat: THREE.Material = MAT.rust): Prop {
  const g = new THREE.Group();
  const b = cyl(0.32, 0.32, 0.9, mat, 0, 0.45, 0, 14);
  g.add(b);
  for (const y of [0.2, 0.45, 0.72]) g.add(cyl(0.335, 0.335, 0.05, MAT.metalDark, 0, y, 0, 14));
  return { group: g };
}

export function pallet(): Prop {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) g.add(box(1.1, 0.05, 0.14, MAT.wood, 0, 0.12, -0.5 + i * 0.25));
  for (const x of [-0.5, 0, 0.5]) g.add(box(0.08, 0.1, 1.0, MAT.woodDark, x, 0.05, 0));
  return { group: g };
}

export function sandbagStack(rows = 3): Prop {
  const g = new THREE.Group();
  const sb = (x: number, y: number, z: number, ry: number): void => {
    const b = box(0.62, 0.24, 0.34, MAT.sandbag, x, y, z);
    b.geometry.scale(1, 0.8, 1);
    b.rotation.y = ry;
    g.add(b);
  };
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    for (let i = 0; i < n; i++) {
      sb((i - (n - 1) / 2) * 0.6, 0.12 + r * 0.2, (r % 2) * 0.05, ((i + r) % 2 - 0.5) * 0.2);
    }
  }
  return { group: g };
}

export function generator(): Prop {
  const g = new THREE.Group();
  g.add(box(1.2, 0.9, 0.75, MAT.metalDark, 0, 0.45, 0));
  g.add(box(1.22, 0.12, 0.77, MAT.metal, 0, 0.86, 0));
  for (let i = 0; i < 4; i++) g.add(box(0.5, 0.04, 0.02, MAT.metal, 0, 0.25 + i * 0.14, 0.38));
  g.add(cyl(0.08, 0.08, 0.5, MAT.rust, 0.45, 1.0, -0.2, 8));
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), MAT.lampOn);
  light.position.set(-0.45, 0.95, 0.2);
  g.add(light);
  return { group: g };
}

export function shelf(): Prop {
  const g = new THREE.Group();
  g.add(box(1.6, 0.06, 0.5, MAT.woodDark, 0, 0.03, 0));
  for (const y of [0.7, 1.4, 2.0]) g.add(box(1.6, 0.06, 0.5, MAT.plank, 0, y, 0));
  for (const x of [-0.78, 0.78]) g.add(box(0.07, 2.0, 0.5, MAT.woodDark, x, 1.0, 0));
  // clutter on shelves
  g.add(box(0.3, 0.3, 0.35, MAT.rust, -0.5, 0.9, 0));
  g.add(box(0.4, 0.25, 0.3, MAT.green, 0.4, 0.87, 0));
  g.add(box(0.3, 0.4, 0.25, MAT.metalDark, 0.55, 1.65, 0));
  return { group: g };
}

export function locker(): Prop {
  const g = new THREE.Group();
  g.add(box(0.55, 1.9, 0.5, MAT.metalDark, 0, 0.95, 0));
  g.add(box(0.5, 0.9, 0.04, MAT.metal, -0.13, 1.4, 0.26));
  g.add(box(0.5, 0.9, 0.5, MAT.metal, 0, 0.45, 0));
  return { group: g };
}

export function table(): Prop {
  const g = new THREE.Group();
  g.add(box(1.3, 0.07, 0.8, MAT.plank, 0, 0.75, 0));
  for (const sx of [-0.58, 0.58]) for (const sz of [-0.33, 0.33]) g.add(box(0.08, 0.75, 0.07, MAT.woodDark, sx, 0.37, sz));
  return { group: g };
}

export function chair(): Prop {
  const g = new THREE.Group();
  g.add(box(0.44, 0.05, 0.44, MAT.plank, 0, 0.45, 0));
  g.add(box(0.44, 0.5, 0.06, MAT.plank, 0, 0.72, -0.19));
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) g.add(box(0.05, 0.45, 0.05, MAT.woodDark, sx, 0.22, sz));
  return { group: g };
}

export function bed(): Prop {
  const g = new THREE.Group();
  g.add(box(1.0, 0.3, 2.0, MAT.woodDark, 0, 0.2, 0));
  g.add(box(0.95, 0.14, 1.9, MAT.fabric, 0, 0.44, 0));
  g.add(box(0.6, 0.12, 0.35, MAT.paint, 0, 0.55, -0.7));
  return { group: g };
}

export function stove(): Prop {
  const g = new THREE.Group();
  g.add(box(0.7, 0.85, 0.65, MAT.metalDark, 0, 0.43, 0));
  g.add(box(0.6, 0.5, 0.05, MAT.rust, 0, 0.4, 0.33));
  g.add(cyl(0.16, 0.16, 0.03, MAT.rust2, -0.15, 0.88, -0.1, 10));
  g.add(cyl(0.16, 0.16, 0.03, MAT.rust2, 0.15, 0.88, -0.1, 10));
  return { group: g };
}

// --- outdoor / roadside ------------------------------------------------------
// --- sign face textures ------------------------------------------------------
// Painted once at module load: gives road signs legible, intentional faces
// instead of blank colored plates.
const signFaceCache = new Map<string, THREE.Texture>();
function signFace(kind: string): THREE.Texture {
  const cached = signFaceCache.get(kind);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = '#d8d4c4';
  x.fillRect(0, 0, 128, 96);
  x.strokeStyle = '#1e2024';
  x.lineWidth = 5;
  x.strokeRect(4, 4, 120, 88);
  if (kind === 'evac') {
    x.fillStyle = '#b33a2a';
    x.fillRect(14, 16, 100, 14);
    x.fillStyle = '#1e2024';
    x.fillRect(14, 40, 100, 8);
    x.fillRect(14, 56, 100, 8);
    x.fillRect(14, 72, 62, 8);
  } else if (kind === 'warn') {
    x.fillStyle = '#c9a227';
    x.fillRect(0, 0, 128, 96);
    x.fillStyle = '#141414';
    x.beginPath();
    x.moveTo(64, 16); x.lineTo(100, 76); x.lineTo(28, 76); x.closePath();
    x.lineWidth = 7; x.stroke();
    x.fillRect(61, 36, 6, 22);
    x.fillRect(61, 62, 6, 6);
  } else if (kind === 'route') {
    x.fillStyle = '#1e2024';
    x.font = 'bold 44px Consolas, monospace';
    x.fillText('7', 54, 60);
    x.strokeRect(40, 16, 48, 62);
  } else if (kind === 'stop') {
    x.fillStyle = '#b33a2a';
    x.fillRect(0, 0, 128, 96);
    x.fillStyle = '#f2ede0';
    x.font = 'bold 30px Consolas, monospace';
    x.fillText('STOP', 22, 58);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signFaceCache.set(kind, tex);
  return tex;
}

export function roadSign(kind: 'stop' | 'warn' | 'route' | 'evac'): Prop {
  const g = new THREE.Group();
  g.add(cyl(0.045, 0.045, 2.4, MAT.metal, 0, 1.2, 0, 8));
  const face = signFace(kind);
  const plateMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.7 });
  const w = kind === 'evac' ? 1.1 : kind === 'warn' ? 0.8 : kind === 'stop' ? 0.75 : 0.6;
  const h = kind === 'evac' ? 0.55 : 0.8;
  const plate = box(w, h, 0.04, plateMat, 0, 2.2, 0);
  plate.rotation.x = 0.04;
  g.add(plate);
  // dark backing so the face never z-fights or reads translucent
  const back = box(w + 0.03, h + 0.03, 0.02, MAT.metalDark, 0, 2.2, -0.02);
  g.add(back);
  return { group: g };
}

export interface LampProp extends Prop {
  light: THREE.PointLight;
  headMat: THREE.MeshStandardMaterial;
}

export function streetlamp(): LampProp {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.12, 5.2, MAT.metalDark, 0, 2.6, 0, 8));
  const arm = box(1.1, 0.08, 0.08, MAT.metalDark, 0.5, 5.15, 0);
  arm.rotation.z = -0.12;
  g.add(arm);
  g.add(box(0.55, 0.14, 0.26, MAT.metalDark, 1.0, 5.05, 0));
  const headMat = MAT.lampOn.clone();
  const head = box(0.4, 0.06, 0.2, headMat, 1.0, 4.96, 0);
  g.add(head);
  const light = new THREE.PointLight(0xffc987, 12, 20, 1.7);
  light.position.set(1.0, 4.85, 0);
  light.userData.base = 12;
  g.add(light);
  return { group: g, light, headMat };
}

export function utilityPole(): Prop {
  const g = new THREE.Group();
  g.add(cyl(0.11, 0.15, 7.5, MAT.woodDark, 0, 3.75, 0, 7));
  g.add(box(2.0, 0.09, 0.09, MAT.woodDark, 0, 6.9, 0));
  g.add(box(1.4, 0.08, 0.08, MAT.woodDark, 0, 6.3, 0));
  for (const x of [-0.8, 0.8]) g.add(cyl(0.03, 0.03, 0.25, MAT.metalDark, x, 7.0, 0, 6));
  // line-tension sag between poles is authored per-stretch; no floating wire stubs
  return { group: g };
}

export function wreckedCar(color = 0x4c5257, burnt = false): Prop {
  const g = new THREE.Group();
  const bodyMat = burnt ? MAT.rust2 : new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.35 });
  g.add(box(1.85, 0.55, 4.2, bodyMat, 0, 0.62, 0));
  g.add(box(1.7, 0.5, 2.0, bodyMat, 0, 1.1, -0.25));
  const winMat = burnt ? MAT.rust2 : MAT.glass;
  g.add(box(1.72, 0.4, 0.06, winMat, 0, 1.14, 0.76));
  g.add(box(1.72, 0.4, 0.06, winMat, 0, 1.14, -1.26));
  for (const sx of [-0.95, 0.95]) for (const sz of [-1.35, 1.35]) {
    const wheel = cyl(0.34, 0.34, 0.22, MAT.tire, sx, 0.3, sz, 12);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
  }
  // hood slightly popped
  const hood = box(1.7, 0.08, 1.1, bodyMat, 0, 0.93, 1.4);
  hood.rotation.x = 0.1;
  g.add(hood);
  return { group: g };
}

export function fenceSection(len = 3.0): Prop {
  const g = new THREE.Group();
  for (const x of [-len / 2, len / 2]) g.add(box(0.12, 1.35, 0.12, MAT.woodDark, x, 0.67, 0));
  for (const y of [0.45, 0.95, 1.3]) {
    const rail = box(len, 0.09, 0.04, MAT.wood, 0, y, 0);
    rail.rotation.z = y === 1.3 ? 0.03 : -0.02;
    g.add(rail);
  }
  return { group: g };
}

export function chainlinkFence(len = 4.0, h = 2.2): Prop {
  const g = new THREE.Group();
  for (const x of [-len / 2, 0, len / 2]) g.add(cyl(0.04, 0.04, h, MAT.metalDark, x, h / 2, 0, 6));
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9aa2ac, roughness: 0.5, metalness: 0.6,
    transparent: true, opacity: 0.28, side: THREE.DoubleSide,
  });
  g.add(box(len, h, 0.015, mat, 0, h / 2, 0));
  g.add(box(len, 0.05, 0.05, MAT.metalDark, 0, h, 0));
  return { group: g };
}

export function barricade(): Prop {
  const g = new THREE.Group();
  const a = box(0.16, 1.5, 0.16, MAT.wood, -0.3, 0.75, 0);
  a.rotation.z = 0.28;
  const b = box(0.16, 1.5, 0.16, MAT.wood, 0.3, 0.75, 0);
  b.rotation.z = -0.28;
  g.add(a, b);
  g.add(box(1.1, 0.09, 0.09, MAT.paint, 0, 1.15, 0.05));
  g.add(box(1.1, 0.09, 0.09, MAT.paint, 0, 0.55, 0.05));
  return { group: g };
}

export function shippingContainer(color = 0x4a5c48): Prop {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.4 });
  g.add(box(6.0, 2.6, 2.45, mat, 0, 1.22, 0));
  for (const z of [-1.23, 1.23]) {
    for (let i = 0; i < 12; i++) g.add(box(0.08, 2.4, 0.05, MAT.metalDark, -2.9 + i * 0.53, 1.22, z * 1.0));
  }
  return { group: g };
}

export function dumpster(): Prop {
  const g = new THREE.Group();
  g.add(box(1.8, 1.1, 1.1, MAT.green, 0, 0.55, 0));
  const lid = box(1.85, 0.08, 1.15, MAT.green, 0, 1.14, -0.03);
  lid.rotation.x = -0.1;
  g.add(lid);
  return { group: g };
}

export function pipes(): Prop {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.16, 3.4, MAT.rust, 0, 0.16, 0, 10).rotateZ(Math.PI / 2));
  g.add(cyl(0.1, 0.1, 2.2, MAT.metalDark, 0.4, 0.4, 0.3, 10).rotateZ(Math.PI / 2));
  return { group: g };
}

export function tent(): Prop {
  const g = new THREE.Group();
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0x6b6250, roughness: 1.0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a4436, roughness: 1.0 });
  // A-frame ridge tent: two sloped canvas slabs + triangular end caps
  const slope = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, 2.5), canvasMat);
  slope.position.set(-0.55, 0.66, 0);
  slope.rotation.z = 0.78;
  slope.castShadow = slope.receiveShadow = true;
  g.add(slope);
  const slope2 = slope.clone();
  slope2.position.x = 0.55;
  slope2.rotation.z = -0.78;
  g.add(slope2);
  const capG = new THREE.BufferGeometry();
  capG.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.8, 0, 0, 0.8, 0, 0, 0, 1.38, 0,
  ], 3));
  capG.computeVertexNormals();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x5d5546, roughness: 1.0, side: THREE.DoubleSide });
  const capB = new THREE.Mesh(capG, capMat);
  capB.position.z = -1.22;
  capB.rotation.y = Math.PI;
  g.add(capB);
  const capF = new THREE.Mesh(capG, capMat);
  capF.position.z = 1.22;
  g.add(capF);
  // dark doorway
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85), darkMat);
  door.position.set(0, 0.43, 1.24);
  g.add(door);
  const ridge = box(0.04, 0.04, 2.5, darkMat, 0, 1.38, 0);
  g.add(ridge);
  return { group: g };
}

export function campfire(): Prop {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const log = cyl(0.07, 0.09, 0.8, MAT.woodDark, 0, 0.1, 0, 5);
    log.rotation.z = Math.PI / 2.3;
    log.rotation.y = i * 1.25;
    g.add(log);
  }
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a0d06, emissive: 0xff5a1a, emissiveIntensity: 1.4 }));
  ember.position.y = 0.16;
  g.add(ember);
  return { group: g };
}

export function note(): Prop {
  const g = new THREE.Group();
  const sheet = box(0.28, 0.005, 0.2, MAT.paper, 0, 0.01, 0);
  sheet.rotation.y = 0.3;
  g.add(sheet);
  return { group: g };
}

// --- tool pickups -------------------------------------------------------------
export function boltCuttersProp(): Prop {
  const g = new THREE.Group();
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x8a2f22, roughness: 0.7 });
  const jawMat = MAT.metal;
  for (const s of [-1, 1]) {
    const handle = box(0.05, 0.05, 0.62, handleMat, s * 0.045, 0.03, 0.2);
    handle.rotation.x = -0.12 * s;
    g.add(handle);
    const jaw = box(0.045, 0.04, 0.2, jawMat, s * 0.02, 0.035, -0.14);
    jaw.rotation.x = 0.28 * s;
    g.add(jaw);
  }
  const pivot = cyl(0.03, 0.03, 0.05, MAT.metalDark, 0, 0.035, 0, 8);
  pivot.rotation.x = Math.PI / 2;
  g.add(pivot);
  return { group: g };
}

export function crowbarProp(): Prop {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a2d22, roughness: 0.5, metalness: 0.6 });
  const bar = box(0.045, 0.045, 0.85, mat, 0, 0.03, 0);
  g.add(bar);
  const hook = box(0.045, 0.045, 0.14, mat, 0, 0.03, -0.46);
  hook.rotation.x = 1.1;
  g.add(hook);
  g.rotation.z = 0.06;
  return { group: g };
}

export function fuseProp(): Prop {
  const g = new THREE.Group();
  const body = cyl(0.03, 0.03, 0.1, MAT.hazard, 0, 0.03, 0, 8);
  g.add(body);
  const cap = cyl(0.035, 0.035, 0.02, MAT.metal, 0, 0.03, 0, 8);
  cap.rotation.x = Math.PI / 2;
  cap.scale.set(1, 0.5, 1);
  g.add(cap);
  return { group: g };
}

export function keycardProp(): Prop {
  const g = new THREE.Group();
  const card = box(0.13, 0.006, 0.09, MAT.paint, 0, 0.01, 0);
  g.add(card);
  const chip = box(0.03, 0.008, 0.025, MAT.hazard, -0.02, 0.008, 0.01);
  g.add(chip);
  return { group: g };
}

export function fuelDrum(): Prop {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1c, roughness: 0.75, metalness: 0.3 });
  const b = cyl(0.34, 0.34, 0.92, redMat, 0, 0.46, 0, 14);
  g.add(b);
  for (const y of [0.22, 0.5, 0.78]) g.add(cyl(0.355, 0.355, 0.05, MAT.metalDark, 0, y, 0, 14));
  // spout + hazard band so it reads "FUEL" not "barrel"
  const spout = cyl(0.05, 0.07, 0.18, MAT.metalDark, 0.18, 1.0, 0, 8);
  spout.rotation.z = 0.4;
  g.add(spout);
  const band = cyl(0.352, 0.352, 0.12, MAT.paint, 0, 0.62, 0, 14);
  g.add(band);
  return { group: g };
}

export function deadBody(): Prop {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3d3a36, roughness: 1.0 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.95 });
  const torso = box(0.5, 0.24, 0.85, cloth, 0, 0.14, 0);
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skin);
  head.position.set(0.05, 0.16, 0.55);
  g.add(head);
  const legL = box(0.16, 0.14, 0.8, cloth, -0.14, 0.1, -0.75);
  legL.rotation.y = 0.2;
  const legR = box(0.16, 0.14, 0.7, cloth, 0.16, 0.1, -0.7);
  legR.rotation.y = -0.15;
  g.add(legL, legR);
  const arm = box(0.14, 0.12, 0.6, cloth, 0.4, 0.08, 0.3);
  arm.rotation.y = 0.7;
  g.add(arm);
  return { group: g };
}