import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

/** Warna condong biru: biru jelas lebih kuat dari merah, dan tidak kalah dari hijau. */
const isBlue = (r: number, g: number, b: number) => b > r + 16 && b >= g;

function colorsIn(source: string) {
  const out: { text: string; r: number; g: number; b: number }[] = [];
  for (const m of source.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const n = parseInt(m[1], 16);
    out.push({ text: m[0], r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
  }
  for (const m of source.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) out.push({ text: m[0], r: +m[1], g: +m[2], b: +m[3] });
  return out;
}

describe('warna UI mengikuti tema kayu dan perkamen', () => {
  it('tidak ada warna biru di style.css dan index.html', () => {
    const blue = colorsIn(read('src/style.css') + read('index.html')).filter((c) => isBlue(c.r, c.g, c.b));
    expect(blue.map((c) => c.text)).toEqual([]);
  });
});

describe('aturan performa UI', () => {
  it('tidak memakai backdrop-filter, karena blur di atas canvas dihitung ulang tiap frame', () => {
    expect(read('src/style.css')).not.toMatch(/^\s*(-webkit-)?backdrop-filter\s*:/m);
  });
});
