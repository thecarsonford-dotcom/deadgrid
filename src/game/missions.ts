// DEADGRID missions — the campaign spine:
// WAKE UP → SIGNAL IN THE STATIC → POWER THE RELAY → BLACKOUT → THE ROAD → BELOW → THE SIGNAL.
// Each mission has ordered objectives; the HUD shows the current objective,
// its distance, a world waypoint marker, and count progress.

import * as THREE from 'three';
import type { PoiManager } from '../world/pois';

export type ObjectiveId =
  | 'search_cabin'
  | 'take_pistol'
  | 'locate_radio'
  | 'first_contact'
  | 'reach_tower'
  | 'inspect_generator'
  | 'find_fuse'
  | 'find_fuel'
  | 'install_fuse'
  | 'refuel_generator'
  | 'restore_generator'
  | 'survive_blackout'
  | 'recover_coordinates'
  | 'follow_road'
  | 'loot_vehicles'
  | 'road_survive'
  | 'enter_bunker'
  | 'bunker_power'
  | 'recover_dossier'
  | 'final_signal';

export interface Objective {
  id: ObjectiveId;
  text: string;
  waypoint?: { poi?: string; pos?: THREE.Vector3 };
  radius?: number;       // auto-complete when player within radius (waypoint missions)
  needCount?: number;    // for count objectives (loot_vehicles)
  hint?: string;         // secondary HUD line (where to look)
  /**
   * Live navigation target (world x,z) for HUD distance, compass and minimap.
   * Waypoint objectives resolve through `waypoint`; interaction objectives
   * (generator, fuse, console…) point at the exact interactable so the player
   * always has a bearing + live distance, never a dead "no distance" state.
   */
  nav?: { x: number; z: number };
  /**
   * Combat/survival objective — completion is event-driven (enemies cleared),
   * not destination-driven. The HUD must not show a meaningless distance to a
   * fixed point; the player is already in the encounter area.
   */
  combat?: boolean;
}

export interface MissionDef {
  id: string;
  title: string;
  objectives: Objective[];
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'wake',
    title: 'WAKE UP',
    objectives: [
      { id: 'search_cabin', text: 'Search the cabin', nav: { x: 10.3, z: 25.1 }, hint: 'Shelves and crates — the homeowner left in a hurry' },
      { id: 'take_pistol', text: 'Take the pistol', nav: { x: 11.4, z: 28.6 }, hint: 'Nightstand, back of the cabin' },
      { id: 'locate_radio', text: 'Check the dead radio', nav: { x: 10.9, z: 23.3 }, hint: 'Where the static is coming from' },
      { id: 'first_contact', text: 'Survive the first Hollow', combat: true, hint: 'They heard the cabin door — the porch and woodpile are cover. If you run, come back to the cabin to finish it' },
    ],
  },
  {
    id: 'signal',
    title: 'SIGNAL IN THE STATIC',
    objectives: [
      { id: 'reach_tower', text: 'Reach the radio relay', waypoint: { poi: 'radio' }, radius: 30, hint: 'Follow the road east — the evac camp is on the way, the tower is on the hill' },
    ],
  },
  {
    id: 'relay',
    title: 'POWER THE RELAY',
    objectives: [
      { id: 'inspect_generator', text: 'Inspect the generator', nav: { x: 295.7, z: 72.3 }, hint: 'Utility building, west corner — it will tell you what it needs' },
      { id: 'find_fuse', text: 'Find a replacement fuse', nav: { x: 295.5, z: 73.2 }, hint: 'The technician was working the line — parts shelf, or on the body by the tower' },
      { id: 'find_fuel', text: 'Find fuel', nav: { x: 293.9, z: 73.4 }, hint: 'Red drums by the generator' },
      { id: 'install_fuse', text: 'Install the fuse', nav: { x: 295.7, z: 72.3 }, hint: 'Back at the generator — it takes the fuse' },
      { id: 'refuel_generator', text: 'Refuel the generator', nav: { x: 295.7, z: 72.3 }, hint: 'Back at the generator — it takes the fuel' },
      { id: 'restore_generator', text: 'Start the generator', nav: { x: 295.7, z: 72.3 }, hint: 'Fuse + fuel in — turn it over' },
    ],
  },
  {
    id: 'blackout', title: 'BLACKOUT', objectives: [
      { id: 'survive_blackout', text: 'Survive the Blackout', combat: true, hint: 'Power is down — hold the facility, the generator is your cover' },
      { id: 'recover_coordinates', text: 'Recover the coordinates', nav: { x: 298.4, z: 67.5 }, hint: 'Read the radio console' },
    ],
  },
  {
    id: 'road', title: 'THE ROAD', objectives: [
      { id: 'follow_road', text: 'Follow the highway east', waypoint: { pos: new THREE.Vector3(430, 0, 44) }, radius: 40, hint: 'Watch for the military checkpoint' },
      { id: 'loot_vehicles', text: 'Search abandoned vehicles', needCount: 2, nav: { x: 364.4, z: 30.2 }, hint: 'Wrecks along the road — the checkpoint car is searchable' },
      { id: 'road_survive', text: 'Survive the Hollow ambush', combat: true, hint: 'They followed you — the yard containers are cover' },
    ],
  },
  {
    id: 'below', title: 'BELOW', objectives: [
      { id: 'enter_bunker', text: 'Reach the bunker', waypoint: { poi: 'bunker' }, radius: 40, hint: 'Coordinates put it in the northern hollow' },
      { id: 'bunker_power', text: 'Restore emergency power', nav: { x: 556.4, z: -75.1 }, hint: 'Needs a charged battery — check the duty locker, or the relief cache at the relay' },
      { id: 'recover_dossier', text: 'Recover the classified dossier', nav: { x: 560.4, z: -81.0 }, hint: 'Command desk' },
    ],
  },
  {
    id: 'signalend', title: 'THE SIGNAL', objectives: [
      { id: 'final_signal', text: 'Return to the radio console', waypoint: { poi: 'radio' }, radius: 8, nav: { x: 298.4, z: 67.5 }, hint: 'The tower is still on the hill' },
    ],
  },
];

export class MissionManager {
  private index = 0;
  private objIndex = 0;
  private counters = new Map<ObjectiveId, number>();
  private completed = new Set<string>();
  // notifications that arrived out of order (e.g. fuse found before the
  // "find fuse" objective appeared) — drained as objectives advance
  private pending = new Set<string>();
  onMissionStart: ((m: MissionDef) => void) | null = null;
  onObjective: ((o: Objective) => void) | null = null;
  onMissionComplete: ((m: MissionDef) => void) | null = null;
  onCampaignComplete: (() => void) | null = null;

  get current(): MissionDef | null {
    return this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }
  get objective(): Objective | null {
    const m = this.current;
    if (!m) return null;
    return m.objectives[this.objIndex] ?? null;
  }
  get missionIndex(): number { return this.index; }
  get objectiveIndex(): number { return this.objIndex; }
  counterOf(id: ObjectiveId): number { return this.counters.get(id) ?? 0; }

  /** Serialized state for saves. */
  getState(): { m: number; o: number; c: string[] } {
    return { m: this.index, o: this.objIndex, c: Array.from(this.completed) };
  }
  setState(s: { m: number; o: number; c: string[] }): void {
    this.index = Math.min(s.m, MISSIONS.length - 1);
    this.objIndex = Math.min(s.o, MISSIONS[this.index].objectives.length - 1);
    this.completed = new Set(s.c);
    this.pending.clear();
  }

  reset(): void {
    this.index = 0;
    this.objIndex = 0;
    this.counters.clear();
    this.completed.clear();
    this.pending.clear();
    const m = this.current!;
    this.onMissionStart?.(m);
    this.onObjective?.(m.objectives[0]);
  }

  /** Called when a specific interactable/event fires. */
  notify(id: string): void {
    const obj = this.objective;
    if (!obj) return;
    if (obj.id !== id) { this.pending.add(id); return; }
    if (obj.needCount) {
      const n = (this.counters.get(obj.id) ?? 0) + 1;
      this.counters.set(obj.id, n);
      if (n < obj.needCount) return;
    }
    this.complete(obj.id, id);
  }

  /** Called when the player enters a waypoint radius (horizontal distance). */
  checkProximity(pos: THREE.Vector3, pois: PoiManager): void {
    const obj = this.objective;
    if (!obj || !obj.waypoint || !obj.radius) return;
    let target: THREE.Vector3 | null = null;
    if (obj.waypoint.poi) target = pois.anchor(obj.waypoint.poi);
    else if (obj.waypoint.pos) target = obj.waypoint.pos;
    if (!target) return;
    const dx = pos.x - target.x, dz = pos.z - target.z;
    if (dx * dx + dz * dz < obj.radius * obj.radius) this.complete(obj.id);
  }

  /** Force-complete the current objective (mission scripts). */
  completeCurrent(): void {
    const obj = this.objective;
    if (obj) this.complete(obj.id);
  }

  private complete(objId: ObjectiveId, src?: string): void {
    const obj = this.objective;
    if (!obj || obj.id !== objId) return;
    this.completed.add(objId);
    void src;
    const m = this.current!;
    this.objIndex++;
    if (this.objIndex >= m.objectives.length) {
      this.onMissionComplete?.(m);
      this.index++;
      this.objIndex = 0;
      if (this.index >= MISSIONS.length) {
        this.onCampaignComplete?.();
        return;
      }
      this.onMissionStart?.(this.current!);
      const next = this.objective;
      if (next) this.onObjective?.(next);
    } else {
      this.onObjective?.(m.objectives[this.objIndex]);
    }
    this.drainPending();
  }

  /** Complete objectives already satisfied by earlier out-of-order events. */
  private drainPending(): void {
    const obj = this.objective;
    if (!obj) { this.pending.clear(); return; }
    if (this.pending.has(obj.id)) {
      this.pending.delete(obj.id);
      this.notify(obj.id);
    }
  }

  /** HUD info: current mission title + objective text. */
  hudText(): { title: string; objective: string } | null {
    const m = this.current;
    const o = this.objective;
    if (!m || !o) return null;
    return { title: m.title, objective: o.text };
  }

  /** Live navigation target (world x,z) for HUD distance / compass / minimap.
   *  Combat/survival objectives have no destination — the player is already in
   *  the encounter area, so a fixed-point distance is meaningless. */
  navTarget(pois: PoiManager): THREE.Vector3 | null {
    const o = this.objective;
    if (!o) return null;
    if (o.combat) return null;
    if (o.waypoint) {
      if (o.waypoint.poi) return pois.anchor(o.waypoint.poi);
      if (o.waypoint.pos) return o.waypoint.pos;
    }
    if (o.nav) return new THREE.Vector3(o.nav.x, 0, o.nav.z);
    return null;
  }
}