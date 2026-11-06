# Ravenhold Survivor

Prototipe game survival ala Survivor.io: bertahan 15 menit melawan gerombolan musuh,
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

- 5 jenis musuh: Goblin Semak, Prajurit Tulang, Ogre Batu, serta bos Ksatria Terkutuk (menit 5) dan Naga Bara (menit 9,5).
- Jumlah dan kekuatan musuh mengikuti level pemain, dengan gelombang besar setiap 60 detik.
- 3 senjata: panah otomatis, pedang penjaga yang mengorbit, lingkar rune.
- 10 senjata pusaka, ditawarkan acak setiap level kelipatan 5, masing-masing tiga tingkat.
- 29 upgrade bertingkat (senjata dan perlengkapan) dengan kelangkaan Biasa, Langka, dan Epik.
- Level maksimum 50, kira-kira dicapai setelah 15 menit. Saat waktu habis, game kembali ke menu utama.
- Rekor tersimpan di browser (localStorage).
- Efek bloom yang mati otomatis kalau HP tidak kuat (bisa diatur manual).

## Kredit musik

Musik oleh Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License
(http://creativecommons.org/licenses/by/4.0/):

| Dipakai untuk | Trek |
|---|---|
| Menu utama | "Angevin" |
| Pagi | "Village Consort" |
| Senja | "Lord of the Land" |
| Malam | "Heavy Heart" |
| Bos: Ksatria Terkutuk | "Unholy Knight" |
| Bos: Naga Bara | "Death and Axes" |

Rincian lisensi semua file audio ada di `src/audio/files/CREDITS.md`.

## Test

```bash
npm test           # unit test logika (cepat, tanpa browser)
npm run test:e2e   # game sungguhan di Google Chrome: shader, lampu, alur main
npm run test:all   # keduanya
```

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
