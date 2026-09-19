// DEADGRID terrain core — a continuous, smooth post-collapse wilderness.
// Replaces the old blocky voxel surface: terrain is a heightfield sampled by
// fbm noise, flattened around roads and key POIs so the world reads as a
// natural, human-scale environment instead of stacked cubes.

import { fbm2, hash2 } from './noise';

export const WORLD = {
  WATER_Y: 25.0,
  CHUNK: 32, // world units per terrain chunk

  // Continuous ground height at any world position. Used by rendering,
// collision and AI. Range roughly 26..58.
  groundHeight(x: number, z: number): number {
    const base =
      fbm2(x * 0.0042, z * 0.0042, 4, 2.05, 0.5) * 20 +
      fbm2(x * 0.016, z * 0.016, 3, 2, 0.5) * 5 +
      fbm2(x * 0.07, z * 0.07, 2, 2, 0.5) * 1.1;
    // gentle valley shaping: rare shallow ponds in the deepest basins
    let h = 38 + base;
    if (h < 31) h = 31 + (h - 31) * 0.7;
    // road corridor: smooth the terrain along the road profile
    const road = roadFlatten(x, z);
    if (road.weight > 0) h = h * (1 - road.weight) + road.y * road.weight;
    // pads flatten fully around key structures
    const pad = padBlend(x, z);
    if (pad) h = h * (1 - pad.weight) + pad.y * pad.weight;
    return h;
  },

  // forest density 0..1 — drives scatter counts
  forest(x: number, z: number): number {
    const f = fbm2(x * 0.011, z * 0.011, 3, 2, 0.55) * 0.5 + 0.5;
    const clear = fbm2(x * 0.004 + 900, z * 0.004 - 300, 2, 2, 0.5) * 0.5 + 0.5;
    return Math.max(0, f * 1.15 - (clear - 0.55) * 0.9);
  },

  // 0-1 deterministic hash for scatter decisions
  hash(x: number, z: number, salt = 0): number {
    return hash2((x | 0) * 31 + salt, (z | 0) * 57 + salt * 7);
  },
};

// ---------------------------------------------------------------------------
// Road network — a polyline the terrain flattens toward and props/POIs align
// to. Defined once; roadFlatten/roadDistance are pure functions so terrain
// meshing, scatter and gameplay can all query it cheaply.
// ---------------------------------------------------------------------------

const ROAD_PTS: [number, number][] = [
  [-150, 150], [-90, 95], [-40, 62], [0, 44], [60, 28], [140, 18],
  [210, 26], [270, 42], [320, 52], [380, 40], [440, 4], [500, -34],
  [540, -58], [585, -80],
];

const ROAD_SEG: { ax: number; az: number; bx: number; bz: number; len: number }[] = [];
for (let i = 0; i < ROAD_PTS.length - 1; i++) {
  const [ax, az] = ROAD_PTS[i];
  const [bx, bz] = ROAD_PTS[i + 1];
  ROAD_SEG.push({ ax, az, bx, bz, len: Math.hypot(bx - ax, bz - az) });
}

const ROAD_HALF = 4.2; // paved half-width
const ROAD_BLEND = 13.0; // corridor width over which terrain eases to road

export interface RoadInfo {
  dist: number;      // distance to road centerline
  weight: number;    // 0..1 flatten blend inside corridor
  paved: boolean;    // inside asphalt
}

/** Distance from (x,z) to the road polyline. */
export function roadDist(x: number, z: number): number {
  let best = Infinity;
  for (const s of ROAD_SEG) {
    const vx = s.bx - s.ax, vz = s.bz - s.az;
    const wx = x - s.ax, wz = z - s.az;
    const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (s.len * s.len)));
    const px = s.ax + vx * t, pz = s.az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

// road surface height = smoothed terrain sampled along the polyline.
// Precomputed once at 2m steps along the arc so the profile is perfectly
// smooth along the road — quantizing the sample position by rounding the
// nearest-point coordinates created huge stepped terraces in the terrain.
const ROAD_PROFILE_STEP = 2;
const roadProfile: number[] = [];
{
  const raw = (rx: number, rz: number): number => {
    const base =
      fbm2(rx * 0.0042, rz * 0.0042, 4, 2.05, 0.5) * 20 +
      fbm2(rx * 0.016, rz * 0.016, 3, 2, 0.5) * 5 +
      fbm2(rx * 0.07, rz * 0.07, 2, 2, 0.5) * 1.1;
    let h = 38 + base;
    if (h < 31) h = 31 + (h - 31) * 0.7;
    return h;
  };
  let total = 0;
  for (let i = 0; i < ROAD_SEG.length; i++) total += ROAD_SEG[i].len;
  const n = Math.ceil(total / ROAD_PROFILE_STEP);
  for (let i = 0; i <= n; i++) {
    const t = Math.min(total, i * ROAD_PROFILE_STEP);
    // walk the polyline to arc position t
    let d = t, px = 0, pz = 0;
    for (const s of ROAD_SEG) {
      if (d <= s.len) {
        const f = d / s.len;
        px = s.ax + (s.bx - s.ax) * f;
        pz = s.az + (s.bz - s.az) * f;
        break;
      }
      d -= s.len;
    }
    // profile = smoothed raw terrain along the centerline (kills local spikes)
    roadProfile.push((raw(px, pz) + raw(px + 5, pz + 2.5) + raw(px - 4, pz - 2)) / 3);
  }
}

function roadProfileY(tArc: number): number {
  const f = tArc / ROAD_PROFILE_STEP;
  const i = Math.max(0, Math.min(roadProfile.length - 2, Math.floor(f)));
  const frac = f - i;
  return roadProfile[i] * (1 - frac) + roadProfile[i + 1] * frac;
}

function roadFlatten(x: number, z: number): { weight: number; y: number } {
  // find nearest point on polyline (and its arc position)
  let best = Infinity, arc = 0;
  let acc = 0;
  for (const s of ROAD_SEG) {
    const vx = s.bx - s.ax, vz = s.bz - s.az;
    const wx = x - s.ax, wz = z - s.az;
    const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (s.len * s.len)));
    const px = s.ax + vx * t, pz = s.az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; arc = acc + t * s.len; }
    acc += s.len;
  }
  if (best > ROAD_BLEND) return { weight: 0, y: 0 };
  const weight = 1 - Math.min(1, Math.max(0, (best - ROAD_HALF) / (ROAD_BLEND - ROAD_HALF)));
  const smooth = weight * weight * (3 - 2 * weight);
  return { weight: smooth, y: roadProfileY(arc) };
}

export function roadInfo(x: number, z: number): RoadInfo {
  const d = roadDist(x, z);
  return { dist: d, weight: 0, paved: d < ROAD_HALF };
}

export function onRoad(x: number, z: number): boolean {
  return roadDist(x, z) < ROAD_HALF;
}

// ---------------------------------------------------------------------------
// Flatten pads around the fixed campaign POIs. Terrain height snaps to the
// pad height inside the radius so structures always sit on clean ground.
// ---------------------------------------------------------------------------

export interface Pad { x: number; z: number; r: number; y: number | null; }
const PADS: Pad[] = [
  { x: 14, z: 26, r: 12, y: null },      // cabin
  { x: 300, z: 70, r: 26, y: null },     // radio facility
  { x: 560, z: -78, r: 22, y: null },    // bunker
  { x: 430, z: 44, r: 24, y: null },     // industrial yard
  { x: -72, z: 92, r: 30, y: null },     // suburb
  { x: 368, z: 30, r: 10, y: null },     // checkpoint
  { x: 180, z: 8, r: 10, y: null },      // evacuation camp
];

// pad heights are sampled once from raw terrain (no pads/roads) at init
for (const p of PADS) {
  const raw =
    fbm2(p.x * 0.0042, p.z * 0.0042, 4, 2.05, 0.5) * 20 +
    fbm2(p.x * 0.016, p.z * 0.016, 3, 2, 0.5) * 5 +
    fbm2(p.x * 0.07, p.z * 0.07, 2, 2, 0.5) * 1.1;
  let h = 38 + raw;
  if (h < 31) h = 31 + (h - 31) * 0.7;
  // pads never sink below the waterline
  p.y = Math.round(Math.max(h, WORLD.WATER_Y + 1.3) * 2) / 2;
}

/** Returns pad blend info: {y, weight} if inside a pad, else null. */
export function padBlend(x: number, z: number): { y: number; weight: number } | null {
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r) {
      if (d < p.r * 0.62) return { y: p.y!, weight: 1 };
      const t = (d - p.r * 0.62) / (p.r * 0.38);
      return { y: p.y!, weight: 1 - t * t * (3 - 2 * t) };
    }
  }
  return null;
}

/** TRUE if (x,z) is inside any pad's inner radius (used to suppress trees). */
export function inPad(x: number, z: number): boolean {
  for (const p of PADS) if (Math.hypot(x - p.x, z - p.z) < p.r * 1.05) return true;
  return false;
}

export { PADS };

// Water: terrain below WATER_Y forms shallow ponds; scatter avoids water.
export function isWater(x: number, z: number): boolean {
  return WORLD.groundHeight(x, z) < WORLD.WATER_Y + 0.15;
}
