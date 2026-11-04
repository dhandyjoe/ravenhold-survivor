import { PLAYER } from './config';

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
});

export interface Upgrade {
  id: string;
  name: string;
  /** Teks efek untuk level berikutnya. */
  desc: (nextLevel: number) => string;
  tag: 'Senjata' | 'Pasif';
  max: number;
  icon: string; // SVG inline, memakai currentColor
  /** Mengubah stats. Boleh mengembalikan jumlah HP yang dipulihkan. */
  apply: (s: Stats, level: number) => number | void;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const UPGRADES: Upgrade[] = [
  {
    id: 'power',
    name: 'Inti Terang',
    tag: 'Senjata',
    max: 5,
    desc: () => 'Kerusakan peluru +25%.',
    icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    apply: (s) => {
      s.damageMul += 0.25;
    },
  },
  {
    id: 'rate',
    name: 'Ritme Cepat',
    tag: 'Senjata',
    max: 5,
    desc: () => 'Jeda antar tembakan -12%.',
    icon: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>'),
    apply: (s) => {
      s.cooldownMul *= 0.88;
    },
  },
  {
    id: 'multi',
    name: 'Tembakan Kembar',
    tag: 'Senjata',
    max: 4,
    desc: (lv) => `Tembak ${lv + 1} peluru sekaligus.`,
    icon: svg('<path d="M4 8h12M4 16h12"/><path d="m14 5 4 3-4 3M14 13l4 3-4 3"/>'),
    apply: (s) => {
      s.projectiles += 1;
    },
  },
  {
    id: 'pierce',
    name: 'Tembus',
    tag: 'Senjata',
    max: 3,
    desc: (lv) => `Peluru menembus ${lv} musuh tambahan, dan melesat 15% lebih cepat.`,
    icon: svg('<path d="M3 12h15"/><path d="m14 8 4 4-4 4"/><rect x="8" y="5" width="3" height="14" rx="1.5"/>'),
    apply: (s) => {
      s.pierce += 1;
      s.boltSpeedMul += 0.15;
    },
  },
  {
    id: 'orbit',
    name: 'Satelit',
    tag: 'Senjata',
    max: 5,
    desc: (lv) => (lv === 1 ? 'Sebuah bola cahaya mengorbit dan melukai musuh.' : `Tambah satelit (total ${lv}).`),
    icon: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="19" cy="8" r="1.8" fill="currentColor"/>'),
    apply: (s) => {
      s.orbitCount += 1;
    },
  },
  {
    id: 'nova',
    name: 'Gelombang Nova',
    tag: 'Senjata',
    max: 5,
    desc: (lv) => (lv === 1 ? 'Ledakan cahaya berkala di sekitar Anda.' : 'Nova lebih luas, lebih kuat, dan lebih sering.'),
    icon: svg('<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.5" stroke-opacity=".5"/>'),
    apply: (s) => {
      s.novaLevel += 1;
    },
  },
  {
    id: 'speed',
    name: 'Langkah Ringan',
    tag: 'Pasif',
    max: 5,
    desc: () => 'Kecepatan gerak +10%.',
    icon: svg('<path d="M5 18c4 0 5-3 7-6s3-6 7-6"/><path d="M3 12h4M5 8h3"/>'),
    apply: (s) => {
      s.speedMul += 0.1;
    },
  },
  {
    id: 'magnet',
    name: 'Magnet',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Jangkauan tarik kristal +40%.',
    icon: svg('<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/>'),
    apply: (s) => {
      s.magnetMul += 0.4;
    },
  },
  {
    id: 'vital',
    name: 'Inti Tangguh',
    tag: 'Pasif',
    max: 5,
    desc: () => 'HP maksimum +20 dan pulihkan 30 HP.',
    icon: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
    apply: (s) => {
      s.maxHp += 20;
      return 30;
    },
  },
  {
    id: 'regen',
    name: 'Regenerasi',
    tag: 'Pasif',
    max: 4,
    desc: () => 'Pulih 0,6 HP setiap detik.',
    icon: svg('<path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="9" stroke-opacity=".5"/>'),
    apply: (s) => {
      s.regen += 0.6;
    },
  },
];

/** Dipakai kalau semua upgrade sudah maksimal. */
export const HEAL_FALLBACK: Upgrade = {
  id: 'heal',
  name: 'Pulihkan',
  tag: 'Pasif',
  max: 999,
  desc: () => 'Pulihkan 40 HP.',
  icon: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>'),
  apply: () => 40,
};

/** Pilih `n` upgrade acak yang belum maksimal. */
export function rollChoices(levels: Record<string, number>, n = 3): Upgrade[] {
  const pool = UPGRADES.filter((u) => (levels[u.id] ?? 0) < u.max);
  const picks: Upgrade[] = [];
  while (picks.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  if (picks.length === 0) picks.push(HEAL_FALLBACK);
  return picks;
}
