import * as Phaser from 'phaser';
import { normalMapFrom, type NormalOptions } from './normal';

/**
 * Perkakas lukis prosedural: semua sprite digambar lewat Canvas 2D saat game dimuat.
 * Tekstur digambar lebih besar (`res`) lalu dikecilkan di game supaya tetap tajam di layar HP.
 */
export const TEX_SCALE = 2;

export type Ctx = CanvasRenderingContext2D;

export function rgba(hexColor: string, a: number) {
  const n = parseInt(hexColor.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Campur dua warna hex, hasilnya hex juga supaya bisa dicampur lagi. */
export function mix(a: string, b: string, t: number) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** RNG dengan seed tetap, supaya gambar prosedural selalu sama di setiap pemuatan. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Bentuk dasar

export function vgrad(ctx: Ctx, y0: number, y1: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

/** Anggota tubuh: garis tebal berujung bulat. */
export function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, width: number, color: string | CanvasGradient) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Poligon dari daftar titik [x, y, x, y, ...]. */
export function shape(ctx: Ctx, pts: number[], fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

export function softGlow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  oval(ctx, x, y, r, r, g);
}

// ---------------------------------------------------------------- Penyelesaian sprite

export interface FinishOptions {
  /** Warna outline. Kosongkan untuk tanpa outline. */
  outline?: string;
  /** Tebal outline dalam unit dunia. */
  outlineWidth?: number;
  /** Warna dan kekuatan rim light di sisi kiri-atas (arah datangnya cahaya utama). */
  rim?: string;
  rimAlpha?: number;
  /** Warna dan kekuatan bayangan bentuk di sisi kanan-bawah. */
  shade?: string;
  shadeAlpha?: number;
  /** Lebar sapuan rim dan bayangan, dalam unit dunia. */
  edge?: number;
}

const RING = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
];

function scratch(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Sapuan sabit di tepi siluet: bagian `layer` yang tidak tertutup salinannya sendiri setelah digeser. */
function edgeCrescent(ctx: Ctx, temp: HTMLCanvasElement, layer: HTMLCanvasElement, color: string, alpha: number, dx: number, dy: number) {
  const t = temp.getContext('2d')!;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, temp.width, temp.height);
  t.drawImage(layer, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, temp.width, temp.height);
  t.globalCompositeOperation = 'destination-out';
  t.drawImage(layer, dx, dy);
  t.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.drawImage(temp, 0, 0);
  ctx.globalAlpha = 1;
}

/**
 * Menyelesaikan satu lapisan lukisan: bayangan bentuk + rim light (agar tetap bervolume
 * walau lampu dinamis dimatikan), lalu outline di belakangnya.
 */
function finish(out: Ctx, layer: HTMLCanvasElement, temp: HTMLCanvasElement, res: number, o: FinishOptions) {
  const px = (o.outlineWidth ?? 0) * res;
  const edge = (o.edge ?? 1.2) * res;
  const lctx = layer.getContext('2d')!;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-atop';
  if (o.shade) edgeCrescent(lctx, temp, layer, o.shade, o.shadeAlpha ?? 0.35, -edge, -edge);
  if (o.rim) edgeCrescent(lctx, temp, layer, o.rim, o.rimAlpha ?? 0.45, edge * 0.7, edge * 0.7);
  lctx.globalCompositeOperation = 'source-over';

  if (o.outline && px > 0) {
    const t = temp.getContext('2d')!;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, temp.width, temp.height);
    for (const [dx, dy] of RING) t.drawImage(layer, dx * px, dy * px);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = o.outline;
    t.fillRect(0, 0, temp.width, temp.height);
    t.globalCompositeOperation = 'source-over';
    out.drawImage(temp, 0, 0);
  }
  out.drawImage(layer, 0, 0);
}

// ---------------------------------------------------------------- Baker atlas

export interface Strip {
  key: string;
  /** Frame siap pakai untuk `Image.setFrame(frame, false, false)`, tanpa alokasi saat runtime. */
  frames: Phaser.Textures.Frame[];
  /** Skala tampilan (kebalikan `res`). */
  scale: number;
}

export interface BakeSpec<F> {
  key: string;
  /** Ukuran satu frame dalam unit dunia. */
  w: number;
  h: number;
  res?: number;
  /** Daftar deskripsi frame; `draw` dipanggil sekali untuk tiap elemen. */
  frames: F[];
  draw: (ctx: Ctx, frame: F, index: number) => void;
  /** Frame yang digambar tercermin secara horizontal. */
  mirror?: (frame: F) => boolean;
  finish?: FinishOptions;
  /** Isi untuk membuat normal map (menjadikan sprite bisa diterangi). */
  normal?: NormalOptions;
}

/**
 * Melukis semua frame ke satu atlas. Phaser menangani rotasi normal map tetapi tidak `flipX`,
 * jadi arah kiri digambar sebagai frame tersendiri, bukan dengan membalik sprite saat runtime.
 */
export function bake<F>(scene: Phaser.Scene, spec: BakeSpec<F>): Strip {
  const res = spec.res ?? TEX_SCALE;
  const fw = Math.ceil(spec.w * res);
  const fh = Math.ceil(spec.h * res);
  const cols = Math.ceil(Math.sqrt(spec.frames.length));
  const rows = Math.ceil(spec.frames.length / cols);
  const atlas = scratch(cols * fw, rows * fh);
  const actx = atlas.getContext('2d', { willReadFrequently: !!spec.normal })!;
  const layer = scratch(fw, fh);
  const temp = scratch(fw, fh);
  const lctx = layer.getContext('2d')!;
  const combined = scratch(fw, fh);
  const cctx = combined.getContext('2d')!;

  spec.frames.forEach((frame, i) => {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, fw, fh);
    if (spec.mirror?.(frame)) lctx.setTransform(-res, 0, 0, res, fw, 0);
    else lctx.setTransform(res, 0, 0, res, 0, 0);
    spec.draw(lctx, frame, i);

    cctx.clearRect(0, 0, fw, fh);
    finish(cctx, layer, temp, res, spec.finish ?? {});
    actx.drawImage(combined, (i % cols) * fw, Math.floor(i / cols) * fh);
  });

  if (scene.textures.exists(spec.key)) scene.textures.remove(spec.key);
  const tex = scene.textures.addCanvas(spec.key, atlas)!;
  const frames: Phaser.Textures.Frame[] = [];
  spec.frames.forEach((_, i) => {
    frames.push(tex.add(String(i), 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh)!);
  });
  if (spec.normal) tex.setDataSource(normalMapFrom(atlas, spec.normal));
  return { key: spec.key, frames, scale: 1 / res };
}

/** Tekstur statis satu frame (efek, partikel), tanpa outline dan normal map. */
export function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void, res = TEX_SCALE) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = scratch(Math.ceil(w * res), Math.ceil(h * res));
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  draw(ctx);
  scene.textures.addCanvas(key, c);
}

/**
 * Tekstur berulang tanpa sambungan: `paint` dipanggil sembilan kali dengan offset
 * sehingga goresan yang keluar dari tepi muncul kembali di sisi seberang.
 * Ukurannya harus pangkat dua agar GPU memakai mode REPEAT.
 */
export function makeTile(scene: Phaser.Scene, key: string, size: number, paint: (ctx: Ctx, stamp: (fn: (ox: number, oy: number) => void) => void) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = scratch(size, size);
  const ctx = c.getContext('2d')!;
  const stamp = (fn: (ox: number, oy: number) => void) => {
    for (const oy of [-size, 0, size]) for (const ox of [-size, 0, size]) fn(ox, oy);
  };
  paint(ctx, stamp);
  scene.textures.addCanvas(key, c);
}
