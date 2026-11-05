import * as Phaser from 'phaser';
import { PALETTE } from '../config';
import { bake, limb, oval, shape, vgrad, type Ctx } from './kit';

/**
 * Pemanah pengelana bertudung. Tubuh dan jubah dipisah: jubah adalah Image sendiri
 * yang berayun dengan pegas di GameScene, sehingga geraknya tidak terkunci pada frame lari.
 */
const P = PALETTE.hero;
const TAU = Math.PI * 2;

export type HeroView = 0 | 1 | 2 | 3; // 0 bawah, 1 atas, 2 kanan, 3 kiri
export const HERO_IDLE = 4;
export const HERO_WALK = 6;
const PER_VIEW = HERO_IDLE + HERO_WALK;

export const HERO_SIZE = 64;
export const HERO_ANCHOR = { x: 32 / HERO_SIZE, y: 40 / HERO_SIZE };
export const CAPE_SIZE = 44;
export const CAPE_ANCHOR = { x: 22 / CAPE_SIZE, y: 6 / CAPE_SIZE };
export const CAPE_FRAMES = 4;

export const heroFrame = (view: HeroView, walking: boolean, step: number) =>
  view * PER_VIEW + (walking ? HERO_IDLE + (step % HERO_WALK) : step % HERO_IDLE);
export const capeFrame = (view: HeroView, step: number) => view * CAPE_FRAMES + (step % CAPE_FRAMES);

interface HeroPose {
  view: HeroView;
  walking: boolean;
  t: number;
}

function boot(ctx: Ctx, hipX: number, hipY: number, footX: number, footY: number, dir: number, dark: boolean) {
  const trousers = dark ? '#3f3228' : P.trousers;
  limb(ctx, hipX, hipY, footX, footY - 3, 5.4, trousers);
  limb(ctx, footX, footY - 5, footX, footY - 1, 5.2, dark ? '#2c1e17' : P.boot);
  oval(ctx, footX + dir * 1.4, footY, 3.9, 2.5, dark ? '#2c1e17' : P.boot);
  if (!dark) oval(ctx, footX + dir * 1.8, footY - 0.8, 1.9, 0.9, P.bootLight);
}

function tunic(ctx: Ctx, cx: number, top: number, hip: number, wide: number) {
  // Rok tunik di bawah ikat pinggang
  shape(ctx, [cx - wide + 0.6, hip - 1, cx + wide - 0.6, hip - 1, cx + wide + 1.6, hip + 5.2, cx + 2.5, hip + 4.2, cx, hip + 5.4, cx - 2.5, hip + 4.2, cx - wide - 1.6, hip + 5.2], vgrad(ctx, hip - 1, hip + 5.4, P.cloth, P.clothDark));
  // Rompi kulit
  ctx.fillStyle = vgrad(ctx, top, hip, P.leatherLight, P.leatherDark);
  ctx.beginPath();
  ctx.roundRect(cx - wide, top, wide * 2, hip - top + 0.5, 4.5);
  ctx.fill();
}

function belt(ctx: Ctx, cx: number, hip: number, wide: number, buckle: boolean) {
  ctx.fillStyle = P.boot;
  ctx.beginPath();
  ctx.roundRect(cx - wide - 0.3, hip - 1.8, wide * 2 + 0.6, 3, 1.2);
  ctx.fill();
  if (buckle) {
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.roundRect(cx - 1.7, hip - 2, 3.4, 3.4, 0.8);
    ctx.fill();
  }
}

function eye(ctx: Ctx, x: number, y: number) {
  oval(ctx, x, y, 1.45, 2.05, P.eye);
  oval(ctx, x - 0.4, y - 0.8, 0.6, 0.62, '#ffffff');
}

function headFront(ctx: Ctx, x: number, y: number) {
  // Pucuk tudung terkulai ke belakang
  shape(ctx, [x - 8.5, y - 7, x + 3, y - 11.5, x + 11, y - 15, x + 9.5, y - 6], P.capeDark);
  oval(ctx, x, y, 11.6, 11, vgrad(ctx, y - 11, y + 11, P.capeLight, P.cape));
  // Lubang tudung
  oval(ctx, x, y + 2.3, 8.7, 8, P.capeDark);
  oval(ctx, x, y + 3, 7.6, 7, vgrad(ctx, y - 3, y + 10, P.skinDark, P.skin));
  oval(ctx, x, y + 3.9, 7.2, 5.9, P.skin);
  // Poni
  shape(ctx, [x - 7.2, y + 1.7, x - 5, y - 3.3, x + 5, y - 3.3, x + 7.2, y + 1.7, x + 3.6, y - 0.2, x + 1.2, y + 1.3, x - 1.8, y - 0.3, x - 4.2, y + 1.3], P.hair);
  eye(ctx, x - 3.3, y + 4);
  eye(ctx, x + 3.3, y + 4);
  oval(ctx, x - 5, y + 6.6, 1.5, 0.85, '#e39377');
  oval(ctx, x + 5, y + 6.6, 1.5, 0.85, '#e39377');
  limb(ctx, x - 0.9, y + 7.8, x + 0.9, y + 7.8, 0.75, '#9c5a48');
}

function headBack(ctx: Ctx, x: number, y: number) {
  oval(ctx, x, y, 11.4, 11, vgrad(ctx, y - 11, y + 11, P.capeLight, P.capeDark));
  // Lipatan dan jahitan tudung dari belakang
  shape(ctx, [x - 2.4, y - 10.5, x + 2.4, y - 10.5, x + 1.5, y + 8.5, x - 1.5, y + 8.5], P.cape);
  ctx.strokeStyle = P.capeDark;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y - 10.5);
  ctx.quadraticCurveTo(x + 1.5, y, x, y + 9);
  ctx.stroke();
  shape(ctx, [x - 4, y - 9.3, x + 0.3, y - 15.6, x + 4, y - 9.3], P.cape);
}

function headSide(ctx: Ctx, x: number, y: number) {
  // Pucuk tudung ke belakang
  shape(ctx, [x - 3, y - 10, x - 15.5, y - 7.5, x - 9.5, y + 2], P.capeDark);
  oval(ctx, x - 0.6, y, 11.2, 10.8, vgrad(ctx, y - 11, y + 11, P.capeLight, P.cape));
  oval(ctx, x + 4.1, y + 2.1, 7, 7.9, P.capeDark);
  oval(ctx, x + 4.8, y + 3, 6, 6.9, vgrad(ctx, y - 3, y + 10, P.skinDark, P.skin));
  oval(ctx, x + 5.2, y + 4, 5.5, 5.7, P.skin);
  shape(ctx, [x - 0.5, y + 1.5, x + 1, y - 3.3, x + 9.5, y - 3, x + 10.5, y + 1.2, x + 7, y - 0.2, x + 4.6, y + 1.2, x + 2.6, y - 0.2], P.hair);
  eye(ctx, x + 7, y + 4);
  oval(ctx, x + 4.1, y + 6.6, 1.5, 0.85, '#e39377');
  oval(ctx, x + 10.5, y + 4.6, 0.75, 0.95, P.skinDark);
}

function quiver(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  ctx.fillStyle = P.quiver;
  ctx.beginPath();
  ctx.roundRect(-2.6, -2, 5.2, 14, 1.8);
  ctx.fill();
  for (const dx of [-1.6, 0.2, 1.8]) {
    limb(ctx, dx, -2, dx, -5.5, 0.8, PALETTE.arrow.shaft);
    shape(ctx, [dx - 1.2, -5, dx, -9, dx + 1.2, -5], P.feather);
  }
  ctx.restore();
}

function mantle(ctx: Ctx, cx: number, y: number, wide: number, clasp: boolean) {
  ctx.fillStyle = vgrad(ctx, y - 3, y + 5, P.capeLight, P.cape);
  ctx.beginPath();
  ctx.moveTo(cx - wide, y + 3.8);
  ctx.quadraticCurveTo(cx - wide + 1, y - 3.4, cx, y - 3.6);
  ctx.quadraticCurveTo(cx + wide - 1, y - 3.4, cx + wide, y + 3.8);
  ctx.quadraticCurveTo(cx, y + 6.6, cx - wide, y + 3.8);
  ctx.fill();
  if (clasp) oval(ctx, cx, y + 2.4, 1.5, 1.5, P.gold);
}

function drawHero(ctx: Ctx, f: HeroPose) {
  const tau = f.t * TAU;
  const s = Math.sin(tau);
  const c = Math.cos(tau);
  const bob = f.walking ? Math.abs(c) * 1.7 : (Math.sin(tau) + 1) * 0.42;
  const hip = 47.5 - bob;
  const top = hip - 13;
  const head = hip - 21 + (f.walking ? Math.abs(s) * 0.35 : 0.2);

  if (f.view === 0) {
    const liftA = f.walking ? Math.max(0, s) * 3.6 : 0;
    const liftB = f.walking ? Math.max(0, -s) * 3.6 : 0;
    const sway = f.walking ? s * 0.7 : 0;
    boot(ctx, 28.6, hip + 2, 27.7, 57.5 - liftA, -0.25, false);
    boot(ctx, 35.4, hip + 2, 36.3, 57.5 - liftB, 0.25, false);
    tunic(ctx, 32 + sway, top, hip, 7.5);
    ctx.strokeStyle = P.leatherDark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(32 + sway, top + 2);
    ctx.lineTo(32 + sway, hip - 2);
    ctx.stroke();
    belt(ctx, 32 + sway, hip, 7.5, true);
    const swing = f.walking ? s * 2.4 : 0;
    limb(ctx, 24.5 + sway, top + 2.6, 23.8 + sway, top + 9.5 + swing, 4.2, P.cloth);
    oval(ctx, 23.8 + sway, top + 10.8 + swing, 2.1, 2.1, P.skin);
    limb(ctx, 39.5 + sway, top + 2.6, 40.2 + sway, top + 9.5 - swing, 4.2, P.cloth);
    oval(ctx, 40.2 + sway, top + 10.8 - swing, 2.1, 2.1, P.skin);
    mantle(ctx, 32 + sway, top + 1.2, 10.2, true);
    headFront(ctx, 32 + sway * 0.5, head);
  } else if (f.view === 1) {
    const liftA = f.walking ? Math.max(0, s) * 3.6 : 0;
    const liftB = f.walking ? Math.max(0, -s) * 3.6 : 0;
    const sway = f.walking ? s * 0.7 : 0;
    boot(ctx, 28.6, hip + 2, 27.7, 57.5 - liftA, -0.15, false);
    boot(ctx, 35.4, hip + 2, 36.3, 57.5 - liftB, 0.15, false);
    tunic(ctx, 32 + sway, top, hip, 7.5);
    belt(ctx, 32 + sway, hip, 7.5, false);
    const swing = f.walking ? s * 2.4 : 0;
    limb(ctx, 24.5 + sway, top + 2.6, 23.8 + sway, top + 9.5 + swing, 4.2, P.cloth);
    oval(ctx, 23.8 + sway, top + 10.8 + swing, 2.1, 2.1, P.skin);
    limb(ctx, 39.5 + sway, top + 2.6, 40.2 + sway, top + 9.5 - swing, 4.2, P.cloth);
    oval(ctx, 40.2 + sway, top + 10.8 - swing, 2.1, 2.1, P.skin);
    quiver(ctx, 36 + sway, top - 3);
    mantle(ctx, 32 + sway, top + 1.2, 10.2, false);
    headBack(ctx, 32 + sway * 0.5, head);
  } else {
    const dx = f.walking ? s * 7.4 : 0;
    const liftA = f.walking ? Math.max(0, c) * 3.8 : 0;
    const liftB = f.walking ? Math.max(0, -c) * 3.8 : 0;
    const lean = f.walking ? 1.6 : 0;
    boot(ctx, 31, hip + 1.5, 31 - dx, 57.5 - liftB, 1, true);
    quiver(ctx, 25.5, top + 1);
    const swing = f.walking ? s * 4.5 : 0;
    limb(ctx, 32 + lean, top + 3, 32 + lean + swing * 0.7, top + 10.5, 3.6, P.clothDark);
    boot(ctx, 33, hip + 1.5, 33 + dx, 57.5 - liftA, 1, false);
    tunic(ctx, 32 + lean * 0.7, top, hip, 6.2);
    belt(ctx, 32 + lean * 0.7, hip, 6.2, false);
    limb(ctx, 31.5 + lean, top + 3, 31.5 + lean - swing, top + 10, 4, P.cloth);
    oval(ctx, 31.5 + lean - swing, top + 11.3, 2.1, 2.1, P.skin);
    mantle(ctx, 31.5 + lean, top + 1.2, 8.6, false);
    headSide(ctx, 32.5 + lean, head);
  }
}

function drawCape(ctx: Ctx, view: HeroView, t: number) {
  const tau = t * TAU;
  const w1 = Math.sin(tau) * 1.1;
  const w2 = Math.sin(tau + 2) * 1.1;
  const w3 = Math.sin(tau + 4) * 1.1;
  const x = 22;
  const y = 6;
  if (view === 2 || view === 3) {
    // Tampak samping: jubah jatuh di belakang punggung
    ctx.fillStyle = vgrad(ctx, y, y + 27, P.cape, P.capeDark);
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 1);
    ctx.quadraticCurveTo(x - 4, y + 2, x - 7 + w1, y + 14);
    ctx.quadraticCurveTo(x - 9 + w2, y + 22, x - 8 + w3, y + 27);
    ctx.lineTo(x - 3.5 + w1, y + 25.2);
    ctx.lineTo(x + 0.5 + w2, y + 27);
    ctx.quadraticCurveTo(x + 3, y + 12, x + 3, y - 1);
    ctx.fill();
    limb(ctx, x - 1.5, y + 5, x - 3.5 + w1, y + 21, 1, P.capeLight);
    return;
  }
  const front = view === 1;
  // Tampak belakang lebih pendek supaya kaki tetap terlihat dan siluet manusianya terbaca
  const len = front ? 20 : 27;
  const half = front ? 10 : 12.5;
  ctx.fillStyle = front ? vgrad(ctx, y, y + len, P.capeLight, P.capeDark) : P.capeDark;
  ctx.beginPath();
  ctx.moveTo(x - 7.5, y);
  ctx.quadraticCurveTo(x - half + 1, y + len * 0.45, x - half + w1, y + len - 1);
  ctx.lineTo(x - half * 0.56 + w2, y + len - 2.8);
  ctx.lineTo(x - half * 0.2 + w3, y + len);
  ctx.lineTo(x + half * 0.2 + w1, y + len - 2.6);
  ctx.lineTo(x + half * 0.56 + w2, y + len);
  ctx.lineTo(x + half + w3, y + len - 1.6);
  ctx.quadraticCurveTo(x + half - 1, y + len * 0.45, x + 7.5, y);
  ctx.closePath();
  ctx.fill();
  if (front) {
    limb(ctx, x - 4, y + 4, x - 5.5 + w2, y + len - 5, 1.1, P.cape);
    limb(ctx, x + 4, y + 4, x + 5.5 + w3, y + len - 5, 1.1, P.cape);
    limb(ctx, x, y + 3, x + w1, y + len - 4, 1, P.capeDark);
  }
}

export function bakeHero(scene: Phaser.Scene) {
  const poses: HeroPose[] = [];
  for (const view of [0, 1, 2, 3] as HeroView[]) {
    for (let i = 0; i < HERO_IDLE; i++) poses.push({ view, walking: false, t: i / HERO_IDLE });
    for (let i = 0; i < HERO_WALK; i++) poses.push({ view, walking: true, t: i / HERO_WALK });
  }
  const hero = bake(scene, {
    key: 'hero',
    w: HERO_SIZE,
    h: HERO_SIZE,
    res: 2.5,
    frames: poses,
    mirror: (f) => f.view === 3,
    draw: drawHero,
    finish: { outline: PALETTE.outline, outlineWidth: 0.85, rim: PALETTE.rim, rimAlpha: 0.32, shade: PALETTE.shade, shadeAlpha: 0.3, edge: 1.1 },
    normal: { strength: 2.2, pillow: 6, detail: 0.32 },
  });

  const capes: { view: HeroView; t: number }[] = [];
  for (const view of [0, 1, 2, 3] as HeroView[]) for (let i = 0; i < CAPE_FRAMES; i++) capes.push({ view, t: i / CAPE_FRAMES });
  const cape = bake(scene, {
    key: 'heroCape',
    w: CAPE_SIZE,
    h: CAPE_SIZE,
    res: 2.5,
    frames: capes,
    mirror: (f) => f.view === 3,
    draw: (ctx, f) => drawCape(ctx, f.view, f.t),
    finish: { outline: PALETTE.outline, outlineWidth: 0.8, rim: PALETTE.rim, rimAlpha: 0.2, shade: PALETTE.shade, shadeAlpha: 0.3, edge: 1 },
    normal: { strength: 2, pillow: 5, detail: 0.35 },
  });
  return { hero, cape };
}
