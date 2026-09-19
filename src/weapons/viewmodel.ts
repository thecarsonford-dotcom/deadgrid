// DEADGRID first-person viewmodel — arms + weapon models built from
// primitives, with idle sway, walk bob, sprint pose, ADS transitions,
// recoil springs, reload timelines and melee swings. Attached to the camera.
//
// ---------------------------------------------------------------------------
// TRANSFORM HIERARCHY (each node owns exactly ONE responsibility):
//
//   CAMERA
//   └─ VIEWMODEL ROOT            (this.group — camera-space anchor)
//      ├─ PRIMARY ARM            (armR — stylized forearm + hand, own pose)
//      ├─ SUPPORT ARM            (armL — two-hand weapons only)
//      ├─ MUZZLE FLASH           (sprite + light, placed at computed muzzle)
//      └─ PISTOL POSE ROOT       (poseRoot — hip/ADS pose + motion + recoil)
//         └─ WEAPON MOUNT        (mount — grip/mount alignment only)
//            └─ ASSET ORIENT     (orient — GLB native orientation only)
//               └─ ASSET        (GLB scene or primitive model, scaled)
//
//   1. GLB native orientation  → ASSET ORIENT node
//   2. GLB scale               → ASSET node
//   3. grip/mount alignment    → WEAPON MOUNT node
//   4. camera-space HIP pose   → PISTOL POSE ROOT (position)
//   5. camera-space ADS pose   → PISTOL POSE ROOT (position, blended)
//   6. recoil                  → PISTOL POSE ROOT (position.z + rotation.x)
//   7. animation (bob/sway)    → PISTOL POSE ROOT (position + rotation)
//
// No node stacks unrelated corrections. The grip point of the weapon is the
// WEAPON MOUNT origin — the hand is placed at the same point, so the weapon
// is always connected to the hand by construction.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { WeaponId, WEAPONS } from './weapons';
import { AssetLib } from '../assets/registry';

// Arm palette — restrained tactical/survival. Dark olive sleeve, charcoal
// glove. Deliberately muted so the arms never compete with the weapon.
const SLEEVE = new THREE.MeshStandardMaterial({ color: 0x39412f, roughness: 0.95 });
const GLOVE = new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.92 });
const GUNMETAL = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.45, metalness: 0.7 });
const GUNSTEEL = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.35, metalness: 0.8 });
const WOODGUN = new THREE.MeshStandardMaterial({ color: 0x5d4326, roughness: 0.8 });
const BLADE = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.3, metalness: 0.85 });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function barrelMesh(r: number, len: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

/**
 * Stylized first-person arm: short tapered sleeve + compact gloved hand.
 *
 * The group origin is the WRIST. The hand extends forward (-Z) so the palm
 * center lands ~0.055 m in front of the wrist, on the weapon grip. Forward is
 * -Z. Deliberately small and dark — a believable compact silhouette beats
 * broken anatomy, and LESS ARM IS BETTER THAN BAD ARM.
 */
function makeArm(right: boolean): THREE.Group {
  const g = new THREE.Group();
  // sleeve: short, tapered (narrow at wrist, wider toward the elbow at +Z).
  // Only ~0.16 m of forearm is visible — enough to sell the pose, nothing
  // that stretches across the viewport.
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.16, 8), SLEEVE);
  fore.rotation.x = -Math.PI / 2;     // cylinder along Z
  fore.position.z = 0.08;
  fore.castShadow = true;
  g.add(fore);
  // cuff: small dark band at the wrist
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.026, 0.03, 8), GLOVE);
  cuff.rotation.x = -Math.PI / 2;
  cuff.position.z = 0.012;
  g.add(cuff);
  // hand: compact gloved palm centered on the grip
  const palm = box(0.05, 0.028, 0.062, GLOVE, 0, -0.006, -0.055);
  g.add(palm);
  // fingers: four short wrapped segments — silhouette only, no articulation
  const sign = right ? -1 : 1;
  for (let i = 0; i < 4; i++) {
    const f = box(0.013, 0.02, 0.05, GLOVE, -0.018 + i * 0.013, -0.02, -0.055 + Math.abs(i - 1.2) * 0.003);
    f.rotation.x = 0.5;
    g.add(f);
  }
  // thumb: tucked along the grip
  const thumb = box(0.015, 0.018, 0.038, GLOVE, sign * 0.03, -0.002, -0.034);
  thumb.rotation.x = 0.25;
  thumb.rotation.z = sign * 0.45;
  g.add(thumb);
  return g;
}

// --- weapon models (built along -Z; grip near origin) ------------------------
function buildWeaponModel(id: WeaponId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'knife': {
      const handle = box(0.03, 0.046, 0.13, GLOVE, 0, 0, 0.015);
      g.add(handle);
      for (let i = 0; i < 3; i++) g.add(box(0.034, 0.052, 0.012, GUNMETAL, 0, 0, 0.05 - i * 0.032));
      const guard = box(0.062, 0.022, 0.018, GUNMETAL, 0, 0, -0.055);
      g.add(guard);
      // blade: tapered diamond cross-section with a clip-point tip
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.019, 0.19, 4), BLADE);
      blade.rotation.x = -Math.PI / 2;
      blade.rotation.y = Math.PI / 4;
      blade.scale.x = 0.5;
      blade.position.set(0, 0.004, -0.16);
      g.add(blade);
      const spine = box(0.008, 0.012, 0.12, BLADE, 0, 0.012, -0.11);
      g.add(spine);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05, 4), BLADE);
      tip.rotation.x = -Math.PI / 2;
      tip.rotation.y = Math.PI / 4;
      tip.scale.x = 0.5;
      tip.position.set(0, 0.006, -0.28);
      g.add(tip);
      break;
    }
    case 'machete': {
      const handle = box(0.04, 0.055, 0.17, GUNMETAL, 0, 0, -0.05);
      const guard = box(0.09, 0.02, 0.02, GUNMETAL, 0, 0, -0.15);
      const blade = box(0.012, 0.07, 0.5, BLADE, 0, 0.01, -0.4);
      g.add(handle, guard, blade);
      break;
    }
    case 'hatchet': {
      const handle = box(0.035, 0.035, 0.5, WOODGUN, 0, 0, -0.18);
      const head = box(0.05, 0.11, 0.07, BLADE, 0, 0.04, -0.38);
      const edge = box(0.055, 0.13, 0.02, BLADE, 0, 0.04, -0.415);
      g.add(handle, head, edge);
      break;
    }
    case 'pistol': {
      const grip = box(0.042, 0.115, 0.058, GUNMETAL, 0, -0.055, 0.025);
      grip.rotation.x = 0.2;
      const slide = box(0.05, 0.048, 0.26, GUNMETAL, 0, 0, -0.1);
      const frame = box(0.046, 0.03, 0.2, GUNSTEEL, 0, -0.036, -0.07);
      // slide serrations at the rear
      for (let i = 0; i < 4; i++) g.add(box(0.052, 0.03, 0.006, GUNSTEEL, 0, 0.002, 0.02 + i * 0.014));
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), GUNSTEEL);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.002, -0.24);
      g.add(muzzle);
      // sights
      g.add(box(0.008, 0.012, 0.012, BLADE, 0, 0.03, -0.21));
      g.add(box(0.03, 0.012, 0.012, BLADE, 0, 0.03, 0.06));
      // trigger + guard
      const guard = box(0.012, 0.03, 0.06, GUNMETAL, 0, -0.062, -0.02);
      const trigger = box(0.01, 0.028, 0.012, BLADE, 0, -0.052, -0.015);
      g.add(guard, trigger);
      const mag = box(0.036, 0.05, 0.07, GUNSTEEL, 0, -0.095, 0.03);
      mag.rotation.x = 0.2;
      g.add(grip, slide, frame, mag);
      g.userData.muzzle = new THREE.Vector3(0, 0, -0.26);
      break;
    }
    case 'shotgun': {
      const receiver = box(0.06, 0.075, 0.34, GUNMETAL, 0, 0, -0.1);
      const barrel = barrelMesh(0.017, 0.62, GUNSTEEL, 0, 0.022, -0.5);
      const tube = barrelMesh(0.013, 0.5, GUNMETAL, 0, -0.022, -0.45);
      const pump = box(0.05, 0.05, 0.16, WOODGUN, 0, -0.028, -0.4);
      // pump ribs
      for (let i = 0; i < 3; i++) g.add(box(0.054, 0.008, 0.012, GUNSTEEL, 0, -0.028, -0.35 - i * 0.05));
      const stock = box(0.05, 0.09, 0.3, WOODGUN, 0, -0.02, 0.22);
      stock.rotation.x = -0.12;
      const bead = box(0.008, 0.014, 0.01, GUNSTEEL, 0, 0.042, -0.79);
      g.add(receiver, barrel, tube, pump, stock, bead);
      g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.82);
      break;
    }
    case 'smg': {
      const body = box(0.055, 0.08, 0.3, GUNMETAL, 0, 0, -0.08);
      const barrel = barrelMesh(0.014, 0.2, GUNSTEEL, 0, 0.01, -0.32);
      const mag = box(0.035, 0.17, 0.05, GUNSTEEL, 0, -0.11, -0.02);
      mag.rotation.x = 0.08;
      const grip = box(0.04, 0.1, 0.06, GUNMETAL, 0, -0.08, 0.05);
      grip.rotation.x = 0.18;
      const stockWire = box(0.014, 0.05, 0.2, GUNSTEEL, 0, 0.01, 0.16);
      const stockPlate = box(0.02, 0.07, 0.03, GUNSTEEL, 0, -0.01, 0.16);
      const sight = box(0.012, 0.016, 0.02, BLADE, 0, 0.05, -0.24);
      const rail = box(0.03, 0.012, 0.14, GUNSTEEL, 0, 0.048, -0.12);
      g.add(body, barrel, mag, grip, stockWire, stockPlate, sight, rail);
      g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.42);
      break;
    }
    case 'rifle': {
      const body = box(0.055, 0.08, 0.42, GUNMETAL, 0, 0, -0.12);
      const handguard = box(0.05, 0.062, 0.2, GUNSTEEL, 0, 0.004, -0.36);
      const barrel = barrelMesh(0.014, 0.36, GUNSTEEL, 0, 0.015, -0.6);
      const mag = box(0.04, 0.12, 0.07, GUNSTEEL, 0, -0.09, -0.06);
      mag.rotation.x = 0.28;
      const grip = box(0.04, 0.09, 0.06, GUNMETAL, 0, -0.075, 0.06);
      grip.rotation.x = 0.2;
      const stock = box(0.05, 0.1, 0.26, WOODGUN, 0, -0.01, 0.24);
      const fSight = box(0.008, 0.02, 0.012, BLADE, 0, 0.05, -0.44);
      const rSight = box(0.03, 0.018, 0.014, BLADE, 0, 0.05, 0.02);
      g.add(body, handguard, barrel, mag, grip, stock, fSight, rSight);
      g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.78);
      break;
    }
    case 'precision': {
      const body = box(0.05, 0.075, 0.4, WOODGUN, 0, 0, -0.08);
      const barrel = barrelMesh(0.015, 0.75, GUNSTEEL, 0, 0.015, -0.62);
      const scope = barrelMesh(0.028, 0.26, GUNMETAL, 0, 0.075, -0.18);
      const bolt = box(0.014, 0.014, 0.06, BLADE, 0.045, 0.03, -0.06);
      const stock = box(0.05, 0.11, 0.3, WOODGUN, 0, -0.015, 0.18);
      g.add(body, barrel, scope, bolt, stock);
      g.userData.muzzle = new THREE.Vector3(0, 0.015, -1.0);
      break;
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Per-weapon viewmodel calibration.
//
// Coordinate convention (camera space, YXZ order):
//   -Z = forward (out of the screen), +X = right, +Y = up.
//
// Every gun gets its own rest pose (hip + ADS), rotation, and (for GLB
// assets) scale / orientation / grip anchor. Nothing is shared across weapons
// except the motion system (bob, sway, recoil spring, equip/reload
// choreography).
// ---------------------------------------------------------------------------

export interface VmPose {
  hip: THREE.Vector3;      // rest (hip-fire) position in camera space
  ads: THREE.Vector3;      // aim-down-sights position in camera space
  hipRot?: [number, number, number];  // extra rest rotation (rad)
  adsRot?: [number, number, number];  // extra ADS rotation (rad)
  twoHand?: boolean;       // show the left support arm
}

const TWO_HAND: Set<WeaponId> = new Set(['shotgun', 'smg', 'rifle', 'precision']);

// Default pose (used by primitives that don't override it).
const DEFAULT_POSE: VmPose = {
  hip: new THREE.Vector3(0.15, -0.145, -0.34),
  ads: new THREE.Vector3(0.0, -0.078, -0.38),
};

// Per-weapon rest poses. GLB guns are calibrated individually; primitives
// keep the tuned defaults (knife gets its own closer pose).
const WEAPON_POSES: Partial<Record<WeaponId, VmPose>> = {
  // KNIFE — close to camera, angled for swing. No ADS (melee).
  knife: {
    hip: new THREE.Vector3(0.14, -0.13, -0.28),
    ads: new THREE.Vector3(0.14, -0.13, -0.28),
    hipRot: [-0.15, 0.0, 0.10],
  },
  // PISTOL — compact, lower-right hip with natural barrel angle toward center.
  // ADS: centered, barrel aligned with crosshair.
  pistol: {
    hip: new THREE.Vector3(0.155, -0.148, -0.32),
    hipRot: [0.08, -0.10, -0.05],
    ads: new THREE.Vector3(0.0, -0.072, -0.34),
    adsRot: [0.0, 0.0, 0.0],
  },
  // SHOTGUN — long gun, hip is lower-right with barrel angled slightly up.
  // ADS: centered, barrel through crosshair.
  shotgun: {
    hip: new THREE.Vector3(0.145, -0.145, -0.38),
    hipRot: [0.06, -0.08, -0.04],
    ads: new THREE.Vector3(0.0, -0.075, -0.42),
    adsRot: [0.0, 0.0, 0.0],
    twoHand: true,
  },
  // SMG — shorter than rifle, hip slightly closer to camera.
  // ADS: centered, barrel through crosshair.
  smg: {
    hip: new THREE.Vector3(0.145, -0.145, -0.36),
    hipRot: [0.06, -0.08, -0.04],
    ads: new THREE.Vector3(0.0, -0.075, -0.40),
    adsRot: [0.0, 0.0, 0.0],
    twoHand: true,
  },
  // RIFLE — standard AR, hip lower-right, ADS centered.
  rifle: {
    hip: new THREE.Vector3(0.145, -0.145, -0.40),
    hipRot: [0.06, -0.08, -0.04],
    ads: new THREE.Vector3(0.0, -0.075, -0.44),
    adsRot: [0.0, 0.0, 0.0],
    twoHand: true,
  },
  // PRECISION — long sniper, hip further back, ADS centered with scope.
  precision: {
    hip: new THREE.Vector3(0.145, -0.145, -0.44),
    hipRot: [0.06, -0.08, -0.04],
    ads: new THREE.Vector3(0.0, -0.078, -0.48),
    adsRot: [0.0, 0.0, 0.0],
    twoHand: true,
  },
};

function poseFor(id: WeaponId | null): VmPose {
  if (id && WEAPON_POSES[id]) return WEAPON_POSES[id]!;
  return DEFAULT_POSE;
}

// ---------------------------------------------------------------------------
// GLB weapon assets.
//
// Native GLB orientations (from dimension analysis of the raw accessors):
//   tec9:     long axis = Y (15.689), barrel along +Y
//   aa12:     long axis = X (14.982), barrel along +X
//   m24:      long axis = X (13.806), barrel along +X
//
// `orient` rotates the native model so the barrel points along -Z (forward)
// and the top of the gun points +Y. `scale` brings it to a believable
// viewmodel length. `gripFrac` is the fraction along the long axis (from the
// rear) where the player's hand grips the weapon — the model is centered so
// that point lands at the origin.
// ---------------------------------------------------------------------------
const GLB_WEAPONS: Partial<Record<WeaponId, {
  path: string;
  scale: number;
  orient: [number, number, number];  // [rotX, rotY, rotZ]
  gripFrac: number;
}>> = {
  pistol: {
    path: 'assets/runtime/weapons/tec9.glb',
    // PISTOL ASSET CALIBRATION (TEC-9 GLB)
    // assetScale: 23.1 native units * 0.011 ≈ 0.25 m (compact pistol)
    scale: 0.011,
    // assetRotation: native long axis = +Y (barrel up) → rotate to -Z (forward)
    orient: [0, -Math.PI / 2, 0],
    // gripOffset: fraction along the long axis (from rear) where the hand
    // grips — the model is centered so this point lands at the mount origin.
    gripFrac: 0.30,
  },
  shotgun: {
    path: 'assets/runtime/weapons/aa12.glb',
    scale: 0.047,            // 14.982 * 0.047 ≈ 0.70 m
    orient: [0, Math.PI / 2, 0],   // +X → -Z (barrel forward)
    gripFrac: 0.30,
  },
  precision: {
    path: 'assets/runtime/weapons/m24_sniper.glb',
    scale: 0.065,            // 13.806 * 0.065 ≈ 0.90 m
    orient: [0, Math.PI / 2, 0],   // +X → -Z (barrel forward)
    gripFrac: 0.30,
  },
};

/**
 * Load a GLB weapon and transform it into viewmodel space.
 *
 * IMPORTANT: the model's own rotation is applied to a child wrapper, and the
 * centering translation is applied to the returned group. Three.js composes a
 * node's matrix as T·R·S, so putting the centering offset on the SAME node as
 * the rotation would rotate the offset too and misplace the model. Keeping
 * them on separate nodes (group → rotated child) makes the math exact:
 *   world = T(group) · R(child) · S(child) · local
 * so the grip point (computed in the rotated frame) lands exactly at the
 * group origin.
 */
function loadGlbWeapon(id: WeaponId): Promise<THREE.Group | null> {
  const cfg = GLB_WEAPONS[id];
  if (!cfg) return Promise.resolve(null);
  return AssetLib.load(id, cfg.path).then((scene) => {
    const inner = scene.clone(true);
    inner.scale.setScalar(cfg.scale);
    inner.rotation.set(cfg.orient[0], cfg.orient[1], cfg.orient[2]);
    inner.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(inner);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // After orientation, the long axis is Z. Rear (stock) is at box.max.z
    // (closest to camera), muzzle at box.min.z. The grip sits gripFrac of the
    // way from the rear toward the muzzle.
    const gripZ = box.max.z - size.z * cfg.gripFrac;

    // Center the model so the grip point lands at the group origin.
    const group = new THREE.Group();
    group.add(inner);
    group.position.set(-center.x, -center.y, -gripZ);

    // Muzzle in group-local space (front of the weapon, along -Z).
    const muzzle = new THREE.Vector3(0, 0, box.min.z - gripZ);
    group.userData.muzzle = muzzle;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return group;
  }).catch(() => null);
}

export interface VmState {
  moving: boolean;
  sprinting: boolean;
  adsT: number;          // 0..1 aim blend
  mouseDX: number;
  mouseDY: number;
  bobPhase: number;
  bobAmp: number;
}

export class Viewmodel {
  group = new THREE.Group();
  private poseRoot = new THREE.Group();   // hip/ADS pose + motion + recoil
  private mount = new THREE.Group();      // grip/mount alignment
  private armR = new THREE.Group();
  private armL = new THREE.Group();
  private flashSprite: THREE.Mesh;
  private flashLight: THREE.PointLight;
  private model: THREE.Group | null = null;
  private weaponId: WeaponId | null = null;

  private equipT = 1;
  private equipDur = 0.3;
  private lowering = false;      // lowering old weapon before swap
  private pendingWeapon: WeaponId | null = null;
  private reloadT = -1;
  private reloadDur = 1;
  private swingT = -1;
  private swingHeavy = false;
  private kick = 0;
  private kickV = 0;
  private swayX = 0;
  private swayY = 0;
  private flashT = 0;
  private t = 0;
  private pumpT = -1;

  onMuzzleFlash: (() => void) | null = null;

  constructor() {
    // PISTOL POSE ROOT → WEAPON MOUNT → (asset loaded in swapNow)
    this.group.add(this.poseRoot);
    this.poseRoot.add(this.mount);

    this.armR.add(makeArm(true));
    this.armR.traverse((n) => { n.frustumCulled = false; if (n instanceof THREE.Mesh) n.renderOrder = 998; });
    this.group.add(this.armR);

    this.armL.add(makeArm(false));
    this.armL.traverse((n) => { n.frustumCulled = false; if (n instanceof THREE.Mesh) n.renderOrder = 998; });
    this.group.add(this.armL);

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0.9, depthTest: false,
    });
    this.flashSprite = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), flashMat);
    this.flashSprite.visible = false;
    this.flashSprite.renderOrder = 999;
    this.group.add(this.flashSprite);
    this.flashLight = new THREE.PointLight(0xffc070, 0, 9, 2);
    this.group.add(this.flashLight);

    // soft fill so the viewmodel stays readable in darkness
    this.fillLight = new THREE.PointLight(0xffe8d0, 1.3, 2.0, 2);
    this.fillLight.position.set(0.05, 0.15, 0.1);
    this.group.add(this.fillLight);

    // ensure the entire viewmodel tree is never frustum-culled
    this.group.traverse((n) => { n.frustumCulled = false; });
  }
  private fillLight: THREE.PointLight;

  setWeapon(id: WeaponId | null): void {
    if (id === this.weaponId) return;
    // phase 1: lower the current weapon fast, then swap + raise
    this.lowering = true;
    this.pendingWeapon = id;
    this.reloadT = -1;
    this.swingT = -1;
    this.equipT = 0;
    this.equipDur = 0.1;
    if (!this.model) this.swapNow();
  }

  private swapNow(): void {
    const id = this.pendingWeapon;
    this.pendingWeapon = null;
    this.lowering = false;
    if (this.model) {
      this.mount.remove(this.model);
      disposeTree(this.model);
      this.model = null;
    }
    this.weaponId = id;
    this.equipDur = id ? (WEAPONS[id]?.equipTime ?? 0.3) : 0.2;
    this.equipT = 0;
    if (id) {
      // Try GLB asset first; fall back to primitive if not loaded or unavailable
      const glbCfg = GLB_WEAPONS[id];
      if (glbCfg) {
        loadGlbWeapon(id).then((glb) => {
          if (glb && this.weaponId === id) {
            this.model = glb;
            this.mount.add(this.model);
          } else if (this.weaponId === id) {
            // GLB failed — fall back to primitive
            this.model = buildWeaponModel(id);
            this.mount.add(this.model);
          }
        });
      } else {
        this.model = buildWeaponModel(id);
        this.mount.add(this.model);
      }
    }
  }

  get currentId(): WeaponId | null { return this.weaponId; }
  get isReloading(): boolean { return this.reloadT >= 0; }
  get isSwinging(): boolean { return this.swingT >= 0; }
  get equipDone(): boolean { return this.equipT >= 1 && !this.lowering; }
  get isPumping(): boolean { return this.pumpT >= 0; }

  /** Pump-action rack after reload / between shots. */
  startPump(): void { this.pumpT = 0; }

  triggerRecoil(strength: number): void {
    this.kickV += strength;
  }

  startReload(dur: number): void {
    this.reloadT = 0;
    this.reloadDur = Math.max(0.2, dur);
  }

  startSwing(heavy: boolean): void {
    this.swingT = 0;
    this.swingHeavy = heavy;
  }

  showFlash(): void {
    this.flashT = 0.05;
    if (this.model && this.model.userData.muzzle) {
      // Muzzle is stored in the model's local space. Transform it into the
      // viewmodel root's local space (where the flash sprite/light live)
      // using the relative matrix — no stale world matrices needed.
      this.model.updateMatrixWorld(true);
      this.group.updateMatrixWorld(true);
      const mz = (this.model.userData.muzzle as THREE.Vector3).clone();
      mz.applyMatrix4(this.model.matrixWorld);
      mz.applyMatrix4(this.group.matrixWorld.clone().invert());
      this.flashSprite.position.copy(mz).add(new THREE.Vector3(0, 0, -0.06));
      this.flashLight.position.copy(mz).add(new THREE.Vector3(0, 0.02, -0.1));
    }
  }

  /** World-space muzzle point for tracer/impact alignment. */
  getMuzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (this.model && this.model.userData.muzzle) {
      this.model.updateMatrixWorld(true);
      out.copy(this.model.userData.muzzle as THREE.Vector3);
      out.applyMatrix4(this.model.matrixWorld);
    } else {
      this.poseRoot.updateMatrixWorld(true);
      out.set(0, 0, -0.5);
      out.applyMatrix4(this.poseRoot.matrixWorld);
    }
    return out;
  }

  update(dt: number, s: {
    moving: boolean; sprinting: boolean; adsT: number;
    mouseDX: number; mouseDY: number;
    bobPhase: number; bobAmp: number;
  }): void {
    this.t += dt;

    // weapon switch: fast lower, then raise with class handling time
    if (this.lowering) {
      this.equipT = Math.min(1, this.equipT + dt / 0.1);
      if (this.equipT >= 1) this.swapNow();
    } else {
      this.equipT = Math.min(1, this.equipT + dt / Math.max(0.05, this.equipDur));
    }

    // recoil spring toward rest
    this.kickV += (-this.kick * 120 - this.kickV * 15) * dt;
    this.kick += this.kickV * dt;

    // sway follows mouse
    this.swayX += (-s.mouseDX * 0.00013 - this.swayX) * Math.min(1, 9 * dt);
    this.swayY += (s.mouseDY * 0.00011 - this.swayY) * Math.min(1, 9 * dt);
    this.swayX = THREE.MathUtils.clamp(this.swayX, -0.03, 0.03);
    this.swayY = THREE.MathUtils.clamp(this.swayY, -0.03, 0.03);

    // muzzle flash decay
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashSprite.visible = this.flashT > 0;
      this.flashSprite.rotation.z = Math.random() * 3;
      this.flashLight.intensity = Math.max(0, this.flashT * 140);
    } else {
      this.flashSprite.visible = false;
      this.flashLight.intensity = 0;
    }

    const sprintRot = s.sprinting && s.moving ? 1 : 0;
    const pose = poseFor(this.weaponId);
    const twoHand = this.weaponId !== null && (pose.twoHand ?? TWO_HAND.has(this.weaponId));
    const hip = pose.hip.clone();
    const ads = pose.ads.clone();
    const target = hip.lerp(ads, s.adsT);
    // per-weapon rest rotation (defaults to identity)
    const hr = pose.hipRot ?? [0, 0, 0];
    const ar = pose.adsRot ?? [0, 0, 0];
    const bobX = Math.cos(s.bobPhase) * 0.015 * s.bobAmp * (1 - s.adsT * 0.85);
    const bobY = Math.abs(Math.sin(s.bobPhase)) * 0.013 * s.bobAmp * (1 - s.adsT * 0.85);
    const idleY = Math.sin(this.t * 1.6) * 0.0022 * (1 - s.adsT * 0.7);

    let px = target.x + bobX + this.swayX;
    let py = target.y + bobY + idleY + this.swayY * 0.4;
    let pz = target.z + this.kick * 0.6;
    // base rotation = per-weapon rest pose (hip→ads blend) + motion
    const rx0 = hr[0] + (ar[0] - hr[0]) * s.adsT;
    const ry0 = hr[1] + (ar[1] - hr[1]) * s.adsT;
    const rz0 = hr[2] + (ar[2] - hr[2]) * s.adsT;
    let rx = rx0 + this.kick * 2.4 + this.swayY * 1.4;
    let ry = ry0 + sprintRot * 0.3 + this.swayX * 1.8;
    let rz = rz0 + sprintRot * 0.18 + this.swayX * 0.8;

    // equip raise — deeper dip for slower weapons
    const equipDip = 1 - this.equipT;
    py -= equipDip * 0.4;
    rx -= equipDip * 0.95;
    rz += equipDip * 0.3;

    // reload choreography: tilt down + mag out → pause → insert + slap
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      const p = Math.min(1, this.reloadT / this.reloadDur);
      const magOut = Math.min(1, p / 0.35);
      const insert = p > 0.45 ? Math.min(1, (p - 0.45) / 0.4) : 0;
      const settle = p > 0.85 ? Math.min(1, (p - 0.85) / 0.15) : 0;
      py -= (magOut * 0.1 + insert * 0.06 - settle * 0.16);
      rz += magOut * 0.55 - settle * 0.55;
      rx -= magOut * 0.35 + insert * 0.12 - settle * 0.47;
      px += insert * 0.02 - settle * 0.02;
      if (p >= 1) this.reloadT = -1;
    }

    // pump rack: pull back + tilt, then forward
    if (this.pumpT >= 0) {
      this.pumpT += dt;
      const dur = 0.42;
      const p = Math.min(1, this.pumpT / dur);
      const pull = Math.sin(p * Math.PI);
      py -= pull * 0.03;
      rz += pull * 0.12;
      rx -= pull * 0.08;
      if (p >= 1) this.pumpT = -1;
    }

    // melee swing arc
    if (this.swingT >= 0) {
      const dur = this.swingHeavy ? 0.82 : 0.38;
      this.swingT += dt;
      const p = Math.min(1, this.swingT / dur);
      const sw = Math.sin(p * Math.PI);
      const wind = p < 0.3 ? p / 0.35 : 1;
      rz += sw * (this.swingHeavy ? -1.0 : -0.7);
      rx += sw * 0.55;
      ry += sw * -0.45;
      px -= sw * 0.2 * (this.swingHeavy ? 1.3 : 1);
      py += sw * 0.08 - (p < 0.35 ? wind * 0.04 : 0);
      if (p >= 1) this.swingT = -1;
    }

    this.poseRoot.position.set(px, py, pz);
    this.poseRoot.rotation.set(rx, ry, rz);
    this.poseRoot.updateMatrix();

    // ------------------------------------------------------------------
    // Arms track the weapon via explicit per-weapon HAND ANCHORS.
    //
    // The arm group origin is the WRIST; the palm center sits ~0.055 m in
    // front of the wrist along the arm's local -Z. So the wrist is placed
    // 0.055 m behind the hand anchor, along the arm's local +Z.
    //
    // Hand anchors are defined in WEAPON MOUNT space (the grip point is the
    // mount origin). They are transformed into viewmodel-root space with the
    // poseRoot matrix, so the hands stay welded to the weapon through hip
    // pose, ADS blend, recoil, bob and reload — and never inherit GLB
    // orientation (that lives deeper in the hierarchy, on the asset node).
    //
    // HIP: primary hand at the grip, support hand at pump/foregrip/stock.
    // ADS: hands slide forward along the weapon axis and drop slightly so
    // the forearm exits from the bottom corner of the screen and the sight
    // line stays clear.
    // ------------------------------------------------------------------
    const HAND_ANCHORS: Partial<Record<WeaponId, {
      primary: [number, number, number];
      support?: [number, number, number];
    }>> = {
      // PISTOL: single hand on the grip (grip is the mount origin).
      pistol: { primary: [0, -0.01, 0] },
      // SHOTGUN: right hand on the trigger grip, left hand on the pump.
      shotgun: { primary: [0, -0.02, 0], support: [0, -0.03, -0.30] },
      // SMG: compact two-hand — grip + foregrip.
      smg: { primary: [0, -0.02, 0], support: [0, -0.02, -0.20] },
      // RIFLE: grip + handguard.
      rifle: { primary: [0, -0.02, 0], support: [0, -0.02, -0.30] },
      // PRECISION: grip + front stock.
      precision: { primary: [0, -0.02, 0], support: [0, -0.02, -0.34] },
      // KNIFE: single hand on the handle.
      knife: { primary: [0, 0, 0] },
    };
    const anchor = (this.weaponId && HAND_ANCHORS[this.weaponId]) ?? { primary: [0, -0.01, 0] as [number, number, number] };
    const _v = new THREE.Vector3();
    const placeArm = (
      arm: THREE.Group,
      anchorPos: [number, number, number],
      rot: [number, number, number],
      adsShift: [number, number, number],
    ): void => {
      // hand anchor in viewmodel-root space (poseRoot matrix carries hip/ADS/
      // recoil/bob — the hand moves WITH the weapon pose)
      _v.set(
        anchorPos[0] + adsShift[0] * s.adsT,
        anchorPos[1] + adsShift[1] * s.adsT,
        anchorPos[2] + adsShift[2] * s.adsT,
      );
      _v.applyMatrix4(this.poseRoot.matrix);
      // wrist = hand anchor pulled back 0.055 m along the arm's local +Z
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
      const back = new THREE.Vector3(0, 0, 0.055).applyQuaternion(q);
      arm.position.copy(_v).add(back);
      arm.rotation.set(rot[0], rot[1], rot[2]);
    };

    // PRIMARY (right) arm — enters from bottom-right toward the grip.
    // ADS: hand slides forward along the weapon axis and drops, so the
    // forearm exits the bottom-right corner and the sight line stays clear.
    const primaryRot: [number, number, number] =
      this.weaponId === 'knife' ? [-0.18, 0, 0.1] : [0.10, -0.06, -0.04];
    const primaryAds: [number, number, number] =
      this.weaponId === 'knife' ? [0, 0, 0] : [0, -0.02, -0.06];
    placeArm(this.armR, anchor.primary, primaryRot, primaryAds);

    // SUPPORT (left) arm — enters from bottom-left toward the fore-end.
    // ADS: slides forward along the weapon axis, stays low, never crosses
    // the center sight line.
    this.armL.visible = twoHand && !!anchor.support;
    if (twoHand && anchor.support) {
      const supportRot: [number, number, number] = [-0.12, 0.10, 0.05];
      const supportAds: [number, number, number] = [0, -0.015, -0.08];
      placeArm(this.armL, anchor.support, supportRot, supportAds);
    } else {
      // hidden for one-hand weapons — park it out of view
      this.armL.position.set(-0.4, -0.4, 0.3);
      this.armL.rotation.set(-1.0, 0, 0.2);
    }
  }

  get meleeHitWindow(): boolean {
    if (this.swingT < 0) return false;
    const dur = this.swingHeavy ? 0.82 : 0.38;
    const p = this.swingT / dur;
    return p > 0.28 && p < 0.68;
  }

  /** QA hook: world-space bbox + per-mesh bboxes of the current weapon. */
  debugWeaponBbox(): Record<string, unknown> {
    if (!this.model) return { err: 'no model' };
    try {
      this.model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.model);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      // per-mesh world bboxes to find the true barrel axis
      const meshes: { name: string; size: [number, number, number]; center: [number, number, number] }[] = [];
      this.model.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          const mb = new THREE.Box3().setFromObject(n);
          if (mb.isEmpty()) return;
          const ms = mb.getSize(new THREE.Vector3());
          const mc = mb.getCenter(new THREE.Vector3());
          meshes.push({
            name: n.name || (n.geometry as THREE.BufferGeometry).type || 'mesh',
            size: [+ms.x.toFixed(3), +ms.y.toFixed(3), +ms.z.toFixed(3)],
            center: [+mc.x.toFixed(3), +mc.y.toFixed(3), +mc.z.toFixed(3)],
          });
        }
      });
      // sort by largest dimension
      meshes.sort((a, b) => Math.max(...b.size) - Math.max(...a.size));
      return {
        id: this.weaponId,
        worldSize: [s.x, s.y, s.z].map((x) => +x.toFixed(3)),
        worldCenter: [c.x, c.y, c.z].map((x) => +x.toFixed(3)),
        topMeshes: meshes.slice(0, 6),
      };
    } catch (e) {
      return { err: String(e) };
    }
  }
}

function disposeTree(o: THREE.Object3D): void {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}
