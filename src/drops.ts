// DEADGRID supply drops — small pickups The Hollow occasionally leave.
// Walk-over auto-collection, pooled meshes, restrained rates.

import * as THREE from 'three';
import { WORLD } from './core/world';

interface Drop {
  mesh: THREE.Group;
  kind: 'ammo9' | 'ammo12' | 'ammo762' | 'bandage';
  t: number;
}

const GEO_BOX = new THREE.BoxGeometry(0.26, 0.16, 0.2);
const GEO_GLOW = new THREE.PlaneGeometry(0.5, 0.5);
const MATS: Record<Drop['kind'], THREE.MeshStandardMaterial> = {
  ammo9: new THREE.MeshStandardMaterial({ color: 0x4a4234, roughness: 0.8 }),
  ammo12: new THREE.MeshStandardMaterial({ color: 0x5a3226, roughness: 0.8 }),
  ammo762: new THREE.MeshStandardMaterial({ color: 0x3a4232, roughness: 0.8 }),
  bandage: new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 }),
};
const GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd9a0, transparent: true, opacity: 0.16, depthWrite: false,
});

const DROP_TABLE: [Drop['kind'], number][] = [
  ['ammo9', 0.5], ['ammo12', 0.18], ['ammo762', 0.2], ['bandage', 0.12],
];

const AMMO_AMOUNT: Record<Drop['kind'], number> = {
  ammo9: 8, ammo12: 3, ammo762: 6, bandage: 1,
};

export class Drops {
  group = new THREE.Group();
  private list: Drop[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Spawn a random drop at a death position. */
  spawnAt(pos: THREE.Vector3): void {
    if (this.list.length >= 10) return;
    let r = Math.random();
    let kind: Drop['kind'] = 'ammo9';
    for (const [k, w] of DROP_TABLE) {
      if (r < w) { kind = k; break; }
      r -= w;
    }
    const g = new THREE.Group();
    const box = new THREE.Mesh(GEO_BOX, MATS[kind]);
    box.position.y = 0.1;
    box.rotation.y = Math.random() * Math.PI;
    box.castShadow = true;
    g.add(box);
    const glow = new THREE.Mesh(GEO_GLOW, GLOW_MAT);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    g.add(glow);
    g.position.set(pos.x, WORLD.groundHeight(pos.x, pos.z), pos.z);
    this.group.add(g);
    this.list.push({ mesh: g, kind, t: 0 });
  }

  /** Returns collected drop kinds this frame; auto-pickup within 1.3m. */
  update(dt: number, playerPos: THREE.Vector3, give: (kind: Drop['kind'], n: number) => void): Drop['kind'][] {
    const collected: Drop['kind'][] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.t += dt;
      d.mesh.children[0].position.y = 0.1 + Math.sin(d.t * 2.4) * 0.02;
      d.mesh.children[0].rotation.y += dt * 0.8;
      if (d.t > 45) { this.remove(i); continue; }
      const dx = d.mesh.position.x - playerPos.x;
      const dz = d.mesh.position.z - playerPos.z;
      if (dx * dx + dz * dz < 1.7) {
        give(d.kind, AMMO_AMOUNT[d.kind]);
        collected.push(d.kind);
        this.remove(i);
      }
    }
    return collected;
  }

  private remove(i: number): void {
    this.group.remove(this.list[i].mesh);
    this.list.splice(i, 1);
  }

  clear(): void {
    for (const d of this.list) this.group.remove(d.mesh);
    this.list.length = 0;
  }
}
