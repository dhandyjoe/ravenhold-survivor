import { describe, expect, it, vi } from 'vitest';
import { CAPE_FRAMES, HERO_IDLE, HERO_WALK, capeFrame, heroFrame, type HeroView } from '../../src/art/hero';
import { mix, rgba, seeded } from '../../src/art/kit';
import { normalMapFrom } from '../../src/art/normal';

const VIEWS: HeroView[] = [0, 1, 2, 3];

describe('indeks frame pemain', () => {
  it('setiap arah dan langkah menunjuk frame berbeda, tanpa celah', () => {
    const seen = new Set<number>();
    for (const v of VIEWS) {
      for (let i = 0; i < HERO_IDLE; i++) seen.add(heroFrame(v, false, i));
      for (let i = 0; i < HERO_WALK; i++) seen.add(heroFrame(v, true, i));
    }
    const total = VIEWS.length * (HERO_IDLE + HERO_WALK);
    expect(seen.size).toBe(total);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(total - 1);
  });

  it('langkah berulang kembali ke awal siklus', () => {
    expect(heroFrame(2, true, HERO_WALK)).toBe(heroFrame(2, true, 0));
    expect(heroFrame(1, false, HERO_IDLE + 1)).toBe(heroFrame(1, false, 1));
    expect(capeFrame(3, CAPE_FRAMES)).toBe(capeFrame(3, 0));
  });
});

describe('perkakas warna', () => {
  it('mix menghasilkan hex yang bisa dicampur lagi', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#ff0000', '#0000ff', 0.5)).toBe('#800080');
    expect(mix(mix('#000000', '#ffffff', 0.5), '#000000', 1)).toBe('#000000');
  });

  it('rgba', () => {
    expect(rgba('#102030', 0.5)).toBe('rgba(16,32,48,0.5)');
  });

  it('seeded selalu sama untuk seed yang sama, supaya gambar tidak berubah tiap dimuat', () => {
    const a = seeded(42);
    const b = seeded(42);
    const c = seeded(43);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(c()).not.toBe(seqA[0]);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('normal map', () => {
  /** Kanvas palsu berisi lingkaran putih di tengah, supaya arah normalnya bisa diperiksa. */
  function disc(size: number, r: number) {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inside = Math.hypot(x - size / 2, y - size / 2) < r;
        data.set(inside ? [255, 255, 255, 255] : [0, 0, 0, 0], (y * size + x) * 4);
      }
    }
    return { width: size, height: size, getContext: () => ({ getImageData: () => ({ data }) }) } as unknown as HTMLCanvasElement;
  }

  function generate(size: number, r: number) {
    let out: Uint8ClampedArray = new Uint8ClampedArray();
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (img: { data: Uint8ClampedArray }) => (out = img.data),
        }),
      }),
    });
    normalMapFrom(disc(size, r), { pillow: 3, detail: 0 });
    vi.unstubAllGlobals();
    return (x: number, y: number) => out.slice((y * size + x) * 4, (y * size + x) * 4 + 4);
  }

  const N = 64;
  const at = generate(N, 20);
  const c = N / 2;

  it('tepi kiri menghadap kiri dan tepi kanan menghadap kanan', () => {
    expect(at(c - 20, c)[0]).toBeLessThan(110);
    expect(at(c + 20, c)[0]).toBeGreaterThan(146);
  });

  it('tepi atas menghadap ke atas layar (konvensi GL, hijau tinggi)', () => {
    expect(at(c, c - 20)[1]).toBeGreaterThan(146);
    expect(at(c, c + 20)[1]).toBeLessThan(110);
  });

  it('tengah dan area kosong menghadap lurus ke kamera', () => {
    for (const [x, y] of [[c, c], [1, 1]]) {
      const [r, g, b] = at(x, y);
      expect(Math.abs(r - 127.5)).toBeLessThan(4);
      expect(Math.abs(g - 127.5)).toBeLessThan(4);
      expect(b).toBeGreaterThan(250);
    }
  });

  it('alpha selalu penuh agar warna normal tidak rusak oleh premultiply', () => {
    expect(at(1, 1)[3]).toBe(255);
    expect(at(c, c)[3]).toBe(255);
  });
});
