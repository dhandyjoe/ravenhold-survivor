import { describe, expect, it } from 'vitest';
import { SpatialHash } from '../../src/spatial';

const found = (h: SpatialHash, x: number, y: number, r: number) => {
  const ids: number[] = [];
  h.query(x, y, r, (id) => ids.push(id));
  return ids.sort((a, b) => a - b);
};

describe('SpatialHash', () => {
  it('menemukan item di sekitar dan melewati yang jauh', () => {
    const h = new SpatialHash(64);
    h.insert(1, 10, 10);
    h.insert(2, 40, 20);
    h.insert(3, 900, 900);
    expect(found(h, 20, 20, 30)).toEqual([1, 2]);
  });

  it('bekerja di koordinat negatif dan melintasi batas sel', () => {
    const h = new SpatialHash(64);
    h.insert(1, -5, -5);
    h.insert(2, 5, 5);
    h.insert(3, -500, 700);
    expect(found(h, 0, 0, 12)).toEqual([1, 2]);
    expect(found(h, -500, 700, 1)).toEqual([3]);
  });

  it('clear mengosongkan isi, dan pemakaian ulang tidak membawa data lama', () => {
    const h = new SpatialHash(64);
    h.insert(1, 10, 10);
    h.clear();
    expect(found(h, 10, 10, 30)).toEqual([]);
    h.insert(2, 500, 500);
    expect(found(h, 500, 500, 10)).toEqual([2]);
    expect(found(h, 10, 10, 30)).toEqual([]);
  });
});
