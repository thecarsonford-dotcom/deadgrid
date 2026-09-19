import * as THREE from 'three';

// timeOfDay in [0,1): 0 = midnight, 0.5 = noon. Full cycle length in seconds.
const CYCLE = 12 * 60; // 12 min full day/night

const PALETTE = {
  night: {
    top: new THREE.Color(0x05080f), bottom: new THREE.Color(0x0a0f1a),
    fog: new THREE.Color(0x04060a), sunLight: new THREE.Color(0x1a2840),
    skyTint: new THREE.Color(0x0d1320), ground: new THREE.Color(0x05070c),
  },
  dawn: {
    top: new THREE.Color(0x2a2440), bottom: new THREE.Color(0x9a5a34),
    fog: new THREE.Color(0x3a2a24), sunLight: new THREE.Color(0xffb060),
    skyTint: new THREE.Color(0x664060), ground: new THREE.Color(0x2a1a1a),
  },
  day: {
    top: new THREE.Color(0x41679f), bottom: new THREE.Color(0x93b7d8),
    fog: new THREE.Color(0x455968), sunLight: new THREE.Color(0xfff2d0),
    skyTint: new THREE.Color(0x9cc0ff), ground: new THREE.Color(0x3a3a2a),
  },
  dusk: {
    top: new THREE.Color(0x1a1430), bottom: new THREE.Color(0x9a5530),
    fog: new THREE.Color(0x332022), sunLight: new THREE.Color(0xff9050),
    skyTint: new THREE.Color(0x64425e), ground: new THREE.Color(0x33221c),
  },
};

function lerpC(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return a.clone().lerp(b, t);
}

export function isNight(t: number): boolean {
  return t < 0.23 || t > 0.77;
}
export function timeLabel(t: number): string {
  const hours = (t * 24) % 24;
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}


export function dayNightColor(t: number): {
  top: THREE.Color; bottom: THREE.Color; fog: THREE.Color;
  sunLight: THREE.Color; skyTint: THREE.Color; ground: THREE.Color;
} {
  // key points in time
  // 0.0 night, 0.20 dawn, 0.29 day, 0.5 noon, 0.7 day, 0.78 dusk, 0.84 night
  type C = typeof PALETTE.day;
  const stops: [number, C][] = [
    [0.0, PALETTE.night],
    [0.20, PALETTE.night],
    [0.25, PALETTE.dawn],
    [0.31, PALETTE.day],
    [0.5, PALETTE.day],
    [0.65, PALETTE.day],
    [0.76, PALETTE.dusk],
    [0.84, PALETTE.night],
    [1.0, PALETTE.night],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, a] = stops[i];
    const [t1, b] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return {
        top: lerpC(a.top, b.top, f),
        bottom: lerpC(a.bottom, b.bottom, f),
        fog: lerpC(a.fog, b.fog, f),
        sunLight: lerpC(a.sunLight, b.sunLight, f),
        skyTint: lerpC(a.skyTint, b.skyTint, f),
        ground: lerpC(a.ground, b.ground, f),
      };
    }
  }
  return PALETTE.night;
}

export function sunDir(t: number): THREE.Vector3 {
  // sun travels east (right) at dawn to west at dusk; up at noon.
  const ang = (t - 0.25) * 2 * Math.PI; // at t=0.25, ang=0 -> horizon east; at t=0.5, 90deg up
  const y = Math.sin(ang);
  const x = Math.cos(ang);
  return new THREE.Vector3(x, Math.max(y, -0.2) * 0.8 + 0.2 * y, 0.3).normalize();
}

export function moonDir(t: number): THREE.Vector3 {
  // Moon roughly opposite the sun (12h offset), so it rises at dusk.
  const d = sunDir(t);
  return new THREE.Vector3(-d.x, -d.y, -d.z).normalize();
}

export function advanceTime(dt: number): number {
  return (dt / CYCLE) % 1;
}

export function ambientStrength(t: number): number {
  // 1 at day, ~0.15 at night
  if (t < 0.22) return 0.1;
  if (t < 0.32) return 0.1 + (t - 0.22) / 0.1 * 0.9;
  if (t < 0.68) return 1.0;
  if (t < 0.80) return 1.0 - (t - 0.68) / 0.12 * 0.9;
  return 0.1;
}
