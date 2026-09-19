// DEADGRID — core game orchestrator.
// Owns the scene, terrain streaming, player, weapons/viewmodel, enemies,
// POIs, missions, Blackout events, survival stats and the HUD state.

import * as THREE from 'three';
import { WORLD, inPad, onRoad } from './core/world';
import { Renderer } from './renderer';
import { Player } from './player';
import { InputManager } from './input';
import { buildTerrainGeometry, makeWater, terrainMaterial } from './world/terrain';
import { buildScatterGeometry, scatterMaterial } from './world/scatter';
import { COLLISION } from './world/collision';
import { buildRoadPaint, roadPaintMaterial, buildRoadsideProps, RoadLootSpec } from './world/roads';
import { PoiManager, Interactable } from './world/pois';
import { EnemyDirector, EnemyKind } from './enemies/hollow';
import { MissionManager } from './game/missions';
import { BlackoutEvent } from './game/blackout';
import { Minimap } from './game/minimap';
import { Compass } from './game/compass';
import { Viewmodel } from './weapons/viewmodel';
import { WEAPONS, WeaponId, WeaponDef } from './weapons/weapons';
import { makeWorldWeapon } from './weapons/worldWeapon';
import { Particles } from './particles';
import { Decals } from './decals';
import { Drops } from './drops';
import { SFX } from './audio';
import { AssetLib } from './assets/registry';
import { OutpostAssets } from './assets/components';

const CHUNK = WORLD.CHUNK;
const PRELOAD_R = 3;
const DAY_LENGTH = 600;        // seconds per full cycle

export type GamePhase = 'title' | 'paused' | 'playing' | 'dead';
export type ItemId =
  | 'ammo9' | 'ammo12' | 'ammo762' | 'food' | 'bandage' | 'medkit' | 'battery' | 'scrap'
  | 'fuse' | 'fuel' | 'cutters' | 'crowbar' | 'keycard';
export type SlotName = 'primary' | 'secondary' | 'melee';

/** Items that read as TOOLS / MISSION CRITICAL in the HUD + cargo manifest. */
export const TOOL_ITEMS: Record<string, { label: string; note: string }> = {
  fuse: { label: 'FUSE', note: 'Repairs dead generators and switchgear' },
  fuel: { label: 'FUEL CAN', note: 'Refuels generators and machinery' },
  cutters: { label: 'BOLT CUTTERS', note: 'Cuts chains and padlocks' },
  crowbar: { label: 'CROWBAR', note: 'Pries open sealed panels and doors' },
  keycard: { label: 'KEYCARD', note: 'Military-grade security locks' },
};

export interface HudData {
  hp: number;
  stamina: number;
  hunger: number;
  battery: number;
  flashlight: boolean;
  mag: number | null;
  reserve: number | null;
  weaponName: string;
  weaponMode: string | null;
  slotPrimary: WeaponId | null;
  slotSecondary: WeaponId | null;
  selected: SlotName;
  mission: { title: string; objective: string; hint?: string } | null;
  objectiveHint: string | null;
  objectiveDist: number | null;
  objectivePos: [number, number, number] | null;
  objCount: number;
  objNeed: number;
  time: number;
  day: number;
  night: boolean;
  blackoutPhase: string;
  blackoutWave: number;
  prompt: { verb: string; label: string; locked?: boolean; req?: string } | null;
  hitMarker: boolean;
  damageFlash: number;
  damageAngle: number;
  ads: number;
  useProgress: number;
  inv: Record<ItemId, number>;
}

export interface SaveData {
  v: number;
  seed: number;
  day: number;
  time: number;
  hp: number;
  hunger: number;
  battery: number;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  inv: Record<ItemId, number>;
  owned: WeaponId[];
  mags: Partial<Record<WeaponId, number>>;
  slotPrimary: WeaponId | null;
  slotSecondary: WeaponId | null;
  selected: SlotName;
  mission: { m: number; o: number; c: string[] };
  done: string[];
  flags?: { fuseInstalled?: boolean; fuelLoaded?: boolean };
  /** Opening-encounter state so save/Continue preserves coherent mission state. */
  firstEncounter?: { spawned?: boolean; fled?: boolean };
}

export class Game {
  phase: GamePhase = 'title';
  renderer: Renderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  worldSeed = 1;
  player = new Player();
  input = new InputManager();
  pois: PoiManager;
  enemies: EnemyDirector;
  missions = new MissionManager();
  blackout: BlackoutEvent;
  viewmodel = new Viewmodel();
  particles = new Particles();
  decals: Decals;
  drops: Drops;

  time = 0.32;
  day = 1;
  hp = 100;
  hunger = 100;
  battery = 100;
  flashlightOn = false;
  baseFov = 75;
  sensitivity = 1.0;
  viewBob = 1.0;
  viewR = 5;

  inv: Record<ItemId, number> = {
    ammo9: 0, ammo12: 0, ammo762: 0, food: 1, bandage: 1, medkit: 0, battery: 0, scrap: 0,
    fuse: 0, fuel: 0, cutters: 0, crowbar: 0, keycard: 0,
  };
  /** World-state flags that must survive save/load (independent of the inventory). */
  worldFlags = { fuseInstalled: false, fuelLoaded: false };
  owned = new Set<WeaponId>(['knife']);
  mags: Partial<Record<WeaponId, number>> = {};
  slotPrimary: WeaponId | null = null;
  slotSecondary: WeaponId | null = null;
  selected: SlotName = 'melee';

  // weapon runtime
  private fireCd = 0;
  private reloadT = -1;
  private adsT = 0;
  private useT = -1;
  private useKind: 'bandage' | 'medkit' | 'food' | null = null;
  private meleeApplied = false;

  // camera effects
  private recoilPitch = 0;
  private recoilPitchV = 0;
  private recoilYaw = 0;
  private recoilYawV = 0;
  private camShakeAmt = 0;
  private damageFlashT = 0;
  private hitMarkerT = 0;
  private aimDirAngle = 0;
  private nightF = 0;
  private lastInterior = false;
  private underwater = false;

  // world
  private chunks = new Map<string, { terrain: THREE.Mesh; scatter: THREE.Mesh | null }>();
  private water: THREE.Mesh;
  private tracers: { line: THREE.Line; t: number }[] = [];
  private spawnT = 6;

  // hooks
  // UI hooks
  onHud: ((d: HudData) => void) | null = null;
  onDeath: (() => void) | null = null;
  onStory: ((text: string) => void) | null = null;
  onAutosave: (() => void) | null = null;
  onUnderwater: ((u: boolean) => void) | null = null;
  onMissionEvent: ((type: 'start' | 'objective' | 'complete' | 'campaign', title: string, sub: string) => void) | null = null;
  notifyFn: ((text: string, kind?: string) => void) | null = null;

  private lastFrame = performance.now();
  private ray = new THREE.Raycaster();
  private muzzleWorld = new THREE.Vector3();
  private blackoutStarted = false;
  private blackoutCleared = false;
  private radioLights: { main: THREE.Light[]; emerg: THREE.Light[] } = { main: [], emerg: [] };
  private roadSurviveActive = false;
  private firstEncounterSpawned = false;
  private firstEncounterFled = false;
  // The authored opening encounter owns its own completion: only the Hollows
  // spawned for first_contact count toward clearing it. Global aliveCount
  // would let ambient strays (or a cleared field) complete the objective,
  // and would block it if any stray survives elsewhere in the world.
  private firstEncounterEnemies: import('./enemies/hollow').Enemy[] = [];

  private travelAmbushed = false;
  private roadAmbushSpawned = false;
  private evacBeatDone = false;
  private vehicleLoots = 0;
  // authored travel beats — one-shot, distance-gated, survive the frame
  private beatRadio1 = false;
  private beatRadio2 = false;
  private beatRumble = false;
  private beatBunker1 = false;
  private beatBunker2 = false;
  private beatBunker3 = false;
  private beatCorpse = false;
  private beatBarricade = false;
  private nearInteract: Interactable | null = null;
  private roadLoot: RoadLootSpec[] | null = null;

  // navigation UI — minimap + compass (DOM canvases owned by main.ts)
  private minimap: Minimap | null = null;
  private compass: Compass | null = null;
  private navAcc = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.scene = this.renderer.scene;
    this.camera = this.renderer.camera;
    this.camera.add(this.viewmodel.group);
    this.scene.add(this.camera);

    this.water = makeWater();
    this.scene.add(this.water);
    const paint = new THREE.Mesh(buildRoadPaint(), roadPaintMaterial);
    paint.receiveShadow = true;
    this.scene.add(paint);
    this.roadLoot = [];
    this.scene.add(buildRoadsideProps(1, COLLISION, (s) => this.roadLoot!.push(s)));

    this.pois = new PoiManager(this.scene, COLLISION);
    // roadside loot was authored during world build — register it now
    for (const s of this.roadLoot!) this.pois.addStatic(s.id, s.pos, s.verb, s.label, s.items);
    this.decals = new Decals(this.scene);
    this.drops = new Drops(this.scene);
    this.enemies = new EnemyDirector(this.scene);
    this.blackout = new BlackoutEvent(this.enemies);

    this.player.onStep = () => {
      // surface-aware footsteps: asphalt on road, concrete on POI pads, grass elsewhere
      const p = this.player.pos;
      const surface = onRoad(p.x, p.z) ? 'asphalt' : inPad(p.x, p.z) ? 'concrete' : 'grass';
      SFX.step(this.player.sprinting, surface);
    };
    this.player.onLand = (impact) => {
      SFX.land();
      this.camShakeAmt = Math.min(0.6, this.camShakeAmt + Math.min(0.5, impact / 30));
    };
    this.enemies.onHitPlayer = (dmg, from) => this.hurt(dmg, from);
    this.enemies.onGrowl = (dist) => SFX.growl(dist);
    this.enemies.onDrop = (pos) => this.drops.spawnAt(pos);
    this.enemies.onDeath = () => {
      this.camShakeAmt = Math.min(0.4, this.camShakeAmt + 0.05);
      SFX.enemyDeath();
    };

    // --- production asset integration (Phase 9) ---
    // Assets are loaded with correct scaling (docs/ASSET_DIMENSIONS.md),
    // terrain grounding, and component extraction (not full scene dumps).
    this.integrateAssets();
    this.setupMissionHooks();
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------
  newGame(seed: number): void {
    this.worldSeed = seed;
    COLLISION.clear();
    this.pois.seed = seed;
    this.pois.reset();
    this.enemies.clear();
    this.enemies.reseed(seed);
    for (const [key, c] of Array.from(this.chunks.entries())) this.disposeChunk(key, c);
    this.chunks.clear();
    this.time = 0.32;
    this.day = 1;
    this.hp = 100;
    this.hunger = 100;
    this.battery = 100;
    this.flashlightOn = false;
    this.inv = { ammo9: 0, ammo12: 0, ammo762: 0, food: 1, bandage: 1, medkit: 0, battery: 0, scrap: 0, fuse: 0, fuel: 0, cutters: 0, crowbar: 0, keycard: 0 };
    this.worldFlags = { fuseInstalled: false, fuelLoaded: false };
    this.owned = new Set<WeaponId>(['knife']);
    this.mags = {};
    this.slotPrimary = null;
    this.slotSecondary = null;
    this.selected = 'melee';
    this.blackout.abort();
    this.blackoutStarted = false;
    this.blackoutCleared = false;
    void this.blackoutCleared;
    this.roadSurviveActive = false;
    this.firstEncounterSpawned = false;
    this.firstEncounterFled = false;
    this.firstEncounterEnemies = [];
    this.travelAmbushed = false;
    this.roadAmbushSpawned = false;
    this.evacBeatDone = false;
    this.beatRadio1 = false;
    this.beatRadio2 = false;
    this.beatRumble = false;
    this.beatBunker1 = false;
    this.beatBunker2 = false;
    this.beatBunker3 = false;
    this.beatCorpse = false;
    this.beatBarricade = false;
    this.drops.clear();

    for (let dx = -PRELOAD_R; dx <= PRELOAD_R; dx++) {
      for (let dz = -PRELOAD_R; dz <= PRELOAD_R; dz++) this.ensureChunk(dx, dz);
    }
    const sx = 14, sz = 26;
    const gy = WORLD.groundHeight(sx, sz);
    this.player.pos.set(sx + 2.2, gy + 0.6, sz + 1.2);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = 2.7;
    this.player.pitch = 0;
    this.enemies.clear();
    this.pois.update(this.player.pos, makeWorldWeapon);
    this.captureRadioLights();
    this.selectWeapon('melee', true);
    this.missions.reset();
    SFX.setMuted(false);
    SFX.startAmbience();
  }

  startPlaying(seed?: number, save?: SaveData): void {
    if (save) this.applySave(save);
    else this.newGame(seed ?? Math.floor(Math.random() * 999999));
    this.phase = 'playing';
    this.input.attach(this.canvas);
    this.canvas.requestPointerLock();
    SFX.startAmbience();
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    document.exitPointerLock?.();
    SFX.setPaused(true);
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.canvas.requestPointerLock();
    SFX.setPaused(false);
  }

  // -------------------------------------------------------------------------
  // main loop
  // -------------------------------------------------------------------------
  loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.phase === 'playing') this.update(dt);
    this.renderFrame();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    const input = this.input;
    const player = this.player;
    input.beginFrame();

    const [mdx, mdy] = input.consumeMouseDelta();
    const sens = 0.0021 * this.sensitivity;
    player.yaw -= mdx * sens * (1 - this.adsT * 0.45);
    player.pitch -= mdy * sens * (1 - this.adsT * 0.45);
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.45, 1.45);

    player.update(dt, {
      fwd: input.isDown('KeyW') || input.isDown('ArrowUp'),
      back: input.isDown('KeyS') || input.isDown('ArrowDown'),
      left: input.isDown('KeyA') || input.isDown('ArrowLeft'),
      right: input.isDown('KeyD') || input.isDown('ArrowRight'),
      jump: input.isDown('Space'),
      sprint: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      crouch: input.isDown('KeyC') || input.isDown('ControlLeft'),
    });
    player.speedScale = 1 - this.adsT * 0.35;

    // flashlight
    if (input.consumePressed('KeyF')) {
      if (this.battery > 0) { this.flashlightOn = !this.flashlightOn; SFX.click(); }
      else this.notifyFn?.('BATTERY DEAD', 'warn');
    }

    // time
    this.time += dt / DAY_LENGTH;
    if (this.time >= 1) { this.time -= 1; this.day++; }

    // survival
    this.hunger = Math.max(0, this.hunger - dt * (100 / 640));
    if (this.hunger <= 0) this.hurt(dt * 2, this.player.pos, true);
    if (this.hunger > 60 && this.hp < 100) this.hp = Math.min(100, this.hp + dt * 1.0);
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - dt * 1.7);
      if (this.battery <= 0) { this.flashlightOn = false; this.notifyFn?.('BATTERY DEAD', 'warn'); }
    }

    const night = this.isNight();
    this.nightF += ((night ? 1 : 0) - this.nightF) * Math.min(1, dt * 2);

    // interior audio state: cabin + bunker read as enclosed spaces
    const px = this.player.pos.x, pz = this.player.pos.z;
    const indoor = Math.min(Math.hypot(px - 14, pz - 26), Math.hypot(px - 560, pz + 78)) < 7.5;
    if (indoor !== this.lastInterior) {
      this.lastInterior = indoor;
      SFX.setInterior(indoor);
    }

    // consumable use
    if (this.useT >= 0) {
      this.useT -= dt;
      if (this.useT <= 0) this.finishUse();
    }

    // weapon logic
    this.fireCd -= dt;
    if (this.reloadT >= 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    this.handleTriggers();

    // ADS
    const wantAds = input.isDown('Mouse2') && !player.sprinting && this.useT < 0 && this.reloadT < 0;
    this.adsT += ((wantAds ? 1 : 0) - this.adsT) * Math.min(1, dt * 10);

    // enemies + blackout
    this.enemies.setNight(night);
    this.enemies.update(dt, player.pos, { night });
    this.blackout.update(dt);
    this.updateAmbientSpawns(dt, night);
    SFX.setAmbience(this.nightF, this.blackout.active ? 1 : 0);

    // POIs + interaction
    this.pois.update(player.pos, makeWorldWeapon);
    this.nearInteract = this.pois.nearest(player.pos, 2.9);
    if (this.nearInteract && input.consumePressed('KeyE')) this.interact(this.nearInteract);

    // missions
    this.missions.checkProximity(player.pos, this.pois);
    this.updateMissionScripts();

    // weapon slots via keys/wheel
    if (input.consumePressed('Digit1')) this.selectWeapon('primary');
    if (input.consumePressed('Digit2')) this.selectWeapon('secondary');
    if (input.consumePressed('Digit3')) this.selectWeapon('melee');
    if (input.consumePressed('Digit4')) this.startUse('medkit');
    if (input.consumePressed('KeyH')) this.startUse('bandage');
    const wheel = input.consumeWheel();
    if (wheel !== 0) this.cycleWeapon(wheel);

    // camera recoil spring
    this.recoilPitchV += (-this.recoilPitch * 150 - this.recoilPitchV * 15) * dt;
    this.recoilPitch += this.recoilPitchV * dt;
    this.recoilYawV += (-this.recoilYaw * 150 - this.recoilYawV * 15) * dt;
    this.recoilYaw += this.recoilYawV * dt;

    // effects
    this.damageFlashT = Math.max(0, this.damageFlashT - dt * 2.2);
    this.hitMarkerT = Math.max(0, this.hitMarkerT - dt);
    this.camShakeAmt = Math.max(0, this.camShakeAmt - dt * 2.6);

    // particles/tracers/decals/drops
    this.particles.update(dt);
    this.decals.update(dt);
    const picked = this.drops.update(dt, this.player.pos, (kind, n) => {
      if (kind === 'bandage') this.giveItem('bandage', n);
      else this.giveItem(kind, n);
    });
    if (picked.length > 0) {
      SFX.loot();
      this.notifyFn?.('SALVAGE RECOVERED', 'good');
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].t -= dt;
      if (this.tracers[i].t <= 0) {
        this.scene.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    this.streamChunks();

    this.viewmodel.update(dt, {
      moving: player.speed2D > 0.5,
      sprinting: player.sprinting,
      adsT: this.adsT,
      mouseDX: mdx,
      mouseDY: mdy,
      bobPhase: player.bobPhase,
      bobAmp: player.bobAmp * this.viewBob,
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.phase = 'dead';
      document.exitPointerLock?.();
      SFX.die();
      this.onDeath?.();
    }
  }

  private isNight(): boolean {
    return this.time < 0.22 || this.time > 0.78;
  }

  private fogDensity(): number {
    const night = 0.0075 * this.nightF;
    const day = 0.0036 * (1 - this.nightF);
    return day + night + (this.blackout.active ? 0.002 : 0);
  }

  // -------------------------------------------------------------------------
  // rendering
  // -------------------------------------------------------------------------
  private renderFrame(): void {
    const cam = this.camera;
    const p = this.player;
    // title screen: slow cinematic drift at dusk
    if (this.phase === 'title') {
      this.time += 0.00004;
      if (this.time >= 1) this.time -= 1;
      p.yaw += 0.0006;
    }
    const bobY = Math.abs(Math.sin(p.bobPhase)) * 0.05 * p.bobAmp * this.viewBob;
    const bobX = Math.cos(p.bobPhase) * 0.035 * p.bobAmp * this.viewBob;
    const eyeH = p.height - 0.15;
    cam.position.set(
      p.pos.x + Math.cos(p.yaw) * bobX,
      p.pos.y + eyeH + bobY * 0.7 + crouchDip(p.crouching),
      p.pos.z - Math.sin(p.yaw) * bobX,
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.y = p.yaw + this.recoilYaw;
    cam.rotation.x = p.pitch + this.recoilPitch - p.landKick * 0.08;
    cam.rotation.z = Math.sin(p.bobPhase) * 0.006 * p.bobAmp + p.strafeAmt * 0.012;

    if (this.camShakeAmt > 0.001) {
      cam.rotation.x += (Math.random() - 0.5) * 0.02 * this.camShakeAmt;
      cam.rotation.y += (Math.random() - 0.5) * 0.02 * this.camShakeAmt;
    }

    const weapon = this.currentWeaponDef();
    const sprintBoost = p.sprinting && p.speed2D > 4 ? 6 : 0;
    const adsFov = weapon.adsFov ?? this.baseFov - 8;
    const fov = THREE.MathUtils.lerp(this.baseFov + sprintBoost, adsFov, this.adsT);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    this.renderer.updateSky(this.time, this.fogDensity());
    this.water.position.x = cam.position.x;
    this.water.position.z = cam.position.z;
    const wmat = this.water.material as THREE.ShaderMaterial;
    if (wmat.uniforms.uTime) wmat.uniforms.uTime.value = performance.now() * 0.001;
    // underwater: dim to a murky teal instead of rendering the void
    const under = cam.position.y < WORLD.WATER_Y;
    if (under !== this.underwater) {
      this.underwater = under;
      this.onUnderwater?.(under);
    }

    const fl = this.renderer.flashlight;
    if (this.flashlightOn) {
      fl.visible = true;
      fl.intensity = 42 + (this.battery < 20 ? Math.sin(performance.now() * 0.02) * 9 : 0);
      fl.position.copy(cam.position);
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(cam.rotation);
      fl.target.position.copy(cam.position).addScaledVector(dir, 9);
      fl.target.updateMatrixWorld();
    } else fl.visible = false;

    this.pushHud();
    // navigation UI — redraw every other frame (cheap 2D canvas)
    this.navAcc++;
    if (this.navAcc % 2 === 0) this.updateNavUI();
    this.renderer.renderer.render(this.scene, this.camera);
  }

  private hudAcc = 0;
  private pushHud(): void {
    this.hudAcc++;
    if (this.hudAcc % 3 !== 0) return;
    this.onHud?.(this.hudSnapshot());
  }

  // -------------------------------------------------------------------------
  // weapons
  // -------------------------------------------------------------------------
  get currentWeaponId(): WeaponId {
    if (this.selected === 'primary') return this.slotPrimary ?? 'knife';
    if (this.selected === 'secondary') return this.slotSecondary ?? 'knife';
    return 'knife';
  }

  currentWeaponDef(): WeaponDef {
    return WEAPONS[this.currentWeaponId];
  }

  selectWeapon(slot: SlotName, silent = false): void {
    if (slot === 'primary' && !this.slotPrimary) return;
    if (slot === 'secondary' && !this.slotSecondary) return;
    if (this.selected === slot && !silent) return;
    this.selected = slot;
    this.viewmodel.setWeapon(this.currentWeaponId);
    if (!silent) SFX.swap();
    this.onHud?.(this.hudSnapshot());
  }

  cycleWeapon(dir: number): void {
    const order: SlotName[] = [];
    if (this.slotPrimary) order.push('primary');
    if (this.slotSecondary) order.push('secondary');
    order.push('melee');
    const idx = order.indexOf(this.selected);
    const next = order[(idx + (dir > 0 ? 1 : order.length - 1)) % order.length];
    this.selectWeapon(next);
  }

  private handleTriggers(): void {
    const def = this.currentWeaponDef();
    const id = this.currentWeaponId;
    const melee = def.kind === 'melee';

    if (melee) {
      if (this.input.consumePressed('Mouse0') && this.viewmodel.equipDone && !this.viewmodel.isSwinging) {
        if (this.player.stamina >= (def.stamCost ?? 6)) {
          this.player.stamina -= def.stamCost ?? 6;
          this.viewmodel.startSwing(def.meleeDmg! > 40);
          SFX.swing(def.id);
        }
      }
      if (this.viewmodel.meleeHitWindow && !this.meleeApplied) {
        this.meleeApplied = true;
        this.applyMeleeHit();
      }
      if (!this.viewmodel.isSwinging) this.meleeApplied = false;
      return;
    }

    const pressed = this.input.consumePressed('Mouse0');
    const wantFire = def.auto ? this.input.isDown('Mouse0') : pressed;
    if (wantFire && this.fireCd <= 0 && this.reloadT < 0 && this.viewmodel.equipDone
      && this.useT < 0 && !this.viewmodel.isPumping) {
      const mag = this.mags[id] ?? 0;
      if (mag > 0) {
        this.fireGun(id, def);
      } else {
        SFX.dryFire();
        this.fireCd = 0.28;
        if (this.inv[def.ammo!] > 0) this.tryReload();
      }
    }
    if (this.input.consumePressed('KeyR')) this.tryReload();
  }

  tryReload(): void {
    const id = this.currentWeaponId;
    const def = this.currentWeaponDef();
    if (def.kind === 'melee') return;
    const mag = this.mags[id] ?? 0;
    const reserve = this.inv[def.ammo!];
    if (mag >= def.mag! || reserve <= 0 || this.reloadT >= 0) return;
    this.reloadT = def.reloadTime!;
    this.reloadingWeapon = id;
    this.viewmodel.startReload(def.reloadTime!);
    SFX.reloadStart();
  }
  private reloadingWeapon: WeaponId | null = null;

  private finishReload(): void {
    const id = this.reloadingWeapon;
    if (!id) return;
    const def = WEAPONS[id];
    const mag = this.mags[id] ?? 0;
    const take = Math.min(def.mag! - mag, this.inv[def.ammo!]);
    this.inv[def.ammo!] -= take;
    this.mags[id] = mag + take;
    this.reloadingWeapon = null;
    this.reloadT = -1;
    SFX.reloadEnd();
    if (def.pump) {
      this.viewmodel.startPump();
      SFX.pumpRack();
    }
  }

  private fireGun(id: WeaponId, def: WeaponDef): void {
    this.fireCd = 60 / def.rpm!;
    this.mags[id] = (this.mags[id] ?? 0) - 1;
    this.viewmodel.triggerRecoil(def.recoilKick ?? 0.05);
    this.recoilPitchV -= (def.recoilRise ?? 1) * 0.55;
    this.recoilYawV += (Math.random() - 0.5) * 2 * (def.recoilYaw ?? 0.4) * 0.6;
    this.camShakeAmt = Math.min(0.5, this.camShakeAmt + (def.recoilRise ?? 1) * 0.05);
    this.viewmodel.showFlash();
    SFX.gunshot(def.id);
    this.enemies.noise(this.player.pos, 55);
    if (def.pump) this.viewmodel.startPump();

    const spreadDeg = (def.spread! * (1 - this.adsT * 0.72) + 0.22) * (this.player.speed2D > 5 ? 1.35 : 1);
    const pellets = def.pellets ?? 1;
    this.viewmodel.getMuzzleWorld(this.muzzleWorld);
    const camPos = this.camera.position.clone();
    const baseDir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);

    let hitAny = false;
    let killed = false;
    let hitHead = false;
    for (let p = 0; p < pellets; p++) {
      const dir = baseDir.clone();
      if (spreadDeg > 0.01) {
        const a = Math.random() * Math.PI * 2;
        const r = (Math.sqrt(Math.random()) * spreadDeg * Math.PI) / 180;
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();
        dir.applyAxisAngle(right, Math.cos(a) * r);
        dir.applyAxisAngle(up, Math.sin(a) * r);
        dir.normalize();
      }
      const res = this.castBullet(camPos, dir, def.range!, def.damage!, def.headMult ?? 2.5, def.limbMult ?? 0.8, def.knockback ?? 1.6);
      if (res.enemy) { hitAny = true; if (res.head) hitHead = true; if (res.killed) killed = true; }
      if (res.point) {
        if (pellets === 1 || p === 0) this.spawnTracer(this.muzzleWorld, res.point);
        if (!res.enemy) this.particles.emit(res.point, 0xb9b2a4, 5, 2.2, 0.35, 0.45);
      }
    }
    if (hitAny) {
      this.hitMarkerT = 0.18;
      SFX.hitmarker(killed);
      if (hitHead) SFX.headshot();
      if (pellets > 1) this.camShakeAmt = Math.min(0.7, this.camShakeAmt + 0.18);
    }
  }

  private castBullet(origin: THREE.Vector3, dir: THREE.Vector3, range: number, dmg: number, headMult: number, limbMult: number, knockback: number):
    { enemy: boolean; killed: boolean; head: boolean; point: THREE.Vector3 | null } {
    const meshes: THREE.Mesh[] = [];
    for (const e of this.enemies.list) {
      if (e.state === 'dead') continue;
      if (e.pos.distanceTo(origin) > range + 2) continue;
      meshes.push(e.head, e.torso, e.armL, e.armR, e.legL, e.legR);
    }
    this.ray.set(origin, dir);
    this.ray.far = range;
    const hits = this.ray.intersectObjects(meshes, false);
    let enemyT = Infinity;
    let enemyMesh: THREE.Mesh | null = null;
    if (hits.length > 0) {
      enemyT = hits[0].distance;
      enemyMesh = hits[0].object as THREE.Mesh;
    }
    const terrT = marchTerrain(origin, dir, range);
    const boxT = COLLISION.rayHitT(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range);
    const t = Math.min(enemyT, terrT < 0 ? Infinity : terrT, boxT < 0 ? Infinity : boxT);
    if (t === Infinity) return { enemy: false, killed: false, head: false, point: null };
    const point = origin.clone().addScaledVector(dir, t);
    if (enemyMesh && t === enemyT) {
      const dirXZ = new THREE.Vector2(dir.x, dir.z).normalize();
      const isHead = enemyMesh.userData.zone === 'head';
      const killed = this.enemies.hitZone(enemyMesh, dmg, dirXZ.x, dirXZ.y, knockback);
      this.particles.emit(point, 0x5a1210, 10, 2.6, 0.4, 0.7);
      this.decals.splat(point, 0.55);
      return { enemy: true, killed, head: isHead, point };
    }
    this.decals.mark(point, 0.2);
    return { enemy: false, killed: false, head: false, point };
  }

  private applyMeleeHit(): void {
    const def = this.currentWeaponDef();
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    let hit = false;
    let killed = false;
    for (const e of this.enemies.list) {
      if (e.state === 'dead') continue;
      const to = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(origin);
      const dist = to.length();
      if (dist > (def.reach ?? 2.4) + 0.4) continue;
      to.normalize();
      if (to.dot(dir) < 0.62) continue;
      hit = true;
      const k = this.enemies.damage(e, def.meleeDmg ?? 25, dir.x, dir.z, 1, 2.8);
      if (k) killed = true;
      this.particles.emit(e.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 0x5a1210, 8, 2.4, 0.35, 0.6);
      this.decals.splat(e.pos, 0.5);
      break;
    }
    if (hit) {
      SFX.meleeHit();
      this.camShakeAmt = Math.min(0.6, this.camShakeAmt + ((def.meleeDmg ?? 25) > 40 ? 0.3 : 0.2));
      this.hitMarkerT = 0.18;
      SFX.hitmarker(killed);
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, tracerMaterial);
    this.scene.add(line);
    this.tracers.push({ line, t: 0.05 });
  }

  // -------------------------------------------------------------------------
  // interactions + inventory
  // -------------------------------------------------------------------------
  private interact(it: Interactable): void {
    // tool-gated interactions: without the item, the prompt explains why
    if (it.req && (this.inv[it.req as ItemId] ?? 0) <= 0) {
      SFX.dryFire();
      this.notifyFn?.(`REQUIRES ${it.reqLabel ?? it.req.toUpperCase()}`, 'warn');
      return;
    }
    if (it.kind === 'loot') {
      if (it.items) for (const [id, n] of it.items) this.giveItem(id as ItemId, n);
      it.done = true;
      this.pois.markDone(it.id);
      SFX.loot();
      this.notifyFn?.(`${it.label} — LOOTED`, 'good');
      this.notifyKeyItems(it);
      if (it.poiId === 'cabin') this.missions.notify('search_cabin');
      if (it.items?.some(([i]) => i === 'fuse')) this.missions.notify('find_fuse');
      if (it.items?.some(([i]) => i === 'fuel')) this.missions.notify('find_fuel');
      if (it.id.startsWith('veh') || it.id.startsWith('roadwreck')) {
        this.vehicleLoots++;
        this.missions.notify('loot_vehicles');
      }
    } else if (it.kind === 'weapon') {
      const wid = it.weapon as WeaponId;
      this.acquireWeapon(wid);
      if (it.items) for (const [id, n] of it.items) this.giveItem(id as ItemId, n);
      it.done = true;
      this.pois.markDone(it.id);
      this.pois.removeWeaponMesh(it.id);
      SFX.loot();
      this.notifyFn?.(`${WEAPONS[wid].name} ACQUIRED`, 'good');
      this.notifyKeyItems(it);
      if (wid === 'knife') this.missions.notify('take_knife');
      if (it.id === 'cabin_pistol') this.missions.notify('take_pistol');
      this.selectWeapon(WEAPONS[wid].slot, true);
    } else if (it.kind === 'tool') {
      if (it.req) {
        // gated opener (gate/shed/alcove): consume if required, open the world
        if (it.consume) this.inv[it.req as ItemId]--;
        it.done = true;
        this.pois.markDone(it.id);
        SFX.chainSnap();
        this.notifyFn?.(`${it.reqLabel ?? 'TOOL'} USED — ${it.label} OPENED`, 'good');
        if (it.id === 'radio_gate') this.pois.openGate('radio', 'main', 'radio_gate_loot');
        if (it.id === 'sub_shed') this.pois.openGate('suburb', 'shed', 'sub_shed_loot');
        if (it.id === 'bunker_alcove') this.pois.openGate('bunker', 'alcove', 'bunker_alcove_loot');
      } else {
        // tool pickup sitting in the world
        if (it.items) for (const [id, n] of it.items) this.giveItem(id as ItemId, n);
        it.done = true;
        this.pois.markDone(it.id);
        SFX.loot();
        this.notifyKeyItems(it);
        this.notifyFn?.(`${it.label} ACQUIRED`, 'pickup');
      }
    } else if (it.kind === 'story') {
      it.done = true;
      this.pois.markDone(it.id);
      SFX.page();
      this.onStory?.(it.story ?? '');
      if (it.id === 'cabin_radio') {
      this.missions.notify('locate_radio');
      }
      // radio console: coordinate handover gated by campaign stage
      if (it.id === 'radio_console') {
        const mid = this.missions.current?.id;
        if (mid === 'blackout') {
          this.onStory?.((it.story ?? '') + '\n\nCOORDINATES STORED: 54.7°N / GRID SITE 7 — THE BUNKER.');
          this.missions.notify('recover_coordinates');
        } else if (mid === 'signalend') {
          this.missions.notify('final_signal');
        }
      }
      if (it.id === 'bunker_docs') this.missions.notify('recover_dossier');
    } else if (it.kind === 'switch') {
      this.onSwitch(it);
    }
  }

  /** Extra toast for tools/mission items hidden inside a loot bundle. */
  private notifyKeyItems(it: Interactable): void {
    if (!it.items) return;
    for (const [id] of it.items) {
      const tool = TOOL_ITEMS[id];
      if (tool) this.notifyFn?.(`${tool.label} ACQUIRED`, 'pickup');
    }
  }

  hasItem(id: string): boolean { return (this.inv[id as ItemId] ?? 0) > 0; }

  private onSwitch(it: Interactable): void {
    if (it.id === 'radio_gen') {
      // the generator only matters once the relay mission is live — early
      // visits must not advance campaign state
      if (this.missions.current?.id !== 'relay') {
        SFX.dryFire();
        this.notifyFn?.('RADIO SYSTEM OFFLINE — NO REASON TO USE THIS YET', 'info');
        return;
      }
      this.onRadioGenerator();
    } else if (it.id === 'bunker_power') {
      if (this.pois.getLocalPower('bunker')) { this.notifyFn?.('Emergency power is holding.', 'info'); return; }
      if (!this.hasItem('battery')) {
        // tell the player exactly what it needs and where to look — never a
        // dead "REQUIRES BATTERY" with no direction
        SFX.dryFire();
        this.notifyFn?.('POWER CELL EMPTY — NEEDS A CHARGED BATTERY', 'warn');
        this.notifyFn?.('CHECK THE DUTY LOCKER, OR THE RELIEF CACHE AT THE RELAY', 'info');
        return;
      }
      this.inv.battery--;
      SFX.generatorStart();
      this.pois.setLocalPower('bunker', true);
      this.camShakeAmt = Math.min(0.7, this.camShakeAmt + 0.4);
      this.notifyFn?.('EMERGENCY POWER RESTORED — LIGHTS COMING UP', 'good');
      this.missions.notify('bunker_power');
    }
  }

  /**
   * Station generator — a state machine, not a menu. The same switch works at
   * any campaign stage: it reports what's missing, accepts the fuse and fuel
   * when you have them, and starts once both are in. No objective gating, so
   * the player can never be stuck "not knowing what to do next."
   */
  private onRadioGenerator(): void {
    const build = this.pois.activeBuild('radio');
    if (build?.group.userData.genRunning) {
      this.notifyFn?.('The generator hums steadily.', 'info');
      return;
    }
    const hasFuse = this.worldFlags.fuseInstalled;
    const hasFuel = this.worldFlags.fuelLoaded;
    if (!hasFuse && (this.inv.fuse ?? 0) > 0) {
      this.inv.fuse--;
      this.worldFlags.fuseInstalled = true;
      this.pois.markDone('radio_fuse_installed');
      const slot = build?.group.getObjectByName('gen_fuse_slot');
      if (slot) ((slot as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0xffa030);
      SFX.click();
      this.notifyFn?.('FUSE SEATED — HOLDER LIGHTS UP', 'good');
      this.missions.notify('install_fuse');
      return;
    }
    if (hasFuse && !hasFuel && (this.inv.fuel ?? 0) > 0) {
      this.inv.fuel--;
      this.worldFlags.fuelLoaded = true;
      SFX.fuelPour();
      this.notifyFn?.('FUEL TANK FILLED', 'good');
      this.missions.notify('refuel_generator');
      return;
    }
    if (hasFuse && hasFuel) {
      this.startRadioGenerator();
      return;
    }
    // nothing to do yet — tell the player exactly what's missing AND where
    // to find it. The generator is the mission's heart; the feedback must be
    // unmistakable, never a dead "REQUIRES FUSE" with no direction.
    SFX.generatorFailed();
    const missing: string[] = [];
    if (!hasFuse) missing.push('FUSE');
    if (!hasFuel) missing.push('FUEL');
    this.notifyFn?.(`GENERATOR OFFLINE — NEEDS: ${missing.join(' + ')}`, 'warn');
    if (!hasFuse) this.notifyFn?.('FUSE — PARTS SHELF IN THE UTILITY BUILDING, OR ON THE BODY BY THE TOWER', 'info');
    if (!hasFuel) this.notifyFn?.('FUEL — RED DRUMS BY THE GENERATOR', 'info');
    this.missions.notify('inspect_generator');
  }

  /** Start the relay generator: a physical cold-start, not a UI blip.
   *  The engine turns over and catches, the status light flips green, the
   *  facility's dead lights flicker back on, and the camera shudders with
   *  the vibration. The world reacts — the player feels the grid come up. */
  startRadioGenerator(): void {
    const build = this.pois.activeBuild('radio');
    if (build) {
      build.group.userData.genRunning = true;
      const status = build.group.getObjectByName('gen_status_light');
      if (status) {
        const m = (status as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissive.setHex(0x2fff5a);
        m.color.setHex(0x0a2a10);
      }
      // the generator's red warning beacon flips to a steady green — the
      // machine itself is visibly "alive" now, not just the status dot
      const beacon = build.group.getObjectByName('gen_warning_light');
      if (beacon) {
        const m = (beacon as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissive.setHex(0x2fff5a);
        m.color.setHex(0x0a2a10);
      }
      // the facility's main lights flicker back on in a staggered wave —
      // the grid is live again, and the player can watch it happen
      const lights = build.powerLights;
      lights.forEach((l, i) => {
        if (l.userData.base === undefined) return;
        l.intensity = 0;
        setTimeout(() => { l.intensity = l.userData.base ?? 1; }, 180 + i * 120);
      });
      // the tower beacon brightens — the relay is transmitting again
      const towerBeacon = build.group.children.find((n) => (n as THREE.Mesh).material && ((n as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive?.getHex() === 0xff2211);
      if (towerBeacon) {
        const m = (towerBeacon as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 5.0;
      }
    }
    this.pois.markDone('radio_gen_running');
    this.worldFlags.fuseInstalled = true;
    // heavy diesel turn-over, catch, and settle — the physical startup
    SFX.generatorStart();
    // the vibration travels through the ground into the player's feet
    this.camShakeAmt = Math.min(0.8, this.camShakeAmt + 0.55);
    this.notifyFn?.('GENERATOR ONLINE — GRID REACTING', 'good');
    // a short success beat: the world acknowledges the power before the
    // next objective fires. The player feels the grid come up.
    setTimeout(() => {
      this.notifyFn?.('THE TOWER IS TRANSMITTING — LIGHTS ALIVE ACROSS THE FACILITY', 'good');
      SFX.radioBurst();
    }, 1600);
    this.missions.notify('restore_generator');
  }

  acquireWeapon(id: WeaponId): void {
    this.owned.add(id);
    const def = WEAPONS[id];
    if (def.kind === 'melee') return;
    if (def.slot === 'secondary') this.slotSecondary = id;
    else this.slotPrimary = id;
    if (this.mags[id] === undefined) this.mags[id] = def.mag!;
    this.onHud?.(this.hudSnapshot());
  }

  giveItem(id: ItemId, n: number): void {
    if (id === 'battery') { this.battery = Math.min(100, this.battery + 55 * n); return; }
    this.inv[id] = (this.inv[id] ?? 0) + n;
  }
  countItem(id: ItemId): number { return this.inv[id] ?? 0; }

  startUse(kind: 'bandage' | 'medkit' | 'food'): void {
    if (this.useT >= 0) return;
    if ((this.inv[kind] ?? 0) <= 0) { this.notifyFn?.('NOTHING TO USE', 'warn'); return; }
    this.useKind = kind;
    this.useT = kind === 'medkit' ? 3.2 : kind === 'bandage' ? 2.0 : 1.4;
    SFX.useStart(kind);
  }

  private finishUse(): void {
    const k = this.useKind;
    if (!k) return;
    this.inv[k]--;
    if (k === 'food') {
      this.hunger = Math.min(100, this.hunger + 32);
      this.hp = Math.min(100, this.hp + 6);
    } else if (k === 'bandage') this.hp = Math.min(100, this.hp + 25);
    else this.hp = Math.min(100, this.hp + 60);
    this.useKind = null;
    SFX.useDone();
  }

  hurt(amount: number, fromPos: THREE.Vector3, silent = false): void {
    if (this.phase !== 'playing') return;
    this.hp -= amount;
    this.damageFlashT = 1;
    const to = new THREE.Vector2(fromPos.x - this.player.pos.x, fromPos.z - this.player.pos.z);
    this.aimDirAngle = Math.atan2(to.x, to.y) - this.player.yaw;
    this.camShakeAmt = Math.min(0.8, this.camShakeAmt + 0.25);
    if (!silent) SFX.hurt();
  }

  // -------------------------------------------------------------------------
  // ambient enemy pressure
  // -------------------------------------------------------------------------
  private updateAmbientSpawns(dt: number, night: boolean): void {
    // authored encounters own the enemy field — ambient pressure must not
    // dilute them (or let the player "clear" an encounter with strays)
    if (this.missions.objective?.id === 'first_contact' || this.blackout.active) return;
    this.spawnT -= dt;
    const cap = night ? 12 : 6;
    if (this.enemies.aliveCount >= cap) return;
    if (this.spawnT <= 0) {
      this.spawnT = night ? 4 + Math.random() * 4 : 11 + Math.random() * 8;
      const r = Math.random();
      const kinds: EnemyKind[] = night
        ? (r < 0.25 ? ['stalker'] : r < 0.55 ? ['runner'] : ['hollow'])
        : ['hollow'];
      this.enemies.spawnAround(this.player.pos, 1, kinds, 26, 42);
    }
  }

  // -------------------------------------------------------------------------
  // mission scripts
  // -------------------------------------------------------------------------
  private setupMissionHooks(): void {
    this.missions.onMissionStart = (m) => {
      this.notifyFn?.(`MISSION — ${m.title}`, 'info');
      this.onMissionEvent?.('start', m.title, 'NEW MISSION');
      SFX.mission();
    };
    this.missions.onObjective = (o) => {
      this.notifyFn?.(`OBJECTIVE — ${o.text.toUpperCase()}`, 'info');
    };
    this.missions.onMissionComplete = (m) => {
      this.notifyFn?.(`${m.title} — COMPLETE`, 'good');
      this.onMissionEvent?.('complete', m.title, 'MISSION COMPLETE');
      SFX.missionDone();
      this.onAutosave?.();
    };
    this.missions.onCampaignComplete = () => {
      this.notifyFn?.('THE SIGNAL HAS A SOURCE. — CAMPAIGN COMPLETE (v0.2)', 'good');
      this.onMissionEvent?.('campaign', 'THE SIGNAL', 'CAMPAIGN COMPLETE');
      SFX.missionDone();
    };
  }

  private lostTimer = 0;
  private lostReminded = false;

  private updateMissionScripts(): void {
    const obj = this.missions.objective;
    if (!obj) return;
    const px = this.player.pos.x, pz = this.player.pos.z;

    // PLAYER-LOST FALLBACK — if the player has been wandering for too long
    // without making progress, gently reinforce the objective. Not a spam
    // loop: one reminder per 45s of inactivity, then reset on progress.
    const nav = this.missions.navTarget(this.pois);
    if (nav) {
      const d = Math.hypot(px - nav.x, pz - nav.z);
      if (d > 15) {
        this.lostTimer += 1 / 60;
        if (this.lostTimer > 45 && !this.lostReminded) {
          this.lostReminded = true;
          this.notifyFn?.(`OBJECTIVE — ${obj.text.toUpperCase()}`, 'info');
          if (obj.hint) this.notifyFn?.(obj.hint, 'info');
          SFX.radioBurst();
        }
      } else {
        this.lostTimer = 0;
        this.lostReminded = false;
      }
    }

    // FIRST CONTACT: as the player reads the radio, two Hollow drift in from
    // the treeline — the opening minutes end with a real fight, not a menu.
    // They approach from the open side (away from the porch/woodpile cover),
    // so the player can learn to use the cabin's edges.
    // FIRST CONTACT: the encounter is authored around the cabin. It spawns
    // once the objective is live, and only completes when the player is back
    // in the encounter area and the field is clear — running away never
    // advances the campaign, and the HUD tells them where to come back.
    if (obj.id === 'first_contact') {
      const dCabin = Math.hypot(px - 14, pz - 26);
      if (!this.firstEncounterSpawned) {
        this.firstEncounterSpawned = true;
        const side = Math.random() > 0.5 ? 1 : -1;
        const pos = new THREE.Vector3(14 + side * 24, 0, 26 + (Math.random() > 0.5 ? 1 : -1) * 18);
        // Track exactly which enemies belong to this encounter so completion
        // is reliable: clearing the field (or fleeing with them alive) never
        // completes it, and ambient strays elsewhere never block it.
        const before = this.enemies.list.length;
        this.enemies.spawnAround(pos, 2, ['hollow'], 6, 12);
        this.firstEncounterEnemies = this.enemies.list.slice(before);
        this.notifyFn?.('MOVEMENT IN THE TREELINE', 'warn');
        SFX.growl(12);
      } else if (dCabin > 40 && !this.firstEncounterFled) {
        this.firstEncounterFled = true;
        this.notifyFn?.('THEY ARE STILL OUT THERE — RETURN TO THE CABIN TO FINISH IT', 'warn');
        SFX.radioBurst();
      } else if (dCabin <= 40 && this.firstEncounterFled) {
        this.firstEncounterFled = false;
        this.notifyFn?.('THEY ARE WAITING BY THE CABIN', 'warn');
        SFX.growl(10);
      }
      if (this.firstEncounterSpawned && dCabin <= 40 &&
          this.firstEncounterEnemies.every((e) => e.state === 'dead')) {
        this.missions.notify('first_contact');
      }
    }

    // TRAVEL AMBUSH: Hollow shadow the player on the road to the relay.
    // Triggered by distance so it fires even if the player detours.
    // Authored: two Hollow from ahead, one Runner from the flank — the player
    // learns to check both the road and the treeline, and the cover of the
    // roadside props (barrels, wrecks) becomes tactical.
    if (obj.id === 'reach_tower' && !this.travelAmbushed) {
      const distTower = Math.hypot(px - 300, pz - 70);
      if (distTower < 160 && distTower > 70) {
        this.travelAmbushed = true;
        const a = Math.atan2(70 - pz, 300 - px);
        // ahead on the road
        const ahead = new THREE.Vector3(px + Math.cos(a) * 28, 0, pz + Math.sin(a) * 28);
        this.enemies.spawnAround(ahead, 2, ['hollow'], 8, 14);
        // a faster Runner from the flank — forces the player to turn
        const flank = a + Math.PI / 2;
        const flankPos = new THREE.Vector3(px + Math.cos(flank) * 22, 0, pz + Math.sin(flank) * 22);
        this.enemies.spawnAround(flankPos, 1, ['runner'], 6, 10);
        this.notifyFn?.('MOVEMENT AHEAD — AND SOMETHING IN THE TREELINE', 'warn');
      }
    }

    // BLACKOUT: begins automatically when the survive objective is active
    if (obj.id === 'survive_blackout' && this.blackout.phase === 'idle' && !this.blackoutStarted) {
      this.captureRadioLights();
      const a = this.pois.anchor('radio');
      if (this.radioLights.main.length > 0) {
        this.blackoutStarted = true;
        this.blackout.begin(a, this.radioLights.main, this.radioLights.emerg);
        this.pois.setPower(false);
        SFX.blackoutWarning();
        SFX.radioStatic();
        this.notifyFn?.('GRID INSTABILITY DETECTED', 'warn');
        this.blackout.onCleared = () => {
          this.pois.setPower(true);
          this.pois.unlockCache();
          this.notifyFn?.('POWER STABILIZED — RELIEF CACHE UNLOCKED', 'good');
          this.missions.notify('survive_blackout');
          SFX.blackoutCleared();
          // Post-blackout: immediate purpose — the radio console now has
          // coordinates. The player should not sit in a gameplay vacuum; the
          // next objective fires within seconds, with a clear destination.
          setTimeout(() => {
            this.notifyFn?.('RADIO — "…grid site seven… coordinates stored…"', 'info');
            SFX.radioBurst();
          }, 1500);
          setTimeout(() => {
            this.notifyFn?.('NEW OBJECTIVE — RECOVER THE COORDINATES AT THE RADIO CONSOLE', 'good');
            this.notifyFn?.('THE CONSOLE IS IN THE UTILITY BUILDING, WEST SIDE', 'info');
          }, 3200);
        };
        this.blackout.onWaveStart = (w, t) => {
          this.notifyFn?.(`SURGE ${w} OF ${t} — HOSTILES INBOUND`, 'warn');
          SFX.waveStart();
        };
      }
    }
    if (this.blackout.phase === 'cleared') this.blackout.phase = 'idle';

    // road ambush: first time on the road leg, Hollow shadow the player
    if (obj.id === 'loot_vehicles' && !this.roadSurviveActive) {
      this.roadSurviveActive = true;
    }
    if (obj.id === 'road_survive' && !this.roadAmbushSpawned) {
      this.roadAmbushSpawned = true;
      // Authored ambush: a Brute anchors the center, Runners sweep the flanks,
      // Hollows press from the road. The yard's shipping containers and
      // barrels are the player's cover — the encounter is designed around
      // them, not random.
      const center = new THREE.Vector3().lerpVectors(this.player.pos, this.pois.anchor('industrial'), 0.4);
      this.enemies.spawnAround(center, 1, ['brute'], 10, 16);
      const a = Math.atan2(center.z - pz, center.x - px);
      const flankL = new THREE.Vector3(px + Math.cos(a + Math.PI / 2) * 20, 0, pz + Math.sin(a + Math.PI / 2) * 20);
      const flankR = new THREE.Vector3(px + Math.cos(a - Math.PI / 2) * 20, 0, pz + Math.sin(a - Math.PI / 2) * 20);
      this.enemies.spawnAround(flankL, 1, ['runner'], 6, 10);
      this.enemies.spawnAround(flankR, 1, ['runner'], 6, 10);
      this.enemies.spawnAround(center, 2, ['hollow'], 12, 20);
      this.notifyFn?.('AMBUSH — A BRUTE ANCHORS THE YARD, RUNNERS ON BOTH FLANKS', 'warn');
    }
    if (obj.id === 'road_survive' && this.roadAmbushSpawned) {
      if (this.enemies.aliveCount === 0) this.missions.notify('road_survive');
    }

    // ROAD LEG: the evac camp is the authored waypoint between the cabin and
    // the relay — a guaranteed beat on the travel leg, not optional scenery.
    if (obj.id === 'reach_tower' && !this.evacBeatDone) {
      const dEvac = Math.hypot(px - 180, pz - 8);
      if (dEvac < 26) {
        this.evacBeatDone = true;
        this.notifyFn?.('EVACUATION CAMP — SUPPLIES LEFT BEHIND', 'info');
        // a single Hollow stirs in the camp — the camp is not empty
        if (this.enemies.aliveCount < 4) {
          this.enemies.spawnAround(new THREE.Vector3(180, 0, 8), 1, ['hollow'], 10, 18);
        }
      }
    }

    // TRAVEL BEATS — cabin → relay. The leg is ~290m of open ground; without
    // authored moments it reads as empty woods. These fire once, in order,
    // as the player closes on the tower: a radio transmission, a distant
    // movement, then the tower itself coming into view. Each gives the player
    // something to hear, see, or do — never a dead stretch.
    if (obj.id === 'reach_tower') {
      const dTower = Math.hypot(px - 300, pz - 70);
      // 1) a faint voice on the emergency band — the world is not silent
      if (!this.beatRadio1 && dTower < 230) {
        this.beatRadio1 = true;
        SFX.radioBurst();
        this.notifyFn?.('RADIO — “…anyone holding a tower… we can still see you…”', 'info');
      }
      // 2) something large moving in the treeline ahead — tension before the fight
      if (!this.beatRumble && dTower < 150) {
        this.beatRumble = true;
        SFX.distantRumble();
        this.notifyFn?.('SOMETHING MOVES IN THE TREELINE AHEAD', 'warn');
      }
      // 3) the tower resolves out of the haze — the destination is real
      if (!this.beatRadio2 && dTower < 95) {
        this.beatRadio2 = true;
        this.notifyFn?.('THE RELAY TOWER — LIGHTS DEAD, GATE CHAINED', 'info');
      }
      // 4) a body by the roadside — the world has a story, not just geometry
      if (!this.beatCorpse && dTower < 200) {
        this.beatCorpse = true;
        this.notifyFn?.('A BODY BY THE ROAD — HANDS CLUTCHED TO THE CHEST', 'info');
        this.onStory?.('A civilian, slumped against a guardrail. The face is calm — almost peaceful. Scratched into the asphalt beside the hand: "THEY WALK TOWARD THE LIGHT."');
      }
      // 5) a hastily built barricade — someone tried to hold this road
      if (!this.beatBarricade && dTower < 130) {
        this.beatBarricade = true;
        this.notifyFn?.('A BARRICADE ACROSS THE ROAD — WRECKED CARS, SANDBAGS', 'info');
        this.onStory?.('Cars stacked across both lanes, sandbags piled high. Whatever came through here, it did not come quietly. The barricade is broken from the inside.');
      }
    }

    // TRAVEL BEATS — relay → bunker. The coordinates put the bunker ~280m to
    // the north-east, off the road. These beats keep the leg directed and
    // alive: a second transmission, a distant movement, then the berm itself.
    if (obj.id === 'enter_bunker') {
      const dBunker = Math.hypot(px - 560, pz + 78);
      if (!this.beatBunker1 && dBunker < 240) {
        this.beatBunker1 = true;
        SFX.radioBurst();
        this.notifyFn?.('RADIO — “…grid site seven… keep the current on…”', 'info');
      }
      if (!this.beatBunker2 && dBunker < 160) {
        this.beatBunker2 = true;
        SFX.distantRumble();
        this.notifyFn?.('GROUND SHAKES — SOMETHING LARGE, NORTH-EAST', 'warn');
      }
      if (!this.beatBunker3 && dBunker < 100) {
        this.beatBunker3 = true;
        this.notifyFn?.('A CONCRETE BERM RISES OUT OF THE HOLLOW', 'info');
      }
    }
  }

  private captureRadioLights(): void {
    const build = this.pois.activeBuild('radio');
    if (build) this.radioLights = { main: build.powerLights, emerg: build.emergencyLights };
  }

  // -------------------------------------------------------------------------
  // production asset integration (Phase 9)
  // -------------------------------------------------------------------------
  /**
   * Load GLB assets from the runtime library and place them at their
   * campaign locations with correct scaling, grounding, and orientation.
   *
   * Scale corrections are computed in docs/ASSET_DIMENSIONS.md.
   * Assets are loaded asynchronously; on failure the existing primitives
   * remain as the visual fallback.
   *
   * Placement order (Phase 11):
   *   1. Generator — replace primitive visual, keep interaction anchors
   *   2. Radio Tower — tower structure only, base contacts terrain
   *   3. Evac Camp — selected outpost kit components, intentional composition
   *   4. Road Wreck — crashed car, grounded on road
   *   5. Bunker — selected outpost kit components for entrance
   */
  private integrateAssets(): void {
    // Helper: place a component (extracted from a multi-prop GLB)
    const placeComponent = (
      comp: THREE.Group | null,
      x: number, z: number,
      scale = 1.0, ry = 0,
    ): void => {
      if (!comp) return;
      const clone = comp.clone(true);
      clone.scale.setScalar(scale);
      clone.rotation.y = ry;
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      clone.position.x = x - center.x;
      clone.position.z = z - center.z;
      clone.position.y = WORLD.groundHeight(x, z) - box.min.y;
      this.scene.add(clone);
    };

    // ------------------------------------------------------------------
    // 1. GENERATOR — replace primitive visual at radio facility
    //    Scale: 0.026 (46m → 1.2m)
    //    Position: aligned with existing interaction anchor
    //    When the GLB loads, hide the primitive generator to avoid overlap.
    // ------------------------------------------------------------------
    AssetLib.load('generator', 'assets/runtime/industrial/generator.glb').then((scene) => {
      const clone = scene.clone(true);
      clone.scale.setScalar(0.026);
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      clone.position.x = 293 - center.x;
      clone.position.z = 74 - center.z;
      clone.position.y = WORLD.groundHeight(293, 74) - box.min.y;
      clone.rotation.y = Math.PI / 2;
      this.scene.add(clone);
      // Hide the primitive generator visual (keep interaction anchors)
      this.scene.traverse((child) => {
        if (child.name === 'gen_primitive') child.visible = false;
      });
    }).catch(() => { /* fallback: existing primitives remain */ });

    // ------------------------------------------------------------------
    // 2. RADIO TOWER — full scene as a distant landmark
    //    The GLB contains the tower + fence + electric boxes.
    //    Native scale: ~17.6m for the full scene (tower is 4.87m with
    //    baked 0.01 matrix, but the full scene including fence is larger).
    //    Target: keep at native scale (1.0) since it's already ~17.6m.
    //    Position: at the radio facility (x:300, z:70), base contacts terrain
    // ------------------------------------------------------------------
    AssetLib.load('radio_tower', 'assets/runtime/structures/radio_tower.glb').then((scene) => {
      const clone = scene.clone(true);
      clone.scale.setScalar(1.0);
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      if (box.isEmpty()) return; // skip if no geometry
      const center = box.getCenter(new THREE.Vector3());
      // Place at radio facility location
      const tx = 300, tz = 70;
      clone.position.x = tx - center.x;
      clone.position.z = tz - center.z;
      // Ground the tower: sample terrain at the tower's base center
      clone.position.y = WORLD.groundHeight(tx, tz) - box.min.y;
      this.scene.add(clone);
    }).catch(() => { /* fallback: existing tower beacon remains */ });

    // ------------------------------------------------------------------
    // 3. EVAC CAMP — selected outpost kit components, intentional composition
    //    NOT the full 68-mesh scene. Only useful components.
    // ------------------------------------------------------------------
    AssetLib.load('outpost_kit', 'assets/runtime/military/outpost_kit.glb').then(() => {
      // Sandbag wall
      placeComponent(OutpostAssets.sandbagWall(), 176, 4, 1.0, 0);
      // HESCO barrier
      placeComponent(OutpostAssets.hescoLarge(), 180, 8, 1.0, 0.3);
      // Floodlight
      placeComponent(OutpostAssets.floodLight(), 183, 5, 1.0, -Math.PI / 4);
      // Ammo tins
      placeComponent(OutpostAssets.ammoTin556(), 178, 10, 1.0, 0.2);
      placeComponent(OutpostAssets.ammoTin762(), 181, 10, 1.0, -0.3);
      // Camp cot
      placeComponent(OutpostAssets.campCot(), 179, 12, 1.0, 0);
    }).catch(() => { /* fallback: existing camp props remain */ });

    // ------------------------------------------------------------------
    // 4. ROAD WRECK — crashed car, grounded on road
    //    Per-axis scale: X=0.35, Y=0.45, Z=0.616 (8.1m → 5.0m length,
    //    width/height corrected for non-uniform baked scale in the GLB)
    // ------------------------------------------------------------------
    AssetLib.load('crashed_car', 'assets/runtime/vehicles/crashed_car.glb').then((scene) => {
      const clone = scene.clone(true);
      clone.scale.set(0.35, 0.45, 0.616);
      clone.rotation.y = 0.8;
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      clone.position.x = 220 - center.x;
      clone.position.z = 15 - center.z;
      clone.position.y = WORLD.groundHeight(220, 15) - box.min.y;
      this.scene.add(clone);
    }).catch(() => { /* fallback: existing primitives remain */ });

    // ------------------------------------------------------------------
    // 5. BUNKER — selected outpost kit components for entrance
    // ------------------------------------------------------------------
    AssetLib.load('outpost_kit', 'assets/runtime/military/outpost_kit.glb').then(() => {
      // Concrete barriers
      placeComponent(OutpostAssets.concreteBarrierTall(), 553, -70, 1.0, 0);
      placeComponent(OutpostAssets.concreteBarrierWide(), 557, -74, 1.0, Math.PI);
      // HESCO
      placeComponent(OutpostAssets.hescoSmall(), 555, -72, 1.0, 0);
      // Floodlight
      placeComponent(OutpostAssets.floodLight(), 558, -70, 1.0, -Math.PI / 3);
    }).catch(() => { /* fallback: existing bunker geometry remains */ });
  }

  // -------------------------------------------------------------------------
  // chunk streaming
  // -------------------------------------------------------------------------
  private ensureChunk(cx: number, cz: number): void {
    const key = cx + ',' + cz;
    if (this.chunks.has(key)) return;
    const terrain = new THREE.Mesh(buildTerrainGeometry(cx, cz), terrainMaterial);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    const sg = buildScatterGeometry(cx, cz, this.worldSeed);
    let scatter: THREE.Mesh | null = null;
    if (sg) {
      scatter = new THREE.Mesh(sg, scatterMaterial);
      scatter.castShadow = true;
      scatter.receiveShadow = true;
      this.scene.add(scatter);
    }
    this.chunks.set(key, { terrain, scatter });
  }

  private disposeChunk(key: string, c: { terrain: THREE.Mesh; scatter: THREE.Mesh | null }): void {
    this.scene.remove(c.terrain);
    c.terrain.geometry.dispose();
    if (c.scatter) {
      this.scene.remove(c.scatter);
      c.scatter.geometry.dispose();
    }
    this.chunks.delete(key);
  }

  private streamChunks(): void {
    const VIEW_R = this.viewR;
    const pcx = Math.floor(this.player.pos.x / CHUNK);
    const pcz = Math.floor(this.player.pos.z / CHUNK);
    let built = 0;
    for (let r = 0; r <= VIEW_R && built < 2; r++) {
      for (let dx = -r; dx <= r && built < 2; dx++) {
        for (let dz = -r; dz <= r && built < 2; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!this.chunks.has((pcx + dx) + ',' + (pcz + dz))) {
            this.ensureChunk(pcx + dx, pcz + dz);
            built++;
          }
        }
      }
    }
    for (const [key, c] of Array.from(this.chunks.entries())) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > VIEW_R + 1) {
        this.disposeChunk(key, c);
      }
    }
  }

  // -------------------------------------------------------------------------
  // navigation UI (minimap + compass)
  // -------------------------------------------------------------------------
  /** Attach the minimap + compass canvases (created by main.ts). */
  setNavUI(minimap: Minimap, compass: Compass): void {
    this.minimap = minimap;
    this.compass = compass;
  }

  /** Resolve the current navigation target (world x,z) or null.
   *  Waypoint objectives resolve to their POI/pos; non-waypoint objectives
   *  (generator, blackout, etc.) resolve to the nearest relevant site so the
   *  player always has a bearing to follow. */
  private navTarget(): [number, number] | null {
    const t = this.missions.navTarget(this.pois);
    return t ? [t.x, t.z] : null;
  }

  /** Draw the minimap + compass. Called from the render loop. */
  private updateNavUI(): void {
    if (!this.minimap || !this.compass) return;
    const p = this.player.pos;
    const target = this.navTarget();
    let objBearing: number | null = null;
    if (target) {
      objBearing = Math.atan2(target[0] - p.x, target[1] - p.z);
    }
    this.minimap.draw({
      px: p.x, pz: p.z,
      yaw: this.player.yaw,
      objective: target,
      blackout: this.blackout.active,
    });
    this.compass.draw({ yaw: this.player.yaw, objectiveBearing: objBearing });
  }

  // -------------------------------------------------------------------------
  // HUD + save
  // -------------------------------------------------------------------------
  hudSnapshot(): HudData {
    const w = this.currentWeaponDef();
    const id = this.currentWeaponId;
    const obj = this.missions.objective;
    const navT = this.missions.navTarget(this.pois);
    const objectivePos: [number, number, number] | null = navT ? [navT.x, navT.y, navT.z] : null;
    return {
      hp: this.hp,
      stamina: this.player.stamina,
      hunger: this.hunger,
      battery: this.battery,
      flashlight: this.flashlightOn,
      mag: w.kind === 'gun' ? (this.mags[id] ?? 0) : null,
      reserve: w.kind === 'gun' ? this.inv[w.ammo!] : null,
      weaponName: w.name,
      weaponMode: w.kind === 'gun' ? (w.auto ? 'AUTO' : w.pump ? 'PUMP' : null) : null,
      slotPrimary: this.slotPrimary,
      slotSecondary: this.slotSecondary,
      selected: this.selected,
      mission: this.missions.hudText(),
      objectiveHint: this.missions.objective?.hint ?? null,
      objectiveDist: this.objectiveDistance(),
      objectivePos,
      objCount: obj ? this.missions.counterOf(obj.id) : 0,
      objNeed: obj?.needCount ?? 0,
      time: this.time,
      day: this.day,
      night: this.isNight(),
      blackoutPhase: this.blackout.phase,
      blackoutWave: this.blackout.wave,
      prompt: this.nearInteract
        ? {
          verb: this.nearInteract.verb,
          label: this.nearInteract.label,
          locked: !!this.nearInteract.req && !this.hasItem(this.nearInteract.req),
          req: this.nearInteract.reqLabel,
        }
        : null,
      hitMarker: this.hitMarkerT > 0,
      damageFlash: this.damageFlashT,
      damageAngle: this.aimDirAngle,
      ads: this.adsT,
      useProgress: this.useKind && this.useT > 0
        ? 1 - this.useT / (this.useKind === 'medkit' ? 3.2 : this.useKind === 'bandage' ? 2 : 1.4)
        : -1,
      inv: { ...this.inv },
    };
  }

  private objectiveDistance(): number | null {
    const t = this.missions.navTarget(this.pois);
    if (!t) return null;
    return Math.round(this.player.pos.distanceTo(t));
  }

  serialize(): SaveData {
    return {
      v: 3,
      seed: this.worldSeed,
      day: this.day,
      time: this.time,
      hp: this.hp,
      hunger: this.hunger,
      battery: this.battery,
      pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      inv: { ...this.inv },
      owned: Array.from(this.owned),
      mags: { ...this.mags },
      slotPrimary: this.slotPrimary,
      slotSecondary: this.slotSecondary,
      selected: this.selected,
      mission: this.missions.getState(),
      done: this.pois.getDoneIds(),
      flags: { fuseInstalled: this.worldFlags.fuseInstalled, fuelLoaded: this.worldFlags.fuelLoaded },
      firstEncounter: { spawned: this.firstEncounterSpawned, fled: this.firstEncounterFled },
    };
  }

  applySave(s: SaveData): void {
    this.newGame(s.seed);
    this.day = s.day;
    this.time = s.time;
    this.hp = s.hp;
    this.hunger = s.hunger;
    this.battery = s.battery;
    this.player.pos.set(s.pos[0], s.pos[1] + 0.5, s.pos[2]);
    this.player.yaw = s.yaw;
    this.player.pitch = s.pitch;
    this.inv = { ...this.inv, ...s.inv };
    this.owned = new Set(s.owned);
    this.mags = { ...s.mags };
    this.slotPrimary = s.slotPrimary;
    this.slotSecondary = s.slotSecondary;
    this.selected = s.selected;
    this.missions.setState(s.mission);
    this.pois.setDoneIds(s.done);
    this.worldFlags.fuseInstalled = s.flags?.fuseInstalled ?? (this.pois.isDone('radio_gen_running') || this.pois.isDone('radio_fuse_installed'));
    this.worldFlags.fuelLoaded = s.flags?.fuelLoaded ?? this.pois.isDone('radio_gen_running');
    // Restore the opening-encounter state. If the encounter was already
    // cleared before the save, the objective is already past — nothing to do.
    // If it was spawned but not cleared, re-spawn the authored Hollows so the
    // player has a reliable completion path on Continue.
    if (s.firstEncounter?.spawned) {
      this.firstEncounterSpawned = true;
      this.firstEncounterFled = s.firstEncounter.fled ?? false;
      const side = Math.random() > 0.5 ? 1 : -1;
      const pos = new THREE.Vector3(14 + side * 24, 0, 26 + (Math.random() > 0.5 ? 1 : -1) * 18);
      const before = this.enemies.list.length;
      this.enemies.spawnAround(pos, 2, ['hollow'], 6, 12);
      this.firstEncounterEnemies = this.enemies.list.slice(before);
    }
    this.pois.update(this.player.pos, makeWorldWeapon);
    this.selectWeapon(s.selected, true);
  }

  dispose(): void {
    document.exitPointerLock?.();
  }
}

const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.7 });

/** March the ray against the terrain heightfield; returns distance or -1. */
function marchTerrain(origin: THREE.Vector3, dir: THREE.Vector3, range: number): number {
  const step = 0.5;
  let prevDiff = origin.y - WORLD.groundHeight(origin.x, origin.z);
  for (let t = step; t <= range; t += step) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    const diff = y - WORLD.groundHeight(x, z);
    if (diff <= 0) {
      // refine between prev and current
      let lo = t - step, hi = t;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        const d = origin.y + dir.y * mid - WORLD.groundHeight(origin.x + dir.x * mid, origin.z + dir.z * mid);
        if (d > 0) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prevDiff = diff;
    if (dir.y > 0 && prevDiff > 12) return -1;
  }
  return -1;
}

function crouchDip(c: boolean): number { return c ? -0.12 : 0; }