import * as Phaser from 'phaser';
import { COLORS } from './config';

/**
 * Semua grafis dibuat secara prosedural lewat Canvas 2D, jadi tidak perlu file gambar.
 * Tekstur digambar 2x lebih besar (TEX_SCALE) lalu di-scale 0.5 di game,
 * supaya tetap tajam di layar HP yang devicePixelRatio-nya tinggi.
 *
 * Untuk mengganti dengan sprite buatan sendiri: muat PNG dengan key yang sama
 * di preload(), lalu hapus pemanggilan make...() yang bersangkutan.
 */
export const TEX_SCALE = 2;

function rgba(hexColor: string, a: number) {
  const n = parseInt(hexColor.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * TEX_SCALE);
  c.height = Math.ceil(h * TEX_SCALE);
  const ctx = c.getContext('2d')!;
  ctx.scale(TEX_SCALE, TEX_SCALE);
  draw(ctx);
  scene.textures.addCanvas(key, c);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function shadedFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, light: string, dark: string) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

function mix(a: string, b: string, t: number) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function createTextures(scene: Phaser.Scene) {
  // Pemain: bola cahaya dengan cincin dalam
  make(scene, 'player', 80, 80, (ctx) => {
    glow(ctx, 40, 40, 38, COLORS.player, 0.4);
    ctx.fillStyle = shadedFill(ctx, 40, 40, 14, '#e6fdff', COLORS.playerDeep);
    ctx.beginPath();
    ctx.arc(40, 40, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(13,14,26,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(40, 40, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(36, 36, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Penunjuk arah gerak pemain
  make(scene, 'aim', 16, 16, (ctx) => {
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(5, 3);
    ctx.lineTo(11, 8);
    ctx.lineTo(5, 13);
    ctx.stroke();
  });

  // Musuh. Setiap jenis punya dua versi: normal dan "-hit" (putih, untuk kilatan saat terkena).
  for (const hit of [false, true]) {
    const sfx = hit ? '-hit' : '';
    const body = (c: string) => (hit ? ['#ffffff', mix(c, '#ffffff', 0.7)] : [mix(c, '#ffffff', 0.35), mix(c, '#000000', 0.15)]);
    const halo = hit ? 0.18 : 0.32;

    // Segitiga cepat
    make(scene, 'drone' + sfx, 56, 56, (ctx) => {
      const [l, d] = body(COLORS.drone);
      glow(ctx, 28, 28, 26, COLORS.drone, halo);
      polygon(ctx, 28, 28, 13, 3, 0);
      ctx.fillStyle = shadedFill(ctx, 28, 28, 13, l, d);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = hit ? '#ffffff' : mix(COLORS.drone, '#ffffff', 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(13,14,26,0.55)';
      ctx.beginPath();
      ctx.arc(31, 28, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Kotak membulat
    make(scene, 'blob' + sfx, 64, 64, (ctx) => {
      const [l, d] = body(COLORS.blob);
      glow(ctx, 32, 32, 30, COLORS.blob, halo);
      ctx.fillStyle = shadedFill(ctx, 32, 32, 12, l, d);
      ctx.beginPath();
      ctx.roundRect(20, 20, 24, 24, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(13,14,26,0.5)';
      ctx.beginPath();
      ctx.roundRect(27, 27, 10, 10, 3);
      ctx.fill();
    });

    // Heksagon besar
    make(scene, 'brute' + sfx, 88, 88, (ctx) => {
      const [l, d] = body(COLORS.brute);
      glow(ctx, 44, 44, 42, COLORS.brute, halo);
      polygon(ctx, 44, 44, 20, 6, Math.PI / 6);
      ctx.fillStyle = shadedFill(ctx, 44, 44, 20, l, d);
      ctx.fill();
      polygon(ctx, 44, 44, 11, 6, Math.PI / 6);
      ctx.strokeStyle = 'rgba(13,14,26,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Bos: bintang
    make(scene, 'titan' + sfx, 88, 88, (ctx) => {
      const [l, d] = body(COLORS.titan);
      glow(ctx, 44, 44, 42, COLORS.titan, hit ? 0.2 : 0.36);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 21 : 13;
        const a = -Math.PI / 2 + (i / 16) * Math.PI * 2;
        const x = 44 + Math.cos(a) * r;
        const y = 44 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = shadedFill(ctx, 44, 44, 21, l, d);
      ctx.fill();
      ctx.fillStyle = 'rgba(13,14,26,0.55)';
      ctx.beginPath();
      ctx.arc(44, 44, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Kristal XP
  const gem = (key: string, color: string, s: number) =>
    make(scene, key, 32, 32, (ctx) => {
      glow(ctx, 16, 16, 15, color, 0.45);
      ctx.beginPath();
      ctx.moveTo(16, 16 - 8 * s);
      ctx.lineTo(16 + 5.5 * s, 16);
      ctx.lineTo(16, 16 + 8 * s);
      ctx.lineTo(16 - 5.5 * s, 16);
      ctx.closePath();
      ctx.fillStyle = shadedFill(ctx, 16, 16, 8, mix(color, '#ffffff', 0.5), color);
      ctx.fill();
    });
  gem('gem', COLORS.gem, 1);
  gem('gemBig', COLORS.gemBig, 1.25);

  // Proyektil
  make(scene, 'bolt', 40, 20, (ctx) => {
    const g = ctx.createRadialGradient(20, 10, 0, 20, 10, 18);
    g.addColorStop(0, rgba(COLORS.player, 0.55));
    g.addColorStop(1, rgba(COLORS.player, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(20, 10, 19, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(11, 7, 18, 6, 3);
    ctx.fill();
  });

  // Orbit
  make(scene, 'shard', 40, 40, (ctx) => {
    glow(ctx, 20, 20, 19, COLORS.shard, 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(20, 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.shard;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(20, 20, 9, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Partikel
  make(scene, 'spark', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  // Gelombang nova (radius dasar 100)
  make(scene, 'ring', 216, 216, (ctx) => {
    ctx.strokeStyle = rgba(COLORS.player, 0.18);
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(108, 108, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(COLORS.player, 0.9);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(108, 108, 100, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Lantai: grid titik yang halus
  make(scene, 'grid', 64, 64, (ctx) => {
    ctx.fillStyle = COLORS.grid;
    ctx.beginPath();
    ctx.arc(32, 32, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(38,42,71,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(64, 0.5);
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, 64);
    ctx.stroke();
  });
}
