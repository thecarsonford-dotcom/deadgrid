// DEADGRID terrain renderer — smooth heightfield chunks.
// One 1m-grid surface mesh per chunk with per-vertex color blending
// (grass / dry grass / dirt / rock / sand / asphalt), finite-difference
// normals so chunk seams shade continuously, and water as a simple plane.

import * as THREE from 'three';
import { WORLD, padBlend, roadDist } from '../core/world';

const CELL = 0.5;
const ROAD_HALF = 4.2;

// grounded, desaturated palette
const C_GRASS = new THREE.Color(0x556038);
const C_GRASS2 = new THREE.Color(0x646e3d);
const C_DRY = new THREE.Color(0x77704a);
const C_DIRT = new THREE.Color(0x5e4c38);
const C_ROCK = new THREE.Color(0x6d7076);
const C_SAND = new THREE.Color(0x877d68);
const C_ASPHALT = new THREE.Color(0x47494e);
const C_ASPHALT2 = new THREE.Color(0x50525a);

const tmpC = new THREE.Color();

export const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  metalness: 0.0,
});

// Deterministic soft noise for color variation (cheap hash-based).
function vnoise(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function buildTerrainGeometry(cx: number, cz: number): THREE.BufferGeometry {
  const N = WORLD.CHUNK / CELL; // verts per side
  const ox = cx * WORLD.CHUNK;
  const oz = cz * WORLD.CHUNK;
  const count = (N + 1) * (N + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const eps = 0.9;

  // heights + normals
  const hAt = (wx: number, wz: number): number => WORLD.groundHeight(wx, wz);
  for (let iz = 0; iz <= N; iz++) {
    for (let ix = 0; ix <= N; ix++) {
      const wx = ox + ix * CELL;
      const wz = oz + iz * CELL;
      const h = hAt(wx, wz);
      const i = iz * (N + 1) + ix;
      positions[i * 3] = wx;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = wz;
      const hx = hAt(wx + eps, wz) - hAt(wx - eps, wz);
      const hz = hAt(wx, wz + eps) - hAt(wx, wz - eps);
      const nx = -hx, ny = 2 * eps, nz = -hz;
      const l = Math.hypot(nx, ny, nz);
      normals[i * 3] = nx / l;
      normals[i * 3 + 1] = ny / l;
      normals[i * 3 + 2] = nz / l;
    }
  }

  // colors
  for (let iz = 0; iz <= N; iz++) {
    for (let ix = 0; ix <= N; ix++) {
      const i = iz * (N + 1) + ix;
      const wx = positions[i * 3], wy = positions[i * 3 + 1], wz = positions[i * 3 + 2];
      const slope = 1 - normals[i * 3 + 1]; // 0 flat .. ~1 steep
      const va = vnoise(wx * 0.13, wz * 0.13);
      const vb = vnoise(wx * 0.045, wz * 0.045);

      // start from grass mix
      tmpC.copy(C_GRASS).lerp(C_GRASS2, va);
      tmpC.lerp(C_DRY, vb * 0.4);

      // dirt patches
      const patch = vnoise(wx * 0.05 + 40, wz * 0.05 - 60);
      if (patch > 0.72) tmpC.lerp(C_DIRT, (patch - 0.72) * 2.4);

      // slope → dirt → rock
      if (slope > 0.28) tmpC.lerp(C_DIRT, Math.min(1, (slope - 0.28) * 2.6));
      if (slope > 0.55) tmpC.lerp(C_ROCK, Math.min(1, (slope - 0.55) * 2.2));

      // shoreline sand
      if (wy < WORLD.WATER_Y + 0.8) {
        const t = Math.min(1, (WORLD.WATER_Y + 0.8 - wy) / 1.6);
        tmpC.lerp(C_SAND, t);
      }

      // road: asphalt + variation
      const rd = roadDist(wx, wz);
      if (rd < ROAD_HALF + 0.6) {
        const t = Math.min(1, Math.max(0, (ROAD_HALF + 0.6 - rd) / 0.6));
        tmpC.lerp(va > 0.5 ? C_ASPHALT : C_ASPHALT2, Math.min(1, t * 1.2));
        // dirt shoulder just past the pavement
        if (rd > ROAD_HALF - 0.4 && rd < ROAD_HALF + 0.6) tmpC.lerp(C_DIRT, 0.35);
      }

      // flatten-pad ground: compacted dirt/gravel look
      const pad = padBlend(wx, wz);
      if (pad && pad.weight > 0.25) {
        tmpC.lerp(C_DIRT, 0.5 * pad.weight);
        tmpC.lerp(C_SAND, 0.15 * pad.weight);
      }

      colors[i * 3] = tmpC.r;
      colors[i * 3 + 1] = tmpC.g;
      colors[i * 3 + 2] = tmpC.b;
    }
  }

  // indices
  const quads = N * N;
  const indices = new Uint32Array(quads * 6);
  let p = 0;
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const a = iz * (N + 1) + ix;
      const b = a + 1;
      const c = a + N + 1;
      const d = c + 1;
      indices[p++] = a; indices[p++] = c; indices[p++] = b;
      indices[p++] = b; indices[p++] = c; indices[p++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------
// Water — one plane that follows the camera. Ponds appear where terrain dips
// below WATER_Y. The plane fades out radially before the terrain-streaming
// edge so it never reads as an endless ocean past the loaded world.
// ---------------------------------------------------------------------------
export function makeWater(): THREE.Mesh {
  const R = 210;
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, 24, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x2d4550) },
      uShallow: { value: new THREE.Color(0x4d6d78) },
    },
    vertexShader: `
      varying vec2 vXZ;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec2 vXZ;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform float uTime;
      void main(){
        float d = length(vXZ);
        // soft circular fade before the streaming edge
        float fade = 1.0 - smoothstep(150.0, 200.0, d);
        // gentle ripple sheen
        float rip = sin(vXZ.x * 0.55 + uTime * 0.7) * sin(vXZ.y * 0.43 - uTime * 0.5);
        vec3 col = mix(uShallow, uDeep, smoothstep(30.0, 120.0, d));
        col += vec3(0.02, 0.03, 0.03) * rip;
        gl_FragColor = vec4(col, 0.78 * fade);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = WORLD.WATER_Y - 0.12;
  m.renderOrder = 1;
  return m;
}