# DEADGRID — Asset Inventory

Source archive: `public/assets/incoming/` (untouched)
Generated: 2026-09-15

> **Local audit record:** the raw source archive described below is intentionally excluded from the public repository. Every GLB actually used by the game remains included under `public/assets/runtime/`. Some preliminary license labels in this historical inventory were superseded by embedded GLB metadata discovered during the release audit.

## Summary

| Category | Count | Total Size |
|----------|-------|------------|
| GLB models (directly usable) | 21 | ~530 MB |
| .blend.zip (source, need conversion) | 12 | ~530 MB |
| EXR HDRIs | 3 | ~203 MB |
| Audio zips | 3 | ~26 MB |
| OBJ zip (survival props) | 1 | 0.4 MB |
| Animation library zip | 1 | 15 MB |
| **Total files** | **41** | **~1.3 GB** |

## GLB Models (Directly Usable by Three.js)

| Filename | Size | Meshes | Materials | Textures | Animations | Category | Purpose | Duplicated? |
|----------|------|--------|-----------|----------|------------|----------|---------|-------------|
| `portable_generator_3d_model.glb` | 3.1 MB | 1 | 1 | 3 | 0 | industrial | Generator site hero asset | Yes (1.5MB variant) |
| `portable_generator_3d_model (1).glb` | 1.5 MB | 1 | 1 | 3 | 0 | industrial | Lower-res generator variant | Yes |
| `radio_communications_tower.glb` | 25.9 MB | 97 | 10 | 24 | 0 | structures | Radio tower landmark | No |
| `military_outpost_kit_1.0_cc0.glb` | 8.2 MB | 68 | 26 | 0 | 0 | military | Evac camp / bunker props | No |
| `crashed_abandoned_car_-_game_ready.glb` | 48.9 MB | 10 | 1 | 3 | 0 | vehicles | Roadside wreck (high-res) | Yes (4.3MB variant) |
| `crashed_abandoned_car_-_game_ready (1).glb` | 4.3 MB | 10 | 1 | 3 | 0 | vehicles | Roadside wreck (low-res) | Yes |
| `zombie_pickup_truck.glb` | 3.7 MB | 3 | 3 | 3 | 0 | vehicles | Roadside wreck | No |
| `aa-12_redesign.glb` | 2.0 MB | 21 | 16 | 0 | 0 | weapons | Shotgun (no textures) | No |
| `m24_bounty_hunter_sniper_rifle.glb` | 3.6 MB | 14 | 8 | 6 | 0 | weapons | Sniper rifle | Yes (2.2MB variant) |
| `m24_bounty_hunter_sniper_rifle (1).glb` | 2.2 MB | 14 | 8 | 6 | 0 | weapons | Sniper rifle (low-res) | Yes |
| `tec-9_modified.glb` | 3.8 MB | 15 | 6 | 6 | 0 | weapons | Pistol | Yes (2.9MB variant) |
| `tec-9_modified (1).glb` | 2.9 MB | 15 | 6 | 6 | 0 | weapons | Pistol (low-res) | Yes |
| `desert_nomad_assassin_-_dark_fantasy.glb` | 126.3 MB | 22 | 1 | 3 | 0 | characters | Fantasy character (too large) | Yes (112MB variant) |
| `desert_nomad_assassin_-_dark_fantasy (1).glb` | 112.0 MB | 22 | 1 | 3 | 0 | characters | Fantasy character (low-res) | Yes |
| `ford_mustang_gt3__www.vecarz.com.glb` | 67.0 MB | 85 | 39 | 42 | 0 | vehicles | Branded car (too large) | Yes (37.9MB variant) |
| `ford_mustang_gt3__www.vecarz.com (1).glb` | 37.9 MB | 85 | 39 | 42 | 0 | vehicles | Branded car (low-res) | Yes |
| `zombie_smoke_mummy_character_12_mb.glb` | 9.7 MB | 1 | 1 | 3 | 0 | characters | Zombie variant | Yes (3 variants) |
| `zombie_smoke_mummy_character_12_mb (1).glb` | 4.9 MB | 1 | 1 | 3 | 0 | characters | Zombie variant (low-res) | Yes |
| `zombie_smoke_mummy_character_12_mb (2).glb` | 10.1 MB | 2 | 2 | 4 | 0 | characters | Zombie variant (2 meshes) | Yes |
| `zombie_smoke_mummy_character_12_mb (3).glb` | 5.0 MB | 2 | 2 | 4 | 0 | characters | Zombie variant (low-res) | Yes |

## .blend.zip Source Assets (Need Blender Conversion)

| Filename | Size | Contents | Textures | Category |
|----------|------|----------|----------|----------|
| `Barrel_01_4k.blend.zip` | 50 MB | Barrel_01_4k.blend | diff, rough, metallic, normal (4K) | props |
| `barrel_03_4k.blend.zip` | 21 MB | barrel_03_4k.blend | diff, rough, metallic, normal (4K) | props |
| `barrel_stove_4k.blend.zip` | 34 MB | barrel_stove_4k.blend | diff, rough, metallic, normal, opacity (4K) | props |
| `concrete_moss_4k.blend.zip` | 62 MB | concrete_moss_4k.blend | diff, rough, normal, displacement (4K) | environment |
| `forest_floor_4k.blend.zip` | 102 MB | forest_floor_4k.blend | diff, rough, normal, displacement (4K) | vegetation |
| `moss_01_4k.blend.zip` | 20 MB | moss_01_4k.blend | diff, rough, normal, alpha (4K) | vegetation |
| `moss_wood_4k.blend.zip` | 68 MB | moss_wood_4k.blend | diff, rough, normal, displacement (4K) | environment |
| `plastic_crate_01_4k.blend.zip` | 34 MB | plastic_crate_01_4k.blend | diff, metallic, normal, rough (4K) | props |
| `plastic_crate_02_4k.blend.zip` | 16 MB | plastic_crate_02_4k.blend | diff, normal, opacity, rough (4K) | props |
| `tree_stump_01_4k.blend.zip` | 53 MB | tree_stump_01_4k.blend | diff, rough, normal (4K) | vegetation |
| `utility_box_01_4k.blend.zip` | 50 MB | utility_box_01_4k.blend | diff, metallic, normal, rough (4K) | industrial |
| `wooden_rough_planks_4k.blend.zip` | 51 MB | wooden_rough_planks_4k.blend | diff, rough, normal, displacement (4K) | environment |

**Note:** Blender is NOT available on this machine. These assets remain as source.
The GLB assets (generator, tower, military outpost, vehicles) are sufficient for the
priority visual replacements. The .blend assets would provide higher-quality textures
for barrels, crates, concrete, moss, forest floor, tree stumps, utility boxes, and
wooden planks — all useful for the generator site, evac camp, bunker, and forest.

## EXR HDRIs

| Filename | Size | Purpose |
|----------|------|---------|
| `dark_autumn_forest_4k.exr` | 88.1 MB | Environmental lighting reference (duplicate) |
| `dark_autumn_forest_4k (1).exr` | 88.1 MB | Environmental lighting reference (duplicate) |
| `misty_pines_4k.exr` | 26.6 MB | Environmental lighting reference |

**Policy:** Do NOT load 88MB EXRs into gameplay. Use as color-grading reference only.
The game's procedural sky system (src/sky.ts) handles runtime lighting.

## Audio

| Filename | Size | Contents | License |
|----------|------|----------|---------|
| `horror_hit_soundpack_1.zip` | 24.7 MB | 55 WAV files (Bassy:11, High:20, Mid:20, Very Bassy:4) | Unknown (BandLab-made, "it's yours") |
| `kenney_impact-sounds.zip` | 0.8 MB | 125 OGG files (footsteps, impacts: metal, wood, glass, plate, punch, soft, tin, mining, bell) | CC0 (Kenney) |
| `kenney_input-prompts_1.5.zip` | 4.9 MB | Keyboard/mouse glyphs (PNG, multiple platforms) | CC0 (Kenney) |

## OBJ Survival Props

`OBJ-20260915T234931Z-1-001.zip` (0.4 MB) — 80+ OBJ/MTL files:
- Weapons: Pistol, Revolver, Shotgun, Knife, FlareGun, Axe
- Survival: Tent, Backpack, FirstAidKit, Bandages, WaterBottle, GasCan, PropaneTank
- Camp: Bonfire, Torch, WoodenTorch, WoodLog, Match, Matchbox
- Misc: Battery, Can, Compass, Phone, Pot, Raft, Shovel, Trashcan, BearTrap

**Note:** OBJ format needs conversion to GLB for Three.js. No textures included (MTL only).

## Animation Library

`Universal Animation Library[Standard].zip` (15 MB)
- UAL1_Standard.glb (7.4 MB) — CC0, by Quaternius
- UAL1_Standard_RM.glb (7.4 MB) — root motion variant
- Contains: idle, walk, run, jump, attack, hit, death, and many more
- **Compatibility:** DEADGRID characters use procedural animation (src/enemies/hollow.ts),
  not skeletal animation. UAL animations would require a rig retargeting system.
  **Decision:** Not integrated in this pass. Documented for future use.

## Duplicates

| Asset | Variants | Recommendation |
|-------|----------|----------------|
| portable_generator | 1.5MB + 3.1MB | Use 1.5MB (runtime), keep 3.1MB (source) |
| crashed_abandoned_car | 4.3MB + 48.9MB | Use 4.3MB (runtime), keep 48.9MB (source) |
| m24_bounty_hunter | 2.2MB + 3.6MB | Use 2.2MB (runtime), keep 3.6MB (source) |
| tec-9_modified | 2.9MB + 3.8MB | Use 2.9MB (runtime), keep 3.8MB (source) |
| desert_nomad_assassin | 112MB + 126MB | Too large for browser — skip |
| ford_mustang_gt3 | 37.9MB + 67MB | Branded vehicle — skip (license) |
| zombie_smoke_mummy | 4 variants (4.9-10.1MB) | Use smallest (4.9MB) if needed |
| dark_autumn_forest_4k | 2 identical 88MB EXRs | Keep one as reference |
