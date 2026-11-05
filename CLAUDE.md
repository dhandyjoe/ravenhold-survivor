# Ravenhold Survivor — aturan proyek untuk Claude Code

Game survival ala Survivor.io untuk browser (desktop + mobile).
Bahasa UI dan komentar kode: Bahasa Indonesia.

## Stack
- Phaser 4 (WebGL), TypeScript strict, Vite.
- Dokumentasi Phaser 4 untuk AI ada di `node_modules/phaser/skills/`. **Baca skill yang relevan
  sebelum memakai API Phaser** (mis. `filters-and-postfx`, `particles`, `v3-to-v4-migration`).
  Jangan memakai API Phaser 3 yang sudah dihapus: `setTintFill`, `preFX/postFX`, `BitmapMask`,
  `Geom.Point`, pipeline. `Math.TAU` sekarang = 2π.

## Struktur
- `src/main.ts` — konfigurasi Phaser dan resize. `src/quality.ts` — ukuran canvas dan pengamat frame yang menurunkan kualitas otomatis.
- `src/config.ts` — **semua angka balancing dan warna**. Ubah di sini, jangan hardcode di scene.
- `src/balance.ts` — rumus murni: level efektif, populasi musuh, laju spawn, skala HP, kerusakan pusaka.
- `src/specials.ts` — senjata pusaka (level kelipatan 5). `src/fx.ts` — pool efek sekali pakai.
- `src/scenes/GameScene.ts` — loop utama: pemain, musuh, senjata, XP, level-up, state machine
  (`menu | playing | levelup | paused | over`).
- `src/upgrades.ts` — daftar upgrade (kartu level-up). Tambah upgrade baru di array `UPGRADES`, pusaka di `SPECIAL_UPGRADES`.
- `src/textures.ts` + `src/art/` — grafis prosedural (Canvas 2D). Monster di `art/monsters.ts`, efek di `art/fx.ts`. Kilatan terkena serangan memakai tint FILL.
- `src/ui.ts` + `index.html` + `src/style.css` — semua UI adalah HTML/CSS di atas canvas.
- `src/art/logo.svg` — lambang game. `src/art/favicon.svg` — versi sederhana untuk tab browser. PNG di sebelahnya dibuat dari SVG yang sama.
- `src/input.ts` — keyboard + joystick sentuh (DOM, bukan input Phaser).
- `src/spatial.ts` — spatial hash untuk cek tabrakan cepat.

## Aturan teknis
- Target 60 fps di HP kelas menengah dengan ±300 musuh.
- **Selalu pakai object pooling** untuk musuh, peluru, kristal, dan angka damage.
  Jangan `destroy()`/`add.image()` di dalam loop per-frame.
- Tabrakan memakai jarak lingkaran + `SpatialHash`, bukan Arcade Physics.
- Target 60 fps juga berlaku di layar Retina: ukur dengan `deviceScaleFactor: 2`, bukan hanya jendela kecil.
- Jangan menambah pass layar penuh (filter kamera) atau `backdrop-filter`. Vignette adalah lapisan CSS, bloom hanya menyala di layar kecil.
- Jangan membuat tekstur baru saat bermain: angka damage memakai BitmapText, bukan Text. `setDepth` hanya kalau nilainya berubah.
- Satu jenis musuh satu `depth` (`EnemySpec.depth`), supaya gambarnya dibatch.
- Semua timer gameplay memakai `this.clock` (berhenti saat jeda), bukan `Date.now()`.
- Gerakan selalu dikali `dt` (detik), dan `dt` dibatasi maks 50 ms.
- Jumlah dan kekuatan musuh mengikuti level efektif (`src/balance.ts`), jangan hanya waktu.
- Efek yang melukai atau bergerak dijalankan dengan `dt` dari loop utama (`FxPool`, `SpecialWeapons`), bukan tween, supaya ikut berhenti saat jeda.

## Aturan visual (gaya "modern, simple")
- Tanpa pixel art. Ilustrasi storybook: outline gelap hangat, shading lembut, medieval fantasy.
- Palet: kayu gelap dan perkamen untuk UI, aksen amber, mint untuk XP, emas untuk hal spesial. Tidak ada biru di UI (dijaga `tests/unit/style.test.ts`).
  Warna baru harus ditambahkan ke `COLORS` di `config.ts` dan token di `style.css`.
- UI baru dibuat di HTML/CSS (panel kayu padat, font Unbounded untuk angka/judul, Cinzel untuk judul medieval, Manrope untuk teks).
  Jangan menggambar UI/menu dengan Phaser Text.
- Animasi UI singkat (≤ 350 ms) dan hormati `prefers-reduced-motion`.
- Efek berat bisa dimatikan (toggle "Efek cahaya"); fitur visual berat harus ikut toggle ini dan `QUALITY` di `config.ts`.

## Perintah
- `npm run dev` — server pengembangan (bisa dibuka dari HP di jaringan yang sama).
- `npm run typecheck` — wajib lolos sebelum selesai (mencakup kode test).
- `npm test` — unit test logika, termasuk penjaga angka balancing di `tests/unit/balance.test.ts`.
- `npm run test:e2e` — game sungguhan di Chrome: shader, lampu, dan alur main. Wajib lolos untuk perubahan visual.
- `npm run build` — build untuk hosting di `dist/`.
- `npm run build:single` — satu file HTML di `dist-single/`.
- Buka `?debug` untuk mengakses `window.__game` dari console.
  Contoh: `__game.scene.getScene('game').runTime = 290` untuk loncat ke menit ke-5.
