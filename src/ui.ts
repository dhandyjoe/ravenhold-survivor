import type { Upgrade } from './upgrades';

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

  showLevelUp(level: number, choices: Upgrade[], levels: Record<string, number>, onPick: (u: Upgrade) => void) {
    $('levelup-title').textContent = `Level ${level}`;
    this.cards.innerHTML = '';
    choices.forEach((u, i) => {
      const cur = levels[u.id] ?? 0;
      const next = cur + 1;
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.type = 'button';
      btn.style.setProperty('--i', String(i));
      const pips =
        u.max < 50
          ? `<div class="pips" aria-label="Level ${next} dari ${u.max}">${Array.from({ length: u.max }, (_, p) => `<i class="${p < next ? 'on' : ''}"></i>`).join('')}</div>`
          : '';
      btn.innerHTML = `
        <div class="card-icon">${u.icon}</div>
        <div class="card-body">
          <div class="card-top"><span class="card-tag">${cur === 0 ? 'Baru' : u.tag}</span>${pips}</div>
          <div class="card-name">${u.name}</div>
          <div class="card-desc">${u.desc(next)}</div>
        </div>
        <kbd class="card-key">${i + 1}</kbd>`;
      btn.addEventListener('click', () => {
        window.removeEventListener('keydown', keyHandler);
        onPick(u);
      });
      this.cards.appendChild(btn);
    });
    const keyHandler = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) {
        window.removeEventListener('keydown', keyHandler);
        onPick(choices[n - 1]);
      }
    };
    window.addEventListener('keydown', keyHandler);
    this.show('levelup');
    (this.cards.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  }

  showEnd(win: boolean, stats: { time: number; kills: number; level: number }, newRecord: boolean) {
    $('end-eyebrow').textContent = win ? 'Anda bertahan' : 'Cahaya padam';
    $('end-title').textContent = win ? 'Menang!' : 'Game over';
    $('end-time').textContent = fmtTime(stats.time);
    $('end-kills').textContent = String(stats.kills);
    $('end-level').textContent = String(stats.level);
    $('end-record').hidden = !newRecord;
    this.screens.end.classList.toggle('win', win);
    this.show('end');
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
