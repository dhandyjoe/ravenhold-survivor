import type * as Phaser from 'phaser';
import { PALETTE, SPECIALS, SPECIAL_FX, hex, type SpecialId } from './config';
import { RING_RADIUS } from './art/fx';
import { specialDamage } from './balance';
import type { FxPool } from './fx';
import type { SoundId } from './audioCatalog';
import { TEX_SCALE } from './art/kit';

/** Musuh sejauh yang perlu diketahui pusaka. */
export interface SpecialTarget {
  id: number;
  img: { x: number; y: number };
  radius: number;
  alive: boolean;
}

/** Jembatan ke GameScene, supaya pusaka tidak perlu tahu isi scene. */
export interface SpecialHost {
  player: Phaser.GameObjects.Image;
  fx: FxPool;
  hpMul(): number;
  damageMul(): number;
  enemies(): readonly SpecialTarget[];
  /** Memanggil fn untuk setiap musuh yang lingkarannya menyentuh lingkaran ini. */
  eachInRadius(x: number, y: number, r: number, fn: (e: SpecialTarget, dist: number, dx: number, dy: number) => void): void;
  /** Titik tengah kerumunan terpadat dalam jangkauan. False kalau tidak ada musuh. */
  densest(range: number, out: { x: number; y: number }, avoid?: { x: number; y: number }, avoidRadius?: number): boolean;
  hit(e: SpecialTarget, damage: number, kx: number, ky: number, knock: number): void;
  /** Mendorong tanpa melukai, memperhitungkan berat musuh. */
  push(e: SpecialTarget, kx: number, ky: number, force: number): void;
  /** Memperlambat; 0 berarti membeku. Bos punya batas sendiri. */
  slow(e: SpecialTarget, factor: number, seconds: number): void;
  heal(amount: number): void;
  debris(x: number, y: number, count: number, tint: number[]): void;
  shake(ms: number, power: number): void;
  slowMotion(seconds: number): void;
  flash(x: number, y: number, color: number, power: number, radius: number): void;
  /** Efek suara; posisi opsional untuk pan dan jarak. */
  sound(id: SoundId, x?: number, y?: number): void;
  /** Suara berulang selama `seconds`. */
  loop(id: SoundId, seconds: number): void;
}

type StrikeKind = 'meteorCue' | 'meteor' | 'burn' | 'rainSpawn' | 'rainHit' | 'thunder' | 'moon' | 'flame' | 'holy' | 'shatter' | 'quake';

interface Strike {
  at: number;
  kind: StrikeKind;
  x: number;
  y: number;
  r: number;
  damage: number;
}

interface MoonWave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  damage: number;
  /** Musuh yang sudah kena gelombang ini, supaya tiap musuh hanya kena sekali. */
  hit: Set<number>;
}

interface Raven {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  cool: number;
  damage: number;
  target: SpecialTarget | null;
  img: { rotation: number } | undefined;
}

interface Tornado {
  x: number;
  y: number;
  r: number;
  life: number;
  tick: number;
  retarget: number;
  goalX: number;
  goalY: number;
  damage: number;
  offset: number;
}

const FX = SPECIAL_FX;
const F = PALETTE.fx;
const RANGE = 460; // jangkauan mencari sasaran dari pemain
const TAU = Math.PI * 2;
const INV = 1 / TEX_SCALE;

const RAIN_ARROW = INV * 1.35;
const DEPTH_GROUND = 3.5;
const DEPTH_AIR = 11.5;

/** Skala tekstur cincin agar menutupi lingkaran berjari-jari `r` di dunia. */
const ringScale = (r: number) => (r / RING_RADIUS) * INV;

/**
 * Senjata pusaka. Semua penjadwalan memakai `clock` yang dijalankan loop utama,
 * sehingga serangan yang sedang berlangsung ikut berhenti saat permainan dijeda.
 */
export class SpecialWeapons {
  private tiers: Partial<Record<SpecialId, number>> = {};
  private timers: Partial<Record<SpecialId, number>> = {};
  private strikes: Strike[] = [];
  private spare: Strike[] = [];
  private waves: MoonWave[] = [];
  private ravens: Raven[] = [];
  private tornados: Tornado[] = [];
  private clock = 0;
  private point = { x: 0, y: 0 };

  constructor(private host: SpecialHost) {}

  reset() {
    this.tiers = {};
    this.timers = {};
    this.spare.push(...this.strikes);
    this.strikes.length = 0;
    this.waves.length = 0;
    this.ravens.length = 0;
    this.tornados.length = 0;
    this.clock = 0;
  }

  /** Tingkat 1..3. Langsung menembak sekali, supaya efeknya terasa saat itu juga. */
  setTier(id: SpecialId, tier: number) {
    this.tiers[id] = tier;
    this.timers[id] = 0.15;
  }

  /** 1 = siap, 0 = baru saja dipakai. */
  readiness(id: SpecialId) {
    const tier = this.tiers[id];
    if (!tier) return 0;
    const cd = SPECIALS[id][tier - 1].cooldown;
    return 1 - Math.max(0, Math.min(1, (this.timers[id] ?? 0) / cd));
  }

  get owned() {
    return Object.keys(this.tiers) as SpecialId[];
  }

  update(dt: number) {
    this.clock += dt;
    for (const id of this.owned) {
      const left = (this.timers[id] ?? 0) - dt;
      this.timers[id] = left;
      if (left > 0) continue;
      const tier = this.tiers[id]! - 1;
      if (this.activate(id, tier)) this.timers[id] = SPECIALS[id][tier].cooldown;
      else this.timers[id] = 0.25; // belum ada sasaran: coba lagi sebentar lagi
    }
    this.runStrikes();
    this.updateWaves(dt);
    this.updateRavens(dt);
    this.updateTornados(dt);
  }

  private schedule(kind: StrikeKind, delay: number, x: number, y: number, r: number, damage: number) {
    const s = this.spare.pop() ?? ({} as Strike);
    s.kind = kind;
    s.at = this.clock + delay;
    s.x = x;
    s.y = y;
    s.r = r;
    s.damage = damage;
    this.strikes.push(s);
  }

  private runStrikes() {
    const list = this.strikes;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (this.clock < s.at) continue;
      list[i] = list[list.length - 1];
      list.pop();
      if (s.kind === 'meteorCue') this.host.sound('meteor_fall', s.x, s.y);
      else if (s.kind === 'meteor') this.explodeMeteor(s);
      else if (s.kind === 'burn') this.burn(s);
      else if (s.kind === 'rainSpawn') this.dropArrow(s);
      else if (s.kind === 'rainHit') this.arrowHit(s);
      else if (s.kind === 'thunder') this.strikeThunder(s);
      else if (s.kind === 'flame') this.flame(s);
      else if (s.kind === 'holy') this.holyPulse(s);
      else if (s.kind === 'shatter') this.shatter(s);
      else if (s.kind === 'quake') this.quakeBlast(s);
      else this.startMoon(s);
      // Baru dikembalikan setelah dipakai: penanganan di atas bisa menjadwalkan serangan baru
      this.spare.push(s);
    }
  }

  private activate(id: SpecialId, tier: number) {
    const spec = SPECIALS[id][tier];
    const h = this.host;
    if (!h.densest(RANGE, this.point)) return false;
    const damage = specialDamage(id, tier, h.hpMul(), h.damageMul());
    if (id === 'meteor') {
      const first = { x: this.point.x, y: this.point.y };
      for (let i = 0; i < spec.count; i++) {
        if (i > 0 && !h.densest(RANGE, this.point, first, spec.radius * 0.9)) {
          // Tidak ada kerumunan lain: jatuhkan di sekitar kerumunan pertama
          this.point.x = first.x + Math.cos(i * 2.4) * spec.radius * 0.8;
          this.point.y = first.y + Math.sin(i * 2.4) * spec.radius * 0.8;
        }
        this.launchMeteor(this.point.x, this.point.y, spec.radius, damage, i * FX.meteorGap);
      }
    } else if (id === 'rain') {
      h.sound('rain_release');
      h.loop('rain_loop', FX.rainDuration + FX.rainFall);
      for (let i = 0; i < spec.count; i++) {
        this.schedule('rainSpawn', (i / spec.count) * FX.rainDuration, 0, 0, spec.radius, damage);
      }
    } else if (id === 'thunder') {
      h.sound('thunder_rumble');
      for (let i = 0; i < spec.count; i++) {
        this.schedule('thunder', i * FX.thunderGap, 0, 0, spec.radius, damage);
      }
    } else if (id === 'moon') {
      for (let i = 0; i < spec.count; i++) {
        this.schedule('moon', i * FX.moonGap, 0, 0, spec.radius, damage);
      }
    } else if (id === 'ravens') {
      this.releaseRavens(spec.count, damage);
      for (let i = 0; i < 3; i++) h.sound('raven_caw');
      h.loop('raven_wings', FX.ravenLife);
    } else if (id === 'tornado') {
      this.summonTornados(spec.count, spec.radius, damage);
      h.sound('tornado_start');
      h.loop('tornado_loop', FX.tornadoLife);
    } else if (id === 'flames') {
      this.igniteRing(spec.count, spec.radius, damage);
      h.sound('flames_ignite');
      h.loop('flames_loop', FX.flamesLife);
    } else if (id === 'holy') {
      for (let i = 0; i < spec.count; i++) this.schedule('holy', i * FX.holyGap, 0, 0, spec.radius, damage);
    } else if (id === 'frost') {
      this.freeze(spec.radius, spec.count, damage);
    } else {
      this.crackGround(spec.count, spec.radius, damage);
    }
    return true;
  }

  // ---------------------------------------------------------------- Bintang Jatuh

  private launchMeteor(x: number, y: number, r: number, damage: number, delay: number) {
    const fall = FX.meteorFall;
    const fx = this.host.fx;
    fx.spawn({ key: 'fxTarget', x, y, life: fall + 0.08, delay, depth: DEPTH_GROUND, s0: ringScale(r * 1.15), s1: ringScale(r), a0: 0.35, a1: 1, spin: 1.6, ease: 'in' });
    // Jatuh miring dari kanan atas layar; ekor api menghadap arah datangnya
    const dropX = 240;
    const dropY = -620;
    const scale = 1.25 + (r / 170 - 1);
    fx.spawn({
      key: 'fxMeteor',
      x: x + dropX,
      y: y + dropY,
      vx: -dropX / fall,
      vy: -dropY / fall,
      life: fall,
      delay,
      depth: DEPTH_AIR,
      s0: scale * 0.75 * INV,
      s1: scale * INV,
      a0: 1,
      a1: 1,
      rotation: Math.atan2(-dropY, -dropX) - Math.PI / 2,
      ease: 'linear',
      originY: 0.78,
    });
    // Siulan meteor mulai saat meteor muncul di atas, supaya mendarat bersama ledakannya
    this.schedule('meteorCue', delay, x, y, r, damage);
    this.schedule('meteor', delay + fall, x, y, r, damage);
  }

  private explodeMeteor(s: Strike) {
    const h = this.host;
    const { x, y, r } = s;
    h.eachInRadius(x, y, r, (e, _d, dx, dy) => h.hit(e, s.damage, dx, dy, 900));

    const fx = h.fx;
    fx.spawn({ key: 'fxCrater', x, y, life: FX.craterLife, depth: DEPTH_GROUND, s0: ringScale(r * 0.82), s1: ringScale(r * 0.86), a0: 0.95, a1: 0, ease: 'linear' });
    fx.spawn({ key: 'fxBlast', x, y, life: 0.42, depth: DEPTH_AIR, s0: ringScale(r * 0.5), s1: ringScale(r * 1.25), a0: 1, a1: 0, add: true });
    fx.spawn({ key: 'fxShock', x, y, life: 0.42, depth: DEPTH_GROUND + 0.1, s0: ringScale(r * 0.3), s1: ringScale(r * 1.3), a0: 0.95, a1: 0, tint: hex(F.fireCore) });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + Math.random();
      const d = r * (0.1 + Math.random() * 0.35);
      const sp = 40 + Math.random() * 90;
      fx.spawn({
        key: 'puff',
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.9 + Math.random() * 0.6,
        delay: 0.05,
        depth: DEPTH_AIR - 0.1,
        s0: r / 170,
        s1: r / 80,
        a0: 0.5,
        a1: 0,
        spin: (Math.random() - 0.5) * 1.5,
        tint: hex(F.smoke),
      });
    }
    h.debris(x, y, 26, [hex(F.fire), hex(F.fireCore), hex(F.scorch)]);
    h.sound('meteor_impact', x, y);
    h.loop('meteor_burn', FX.craterLife);
    h.shake(280, 0.016);
    h.slowMotion(0.09);
    h.flash(x, y, hex(F.fire), 3, r * 2.2);

    const ticks = Math.floor(FX.craterLife / FX.burnTick) - 1;
    for (let i = 1; i <= ticks; i++) this.schedule('burn', i * FX.burnTick, x, y, r * 0.78, s.damage * FX.burnDamage);
  }

  private burn(s: Strike) {
    const h = this.host;
    h.eachInRadius(s.x, s.y, s.r, (e, _d, dx, dy) => h.hit(e, s.damage, dx, dy, 40));
    const a = Math.random() * TAU;
    const d = Math.random() * s.r * 0.7;
    h.fx.spawn({ key: 'puff', x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, vy: -50, life: 0.55, depth: DEPTH_GROUND + 0.2, s0: 0.7, s1: 1.4, a0: 0.75, a1: 0, tint: hex(F.fire), add: true });
  }

  // ---------------------------------------------------------------- Hujan Panah

  /** Sebagian besar panah mengincar musuh sungguhan, sisanya mengisi area. */
  private dropArrow(s: Strike) {
    const h = this.host;
    const px = h.player.x;
    const py = h.player.y;
    let x = 0;
    let y = 0;
    const target = Math.random() < 0.72 ? this.randomEnemy(s.r) : null;
    if (target) {
      x = target.img.x + (Math.random() - 0.5) * 22;
      y = target.img.y + (Math.random() - 0.5) * 22;
    } else {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * s.r;
      x = px + Math.cos(a) * d;
      y = py + Math.sin(a) * d * 0.8;
    }
    const fall = FX.rainFall;
    const height = 320;
    const drift = 44;
    h.fx.spawn({
      key: 'fxRainArrow',
      x: x + drift,
      y: y - height,
      vx: -drift / fall,
      vy: height / fall,
      life: fall,
      depth: DEPTH_AIR,
      s0: RAIN_ARROW,
      s1: RAIN_ARROW,
      a0: 0.7,
      a1: 1,
      rotation: Math.atan2(height, -drift),
      ease: 'linear',
    });
    this.schedule('rainHit', fall, x, y, FX.rainHitRadius, s.damage);
  }

  private arrowHit(s: Strike) {
    const h = this.host;
    h.sound('rain_thud', s.x, s.y);
    h.eachInRadius(s.x, s.y, s.r, (e, _d, dx, dy) => h.hit(e, s.damage, dx, dy, 130));
    h.fx.spawn({ key: 'fxRainArrow', x: s.x, y: s.y - 8, life: 0.55, depth: DEPTH_GROUND + 0.3, s0: RAIN_ARROW, s1: RAIN_ARROW, a0: 1, a1: 0, rotation: Math.PI / 2 - 0.14, ease: 'linear' });
    h.fx.spawn({ key: 'puff', x: s.x, y: s.y, life: 0.3, depth: DEPTH_GROUND + 0.2, s0: 0.45, s1: 1.1, a0: 0.8, a1: 0, tint: hex(F.dust) });
  }

  private randomEnemy(range: number) {
    const list = this.host.enemies();
    const n = list.length;
    if (!n) return null;
    const px = this.host.player.x;
    const py = this.host.player.y;
    const start = Math.floor(Math.random() * n);
    for (let i = 0; i < n; i++) {
      const e = list[(start + i) % n];
      if (!e.alive) continue;
      const dx = e.img.x - px;
      const dy = e.img.y - py;
      if (dx * dx + dy * dy < range * range) return e;
    }
    return null;
  }

  // ---------------------------------------------------------------- Murka Petir

  private strikeThunder(s: Strike) {
    const h = this.host;
    const target = this.randomEnemy(RANGE + 60);
    if (!target) return;
    const x = target.img.x;
    const y = target.img.y;
    h.sound('thunder_crack', x, y);
    let arcs = 0;
    h.eachInRadius(x, y, s.r, (e, dist, dx, dy) => {
      if (arcs < 3 && e !== target && dist > 12) {
        arcs++;
        h.fx.spawn({ key: 'fxArc', x, y, life: 0.16, depth: DEPTH_AIR, s0: dist / 64 * INV, s1: dist / 64 * INV, sy0: INV * 1.1, sy1: INV * 0.4, a0: 1, a1: 0.2, rotation: Math.atan2(dy, dx), originX: 0, add: true, ease: 'linear' });
      }
      h.hit(e, s.damage, dx, dy, 210);
    });
    h.fx.spawn({ key: `fxBolt${Math.floor(Math.random() * 3)}`, x, y, life: 0.2, depth: DEPTH_AIR, s0: INV * 1.15, s1: INV * 0.7, sy0: INV * 1.6, sy1: INV * 1.6, a0: 1, a1: 0, originY: 1, add: true, ease: 'linear' });
    h.fx.spawn({ key: 'fxShock', x, y, life: 0.26, depth: DEPTH_GROUND + 0.1, s0: ringScale(s.r * 0.3), s1: ringScale(s.r * 1.05), a0: 0.9, a1: 0, tint: hex(F.lightning), add: true });
    h.fx.spawn({ key: 'fxCrater', x, y, life: 0.8, depth: DEPTH_GROUND, s0: ringScale(s.r * 0.5), s1: ringScale(s.r * 0.5), a0: 0.65, a1: 0, ease: 'linear' });
    h.debris(x, y, 5, [hex(F.lightning), hex(F.lightningDeep)]);
    h.shake(70, 0.005);
    h.flash(x, y, hex(F.lightningDeep), 1.9, s.r * 3.2);
  }

  // ---------------------------------------------------------------- Tebasan Bulan

  private startMoon(s: Strike) {
    const h = this.host;
    const x = h.player.x;
    const y = h.player.y;
    h.sound('moon_slash');
    this.waves.push({ x, y, r: 12, maxR: s.r, damage: s.damage, hit: new Set() });
    const life = s.r / FX.moonSpeed;
    h.fx.spawn({ key: 'fxMoon', x, y, life, depth: DEPTH_AIR, s0: ringScale(12), s1: ringScale(s.r), a0: 1, a1: 0.15, spin: 3.2, add: true, ease: 'linear' });
    h.fx.spawn({ key: 'fxShock', x, y, life: 0.3, depth: DEPTH_GROUND + 0.1, s0: ringScale(10), s1: ringScale(110), a0: 0.9, a1: 0, tint: hex(F.moon), add: true });
    h.shake(140, 0.008);
    h.flash(x, y, hex(F.moonDeep), 2.2, s.r * 1.4);
  }

  private updateWaves(dt: number) {
    if (!this.waves.length) return;
    const h = this.host;
    const enemies = h.enemies();
    for (let w = this.waves.length - 1; w >= 0; w--) {
      const wave = this.waves[w];
      const inner = wave.r - FX.moonBand;
      wave.r += FX.moonSpeed * dt;
      const outer = wave.r;
      for (const e of enemies) {
        if (!e.alive || wave.hit.has(e.id)) continue;
        const dx = e.img.x - wave.x;
        const dy = e.img.y - wave.y;
        const d = Math.hypot(dx, dy);
        if (d + e.radius < inner || d - e.radius > outer) continue;
        wave.hit.add(e.id);
        const n = d || 1;
        h.hit(e, wave.damage, dx / n, dy / n, 1100);
      }
      if (wave.r >= wave.maxR) {
        this.waves[w] = this.waves[this.waves.length - 1];
        this.waves.pop();
      }
    }
  }

  // ---------------------------------------------------------------- Kawanan Gagak

  private releaseRavens(count: number, damage: number) {
    const h = this.host;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const raven: Raven = {
        x: h.player.x + Math.cos(a) * 26,
        y: h.player.y + Math.sin(a) * 26,
        vx: Math.cos(a) * 220,
        vy: Math.sin(a) * 220,
        life: FX.ravenLife + Math.random() * 0.5,
        cool: i * 0.04,
        damage,
        target: null,
        img: undefined,
      };
      raven.img = h.fx.spawn({ key: 'fxRaven', x: raven.x, y: raven.y, life: raven.life, depth: DEPTH_AIR, s0: INV * 1.55, s1: INV * 1.55, a0: 1, a1: 0.85, ease: 'linear', follow: raven });
      this.ravens.push(raven);
    }
  }

  private updateRavens(dt: number) {
    const h = this.host;
    for (let i = this.ravens.length - 1; i >= 0; i--) {
      const r = this.ravens[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.ravens[i] = this.ravens[this.ravens.length - 1];
        this.ravens.pop();
        continue;
      }
      r.cool = Math.max(0, r.cool - dt);
      if (!r.target || !r.target.alive) r.target = this.randomEnemy(RANGE + 100);
      // Tanpa sasaran: berputar di sekitar pemain sambil menunggu
      const gx = r.target ? r.target.img.x : h.player.x;
      const gy = r.target ? r.target.img.y : h.player.y;
      const dx = gx - r.x;
      const dy = gy - r.y;
      const d = Math.hypot(dx, dy) || 1;
      const steer = 1 - Math.exp(-7 * dt);
      r.vx += ((dx / d) * FX.ravenSpeed - r.vx) * steer;
      r.vy += ((dy / d) * FX.ravenSpeed - r.vy) * steer;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      if (r.img) r.img.rotation = Math.atan2(r.vy, r.vx);
      if (r.target && r.cool <= 0 && d < r.target.radius + 12) {
        h.hit(r.target, r.damage, dx / d, dy / d, 120);
        h.sound('raven_peck', r.x, r.y);
        r.cool = FX.ravenCooldown;
        r.target = null;
      }
    }
  }

  // ---------------------------------------------------------------- Pusaran Badai

  private summonTornados(count: number, radius: number, damage: number) {
    const h = this.host;
    for (let i = 0; i < count; i++) {
      const offset = (i / count) * TAU;
      const t: Tornado = {
        x: h.player.x + Math.cos(offset) * 90,
        y: h.player.y + Math.sin(offset) * 90,
        r: radius,
        life: FX.tornadoLife,
        tick: 0,
        retarget: 0,
        goalX: h.player.x,
        goalY: h.player.y,
        damage,
        offset,
      };
      h.fx.spawn({ key: 'fxTornado', x: t.x, y: t.y, life: t.life, depth: DEPTH_GROUND + 0.4, s0: ringScale(radius * 0.7), s1: ringScale(radius * 1.15), a0: 0.95, a1: 0.25, spin: 9, ease: 'linear', follow: t });
      this.tornados.push(t);
    }
  }

  private updateTornados(dt: number) {
    const h = this.host;
    for (let i = this.tornados.length - 1; i >= 0; i--) {
      const t = this.tornados[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.tornados[i] = this.tornados[this.tornados.length - 1];
        this.tornados.pop();
        continue;
      }
      t.retarget -= dt;
      if (t.retarget <= 0) {
        t.retarget = 0.6;
        if (h.densest(RANGE + 100, this.point)) {
          // Tiap pusaran mengincar sisi berbeda, supaya tidak menumpuk di satu titik
          t.goalX = this.point.x + Math.cos(t.offset) * t.r * 0.6;
          t.goalY = this.point.y + Math.sin(t.offset) * t.r * 0.6;
        }
      }
      const gx = t.goalX - t.x;
      const gy = t.goalY - t.y;
      const gd = Math.hypot(gx, gy) || 1;
      const step = Math.min(gd, FX.tornadoSpeed * dt);
      t.x += (gx / gd) * step;
      t.y += (gy / gd) * step;
      // Dorongan musuh meluruh sekitar 8 kali per detik, jadi gaya ini setara dengan kecepatan tarikan
      const force = FX.tornadoPull * 8 * dt;
      h.eachInRadius(t.x, t.y, t.r * 1.7, (e, _d, dx, dy) => h.push(e, -dx, -dy, force));
      t.tick -= dt;
      if (t.tick <= 0) {
        t.tick = FX.tornadoTick;
        h.eachInRadius(t.x, t.y, t.r, (e) => h.hit(e, t.damage, 0, 0, 0));
        h.fx.spawn({ key: 'puff', x: t.x, y: t.y, vy: -30, life: 0.5, depth: DEPTH_GROUND + 0.5, s0: t.r / 90, s1: t.r / 45, a0: 0.5, a1: 0, spin: 3, tint: hex(F.dust) });
      }
    }
  }

  // ---------------------------------------------------------------- Lingkar Api

  private igniteRing(count: number, radius: number, damage: number) {
    const px = this.host.player.x;
    const py = this.host.player.y;
    const ticks = Math.floor(FX.flamesLife / FX.flamesTick);
    // Dua cincin: yang luar menghadang musuh baru, yang dalam membakar musuh yang sudah dekat
    const inner = Math.round(count / 3);
    for (let i = 0; i < count; i++) {
      const isInner = i < inner;
      const a = isInner ? (i / inner) * TAU : ((i - inner) / (count - inner)) * TAU;
      const r = isInner ? radius * 0.45 : radius;
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      // Menyala berurutan mengelilingi pemain, lalu terus membakar
      const start = (i / count) * 0.3;
      for (let k = 0; k < ticks; k++) this.schedule('flame', start + k * FX.flamesTick, x, y, FX.flamesPatch, damage);
    }
    this.host.flash(px, py, hex(F.fire), 1.6, radius * 2);
  }

  private flame(s: Strike) {
    const h = this.host;
    h.eachInRadius(s.x, s.y, s.r, (e, _d, dx, dy) => h.hit(e, s.damage, dx, dy, 60));
    h.fx.spawn({ key: 'fxBlast', x: s.x, y: s.y - 10, vy: -35, life: FX.flamesTick + 0.25, depth: DEPTH_AIR - 0.2, s0: ringScale(s.r * 0.6), s1: ringScale(s.r * 1.05), a0: 0.85, a1: 0, add: true, ease: 'linear' });
  }

  // ---------------------------------------------------------------- Cahaya Suci

  private holyPulse(s: Strike) {
    const h = this.host;
    const x = h.player.x;
    const y = h.player.y;
    h.eachInRadius(x, y, s.r, (e, _d, dx, dy) => h.hit(e, s.damage, dx, dy, 520));
    h.heal(FX.holyHeal);
    h.sound('holy_pulse');
    h.fx.spawn({ key: 'fxPillar', x, y: y + 18, life: 0.55, depth: DEPTH_AIR, s0: INV * 1.1, s1: INV * 1.6, sy0: INV * 1.1, sy1: INV * 1.3, a0: 1, a1: 0, originY: 1, add: true, ease: 'linear' });
    h.fx.spawn({ key: 'fxShock', x, y, life: 0.42, depth: DEPTH_GROUND + 0.1, s0: ringScale(s.r * 0.2), s1: ringScale(s.r), a0: 0.95, a1: 0, tint: hex(F.holy), add: true });
    h.shake(110, 0.005);
    h.flash(x, y, hex(F.holy), 2, s.r * 2);
  }

  // ---------------------------------------------------------------- Badai Es

  private freeze(radius: number, seconds: number, damage: number) {
    const h = this.host;
    const x = h.player.x;
    const y = h.player.y;
    h.sound('frost_cast');
    h.eachInRadius(x, y, radius, (e) => h.slow(e, 0, seconds));
    h.fx.spawn({ key: 'fxShock', x, y, life: 0.5, depth: DEPTH_GROUND + 0.1, s0: ringScale(radius * 0.15), s1: ringScale(radius), a0: 1, a1: 0, tint: hex(F.frost), add: true });
    h.flash(x, y, hex(F.frost), 1.8, radius * 1.5);
    h.shake(90, 0.004);
    this.schedule('shatter', seconds, x, y, radius, damage);
  }

  private shatter(s: Strike) {
    const h = this.host;
    h.sound('frost_shatter');
    let shards = 0;
    h.eachInRadius(s.x, s.y, s.r, (e, _d, dx, dy) => {
      h.hit(e, s.damage, dx, dy, 300);
      if (shards++ < 12) h.debris(e.img.x, e.img.y, 5, [hex(F.frost)]);
    });
    h.fx.spawn({ key: 'fxShock', x: s.x, y: s.y, life: 0.3, depth: DEPTH_GROUND + 0.1, s0: ringScale(s.r * 0.8), s1: ringScale(s.r * 1.05), a0: 0.7, a1: 0, tint: hex(F.frost), add: true });
    h.shake(120, 0.007);
  }

  // ---------------------------------------------------------------- Gempa Bumi

  private crackGround(count: number, reach: number, damage: number) {
    const h = this.host;
    const px = h.player.x;
    const py = h.player.y;
    const steps = Math.ceil(reach / FX.quakeStep);
    const turn = Math.random() * TAU;
    for (let i = 0; i < count; i++) {
      const a = turn + (i / count) * TAU;
      for (let k = 1; k <= steps; k++) {
        const d = k * FX.quakeStep;
        // Sedikit berkelok, seperti retakan tanah sungguhan
        const w = a + Math.sin(k * 1.7 + i) * 0.09;
        this.schedule('quake', k * FX.quakeGap, px + Math.cos(w) * d, py + Math.sin(w) * d, FX.quakeBlast, damage);
      }
    }
    h.sound('quake_start');
    h.shake(320, 0.012);
    h.slowMotion(0.06);
  }

  private quakeBlast(s: Strike) {
    const h = this.host;
    h.sound('quake_rock', s.x, s.y);
    h.eachInRadius(s.x, s.y, s.r, (e, _d, dx, dy) => h.hit(e, s.damage, dx, dy, 340));
    h.fx.spawn({ key: 'fxCrater', x: s.x, y: s.y, life: 1.1, depth: DEPTH_GROUND, s0: ringScale(s.r * 0.75), s1: ringScale(s.r * 0.8), a0: 0.85, a1: 0, ease: 'linear' });
    h.fx.spawn({ key: 'puff', x: s.x, y: s.y, vy: -28, life: 0.5, depth: DEPTH_GROUND + 0.3, s0: 0.5, s1: 1.2, a0: 0.65, a1: 0, spin: 2, tint: hex(F.dust) });
  }
}
