// World-placed weapon pickups — small display versions of the viewmodels,
// laid flat on surfaces with a subtle glow so they read as loot.

import * as THREE from 'three';
import type { WeaponId } from './weapons';

export function makeWorldWeapon(id: string): THREE.Group | null {
  return makeWorldWeaponTyped(id as WeaponId);
}

function makeWorldWeaponTyped(id: WeaponId): THREE.Group | null {
  const g = new THREE.Group();
  const gun = buildFlatModel(id);
  if (!gun) return null;
  gun.rotation.x = -Math.PI / 2;
  gun.rotation.z = 0.4;
  gun.position.y = 0.05;
  g.add(gun);
  // faint glint so pickups are findable
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.55),
    new THREE.MeshBasicMaterial({
      color: 0xffdf9a, transparent: true, opacity: 0.12, depthWrite: false,
    }),
  );
  glint.rotation.x = -Math.PI / 2;
  glint.position.y = 0.012;
  g.add(glint);
  return g;
}

function buildFlatModel(id: WeaponId): THREE.Group | null {
  const GUNMETAL = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.45, metalness: 0.7 });
  const GUNSTEEL = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.35, metalness: 0.8 });
  const WOODGUN = new THREE.MeshStandardMaterial({ color: 0x5d4326, roughness: 0.8 });
  const BLADE = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.3, metalness: 0.85 });
  const GLOVE = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.9 });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };
  const tube = (r: number, len: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  };
  const g = new THREE.Group();
  switch (id) {
    case 'knife': {
      const handle = box(0.035, 0.05, 0.14, GLOVE);
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.02, 0.2, 4), BLADE);
      blade.rotation.x = -Math.PI / 2;
      blade.rotation.y = Math.PI / 4;
      blade.scale.x = 0.5;
      blade.position.set(0, 0.006, -0.19);
      g.add(handle, blade);
      break;
    }
    case 'machete': {
      g.add(box(0.04, 0.055, 0.17, GUNMETAL, 0, 0, -0.05), box(0.012, 0.07, 0.5, BLADE, 0, 0.01, -0.4));
      break;
    }
    case 'hatchet': {
      g.add(box(0.035, 0.035, 0.5, WOODGUN, 0, 0, -0.18), box(0.05, 0.11, 0.07, BLADE, 0, 0.04, -0.38));
      break;
    }
    case 'pistol': {
      const grip = box(0.045, 0.11, 0.06, GUNMETAL, 0, -0.055, 0.02);
      grip.rotation.x = 0.22;
      g.add(grip, box(0.05, 0.05, 0.24, GUNMETAL, 0, 0, -0.1));
      break;
    }
    case 'shotgun': {
      g.add(box(0.06, 0.075, 0.34, GUNMETAL, 0, 0, -0.1),
        tube(0.017, 0.62, GUNSTEEL, 0, 0.022, -0.5),
        box(0.05, 0.05, 0.16, WOODGUN, 0, -0.028, -0.4),
        box(0.05, 0.09, 0.3, WOODGUN, 0, -0.02, 0.22));
      break;
    }
    case 'smg': {
      g.add(box(0.055, 0.08, 0.3, GUNMETAL, 0, 0, -0.08),
        tube(0.014, 0.2, GUNSTEEL, 0, 0.01, -0.32),
        box(0.035, 0.17, 0.05, GUNSTEEL, 0, -0.11, -0.02));
      break;
    }
    case 'rifle': {
      g.add(box(0.055, 0.08, 0.42, GUNMETAL, 0, 0, -0.12),
        tube(0.014, 0.5, GUNSTEEL, 0, 0.015, -0.52),
        box(0.04, 0.12, 0.07, GUNSTEEL, 0, -0.09, -0.06),
        box(0.05, 0.1, 0.26, WOODGUN, 0, -0.01, 0.24));
      break;
    }
    case 'precision': {
      g.add(box(0.05, 0.075, 0.4, WOODGUN, 0, 0, -0.08),
        tube(0.015, 0.75, GUNSTEEL, 0, 0.015, -0.62),
        tube(0.028, 0.26, GUNMETAL, 0, 0.075, -0.18));
      break;
    }
    default: return null;
  }
  g.scale.setScalar(id === 'pistol' ? 1.05 : id === 'knife' || id === 'machete' ? 1.25 : 1.35);
  return g;
}