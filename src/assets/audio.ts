// DEADGRID AudioAssets — categorized audio pools for impacts, horror stingers,
// and footsteps. Loads from the runtime library, caches decoded buffers,
// and provides pool-based playback to avoid GC pressure.

export interface AudioPool {
  id: string;
  buffers: AudioBuffer[];
  nextIndex: number;
}

export class AudioAssets {
  private ctx: AudioContext | null = null;
  private pools = new Map<string, AudioPool>();
  private pending = new Map<string, Promise<AudioPool>>();
  private basePath = 'assets/runtime/audio/';

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Load a pool of audio files (e.g. impactMetal_heavy_000..004.ogg). */
  async loadPool(id: string, files: string[]): Promise<AudioPool> {
    const cached = this.pools.get(id);
    if (cached) return cached;
    if (this.pending.has(id)) return this.pending.get(id)!;

    const ctx = this.ensureCtx();
    if (!ctx) throw new Error('No AudioContext');

    const promise = (async (): Promise<AudioPool> => {
      const buffers: AudioBuffer[] = [];
      for (const file of files) {
        try {
          const resp = await fetch(this.basePath + file);
          const arr = await resp.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          buffers.push(buf);
        } catch { /* skip failed files */ }
      }
      const pool: AudioPool = { id, buffers, nextIndex: 0 };
      this.pools.set(id, pool);
      this.pending.delete(id);
      return pool;
    })();

    this.pending.set(id, promise);
    return promise;
  }

  /** Play a random buffer from a pool. Returns the source node. */
  play(id: string, volume = 1.0, rate = 1.0): AudioBufferSourceNode | null {
    const pool = this.pools.get(id);
    if (!pool || pool.buffers.length === 0) return null;
    const ctx = this.ensureCtx();
    if (!ctx) return null;

    const buf = pool.buffers[pool.nextIndex % pool.buffers.length];
    pool.nextIndex++;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return src;
  }

  /** Check if a pool is loaded. */
  isLoaded(id: string): boolean {
    return this.pools.has(id);
  }

  /** List all loaded pools. */
  list(): string[] {
    return Array.from(this.pools.keys());
  }
}

/** Global singleton. */
export const AudioLib = new AudioAssets();
