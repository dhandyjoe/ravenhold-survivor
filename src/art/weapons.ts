import * as Phaser from 'phaser';
import { PALETTE } from '../config';
import { bake, limb, rgba, shape, type Ctx } from './kit';

/** Busur digambar menghadap kanan. Frame 0 = rileks, frame terakhir = tertarik penuh. */
export const BOW_FRAMES = 3;
export const BOW_SIZE = 44;
export const BOW_ANCHOR = { x: 18 / BOW_SIZE, y: 0.5 };

const W = PALETTE.wood;
const A = PALETTE.arrow;

function drawArrowBody(ctx: Ctx, tail: number, tip: number, y: number) {
  limb(ctx, tail, y, tip - 3.5, y, 1.25, A.shaft);
  shape(ctx, [tip - 4.5, y - 2.3, tip + 0.5, y, tip - 4.5, y + 2.3], A.head);
  shape(ctx, [tip - 4.5, y, tip + 0.5, y, tip - 4.5, y + 2.3], A.headDark);
  shape(ctx, [tail - 1.5, y - 2.5, tail + 4.5, y - 0.4, tail + 0.5, y - 0.2], A.fletch);
  shape(ctx, [tail - 1.5, y + 2.5, tail + 4.5, y + 0.4, tail + 0.5, y + 0.2], A.fletch);
}

function drawBow(ctx: Ctx, pull: number) {
  const gx = 18;
  const gy = 22;
  const bend = pull * 2.4;
  const tipX = gx - 7 - bend;
  const tipTop = gy - 16 + bend * 0.45;
  const tipBot = gy + 16 - bend * 0.45;
  const stringX = tipX - pull * 9;

  ctx.strokeStyle = W.string;
  ctx.lineWidth = 0.65;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tipX, tipTop);
  ctx.lineTo(stringX, gy);
  ctx.lineTo(tipX, tipBot);
  ctx.stroke();

  if (pull > 0) drawArrowBody(ctx, stringX, gx + 11, gy);

  // Lengan busur: dua kurva, tebal di pegangan lalu menipis
  const curve = (dir: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + 2.5, gy + dir * 9, tipX, gy + dir * (16 - bend * 0.45));
    ctx.stroke();
  };
  curve(-1, W.dark, 3);
  curve(1, W.dark, 3);
  curve(-1, W.light, 1.3);
  curve(1, W.light, 1.3);
  limb(ctx, gx + 0.2, gy - 3, gx + 0.2, gy + 3, 3.4, W.wrap);
}

export function bakeBow(scene: Phaser.Scene) {
  const frames = Array.from({ length: BOW_FRAMES }, (_, i) => i / (BOW_FRAMES - 1));
  return bake(scene, {
    key: 'bow',
    w: BOW_SIZE,
    h: BOW_SIZE,
    frames,
    draw: (ctx, pull) => drawBow(ctx, pull),
    finish: { outline: PALETTE.outline, outlineWidth: 0.6 },
    normal: { strength: 1.4, pillow: 2, detail: 0.3 },
  });
}

/** Pedang Penjaga: pedang melayang yang mengorbit pemain. Digambar menunjuk ke kanan. */
export function bakeGuardSword(scene: Phaser.Scene) {
  const S = PALETTE.sword;
  return bake(scene, {
    key: 'guardSword',
    w: 48,
    h: 20,
    frames: [0],
    draw: (ctx) => {
      const y = 10;
      shape(ctx, [14, y - 3.3, 38, y - 2.5, 46, y, 38, y + 2.5, 14, y + 3.3], S.blade);
      shape(ctx, [14, y, 46, y, 38, y + 2.5, 14, y + 3.3], S.bladeDark);
      limb(ctx, 16, y, 37, y, 0.8, S.rune);
      limb(ctx, 12.5, y - 7.5, 12.5, y + 7.5, 2.8, S.guard);
      limb(ctx, 12.5, y - 7, 12.5, y - 1, 0.8, S.guardDark);
      limb(ctx, 4, y, 11, y, 3, S.grip);
      shape(ctx, [1, y, 3.5, y - 2.6, 6, y, 3.5, y + 2.6], S.guard);
    },
    finish: { outline: PALETTE.outline, outlineWidth: 0.7, rim: PALETTE.rim, rimAlpha: 0.3, edge: 0.7 },
  });
}

/** Anak panah terbang, dengan jejak udara tipis di belakangnya. */
export function bakeArrow(scene: Phaser.Scene) {
  return bake(scene, {
    key: 'arrow',
    w: 56,
    h: 14,
    frames: [0],
    draw: (ctx) => {
      const g = ctx.createLinearGradient(2, 0, 28, 0);
      g.addColorStop(0, rgba(PALETTE.rim, 0));
      g.addColorStop(1, rgba(PALETTE.rim, 0.42));
      shape(ctx, [2, 7, 28, 5.8, 28, 8.2], g);
      drawArrowBody(ctx, 25, 50, 7);
    },
    finish: {},
    normal: { strength: 1, pillow: 1, detail: 0.2 },
  });
}
