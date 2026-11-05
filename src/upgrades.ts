import { GEAR, LUCK_EPIC, LUCK_RARE, PLAYER, RARITY, SPECIALS, SPECIAL_EVERY, SPECIAL_FX, type Rarity, type SpecialId } from './config';

export interface Stats {
  damageMul: number;
  cooldownMul: number;
  projectiles: number;
  pierce: number;
  boltSpeedMul: number;
  orbitCount: number;
  novaLevel: number;
  speedMul: number;
  magnetMul: number;
  maxHp: number;
  regen: number; // HP per detik
  critChance: number;
  critMul: number;
  armor: number; // bagian kerusakan yang ditahan
  dodge: number; // peluang menghindar
  thorns: number; // tingkat zirah berduri
  lifesteal: number; // peluang pulih saat membunuh
  xpMul: number;
  knockMul: number;
  luck: number;
  revives: number;
  execute: number; // musuh biasa di bawah bagian HP ini langsung tumbang
  poison: number;
  frost: number;
  explode: number;
  ricochet: number;
  doubleShot: number;
  orbitMul: number;
  orbitBonus: number; // tambahan jari-jari orbit
  novaMul: number;
  novaArea: number;
  /** Pusaka yang dimiliki: tingkat 1..3. */
  specials: Partial<Record<SpecialId, number>>;
}

export const baseStats = (): Stats => ({
  damageMul: 1,
  cooldownMul: 1,
  projectiles: 1,
  pierce: 0,
  boltSpeedMul: 1,
  orbitCount: 0,
  novaLevel: 0,
  speedMul: 1,
  magnetMul: 1,
  maxHp: PLAYER.maxHp,
  regen: 0,
  critChance: GEAR.critChance,
  critMul: GEAR.critMul,
  armor: 0,
  dodge: 0,
  thorns: 0,
  lifesteal: 0,
  xpMul: 1,
  knockMul: 1,
  luck: 0,
  revives: 0,
  execute: 0,
  poison: 0,
  frost: 0,
  explode: 0,
  ricochet: 0,
  doubleShot: 0,
  orbitMul: 1,
  orbitBonus: 0,
  novaMul: 1,
  novaArea: 1,
  specials: {},
});

/** Satu baris perubahan angka di kartu, misalnya "Kerusakan +25% → +50%". */
export interface CardStat {
  label: string;
  from: string;
  to: string;
}

export type UpgradeTag = 'Senjata' | 'Pasif' | 'Pusaka';

export interface Upgrade {
  id: string;
  name: string;
  /** Satu kalimat tentang apa yang dilakukan upgrade ini. */
  desc: (nextLevel: number) => string;
  /** Perubahan angka saat naik ke `nextLevel`. */
  stats: (nextLevel: number) => CardStat[];
  tag: UpgradeTag;
  rarity: Rarity;
  /** Hanya ditawarkan kalau upgrade ini sudah dimiliki. */
  requires?: string;
  max: number;
  icon: string; // SVG inline, memakai currentColor
  /** Mengubah stats. Boleh mengembalikan jumlah HP yang dipulihkan. */
  apply: (s: Stats, level: number) => number | void;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">${body}</svg>`;
const LINE = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`;
const none = '—';
/** Baris kartu dari fungsi nilai per level; level 0 berarti belum dimiliki. */
const row = (label: string, next: number, value: (lv: number) => string): CardStat[] => [
  { label, from: next <= 1 ? none : value(next - 1), to: value(next) },
];

export const UPGRADES: Upgrade[] = [
  {
    id: 'power',
    rarity: 'common',
    name: 'Mata Panah Tempaan',
    tag: 'Senjata',
    max: 5,
    desc: () => 'Semua senjata menjadi lebih mematikan.',
    stats: (n) => row('Kerusakan', n, (lv) => pct(lv * 25)),
    icon: svg('<path d="M12 1.5 18.5 11 14 12.4V22.5h-4V12.4L5.5 11z"/>'),
    apply: (s) => {
      s.damageMul += 0.25;
    },
  },
  {
    id: 'rate',
    rarity: 'common',
    name: 'Tarikan Kilat',
    tag: 'Senjata',
    max: 5,
    desc: () => 'Busur ditarik lebih cepat.',
    stats: (n) => row('Jeda tembak', n, (lv) => pct((Math.pow(0.88, lv) - 1) * 100)),
    icon: svg(`<path ${LINE} d="M6 3c8 1.5 13 7 14 15M6 3l14 15"/><path d="M11.5 5.5 6 14h3.4L8 20.5l6-9h-3.5z"/>`),
    apply: (s) => {
      s.cooldownMul *= 0.88;
    },
  },
  {
    id: 'multi',
    rarity: 'rare',
    name: 'Panah Kembar',
    tag: 'Senjata',
    max: 4,
    desc: () => 'Lepaskan lebih banyak panah sekaligus.',
    stats: (n) => [{ label: 'Panah', from: String(n), to: String(n + 1) }],
    icon: svg(`<path ${LINE} d="M5 20 14 7M12 21l6-13"/><path d="m15.8 2.5-.3 7.2-5-3.4zM20.5 3.5l-.1 6.5-4.6-2.3z"/>`),
    apply: (s) => {
      s.projectiles += 1;
    },
  },
  {
    id: 'pierce',
    rarity: 'common',
    name: 'Panah Penembus',
    tag: 'Senjata',
    max: 3,
    desc: () => 'Panah menembus musuh dan melesat lebih cepat.',
    stats: (n) => [{ label: 'Tembus', from: `${n - 1} musuh`, to: `${n} musuh` }],
    icon: svg(`<path ${LINE} d="M2 12h17"/><path d="m23 12-6.5 4.2V7.8z"/><path d="M9 3.5h4.5v17H9c-2.2-2.2-3-5.2-3-8.5s.8-6.3 3-8.5z" opacity=".55"/>`),
    apply: (s) => {
      s.pierce += 1;
      s.boltSpeedMul += 0.15;
    },
  },
  {
    id: 'orbit',
    rarity: 'common',
    name: 'Pedang Penjaga',
    tag: 'Senjata',
    max: 5,
    desc: (lv) => (lv === 1 ? 'Sebilah pedang melayang menjaga Anda dan menebas musuh yang mendekat.' : 'Tambah pedang penjaga.'),
    stats: (n) => [{ label: 'Pedang', from: String(n - 1), to: String(n) }],
    icon: svg(`<path d="m13.5 2 1.8 1.8L14 13.5l-2.5 2.5-1-1-1-1L12 11.5z" transform="rotate(35 12 12)"/><path ${LINE} d="M6.5 13.5 11 18M5 19l3-3"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.5 3" opacity=".6"/>`),
    apply: (s) => {
      s.orbitCount += 1;
    },
  },
  {
    id: 'nova',
    rarity: 'common',
    name: 'Lingkar Rune',
    tag: 'Senjata',
    max: 5,
    desc: (lv) => (lv === 1 ? 'Lingkaran rune meledak berkala di sekitar Anda.' : 'Rune lebih luas, lebih kuat, dan lebih sering.'),
    stats: (n) => row('Area', n, (lv) => pct((lv - 1) * 15)),
    icon: svg(`<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M12 6.8 16.5 15h-9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12.4" r="1.4"/>`),
    apply: (s) => {
      s.novaLevel += 1;
    },
  },
  {
    id: 'speed',
    rarity: 'common',
    name: 'Sepatu Pengelana',
    tag: 'Pasif',
    max: 5,
    desc: () => 'Berlari lebih cepat.',
    stats: (n) => row('Kecepatan', n, (lv) => pct(lv * 10)),
    icon: svg('<path d="M8 2.5h6.2l.5 8.2c.2 1.6 1.3 2.5 3 3.2 2 .8 3.8 1.4 3.8 3.6V19H5.5c-.8 0-1.3-.5-1.3-1.2z"/><rect x="4" y="19.6" width="17.6" height="2" rx="1"/>'),
    apply: (s) => {
      s.speedMul += 0.1;
    },
  },
  {
    id: 'magnet',
    rarity: 'common',
    name: 'Jimat Pemikat',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Kristal tertarik dari jarak lebih jauh.',
    stats: (n) => row('Jangkauan', n, (lv) => pct(lv * 40)),
    icon: svg(`<path ${LINE} d="M6 2.5c.3 4 2.3 7 6 8.5 3.7-1.5 5.7-4.5 6-8.5"/><path d="m12 10.5 5 5.5-5 6-5-6z"/>`),
    apply: (s) => {
      s.magnetMul += 0.4;
    },
  },
  {
    id: 'vital',
    rarity: 'common',
    name: 'Zirah Tangguh',
    tag: 'Pasif',
    max: 5,
    desc: () => 'Menambah HP maksimum dan langsung memulihkan 30 HP.',
    stats: (n) => [{ label: 'HP maks', from: String(PLAYER.maxHp + (n - 1) * 20), to: String(PLAYER.maxHp + n * 20) }],
    icon: svg('<path d="M12 22c-4.5-1.6-7.5-4.8-7.5-9V5.2C7 5 9.8 4 12 2c2.2 2 5 3 7.5 3.2V13c0 4.2-3 7.4-7.5 9z"/>'),
    apply: (s) => {
      s.maxHp += 20;
      return 30;
    },
  },
  {
    id: 'regen',
    rarity: 'common',
    name: 'Berkah Hutan',
    tag: 'Pasif',
    max: 4,
    desc: () => 'HP pulih sedikit demi sedikit.',
    stats: (n) => row('Pulih/detik', n, (lv) => (lv * 0.6).toFixed(1).replace('.', ',')),
    icon: svg(`<path d="M20.5 3C11 3 4.5 7.5 4.5 14c0 1.5.4 2.8 1.1 4C8 12.5 12 10 16 8.8c-3.7 2-7 5-9.3 10.5 1.4 1.2 3.1 1.7 5 1.7 6.3 0 8.8-8 8.8-18z"/>`),
    apply: (s) => {
      s.regen += 0.6;
    },
  },
  // ---- Modifikasi panah
  {
    id: 'poison',
    rarity: 'common',
    name: 'Panah Racun',
    tag: 'Senjata',
    max: 4,
    desc: () => 'Panah melapisi musuh dengan racun yang terus menggerogoti HP.',
    stats: (n) => row('Racun/detik', n, (lv) => `${Math.round(lv * GEAR.poisonDps * 100)}%`),
    icon: svg('<path d="M12 2c4 5.5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7.5 7-13z"/><circle cx="9.5" cy="15" r="1.6" fill="#2c1d12"/><circle cx="14" cy="17.5" r="1.1" fill="#2c1d12"/>'),
    apply: (s) => {
      s.poison += 1;
    },
  },
  {
    id: 'chill',
    rarity: 'common',
    name: 'Panah Beku',
    tag: 'Senjata',
    max: 3,
    desc: () => 'Musuh yang terkena panah bergerak lebih lambat.',
    stats: (n) => row('Perlambatan', n, (lv) => `${Math.round(lv * GEAR.frostSlow * 100)}%`),
    icon: svg(`<path ${LINE} d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/><path ${LINE} d="m9.5 4 2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5"/>`),
    apply: (s) => {
      s.frost += 1;
    },
  },
  {
    id: 'explode',
    rarity: 'rare',
    name: 'Panah Ledak',
    tag: 'Senjata',
    max: 4,
    desc: () => 'Panah meledak saat mengenai musuh dan melukai yang di sekitarnya.',
    stats: (n) => row('Ledakan', n, (lv) => `${Math.round(lv * GEAR.explodeDamage * 100)}%`),
    icon: svg('<path d="m12 1.5 2.3 5.3 5.2-2.6-1.9 5.5 5.4 1.3-4.8 2.9 3.1 4.8-5.8-.5-.3 5.8-3.2-4.8-3.2 4.8-.3-5.8-5.8.5 3.1-4.8L1 11l5.4-1.3-1.9-5.5 5.2 2.6z"/>'),
    apply: (s) => {
      s.explode += 1;
    },
  },
  {
    id: 'ricochet',
    rarity: 'rare',
    name: 'Panah Pantul',
    tag: 'Senjata',
    max: 3,
    desc: () => 'Setelah mengenai musuh, panah memantul ke musuh terdekat lainnya.',
    stats: (n) => [{ label: 'Pantulan', from: String(n - 1), to: String(n) }],
    icon: svg(`<path ${LINE} d="M3 20 12 6l5 11"/><path d="m21.5 22-7-1.8 5.4-3.3z"/><circle cx="12" cy="6" r="2.8"/>`),
    apply: (s) => {
      s.ricochet += 1;
    },
  },
  {
    id: 'quiver',
    rarity: 'common',
    name: 'Tabung Panah',
    tag: 'Senjata',
    max: 4,
    desc: () => 'Kadang melepaskan satu lagi tembakan penuh tanpa jeda.',
    stats: (n) => row('Tembak ganda', n, (lv) => `${Math.round(lv * GEAR.doubleShot * 100)}%`),
    icon: svg(`<path d="M7 9h10l-1.5 13h-7z"/><path ${LINE} d="M9.5 9 8 2.5M12 9V2M14.5 9 16 2.5"/>`),
    apply: (s) => {
      s.doubleShot += GEAR.doubleShot;
    },
  },
  {
    id: 'whet',
    rarity: 'rare',
    requires: 'orbit',
    name: 'Batu Asah Penjaga',
    tag: 'Senjata',
    max: 4,
    desc: () => 'Pedang penjaga lebih tajam dan berputar lebih lebar.',
    stats: (n) => row('Tebasan', n, (lv) => pct(lv * GEAR.whetDamage * 100)),
    icon: svg('<path d="M3 16 14.5 4.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L8 21H3z"/><path d="m12 16 3-3 5 5-3 3z" opacity=".55"/>'),
    apply: (s) => {
      s.orbitMul += GEAR.whetDamage;
      s.orbitBonus += GEAR.whetRadius;
    },
  },
  {
    id: 'runestone',
    rarity: 'rare',
    requires: 'nova',
    name: 'Batu Rune Kuno',
    tag: 'Senjata',
    max: 3,
    desc: () => 'Lingkar rune lebih kuat dan lebih luas.',
    stats: (n) => row('Ledakan rune', n, (lv) => pct(lv * GEAR.runeDamage * 100)),
    icon: svg('<path d="m12 2 8.5 5v10L12 22l-8.5-5V7z"/><path d="m9 8 6 8M15 8l-6 8" fill="none" stroke="#2c1d12" stroke-width="1.8" stroke-linecap="round"/>'),
    apply: (s) => {
      s.novaMul += GEAR.runeDamage;
      s.novaArea += GEAR.runeArea;
    },
  },
  // ---- Perlengkapan
  {
    id: 'eagle',
    rarity: 'common',
    name: 'Mata Elang',
    tag: 'Pasif',
    max: 5,
    desc: () => 'Lebih sering mengenai titik lemah musuh.',
    stats: (n) => row('Peluang kritis', n, (lv) => `${Math.round((GEAR.critChance + lv * GEAR.eagleCrit) * 100)}%`),
    icon: svg('<path d="M12 5C6.5 5 3 9 1.5 12 3 15 6.5 19 12 19s9-4 10.5-7C21 9 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/><circle cx="12" cy="12" r="1.8"/>'),
    apply: (s) => {
      s.critChance += GEAR.eagleCrit;
    },
  },
  {
    id: 'axe',
    rarity: 'rare',
    name: 'Mata Kapak Algojo',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Serangan kritis jauh lebih menyakitkan.',
    stats: (n) => row('Kerusakan kritis', n, (lv) => `×${(GEAR.critMul + lv * GEAR.axeCrit).toFixed(1).replace('.', ',')}`),
    icon: svg('<path d="M11 2h2.5v20H11z"/><path d="M13.5 3c5 0 8 3.5 8 7.5S18.5 16 13.5 16z"/><path d="M11 5C7 5 3.5 7 3.5 10.5S7 14 11 14z" opacity=".6"/>'),
    apply: (s) => {
      s.critMul += GEAR.axeCrit;
    },
  },
  {
    id: 'shield',
    rarity: 'common',
    name: 'Perisai Baja',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Menahan sebagian kerusakan yang diterima.',
    stats: (n) => row('Kerusakan masuk', n, (lv) => pct(-lv * GEAR.armor * 100)),
    icon: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5" fill="#2c1d12" opacity=".35"/><circle cx="12" cy="12" r="2.8"/>'),
    apply: (s) => {
      s.armor += GEAR.armor;
    },
  },
  {
    id: 'shadow',
    rarity: 'rare',
    name: 'Jubah Bayangan',
    tag: 'Pasif',
    max: 3,
    desc: () => 'Kadang serangan musuh meleset sama sekali.',
    stats: (n) => row('Menghindar', n, (lv) => `${Math.round(lv * GEAR.dodge * 100)}%`),
    icon: svg('<path d="M12 2c3.5 0 6 2.5 6 6v3l3.5 11h-5L15 18l-1 4h-4l-1-4-1.5 4h-5L6 11V8c0-3.5 2.5-6 6-6z"/><circle cx="12" cy="8.5" r="2.3" fill="#2c1d12"/>'),
    apply: (s) => {
      s.dodge += GEAR.dodge;
    },
  },
  {
    id: 'thorn',
    rarity: 'rare',
    name: 'Zirah Berduri',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Musuh di sekitar ikut terluka setiap kali Anda diserang.',
    stats: (n) => row('Pantulan luka', n, (lv) => `Tingkat ${lv}`),
    icon: svg('<path d="M12 4c4.5 0 8 3.5 8 8s-3.5 8-8 8-8-3.5-8-8 3.5-8 8-8z"/><path d="m12 0 2 5h-4zM12 24l-2-5h4zM0 12l5-2v4zM24 12l-5 2v-4zM3.5 3.5l5 2.2-2.8 2.8zM20.5 20.5l-5-2.2 2.8-2.8zM20.5 3.5l-2.2 5-2.8-2.8zM3.5 20.5l2.2-5 2.8 2.8z"/>'),
    apply: (s) => {
      s.thorns += 1;
    },
  },
  {
    id: 'chalice',
    rarity: 'rare',
    name: 'Piala Darah',
    tag: 'Pasif',
    max: 4,
    desc: () => `Setiap musuh yang tumbang berpeluang memulihkan ${GEAR.lifestealHeal} HP.`,
    stats: (n) => row('Peluang pulih', n, (lv) => `${Math.round(lv * GEAR.lifesteal * 100)}%`),
    icon: svg('<path d="M5 2h14c0 6-1.5 11-5.5 12.5V19H17v3H7v-3h3.5v-4.5C6.5 13 5 8 5 2z"/>'),
    apply: (s) => {
      s.lifesteal += GEAR.lifesteal;
    },
  },
  {
    id: 'tome',
    rarity: 'common',
    name: 'Kitab Pengetahuan',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Setiap kristal memberi lebih banyak pengalaman.',
    stats: (n) => row('XP', n, (lv) => pct(lv * GEAR.xp * 100)),
    icon: svg('<path d="M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 5v15" stroke="#2c1d12" stroke-width="1.5"/>'),
    apply: (s) => {
      s.xpMul += GEAR.xp;
    },
  },
  {
    id: 'gauntlet',
    rarity: 'common',
    name: 'Sarung Tangan Besi',
    tag: 'Pasif',
    max: 3,
    desc: () => 'Serangan melempar musuh lebih jauh.',
    stats: (n) => row('Dorongan', n, (lv) => pct(lv * GEAR.knock * 100)),
    icon: svg('<path d="M7 3h2v8h1V2h2.5v9h1V3H16v9h1V6h2v10c0 3.5-2.5 6-6 6h-1c-3 0-5-2-6.5-5L3 12.5l1.8-1.3L7 14z"/>'),
    apply: (s) => {
      s.knockMul += GEAR.knock;
    },
  },
  {
    id: 'clover',
    rarity: 'rare',
    name: 'Cincin Keberuntungan',
    tag: 'Pasif',
    max: 3,
    desc: () => 'Kartu langka dan epik lebih sering muncul.',
    stats: (n) => row('Keberuntungan', n, (lv) => `Tingkat ${lv}`),
    icon: svg('<path fill-rule="evenodd" d="M12 7a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/><path d="m12 0 3.5 3.5L12 7 8.5 3.5z"/>'),
    apply: (s) => {
      s.luck += 1;
    },
  },
  {
    id: 'phoenix',
    rarity: 'epic',
    name: 'Bulu Phoenix',
    tag: 'Pasif',
    max: 2,
    desc: () => 'Saat HP habis, Anda bangkit kembali dan melontarkan musuh di sekitar.',
    stats: (n) => [{ label: 'Bangkit', from: `${n - 1}×`, to: `${n}×` }],
    icon: svg('<path d="M20.5 2C12 2.5 6 7 4.5 15L2 22l3-1.5 2.5.5c7-1 12-5.5 13-13.5-2 1.5-4 2-6 2 2.5-1.5 5-4 6-7.5z"/>'),
    apply: (s) => {
      s.revives += 1;
    },
  },
  {
    id: 'headsman',
    rarity: 'epic',
    name: 'Titah Algojo',
    tag: 'Pasif',
    max: 3,
    desc: () => 'Musuh biasa yang HP-nya sudah rendah langsung tumbang saat terkena.',
    stats: (n) => row('Batas HP', n, (lv) => `${Math.round(lv * GEAR.execute * 100)}%`),
    icon: svg('<path d="M11 1.5h2l1 15h-4z"/><rect x="6" y="16" width="12" height="2.6" rx="1"/><path d="M10.5 18.6h3V23h-3z"/>'),
    apply: (s) => {
      s.execute += GEAR.execute;
    },
  },
  {
    id: 'glass',
    rarity: 'epic',
    name: 'Pedang Kaca',
    tag: 'Pasif',
    max: 2,
    desc: () => `Kerusakan melonjak, tetapi HP maksimum berkurang ${GEAR.glassHp}.`,
    stats: (n) => row('Kerusakan', n, (lv) => pct(lv * GEAR.glassDamage * 100)),
    icon: svg('<path d="m12 1 3.5 4.5L14 16h-4L8.5 5.5z"/><path d="M12 1v15" stroke="#2c1d12" stroke-width="1" opacity=".5"/><rect x="6.5" y="16" width="11" height="2.4" rx="1"/><path d="M10.7 18.4h2.6V23h-2.6z"/>'),
    apply: (s) => {
      s.damageMul += GEAR.glassDamage;
      s.maxHp = Math.max(GEAR.minHp, s.maxHp - GEAR.glassHp);
    },
  },
];

const specialStats = (id: SpecialId, unit: string) => (next: number): CardStat[] => {
  const to = SPECIALS[id][next - 1];
  const from = next > 1 ? SPECIALS[id][next - 2] : null;
  return [
    { label: 'Kekuatan', from: from ? `×${from.damage}` : none, to: `×${to.damage}` },
    { label: unit, from: from ? String(from.count) : none, to: String(to.count) },
    { label: 'Jeda', from: from ? `${from.cooldown} dtk` : none, to: `${to.cooldown} dtk` },
  ];
};

const specialUpgrade = (id: SpecialId, name: string, unit: string, desc: string, up: string, icon: string): Upgrade => ({
  id,
  name,
  tag: 'Pusaka',
  rarity: 'epic',
  max: SPECIALS[id].length,
  desc: (lv) => (lv === 1 ? desc : up),
  stats: specialStats(id, unit),
  icon: svg(icon),
  apply: (s, lv) => {
    s.specials[id] = lv;
  },
});

/** Senjata pusaka, hanya ditawarkan di level kelipatan `SPECIAL_EVERY`. */
export const SPECIAL_UPGRADES: Upgrade[] = [
  specialUpgrade(
    'meteor',
    'Bintang Jatuh',
    'Meteor',
    'Meteor raksasa menghantam kerumunan terpadat, lalu kawahnya terus membakar.',
    'Lebih banyak meteor dengan ledakan lebih besar.',
    '<path d="M3 3c3.2 4.8 5.4 6.9 8.2 8.2-.8-2.4-1-5-.6-8.2 2 3 4 5 7.3 7.4 1.7 1.3 3 3.2 3 5.6a5.8 5.8 0 0 1-5.9 6c-3.5 0-6-2.5-6-5.7C6.7 14.8 4 10 3 3z"/>',
  ),
  specialUpgrade(
    'rain',
    'Hujan Panah',
    'Panah',
    'Ratusan panah menghujani seluruh area di sekitar Anda.',
    'Hujan lebih deras dan lebih luas.',
    `<path ${LINE} d="M5 3v12M12 2v16M19 3v12"/><path d="m5 21-3-6.5h6zM12 23.5l-3-6.5h6zM19 21l-3-6.5h6z"/>`,
  ),
  specialUpgrade(
    'thunder',
    'Murka Petir',
    'Sambaran',
    'Petir menyambar musuh satu per satu dan melompat ke yang di sekitarnya.',
    'Lebih banyak sambaran dengan area lebih lebar.',
    '<path d="M14.5 1 4.5 13.5h6L8.5 23l11-13.5h-6.2z"/>',
  ),
  specialUpgrade(
    'moon',
    'Tebasan Bulan',
    'Gelombang',
    'Gelombang bilah bulan menyapu seluruh layar dan melempar musuh menjauh.',
    'Gelombang tambahan dengan jangkauan lebih jauh.',
    '<path d="M15.5 1.5A10.8 10.8 0 1 1 3 18.5c9.7 2 16-6.5 12.5-17z"/>',
  ),
  specialUpgrade(
    'ravens',
    'Kawanan Gagak',
    'Gagak',
    'Kawanan gagak Ravenhold memburu musuh satu per satu dan mematuknya.',
    'Kawanan lebih besar dengan paruh lebih tajam.',
    '<path d="M2 11c3-3.5 7-5 10-3.5C14 5 18 3 22.5 3.5c-1 3.5-3 6-5.5 7.5 1 2.5.5 5-1.5 7l1 3-3-1.5c-3 1-6 .5-8-1.5l-3 .5 1.5-3C3 13.5 2.5 12 2 11z"/>',
  ),
  specialUpgrade(
    'tornado',
    'Pusaran Badai',
    'Pusaran',
    'Pusaran angin mengejar kerumunan, menyedot musuh ke tengah, dan terus melukai.',
    'Lebih banyak pusaran dengan tarikan lebih lebar.',
    `<path ${LINE} d="M3 5c5 2 13 2 18 0M5.5 10c4 1.5 9 1.5 13 0M8 15c2.5 1 5.5 1 8 0M10.5 19.5c1 .5 2 .5 3 0"/>`,
  ),
  specialUpgrade(
    'flames',
    'Lingkar Api',
    'Kobaran',
    'Cincin api menyala di sekitar Anda dan membakar musuh yang melintasinya.',
    'Cincin lebih lebar dengan kobaran lebih rapat.',
    '<path d="M12 1c1 4 5 6 5 12a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 1-3-.5-6 1-10.5z"/><path d="M4 20c5 2.5 11 2.5 16 0v2.5c-5 2-11 2-16 0z"/>',
  ),
  specialUpgrade(
    'holy',
    'Cahaya Suci',
    'Denyut',
    `Tiang cahaya melukai musuh di sekitar sekaligus memulihkan ${SPECIAL_FX.holyHeal} HP.`,
    'Lebih banyak denyut cahaya dengan jangkauan lebih luas.',
    '<path d="M9 1h6l2 16H7z"/><path d="M3 18.5c5.5-1.5 12.5-1.5 18 0V21c-5.5 2-12.5 2-18 0z"/>',
  ),
  specialUpgrade(
    'frost',
    'Badai Es',
    'Beku (dtk)',
    'Semua musuh di area luas membeku, lalu esnya pecah dan melukai mereka.',
    'Area lebih luas dengan pecahan es lebih kuat.',
    `<path ${LINE} d="M12 1.5v21M2.9 6.8l18.2 10.4M21.1 6.8 2.9 17.2"/><path d="m12 8 3.5 4-3.5 4-3.5-4z"/>`,
  ),
  specialUpgrade(
    'quake',
    'Gempa Bumi',
    'Retakan',
    'Tanah retak memancar dari kaki Anda dan meledak di sepanjang jalurnya.',
    'Lebih banyak retakan dengan jangkauan lebih jauh.',
    `<path ${LINE} d="m12 12-3-3 1-4-2-3M12 12l4-2 1-4 4-1M12 12l1 4 4 2 1 4M12 12l-4 1-2 4-4 1"/><circle cx="12" cy="12" r="2.5"/>`,
  ),
];

export const ALL_UPGRADES = [...UPGRADES, ...SPECIAL_UPGRADES];

/** Dipakai kalau semua upgrade sudah maksimal. */
export const HEAL_FALLBACK: Upgrade = {
  id: 'heal',
  name: 'Ramuan Pemulih',
  tag: 'Pasif',
  rarity: 'common',
  max: 999,
  desc: () => 'Pulihkan 40 HP.',
  stats: () => [],
  icon: svg('<path d="M9.5 2h5v2h-1v3.5c3.2 1 5.5 3.9 5.5 7.2 0 4.1-3.1 7.3-7 7.3s-7-3.2-7-7.3c0-3.3 2.3-6.2 5.5-7.2V4h-1z"/>'),
  apply: () => 40,
};

export const isSpecialLevel = (level: number) => level % SPECIAL_EVERY === 0;

const OWNED_WEIGHT = 1.8;

/** Peluang kartu ini terpilih: kelangkaan, keberuntungan, dan apakah sudah dimiliki. */
export function cardWeight(u: Upgrade, levels: Record<string, number>, luck = 0) {
  const boost = u.rarity === 'rare' ? 1 + luck * LUCK_RARE : u.rarity === 'epic' ? 1 + luck * LUCK_EPIC : 1;
  return RARITY[u.rarity].weight * boost * ((levels[u.id] ?? 0) > 0 ? OWNED_WEIGHT : 1);
}

function pickWeighted(pool: Upgrade[], levels: Record<string, number>, rng: () => number, luck: number) {
  let r = rng() * pool.reduce((sum, u) => sum + cardWeight(u, levels, luck), 0);
  for (let i = 0; i < pool.length; i++) {
    r -= cardWeight(pool[i], levels, luck);
    if (r <= 0) return pool.splice(i, 1)[0];
  }
  return pool.pop()!;
}

const available = (list: Upgrade[], levels: Record<string, number>) =>
  list.filter((u) => (levels[u.id] ?? 0) < u.max && (!u.requires || (levels[u.requires] ?? 0) > 0));

/**
 * Pilih `n` upgrade acak yang belum maksimal. Selalu ada setidaknya satu senjata selama masih tersedia.
 * Upgrade yang kuat lebih jarang muncul, dan yang sudah dimiliki lebih sering, supaya bangunan karakter terarah.
 */
export function rollChoices(levels: Record<string, number>, n = 3, rng: () => number = Math.random, luck = 0): Upgrade[] {
  const pool = available(UPGRADES, levels);
  const picks: Upgrade[] = [];
  const weapons = pool.filter((u) => u.tag === 'Senjata');
  if (weapons.length && n > 0) {
    const w = pickWeighted(weapons, levels, rng, luck);
    pool.splice(pool.indexOf(w), 1);
    picks.push(w);
  }
  while (picks.length < n && pool.length) picks.push(pickWeighted(pool, levels, rng, luck));
  // Senjata pasti tidak selalu di posisi pertama
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  if (picks.length === 0) picks.push(HEAL_FALLBACK);
  return picks;
}

/**
 * Pilihan pusaka, acak merata. Selama masih ada pusaka yang belum dimiliki, minimal satu kartu adalah pusaka baru,
 * supaya pemain selalu bisa mencoba sesuatu yang berbeda. Kosong kalau semuanya sudah tingkat tertinggi.
 */
export function rollSpecials(levels: Record<string, number>, n = 3, rng: () => number = Math.random): Upgrade[] {
  const pool = available(SPECIAL_UPGRADES, levels);
  const take = (list: Upgrade[]) => list[Math.floor(rng() * list.length)];
  const picks: Upgrade[] = [];
  const unowned = pool.filter((u) => (levels[u.id] ?? 0) === 0);
  if (unowned.length && n > 0) {
    const first = take(unowned);
    pool.splice(pool.indexOf(first), 1);
    picks.push(first);
  }
  while (picks.length < n && pool.length) {
    const u = take(pool);
    pool.splice(pool.indexOf(u), 1);
    picks.push(u);
  }
  // Pusaka baru tidak selalu di posisi pertama
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks;
}
