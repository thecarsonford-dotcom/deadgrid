// DEADGRID POI manager — streams the fixed campaign locations and seeded
// wilderness sites in/out around the player, owns their colliders and the
// interaction registry, and drives power/emergency lighting for Blackouts.

import * as THREE from 'three';
import { WORLD } from '../core/world';
import { hash2 } from '../core/noise';
import { inPad, roadDist } from '../core/world';
import { CollisionWorld } from './collision';
import { InteractSpec, PoiBuild, buildCabin, buildRadioFacility, buildSuburb, buildEvacCamp, buildCheckpoint, buildIndustrial, buildBunker } from './poiBuilders';
import { buildWildCamp, buildWildRuin } from './wildPois';

export interface Interactable {
  id: string;
  poiId: string;
  pos: THREE.Vector3;
  radius: number;
  verb: string;
  label: string;
  kind: InteractSpec['kind'];
  items?: [string, number][];
  weapon?: string;
  story?: string;
  req?: string;          // item id required to use (gated interactions)
  reqLabel?: string;     // human name shown when locked
  consume?: boolean;     // consume the req item on success
  done: boolean;
}

interface FixedPoi {
  id: string;
  kind: 'cabin' | 'radio' | 'suburb' | 'evac' | 'checkpoint' | 'industrial' | 'bunker' | 'wild_camp' | 'wild_ruin';
  x: number;
  z: number;
  ry: number;
  activeR: number;
}

const FIXED: FixedPoi[] = [
  { id: 'cabin', kind: 'cabin', x: 14, z: 26, ry: 0.25, activeR: 140 },
  { id: 'radio', kind: 'radio', x: 300, z: 70, ry: Math.PI, activeR: 240 },
  { id: 'evac', kind: 'evac', x: 180, z: 8, ry: 1.46, activeR: 130 },
  { id: 'checkpoint', kind: 'checkpoint', x: 368, z: 30, ry: 2.1, activeR: 120 },
  { id: 'industrial', kind: 'industrial', x: 430, z: 44, ry: 0, activeR: 160 },
  { id: 'bunker', kind: 'bunker', x: 560, z: -78, ry: 0, activeR: 150 },
  { id: 'suburb', kind: 'suburb', x: -72, z: 92, ry: Math.PI, activeR: 180 },
];

export type WeaponMeshFactory = (weaponId: string) => THREE.Object3D | null;

interface ActivePoi {
  fixed: FixedPoi;
  build: PoiBuild;
}

export class PoiManager {
  private scene: THREE.Scene;
  private colliders: CollisionWorld;
  private active = new Map<string, ActivePoi>();
  private wildActive = new Map<string, ActivePoi>();
  private wildEmpty = new Set<string>();
  private doneFlags = new Set<string>();
  private weaponMeshes = new Map<string, THREE.Object3D>();
  private registeredBases = false;
  powerOn = true;
  interactables: Interactable[] = [];
  seed = 1;

  constructor(scene: THREE.Scene, colliders: CollisionWorld) {
    this.scene = scene;
    this.colliders = colliders;
  }

  /** World anchor of a fixed POI (used by missions/waypoints). */
  anchor(id: string): THREE.Vector3 {
    const f = FIXED.find((p) => p.id === id)!;
    return new THREE.Vector3(f.x, WORLD.groundHeight(f.x, f.z), f.z);
  }

  reset(): void {
    for (const key of Array.from(this.active.keys())) this.despawn(key);
    for (const key of Array.from(this.wildActive.keys())) this.despawnWild(key);
    this.doneFlags.clear();
    // locked content: relief cache until Blackout clears, gated loot until
    // its tool is used on the gate/alcove
    this.doneFlags.add('radio_cache'); // locked until the Blackout clears
    this.doneFlags.add('radio_gate_loot');
    this.doneFlags.add('bunker_alcove_loot');
    this.wildEmpty.clear();
    this.registeredBases = false;
  }

  isDone(id: string): boolean { return this.doneFlags.has(id); }
  markDone(id: string): void { this.doneFlags.add(id); }
  clearDone(id: string): void { this.doneFlags.delete(id); }

  update(playerPos: THREE.Vector3, weaponMeshFactory: WeaponMeshFactory): void {
    for (const f of FIXED) {
      const d = Math.hypot(playerPos.x - f.x, playerPos.z - f.z);
      const inst = this.active.get(f.id);
      if (d < f.activeR && !inst) this.spawnFixed(f, weaponMeshFactory);
      else if (d > f.activeR + 60 && inst) this.despawn(f.id);
    }
    this.updateWilderness(playerPos, weaponMeshFactory);
    if (!this.registeredBases) {
      this.registerBaseIntensities();
      this.registeredBases = true;
    }
  }

  // --- spawning ----------------------------------------------------------------
  private spawnFixed(f: FixedPoi, weaponMeshFactory: WeaponMeshFactory): void {
    const build = builderFor(f.kind)();
    const padY = WORLD.groundHeight(f.x, f.z);
    this.spawnCommon(f, build, padY, weaponMeshFactory, f.id, false);
  }

  private spawnCommon(f: FixedPoi, build: PoiBuild, padY: number, weaponMeshFactory: WeaponMeshFactory, key: string, wild: boolean): void {
    // wild sites sit slightly into the ground so minor terrain variance
    // across the footprint never shows a floating edge
    build.group.position.set(f.x, padY - (wild ? 0.14 : 0), f.z);
    build.group.rotation.y = f.ry;
    const cos = Math.cos(f.ry), sin = Math.sin(f.ry);
    const absCos = Math.abs(cos), absSin = Math.abs(sin);
    for (const [lx, ly, lz, w, h, d] of build.colliders) {
      const cx = lx + w / 2, cz = lz + d / 2;
      const wx = cx * cos + cz * sin;
      const wz = -cx * sin + cz * cos;
      const rw = w * absCos + d * absSin;
      const rd = w * absSin + d * absCos;
      this.colliders.addOwned(build.group, {
        minX: f.x + wx - rw / 2, maxX: f.x + wx + rw / 2,
        minY: padY + ly, maxY: padY + ly + h,
        minZ: f.z + wz - rd / 2, maxZ: f.z + wz + rd / 2,
      });
    }
    for (const gb of build.gateBoxes) {
      const [lx, ly, lz, w, h, d] = gb.box;
      const cx = lx + w / 2, cz = lz + d / 2;
      const wx = cx * cos + cz * sin;
      const wz = -cx * sin + cz * cos;
      const rw = w * absCos + d * absSin;
      const rd = w * absSin + d * absCos;
      this.colliders.addOwned(gb.anchor, {
        minX: f.x + wx - rw / 2, maxX: f.x + wx + rw / 2,
        minY: padY + ly, maxY: padY + ly + h,
        minZ: f.z + wz - rd / 2, maxZ: f.z + wz + rd / 2,
      });
    }
    for (const spec of build.interactables) {
      const it = this.transformInteract(spec, f, padY);
      if (wild) {
        // wilderness sites share builder ids — namespace per instance
        it.id = `${key}:${spec.id}`;
        it.done = this.doneFlags.has(it.id);
      }
      if (it.weapon && weaponMeshFactory && !it.done) {
        const mesh = weaponMeshFactory(it.weapon);
        if (mesh) {
          mesh.position.copy(it.pos);
          mesh.rotation.y = f.ry + 0.6;
          this.scene.add(mesh);
          this.weaponMeshes.set(it.id, mesh);
        }
      }
      this.interactables.push(it);
    }
    this.applyPower(build, this.powerOn);
    this.applyPersistentState(f.id, build);
    // gates opened before despawn stay open across respawns
    this.reopenGates(key);
    this.scene.add(build.group);
    const a: ActivePoi = { fixed: f, build };
    if (wild) this.wildActive.set(key, a);
    else this.active.set(f.id, a);
  }

  private transformInteract(spec: InteractSpec, f: FixedPoi, padY: number): Interactable {
    const local = new THREE.Vector3(spec.localPos[0], spec.localPos[1], spec.localPos[2]);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), f.ry);
    return {
      id: spec.id,
      poiId: f.id,
      pos: new THREE.Vector3(f.x + local.x, padY + local.y, f.z + local.z),
      radius: 2.8,
      verb: spec.verb,
      label: spec.label,
      kind: spec.kind,
      items: spec.items,
      weapon: spec.weapon,
      story: spec.story,
      req: spec.req,
      reqLabel: spec.reqLabel,
      consume: spec.consume,
      done: this.doneFlags.has(spec.id),
    };
  }

  private despawn(key: string): void {
    const a = this.active.get(key);
    if (!a) return;
    this.colliders.removeOwner(a.build.group);
    const gateAnchor = a.build.group.userData.gateAnchor;
    if (gateAnchor) this.colliders.removeOwner(gateAnchor);
    this.scene.remove(a.build.group);
    disposeGroup(a.build.group);
    // drop this POI's interaction entries so despawn/respawn never ghosts
    this.interactables = this.interactables.filter((i) => i.poiId !== key);
    this.removeOrphanWeaponMeshes();
    this.active.delete(key);
  }

  // --- wilderness minor POIs (seeded per chunk) --------------------------------
  private wildKey(cx: number, cz: number): string { return `w${cx},${cz}`; }

  private wildForChunk(cx: number, cz: number): 'camp' | 'ruin' | null {
    if (Math.abs(cx) < 2 && Math.abs(cz) < 2) return null;
    const h = hash2(cx * 7919 + this.seed, cz * 6553 - this.seed);
    if (h > 0.09) return null;
    const lx = cx * WORLD.CHUNK + WORLD.CHUNK / 2;
    const lz = cz * WORLD.CHUNK + WORLD.CHUNK / 2;
    if (inPad(lx, lz) || roadDist(lx, lz) < 9) return null;
    // never spawn a site on a slope — the group would float on the downhill side
    const gh = WORLD.groundHeight(lx, lz);
    const sx = Math.abs(WORLD.groundHeight(lx + 4, lz) - gh);
    const sz = Math.abs(WORLD.groundHeight(lx, lz + 4) - gh);
    if (Math.max(sx, sz) > 1.2) return null;
    return h > 0.045 ? 'camp' : 'ruin';
  }

  private updateWilderness(playerPos: THREE.Vector3, weaponMeshFactory: WeaponMeshFactory): void {
    const pcx = Math.floor(playerPos.x / WORLD.CHUNK);
    const pcz = Math.floor(playerPos.z / WORLD.CHUNK);
    const R = 4;
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const cx = pcx + dx, cz = pcz + dz;
        const key = this.wildKey(cx, cz);
        if (this.wildActive.has(key) || this.wildEmpty.has(key)) continue;
        const kind = this.wildForChunk(cx, cz);
        if (!kind) { this.wildEmpty.add(key); continue; }
        const h1 = hash2(cx * 331 + 17 + this.seed, cz * 991 - 5);
        const h2 = hash2(cx * 271 - 71, cz * 419 + 9 + this.seed);
        const lx = cx * WORLD.CHUNK + 6 + h1 * (WORLD.CHUNK - 12);
        const lz = cz * WORLD.CHUNK + 6 + h2 * (WORLD.CHUNK - 12);
        const padY = WORLD.groundHeight(lx, lz);
        const f: FixedPoi = { id: key, kind: kind === 'camp' ? 'wild_camp' : 'wild_ruin', x: lx, z: lz, ry: h1 * Math.PI * 2, activeR: 130 };
        const build = kind === 'camp' ? buildWildCamp() : buildWildRuin();
        if (padY < WORLD.WATER_Y + 0.3) { this.wildEmpty.add(key); disposeGroup(build.group); continue; }
        this.spawnCommon(f, build, padY, weaponMeshFactory, key, true);
      }
    }
    for (const key of Array.from(this.wildActive.keys())) {
      const a = this.wildActive.get(key)!;
      const d = Math.hypot(playerPos.x - a.fixed.x, playerPos.z - a.fixed.z);
      if (d > (R + 1.5) * WORLD.CHUNK) this.despawnWild(key);
    }
  }

  private despawnWild(key: string): void {
    const a = this.wildActive.get(key);
    if (!a) return;
    this.colliders.removeOwner(a.build.group);
    const gateAnchor = a.build.group.userData.gateAnchor;
    if (gateAnchor) this.colliders.removeOwner(gateAnchor);
    this.scene.remove(a.build.group);
    disposeGroup(a.build.group);
    this.interactables = this.interactables.filter((i) => i.poiId !== key);
    this.removeOrphanWeaponMeshes();
    this.wildActive.delete(key);
  }

  private removeOrphanWeaponMeshes(): void {
    for (const [id, mesh] of Array.from(this.weaponMeshes.entries())) {
      if (!this.interactables.find((i) => i.id === id) || this.doneFlags.has(id)) {
        this.scene.remove(mesh);
        disposeObject(mesh);
        this.weaponMeshes.delete(id);
      }
    }
  }

  /** Interaction lookup for the HUD prompt. */
  nearest(pos: THREE.Vector3, maxR: number): Interactable | null {
    let best: Interactable | null = null;
    let bestD = maxR;
    for (const it of this.interactables) {
      if (it.done) continue;
      const d = it.pos.distanceTo(pos);
      if (d < Math.min(it.radius, bestD)) { best = it; bestD = d; }
    }
    return best;
  }

  /**
   * Register a world-anchored static interaction (roadside loot etc.).
   * Persisted through doneFlags like POI interactables.
   */
  addStatic(id: string, pos: THREE.Vector3, verb: string, label: string, items: [string, number][]): void {
    if (this.interactables.some((i) => i.id === id)) return;
    this.interactables.push({
      id, poiId: 'road', pos, radius: 2.7, verb, label, kind: 'loot',
      items, done: this.doneFlags.has(id),
    });
  }

  /** Toggle facility power (Blackout). */
  setPower(on: boolean): void {
    this.powerOn = on;
    for (const a of this.active.values()) this.applyPower(a.build, on);
    for (const a of this.wildActive.values()) this.applyPower(a.build, on);
  }

  private applyPower(build: PoiBuild, on: boolean): void {
    // per-POI override (bunker starts unpowered until its own switch)
    const local = build.group.userData.localPower;
    const eff = local !== undefined ? local : on;
    for (const l of build.powerLights) l.intensity = eff ? (l.userData.base ?? 1) : 0;
    for (const l of build.emergencyLights) l.intensity = eff ? 0 : (l.userData.base ?? 1);
    // 'pulse'/'always' lights are untouched (standby/b beacon)
  }

  /** World-state that survives despawn/save: generator running, bunker power. */
  private applyPersistentState(poiId: string, build: PoiBuild): void {
    if (poiId === 'bunker' && this.doneFlags.has('bunker_power')) {
      build.group.userData.localPower = true;
      this.applyPower(build, this.powerOn);
    }
    if (poiId === 'radio' && this.doneFlags.has('radio_gen_running')) {
      build.group.userData.genRunning = true;
      const status = build.group.getObjectByName('gen_status_light');
      if (status) {
        const m = ((status as THREE.Mesh).material) as THREE.MeshStandardMaterial;
        m.emissive.setHex(0x2fff5a);
        m.color.setHex(0x0a2a10);
      }
      const slot = build.group.getObjectByName('gen_fuse_slot');
      if (slot) ((slot as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0xffa030);
    }
    // fuse installed but generator not yet started (save/respawn path)
    if (poiId === 'radio' && !build.group.userData.genRunning && this.doneFlags.has('radio_fuse_installed')) {
      const slot = build.group.getObjectByName('gen_fuse_slot');
      if (slot) ((slot as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0xffa030);
    }
  }

  private registerBaseIntensities(): void {
    for (const a of this.active.values()) {
      for (const l of a.build.powerLights) if (l.userData.base === undefined) l.userData.base = l.intensity;
      for (const l of a.build.emergencyLights) if (l.userData.base === undefined) l.userData.base = l.intensity;
    }
    for (const a of this.wildActive.values()) {
      for (const l of a.build.emergencyLights) if (l.userData.base === undefined) l.userData.base = l.intensity;
    }
  }

  /** Remove a consumed weapon pickup mesh. */
  removeWeaponMesh(interactId: string): void {
    const mesh = this.weaponMeshes.get(interactId);
    if (mesh) {
      this.scene.remove(mesh);
      disposeObject(mesh);
      this.weaponMeshes.delete(interactId);
    }
  }

  /** Make an interactable available again (e.g. Blackout reward cache). */
  unlockCache(): void {
    this.doneFlags.delete('radio_cache');
    const live = this.interactables.find((i) => i.id === 'radio_cache');
    if (live) live.done = false;
  }

  /** Hide an interactable (mission scripts). */
  setInteractableEnabled(id: string, enabled: boolean): void {
    const live = this.interactables.find((i) => i.id === id);
    if (live) {
      live.done = !enabled;
      if (enabled) this.doneFlags.delete(id);
    }
  }

  /**
   * Open a gated structure: removes its `#gate:<id>:` meshes, drops its
   * collider, and (optionally) reveals a hidden loot interactable.
   */
  openGate(poiId: string, gateId = 'main', revealId?: string): void {
    const a = this.active.get(poiId);
    if (a) {
      const prefix = `#gate:${gateId}:`;
      const doomed: THREE.Object3D[] = [];
      a.build.group.traverse((n) => {
        if (n.name.startsWith(prefix)) doomed.push(n);
      });
      for (const n of doomed) n.parent?.remove(n);
      const gates = a.build.group.userData.gates as Record<string, object> | undefined;
      const anchor = gates?.[gateId];
      if (anchor) {
        this.colliders.removeOwner(anchor);
        delete gates![gateId];
      }
      this.markDone(`gate_${poiId}_${gateId}`);
    }
    if (revealId) this.setInteractableEnabled(revealId, true);
  }

  /** Re-open any gates whose flags say they were opened (respawn path). */
  reopenGates(poiId: string): void {
    const a = this.active.get(poiId);
    if (!a) return;
    const ids = a.build.group.userData.gateIds as string[] | undefined;
    if (!ids) return;
    for (const id of ids) {
      if (this.doneFlags.has(`gate_${poiId}_${id}`)) this.openGate(poiId, id);
    }
  }

  /** Per-POI local power override (bunker starts dark until its own switch). */
  setLocalPower(poiId: string, on: boolean): void {
    const a = this.active.get(poiId);
    if (!a) return;
    a.build.group.userData.localPower = on;
    this.applyPower(a.build, on);
  }

  getLocalPower(poiId: string): boolean {
    const a = this.active.get(poiId);
    return a ? (a.build.group.userData.localPower ?? this.powerOn) : this.powerOn;
  }

  /** Live build of an active fixed POI (for light capture). */
  activeBuild(id: string): PoiBuild | null {
    return this.active.get(id)?.build ?? null;
  }

  /** Serialization of interacted flags. */
  getDoneIds(): string[] { return Array.from(this.doneFlags); }
  setDoneIds(ids: string[]): void {
    this.doneFlags = new Set(ids);
    for (const it of this.interactables) it.done = this.doneFlags.has(it.id);
  }
}

function builderFor(kind: FixedPoi['kind']): () => PoiBuild {
  switch (kind) {
    case 'cabin': return buildCabin;
    case 'radio': return buildRadioFacility;
    case 'suburb': return buildSuburb;
    case 'evac': return buildEvacCamp;
    case 'checkpoint': return buildCheckpoint;
    case 'industrial': return buildIndustrial;
    case 'bunker': return buildBunker;
    default: return buildWildCamp;
  }
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else (m.material as THREE.Material).dispose();
    }
  });
}

export function disposeObject(o: THREE.Object3D): void {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else (m.material as THREE.Material).dispose();
    }
  });
}