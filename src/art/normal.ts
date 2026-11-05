/**
 * Membuat normal map dari sprite yang sudah dilukis, supaya lampu dinamis bisa
 * "membentuk" volume pada gambar 2D. Tinggi permukaan diperkirakan dari alpha
 * (tepi = rendah, tengah = tinggi, seperti bantal) ditambah sedikit luminance
 * (detail terang terasa menonjol).
 *
 * Blur dikerjakan manual di array, bukan `ctx.filter`, karena `ctx.filter`
 * tidak bisa diandalkan di Safari iOS.
 */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const out = new Float32Array(src.length);
  const norm = 1 / (r * 2 + 1);
  // Horizontal
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      out[row + x] = sum * norm;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  // Vertikal
  const res = new Float32Array(src.length);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += out[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      res[y * w + x] = sum * norm;
      sum += out[Math.min(h - 1, y + r + 1) * w + x] - out[Math.max(0, y - r) * w + x];
    }
  }
  return res;
}

export interface NormalOptions {
  /** Kekuatan relief. Lebih besar = bentuk lebih menonjol. */
  strength?: number;
  /** Radius blur alpha dalam piksel tekstur (seberapa "tebal" bantalnya). */
  pillow?: number;
  /** Porsi detail luminance terhadap tinggi (0..1). */
  detail?: number;
}

export function normalMapFrom(source: HTMLCanvasElement, opts: NormalOptions = {}) {
  const strength = opts.strength ?? 2.4;
  const pillow = opts.pillow ?? 5;
  const detail = opts.detail ?? 0.3;

  const w = source.width;
  const h = source.height;
  const data = source.getContext('2d')!.getImageData(0, 0, w, h).data;

  const alpha = new Float32Array(w * h);
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const a = data[p + 3] / 255;
    alpha[i] = a;
    luma[i] = a * ((data[p] * 0.3 + data[p + 1] * 0.59 + data[p + 2] * 0.11) / 255);
  }

  const soft = boxBlur(boxBlur(alpha, w, h, pillow), w, h, Math.max(1, pillow >> 1));
  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) height[i] = soft[i] * (1 - detail) + luma[i] * detail;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const out = img.data;
  const k = strength * 8;

  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w;
    const dn = Math.min(h - 1, y + 1) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const lf = Math.max(0, x - 1);
      const rt = Math.min(w - 1, x + 1);
      const p = (row + x) * 4;
      // Y-nya positif ke atas layar (konvensi GL), makanya tanda dx dan dy berbeda.
      let nx = -(height[row + rt] - height[row + lf]) * k;
      let ny = (height[dn + x] - height[up + x]) * k;
      let nz = 1;
      const len = 1 / Math.hypot(nx, ny, nz);
      nx *= len;
      ny *= len;
      nz *= len;
      out[p] = (nx * 0.5 + 0.5) * 255;
      out[p + 1] = (ny * 0.5 + 0.5) * 255;
      out[p + 2] = (nz * 0.5 + 0.5) * 255;
      out[p + 3] = 255; // alpha penuh agar warna normal tidak diubah premultiply
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
