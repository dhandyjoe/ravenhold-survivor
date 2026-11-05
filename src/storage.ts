// localStorage bisa dimatikan browser (mode privat, dll), jadi selalu dibungkus try/catch.

export interface SaveData {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  glow: boolean | null; // null = otomatis
}

// Nama lama sengaja dipertahankan, supaya rekor pemain tidak hilang setelah game berganti nama.
const KEY = 'lumen-survivor-v1';
const defaults: SaveData = { bestTime: 0, bestKills: 0, bestLevel: 0, glow: null };

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
