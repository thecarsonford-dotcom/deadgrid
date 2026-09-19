// DEADGRID COMPASS — a horizontal bearing strip across the top of the view.
// Ticks scroll with the player's yaw; cardinal labels (N/NE/E/SE/S/SW/W/NW)
// and an amber objective chevron show the bearing to the current target.

export interface CompassState {
  yaw: number;                        // player heading (radians)
  objectiveBearing: number | null;    // world bearing to objective (radians) or null
}

const CARDINALS: { deg: number; label: string }[] = [
  { deg: 0, label: 'N' }, { deg: 45, label: 'NE' }, { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' }, { deg: 180, label: 'S' }, { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' }, { deg: 315, label: 'NW' }, { deg: 360, label: 'N' },
];

export class Compass {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 320;   // css px
  private h = 26;
  private dpr = 1;
  private degPerPx = 0.6; // degrees of world per css pixel

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('compass: 2d context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  /** Convert a world bearing (radians) to a compass degree (0=N, 90=E). */
  private toDeg(bearing: number): number {
    // bearing is measured in world space: 0 = +Z (south), 90° = +X (east).
    // Compass: 0 = N (-Z), 90 = E (+X). So compassDeg = 90 - worldDeg.
    const worldDeg = (bearing * 180) / Math.PI;
    return ((90 - worldDeg) % 360 + 360) % 360;
  }

  draw(s: CompassState): void {
    const ctx = this.ctx;
    const W = this.w, H = this.h;
    ctx.clearRect(0, 0, W * this.dpr, H * this.dpr);
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(14,16,20,0.0)');
    grad.addColorStop(0.5, 'rgba(14,16,20,0.72)');
    grad.addColorStop(1, 'rgba(14,16,20,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const centerDeg = this.toDeg(s.yaw);
    const cx = W / 2;

    // --- ticks ---
    const startDeg = centerDeg - (cx / this.degPerPx);
    const endDeg = centerDeg + (cx / this.degPerPx);
    for (let d = Math.floor(startDeg / 5) * 5; d <= endDeg; d += 5) {
      const dd = ((d % 360) + 360) % 360;
      const x = cx + (d - centerDeg) / this.degPerPx;
      const major = dd % 45 === 0;
      const mid = dd % 15 === 0;
      const len = major ? 9 : mid ? 6 : 3;
      ctx.strokeStyle = major ? 'rgba(232,163,61,0.9)' : mid ? 'rgba(207,211,216,0.5)' : 'rgba(207,211,216,0.28)';
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, H - 4);
      ctx.lineTo(x, H - 4 - len);
      ctx.stroke();
    }

    // --- cardinal labels ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const c of CARDINALS) {
      // find the instance of this cardinal nearest to centerDeg
      let deg = c.deg;
      while (deg < centerDeg - 180) deg += 360;
      while (deg > centerDeg + 180) deg -= 360;
      const x = cx + (deg - centerDeg) / this.degPerPx;
      if (x < 8 || x > W - 8) continue;
      ctx.fillStyle = c.label === 'N' ? '#e8a33d' : 'rgba(207,211,216,0.85)';
      ctx.font = c.label === 'N' ? '700 10px Consolas, monospace' : '600 9px Consolas, monospace';
      ctx.fillText(c.label, x, 12);
    }

    // --- center index ---
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.moveTo(cx, H - 2);
    ctx.lineTo(cx - 4, H - 8);
    ctx.lineTo(cx + 4, H - 8);
    ctx.closePath();
    ctx.fill();

    // --- objective chevron ---
    if (s.objectiveBearing !== null) {
      const ob = this.toDeg(s.objectiveBearing);
      let deg = ob;
      while (deg < centerDeg - 180) deg += 360;
      while (deg > centerDeg + 180) deg -= 360;
      const x = cx + (deg - centerDeg) / this.degPerPx;
      if (x > 4 && x < W - 4) {
        ctx.fillStyle = '#e8a33d';
        ctx.beginPath();
        ctx.moveTo(x, 3);
        ctx.lineTo(x - 5, 10);
        ctx.lineTo(x + 5, 10);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
