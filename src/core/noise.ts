// Deterministic, seedable value-noise (2D and 3D) with fractal Brownian motion.
// No external dependencies. Fast enough for terrain sampling.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERM = new Float32Array(512);
function initSeed(seed: number): void {
  const rng = mulberry32((seed ?? 1337) >>> 0);
  for (let i = 0; i < 256; i++) PERM[i] = rng();
  for (let i = 256; i < 512; i++) PERM[i] = PERM[i - 256];
}
let currentSeed = 1337;
initSeed(1337);

export function setNoiseSeed(seed: number): void {
  currentSeed = seed | 0;
  initSeed(currentSeed);
}

function smooth(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// 2D value noise in [-1, 1]
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const h = (ix: number, iy: number): number => {
    const key = (ix & 255) ^ (iy & 255);
    return (PERM[(key) & 511] * 2 - 1);
  };
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

export function fbm2(x: number, y: number, octaves: number, lac = 2, gain = 0.5): number {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

// 3D value noise in [-1, 1]
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  const h = (ix: number, iy: number, iz: number): number => {
    const key = ((ix & 255) ^ (iy & 255) ^ (iz & 255)) & 511;
    return PERM[key] * 2 - 1;
  };
  const c000 = h(xi, yi, zi);
  const c100 = h(xi + 1, yi, zi);
  const c010 = h(xi, yi + 1, zi);
  const c110 = h(xi + 1, yi + 1, zi);
  const c001 = h(xi, yi, zi + 1);
  const c101 = h(xi + 1, yi, zi + 1);
  const c011 = h(xi, yi + 1, zi + 1);
  const c111 = h(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

export function fbm3(x: number, y: number, z: number, octaves: number, lac = 2, gain = 0.5): number {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * freq, y * freq, z * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

// Cheap deterministic hash in [0,1)
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}
export function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

// Alias wrappers for the terrain module
export const snoise2 = fbm2;
export const snoise3 = fbm3;
