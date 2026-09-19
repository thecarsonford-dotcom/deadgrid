// DEADGRID roads — the abandoned highway spine. Terrain flattens toward the
// road polyline (core/world.ts); this module bakes lane paint onto the
// surface and places roadside storytelling props (wrecks, signs, barrels).

import * as THREE from 'three';
import { WORLD } from '../core/world';
import { MAT, crate, barrel, roadSign, sandbagStack, utilityPole, wreckedCar } from './props';
import { CollisionWorld, Box } from './collision';

const ROAD_HALF = 4.2;

export const ROAD_PTS: [number, number][] = [
  [-150, 150], [-90, 95], [-40, 62], [0, 44], [60, 28], [140, 18],
  [210, 26], [270, 42], [320, 52], [380, 40], [440, 4], [500, -34],
  [540, -58], [585, -80],
];

const SEG: { ax: number; az: number; bx: number; bz: number; len: number; dx: number; dz: number }[] = [];
for (let i = 0; i < ROAD_PTS.length - 1; i++) {
  const [ax, az] = ROAD_PTS[i];
  const [bx, bz] = ROAD_PTS[i + 1];
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  SEG.push({ ax, az, bx, bz, len, dx: dx / len, dz: dz / len });
}
export const ROAD_TOTAL = SEG.reduce((a, s) => a + s.len, 0);

/** Point along the road at arc-length t, plus direction. */
export function roadAt(t: number): { x: number; z: number; dirX: number; dirZ: number } {
  let d = t;
  for (const s of SEG) {
    if (d <= s.len) {
      const f = d / s.len;
      return { x: s.ax + (s.bx - s.ax) * f, z: s.az + (s.bz - s.az) * f, dirX: s.dx, dirZ: s.dz };
    }
    d -= s.len;
  }
  const s = SEG[SEG.length - 1];
  return { x: s.bx, z: s.bz, dirX: s.dx, dirZ: s.dz };
}

function rotY(dirX: number, dirZ: number): number {
  return Math.atan2(dirX, dirZ);
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- lane paint --------------------------------------------------------------
const PAINT = new THREE.Color(0xb0a996);

export function buildRoadPaint(): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], indices: number[] = [];
  // one quad with per-corner terrain sampling so paint never clips slopes
  const addQuad = (c: [number, number][], yOff: number): void => {
    const b = pos.length / 3;
    for (const [cx, cz] of c) {
      pos.push(cx, WORLD.groundHeight(cx, cz) + yOff, cz);
      nor.push(0, 1, 0);
      col.push(PAINT.r, PAINT.g, PAINT.b);
    }
    indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  };
  const step = 3.0;
  for (let t = 10; t < ROAD_TOTAL - 10; t += step) {
    const p = roadAt(t);
    const ry = rotY(p.dirX, p.dirZ);
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const pt = (fwd: number, lat: number): [number, number] => [p.x + cos * lat + sin * fwd, p.z - sin * lat + cos * fwd];
    // center dash split into two short quads, corner-sampled
    for (const f0 of [0, 1.2]) {
      addQuad([pt(f0, -0.07), pt(f0, 0.07), pt(f0 + 1.2, -0.07), pt(f0 + 1.2, 0.07)], 0.05);
    }
    // solid edge lines in short corner-sampled segments
    const len = Math.min(step, ROAD_TOTAL - 10 - t);
    for (const side of [-1, 1]) {
      const lat = side * (ROAD_HALF - 0.55);
      for (let f0 = 0; f0 < len - 0.01; f0 += 1.5) {
        const f1 = Math.min(f0 + 1.5, len);
        addQuad([pt(f0, lat - 0.05), pt(f0, lat + 0.05), pt(f1, lat - 0.05), pt(f1, lat + 0.05)], 0.05);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export const roadPaintMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.85,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

// --- roadside props -----------------------------------------------------------
export interface RoadLootSpec { id: string; pos: THREE.Vector3; verb: string; label: string; items: [string, number][]; }

export function buildRoadsideProps(seed: number, colliders: CollisionWorld, onLoot?: (s: RoadLootSpec) => void): THREE.Group {
  const rng = mulberry32(seed * 4241 + 99);
  const root = new THREE.Group();

  const addBoxCollider = (x: number, y: number, z: number, w: number, h: number, d: number): void => {
    const b: Box = { minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2 };
    colliders.addBox(b);
  };

  const spots: number[] = [];
  for (let t = 30; t < ROAD_TOTAL - 60; t += 30 + rng() * 28) spots.push(t);

  for (const t of spots) {
    const p = roadAt(t);
    const ry = rotY(p.dirX, p.dirZ);
    const side = rng() > 0.5 ? 1 : -1;
    const lateral = 5.5 + rng() * 3.5;
    const rx = p.x + Math.cos(ry) * side * lateral;
    const rz = p.z - Math.sin(ry) * side * lateral;
    const gy = WORLD.groundHeight(rx, rz);
    if (gy < WORLD.WATER_Y + 0.3) continue;
    const roll = rng();
    const propRot = ry + (rng() - 0.5) * 0.9;

    if (roll < 0.36) {
      const car = wreckedCar([0x4c5257, 0x5a4a3a, 0x39424e, 0x6b6250][Math.floor(rng() * 4)], rng() > 0.7).group;
      car.position.set(rx, gy, rz);
      car.rotation.y = propRot;
      root.add(car);
      addBoxCollider(rx, gy, rz, 2.4, 1.7, 4.8);
      // every third authored wreck is searchable — travel has pickup beats
      if (onLoot && Math.floor(t / 30) % 3 === 0) {
        onLoot({
          id: `roadwreck_${Math.round(t)}`,
          pos: new THREE.Vector3(rx + Math.cos(ry) * 1.6, gy + 0.5, rz - Math.sin(ry) * 1.6),
          verb: 'SEARCH',
          label: 'WRECKED CAR',
          items: [
            ['ammo9', 8 + Math.floor(rng() * 8)],
            rng() > 0.5 ? ['food', 1] : ['bandage', 1],
          ],
        });
      }
    } else if (roll < 0.5) {
      const sign = roadSign(rng() < 0.45 ? 'warn' : (rng() < 0.7 ? 'route' : 'evac')).group;
      sign.position.set(rx, gy, rz);
      sign.rotation.y = ry + Math.PI * (rng() > 0.5 ? 0.95 : -0.4);
      root.add(sign);
    } else if (roll < 0.68) {
      let n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const bx = rx + (rng() - 0.5) * 2.4;
        const bz = rz + (rng() - 0.5) * 2.4;
        const by = WORLD.groundHeight(bx, bz);
        if (by < WORLD.WATER_Y + 0.2) continue;
        const b = barrel().group;
        b.position.set(bx, by, bz);
        b.rotation.y = rng() * Math.PI;
        if (rng() > 0.88) { b.rotation.z = Math.PI / 2; b.position.y = by + 0.34; }
        else addBoxCollider(bx, by, bz, 0.68, 0.92, 0.68);
        root.add(b);
      }
    } else if (roll < 0.8) {
      const pole = utilityPole().group;
      pole.position.set(rx, gy, rz);
      pole.rotation.y = ry;
      root.add(pole);
    } else {
      const g = new THREE.Group();
      g.position.set(rx, gy, rz);
      const c = crate().group;
      c.rotation.y = rng() * Math.PI;
      g.add(c);
      addBoxCollider(rx, gy, rz, 0.8, 0.65, 0.8);
      if (rng() > 0.45) {
        const sb = sandbagStack(2).group;
        sb.position.set(1.2, 0, 0.3);
        sb.rotation.y = rng();
        g.add(sb);
      }
      root.add(g);
    }
    // occasional utility pole on the other side too
    if (rng() > 0.86) {
      const ox = p.x + Math.cos(ry) * -side * 7.2;
      const oz = p.z - Math.sin(ry) * -side * 7.2;
      const pole = utilityPole().group;
      pole.position.set(ox, WORLD.groundHeight(ox, oz), oz);
      pole.rotation.y = ry;
      root.add(pole);
    }
  }

  // guaranteed authored supply caches — travel beats at fixed arc positions
  const caches: [number, [string, number][], string][] = [
    [86, [['ammo9', 12], ['food', 1]], 'ROADSIDE CACHE'],
    [196, [['ammo12', 6], ['battery', 1]], 'SUPPLY DROP'],
    [248, [['bandage', 2], ['scrap', 2]], 'SURVIVOR STASH'],
    [404, [['ammo9', 12], ['ammo12', 6]], 'ABANDONED PACK'],
  ];
  for (const [t, items, label] of caches) {
    const p = roadAt(t);
    const ry = rotY(p.dirX, p.dirZ);
    const side = ((t / 7) | 0) % 2 === 0 ? 1 : -1;
    const rx = p.x + Math.cos(ry) * side * 5.6;
    const rz = p.z - Math.sin(ry) * side * 5.6;
    const gy = WORLD.groundHeight(rx, rz);
    if (gy < WORLD.WATER_Y + 0.3) continue;
    const g = new THREE.Group();
    g.position.set(rx, gy, rz);
    const c = crate().group;
    c.rotation.y = rng() * Math.PI;
    g.add(c);
    const sb = sandbagStack(1).group;
    sb.position.set(0.75, 0, 0.2);
    g.add(sb);
    root.add(g);
    addBoxCollider(rx, gy, rz, 1.0, 0.7, 1.0);
    onLoot?.({ id: `roadcache_${t}`, pos: new THREE.Vector3(rx, gy + 0.45, rz), verb: 'SEARCH', label, items });
  }

  // --- AUTHORED ROAD WRECK BEAT (cabin → relay) -------------------------------
  // A deliberate set piece at a fixed arc position: a crashed car blocking the
  // shoulder, a body, a readable note, and a lootable wreck. It is the first
  // "something happened here" moment on the critical path — cover, story,
  // tension, and a pickup beat in one composition, not random decoration.
  {
    const t = 118;
    const p = roadAt(t);
    const ry = rotY(p.dirX, p.dirZ);
    const side = 1;
    const rx = p.x + Math.cos(ry) * side * 4.6;
    const rz = p.z - Math.sin(ry) * side * 4.6;
    const gy = WORLD.groundHeight(rx, rz);
    const car = wreckedCar(0x5a4a3a, true).group;
    car.position.set(rx, gy, rz);
    car.rotation.y = ry + 0.55;
    root.add(car);
    addBoxCollider(rx, gy, rz, 2.4, 1.7, 4.8);
    // a second vehicle half off the road — the crash was a pile-up
    const car2 = wreckedCar(0x39424e, false).group;
    const rx2 = p.x + Math.cos(ry) * side * 7.4;
    const rz2 = p.z - Math.sin(ry) * side * 7.4;
    car2.position.set(rx2, WORLD.groundHeight(rx2, rz2), rz2);
    car2.rotation.y = ry - 0.8;
    root.add(car2);
    addBoxCollider(rx2, WORLD.groundHeight(rx2, rz2), rz2, 2.4, 1.7, 4.8);
    // scattered glass/debris on the asphalt
    for (let i = 0; i < 5; i++) {
      const dx = (rng() - 0.5) * 6, dz = (rng() - 0.5) * 6;
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.12 + rng() * 0.2, 0.03, 0.12 + rng() * 0.2), MAT.metalDark);
      sh.position.set(p.x + dx, WORLD.groundHeight(p.x + dx, p.z + dz) + 0.02, p.z + dz);
      sh.rotation.y = rng() * Math.PI;
      root.add(sh);
    }
    onLoot?.({
      id: 'roadwreck_authored',
      pos: new THREE.Vector3(rx + Math.cos(ry) * 1.4, gy + 0.5, rz - Math.sin(ry) * 1.4),
      verb: 'SEARCH', label: 'CRASHED CAR',
      items: [['ammo9', 14], ['bandage', 2], ['battery', 1]],
    });
  }

  // --- INFRASTRUCTURE CORRIDOR (relay approach) -------------------------------
  // A continuous line of utility poles + cable runs on the relay side of the
  // road. The player reads "power line → follow it → relay" — environmental
  // navigation that replaces empty forest with a directed service corridor.
  {
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x181a1c, roughness: 0.9 });
    let prev: { x: number; z: number; y: number } | null = null;
    for (let t = 200; t <= 268; t += 12) {
      const p = roadAt(t);
      const ry = rotY(p.dirX, p.dirZ);
      const side = ((t / 12) | 0) % 2 === 0 ? 1 : -1;
      const px = p.x + Math.cos(ry) * side * 6.4;
      const pz = p.z - Math.sin(ry) * side * 6.4;
      const py = WORLD.groundHeight(px, pz);
      if (py < WORLD.WATER_Y + 0.3) { prev = null; continue; }
      const pole = utilityPole().group;
      pole.position.set(px, py, pz);
      pole.rotation.y = ry;
      root.add(pole);
      // cable span to the previous pole — a visible line pulling the eye
      if (prev) {
        const mx = (prev.x + px) / 2, mz = (prev.z + pz) / 2;
        const len = Math.hypot(px - prev.x, pz - prev.z);
        const sag = Math.min(0.5, len * 0.04);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.06), cableMat);
        seg.position.set(mx, Math.max(prev.y, py) + 4.6 - sag, mz);
        seg.rotation.y = Math.atan2(px - prev.x, pz - prev.z) + Math.PI / 2;
        root.add(seg);
      }
      prev = { x: px, z: pz, y: py };
    }
    // a service warning sign at the corridor's start
    const warnSign = roadSign('warn').group;
    const wp = roadAt(198);
    const wry = rotY(wp.dirX, wp.dirZ);
    warnSign.position.set(wp.x + Math.cos(wry) * 5.4, WORLD.groundHeight(wp.x + Math.cos(wry) * 5.4, wp.z - Math.sin(wry) * 5.4), wp.z - Math.sin(wry) * 5.4);
    warnSign.rotation.y = wry + Math.PI * 0.95;
    root.add(warnSign);
  }

  // --- TOWER REVEAL CLEARING --------------------------------------------------
  // A deliberate opening in the tree line just before the relay: the road
  // curves, the forest thins, and the tower + facility resolve out of the
  // haze. A few rocks and a fallen log frame the vista; the beacon light
  // (fog-exempt) is the first thing the eye lands on.
  {
    const t = 276;
    const p = roadAt(t);
    const ry = rotY(p.dirX, p.dirZ);
    // rocks framing the reveal on both shoulders
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const rx = p.x + Math.cos(ry) * side * (5.5 + i * 1.6);
        const rz = p.z - Math.sin(ry) * side * (5.5 + i * 1.6);
        const gy = WORLD.groundHeight(rx, rz);
        if (gy < WORLD.WATER_Y + 0.3) continue;
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + rng() * 0.4, 0), MAT.concrete);
        rock.position.set(rx, gy + 0.15, rz);
        rock.scale.set(1.2, 0.7, 1);
        rock.rotation.y = rng() * Math.PI;
        rock.castShadow = true;
        root.add(rock);
      }
    }
    // a fallen log across the shoulder — a natural "slow down" cue
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 7), MAT.wood);
    log.rotation.z = Math.PI / 2 - 0.1;
    const lx = p.x + Math.cos(ry) * -5.8, lz = p.z - Math.sin(ry) * -5.8;
    log.position.set(lx, WORLD.groundHeight(lx, lz) + 0.2, lz);
    log.rotation.y = ry + 0.3;
    log.castShadow = true;
    root.add(log);
  }

  // guardrail stretches near curves — post + rail heights follow terrain
  for (const t0 of [150, 330, 480]) {
    for (let i = 0; i < 8; i++) {
      const p = roadAt(t0 + i * 3.2);
      const ry = rotY(p.dirX, p.dirZ);
      const gx = p.x + Math.cos(ry) * 5.2;
      const gz = p.z - Math.sin(ry) * 5.2;
      const gy = WORLD.groundHeight(gx, gz);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), MAT.metalDark);
      post.position.set(gx, gy + 0.45, gz);
      post.castShadow = true;
      root.add(post);
    }
    // rail built from short segments so it tracks the grade
    for (let i = 0; i < 7; i++) {
      const t = t0 + i * 3.2 + 1.6;
      const p = roadAt(t);
      const ry = rotY(p.dirX, p.dirZ);
      const gx = p.x + Math.cos(ry) * 5.2;
      const gz = p.z - Math.sin(ry) * 5.2;
      const gy = WORLD.groundHeight(gx, gz);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 3.3), MAT.metal);
      rail.position.set(gx, gy + 0.78, gz);
      rail.rotation.y = ry;
      rail.rotation.x = Math.atan2(
        WORLD.groundHeight(roadAt(t + 1.6).x, roadAt(t + 1.6).z) -
        WORLD.groundHeight(roadAt(t - 1.6).x, roadAt(t - 1.6).z), 6.4);
      rail.castShadow = true;
      root.add(rail);
    }
  }
  return root;
}