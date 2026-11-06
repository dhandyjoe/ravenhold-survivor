import { AUDIO } from './config';

// localStorage bisa dimatikan browser (mode privat, dll), jadi selalu dibungkus try/catch.

export interface SaveData {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  glow: boolean | null; // null = otomatis
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
  muted: boolean;
}

// Nama lama sengaja dipertahankan, supaya rekor pemain tidak hilang setelah game berganti nama.
const KEY = 'lumen-survivor-v1';
const defaults: SaveData = { bestTime: 0, bestKills: 0, bestLevel: 0, glow: null, musicVol: AUDIO.musicVolume, sfxVol: AUDIO.sfxVolume, muted: false };

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* abaikan */
  }
  return { ...defaults };
}

export function save(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* abaikan */
  }
}
