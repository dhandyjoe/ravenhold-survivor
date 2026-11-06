import { AUDIO, SPAWN, type EnemyKind } from './config';
import type { SoundId } from './audioCatalog';

/** Logika murni audio: memilih trek, pan, jarak, dan batas laju. Tanpa Phaser, jadi bisa diuji unit. */

export type MusicState = 'menu' | 'playing' | 'levelup' | 'paused' | 'over';

export type BossCue = { at: number; kind: EnemyKind };

export function phaseTrack(runTime: number): 'mus_pagi' | 'mus_senja' | 'mus_malam' {
  if (runTime >= AUDIO.malamAt) return 'mus_malam';
  if (runTime >= AUDIO.senjaAt) return 'mus_senja';
  return 'mus_pagi';
}

export function bossTrack(kind: EnemyKind): 'mus_bos_ksatria' | 'mus_bos_naga' {
  return kind === 'wyrm' ? 'mus_bos_naga' : 'mus_bos_ksatria';
}

/** Trek musik yang harus berbunyi sekarang. Null berarti hening (mis. layar akhir, saat stinger berbunyi). */
export function musicTrackAt(state: MusicState, runTime: number, boss: EnemyKind | null): SoundId | null {
  if (state === 'menu') return 'mus_menu';
  if (state === 'over') return null;
  return boss ? bossTrack(boss) : phaseTrack(runTime);
}

export function ambientAt(state: MusicState, runTime: number): SoundId | null {
  if (state === 'menu' || state === 'over') return null;
  return runTime >= AUDIO.malamAt ? 'amb_malam' : runTime >= AUDIO.senjaAt ? 'amb_senja' : 'amb_pagi';
}

/**
 * Trek yang perlu ada di memori: yang sedang berbunyi, yang akan berbunyi dalam `lead` detik,
 * dan trek bos selama jendela bosnya. File musik di-decode jadi puluhan MB, jadi sisanya dibuang.
 */
export function tracksNeeded(runTime: number, bosses: readonly BossCue[] = SPAWN.bosses, lead = AUDIO.lookahead): SoundId[] {
  const out = new Set<SoundId>([phaseTrack(runTime), phaseTrack(runTime + lead)]);
  for (const b of bosses) {
    if (runTime >= b.at - lead && runTime <= b.at + AUDIO.bossWindow) out.add(bossTrack(b.kind));
  }
  return [...out];
}

/** Trek yang bukan loop menyambung dirinya sendiri: mulai lagi (dengan crossfade) saat sisa waktunya tinggal `fade` detik. */
export function shouldRestart(position: number, duration: number, fade: number): boolean {
  return duration > fade * 2 && position >= duration - fade;
}

/** Nama file `bow_shot_2` menjadi id `bow_shot` dan variasi 2; `mus_menu` tanpa nomor menjadi variasi 1. */
export function parseSoundName(base: string): { id: string; variant: number } {
  const m = /^(.+?)_(\d+)$/.exec(base);
  return m ? { id: m[1], variant: Number(m[2]) } : { id: base, variant: 1 };
}

/** Pan -panWidth..panWidth menurut posisi horizontal terhadap pendengar. */
export function panFor(dx: number, halfView: number): number {
  if (halfView <= 0) return 0;
  return Math.max(-1, Math.min(1, dx / halfView)) * AUDIO.panWidth;
}

/** Pengali volume menurut jarak: penuh di dekat, turun linear sampai `hearFloor`, nol lewat dua kali jangkauan. */
export function gainForDistance(dist: number): number {
  if (dist >= AUDIO.hearRange * 2) return 0;
  const t = Math.min(1, dist / AUDIO.hearRange);
  return 1 - t * (1 - AUDIO.hearFloor);
}

/** Membatasi seberapa sering satu suara (atau satu kelompok) boleh berbunyi. */
export class RateLimiter {
  private last = new Map<string, number>();

  allow(key: string, perSecond: number | undefined, now: number): boolean {
    if (!perSecond) return true;
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < 1 / perSecond) return false;
    this.last.set(key, now);
    return true;
  }

  clear() {
    this.last.clear();
  }
}

/** Memilih nomor variasi acak yang berbeda dari yang terakhir. */
export function pickVariant(count: number, last: number, rng: () => number = Math.random): number {
  if (count <= 1) return 0;
  const n = Math.floor(rng() * (count - 1));
  return n >= last ? n + 1 : n;
}
