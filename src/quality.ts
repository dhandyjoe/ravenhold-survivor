import { QUALITY } from './config';

/** Batas piksel canvas saat ini. Dibaca setiap kali ukuran game dihitung, termasuk saat jendela berubah. */
export const resolution = { maxPixels: Infinity };

/** Ukuran canvas: ukuran layar x devicePixelRatio, lalu dikecilkan kalau melebihi batas piksel. */
export function renderSize(cssW: number, cssH: number, dpr: number, maxPixels: number) {
  const ratio = Math.min(dpr || 1, QUALITY.maxDpr);
  const scale = Math.min(ratio, Math.sqrt(maxPixels / Math.max(1, cssW * cssH)));
  return { width: Math.round(cssW * scale), height: Math.round(cssH * scale) };
}

/** Scale.FIT mengecilkan atau membesarkan canvas kembali ke ukuran layar. */
export const gameSize = () => renderSize(window.innerWidth, window.innerHeight, window.devicePixelRatio, resolution.maxPixels);

/**
 * Pengamat frame: memberi tahu kapan kualitas perlu diturunkan.
 * Layar yang dibatasi 30 Hz selalu terlihat terlambat walau kualitas sudah diturunkan,
 * jadi setelah beberapa kali turun tingkat tanpa hasil, pengamat berhenti supaya gambar tidak dikorbankan sia-sia.
 */
export class FrameGovernor {
  private count = 0;
  private slow = 0;
  private settle: number = QUALITY.settleFrames;
  private lastRatio: number | null = null;
  private futile = 0;
  private locked = false;

  /** Dipanggil sekali per frame. True berarti kualitas perlu turun satu tingkat. */
  sample(ms: number) {
    if (this.locked || ms > QUALITY.ignoreAboveMs) return false;
    if (this.settle > 0) {
      this.settle--;
      return false;
    }
    this.count++;
    if (ms > QUALITY.slowFrameMs) this.slow++;
    if (this.count < QUALITY.windowFrames) return false;

    const ratio = this.slow / this.count;
    this.count = 0;
    this.slow = 0;
    if (ratio < QUALITY.dropLimit) {
      this.lastRatio = null;
      this.futile = 0;
      return false;
    }
    if (this.lastRatio !== null) {
      this.futile = ratio > this.lastRatio * (1 - QUALITY.minImprovement) ? this.futile + 1 : 0;
      if (this.futile >= QUALITY.futileLimit) {
        this.locked = true;
        return false;
      }
    }
    this.lastRatio = ratio;
    this.settle = QUALITY.settleFrames;
    return true;
  }
}
