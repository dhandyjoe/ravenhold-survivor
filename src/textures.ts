import * as Phaser from 'phaser';
import { COLORS, type EnemyKind } from './config';
import { bakeHero } from './art/hero';
import { bakeArrow, bakeBow, bakeGuardSword } from './art/weapons';
import { createEnvironment } from './art/environment';
import { createFxTextures } from './art/fx';
import { bakeDragon, bakeGoblin, bakeKnight, bakeOgre, bakeSkeleton, type EnemyArt } from './art/monsters';
import { TEX_SCALE, mix, rgba, type Ctx, type Strip } from './art/kit';

export { TEX_SCALE };

/**
 * Pintu masuk semua grafis. Semuanya dibuat lewat Canvas 2D, jadi tidak perlu file gambar.
 * Lukisan karakter dan lingkungan ada di `src/art/`.
 */
export interface Art {
  hero: Strip;
  cape: Strip;
  bow: Strip;
  arrow: Strip;
  sword: Strip;
  enemies: Record<EnemyKind, EnemyArt>;
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * TEX_SCALE);
  c.height = Math.ceil(h * TEX_SCALE);
  const ctx = c.getContext('2d')!;
  ctx.scale(TEX_SCALE, TEX_SCALE);
  draw(ctx);
  scene.textures.addCanvas(key, c);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function shadedFill(ctx: Ctx, cx: number, cy: number, r: number, light: string, dark: string) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

export function createTextures(scene: Phaser.Scene): Art {
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

  // Partikel
  make(scene, 'spark', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  createFxTextures(scene);
  createEnvironment(scene);
  const { hero, cape } = bakeHero(scene);
  return {
    hero,
    cape,
    bow: bakeBow(scene),
    arrow: bakeArrow(scene),
    sword: bakeGuardSword(scene),
    enemies: {
      drone: bakeGoblin(scene),
      blob: bakeSkeleton(scene),
      brute: bakeOgre(scene),
      titan: bakeKnight(scene),
      wyrm: bakeDragon(scene),
    },
  };
}
