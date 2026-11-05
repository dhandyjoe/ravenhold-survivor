import { describe, expect, it } from 'vitest';
import { QUALITY } from '../../src/config';
import { FrameGovernor, renderSize } from '../../src/quality';

describe('renderSize', () => {
  it('memakai devicePixelRatio, dibatasi maksimum', () => {
    expect(renderSize(1000, 500, 1, Infinity)).toEqual({ width: 1000, height: 500 });
    expect(renderSize(1000, 500, 2, Infinity)).toEqual({ width: 2000, height: 1000 });
    expect(renderSize(1000, 500, 3, Infinity)).toEqual({ width: 2000, height: 1000 });
  });

  it('mengecilkan canvas sampai batas piksel, dengan rasio layar yang sama', () => {
    const s = renderSize(1440, 900, 2, 1_500_000);
    expect(s.width * s.height).toBeLessThanOrEqual(1_501_000);
    expect(s.width / s.height).toBeCloseTo(1440 / 900, 2);
  });

  it('tidak pernah membesar melebihi ukuran asli demi memenuhi batas', () => {
    expect(renderSize(800, 600, 1, 5_000_000)).toEqual({ width: 800, height: 600 });
  });
});

describe('FrameGovernor', () => {
  /** Mengirim frame sampai satu jendela selesai, mengembalikan apakah kualitas diminta turun. */
  const window_ = (g: FrameGovernor, ms: number) => {
    let asked = false;
    for (let i = 0; i < QUALITY.windowFrames + QUALITY.settleFrames; i++) asked = g.sample(ms) || asked;
    return asked;
  };

  it('diam saat frame lancar', () => {
    const g = new FrameGovernor();
    for (let i = 0; i < 10; i++) expect(window_(g, 16.7)).toBe(false);
  });

  it('meminta turun tingkat saat banyak frame terlambat', () => {
    expect(window_(new FrameGovernor(), 33)).toBe(true);
  });

  it('satu dua frame lambat tidak memicu apa pun', () => {
    const g = new FrameGovernor();
    let asked = false;
    for (let i = 0; i < QUALITY.windowFrames + QUALITY.settleFrames; i++) asked = g.sample(i % 40 === 0 ? 40 : 16.7) || asked;
    expect(asked).toBe(false);
  });

  it('jeda panjang karena pindah tab diabaikan', () => {
    const g = new FrameGovernor();
    let asked = false;
    for (let i = 0; i < QUALITY.windowFrames * 3; i++) asked = g.sample(5000) || asked;
    expect(asked).toBe(false);
  });

  it('berhenti setelah turun tingkat terbukti sia-sia, misalnya layar dibatasi 30 Hz', () => {
    const g = new FrameGovernor();
    const asks = Array.from({ length: 8 }, () => window_(g, 33)).filter(Boolean).length;
    expect(asks).toBeLessThanOrEqual(QUALITY.futileLimit + 1);
  });

  it('terus turun selama hasilnya membaik', () => {
    const g = new FrameGovernor();
    const feed = (slowCount: number) => {
      let asked = false;
      for (let i = 0; i < QUALITY.windowFrames + QUALITY.settleFrames; i++) asked = g.sample(i < slowCount + QUALITY.settleFrames ? 33 : 16.7) || asked;
      return asked;
    };
    expect(feed(100)).toBe(true);
    expect(feed(60)).toBe(true);
    expect(feed(30)).toBe(true);
  });

  it('tingkat kualitas makin ringan dan batas piksel tidak pernah naik', () => {
    QUALITY.tiers.slice(1).forEach((tier, i) => {
      expect(tier.maxPixels).toBeLessThanOrEqual(QUALITY.tiers[i].maxPixels);
      expect(Number(tier.bloom)).toBeLessThanOrEqual(Number(QUALITY.tiers[i].bloom));
      expect(Number(tier.lights)).toBeLessThanOrEqual(Number(QUALITY.tiers[i].lights));
    });
  });
});
