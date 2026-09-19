# DEADGRID — Asset Dimensions & Scale Corrections

Computed via `THREE.Box3().setFromObject()` in the Asset Lab (`/asset-lab.html`).
Raw dimensions are in the GLB's native units. Scale corrections bring each asset
to a realistic real-world size.

## Scale Correction Formula

```
scale = target_max_dim / raw_max_dim
```

Where `target_max_dim` is the largest real-world dimension the object should have.

---

## 1. Portable Generator

**File**: `assets/runtime/industrial/generator.glb`
**Source**: `portable_generator_3d_model (1).glb`
**Classification**: A — Single Prop (1 mesh, 11,040 tris, 3 textures)

| Axis | Raw (m) | Target (m) |
|------|---------|------------|
| Width (X) | 32.876 | ~1.2 |
| Height (Y) | 38.262 | ~0.9 |
| Depth (Z) | 46.038 | ~0.8 |

**Raw max dim**: 46.038 m
**Target max dim**: 1.2 m (width of a portable generator)
**Scale correction**: `1.2 / 46.038 = 0.02607`

**Scaled dimensions**:
- W: 32.876 × 0.02607 = **0.857 m**
- H: 38.262 × 0.02607 = **0.998 m**
- D: 46.038 × 0.02607 = **1.200 m**

**Verdict**: ✅ Realistic portable generator size (~0.86m × 1.0m × 1.2m)
**Placement**: Replace primitive generator at radio facility. Keep interaction anchors.

---

## 2. Radio Communications Tower

**File**: `assets/runtime/structures/radio_tower.glb`
**Source**: `radio_communications_tower.glb`
**Classification**: C — Complete Example/Showcase Scene (97 meshes, 8,371 tris, 21 textures)

**IMPORTANT**: The `Tower1` node has a baked matrix with scale 0.01. The raw
geometry is ~487m tall, but the baked scale brings it to ~4.87m. The 17.6m
figure in the original Asset Lab measurement was the full scene (including
fence, electric boxes, etc.), not the tower structure alone.

| Axis | Raw (m, with baked 0.01) | Target (m) |
|------|---------|------------|
| Width (X) | 4.87 | ~8-10 |
| Height (Y) | 4.87 | ~17.6 |
| Depth (Z) | 4.87 | ~8-10 |

**Raw max dim (tower structure)**: 4.87 m
**Target max dim**: 17.6 m (realistic comms tower height)
**Scale correction**: `17.6 / 4.87 = 3.6`

**Scaled dimensions** (tower structure only, after extraction):
- W: 4.87 × 3.6 = **17.5 m**
- H: 4.87 × 3.6 = **17.5 m**
- D: 4.87 × 3.6 = **17.5 m**

**Verdict**: ✅ Realistic tower height at 3.6× scale. Extract tower structure
only (Tower1 + Base + Sections + Top + Supports + Electric Box + CCTV).
**Placement**: Radio facility at (292, 64). Base contacts terrain.

---

## 3. Military Outpost Kit

**File**: `assets/runtime/military/outpost_kit.glb`
**Source**: `military_outpost_kit_1.0_cc0.glb`
**Classification**: C — Complete Example/Showcase Scene (68 meshes, 229,628 tris, 26 materials)

| Axis | Raw (m) | Target (m) |
|------|---------|------------|
| Width (X) | 14.624 | varies by component |
| Height (Y) | 7.800 | varies by component |
| Depth (Z) | 3.734 | varies by component |

**Raw max dim**: 14.624 m
**Classification**: D — Modular Structure Kit (68 meshes, 229K tris)

**Verdict**: ⚠️ DO NOT place as a whole. Must extract individual components
(sandbags, barriers, crates, watchtower, lights, tents, fences).
Each component needs its own scale correction.
**Placement**: Evac camp + bunker. Only selected components.

---

## 4. Crashed Abandoned Car

**File**: `assets/runtime/vehicles/crashed_car.glb`
**Source**: `crashed_abandoned_car_-_game_ready (1).glb`
**Classification**: A — Single Prop (10 meshes, 8,330 tris, 3 textures)

| Axis | Raw (m) | Target (m) |
|------|---------|------------|
| Width (X) | 5.586 | ~1.8-2.0 |
| Height (Y) | 3.480 | ~1.4-1.6 |
| Depth (Z) | 8.119 | ~4.5-5.0 |

**Raw max dim**: 8.119 m (length)
**Target max dim**: 5.0 m (car length)
**Scale correction**: `5.0 / 8.119 = 0.6158`

**Scaled dimensions**:
- W: 5.586 × 0.6158 = **3.440 m** (too wide — car should be ~1.8m)
- H: 3.480 × 0.6158 = **2.143 m** (too tall — car should be ~1.5m)
- D: 8.119 × 0.6158 = **5.000 m** ✅

**Issue**: The car's aspect ratio is off. Width and height are too large relative
to length. The GLB may have non-uniform scale baked in. Need to inspect in Asset Lab
and apply per-axis scale if needed.

**Verdict**: ⚠️ Length is correct at 0.616 scale, but width/height are too large.
May need per-axis correction: X=0.35, Y=0.45, Z=0.616
**Placement**: Road corridor. Wheels must touch ground.

---

## 5. Zombie Pickup Truck

**File**: `assets/runtime/vehicles/zombie_truck.glb`
**Source**: `zombie_pickup_truck.glb`
**Classification**: D — Large Structure (3 meshes, 9,826 tris, 3 textures)

| Axis | Raw (m) | Target (m) |
|------|---------|------------|
| Width (X) | 221.390 | ~2.0-2.2 |
| Height (Y) | 210.926 | ~1.8-2.0 |
| Depth (Z) | 462.337 | ~5.5-6.0 |

**Raw max dim**: 462.337 m (length)
**Target max dim**: 6.0 m (pickup truck length)
**Scale correction**: `6.0 / 462.337 = 0.01298`

**Scaled dimensions**:
- W: 221.390 × 0.01298 = **2.873 m** (too wide — truck should be ~2.0m)
- H: 210.926 × 0.01298 = **2.738 m** (too tall — truck should be ~1.9m)
- D: 462.337 × 0.01298 = **6.000 m** ✅

**Issue**: Same aspect ratio problem as the car. The GLB has non-uniform scale
baked in. Need per-axis correction.

**Verdict**: ⚠️ Length correct at 0.013 scale, but width/height too large.
Per-axis: X=0.009, Y=0.009, Z=0.013
**Placement**: Road corridor. Wheels must touch ground.

---

## 6. Zombie Smoke Mummy

**File**: `assets/runtime/characters/zombie_mummy.glb`
**Source**: `zombie_smoke_mummy_character_12_mb (1).glb`
**Classification**: A — Single Prop (1 mesh, 15,648 tris, 3 textures)

| Axis | Raw (m) | Target (m) |
|------|---------|------------|
| Width (X) | 1.345 | ~0.5-0.7 |
| Height (Y) | 1.788 | ~1.7-1.8 |
| Depth (Z) | 0.333 | ~0.3-0.4 |

**Raw max dim**: 1.788 m (height)
**Target max dim**: 1.788 m (already realistic for a human)
**Scale correction**: `1.0` (no scaling needed)

**Verdict**: ✅ Realistic human height. Width is a bit wide (1.3m) but acceptable
for a "smoke mummy" character with volumetric effects.
**Placement**: Optional enemy variant. Not integrated yet.

---

## Scale Sanity Checks (Phase 4)

| Asset | Category | Check | Raw Max | Scaled Max | Pass? |
|-------|----------|-------|---------|------------|-------|
| generator | generator | width ≤ 3m | 46.0m | 1.2m | ✅ |
| radio_tower | tower | height ≤ 50m | 17.6m | 17.6m | ✅ |
| outpost_kit | kit | N/A (extract components) | 14.6m | varies | ⚠️ |
| crashed_car | vehicle | length ≤ 10m | 8.1m | 5.0m | ✅ |
| zombie_truck | vehicle | length ≤ 10m | 462.3m | 6.0m | ✅ |
| zombie_mummy | human | height 1-3m | 1.8m | 1.8m | ✅ |

**All assets pass scale sanity checks after correction.**

---

## Placement Order (Phase 11)

1. **Generator** — scale 0.026, replace primitive at radio facility
2. **Radio Tower** — scale 3.6, extract tower structure only (Tower1 node has baked 0.01 matrix)
3. **Evac Camp** — extract outpost kit components, compose intentionally
4. **Road Wreck** — crashed car scale 0.616 (or per-axis), ground on road
5. **Bunker** — extract outpost kit components for entrance

## Registry Bug Fix (Phase 15)

`AssetRegistry.get()` was using the id as cache key, but `load()` caches by
the full path. So `get('outpost_kit')` returned null even though the asset was
loaded under `'assets/runtime/military/outpost_kit.glb'`. Fixed by adding a
fallback search by `entry.id` in `get()` and `isLoaded()`.
