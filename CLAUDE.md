# Lumen Survivor — aturan proyek untuk Claude Code

Game survival ala Survivor.io untuk browser (desktop + mobile).
Bahasa UI dan komentar kode: Bahasa Indonesia.

## Stack
- Phaser 4 (WebGL), TypeScript strict, Vite.
- Dokumentasi Phaser 4 untuk AI ada di `node_modules/phaser/skills/`. **Baca skill yang relevan
  sebelum memakai API Phaser** (mis. `filters-and-postfx`, `particles`, `v3-to-v4-migration`).
  Jangan memakai API Phaser 3 yang sudah dihapus: `setTintFill`, `preFX/postFX`, `BitmapMask`,
  `Geom.Point`, pipeline. `Math.TAU` sekarang = 2π.

## Struktur
- `src/main.ts` — konfigurasi Phaser, resolusi (devicePixelRatio maks 2), resize.
- `src/config.ts` — **semua angka balancing dan warna**. Ubah di sini, jangan hardcode di scene.
- `src/scenes/GameScene.ts` — loop utama: pemain, musuh, senjata, XP, level-up, state machine
  (`menu | playing | levelup | paused | over`).
- `src/upgrades.ts` — daftar upgrade (kartu level-up). Tambah upgrade baru di array `UPGRADES`.
- `src/textures.ts` — grafis prosedural (Canvas 2D). Setiap musuh punya versi `-hit` untuk kilatan.
- `src/ui.ts` + `index.html` + `src/style.css` — semua UI adalah HTML/CSS di atas canvas.
- `src/input.ts` — keyboard + joystick sentuh (DOM, bukan input Phaser).
- `src/spatial.ts` — spatial hash untuk cek tabrakan cepat.

## Aturan teknis
- Target 60 fps di HP kelas menengah dengan ±300 musuh.
- **Selalu pakai object pooling** untuk musuh, peluru, kristal, dan angka damage.
  Jangan `destroy()`/`add.image()` di dalam loop per-frame.
- Tabrakan memakai jarak lingkaran + `SpatialHash`, bukan Arcade Physics.
- Semua timer gameplay memakai `this.clock` (berhenti saat jeda), bukan `Date.now()`.
- Gerakan selalu dikali `dt` (detik), dan `dt` dibatasi maks 50 ms.

## Aturan visual (gaya "modern, simple")
- Tanpa pixel art. Bentuk geometris bersih, cahaya lembut (glow), latar gelap #0d0e1a.
- Palet terbatas: cyan pemain, coral/amber/violet musuh, mint XP, emas untuk hal spesial.
  Warna baru harus ditambahkan ke `COLORS` di `config.ts` dan token di `style.css`.
- UI baru dibuat di HTML/CSS (panel kaca, font Unbounded untuk angka/judul, Manrope untuk teks).
  Jangan menggambar UI/menu dengan Phaser Text.
- Animasi UI singkat (≤ 350 ms) dan hormati `prefers-reduced-motion`.
- Bloom bisa dimatikan (toggle "Efek cahaya"); fitur visual berat harus ikut toggle ini.

## Perintah
- `npm run dev` — server pengembangan (bisa dibuka dari HP di jaringan yang sama).
- `npm run typecheck` — wajib lolos sebelum selesai.
- `npm run build` — build untuk hosting di `dist/`.
- `npm run build:single` — satu file HTML di `dist-single/`.
- Buka `?debug` untuk mengakses `window.__game` dari console.
  Contoh: `__game.scene.getScene('game').runTime = 290` untuk loncat ke menit ke-5.
