/**
 * Daftar semua suara dan takarannya. ID menjadi tipe `SoundId`, jadi salah ketik di kode langsung gagal typecheck.
 * File ada di `src/audio/files/<kategori>/<id>.mp3` atau `<id>_<nomor>.mp3` untuk variasi.
 * File yang belum ada berarti senyap, bukan error: aset boleh ditambah bertahap.
 */
export type SoundCategory = 'music' | 'stinger' | 'ambient' | 'weapon' | 'special' | 'enemy' | 'hero' | 'pickup' | 'ui';

export interface SoundSpec {
  cat: SoundCategory;
  /** Jumlah variasi file yang direncanakan. */
  files: number;
  /** 1 wajib lebih dulu, 3 polesan. */
  pri: 1 | 2 | 3;
  /** Volume dasar 0..1. */
  vol?: number;
  /** Batas pemutaran per detik. Suara dengan `group` yang sama berbagi batas ini. */
  rate?: number;
  group?: string;
  /** Tanpa pengaruh jarak: suara hero dan antarmuka. */
  flat?: boolean;
}

const S = (cat: SoundCategory, files: number, pri: 1 | 2 | 3, extra: Partial<SoundSpec> = {}): SoundSpec => ({ cat, files, pri, ...extra });
const HIT = { group: 'hit', rate: 12, vol: 0.7 };
const DIE = { group: 'die', rate: 8, vol: 0.8 };

export const CATALOG = {
  // Musik dan suasana: satu trek, mengulang
  // `vol` menyetarakan kerasnya (diukur RMS file); bos sengaja +3 dB agar terasa lebih menekan
  mus_menu: S('music', 1, 1, { vol: 0.5 }),
  mus_pagi: S('music', 1, 1, { vol: 0.26 }),
  mus_senja: S('music', 1, 2, { vol: 1 }),
  mus_malam: S('music', 1, 2, { vol: 0.86 }),
  mus_bos_ksatria: S('music', 1, 1, { vol: 0.52 }),
  mus_bos_naga: S('music', 1, 2, { vol: 0.4 }),
  amb_pagi: S('ambient', 1, 2),
  amb_senja: S('ambient', 1, 2),
  amb_malam: S('ambient', 1, 2),
  // Stinger
  stg_levelup: S('stinger', 1, 1, { flat: true }),
  stg_pusaka: S('stinger', 1, 1, { flat: true }),
  stg_win: S('stinger', 1, 1, { flat: true }),
  stg_lose: S('stinger', 1, 1, { flat: true }),
  stg_record: S('stinger', 1, 3, { flat: true }),
  // Senjata dasar
  bow_shot: S('weapon', 3, 1, { vol: 0.55, flat: true }),
  bow_multi: S('weapon', 2, 2, { vol: 0.5, flat: true }),
  hit_flesh: S('weapon', 3, 1, HIT),
  hit_bone: S('weapon', 3, 1, HIT),
  hit_stone: S('weapon', 2, 2, HIT),
  hit_armor: S('weapon', 3, 1, HIT),
  hit_scale: S('weapon', 2, 2, HIT),
  hit_crit: S('weapon', 2, 2, { rate: 4, vol: 0.75 }),
  hit_execute: S('weapon', 1, 3, { rate: 3 }),
  arrow_poison: S('weapon', 1, 3, { rate: 3, vol: 0.5 }),
  arrow_frost: S('weapon', 2, 3, { rate: 4, vol: 0.5 }),
  arrow_explode: S('weapon', 3, 2, { rate: 5, vol: 0.7 }),
  arrow_bounce: S('weapon', 2, 3, { rate: 5, vol: 0.5 }),
  sword_hit: S('weapon', 3, 1, { rate: 8, vol: 0.65 }),
  sword_whirl: S('weapon', 1, 3, { vol: 0.3, flat: true }),
  nova_cast: S('weapon', 2, 1, { vol: 0.75 }),
  // Pusaka
  meteor_fall: S('special', 1, 1, { vol: 0.8 }),
  meteor_impact: S('special', 2, 1, { vol: 1 }),
  meteor_burn: S('special', 1, 3, { vol: 0.45 }),
  rain_release: S('special', 1, 1, { vol: 0.8, flat: true }),
  rain_loop: S('special', 1, 1, { vol: 0.5, flat: true }),
  rain_thud: S('special', 3, 2, { rate: 6, vol: 0.45 }),
  thunder_crack: S('special', 4, 1, { rate: 5, vol: 0.85 }),
  thunder_rumble: S('special', 1, 2, { vol: 0.6, flat: true }),
  moon_slash: S('special', 2, 1, { vol: 0.85, flat: true }),
  raven_caw: S('special', 3, 1, { rate: 6, vol: 0.6, flat: true }),
  raven_wings: S('special', 1, 2, { vol: 0.5, flat: true }),
  raven_peck: S('special', 2, 3, { rate: 6, vol: 0.45 }),
  tornado_start: S('special', 1, 2, { vol: 0.7 }),
  tornado_loop: S('special', 1, 1, { vol: 0.5, flat: true }),
  flames_ignite: S('special', 1, 1, { vol: 0.8, flat: true }),
  flames_loop: S('special', 1, 2, { vol: 0.45, flat: true }),
  holy_pulse: S('special', 2, 1, { vol: 0.85, flat: true }),
  frost_cast: S('special', 1, 1, { vol: 0.85, flat: true }),
  frost_shatter: S('special', 2, 1, { vol: 0.9, flat: true }),
  quake_start: S('special', 1, 1, { vol: 0.95, flat: true }),
  quake_rock: S('special', 3, 2, { rate: 8, vol: 0.55 }),
  // Musuh
  die_goblin: S('enemy', 3, 1, DIE),
  die_bone: S('enemy', 3, 1, DIE),
  die_ogre: S('enemy', 2, 1, DIE),
  die_crowd: S('enemy', 1, 2, { rate: 2, vol: 0.8 }),
  die_knight: S('enemy', 1, 1, { vol: 1, flat: true }),
  die_dragon: S('enemy', 1, 1, { vol: 1, flat: true }),
  boss_knight_enter: S('enemy', 1, 1, { vol: 1, flat: true }),
  boss_dragon_enter: S('enemy', 1, 1, { vol: 1, flat: true }),
  swarm_horn: S('enemy', 1, 1, { vol: 0.8, flat: true }),
  boss_attack: S('enemy', 2, 2, { rate: 2, vol: 0.8 }),
  step_ogre: S('enemy', 2, 3, { rate: 3, vol: 0.4 }),
  step_boss: S('enemy', 2, 2, { rate: 2, vol: 0.6 }),
  goblin_chatter: S('enemy', 3, 3, { rate: 1, vol: 0.35 }),
  // Karakter utama
  foot_grass: S('hero', 4, 2, { rate: 6, vol: 0.28, flat: true }),
  hero_hurt: S('hero', 4, 1, { vol: 0.85, flat: true }),
  hero_dodge: S('hero', 2, 3, { vol: 0.6, flat: true }),
  hero_heartbeat: S('hero', 1, 2, { vol: 0.6, flat: true }),
  hero_death: S('hero', 1, 1, { vol: 0.95, flat: true }),
  hero_gasp: S('hero', 1, 2, { vol: 0.85, flat: true }),
  revive_phoenix: S('hero', 1, 2, { vol: 0.95, flat: true }),
  hero_power: S('hero', 2, 2, { vol: 0.85, flat: true }),
  hero_win: S('hero', 1, 3, { vol: 0.85, flat: true }),
  // Kristal dan pemulihan
  gem_small: S('pickup', 1, 1, { rate: 18, vol: 0.6, flat: true }),
  gem_big: S('pickup', 1, 2, { rate: 10, vol: 0.75, flat: true }),
  gem_recall: S('pickup', 1, 3, { vol: 0.7, flat: true }),
  heal_small: S('pickup', 1, 3, { rate: 3, vol: 0.5, flat: true }),
  // Antarmuka dan penanda waktu
  ui_click: S('ui', 1, 1, { flat: true }),
  ui_hover: S('ui', 1, 3, { flat: true, vol: 0.3 }),
  ui_toggle: S('ui', 1, 2, { flat: true }),
  ui_pause: S('ui', 1, 2, { flat: true }),
  ui_resume: S('ui', 1, 2, { flat: true }),
  card_appear: S('ui', 1, 1, { flat: true }),
  card_pick: S('ui', 1, 1, { flat: true }),
  card_pick_rare: S('ui', 1, 2, { flat: true }),
  card_pick_special: S('ui', 1, 1, { flat: true }),
  bell_cycle: S('ui', 1, 2, { vol: 0.8, flat: true }),
  bell_final: S('ui', 1, 2, { vol: 0.9, flat: true }),
  ui_tick: S('ui', 1, 3, { vol: 0.5, flat: true }),
} as const satisfies Record<string, SoundSpec>;

export type SoundId = keyof typeof CATALOG;
export const SOUND_IDS = Object.keys(CATALOG) as SoundId[];
export const spec = (id: SoundId): SoundSpec => CATALOG[id];
