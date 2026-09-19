// DEADGRID POI builders — hand-composed structures that give the world its
// campaign spine. Each builder returns a Ctx with:
//   group          — THREE.Group (origin at pad center, ground y=0)
//   colliders      — [minX, minY, minZ, w, h, d] boxes in local space
//   interactables  — interaction points in local space
//   powerLights / emergencyLights / pulsing — lights managed by the game
// POI rotation stays at 90° steps so AABB colliders remain axis-aligned.

import * as THREE from 'three';
import { MAT } from './props';
import {
  table, chair, bed, shelf, locker, crate, barrel, pallet, sandbagStack,
  generator, tent, campfire, deadBody, wreckedCar, fenceSection, chainlinkFence,
  streetlamp, roadSign, barricade, dumpster, shippingContainer, note,
  boltCuttersProp, crowbarProp, keycardProp, fuelDrum, utilityPole,
} from './props';

export interface InteractSpec {
  id: string;
  localPos: [number, number, number];
  verb: string;
  label: string;
  kind: 'loot' | 'weapon' | 'switch' | 'story' | 'tool';
  items?: [string, number][];
  weapon?: string;
  story?: string;
  req?: string;          // item required (e.g. 'cutters')
  reqLabel?: string;     // shown when locked ("REQUIRES BOLT CUTTERS")
  consume?: boolean;     // consume the required item on success
}

export interface GateBox { anchor: object; box: [number, number, number, number, number, number]; }

export interface PoiBuild {
  group: THREE.Group;
  colliders: [number, number, number, number, number, number][];
  gateBoxes: GateBox[];
  interactables: InteractSpec[];
  powerLights: THREE.Light[];
  emergencyLights: THREE.Light[];
  pulsing: THREE.Light[];
}

class Ctx implements PoiBuild {
  group = new THREE.Group();
  colliders: [number, number, number, number, number, number][] = [];
  gateBoxes: GateBox[] = [];
  interactables: InteractSpec[] = [];
  powerLights: THREE.Light[] = [];
  emergencyLights: THREE.Light[] = [];
  pulsing: THREE.Light[] = [];

  /** Add a box; (x,z) is the CENTER, y is the BASE height. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, collide = true): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    if (collide) this.colliders.push([x - w / 2, y, z - d / 2, w, h, d]);
    return m;
  }

  /**
   * Register a removable gate: anchor owns the collider; meshes named
   * `#gate:<id>:...` are removed when the gate opens.
   */
  gate(id: string, anchor: object, box: [number, number, number, number, number, number]): void {
    const gates = (this.group.userData.gates ??= {}) as Record<string, object>;
    gates[id] = anchor;
    this.group.userData.gateIds = Object.keys(gates);
    this.gateBoxes.push({ anchor, box });
  }

  /** Prop wrapper: position a prebuilt prop group, optionally colliding. */
  place(propGroup: THREE.Group, x: number, y: number, z: number, ry: number, collide?: [number, number, number, number, number, number]): void {
    propGroup.position.set(x, y, z);
    propGroup.rotation.y = ry;
    this.group.add(propGroup);
    if (collide) this.colliders.push(collide!);
  }

  light(kind: 'main' | 'emerg' | 'pulse' | 'always', color: number, intensity: number, dist: number, x: number, y: number, z: number): THREE.PointLight {
    // physical light units: intensities are candela-scale
    const l = new THREE.PointLight(color, intensity, dist, 1.7);
    l.userData.base = intensity;
    l.position.set(x, y, z);
    this.group.add(l);
    if (kind === 'main') { this.powerLights.push(l); l.intensity = intensity; }
    else if (kind === 'emerg') { this.emergencyLights.push(l); l.intensity = 0; }
    else if (kind === 'pulse') this.pulsing.push(l);
    return l;
  }

  interact(spec: InteractSpec): void {
    this.interactables.push(spec);
  }
}

const MATS = {
  wall: new THREE.MeshStandardMaterial({ color: 0x6e6154, roughness: 0.95 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x6a6d71, roughness: 0.96 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x565a5e, roughness: 0.97 }),
  floorWood: new THREE.MeshStandardMaterial({ color: 0x71573a, roughness: 0.9 }),
  glassDark: new THREE.MeshStandardMaterial({ color: 0x1c262e, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.72 }),
  metal: MAT.metal,
  metalDark: MAT.metalDark,
  wood: MAT.wood,
  plank: MAT.plank,
  fabric: MAT.fabric,
  hazard: MAT.hazard,
  screenOn: new THREE.MeshStandardMaterial({ color: 0x0a130c, emissive: 0x2c6a40, emissiveIntensity: 0.45 }),
};

// read-only monitor faces (dark with faint glow, not neon-green slabs)
export function screenMaterial(tint = 0x2c6a40): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x0a130c, emissive: tint, emissiveIntensity: 0.45 });
}

// ---------------------------------------------------------------------------
// CABIN — Mission 1. Small hunting cabin, furnished interior.
// ---------------------------------------------------------------------------
export function buildCabin(): PoiBuild {
  const c = new Ctx();
  const FL = 0.28;
  const W = 8.8, D = 6.8, H = 2.6, T = 0.24;

  c.box(0, 0, 0, W, FL, D, MATS.floorWood);
  // back / left / right walls
  c.box(0, FL, -D / 2, W, H, T, MATS.wall);
  c.box(-W / 2, FL, 0, T, H, D, MATS.wall);
  c.box(W / 2, FL, 0, T, H, D, MATS.wall);
  // front with door gap (left) + window (right)
  c.box(-2.9, FL, D / 2, 2.8, H, T, MATS.wall);
  c.box(3.6, FL, D / 2, 1.6, H, T, MATS.wall);
  c.box(1.35, FL, D / 2, 1.5, 1.0, T, MATS.wall);      // window sill
  c.box(1.35, FL + 2.1, D / 2, 1.5, 0.5, T, MATS.wall); // window header
  c.box(2.55, FL + 0.5, D / 2, 0.3, 1.6, T, MATS.wall); // mullion
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.05), MATS.glassDark);
  glass.position.set(1.35, FL + 1.8, D / 2);
  c.group.add(glass);

  // door ajar
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, 0.07), MATS.plank);
  door.position.set(-1.05, FL + 1.02, D / 2 + 0.55);
  door.rotation.y = 0.95;
  door.castShadow = true;
  c.group.add(door);

  // gabled roof
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.16, D + 0.7), MATS.roof);
  roofL.position.set(-1.75, FL + 3.4, 0);
  roofL.rotation.z = 0.52;
  roofL.castShadow = roofL.receiveShadow = true;
  c.group.add(roofL);
  const roofR = roofL.clone();
  roofR.position.x = 1.75;
  roofR.rotation.z = -0.52;
  c.group.add(roofR);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, D + 0.4), MATS.wood);
  ridge.position.set(0, FL + 4.15, 0);
  c.group.add(ridge);

  // porch
  c.box(0, FL - 0.26, D / 2 + 1.15, 3.6, 0.22, 1.9, MATS.floorWood, false);
  c.box(-1.62, FL - 0.04, D / 2 + 1.95, 0.14, 2.2, 0.14, MATS.wood);
  c.box(1.62, FL - 0.04, D / 2 + 1.95, 0.16, 2.2, 0.16, MATS.wood);
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 2.2), MATS.roof);
  porchRoof.position.set(0, FL + 2.4, D / 2 + 1.4);
  porchRoof.rotation.z = 0.05;
  porchRoof.castShadow = true;
  c.group.add(porchRoof);

  // interior furniture
  c.place(table().group, 2.6, FL, -1.2, 0, [1.85, FL, -1.43, 1.4, 0.8, 0.9]);
  c.place(chair().group, 2.6, FL, -1.95, Math.PI);
  c.place(shelf().group, -3.85, FL, -0.9, Math.PI / 2, [-4.15, FL, -1.7, 0.55, 2.0, 1.65]);
  c.place(bed().group, -3.1, FL, 1.8, Math.PI / 2, [-3.65, FL, 0.75, 2.0, 0.55, 1.05]);
  c.box(-2.95, FL, -2.85, 0.78, 0.85, 0.68, MAT.metalDark); // stove
  c.place(crate().group, 0.4, FL, -2.7, 0.3, [-0.03, FL, -3.13, 0.8, 0.65, 0.8]);
  const cr2 = crate().group;
  cr2.scale.setScalar(0.82);
  c.place(cr2, 1.1, FL, -2.8, -0.2);
  c.place(pallet().group, 3.55, FL, 1.2, 0.2);

  // lived-in dressing: tableware, journal, wall coat, candles, firewood
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 8), MATS.plank);
  mug.position.set(2.25, FL + 0.83, -1.1);
  mug.castShadow = true;
  c.group.add(mug);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12), MATS.fabric);
  plate.position.set(2.95, FL + 0.79, -1.35);
  c.group.add(plate);
  const journal = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), MAT.paper);
  journal.position.set(-3.0, FL + 0.53, 1.7);
  journal.rotation.y = 0.5;
  journal.castShadow = true;
  c.group.add(journal);
  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.75, 0.1), MATS.fabric);
  coat.position.set(4.25, FL + 1.55, -2.8);
  coat.rotation.z = 0.06;
  c.group.add(coat);
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 6), MATS.wood);
    log.rotation.z = Math.PI / 2;
    log.position.set(-2.6 + i * 0.02, FL + 0.06 + i * 0.15, -2.45);
    log.castShadow = true;
    c.group.add(log);
  }
  // hanging lamp
  const lampBulbMat = new THREE.MeshStandardMaterial({ color: 0x2a2210, emissive: 0xffd9a0, emissiveIntensity: 1.9 });
  const wire = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), MAT.metalDark);
  wire.position.set(0.5, FL + 2.32, -0.7);
  c.group.add(wire);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 8), MAT.metalDark);
  lampHead.position.set(0.5, FL + 2.02, -0.7);
  c.group.add(lampHead);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lampBulbMat);
  lampBulb.position.set(0.5, FL + 1.92, -0.7);
  c.group.add(lampBulb);
  c.light('main', 0xffc987, 14, 12, 0.5, FL + 1.7, -0.7);

  c.interact({ id: 'cabin_knife', localPos: [2.6, FL + 0.8, -1.0], verb: 'TAKE', label: 'FIELD KNIFE', kind: 'weapon', weapon: 'knife' });
  c.interact({ id: 'cabin_shelf', localPos: [-3.7, FL + 0.9, -0.9], verb: 'SEARCH', label: 'SUPPLY SHELF', kind: 'loot', items: [['food', 2], ['bandage', 1]] });
  c.interact({ id: 'cabin_crate', localPos: [0.4, FL + 0.4, -2.7], verb: 'SEARCH', label: 'CRATE', kind: 'loot', items: [['scrap', 2], ['battery', 1], ['ammo9', 12]] });
  // homeowner's pistol on the nightstand — the first firearm, minutes into the game
  c.interact({ id: 'cabin_pistol', localPos: [-2.6, FL + 0.55, 2.6], verb: 'TAKE', label: 'RANGER-9 PISTOL', kind: 'weapon', weapon: 'pistol', items: [['ammo9', 24]] });
  c.interact({
    id: 'cabin_radio', localPos: [-3.1, FL + 1.6, -2.7], verb: 'READ', label: 'FIELD RADIO', kind: 'story',
    story: 'A dead field radio, dial frozen at the emergency band. Scratched into the casing: "IF YOU HEAR THIS — TOWER EAST OF THE ROAD. BRING POWER."',
  });

  // outside dressing
  const woodPile = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.8, 6), MATS.wood);
    log.rotation.z = Math.PI / 2;
    log.position.set((i % 3) * 0.24 - 0.24, Math.floor(i / 3) * 0.2, 0);
    log.castShadow = true;
    woodPile.add(log);
  }
  woodPile.position.set(-5.1, FL - 0.16, -2.0);
  woodPile.rotation.y = 0.2;
  c.group.add(woodPile);
  c.place(barrel().group, 4.9, FL - 0.2, -2.2, 0.5, [4.55, FL - 0.2, -2.55, 0.7, 0.9, 0.7]);
  c.place(campfire().group, 1.4, FL - 0.24, 4.7, 0.4);
  const sign = roadSign('evac').group;
  c.place(sign, -3.4, FL - 0.28, 4.6, 0.5);
  c.light('main', 0xffc987, 5, 8, -1.3, FL + 2.1, D / 2 + 1.0);

  // --- CABIN EXIT COMPOSITION -------------------------------------------------
  // The player exits the door (local -1.05, +z) and must immediately read
  // "the road is that way." A worn gravel driveway runs from the porch to the
  // road, flanked by a fence line, a utility pole, and a leaning route sign
  // that points down the highway. The eye is funneled, not left to scan 360°.
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x5a564c, roughness: 1.0 });
  // driveway: 4 short quads stepping down toward the road (local +z)
  for (let i = 0; i < 4; i++) {
    const dz = 4.2 + i * 2.6;
    const w = 2.6 + i * 0.35;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 2.7), gravelMat);
    slab.position.set(-0.6, FL - 0.3 - i * 0.02, dz);
    slab.rotation.y = (i % 2 ? 0.06 : -0.05);
    slab.receiveShadow = true;
    c.group.add(slab);
  }
  // fence line along the driveway's left edge — a hard visual boundary
  for (let i = 0; i < 4; i++) {
    const fz = 4.6 + i * 2.4;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), MATS.wood);
    post.position.set(-2.6, FL + 0.25, fz);
    post.castShadow = true;
    c.group.add(post);
    if (i < 3) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.4), MATS.wood);
      rail.position.set(-2.6, FL + 0.62, fz + 1.2);
      c.group.add(rail);
    }
  }
  // utility pole at the driveway mouth — infrastructure cue that the road is near
  const pole = utilityPole().group;
  c.place(pole, 2.4, FL - 0.3, 9.6, 0.4);
  // leaning route sign at the driveway end, angled down the highway
  const routeSign = roadSign('route').group;
  routeSign.rotation.z = 0.12;
  c.place(routeSign, -1.8, FL - 0.3, 10.4, 0.9);
  // a second wrecked car parked off the driveway — the first "something happened"
  const exitCar = wreckedCar(0x4c5257, true).group;
  c.place(exitCar, 5.6, FL - 0.34, 11.5, 1.1, [4.4, FL - 0.34, 9.6, 2.4, 1.7, 4.8]);
  c.interact({
    id: 'cabin_exit_car', localPos: [5.6, FL + 0.3, 11.5], verb: 'SEARCH', label: 'PARKED CAR', kind: 'loot',
    items: [['ammo9', 10], ['bandage', 1]],
    story: 'The engine is cold. A map on the seat is folded to the county road, a finger-line of dust across the "TOWER" annotation.',
  });
  return c;
}

// ---------------------------------------------------------------------------
// RADIO FACILITY — Missions 2/3. Tower, utility building, generator, cache.
// ---------------------------------------------------------------------------
export function buildRadioFacility(): PoiBuild {
  const c = new Ctx();
  const FL = 0.04;

  // fence perimeter, gate gap on the south side
  const fence = chainlinkFence(30, 2.3).group;
  fence.position.set(0, 0, -14);
  c.group.add(fence);
  c.colliders.push([-15, 0, -14.15, 30, 2.3, 0.3]);
  for (const side of [-1, 1]) {
    const f = chainlinkFence(24, 2.3).group;
    f.position.set(side * 15, 0, -2);
    f.rotation.y = Math.PI / 2;
    c.group.add(f);
    c.colliders.push([side * 15 - 0.15, 0, -14, 0.3, 2.3, 24]);
  }
  for (const px of [-5.2, 5.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), MATS.metalDark);
    post.position.set(px, 1.3, 10);
    post.castShadow = true;
    c.group.add(post);
    c.colliders.push([px - 0.1, 0, 9.9, 0.2, 2.6, 0.2]);
  }
  // chained vehicle gate across the south entrance — bolt cutters required
  {
    const anchor = {};
    const gate = new THREE.Group();
    const leafL = new THREE.Mesh(new THREE.BoxGeometry(5.1, 2.1, 0.1), MATS.metalDark);
    leafL.position.set(-2.62, 1.05, 0);
    leafL.castShadow = true;
    leafL.name = '#gate-leaf-l';
    gate.add(leafL);
    const leafR = leafL.clone();
    leafR.position.x = 2.62;
    leafR.name = '#gate-leaf-r';
    gate.add(leafR);
    for (const gx of [-4.8, -2.4, 0, 2.4, 4.8]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.1, 0.16), MATS.metal);
      bar.position.set(gx, 1.05, 0.06);
      bar.name = `#gate-bar${gx}`;
      gate.add(bar);
    }
    // chain + lock between the leaves
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.12), MATS.metal);
    chain.position.set(0, 1.15, 0.14);
    chain.rotation.z = 0.18;
    chain.name = '#gate-chain';
    gate.add(chain);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.08), MATS.metal);
    lock.position.set(0, 1.02, 0.16);
    lock.name = '#gate-lock';
    gate.add(lock);
    gate.position.set(0, 0, 10);
    c.group.add(gate);
    c.gate('main', anchor, [-5.3, 0, 9.8, 10.6, 2.2, 0.4]);
    for (const part of [leafL, leafR, chain, lock]) part.name = `#gate:main:${part.name}`;
    c.interact({ id: 'radio_gate', localPos: [0, 1.1, 10], verb: 'OPEN', label: 'CHAINED GATE', kind: 'tool', req: 'cutters', reqLabel: 'BOLT CUTTERS' });
  }
  const gs = roadSign('evac').group;
  c.place(gs, -5.2, 0, 10.6, 0.3);
  // --- APPROACH DRESSING ------------------------------------------------------
  // The facility must read as a real destination, not props in the forest.
  // A service road apron, a warning sign, a utility cabinet, and a floodlight
  // at the gate give the approach a "you have arrived" identity before the
  // player even sees the tower.
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x565a5e, roughness: 0.97 });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 8), apronMat);
  apron.position.set(0, 0.02, 12);
  apron.receiveShadow = true;
  c.group.add(apron);
  c.place(roadSign('warn').group, 5.2, 0, 10.6, -0.3);
  // utility cabinet at the gate — a "power infrastructure" cue
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.5), MATS.metalDark);
  cab.position.set(6.4, 0.8, 11.2);
  cab.castShadow = true;
  c.group.add(cab);
  c.colliders.push([5.95, 0, 10.95, 0.9, 1.6, 0.5]);
  // floodlight at the gate — the facility is lit, the forest is not
  c.light('main', 0xffe0b0, 18, 20, 0, 3.4, 11);

  // radio tower — 17m lattice at (-8,-6)
  const TX = -8, TZ = -6, TH = 17;
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.6, 1.6]) {
    c.box(TX + sx, 0, TZ + sz, 0.28, TH, 0.28, MATS.metal);
  }
  for (const y of [3, 6, 9, 12, 15]) {
    for (const axis of [0, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(axis ? 0.12 : 3.6, 0.12, axis ? 3.8 : 0.12), MATS.metal);
      bar.position.set(TX, y, TZ);
      c.group.add(bar);
    }
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 4.4, 0.09), MATS.metalDark);
    diag.position.set(TX, y + 1.9, TZ);
    diag.rotation.set(0.55, Math.PI / 4, 0.55);
    c.group.add(diag);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 4.2), MATS.metalDark);
  platform.position.set(TX, TH - 0.5, TZ);
  platform.castShadow = true;
  c.group.add(platform);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 6), MATS.metal);
  mast.position.set(TX, TH + 1.2, TZ);
  c.group.add(mast);
  // the beacon is exempt from fog — a red star visible for kilometers, the
  // player's primary world landmark on the way to the relay
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x220606, emissive: 0xff2211, emissiveIntensity: 3.2, fog: false }));
  beacon.position.set(TX, TH + 2.4, TZ);
  c.group.add(beacon);
  c.light('pulse', 0xff3322, 22, 44, TX, TH + 2.1, TZ);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.16, 18), MATS.metal);
  dish.position.set(TX + 1.2, TH - 1.6, TZ + 0.9);
  dish.rotation.set(Math.PI / 2.6, 0.8, 0);
  dish.castShadow = true;
  c.group.add(dish);
  for (let i = 0; i < 3; i++) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), MATS.metalDark);
    ant.position.set(TX - 1.2 + i * 0.5, TH + 0.6, TZ - 1.0);
    c.group.add(ant);
  }
  c.colliders.push([TX - 1.85, 0, TZ - 1.85, 3.7, TH, 3.7]);

  // utility building with interior
  const BX = 7, BZ = 4, W = 11, D = 7, H = 3.0, T = 0.26;
  c.box(BX, FL, BZ, W, 0.3, D, MATS.concreteDark);
  c.box(BX, FL + 0.3, BZ - D / 2, W, H, T, MATS.concrete);
  c.box(BX - W / 2, FL + 0.3, BZ, T, H, D, MATS.concrete);
  c.box(BX + W / 2, FL + 0.3, BZ, T, H, D, MATS.concrete);
  c.box(BX - 3.3, FL + 0.3, BZ + D / 2, 3.3, H, T, MATS.concrete);
  c.box(BX + 1.2, FL + 2.2, BZ + D / 2, 6.5, 1.1, T, MATS.concrete);
  const wg = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 0.06), MATS.glassDark);
  wg.position.set(BX + 4.4, FL + 1.85, BZ + D / 2);
  c.group.add(wg);
  c.box(BX + 4.4, FL + 0.3, BZ + D / 2, 1.5, 0.95, T, MATS.concrete);
  c.box(BX + 5.25, FL + 0.3, BZ + D / 2, 0.3, 2.7, T, MATS.concrete);
  c.box(BX + 3.55, FL + 0.3, BZ + D / 2, 0.35, 2.7, T, MATS.concrete);
  c.box(BX, FL + 0.3 + H, BZ, W + 0.4, 0.35, D + 0.4, MATS.concreteDark);

  // console bank
  const consoleG = new THREE.Group();
  const cdesk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.8), MATS.metalDark);
  cdesk.position.y = 0.45;
  cdesk.castShadow = true;
  consoleG.add(cdesk);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.06), MATS.screenOn);
  scr.position.set(-0.7, 1.45, -0.15);
  consoleG.add(scr);
  const scr2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), MATS.screenOn);
  scr2.position.set(0.45, 1.35, -0.15);
  consoleG.add(scr2);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.55), MATS.metalDark);
  rack.position.set(1.9, 0.8, -0.15);
  rack.castShadow = true;
  consoleG.add(rack);
  consoleG.position.set(BX - 1.6, FL + 0.3, BZ - 2.5);
  c.group.add(consoleG);
  c.colliders.push([BX - 3.2, FL, BZ - 2.9, 3.2, 1.5, 0.8]);
  c.colliders.push([BX + 0.3, FL, BZ - 2.65, 0.7, 1.6, 0.55]);

  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.8), MATS.plank);
  desk.position.set(BX + 3.6, FL + 0.7, BZ - 2.5);
  desk.castShadow = true;
  c.group.add(desk);
  c.colliders.push([BX + 2.8, FL, BZ - 2.9, 1.6, 0.8, 0.8]);
  c.place(chair().group, BX + 3.6, FL, BZ - 1.7, Math.PI);
  c.place(shelf().group, BX - 5.1, FL, BZ + 1.4, Math.PI / 2, [BX - 5.4, FL, BZ + 0.55, 0.6, 2.0, 1.7]);
  c.place(locker().group, BX + 4.75, FL, BZ + 2.2, Math.PI, [BX + 4.45, FL, BZ + 1.9, 0.6, 1.9, 0.6]);
  const gen = generator().group;
  gen.name = 'gen_primitive';
  c.place(gen, BX - 4.3, FL, BZ + 2.3, Math.PI / 2, [BX - 4.65, FL, BZ + 1.9, 0.8, 1.0, 1.3]);
  // generator status light + wall fuse box (state-driven by the relay mission)
  const statusMat = new THREE.MeshStandardMaterial({ color: 0x1c0806, emissive: 0xff2211, emissiveIntensity: 1.4 });
  const status = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), statusMat);
  status.name = 'gen_status_light';
  status.position.set(BX - 4.3, FL + 1.12, BZ + 2.0);
  c.group.add(status);
  const fusebox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.1), MATS.metalDark);
  fusebox.name = 'gen_fusebox';
  fusebox.position.set(BX - 3.4, FL + 1.6, BZ + 3.32);
  c.group.add(fusebox);
  const fuseSlot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), MAT.hazard);
  fuseSlot.name = 'gen_fuse_slot';
  fuseSlot.position.set(BX - 3.4, FL + 1.62, BZ + 3.4);
  c.group.add(fuseSlot);
  const fuseSlotMat = fuseSlot.material as THREE.MeshStandardMaterial;
  fuseSlotMat.emissive = new THREE.Color(0x000000); // empty holder
  // a small warning beacon on the generator itself — a red dot the player can
  // spot from the yard, marking exactly where the generator lives
  const genBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a0806, emissive: 0xff3322, emissiveIntensity: 2.0, fog: false }));
  genBeacon.name = 'gen_warning_light';
  genBeacon.position.set(BX - 4.3, FL + 1.25, BZ + 2.3);
  c.group.add(genBeacon);

  c.light('main', 0xffe0b0, 13, 14, BX, FL + 2.6, BZ);
  c.light('emerg', 0xff2a1a, 9, 14, BX, FL + 2.5, BZ - 1.5);

  c.interact({ id: 'radio_gen', localPos: [BX - 4.2, FL + 0.8, BZ + 2.3], verb: 'USE', label: 'STATION GENERATOR', kind: 'switch' });
  c.interact({
    id: 'radio_console', localPos: [BX - 1.6, FL + 1.3, BZ - 2.5], verb: 'READ', label: 'RADIO CONSOLE', kind: 'story',
    story: 'The console crackles. A looped evacuation broadcast… then a sharper voice underneath: "…if anyone holds a tower — WE CAN STILL SEE YOU. Keep the current ON."',
  });
  c.interact({ id: 'radio_pistol', localPos: [BX + 3.6, FL + 0.85, BZ - 2.5], verb: 'TAKE', label: 'RANGER-9 PISTOL', kind: 'weapon', weapon: 'pistol', items: [['ammo9', 24]] });
  // staff SMG crate — locked behind the chained gate
  const smgCrate = crate().group;
  smgCrate.scale.setScalar(1.1);
  c.place(smgCrate, -12.8, 0, 4.6, 0.5, [-13.45, 0, 4.1, 0.9, 0.75, 0.9]);
  c.interact({ id: 'radio_smg', localPos: [-12.8, 0.55, 4.6], verb: 'TAKE', label: 'VESPER SMG', kind: 'weapon', weapon: 'smg', items: [['ammo9', 30]] });
  c.interact({ id: 'radio_gate_loot', localPos: [-12.4, 0.5, 6.0], verb: 'SEARCH', label: 'SALVAGE CACHE', kind: 'loot', items: [['ammo9', 30], ['medkit', 1], ['scrap', 2]] });
  c.interact({ id: 'radio_locker', localPos: [BX + 4.75, FL + 0.9, BZ + 2.2], verb: 'SEARCH', label: 'STAFF LOCKER', kind: 'loot', items: [['ammo9', 24], ['food', 1]] });
  c.interact({ id: 'radio_shelf', localPos: [BX - 5.1, FL + 0.9, BZ + 1.4], verb: 'SEARCH', label: 'PARTS SHELF', kind: 'loot', items: [['battery', 1], ['fuse', 1], ['bandage', 1]] });

  // yard dressing
  c.place(generator().group, -2, 0, 6, -0.4);
  c.light('main', 0xffd9a0, 5, 10, -2, 1.4, 6);
  c.place(pallet().group, -11, 0, 5, 0.3);
  c.place(barrel().group, -10.2, 0, 6.1, 0.7);
  // --- BLACKOUT ARENA COVER ---------------------------------------------------
  // The facility must be a fightable arena, not an empty field. Sandbag
  // lines, a shipping container, and a barrel cluster give the player
  // multiple cover positions and repositioning routes during the Blackout
  // waves. The generator building itself is the anchor cover.
  c.place(sandbagStack(3).group, -6, 0, 10, 0.4, [-7.1, 0, 9.5, 2.2, 0.8, 1.0]);
  c.place(sandbagStack(3).group, 6, 0, 10, -0.4, [4.9, 0, 9.5, 2.2, 0.8, 1.0]);
  const cont = shippingContainer(0x4a5c48).group;
  c.place(cont, -10, 0, 12, 0.3, [-13, 0, 10.75, 6, 2.6, 2.5]);
  const cont2 = shippingContainer(0x6b3a22).group;
  c.place(cont2, 10, 0, 12, -0.2, [7, 0, 10.75, 6, 2.6, 2.5]);
  for (const [bx, bz] of [[-4, 13], [-3.2, 13.8], [4, 13], [4.8, 13.8]] as [number, number][]) {
    c.place(barrel().group, bx, 0, bz, 0.5, [bx - 0.35, 0, bz - 0.35, 0.7, 0.9, 0.7]);
  }
  // supply crate parked clear of the generator building interactions
  c.place(crate().group, 11, 0, 12.2, 0.5, [10.6, 0, 11.8, 0.8, 0.65, 0.8]);
  c.interact({ id: 'radio_crate', localPos: [11, 0.4, 12.2], verb: 'SEARCH', label: 'SUPPLY CRATE', kind: 'loot', items: [['scrap', 2], ['ammo9', 12]] });
  // fuel drums by the generator — refuel source for the relay mission
  c.place(fuelDrum().group, BX - 6.1, FL, BZ + 3.4, 0.2, [BX - 6.45, FL, BZ + 3.05, 0.75, 1.0, 0.75]);
  c.place(fuelDrum().group, BX - 6.0, FL, BZ + 2.4, 1.3);
  c.interact({ id: 'radio_fuel', localPos: [BX - 6.1, FL + 0.7, BZ + 3.4], verb: 'TAKE', label: 'FUEL CAN', kind: 'loot', items: [['fuel', 1]] });
  // power cable runs: generator → building → tower
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x181a1c, roughness: 0.9 });
  const cable = (x1: number, z1: number, x2: number, z2: number): void => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.09), cableMat);
    seg.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
    seg.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    seg.receiveShadow = true;
    c.group.add(seg);
  };
  cable(-2, 6, 7, 6);
  cable(-2, 6, -8, -4);
  cable(-8, -4, -9, -12);
  // exterior conduit + junction box on the building's west wall
  const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.12), cableMat);
  conduit.position.set(BX - W / 2 - 0.16, FL + 1.5, BZ + 1.5);
  c.group.add(conduit);
  const jbox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.14), MATS.metalDark);
  jbox.position.set(BX - W / 2 - 0.18, FL + 2.1, BZ + 1.5);
  jbox.castShadow = true;
  c.group.add(jbox);
  // warning signs on the fence line
  c.place(roadSign('warn').group, -14.4, 0, 2, Math.PI / 2);
  c.place(roadSign('warn').group, 14.4, 0, -8, -Math.PI / 2);
  // spare drum cluster by the tower
  c.place(barrel().group, -12.2, 0, -9.4, 0.2);
  c.place(barrel().group, -11.4, 0, -10.2, 1.1);
  // floodlight poles
  for (const [px, pz] of [[-13, 8], [13, -6]] as [number, number][]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 8), MATS.metalDark);
    pole.position.set(px, 3, pz);
    pole.castShadow = true;
    c.group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), MATS.metalDark);
    head.position.set(px, 5.9, pz);
    head.lookAt(0, 1.5, 0);
    c.group.add(head);
    const spot = new THREE.SpotLight(0xffe8c0, 0, 32, 0.75, 0.5, 1.6);
    spot.position.set(px, 5.8, pz);
    spot.target.position.set(0, 1.5, 0);
    c.group.add(spot, spot.target);
    c.powerLights.push(spot);
  }
  c.light('emerg', 0xff2a1a, 12, 24, TX, 4.5, TZ);
  c.light('emerg', 0xff2a1a, 10, 18, 4, 2.2, -6);
  const body = deadBody().group;
  c.place(body, -4.5, 0, 3.2, 2.2);
  c.interact({
    id: 'radio_body', localPos: [-4.5, 0.3, 3.2], verb: 'SEARCH', label: 'TECHNICIAN', kind: 'loot',
    items: [['battery', 1], ['fuse', 1], ['bandage', 1]],
  });

  // reward cache (unlocked after the Blackout)
  const cache = crate().group;
  cache.scale.setScalar(1.3);
  c.place(cache, 10.5, 0, 8, 0.4, [9.85, 0, 7.35, 1.3, 0.85, 1.3]);
  c.interact({ id: 'radio_cache', localPos: [10.5, 0.5, 8], verb: 'SEARCH', label: 'RELIEF CACHE', kind: 'loot', items: [['ammo9', 36], ['ammo12', 10], ['food', 2], ['battery', 1], ['bandage', 2]] });
  return c;
}

// ---------------------------------------------------------------------------
// SUBURB — damaged houses along a dead-end street.
// ---------------------------------------------------------------------------
export function buildSuburb(): PoiBuild {
  const c = new Ctx();
  const T = 0.26;

  const house = (hx: number, hz: number, opts: { burnt?: boolean; open?: boolean }): void => {
    const W = 8.6, D = 6.8, H = 2.7, FL = 0.1;
    const wallMat = opts.burnt ? MAT.rust2 : MATS.wall;
    c.box(hx, 0, hz, W, FL, D, MATS.floorWood);
    c.box(hx, FL, hz - D / 2, W, H, T, wallMat);
    c.box(hx - W / 2, FL, hz, T, H, D, wallMat);
    c.box(hx + W / 2, FL, hz, T, H, D, wallMat);
    // front: door gap left, window right
    c.box(hx - 2.4, FL, hz + D / 2, 1.9, H, T, wallMat);
    c.box(hx + 2.6, FL, hz + D / 2, 1.7, H, T, wallMat);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 0.06), MATS.glassDark);
    pane.position.set(hx - 0.2, FL + 1.85, hz + D / 2);
    c.group.add(pane);
    c.box(hx - 0.2, FL, hz + D / 2, 1.7, 1.1, T, wallMat);
    c.box(hx - 0.2, FL + 2.5, hz + D / 2, 1.5, 0.2, T, wallMat);
    if (opts.burnt) {
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, D * 0.7), MAT.rust2);
      chunk.position.set(hx - 1.4, FL + 2.95, hz + 0.5);
      chunk.rotation.set(0.24, 0.2, 0.34);
      chunk.castShadow = chunk.receiveShadow = true;
      c.group.add(chunk);
    } else {
      const rL = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.16, D + 0.6), MATS.roof);
      rL.position.set(hx - 1.75, FL + 3.5, hz);
      rL.rotation.z = 0.5;
      rL.castShadow = rL.receiveShadow = true;
      c.group.add(rL);
      const rR = rL.clone();
      rR.position.x = hx + 1.75;
      rR.rotation.z = -0.5;
      c.group.add(rR);
    }
    if (opts.open) {
      c.place(table().group, hx + 2.3, FL, hz - 1.5, 0, [hx + 1.6, FL, hz - 1.95, 1.4, 0.8, 0.9]);
      c.place(chair().group, hx + 2.3, FL, hz - 0.7, Math.PI);
      c.place(shelf().group, hx - 3.9, FL, hz + 1.2, Math.PI / 2, [hx - 4.2, FL, hz + 0.35, 0.6, 2.0, 1.7]);
      const couch = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.85), MATS.fabric);
      couch.position.set(hx - 2.2, FL + 0.35, hz - 2.3);
      couch.castShadow = true;
      c.group.add(couch);
      c.colliders.push([hx - 3.2, FL, hz - 2.75, 2.0, 0.7, 0.85]);
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), MATS.fabric);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(hx + 0.4, FL + 0.11, hz + 0.8);
      c.group.add(rug);
      c.interact({ id: 'sub_shelf', localPos: [hx - 3.8, FL + 0.9, hz + 1.2], verb: 'SEARCH', label: 'FAMILY SHELF', kind: 'loot', items: [['food', 1], ['bandage', 2]] });
      c.interact({ id: 'sub_couch', localPos: [hx - 2.2, FL + 0.8, hz - 2.3], verb: 'SEARCH', label: 'COUCH', kind: 'loot', items: [['ammo9', 12], ['scrap', 1]] });
      c.interact({ id: 'sub_machete', localPos: [hx + 2.3, FL + 0.85, hz - 1.5], verb: 'TAKE', label: 'MACHETE', kind: 'weapon', weapon: 'machete' });
      c.interact({
        id: 'sub_note', localPos: [hx + 0.4, FL + 0.35, hz + 0.7], verb: 'READ', label: 'FRAMED PHOTO', kind: 'story',
        story: 'A family photo, laid face-down. Pencil on the back: "They took the road east. If you read this — do not follow the lights."',
      });
    }
  };

  house(-6, -4, { open: true });
  house(7, 5.5, { burnt: true });
  house(-7.5, 9, {});

  // street props
  const car1 = wreckedCar(0x39424e, false).group;
  c.place(car1, 2.5, 0, -9, 0.25, [1.3, 0, -11.4, 2.4, 1.7, 4.8]);
  const car2 = wreckedCar(0x5a4a3a, true).group;
  c.place(car2, -3.5, 0, 13, 1.9, [-4.7, 0, 11.1, 2.4, 1.7, 4.8]);
  const lamp = streetlamp();
  c.place(lamp.group, 5.5, 0, -1, Math.PI);
  c.powerLights.push(lamp.light);
  c.interact({ id: 'veh_sub_car', localPos: [2.5, 0.5, -6.6], verb: 'SEARCH', label: 'WRECKED CAR', kind: 'loot', items: [['ammo12', 6], ['food', 1]] });
  const mail = new THREE.Group();
  const mpost = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09), MATS.wood);
  mpost.position.y = 0.55;
  mail.add(mpost);
  const mbox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.42), MATS.metalDark);
  mbox.position.y = 1.16;
  mail.add(mbox);
  c.place(mail, 0.4, 0, 4.0, 0.3);
  for (const [fx, fz, len] of [[-1.0, 2.4, 6], [-1.0, -1.6, 4.5]] as [number, number, number][]) {
    const f = fenceSection(len).group;
    f.position.set(fx, 0, fz);
    f.rotation.y = Math.PI / 2;
    c.group.add(f);
    c.colliders.push([fx - 0.1, 0, fz - len / 2, 0.2, 1.35, len]);
  }
  const dump = dumpster().group;
  c.place(dump, 10.4, 0, 1.5, -0.2, [9.5, 0, 0.95, 1.9, 1.1, 1.15]);
  const body = deadBody().group;
  c.place(body, -2.6, 0.1, -1.5, 1.2);
  const pole = utilityPoleProp().group;
  c.place(pole, -4.5, 0, -10.5, 0);

  // backyard utility shed — chained shut, bolt cutters open it (optional find)
  {
    const SX = 13.2, SZ = -6.5;
    c.box(SX, 0, SZ, 3.2, 0.16, 2.6, MATS.concreteDark);
    c.box(SX, 0.16, SZ - 1.3, 3.2, 2.3, 0.14, MATS.metalDark);
    c.box(SX - 1.6, 0.16, SZ, 0.14, 2.3, 2.6, MATS.metalDark);
    c.box(SX + 1.6, 0.16, SZ, 0.14, 2.3, 2.6, MATS.metalDark);
    c.box(SX - 0.75, 0.16, SZ + 1.3, 1.5, 2.3, 0.14, MATS.metalDark);
    c.box(SX + 0.75, 0.16, SZ + 1.3, 1.5, 2.3, 0.14, MATS.metalDark);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 2.9), MATS.metalDark);
    roof.position.set(SX, 2.5, SZ);
    roof.rotation.z = 0.06;
    roof.castShadow = roof.receiveShadow = true;
    c.group.add(roof);
    // chained door leaf (dark panel across the gap)
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.2, 0.1), MATS.metalDark);
    door.name = '#gate:shed:door';
    door.position.set(SX + 0.02, 1.26, SZ + 1.3);
    door.rotation.y = 0.04;
    c.group.add(door);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.06), MATS.metal);
    chain.name = '#gate:shed:chain';
    chain.position.set(SX - 0.02, 1.1, SZ + 1.36);
    c.group.add(chain);
    c.gate('shed', {}, [SX - 0.75, 0.16, SZ + 1.24, 1.5, 2.2, 0.2]);
    c.box(SX - 0.6, 0.16, SZ - 0.3, 0.5, 0.9, 0.5, MATS.metalDark, false); // workbench
  }
  c.interact({ id: 'sub_shed', localPos: [12.6, 1.1, -5.2], verb: 'OPEN', label: 'CHAINED SHED', kind: 'tool', req: 'cutters', reqLabel: 'BOLT CUTTERS' });
  c.interact({ id: 'sub_shed_loot', localPos: [13.2, 0.8, -6.5], verb: 'SEARCH', label: 'MAINTENANCE SHELF', kind: 'loot', items: [['medkit', 1], ['ammo9', 12], ['scrap', 2]] });
  return c;
}
function utilityPoleProp(): { group: THREE.Group } {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 7.4, 7), MATS.wood);
  pole.position.y = 3.7;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.09, 0.09), MATS.wood);
  arm.position.y = 6.9;
  g.add(arm);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), MATS.wood);
  arm2.position.y = 6.3;
  g.add(arm2);
  return { group: g };
}

// ---------------------------------------------------------------------------
// EVACUATION CAMP — roadside refugee camp, long abandoned.
// ---------------------------------------------------------------------------
export function buildEvacCamp(): PoiBuild {
  const c = new Ctx();
  // --- AUTHORED LAYOUT --------------------------------------------------------
  // The camp is a deliberate composition, not a prop dump. Entry from the
  // road (local +z) is funneled through a sandbag choke point past a floodlit
  // guard position. Tents cluster around a central fire; the supply cache and
  // the guard's shotgun sit at the far side, so the player must cross the
  // camp — reading the bodies, the note, the barricade — to reach the reward.
  for (const [tx, tz, ry] of [[-3, -2, 0.4], [3.5, -3.5, -0.6], [-4.5, 2.5, 1.2], [4, 3, 0.2]] as [number, number, number][]) {
    c.place(tent().group, tx, 0, tz, ry);
  }
  c.place(campfire().group, 0.5, 0, 0.5, 0);
  c.place(campfire().group, -1.5, 0, -4.8, 0);
  // entry choke: two sandbag walls forming a narrow lane from the road
  c.place(sandbagStack(3).group, -2.2, 0, 6.8, 0.3, [-3.3, 0, 6.3, 2.2, 0.8, 1.0]);
  c.place(sandbagStack(3).group, 2.2, 0, 6.8, -0.3, [1.1, 0, 6.3, 2.2, 0.8, 1.0]);
  // a barricade of crates + barrel across the lane — someone held this line
  c.place(crate().group, 0, 0, 7.4, 0.2, [-0.4, 0, 7.0, 0.8, 0.65, 0.8]);
  c.place(barrel().group, 0.9, 0, 7.2, 0.5, [0.55, 0, 6.85, 0.7, 0.9, 0.7]);
  // floodlight on a pole at the guard position — the camp's only strong light
  const floodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), MATS.metalDark);
  floodPole.position.set(-6.8, 1.6, 5.2);
  floodPole.castShadow = true;
  c.group.add(floodPole);
  const floodHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.14), MATS.metal);
  floodHead.position.set(-6.8, 3.1, 5.2);
  floodHead.rotation.x = 0.4;
  c.group.add(floodHead);
  c.light('always', 0xffd9a0, 14, 16, -6.8, 2.9, 5.2);
  c.place(sandbagStack(3).group, -7, 0, 5, 1.2, [-8.1, 0, 4.5, 2.2, 0.8, 1.0]);
  c.place(crate().group, 1.5, 0, 1.8, 0.7, [1.1, 0, 1.4, 0.8, 0.65, 0.8]);
  const cr2 = crate().group;
  cr2.scale.setScalar(0.85);
  c.place(cr2, -2.5, 0, 3.6, 0.2, [-2.85, 0, 3.26, 0.7, 0.55, 0.7]);
  c.place(barrel().group, 5.5, 0, 0.5, 0, [5.15, 0, 0.15, 0.7, 0.9, 0.7]);
  c.place(note().group, 1.5, 0.45, 1.5, 0.8);
  // two bodies — one by the fire (died resting), one at the barricade (died holding)
  c.place(deadBody().group, -5.5, 0, -1.5, 3.4);
  c.place(deadBody().group, 0.4, 0, 6.9, 1.8);
  c.place(roadSign('evac').group, 0, 0, 6.5, 2.6);
  // a second evac sign at the entry — "this is a place, not a clearing"
  c.place(roadSign('evac').group, -3.4, 0, 7.6, 0.4);
  c.interact({ id: 'evac_crate', localPos: [1.5, 0.4, 1.8], verb: 'SEARCH', label: 'EVAC SUPPLIES', kind: 'loot', items: [['food', 2], ['battery', 1]] });
  c.interact({ id: 'evac_crate2', localPos: [-2.5, 0.35, 3.6], verb: 'SEARCH', label: 'SUPPLY CRATE', kind: 'loot', items: [['bandage', 2], ['scrap', 1]] });
  // the barricade crate — a third search beat at the entry
  c.interact({ id: 'evac_barricade', localPos: [0, 0.4, 7.4], verb: 'SEARCH', label: 'BARRICADE CRATE', kind: 'loot', items: [['ammo12', 6], ['bandage', 1]] });
  // abandoned guard shotgun on the sandbags — early primary on the way to the tower
  c.interact({ id: 'evac_shotgun', localPos: [-6.6, 0.7, 4.6], verb: 'TAKE', label: 'FIELDLINE 12', kind: 'weapon', weapon: 'shotgun', items: [['ammo12', 8]] });
  // guard's tool roll — bolt cutters open the chained relay gate and the suburb shed
  c.place(boltCuttersProp().group, -6.2, 0.72, 5.0, 0.9);
  c.interact({ id: 'evac_cutters', localPos: [-6.2, 0.75, 5.0], verb: 'TAKE', label: 'BOLT CUTTERS', kind: 'tool', items: [['cutters', 1]] });
  c.interact({
    id: 'evac_note', localPos: [1.5, 0.4, 1.45], verb: 'READ', label: 'HANDWRITTEN NOTE', kind: 'story',
    story: 'Day 9. The grid failed on night four. They are not sick — they are HOLLOW. No fires after dark. Do not follow the voices.',
  });
  c.interact({
    id: 'evac_barricade_note', localPos: [0.4, 0.3, 6.9], verb: 'READ', label: 'GUARD\'S JOURNAL', kind: 'story',
    story: 'The last entry is a single line, pressed hard enough to tear the page: "They came from the tower. We held the road until the light went out. If you are reading this — the tower is still lit. That is not a good sign."',
  });
  c.light('always', 0xff7a2a, 3.5, 7, -1.5, 0.5, -4.2);
  return c;
}

// ---------------------------------------------------------------------------
// MILITARY CHECKPOINT — Mission 4 (rifle pickup).
// ---------------------------------------------------------------------------
export function buildCheckpoint(): PoiBuild {
  const c = new Ctx();
  // --- AUTHORED CHECKPOINT ----------------------------------------------------
  // The checkpoint is a set piece, not a prop cluster. A road-narrowing
  // barricade of sandbags + a second vehicle forces the player through a
  // choke point. The fallen officer and the rifle sit behind the cover, so
  // the player must commit to the fight to reach the reward.
  c.place(sandbagStack(3).group, -2.5, 0, 0, 0, [-3.6, 0, -0.5, 2.2, 0.85, 1.0]);
  c.place(sandbagStack(3).group, 2.5, 0, 0, 0, [1.4, 0, -0.5, 2.0, 0.8, 1.0]);
  // a second sandbag line across the road — the choke point
  c.place(sandbagStack(3).group, 0, 0, 2.8, 0, [-1.1, 0, 2.3, 2.2, 0.8, 1.0]);
  c.place(sandbagStack(3).group, 0, 0, -3.2, 0, [-1.1, 0, -3.7, 2.2, 0.8, 1.0]);
  c.place(barricade().group, 0, 0, -2.6, 0, [-0.6, 0, -2.9, 1.2, 1.5, 0.6]);
  c.place(roadSign('stop').group, 0, 0, -3.6, 0.15);
  // a second military vehicle — the checkpoint had a presence
  const car2 = wreckedCar(0x39424e, true).group;
  c.place(car2, 4.5, 0, -2.2, -0.6, [3.3, 0, -4.6, 2.4, 1.7, 4.8]);
  c.interact({ id: 'veh_cp_car2', localPos: [3.6, 0.6, -0.4], verb: 'SEARCH', label: 'MILITARY VEHICLE', kind: 'loot', items: [['ammo762', 16], ['bandage', 1]] });
  const car = wreckedCar(0x2e3440, false).group;
  c.place(car, -4.5, 0, -1.4, 0.5, [-5.7, 0, -3.8, 2.4, 1.7, 4.8]);
  c.interact({ id: 'veh_cp_car', localPos: [-3.6, 0.6, 0.2], verb: 'SEARCH', label: 'WRECKED CAR', kind: 'loot', items: [['ammo9', 12], ['food', 1]] });
  c.place(deadBody().group, 1.4, 0, -1.8, 0.9);
  c.place(deadBody().group, -2.2, 0, 2.2, 2.6);
  // a third body at the second vehicle — the checkpoint was overrun
  c.place(deadBody().group, 4.2, 0, -1.2, 2.4);
  // fallen officer — carries the bunker security keycard
  c.place(keycardProp().group, 1.4, 0.18, -1.55, 0.5);
  c.interact({
    id: 'cp_officer', localPos: [1.4, 0.25, -1.8], verb: 'SEARCH', label: 'FALLEN OFFICER', kind: 'loot',
    items: [['keycard', 1], ['bandage', 1], ['ammo9', 12]],
  });
  c.place(crate().group, 3.6, 0, -1.8, 0.4, [3.2, 0, -2.2, 0.8, 0.65, 0.8]);
  c.interact({ id: 'cp_crate', localPos: [3.6, 0.4, -1.8], verb: 'SEARCH', label: 'AMMO CRATE', kind: 'loot', items: [['ammo762', 20], ['bandage', 1]] });
  c.interact({ id: 'cp_rifle', localPos: [1.1, 0.35, -1.9], verb: 'TAKE', label: 'MERIDIAN RIFLE', kind: 'weapon', weapon: 'rifle', items: [['ammo762', 30]] });
  c.interact({
    id: 'cp_sign', localPos: [0, 1.15, -3.1], verb: 'READ', label: 'CHECKPOINT ORDER', kind: 'story',
    story: 'QUARANTINE ORDER 7: All civilians route east. DO NOT approach grid failure sites. Only sanctioned survival teams beyond this line.',
  });
  return c;
}

// ---------------------------------------------------------------------------
// INDUSTRIAL YARD — precision rifle + supplies (Mission 5 detour).
// ---------------------------------------------------------------------------
export function buildIndustrial(): PoiBuild {
  const c = new Ctx();
  const WX = -6, WZ = -4, W = 14, D = 10, H = 4.4, T = 0.3;
  c.box(WX, 0, WZ, W, 0.18, D, MATS.concreteDark);
  c.box(WX, 0.18, WZ - D / 2, W, H, T, MATS.concrete);
  c.box(WX - W / 2, 0.18, WZ, T, H, D, MATS.metalDark);
  c.box(WX + W / 2, 0.18, WZ, T, H, D, MATS.metalDark);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.18, D + 0.6), MATS.metalDark);
  roof.position.set(WX, H + 0.3, WZ);
  roof.castShadow = roof.receiveShadow = true;
  c.group.add(roof);
  for (const px of [WX - W / 2 + 1, WX + W / 2 - 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 0.3), MATS.metalDark);
    col.position.set(px, H / 2, WZ + D / 2 - 0.2);
    col.castShadow = true;
    c.group.add(col);
    c.colliders.push([px - 0.15, 0, WZ + D / 2 - 0.35, 0.3, H, 0.3]);
  }
  c.place(shelf().group, WX - 5.4, 0.18, WZ - 2.2, Math.PI / 2, [WX - 5.7, 0.18, WZ - 3.05, 0.6, 2.0, 1.7]);
  c.place(shelf().group, WX + 5.4, 0.18, WZ + 1.5, Math.PI / 2, [WX + 5.1, 0.18, WZ + 0.65, 0.6, 2.0, 1.7]);
  c.place(crate().group, WX + 2.4, 0.18, WZ - 3.2, 0.4, [WX + 2.0, 0.18, WZ - 3.6, 0.8, 0.65, 0.8]);
  const gen = generator().group;
  c.place(gen, WX - 2.2, 0.18, WZ - 3.4, 0, [WX - 2.8, 0.18, WZ - 3.8, 1.2, 0.95, 0.8]);
  const lk = locker().group;
  c.place(lk, WX + 6.3, 0.18, WZ - 3.9, Math.PI, [WX + 6.0, 0.18, WZ - 4.2, 0.6, 1.9, 0.6]);
  c.light('main', 0xfff2d0, 10, 18, WX, H - 0.5, WZ);
  c.light('emerg', 0xff2a1a, 8, 13, WX - 4, 2.4, WZ + 2);

  c.interact({ id: 'ind_shelf', localPos: [WX - 5.4, 0.9, WZ - 2.2], verb: 'SEARCH', label: 'SUPPLY SHELF', kind: 'loot', items: [['scrap', 3], ['fuel', 1], ['food', 1]] });
  c.interact({ id: 'ind_locker', localPos: [WX + 6.3, 0.9, WZ - 3.9], verb: 'SEARCH', label: 'LOCKER', kind: 'loot', items: [['ammo762', 20], ['battery', 1]] });
  c.interact({ id: 'ind_crate', localPos: [WX + 2.4, 0.5, WZ - 3.2], verb: 'SEARCH', label: 'PARTS CRATE', kind: 'loot', items: [['scrap', 2], ['bandage', 2]] });
  // maintenance crowbar on the workbench — pries the sealed bunker alcove
  c.place(crowbarProp().group, WX + 3.2, 0.66, WZ - 3.15, 0.4);
  c.interact({ id: 'ind_crowbar', localPos: [WX + 3.2, 0.7, WZ - 3.2], verb: 'TAKE', label: 'CROWBAR', kind: 'tool', items: [['crowbar', 1]] });

  // office container (LONGEYE inside)
  const off = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.5, 2.5), MATS.metalDark);
  shell.position.y = 1.25;
  shell.castShadow = shell.receiveShadow = true;
  off.add(shell);
  const offDoor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.95), MATS.metalDark);
  offDoor.position.set(3.13, 0.95, -0.5);
  off.add(offDoor);
  off.position.set(8, 0, 2);
  g2(off);
  function g2(gg: THREE.Group): void { c.group.add(gg); }
  c.colliders.push([8 - 3.1, 0, 2 - 1.25, 6.2, 2.5, 2.5]);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.7), MATS.metalDark);
  desk.position.set(8.9, 0.4, 3.2);
  desk.castShadow = true;
  c.group.add(desk);
  c.colliders.push([8.1, 0, 2.85, 1.6, 0.8, 0.7]);
  c.interact({ id: 'ind_rifle', localPos: [8.9, 0.85, 3.2], verb: 'TAKE', label: 'LONGEYE MARKSMAN', kind: 'weapon', weapon: 'precision', items: [['ammo762', 10]] });
  c.interact({ id: 'ind_desk', localPos: [9.6, 0.7, 3.2], verb: 'SEARCH', label: 'OFFICE DESK', kind: 'loot', items: [['ammo762', 20], ['food', 1]] });

  // yard props
  const cont1 = shippingContainer(0x4a5c48).group;
  cont1.position.set(-10, 0, 6);
  cont1.rotation.y = 0.2;
  c.group.add(cont1);
  c.colliders.push([-13, 0, 4.75, 6, 2.6, 2.5]);
  const cont2 = shippingContainer(0x6b3a22).group;
  cont2.position.set(-9.6, 2.6, 6.2);
  cont2.rotation.y = 0.22;
  c.group.add(cont2);
  const cont3 = shippingContainer(0x31445a).group;
  cont3.position.set(2, 0, 9);
  cont3.rotation.y = Math.PI / 2;
  c.group.add(cont3);
  c.colliders.push([0.75, 0, 6, 2.5, 2.6, 6]);
  c.place(pallet().group, -6.5, 0, 4, 0.6);
  c.place(barrel().group, -5.9, 0, 4.6, 0, [-6.25, 0, 4.25, 0.7, 0.9, 0.7]);
  c.place(barrel().group, -5.2, 0, 3.4, 1.1, [-5.55, 0, 3.05, 0.7, 0.9, 0.7]);
  const bar3 = barrel().group;
  bar3.position.set(-5.6, 0.9, 4.1);
  c.group.add(bar3);
  c.place(dumpster().group, 10.5, 0, -4, -0.3, [9.55, 0, -4.6, 1.9, 1.1, 1.15]);
  const roadCar = wreckedCar(0x4c5257, true).group;
  c.place(roadCar, 6.5, 0, -7.5, 0.8, [5.3, 0, -9.4, 2.4, 1.7, 4.8]);
  c.interact({ id: 'veh_ind_car', localPos: [7.4, 0.6, -5.6], verb: 'SEARCH', label: 'WRECKED TRUCK', kind: 'loot', items: [['ammo12', 6], ['bandage', 1]] });
  c.place(deadBody().group, -8.2, 0, -8.4, 1.7);

  // perimeter fence with gap
  for (const side of [-1, 1]) {
    const f = chainlinkFence(16, 2.3).group;
    f.position.set(side * 12, 0, -10);
    c.group.add(f);
    c.colliders.push([side * 12 - 8, 0, -10.15, 16, 2.3, 0.3]);
  }
  c.place(roadSign('warn').group, -7.5, 0, -10.3, Math.PI);
  c.light('emerg', 0xff2a1a, 8, 14, WX, 2.6, WZ - 3);
  return c;
}

// ---------------------------------------------------------------------------
// BUNKER — Mission 5/6. Concrete entry into a bermed hill.
// ---------------------------------------------------------------------------
export function buildBunker(): PoiBuild {
  const c = new Ctx();
  const FL = -0.4;
  const W = 11, H = 3.2, T = 0.5;
  // the bunker runs dark until the player restores its own emergency power
  c.group.userData.localPower = false;

  const berm = new THREE.Mesh(new THREE.CylinderGeometry(15, 17.5, 3.8, 7), MATS.concreteDark);
  berm.position.set(0, 1.1, -3);
  berm.castShadow = berm.receiveShadow = true;
  c.group.add(berm);
  c.colliders.push([-15, FL + 0.4, -18, 30, 3.8, 12]);

  c.box(0, FL + 0.4, 0, W, 0.3, 7.5, MATS.concrete);
  c.box(0, FL + 0.7, -3.5, W, H, T, MATS.concrete);
  c.box(-W / 2, FL + 0.7, 0, T, H, 7, MATS.concrete);
  c.box(W / 2, FL + 0.7, 0, T, H, 7, MATS.concrete);
  c.box(-4.2, FL + 0.7, 3.5, 2.6, H, T, MATS.concrete);
  c.box(4.2, FL + 0.7, 3.5, 2.6, H, T, MATS.concrete);
  c.box(0, FL + 2.9, 3.5, 3.0, 0.3, T, MATS.concrete);
  c.box(0, FL + 0.7 + H, 0, W + 0.7, 0.4, 7.8, MATS.concreteDark);

  // ceiling pipes + conduit run (industrial character)
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x54524c, roughness: 0.6, metalness: 0.5 });
  for (const [py, pr] of [[FL + 0.7 + H - 0.28, 0.07], [FL + 0.7 + H - 0.14, 0.05]] as [number, number][]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, 6.6, 8), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, py, -1.8);
    c.group.add(pipe);
  }
  const dropPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), pipeMat);
  dropPipe.position.set(-2.2, FL + 0.7 + H - 1.0, -1.8);
  c.group.add(dropPipe);
  const conduitBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.1), MATS.metalDark);
  conduitBox.position.set(1.6, FL + 2.2, -3.42);
  c.group.add(conduitBox);
  const cableTray = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.24), MATS.metalDark);
  cableTray.position.set(1.2, FL + 0.76, -3.3);
  c.group.add(cableTray);
  // stacked crates in the back corner
  c.place(crate().group, 5.0, FL + 0.7, -2.6, 0.35, [4.6, FL + 0.7, -3.0, 0.8, 0.65, 0.8]);
  const bk2 = crate().group;
  bk2.scale.setScalar(0.85);
  bk2.position.set(5.12, FL + 1.36, -2.54);
  bk2.rotation.y = 0.62;
  c.group.add(bk2);

  // blast door ajar with hazard stripes
  const doorFrame = new THREE.Group();
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.9, 0.28), MATS.metalDark);
  door.castShadow = true;
  door.position.set(-1.1, 0, 0);
  doorFrame.add(door);
  for (let i = -1; i <= 1; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.3), MATS.hazard);
    stripe.position.set(i * 0.75, 0, 0.02);
    doorFrame.add(stripe);
  }
  doorFrame.position.set(1.7, FL + 1.95, 3.7);
  doorFrame.rotation.y = -1.3;
  c.group.add(doorFrame);

  c.box(0, FL + 0.72, 5.6, 3.2, 0.1, 4.2, MATS.concreteDark, false);
  c.place(sandbagStack(3).group, 2.4, FL + 0.75, 5.6, 0.1, [1.3, FL + 0.75, 5.1, 2.2, 0.8, 1.0]);
  c.place(roadSign('warn').group, -2.6, FL + 0.75, 6.6, 0.2);
  // --- SECURITY ZONE APPROACH -------------------------------------------------
  // The bunker must feel like the next chapter, not a hole in the ground.
  // A chainlink fence line, a second warning sign, and a concrete barrier
  // create a "you are entering a restricted area" transition before the
  // blast door. The fence is the visual boundary between forest and facility.
  const fenceL = chainlinkFence(10, 2.3).group;
  fenceL.position.set(-8, FL + 0.4, 8);
  fenceL.rotation.y = 0.3;
  c.group.add(fenceL);
  c.colliders.push([-13, FL + 0.4, 7.85, 10, 2.3, 0.3]);
  const fenceR = chainlinkFence(10, 2.3).group;
  fenceR.position.set(8, FL + 0.4, 8);
  fenceR.rotation.y = -0.3;
  c.group.add(fenceR);
  c.colliders.push([3, FL + 0.4, 7.85, 10, 2.3, 0.3]);
  // a concrete barrier at the entrance — the last "civilian" element
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.5), MATS.concrete);
  barrier.position.set(-4.5, FL + 0.95, 7.5);
  barrier.rotation.y = 0.2;
  barrier.castShadow = true;
  c.group.add(barrier);
  c.colliders.push([-5.7, FL + 0.4, 7.25, 2.4, 1.1, 0.5]);
  // a second warning sign — "RESTRICTED"
  c.place(roadSign('warn').group, 4.5, FL + 0.75, 7.5, -0.2);
  // a floodlight at the entrance — the bunker is lit, the forest is not
  c.light('main', 0xffe0b0, 12, 16, 0, FL + 3.2, 7);
  for (const vx of [-3.5, 3.5]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.5, 10), MAT.rust);
    stack.position.set(vx, FL + 3.85, -2.4);
    stack.castShadow = true;
    c.group.add(stack);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), MATS.metal);
  ant.position.set(4.8, FL + 5.6, -3);
  c.group.add(ant);
  // a tall concrete antenna mast with a fog-exempt beacon — the bunker's
  // landmark, visible from the road so the destination reads as a place,
  // not an invisible hole in the ground
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 9, 8), MATS.concrete);
  mast.position.set(6.5, FL + 5.2, -4.5);
  mast.castShadow = true;
  c.group.add(mast);
  const mastBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x0a1a0a, emissive: 0x22ff44, emissiveIntensity: 2.4, fog: false }));
  mastBeacon.position.set(6.5, FL + 9.8, -4.5);
  c.group.add(mastBeacon);

  // interior contents
  c.place(locker().group, -4.6, FL + 0.7, -2.6, Math.PI / 2, [-4.95, FL + 0.7, -2.9, 0.6, 1.9, 0.6]);
  c.place(locker().group, -4.6, FL + 0.7, -1.2, Math.PI / 2, [-4.95, FL + 0.7, -1.55, 0.6, 1.9, 0.6]);
  c.place(shelf().group, -4.75, FL + 0.7, 1.2, Math.PI / 2, [-5.05, FL + 0.7, 0.35, 0.6, 2.0, 1.7]);
  c.place(bed().group, 3.5, FL + 0.7, -2.5, 0.05, [2.5, FL + 0.7, -3.55, 2.0, 0.55, 2.1]);
  const bd2 = bed().group;
  c.place(bd2, 3.5, FL + 0.7, -0.3, 0.06, [2.5, FL + 0.7, -1.35, 2.0, 0.55, 2.0]);
  c.place(generator().group, -3.6, FL + 0.7, 2.9, Math.PI, [-4.0, FL + 0.7, 2.5, 1.25, 1.0, 0.8]);
  const deskC = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.8), MATS.metalDark);
  deskC.position.set(0.4, FL + 1.15, -3.0);
  deskC.castShadow = true;
  c.group.add(deskC);
  c.colliders.push([-0.6, FL + 0.7, -3.4, 2.0, 0.9, 0.8]);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.06), MATS.screenOn);
  screen.position.set(0.4, FL + 1.75, -3.25);
  c.group.add(screen);

  c.interact({ id: 'bunker_power', localPos: [-3.6, FL + 1.5, 2.9], verb: 'REPAIR', label: 'EMERGENCY POWER', kind: 'switch' });
  c.interact({
    id: 'bunker_docs', localPos: [0.4, FL + 1.25, -3.0], verb: 'TAKE', label: 'CLASSIFIED DOSSIER', kind: 'story',
    story: 'PROJECT DEADGRID — SITE DIRECTIVE 7: Subjects designated HOLLOW persist after cardiac death while grid current is maintained through them. The signal is the source. Coordinates follow.',
  });
  c.interact({ id: 'bunker_med', localPos: [-4.75, FL + 1.5, 1.2], verb: 'SEARCH', label: 'MEDICAL CABINET', kind: 'loot', items: [['medkit', 2], ['bandage', 2]] });
  c.interact({ id: 'bunker_locker', localPos: [-4.6, FL + 1.5, -1.2], verb: 'SEARCH', label: 'DUTY LOCKER', kind: 'loot', items: [['ammo762', 30], ['food', 1], ['battery', 1]] });
  c.interact({ id: 'bunker_shelf', localPos: [-4.75, FL + 1.5, 1.2], verb: 'SEARCH', label: 'STORAGE SHELF', kind: 'loot', items: [['battery', 2], ['ammo9', 24]] });
  // security locker — keycard from the checkpoint officer
  {
    const sec = locker().group;
    sec.position.set(2.6, FL + 0.7, 3.05);
    c.group.add(sec);
    c.colliders.push([2.3, FL + 0.7, 2.75, 0.6, 1.9, 0.6]);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.04), MATS.hazard);
    stripe.position.set(2.6, FL + 1.9, 3.36);
    c.group.add(stripe);
    const reader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.05), MATS.metal);
    reader.position.set(2.85, FL + 1.45, 3.38);
    c.group.add(reader);
  }
  c.interact({ id: 'bunker_security', localPos: [2.6, FL + 1.2, 3.1], verb: 'OPEN', label: 'SECURITY LOCKER', kind: 'loot', req: 'keycard', reqLabel: 'KEYCARD', items: [['ammo762', 40], ['medkit', 1], ['food', 1]] });
  // sealed storage alcove — crowbar from the industrial yard (east wall,
  // well clear of the generator/door so interactions never compete)
  {
    const AX = 5.35, AZ = 1.6;
    const recess = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 1.8), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 1.0 }));
    recess.position.set(AX - 0.1, FL + 1.7, AZ);
    c.group.add(recess);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 1.7), MATS.metalDark);
    panel.name = '#gate:alcove:panel';
    panel.position.set(AX + 0.05, FL + 1.65, AZ);
    panel.rotation.x = 0.03;
    panel.rotation.z = -0.06;
    panel.castShadow = true;
    c.group.add(panel);
    // pry-bar scuff strip so the panel hints at being forced, not painted
    const scuff = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.06), MAT.rust);
    scuff.name = '#gate:alcove:scuff';
    scuff.position.set(AX + 0.1, FL + 1.2, AZ - 0.55);
    c.group.add(scuff);
    const lootCrate = crate().group;
    lootCrate.scale.setScalar(0.95);
    lootCrate.position.set(AX - 0.4, FL + 0.9, AZ);
    lootCrate.name = '#gate:alcove:loot';
    c.group.add(lootCrate);
    c.gate('alcove', {}, [0, 0, 0, 0, 0, 0]);
  }
  c.interact({ id: 'bunker_alcove', localPos: [5.3, FL + 1.4, 1.6], verb: 'PRY', label: 'SEALED STORAGE', kind: 'tool', req: 'crowbar', reqLabel: 'CROWBAR' });
  c.interact({ id: 'bunker_alcove_loot', localPos: [4.95, FL + 1.0, 1.6], verb: 'TAKE', label: 'MAINTENANCE CACHE', kind: 'weapon', weapon: 'hatchet', items: [['medkit', 1], ['ammo9', 12]] });

  c.light('always', 0xff2a1a, 4.5, 14, 0, FL + 2.6, -1.5);
  c.light('emerg', 0xff2a1a, 8, 13, 0, FL + 2.6, 2.0);
  c.light('main', 0xffe6c0, 12, 16, 0, FL + 2.7, 0.5);
  return c;
}
