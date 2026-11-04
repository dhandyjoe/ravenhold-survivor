# Lumen Survivor

Prototipe game survival ala Survivor.io: bertahan 10 menit melawan gerombolan musuh,
kumpulkan kristal XP, lalu pilih kekuatan baru setiap naik level.
Jalan di browser desktop dan mobile.

**Stack:** Phaser 4 · TypeScript · Vite. Tanpa file gambar: semua grafis dibuat lewat kode.

## Menjalankan

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal. Untuk mencoba di HP, pakai alamat "Network"
(HP dan komputer harus di Wi-Fi yang sama).

## Kontrol

| Perangkat | Gerak | Jeda |
|---|---|---|
| Desktop | WASD / tombol panah | Esc atau P |
| HP / tablet | Sentuh dan geser di mana saja (joystick melayang) | Tombol ⏸ |

Saat naik level, pilih kartu dengan klik/sentuh, atau tombol 1–3.

## Isi prototipe

- 4 jenis musuh: segitiga cepat, kotak, heksagon tebal, dan bos bintang (menit 5 dan 9).
- Gelombang besar setiap 60 detik.
- 3 senjata: peluru otomatis, satelit yang mengorbit, gelombang nova.
- 10 upgrade (5 senjata, 5 pasif), masing-masing bertingkat.
- Rekor tersimpan di browser (localStorage).
- Efek bloom yang mati otomatis kalau HP tidak kuat (bisa diatur manual).

## Build & hosting

```bash
npm run build          # hasil di dist/  → upload ke Netlify, Vercel, GitHub Pages, atau itch.io
npm run build:single   # satu file dist-single/index.html (mudah dibagikan)
```

## Ide langkah berikutnya (minta ke Claude Code)

1. Efek suara dan musik (WebAudio, dengan tombol mute).
2. Upgrade permanen di antara ronde (koin → HP awal, damage awal).
3. Evolusi senjata: kombinasi dua upgrade maksimal jadi senjata baru.
4. Peti hadiah dari bos.
5. PWA (`vite-plugin-pwa`) supaya bisa diinstal di layar utama HP.
6. Mengganti grafis prosedural dengan sprite buatan sendiri (lihat komentar di `src/textures.ts`).
