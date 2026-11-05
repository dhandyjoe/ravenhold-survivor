import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit test berjalan di Node tanpa WebGL, jadi Phaser diganti stub kecil.
// E2E tidak memakai alias ini: game dijalankan oleh server Vite terpisah di browser sungguhan.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    alias: { phaser: fileURLToPath(new URL('./tests/unit/phaser-stub.ts', import.meta.url)) },
  },
});
