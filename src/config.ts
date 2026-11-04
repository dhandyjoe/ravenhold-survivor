// Semua angka balancing dan warna ada di sini, supaya mudah di-tweak.

export const COLORS = {
  bg: 0x0d0e1a,
  grid: '#262a47',
  player: '#8ff3ff',
  playerDeep: '#3fb8d9',
  drone: '#ff7b8a',
  blob: '#ffb65c',
  brute: '#b98cff',
  titan: '#ff5fa2',
  gem: '#86f7c0',
  gemBig: '#ffe27a',
  bolt: '#c9fbff',
  shard: '#9df9ff',
  hp: '#86f7c0',
  hpLow: '#ff7b8a',
} as const;

export const hex = (c: string) => parseInt(c.slice(1), 16);

/** Lama satu ronde. Bertahan sampai waktu ini = menang. */
export const RUN_SECONDS = 600;

export const PLAYER = {
  radius: 14,
  speed: 215,
  maxHp: 100,
  invulnMs: 550,
  baseMagnet: 70,
};

export const WEAPON = {
  boltDamage: 10,
  boltCooldown: 0.55,
  boltSpeed: 540,
  boltLife: 1.0,
  boltRadius: 6,
  orbitRadius: 74,
  orbitSpeed: 2.6, // radian per detik
  orbitDamage: 9,
  orbitHitCooldown: 0.45,
  novaDamage: 22,
  novaRadius: 130,
  novaCooldown: 3.2,
};

export type EnemyKind = 'drone' | 'blob' | 'brute' | 'titan';

export interface EnemySpec {
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  scale: number;
  color: string;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  drone: { hp: 12, speed: 78, damage: 8, radius: 11, xp: 1, scale: 1, color: COLORS.drone },
  blob: { hp: 32, speed: 58, damage: 12, radius: 13, xp: 2, scale: 1, color: COLORS.blob },
  brute: { hp: 95, speed: 42, damage: 20, radius: 19, xp: 5, scale: 1, color: COLORS.brute },
  titan: { hp: 1600, speed: 52, damage: 30, radius: 44, xp: 40, scale: 2.3, color: COLORS.titan },
};

export const SPAWN = {
  maxEnemies: 340,
  baseRate: 1.2, // musuh per detik di awal
  ratePerSecond: 0.034, // tambahan musuh/detik setiap detik berlalu
  hpGrowthSeconds: 95, // hp musuh x2 setiap ~95 detik
  swarmEvery: 60,
  titanAt: [300, 540],
};

/** XP yang dibutuhkan untuk naik dari `level` ke level berikutnya. */
export const xpForLevel = (level: number) =>
  Math.round(6 + (level - 1) * 5 + Math.pow(level - 1, 1.6));
