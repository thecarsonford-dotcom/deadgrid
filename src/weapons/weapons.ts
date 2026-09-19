// DEADGRID weapon roster — a compact, distinctly-feeling set. Generic
// identities, no real-world branding.

export type WeaponId = 'knife' | 'machete' | 'hatchet' | 'pistol' | 'shotgun' | 'smg' | 'rifle' | 'precision';
export type AmmoType = 'ammo9' | 'ammo12' | 'ammo762';
export type WeaponSlot = 'primary' | 'secondary' | 'melee';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  short: string;
  slot: WeaponSlot;
  kind: 'melee' | 'gun';
  equipTime?: number;          // raise-to-ready seconds (class handling)
  // guns
  ammo?: AmmoType;
  mag?: number;
  rpm?: number;
  auto?: boolean;
  pump?: boolean;              // re-cock delay between shots
  damage?: number;
  pellets?: number;
  spread?: number;             // degrees, hip
  adsSpread?: number;          // degrees, ADS
  range?: number;
  headMult?: number;
  limbMult?: number;
  reloadTime?: number;
  recoilKick?: number;         // viewmodel kick
  recoilRise?: number;         // camera pitch degrees
  recoilYaw?: number;          // horizontal kick impulse
  knockback?: number;          // enemy impulse scale on hit
  adsFov?: number;
  // melee
  meleeDmg?: number;
  reach?: number;
  swingTime?: number;
  stamCost?: number;
  stagger?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife: {
    id: 'knife', name: 'FIELD KNIFE', short: 'KNIFE', slot: 'melee', kind: 'melee',
    equipTime: 0.14,
    meleeDmg: 28, reach: 2.2, swingTime: 0.38, stamCost: 6, stagger: 0.25,
  },
  machete: {
    id: 'machete', name: 'MACHETE', short: 'MACHETE', slot: 'melee', kind: 'melee',
    equipTime: 0.26,
    meleeDmg: 42, reach: 2.7, swingTime: 0.58, stamCost: 10, stagger: 0.4,
  },
  hatchet: {
    id: 'hatchet', name: 'HATCHET', short: 'HATCHET', slot: 'melee', kind: 'melee',
    equipTime: 0.3,
    meleeDmg: 62, reach: 2.4, swingTime: 0.82, stamCost: 15, stagger: 0.7,
  },
  pistol: {
    id: 'pistol', name: 'RANGER-9', short: 'RANGER-9', slot: 'secondary', kind: 'gun',
    equipTime: 0.22,
    ammo: 'ammo9', mag: 12, rpm: 330, damage: 30, pellets: 1,
    spread: 1.6, adsSpread: 0.45, range: 60, headMult: 2.6, limbMult: 0.8,
    reloadTime: 1.55, recoilKick: 0.055, recoilRise: 0.9, recoilYaw: 0.35, knockback: 1.4, adsFov: 62,
  },
  shotgun: {
    id: 'shotgun', name: 'FIELDLINE 12', short: 'FIELDLINE', slot: 'primary', kind: 'gun',
    equipTime: 0.4,
    ammo: 'ammo12', mag: 6, rpm: 70, pump: true, damage: 12, pellets: 8,
    spread: 4.6, adsSpread: 3.6, range: 22, headMult: 1.6, limbMult: 0.85,
    reloadTime: 3.1, recoilKick: 0.16, recoilRise: 2.6, recoilYaw: 0.8, knockback: 4.2, adsFov: 65,
  },
  smg: {
    id: 'smg', name: 'VESPER SMG', short: 'VESPER', slot: 'primary', kind: 'gun',
    equipTime: 0.3,
    ammo: 'ammo9', mag: 30, rpm: 840, auto: true, damage: 15, pellets: 1,
    spread: 2.4, adsSpread: 1.4, range: 45, headMult: 2.2, limbMult: 0.8,
    reloadTime: 2.2, recoilKick: 0.035, recoilRise: 0.55, recoilYaw: 0.3, knockback: 1.0, adsFov: 62,
  },
  rifle: {
    id: 'rifle', name: 'MERIDIAN 762', short: 'MERIDIAN', slot: 'primary', kind: 'gun',
    equipTime: 0.4,
    ammo: 'ammo762', mag: 20, rpm: 260, damage: 42, pellets: 1,
    spread: 1.0, adsSpread: 0.28, range: 90, headMult: 2.8, limbMult: 0.8,
    reloadTime: 2.4, recoilKick: 0.09, recoilRise: 1.6, recoilYaw: 0.55, knockback: 2.4, adsFov: 55,
  },
  precision: {
    id: 'precision', name: 'LONGEYE MARKSMAN', short: 'LONGEYE', slot: 'primary', kind: 'gun',
    equipTime: 0.52,
    ammo: 'ammo762', mag: 5, rpm: 62, damage: 95, pellets: 1,
    spread: 1.6, adsSpread: 0.12, range: 140, headMult: 3.2, limbMult: 0.85,
    reloadTime: 3.2, recoilKick: 0.18, recoilRise: 3.2, recoilYaw: 0.9, knockback: 3.4, adsFov: 34,
  },
};

export const AMMO_LABEL: Record<AmmoType, string> = {
  ammo9: '9MM',
  ammo12: '12GA',
  ammo762: '7.62',
};

export function isMelee(id: WeaponId): boolean {
  return WEAPONS[id].kind === 'melee';
}
