// DEADGRID AssetRegistry — cached GLB loading, shared geometry/material reuse,
// error fallback, and disposal support. Avoids scattering hard-coded
// GLTFLoader paths throughout game.ts.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface AssetEntry {
  id: string;
  path: string;
  category: string;
  loaded: boolean;
  scene: THREE.Group | null;
  error: string | null;
}

export class AssetRegistry {
  private loader = new GLTFLoader();
  private cache = new Map<string, AssetEntry>();
  private pending = new Map<string, Promise<THREE.Group>>();
  private basePath = 'assets/runtime/';

  /** Load a GLB asset by id (from asset-manifest.json). Cached. */
  async load(id: string, path?: string): Promise<THREE.Group> {
    const key = path ?? id;
    const cached = this.cache.get(key);
    if (cached?.loaded && cached.scene) return cached.scene;
    if (this.pending.has(key)) return this.pending.get(key)!;

    const entry: AssetEntry = {
      id,
      path: path ?? `${this.basePath}${id}.glb`,
      category: 'unknown',
      loaded: false,
      scene: null,
      error: null,
    };
    this.cache.set(key, entry);

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        entry.path,
        (gltf) => {
          const scene = gltf.scene;
          // NO auto-normalization — assets are loaded at their native scale.
          // Scale correction is computed per-asset in docs/ASSET_DIMENSIONS.md
          // and applied at placement time. The Asset Lab inspects raw dimensions.
          // Enable shadows
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          entry.loaded = true;
          entry.scene = scene;
          this.pending.delete(key);
          resolve(scene);
        },
        undefined,
        (err) => {
          entry.error = String(err);
          this.pending.delete(key);
          reject(err);
        },
      );
    });

    this.pending.set(key, promise);
    return promise;
  }

  /** Load with a fallback to a procedural placeholder on error. */
  async loadWithFallback(id: string, fallback: () => THREE.Group, path?: string): Promise<THREE.Group> {
    try {
      return await this.load(id, path);
    } catch {
      return fallback();
    }
  }

  /** Get a cached asset by id or path (null if not loaded). */
  get(id: string): THREE.Group | null {
    // Try direct key first (id or path)
    const direct = this.cache.get(id);
    if (direct?.scene) return direct.scene;
    // Fall back: search by entry.id
    for (const entry of this.cache.values()) {
      if (entry.id === id && entry.scene) return entry.scene;
    }
    return null;
  }

  /** Check if an asset is loaded (by id or path). */
  isLoaded(id: string): boolean {
    const direct = this.cache.get(id);
    if (direct?.loaded) return true;
    for (const entry of this.cache.values()) {
      if (entry.id === id && entry.loaded) return true;
    }
    return false;
  }

  /** Dispose a single asset. */
  dispose(id: string): void {
    const entry = this.cache.get(id);
    if (entry?.scene) {
      entry.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material?.dispose();
        }
      });
      entry.scene = null;
      entry.loaded = false;
    }
    this.cache.delete(id);
  }

  /** Dispose all assets. */
  disposeAll(): void {
    for (const id of Array.from(this.cache.keys())) this.dispose(id);
    this.pending.clear();
  }

  /** List all loaded assets. */
  list(): AssetEntry[] {
    return Array.from(this.cache.values());
  }
}

/** Global singleton — one registry for the whole game. */
export const AssetLib = new AssetRegistry();
