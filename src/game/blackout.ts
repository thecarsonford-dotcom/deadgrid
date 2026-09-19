// DEADGRID BLACKOUT EVENTS — the survival-pressure pillar. When the grid
// fails at a mission site: power stutters and dies, emergency lights take
// over, the Hollow attack in escalating waves, and ambient audio shifts.
// Survive all waves to restore power and unlock the reward.

import * as THREE from 'three';
import type { EnemyDirector, EnemyKind } from '../enemies/hollow';

export const TOTAL_WAVES = 4;

export class BlackoutEvent {
  phase: 'idle' | 'warning' | 'active' | 'cleared' = 'idle';
  wave = 0;
  private timer = 0;
  private waitingSpawn = false;
  private center = new THREE.Vector3();
  private director: EnemyDirector;
  private main: THREE.Light[] = [];
  private emerg: THREE.Light[] = [];
  private flickerT = 0;
  private rng = (): number => Math.random();

  onWarning: (() => void) | null = null;
  onStart: (() => void) | null = null;
  onWaveStart: ((wave: number, total: number) => void) | null = null;
  onCleared: (() => void) | null = null;

  constructor(director: EnemyDirector) {
    this.director = director;
  }

  get active(): boolean { return this.phase === 'warning' || this.phase === 'active'; }

  begin(center: THREE.Vector3, mainLights: THREE.Light[], emergLights: THREE.Light[]): void {
    this.phase = 'warning';
    this.wave = 0;
    this.timer = 3.4;
    this.waitingSpawn = false;
    this.center.copy(center);
    this.main = mainLights.map((l) => {
      if (l.userData.base === undefined) l.userData.base = l.intensity;
      return l;
    });
    this.emerg = emergLights.map((l) => {
      if (l.userData.base === undefined) l.userData.base = l.intensity || 1;
      return l;
    });
    this.onWarning?.();
  }

  abort(): void {
    if (this.phase === 'idle') return;
    this.phase = 'idle';
    this.restoreLights();
  }

  update(dt: number): void {
    if (this.phase === 'warning') {
      this.flickerT += dt;
      const stutter = Math.sin(this.flickerT * 21) > 0.1;
      for (const l of this.main) l.intensity = stutter ? (l.userData.base ?? 1) : 0;
      this.timer -= dt;
      if (this.timer <= 0) {
        for (const l of this.main) l.intensity = 0;
        for (const l of this.emerg) l.intensity = l.userData.base ?? 1;
        this.phase = 'active';
        this.wave = 0;
        this.waitingSpawn = true;
        this.timer = 1.2;
        this.onStart?.();
      }
      return;
    }

    if (this.phase !== 'active') return;

    this.flickerT += dt;
    for (const l of this.emerg) {
      const base = l.userData.base ?? 1;
      l.intensity = base * (0.8 + 0.2 * Math.sin(this.flickerT * 8.7));
    }

    if (this.waitingSpawn) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.wave++;
        this.spawnWave(this.wave);
        this.waitingSpawn = false;
        this.onWaveStart?.(this.wave, TOTAL_WAVES);
      }
      return;
    }

    // wave in progress: clear condition = few enemies remain near the site
    const alive = this.director.list.filter(
      (e) => e.state !== 'dead' && e.pos.distanceTo(this.center) < 75,
    ).length;
    if (alive <= 1) {
      if (this.wave >= TOTAL_WAVES) {
        this.phase = 'cleared';
        this.restoreLights();
        this.onCleared?.();
      } else {
        this.waitingSpawn = true;
        this.timer = 5.5;
      }
    }
  }

  private spawnWave(wave: number): void {
    // escalating tactical pressure — approach directions and speed, not health sponges
    if (wave === 1) {
      this.spawnGroup(3, ['hollow'], 16, 26, 0);
    } else if (wave === 2) {
      this.spawnGroup(3, ['hollow'], 15, 24, 0);
      this.spawnGroup(2, ['hollow'], 15, 24, Math.PI);
    } else if (wave === 3) {
      this.spawnGroup(2, ['hollow'], 14, 22, 0.7);
      this.spawnGroup(3, ['runner'], 18, 28, Math.PI * 0.8);
      this.spawnGroup(1, ['runner'], 12, 18, Math.PI * 1.4);
    } else {
      this.spawnGroup(3, ['hollow', 'runner'], 14, 26, 0.3);
      this.spawnGroup(2, ['stalker'], 20, 30, Math.PI);
      this.spawnGroup(1, ['brute'], 18, 24, Math.PI * 0.5);
    }
  }

  /** Spawn a group offset in one approach direction around the site. */
  private spawnGroup(count: number, kinds: EnemyKind[], minR: number, maxR: number, dir: number): void {
    const a = dir + (this.rng() - 0.5) * 1.2;
    const cx = this.center.x + Math.cos(a) * ((minR + maxR) / 2);
    const cz = this.center.z + Math.sin(a) * ((minR + maxR) / 2);
    this.director.spawnAround(new THREE.Vector3(cx, this.center.y, cz), count, kinds, 2, 9);
  }

  private restoreLights(): void {
    for (const l of this.main) l.intensity = l.userData.base ?? 1;
    for (const l of this.emerg) l.intensity = 0;
  }
}