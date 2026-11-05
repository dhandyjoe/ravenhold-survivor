import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../../src/storage';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

afterEach(() => vi.unstubAllGlobals());

describe('simpanan', () => {
  it('memakai nilai awal kalau belum ada data', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(load()).toEqual({ bestTime: 0, bestKills: 0, bestLevel: 0, glow: null });
  });

  it('menyimpan dan memuat kembali, termasuk pilihan efek cahaya', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    save({ bestTime: 120, bestKills: 50, bestLevel: 7, glow: false });
    expect(load()).toEqual({ bestTime: 120, bestKills: 50, bestLevel: 7, glow: false });
  });

  it('tidak melempar error kalau data rusak atau localStorage diblokir', () => {
    const broken = memoryStorage();
    broken.setItem('lumen-survivor-v1', '{rusak');
    vi.stubGlobal('localStorage', broken);
    expect(load().bestTime).toBe(0);

    const blocked = () => {
      throw new Error('diblokir');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(load().bestTime).toBe(0);
    expect(() => save({ bestTime: 1, bestKills: 1, bestLevel: 1, glow: null })).not.toThrow();
  });
});
