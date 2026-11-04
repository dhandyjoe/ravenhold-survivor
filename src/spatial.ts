/**
 * Spatial hash sederhana: membagi dunia jadi sel kotak, supaya cek tabrakan
 * hanya dilakukan dengan musuh di sel terdekat (bukan semua musuh).
 * Penting untuk performa saat ada ratusan musuh di layar HP.
 */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  private spare: number[][] = [];

  constructor(public readonly cellSize = 64) {}

  private key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear() {
    for (const arr of this.cells.values()) {
      arr.length = 0;
      this.spare.push(arr);
    }
    this.cells.clear();
  }

  insert(id: number, x: number, y: number) {
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    let arr = this.cells.get(k);
    if (!arr) {
      arr = this.spare.pop() ?? [];
      this.cells.set(k, arr);
    }
    arr.push(id);
  }

  /** Memanggil fn(id) untuk setiap item di sel yang bersinggungan dengan lingkaran (x, y, r). */
  query(x: number, y: number, r: number, fn: (id: number) => void) {
    const s = this.cellSize;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) fn(arr[i]);
      }
    }
  }
}
