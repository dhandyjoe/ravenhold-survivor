import { describe, expect, it } from 'vitest';
import { effectiveLevel, enemyDamageMul, enemyHpMul, expectedLevel, pickKind, spawnRate, specialDamage, swarmSize, targetPopulation } from '../../src/balance';
import { ENEMIES, GEAR, MAX_LEVEL, PLAYER, RUN_SECONDS, SPAWN, SPECIALS, SPECIAL_EVERY, WEAPON, xpForLevel, type SpecialId } from '../../src/config';
import { UPGRADES, baseStats } from '../../src/upgrades';

/**
 * Penjaga angka balancing. Kalau balancing memang sengaja diubah,
 * perbarui angka di sini bersamaan dengan perubahannya.
 */
const XP_CURVE = [6, 12, 19, 35, 85, 238, 614, 2021];

describe('angka dasar', () => {
  it('pemain', () => {
    expect(PLAYER).toEqual({ radius: 14, speed: 215, maxHp: 100, invulnMs: 550, baseMagnet: 70, gemRecallFactor: 1.35 });
  });

  it('senjata', () => {
    expect(WEAPON).toEqual({
      boltDamage: 13,
      boltCooldown: 0.5,
      boltSpeed: 540,
      boltLife: 1.0,
      boltRadius: 6,
      orbitRadius: 74,
      orbitSpeed: 2.6,
      orbitDamage: 9,
      orbitHitCooldown: 0.45,
      novaDamage: 22,
      novaRadius: 130,
      novaCooldown: 3.2,
    });
  });

  it.each([
    ['drone', { hp: 12, speed: 78, damage: 5, radius: 11, xp: 1, boss: false }],
    ['blob', { hp: 32, speed: 58, damage: 10, radius: 13, xp: 3, boss: false }],
    ['brute', { hp: 95, speed: 42, damage: 18, radius: 22, xp: 8, boss: false }],
    ['titan', { hp: 1600, speed: 52, damage: 30, radius: 44, xp: 60, boss: true }],
    ['wyrm', { hp: 2200, speed: 60, damage: 34, radius: 44, xp: 90, boss: true }],
  ] as const)('musuh %s', (kind, stats) => {
    expect(ENEMIES[kind]).toMatchObject(stats);
  });

  it('lama ronde, level maksimum, dan jadwal bos', () => {
    expect(RUN_SECONDS).toBe(900);
    expect(MAX_LEVEL).toBe(50);
    expect(SPAWN.bosses).toEqual([
      { at: 300, kind: 'titan' },
      { at: 570, kind: 'wyrm' },
      { at: 810, kind: 'titan' },
    ]);
    for (const b of SPAWN.bosses) expect(b.at).toBeLessThan(RUN_SECONDS);
  });

  it('kurva XP', () => {
    expect([1, 2, 3, 5, 10, 20, 30, 49].map(xpForLevel)).toEqual(XP_CURVE);
    for (let lv = 2; lv < MAX_LEVEL; lv++) expect(xpForLevel(lv)).toBeGreaterThan(xpForLevel(lv - 1));
  });

  it('efek setiap upgrade', () => {
    const after = (id: string) => {
      const s = baseStats();
      const heal = UPGRADES.find((u) => u.id === id)!.apply(s, 1);
      return { s, heal };
    };
    expect(after('power').s.damageMul).toBe(1.25);
    expect(after('rate').s.cooldownMul).toBe(0.88);
    expect(after('multi').s.projectiles).toBe(2);
    expect(after('pierce').s).toMatchObject({ pierce: 1, boltSpeedMul: 1.15 });
    expect(after('orbit').s.orbitCount).toBe(1);
    expect(after('nova').s.novaLevel).toBe(1);
    expect(after('speed').s.speedMul).toBe(1.1);
    expect(after('magnet').s.magnetMul).toBe(1.4);
    expect(after('vital')).toMatchObject({ s: { maxHp: 120 }, heal: 30 });
    expect(after('regen').s.regen).toBe(0.6);
    expect(after('poison').s.poison).toBe(1);
    expect(after('chill').s.frost).toBe(1);
    expect(after('explode').s.explode).toBe(1);
    expect(after('ricochet').s.ricochet).toBe(1);
    expect(after('quiver').s.doubleShot).toBe(GEAR.doubleShot);
    expect(after('whet').s).toMatchObject({ orbitMul: 1.4, orbitBonus: GEAR.whetRadius });
    expect(after('runestone').s).toMatchObject({ novaMul: 1.35, novaArea: 1.1 });
    expect(after('eagle').s.critChance).toBeCloseTo(0.13);
    expect(after('axe').s.critMul).toBe(2.5);
    expect(after('shield').s.armor).toBe(GEAR.armor);
    expect(after('shadow').s.dodge).toBe(GEAR.dodge);
    expect(after('thorn').s.thorns).toBe(1);
    expect(after('chalice').s.lifesteal).toBe(GEAR.lifesteal);
    expect(after('tome').s.xpMul).toBe(1.12);
    expect(after('gauntlet').s.knockMul).toBe(1.3);
    expect(after('clover').s.luck).toBe(1);
    expect(after('phoenix').s.revives).toBe(1);
    expect(after('headsman').s.execute).toBe(GEAR.execute);
    expect(after('glass').s).toMatchObject({ damageMul: 1.5, maxHp: 75 });
  });
});

describe('musuh sepadan dengan level pemain', () => {
  it('level acuan naik dari 1 sampai level maksimum selama ronde', () => {
    expect(expectedLevel(0)).toBe(1);
    expect(expectedLevel(RUN_SECONDS)).toBeCloseTo(MAX_LEVEL);
    expect(expectedLevel(RUN_SECONDS * 3)).toBeCloseTo(MAX_LEVEL);
  });

  it('musuh tetap wajar sampai level maksimum', () => {
    expect(enemyHpMul(MAX_LEVEL)).toBeLessThan(6);
    expect(enemyDamageMul(MAX_LEVEL)).toBeLessThan(2.5);
    expect(targetPopulation(MAX_LEVEL)).toBeLessThanOrEqual(SPAWN.maxEnemies);
  });

  it('pada waktu yang sama, pemain tertinggal menghadapi lebih sedikit musuh yang lebih lemah', () => {
    const t = 240;
    const behind = effectiveLevel(t, 6);
    const ahead = effectiveLevel(t, 25);
    expect(behind).toBeLessThan(ahead);
    expect(targetPopulation(behind)).toBeLessThan(targetPopulation(ahead));
    expect(enemyHpMul(behind)).toBeLessThan(enemyHpMul(ahead));
  });

  it('bermain lambat tetap makin berat seiring waktu', () => {
    expect(effectiveLevel(500, 8)).toBeGreaterThan(effectiveLevel(100, 8));
  });

  it('populasi wajar untuk tiap level, dan tidak pernah melewati batas', () => {
    expect(targetPopulation(1)).toBeLessThanOrEqual(15);
    expect(targetPopulation(6)).toBeLessThanOrEqual(40);
    expect(targetPopulation(30)).toBeLessThanOrEqual(150);
    expect(targetPopulation(999)).toBe(SPAWN.maxEnemies);
    expect(SPAWN.hardCap).toBeGreaterThan(SPAWN.maxEnemies);
  });

  it('spawn berhenti saat populasi penuh, dan mengisi cepat setelah gelombang dibersihkan', () => {
    const lv = 20;
    const full = targetPopulation(lv);
    expect(spawnRate(full, lv)).toBe(0);
    expect(spawnRate(full + 30, lv)).toBe(0);
    expect(spawnRate(0, lv)).toBeGreaterThan(spawnRate(full - 1, lv));
    expect(spawnRate(full - 1, lv)).toBeGreaterThanOrEqual(SPAWN.rateMin);
  });

  it('jenis musuh terbuka bertahap', () => {
    const kinds = (lv: number) => new Set(Array.from({ length: 200 }, (_, i) => pickKind(lv, i / 200)));
    expect([...kinds(1)]).toEqual(['drone']);
    expect(kinds(8).has('blob')).toBe(true);
    expect(kinds(8).has('brute')).toBe(false);
    expect(kinds(24).has('brute')).toBe(true);
    expect(kinds(24).has('titan')).toBe(false);
  });

  it('gelombang mengikuti level, tidak langsung menenggelamkan pemain baru', () => {
    expect(swarmSize(5)).toBeLessThanOrEqual(16);
    expect(swarmSize(30)).toBeGreaterThan(swarmSize(5));
  });
});

describe('senjata pusaka', () => {
  const ids = Object.keys(SPECIALS) as SpecialId[];

  it('ditawarkan setiap lima level, ada sepuluh senjata dengan tiga tingkat', () => {
    expect(SPECIAL_EVERY).toBe(5);
    expect(ids).toHaveLength(10);
    for (const id of ids) expect(SPECIALS[id]).toHaveLength(3);
  });

  it('setiap tingkat lebih kuat dan lebih sering dari sebelumnya', () => {
    for (const id of ids) {
      SPECIALS[id].slice(1).forEach((tier, i) => {
        const prev = SPECIALS[id][i];
        expect(tier.damage).toBeGreaterThan(prev.damage);
        expect(tier.cooldown).toBeLessThan(prev.cooldown);
        expect(tier.radius).toBeGreaterThan(prev.radius);
        expect(tier.count).toBeGreaterThan(prev.count);
      });
    }
  });

  it('di level apa pun, sekali kena mematikan goblin tanpa bantuan upgrade', () => {
    for (const lv of [1, 10, 30, 60]) {
      const hp = ENEMIES.drone.hp * enemyHpMul(lv);
      for (const id of ids) expect(specialDamage(id, 0, enemyHpMul(lv), 1)).toBeGreaterThanOrEqual(hp);
    }
  });

  it('bintang jatuh tingkat III mematikan ogre sekali ledak, karena memang senjata kerusakan besar', () => {
    const mul = enemyHpMul(30);
    expect(specialDamage('meteor', 2, mul, 1)).toBeGreaterThan(ENEMIES.brute.hp * mul);
  });
});
