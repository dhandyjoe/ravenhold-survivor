import * as Phaser from 'phaser';
import { COLORS, PALETTE, type EnemyKind } from './config';
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

function shapeFill(ctx: Ctx, pts: number[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

export function createTextures(scene: Phaser.Scene): Art {
  // Permata XP: potongan berfaset beroutline gelap hangat, zamrud kecil dan topas besar
  const gem = (key: string, color: string, s: number) =>
    make(scene, key, 32, 32, (ctx) => {
      glow(ctx, 16, 17, 15, color, 0.28);
      ctx.save();
      ctx.translate(16, 17);
      ctx.scale(s, s);
      const P = (pts: number[]) => pts.map((v) => v - 16);
      const crown = P([10, 10, 22, 10, 25.5, 14.5, 6.5, 14.5]);
      const left = P([6.5, 14.5, 16, 14.5, 16, 26]);
      const right = P([16, 14.5, 25.5, 14.5, 16, 26]);
      shapeFill(ctx, crown, mix(color, '#fff4d6', 0.55));
      shapeFill(ctx, left, mix(color, '#fff4d6', 0.1));
      shapeFill(ctx, right, mix(color, PALETTE.outline, 0.45));
      // Faset tengah mahkota lebih terang, memberi kesan kilap
      shapeFill(ctx, P([13, 10, 19, 10, 20.5, 14.5, 11.5, 14.5]), mix(color, '#ffffff', 0.7));
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = PALETTE.outline;
      ctx.beginPath();
      const outline = P([10, 10, 22, 10, 25.5, 14.5, 16, 26, 6.5, 14.5]);
      ctx.moveTo(outline[0], outline[1]);
      for (let i = 2; i < outline.length; i += 2) ctx.lineTo(outline[i], outline[i + 1]);
      ctx.closePath();
      ctx.moveTo(P([6.5])[0], P([14.5])[0]);
      ctx.lineTo(P([25.5])[0], P([14.5])[0]);
      ctx.stroke();
      // Kilau kecil di sudut kiri atas
      ctx.fillStyle = rgba('#ffffff', 0.9);
      ctx.beginPath();
      ctx.ellipse(12.5 - 16, 12 - 16, 1.6, 0.9, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  gem('gem', COLORS.gem, 1);
  gem('gemBig', COLORS.gemBig, 1.2);

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
