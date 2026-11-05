// Hanya bagian Phaser yang dipanggil logika murni saat diuji di Node.
export const Math = {
  Clamp: (v: number, min: number, max: number) => globalThis.Math.max(min, globalThis.Math.min(max, v)),
};
