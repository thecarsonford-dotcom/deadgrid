// DEADGRID player controller — feet-position kinematic body with heightfield
// ground, structure-box collision, crouch, stamina sprint, head-bob state and
// landing impulses. Feels like a proper FPS body, not a floating camera.

import * as THREE from 'three';
import { COLLISION } from './world/collision';

const WALK = 4.3;
const SPRINT = 6.9;
const CROUCH_SPEED = 2.1;
const ACCEL = 14;
const AIR_ACCEL = 2.6;
const GRAV = 24;
const JUMP = 8.2;
const RADIUS = 0.34;
const STAND_H = 1.75;
const CROUCH_H = 1.2;
const STEP_UP = 0.55;

export interface PlayerInput {
  fwd: boolean; back: boolean; left: boolean; right: boolean;
  jump: boolean; sprint: boolean; crouch: boolean;
}

export class Player {
  pos = new THREE.Vector3(0, 40, 0); // FEET position
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;
  stamina = 100;
  crouching = false;
  sprinting = false;
  speed2D = 0;
  fallSpeed = 0;
  speedScale = 1;
  strafeAmt = 0;
  landKick = 0;

  // presentation state (read by game for camera + viewmodel)
  bobPhase = 0;
  bobAmp = 0;
  onStep: (() => void) | null = null;

  get height(): number { return this.crouching ? CROUCH_H : STAND_H; }
  get eyeY(): number { return this.pos.y + this.height - 0.15; }

  private wasGrounded = true;
  private jumpHeld = false;

  private groundAt(x: number, z: number, feetY: number): number {
    return COLLISION.supportAt(x, z, feetY + STEP_UP);
  }

  private blockedBox(x: number, z: number, y0: number, y1: number): boolean {
    return COLLISION.boxBlocked(x - RADIUS, x + RADIUS, z - RADIUS, z + RADIUS, y0, y1);
  }

  update(dt: number, input: PlayerInput): void {
    dt = Math.min(dt, 0.05);
    const p = this.pos, v = this.vel;

    // wish direction
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const fwdX = -sinY, fwdZ = -cosY;
    const rightX = cosY, rightZ = -sinY;
    let wx = 0, wz = 0;
    if (input.fwd) { wx += fwdX; wz += fwdZ; }
    if (input.back) { wx -= fwdX; wz -= fwdZ; }
    if (input.right) { wx += rightX; wz += rightZ; }
    if (input.left) { wx -= rightX; wz -= rightZ; }
    const moving = wx !== 0 || wz !== 0;
    const strafeTarget = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.strafeAmt += (strafeTarget - this.strafeAmt) * Math.min(1, dt * 9);
    if (moving) {
      const l = Math.hypot(wx, wz);
      wx /= l; wz /= l;
    }

    // crouch (hold)
    const wantCrouch = input.crouch;
    if (wantCrouch) this.crouching = true;
    else if (this.crouching) {
      // only stand up if there's headroom
      const ceil = COLLISION.ceilAt(p.x, p.z, p.y + CROUCH_H);
      if (ceil - (p.y + CROUCH_H) > STAND_H - CROUCH_H + 0.05 || ceil === Infinity) this.crouching = false;
    }

    // sprint + stamina
    const canSprint = input.sprint && moving && !this.crouching && this.grounded && this.stamina > 4;
    this.sprinting = canSprint;
    if (canSprint) this.stamina = Math.max(0, this.stamina - 15 * dt);
    else this.stamina = Math.min(100, this.stamina + (moving ? 7 : 12) * dt);

    const speed = (this.crouching ? CROUCH_SPEED : canSprint ? SPRINT : WALK) * this.speedScale;
    const accel = this.grounded ? ACCEL : AIR_ACCEL;
    v.x += (wx * speed - v.x) * Math.min(1, accel * dt);
    v.z += (wz * speed - v.z) * Math.min(1, accel * dt);
    if (!moving && this.grounded) {
      const damp = Math.max(0, 1 - 10 * dt);
      v.x *= damp; v.z *= damp;
    }
    this.speed2D = Math.hypot(v.x, v.z);

    // gravity
    v.y -= GRAV * dt;
    if (input.jump && this.grounded && !this.crouching && !this.jumpHeld) {
      v.y = JUMP;
      this.grounded = false;
    }
    this.jumpHeld = input.jump;

    // --- horizontal movement with blocking ---
    for (const axis of ['x', 'z'] as const) {
      const delta = (axis === 'x' ? v.x : v.z) * dt;
      const sign = Math.sign(delta);
      let remaining = Math.abs(delta);
      while (remaining > 1e-6) {
        const d = sign * Math.min(0.1, remaining);
        remaining -= Math.abs(d);
        const nx = axis === 'x' ? p.x + d : p.x;
        const nz = axis === 'z' ? p.z + d : p.z;
        // structure collision
        if (this.blockedBox(nx, nz, p.y + 0.25, p.y + this.height - 0.05)) {
          if (axis === 'x') v.x = 0; else v.z = 0;
          break;
        }
        // steep slope blocking
        const gHere = this.groundAt(p.x, p.z, p.y);
        const gThere = this.groundAt(nx, nz, p.y);
        if (gThere - gHere > STEP_UP && this.grounded) {
          if (axis === 'x') v.x = 0; else v.z = 0;
          break;
        }
        if (axis === 'x') p.x = nx; else p.z = nz;
      }
    }

    // --- vertical
    const prevY = p.y;
    p.y += v.y * dt;
    const ground = this.groundAt(p.x, p.z, p.y + 0.2);
    this.grounded = false;
    if (p.y <= ground) {
      const impact = Math.max(0, -v.y);
      p.y = ground;
      v.y = 0;
      this.grounded = true;
      if (impact > 7 && !this.wasGrounded) {
        this.landKick = Math.min(1, impact / 14);
        this.onLand?.(impact);
      }
    } else if (p.y - ground < 0.08 && v.y <= 0) {
      p.y = ground;
      v.y = 0;
      this.grounded = true;
    }
    // ceiling
    const headY = p.y + this.height;
    const ceil = COLLISION.ceilAt(p.x, p.z, p.y + 0.4);
    if (ceil !== Infinity && headY > ceil) {
      p.y = Math.max(ground, ceil - this.height - 0.02);
      if (v.y > 0) v.y = 0;
    }
    this.fallSpeed = Math.max(0, -v.y);
    this.wasGrounded = this.grounded;
    this.landKick = Math.max(0, this.landKick - dt * 3.2);
    void prevY;

    // head-bob phase + footstep events
    if (this.grounded && this.speed2D > 0.4) {
      const rate = 1.9 + this.speed2D * 0.55;
      const prevPhase = this.bobPhase;
      this.bobPhase += rate * dt;
      this.bobAmp = Math.min(1, this.bobAmp + dt * 5);
      const cyc = Math.floor(this.bobPhase / Math.PI);
      const prevCyc = Math.floor(prevPhase / Math.PI);
      if (cyc !== prevCyc) this.onStep?.();
    } else {
      this.bobAmp = Math.max(0, this.bobAmp - dt * 4);
    }

    // fell out of the world (safety)
    if (p.y < -30) {
      p.y = this.groundAt(p.x, p.z, 60) + 2;
      v.set(0, 0, 0);
    }
  }

  onLand: ((impact: number) => void) | null = null;
}