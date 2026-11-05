import { MAX_LEVEL, RARITY, RUN_SECONDS } from './config';
import { ALL_UPGRADES, type Upgrade } from './upgrades';

/**
 * Semua UI (HUD, menu, kartu level-up) dibuat dengan HTML/CSS di atas canvas.
 * Hasilnya lebih tajam dan lebih mudah dibuat modern daripada UI yang digambar di dalam engine.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Screen = 'start' | 'levelup' | 'pause' | 'end' | null;

class UIController {
  private hud = $('hud');
  private xpFill = $('xp-fill');
  private lvl = $('lvl');
  private timer = $('timer');
  private kills = $('kills');
  private hurt = $('hurt');
  private toastEl = $('toast');
  private screens = {
    start: $('screen-start'),
    levelup: $('screen-levelup'),
    pause: $('screen-pause'),
    end: $('screen-end'),
  };
  private cards = $('cards');
  private loadout = $('loadout');
  private levelupPanel = $('levelup-panel');
  private bossBar = $('boss-bar');
  private bossName = $('boss-name');
  private bossFill = $('boss-fill');
  private specialSlots = $('specials');
  private redirectTimer = 0;
  private toastTimer = 0;
  private last = { time: -1, kills: -1, level: -1, xp: -1 };

  onStart = () => {};
  onResume = () => {};
  onRestart = () => {};
  onMenu = () => {};
  onPauseRequest = () => {};
  onGlowChange = (_on: boolean) => {};

  constructor() {
    $('btn-start').addEventListener('click', () => this.onStart());
    $('btn-resume').addEventListener('click', () => this.onResume());
    $('btn-restart').addEventListener('click', () => this.onRestart());
    $('btn-quit').addEventListener('click', () => this.onMenu());
    $('btn-again').addEventListener('click', () => this.onRestart());
    $('btn-menu').addEventListener('click', () => this.onMenu());
    $('pause-btn').addEventListener('click', () => this.onPauseRequest());
    for (const id of ['opt-glow', 'opt-glow-2']) {
      $<HTMLInputElement>(id).addEventListener('change', (e) => {
        const on = (e.target as HTMLInputElement).checked;
        this.setGlowToggle(on);
        this.onGlowChange(on);
      });
    }
    $('start-eyebrow').textContent = `Survival · ${RUN_SECONDS / 60} menit · Level maks ${MAX_LEVEL}`;
    $('lvl-max').textContent = `/${MAX_LEVEL}`;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    $('controls-hint').textContent = touch
      ? 'Sentuh dan geser di mana saja untuk bergerak. Senjata menembak otomatis.'
      : 'Gerak dengan WASD atau tombol panah. Senjata menembak otomatis. Esc untuk jeda.';
  }

  setGlowToggle(on: boolean) {
    $<HTMLInputElement>('opt-glow').checked = on;
    $<HTMLInputElement>('opt-glow-2').checked = on;
  }

  show(screen: Screen) {
    this.cancelRedirect();
    for (const [k, el] of Object.entries(this.screens)) el.hidden = k !== screen;
    const focus = screen && this.screens[screen].querySelector<HTMLElement>('[data-autofocus]');
    focus?.focus({ preventScroll: true });
  }

  showHud(on: boolean) {
    this.hud.hidden = !on;
  }

  showStart(best: { time: number; kills: number; level: number }) {
    const el = $('best');
    el.hidden = best.time <= 0;
    el.innerHTML = `Rekor: <b>${fmtTime(best.time)}</b> · ${best.kills} musuh · level ${best.level}`;
    this.show('start');
  }

  updateHud(time: number, kills: number, level: number, xpFrac: number) {
    const t = Math.floor(time);
    if (t !== this.last.time) {
      this.timer.textContent = fmtTime(t);
      this.last.time = t;
    }
    if (kills !== this.last.kills) {
      this.kills.textContent = String(kills);
      this.last.kills = kills;
    }
    if (level !== this.last.level) {
      this.lvl.textContent = String(level);
      this.last.level = level;
    }
    const xp = Math.round(xpFrac * 1000) / 1000;
    if (xp !== this.last.xp) {
      this.xpFill.style.transform = `scaleX(${xp})`;
      this.last.xp = xp;
    }
  }

  resetHud() {
    this.last = { time: -1, kills: -1, level: -1, xp: -1 };
  }

  showLevelUp(level: number, choices: Upgrade[], levels: Record<string, number>, onPick: (u: Upgrade) => void, special = false) {
    this.levelupPanel.classList.toggle('special', special);
    $('levelup-eyebrow').textContent = special ? 'Pusaka terbuka' : 'Naik level';
    $('levelup-title').textContent = `Level ${level}`;
    $('levelup-sub').textContent = special ? 'Senjata dahsyat yang menyapu seluruh gelombang. Pilih satu.' : 'Pilih satu kekuatan';
    this.cards.innerHTML = '';
    let picked = false;
    const pick = (u: Upgrade) => {
      if (picked) return;
      picked = true;
      window.removeEventListener('keydown', keyHandler);
      onPick(u);
    };
    choices.forEach((u, i) => {
      const cur = levels[u.id] ?? 0;
      const btn = document.createElement('button');
      btn.className = `card tag-${u.tag.toLowerCase()} rarity-${u.rarity}`;
      btn.type = 'button';
      btn.style.setProperty('--i', String(i));
      btn.innerHTML = this.cardHtml(u, cur, i);
      btn.addEventListener('click', () => pick(u));
      this.cards.appendChild(btn);
    });
    const keyHandler = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) pick(choices[n - 1]);
    };
    window.addEventListener('keydown', keyHandler);
    this.renderLoadout(levels);
    this.show('levelup');
    (this.cards.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private cardHtml(u: Upgrade, cur: number, index: number) {
    const next = cur + 1;
    const isNew = cur === 0;
    const pips =
      u.max < 50
        ? `<div class="pips" aria-label="Tingkat ${next} dari ${u.max}">${Array.from({ length: u.max }, (_, p) => `<i class="${p < cur ? 'on' : p === cur ? 'next' : ''}"></i>`).join('')}</div>`
        : '';
    const stats = u
      .stats(next)
      .map((s) => `<li><span>${s.label}</span><b>${isNew ? '' : `<s>${s.from}</s><em aria-hidden="true">›</em>`}${s.to}</b></li>`)
      .join('');
    return `
      <div class="card-head">
        <div class="card-crest">${u.icon}</div>
        <div class="card-title">
          <div class="card-tag">${u.tag}${u.rarity !== 'common' && u.tag !== 'Pusaka' ? `<span class="card-rarity">${RARITY[u.rarity].label}</span>` : ''}${isNew ? '<span class="card-new">Baru</span>' : ''}</div>
          <div class="card-name">${u.name}</div>
        </div>
      </div>
      <div class="card-desc">${u.desc(next)}</div>
      ${stats ? `<ul class="card-stats">${stats}</ul>` : ''}
      <div class="card-foot">${pips}<kbd class="card-key">${index + 1}</kbd></div>`;
  }

  /** Perlengkapan yang sudah dimiliki, supaya pilihan bisa dipertimbangkan terhadap bangunan saat ini. */
  private renderLoadout(levels: Record<string, number>) {
    const owned = ALL_UPGRADES.filter((u) => (levels[u.id] ?? 0) > 0);
    this.loadout.hidden = owned.length === 0;
    this.loadout.innerHTML = owned
      .map((u) => `<div class="gear tag-${u.tag.toLowerCase()}" title="${u.name}">${u.icon}<b>${levels[u.id]}</b></div>`)
      .join('');
  }

  setSpecialSlots(slots: { id: string; icon: string; tier: number }[]) {
    this.specialSlots.hidden = slots.length === 0;
    this.specialSlots.innerHTML = slots
      .map((s) => `<div class="special-slot" data-id="${s.id}">${s.icon}<b>${['I', 'II', 'III'][s.tier - 1]}</b></div>`)
      .join('');
  }

  /** Mengisi lingkar jeda pusaka. `ready` 1 berarti siap. */
  setSpecialReady(id: string, ready: number) {
    const el = this.specialSlots.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!el) return;
    el.style.setProperty('--ready', ready.toFixed(2));
    el.classList.toggle('ready', ready >= 1);
  }

  setBoss(name: string | null) {
    this.bossBar.hidden = name === null;
    if (name !== null) {
      this.bossName.textContent = name;
      this.setBossHp(1);
    }
  }

  setBossHp(frac: number) {
    this.bossFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
  }

  /** `redirectSeconds` di atas 0 menampilkan hitung mundur, lalu otomatis kembali ke menu utama. */
  showEnd(win: boolean, stats: { time: number; kills: number; level: number }, newRecord: boolean, redirectSeconds = 0) {
    $('end-eyebrow').textContent = win ? `Waktu ${RUN_SECONDS / 60} menit habis` : 'Perjalanan berakhir';
    $('end-title').textContent = win ? 'Game selesai!' : 'Game over';
    $('end-time').textContent = fmtTime(stats.time);
    $('end-kills').textContent = String(stats.kills);
    $('end-level').textContent = String(stats.level);
    $('end-record').hidden = !newRecord;
    this.screens.end.classList.toggle('win', win);
    this.show('end');
    this.startRedirect(redirectSeconds);
  }

  private startRedirect(seconds: number) {
    const note = $('end-redirect');
    note.hidden = seconds <= 0;
    if (seconds <= 0) return;
    let left = seconds;
    const count = $('end-redirect-count');
    count.textContent = String(left);
    this.redirectTimer = window.setInterval(() => {
      left--;
      count.textContent = String(left);
      if (left <= 0) {
        this.cancelRedirect();
        this.onMenu();
      }
    }, 1000);
  }

  private cancelRedirect() {
    clearInterval(this.redirectTimer);
    this.redirectTimer = 0;
  }

  toast(text: string, tone: 'info' | 'danger' = 'info') {
    this.toastEl.textContent = text;
    this.toastEl.className = `show ${tone}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.className = ''), 2400);
  }

  hurtFlash() {
    this.hurt.classList.remove('flash');
    void this.hurt.offsetWidth;
    this.hurt.classList.add('flash');
  }
}

export const ui = new UIController();
