// DEADGRID collision — continuous heightfield ground + static structure boxes.
// The old per-block collision is gone; the player and enemies move against
// the terrain height and axis-aligned boxes registered by POIs (walls,
// floors, crates). Steep slopes block movement so the world still feels solid.

import { WORLD } from '../core/world';

export interface Box {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export class CollisionWorld {
  private boxes: Box[] = [];
  private owners = new Map<object, Box[]>();

  addBox(b: Box): void { this.boxes.push(b); }

  /** Register boxes under an owner object; removeOwner(owner) drops them. */
  addOwned(owner: object, b: Box): void {
    this.boxes.push(b);
    let list = this.owners.get(owner);
    if (!list) { list = []; this.owners.set(owner, list); }
    list.push(b);
  }

  addBoxCentered(cx: number, y0: number, cz: number, w: number, h: number, d: number): Box {
    const b: Box = {
      minX: cx - w / 2, maxX: cx + w / 2,
      minY: y0, maxY: y0 + h,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    };
    this.boxes.push(b);
    return b;
  }

  removeOwner(owner: object): void {
    const list = this.owners.get(owner);
    if (!list) return;
    this.boxes = this.boxes.filter((b) => !list.includes(b));
    this.owners.delete(owner);
  }

  clear(): void { this.boxes.length = 0; this.owners.clear(); }

  get count(): number { return this.boxes.length; }

  // Highest walkable surface at (x,z) no higher than `upTo` (feet y + step).
  supportAt(x: number, z: number, upTo: number): number {
    let y = WORLD.groundHeight(x, z);
    for (const b of this.boxes) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        if (b.maxY <= upTo && b.maxY > y) y = b.maxY;
      }
    }
    return y;
  }

  // Lowest ceiling bottom at (x,z) at or above `fromY` (head y).
  ceilAt(x: number, z: number, aboveY: number): number {
    let y = Infinity;
    for (const b of this.boxes) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        if (b.minY >= aboveY && b.minY < y) y = b.minY;
      }
    }
    return y;
  }

  // Does the vertical segment (feetY..headY) intersect any structure at (x,z)?
  blockedAt(x: number, y0: number, y1: number, z: number, pad = 0): boolean {
    for (const b of this.boxes) {
      if (x >= b.minX - pad && x <= b.maxX + pad && z >= b.minZ - pad && z <= b.maxZ + pad) {
        if (y1 > b.minY + 0.02 && y0 < b.maxY - 0.02) return true;
      }
    }
    return false;
  }

  // Blocked test for an AABB body (used for horizontal movement).
  boxBlocked(minX: number, maxX: number, minZ: number, maxZ: number, y0: number, y1: number): boolean {
    for (const b of this.boxes) {
      if (minX < b.maxX && maxX > b.minX && minZ < b.maxZ && maxZ > b.minZ) {
        if (y1 > b.minY + 0.02 && y0 < b.maxY - 0.02) return true;
      }
    }
    return false;
  }

  // Cheap ray vs AABBs (structure occlusion / AI sight). Returns nearest t or -1.
  rayHitT(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): number {
    let best = -1;
    for (const b of this.boxes) {
      let t0 = 0, t1 = maxT;
      let ok = true;
      const axes: [number, number, number, number][] = [
        [ox, dx, b.minX, b.maxX],
        [oy, dy, b.minY, b.maxY],
        [oz, dz, b.minZ, b.maxZ],
      ];
      for (const [o, d, mn, mx] of axes) {
        if (Math.abs(d) < 1e-8) {
          if (o < mn || o > mx) { ok = false; break; }
        } else {
          let ta = (mn - o) / d, tb = (mx - o) / d;
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok && (best < 0 || t0 < best)) best = t0;
    }
    return best;
  }

  forEachBox(fn: (b: Box) => void): void { for (const b of this.boxes) fn(b); }
}

export const COLLISION = new CollisionWorld();