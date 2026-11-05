import { ENEMIES, RUN_SECONDS, SPAWN, SPECIALS, type EnemyKind, type SpecialId } from './config';

/**
 * Rumus keseimbangan musuh terhadap pemain. Semuanya fungsi murni, jadi bisa diuji tanpa game.
 * Gagasan utamanya: musuh mengikuti "level efektif", yaitu campuran level pemain dan level acuan
 * menurut waktu. Pemain yang tertinggal tidak tenggelam, pemain yang kuat mendapat lawan sepadan.
 */

/** Level yang wajar dicapai pada detik ke-t. */
export const expectedLevel = (t: number) =>
  1 + SPAWN.levelSpan * Math.pow(Math.min(1, Math.max(0, t) / RUN_SECONDS), SPAWN.levelCurve);

export const effectiveLevel = (t: number, level: number) =>
  SPAWN.levelWeight * level + (1 - SPAWN.levelWeight) * expectedLevel(t);

/** Jumlah musuh hidup yang dituju pada level efektif ini. */
export const targetPopulation = (lv: number) =>
  Math.min(SPAWN.maxEnemies, Math.round(SPAWN.popBase + SPAWN.popPerLevel * lv));

/** Musuh per detik. Mengisi kekurangan populasi, jadi membersihkan gelombang memberi jeda singkat. */
export function spawnRate(alive: number, lv: number) {
  const missing = targetPopulation(lv) - alive;
  if (missing <= 0) return 0;
  const max = SPAWN.rateBase + SPAWN.ratePerLevel * lv;
  return Math.max(SPAWN.rateMin, Math.min(max, missing * SPAWN.fillRate));
}

export const enemyHpMul = (lv: number) => 1 + SPAWN.hpPerLevel * Math.max(0, lv - 1);

export const enemyDamageMul = (lv: number) => 1 + SPAWN.damagePerLevel * Math.max(0, lv - 1);

export const enemySpeedMul = (lv: number) => 1 + SPAWN.speedPerLevel * Math.max(0, lv - 1);

export const swarmSize = (lv: number) => Math.round(SPAWN.swarmBase + SPAWN.swarmPerLevel * lv);

const ramp = (lv: number, from: number, span: number, max: number) =>
  Math.max(0, Math.min(max, ((lv - from) / span) * max));

/** Memilih jenis musuh. `roll` adalah angka acak 0..1. */
export function pickKind(lv: number, roll: number): EnemyKind {
  const blob = ramp(lv, SPAWN.blobFromLevel, SPAWN.blobRamp, SPAWN.blobMax);
  const brute = ramp(lv, SPAWN.bruteFromLevel, SPAWN.bruteRamp, SPAWN.bruteMax);
  const r = roll * (1 + blob + brute);
  return r < 1 ? 'drone' : r < 1 + blob ? 'blob' : 'brute';
}

/**
 * Kerusakan pusaka mengikuti HP musuh saat itu, supaya pusaka selalu terasa kuat:
 * musuh kecil mati sekali kena, musuh besar dan bos terluka secara nyata.
 */
export const specialDamage = (id: SpecialId, tier: number, hpMul: number, damageMul: number) =>
  SPECIALS[id][tier].damage * hpMul * damageMul;

export const enemyHp = (kind: EnemyKind, lv: number) => ENEMIES[kind].hp * enemyHpMul(lv);
