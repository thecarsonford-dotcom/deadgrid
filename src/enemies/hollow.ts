// DEADGRID enemies — THE HOLLOW. Human-proportioned low-poly infected with
// procedural walk/attack/stagger/death animation, zone-based hitboxes
// (head/torso/limbs), state-driven AI (wander → investigate → chase → attack),
// and four variants: Hollow, Runner, Brute, Stalker.

import * as THREE from 'three';
import { COLLISION } from '../world/collision';
import { WORLD } from '../core/world';

export type EnemyKind = 'hollow' | 'runner' | 'brute' | 'stalker';
export type EnemyState = 'idle' | 'wander' | 'investigate' | 'chase' | 'attack' | 'dead';

export interface Enemy {
  kind: EnemyKind;
  state: EnemyState;
  root: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  eyes: THREE.Object3D;
  bodyMats: THREE.MeshStandardMaterial[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  maxHp: number;
  walkSpeed: number;
  chaseSpeed: number;
  damage: number;
  attackRange: number;
  attackCd: number;
  windup: number;          // >0 while attacking windup
  stateT: number;
  target: THREE.Vector3;
  wanderT: number;
  walkPhase: number;
  staggerT: number;
  staggerResist: number;
  detectR: number;
  loseT: number;
  growlCd: number;
  deathT: number;
  deathDir: number;
  attackCdMax: number;
  scale: number;
  hitLean?: number;
  deathSpeed?: number;
  deathSpin?: number;
}

interface KindStats {
  hp: number; walk: number; chase: number; dmg: number; range: number;
  cd: number; detect: number; scale: number; stagger: number;
}

const STATS: Record<EnemyKind, KindStats> = {
  hollow: { hp: 55, walk: 1.5, chase: 3.2, dmg: 10, cd: 1.25, detect: 20, range: 1.9, stagger: 0.35, scale: 1.0 },
  runner: { hp: 32, walk: 2.2, chase: 5.3, dmg: 8, cd: 0.85, detect: 24, range: 1.8, stagger: 0.3, scale: 0.95 },
  brute: { hp: 210, walk: 1.1, chase: 2.3, dmg: 26, cd: 1.7, detect: 18, range: 2.4, stagger: 0.14, scale: 1.34 },
  stalker: { hp: 50, walk: 1.8, chase: 5.6, dmg: 14, cd: 1.0, detect: 15, range: 1.9, stagger: 0.3, scale: 0.98 },
};

const CLOTH_COLORS = [0x3a3f46, 0x4a4238, 0x37424a, 0x46403a, 0x2f3538];

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// shared geometries — capsule/tapered human parts, not cubes
const G = {
  head: new THREE.SphereGeometry(0.125, 10, 8),
  jaw: new THREE.BoxGeometry(0.13, 0.055, 0.09),
  eye: new THREE.SphereGeometry(0.017, 6, 5),
  torso: new THREE.CapsuleGeometry(0.185, 0.34, 3, 8),
  pelvis: new THREE.CapsuleGeometry(0.15, 0.1, 3, 8),
  arm: new THREE.CylinderGeometry(0.048, 0.038, 0.6, 6),
  hand: new THREE.SphereGeometry(0.05, 6, 5),
  leg: new THREE.CylinderGeometry(0.072, 0.05, 0.7, 6),
  foot: new THREE.BoxGeometry(0.09, 0.05, 0.2),
};

export class EnemyDirector {
  list: Enemy[] = [];
  private scene: THREE.Scene;
  private rng: () => number = mulberry32(0xdead1);

  // tuning
  maxAlive = 13;
  onGrowl: ((dist: number) => void) | null = null;
  onHitPlayer: ((dmg: number, fromPos: THREE.Vector3) => void) | null = null;
  onDeath: ((e: Enemy) => void) | null = null;
  onDrop: ((pos: THREE.Vector3) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  reseed(seed: number): void {
    let s = seed >>> 0;
    this.rng = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  clear(): void {
    for (const e of this.list) this.scene.remove(e.root);
    this.list.length = 0;
  }

  get aliveCount(): number { return this.list.filter((e) => e.state !== 'dead').length; }

  spawn(kind: EnemyKind, x: number, z: number): Enemy | null {
    const st = STATS[kind];
    const gy = groundAt(x, z);
    if (gy < WORLD.WATER_Y + 0.3) return null;

    const rng = this.rng;
    const cloth = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CLOTH_COLORS[Math.floor(rng() * CLOTH_COLORS.length)]),
      roughness: 0.95,
    });
    const skinTint = kind === 'stalker' ? 0x6f6b60 : kind === 'runner' ? 0x8f8c80 : 0x948e7e;
    const skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinTint).offsetHSL(0, 0, (rng() - 0.5) * 0.08),
      roughness: 0.92,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0d05,
      emissive: new THREE.Color(kind === 'stalker' ? 0xff5a1a : 0xffb64a),
      emissiveIntensity: kind === 'stalker' ? 2.4 : 1.2,
    });

    const root = new THREE.Group();
    const torso = new THREE.Mesh(G.torso, kind === 'runner' ? skin : cloth);
    torso.scale.set(1, 1, 0.72);           // flatter chest profile
    torso.position.y = 1.16;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6), skin);
    neck.position.y = 1.55;
    root.add(neck);
    const head = new THREE.Mesh(G.head, skin);
    head.scale.set(1, 1.12, 1.02);
    head.position.y = 1.68;
    head.rotation.x = 0.18;
    // gaunt jaw wedge
    const jaw = new THREE.Mesh(G.jaw, skin);
    jaw.position.set(0, -0.085, 0.055);
    jaw.rotation.x = 0.3;
    head.add(jaw);
    // eyes: twin emissive dots, sparing use
    const eyes = new THREE.Group();
    const eyeL = new THREE.Mesh(G.eye, eyeMat);
    const eyeR = new THREE.Mesh(G.eye, eyeMat);
    eyeL.position.set(-0.042, 0.015, 0.108);
    eyeR.position.set(0.042, 0.015, 0.108);
    eyes.add(eyeL, eyeR);
    head.add(eyes);
    const armL = new THREE.Mesh(G.arm, cloth);
    armL.position.set(-0.245, 1.3, 0);
    const shoulderL = new THREE.Mesh(G.hand, skin);
    shoulderL.position.set(0, 0.3, 0);
    shoulderL.scale.setScalar(0.85);
    armL.add(shoulderL);
    const handL = new THREE.Mesh(G.hand, skin);
    handL.position.set(0, -0.33, 0.02);
    armL.add(handL);
    const armR = new THREE.Mesh(G.arm, cloth);
    armR.position.set(0.245, 1.3, 0);
    const shoulderR = new THREE.Mesh(G.hand, skin);
    shoulderR.position.set(0, 0.3, 0);
    shoulderR.scale.setScalar(0.85);
    armR.add(shoulderR);
    const handR = new THREE.Mesh(G.hand, skin);
    handR.position.set(0, -0.33, 0.02);
    armR.add(handR);
    const legL = new THREE.Mesh(G.leg, cloth);
    legL.position.set(-0.105, 0.42, 0);
    const footL = new THREE.Mesh(G.foot, cloth);
    footL.position.set(0, -0.35, 0.04);
    legL.add(footL);
    const legR = new THREE.Mesh(G.leg, cloth);
    legR.position.set(0.105, 0.42, 0);
    const footR = new THREE.Mesh(G.foot, cloth);
    footR.position.set(0, -0.35, 0.04);
    legR.add(footR);
    const pelvis = new THREE.Mesh(G.pelvis, cloth);
    pelvis.scale.set(1.05, 1, 0.8);
    pelvis.position.y = 0.82;
    for (const m of [torso, head, armL, armR, legL, legR, pelvis, neck]) {
      m.castShadow = true;
      m.userData.enemy = true;
      root.add(m);
    }
    root.userData.zones = { head, torso, armL, armR, legL, legR };
    const s = st.scale;
    root.scale.setScalar(s);
    root.position.set(x, gy, z);
    this.scene.add(root);

    const e: Enemy = {
      kind, state: 'wander', root, head, torso, armL, armR, legL, legR, eyes,
      bodyMats: [skin, cloth],
      pos: new THREE.Vector3(x, gy, z),
      vel: new THREE.Vector3(),
      hp: st.hp, maxHp: st.hp,
      walkSpeed: st.walk, chaseSpeed: st.chase,
      damage: st.dmg, attackRange: st.range,
      attackCd: 0, windup: 0,
      stateT: 0, walkPhase: rng() * 6,
      staggerT: 0, staggerResist: st.stagger,
      detectR: st.detect,
      loseT: 0, growlCd: rng() * 8,
      deathT: 0, deathDir: 0,
      attackCdMax: st.cd,
      scale: s,
      target: new THREE.Vector3(x, gy, z),
      wanderT: rng() * 3,
    };
    // register zone owners
    for (const m of [head, torso, armL, armR, legL, legR]) {
      m.userData.enemyRef = e;
      head.userData.zone = 'head';
      torso.userData.zone = 'torso';
      armL.userData.zone = 'limb'; armR.userData.zone = 'limb';
      legL.userData.zone = 'limb'; legR.userData.zone = 'limb';
    }
    this.list.push(e);
    return e;
  }

  /** Spawn a loose ring around a position, returning the count placed. */
  spawnAround(center: THREE.Vector3, count: number, kinds: EnemyKind[], minR = 18, maxR = 34): number {
    let placed = 0;
    for (let i = 0; i < count * 4 && placed < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = minR + this.rng() * (maxR - minR);
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      const kind = kinds[Math.floor(this.rng() * kinds.length)];
      const before = this.list.length;
      this.spawn(kind, x, z);
      if (this.list.length > before) placed++;
    }
    return placed;
  }

  /** Alert enemies near a noise position to investigate. */
  noise(pos: THREE.Vector3, radius: number): void {
    for (const e of this.list) {
      if (e.state === 'dead' || e.state === 'chase' || e.state === 'attack') continue;
      if (e.pos.distanceTo(pos) < radius) {
        e.state = 'investigate';
        e.stateT = 0;
        e.wanderT = 0;
        (e as Enemy & { invX?: number; invZ?: number }).invX = pos.x;
        (e as Enemy & { invX?: number; invZ?: number }).invZ = pos.z;
      }
    }
  }

  /** Apply zone damage from a raycast part mesh. Returns true if killed. */
  hitZone(mesh: THREE.Mesh, dmg: number, dirX: number, dirZ: number, knockback = 1.6): boolean {
    const e = mesh.userData.enemyRef as Enemy | undefined;
    if (!e || e.state === 'dead') return false;
    const zone = mesh.userData.zone as 'head' | 'torso' | 'limb' | undefined;
    let mult = 1;
    if (zone === 'head') mult = e.kind === 'brute' ? 1.8 : 2.6;
    else if (zone === 'limb') mult = 0.75;
    const headMult = zone === 'head' ? 1.6 : 1;
    return this.damage(e, dmg * mult, dirX, dirZ, headMult, knockback * (zone === 'head' ? 1.5 : 1));
  }

  /** Direct damage (melee). Returns true if killed. */
  damage(e: Enemy, dmg: number, dirX: number, dirZ: number, staggerMult = 1, knockback = 1.6): boolean {
    if (e.state === 'dead') return false;
    e.hp -= dmg;
    e.staggerT = Math.max(e.staggerT, e.staggerResist * staggerMult);
    if (e.state === 'idle' || e.state === 'wander' || e.state === 'investigate') {
      e.state = 'chase';
      e.loseT = 0;
    }
    // weapon-scaled knockback impulse
    e.vel.x += dirX * knockback;
    e.vel.z += dirZ * knockback;
    // flinch pitch — hit reaction leans away from the shot
    e.hitLean = Math.min(0.9, (e.hitLean ?? 0) + 0.35 * staggerMult);
    if (e.hp <= 0) {
      this.kill(e, dirX, dirZ, knockback);
      return true;
    }
    return false;
  }

  private kill(e: Enemy, dirX: number, dirZ: number, knockback: number): void {
    e.state = 'dead';
    e.deathT = 0;
    e.deathDir = Math.atan2(dirX, dirZ);
    // death impulse: heavier hits send the body further and faster
    e.deathSpeed = 1.1 + Math.min(3.4, knockback * 0.75);
    e.deathSpin = (this.rng() - 0.5) * 1.6;
    // corpse pool: fade the oldest when over budget
    const corpses = this.list.filter((x) => x.state === 'dead');
    if (corpses.length > 12) {
      const oldest = corpses.reduce((a, b) => (a.deathT > b.deathT ? a : b));
      if (oldest.deathT < 14) oldest.deathT = Math.max(oldest.deathT, 14.5);
    }
    this.onDeath?.(e);
    // occasional supply drop (16%) — supports the survival economy
    if (this.onDrop && this.rng() < 0.16) this.onDrop(e.pos.clone());
  }

  update(dt: number, playerPos: THREE.Vector3, opts: { night: boolean }): void {
    void opts;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.state === 'dead') {
        this.updateDeath(e, dt);
        if (e.deathT > 18) {
          this.scene.remove(e.root);
          this.list.splice(i, 1);
        }
        continue;
      }

      const dist = e.pos.distanceTo(playerPos);
      e.attackCd -= dt;
      e.stateT += dt;
      e.growlCd -= dt;

      // perception
      const night = this.nightNow;
      const detect = night ? e.detectR * 0.55 : e.detectR;
      if (dist < detect && e.state !== 'attack') {
        e.state = 'chase';
        e.loseT = 0;
      } else if (e.state === 'chase') {
        e.loseT += dt;
        if (e.loseT > 7) { e.state = 'wander'; e.wanderT = 0; }
      }

      // state behavior
      let moveX = 0, moveZ = 0, speed = 0;
      switch (e.state) {
        case 'wander': {
          e.wanderT -= dt;
          if (e.wanderT <= 0) {
            const a = this.rng() * Math.PI * 2;
            e.wanderT = 3 + this.rng() * 4;
            (e as Enemy & { tx?: number; tz?: number }).tx = e.pos.x + Math.cos(a) * 8;
            (e as Enemy & { tx?: number; tz?: number }).tz = e.pos.z + Math.sin(a) * 8;
          }
          const tx = (e as Enemy & { tx?: number }).tx ?? e.pos.x;
          const tz = (e as Enemy & { tz?: number }).tz ?? e.pos.z;
          const dx = tx - e.pos.x, dz = tz - e.pos.z;
          const l = Math.hypot(dx, dz);
          if (l > 0.8) { moveX = dx / l; moveZ = dz / l; speed = e.walkSpeed; }
          break;
        }
        case 'investigate': {
          const inv = e as Enemy & { invX?: number; invZ?: number };
          const dx = (inv.invX ?? e.pos.x) - e.pos.x;
          const dz = (inv.invZ ?? e.pos.z) - e.pos.z;
          const l = Math.hypot(dx, dz);
          if (l > 1.2) { moveX = dx / l; moveZ = dz / l; speed = e.walkSpeed * 1.5; }
          else if (e.stateT > 4) e.state = 'wander';
          break;
        }
        case 'chase': {
          const dx = playerPos.x - e.pos.x, dz = playerPos.z - e.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          moveX = dx / l; moveZ = dz / l;
          speed = e.chaseSpeed;
          if (dist < e.attackRange * 0.8 && e.attackCd <= 0) {
            e.state = 'attack';
            e.windup = 0.42;
            e.stateT = 0;
          }
          break;
        }
        case 'attack': {
          const dx = playerPos.x - e.pos.x, dz = playerPos.z - e.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          // hold position, small shuffle forward
          if (dist > e.attackRange * 0.8) { moveX = dx / l; moveZ = dz / l; speed = e.chaseSpeed * 0.6; }
          e.windup -= dt;
          if (e.windup <= 0 && e.stateT > 0.45) {
            if (dist < e.attackRange * 1.15) {
              this.onHitPlayer?.(e.damage, e.pos);
            }
            e.state = 'chase';
            e.attackCd = e.attackCdMax + (e.windup < -0.2 ? 0.5 : 0);
          }
          if (dist > e.attackRange * 1.6) e.state = 'chase';
          break;
        }
        default: break;
      }

      // stagger blocks movement
      if (e.staggerT > 0) {
        e.staggerT -= dt;
        moveX = 0; moveZ = 0; speed = 0;
      }

      // knockback velocity decay
      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
      e.vel.x *= Math.max(0, 1 - 6 * dt);
      e.vel.z *= Math.max(0, 1 - 6 * dt);

      // move + obstacle steer
      if (speed > 0) {
        let sx = moveX * speed * dt;
        let sz = moveZ * speed * dt;
        if (blocked(e.pos.x + sx, e.pos.z, e.pos.y)) {
          // slide along obstacle
          const alt = this.rng() > 0.5 ? 1 : -1;
          const px = -moveZ * alt, pz = moveX * alt;
          sx = px * speed * dt;
          sz = pz * speed * dt;
          if (blocked(e.pos.x + sx, e.pos.z + sz, e.pos.y)) { sx = 0; sz = 0; }
        }
        if (!blocked(e.pos.x + sx, e.pos.z + sz, e.pos.y)) {
          e.pos.x += sx;
          e.pos.z += sz;
        }
        e.walkPhase += dt * (speed * 3.4);
      }

      // ground snap
      const gy = groundAt(e.pos.x, e.pos.z);
      e.pos.y += (gy - e.pos.y) * Math.min(1, 10 * dt);

      // growls
      if (this.onGrowl && e.growlCd <= 0 && (e.state === 'chase' || e.state === 'attack') && dist < 26) {
        this.onGrowl(dist);
        e.growlCd = 2 + this.rng() * 4;
      }

      // present
      e.root.position.copy(e.pos);
      const face = e.state === 'wander' || e.state === 'investigate'
        ? Math.atan2(moveX || Math.sin(e.walkPhase), moveZ || Math.cos(e.walkPhase))
        : Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      // smooth turn
      let cur = e.root.rotation.y;
      let diff = ((face - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;
      e.root.rotation.y = cur + diff * Math.min(1, 8 * dt);

      this.animate(e, dt, playerPos);

      // despawn far away
      if (dist > 90) {
        this.scene.remove(e.root);
        this.list.splice(i, 1);
      }
    }
  }

  private updateDeath(e: Enemy, dt: number): void {
    e.deathT += dt;
    const speed = e.deathSpeed ?? 1.1;
    // phase 1 (0..0.18s): slide back along the hit impulse
    // phase 2 (0.18..0.7s): directional collapse with spin drift
    const fall = Math.min(1, Math.max(0, (e.deathT - 0.12) / 0.55));
    const fp = fall * fall * (3 - 2 * fall);
    e.root.rotation.x = fp * (Math.PI / 2) * 0.94;
    e.root.rotation.z = fp * (e.deathSpin ?? 0) * 0.3;
    e.root.position.y = e.pos.y - fp * 0.42;
    e.root.rotation.y = e.deathDir + (e.deathSpin ?? 0) * fp * 0.4;
    const slide = speed * (1 - fp);
    e.pos.x += Math.sin(e.deathDir) * dt * slide;
    e.pos.z += Math.cos(e.deathDir) * dt * slide;
    e.root.position.x = e.pos.x;
    e.root.position.z = e.pos.z;
    // splay arms as the body drops
    e.armL.rotation.z = 0.15 + fp * 1.1;
    e.armR.rotation.z = -0.15 - fp * 1.1;
    e.armL.rotation.x = -0.2 - fp * 0.4;
    e.armR.rotation.x = -0.2 - fp * 1.2;
    // fade out at the end of the corpse window
    if (e.deathT > 15) {
      const f = Math.max(0, 1 - (e.deathT - 15) / 3);
      for (const m of e.bodyMats) {
        m.transparent = true;
        m.opacity = f;
      }
    }
  }

  private nightNow = false;
  setNight(n: boolean): void { this.nightNow = n; }

  private animate(e: Enemy, dt: number, playerPos: THREE.Vector3): void {
    const ph = e.walkPhase;
    const moving = e.state === 'chase' || e.state === 'investigate' || (e.state === 'wander');
    const amp = moving ? (e.state === 'chase' ? 0.85 : 0.5) : 0.06;
    // legs swing
    e.legL.rotation.x = Math.sin(ph) * amp;
    e.legR.rotation.x = -Math.sin(ph) * amp;
    // arms: runner/stalker reach forward; others dangle and swing
    if (e.kind === 'runner' || e.kind === 'stalker') {
      e.armL.rotation.x = -1.9 + Math.sin(ph * 2) * 0.15;
      e.armR.rotation.x = -1.9 - Math.sin(ph * 2) * 0.15;
      e.armL.rotation.z = 0.12;
      e.armR.rotation.z = -0.12;
    } else if (e.kind === 'brute') {
      e.armL.rotation.x = -0.5 + Math.sin(ph) * 0.35;
      e.armR.rotation.x = -0.5 - Math.sin(ph) * 0.35;
      e.armL.rotation.z = 0.5;
      e.armR.rotation.z = -0.5;
    } else {
      e.armL.rotation.x = -0.45 + Math.sin(ph) * amp * 0.8;
      e.armR.rotation.x = -0.45 - Math.sin(ph) * amp * 0.8;
      e.armL.rotation.z = 0.15;
      e.armR.rotation.z = -0.15;
    }
    // hunch + head wobble
    const hunch = e.kind === 'runner' ? 0.55 : e.kind === 'brute' ? 0.3 : 0.42;
    e.torso.rotation.x = THREE.MathUtils.lerp(e.torso.rotation.x, hunch + Math.sin(ph * 2) * 0.04, Math.min(1, dt * 6));
    e.head.rotation.z = Math.sin(e.stateT * 1.3) * 0.18;
    // attack windup: raise both arms fast
    if (e.state === 'attack' || e.windup > 0) {
      const raise = THREE.MathUtils.clamp(1 - Math.max(0, e.windup) / 0.42, 0, 1);
      e.armL.rotation.x = -2.3 + raise * 1.6;
      e.armR.rotation.x = -2.3 + raise * 1.6;
    }
    // stagger flinch: lean away from the hit + head snap
    if (e.staggerT > 0) {
      e.torso.rotation.x -= 0.4 + (e.hitLean ?? 0) * 0.5;
      e.torso.rotation.y = (e.hitLean ?? 0) * 0.35;
      e.head.rotation.z += 0.5 + (e.hitLean ?? 0) * 0.4;
    } else {
      e.torso.rotation.y = 0;
    }
    // hit lean decays
    if (e.hitLean) e.hitLean = Math.max(0, e.hitLean - dt * 3.2);
    // eye glow pulse at night
    if (this.nightNow) {
      const eyeMesh = e.eyes.children[0] as THREE.Mesh | undefined;
      if (eyeMesh) (eyeMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.6 + Math.sin(e.stateT * 3 + e.walkPhase) * 1.2;
    }
    // hit flash: quick red emissive pulse on the skin
    if (e.staggerT > 0.18) {
      for (const m of e.bodyMats) m.emissive.setRGB(0.35, 0.02, 0.02);
    } else {
      for (const m of e.bodyMats) m.emissive.setRGB(0, 0, 0);
    }
    void playerPos;
  }
}

function groundAt(x: number, z: number): number {
  return WORLD.groundHeight(x, z);
}

function blocked(x: number, y: number, z: number): boolean {
  return COLLISION.blockedAt(x, y + 0.3, y + 1.7, z, 0.25);
}