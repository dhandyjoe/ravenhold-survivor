import * as Phaser from 'phaser';
import { COLORS, ENEMIES, PLAYER, RUN_SECONDS, SPAWN, WEAPON, hex, xpForLevel, type EnemyKind } from '../config';
import { Controls } from '../input';
import { SpatialHash } from '../spatial';
import { load, save, type SaveData } from '../storage';
import { TEX_SCALE, createTextures } from '../textures';
import { ui } from '../ui';
import { baseStats, rollChoices, type Stats, type Upgrade } from '../upgrades';

type State = 'menu' | 'playing' | 'levelup' | 'paused' | 'over';

interface Enemy {
  id: number;
  img: Phaser.GameObjects.Image;
  alive: boolean;
  kind: EnemyKind;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  kbx: number;
  kby: number;
  flashUntil: number;
  flashing: boolean;
  lastOrbitHit: number;
}

interface Bolt {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  damage: number;
  hits: number[];
}

interface Gem {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  value: number;
  pulled: boolean;
  speed: number;
}

const INV = 1 / TEX_SCALE;
const VIEW_AREA = 820; // luas pandang dunia ≈ 820 x 820 unit, di layar apa pun

export class GameScene extends Phaser.Scene {
  private state: State = 'menu';
  private save!: SaveData;
  private controls!: Controls;

  // Dunia
  private bg!: Phaser.GameObjects.TileSprite;
  private player!: Phaser.GameObjects.Image;
  private aim!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Graphics;
  private camX = 0;
  private camY = 0;
  private bloom: Phaser.Filters.ParallelFilters | null = null;

  // Pool objek (dipakai ulang, tidak dibuat/dihancurkan tiap frame)
  private enemies: Enemy[] = [];
  private bolts: Bolt[] = [];
  private gems: Gem[] = [];
  private orbs: Phaser.GameObjects.Image[] = [];
  private numbers: Phaser.GameObjects.Text[] = [];
  private hash = new SpatialHash(64);
  private bursts = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private aliveEnemies = 0;

  // Status ronde
  private clock = 0; // detik, hanya berjalan saat tidak dijeda
  private runTime = 0;
  private hp: number = PLAYER.maxHp;
  private vx = 0;
  private vy = 0;
  private stats: Stats = baseStats();
  private levels: Record<string, number> = {};
  private level = 1;
  private xp = 0;
  private kills = 0;
  private invulnUntil = 0;
  private boltTimer = 0;
  private novaTimer = 0;
  private orbitAngle = 0;
  private spawnAcc = 0;
  private nextSwarm = SPAWN.swarmEvery;
  private titanIndex = 0;
  private fpsSamples: number[] = [];
  private fpsTimer = 0;

  private tmp = { x: 0, y: 0 };

  constructor() {
    super('game');
  }

  create() {
    this.save = load();
    createTextures(this);

    this.bg = this.add.tileSprite(0, 0, 16, 16, 'grid').setOrigin(0).setScrollFactor(0).setScale(INV).setDepth(-10);
    this.player = this.add.image(0, 0, 'player').setScale(INV).setDepth(10);
    this.aim = this.add.image(0, 0, 'aim').setScale(INV).setDepth(11).setAlpha(0);
    this.hpBar = this.add.graphics().setDepth(12);

    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      this.bursts.set(
        kind,
        this.add
          .particles(0, 0, 'spark', {
            speed: { min: 50, max: kind === 'titan' ? 360 : 210 },
            lifespan: { min: 260, max: 620 },
            scale: { start: kind === 'titan' ? 1.6 : 0.85, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: hex(ENEMIES[kind].color),
            blendMode: Phaser.BlendModes.ADD,
            emitting: false,
          })
          .setDepth(6),
      );
    }
    this.bursts.set(
      'pickup',
      this.add
        .particles(0, 0, 'spark', {
          speed: { min: 20, max: 90 },
          lifespan: 300,
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: hex(COLORS.gem),
          blendMode: Phaser.BlendModes.ADD,
          emitting: false,
        })
        .setDepth(9),
    );

    // Efek layar: bloom (cahaya berpendar) + vignette lembut di tepi
    const cam = this.cameras.main;
    cam.setBackgroundColor(COLORS.bg);
    cam.filters.external.addVignette(0.5, 0.5, 0.9, 0.28, 0x05060c);
    this.bloom = Phaser.Actions.AddEffectBloom(cam, {
      threshold: 0.55,
      blurRadius: 2,
      blurSteps: 4,
      blendAmount: 0.6,
    })[0].parallelFilters;
    this.setGlow(this.save.glow ?? true);
    ui.setGlowToggle(this.save.glow ?? true);

    this.controls = new Controls(
      document.getElementById('touch-layer')!,
      document.getElementById('joy-base')!,
      document.getElementById('joy-knob')!,
    );
    this.controls.onPause = () => this.togglePause();
    this.wireUi();

    this.scale.on('resize', this.onResize, this);
    this.onResize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });

    this.enterMenu();
  }

  // ---------------------------------------------------------------- UI & state

  private wireUi() {
    ui.onStart = () => this.startRun();
    ui.onRestart = () => this.startRun();
    ui.onResume = () => this.togglePause();
    ui.onPauseRequest = () => this.togglePause();
    ui.onMenu = () => this.enterMenu();
    ui.onGlowChange = (on) => {
      this.save.glow = on;
      save(this.save);
      this.setGlow(on);
    };
  }

  private setGlow(on: boolean) {
    if (this.bloom) this.bloom.active = on;
  }

  private enterMenu() {
    this.clearWorld();
    this.resetStats();
    this.stats.projectiles = 2;
    this.stats.orbitCount = 2;
    this.stats.novaLevel = 1;
    this.rebuildOrbs();
    this.state = 'menu';
    this.controls.setEnabled(false);
    ui.showHud(false);
    ui.showStart({ time: this.save.bestTime, kills: this.save.bestKills, level: this.save.bestLevel });
  }

  private startRun() {
    this.clearWorld();
    this.resetStats();
    this.rebuildOrbs();
    this.state = 'playing';
    this.controls.setEnabled(true);
    ui.resetHud();
    ui.showHud(true);
    ui.show(null);
    ui.toast('Bertahan selama 10 menit');
  }

  private togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.controls.setEnabled(false);
      ui.show('pause');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.controls.setEnabled(true);
      ui.show(null);
    }
  }

  private endRun(win: boolean) {
    this.state = 'over';
    this.controls.setEnabled(false);
    const stats = { time: this.runTime, kills: this.kills, level: this.level };
    const newRecord = this.runTime > this.save.bestTime || (win && this.kills > this.save.bestKills);
    if (newRecord) {
      this.save.bestTime = Math.max(this.save.bestTime, this.runTime);
      this.save.bestKills = this.kills;
      this.save.bestLevel = this.level;
      save(this.save);
    }
    if (!win) {
      this.bursts.get('titan')!.explode(40, this.player.x, this.player.y);
      this.player.setVisible(false);
      this.aim.setVisible(false);
      this.hpBar.clear();
    }
    // setTimeout (bukan timer Phaser) supaya layar akhir tetap muncul walau FPS sedang turun
    window.setTimeout(() => {
      if (this.state !== 'over') return;
      ui.showHud(false);
      ui.showEnd(win, stats, newRecord);
    }, win ? 200 : 750);
  }

  private resetStats() {
    this.stats = baseStats();
    this.levels = {};
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.hp = this.stats.maxHp;
    this.runTime = 0;
    this.invulnUntil = 0;
    this.boltTimer = 0.3;
    this.novaTimer = 1;
    this.spawnAcc = 0;
    this.nextSwarm = SPAWN.swarmEvery;
    this.titanIndex = 0;
    this.vx = this.vy = 0;
    this.player.setPosition(0, 0).setVisible(true).setAlpha(1);
    this.aim.setVisible(true);
    this.camX = this.camY = 0;
  }

  private clearWorld() {
    for (const e of this.enemies) this.removeEnemy(e);
    for (const b of this.bolts) this.removeBolt(b);
    for (const g of this.gems) this.removeGem(g);
    this.aliveEnemies = 0;
  }

  private onResize() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    cam.setSize(w, h);
    cam.setZoom(Math.max(0.5, Math.sqrt(w * h) / VIEW_AREA));
    const vw = w / cam.zoom + 8;
    const vh = h / cam.zoom + 8;
    this.bg.setSize(vw * TEX_SCALE, vh * TEX_SCALE);
    this.bg.setPosition(w / 2 - vw / 2, h / 2 - vh / 2);
  }

  // ---------------------------------------------------------------- Loop utama

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (this.state === 'playing' || this.state === 'menu') this.step(dt);
    this.updateCamera(dt);
    this.drawHpBar();
    if (this.state !== 'menu') {
      ui.updateHud(this.runTime, this.kills, this.level, Math.min(1, this.xp / xpForLevel(this.level)));
    }
    if (this.state === 'playing') this.watchFps(dt);
  }

  private step(dt: number) {
    const playing = this.state === 'playing';
    this.clock += dt;
    if (playing) this.runTime += dt;

    this.movePlayer(dt, playing);
    if (playing && this.stats.regen > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);

    this.spawn(dt, playing);
    this.rebuildHash();
    this.updateEnemies(dt, playing);
    this.updateWeapons(dt);
    this.updateBolts(dt);
    this.updateGems(dt, playing);

    if (!playing) return;
    if (this.runTime >= this.nextSwarm) {
      this.nextSwarm += SPAWN.swarmEvery;
      this.spawnSwarm();
    }
    if (this.titanIndex < SPAWN.titanAt.length && this.runTime >= SPAWN.titanAt[this.titanIndex]) {
      this.titanIndex++;
      this.spawnEnemy('titan');
      ui.toast('Bos muncul!', 'danger');
    }
    if (this.hp <= 0) this.endRun(false);
    else if (this.runTime >= RUN_SECONDS) this.endRun(true);
    else if (this.xp >= xpForLevel(this.level)) this.levelUp();
  }

  private movePlayer(dt: number, playing: boolean) {
    const v = this.tmp;
    if (playing) this.controls.vector(v);
    else {
      // Mode demo di menu: pemain bergerak sendiri
      v.x = Math.cos(this.clock * 0.35) * 0.6;
      v.y = Math.sin(this.clock * 0.5) * 0.6;
    }
    const speed = PLAYER.speed * this.stats.speedMul;
    const k = 1 - Math.exp(-14 * dt);
    this.vx += (v.x * speed - this.vx) * k;
    this.vy += (v.y * speed - this.vy) * k;
    this.player.x += this.vx * dt;
    this.player.y += this.vy * dt;

    const moving = Math.hypot(this.vx, this.vy) > 12;
    const ang = Math.atan2(this.vy, this.vx);
    this.aim.setPosition(this.player.x + Math.cos(ang) * 22, this.player.y + Math.sin(ang) * 22);
    this.aim.setRotation(ang);
    this.aim.setAlpha(moving ? 0.9 : Math.max(0, this.aim.alpha - dt * 4));

    // Berkedip saat kebal setelah terkena serangan
    const inv = this.clock < this.invulnUntil;
    this.player.setAlpha(inv ? 0.45 + 0.55 * Math.abs(Math.sin(this.clock * 30)) : 1);
    this.player.setScale(INV * (1 + Math.sin(this.clock * 4) * 0.03));
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const vw = this.bg.width * INV;
    const vh = this.bg.height * INV;
    // Di menu, geser kamera supaya pemain tidak tertutup panel judul
    let ox = 0;
    let oy = 0;
    if (this.state === 'menu') {
      if (vw > vh * 1.1) ox = -vw * 0.17;
      else oy = vh * 0.2;
    }
    const k = 1 - Math.exp(-9 * dt);
    this.camX += (this.player.x + ox - this.camX) * k;
    this.camY += (this.player.y + oy - this.camY) * k;
    cam.centerOn(this.camX, this.camY);
    this.bg.setTilePosition((this.camX - vw / 2) * TEX_SCALE, (this.camY - vh / 2) * TEX_SCALE);
  }

  private drawHpBar() {
    const g = this.hpBar;
    g.clear();
    if (!this.player.visible || this.state === 'menu') return;
    const w = 34;
    const x = this.player.x - w / 2;
    const y = this.player.y + 22;
    const frac = Phaser.Math.Clamp(this.hp / this.stats.maxHp, 0, 1);
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(x - 1, y - 1, w + 2, 6, 3);
    g.fillStyle(hex(frac < 0.3 ? COLORS.hpLow : COLORS.hp), 1);
    if (frac > 0) g.fillRoundedRect(x, y, Math.max(4, w * frac), 4, 2);
  }

  /** Kalau efek cahaya "otomatis" dan HP terlalu berat, matikan bloom. */
  private watchFps(dt: number) {
    if (this.save.glow !== null || !this.bloom?.active) return;
    this.fpsTimer += dt;
    this.fpsSamples.push(this.game.loop.actualFps);
    if (this.fpsTimer < 4) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fpsTimer = 0;
    this.fpsSamples.length = 0;
    if (avg < 42) {
      this.setGlow(false);
      ui.setGlowToggle(false);
      ui.toast('Efek cahaya dimatikan agar game tetap lancar');
    }
  }

  // ---------------------------------------------------------------- Musuh

  private spawn(dt: number, playing: boolean) {
    const t = this.runTime;
    const rate = playing ? SPAWN.baseRate + t * SPAWN.ratePerSecond : 2.2;
    const cap = playing ? SPAWN.maxEnemies : 45;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.aliveEnemies >= cap) continue;
      const blob = Phaser.Math.Clamp((t - 40) / 120, 0, 0.8);
      const brute = Phaser.Math.Clamp((t - 110) / 200, 0, 0.5);
      const r = Math.random() * (1 + blob + brute);
      this.spawnEnemy(r < 1 ? 'drone' : r < 1 + blob ? 'blob' : 'brute');
    }
  }

  private spawnRadius() {
    const cam = this.cameras.main;
    return Math.hypot(cam.width, cam.height) / cam.zoom / 2 + 50;
  }

  private spawnSwarm() {
    const n = Math.round(16 + this.runTime / 20);
    const r = this.spawnRadius();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawnEnemy('drone', this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r);
    }
    ui.toast('Gelombang datang!', 'danger');
  }

  private spawnEnemy(kind: EnemyKind, x?: number, y?: number) {
    let e = this.enemies.find((en) => !en.alive);
    if (!e) {
      if (this.enemies.length >= SPAWN.maxEnemies + 60) return;
      e = {
        id: this.enemies.length,
        img: this.add.image(0, 0, kind).setDepth(8),
        alive: false,
        kind,
        hp: 0,
        speed: 0,
        damage: 0,
        radius: 0,
        xp: 0,
        kbx: 0,
        kby: 0,
        flashUntil: 0,
        flashing: false,
        lastOrbitHit: -9,
      };
      this.enemies.push(e);
    }
    if (x === undefined || y === undefined) {
      const a = Math.random() * Math.PI * 2;
      const r = this.spawnRadius();
      x = this.player.x + Math.cos(a) * r;
      y = this.player.y + Math.sin(a) * r;
    }
    const spec = ENEMIES[kind];
    const hpMul = 1 + this.runTime / SPAWN.hpGrowthSeconds;
    Object.assign(e, {
      alive: true,
      kind,
      hp: spec.hp * hpMul,
      speed: spec.speed * Phaser.Math.FloatBetween(0.9, 1.12),
      damage: spec.damage,
      radius: spec.radius,
      xp: spec.xp,
      kbx: 0,
      kby: 0,
      flashUntil: 0,
      flashing: false,
      lastOrbitHit: -9,
    });
    e.img
      .setTexture(kind)
      .setPosition(x, y)
      .setScale(INV * spec.scale)
      .setRotation(0)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true)
      .setDepth(kind === 'titan' ? 9 : 8);
    this.aliveEnemies++;
  }

  private rebuildHash() {
    this.hash.clear();
    for (const e of this.enemies) if (e.alive) this.hash.insert(e.id, e.img.x, e.img.y);
  }

  private updateEnemies(dt: number, playing: boolean) {
    const px = this.player.x;
    const py = this.player.y;
    const despawn = this.spawnRadius() * 1.8;
    const kbDecay = Math.exp(-8 * dt);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const img = e.img;
      let dx = px - img.x;
      let dy = py - img.y;
      const d = Math.hypot(dx, dy) || 1;

      // Musuh yang tertinggal terlalu jauh dipindah ke depan pemain
      if (d > despawn && e.kind !== 'titan') {
        const a = Math.random() * Math.PI * 2;
        const r = this.spawnRadius();
        img.setPosition(px + Math.cos(a) * r, py + Math.sin(a) * r);
        continue;
      }

      dx /= d;
      dy /= d;
      let mx = dx * e.speed;
      let my = dy * e.speed;

      // Saling dorong supaya musuh tidak menumpuk jadi satu titik
      let sx = 0;
      let sy = 0;
      this.hash.query(img.x, img.y, e.radius + 20, (oid) => {
        if (oid === e.id) return;
        const o = this.enemies[oid];
        const ox = img.x - o.img.x;
        const oy = img.y - o.img.y;
        const min = e.radius + o.radius;
        const dd = ox * ox + oy * oy;
        if (dd > 0.01 && dd < min * min) {
          const dist = Math.sqrt(dd);
          const push = (min - dist) / min;
          sx += (ox / dist) * push;
          sy += (oy / dist) * push;
        }
      });
      const sepStrength = e.kind === 'titan' ? 10 : 90;
      mx += sx * sepStrength;
      my += sy * sepStrength;

      img.x += (mx + e.kbx) * dt;
      img.y += (my + e.kby) * dt;
      e.kbx *= kbDecay;
      e.kby *= kbDecay;

      if (e.kind === 'drone') img.setRotation(Math.atan2(dy, dx));
      else if (e.kind === 'titan') img.rotation += dt * 0.8;
      else img.rotation += dt * (e.kind === 'brute' ? 0.4 : 1.2);

      if (e.flashing && this.clock >= e.flashUntil) {
        e.flashing = false;
        img.setTexture(e.kind);
      }

      // Tabrakan dengan pemain
      if (playing && d < e.radius + PLAYER.radius && this.clock >= this.invulnUntil) {
        this.hurtPlayer(e.damage);
      }
    }
  }

  private hurtPlayer(dmg: number) {
    this.hp -= dmg;
    this.invulnUntil = this.clock + PLAYER.invulnMs / 1000;
    this.cameras.main.shake(140, 0.006);
    ui.hurtFlash();
  }

  private damageEnemy(e: Enemy, amount: number, kx: number, ky: number, knock: number) {
    const crit = Math.random() < 0.08;
    const dmg = crit ? amount * 2 : amount;
    e.hp -= dmg;
    const kbScale = e.kind === 'titan' ? 0.05 : e.kind === 'brute' ? 0.4 : 1;
    e.kbx += kx * knock * kbScale;
    e.kby += ky * knock * kbScale;
    e.flashUntil = this.clock + 0.07;
    if (!e.flashing) {
      e.flashing = true;
      e.img.setTexture(e.kind + '-hit');
    }
    this.showNumber(e.img.x, e.img.y - e.radius, dmg, crit);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    const x = e.img.x;
    const y = e.img.y;
    this.bursts.get(e.kind)!.explode(e.kind === 'titan' ? 60 : e.kind === 'brute' ? 14 : 8, x, y);
    if (e.kind === 'titan') {
      this.cameras.main.shake(300, 0.012);
      this.dropGem(x, y, e.xp, true);
      this.hp = Math.min(this.stats.maxHp, this.hp + 25);
    } else {
      this.dropGem(x, y, e.xp, e.xp >= 5);
    }
    if (this.state === 'playing') this.kills++;
    this.removeEnemy(e);
  }

  private removeEnemy(e: Enemy) {
    if (e.alive) this.aliveEnemies--;
    e.alive = false;
    e.img.setActive(false).setVisible(false);
  }

  private nearestEnemy(maxDist: number) {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    const px = this.player.x;
    const py = this.player.y;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.img.x - px;
      const dy = e.img.y - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- Senjata

  private updateWeapons(dt: number) {
    const s = this.stats;

    // 1) Peluru otomatis ke musuh terdekat
    this.boltTimer -= dt;
    if (this.boltTimer <= 0) {
      const target = this.nearestEnemy(480);
      if (target) {
        this.boltTimer = WEAPON.boltCooldown * s.cooldownMul;
        const base = Math.atan2(target.img.y - this.player.y, target.img.x - this.player.x);
        const n = s.projectiles;
        const spread = 0.16;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * spread;
          this.fireBolt(a);
        }
      } else {
        this.boltTimer = 0.1;
      }
    }

    // 2) Satelit yang mengorbit
    const count = s.orbitCount;
    if (count > 0) {
      this.orbitAngle += WEAPON.orbitSpeed * dt;
      const r = WEAPON.orbitRadius;
      for (let i = 0; i < count; i++) {
        const orb = this.orbs[i];
        const a = this.orbitAngle + (i / count) * Math.PI * 2;
        const ox = this.player.x + Math.cos(a) * r;
        const oy = this.player.y + Math.sin(a) * r;
        orb.setPosition(ox, oy);
        this.hash.query(ox, oy, 60, (id) => {
          const e = this.enemies[id];
          if (!e.alive || this.clock - e.lastOrbitHit < WEAPON.orbitHitCooldown) return;
          const dx = e.img.x - ox;
          const dy = e.img.y - oy;
          const rr = e.radius + 10;
          if (dx * dx + dy * dy < rr * rr) {
            e.lastOrbitHit = this.clock;
            const d = Math.hypot(dx, dy) || 1;
            this.damageEnemy(e, WEAPON.orbitDamage * s.damageMul, dx / d, dy / d, 160);
          }
        });
      }
    }

    // 3) Gelombang nova
    if (s.novaLevel > 0) {
      this.novaTimer -= dt;
      if (this.novaTimer <= 0) {
        const lv = s.novaLevel;
        this.novaTimer = WEAPON.novaCooldown * (1 - 0.1 * (lv - 1));
        this.fireNova(WEAPON.novaRadius * (1 + 0.15 * (lv - 1)), WEAPON.novaDamage * (1 + 0.3 * (lv - 1)) * s.damageMul);
      }
    }
  }

  private fireBolt(angle: number) {
    let b = this.bolts.find((bb) => !bb.alive);
    if (!b) {
      b = {
        img: this.add.image(0, 0, 'bolt').setScale(INV).setDepth(7).setBlendMode(Phaser.BlendModes.ADD),
        alive: false,
        vx: 0,
        vy: 0,
        life: 0,
        pierce: 0,
        damage: 0,
        hits: [],
      };
      this.bolts.push(b);
    }
    const speed = WEAPON.boltSpeed * this.stats.boltSpeedMul;
    b.alive = true;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = WEAPON.boltLife;
    b.pierce = this.stats.pierce;
    b.damage = WEAPON.boltDamage * this.stats.damageMul;
    b.hits.length = 0;
    b.img.setPosition(this.player.x, this.player.y).setRotation(angle).setActive(true).setVisible(true);
  }

  private removeBolt(b: Bolt) {
    b.alive = false;
    b.img.setActive(false).setVisible(false);
  }

  private updateBolts(dt: number) {
    for (const b of this.bolts) {
      if (!b.alive) continue;
      b.life -= dt;
      if (b.life <= 0) {
        this.removeBolt(b);
        continue;
      }
      const img = b.img;
      img.x += b.vx * dt;
      img.y += b.vy * dt;
      this.hash.query(img.x, img.y, WEAPON.boltRadius + 50, (id) => {
        if (!b.alive) return;
        const e = this.enemies[id];
        if (!e.alive || b.hits.includes(id)) return;
        const dx = e.img.x - img.x;
        const dy = e.img.y - img.y;
        const rr = e.radius + WEAPON.boltRadius;
        if (dx * dx + dy * dy < rr * rr) {
          b.hits.push(id);
          const sp = Math.hypot(b.vx, b.vy) || 1;
          this.damageEnemy(e, b.damage, b.vx / sp, b.vy / sp, 220);
          if (b.pierce-- <= 0) this.removeBolt(b);
        }
      });
    }
  }

  private fireNova(radius: number, damage: number) {
    const ring = this.add
      .image(this.player.x, this.player.y, 'ring')
      .setScale(0.1)
      .setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scale: (radius / 100) * INV,
      alpha: { from: 1, to: 0 },
      duration: 420,
      ease: 'Cubic.easeOut',
      onUpdate: () => ring.setPosition(this.player.x, this.player.y),
      onComplete: () => ring.destroy(),
    });
    const px = this.player.x;
    const py = this.player.y;
    this.hash.query(px, py, radius, (id) => {
      const e = this.enemies[id];
      if (!e.alive) return;
      const dx = e.img.x - px;
      const dy = e.img.y - py;
      const d = Math.hypot(dx, dy) || 1;
      if (d < radius + e.radius) this.damageEnemy(e, damage, dx / d, dy / d, 320);
    });
  }

  private rebuildOrbs() {
    const n = this.stats.orbitCount;
    while (this.orbs.length < n) {
      this.orbs.push(this.add.image(0, 0, 'shard').setScale(INV).setDepth(11).setBlendMode(Phaser.BlendModes.ADD));
    }
    // Orb di atas jumlah aktif disembunyikan (mis. saat kembali ke menu)
    this.orbs.forEach((o, i) => o.setVisible(i < n).setActive(i < n));
  }

  // ---------------------------------------------------------------- XP

  private dropGem(x: number, y: number, value: number, big: boolean) {
    let g = this.gems.find((gg) => !gg.alive);
    if (!g) {
      if (this.gems.length >= 450) {
        // Terlalu banyak kristal: gabungkan ke kristal yang sudah ada
        const any = this.gems[Math.floor(Math.random() * this.gems.length)];
        any.value += value;
        return;
      }
      g = { img: this.add.image(0, 0, 'gem').setScale(INV).setDepth(5), alive: false, value: 0, pulled: false, speed: 0 };
      this.gems.push(g);
    }
    g.alive = true;
    g.value = value;
    g.pulled = false;
    g.speed = 0;
    g.img
      .setTexture(big ? 'gemBig' : 'gem')
      .setPosition(x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-4, 4))
      .setActive(true)
      .setVisible(true);
  }

  private removeGem(g: Gem) {
    g.alive = false;
    g.img.setActive(false).setVisible(false);
  }

  private updateGems(dt: number, playing: boolean) {
    const px = this.player.x;
    const py = this.player.y;
    const magnet = PLAYER.baseMagnet * this.stats.magnetMul;
    for (const g of this.gems) {
      if (!g.alive) continue;
      const img = g.img;
      const dx = px - img.x;
      const dy = py - img.y;
      const d = Math.hypot(dx, dy);
      if (!g.pulled && d < magnet) g.pulled = true;
      if (g.pulled) {
        g.speed = Math.min(g.speed + 1400 * dt, 900);
        const step = Math.min(d, g.speed * dt);
        img.x += (dx / (d || 1)) * step;
        img.y += (dy / (d || 1)) * step;
        if (d < PLAYER.radius + 4) {
          this.bursts.get('pickup')!.explode(4, img.x, img.y);
          if (playing) this.xp += g.value;
          this.removeGem(g);
        }
      }
    }
  }

  private levelUp() {
    this.xp -= xpForLevel(this.level);
    this.level++;
    this.state = 'levelup';
    this.controls.setEnabled(false);
    const choices = rollChoices(this.levels);
    ui.showLevelUp(this.level, choices, this.levels, (u) => this.applyUpgrade(u));
  }

  private applyUpgrade(u: Upgrade) {
    const next = (this.levels[u.id] ?? 0) + 1;
    this.levels[u.id] = next;
    const heal = u.apply(this.stats, next);
    if (heal) this.hp = Math.min(this.stats.maxHp, this.hp + heal);
    this.rebuildOrbs();
    this.invulnUntil = this.clock + 0.6;
    ui.show(null);
    this.state = 'playing';
    this.controls.setEnabled(true);
  }

  // ---------------------------------------------------------------- Angka damage

  private showNumber(x: number, y: number, value: number, crit: boolean) {
    if (this.state === 'menu') return;
    let t = this.numbers.find((n) => !n.active);
    if (!t) {
      if (this.numbers.length >= 28) return;
      t = this.add
        .text(0, 0, '', {
          fontFamily: 'Unbounded, "Segoe UI", system-ui, sans-serif',
          fontSize: '11px',
          fontStyle: '600',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setResolution(2.5);
      this.numbers.push(t);
    }
    t.setText(String(Math.round(value)))
      .setColor(crit ? COLORS.gemBig : '#eef0ff')
      .setFontSize(crit ? 16 : 11)
      .setPosition(x + Phaser.Math.Between(-6, 6), y)
      .setAlpha(crit ? 1 : 0.75)
      .setActive(true)
      .setVisible(true);
    this.tweens.add({
      targets: t,
      y: y - 26,
      alpha: 0,
      duration: 560,
      ease: 'Cubic.easeOut',
      onComplete: () => t!.setActive(false).setVisible(false),
    });
  }
}
