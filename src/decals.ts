// DEADGRID decals — pooled ground splats (blood + impact scuffs).
// Restrained dark evidence of combat; capped, fading, cheap.

import * as THREE from 'three';
import { WORLD } from './core/world';

const MAX = 44;

export class Decals {
  group = new THREE.Group();
  private pool: { mesh: THREE.Mesh; t: number; fade: number }[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CircleGeometry(1, 10);
    for (let i = 0; i < MAX; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x240c09, transparent: true, opacity: 0,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, t: 0, fade: 0.5 });
    }
    scene.add(this.group);
  }

  /** Dark blood splat on the ground under a world point. */
  splat(p: THREE.Vector3, size: number): void {
    const d = this.acquire();
    d.mesh.position.set(p.x, WORLD.groundHeight(p.x, p.z) + 0.05, p.z);
    d.mesh.scale.setScalar(size * (0.8 + Math.random() * 0.6));
    (d.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x240c09);
    d.fade = 0.55;
    d.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    d.mesh.visible = true;
  }

  /** Small neutral impact ring on the ground. */
  mark(p: THREE.Vector3, size: number): void {
    const d = this.acquire();
    d.mesh.position.set(p.x, WORLD.groundHeight(p.x, p.z) + 0.05, p.z);
    d.mesh.scale.setScalar(size * (0.7 + Math.random() * 0.6));
    (d.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x2c2620);
    d.fade = 0.35;
    d.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    d.mesh.visible = true;
  }

  private acquire(): { mesh: THREE.Mesh; t: number; fade: number } {
    const d = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    d.t = 0;
    return d;
  }

  update(dt: number): void {
    for (const d of this.pool) {
      if (!d.mesh.visible) continue;
      d.t += dt;
      const mat = d.mesh.material as THREE.MeshBasicMaterial;
      if (d.t > 25) mat.opacity = Math.max(0, d.fade * (1 - (d.t - 25) / 15));
      if (d.t > 40) { d.mesh.visible = false; mat.opacity = 0; }
    }
  }
}
