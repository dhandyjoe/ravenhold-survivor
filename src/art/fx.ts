import * as Phaser from 'phaser';
import { PALETTE } from '../config';
import { limb, makeTexture, oval, rgba, seeded, shape, softGlow, vgrad, type Ctx } from './kit';

/** Tekstur efek serangan dan kematian. Semua berbasis material (asap, api, serpihan), bukan cahaya neon. */
const F = PALETTE.fx;
const TAU = Math.PI * 2;

/** Font angka damage: satu baris digit putih bertepi gelap, diberi warna lewat tint. */
export const DIGIT_FONT = 'dmgDigits';
const DIGIT_W = 30;
const DIGIT_H = 44;
const DIGITS = '0123456789';

/** Membuat font sekali saat dimuat, supaya mengganti angka tidak perlu mengunggah tekstur ke GPU. */
function createDigitFont(scene: Phaser.Scene) {
  makeTexture(
    scene,
    DIGIT_FONT,
    DIGIT_W * DIGITS.length,
    DIGIT_H,
    (ctx) => {
      ctx.font = "800 36px Manrope, 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = PALETTE.outline;
      ctx.fillStyle = '#ffffff';
      [...DIGITS].forEach((d, i) => {
        const x = DIGIT_W * (i + 0.5);
        ctx.strokeText(d, x, DIGIT_H / 2);
        ctx.fillText(d, x, DIGIT_H / 2);
      });
    },
    1,
  );
  if (scene.cache.bitmapFont.exists(DIGIT_FONT)) scene.cache.bitmapFont.remove(DIGIT_FONT);
  scene.cache.bitmapFont.add(
    DIGIT_FONT,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: DIGIT_FONT,
      width: DIGIT_W,
      height: DIGIT_H,
      chars: DIGITS,
      charsPerRow: DIGITS.length,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 0,
    }),
  );
}

/** Ukuran dasar tekstur cincin dalam unit dunia, dipakai untuk menghitung skala efek. */
export const RING_RADIUS = 120;

function ring(ctx: Ctx, c: number, r: number, width: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.stroke();
}

/** Lingkaran rune: garis emas, glyph bersudut, dan tepi tipis. Dipakai Lingkar Rune dan tanda meteor. */
function runeCircle(ctx: Ctx, c: number, r: number, color: string, deep: string, fill: number) {
  if (fill > 0) {
    const g = ctx.createRadialGradient(c, c, r * 0.1, c, c, r);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.72, rgba(color, fill * 0.35));
    g.addColorStop(1, rgba(color, fill));
    oval(ctx, c, c, r, r, g);
  }
  ring(ctx, c, r, 4.6, rgba(deep, 0.85));
  ring(ctx, c, r, 2, color);
  ring(ctx, c, r * 0.77, 1.3, rgba(color, 0.8));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  // Glyph orisinal di antara dua lingkaran
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const m = r * 0.885;
    ctx.save();
    ctx.translate(c + Math.cos(a) * m, c + Math.sin(a) * m);
    ctx.rotate(a + Math.PI / 2);
    const h = r * 0.05;
    ctx.beginPath();
    if (i % 3 === 0) {
      ctx.moveTo(-h, h);
      ctx.lineTo(0, -h);
      ctx.lineTo(h, h);
    } else if (i % 3 === 1) {
      ctx.moveTo(-h, -h);
      ctx.lineTo(h, -h);
      ctx.moveTo(0, -h);
      ctx.lineTo(0, h);
    } else {
      ctx.moveTo(-h, 0);
      ctx.lineTo(h, 0);
      ctx.moveTo(-h * 0.5, -h);
      ctx.lineTo(h * 0.5, h);
    }
    ctx.stroke();
    ctx.restore();
  }
  // Bintang di tengah
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i * 2 * TAU) / 6;
    const x = c + Math.cos(a) * r * 0.77;
    const y = c + Math.sin(a) * r * 0.77;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(color, 0.55);
  ctx.stroke();
}

export function createFxTextures(scene: Phaser.Scene) {
  createDigitFont(scene);
  const size = (RING_RADIUS + 8) * 2;
  const c = size / 2;

  // Kepulan asap dan debu (putih, diberi warna lewat tint)
  makeTexture(scene, 'puff', 40, 40, (ctx) => {
    const rnd = seeded(7);
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU;
      const d = rnd() * 9;
      const r = 7 + rnd() * 6;
      const x = 20 + Math.cos(a) * d;
      const y = 20 + Math.sin(a) * d;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.48)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      oval(ctx, x, y, r, r, g);
    }
  });

  // Serpihan bersudut untuk tulang, batu, dan zirah
  makeTexture(scene, 'chip', 12, 12, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(2, 4);
    ctx.lineTo(7, 1);
    ctx.lineTo(11, 6);
    ctx.lineTo(7, 11);
    ctx.lineTo(2, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(7, 11);
    ctx.lineTo(11, 6);
    ctx.lineTo(6, 6);
    ctx.lineTo(2, 9);
    ctx.closePath();
    ctx.fill();
  });

  makeTexture(scene, 'fxRune', size, size, (ctx) => runeCircle(ctx, c, RING_RADIUS, F.rune, F.runeDeep, 0.2));
  makeTexture(scene, 'fxTarget', size, size, (ctx) => runeCircle(ctx, c, RING_RADIUS, F.fire, F.fireDeep, 0.34));

  // Gelombang kejut: tipis di tepi, memudar ke dalam
  makeTexture(scene, 'fxShock', size, size, (ctx) => {
    const g = ctx.createRadialGradient(c, c, RING_RADIUS * 0.6, c, c, RING_RADIUS);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.96, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    oval(ctx, c, c, RING_RADIUS, RING_RADIUS, g);
  });

  // Bola api: inti terang, tepi oranye bergerigi
  makeTexture(scene, 'fxBlast', size, size, (ctx) => {
    const rnd = seeded(23);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU;
      const d = RING_RADIUS * (0.25 + rnd() * 0.5);
      const r = RING_RADIUS * (0.2 + rnd() * 0.26);
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(F.fire, 0.6));
      g.addColorStop(1, rgba(F.fireDeep, 0));
      oval(ctx, x, y, r, r, g);
    }
    const g = ctx.createRadialGradient(c, c, 0, c, c, RING_RADIUS * 0.7);
    g.addColorStop(0, rgba(F.fireCore, 1));
    g.addColorStop(0.5, rgba(F.fire, 0.8));
    g.addColorStop(1, rgba(F.fireDeep, 0));
    oval(ctx, c, c, RING_RADIUS * 0.7, RING_RADIUS * 0.7, g);
  });

  // Kawah gosong di tanah
  makeTexture(scene, 'fxCrater', size, size, (ctx) => {
    const rnd = seeded(5);
    const g = ctx.createRadialGradient(c, c, RING_RADIUS * 0.3, c, c, RING_RADIUS);
    g.addColorStop(0, rgba(F.scorch, 0.92));
    g.addColorStop(0.8, rgba(F.scorch, 0.6));
    g.addColorStop(1, rgba(F.scorch, 0));
    oval(ctx, c, c, RING_RADIUS, RING_RADIUS, g);
    // Retakan menyala
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU;
      let r = RING_RADIUS * 0.15;
      let x = c + Math.cos(a) * r;
      let y = c + Math.sin(a) * r;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (r < RING_RADIUS * (0.55 + rnd() * 0.35)) {
        r += 12;
        const j = a + (rnd() - 0.5) * 0.7;
        x = c + Math.cos(j) * r;
        y = c + Math.sin(j) * r;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(F.fire, 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = rgba(F.fireCore, 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  });

  // Meteor: batu gelap dengan ekor api, digambar menukik ke bawah
  makeTexture(scene, 'fxMeteor', 96, 160, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, rgba(F.fireDeep, 0));
    g.addColorStop(0.6, rgba(F.fire, 0.8));
    g.addColorStop(1, rgba(F.fireCore, 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(48, 0);
    ctx.quadraticCurveTo(82, 74, 80, 118);
    ctx.lineTo(16, 118);
    ctx.quadraticCurveTo(14, 74, 48, 0);
    ctx.fill();
    softGlow(ctx, 48, 118, 44, F.fire, 0.8);
    ctx.fillStyle = vgrad(ctx, 90, 150, F.rock, F.rockDark);
    ctx.beginPath();
    ctx.moveTo(24, 110);
    ctx.lineTo(44, 90);
    ctx.lineTo(70, 96);
    ctx.lineTo(80, 122);
    ctx.lineTo(60, 150);
    ctx.lineTo(32, 146);
    ctx.lineTo(18, 130);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = F.fire;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(32, 116);
    ctx.lineTo(48, 124);
    ctx.lineTo(44, 140);
    ctx.moveTo(48, 124);
    ctx.lineTo(68, 116);
    ctx.stroke();
  });

  // Panah Hujan Panah: lebih tebal dari panah biasa agar terbaca di tengah keramaian
  makeTexture(scene, 'fxRainArrow', 44, 10, (ctx) => {
    const A = PALETTE.arrow;
    limb(ctx, 4, 5, 36, 5, 1.8, A.shaft);
    shape(ctx, [34, 1.4, 43, 5, 34, 8.6], A.head);
    shape(ctx, [34, 5, 43, 5, 34, 8.6], A.headDark);
    shape(ctx, [1, 1.4, 9, 4.2, 4, 5], A.fletch);
    shape(ctx, [1, 8.6, 9, 5.8, 4, 5], A.fletch);
  });

  // Gagak terbang menghadap kanan, sayap terbentang
  makeTexture(scene, 'fxRaven', 40, 28, (ctx) => {
    ctx.fillStyle = F.raven;
    ctx.beginPath();
    ctx.moveTo(38, 14);
    ctx.lineTo(29, 11);
    ctx.quadraticCurveTo(24, 9, 20, 11);
    ctx.quadraticCurveTo(16, 3, 6, 1);
    ctx.quadraticCurveTo(9, 7, 11, 12);
    ctx.lineTo(1, 13);
    ctx.lineTo(10, 16);
    ctx.quadraticCurveTo(9, 22, 5, 27);
    ctx.quadraticCurveTo(15, 25, 20, 18);
    ctx.quadraticCurveTo(25, 19, 29, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = F.ravenLight;
    ctx.beginPath();
    ctx.moveTo(18, 11);
    ctx.quadraticCurveTo(14, 6, 9, 4);
    ctx.quadraticCurveTo(13, 9, 14, 12);
    ctx.closePath();
    ctx.fill();
    oval(ctx, 27, 12.6, 1.3, 1.3, F.ravenEye);
  });

  // Pusaran dilihat dari atas: garis melingkar yang merapat ke tengah
  makeTexture(scene, 'fxTornado', size, size, (ctx) => {
    const g = ctx.createRadialGradient(c, c, 0, c, c, RING_RADIUS);
    g.addColorStop(0, rgba(F.wind, 0.7));
    g.addColorStop(0.6, rgba(F.dust, 0.3));
    g.addColorStop(1, rgba(F.dust, 0));
    oval(ctx, c, c, RING_RADIUS, RING_RADIUS, g);
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 5; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const f = i / 48;
        const a = (arm / 5) * TAU + f * 5.2;
        const r = RING_RADIUS * (0.06 + f * 0.9);
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(F.wind, 0.72);
      ctx.lineWidth = 3.4;
      ctx.stroke();
    }
  });

  // Tiang cahaya, dasarnya di tanah
  makeTexture(scene, 'fxPillar', 120, 340, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 340);
    g.addColorStop(0, rgba(F.holy, 0));
    g.addColorStop(0.7, rgba(F.holy, 0.5));
    g.addColorStop(1, rgba(F.holy, 0.9));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.lineTo(82, 0);
    ctx.lineTo(112, 340);
    ctx.lineTo(8, 340);
    ctx.closePath();
    ctx.fill();
    const core = ctx.createLinearGradient(0, 0, 0, 340);
    core.addColorStop(0, rgba('#ffffff', 0));
    core.addColorStop(1, rgba('#ffffff', 0.85));
    ctx.fillStyle = core;
    ctx.fillRect(48, 0, 24, 340);
  });

  // Tiga bentuk petir, ditarik dari tanah (bawah) ke langit (atas)
  for (let v = 0; v < 3; v++) {
    makeTexture(scene, `fxBolt${v}`, 64, 320, (ctx) => {
      const rnd = seeded(101 + v * 17);
      const pts: [number, number][] = [[32, 320]];
      let x = 32;
      for (let y = 300; y > 0; y -= 26) {
        x = Math.max(10, Math.min(54, x + (rnd() - 0.5) * 30));
        pts.push([x, y]);
      }
      const path = () => {
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      };
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      path();
      ctx.strokeStyle = rgba(F.lightningDeep, 0.34);
      ctx.lineWidth = 15;
      ctx.stroke();
      path();
      ctx.strokeStyle = rgba(F.lightningDeep, 0.9);
      ctx.lineWidth = 5.5;
      ctx.stroke();
      path();
      ctx.strokeStyle = F.lightning;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    });
  }

  // Busur listrik pendek antar musuh (membentang mendatar)
  makeTexture(scene, 'fxArc', 128, 24, (ctx) => {
    const rnd = seeded(77);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts: [number, number][] = [[0, 12]];
    for (let x = 12; x < 128; x += 12) pts.push([x, 12 + (rnd() - 0.5) * 16]);
    pts.push([128, 12]);
    const path = () => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    };
    path();
    ctx.strokeStyle = rgba(F.lightningDeep, 0.85);
    ctx.lineWidth = 3.6;
    ctx.stroke();
    path();
    ctx.strokeStyle = F.lightning;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });

  // Tebasan Bulan: cincin bilah cahaya bulan dengan enam lengkung tajam
  makeTexture(scene, 'fxMoon', size, size, (ctx) => {
    const g = ctx.createRadialGradient(c, c, RING_RADIUS * 0.72, c, c, RING_RADIUS);
    g.addColorStop(0, rgba(F.moonDeep, 0));
    g.addColorStop(0.75, rgba(F.moonDeep, 0.32));
    g.addColorStop(0.96, rgba(F.moon, 0.9));
    g.addColorStop(1, rgba(F.moon, 0));
    oval(ctx, c, c, RING_RADIUS, RING_RADIUS, g);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.fillStyle = rgba('#ffffff', 0.95);
      ctx.beginPath();
      ctx.arc(c, c, RING_RADIUS * 0.985, a, a + 0.86);
      ctx.arc(c + Math.cos(a + 0.43) * -RING_RADIUS * 0.06, c + Math.sin(a + 0.43) * -RING_RADIUS * 0.06, RING_RADIUS * 0.92, a + 0.86, a, true);
      ctx.closePath();
      ctx.fill();
    }
  });
}
