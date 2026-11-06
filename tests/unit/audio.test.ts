import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIO, SPAWN } from '../../src/config';
import { CATALOG, SOUND_IDS } from '../../src/audioCatalog';
import { RateLimiter, ambientAt, gainForDistance, musicTrackAt, panFor, parseSoundName, phaseTrack, pickVariant, shouldRestart, tracksNeeded } from '../../src/audioMix';

describe('memilih musik', () => {
  it('menu, siklus hari, dan bos', () => {
    expect(musicTrackAt('menu', 0, null)).toBe('mus_menu');
    expect(musicTrackAt('playing', 0, null)).toBe('mus_pagi');
    expect(musicTrackAt('playing', AUDIO.senjaAt - 1, null)).toBe('mus_pagi');
    expect(musicTrackAt('playing', AUDIO.senjaAt, null)).toBe('mus_senja');
    expect(musicTrackAt('playing', AUDIO.malamAt, null)).toBe('mus_malam');
    expect(musicTrackAt('playing', 300, 'titan')).toBe('mus_bos_ksatria');
    expect(musicTrackAt('playing', 570, 'wyrm')).toBe('mus_bos_naga');
  });

  it('jeda dan pilih kartu tidak mengganti musik; layar akhir hening', () => {
    expect(musicTrackAt('paused', 400, null)).toBe('mus_senja');
    expect(musicTrackAt('levelup', 400, null)).toBe('mus_senja');
    expect(musicTrackAt('over', 400, null)).toBeNull();
  });

  it('suasana alam mengikuti fase yang sama dengan musik', () => {
    expect(ambientAt('menu', 0)).toBeNull();
    for (const t of [0, AUDIO.senjaAt, AUDIO.malamAt]) {
      expect(ambientAt('playing', t)).toBe(phaseTrack(t).replace('mus_', 'amb_'));
    }
  });
});

describe('trek yang disimpan di memori', () => {
  it('memuat fase berikutnya lebih awal', () => {
    expect(tracksNeeded(10)).toEqual(['mus_pagi']);
    expect(tracksNeeded(AUDIO.senjaAt - AUDIO.lookahead + 1)).toContain('mus_senja');
  });

  it('trek bos hanya ada di sekitar kemunculan bosnya', () => {
    const { at, kind } = SPAWN.bosses[0];
    expect(kind).toBe('titan');
    expect(tracksNeeded(at - AUDIO.lookahead - 5)).not.toContain('mus_bos_ksatria');
    expect(tracksNeeded(at - 5)).toContain('mus_bos_ksatria');
    expect(tracksNeeded(at + AUDIO.bossWindow + 5)).not.toContain('mus_bos_ksatria');
  });

  it('tidak pernah lebih dari tiga trek sekaligus', () => {
    for (let t = 0; t <= 900; t += 5) expect(tracksNeeded(t).length).toBeLessThanOrEqual(3);
  });
});

describe('trek menyambung dirinya', () => {
  it('mulai lagi saat sisa waktu tinggal selebar crossfade', () => {
    expect(shouldRestart(100, 200, 3)).toBe(false);
    expect(shouldRestart(196.9, 200, 3)).toBe(false);
    expect(shouldRestart(197, 200, 3)).toBe(true);
  });

  it('trek yang terlalu pendek tidak pernah disambung (akan berkedip)', () => {
    expect(shouldRestart(5, 6, 3)).toBe(false);
  });
});

describe('nama file', () => {
  it('variasi bernomor dan tanpa nomor', () => {
    expect(parseSoundName('bow_shot_2')).toEqual({ id: 'bow_shot', variant: 2 });
    expect(parseSoundName('mus_menu')).toEqual({ id: 'mus_menu', variant: 1 });
    expect(parseSoundName('hit_flesh_10')).toEqual({ id: 'hit_flesh', variant: 10 });
  });

  it('semua musik yang direncanakan P1 sudah punya file dan kreditnya tercatat', () => {
    const dir = new URL('../../src/audio/files/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' });
    const credits = readFileSync(new URL('../../src/audio/files/CREDITS.md', import.meta.url), 'utf8');
    for (const id of ['mus_menu', 'mus_pagi', 'mus_senja', 'mus_malam', 'mus_bos_ksatria', 'mus_bos_naga']) {
      expect(files.some((f) => new RegExp(`(^|/)${id}\\.(mp3|m4a)$`).test(f)), id).toBe(true);
      expect(credits, id).toContain(id);
    }
  });
});

describe('posisi suara', () => {
  it('pan mengikuti sisi dan dibatasi', () => {
    expect(panFor(0, 400)).toBe(0);
    expect(panFor(-200, 400)).toBeLessThan(0);
    expect(panFor(9999, 400)).toBeCloseTo(AUDIO.panWidth);
    expect(panFor(100, 0)).toBe(0);
  });

  it('makin jauh makin pelan, dan hilang di luar jangkauan', () => {
    expect(gainForDistance(0)).toBe(1);
    expect(gainForDistance(AUDIO.hearRange)).toBeCloseTo(AUDIO.hearFloor);
    expect(gainForDistance(AUDIO.hearRange / 2)).toBeGreaterThan(gainForDistance(AUDIO.hearRange));
    expect(gainForDistance(AUDIO.hearRange * 2)).toBe(0);
  });
});

describe('pembatas laju', () => {
  it('menolak yang terlalu rapat dan menerima setelah jeda', () => {
    const r = new RateLimiter();
    expect(r.allow('hit', 10, 0)).toBe(true);
    expect(r.allow('hit', 10, 0.05)).toBe(false);
    expect(r.allow('hit', 10, 0.11)).toBe(true);
    expect(r.allow('lain', 10, 0.11)).toBe(true);
    expect(r.allow('bebas', undefined, 0)).toBe(true);
    expect(r.allow('bebas', undefined, 0)).toBe(true);
  });
});

describe('variasi', () => {
  it('tidak mengulang yang terakhir dan tetap dalam rentang', () => {
    for (let last = 0; last < 3; last++) {
      for (let i = 0; i < 50; i++) {
        const n = pickVariant(3, last);
        expect(n).not.toBe(last);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(3);
      }
    }
    expect(pickVariant(1, 0)).toBe(0);
  });
});

describe('katalog suara', () => {
  const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
  const code = ['scenes/GameScene.ts', 'specials.ts', 'ui.ts', 'audio.ts'].map(src).join('\n');

  it('tiap ID yang dipakai kode terdaftar', () => {
    const used = new Set([...code.matchAll(/(?:sfx|ui|stinger|loop|sound|onUiSound)\('([a-z0-9_]+)'/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(40);
    for (const id of used) expect(SOUND_IDS, id).toContain(id);
  });

  it('tiap suara P1 punya pemicu di kode', () => {
    for (const id of SOUND_IDS) {
      if (CATALOG[id].pri !== 1 || id.startsWith('mus_')) continue;
      expect(code, id).toContain(`'${id}'`);
    }
  });

  it('tiap file audio tercatat di CREDITS.md dan variasinya tidak melebihi rencana', () => {
    const dir = new URL('../../src/audio/files/', import.meta.url);
    const credits = readFileSync(new URL('../../src/audio/files/CREDITS.md', import.meta.url), 'utf8');
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(mp3|m4a)$/.test(f));
    const count: Record<string, number> = {};
    for (const f of files) {
      const base = f.slice(f.lastIndexOf('/') + 1).replace(/\.(mp3|m4a)$/, '');
      expect(credits, f).toContain(base);
      const { id } = parseSoundName(base);
      count[id] = (count[id] ?? 0) + 1;
    }
    for (const [id, n] of Object.entries(count)) expect(n, id).toBeLessThanOrEqual(CATALOG[id as keyof typeof CATALOG].files);
  });

  it('file yang sudah ada bernama sesuai katalog', () => {
    const dir = new URL('../../src/audio/files/', import.meta.url);
    let names: string[] = [];
    try {
      names = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(mp3|m4a)$/.test(f));
    } catch {
      return; // belum ada file: tidak apa-apa
    }
    for (const f of names) {
      const base = f.slice(f.lastIndexOf('/') + 1).replace(/\.(mp3|m4a)$/, '');
      expect(SOUND_IDS, f).toContain(parseSoundName(base).id);
    }
  });
});
