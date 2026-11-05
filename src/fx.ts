import * as Phaser from 'phaser';

export interface FxOptions {
  key?: string;
  frame?: Phaser.Textures.Frame;
  x: number;
  y: number;
  life: number;
  depth: number;
  /** Tunda sebelum mulai terlihat, dalam detik. */
  delay?: number;
  /** Skala awal dan akhir; `sy` mengikuti `s` kalau kosong. */
  s0: number;
  s1: number;
  sy0?: number;
  sy1?: number;
  a0?: number;
  a1?: number;
  vx?: number;
  vy?: number;
  rotation?: number;
  spin?: number;
  tint?: number;
  add?: boolean;
  lit?: boolean;
  originX?: number;
  originY?: number;
  /** Kurva laju: 'out' cepat di awal (ledakan), 'in' cepat di akhir (benda jatuh). */
  ease?: 'out' | 'in' | 'linear';
  /** Mengikuti titik yang bergerak, misalnya pemain. */
  follow?: { x: number; y: number };
}

interface Fx extends Required<Pick<FxOptions, 's0' | 's1' | 'life'>> {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  age: number;
  delay: number;
  sy0: number;
  sy1: number;
  a0: number;
  a1: number;
  vx: number;
  vy: number;
  spin: number;
  ease: 'out' | 'in' | 'linear';
  follow: { x: number; y: number } | null;
}

const MAX_FX = 260;

/**
 * Pool efek sekali pakai. Berjalan dengan `dt` dari loop utama (bukan tween), jadi ikut
 * berhenti saat jeda dan tidak membuat objek baru selama permainan.
 */
export class FxPool {
  private pool: Fx[] = [];
  private free: Fx[] = [];
  private active: Fx[] = [];

  constructor(private scene: Phaser.Scene) {}

  spawn(o: FxOptions) {
    let f = this.free.pop();
    if (!f) {
      if (this.pool.length >= MAX_FX) return undefined;
      f = {
        img: this.scene.add.image(0, 0, o.key ?? 'spark').setActive(false).setVisible(false),
        alive: false,
        age: 0,
        delay: 0,
        life: 1,
        s0: 1,
        s1: 1,
        sy0: 1,
        sy1: 1,
        a0: 1,
        a1: 0,
        vx: 0,
        vy: 0,
        spin: 0,
        ease: 'out',
        follow: null,
      };
      this.pool.push(f);
    }
    f.alive = true;
    f.age = 0;
    f.delay = o.delay ?? 0;
    f.life = o.life;
    f.s0 = o.s0;
    f.s1 = o.s1;
    f.sy0 = o.sy0 ?? o.s0;
    f.sy1 = o.sy1 ?? o.s1;
    f.a0 = o.a0 ?? 1;
    f.a1 = o.a1 ?? 0;
    f.vx = o.vx ?? 0;
    f.vy = o.vy ?? 0;
    f.spin = o.spin ?? 0;
    f.ease = o.ease ?? 'out';
    f.follow = o.follow ?? null;
    const img = f.img;
    if (o.frame) img.setFrame(o.frame, true, false);
    else img.setTexture(o.key!);
    img
      .setPosition(o.x, o.y)
      .setOrigin(o.originX ?? 0.5, o.originY ?? 0.5)
      .setScale(f.s0, f.sy0)
      .setAlpha(f.delay > 0 ? 0 : f.a0)
      .setRotation(o.rotation ?? 0)
      .setDepth(o.depth)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setLighting(o.lit ?? false)
      .setActive(true)
      .setVisible(true);
    if (o.tint !== undefined) img.setTint(o.tint);
    else img.clearTint();
    this.active.push(f);
    return img;
  }

  update(dt: number) {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.delay > 0) {
        f.delay -= dt;
        if (f.delay > 0) continue;
      }
      f.age += dt;
      if (f.age >= f.life) {
        this.release(f, i);
        continue;
      }
      const t = f.age / f.life;
      const e = f.ease === 'out' ? 1 - (1 - t) * (1 - t) * (1 - t) : f.ease === 'in' ? t * t : t;
      const img = f.img;
      img.scaleX = f.s0 + (f.s1 - f.s0) * e;
      img.scaleY = f.sy0 + (f.sy1 - f.sy0) * e;
      img.alpha = f.a0 + (f.a1 - f.a0) * t;
      img.rotation += f.spin * dt;
      if (f.follow) {
        img.x = f.follow.x;
        img.y = f.follow.y;
      } else {
        img.x += f.vx * dt;
        img.y += f.vy * dt;
      }
    }
  }

  private release(f: Fx, index: number) {
    f.alive = false;
    f.follow = null;
    f.img.setActive(false).setVisible(false);
    const list = this.active;
    list[index] = list[list.length - 1];
    list.pop();
    this.free.push(f);
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this.release(this.active[i], i);
  }

  get activeCount() {
    return this.active.length;
  }
}
