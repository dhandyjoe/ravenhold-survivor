import * as Phaser from 'phaser';
import { COLORS, END_REDIRECT_SECONDS, ENEMIES, GEAR, LIGHTING, MAX_LEVEL, PALETTE, PLAYER, QUALITY, RUN_SECONDS, SPAWN, SPECIAL_FX, WEAPON, hex, xpForLevel, type EnemyKind, type SpecialId } from '../config';
import { effectiveLevel, enemyDamageMul, enemyHpMul, enemySpeedMul, pickKind, spawnRate, swarmSize, targetPopulation } from '../balance';
import { DIGIT_FONT, RING_RADIUS } from '../art/fx';
import { FxPool } from '../fx';
import { FrameGovernor, gameSize, resolution } from '../quality';
import { SpecialWeapons, type SpecialTarget } from '../specials';
import { Controls } from '../input';
import { SpatialHash } from '../spatial';
import { load, save, type SaveData } from '../storage';
import { BOW_ANCHOR, BOW_FRAMES } from '../art/weapons';
import { CAPE_ANCHOR, CAPE_FRAMES, HERO_ANCHOR, HERO_IDLE, HERO_WALK, capeFrame, heroFrame, type HeroView } from '../art/hero';
import type { EnemyArt } from '../art/monsters';
import { Lighting, createDayState, sampleDay } from '../lighting';
import { GROUND_FRAG } from '../shaders/ground';
import { TEX_SCALE, createTextures, type Art } from '../textures';
import { ui } from '../ui';
import { ALL_UPGRADES, baseStats, isSpecialLevel, rollChoices, rollSpecials, type Stats, type Upgrade } from '../upgrades';

type State = 'menu' | 'playing' | 'levelup' | 'paused' | 'over';

interface Enemy {
  id: number;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  art: EnemyArt;
  frame: number;
  alive: boolean;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  kbx: number;
  kby: number;
  flashUntil: number;
  flashing: boolean;
  lastOrbitHit: number;
  baseScale: number;
  facing: number; // 0 kanan, 1 kiri
  born: number;
  hitPop: number; // 1..0, badan tertekan sesaat saat terkena
  attack: number; // 1..0, ayunan badan saat menyerang
  nextAttack: number;
  stepNow: number;
  // Status dari racun dan es
  dotDps: number;
  dotUntil: number;
  dotNext: number;
  slowFactor: number;
  slowUntil: number;
  statusTint: number; // warna status yang sedang terpasang, 0 berarti tidak ada
}

const POISON_TINT = hex(PALETTE.fx.poisonTint);
const FROST_TINT = hex(PALETTE.fx.frostTint);

interface Bolt {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  bounce: number;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  damage: number;
  hits: number[];
}

interface DamageNumber {
  text: Phaser.GameObjects.BitmapText;
  age: number;
  y0: number;
}

const NUMBER_LIFE = 0.56;

interface Gem {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  value: number;
  pulled: boolean;
  speed: number;
}

const INV = 1 / TEX_SCALE;
const VIEW_AREA = 820; // luas pandang dunia ≈ 820 x 820 unit, di layar apa pun
const VIEW_OVERSCAN = 1.06;
const HERO_STRIDE = 58; // unit dunia yang ditempuh dalam satu siklus lari
const HERO_SIZE = 1.3; // pengali ukuran tampilan pemain; hitbox tidak ikut berubah
const HERO_FEET = 18 * HERO_SIZE; // jarak titik tengah pemain ke telapak kaki
const HERO_NECK = -7 * HERO_SIZE; // jarak titik tengah pemain ke leher (tempat jubah menempel)
const SHADOW_BASE = 64; // ukuran tekstur bayangan dalam unit dunia
const MENU_THREAT = 14; // level efektif musuh demo di menu, supaya semua jenis terlihat
const NUMBERS_PER_FRAME = 5; // pusaka bisa mengenai ratusan musuh; teks hanya sedikit per frame
const CLUSTER_RADIUS = 110;
const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).map((e) => e.radius));
const SEPARATION_MAX = 1.5; // batas dorongan antar musuh, supaya kerumunan padat tidak bergetar
const KNOCK_MAX = 900;
const BOLT_SUBSTEP = 14; // panah bergerak maks sejauh ini per pemeriksaan, supaya tidak menembus musuh

export class GameScene extends Phaser.Scene {
  private state: State = 'menu';
  private save!: SaveData;
  private controls!: Controls;

  // Dunia
  private art!: Art;
  /** Lama pembuatan semua tekstur saat dimuat, untuk dipantau lewat `?debug`. */
  bakeMs = 0;
  private bg!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.Shader;
  private player!: Phaser.GameObjects.Image;
  private cape!: Phaser.GameObjects.Image;
  private bow!: Phaser.GameObjects.Image;
  private heroShadow!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Graphics;
  private dayTint!: Phaser.GameObjects.Rectangle;
  private lighting!: Lighting;
  private day = createDayState();
  private lit = true;
  private viewW = 16;
  private viewH = 16;
  private camX = 0;
  private camY = 0;
  private bloom: Phaser.Filters.ParallelFilters | null = null;

  // Pool objek (dipakai ulang, tidak dibuat/dihancurkan tiap frame)
  private enemies: Enemy[] = [];
  private bolts: Bolt[] = [];
  private gems: Gem[] = [];
  private swords: Phaser.GameObjects.Image[] = [];
  private fx!: FxPool;
  private specials!: SpecialWeapons;
  private boss: Enemy | null = null;
  private numbers: DamageNumber[] = [];
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

  // Rig pemain
  private heroFrameNow = -1;
  private walkPhase = 0;
  private capeAngle = 0;
  private capeVel = 0;
  private aimAngle = 0;
  private aimGoal = 0;
  private recoil = 0;
  private bowFrameNow = -1;
  private spawnAcc = 0;
  private nextSwarm = SPAWN.swarmEvery;
  private bossIndex = 0;
  private slowLeft = 0;
  private warnedEnd = false;
  private extraVolley = 0; // sisa jeda sebelum tembakan ganda dari Tabung Panah
  private numbersLeft = NUMBERS_PER_FRAME;
  private specialHudTimer = 0;
  private reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private governor = new FrameGovernor();
  private qualityTier = 0;

  private tmp = { x: 0, y: 0 };

  constructor() {
    super('game');
  }

  create() {
    this.save = load();
    const bakeStart = performance.now();
    this.art = createTextures(this);
    this.bakeMs = Math.round(performance.now() - bakeStart);
    this.lighting = new Lighting(this);

    // Tanah cadangan saat efek cahaya dimatikan: hanya tekstur rumput, tanpa shader
    this.bg = this.add.tileSprite(0, 0, 16, 16, 'groundGrass').setOrigin(0).setScrollFactor(0).setDepth(-10).setVisible(false);
    this.ground = this.add
      .shader(
        {
          name: 'ground',
          fragmentSource: GROUND_FRAG,
          setupUniforms: (set: (name: string, value: unknown) => void) => {
            set('uGrass', 0);
            set('uDirt', 1);
            set('uStone', 2);
            set('uNoise', 3);
            set('uCam', [this.camX, this.camY]);
            set('uView', [this.viewW, this.viewH]);
            set('uTime', this.clock % 3600);
            set('uAmbient', this.lighting.ambient);
            set('uSun', this.lighting.sunOnGround);
            set('uCloud', this.day.cloud);
            set('uLightPos[0]', this.lighting.groundPos);
            set('uLightColor[0]', this.lighting.groundColor);
          },
        },
        0,
        0,
        16,
        16,
        ['groundGrass', 'groundDirt', 'groundStone', 'groundNoise'],
      )
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-10);

    const a = this.art;
    this.heroShadow = this.add.image(0, 0, 'shadow').setDepth(4);
    this.cape = this.add.image(0, 0, a.cape.key, a.cape.frames[0].name).setOrigin(CAPE_ANCHOR.x, CAPE_ANCHOR.y).setDepth(9.9);
    this.player = this.add.image(0, 0, a.hero.key, a.hero.frames[0].name).setOrigin(HERO_ANCHOR.x, HERO_ANCHOR.y).setScale(a.hero.scale * HERO_SIZE).setDepth(10);
    this.bow = this.add.image(0, 0, a.bow.key, a.bow.frames[0].name).setOrigin(BOW_ANCHOR.x, BOW_ANCHOR.y).setScale(a.bow.scale * HERO_SIZE).setDepth(10.1);
    this.hpBar = this.add.graphics().setDepth(12);
    this.dayTint = this.add.rectangle(0, 0, 16, 16, 0xffffff).setOrigin(0).setScrollFactor(0).setDepth(13).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);

    this.fx = new FxPool(this);
    this.specials = this.createSpecials();

    // Serpihan saat mati: jatuh terkena gravitasi, warnanya mengikuti bahan tubuh monster
    const chips = (key: string, tint: number[], speed: number, size: number) =>
      this.bursts.set(
        key,
        this.add
          .particles(0, 0, 'chip', {
            speed: { min: speed * 0.3, max: speed },
            angle: { min: 200, max: 340 },
            gravityY: 620,
            lifespan: { min: 320, max: 620 },
            scale: { start: size, end: size * 0.45 },
            alpha: { start: 1, end: 0 },
            rotate: { start: 0, end: 540 },
            tint,
            emitting: false,
          })
          .setDepth(8.5),
      );
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const art = this.art.enemies[kind];
      chips(kind, art.debris, ENEMIES[kind].boss ? 420 : 240, ENEMIES[kind].boss ? 0.8 : 0.36);
    }
    const H = PALETTE.hero;
    chips('hero', [hex(H.cape), hex(H.leather), hex(H.cloth)], 340, 0.5);
    chips('fxDebris', [0xffffff], 460, 0.5);
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
    // Adegan kini terang: ambang bloom dinaikkan supaya hanya sumber cahaya yang berpendar
    this.bloom = Phaser.Actions.AddEffectBloom(cam, {
      threshold: 0.86,
      blurRadius: 2,
      blurSteps: 2,
      blendAmount: 0.45,
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

    this.prewarmShaders();
    this.enterMenu();
  }

  /**
   * Phaser mengompilasi shader baru saat jumlah tekstur dalam satu batch pertama kali bertambah,
   * dan itu terjadi tepat saat pusaka pertama dipakai. Di sini semua varian dikompilasi saat dimuat,
   * dengan gambar sekali pakai di bawah tanah supaya tidak terlihat. Gambar berlampu di antaranya memutus batch.
   */
  private prewarmShaders() {
    const keys = ['puff', 'chip', 'fxRune', 'fxTarget', 'fxShock', 'fxBlast', 'fxCrater', 'fxMeteor'].slice(0, QUALITY.maxTextures);
    const temp: Phaser.GameObjects.Image[] = [];
    let depth = -20;
    for (let count = 1; count <= keys.length; count++) {
      for (let i = 0; i < count; i++) temp.push(this.add.image(0, 0, keys[i]).setDepth((depth += 0.01)));
      temp.push(this.add.image(0, 0, this.art.hero.key, this.art.hero.frames[0].name).setDepth((depth += 0.01)).setLighting(true));
    }
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      for (const o of temp) o.destroy();
    });
  }

  private createSpecials() {
    return new SpecialWeapons({
      player: this.player,
      fx: this.fx,
      hpMul: () => enemyHpMul(this.threat()),
      damageMul: () => this.stats.damageMul,
      enemies: () => this.enemies,
      eachInRadius: (x, y, r, fn) => this.eachInRadius(x, y, r, fn),
      densest: (range, out, avoid, avoidRadius) => this.densest(range, out, avoid, avoidRadius),
      hit: (e, damage, kx, ky, knock) => this.damageEnemy(e as Enemy, damage, kx, ky, knock, true),
      push: (e, kx, ky, force) => this.pushEnemy(e as Enemy, kx, ky, force),
      slow: (e, factor, seconds) => this.slowEnemy(e as Enemy, factor, seconds),
      heal: (amount) => {
        this.hp = Math.min(this.stats.maxHp, this.hp + amount);
      },
      debris: (x, y, count, tint) => {
        const b = this.bursts.get('fxDebris')!;
        b.particleTint = tint[Math.floor(Math.random() * tint.length)];
        b.explode(count, x, y);
      },
      shake: (ms, power) => this.shake(ms, power),
      slowMotion: (seconds) => {
        if (!this.reducedMotion) this.slowLeft = Math.max(this.slowLeft, seconds);
      },
      flash: (x, y, color, power, radius) => this.lighting.flash(x, y, color, power, radius),
    });
  }

  private shake(ms: number, power: number) {
    if (!this.reducedMotion) this.cameras.main.shake(ms, power);
  }

  /** Level efektif yang menentukan jumlah dan kekuatan musuh saat ini. */
  private threat() {
    return effectiveLevel(this.runTime, this.level);
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

  /** Semua efek berat ikut toggle ini. Saat mati, siklus waktu digantikan satu lapisan warna. */
  private setGlow(on: boolean) {
    this.lit = on;
    this.updateBloom();
    this.lighting.setEnabled(on);
    this.ground.setVisible(on);
    this.bg.setVisible(!on);
    this.dayTint.setVisible(!on);
    for (const o of [this.player, this.cape, this.bow]) o.setLighting(on);
    for (const e of this.enemies) e.img.setLighting(on);
    for (const b of this.bolts) b.img.setLighting(on);
  }

  /** Bloom menyala hanya kalau efek cahaya hidup, tingkat kualitas mengizinkan, dan layarnya tidak terlalu besar. */
  private updateBloom() {
    if (!this.bloom) return;
    const pixels = this.scale.width * this.scale.height;
    this.bloom.active = this.lit && QUALITY.tiers[this.qualityTier].bloom && pixels <= QUALITY.bloomMaxPixels;
  }

  /** Menerapkan tingkat kualitas saat ini. Mengembalikan true kalau ada yang benar-benar berubah. */
  private applyQuality() {
    const q = QUALITY.tiers[this.qualityTier];
    const before = this.bloom?.active;
    resolution.maxPixels = q.maxPixels;
    const s = gameSize();
    const resized = s.width !== this.scale.width || s.height !== this.scale.height;
    if (resized) this.scale.setGameSize(s.width, s.height);
    this.updateBloom();
    let lightsOff = false;
    // Lampu hanya dimatikan otomatis kalau pengguna belum memilih sendiri
    if (!q.lights && this.lit && this.save.glow === null) {
      this.setGlow(false);
      ui.setGlowToggle(false);
      ui.toast('Efek cahaya dimatikan agar game tetap lancar');
      lightsOff = true;
    }
    return resized || lightsOff || before !== this.bloom?.active;
  }

  private enterMenu() {
    this.clearWorld();
    this.resetStats();
    this.stats.projectiles = 2;
    this.stats.orbitCount = 2;
    this.stats.novaLevel = 1;
    this.rebuildSwords();
    this.state = 'menu';
    this.controls.setEnabled(false);
    ui.showHud(false);
    ui.showStart({ time: this.save.bestTime, kills: this.save.bestKills, level: this.save.bestLevel });
  }

  private startRun() {
    this.clearWorld();
    this.resetStats();
    this.rebuildSwords();
    this.state = 'playing';
    this.controls.setEnabled(true);
    ui.resetHud();
    ui.showHud(true);
    ui.show(null);
    ui.toast(`Bertahan selama ${RUN_SECONDS / 60} menit`);
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
      this.bursts.get('hero')!.explode(40, this.player.x, this.player.y);
      this.setHeroVisible(false);
      this.hpBar.clear();
    }
    // setTimeout (bukan timer Phaser) supaya layar akhir tetap muncul walau FPS sedang turun
    window.setTimeout(() => {
      if (this.state !== 'over') return;
      ui.showHud(false);
      ui.showEnd(win, stats, newRecord, win ? END_REDIRECT_SECONDS : 0);
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
    this.bossIndex = 0;
    this.slowLeft = 0;
    this.warnedEnd = false;
    this.extraVolley = 0;
    this.specials.reset();
    ui.setSpecialSlots([]);
    this.vx = this.vy = 0;
    this.player.setPosition(0, 0).setAlpha(1);
    this.setHeroVisible(true);
    this.capeAngle = this.capeVel = 0;
    this.recoil = 0;
    this.camX = this.camY = 0;
  }

  private clearWorld() {
    for (const e of this.enemies) this.removeEnemy(e);
    for (const b of this.bolts) this.removeBolt(b);
    for (const g of this.gems) this.removeGem(g);
    this.fx.clear();
    for (const n of this.numbers) n.text.setActive(false).setVisible(false);
    this.lighting.clearFlash();
    this.aliveEnemies = 0;
    this.setBoss(null);
  }

  private onResize() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    cam.setSize(w, h);
    cam.setZoom(Math.max(0.5, Math.sqrt(w * h) / VIEW_AREA));
    this.updateBloom();
    // Tanah dibuat lebih lebar dari pandangan, supaya tepinya tidak terlihat saat layar bergetar
    const vw = (w / cam.zoom) * VIEW_OVERSCAN + 8;
    const vh = (h / cam.zoom) * VIEW_OVERSCAN + 8;
    this.viewW = vw;
    this.viewH = vh;
    const left = w / 2 - vw / 2;
    const top = h / 2 - vh / 2;
    this.bg.setSize(vw, vh).setPosition(left, top);
    this.ground.setSize(vw, vh).setPosition(left, top);
    this.dayTint.setSize(vw, vh).setPosition(left, top);
  }

  // ---------------------------------------------------------------- Loop utama

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (this.state === 'playing' || this.state === 'menu') this.step(dt);
    this.updateCamera(dt);
    this.updateDay();
    this.drawHpBar();
    if (this.state !== 'menu') {
      ui.updateHud(this.runTime, this.kills, this.level, this.level >= MAX_LEVEL ? 1 : Math.min(1, this.xp / xpForLevel(this.level)));
    }
    if (this.state === 'playing') this.watchFrames();
  }

  private step(rawDt: number) {
    const playing = this.state === 'playing';
    // Gerak lambat sesaat saat ledakan besar, supaya benturannya terasa berbobot
    const dt = this.slowLeft > 0 ? rawDt * SPECIAL_FX.slowScale : rawDt;
    this.slowLeft = Math.max(0, this.slowLeft - rawDt);
    this.numbersLeft = NUMBERS_PER_FRAME;
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
    this.specials.update(dt);
    this.fx.update(dt);
    this.updateNumbers(dt);
    this.lighting.tick(dt);

    if (!playing) return;
    this.specialHudTimer -= rawDt;
    if (this.specialHudTimer <= 0) {
      this.specialHudTimer = 0.1;
      for (const id of this.specials.owned) ui.setSpecialReady(id, this.specials.readiness(id));
    }
    if (this.runTime >= this.nextSwarm) {
      this.nextSwarm += SPAWN.swarmEvery;
      this.spawnSwarm();
    }
    if (this.bossIndex < SPAWN.bosses.length && this.runTime >= SPAWN.bosses[this.bossIndex].at) {
      const kind = SPAWN.bosses[this.bossIndex++].kind;
      this.setBoss(this.spawnEnemy(kind) ?? null);
      ui.toast(`${ENEMIES[kind].name} datang!`, 'danger');
    }
    if (this.runTime >= RUN_SECONDS - 60 && !this.warnedEnd) {
      this.warnedEnd = true;
      ui.toast('Satu menit lagi!');
    }
    if (this.hp <= 0) {
      if (this.stats.revives > 0) this.revive();
      else this.endRun(false);
    } else if (this.runTime >= RUN_SECONDS) this.endRun(true);
    else if (this.level < MAX_LEVEL && this.xp >= xpForLevel(this.level)) this.levelUp();
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

    this.animateHero(dt, speed);
  }

  /** `setDepth` selalu memicu pengurutan ulang semua objek, jadi hanya dipanggil kalau nilainya berubah. */
  private setDepthIfChanged(o: Phaser.GameObjects.Image, depth: number) {
    if (o.depth !== depth) o.setDepth(depth);
  }

  private setHeroVisible(on: boolean) {
    for (const o of [this.player, this.cape, this.bow, this.heroShadow]) o.setVisible(on);
  }

  /**
   * Rig pemain: tubuh memakai frame, jubah berayun dengan pegas, busur membidik target.
   * Semua memakai `dt` dan `clock`, jadi ikut berhenti saat jeda.
   */
  private animateHero(dt: number, topSpeed: number) {
    const px = this.player.x;
    const py = this.player.y;
    const a = this.art;
    const speedNow = Math.hypot(this.vx, this.vy);
    const moving = speedNow > 14;

    // Arah hadap mengikuti gerak; saat diam mengikuti arah bidikan
    const fx = moving ? this.vx : Math.cos(this.aimAngle);
    const fy = moving ? this.vy : Math.sin(this.aimAngle);
    const view: HeroView = Math.abs(fx) > Math.abs(fy) * 0.9 ? (fx > 0 ? 2 : 3) : fy > 0 ? 0 : 1;

    let step: number;
    if (moving) {
      this.walkPhase = (this.walkPhase + (dt * speedNow) / HERO_STRIDE) % 1;
      step = Math.floor(this.walkPhase * HERO_WALK);
    } else {
      step = Math.floor(this.clock * 2.6) % HERO_IDLE;
    }
    const frame = heroFrame(view, moving, step);
    if (frame !== this.heroFrameNow) {
      this.heroFrameNow = frame;
      this.player.setFrame(a.hero.frames[frame], false, false);
    }
    // Sedikit condong ke arah gerak supaya berat badan terasa
    const lean = Phaser.Math.Clamp(this.vx / topSpeed, -1, 1);
    this.player.setRotation(lean * 0.07);

    // Jubah: pegas teredam yang tertinggal di belakang gerakan, ditambah desir angin
    const target = lean * 0.8 + Math.sin(this.clock * 1.7) * 0.05;
    this.capeVel += (target - this.capeAngle) * 70 * dt;
    this.capeVel *= Math.exp(-7 * dt);
    this.capeAngle += this.capeVel * dt;
    const along = Phaser.Math.Clamp(this.vy / topSpeed, -1, 1);
    const capeStep = Math.floor(this.clock * (moving ? 9 : 3.5)) % CAPE_FRAMES;
    this.cape
      .setFrame(a.cape.frames[capeFrame(view, capeStep)], false, false)
      .setPosition(px + lean, py + HERO_NECK)
      .setRotation(this.capeAngle)
      .setScale(a.cape.scale * HERO_SIZE, a.cape.scale * HERO_SIZE * (1 - along * 0.16));
    this.setDepthIfChanged(this.cape, view === 1 ? 10.05 : 9.9);

    // Busur: berputar halus menuju target, lalu tersentak mundur saat melepas panah
    const delta = Phaser.Math.Angle.Wrap(this.aimGoal - this.aimAngle);
    this.aimAngle = Phaser.Math.Angle.Wrap(this.aimAngle + delta * (1 - Math.exp(-18 * dt)));
    this.recoil = Math.max(0, this.recoil - dt * 7);
    const cooldown = WEAPON.boltCooldown * this.stats.cooldownMul;
    const drawn = Phaser.Math.Clamp(1 - this.boltTimer / cooldown, 0, 1);
    const bowFrame = this.recoil > 0.2 ? 0 : Math.min(BOW_FRAMES - 1, Math.floor(drawn * BOW_FRAMES));
    if (bowFrame !== this.bowFrameNow) {
      this.bowFrameNow = bowFrame;
      this.bow.setFrame(a.bow.frames[bowFrame], false, false);
    }
    const reach = 15 - this.recoil * 3.5;
    this.bow
      .setPosition(px + Math.cos(this.aimAngle) * reach, py - 3.5 + Math.sin(this.aimAngle) * reach)
      .setRotation(this.aimAngle);
    this.setDepthIfChanged(this.bow, Math.sin(this.aimAngle) < -0.25 ? 9.95 : 10.1);

    // Bayangan mengikuti arah matahari dan memanjang saat senja
    const d = this.day;
    const len = d.shadowLength;
    this.heroShadow
      .setPosition(px - Math.cos(d.sunAngle) * 7 * len, py + HERO_FEET - Math.sin(d.sunAngle) * 7 * len)
      .setRotation(d.sunAngle)
      .setScale((32 * (1 + len * 0.55)) / SHADOW_BASE / TEX_SCALE, 18 / SHADOW_BASE / TEX_SCALE)
      .setAlpha(d.shadowAlpha * 1.6);

    // Berkedip saat kebal setelah terkena serangan
    const inv = this.clock < this.invulnUntil;
    const alpha = inv ? 0.45 + 0.55 * Math.abs(Math.sin(this.clock * 30)) : 1;
    this.player.setAlpha(alpha);
    this.cape.setAlpha(alpha);
    this.bow.setAlpha(alpha);
  }

  private updateDay() {
    sampleDay(this.runTime, this.day);
    const d = this.day;
    this.lighting.update(d, this.camX, this.camY, this.player.x, this.player.y);
    if (!this.lit) {
      const l = this.lighting;
      const c = (i: number) => Phaser.Math.Clamp(l.ambient[i] + l.sunOnGround[i], 0, 1);
      this.dayTint.setFillStyle((Math.round(c(0) * 255) << 16) | (Math.round(c(1) * 255) << 8) | Math.round(c(2) * 255));
    }
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const vw = this.viewW;
    const vh = this.viewH;
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
    // Skala tile disamakan dengan shader tanah (256 unit dunia per 512 piksel tekstur)
    this.bg.setTileScale(0.5).setTilePosition((this.camX - vw / 2) * TEX_SCALE, (this.camY - vh / 2) * TEX_SCALE);
  }

  private drawHpBar() {
    const g = this.hpBar;
    g.clear();
    if (!this.player.visible || this.state === 'menu') return;
    const w = 34;
    const x = this.player.x - w / 2;
    const y = this.player.y + 28;
    const frac = Phaser.Math.Clamp(this.hp / this.stats.maxHp, 0, 1);
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(x - 1, y - 1, w + 2, 6, 3);
    g.fillStyle(hex(frac < 0.3 ? COLORS.hpLow : COLORS.hp), 1);
    if (frac > 0) g.fillRoundedRect(x, y, Math.max(4, w * frac), 4, 2);
  }

  /** Turun satu tingkat kualitas kalau frame mulai terlambat. Memakai delta mentah, bukan yang sudah dihaluskan Phaser. */
  private watchFrames() {
    if (!this.governor.sample(this.game.loop.rawDelta)) return;
    // Tingkat yang tidak mengubah apa pun dilewati, supaya tidak perlu menunggu satu jendela pengukuran lagi
    while (this.qualityTier < QUALITY.tiers.length - 1) {
      this.qualityTier++;
      if (this.applyQuality()) return;
    }
  }

  // ---------------------------------------------------------------- Musuh

  private spawn(dt: number, playing: boolean) {
    const lv = playing ? this.threat() : MENU_THREAT;
    const rate = playing ? spawnRate(this.aliveEnemies, lv) : 2.2;
    const cap = playing ? targetPopulation(lv) : 45;
    this.spawnAcc = Math.min(this.spawnAcc + rate * dt, 3);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.aliveEnemies < cap) this.spawnEnemy(pickKind(lv, Math.random()));
    }
  }

  private spawnRadius() {
    const cam = this.cameras.main;
    return Math.hypot(cam.width, cam.height) / cam.zoom / 2 + 50;
  }

  /** Sudut muncul di tepi pandang, condong ke arah gerak pemain. Jaraknya tetap, jadi tidak muncul di layar. */
  private spawnAngle() {
    const moving = Math.hypot(this.vx, this.vy) > 40;
    if (!moving || Math.random() > SPAWN.aheadChance) return Math.random() * Math.PI * 2;
    return Math.atan2(this.vy, this.vx) + (Math.random() - 0.5) * SPAWN.aheadSpread;
  }

  private spawnSwarm() {
    const n = swarmSize(this.threat());
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
      // Bos selalu boleh masuk, walau pool sedang penuh
      if (this.enemies.length >= SPAWN.hardCap && !ENEMIES[kind].boss) return undefined;
      e = {
        id: this.enemies.length,
        img: this.add.image(0, 0, this.art.enemies[kind].strip.key).setDepth(8).setLighting(this.lit),
        shadow: this.add.image(0, 0, 'shadow').setDepth(4),
        art: this.art.enemies[kind],
        frame: -1,
        alive: false,
        kind,
        hp: 0,
        maxHp: 1,
        speed: 0,
        damage: 0,
        radius: 0,
        xp: 0,
        kbx: 0,
        kby: 0,
        flashUntil: 0,
        flashing: false,
        lastOrbitHit: -9,
        baseScale: 1,
        facing: 0,
        born: 0,
        hitPop: 0,
        attack: 0,
        nextAttack: 0,
        stepNow: 0,
        dotDps: 0,
        dotUntil: 0,
        dotNext: 0,
        slowFactor: 1,
        slowUntil: 0,
        statusTint: 0,
      };
      this.enemies.push(e);
    }
    if (x === undefined || y === undefined) {
      const a = this.spawnAngle();
      const r = this.spawnRadius();
      x = this.player.x + Math.cos(a) * r;
      y = this.player.y + Math.sin(a) * r;
    }
    const spec = ENEMIES[kind];
    const lv = this.state === 'menu' ? 1 : this.threat();
    const hpMul = enemyHpMul(lv);
    Object.assign(e, {
      alive: true,
      kind,
      hp: spec.hp * hpMul,
      maxHp: spec.hp * hpMul,
      speed: spec.speed * enemySpeedMul(lv) * Phaser.Math.FloatBetween(0.9, 1.12),
      damage: spec.damage * enemyDamageMul(lv),
      radius: spec.radius,
      xp: spec.xp,
      kbx: 0,
      kby: 0,
      flashUntil: 0,
      flashing: false,
      lastOrbitHit: -9,
      facing: 0,
      born: this.clock,
      hitPop: 0,
      attack: 0,
      nextAttack: 0,
      stepNow: -1,
      dotDps: 0,
      dotUntil: 0,
      dotNext: 0,
      slowFactor: 1,
      slowUntil: 0,
      statusTint: 0,
    });
    const art = this.art.enemies[kind];
    e.art = art;
    e.frame = 0;
    e.baseScale = art.strip.scale * art.size * spec.scale;
    e.img
      .setFrame(art.strip.frames[0], true, false)
      .setOrigin(0.5, art.anchorY)
      .setPosition(x, y)
      .setScale(e.baseScale)
      .setRotation(0)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true)
      .clearTint();
    this.setDepthIfChanged(e.img, spec.depth);
    e.shadow.setVisible(true).setActive(true);
    this.aliveEnemies++;
    return e;
  }

  private rebuildHash() {
    this.hash.clear();
    for (const e of this.enemies) if (e.alive) this.hash.insert(e.id, e.img.x, e.img.y);
  }

  private updateEnemies(dt: number, playing: boolean) {
    const px = this.player.x;
    const py = this.player.y;
    const despawn = this.spawnRadius() * SPAWN.recycleFactor;
    const kbDecay = Math.exp(-8 * dt);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const img = e.img;
      let dx = px - img.x;
      let dy = py - img.y;
      const d = Math.hypot(dx, dy) || 1;

      // Musuh yang tertinggal terlalu jauh dipindah ke depan pemain
      const spec = ENEMIES[e.kind];
      if (d > despawn && !spec.boss) {
        const a = this.spawnAngle();
        const r = this.spawnRadius();
        img.setPosition(px + Math.cos(a) * r, py + Math.sin(a) * r);
        continue;
      }

      dx /= d;
      dy /= d;
      // Berhenti di tepi tubuh pemain: mengepung, bukan menumpuk di atasnya
      const contact = e.radius + PLAYER.radius;
      const stopAt = contact * 0.86;
      const slowed = this.clock < e.slowUntil ? e.slowFactor : 1;
      const approach = d > stopAt ? e.speed * slowed : (d - stopAt) * 8;
      let mx = dx * approach;
      let my = dy * approach;

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
      const sl = Math.hypot(sx, sy);
      if (sl > SEPARATION_MAX) {
        sx *= SEPARATION_MAX / sl;
        sy *= SEPARATION_MAX / sl;
      }
      const sepStrength = spec.boss ? 10 : 90;
      mx += sx * sepStrength;
      my += sy * sepStrength;

      // Bos lebih besar dari jangkauan hash musuh kecil, jadi dorongannya diperiksa terpisah
      const boss = this.boss;
      if (boss && boss !== e) {
        const bx = img.x - boss.img.x;
        const by = img.y - boss.img.y;
        const min = e.radius + boss.radius;
        const bd = bx * bx + by * by;
        if (bd > 0.01 && bd < min * min) {
          const dist = Math.sqrt(bd);
          const push = ((min - dist) / min) * 280;
          mx += (bx / dist) * push;
          my += (by / dist) * push;
        }
      }

      img.x += (mx + e.kbx) * dt;
      img.y += (my + e.kby) * dt;
      e.kbx *= kbDecay;
      e.kby *= kbDecay;

      this.animateEnemy(e, dx, mx, dt);

      if (e.flashing && this.clock >= e.flashUntil) {
        e.flashing = false;
        img.clearTint();
        e.statusTint = 0;
      }
      if (!e.flashing) this.updateStatusTint(e);

      // Racun terus menggerogoti, tanpa kilatan dan tanpa dorongan
      if (this.clock < e.dotUntil && this.clock >= e.dotNext) {
        e.dotNext = this.clock + GEAR.poisonTick;
        const dmg = e.dotDps * GEAR.poisonTick;
        e.hp -= dmg;
        this.showNumber(img.x, img.y - e.radius, dmg, false, false);
        if (e === this.boss) ui.setBossHp(e.hp / e.maxHp);
        if (e.hp <= 0) {
          this.killEnemy(e);
          continue;
        }
      }

      // Tabrakan dengan pemain
      if (d < contact) {
        if (this.clock >= e.nextAttack) {
          e.attack = 1;
          e.nextAttack = this.clock + 0.8;
        }
        if (playing && this.clock >= this.invulnUntil) {
          e.attack = 1;
          this.hurtPlayer(e.damage);
        }
      }
    }
    if (this.boss) this.lighting.setBossLight(this.boss.img.x, this.boss.img.y, hex(ENEMIES[this.boss.kind].color), LIGHTING.bossPower);
  }

  /** Frame hanya diganti saat berubah, dan langkah tiap musuh digeser agar tidak serempak. */
  private animateEnemy(e: Enemy, dirX: number, moveX: number, dt: number) {
    const art = e.art;
    const img = e.img;
    // Tidak berbalik saat pemain tepat di atas atau bawahnya, supaya tidak berkedip kiri-kanan
    if (Math.abs(dirX) > 0.2) e.facing = dirX < 0 ? 1 : 0;
    const phase = this.clock * art.fps + e.id * 0.37;
    const step = Math.floor(phase) % art.walk;
    const frame = step + e.facing * art.walk;
    if (frame !== e.frame) {
      e.frame = frame;
      img.setFrame(art.strip.frames[frame], false, false);
    }

    e.hitPop = Math.max(0, e.hitPop - dt * 8);
    e.attack = Math.max(0, e.attack - dt * 4.2);
    const forward = e.facing ? -1 : 1;
    const lunge = Math.sin(e.attack * Math.PI);
    const rise = Math.min(1, (this.clock - e.born) / 0.26);
    // Tubuh berat melebar dan memendek saat kaki menapak
    const stomp = art.stomp * Math.abs(Math.sin((phase / art.walk) * Math.PI * 2));
    const size = e.baseScale * (0.55 + 0.45 * rise);
    img.scaleX = size * (1 + stomp + e.hitPop * 0.16 + lunge * 0.1);
    img.scaleY = size * (1 - stomp - e.hitPop * 0.12 - lunge * 0.04);
    img.alpha = Math.min(1, rise * 1.6);
    img.rotation = Phaser.Math.Clamp(moveX / (e.speed + 1), -1, 1) * 0.06 + forward * lunge * 0.34;

    // Debu setiap kaki makhluk berat menapak
    if (art.stomp > 0 && step !== e.stepNow) {
      e.stepNow = step;
      if (step % (art.walk / 2) === 0) {
        const feet = art.feet * (img.scaleY / art.strip.scale);
        this.fx.spawn({ key: 'puff', x: img.x, y: img.y + feet, life: 0.42, depth: 4.5, s0: (e.radius / 30) * 0.6, s1: e.radius / 30, a0: 0.5, a1: 0, tint: art.smoke });
      }
    }

    const d = this.day;
    const scale = e.baseScale / art.strip.scale;
    const w = art.shadow * scale;
    const len = d.shadowLength;
    const shadow = e.shadow;
    shadow.x = img.x - Math.cos(d.sunAngle) * w * 0.26 * len;
    shadow.y = img.y + art.feet * scale - Math.sin(d.sunAngle) * w * 0.26 * len;
    shadow.rotation = d.sunAngle;
    shadow.scaleX = (w * (1 + len * 0.55)) / SHADOW_BASE / TEX_SCALE;
    shadow.scaleY = (w * 0.56) / SHADOW_BASE / TEX_SCALE;
    shadow.alpha = d.shadowAlpha * 1.6;
  }

  private hurtPlayer(dmg: number) {
    const s = this.stats;
    this.invulnUntil = this.clock + PLAYER.invulnMs / 1000;
    if (Math.random() < s.dodge) {
      this.fx.spawn({ key: 'puff', x: this.player.x, y: this.player.y, vy: -30, life: 0.4, depth: 10.5, s0: 0.6, s1: 1.3, a0: 0.7, a1: 0, spin: 2, tint: hex(PALETTE.fx.dust) });
      return;
    }
    this.hp -= dmg * (1 - s.armor);
    this.shake(140, 0.006);
    ui.hurtFlash();
    const thorns = s.thorns > 0 ? ENEMIES.drone.hp * enemyHpMul(this.threat()) * GEAR.thorns * s.thorns : 0;
    // Musuh di sekitar terdorong sedikit, supaya pemain punya celah untuk kabur
    this.eachInRadius(this.player.x, this.player.y, GEAR.thornsRadius, (o, _d, dx, dy) => {
      const k = o as Enemy;
      if (thorns > 0) this.damageEnemy(k, thorns, dx, dy, 300);
      else this.pushEnemy(k, dx, dy, 300);
    });
  }

  /** Bulu Phoenix: bangkit dengan sebagian HP dan melontarkan musuh di sekitar. */
  private revive() {
    const s = this.stats;
    s.revives--;
    this.hp = s.maxHp * GEAR.reviveHp;
    this.invulnUntil = this.clock + GEAR.reviveInvuln;
    const { x, y } = this.player;
    const scale = (GEAR.reviveRadius / RING_RADIUS) * INV;
    this.fx.spawn({ key: 'fxBlast', x, y, life: 0.6, depth: 11.5, s0: scale * 0.3, s1: scale * 0.9, a0: 1, a1: 0, add: true });
    this.fx.spawn({ key: 'fxShock', x, y, life: 0.5, depth: 3.6, s0: scale * 0.2, s1: scale, a0: 1, a1: 0, tint: hex(PALETTE.fx.fireCore), add: true });
    this.eachInRadius(x, y, GEAR.reviveRadius, (o, _d, dx, dy) => this.pushEnemy(o as Enemy, dx, dy, 1000));
    this.shake(320, 0.014);
    this.lighting.flash(x, y, hex(PALETTE.fx.fire), 3, GEAR.reviveRadius * 2);
    ui.toast('Bulu Phoenix membangkitkan Anda!');
  }

  private slowEnemy(e: Enemy, factor: number, seconds: number) {
    // Bos hanya melambat, supaya pertarungannya tidak bisa dibekukan terus-menerus
    const f = ENEMIES[e.kind].boss ? Math.max(factor, SPECIAL_FX.frostBossSlow) : factor;
    if (this.clock < e.slowUntil && e.slowFactor < f) return;
    e.slowFactor = f;
    e.slowUntil = this.clock + seconds;
  }

  /** Warna tubuh mengikuti status: es di atas racun. Tint hanya diganti saat berubah. */
  private updateStatusTint(e: Enemy) {
    const want = this.clock < e.slowUntil && e.slowFactor < 1 ? FROST_TINT : this.clock < e.dotUntil ? POISON_TINT : 0;
    if (want === e.statusTint) return;
    e.statusTint = want;
    if (want) e.img.setTint(want);
    else e.img.clearTint();
  }

  private pushEnemy(e: Enemy, kx: number, ky: number, knock: number) {
    const k = knock * ENEMIES[e.kind].knockback * this.stats.knockMul;
    e.kbx += kx * k;
    e.kby += ky * k;
    const m = Math.hypot(e.kbx, e.kby);
    if (m > KNOCK_MAX) {
      e.kbx *= KNOCK_MAX / m;
      e.kby *= KNOCK_MAX / m;
    }
  }

  private damageEnemy(e: Enemy, amount: number, kx: number, ky: number, knock: number, heavy = false) {
    if (!e.alive) return;
    const s = this.stats;
    const crit = Math.random() < s.critChance;
    const dmg = crit ? amount * s.critMul : amount;
    e.hp -= dmg;
    // Titah Algojo: musuh biasa yang nyaris mati langsung tumbang
    if (s.execute > 0 && e.hp > 0 && !ENEMIES[e.kind].boss && e.hp / e.maxHp < s.execute) e.hp = 0;
    this.pushEnemy(e, kx, ky, knock);
    e.hitPop = 1;
    e.flashUntil = this.clock + 0.07;
    if (!e.flashing) {
      e.flashing = true;
      e.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    }
    this.showNumber(e.img.x, e.img.y - e.radius, dmg, crit, heavy);
    if (e === this.boss) ui.setBossHp(e.hp / e.maxHp);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    const x = e.img.x;
    const y = e.img.y;
    const spec = ENEMIES[e.kind];
    const big = spec.boss ? 60 : e.kind === 'brute' ? 12 : 6;
    this.bursts.get(e.kind)!.explode(big, x, y - e.radius * 0.4);

    // Tubuh tertekan dan memudar, lalu kepulan debu sesuai jenisnya
    const art = e.art;
    const bs = e.baseScale;
    this.fx.spawn({ frame: art.strip.frames[e.frame], x, y, life: spec.boss ? 0.7 : 0.26, depth: 7.5, s0: bs * 1.1, s1: bs * 1.3, sy0: bs * 0.9, sy1: bs * 0.15, a0: 1, a1: 0, originY: art.anchorY, lit: this.lit, tint: art.smoke, ease: 'linear' });
    this.fx.spawn({ key: 'puff', x, y: y + e.radius * 0.3, vy: -18, life: 0.5, depth: 8.2, s0: (e.radius / 32) * 0.7, s1: (e.radius / 32) * 1.6, a0: 0.7, a1: 0, spin: 0.8, tint: art.smoke });

    if (spec.boss) {
      this.shake(420, 0.016);
      this.slowLeft = this.reducedMotion ? 0 : 0.5;
      this.lighting.flash(x, y, hex(spec.color), 3, 700);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.fx.spawn({ key: 'puff', x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 20, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60, life: 0.9, depth: 8.2, s0: 1.4, s1: 3.4, a0: 0.8, a1: 0, spin: 1, tint: art.smoke });
      }
      this.dropGem(x, y, e.xp, true);
      this.hp = Math.min(this.stats.maxHp, this.hp + 25);
      // Bos kalah: semua kristal di dunia tertarik ke pemain
      for (const g of this.gems) if (g.alive) g.pulled = true;
      if (this.state === 'playing') ui.toast(`${spec.name} tumbang!`);
    } else {
      this.dropGem(x, y, e.xp, e.xp >= 5);
    }
    if (this.state === 'playing') {
      this.kills++;
      if (this.stats.lifesteal > 0 && Math.random() < this.stats.lifesteal) {
        this.hp = Math.min(this.stats.maxHp, this.hp + GEAR.lifestealHeal);
      }
    }
    this.removeEnemy(e);
  }

  private setBoss(e: Enemy | null) {
    this.boss = e;
    ui.setBoss(e ? ENEMIES[e.kind].name : null);
    if (!e) this.lighting.setBossLight(0, 0, 0xffffff, 0);
  }

  private removeEnemy(e: Enemy) {
    if (e.alive) this.aliveEnemies--;
    e.alive = false;
    if (e === this.boss) this.setBoss(null);
    e.img.setActive(false).setVisible(false);
    e.shadow.setActive(false).setVisible(false);
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

  /** Hash menyimpan titik tengah, jadi pencarian diperluas selebar musuh terbesar lalu dicek tepat. */
  private eachInRadius(x: number, y: number, r: number, fn: (e: SpecialTarget, dist: number, dx: number, dy: number) => void) {
    this.hash.query(x, y, r + MAX_ENEMY_RADIUS, (id) => {
      const e = this.enemies[id];
      if (!e.alive) return;
      const ex = e.img.x - x;
      const ey = e.img.y - y;
      const d = Math.hypot(ex, ey);
      if (d >= r + e.radius) return;
      const n = d || 1;
      fn(e, d, ex / n, ey / n);
    });
  }

  /** Mencari pusat kerumunan terpadat. Hanya dipanggil saat pusaka aktif, bukan tiap frame. */
  private densest(range: number, out: { x: number; y: number }, avoid?: { x: number; y: number }, avoidRadius = 0) {
    const px = this.player.x;
    const py = this.player.y;
    const stride = Math.max(1, Math.floor(this.aliveEnemies / 40));
    let seen = 0;
    let best = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ex = e.img.x;
      const ey = e.img.y;
      if (Phaser.Math.Distance.Squared(ex, ey, px, py) > range * range) continue;
      if (avoid && Phaser.Math.Distance.Squared(ex, ey, avoid.x, avoid.y) < avoidRadius * avoidRadius) continue;
      if (seen++ % stride !== 0) continue;
      let score = 0;
      let sx = 0;
      let sy = 0;
      let n = 0;
      this.hash.query(ex, ey, CLUSTER_RADIUS, (id) => {
        const o = this.enemies[id];
        if (!o.alive || Phaser.Math.Distance.Squared(o.img.x, o.img.y, ex, ey) > CLUSTER_RADIUS * CLUSTER_RADIUS) return;
        score += ENEMIES[o.kind].boss ? 6 : 1;
        sx += o.img.x;
        sy += o.img.y;
        n++;
      });
      if (n > 0 && score > best) {
        best = score;
        out.x = sx / n;
        out.y = sy / n;
      }
    }
    return best > 0;
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
        this.fireVolley(target);
        if (Math.random() < s.doubleShot) this.extraVolley = 0.12;
      } else {
        this.boltTimer = 0.1;
      }
    }

    if (this.extraVolley > 0) {
      this.extraVolley -= dt;
      if (this.extraVolley <= 0) {
        const target = this.nearestEnemy(480);
        if (target) this.fireVolley(target);
      }
    }

    // 2) Satelit yang mengorbit
    const count = s.orbitCount;
    if (count > 0) {
      this.orbitAngle += WEAPON.orbitSpeed * dt;
      const r = WEAPON.orbitRadius + s.orbitBonus;
      for (let i = 0; i < count; i++) {
        const sword = this.swords[i];
        const a = this.orbitAngle + (i / count) * Math.PI * 2;
        const ox = this.player.x + Math.cos(a) * r;
        const oy = this.player.y + Math.sin(a) * r;
        // Ujung pedang mengarah ke arah putaran, seperti sedang menebas
        sword.setPosition(ox, oy).setRotation(a + Math.PI / 2);
        this.hash.query(ox, oy, 60, (id) => {
          const e = this.enemies[id];
          if (!e.alive || this.clock - e.lastOrbitHit < WEAPON.orbitHitCooldown) return;
          const dx = e.img.x - ox;
          const dy = e.img.y - oy;
          const rr = e.radius + 16;
          if (dx * dx + dy * dy < rr * rr) {
            e.lastOrbitHit = this.clock;
            const d = Math.hypot(dx, dy) || 1;
            this.damageEnemy(e, WEAPON.orbitDamage * s.damageMul * s.orbitMul, dx / d, dy / d, 160);
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
        this.fireNova(WEAPON.novaRadius * (1 + 0.15 * (lv - 1)) * s.novaArea, WEAPON.novaDamage * (1 + 0.3 * (lv - 1)) * s.damageMul * s.novaMul);
      }
    }
  }

  private fireVolley(target: Enemy) {
    const base = Math.atan2(target.img.y - this.player.y, target.img.x - this.player.x);
    this.aimGoal = base;
    this.recoil = 1;
    const n = this.stats.projectiles;
    const spread = 0.16;
    for (let i = 0; i < n; i++) this.fireBolt(base + (i - (n - 1) / 2) * spread);
  }

  private fireBolt(angle: number) {
    let b = this.bolts.find((bb) => !bb.alive);
    if (!b) {
      b = {
        img: this.add.image(0, 0, this.art.arrow.key, this.art.arrow.frames[0].name).setScale(this.art.arrow.scale).setDepth(7).setLighting(this.lit),
        alive: false,
        bounce: 0,
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
    b.bounce = this.stats.ricochet;
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
      // Dibagi beberapa langkah kecil: panah cepat pada frame panjang tidak boleh melompati musuh
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const steps = Math.max(1, Math.ceil((speed * dt) / BOLT_SUBSTEP));
      const stepDt = dt / steps;
      for (let i = 0; i < steps && b.alive; i++) {
        img.x += b.vx * stepDt;
        img.y += b.vy * stepDt;
        this.hash.query(img.x, img.y, WEAPON.boltRadius + MAX_ENEMY_RADIUS, (id) => {
          if (!b.alive) return;
          const e = this.enemies[id];
          if (!e.alive || b.hits.includes(id)) return;
          const dx = e.img.x - img.x;
          const dy = e.img.y - img.y;
          const rr = e.radius + WEAPON.boltRadius;
          if (dx * dx + dy * dy < rr * rr) {
            b.hits.push(id);
            this.damageEnemy(e, b.damage, b.vx / speed, b.vy / speed, 220);
            this.onBoltHit(e, b, img.x, img.y);
            if (b.bounce > 0 && this.bounceBolt(b, speed)) b.bounce--;
            else if (b.pierce-- <= 0) this.removeBolt(b);
          }
        });
      }
    }
  }

  /** Efek tambahan panah: racun, es, dan ledakan. */
  private onBoltHit(e: Enemy, b: Bolt, x: number, y: number) {
    const s = this.stats;
    if (e.alive && s.poison > 0) {
      e.dotDps = b.damage * GEAR.poisonDps * s.poison;
      e.dotUntil = this.clock + GEAR.poisonSeconds;
    }
    if (e.alive && s.frost > 0) this.slowEnemy(e, 1 - GEAR.frostSlow * s.frost, GEAR.frostSeconds);
    if (s.explode > 0) {
      const r = GEAR.explodeRadius + GEAR.explodeRadiusPerLevel * (s.explode - 1);
      const dmg = b.damage * GEAR.explodeDamage * s.explode;
      this.eachInRadius(x, y, r, (o, _d, dx, dy) => {
        if (o !== e) this.damageEnemy(o as Enemy, dmg, dx, dy, 140);
      });
      const scale = (r / RING_RADIUS) * INV;
      this.fx.spawn({ key: 'fxBlast', x, y, life: 0.22, depth: 7.8, s0: scale * 0.5, s1: scale * 1.1, a0: 0.95, a1: 0, add: true });
    }
  }

  /** Mengarahkan panah ke musuh terdekat yang belum terkena. False kalau tidak ada. */
  private bounceBolt(b: Bolt, speed: number) {
    const x = b.img.x;
    const y = b.img.y;
    let best: Enemy | null = null;
    let bestD = GEAR.ricochetRange * GEAR.ricochetRange;
    this.hash.query(x, y, GEAR.ricochetRange, (id) => {
      const o = this.enemies[id];
      if (!o.alive || b.hits.includes(id)) return;
      const d = Phaser.Math.Distance.Squared(o.img.x, o.img.y, x, y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    });
    if (!best) return false;
    const target: Enemy = best;
    const a = Math.atan2(target.img.y - y, target.img.x - x);
    b.vx = Math.cos(a) * speed;
    b.vy = Math.sin(a) * speed;
    b.life = Math.max(b.life, 0.5);
    b.img.setRotation(a);
    return true;
  }

  private fireNova(radius: number, damage: number) {
    const px = this.player.x;
    const py = this.player.y;
    const scale = (radius / RING_RADIUS) * INV;
    this.fx.spawn({ key: 'fxRune', x: px, y: py, life: 0.46, depth: 3.5, s0: scale * 0.35, s1: scale, a0: 1, a1: 0, spin: 1.4, follow: this.player });
    this.fx.spawn({ key: 'fxShock', x: px, y: py, life: 0.3, depth: 3.6, s0: scale * 0.2, s1: scale * 1.05, a0: 0.8, a1: 0, tint: hex(PALETTE.fx.rune), follow: this.player });
    this.eachInRadius(px, py, radius, (e, _d, dx, dy) => this.damageEnemy(e as Enemy, damage, dx, dy, 320));
  }

  private rebuildSwords() {
    const n = this.stats.orbitCount;
    const a = this.art.sword;
    while (this.swords.length < n) {
      this.swords.push(this.add.image(0, 0, a.key, a.frames[0].name).setScale(a.scale).setDepth(11));
    }
    // Pedang di atas jumlah aktif disembunyikan (mis. saat kembali ke menu)
    this.swords.forEach((o, i) => o.setVisible(i < n).setActive(i < n));
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
    // Kristal yang tertinggal jauh tidak hilang: XP tetap mengalir walau pemain terus berlari
    const recall = this.spawnRadius() * PLAYER.gemRecallFactor;
    for (const g of this.gems) {
      if (!g.alive) continue;
      const img = g.img;
      const dx = px - img.x;
      const dy = py - img.y;
      const d = Math.hypot(dx, dy);
      if (!g.pulled && (d < magnet || d > recall)) g.pulled = true;
      if (g.pulled) {
        g.speed = Math.min(g.speed + 1400 * dt, 900);
        const step = Math.min(d, g.speed * dt);
        img.x += (dx / (d || 1)) * step;
        img.y += (dy / (d || 1)) * step;
        if (d < PLAYER.radius + 4) {
          this.bursts.get('pickup')!.explode(4, img.x, img.y);
          if (playing && this.level < MAX_LEVEL) this.xp += g.value * this.stats.xpMul;
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
    // Level kelipatan lima menawarkan pusaka, selama masih ada yang bisa diambil
    const specials = isSpecialLevel(this.level) ? rollSpecials(this.levels) : [];
    const special = specials.length > 0;
    const choices = special ? specials : rollChoices(this.levels, 3, Math.random, this.stats.luck);
    ui.showLevelUp(this.level, choices, this.levels, (u) => this.applyUpgrade(u), special);
  }

  private applyUpgrade(u: Upgrade) {
    const next = (this.levels[u.id] ?? 0) + 1;
    this.levels[u.id] = next;
    const heal = u.apply(this.stats, next);
    if (heal) this.hp += heal;
    this.hp = Math.min(this.stats.maxHp, this.hp);
    this.rebuildSwords();
    if (u.tag === 'Pusaka') {
      this.specials.setTier(u.id as SpecialId, next);
      ui.setSpecialSlots(this.specials.owned.map((id) => ({ id, icon: ALL_UPGRADES.find((o) => o.id === id)!.icon, tier: this.levels[id] })));
    }
    this.invulnUntil = this.clock + 0.6;
    ui.show(null);
    this.state = 'playing';
    this.controls.setEnabled(true);
  }

  // ---------------------------------------------------------------- Angka damage

  private showNumber(x: number, y: number, value: number, crit: boolean, heavy: boolean) {
    if (this.state === 'menu' || this.numbersLeft <= 0) return;
    this.numbersLeft--;
    let n = this.numbers.find((o) => !o.text.active);
    if (!n) {
      if (this.numbers.length >= 28) return;
      n = { text: this.add.bitmapText(0, 0, DIGIT_FONT, '', 11).setOrigin(0.5).setDepth(20), age: 0, y0: 0 };
      this.numbers.push(n);
    }
    n.age = 0;
    n.y0 = y;
    n.text
      .setText(String(Math.round(value)))
      .setTint(hex(heavy ? COLORS.special : crit ? COLORS.gemBig : COLORS.number))
      .setFontSize(heavy ? 20 : crit ? 18 : 13)
      .setPosition(x + Phaser.Math.Between(-6, 6), y)
      .setAlpha(crit || heavy ? 1 : 0.8)
      .setActive(true)
      .setVisible(true);
  }

  private updateNumbers(dt: number) {
    for (const n of this.numbers) {
      if (!n.text.active) continue;
      n.age += dt;
      const t = n.age / NUMBER_LIFE;
      if (t >= 1) {
        n.text.setActive(false).setVisible(false);
        continue;
      }
      n.text.y = n.y0 - 26 * (1 - (1 - t) * (1 - t) * (1 - t));
      n.text.alpha = Math.min(n.text.alpha, 1 - t * t);
    }
  }
}
