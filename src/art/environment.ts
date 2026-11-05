import * as Phaser from 'phaser';
import { PALETTE } from '../config';
import { makeTexture, makeTile, mix, rgba, seeded, type Ctx } from './kit';

const G = PALETTE.ground;
export const TILE_PX = 512;
export const NOISE_PX = 256;

function blotches(ctx: Ctx, stamp: (fn: (ox: number, oy: number) => void) => void, rng: () => number, colors: string[], n: number, minR: number, maxR: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const x = rng() * TILE_PX;
    const y = rng() * TILE_PX;
    const r = minR + rng() * (maxR - minR);
    const color = colors[Math.floor(rng() * colors.length)];
    stamp((ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
}

/** Padang rumput: lapisan gerombolan warna, lalu ribuan helai yang menghadap ke atas. */
function grassTile(scene: Phaser.Scene) {
  makeTile(scene, 'groundGrass', TILE_PX, (ctx, stamp) => {
    const rng = seeded(11);
    ctx.fillStyle = G.grass;
    ctx.fillRect(0, 0, TILE_PX, TILE_PX);
    blotches(ctx, stamp, rng, [G.grassDeep, G.grassDeep, G.grassLight, G.grassGold], 46, 40, 110, 0.32);

    const shades = [G.grassDeep, mix(G.grass, G.grassDeep, 0.5), G.grass, mix(G.grass, G.grassLight, 0.5), G.grassLight, G.grassGold];
    ctx.lineCap = 'round';
    for (let i = 0; i < 6800; i++) {
      const x = rng() * TILE_PX;
      const y = rng() * TILE_PX;
      const len = 5 + rng() * 11;
      const lean = (rng() - 0.5) * 7;
      const pick = Math.pow(rng(), 1.15);
      ctx.strokeStyle = rgba(shades[Math.floor(pick * shades.length)], 0.34 + rng() * 0.4);
      ctx.lineWidth = 0.9 + rng() * 1.3;
      const blade = (ox: number, oy: number) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + lean * 0.2, y + oy - len * 0.6, x + ox + lean, y + oy - len);
        ctx.stroke();
      };
      if (x > 20 && x < TILE_PX - 20 && y > 20 && y < TILE_PX - 20) blade(0, 0);
      else stamp(blade);
    }
    // Bunga kecil yang jarang, supaya mata punya titik istirahat
    for (let i = 0; i < 34; i++) {
      const x = 12 + rng() * (TILE_PX - 24);
      const y = 12 + rng() * (TILE_PX - 24);
      const color = rng() < 0.6 ? G.flowerA : G.flowerB;
      ctx.fillStyle = rgba(G.grassDeep, 0.55);
      ctx.beginPath();
      ctx.arc(x + 0.6, y + 1.2, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * Math.PI * 2 + rng();
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function dirtTile(scene: Phaser.Scene) {
  makeTile(scene, 'groundDirt', TILE_PX, (ctx, stamp) => {
    const rng = seeded(23);
    ctx.fillStyle = G.dirt;
    ctx.fillRect(0, 0, TILE_PX, TILE_PX);
    blotches(ctx, stamp, rng, [G.dirtDark, G.dirtLight], 40, 30, 90, 0.34);
    for (let i = 0; i < 1500; i++) {
      const x = rng() * TILE_PX;
      const y = rng() * TILE_PX;
      ctx.fillStyle = rgba(rng() < 0.5 ? G.dirtDark : G.dirtLight, 0.3 + rng() * 0.4);
      ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 1.5);
    }
    for (let i = 0; i < 46; i++) {
      const x = 12 + rng() * (TILE_PX - 24);
      const y = 12 + rng() * (TILE_PX - 24);
      const r = 2 + rng() * 3.6;
      ctx.fillStyle = rgba(G.dirtDark, 0.7);
      ctx.beginPath();
      ctx.ellipse(x + 0.8, y + 1.5, r, r * 0.74, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix(G.stone, G.dirtLight, rng());
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.74, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Lantai batu kuno: lempengan tak beraturan dengan celah berlumut. */
function stoneTile(scene: Phaser.Scene) {
  makeTile(scene, 'groundStone', TILE_PX, (ctx, stamp) => {
    const rng = seeded(37);
    ctx.fillStyle = mix(G.moss, G.stoneDark, 0.4);
    ctx.fillRect(0, 0, TILE_PX, TILE_PX);
    const cell = TILE_PX / 4;
    for (let cy = 0; cy < 4; cy++) {
      const shift = cy % 2 ? cell / 2 : 0;
      for (let cx = 0; cx < 4; cx++) {
        const x = cx * cell + shift + 3 + rng() * 3;
        const y = cy * cell + 3 + rng() * 3;
        const w = cell - 8 - rng() * 4;
        const h = cell - 8 - rng() * 4;
        const tone = mix(G.stone, rng() < 0.5 ? G.stoneLight : G.stoneDark, rng() * 0.55);
        const moss = rng();
        const crack = rng();
        const crackX = 0.25 + rng() * 0.5;
        const bendA = (rng() - 0.5) * 0.3;
        const bendB = (rng() - 0.5) * 0.3;
        stamp((ox, oy) => {
          ctx.fillStyle = rgba(G.stoneDark, 0.9);
          ctx.beginPath();
          ctx.roundRect(x + ox, y + oy + 2.5, w, h, 11);
          ctx.fill();
          const g = ctx.createLinearGradient(0, y + oy, 0, y + oy + h);
          g.addColorStop(0, mix(tone, G.stoneLight, 0.22));
          g.addColorStop(1, tone);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(x + ox, y + oy, w, h, 11);
          ctx.fill();
          if (crack < 0.5) {
            ctx.strokeStyle = rgba(G.stoneDark, 0.8);
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(x + ox + w * crackX, y + oy + 4);
            ctx.lineTo(x + ox + w * (crackX + bendA), y + oy + h * 0.28);
            ctx.lineTo(x + ox + w * (crackX + bendB), y + oy + h * 0.55);
            if (crack < 0.25) ctx.lineTo(x + ox + w * (crackX + bendA - bendB), y + oy + h - 8);
            ctx.stroke();
          }
          if (moss < 0.45) {
            const m = ctx.createRadialGradient(x + ox + 8, y + oy + h - 8, 0, x + ox + 8, y + oy + h - 8, 34);
            m.addColorStop(0, rgba(G.moss, 0.85));
            m.addColorStop(1, rgba(G.moss, 0));
            ctx.fillStyle = m;
            ctx.beginPath();
            ctx.roundRect(x + ox, y + oy, w, h, 11);
            ctx.fill();
          }
        });
      }
    }
  });
}

/** Noise berulang tiga saluran independen: pola warna, jalan setapak, dan reruntuhan. */
function noiseTile(scene: Phaser.Scene) {
  const size = NOISE_PX;
  const key = 'groundNoise';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const channels: Float32Array[] = [];

  for (let ch = 0; ch < 3; ch++) {
    const rng = seeded(101 + ch * 17);
    const field = new Float32Array(size * size);
    let amp = 1;
    // Saluran hijau (jalan) dan biru (reruntuhan) dibuat halus: lengkungan panjang, tanpa bercak kecil
    const maxPeriod = ch === 1 ? 8 : ch === 2 ? 8 : 32;
    for (let period = 4; period <= maxPeriod; period *= 2) {
      const grid = Float32Array.from({ length: period * period }, () => rng());
      const cell = size / period;
      for (let y = 0; y < size; y++) {
        const gy = y / cell;
        const y0 = Math.floor(gy);
        let fy = gy - y0;
        fy = fy * fy * (3 - 2 * fy);
        const r0 = (y0 % period) * period;
        const r1 = ((y0 + 1) % period) * period;
        for (let x = 0; x < size; x++) {
          const gx = x / cell;
          const x0 = Math.floor(gx);
          let fx = gx - x0;
          fx = fx * fx * (3 - 2 * fx);
          const c0 = x0 % period;
          const c1 = (x0 + 1) % period;
          const top = grid[r0 + c0] * (1 - fx) + grid[r0 + c1] * fx;
          const bot = grid[r1 + c0] * (1 - fx) + grid[r1 + c1] * fx;
          field[y * size + x] += (top * (1 - fy) + bot * fy) * amp;
        }
      }
      amp *= 0.5;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of field) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const k = 1 / (max - min);
    for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) * k;
    channels.push(field);
  }

  for (let i = 0; i < size * size; i++) {
    const p = i * 4;
    img.data[p] = channels[0][i] * 255;
    img.data[p + 1] = channels[1][i] * 255;
    img.data[p + 2] = channels[2][i] * 255;
    img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
}

export function createEnvironment(scene: Phaser.Scene) {
  grassTile(scene);
  dirtTile(scene);
  stoneTile(scene);
  noiseTile(scene);

  // Bayangan lembut: elips hitam yang diputar dan diregangkan mengikuti arah matahari
  makeTexture(scene, 'shadow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(14,10,20,1)');
    g.addColorStop(0.55, 'rgba(14,10,20,0.75)');
    g.addColorStop(1, 'rgba(14,10,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}
