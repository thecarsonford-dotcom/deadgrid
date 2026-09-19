// DEADGRID entry point — boots the game, owns all DOM UI: title, HUD,
// pause, settings, inventory, story notes, death screen and save management.

import { Game, HudData, SaveData, TOOL_ITEMS } from './game';
import { SFX } from './audio';
import { WORLD } from './core/world';
import { Minimap } from './game/minimap';
import { Compass } from './game/compass';
import { AssetLib } from './assets/registry';
import * as THREE from 'three';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
(window as unknown as Record<string, unknown>).__deadgrid = game;
(window as unknown as Record<string, unknown>).__dgWorld = WORLD;
(window as unknown as Record<string, unknown>).__assetLib = AssetLib;

// --- navigation UI (minimap + compass) ----------------------------------------
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement | null;
const compassCanvas = document.getElementById('compass') as HTMLCanvasElement | null;
if (minimapCanvas && compassCanvas) {
  const minimap = new Minimap(minimapCanvas);
  const compass = new Compass(compassCanvas);
  game.setNavUI(minimap, compass);
  window.addEventListener('resize', () => { minimap.resize(); compass.resize(); });
}

const $ = (id: string): HTMLElement | null => document.getElementById(id);
const show = (id: string): void => { const el = $(id); if (el) el.classList.remove('hidden'); };
const hide = (id: string): void => { const el = $(id); if (el) el.classList.add('hidden'); };

// --- notifications -----------------------------------------------------------
let lastNotifyText = '';
let lastNotifyAt = 0;
function notify(text: string, kind = 'info'): void {
  const wrap = $('notifications');
  if (!wrap) return;
  // collapse identical repeats fired within a second (loot spam guards)
  const now = performance.now();
  if (text === lastNotifyText && now - lastNotifyAt < 1400) return;
  lastNotifyText = text; lastNotifyAt = now;
  const el = document.createElement('div');
  el.className = `notif ${kind}`;
  el.textContent = text;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, kind === 'pickup' ? 1800 : 2500);
  while (wrap.children.length > 4) wrap.firstChild?.remove();
}
game.notifyFn = (t, k) => notify(t, k ?? 'info');
game.onStory = (text) => {
  const el = $('story-text');
  if (el) el.textContent = text;
  show('story');
  game.pause();
};
$('story-close')?.addEventListener('click', () => {
  hide('story');
  if (game.phase === 'paused') game.resume();
});

// --- mission banner ------------------------------------------------------------
let bannerTimer: number | undefined;
game.onMissionEvent = (type, title, sub) => {
  const banner = $('mission-banner');
  if (!banner) return;
  const t = $('mission-banner-title');
  const s = $('mission-banner-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
  banner.classList.toggle('done', type === 'complete' || type === 'campaign');
  banner.classList.remove('hidden');
  requestAnimationFrame(() => banner.classList.add('show'));
  if (bannerTimer) window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    banner.classList.remove('show');
    window.setTimeout(() => banner.classList.add('hidden'), 400);
  }, 3000);
};

// --- save / load ---------------------------------------------------------------
const SAVE_KEY = 'deadgrid.save.v3';
function writeSave(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
    notify('PROGRESS SAVED', 'good');
  } catch { notify('SAVE FAILED', 'warn'); }
}
function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data.v === 3 ? data : null;
  } catch { return null; }
}
function refreshContinue(): void {
  const btn = $('btn-continue') as HTMLButtonElement | null;
  if (btn) btn.disabled = !readSave();
}
refreshContinue();

// --- title ---------------------------------------------------------------------
$('btn-new')?.addEventListener('click', () => {
  hide('title');
  SFX.ui();
  game.startPlaying();
  show('hud');
  show('center');
});
$('btn-continue')?.addEventListener('click', () => {
  const save = readSave();
  if (!save) return;
  hide('title');
  SFX.ui();
  game.startPlaying(undefined, save);
  show('hud');
  show('center');
});
$('btn-title-settings')?.addEventListener('click', () => show('settings'));
$('set-close')?.addEventListener('click', () => hide('settings'));

// --- pause -----------------------------------------------------------------------
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === null && game.phase === 'playing') {
    game.pause();
    show('pause');
  }
});
$('btn-resume')?.addEventListener('click', () => {
  hide('pause');
  hide('settings');
  game.resume();
});
$('btn-quit')?.addEventListener('click', () => {
  hide('pause');
  hide('hud');
  hide('center');
  show('title');
  game.phase = 'title';
  refreshContinue();
});
$('btn-save')?.addEventListener('click', () => { writeSave(); hide('pause'); game.resume(); });
$('btn-settings')?.addEventListener('click', () => show('settings'));

// death
game.onDeath = () => {
  setTimeout(() => {
    hide('hud');
    hide('center');
    show('death');
  }, 900);
};
$('btn-respawn')?.addEventListener('click', () => {
  const save = readSave();
  hide('death');
  if (save) game.startPlaying(undefined, save);
  else game.startPlaying();
  show('hud');
});
$('btn-death-title')?.addEventListener('click', () => {
  hide('death');
  show('title');
  game.phase = 'title';
  refreshContinue();
});

// --- settings -----------------------------------------------------------------
const SETTINGS_KEY = 'deadgrid.settings.v1';
interface Settings { sens: number; fov: number; bob: number; dist: number; shadow: number; vol: number }
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch { /* fresh */ }
  return { sens: 1, fov: 75, bob: 1, dist: 5, shadow: 2, vol: 0.7 };
}
function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
const settings = loadSettings();
function applySettings(): void {
  game.sensitivity = settings.sens;
  game.baseFov = settings.fov;
  game.viewBob = settings.bob;
  game.viewR = settings.dist;
  game.renderer.setShadowQuality(settings.shadow);
  SFX.setVolume(settings.vol);
}

const setFov = $('set-fov') as HTMLInputElement | null;
if (setFov) {
  setFov.value = String(settings.fov);
  setFov.addEventListener('input', () => {
    settings.fov = parseInt(setFov.value, 10);
    game.baseFov = settings.fov;
    const v = $('val-fov'); if (v) v.textContent = `${setFov.value}°`;
    saveSettings(settings);
  });
}
const setSens = $('set-sens') as HTMLInputElement | null;
if (setSens) {
  setSens.value = String(settings.sens);
  setSens.addEventListener('input', () => {
    settings.sens = parseFloat(setSens.value);
    game.sensitivity = settings.sens;
    const v = $('val-sens'); if (v) v.textContent = setSens.value;
    saveSettings(settings);
  });
}
const setBob = $('set-bob') as HTMLInputElement | null;
if (setBob) {
  setBob.value = String(settings.bob);
  setBob.addEventListener('input', () => {
    settings.bob = parseFloat(setBob.value);
    game.viewBob = settings.bob;
    const v = $('val-bob'); if (v) v.textContent = setBob.value;
    saveSettings(settings);
  });
}
const setDist = $('set-dist') as HTMLInputElement | null;
if (setDist) {
  setDist.value = String(settings.dist);
  setDist.addEventListener('input', () => {
    settings.dist = parseInt(setDist.value, 10);
    game.viewR = settings.dist;
    const v = $('val-dist'); if (v) v.textContent = String(settings.dist);
    saveSettings(settings);
  });
}
const setShadow = $('set-shadow') as HTMLInputElement | null;
if (setShadow) {
  setShadow.value = String(settings.shadow);
  setShadow.addEventListener('input', () => {
    settings.shadow = parseInt(setShadow.value, 10);
    game.renderer.setShadowQuality(settings.shadow);
    const v = $('val-shadow'); if (v) v.textContent = ['OFF', 'LOW', 'HIGH'][settings.shadow] ?? '2';
    saveSettings(settings);
  });
}
const setVol = $('set-vol') as HTMLInputElement | null;
if (setVol) {
  setVol.value = String(settings.vol);
  setVol.addEventListener('input', () => {
    settings.vol = parseFloat(setVol.value);
    SFX.setVolume(settings.vol);
    const v = $('val-vol'); if (v) v.textContent = `${Math.round(parseFloat(setVol.value) * 100)}%`;
    saveSettings(settings);
  });
}
// apply persisted settings on boot + set value labels
applySettings();
{
  const v = $('val-sens'); if (v) v.textContent = String(settings.sens);
  const f = $('val-fov'); if (f) f.textContent = `${settings.fov}°`;
  const b = $('val-bob'); if (b) b.textContent = String(settings.bob);
  const d = $('val-dist'); if (d) d.textContent = String(settings.dist);
  const sh = $('val-shadow'); if (sh) sh.textContent = ['OFF', 'LOW', 'HIGH'][settings.shadow] ?? 'HIGH';
  const vl = $('val-vol'); if (vl) vl.textContent = `${Math.round(settings.vol * 100)}%`;
}

// --- inventory (TAB) -------------------------------------------------------------
let invOpen = false;
document.addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && (game.phase === 'playing' || game.phase === 'paused')) {
    e.preventDefault();
    invOpen = !invOpen;
    if (invOpen) { renderInventory(); show('inventory'); game.pause(); }
    else { hide('inventory'); game.resume(); }
  }
});
$('inv-close')?.addEventListener('click', () => {
  invOpen = false;
  hide('inventory');
  game.resume();
});

const AMMO_LABELS: Record<string, string> = { ammo9: '9MM ROUNDS', ammo12: '12GA SHELLS', ammo762: '7.62 ROUNDS' };
function renderInventory(): void {
  const w = $('inv-weapons');
  const i = $('inv-items');
  if (!w || !i) return;
  w.innerHTML = '';
  i.innerHTML = '';

  const row = (parent: HTMLElement, cls: string, name: string, qty: string, note?: string): void => {
    const r = document.createElement('div');
    r.className = `row ${cls}`;
    const left = document.createElement('div');
    const nameEl = document.createElement('span');
    nameEl.textContent = name;
    left.appendChild(nameEl);
    if (note) {
      const n = document.createElement('div');
      n.className = 'inv-row-note';
      n.textContent = note;
      left.appendChild(n);
    }
    const q = document.createElement('span');
    q.className = 'qty';
    q.textContent = qty;
    r.appendChild(left);
    r.appendChild(q);
    parent.appendChild(r);
  };
  const section = (parent: HTMLElement, title: string): HTMLElement => {
    const sec = document.createElement('div');
    sec.className = 'inv-section';
    const h = document.createElement('div');
    h.className = 'inv-cat';
    h.textContent = title;
    sec.appendChild(h);
    parent.appendChild(sec);
    return sec;
  };

  // LOADOUT
  const secW = section(w, 'LOADOUT');
  if (game.slotPrimary) row(secW, 'equipped', '1 · PRIMARY', WEAPON_NAME(game.slotPrimary));
  else row(secW, 'empty', '1 · PRIMARY', '— empty —');
  if (game.slotSecondary) row(secW, game.slotPrimary ? '' : 'equipped', '2 · SIDEARM', WEAPON_NAME(game.slotSecondary));
  row(secW, '', '3 · MELEE', WEAPON_NAME('knife'));

  // AMMO
  const secA = section(i, 'AMMUNITION');
  for (const [id, label] of Object.entries(AMMO_LABELS)) {
    row(secA, '', label, `×${game.countItem(id as never)}`);
  }
  // MEDICAL + SURVIVAL
  const secM = section(i, 'MEDICAL & SURVIVAL');
  row(secM, '', 'BANDAGES', `×${game.countItem('bandage')}`, 'H — stop the bleeding (+25)');
  row(secM, '', 'MEDKITS', `×${game.countItem('medkit')}`, '4 — field treatment (+60)');
  row(secM, '', 'FOOD RATIONS', `×${game.countItem('food')}`, 'Eat to restore stamina drain');
  row(secM, '', 'BATTERIES', `×${game.countItem('battery')}`, 'Charges the flashlight; powers dead systems');
  row(secM, '', 'SCRAP', `×${game.countItem('scrap')}`, 'Salvage — the useful kind');
  // TOOLS / MISSION
  const secT = section(i, 'TOOLS & MISSION ITEMS');
  let anyTool = false;
  for (const [id, info] of Object.entries(TOOL_ITEMS)) {
    const n = game.countItem(id as never);
    if (n <= 0) continue;
    anyTool = true;
    row(secT, 'tool', info.label, `×${n}`, info.note);
  }
  if (!anyTool) {
    const e = document.createElement('div');
    e.className = 'inv-empty';
    e.textContent = 'No tools yet — facilities and locks will need them.';
    secT.appendChild(e);
  }
}
function WEAPON_NAME(id: string): string { return id ? id.toUpperCase() : '—'; }

// --- HUD -----------------------------------------------------------------------
function timeLabel(t: number): string {
  const h = (t * 24) % 24;
  const hh = String(Math.floor(h)).padStart(2, '0');
  const mm = String(Math.floor((h - Math.floor(h)) * 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

function WEAPON_SLOT_NAME(id: string | null): string { return id ? id.toUpperCase() : '—'; }

game.onHud = (d: HudData): void => {
  if (game.phase !== 'playing') return;
  // vitals
  const hpFill = $('hp-fill');
  if (hpFill) hpFill.style.width = `${Math.max(0, d.hp)}%`;
  const hpNum = $('hp-num');
  if (hpNum) hpNum.textContent = String(Math.max(0, Math.round(d.hp)));
  const stFill = $('stamina-fill');
  if (stFill) stFill.style.width = `${d.stamina}%`;
  const vitalFood = $('vital-food');
  if (vitalFood) vitalFood.classList.toggle('hidden', d.hunger > 45);
  const huFill = $('hunger-fill');
  if (huFill) huFill.style.width = `${d.hunger}%`;
  const vitalBatt = $('vital-batt');
  if (vitalBatt) vitalBatt.classList.toggle('hidden', !d.flashlight && d.battery > 45);
  const baFill = $('battery-fill');
  if (baFill) baFill.style.width = `${d.battery}%`;
  const battLabel = $('batt-label');
  if (battLabel) battLabel.textContent = d.flashlight ? 'BAT ◉' : 'BAT';
  const vitalHp = $('vital-hp');
  if (vitalHp) vitalHp.classList.toggle('low', d.hp < 30);

  // weapon
  const mag = $('ammo-mag');
  const res = $('ammo-reserve');
  const ammoRow = $('ammo-row');
  if (mag && res && ammoRow) {
    if (d.mag === null) { mag.textContent = '—'; res.textContent = '—'; ammoRow.classList.remove('dry'); }
    else {
      mag.textContent = String(d.mag);
      res.textContent = String(d.reserve);
      ammoRow.classList.toggle('dry', d.mag === 0);
    }
  }
  const wname = $('weapon-name');
  if (wname) wname.textContent = d.weaponName;
  const fmode = $('fire-mode');
  if (fmode) {
    if (d.weaponMode) { fmode.textContent = d.weaponMode; fmode.classList.remove('hidden'); }
    else fmode.classList.add('hidden');
  }
  const s1 = $('slot-1-name');
  if (s1) s1.textContent = WEAPON_SLOT_NAME(d.slotPrimary);
  const s2 = $('slot-2-name');
  if (s2) s2.textContent = WEAPON_SLOT_NAME(d.slotSecondary);
  for (const slot of ['slot-1', 'slot-2', 'slot-3']) {
    $(slot)?.classList.toggle('active', slot === `slot-${{ primary: '1', secondary: '2', melee: '3' }[d.selected]}`);
  }

  // mission panel
  const m = d.mission;
  const mtitle = $('mission-title');
  if (mtitle) mtitle.textContent = m ? m.title : '';
  const mobj = $('mission-objective');
  if (mobj) mobj.textContent = m ? m.objective : '';
  const mdist = $('mission-dist');
  if (mdist) {
    if (d.objectiveDist !== null) { mdist.textContent = `${d.objectiveDist}m`; mdist.classList.remove('hidden'); }
    else mdist.classList.add('hidden');
  }
  const mcount = $('mission-count');
  if (mcount) {
    if (d.objNeed > 1) { mcount.textContent = `PROGRESS ${d.objCount} / ${d.objNeed}`; mcount.classList.remove('hidden'); }
    else mcount.classList.add('hidden');
  }
  const mhint = $('mission-hint');
  if (mhint) {
    if (d.objectiveHint) { mhint.textContent = d.objectiveHint; mhint.classList.remove('hidden'); }
    else mhint.classList.add('hidden');
  }
  // objective completion flash: detect objective change handled below via objFlashTimer

  // clock
  const dayEl = $('day-label');
  if (dayEl) dayEl.textContent = `DAY ${d.day}`;
  const timeEl = $('time-label');
  if (timeEl) timeEl.textContent = timeLabel(d.time);
  const phaseEl = $('phase-label');
  if (phaseEl) {
    phaseEl.className = d.blackoutPhase === 'warning' || d.blackoutPhase === 'active' ? 'ph-blackout' : d.night ? 'ph-night' : 'ph-day';
    phaseEl.textContent = d.blackoutPhase === 'warning' || d.blackoutPhase === 'active' ? 'BLACKOUT' : d.night ? 'NIGHT' : 'DAY';
  }

  // prompts
  const prompt = $('interact-prompt');
  if (prompt) {
    if (d.prompt) {
      prompt.classList.remove('hidden');
      prompt.classList.toggle('locked', !!d.prompt.locked);
      const verb = $('interact-verb'); if (verb) verb.textContent = d.prompt.verb;
      const label = $('interact-label'); if (label) label.textContent = d.prompt.label;
      const req = $('interact-req');
      if (req) {
        if (d.prompt.locked && d.prompt.req) { req.textContent = `REQUIRES ${d.prompt.req}`; req.classList.remove('hidden'); }
        else req.classList.add('hidden');
      }
      $('crosshair')?.classList.add('interact');
    } else {
      prompt.classList.add('hidden');
      $('crosshair')?.classList.remove('interact');
    }
  }

  // crosshair ADS
  const ch = $('crosshair');
  if (ch) ch.classList.toggle('ads', d.ads > 0.6);

  // hitmarker
  const hm = $('hitmarker');
  if (hm) hm.classList.toggle('hidden', !d.hitMarker);

  // damage
  const dv = $('damage-vignette');
  if (dv) dv.style.opacity = String(Math.min(1, d.damageFlash * (d.hp < 35 ? 1.4 : 1)));
  const df = $('damage-flash');
  if (df) df.style.opacity = String(Math.max(0, d.damageFlash - 0.65) * 2);
  const arrow = $('damage-dir-arrow');
  if (arrow) {
    arrow.style.transform = `rotate(${d.damageAngle}rad)`;
    arrow.style.opacity = d.damageFlash > 0.05 ? String(Math.min(1, d.damageFlash * 1.6)) : '0';
  }

  // use progress
  const up = $('use-progress');
  if (up) {
    if (d.useProgress >= 0) {
      up.classList.remove('hidden');
      const f = $('use-progress-fill') as HTMLElement | null;
      if (f) f.style.width = `${d.useProgress * 100}%`;
    } else up.classList.add('hidden');
  }

  // blackout
  const bt = $('blackout-tint');
  if (bt) bt.style.opacity = d.blackoutPhase === 'active' ? '1' : '0';
  const banner = $('blackout-banner');
  if (banner) {
    const showing = d.blackoutPhase === 'active';
    banner.classList.toggle('hidden', !showing);
    const wv = $('blackout-wave');
    if (wv) wv.textContent = `SURGE ${Math.max(1, d.blackoutWave)} OF 4`;
  }

  // waypoint marker — project the objective into screen space
  const wp = $('waypoint');
  if (wp) {
    if (d.objectivePos && d.objectiveDist !== null) {
      wp.classList.remove('hidden');
      const cam = game.camera;
      cam.updateMatrixWorld();
      const proj = _wpVec.set(d.objectivePos[0], d.objectivePos[1] + 3.5, d.objectivePos[2]).project(cam);
      const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;
      // Vector3.project flips across the camera plane — z > 0 means behind
      const behind = proj.z > 0;
      const margin = 46;
      const offscreen = behind
        || sx < margin || sx > window.innerWidth - margin
        || sy < 70 || sy > window.innerHeight - 90;
      wp.classList.toggle('offscreen', offscreen);
      if (offscreen) {
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        let dx = sx - cx, dy = sy - cy;
        if (behind) { dx = -dx; dy = -dy; }
        const ang = Math.atan2(dy, dx);
        const rx = Math.cos(ang) * (window.innerWidth * 0.36);
        const ry = Math.sin(ang) * (window.innerHeight * 0.36);
        const arrow = $('waypoint-arrow') as HTMLElement | null;
        if (arrow) arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
        wp.style.left = `${cx + rx}px`;
        wp.style.top = `${cy + ry}px`;
      } else {
        wp.style.left = `${sx}px`;
        wp.style.top = `${sy}px`;
      }
      const dist = $('waypoint-dist');
      if (dist) dist.textContent = `${d.objectiveDist}m`;
    } else {
      wp.classList.add('hidden');
    }
  }
};

const _wpVec = new THREE.Vector3();

// pause shows inventory-hidden state
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && invOpen) {
    invOpen = false;
    hide('inventory');
    show('pause');
  }
});

// --- underwater overlay -----------------------------------------------------------
game.onUnderwater = (u) => {
  const el = $('underwater');
  if (el) el.style.opacity = u ? '1' : '0';
};

// --- objective completion flash ----------------------------------------------------
// wrap the HUD callback: when the objective key changes, flash the mission panel
let lastObjKey = '';
const origOnHud = game.onHud.bind(game);
game.onHud = (d: HudData) => {
  const key = d.mission ? `${d.mission.title}|${d.mission.objective}` : '';
  if (key !== lastObjKey && lastObjKey) {
    const panel = $('mission-panel');
    if (panel) {
      panel.classList.remove('flash');
      void (panel as HTMLElement).offsetWidth;
      panel.classList.add('flash');
    }
    SFX.ui();
  }
  lastObjKey = key;
  origOnHud(d);
};

// --- boot ----------------------------------------------------------------------
game.newGame(1337); // live world behind the title screen
game.phase = 'title';
game.onAutosave = writeSave;
requestAnimationFrame(game.loop);