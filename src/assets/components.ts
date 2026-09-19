// DEADGRID Asset Components — extract individual useful components from
// multi-prop GLB scenes (military outpost kit, radio tower).
//
// Each component is a THREE.Group that can be placed independently.
// Components are extracted by name from the GLB scene graph.
//
// Usage:
//   import { OutpostAssets, TowerAssets } from './assets/components';
//   const sandbags = OutpostAssets.sandbagWall();
//   sandbags.position.set(x, terrainY, z);
//   scene.add(sandbags);

import * as THREE from 'three';
import { AssetLib } from './registry';

// ---------------------------------------------------------------------------
// Helper: extract a named child from a loaded GLB scene
// ---------------------------------------------------------------------------

/**
 * Find a child node by name in a GLB scene and return a deep clone.
 * The clone is centered at origin (XZ) and grounded (Y min = 0).
 */
function extractComponent(scene: THREE.Group, name: string): THREE.Group | null {
  const found: THREE.Object3D[] = [];
  scene.traverse((child: THREE.Object3D) => {
    if (child.name === name) found.push(child);
  });
  if (found.length === 0) return null;
  const target = found[0];

  // Deep clone
  const clone = target.clone(true) as THREE.Object3D;
  clone.updateMatrixWorld(true);

  // Center at origin (XZ), ground at Y=0
  const box = new THREE.Box3().setFromObject(clone);
  const center = box.getCenter(new THREE.Vector3());
  clone.position.x -= center.x;
  clone.position.z -= center.z;
  clone.position.y -= box.min.y;

  // Enable shadows
  clone.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const group = new THREE.Group();
  group.add(clone);
  return group;
}

/**
 * Extract multiple components and group them.
 */
function extractComponents(scene: THREE.Group, names: string[]): THREE.Group {
  const group = new THREE.Group();
  for (const name of names) {
    const comp = extractComponent(scene, name);
    if (comp) group.add(comp);
  }
  return group;
}

// ---------------------------------------------------------------------------
// Outpost Assets — military outpost kit components
// ---------------------------------------------------------------------------

export const OutpostAssets = {
  /** Sandbag wall (sandbags_12) */
  sandbagWall(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'sandbags_12');
  },

  /** Concrete barrier — tall (concretebarrier_tall_19) */
  concreteBarrierTall(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'concretebarrier_tall_19');
  },

  /** Concrete barrier — wide (concretebarrier_wide_22) */
  concreteBarrierWide(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'concretebarrier_wide_22');
  },

  /** Concrete barrier — small (concretebarrier_small_25) */
  concreteBarrierSmall(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'concretebarrier_small_25');
  },

  /** HESCO barrier — large (hesco_large_30) */
  hescoLarge(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'hesco_large_30');
  },

  /** HESCO barrier — small (hesco_small_35) */
  hescoSmall(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'hesco_small_35');
  },

  /** Floodlight (floodlight_68) */
  floodLight(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'floodlight_68');
  },

  /** Camp cot (campcot_50) */
  campCot(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'campcot_50');
  },

  /** Ammo tin — 5.56 (ammotin_556big_8) */
  ammoTin556(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'ammotin_556big_8');
  },

  /** Ammo tin — .50 cal (ammotin_50cal_9) */
  ammoTin50(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'ammotin_50cal_9');
  },

  /** Ammo tin — 7.62 (ammotin_762_10) */
  ammoTin762(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'ammotin_762_10');
  },

  /** Ammo tin — 40mm (ammotin_40mm_11) */
  ammoTin40mm(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'ammotin_40mm_11');
  },

  /** Camo net (camonet_16) */
  camoNet(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'camonet_16');
  },

  /** Water bowser (waterbowser_74) */
  waterBowser(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'waterbowser_74');
  },

  /** AA missile (AAmissile_62) */
  aaMissile(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'AAmissile_62');
  },

  /** Solar shower (solarshower_41) */
  solarShower(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'solarshower_41');
  },

  /** Electrical pig (electrical_pig_43) */
  electricalPig(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'electrical_pig_43');
  },

  /** Hard case (hardcase_01_46) */
  hardCase(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'hardcase_01_46');
  },

  /** Lumber — 2x4 (2by4_0) */
  lumber2x4(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, '2by4_0');
  },

  /** Lumber — 4x4 (4by4_1) */
  lumber4x4(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, '4by4_1');
  },

  /** Lumber — 1x4 (1by4_2) */
  lumber1x4(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, '1by4_2');
  },

  /** Plywood sheet (plywood_sheet_3) */
  plywoodSheet(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'plywood_sheet_3');
  },

  /** Steel post (steel_post_4) */
  steelPost(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'steel_post_4');
  },

  /** Metal sheet (metal_sheet_01_7) */
  metalSheet(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'metal_sheet_01_7');
  },

  /** Outdoor flooring (flooring_outdoor_13) */
  outdoorFlooring(): THREE.Group | null {
    const scene = AssetLib.get('outpost_kit');
    if (!scene) return null;
    return extractComponent(scene, 'flooring_outdoor_13');
  },

  /**
   * Pre-composed evac camp cluster:
   * 2 sandbag walls + 1 HESCO + 1 floodlight + 2 ammo tins + 1 camp cot
   */
  evacCampCluster(): THREE.Group {
    const group = new THREE.Group();
    const add = (comp: THREE.Group | null, x: number, z: number, ry = 0): void => {
      if (!comp) return;
      comp.position.set(x, 0, z);
      comp.rotation.y = ry;
      group.add(comp);
    };
    add(this.sandbagWall(), -2, 0, 0);
    add(this.sandbagWall(), 2, 0, Math.PI);
    add(this.hescoLarge(), 0, -1.5, 0);
    add(this.floodLight(), 3, 1, -Math.PI / 4);
    add(this.ammoTin556(), -1, 1.5, 0.3);
    add(this.ammoTin762(), 1, 1.5, -0.2);
    add(this.campCot(), 0, 2, 0);
    return group;
  },

  /**
   * Pre-composed bunker entrance cluster:
   * 2 concrete barriers + 1 HESCO + 1 floodlight + 1 hard case
   */
  bunkerEntranceCluster(): THREE.Group {
    const group = new THREE.Group();
    const add = (comp: THREE.Group | null, x: number, z: number, ry = 0): void => {
      if (!comp) return;
      comp.position.set(x, 0, z);
      comp.rotation.y = ry;
      group.add(comp);
    };
    add(this.concreteBarrierTall(), -2, 0, 0);
    add(this.concreteBarrierWide(), 2, 0, Math.PI);
    add(this.hescoSmall(), 0, -1, 0);
    add(this.floodLight(), 3, 0.5, -Math.PI / 3);
    add(this.hardCase(), -1, 1, 0.5);
    return group;
  },
};

// ---------------------------------------------------------------------------
// Tower Assets — radio tower components
// ---------------------------------------------------------------------------

export const TowerAssets = {
  /** Main tower structure (Tower1 + sections + base + top) */
  towerStructure(): THREE.Group | null {
    const scene = AssetLib.get('radio_tower');
    if (!scene) return null;
    return extractComponents(scene, [
      'Tower1',
      'Tower1_Base',
      'Tower1_SectionA1',
      'Tower1_SectionA2',
      'Tower1_SectionA3',
      'Tower1_Top',
    ]);
  },

  /** Tower with base supports */
  towerWithSupports(): THREE.Group | null {
    const scene = AssetLib.get('radio_tower');
    if (!scene) return null;
    return extractComponents(scene, [
      'Tower1',
      'Tower1_Base',
      'Tower1_SectionA1',
      'Tower1_SectionA2',
      'Tower1_SectionA3',
      'Tower1_Top',
      'Round_Support1',
      'Round_Support2',
      'Round_Support3',
      'Round_Support4',
      'Round_Support5',
    ]);
  },

  /** Electric box (Electic_Box1) */
  electricBox(): THREE.Group | null {
    const scene = AssetLib.get('radio_tower');
    if (!scene) return null;
    return extractComponent(scene, 'Electic_Box1');
  },

  /** CCTV camera (CCTV_Camera) */
  cctvCamera(): THREE.Group | null {
    const scene = AssetLib.get('radio_tower');
    if (!scene) return null;
    return extractComponent(scene, 'CCTV_Camera');
  },

  /** Access panel (Access_PanelAccess_Panel) */
  accessPanel(): THREE.Group | null {
    const scene = AssetLib.get('radio_tower');
    if (!scene) return null;
    return extractComponent(scene, 'Access_PanelAccess_Panel');
  },

  /**
   * Full tower landmark: tower structure + electric box + CCTV + access panel
   */
  towerLandmark(): THREE.Group {
    const group = new THREE.Group();
    const tower = this.towerWithSupports();
    if (tower) group.add(tower);
    const ebox = this.electricBox();
    if (ebox) {
      ebox.position.set(-1, 0, -2.5);
      group.add(ebox);
    }
    const cctv = this.cctvCamera();
    if (cctv) {
      cctv.position.set(1, 4.5, 1);
      group.add(cctv);
    }
    return group;
  },
};
