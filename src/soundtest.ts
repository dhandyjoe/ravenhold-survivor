import { clipCount } from './audio';
import { CATALOG, SOUND_IDS, spec, type SoundId } from './audioCatalog';
import type { GameAudio } from './audio';

/**
 * Panel uji dengar, hanya dimuat lewat `?debug&soundtest`. Menampilkan semua suara di `audioCatalog.ts`,
 * mana yang filenya sudah ada, dan memutarnya satu per satu. Untuk trek musik ada tombol "sambungan"
 * yang memutar akhir lalu awal trek, supaya loop yang kasar langsung terdengar.
 */
const CATS: Record<string, string> = {
  music: 'Musik',
  ambient: 'Suasana',
  stinger: 'Stinger',
  weapon: 'Senjata',
  special: 'Pusaka',
  enemy: 'Musuh',
  hero: 'Karakter utama',
  pickup: 'Kristal',
  ui: 'Antarmuka',
};

function audioOf(): GameAudio | null {
  const game = (window as unknown as { __game?: { scene: { getScene(k: string): { audio?: GameAudio } | null } } }).__game;
  return game?.scene.getScene('game')?.audio ?? null;
}

function build(audio: GameAudio) {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;right:8px;top:8px;bottom:8px;width:min(380px,92vw);z-index:99;overflow:auto;background:#1e140c;color:#f5e9cf;font:12px/1.4 monospace;border:1px solid #9c7338;border-radius:8px;padding:8px';
  const have = SOUND_IDS.filter((id) => clipCount(id) > 0).length;
  const p1 = SOUND_IDS.filter((id) => CATALOG[id].pri === 1);
  const p1Have = p1.filter((id) => clipCount(id) > 0).length;
  root.innerHTML = `<b>Uji dengar</b> · ${have}/${SOUND_IDS.length} jenis ada · P1 ${p1Have}/${p1.length}
    <button id="st-close" style="float:right">tutup</button>`;
  for (const [cat, label] of Object.entries(CATS)) {
    const ids = SOUND_IDS.filter((id) => spec(id).cat === cat);
    const h = document.createElement('div');
    h.style.cssText = 'margin:10px 0 3px;color:#e8b558;font-weight:bold';
    h.textContent = label;
    root.append(h);
    for (const id of ids) root.append(row(audio, id));
  }
  root.querySelector('#st-close')!.addEventListener('click', () => root.remove());
  document.body.append(root);
}

function row(audio: GameAudio, id: SoundId) {
  const s = spec(id);
  const n = clipCount(id);
  const r = document.createElement('div');
  r.style.cssText = `display:flex;gap:6px;align-items:center;opacity:${n ? 1 : 0.45}`;
  const name = document.createElement('span');
  name.style.flex = '1';
  name.textContent = `${id}  ${n}/${s.files}  P${s.pri}`;
  r.append(name);
  if (n) {
    const play = document.createElement('button');
    play.textContent = '▶';
    play.addEventListener('click', () => audio.preview(id));
    r.append(play);
    if (s.cat === 'music' || s.cat === 'ambient') {
      const seam = document.createElement('button');
      seam.textContent = 'sambungan';
      seam.addEventListener('click', () => audio.preview(id, true));
      r.append(seam);
    }
  }
  return r;
}

const wait = window.setInterval(() => {
  const audio = audioOf();
  if (!audio) return;
  clearInterval(wait);
  build(audio);
}, 200);
