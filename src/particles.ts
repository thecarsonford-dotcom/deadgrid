// DEADGRID particles — one pooled THREE.Points system for all bursts:
// blood, dust, sparks, brass, muzzle smoke. Color/size per emit call.

import * as THREE from 'three';

const MAX = 900;

export class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private cursor = 0;

  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -1000;
  }

  emit(p: THREE.Vector3, color: number, count: number, speed: number, life: number, size: number): void {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.7);
      this.vel[i * 3] = Math.cos(a) * Math.cos(b) * s * 0.9;
      this.vel[i * 3 + 1] = Math.abs(Math.sin(b)) * s * 0.9 + speed * 0.35;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s * 0.9;
      this.col[i * 3] = Math.min(1, c.r * (0.8 + Math.random() * 0.4));
      this.col[i * 3 + 1] = Math.min(1, c.g * (0.8 + Math.random() * 0.4));
      this.col[i * 3 + 2] = Math.min(1, c.b * (0.8 + Math.random() * 0.4));
      this.life[i] = life * (0.7 + Math.random() * 0.6);
      this.size[i] = size * (0.7 + Math.random() * 0.6);
    }
    this.points.visible = true;
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -1000;
        continue;
      }
      this.vel[i * 3 + 1] -= 7 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    if (any) {
      (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      const mat = this.points.material as THREE.PointsMaterial;
      mat.opacity = 1;
    } else {
      this.points.visible = false;
    }
  }
}