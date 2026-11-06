import type * as Phaser from 'phaser';
import { AUDIO, SPAWN, type EnemyKind } from './config';
import { CATALOG, spec, type SoundId } from './audioCatalog';
import { RateLimiter, ambientAt, gainForDistance, musicTrackAt, panFor, parseSoundName, pickVariant, shouldRestart, tracksNeeded, type MusicState } from './audioMix';

type Sound = Phaser.Sound.BaseSound;

/** `volume` ada di semua jenis suara Phaser, tetapi tidak di tipe dasarnya. */
const setVol = (snd: Sound, v: number) => {
  (snd as Sound & { volume: number }).volume = v;
};

/** Semua file mp3 dan m4a di `src/audio/files`. Hanya berisi URL, jadi kosong pun tidak masalah. */
const FILES = import.meta.glob('./audio/files/**/*.{mp3,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface Clip {
  key: string;
  url: string;
}

/** Id -> daftar variasi yang filenya ada. */
const CLIPS = new Map<SoundId, Clip[]>();
for (const [path, url] of Object.entries(FILES)) {
  const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.(mp3|m4a)$/, '');
  const { id, variant } = parseSoundName(base);
  if (!(id in CATALOG)) {
    if (import.meta.env.DEV) console.warn(`[audio] ${path}: id "${id}" tidak ada di audioCatalog.ts`);
    continue;
  }
  const list = CLIPS.get(id as SoundId) ?? [];
  list[variant - 1] = { key: base, url };
  CLIPS.set(id as SoundId, list);
}

/** Id yang punya setidaknya satu file. Dipakai panel uji dengar. */
export const availableIds = () => [...CLIPS.keys()];
/** Jumlah file variasi yang ada untuk satu id. */
export const clipCount = (id: SoundId) => CLIPS.get(id)?.filter(Boolean).length ?? 0;

const isStreamed = (id: SoundId) => spec(id).cat === 'music' || spec(id).cat === 'ambient';

interface Layer {
  id: SoundId;
  snd: Sound;
  level: number;
  goal: number;
  /** Takaran trek (kerasnya disetarakan di katalog). */
  gain: number;
  /** Sudah menyambung dirinya sendiri, jangan diulang. */
  restarted: boolean;
}

type Timed = Sound & { duration: number; seek: number };

interface Channel {
  layers: Layer[];
  current: Layer | null;
}

interface Loop {
  snd: Sound;
  left: number;
  vol: number;
}

export interface AudioView {
  state: MusicState;
  runTime: number;
  boss: EnemyKind | null;
  /** Posisi pendengar (pemain) dan setengah lebar pandang, dalam unit dunia. */
  x: number;
  y: number;
  halfView: number;
}

/**
 * Suara game. Dibangun di atas `scene.sound` Phaser, yang sudah menangani autoplay dan jeda saat tab disembunyikan.
 * Instance suara dipakai ulang (pool); file yang belum ada hanya berarti senyap.
 */
export class GameAudio {
  musicVolume: number = AUDIO.musicVolume;
  sfxVolume: number = AUDIO.sfxVolume;

  private pool = new Map<string, Sound[]>();
  private lastVariant = new Map<SoundId, number>();
  private loops = new Map<SoundId, Loop>();
  private limiter = new RateLimiter();
  private requested = new Set<SoundId>();
  private music: Channel = { layers: [], current: null };
  private ambient: Channel = { layers: [], current: null };
  private active = 0;
  private maxVoices: number = AUDIO.maxVoices;
  private now = 0;
  private dt = 0;
  live = false; // ronde sedang berjalan; hanya saat itu efek dunia berbunyi
  private duckLeft = 0;
  private duckDepth = 0;
  private duckGain = 1;
  private lastView: AudioView = { state: 'menu', runTime: 0, boss: null, x: 0, y: 0, halfView: 400 };
  private readonly free = () => {
    this.active = Math.max(0, this.active - 1);
  };

  constructor(private scene: Phaser.Scene) {}

  /**
   * Browser menahan suara sampai ada interaksi pengguna. Phaser hanya mendengar mousedown/touch/keydown,
   * jadi di sini ikut dipasang pointer dan keyboard, dan konteks dilanjutkan pada interaksi pertama di mana saja.
   */
  armUnlock() {
    const mgr = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = mgr.context;
    if (!ctx) return;
    const blocked = () => ctx.state !== 'running';
    if (!blocked()) return;
    const events = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
    const off = () => events.forEach((e) => window.removeEventListener(e, go, true));
    const go = () => {
      void ctx.resume().then(() => {
        if (blocked()) return;
        off();
      });
    };
    events.forEach((e) => window.addEventListener(e, go, true));
    ctx.addEventListener('statechange', () => {
      if (!blocked()) off();
    });
  }

  // Disimpan sendiri: `sound.mute` Phaser dibaca dari gain node, yang baru berubah setelah thread audio memprosesnya
  private mute = false;

  get muted() {
    return this.mute;
  }

  set muted(on: boolean) {
    this.mute = on;
    this.scene.sound.mute = on;
  }

  /** Mulai memuat semua efek suara di latar belakang. Musik dan suasana dimuat saat dibutuhkan. */
  preload() {
    for (const [id, clips] of CLIPS) {
      if (isStreamed(id)) continue;
      for (const c of clips) if (c) this.queue(c);
    }
    this.startLoader();
  }

  setVoiceLimit(low: boolean) {
    this.maxVoices = low ? AUDIO.maxVoicesLow : AUDIO.maxVoices;
  }

  /** Dipanggil saat ronde baru atau kembali ke menu. */
  reset() {
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
    this.limiter.clear();
    this.duckLeft = 0;
  }

  // ---------------------------------------------------------------- Efek suara

  /**
   * Efek suara dunia. Hanya berbunyi saat ronde berjalan, supaya demo di menu tidak ikut bertarung.
   * `x`, `y` memberi posisi: makin jauh dari pemain makin pelan, dan ke kiri atau kanan menurut posisinya.
   */
  sfx(id: SoundId, x?: number, y?: number, volume = 1) {
    if (!this.live) return;
    this.play(id, x, y, volume);
  }

  /** Suara yang selalu berbunyi, seperti antarmuka dan stinger. */
  ui(id: SoundId, volume = 1) {
    this.play(id, undefined, undefined, volume);
  }

  /** Stinger musik: berbunyi walau ronde tidak berjalan, dan menurunkan musik sesaat. */
  stinger(id: SoundId) {
    this.play(id, undefined, undefined, 1);
    this.duck(AUDIO.stingerDuck.seconds, AUDIO.stingerDuck.depth);
  }

  duck(seconds: number, depth: number) {
    this.duckLeft = Math.max(this.duckLeft, seconds);
    this.duckDepth = Math.max(this.duckDepth, depth);
  }

  /**
   * Suara berulang selama `seconds` (mis. api, hujan panah). Memanggil lagi sebelum habis hanya memperpanjang.
   * Waktunya dihitung dari `tick`, jadi berhenti saat permainan dijeda.
   */
  loop(id: SoundId, seconds: number, volume = 1) {
    if (!this.live) return;
    const have = this.loops.get(id);
    if (have) {
      have.left = Math.max(have.left, seconds);
      return;
    }
    const clips = CLIPS.get(id);
    const clip = clips?.find(Boolean);
    if (!clip || !this.scene.cache.audio.exists(clip.key)) return;
    const snd = this.scene.sound.add(clip.key, { loop: true, volume: 0 });
    const vol = (spec(id).vol ?? 1) * volume;
    setVol(snd, vol * this.sfxVolume);
    if (snd.play()) this.loops.set(id, { snd, left: seconds, vol });
    else snd.destroy();
  }

  private stopLoop(id: SoundId) {
    const l = this.loops.get(id);
    if (!l) return;
    l.snd.stop();
    l.snd.destroy();
    this.loops.delete(id);
  }

  /** Dipanggil dari loop utama dengan dt permainan (ikut berhenti saat jeda). */
  tick(dt: number) {
    for (const [id, l] of this.loops) {
      l.left -= dt;
      if (l.left <= 0) this.stopLoop(id);
    }
  }

  // ---------------------------------------------------------------- Per frame

  /** Dipanggil tiap frame dengan dt mentah. Mengatur crossfade musik, ducking, dan jeda. */
  update(dt: number, view: AudioView) {
    this.now += dt;
    this.dt = dt;
    this.lastView = view;
    const live = view.state === 'playing';
    if (live !== this.live) {
      this.live = live;
      for (const l of this.loops.values()) {
        if (live) l.snd.resume();
        else l.snd.pause();
      }
    }

    this.duckLeft = Math.max(0, this.duckLeft - dt);
    if (this.duckLeft <= 0) this.duckDepth = 0;
    const duckGoal = 1 - this.duckDepth;
    const pauseGoal = view.state === 'levelup' || view.state === 'paused' ? AUDIO.pauseDuck : 1;
    const goal = Math.min(duckGoal, pauseGoal);
    this.duckGain += (goal - this.duckGain) * Math.min(1, dt / AUDIO.duckFade);

    if (view.state === 'playing') for (const id of tracksNeeded(view.runTime, SPAWN.bosses)) this.request(id);
    this.follow(this.music, musicTrackAt(view.state, view.runTime, view.boss), this.musicVolume);
    this.follow(this.ambient, ambientAt(view.state, view.runTime), this.musicVolume * AUDIO.ambientVolume);

    // Volume loop ikut penggeser efek suara
    for (const l of this.loops.values()) setVol(l.snd, l.vol * this.sfxVolume);
  }

  // ---------------------------------------------------------------- Musik dan suasana

  private follow(ch: Channel, want: SoundId | null, volume: number) {
    if (want !== (ch.current?.id ?? null)) this.switchTo(ch, want);
    else if (ch.current && !ch.current.restarted) {
      // Trek bukan loop: menjelang akhir, mulai lagi dari awal dengan crossfade
      const t = ch.current.snd as Timed;
      if (shouldRestart(t.seek, t.duration, AUDIO.crossfade)) {
        ch.current.restarted = true;
        this.switchTo(ch, want);
      }
    }
    const step = 1 / AUDIO.crossfade;
    for (let i = ch.layers.length - 1; i >= 0; i--) {
      const l = ch.layers[i];
      l.level += Math.sign(l.goal - l.level) * Math.min(Math.abs(l.goal - l.level), step * this.dt);
      if (l.goal === 0 && l.level <= 0) {
        this.dispose(l);
        ch.layers.splice(i, 1);
        continue;
      }
      setVol(l.snd, l.level * l.gain * volume * this.duckGain);
    }
  }

  private switchTo(ch: Channel, want: SoundId | null) {
    if (want) {
      const clip = CLIPS.get(want)?.find(Boolean);
      if (!clip) return; // tidak ada file: biarkan trek lama
      if (!this.scene.cache.audio.exists(clip.key)) {
        this.request(want); // masih dimuat: trek lama tetap berbunyi
        return;
      }
    }
    for (const l of ch.layers) l.goal = 0;
    ch.current = null;
    if (!want) return;
    const clip = CLIPS.get(want)!.find(Boolean)!;
    const snd = this.scene.sound.add(clip.key, { loop: false, volume: 0 });
    if (!snd.play()) {
      snd.destroy();
      return;
    }
    const layer: Layer = { id: want, snd, level: 0, goal: 1, gain: spec(want).vol ?? 1, restarted: false };
    ch.layers.push(layer);
    ch.current = layer;
  }

  /** Menghentikan trek dan membuang hasil decode-nya dari memori, kecuali masih dibutuhkan. */
  private dispose(l: Layer) {
    l.snd.stop();
    l.snd.destroy();
    const key = CLIPS.get(l.id)?.find(Boolean)?.key;
    const keep = tracksNeeded(this.lastView.runTime, SPAWN.bosses);
    const inUse = this.music.current?.id === l.id || this.ambient.current?.id === l.id;
    if (key && !inUse && !(this.lastView.state !== 'menu' && keep.includes(l.id))) {
      this.scene.cache.audio.remove(key);
      this.requested.delete(l.id);
    }
  }

  private request(id: SoundId) {
    if (this.requested.has(id)) return;
    const clip = CLIPS.get(id)?.find(Boolean);
    if (!clip) return;
    this.requested.add(id);
    if (!this.scene.cache.audio.exists(clip.key)) {
      this.queue(clip);
      this.startLoader();
    }
  }

  // ---------------------------------------------------------------- Panel uji dengar

  private previewing: Sound | null = null;

  /**
   * Untuk panel `?debug&soundtest`: memutar satu suara apa adanya, tanpa batas laju dan penjaga ronde.
   * `seam` memutar 5 detik terakhir sebuah trek lalu 5 detik pertamanya, supaya sambungan loop terdengar.
   */
  preview(id: SoundId, seam = false) {
    const clip = CLIPS.get(id)?.find(Boolean);
    if (!clip) return false;
    this.previewing?.stop();
    this.previewing?.destroy();
    this.previewing = null;
    const go = () => {
      const loop = isStreamed(id) || seam;
      const snd = this.scene.sound.add(clip.key, { loop, volume: (isStreamed(id) ? this.musicVolume : this.sfxVolume) * (spec(id).vol ?? 1) });
      this.previewing = snd;
      if (!snd.play()) return;
      if (seam) snd.setSeek(Math.max(0, (snd as Sound & { duration: number }).duration - 5));
    };
    if (this.scene.cache.audio.exists(clip.key)) go();
    else {
      this.scene.load.once(`filecomplete-audio-${clip.key}`, go);
      this.queue(clip);
      this.startLoader();
    }
    return true;
  }

  // ---------------------------------------------------------------- Pemuatan

  private queue(c: Clip) {
    const load = this.scene.load;
    if (this.scene.cache.audio.exists(c.key)) return;
    load.audio(c.key, c.url);
  }

  private startLoader() {
    const load = this.scene.load;
    if (!load.isLoading() && load.list.size > 0) load.start();
  }

  // ---------------------------------------------------------------- Memutar

  private play(id: SoundId, x?: number, y?: number, volume = 1) {
    const s = spec(id);
    const clips = CLIPS.get(id);
    if (!clips) return;
    if (this.active >= this.maxVoices) return;
    if (!this.limiter.allow(s.group ?? id, s.rate, this.now)) return;

    const last = this.lastVariant.get(id) ?? -1;
    const n = clips.filter(Boolean).length;
    const idx = pickVariant(n, last);
    this.lastVariant.set(id, idx);
    const clip = clips.filter(Boolean)[idx];
    if (!this.scene.cache.audio.exists(clip.key)) return;

    let gain = 1;
    let pan = 0;
    if (x !== undefined && y !== undefined && !s.flat) {
      const v = this.lastView;
      gain = gainForDistance(Math.hypot(x - v.x, y - v.y));
      if (gain <= 0.01) return;
      pan = panFor(x - v.x, v.halfView);
    }
    const snd = this.voice(clip.key);
    if (!snd) return;
    const jitter = 1 + (Math.random() * 2 - 1) * AUDIO.pitchJitter;
    if (snd.play({ volume: (s.vol ?? 1) * volume * gain * this.sfxVolume, rate: jitter, pan })) this.active++;
  }

  private voice(key: string): Sound | null {
    let list = this.pool.get(key);
    if (!list) this.pool.set(key, (list = []));
    for (const s of list) if (!s.isPlaying && !s.isPaused) return s;
    if (list.length >= AUDIO.poolPerKey) return null;
    const s = this.scene.sound.add(key);
    s.on('complete', this.free);
    s.on('stop', this.free);
    list.push(s);
    return s;
  }
}
