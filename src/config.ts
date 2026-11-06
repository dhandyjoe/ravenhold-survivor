// Semua angka balancing dan warna ada di sini, supaya mudah di-tweak.

export const COLORS = {
  bg: 0x1a2116,
  drone: '#ff7b8a',
  blob: '#ffb65c',
  brute: '#b98cff',
  titan: '#a86bff',
  wyrm: '#ff8a3c',
  special: '#ffcf6b',
  number: '#fff4d6',
  gem: '#6fd467',
  gemBig: '#ffe27a',
  hp: '#86f7c0',
  hpLow: '#ff7b8a',
} as const;

export const hex = (c: string) => parseInt(c.slice(1), 16);

/** Warna lukisan karakter dan lingkungan. Semua warna sprite prosedural berasal dari sini. */
export const PALETTE = {
  outline: '#1d1410',
  rim: '#fff0cf',
  shade: '#1a1020',
  hero: {
    cape: '#b4452f',
    capeLight: '#d96a44',
    capeDark: '#6d2820',
    leather: '#83593a',
    leatherLight: '#b08557',
    leatherDark: '#4f3424',
    cloth: '#e4d3a8',
    clothDark: '#b49d73',
    trousers: '#574536',
    boot: '#3c2a20',
    bootLight: '#65493a',
    skin: '#eebd94',
    skinDark: '#c98f6c',
    hair: '#3b2a22',
    eye: '#21161b',
    gold: '#e8bf5f',
    feather: '#e9e1c9',
    quiver: '#6c4a2f',
  },
  goblin: {
    skin: '#b7b866',
    skinLight: '#d6d58a',
    skinDark: '#7f8a45',
    hood: '#e0634e',
    hoodLight: '#f58d6e',
    hoodDark: '#8f3430',
    rag: '#6f5338',
    ragDark: '#493524',
    eye: '#ffd95e',
    pupil: '#23140f',
    fang: '#fff6dc',
    blade: '#b9b3a4',
    bladeDark: '#7b6253',
    grip: '#4a3324',
  },
  skeleton: {
    bone: '#e6dcc0',
    boneLight: '#fbf4dd',
    boneDark: '#a99c7c',
    socket: '#2b1c1a',
    eye: '#ffc65c',
    armor: '#c9863a',
    armorLight: '#efb562',
    armorDark: '#7c4c22',
    rust: '#94532a',
    shield: '#8b5a30',
    shieldDark: '#5a3820',
    iron: '#aeb0ab',
    ironDark: '#6b6d6b',
  },
  ogre: {
    skin: '#8d7fa8',
    skinLight: '#b6a8cc',
    skinDark: '#5c5178',
    stone: '#7c7787',
    stoneLight: '#a7a2ae',
    stoneDark: '#4c4858',
    moss: '#6f8f4c',
    mossDark: '#47612f',
    eye: '#ffd76a',
    pupil: '#2a1a12',
    tusk: '#f2e8cc',
    club: '#6f4a2c',
    clubDark: '#452c19',
    rag: '#5b4432',
  },
  knight: {
    steel: '#5d5a78',
    steelLight: '#8e8bad',
    steelDark: '#35324c',
    steelDeep: '#262338',
    visor: '#160f24',
    trim: '#c79a4b',
    trimDark: '#7e5c2a',
    cape: '#5a2348',
    capeDark: '#33122b',
    flame: '#b98cff',
    flameCore: '#efe2ff',
    flameDeep: '#6a3cc2',
    blade: '#c3bfdc',
    bladeDark: '#7d78a0',
    eye: '#d6b3ff',
  },
  dragon: {
    scale: '#b5482c',
    scaleLight: '#e4764a',
    scaleDark: '#6f2519',
    belly: '#efc27a',
    bellyDark: '#c08a4a',
    wing: '#7e2c24',
    wingLight: '#c2553a',
    horn: '#f2e4c4',
    eye: '#fff0a0',
    pupil: '#3a1408',
    ember: '#ffb04a',
    emberCore: '#fff0c0',
  },
  sword: {
    blade: '#d7dce0',
    bladeDark: '#8d97a0',
    guard: '#c79a4b',
    guardDark: '#7e5c2a',
    grip: '#5a3a26',
    rune: '#ffd97a',
  },
  fx: {
    smoke: '#6f6a63',
    dust: '#a8966f',
    bone: '#e6dcc0',
    fire: '#ff9a3c',
    fireCore: '#fff0c4',
    fireDeep: '#c23f1c',
    scorch: '#1f1712',
    rock: '#5d4538',
    rockDark: '#231713',
    lightning: '#fff6c8',
    lightningDeep: '#7ec8ff',
    moon: '#e4f2ff',
    moonDeep: '#6da7e8',
    rune: '#ffd97a',
    runeDeep: '#c98b2c',
    raven: '#241b2b',
    ravenLight: '#4b3a55',
    ravenEye: '#ffc65c',
    wind: '#e6e0cf',
    holy: '#ffe9a8',
    frost: '#eaf8ff',
    poison: '#9ccf5a',
    frostTint: '#b9e6ff',
    poisonTint: '#a8e070',
  },
  wood: {
    base: '#8a5c34',
    light: '#c08d55',
    dark: '#55361f',
    wrap: '#d7c192',
    string: '#f0e7cc',
  },
  arrow: {
    shaft: '#b98d58',
    head: '#c9ced3',
    headDark: '#6d747c',
    fletch: '#d65c44',
  },
  ground: {
    grass: '#587a3e',
    grassLight: '#8aa556',
    grassDeep: '#3b5c32',
    grassGold: '#a3a85c',
    flowerA: '#f0e6c2',
    flowerB: '#e6c15a',
    dirt: '#73604a',
    dirtLight: '#937d5f',
    dirtDark: '#54452f',
    stone: '#9a9581',
    stoneLight: '#b8b39c',
    stoneDark: '#68644f',
    moss: '#46592f',
  },
} as const;

/** Satu titik kunci siklus waktu. Warna dalam skala 0..1 agar bisa langsung dikirim ke shader. */
export interface DayKey {
  t: number; // detik sejak ronde dimulai
  ambient: [number, number, number];
  sun: [number, number, number];
  sunPower: number;
  sunAngle: number; // radian, arah dari dunia menuju matahari/bulan
  shadowLength: number; // panjang bayangan relatif
  shadowAlpha: number;
  cloud: number; // kekuatan bayangan awan di tanah
  lantern: number; // kekuatan lentera pemain
}

/** Pagi (0-6 menit), senja (6-10,5 menit), malam (10,5-15 menit). */
export const DAY_CYCLE: DayKey[] = [
  { t: 0, ambient: [0.72, 0.72, 0.66], sun: [1, 0.9, 0.72], sunPower: 0.7, sunAngle: -2.5, shadowLength: 1.3, shadowAlpha: 0.34, cloud: 0.2, lantern: 0 },
  { t: 225, ambient: [0.78, 0.79, 0.74], sun: [1, 0.96, 0.86], sunPower: 0.66, sunAngle: -2.0, shadowLength: 0.7, shadowAlpha: 0.38, cloud: 0.22, lantern: 0 },
  { t: 360, ambient: [0.66, 0.57, 0.53], sun: [1, 0.74, 0.46], sunPower: 0.8, sunAngle: -1.4, shadowLength: 1.5, shadowAlpha: 0.36, cloud: 0.2, lantern: 0.15 },
  { t: 495, ambient: [0.5, 0.37, 0.45], sun: [1, 0.5, 0.33], sunPower: 0.86, sunAngle: -0.9, shadowLength: 2.4, shadowAlpha: 0.3, cloud: 0.12, lantern: 0.75 },
  { t: 630, ambient: [0.24, 0.27, 0.45], sun: [0.55, 0.65, 1], sunPower: 0.5, sunAngle: -2.2, shadowLength: 1.2, shadowAlpha: 0.22, cloud: 0.06, lantern: 1.25 },
  { t: 900, ambient: [0.21, 0.25, 0.43], sun: [0.5, 0.62, 1], sunPower: 0.54, sunAngle: -1.9, shadowLength: 1.1, shadowAlpha: 0.22, cloud: 0.05, lantern: 1.35 },
];

/**
 * Tingkat kualitas, dari terbaik ke teringan. Game turun satu tingkat kalau frame mulai terlambat,
 * supaya tetap 60 fps. Bloom paling mahal karena berupa beberapa pass selebar layar.
 */
export const QUALITY = {
  tiers: [
    { bloom: true, maxPixels: Infinity, lights: true },
    { bloom: false, maxPixels: Infinity, lights: true },
    { bloom: false, maxPixels: 2_600_000, lights: true },
    { bloom: false, maxPixels: 1_500_000, lights: true },
    { bloom: false, maxPixels: 1_500_000, lights: false },
  ],
  maxDpr: 2,
  // Jumlah tekstur per batch. Lebih sedikit berarti shader lebih singkat dan lebih sedikit varian untuk dikompilasi.
  maxTextures: 8,
  bloomMaxPixels: 3_000_000, // di atas ini bloom tidak pernah dinyalakan, karena biayanya mengikuti jumlah piksel
  windowFrames: 120,
  settleFrames: 45, // frame yang diabaikan setelah kualitas berubah
  slowFrameMs: 21,
  ignoreAboveMs: 250, // jeda sangat panjang berarti tab berpindah, bukan game yang berat
  dropLimit: 0.12, // bagian frame terlambat yang memicu turun tingkat
  minImprovement: 0.25, // turun tingkat dianggap sia-sia kalau frame terlambat tidak berkurang sebanyak ini
  futileLimit: 2,
};

export const LIGHTING = {
  maxLights: 4,
  sunDistance: 700,
  sunRadius: 4200,
  sunHeight: 520,
  lanternRadius: 300,
  lanternHeight: 90,
  lanternColor: 0xffb86a,
  lanternOnGround: 0.62,
  bossRadius: 340,
  bossPower: 0.85,
  flashSeconds: 0.32,
};

/** Lama satu ronde. Bertahan sampai waktu ini = selesai, lalu kembali ke menu utama. */
export const RUN_SECONDS = 900;
/** Lama hitung mundur sebelum otomatis kembali ke menu setelah waktu habis. */
export const END_REDIRECT_SECONDS = 6;
/** Level tertinggi, kira-kira dicapai pemain yang bertahan 15 menit penuh. */
export const MAX_LEVEL = 50;

export const PLAYER = {
  radius: 14,
  speed: 215,
  maxHp: 100,
  invulnMs: 550,
  baseMagnet: 70,
  gemRecallFactor: 1.35, // kristal sejauh ini (kelipatan jarak muncul musuh) terbang sendiri ke pemain
};

export const WEAPON = {
  boltDamage: 13,
  boltCooldown: 0.5,
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

/** Peluang kemunculan kartu menurut kelangkaan. Makin kuat upgrade, makin jarang muncul. */
export const RARITY = {
  common: { weight: 1, label: 'Biasa' },
  rare: { weight: 0.6, label: 'Langka' },
  epic: { weight: 0.28, label: 'Epik' },
};
export type Rarity = keyof typeof RARITY;
export const LUCK_RARE = 0.35; // tambahan peluang kartu langka per tingkat keberuntungan
export const LUCK_EPIC = 0.6;

/** Efek perlengkapan. Satu tempat supaya kartu dan permainan selalu memakai angka yang sama. */
export const GEAR = {
  poisonDps: 0.3, // bagian kerusakan panah per detik, per tingkat
  poisonSeconds: 3,
  poisonTick: 0.5,
  frostSlow: 0.18, // perlambatan per tingkat
  frostSeconds: 1.6,
  explodeRadius: 42,
  explodeRadiusPerLevel: 10,
  explodeDamage: 0.3, // bagian kerusakan panah per tingkat
  ricochetRange: 260,
  doubleShot: 0.15,
  whetDamage: 0.4,
  whetRadius: 8,
  runeDamage: 0.35,
  runeArea: 0.1,
  critChance: 0.08, // peluang kritis dasar
  critMul: 2,
  eagleCrit: 0.05,
  axeCrit: 0.5,
  armor: 0.08,
  dodge: 0.08,
  thorns: 0.6, // bagian HP goblin saat itu per tingkat
  thornsRadius: 90,
  lifesteal: 0.05,
  lifestealHeal: 3,
  xp: 0.12,
  knock: 0.3,
  reviveHp: 0.5,
  reviveInvuln: 2.5,
  reviveRadius: 280,
  execute: 0.06,
  glassDamage: 0.5,
  glassHp: 25,
  minHp: 40,
};

export type EnemyKind = 'drone' | 'blob' | 'brute' | 'titan' | 'wyrm';

export interface EnemySpec {
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  scale: number;
  color: string;
  /** Bos: tidak dipindah saat tertinggal, punya bar HP sendiri, mendorong musuh lain. */
  boss: boolean;
  /** Lapisan gambar. Satu jenis satu lapisan, supaya GPU menggambar sejenis sekaligus. */
  depth: number;
  /** Pengali dorongan saat terkena serangan. Makin berat, makin kecil. */
  knockback: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  drone: { name: 'Goblin Semak', hp: 12, speed: 78, damage: 5, radius: 11, xp: 1, scale: 1, color: COLORS.drone, boss: false, depth: 8, knockback: 1 },
  blob: { name: 'Prajurit Tulang', hp: 32, speed: 58, damage: 10, radius: 13, xp: 3, scale: 1, color: COLORS.blob, boss: false, depth: 8.1, knockback: 0.75 },
  brute: { name: 'Ogre Batu', hp: 95, speed: 42, damage: 18, radius: 22, xp: 8, scale: 1, color: COLORS.brute, boss: false, depth: 8.2, knockback: 0.4 },
  titan: { name: 'Ksatria Terkutuk', hp: 1600, speed: 52, damage: 30, radius: 44, xp: 60, scale: 1, color: COLORS.titan, boss: true, depth: 9, knockback: 0.05 },
  wyrm: { name: 'Naga Bara', hp: 2200, speed: 60, damage: 34, radius: 44, xp: 90, scale: 1, color: COLORS.wyrm, boss: true, depth: 9.1, knockback: 0.05 },
};

/**
 * Sutradara spawn: jumlah dan kekuatan musuh mengikuti level pemain, bukan hanya waktu.
 * Lihat `src/balance.ts` untuk rumusnya.
 */
export const SPAWN = {
  maxEnemies: 170, // batas populasi normal; gelombang boleh melewatinya sampai `hardCap`
  hardCap: 230,
  // Level acuan: level yang wajar dicapai pada detik ke-t = 1 + levelSpan * (t / RUN_SECONDS)^levelCurve
  levelSpan: MAX_LEVEL - 1,
  levelCurve: 0.86,
  // Bobot level pemain terhadap level acuan. Sisanya memastikan bermain lambat tetap makin berat.
  levelWeight: 0.65,
  // Populasi sasaran = popBase + popPerLevel * level efektif
  popBase: 8,
  popPerLevel: 4.4,
  // Laju mengisi kekurangan populasi: kekurangan * fillRate, dibatasi rateMin..(rateBase + ratePerLevel * level)
  fillRate: 0.7,
  rateMin: 0.8,
  rateBase: 1.4,
  ratePerLevel: 0.3,
  // HP musuh = dasar * (1 + hpPerLevel * (level efektif - 1))
  hpPerLevel: 0.09,
  // Musuh juga sedikit lebih cepat dan lebih sakit seiring level efektif
  damagePerLevel: 0.025,
  speedPerLevel: 0.008,
  // Musuh baru lebih sering muncul di arah gerak pemain, dan yang tertinggal jauh dipindah ke depan.
  // Jadi pemain benar-benar bertemu musuhnya, tanpa perlu populasi yang besar.
  aheadChance: 0.65,
  aheadSpread: 1.9, // radian, lebar busur di depan pemain
  recycleFactor: 1.35, // kelipatan jarak muncul sebelum musuh dipindah
  // Gelombang: lingkaran goblin setiap swarmEvery detik
  swarmEvery: 60,
  swarmBase: 5,
  swarmPerLevel: 1.1,
  // Jenis musuh terbuka bertahap mengikuti level efektif
  blobFromLevel: 4,
  blobRamp: 10,
  blobMax: 0.8,
  bruteFromLevel: 10,
  bruteRamp: 14,
  bruteMax: 0.5,
  bosses: [
    { at: 300, kind: 'titan' },
    { at: 570, kind: 'wyrm' },
    { at: 810, kind: 'titan' },
  ] as { at: number; kind: EnemyKind }[],
};

export type SpecialId = 'meteor' | 'rain' | 'thunder' | 'moon' | 'ravens' | 'tornado' | 'flames' | 'holy' | 'frost' | 'quake';

export interface SpecialTier {
  /** Kerusakan relatif terhadap HP dasar musuh yang sudah diskalakan. Lihat `specialDamage`. */
  damage: number;
  cooldown: number;
  radius: number;
  /** Jumlah serangan per aktivasi (meteor, anak panah, sambaran, atau gelombang). */
  count: number;
}

/** Senjata pusaka, ditawarkan setiap level kelipatan `SPECIAL_EVERY`. Tiga tingkat per senjata. */
export const SPECIALS: Record<SpecialId, SpecialTier[]> = {
  meteor: [
    { damage: 70, cooldown: 11, radius: 170, count: 1 },
    { damage: 100, cooldown: 10, radius: 200, count: 2 },
    { damage: 140, cooldown: 9, radius: 230, count: 3 },
  ],
  rain: [
    { damage: 16, cooldown: 12, radius: 330, count: 50 },
    { damage: 22, cooldown: 11, radius: 380, count: 75 },
    { damage: 30, cooldown: 10, radius: 430, count: 110 },
  ],
  thunder: [
    { damage: 36, cooldown: 9, radius: 62, count: 9 },
    { damage: 50, cooldown: 8, radius: 72, count: 14 },
    { damage: 70, cooldown: 7, radius: 82, count: 20 },
  ],
  moon: [
    { damage: 44, cooldown: 13, radius: 460, count: 1 },
    { damage: 62, cooldown: 12, radius: 520, count: 2 },
    { damage: 85, cooldown: 11, radius: 580, count: 3 },
  ],
  // count: jumlah gagak
  ravens: [
    { damage: 14, cooldown: 12, radius: 460, count: 6 },
    { damage: 20, cooldown: 11, radius: 500, count: 10 },
    { damage: 28, cooldown: 10, radius: 540, count: 16 },
  ],
  // radius: lebar pusaran, count: jumlah pusaran
  tornado: [
    { damage: 14, cooldown: 14, radius: 110, count: 1 },
    { damage: 20, cooldown: 13, radius: 130, count: 2 },
    { damage: 28, cooldown: 12, radius: 150, count: 3 },
  ],
  // radius: jari-jari lingkar api, count: jumlah kobaran
  flames: [
    { damage: 14, cooldown: 13, radius: 170, count: 12 },
    { damage: 20, cooldown: 12, radius: 200, count: 16 },
    { damage: 28, cooldown: 11, radius: 235, count: 22 },
  ],
  // count: jumlah denyut cahaya
  holy: [
    { damage: 34, cooldown: 15, radius: 230, count: 1 },
    { damage: 50, cooldown: 14, radius: 270, count: 2 },
    { damage: 70, cooldown: 13, radius: 320, count: 3 },
  ],
  // damage: saat es pecah, count: lama membeku dalam detik
  frost: [
    { damage: 30, cooldown: 16, radius: 360, count: 2 },
    { damage: 46, cooldown: 15, radius: 420, count: 2.5 },
    { damage: 70, cooldown: 14, radius: 500, count: 3 },
  ],
  // radius: jangkauan retakan, count: jumlah retakan
  quake: [
    { damage: 20, cooldown: 11, radius: 300, count: 8 },
    { damage: 30, cooldown: 10, radius: 360, count: 10 },
    { damage: 44, cooldown: 9, radius: 430, count: 12 },
  ],
};

export const SPECIAL_EVERY = 5;

export const SPECIAL_FX = {
  meteorFall: 0.62, // detik dari tanda di tanah sampai meteor jatuh
  meteorGap: 0.34,
  craterLife: 2.4,
  burnTick: 0.4,
  burnDamage: 0.12, // bagian dari kerusakan ledakan per detak bara
  rainDuration: 2.2,
  rainHitRadius: 44,
  rainFall: 0.3,
  thunderGap: 0.09,
  moonSpeed: 780,
  moonGap: 0.42,
  moonBand: 72, // ketebalan pita gelombang yang melukai
  slowScale: 0.3,
  ravenLife: 4.5,
  ravenSpeed: 520,
  ravenCooldown: 0.22, // jeda seekor gagak setelah mematuk
  tornadoLife: 4.5,
  tornadoSpeed: 150,
  tornadoPull: 170, // kecepatan tarikan ke pusat, unit per detik
  tornadoTick: 0.5,
  flamesLife: 4.5,
  flamesTick: 0.6,
  flamesPatch: 62,
  holyGap: 0.55,
  holyHeal: 10, // HP per denyut
  frostBossSlow: 0.55, // bos hanya melambat, tidak membeku total
  quakeStep: 62,
  quakeGap: 0.055,
  quakeBlast: 58,
};

/** XP yang dibutuhkan untuk naik dari `level` ke level berikutnya. */
export const xpForLevel = (level: number) =>
  Math.round(6 + (level - 1) * 5 + Math.pow(level - 1, 1.6) + Math.pow(Math.max(0, level - 15), 2.03));

/**
 * Pengaturan umum audio. Takaran tiap suara (kerasnya, batas per detik) ada di `audioCatalog.ts`,
 * karena jumlahnya puluhan dan harus sejajar dengan daftar ID-nya.
 */
export const AUDIO = {
  musicVolume: 0.8, // bawaan; pemain mengubahnya lewat penggeser
  sfxVolume: 0.85,
  maxVoices: 24,
  maxVoicesLow: 16, // saat kualitas turun ke tingkat rendah
  poolPerKey: 3, // salinan satu file yang boleh berbunyi bersamaan
  pitchJitter: 0.06, // variasi nada acak ±6%
  hearRange: 520, // jarak dunia sampai suara tinggal sebagian kecil
  hearFloor: 0.22, // kerasnya di ujung jangkauan
  panWidth: 0.7, // pan maksimal di tepi pandang
  crossfade: 3, // detik, pergantian musik dan suasana
  ambientVolume: 0.5, // bagian dari volume musik
  pauseDuck: 0.4, // musik saat jeda atau memilih kartu
  duckFade: 0.25, // detik
  stingerDuck: { seconds: 2.4, depth: 0.55 },
  bossDuck: { seconds: 3, depth: 0.6 },
  lookahead: 30, // detik sebelum trek berikutnya mulai dimuat
  bossWindow: 150, // detik trek bos tetap dipertahankan setelah bos muncul
  senjaAt: 360,
  malamAt: 630,
  lowHpFraction: 0.3,
  heartbeatEvery: 1.05,
  crowdKills: 6, // tumbang dalam satu frame sampai dianggap kerumunan
};
