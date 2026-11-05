import * as Phaser from 'phaser';
import { PALETTE } from '../config';
import { hex } from '../config';
import { bake, limb, oval, rgba, shape, softGlow, vgrad, type Ctx, type Strip } from './kit';

/** Data gambar satu jenis musuh yang dipakai GameScene untuk animasi. */
export interface EnemyArt {
  strip: Strip;
  /** Jumlah frame jalan per arah. Frame arah kiri tepat setelah frame arah kanan. */
  walk: number;
  fps: number;
  anchorY: number;
  /** Jarak dari titik tengah ke telapak kaki, dan lebar bayangan, dalam unit dunia. */
  feet: number;
  shadow: number;
  /** Pengali ukuran tampilan. Hitbox tidak ikut berubah. */
  size: number;
  /** Kekuatan hentakan badan pada tiap langkah (makhluk berat). 0 = tidak ada. */
  stomp: number;
  /** Warna serpihan saat mati, dan warna asapnya. */
  debris: number[];
  smoke: number;
}

const G = PALETTE.goblin;
const B = PALETTE.skeleton;
const O = PALETTE.ogre;
const K = PALETTE.knight;
const D = PALETTE.dragon;
const TAU = Math.PI * 2;

const OUTLINE = { outline: PALETTE.outline, rim: PALETTE.rim, shade: PALETTE.shade };

/** Frame jalan menghadap kanan lalu cerminannya untuk arah kiri. */
function walkFrames(walk: number) {
  const frames: { t: number; left: boolean }[] = [];
  for (const left of [false, true]) for (let i = 0; i < walk; i++) frames.push({ t: i / walk, left });
  return frames;
}

/**
 * Goblin Semak (T1): kecil, kepala besar, tudung coral, dan belati karat.
 * Siluet telinga panjang dan tudung menjadi pembeda utama di layar kecil.
 */
function drawGoblin(ctx: Ctx, t: number) {
  const tau = t * TAU;
  const s = Math.sin(tau);
  const c = Math.cos(tau);
  const bob = Math.abs(c) * 1.6;
  const hip = 37.5 - bob;
  const cx = 25;

  ctx.save();
  // Condong ke depan: goblin selalu berlari, bukan berjalan
  ctx.translate(cx, 45);
  ctx.rotate(0.11);
  ctx.translate(-cx, -45);

  // Kaki belakang
  const dx = s * 6.2;
  const liftA = Math.max(0, c) * 3;
  const liftB = Math.max(0, -c) * 3;
  limb(ctx, cx - 1, hip, cx - 1 - dx, 45 - liftB, 3.1, G.skinDark);
  oval(ctx, cx - dx + 0.2, 45.4 - liftB, 2.9, 1.6, G.skinDark);

  // Lengan belakang
  limb(ctx, cx - 3, hip - 8, cx - 5.5 + dx * 0.3, hip - 3, 2.5, G.skinDark);

  // Kaki depan
  limb(ctx, cx + 1, hip, cx + 1 + dx, 45 - liftA, 3.3, G.skin);
  oval(ctx, cx + 2.2 + dx, 45.4 - liftA, 3, 1.7, G.skin);

  // Badan kain lusuh
  ctx.fillStyle = vgrad(ctx, hip - 11, hip + 4, G.rag, G.ragDark);
  ctx.beginPath();
  ctx.moveTo(cx - 6, hip - 9);
  ctx.quadraticCurveTo(cx, hip - 13, cx + 6, hip - 9);
  ctx.lineTo(cx + 7, hip + 2);
  ctx.lineTo(cx + 3.5, hip + 0.4);
  ctx.lineTo(cx + 1, hip + 3.6);
  ctx.lineTo(cx - 2, hip + 0.6);
  ctx.lineTo(cx - 4.6, hip + 3.2);
  ctx.lineTo(cx - 7, hip + 1);
  ctx.closePath();
  ctx.fill();

  // Tangan depan memegang belati
  const handX = cx + 8.8 - dx * 0.25;
  const handY = hip - 6.5 + dx * 0.25;
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(-0.55 + s * 0.14);
  shape(ctx, [0.8, -1.5, 11, -0.3, 0.8, 1.5], G.blade);
  shape(ctx, [0.8, 0, 11, -0.3, 0.8, 1.5], G.bladeDark);
  limb(ctx, -3, 0, 0.5, 0, 2.2, G.grip);
  limb(ctx, 0.6, -2.5, 0.6, 2.5, 1.2, G.grip);
  ctx.restore();
  limb(ctx, cx + 3, hip - 8, handX, handY, 2.8, G.skin);
  oval(ctx, handX, handY, 1.9, 1.9, G.skin);

  // Telinga belakang
  const hy = hip - 19;
  const hx = cx + 3;
  shape(ctx, [hx - 6, hy - 3, hx - 21, hy - 7 + s, hx - 7, hy + 3.5], G.skinDark);
  shape(ctx, [hx - 7, hy - 1.2, hx - 17, hy - 5.2 + s, hx - 7.5, hy + 1.8], '#5c6233');

  // Kepala
  oval(ctx, hx, hy, 10.2, 8.8, vgrad(ctx, hy - 8, hy + 9, G.skinLight, G.skin));

  // Hidung panjang
  shape(ctx, [hx + 6.5, hy - 1.6, hx + 15, hy + 2, hx + 6.5, hy + 3.4], G.skin);
  shape(ctx, [hx + 6.5, hy + 1.2, hx + 15, hy + 2, hx + 6.5, hy + 3.4], G.skinDark);

  // Mata besar
  oval(ctx, hx + 4.1, hy - 0.7, 3.5, 3.7, G.eye);
  oval(ctx, hx + 5.2, hy - 0.5, 1.6, 2.2, G.pupil);
  oval(ctx, hx + 4.5, hy - 1.7, 0.7, 0.7, '#ffffff');
  oval(ctx, hx - 2.3, hy - 0.2, 2.2, 2.7, G.eye);
  oval(ctx, hx - 1.8, hy, 1, 1.6, G.pupil);
  // Alis marah
  limb(ctx, hx + 0.7, hy - 4.2, hx + 7.2, hy - 3.2, 1.3, G.skinDark);

  // Mulut dan taring
  ctx.strokeStyle = G.pupil;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - 1.5, hy + 5);
  ctx.quadraticCurveTo(hx + 2.5, hy + 6.8, hx + 6.2, hy + 4.2);
  ctx.stroke();
  shape(ctx, [hx + 1.2, hy + 5.5, hx + 2.5, hy + 8, hx + 3.5, hy + 5.4], G.fang);

  // Telinga depan mencuat dari balik tudung
  shape(ctx, [hx - 6.5, hy - 4, hx - 15, hy - 19 - s, hx - 0.5, hy - 7], G.skinLight);
  shape(ctx, [hx - 6, hy - 6, hx - 13, hy - 16 - s, hx - 3, hy - 7], G.skin);

  // Tudung coral dengan ekor kain ke belakang
  ctx.fillStyle = vgrad(ctx, hy - 11, hy, G.hoodLight, G.hood);
  ctx.beginPath();
  ctx.moveTo(hx + 8.3, hy - 4.8);
  ctx.quadraticCurveTo(hx + 4, hy - 11.6, hx - 3, hy - 10.4);
  ctx.quadraticCurveTo(hx - 12, hy - 15, hx - 17 + s * 1.5, hy - 13);
  ctx.quadraticCurveTo(hx - 13, hy - 8.6, hx - 11, hy - 3.2);
  ctx.quadraticCurveTo(hx - 1, hy - 7.2, hx + 8.3, hy - 4.8);
  ctx.fill();
  limb(ctx, hx - 10.5, hy - 3.5, hx + 7.8, hy - 5, 1, G.hoodDark);

  ctx.restore();
}

export function bakeGoblin(scene: Phaser.Scene): EnemyArt {
  const walk = 4;
  const strip = bake(scene, {
    key: 'goblin',
    w: 52,
    h: 52,
    frames: walkFrames(walk),
    mirror: (f) => f.left,
    draw: (ctx, f) => drawGoblin(ctx, f.t),
    finish: { ...OUTLINE, outlineWidth: 0.85, rimAlpha: 0.3, shadeAlpha: 0.3, edge: 1 },
    normal: { strength: 2.2, pillow: 4, detail: 0.32 },
  });
  return { strip, walk, fps: 11, anchorY: 32 / 52, feet: 14, shadow: 26, size: 1.04, stomp: 0, debris: [hex(G.skin), hex(G.hood), hex(G.rag)], smoke: hex(PALETTE.fx.dust) };
}

/**
 * Prajurit Tulang (T2): kerangka berzirah amber karat dengan perisai bundar.
 * Jalannya patah-patah: kaki kaku, kepala tertinggal satu ketukan.
 */
function drawSkeleton(ctx: Ctx, t: number) {
  const tau = t * TAU;
  const s = Math.sin(tau);
  const c = Math.cos(tau);
  const cx = 28;
  const ground = 53;
  const hip = 37.5 - Math.abs(s) * 1.4;
  const dx = s * 6.4;
  const liftA = Math.max(0, c) * 3.4;
  const liftB = Math.max(0, -c) * 3.4;

  // Kaki belakang: tulang kering dan telapak
  limb(ctx, cx - 2, hip, cx - 3 - dx, ground - 7 - liftB, 2.2, B.boneDark);
  limb(ctx, cx - 3 - dx, ground - 7 - liftB, cx - 3 - dx * 1.1, ground - 1.5 - liftB, 2, B.boneDark);
  oval(ctx, cx - 1.4 - dx * 1.1, ground - 0.8 - liftB, 3.4, 1.4, B.boneDark);

  // Lengan belakang memegang perisai di sisi badan
  limb(ctx, cx - 5, hip - 13, cx - 9, hip - 6, 2, B.boneDark);

  // Kaki depan
  limb(ctx, cx + 2, hip, cx + 3 + dx, ground - 7 - liftA, 2.4, B.bone);
  oval(ctx, cx + 3 + dx, ground - 7.6 - liftA, 2.2, 2, B.boneLight);
  limb(ctx, cx + 3 + dx, ground - 7 - liftA, cx + 3 + dx * 1.1, ground - 1.5 - liftA, 2.2, B.bone);
  oval(ctx, cx + 4.8 + dx * 1.1, ground - 0.8 - liftA, 3.6, 1.5, B.bone);

  // Panggul tulang dan rok zirah
  shape(ctx, [cx - 7.5, hip - 3, cx + 7.5, hip - 3, cx + 9, hip + 3.5, cx + 4, hip + 2.2, cx, hip + 4, cx - 4, hip + 2.2, cx - 9, hip + 3.5], vgrad(ctx, hip - 3, hip + 4, B.rust, B.armorDark));

  // Dada zirah amber berkarat
  const top = hip - 17;
  ctx.fillStyle = vgrad(ctx, top, hip, B.armorLight, B.armorDark);
  ctx.beginPath();
  ctx.moveTo(cx - 8.5, top + 2);
  ctx.quadraticCurveTo(cx, top - 2, cx + 8.5, top + 2);
  ctx.lineTo(cx + 6.5, hip - 1);
  ctx.quadraticCurveTo(cx, hip + 1, cx - 6.5, hip - 1);
  ctx.closePath();
  ctx.fill();
  limb(ctx, cx, top + 1, cx, hip - 2, 1, B.armorDark);
  // Bercak karat dan paku keling
  oval(ctx, cx - 4, top + 9, 2.4, 1.7, B.rust);
  oval(ctx, cx + 4.6, top + 11.5, 1.6, 1.2, B.rust);
  for (const [px, py] of [[-5.5, 3.4], [5.5, 3.4]]) oval(ctx, cx + px, top + py, 0.8, 0.8, B.boneLight);

  // Pelindung bahu
  oval(ctx, cx + 8.4, top + 2.2, 4, 3.2, vgrad(ctx, top - 1, top + 5, B.armorLight, B.armorDark));

  // Pedang pendek di tangan depan, mengayun ke arah jalan
  const handX = cx + 12 - dx * 0.2;
  const handY = hip - 9 + dx * 0.25;
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(-0.95 + s * 0.16);
  shape(ctx, [1.5, -1.8, 16, -1.2, 18.5, 0, 16, 1.2, 1.5, 1.8], B.iron);
  shape(ctx, [1.5, 0, 18.5, 0, 16, 1.2, 1.5, 1.8], B.ironDark);
  limb(ctx, 1.2, -3.4, 1.2, 3.4, 1.5, B.armorDark);
  limb(ctx, -2.6, 0, 0.8, 0, 1.9, B.shieldDark);
  ctx.restore();
  limb(ctx, cx + 8, top + 4, handX, handY, 2.2, B.bone);

  // Tengkorak: tertinggal satu ketukan dari badan supaya terasa rapuh
  const hy = top - 7 + Math.sin(tau - 1) * 0.7;
  const hx = cx + 1.6;
  oval(ctx, hx, hy, 7.4, 7, vgrad(ctx, hy - 7, hy + 6, B.boneLight, B.bone));
  // Rahang
  ctx.fillStyle = B.boneDark;
  ctx.beginPath();
  ctx.roundRect(hx - 3.2, hy + 3.4, 8.4, 4 + Math.abs(s) * 0.9, 1.6);
  ctx.fill();
  for (let i = 0; i < 4; i++) limb(ctx, hx - 1.8 + i * 2, hy + 4.4, hx - 1.8 + i * 2, hy + 6.4, 0.5, B.socket);
  // Rongga mata dengan bara kecil
  oval(ctx, hx + 3.6, hy - 0.4, 2.5, 2.7, B.socket);
  oval(ctx, hx - 2, hy - 0.4, 2.1, 2.5, B.socket);
  oval(ctx, hx + 3.9, hy - 0.2, 1.05, 1.15, B.eye);
  oval(ctx, hx - 1.7, hy - 0.2, 0.85, 1, B.eye);
  shape(ctx, [hx + 0.6, hy + 2, hx + 2.1, hy + 3.5, hx - 0.6, hy + 3.5], B.socket);

  // Helm ketel berkarat
  ctx.fillStyle = vgrad(ctx, hy - 11, hy - 2, B.armorLight, B.armor);
  ctx.beginPath();
  ctx.moveTo(hx - 9.8, hy - 2.6);
  ctx.quadraticCurveTo(hx - 7, hy - 11.5, hx + 0.5, hy - 11.5);
  ctx.quadraticCurveTo(hx + 8, hy - 11, hx + 10.4, hy - 2.6);
  ctx.quadraticCurveTo(hx, hy - 5.2, hx - 9.8, hy - 2.6);
  ctx.fill();
  limb(ctx, hx - 10.4, hy - 2.5, hx + 10.8, hy - 2.5, 1.5, B.armorDark);
  oval(ctx, hx - 3.5, hy - 8, 2.3, 1.2, B.rust);

  // Perisai bundar kayu, menutup sisi belakang badan
  const sx = cx - 9.5;
  const sy = hip - 8 - s * 0.6;
  oval(ctx, sx, sy, 8.8, 9.6, vgrad(ctx, sy - 9, sy + 9, B.shield, B.shieldDark));
  for (const off of [-3.4, 0, 3.4]) limb(ctx, sx + off, sy - 8, sx + off, sy + 8, 0.45, B.shieldDark);
  ctx.strokeStyle = B.iron;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 8.2, 9, 0, 0, TAU);
  ctx.stroke();
  oval(ctx, sx, sy, 2.6, 2.8, B.iron);
  oval(ctx, sx - 0.6, sy - 0.8, 1, 1, B.boneLight);
}

export function bakeSkeleton(scene: Phaser.Scene): EnemyArt {
  const walk = 4;
  const strip = bake(scene, {
    key: 'skeleton',
    w: 56,
    h: 58,
    frames: walkFrames(walk),
    mirror: (f) => f.left,
    draw: (ctx, f) => drawSkeleton(ctx, f.t),
    finish: { ...OUTLINE, outlineWidth: 0.85, rimAlpha: 0.28, shadeAlpha: 0.3, edge: 1 },
    normal: { strength: 2.2, pillow: 4, detail: 0.34 },
  });
  return { strip, walk, fps: 6, anchorY: 36 / 58, feet: 17, shadow: 30, size: 1, stomp: 0, debris: [hex(B.bone), hex(B.boneDark), hex(B.armor)], smoke: hex(PALETTE.fx.dust) };
}

/**
 * Ogre Batu (T3): tubuh besar membungkuk, kepala kecil di antara bahu, bahu batu berlumut.
 * Berat badannya terbaca dari badan yang turun dan gada yang berayun tiap langkah.
 */
function drawOgre(ctx: Ctx, t: number) {
  const tau = t * TAU;
  const s = Math.sin(tau);
  const c = Math.cos(tau);
  const cx = 42;
  const ground = 78;
  // Badan paling rendah saat kaki menapak penuh
  const drop = Math.abs(s) * 2.6;
  const hip = 56 + drop;
  const dx = s * 7.5;
  const liftA = Math.max(0, c) * 3.5;
  const liftB = Math.max(0, -c) * 3.5;

  const foot = (x: number, lift: number, color: string, toe: string) => {
    limb(ctx, x > cx ? cx + 7 : cx - 7, hip, x, ground - 7 - lift, 9.6, color);
    oval(ctx, x + 1.4, ground - 3.4 - lift, 7.4, 4, color);
    for (let i = -1; i <= 1; i++) oval(ctx, x + 5.5 + i * 0.6, ground - 2.6 - lift + i * 1.5, 1.3, 1, toe);
  };

  // Kaki dan lengan belakang
  foot(cx - 6 - dx, liftB, O.skinDark, O.stoneDark);
  limb(ctx, cx - 14, hip - 22, cx - 22 + dx * 0.4, hip - 7, 8, O.skinDark);
  oval(ctx, cx - 22 + dx * 0.4, hip - 5.5, 5, 4.8, O.skinDark);

  // Kaki depan
  foot(cx + 6 + dx, liftA, O.skin, O.stone);

  // Cawat
  shape(ctx, [cx - 15, hip - 4, cx + 15, hip - 4, cx + 12, hip + 7, cx + 4, hip + 4.6, cx - 1, hip + 8, cx - 7, hip + 4.6, cx - 13, hip + 6], O.rag);

  // Badan bulat, perut mendahului
  ctx.fillStyle = vgrad(ctx, hip - 32, hip + 2, O.skinLight, O.skinDark);
  ctx.beginPath();
  ctx.moveTo(cx - 18, hip - 22);
  ctx.bezierCurveTo(cx - 22, hip - 34, cx + 12, hip - 37, cx + 18, hip - 25);
  ctx.bezierCurveTo(cx + 24, hip - 14, cx + 21, hip + 1, cx + 7, hip + 1);
  ctx.lineTo(cx - 10, hip + 1);
  ctx.bezierCurveTo(cx - 20, hip, cx - 20, hip - 12, cx - 18, hip - 22);
  ctx.fill();
  // Bayangan perut dan garis otot
  ctx.fillStyle = rgba(O.skinDark, 0.55);
  ctx.beginPath();
  ctx.ellipse(cx + 5, hip - 8, 11, 8, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(O.skinDark, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 2, hip - 24);
  ctx.quadraticCurveTo(cx + 10, hip - 19, cx + 15, hip - 20);
  ctx.stroke();
  // Luka batu di perut
  shape(ctx, [cx - 8, hip - 19, cx - 3.5, hip - 22, cx - 1, hip - 18, cx - 4, hip - 15, cx - 8.5, hip - 16], O.stone);
  shape(ctx, [cx - 7, hip - 18.5, cx - 4, hip - 20.5, cx - 2.5, hip - 18.5, cx - 5.5, hip - 18], O.stoneLight);

  // Bahu batu berlumut, siluet paling khas
  const shoulder = (x: number, y: number, r: number) => {
    shape(ctx, [x - r, y + r * 0.6, x - r * 0.9, y - r * 0.5, x - r * 0.2, y - r, x + r * 0.8, y - r * 0.7, x + r, y + r * 0.1, x + r * 0.6, y + r * 0.8], vgrad(ctx, y - r, y + r, O.stoneLight, O.stoneDark));
    shape(ctx, [x - r * 0.7, y - r * 0.5, x - r * 0.15, y - r * 0.85, x + r * 0.6, y - r * 0.6, x + r * 0.05, y - r * 0.28], O.stoneLight);
    // Lumut di puncak
    oval(ctx, x - r * 0.2, y - r * 0.82, r * 0.72, r * 0.3, O.moss);
    oval(ctx, x + r * 0.4, y - r * 0.68, r * 0.34, r * 0.2, O.mossDark);
    oval(ctx, x - r * 0.72, y - r * 0.36, r * 0.24, r * 0.3, O.mossDark);
  };
  shoulder(cx - 15, hip - 29, 11);

  // Lengan depan menyeret gada besar, berayun berlawanan dengan kaki depan
  const swing = -s * 0.28;
  const armX = cx + 15;
  const armY = hip - 25;
  const handX = armX + 8 + Math.sin(swing) * 10;
  const handY = armY + 19;
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(0.4 + swing);
  // Gada: batang menebal dan benjol batu
  ctx.fillStyle = vgrad(ctx, -2, 24, O.club, O.clubDark);
  ctx.beginPath();
  ctx.moveTo(-2.1, -4);
  ctx.lineTo(2.1, -4);
  ctx.lineTo(4.2, 15);
  ctx.lineTo(-4.2, 15);
  ctx.closePath();
  ctx.fill();
  oval(ctx, 0, 18.5, 8.2, 8.6, vgrad(ctx, 10, 27, O.club, O.clubDark));
  for (const [px, py] of [[-5, 16], [5, 15], [0, 25], [5, 22], [-5, 22]]) {
    shape(ctx, [px - 2.2, py + 1.4, px, py - 2.2, px + 2.2, py + 1.4], O.stoneLight);
  }
  ctx.restore();
  limb(ctx, armX, armY, handX, handY, 9, O.skin);
  oval(ctx, handX, handY, 5.6, 5.4, O.skinLight);
  shoulder(cx + 19, hip - 25, 9);

  // Kepala kecil, menjorok ke depan di antara bahu
  const hy = hip - 38 + Math.sin(tau + 0.6) * 0.8;
  const hx = cx + 7;
  oval(ctx, hx, hy, 10.4, 9, vgrad(ctx, hy - 9, hy + 9, O.skinLight, O.skin));
  // Dahi menonjol
  ctx.fillStyle = O.skinDark;
  ctx.beginPath();
  ctx.moveTo(hx - 4, hy - 4.5);
  ctx.quadraticCurveTo(hx + 4, hy - 7.5, hx + 10.8, hy - 2.8);
  ctx.quadraticCurveTo(hx + 3, hy - 4.2, hx - 4, hy - 2.8);
  ctx.fill();
  oval(ctx, hx + 5.4, hy - 1, 2.3, 2, O.eye);
  oval(ctx, hx + 6, hy - 0.9, 1, 1.2, O.pupil);
  oval(ctx, hx - 0.8, hy - 1, 1.6, 1.5, O.eye);
  // Rahang bawah dan taring
  ctx.fillStyle = O.skinDark;
  ctx.beginPath();
  ctx.roundRect(hx - 3.5, hy + 3.2, 14, 5.4, 2.4);
  ctx.fill();
  shape(ctx, [hx + 7, hy + 4, hx + 9.6, hy - 1.4, hx + 10, hy + 4], O.tusk);
  shape(ctx, [hx - 0.5, hy + 4, hx + 1.2, hy + 0.6, hx + 2, hy + 4], O.tusk);
}

export function bakeOgre(scene: Phaser.Scene): EnemyArt {
  const walk = 4;
  const strip = bake(scene, {
    key: 'ogre',
    w: 84,
    h: 84,
    frames: walkFrames(walk),
    mirror: (f) => f.left,
    draw: (ctx, f) => drawOgre(ctx, f.t),
    finish: { ...OUTLINE, outlineWidth: 1, rimAlpha: 0.26, shadeAlpha: 0.34, edge: 1.4 },
    normal: { strength: 2.6, pillow: 6, detail: 0.36 },
  });
  return { strip, walk, fps: 4.5, anchorY: 52 / 84, feet: 23, shadow: 40, size: 0.88, stomp: 0.05, debris: [hex(O.stone), hex(O.stoneLight), hex(O.moss)], smoke: hex(PALETTE.fx.smoke) };
}

/** Lidah api yang bergoyang di sepanjang garis, dipakai pedang kesatria dan bara naga. */
function flameTongues(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, n: number, reach: number, phase: number, outer: string, inner: string) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (const [color, size] of [[outer, 1], [inner, 0.55]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const w = Math.sin(phase * TAU * 2 + i * 1.9);
      const r = reach * size * (0.55 + 0.45 * w) * (1 - f * 0.35);
      ctx.quadraticCurveTo(x0 + dx * (f - 0.5 / n) + nx * r * 0.2, y0 + dy * (f - 0.5 / n) + ny * r * 0.2, x0 + dx * f + nx * r, y0 + dy * f + ny * r);
      ctx.lineTo(x0 + dx * (f + 0.25 / n), y0 + dy * (f + 0.25 / n));
    }
    for (let i = n; i >= 0; i--) {
      const f = i / n;
      const w = Math.cos(phase * TAU * 2 + i * 2.3);
      const r = reach * size * (0.45 + 0.4 * w) * (1 - f * 0.35);
      ctx.quadraticCurveTo(x0 + dx * (f + 0.5 / n) - nx * r * 0.2, y0 + dy * (f + 0.5 / n) - ny * r * 0.2, x0 + dx * f - nx * r, y0 + dy * f - ny * r);
      ctx.lineTo(x0 + dx * (f - 0.25 / n), y0 + dy * (f - 0.25 / n));
    }
    ctx.closePath();
    ctx.fill();
  }
}

/** Ksatria Terkutuk (bos menit 5): zirah raksasa dan pedang besar berapi violet. */
function drawKnight(ctx: Ctx, t: number) {
  const tau = t * TAU;
  const s = Math.sin(tau);
  const c = Math.cos(tau);
  const cx = 70;
  const ground = 132;
  const drop = Math.abs(s) * 3;
  const hip = 92 + drop;
  const dx = s * 12;
  const liftA = Math.max(0, c) * 6;
  const liftB = Math.max(0, -c) * 6;

  // Jubah compang-camping, berkibar tertinggal di belakang
  ctx.fillStyle = vgrad(ctx, hip - 48, ground, K.cape, K.capeDark);
  ctx.beginPath();
  ctx.moveTo(cx - 16, hip - 46);
  ctx.quadraticCurveTo(cx - 34 - s * 3, hip - 18, cx - 42 + s * 4, ground - 6);
  ctx.lineTo(cx - 33 + s * 2, ground - 13);
  ctx.lineTo(cx - 28 - s * 3, ground - 1);
  ctx.lineTo(cx - 19, ground - 12);
  ctx.lineTo(cx - 12 + s * 2, ground - 3);
  ctx.lineTo(cx + 6, hip - 18);
  ctx.closePath();
  ctx.fill();

  const leg = (hipX: number, footX: number, lift: number, base: string, dark: string) => {
    const kneeX = (hipX + footX) / 2 + 3;
    const kneeY = (hip + ground - lift) / 2 - 1;
    limb(ctx, hipX, hip, kneeX, kneeY, 13, dark);
    limb(ctx, kneeX, kneeY, footX, ground - 8 - lift, 11.5, base);
    // Lutut dan sepatu baja
    oval(ctx, kneeX + 1, kneeY, 7.2, 6.8, K.steelLight);
    oval(ctx, kneeX + 1.5, kneeY, 3, 2.8, K.trim);
    ctx.fillStyle = vgrad(ctx, ground - 12 - lift, ground - lift, base, dark);
    ctx.beginPath();
    ctx.moveTo(footX - 7, ground - 12 - lift);
    ctx.lineTo(footX + 7, ground - 12 - lift);
    ctx.lineTo(footX + 15, ground - 2 - lift);
    ctx.lineTo(footX + 13, ground - lift);
    ctx.lineTo(footX - 8, ground - lift);
    ctx.closePath();
    ctx.fill();
  };
  leg(cx - 8, cx - 8 - dx, liftB, K.steelDark, K.steelDeep);
  leg(cx + 9, cx + 9 + dx, liftA, K.steel, K.steelDark);

  // Rok zirah berlapis
  for (let i = 0; i < 2; i++) {
    const y = hip - 5 + i * 7;
    shape(ctx, [cx - 24 + i * 2, y, cx + 24 - i * 2, y, cx + 21 - i, y + 9, cx + 8, y + 7, cx, y + 10, cx - 8, y + 7, cx - 21 + i, y + 9], vgrad(ctx, y, y + 10, i ? K.steel : K.steelLight, K.steelDark));
  }

  // Badan zirah dengan tepi emas kusam
  const top = hip - 49;
  ctx.fillStyle = vgrad(ctx, top, hip, K.steelLight, K.steelDark);
  ctx.beginPath();
  ctx.moveTo(cx - 26, top + 6);
  ctx.quadraticCurveTo(cx, top - 6, cx + 26, top + 6);
  ctx.quadraticCurveTo(cx + 25, top + 28, cx + 19, hip);
  ctx.lineTo(cx - 19, hip);
  ctx.quadraticCurveTo(cx - 25, top + 28, cx - 26, top + 6);
  ctx.fill();
  limb(ctx, cx - 18, hip - 3, cx + 18, hip - 3, 4.4, K.trim);
  limb(ctx, cx - 18, hip - 3.6, cx + 18, hip - 3.6, 1, K.trimDark);
  // Lambang kutukan di dada: mata terbuka dengan cahaya violet, berdenyut
  const beat = 0.75 + 0.25 * Math.sin(tau * 2);
  softGlow(ctx, cx, top + 21, 13 * beat, K.flame, 0.62);
  shape(ctx, [cx - 9.5, top + 21, cx, top + 13.5, cx + 9.5, top + 21, cx, top + 28.5], K.steelDark);
  oval(ctx, cx, top + 21, 3.4 * beat, 3.4 * beat, K.flameCore);
  oval(ctx, cx, top + 21, 1.6, 2.7, K.flameDeep);
  limb(ctx, cx - 22, top + 8, cx + 22, top + 8, 1.6, K.trimDark);

  // Lengan belakang
  limb(ctx, cx - 25, top + 11, cx - 31 + dx * 0.25, hip - 11, 12, K.steelDark);
  oval(ctx, cx - 31 + dx * 0.25, hip - 9, 7, 7, K.steel);

  // Helm bertanduk, leher tertanam di bahu
  const hy = top - 8 + Math.sin(tau + 0.5) * 1;
  const hx = cx + 3;
  // Tanduk
  ctx.fillStyle = K.steelDark;
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 8);
  ctx.quadraticCurveTo(hx - 27, hy - 12, hx - 27, hy - 32);
  ctx.quadraticCurveTo(hx - 19, hy - 22, hx - 6, hy - 15);
  ctx.fill();
  ctx.fillStyle = K.steelLight;
  ctx.beginPath();
  ctx.moveTo(hx + 10, hy - 8);
  ctx.quadraticCurveTo(hx + 27, hy - 12, hx + 27, hy - 32);
  ctx.quadraticCurveTo(hx + 19, hy - 22, hx + 6, hy - 15);
  ctx.fill();
  ctx.fillStyle = vgrad(ctx, hy - 19, hy + 13, K.steelLight, K.steelDark);
  ctx.beginPath();
  ctx.moveTo(hx - 14, hy + 11);
  ctx.quadraticCurveTo(hx - 17, hy - 18, hx, hy - 19);
  ctx.quadraticCurveTo(hx + 17, hy - 18, hx + 14, hy + 11);
  ctx.lineTo(hx + 5, hy + 15);
  ctx.lineTo(hx, hy + 12);
  ctx.lineTo(hx - 5, hy + 15);
  ctx.closePath();
  ctx.fill();
  limb(ctx, hx, hy - 18, hx, hy + 11, 2, K.trimDark);
  // Celah mata dengan cahaya
  softGlow(ctx, hx + 2, hy - 2, 12, K.flame, 0.7);
  shape(ctx, [hx - 12, hy - 5, hx + 13, hy - 5, hx + 11, hy + 0.5, hx - 10, hy + 0.5], K.visor);
  oval(ctx, hx + 6.5, hy - 2.3, 3.1, 1.6, K.eye);
  oval(ctx, hx - 3, hy - 2.3, 2.5, 1.4, K.eye);

  // Pedang besar: digenggam dua tangan, ujung ke depan-atas, berayun mengikuti langkah
  const hand = { x: cx + 22 + dx * 0.15, y: hip - 18 - drop * 0.4 };
  const angle = -0.82 + s * 0.05;
  const bladeLen = 74;
  const tipX = hand.x + Math.cos(angle) * bladeLen;
  const tipY = hand.y + Math.sin(angle) * bladeLen;
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  shape(ctx, [10, -6.2, bladeLen - 11, -4.8, bladeLen, 0, bladeLen - 11, 4.8, 10, 6.2], K.blade);
  shape(ctx, [10, 0, bladeLen, 0, bladeLen - 11, 4.8, 10, 6.2], K.bladeDark);
  limb(ctx, 13, 0, bladeLen - 15, 0, 1.3, K.steelDark);
  limb(ctx, 8.5, -12, 8.5, 12, 4.2, K.trim);
  limb(ctx, 8.5, -11.6, 8.5, -1, 1.2, K.trimDark);
  limb(ctx, -14, 0, 6, 0, 4.6, K.steelDark);
  oval(ctx, -15.5, 0, 4, 4, K.trim);
  ctx.restore();
  // Api violet di sepanjang bilah
  flameTongues(ctx, hand.x + Math.cos(angle) * 14, hand.y + Math.sin(angle) * 14, tipX, tipY, 6, 11, t, rgba(K.flame, 0.82), rgba(K.flameCore, 0.9));
  softGlow(ctx, tipX - 8, tipY + 8, 18, K.flame, 0.34);
  // Dua tangan menggenggam
  limb(ctx, cx + 22, top + 10, hand.x - 2, hand.y + 1, 12, K.steel);
  oval(ctx, hand.x + Math.cos(angle) * 1, hand.y + Math.sin(angle) * 1, 7, 7, K.steelLight);

  // Bahu bersudut menutupi pangkal lengan
  const pauldron = (x: number, y: number, flip: number, color: string) => {
    ctx.fillStyle = vgrad(ctx, y - 12, y + 12, color, K.steelDark);
    ctx.beginPath();
    ctx.moveTo(x - 15 * flip, y + 8);
    ctx.quadraticCurveTo(x - 14 * flip, y - 12, x + 6 * flip, y - 12);
    ctx.lineTo(x + 19 * flip, y - 19);
    ctx.lineTo(x + 16 * flip, y + 2);
    ctx.quadraticCurveTo(x + 8 * flip, y + 13, x - 15 * flip, y + 8);
    ctx.fill();
    limb(ctx, x - 12 * flip, y + 7, x + 12 * flip, y + 6, 2, K.trim);
  };
  pauldron(cx - 26, top + 9, -1, K.steel);
  pauldron(cx + 26, top + 9, 1, K.steelLight);
}

export function bakeKnight(scene: Phaser.Scene): EnemyArt {
  const walk = 6;
  const strip = bake(scene, {
    key: 'knight',
    w: 140,
    h: 140,
    frames: walkFrames(walk),
    mirror: (f) => f.left,
    draw: (ctx, f) => drawKnight(ctx, f.t),
    finish: { ...OUTLINE, outlineWidth: 1.1, rimAlpha: 0.3, shadeAlpha: 0.32, edge: 1.8 },
    normal: { strength: 3, pillow: 8, detail: 0.36 },
  });
  return { strip, walk, fps: 6, anchorY: 88 / 140, feet: 44, shadow: 84, size: 1, stomp: 0.035, debris: [hex(K.steel), hex(K.flame), hex(K.trim)], smoke: hex(K.capeDark) };
}

/** Naga Bara (bos menit 9): terbang rendah, sayap mengepak, dada memancarkan bara. */
function drawDragon(ctx: Ctx, t: number) {
  const tau = t * TAU;
  const s = Math.sin(tau);
  const c = Math.cos(tau);
  const cx = 78;
  const cy = 80 + s * 3.5;
  // Sudut sayap: naik saat s positif
  const flap = s * 0.75;

  const wing = (rootX: number, rootY: number, dir: number, color: string, membrane: string, scale: number) => {
    const reach = 62 * scale;
    const tipX = rootX + dir * Math.cos(flap) * reach;
    const tipY = rootY - Math.sin(flap + 0.5) * reach;
    const elbowX = rootX + dir * Math.cos(flap + 0.5) * reach * 0.48;
    const elbowY = rootY - Math.sin(flap + 1.05) * reach * 0.48;
    // Selaput sayap bergerigi menuju tubuh
    ctx.fillStyle = membrane;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(tipX, tipY);
    const lowX = rootX + dir * reach * 0.82;
    const lowY = rootY + 14 * scale - flap * 18 * scale;
    ctx.quadraticCurveTo(lowX + dir * 3, lowY - 12 * scale, lowX, lowY);
    ctx.quadraticCurveTo(lowX - dir * 11 * scale, lowY - 13 * scale, rootX + dir * reach * 0.52, rootY + 21 * scale - flap * 12 * scale);
    ctx.quadraticCurveTo(rootX + dir * reach * 0.36, rootY + 9 * scale, rootX + dir * reach * 0.21, rootY + 22 * scale - flap * 6 * scale);
    ctx.quadraticCurveTo(rootX + dir * 6, rootY + 8 * scale, rootX, rootY + 14 * scale);
    ctx.closePath();
    ctx.fill();
    // Tulang sayap
    limb(ctx, rootX, rootY, elbowX, elbowY, 5 * scale, color);
    limb(ctx, elbowX, elbowY, tipX, tipY, 2.8 * scale, color);
    limb(ctx, elbowX, elbowY, rootX + dir * reach * 0.82, rootY + 14 * scale - flap * 18 * scale, 1.5 * scale, color);
    limb(ctx, elbowX, elbowY, rootX + dir * reach * 0.52, rootY + 21 * scale - flap * 12 * scale, 1.5 * scale, color);
    shape(ctx, [tipX - dir * 2, tipY + 2, tipX + dir * 7, tipY - 7, tipX + dir, tipY - 1], D.horn);
  };

  // Sayap jauh
  wing(cx - 6, cy - 16, -1, D.scaleDark, rgba(D.wing, 0.92), 0.88);

  // Ekor melengkung, ujungnya berduri
  const tailWave = Math.sin(tau - 1) * 5;
  ctx.fillStyle = vgrad(ctx, cy - 2, cy + 42, D.scale, D.scaleDark);
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 2);
  ctx.quadraticCurveTo(cx - 44, cy + 3, cx - 60, cy + 24 + tailWave);
  ctx.lineTo(cx - 66, cy + 19 + tailWave);
  ctx.quadraticCurveTo(cx - 40, cy - 8, cx - 14, cy + 13);
  ctx.closePath();
  ctx.fill();
  shape(ctx, [cx - 58, cy + 25 + tailWave, cx - 74, cy + 32 + tailWave, cx - 69, cy + 16 + tailWave], D.horn);

  // Kaki kecil tergantung saat terbang
  for (const [x, swing, col] of [[-5, c, D.scaleDark], [10, -c, D.scale]] as const) {
    limb(ctx, cx + x, cy + 14, cx + x - 1 + swing * 2, cy + 28, 6.4, col);
    oval(ctx, cx + x + swing * 2, cy + 30, 4.8, 3, col);
    for (let i = -1; i <= 1; i++) shape(ctx, [cx + x + i * 2.6 + swing * 2 - 1, cy + 30.4, cx + x + i * 3.4 + swing * 2, cy + 36, cx + x + i * 2.6 + swing * 2 + 1, cy + 30.4], D.horn);
  }

  // Badan
  ctx.fillStyle = vgrad(ctx, cy - 26, cy + 21, D.scaleLight, D.scaleDark);
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, 26, 21, -0.2, 0, TAU);
  ctx.fill();
  // Perut bersisik dengan bara di dada
  ctx.fillStyle = vgrad(ctx, cy - 10, cy + 18, D.belly, D.bellyDark);
  ctx.beginPath();
  ctx.ellipse(cx + 10, cy + 3, 14, 15.4, -0.3, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = D.bellyDark;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + 0.5 + i * 1.6, cy - 6 + i * 6);
    ctx.quadraticCurveTo(cx + 12, cy - 2 + i * 6, cx + 22 - i * 1.6, cy - 9 + i * 6);
    ctx.stroke();
  }
  const beat = 0.8 + 0.2 * Math.sin(tau * 2);
  softGlow(ctx, cx + 13, cy - 3, 18 * beat, D.ember, 0.62);
  oval(ctx, cx + 13, cy - 3, 4.2 * beat, 5 * beat, D.emberCore);

  // Duri punggung
  for (let i = 0; i < 5; i++) {
    const x = cx - 20 + i * 8.5;
    const y = cy - 15 - Math.sin(i / 4 * Math.PI) * 8;
    shape(ctx, [x - 3.4, y + 2.6, x - 2.6, y - 6.5, x + 3.4, y + 1], D.scaleDark);
  }

  // Leher dan kepala, menjulur ke depan-atas
  const nx = cx + 44 + c * 2;
  const ny = cy - 36 - s * 3;
  limb(ctx, cx + 14, cy - 11, cx + 30, cy - 27 - s, 16, D.scale);
  limb(ctx, cx + 30, cy - 27 - s, nx - 7, ny + 3, 13, D.scale);
  limb(ctx, cx + 20, cy - 8, cx + 35, cy - 22 - s, 5.6, D.belly);

  // Tanduk
  ctx.fillStyle = D.horn;
  ctx.beginPath();
  ctx.moveTo(nx - 10, ny - 7);
  ctx.quadraticCurveTo(nx - 22, ny - 15, nx - 30, ny - 8);
  ctx.quadraticCurveTo(nx - 22, ny - 7, nx - 9, ny - 1);
  ctx.fill();
  // Kepala: tengkorak dan moncong
  ctx.fillStyle = vgrad(ctx, ny - 11, ny + 9, D.scaleLight, D.scale);
  ctx.beginPath();
  ctx.moveTo(nx - 12, ny - 6);
  ctx.quadraticCurveTo(nx - 2, ny - 12, nx + 8, ny - 6);
  ctx.lineTo(nx + 23, ny - 1);
  ctx.quadraticCurveTo(nx + 26, ny + 2, nx + 22, ny + 4);
  ctx.lineTo(nx + 6, ny + 6);
  ctx.quadraticCurveTo(nx - 8, ny + 9, nx - 12, ny - 6);
  ctx.fill();
  // Rahang bawah membuka sesuai kepakan, api di dalam mulut
  const jaw = 2.2 + Math.max(0, c) * 3.4;
  softGlow(ctx, nx + 14, ny + 6 + jaw * 0.4, 12, D.ember, 0.65);
  shape(ctx, [nx - 3, ny + 5, nx + 21, ny + 4, nx + 16, ny + 5 + jaw, nx - 2, ny + 8 + jaw * 0.3], D.emberCore);
  ctx.fillStyle = D.scaleDark;
  ctx.beginPath();
  ctx.moveTo(nx - 6, ny + 7);
  ctx.lineTo(nx + 17, ny + 6 + jaw);
  ctx.lineTo(nx + 15, ny + 9.4 + jaw);
  ctx.quadraticCurveTo(nx + 2, ny + 11 + jaw, nx - 6, ny + 7);
  ctx.fill();
  for (let i = 0; i < 3; i++) shape(ctx, [nx + 9 + i * 4.4, ny + 4.2, nx + 10.4 + i * 4.4, ny + 7.6, nx + 12 + i * 4.4, ny + 4], D.horn);
  // Mata dan cuping hidung
  oval(ctx, nx + 2.5, ny - 4, 3, 2.3, D.eye);
  oval(ctx, nx + 3.2, ny - 4, 0.9, 1.9, D.pupil);
  limb(ctx, nx - 1.5, ny - 7, nx + 7, ny - 6, 1.7, D.scaleDark);
  oval(ctx, nx + 19.6, ny - 0.5, 1.2, 0.9, D.scaleDark);

  // Sayap dekat, menutup bahu
  wing(cx + 2, cy - 15, 1, D.scale, rgba(D.wingLight, 0.92), 0.82);

  // Bara beterbangan
  for (let i = 0; i < 5; i++) {
    const f = (t + i / 5) % 1;
    const ex = cx - 38 + i * 20 + Math.sin(f * 7 + i) * 4;
    const ey = cy + 26 - f * 34;
    oval(ctx, ex, ey, 1.5 * (1 - f) + 0.4, 1.5 * (1 - f) + 0.4, D.ember);
  }
}

export function bakeDragon(scene: Phaser.Scene): EnemyArt {
  const walk = 6;
  const strip = bake(scene, {
    key: 'dragon',
    w: 170,
    h: 150,
    frames: walkFrames(walk),
    mirror: (f) => f.left,
    draw: (ctx, f) => drawDragon(ctx, f.t),
    finish: { ...OUTLINE, outlineWidth: 1.1, rimAlpha: 0.3, shadeAlpha: 0.3, edge: 1.8 },
    normal: { strength: 3, pillow: 8, detail: 0.34 },
  });
  return { strip, walk, fps: 7, anchorY: 80 / 150, feet: 48, shadow: 92, size: 1, stomp: 0, debris: [hex(D.scaleLight), hex(D.ember), hex(D.horn)], smoke: hex(D.scaleDark) };
}
