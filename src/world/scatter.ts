// DEADGRID scatter — vegetation and natural debris, deterministically placed
// per chunk and merged into ONE draw call per chunk. Stylized-realistic
// low-poly: layered conifers, broadleaf trees, dead snags, stumps, logs,
// rocks, brush and grass. All templates are NON-INDEXED vertex soups with a
// baked 'color' attribute; the chunk baker transforms them onto the terrain.

import * as THREE from 'three';
import { WORLD, inPad, padBlend, roadDist } from '../core/world';

// --- critical-path authored clearings ----------------------------------------
// The cabin → relay leg must not read as an endless uniform pine band. These
// fixed clearings thin the tree line at authored moments: the cabin exit
// vista, the road-wreck beat, the tower reveal, and the relay approach.
// Trees are rejected inside these radii, producing deliberate openings that
// frame landmarks and break the repetition.
const CLEARINGS: { x: number; z: number; r: number }[] = [
  { x: 14, z: 40, r: 14 },     // cabin exit — open sightline down the driveway
  { x: 60, z: 28, r: 12 },     // road wreck beat — the pile-up needs room
  { x: 140, z: 18, r: 11 },    // mid-leg clearing — a breather + vista
  { x: 210, z: 26, r: 12 },    // infrastructure corridor — poles need sky
  { x: 270, z: 42, r: 15 },    // tower reveal — the facility resolves out
  { x: 300, z: 70, r: 18 },    // relay pad — the destination is open ground
];
function inClearing(x: number, z: number): boolean {
  for (const cl of CLEARINGS) {
    const dx = x - cl.x, dz = z - cl.z;
    if (dx * dx + dz * dz < cl.r * cl.r) return true;
  }
  return false;
}

// --- tiny seeded PRNG -------------------------------------------------------
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- geometry baker ----------------------------------------------------------
// Collects transformed template geometry (position/normal/color) into flat
// arrays. Templates MUST be non-indexed and carry a 'color' attribute.
class Baker {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];

  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, tint: THREE.Color): void {
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = geo.getAttribute('normal') as THREE.BufferAttribute;
    const c = geo.getAttribute('color') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const n3 = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      this.positions.push(v.x, v.y, v.z);
      n3.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.normals.push(n3.x, n3.y, n3.z);
      this.colors.push(c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b);
    }
  }

  build(): THREE.BufferGeometry | null {
    if (this.positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.computeBoundingSphere();
    return geo;
  }
}

// --- template construction ---------------------------------------------------
// paint() writes a per-vertex color with subtle value jitter so merged
// geometry never reads flat.
function paint(geo: THREE.BufferGeometry, color: number, jitter = 0, rng?: () => number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const col = new THREE.Color(color);
  const count = g.getAttribute('position').count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = jitter > 0 ? ((rng ? rng() : Math.random()) - 0.5) * jitter : 0;
    arr[i * 3] = col.r + j; arr[i * 3 + 1] = col.g + j; arr[i * 3 + 2] = col.b + j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

interface Template { geo: THREE.BufferGeometry; }

// Merge parts with full transforms (y offset, yaw, pitch, roll, scale).
// Everything is flattened to non-indexed so triangle order is preserved.
function mergeParts(parts: {
  geo: THREE.BufferGeometry; y?: number; rot?: number; tilt?: number; roll?: number; scale?: number; origin?: [number, number];
}[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const v = new THREE.Vector3(), nv = new THREE.Vector3();
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const s = new THREE.Vector3();
  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
    e.set(part.roll ?? 0, part.rot ?? 0, part.tilt ?? 0, 'YXZ');
    q.setFromEuler(e);
    const sc = part.scale ?? 1;
    s.set(sc, sc, sc);
    const ox = part.origin?.[0] ?? 0, oz = part.origin?.[1] ?? 0;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - ox, p.getY(i), p.getZ(i) - oz).applyQuaternion(q).multiply(s);
      nv.set(n.getX(i), n.getY(i), n.getZ(i)).applyQuaternion(q).normalize();
      pos.push(v.x, v.y + (part.y ?? 0), v.z);
      nor.push(nv.x, nv.y, nv.z);
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

const T: Record<string, Template> = {};

function buildTemplates(): void {
  // PINE — tall tapered trunk, layered conical canopy with branch-tier silhouettes
  {
    const parts: Parameters<typeof mergeParts>[0] = [
      { geo: paint(new THREE.CylinderGeometry(0.10, 0.30, 3.4, 7), 0x5b4630, 0.05), y: 1.6 },
      { geo: paint(new THREE.CylinderGeometry(0.06, 0.14, 2.2, 6), 0x55402c, 0.05), y: 4.2 },
    ];
    // canopy tiers: wide at bottom, tight at top, alternating greens
    const tiers = [
      { r: 1.75, h: 1.5, y: 3.2, c: 0x2c3d26 },
      { r: 1.45, h: 1.5, y: 4.2, c: 0x334727 },
      { r: 1.15, h: 1.4, y: 5.2, c: 0x3a4f2a },
      { r: 0.85, h: 1.3, y: 6.1, c: 0x41572c },
      { r: 0.55, h: 1.2, y: 7.0, c: 0x485e2f },
      { r: 0.28, h: 1.0, y: 7.9, c: 0x506432 },
    ];
    for (const t of tiers) {
      parts.push({ geo: paint(new THREE.ConeGeometry(t.r, t.h, 8), t.c, 0.06), y: t.y });
    }
    T.pine = { geo: mergeParts(parts) };
  }
  // OAK — broadleaf: branching trunk + clumped ellipsoid canopy
  {
    const parts: Parameters<typeof mergeParts>[0] = [
      { geo: paint(new THREE.CylinderGeometry(0.14, 0.26, 2.2, 7), 0x63513a, 0.06), y: 1.1 },
      // main boughs
      { geo: paint(new THREE.CylinderGeometry(0.05, 0.09, 1.3, 5), 0x5c4a34, 0.06), y: 2.0, rot: 0.5, tilt: 0.7, origin: [0, 0] },
      { geo: paint(new THREE.CylinderGeometry(0.05, 0.09, 1.2, 5), 0x5c4a34, 0.06), y: 2.2, rot: 3.6, tilt: 0.8, origin: [0, 0] },
      { geo: paint(new THREE.CylinderGeometry(0.04, 0.08, 1.0, 5), 0x554432, 0.06), y: 2.6, rot: 2.1, tilt: 0.5, origin: [0, 0] },
    ];
    // canopy clumps — irregular spheres pushed outward
    const clumps: [number, number, number, number][] = [
      [0, 3.3, 0, 1.5], [0.9, 3.0, 0.4, 1.05], [-0.8, 3.1, -0.3, 1.1],
      [0.2, 3.9, -0.9, 0.95], [-0.4, 3.8, 0.8, 0.9], [1.1, 3.6, -0.6, 0.8],
    ];
    const leaf = [0x5d7438, 0x677e3e, 0x52682f, 0x6d8544];
    clumps.forEach((cl, i) => {
      const g = new THREE.IcosahedronGeometry(cl[3], 0);
      const p = g.getAttribute('position');
      for (let vi = 0; vi < p.count; vi++) {
        const j = 0.8 + ((Math.sin(vi * 61.7 + i * 13) * 0.5 + 0.5) * 0.4);
        p.setXYZ(vi, p.getX(vi) * j, p.getY(vi) * j * 0.8, p.getZ(vi) * j);
      }
      g.computeVertexNormals();
      parts.push({ geo: paint(g, leaf[i % leaf.length], 0.05), y: cl[1], origin: [cl[0], cl[2]], rot: i * 1.3 });
    });
    T.oak = { geo: mergeParts(parts) };
  }
  // DEAD TREE — weathered snag, jagged broken branches (tilted properly)
  {
    const parts: Parameters<typeof mergeParts>[0] = [
      { geo: paint(new THREE.CylinderGeometry(0.07, 0.20, 3.4, 6), 0x6e675c, 0.07), y: 1.7 },
      { geo: paint(new THREE.CylinderGeometry(0.02, 0.07, 1.5, 5), 0x675f54, 0.07), y: 2.6, rot: 0.8, tilt: 1.05 },
      { geo: paint(new THREE.CylinderGeometry(0.015, 0.06, 1.1, 5), 0x605850, 0.07), y: 1.9, rot: 3.5, tilt: 1.25 },
      { geo: paint(new THREE.CylinderGeometry(0.012, 0.045, 0.8, 4), 0x59524b, 0.07), y: 3.3, rot: 2.0, tilt: 0.9 },
      { geo: paint(new THREE.CylinderGeometry(0.02, 0.05, 0.6, 4), 0x665e53, 0.07), y: 1.5, rot: 4.6, tilt: 1.4 },
    ];
    T.deadTree = { geo: mergeParts(parts) };
  }
  // STUMP — cut base with root flare
  {
    const parts: Parameters<typeof mergeParts>[0] = [
      { geo: paint(new THREE.CylinderGeometry(0.26, 0.36, 0.5, 8), 0x5d4930, 0.07), y: 0.25 },
      { geo: paint(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 8), 0x8a7354, 0.06), y: 0.5 },
    ];
    T.stump = { geo: mergeParts(parts) };
  }
  // SHRUB — multi-bush cluster with twiggy base
  {
    const parts: Parameters<typeof mergeParts>[0] = [
      { geo: paint(new THREE.IcosahedronGeometry(0.34, 0), 0x3c4c28, 0.08), y: 0.26 },
      { geo: paint(new THREE.IcosahedronGeometry(0.26, 0), 0x465730, 0.08), y: 0.34, rot: 1.1 },
      { geo: paint(new THREE.IcosahedronGeometry(0.2, 0), 0x40502a, 0.08), y: 0.3, rot: 2.4 },
      { geo: paint(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4), 0x4e4028, 0.06), y: 0.2, rot: 0.4, tilt: 0.5 },
    ];
    T.shrub = { geo: mergeParts(parts) };
  }
  // BRUSH — dead twiggy mound (reclaiming clearings)
  {
    const parts: Parameters<typeof mergeParts>[0] = [];
    for (let i = 0; i < 6; i++) {
      parts.push({
        geo: paint(new THREE.CylinderGeometry(0.008, 0.02, 0.5 + (i % 3) * 0.2, 4), 0x6a5f4c, 0.06),
        y: 0.22, rot: i * 1.05, tilt: 0.35 + (i % 2) * 0.25,
      });
    }
    T.brush = { geo: mergeParts(parts) };
  }
  // ROCK — two squashed boulder variants
  {
    const g = new THREE.IcosahedronGeometry(0.55, 0);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const j = 0.85 + (Math.sin(i * 91.7) * 0.5 + 0.5) * 0.3;
      p.setXYZ(i, p.getX(i) * j * 1.25, p.getY(i) * j * 0.7, p.getZ(i) * j);
    }
    g.computeVertexNormals();
    T.rock = { geo: paint(g, 0x83878d, 0.05) };
    const g2 = new THREE.IcosahedronGeometry(0.34, 0);
    const p2 = g2p(g2);
    function g2p(gg: THREE.BufferGeometry) { return gg.getAttribute('position'); }
    for (let i = 0; i < p2.count; i++) {
      const j = 0.8 + (Math.sin(i * 51.3) * 0.5 + 0.5) * 0.35;
      p2.setXYZ(i, p2.getX(i) * j * 1.4, p2.getY(i) * j * 0.65, p2.getZ(i) * j);
    }
    g2.computeVertexNormals();
    T.rockSmall = { geo: paint(g2, 0x7d8086, 0.07) };
  }
  // LOG — fallen trunk with stub branches
  {
    const body = paint(new THREE.CylinderGeometry(0.20, 0.24, 2.6, 7), 0x574431, 0.06);
    body.rotateZ(Math.PI / 2);
    const stub1 = paint(new THREE.CylinderGeometry(0.03, 0.06, 0.7, 5), 0x54402d, 0.06);
    const stub2 = paint(new THREE.CylinderGeometry(0.02, 0.05, 0.55, 5), 0x503c2a, 0.06);
    T.log = { geo: mergeParts([
      { geo: body, y: 0.2 },
      { geo: stub1, rot: 0.7, tilt: 1.2, origin: [0.9, 0], y: 0.34 },
      { geo: stub2, rot: 3.9, tilt: 1.1, origin: [-0.7, 0], y: 0.3 },
    ]) };
  }
  // GRASS TUFT — crossed tapered blades (reads as grass, not spikes)
  {
    const blades: Parameters<typeof mergeParts>[0] = [];
    for (let i = 0; i < 5; i++) {
      const h = 0.28 + (i % 3) * 0.12;
      const b = new THREE.ConeGeometry(0.05, h, 3, 1, true);
      blades.push({ geo: paint(b, i % 2 ? 0x6d7440 : 0x7a7f45, 0.05), y: h * 0.42, rot: i * 1.25, tilt: 0.12 + (i % 2) * 0.1 });
    }
    T.tuft = { geo: mergeParts(blades) };
  }
  // WEEDS — taller dry stalk cluster for meadows/roadsides
  {
    const stalks: Parameters<typeof mergeParts>[0] = [];
    for (let i = 0; i < 4; i++) {
      stalks.push({
        geo: paint(new THREE.ConeGeometry(0.02, 0.55 + (i % 2) * 0.2, 3, 1, true), 0x8a8352, 0.05),
        y: 0.26, rot: i * 1.6, tilt: 0.15,
      });
    }
    T.weed = { geo: mergeParts(stalks) };
  }
  // FERN — layered low fronds for forest floor
  {
    const fronds: Parameters<typeof mergeParts>[0] = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.ConeGeometry(0.09, 0.4, 3, 1, true);
      fronds.push({ geo: paint(f, 0x44562c, 0.06), y: 0.16, rot: i * 1.57, tilt: 0.55 });
    }
    T.fern = { geo: mergeParts(fronds) };
  }
  // FALLEN BRANCH — small deadfall litter
  {
    const b = paint(new THREE.CylinderGeometry(0.025, 0.04, 1.1, 5), 0x5f4b35, 0.06);
    b.rotateZ(Math.PI / 2 - 0.15);
    const b2 = paint(new THREE.CylinderGeometry(0.015, 0.025, 0.6, 4), 0x584631, 0.06);
    b2.rotateZ(Math.PI / 2 + 0.4);
    T.branch = { geo: mergeParts([
      { geo: b, y: 0.05 },
      { geo: b2, rot: 0.8, y: 0.04 },
    ]) };
  }
}
buildTemplates();

// --- per-chunk scatter -------------------------------------------------------

export const scatterMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0.0,
});

interface Spot { x: number; z: number; s: number; ry: number; lean: number; }

function spots(
  rng: () => number, cx: number, cz: number, want: number,
  minRoad: number, sizeMin: number, sizeMax: number, avoidPads: boolean,
  maxSlope = 1.1,
): Spot[] {
  const out: Spot[] = [];
  const ox = cx * WORLD.CHUNK, oz = cz * WORLD.CHUNK;
  for (let tries = 0; tries < want * 3 && out.length < want; tries++) {
    const x = ox + rng() * WORLD.CHUNK;
    const z = oz + rng() * WORLD.CHUNK;
    if (WORLD.groundHeight(x, z) < WORLD.WATER_Y + 0.35) continue;
    if (roadDist(x, z) < minRoad) continue;
    if (inClearing(x, z)) continue;
    // pads: trees never; small props only on the outer blend ring (verge dressing)
    if (avoidPads && inPad(x, z)) continue;
    if (!avoidPads) {
      const pad = padBlend(x, z);
      if (pad && pad.weight > 0.4) continue;
    }
    const h = WORLD.groundHeight(x, z);
    const hx = WORLD.groundHeight(x + 1, z) - h;
    const hz = WORLD.groundHeight(x, z + 1) - h;
    if (Math.hypot(hx, hz) > maxSlope) continue;
    out.push({ x, z, s: sizeMin + rng() * (sizeMax - sizeMin), ry: rng() * Math.PI * 2, lean: (rng() - 0.5) * 0.07 });
  }
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function buildScatterGeometry(cx: number, cz: number, seed: number): THREE.BufferGeometry | null {
  const rng = mulberry32(seed * 7919 + cx * 131 + cz * 173 + 17);
  const baker = new Baker();
  const ox = cx * WORLD.CHUNK, oz = cz * WORLD.CHUNK;

  const density = WORLD.forest(ox + WORLD.CHUNK / 2, oz + WORLD.CHUNK / 2);

  // clustering: 1-2 forest cluster centers pull trees toward groves
  const clusters: { x: number; z: number; r: number }[] = [];
  const nClusters = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < nClusters; i++) {
    clusters.push({
      x: ox + 4 + rng() * (WORLD.CHUNK - 8),
      z: oz + 4 + rng() * (WORLD.CHUNK - 8),
      r: 6 + rng() * 8,
    });
  }
  const pull = (x: number, z: number): [number, number] => {
    for (const cl of clusters) {
      const dx = x - cl.x, dz = z - cl.z;
      const d = Math.hypot(dx, dz);
      if (d < cl.r) {
        const f = 0.45 * (1 - d / cl.r);
        return [x - dx * f, z - dz * f];
      }
    }
    return [x, z];
  };

  const grove = Math.min(1, density * 1.25);
  const pineN = Math.floor(grove * 22 * (0.5 + rng() * 0.6));
  const oakN = Math.floor(grove * 5 * (0.4 + rng() * 0.7));
  const deadN = Math.floor(grove * 2.2 + rng() * 1.4);
  const stumpN = Math.floor(rng() * 2.2);
  const fernN = Math.floor(grove * 10 + rng() * 6);
  const shrubN = 5 + Math.floor(rng() * 8);
  const brushN = 2 + Math.floor(rng() * 4);
  const rockN = Math.floor(rng() * 4);
  const rockSN = Math.floor(rng() * 5);
  const logN = Math.floor(rng() * 2.4);
  const branchN = Math.floor(rng() * 3.4);
  const tuftN = 16 + Math.floor(rng() * 14);
  const weedN = 4 + Math.floor(rng() * 6);

  const place = (list: Spot[], t: Template, tintH: number, tintS: number, tintL: number, sink: number): void => {
    for (const s of list) {
      const ground = WORLD.groundHeight(s.x, s.z);
      const tint = new THREE.Color().setHSL(tintH + (rng() - 0.5) * 0.015, tintS + (rng() - 0.5) * 0.08, tintL + (rng() - 0.5) * 0.1);
      _q.setFromEuler(_e.set(s.lean, s.ry, s.lean * 0.5, 'YXZ'));
      const sc = s.s;
      _s.set(sc, sc * (0.92 + rng() * 0.22), sc);
      _m.compose(_v.set(s.x, ground - sink * sc, s.z), _q, _s);
      baker.add(t.geo, _m, tint);
    }
  };

  const treeSpots = (want: number, minRoad: number, sizeMin: number, sizeMax: number): Spot[] => {
    const raw = spots(rng, cx, cz, want, minRoad, sizeMin, sizeMax, true);
    for (const s of raw) {
      const [px, pz] = pull(s.x, s.z);
      s.x = px; s.z = pz;
    }
    return raw;
  };

  place(treeSpots(pineN, 11, 0.9, 1.5), T.pine, 0.26, 0.32, 0.42, 0.25);
  place(treeSpots(oakN, 12, 0.85, 1.15), T.oak, 0.22, 0.34, 0.5, 0.2);
  place(treeSpots(deadN, 12, 0.9, 1.2), T.deadTree, 0.09, 0.08, 0.52, 0.15);
  place(spots(rng, cx, cz, stumpN, 11, 0.8, 1.2, true), T.stump, 0.09, 0.14, 0.34, 0.1);
  place(treeSpots(fernN, 9, 0.7, 1.25), T.fern, 0.25, 0.3, 0.34, 0.05);
  place(spots(rng, cx, cz, shrubN, 6.5, 0.7, 1.15, false), T.shrub, 0.24, 0.3, 0.36, 0.12);
  place(spots(rng, cx, cz, brushN, 6, 0.7, 1.1, false), T.brush, 0.11, 0.12, 0.42, 0.05);
  place(spots(rng, cx, cz, rockN, 6, 0.65, 1.15, false), T.rock, 0.62, 0.03, 0.52, 0.28);
  place(spots(rng, cx, cz, rockSN, 5.5, 0.55, 1.0, false), T.rockSmall, 0.62, 0.03, 0.48, 0.16);
  place(spots(rng, cx, cz, logN, 7, 0.8, 1.15, true), T.log, 0.08, 0.16, 0.32, 0.06);
  place(spots(rng, cx, cz, branchN, 5.5, 0.7, 1.1, false), T.branch, 0.09, 0.14, 0.32, 0.04);
  place(spots(rng, cx, cz, tuftN, 4.6, 0.6, 1.2, false), T.tuft, 0.19, 0.28, 0.34, 0.03);
  place(spots(rng, cx, cz, weedN, 4.8, 0.7, 1.2, false), T.weed, 0.14, 0.24, 0.36, 0.03);

  return baker.build();
}