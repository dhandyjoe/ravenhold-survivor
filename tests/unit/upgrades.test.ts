import { describe, expect, it } from 'vitest';
import { ALL_UPGRADES, HEAL_FALLBACK, SPECIAL_UPGRADES, UPGRADES, baseStats, cardWeight, isSpecialLevel, rollChoices, rollSpecials } from '../../src/upgrades';

const allMaxed = () => Object.fromEntries(UPGRADES.map((u) => [u.id, u.max]));

describe('rollChoices', () => {
  it('memberi tiga pilihan tanpa duplikat', () => {
    for (let i = 0; i < 200; i++) {
      const ids = rollChoices({}).map((u) => u.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it('tidak pernah menawarkan upgrade yang sudah maksimal', () => {
    const levels = allMaxed();
    delete levels.orbit;
    delete levels.nova;
    for (let i = 0; i < 50; i++) {
      expect(rollChoices(levels).map((u) => u.id).sort()).toEqual(['nova', 'orbit']);
    }
  });

  it('menawarkan pemulihan kalau semua sudah maksimal', () => {
    expect(rollChoices(allMaxed())).toEqual([HEAL_FALLBACK]);
  });

  it('selalu ada senjata selama masih tersedia, dan tidak selalu di posisi pertama', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const picks = rollChoices({});
      expect(picks.some((u) => u.tag === 'Senjata')).toBe(true);
      firsts.add(picks[0].tag);
    }
    expect(firsts).toEqual(new Set(['Senjata', 'Pasif']));
  });

  it('upgrade yang sudah dimiliki lebih sering muncul', () => {
    const count = (levels: Record<string, number>) => {
      let n = 0;
      for (let i = 0; i < 3000; i++) if (rollChoices(levels).some((u) => u.id === 'regen')) n++;
      return n;
    };
    expect(count({ regen: 1 })).toBeGreaterThan(count({}) * 1.2);
  });

  it('pusaka tidak pernah muncul di kartu biasa', () => {
    for (let i = 0; i < 200; i++) expect(rollChoices({}).every((u) => u.tag !== 'Pusaka')).toBe(true);
  });
});

describe('variasi kartu', () => {
  it('ada setidaknya 25 upgrade dan 10 pusaka, dengan semua kelangkaan', () => {
    expect(UPGRADES.length).toBeGreaterThanOrEqual(25);
    expect(SPECIAL_UPGRADES).toHaveLength(10);
    expect(new Set(UPGRADES.map((u) => u.rarity))).toEqual(new Set(['common', 'rare', 'epic']));
  });

  it('kartu epik lebih jarang daripada kartu biasa', () => {
    const seen = (id: string) => {
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollChoices({}).some((u) => u.id === id)) n++;
      return n;
    };
    expect(seen('phoenix')).toBeLessThan(seen('tome') * 0.6);
  });

  it('keberuntungan membuat kartu epik lebih sering', () => {
    const phoenix = UPGRADES.find((u) => u.id === 'phoenix')!;
    expect(cardWeight(phoenix, {}, 3)).toBeGreaterThan(cardWeight(phoenix, {}, 0) * 2);
    const tome = UPGRADES.find((u) => u.id === 'tome')!;
    expect(cardWeight(tome, {}, 3)).toBe(cardWeight(tome, {}, 0));
  });

  it('upgrade khusus hanya muncul kalau senjatanya sudah dimiliki', () => {
    for (let i = 0; i < 400; i++) {
      const ids = rollChoices({}).map((u) => u.id);
      expect(ids).not.toContain('whet');
      expect(ids).not.toContain('runestone');
    }
    let found = false;
    for (let i = 0; i < 2000 && !found; i++) found = rollChoices({ orbit: 1 }).some((u) => u.id === 'whet');
    expect(found).toBe(true);
  });

  it('dua ratus pilihan menghasilkan banyak kombinasi berbeda, bukan itu-itu saja', () => {
    const combos = new Set<string>();
    for (let i = 0; i < 200; i++) combos.add(rollChoices({}).map((u) => u.id).sort().join());
    expect(combos.size).toBeGreaterThan(60);
  });
});

describe('rollSpecials', () => {
  it('minimal satu kartu adalah pusaka yang belum dimiliki, selama masih ada', () => {
    const levels = { meteor: 1, rain: 1, thunder: 1, moon: 1, ravens: 1, tornado: 1, flames: 1, holy: 1, frost: 1 };
    for (let i = 0; i < 100; i++) expect(rollSpecials(levels).map((u) => u.id)).toContain('quake');
  });

  it('semua pusaka bisa muncul', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) rollSpecials({}).forEach((u) => seen.add(u.id));
    expect(seen.size).toBe(SPECIAL_UPGRADES.length);
  });

  it('hanya level kelipatan lima', () => {
    expect([1, 4, 5, 6, 10, 15, 16].filter(isSpecialLevel)).toEqual([5, 10, 15]);
  });

  it('menawarkan tiga pusaka berbeda', () => {
    for (let i = 0; i < 100; i++) {
      const ids = rollSpecials({}).map((u) => u.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it('pusaka tingkat tertinggi tidak ditawarkan lagi, dan kosong kalau semuanya sudah penuh', () => {
    const levels = Object.fromEntries(SPECIAL_UPGRADES.map((u) => [u.id, u.max]));
    expect(rollSpecials(levels)).toEqual([]);
    delete levels.moon;
    expect(rollSpecials(levels).map((u) => u.id)).toEqual(['moon']);
  });

  it('mengambil pusaka mencatat tingkatnya di stats', () => {
    const s = baseStats();
    const meteor = SPECIAL_UPGRADES.find((u) => u.id === 'meteor')!;
    meteor.apply(s, 1);
    expect(s.specials.meteor).toBe(1);
    meteor.apply(s, 2);
    expect(s.specials.meteor).toBe(2);
  });
});

describe('daftar upgrade', () => {
  it('id unik dan setiap kartu punya teks serta ikon', () => {
    expect(new Set(ALL_UPGRADES.map((u) => u.id)).size).toBe(ALL_UPGRADES.length);
    for (const u of ALL_UPGRADES) {
      expect(u.name).not.toBe('');
      expect(u.icon).toContain('<svg');
      for (let lv = 1; lv <= u.max; lv++) expect(u.desc(lv)).not.toBe('');
    }
  });

  it('setiap kartu menampilkan perubahan angka yang berbeda antara sebelum dan sesudah', () => {
    for (const u of ALL_UPGRADES) {
      for (let lv = 1; lv <= u.max; lv++) {
        const rows = u.stats(lv);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.label).not.toBe('');
          expect(r.to).not.toBe(r.from);
          expect(`${r.from}${r.to}`).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });
});
