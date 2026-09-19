// DEADGRID wilderness POIs — small seeded discoveries scattered through the
// forest: abandoned camps and concrete ruins with light loot + storytelling.

import * as THREE from 'three';
import { MAT } from './props';
import { crate, barrel, note, deadBody } from './props';
import { InteractSpec, PoiBuild } from './poiBuilders';

class Ctx implements PoiBuild {
  group = new THREE.Group();
  colliders: [number, number, number, number, number, number][] = [];
  gateBoxes: { anchor: object; box: [number, number, number, number, number, number] }[] = [];
  interactables: InteractSpec[] = [];
  powerLights: THREE.Light[] = [];
  emergencyLights: THREE.Light[] = [];
  pulsing: THREE.Light[] = [];

  box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, collide = true): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    if (collide) this.colliders.push([x - w / 2, y, z - d / 2, w, h, d]);
    return m;
  }

  place(propGroup: THREE.Group, x: number, y: number, z: number, ry: number): void {
    propGroup.position.set(x, y, z);
    propGroup.rotation.y = ry;
    this.group.add(propGroup);
  }

  interact(spec: InteractSpec): void {
    this.interactables.push(spec);
  }
}

const MATS = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x6a6d71, roughness: 0.96 }),
  rust: MAT.rust,
  plank: MAT.plank,
  woodDark: MAT.woodDark,
};

export function buildWildCamp(): PoiBuild {
  const c = new Ctx();
  const g = c.group;
  // collapsed tent
  const tarp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 3.0), MAT.fabric);
  tarp.position.set(0.4, 0.35, 0.2);
  tarp.rotation.set(0.12, 0.5, 0.3);
  tarp.castShadow = true;
  g.add(tarp);
  for (const p of [[-0.6, -1.1], [1.2, -0.6], [0.9, 1.3]] as [number, number][]) {
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), MATS.woodDark);
    stake.position.set(p[0], 0.35, p[1]);
    stake.rotation.z = (Math.sin(p[0]) * 0.2);
    g.add(stake);
  }
  // dead fire ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 6, 12), MATS.rust);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  const cr1 = crate().group;
  c.place(cr1, -1.8, 0, 1.4, 0.6);
  const cr2 = crate().group;
  cr2.scale.setScalar(0.8);
  c.place(cr2, -1.6, 0, 2.3, -0.3);
  const n = note().group;
  c.place(n, -1.4, 0.45, 1.6, 1.1);
  const body = deadBody().group;
  c.place(body, 2.6, 0, -1.6, 2.9);
  const bar = barrel().group;
  c.place(bar, -3.4, 0, -0.6, 0.4);
  c.interact({ id: 'wild_camp_loot_a', localPos: [-1.8, 0.4, 1.4], verb: 'SEARCH', label: 'ABANDONED CAMP', kind: 'loot', items: [['food', 1], ['bandage', 1]] });
  c.interact({ id: 'wild_camp_loot_b', localPos: [-1.6, 0.3, 2.3], verb: 'SEARCH', label: 'SUPPLY CRATE', kind: 'loot', items: [['battery', 1], ['scrap', 1]] });
  c.interact({
    id: 'wild_camp_note', localPos: [-1.4, 0.4, 1.7], verb: 'READ', label: 'CAMP LOG', kind: 'story',
    story: 'The water ran out on the fifth day. Marta went toward the towers to find help. We heard the tower horn at dawn, then nothing.',
  });
  c.colliders.push([-2.2, 0, 1.0, 0.8, 0.65, 0.8]);
  c.colliders.push([-2.0, 0, 1.9, 0.7, 0.55, 0.7]);
  return c;
}

export function buildWildRuin(): PoiBuild {
  const c = new Ctx();
  const g = c.group;
  // concrete foundation slab with collapsed walls
  c.box(0, 0, 0, 6.5, 0.35, 5.0, MATS.concrete, false);
  c.box(-3.1, 0.35, -1.5, 0.4, 1.6, 3.4, MATS.concrete);
  c.box(2.9, 0.35, 0.6, 0.4, 2.2, 3.9, MATS.concrete);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 2.4), MATS.concrete);
  slab.position.set(0.6, 1.2, -1.6);
  slab.rotation.set(0.32, 0.4, 0.18);
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  const rub1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.0), MATS.rust);
  rub1.position.set(1.9, 0.35, 1.2);
  rub1.rotation.set(0.2, 0.5, 0.14);
  rub1.castShadow = true;
  g.add(rub1);
  const rub2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.1), MATS.rust);
  rub2.position.set(-1.6, 0.32, 1.9);
  rub2.rotation.set(-0.12, 0.9, 0.2);
  rub2.castShadow = true;
  g.add(rub2);
  const bar = barrel().group;
  bar.position.set(-2.2, 0.35, -1.9);
  bar.rotation.z = Math.PI / 2;
  bar.rotation.y = 0.4;
  g.add(bar);
  const cr = crate().group;
  c.place(cr, 0.4, 0.35, 1.5, 0.9);
  c.interact({ id: 'wild_ruin_loot_a', localPos: [0.4, 0.7, 1.5], verb: 'SEARCH', label: 'RUIN CRATE', kind: 'loot', items: [['scrap', 2], ['ammo9', 12]] });
  c.interact({ id: 'wild_ruin_loot_b', localPos: [1.9, 0.7, 1.2], verb: 'SEARCH', label: 'RUBBLE CACHE', kind: 'loot', items: [['food', 1], ['bandage', 1]] });
  c.colliders.push([-3.3, 0, -3.2, 0.4, 1.6, 3.4]);
  c.colliders.push([2.7, 0, -1.35, 0.4, 2.0, 3.9]);
  c.colliders.push([0.0, 0, 1.1, 0.8, 0.65, 0.8]);
  return c;
}