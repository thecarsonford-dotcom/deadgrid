// DEADGRID MINIMAP — a top-down tactical map rendered to a 2D canvas.
// Player-centered, north-up. Shows terrain elevation, the road spine,
// water, fixed POIs, the current objective marker, and the player heading
// wedge. Cheap enough to redraw every frame at 240px.

import { WORLD } from '../core/world';
import { ROAD_PTS } from '../world/roads';

// Fixed campaign POIs (mirrors pois.ts FIXED) — drawn as labeled blips.
const POIS: { id: string; x: number; z: number; label: string }[] = [
  { id: 'cabin', x: 14, z: 26, label: 'CABIN' },
  { id: 'radio', x: 300, z: 70, label: 'RELAY' },
  { id: 'evac', x: 180, z: 8, label: 'EVAC' },
  { id: 'checkpoint', x: 368, z: 30, label: 'CHECKPOINT' },
  { id: 'industrial', x: 430, z: 44, label: 'YARD' },
  { id: 'bunker', x: 560, z: -78, label: 'BUNKER' },
  { id: 'suburb', x: -72, z: 92, label: 'SUBURB' },
];

// Terrain elevation range (from core/world.ts: roughly 26..58, water at 25).
const H_MIN = 26, H_MAX = 58;

export interface MinimapState {
  px: number; pz: number;      // player feet (world)
  yaw: number;                 // player heading (radians)
  objective: [number, number] | null; // objective target (world x,z) or null
  blackout: boolean;           // blackout active — tint the map
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 240;          // CSS pixels
  private dpr = 1;
  private range = 150;         // world units shown edge-to-edge (half = 75)
  private terrain: HTMLCanvasElement | null = null; // cached terrain layer
  private terrainKey = '';     // cache key (size + range)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('minimap: 2d context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.size * this.dpr);
    this.canvas.height = Math.round(this.size * this.dpr);
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.terrain = null; // invalidate cache
  }

  /** World (x,z) → canvas pixel (cx,cy), north-up, player-centered. */
  private toScreen(wx: number, wz: number, px: number, pz: number): [number, number] {
    const half = this.size / 2;
    const scale = half / this.range;
    return [half + (wx - px) * scale, half + (wz - pz) * scale];
  }

  /** Build (or reuse) the cached terrain layer for the current player cell. */
  private terrainLayer(px: number, pz: number): HTMLCanvasElement {
    // Cache per coarse cell so we don't resample the heightfield every frame.
    const cell = 8;
    const key = `${this.size}|${this.range}|${Math.round(px / cell)}|${Math.round(pz / cell)}`;
    if (this.terrain && this.terrainKey === key) return this.terrain;

    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const step = 4; // css px per sample
    const scale = (this.size / 2) / this.range;

    for (let sy = 0; sy < this.size; sy += step) {
      for (let sx = 0; sx < this.size; sx += step) {
        const wx = px + (sx - this.size / 2) / scale;
        const wz = pz + (sy - this.size / 2) / scale;
        const h = WORLD.groundHeight(wx, wz);
        const water = h < WORLD.WATER_Y + 0.15;
        let r: number, gg: number, b: number;
        if (water) {
          const depth = Math.min(1, (WORLD.WATER_Y + 0.15 - h) / 6);
          r = 18 + 10 * (1 - depth); gg = 40 + 18 * (1 - depth); b = 52 + 22 * (1 - depth);
        } else {
          const t = Math.max(0, Math.min(1, (h - H_MIN) / (H_MAX - H_MIN)));
          // low = dark olive, high = pale ash — reads as elevation
          r = 26 + t * 46; gg = 30 + t * 52; b = 26 + t * 40;
        }
        g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
        g.fillRect(sx * this.dpr, sy * this.dpr, step * this.dpr, step * this.dpr);
      }
    }
    this.terrain = c;
    this.terrainKey = key;
    return c;
  }

  draw(s: MinimapState): void {
    const ctx = this.ctx;
    const S = this.size * this.dpr;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // --- terrain ---
    ctx.drawImage(this.terrainLayer(s.px, s.pz), 0, 0, this.size, this.size);

    // --- road spine ---
    ctx.strokeStyle = 'rgba(150,146,132,0.9)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < ROAD_PTS.length; i++) {
      const [cx, cy] = this.toScreen(ROAD_PTS[i][0], ROAD_PTS[i][1], s.px, s.pz);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    // center dash
    ctx.strokeStyle = 'rgba(210,205,188,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- POI blips ---
    for (const p of POIS) {
      const [cx, cy] = this.toScreen(p.x, p.z, s.px, s.pz);
      if (cx < -12 || cx > this.size + 12 || cy < -12 || cy > this.size + 12) continue;
      ctx.fillStyle = 'rgba(207,211,216,0.85)';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      ctx.fillStyle = 'rgba(130,135,143,0.75)';
      ctx.font = '600 7px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, cx, cy - 5);
    }

    // --- objective marker ---
    if (s.objective) {
      const [cx, cy] = this.toScreen(s.objective[0], s.objective[1], s.px, s.pz);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      const r = 5 + pulse * 2;
      ctx.fillStyle = 'rgba(232,163,61,0.22)';
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeStyle = '#e8a33d';
      ctx.lineWidth = 2;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      // ring
      ctx.strokeStyle = 'rgba(232,163,61,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 9 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- player heading wedge (center) ---
    const half = this.size / 2;
    const fwdX = -Math.sin(s.yaw), fwdZ = -Math.cos(s.yaw);
    const ang = Math.atan2(fwdZ, fwdX);
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(ang);
    // view cone
    ctx.fillStyle = 'rgba(232,163,61,0.16)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 26, -0.5, 0.5);
    ctx.closePath();
    ctx.fill();
    // nose
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- blackout tint ---
    if (s.blackout) {
      ctx.fillStyle = 'rgba(120,20,12,0.18)';
      ctx.fillRect(0, 0, this.size, this.size);
    }

    // --- frame ---
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, this.size - 1, this.size - 1);
    // north tick
    ctx.fillStyle = 'rgba(232,163,61,0.9)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', half, 10);

    ctx.restore();
  }
}
