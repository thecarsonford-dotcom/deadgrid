// DEADGRID audio — fully procedural WebAudio. Weapon cracks, mechanical
// reloads, melee impacts, Hollow vocals with distance attenuation, wind and
// drone ambience, blackout sirens and radio static. No external assets.

class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private ambNodes: AudioNode[] = [];
  private tensionGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private started = false;
  private muted = false;
  volume = 0.7;
  private lastStep = 0;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        this.ambBus = this.ctx.createGain();
        this.ambBus.gain.value = 0.5;
        this.ambBus.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }
  setVolume(v: number): void {
    this.volume = v;
    if (this.master && !this.muted) this.master.gain.value = v;
  }
  setPaused(p: boolean): void {
    if (this.ambBus) this.ambBus.gain.value = p ? 0 : 0.5;
  }

  // --- primitives ------------------------------------------------------------
  private env(g: GainNode, attack: number, decay: number, peak: number, when = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private osc(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.004, when = 0): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, ctx.currentTime + when);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), ctx.currentTime + when + dur);
    o.connect(g); g.connect(this.master!);
    this.env(g, attack, dur, peak, when);
    o.start(ctx.currentTime + when);
    o.stop(ctx.currentTime + when + attack + dur + 0.05);
  }

  private noiseBuf(dur: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noise(dur: number, freq: number, peak: number, opts?: { q?: number; type?: BiquadFilterType; attack?: number; when?: number; bus?: GainNode }): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(dur);
    const filt = ctx.createBiquadFilter();
    filt.type = opts?.type ?? 'lowpass';
    filt.frequency.value = freq;
    filt.Q.value = opts?.q ?? 0.8;
    const g = ctx.createGain();
    src.connect(filt); filt.connect(g); g.connect(opts?.bus ?? this.master!);
    this.env(g, opts?.attack ?? 0.003, dur, peak, opts?.when ?? 0);
    src.start();
  }

  // --- foley -------------------------------------------------------------------
  /** surface: grass | dirt | asphalt | concrete | wood | metal */
  step(sprint: boolean, surface = 'grass'): void {
    const now = performance.now();
    if (now - this.lastStep < (sprint ? 280 : 380)) return;
    this.lastStep = now;
    const v = sprint ? 0.1 : 0.055;
    switch (surface) {
      case 'asphalt':
        this.noise(0.08, 1600, v * 1.1, { type: 'bandpass', q: 0.6 });
        this.noise(0.05, 300, v * 0.5, { when: 0.02 });
        break;
      case 'concrete':
        this.noise(0.07, 2000, v * 1.15, { type: 'bandpass', q: 0.7 });
        this.osc('sine', 130, 70, 0.05, v * 0.5);
        break;
      case 'wood':
        this.noise(0.06, 1200, v, { type: 'bandpass', q: 1.2 });
        this.osc('triangle', 180, 90, 0.06, v * 0.7);
        break;
      case 'metal':
        this.noise(0.06, 3000, v * 0.9, { type: 'bandpass', q: 2 });
        this.osc('square', 700, 400, 0.04, v * 0.4, 0.002, 0.01);
        break;
      case 'dirt':
        this.noise(0.1, 900, v);
        this.noise(0.06, 240, v * 0.6, { when: 0.02 });
        break;
      default: // grass
        this.noise(sprint ? 0.09 : 0.11, sprint ? 1100 : 750, v);
        this.noise(0.05, 240, v * 0.6, { when: 0.02 });
    }
  }

  /** Interior state: damp outdoor wind, slightly lower ambience. */
  setInterior(indoor: boolean): void {
    if (this.ambBus) this.ambBus.gain.value = indoor ? 0.3 : 0.5;
  }

  land(): void {
    this.noise(0.14, 500, 0.2);
    this.osc('sine', 120, 50, 0.12, 0.12);
  }

  hurt(): void {
    this.osc('sawtooth', 340, 90, 0.24, 0.14);
    this.noise(0.16, 700, 0.14);
  }

  die(): void {
    this.osc('sawtooth', 220, 40, 0.9, 0.2, 0.01);
    this.noise(0.8, 400, 0.16, { attack: 0.05 });
  }

  click(): void { this.osc('square', 1800, 1400, 0.03, 0.05); }
  swap(): void {
    this.osc('square', 900, 640, 0.045, 0.05);
    this.noise(0.05, 2000, 0.04, { when: 0.03 });
  }
  ui(): void { this.osc('sine', 660, 880, 0.05, 0.05); }
  page(): void { this.noise(0.1, 2400, 0.06, { type: 'bandpass', q: 1.4 }); }

  dryFire(): void {
    this.osc('square', 1500, 900, 0.035, 0.08);
    this.osc('square', 900, 700, 0.03, 0.05, 0.004, 0.05);
  }

  hitmarker(killed: boolean): void {
    if (killed) {
      this.osc('sine', 520, 780, 0.09, 0.09);
      this.osc('sine', 260, 390, 0.1, 0.07, 0.004, 0.03);
    } else {
      this.osc('sine', 950, 700, 0.05, 0.06);
    }
  }

  /** Distinct headshot confirmation. */
  headshot(): void {
    this.osc('sine', 1300, 500, 0.1, 0.1);
    this.noise(0.08, 1200, 0.1, { when: 0.01 });
  }

  /** Pump-action rack. */
  pumpRack(): void {
    this.noise(0.05, 1800, 0.09, { when: 0 });
    this.osc('square', 400, 700, 0.04, 0.05, 0.003, 0.1);
    this.noise(0.05, 1500, 0.07, { when: 0.16 });
    this.osc('square', 800, 500, 0.04, 0.05, 0.003, 0.2);
  }

  // --- weapons -------------------------------------------------------------------
  gunshot(id: string): void {
    switch (id) {
      case 'pistol':
        this.noise(0.1, 2400, 0.34, { type: 'lowpass' });
        this.osc('triangle', 220, 70, 0.09, 0.2);
        this.noise(0.25, 300, 0.05, { when: 0.03 });
        break;
      case 'shotgun':
        this.noise(0.22, 1300, 0.34);
        this.osc('sine', 140, 40, 0.22, 0.3);
        this.noise(0.4, 220, 0.07, { when: 0.05 });
        break;
      case 'smg':
        this.noise(0.07, 2800, 0.16);
        this.osc('triangle', 260, 90, 0.05, 0.09);
        break;
      case 'rifle':
        this.noise(0.14, 2000, 0.26);
        this.osc('triangle', 180, 55, 0.1, 0.14);
        this.noise(0.35, 260, 0.06, { when: 0.04 });
        break;
      case 'precision':
        this.noise(0.2, 1500, 0.3);
        this.osc('sine', 110, 38, 0.2, 0.2);
        this.noise(0.6, 200, 0.08, { when: 0.06 });
        break;
    }
    // brass tick
    this.osc('square', 3000, 2200, 0.02, 0.02, 0.001, 0.09);
  }

  reloadStart(): void {
    this.osc('square', 700, 500, 0.05, 0.06);
    this.noise(0.08, 1500, 0.05, { when: 0.06 });
    this.osc('square', 500, 800, 0.04, 0.05, 0.003, 0.18);
  }
  reloadEnd(): void {
    this.osc('square', 900, 600, 0.05, 0.07);
    this.noise(0.06, 2000, 0.06, { when: 0.02 });
  }

  swing(id: string): void {
    this.noise(0.12, 2600, 0.05, { type: 'bandpass', q: 0.8, attack: 0.02 });
    if (id === 'hatchet' || id === 'machete') this.osc('sawtooth', 200, 90, 0.1, 0.03);
  }

  meleeHit(): void {
    this.noise(0.09, 900, 0.22);
    this.osc('triangle', 160, 60, 0.09, 0.12);
  }

  // --- enemies -------------------------------------------------------------------
  growl(dist: number): void {
    const vol = Math.max(0.02, 0.5 - dist / 40);
    const f = 70 + Math.random() * 60;
    this.osc('sawtooth', f, f * 0.6, 0.5 + Math.random() * 0.5, vol * 0.12, 0.06);
    this.noise(0.4, 500, vol * 0.06, { attack: 0.08 });
  }

  enemyDeath(): void {
    this.osc('sawtooth', 160, 40, 0.7, 0.1, 0.02);
    this.noise(0.5, 400, 0.08, { attack: 0.05 });
  }

  // --- items / UI ---------------------------------------------------------------
  loot(): void {
    this.osc('sine', 620, 940, 0.09, 0.06);
    this.osc('sine', 940, 1240, 0.07, 0.045, 0.003, 0.07);
  }
  useStart(_kind: string): void { this.noise(0.1, 900, 0.05); }
  useDone(): void {
    this.osc('sine', 620, 880, 0.08, 0.05);
    this.noise(0.06, 1600, 0.04, { when: 0.04 });
  }
  generator(): void {
    this.osc('sawtooth', 55, 62, 1.4, 0.1, 0.12);
    this.noise(1.2, 300, 0.08, { attack: 0.2 });
    this.osc('square', 120, 90, 0.3, 0.05, 0.01, 1.0);
  }
  /**
   * Station generator cold-start: a heavy diesel turn-over that catches,
   * settles, and locks into a steady hum. Feels physical, not a UI blip.
   */
  generatorStart(): void {
    // turn-over: low sawtooth revving up with a rough catch
    this.osc('sawtooth', 38, 74, 0.55, 0.16, 0.05);
    this.noise(0.5, 220, 0.12, { attack: 0.04 });
    // the catch — a sharp thump as the engine fires
    this.osc('sine', 90, 40, 0.18, 0.22, 0.004, 0.5);
    this.noise(0.22, 480, 0.14, { attack: 0.01, when: 0.5 });
    // settle into a steady idle hum
    this.osc('sawtooth', 52, 58, 1.8, 0.09, 0.25, 0.7);
    this.noise(1.6, 300, 0.07, { attack: 0.3, when: 0.7 });
    this.osc('square', 110, 92, 0.4, 0.05, 0.01, 1.1);
    // electrical load engaging — a rising whine as the grid takes current
    this.osc('sine', 180, 420, 0.9, 0.04, 0.3, 1.2);
  }
  /** A distant radio transmission crackling through the static. */
  radioBurst(): void {
    this.noise(0.4, 2600, 0.07, { type: 'highpass', attack: 0.02 });
    this.noise(0.3, 1400, 0.05, { type: 'bandpass', q: 0.5, when: 0.28 });
    this.osc('square', 140, 90, 0.3, 0.03, 0.04, 0.1);
    this.osc('sine', 620, 620, 0.06, 0.03, 0.004, 0.42);
  }
  /** A low, distant rumble — something large moving in the dark. */
  distantRumble(): void {
    this.osc('sine', 42, 30, 1.4, 0.09, 0.4);
    this.noise(1.2, 160, 0.06, { attack: 0.5 });
  }
  /** Generator turns over and dies — wrong fuel, no spark. */
  generatorFailed(): void {
    this.osc('sawtooth', 70, 28, 0.7, 0.09, 0.04);
    this.noise(0.35, 240, 0.06, { attack: 0.03 });
  }
  /** Bolt cutters snapping a chain. */
  chainSnap(): void {
    this.noise(0.06, 3000, 0.12, { type: 'highpass', attack: 0.004 });
    this.osc('square', 1400, 500, 0.09, 0.06, 0.003, 0.03);
    this.noise(0.2, 900, 0.05, { attack: 0.01, when: 0.05 });
  }
  /** Pouring liquid — fuel drums, water. */
  fuelPour(): void {
    this.noise(0.9, 700, 0.06, { type: 'bandpass', q: 0.6, attack: 0.1 });
    this.osc('sine', 240, 300, 0.5, 0.02, 0.1);
  }
  mission(): void {
    this.osc('sine', 440, 440, 0.1, 0.05);
    this.osc('sine', 660, 660, 0.12, 0.05, 0.004, 0.1);
  }
  missionDone(): void {
    this.osc('sine', 520, 520, 0.1, 0.06);
    this.osc('sine', 660, 660, 0.1, 0.06, 0.004, 0.1);
    this.osc('sine', 880, 880, 0.14, 0.06, 0.004, 0.2);
  }

  blackoutWarning(): void {
    // descending siren
    this.osc('sawtooth', 520, 180, 1.6, 0.1, 0.02);
    this.osc('sawtooth', 524, 184, 1.6, 0.08, 0.02, 0.15);
    this.noise(1.4, 240, 0.05, { attack: 0.3 });
  }
  /** Harsh radio static burst — grid failure handshakes. */
  radioStatic(): void {
    this.noise(0.5, 3200, 0.09, { type: 'highpass', attack: 0.02 });
    this.noise(0.35, 1600, 0.06, { type: 'bandpass', q: 0.4, when: 0.3 });
    this.osc('square', 90, 60, 0.5, 0.04, 0.05, 0.1);
  }
  waveStart(): void {
    this.osc('sawtooth', 110, 60, 0.9, 0.1, 0.03);
    this.noise(0.8, 350, 0.07, { attack: 0.12 });
    // distant Hollow chorus answering the surge
    this.noise(1.2, 500, 0.05, { attack: 0.4, when: 0.3 });
  }
  blackoutCleared(): void {
    this.osc('sine', 420, 640, 0.4, 0.07, 0.05);
    this.osc('sine', 640, 960, 0.5, 0.05, 0.05, 0.25);
    // generator stabilization
    this.osc('sawtooth', 50, 58, 1.6, 0.06, 0.3, 0.4);
  }

  // --- ambience -------------------------------------------------------------------
  startAmbience(): void {
    if (this.started) return;
    const ctx = this.ensure();
    if (!ctx || this.muted) { this.started = true; return; }
    this.started = true;

    // wind: filtered noise with slow LFO
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(4);
    src.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.frequency.value = 0.07;
    lfo.type = 'sine';
    lfo.connect(lfoGain); lfoGain.connect(windFilter.frequency);
    src.connect(windFilter); windFilter.connect(windGain); windGain.connect(this.ambBus!);
    src.start(); lfo.start();
    this.windFilter = windFilter;

    // exploration drone: two detuned sines
    const d1 = ctx.createOscillator();
    const d2 = ctx.createOscillator();
    d1.type = 'sine'; d2.type = 'sine';
    d1.frequency.value = 54; d2.frequency.value = 54.7;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.016;
    d1.connect(droneGain); d2.connect(droneGain);
    droneGain.connect(this.ambBus!);
    d1.start(); d2.start();

    // tension layer (blackout / combat): pulsing saw
    const t1 = ctx.createOscillator();
    t1.type = 'sawtooth';
    t1.frequency.value = 41;
    const tf = ctx.createBiquadFilter();
    tf.type = 'lowpass';
    tf.frequency.value = 260;
    const tensionGain = ctx.createGain();
    tensionGain.gain.value = 0;
    const pulse = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    pulse.frequency.value = 1.7;
    pulseGain.gain.value = 0.35;
    pulse.connect(pulseGain); pulseGain.connect(tensionGain.gain);
    t1.connect(tf); tf.connect(tensionGain); tensionGain.connect(this.ambBus!);
    t1.start(); pulse.start();
    this.tensionGain = tensionGain;
    this.ambNodes = [src, lfo, d1, d2, t1, pulse];
  }

  /** 0..1 night factor, 0..1 blackout factor */
  setAmbience(night: number, blackout: number): void {
    if (this.windFilter) this.windFilter.frequency.value = 320 + Math.sin(performance.now() * 0.0001) * 120;
    if (this.tensionGain) {
      const target = 0.008 + night * 0.012 + blackout * 0.05;
      this.tensionGain.gain.value += (target - this.tensionGain.gain.value) * 0.02;
    }
  }

  stopAmbience(): void {
    for (const n of this.ambNodes) {
      const s = n as { stop?: () => void };
      try { s.stop?.(); } catch { /* already stopped */ }
    }
    this.ambNodes = [];
    this.started = false;
  }
}

export const SFX = new AudioEngine();