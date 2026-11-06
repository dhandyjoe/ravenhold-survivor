# Kredit audio

Setiap file di folder ini wajib tercatat di sini sebelum build rilis: siapa penciptanya, dari mana, dan lisensinya.
Hanya karya manusia yang boleh masuk; musik dan suara dari generator AI tidak dipakai di proyek ini.

Nama file: `<id>.mp3` atau `<id>.m4a` atau `<id>_<nomor>.mp3` untuk variasi. Daftar id ada di `src/audioCatalog.ts`.
Letakkan di subfolder kategori (`music/`, `weapon/`, dan seterusnya). Gunakan `scripts/normalize-audio.sh` untuk menyeragamkan kerasnya.

| File | Judul asli | Pencipta | Sumber (URL) | Lisensi | Wajib kredit? |
|---|---|---|---|---|---|
| music/mus_menu.m4a | "Angevin" (Menu utama) | Kevin MacLeod | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Ya |
| music/mus_pagi.m4a | "Village Consort" (Pagi) | Kevin MacLeod | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Ya |
| music/mus_senja.m4a | "Lord of the Land" (Senja) | Kevin MacLeod | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Ya |
| music/mus_malam.m4a | "Heavy Heart" (Malam) | Kevin MacLeod | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Ya |
| music/mus_bos_ksatria.m4a | "Unholy Knight" (Bos: Ksatria Terkutuk) | Kevin MacLeod | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Ya |
| music/mus_bos_naga.m4a | "Death and Axes" (Bos: Naga Bara) | Kevin MacLeod | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Ya |

Teks atribusi (format yang dianjurkan komposernya; wajib ditampilkan di game dan README):

> "Angevin", "Village Consort", "Lord of the Land", "Heavy Heart", "Unholy Knight", "Death and Axes"
> Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

Pengolahan: file asli MP3 256–320 kbps diubah ke AAC 96 kbps dengan `afconvert` (hanya pengecilan); `mus_senja` dinaikkan 2 dB.
Tidak ada pemotongan atau pengubahan musik. Trek menyambung dirinya sendiri dengan crossfade di kode (`src/audio.ts`).
Pilihan trek ini berdasarkan deskripsi katalog (instrumen dan suasana), belum diputuskan lewat uji dengar; ganti bila terasa kurang pas.

## Efek suara (semua CC0, tanpa kewajiban kredit; dicatat agar asal-usulnya jelas)

Paket sumber, semuanya berlisensi CC0 (Public Domain) menurut halaman masing-masing:

| Paket | Pencipta | Sumber |
|---|---|---|
| 25 CC0 bang / firework SFX | rubberduck | https://opengameart.org/content/25-cc0-bang-firework-sfx |
| 80 CC0 creature SFX | rubberduck | https://opengameart.org/content/80-cc0-creature-sfx |
| Cure Magic | Someoneman | https://opengameart.org/content/cure-magic |
| Death sounds | Exewin | https://opengameart.org/content/death-sounds-0 |
| Fireplace Sound loop | PagDev | https://opengameart.org/content/fireplace-sound-loop |
| 50 RPG sound effects | Kenney | https://opengameart.org/content/50-rpg-sound-effects |
| Magic Spell SFX | JaggedStone | https://opengameart.org/content/magic-spell-sfx |
| 100 CC0 metal and wood SFX | rubberduck | https://opengameart.org/content/100-cc0-metal-and-wood-sfx |
| 80 CC0 RPG SFX | rubberduck | https://opengameart.org/content/80-cc0-rpg-sfx |
| 100 CC0 SFX #2 | rubberduck | https://opengameart.org/content/100-cc0-sfx-2 |
| Male Grunt/Yelling sounds (dipakai di bawah CC0) | HaelDB | https://opengameart.org/content/male-gruntyelling-sounds |

Pemetaan tiap file (id -> file asli). Dibangun dengan `node scripts/sfx-tool.mjs build scripts/sfx-manifest.json <folder-unduhan>`
(decode lewat Chrome, pangkas hening, setarakan RMS, AAC lewat `afconvert`). Pilihan ini berdasarkan nama dan jenis suara, belum diuji dengar:
ganti di `scripts/sfx-manifest.json` bila terasa kurang pas.

| File di game | Paket | File asli |
|---|---|---|
| weapon/bow_shot_1.m4a | 80 CC0 RPG SFX | blade_01.ogg |
| weapon/bow_shot_2.m4a | 100 CC0 SFX #2 | sfx100v2_air_03.ogg |
| weapon/bow_shot_3.m4a | 80 CC0 RPG SFX | blade_02.ogg |
| weapon/bow_multi_1.m4a | 80 CC0 RPG SFX | blade_03.ogg |
| weapon/bow_multi_2.m4a | 100 CC0 SFX #2 | sfx100v2_air_02.ogg |
| weapon/hit_flesh_1.m4a | 50 RPG sound effects | OGG/chop.ogg |
| weapon/hit_flesh_2.m4a | 50 RPG sound effects | OGG/knifeSlice2.ogg |
| weapon/hit_flesh_3.m4a | 100 CC0 SFX #2 | sfx100v2_hit_01.ogg |
| weapon/hit_bone_1.m4a | 100 CC0 metal and wood SFX | wood_hit_01.ogg |
| weapon/hit_bone_2.m4a | 100 CC0 metal and wood SFX | wood_hit_03.ogg |
| weapon/hit_bone_3.m4a | 80 CC0 RPG SFX | wood_03.ogg |
| weapon/hit_stone_1.m4a | 80 CC0 RPG SFX | stones_04.ogg |
| weapon/hit_stone_2.m4a | 80 CC0 RPG SFX | item_stone_03.ogg |
| weapon/hit_armor_1.m4a | 100 CC0 metal and wood SFX | metal_hit_01.ogg |
| weapon/hit_armor_2.m4a | 100 CC0 metal and wood SFX | metal_hit_03.ogg |
| weapon/hit_armor_3.m4a | 80 CC0 RPG SFX | metal_02.ogg |
| weapon/hit_scale_1.m4a | 100 CC0 SFX #2 | sfx100v2_hit_02.ogg |
| weapon/hit_scale_2.m4a | 100 CC0 metal and wood SFX | metal_hit_04.ogg |
| weapon/hit_crit_1.m4a | 100 CC0 metal and wood SFX | metal_hit_05.ogg |
| weapon/hit_crit_2.m4a | 100 CC0 SFX #2 | sfx100v2_glass_04.ogg |
| weapon/hit_execute.m4a | 50 RPG sound effects | OGG/chop.ogg |
| weapon/arrow_poison.m4a | 80 CC0 RPG SFX | creature_slime_01.ogg |
| weapon/arrow_frost_1.m4a | 100 CC0 SFX #2 | sfx100v2_glass_01.ogg |
| weapon/arrow_frost_2.m4a | 100 CC0 SFX #2 | sfx100v2_glass_06.ogg |
| weapon/arrow_explode_1.m4a | 25 CC0 bang / firework SFX | bang_02.ogg |
| weapon/arrow_explode_2.m4a | 25 CC0 bang / firework SFX | bang_08.ogg |
| weapon/arrow_explode_3.m4a | 25 CC0 bang / firework SFX | bang_05.ogg |
| weapon/arrow_bounce_1.m4a | 100 CC0 SFX #2 | sfx100v2_metal_hit_02.ogg |
| weapon/arrow_bounce_2.m4a | 80 CC0 RPG SFX | metal_01.ogg |
| weapon/sword_hit_1.m4a | 80 CC0 RPG SFX | metal_02.ogg |
| weapon/sword_hit_2.m4a | 80 CC0 RPG SFX | metal_03.ogg |
| weapon/sword_hit_3.m4a | 80 CC0 RPG SFX | blade_03.ogg |
| weapon/nova_cast_1.m4a | 80 CC0 RPG SFX | spell_01.ogg |
| weapon/nova_cast_2.m4a | 80 CC0 RPG SFX | spell_02.ogg |
| special/meteor_fall.m4a | 100 CC0 SFX #2 | sfx100v2_air_02.ogg |
| special/meteor_impact_1.m4a | 25 CC0 bang / firework SFX | bang_06.ogg |
| special/meteor_impact_2.m4a | 25 CC0 bang / firework SFX | cannon_02.ogg |
| special/meteor_burn.m4a | Fireplace Sound loop | fire.wav |
| special/rain_release.m4a | 100 CC0 SFX #2 | sfx100v2_air_01.ogg |
| special/rain_loop.m4a | 100 CC0 SFX #2 | sfx100v2_air_01.ogg |
| special/rain_thud_1.m4a | 100 CC0 metal and wood SFX | wood_hit_04.ogg |
| special/rain_thud_2.m4a | 100 CC0 metal and wood SFX | wood_hit_05.ogg |
| special/rain_thud_3.m4a | 80 CC0 RPG SFX | item_wood_02.ogg |
| special/thunder_crack_1.m4a | 25 CC0 bang / firework SFX | bang_03.ogg |
| special/thunder_crack_2.m4a | 25 CC0 bang / firework SFX | bang_07.ogg |
| special/thunder_crack_3.m4a | 25 CC0 bang / firework SFX | bang_09.ogg |
| special/thunder_crack_4.m4a | 100 CC0 SFX #2 | sfx100v2_thunder_01.ogg |
| special/thunder_rumble.m4a | 100 CC0 SFX #2 | sfx100v2_thunder_01.ogg |
| special/moon_slash_1.m4a | 80 CC0 RPG SFX | blade_01.ogg |
| special/moon_slash_2.m4a | 80 CC0 RPG SFX | blade_02.ogg |
| special/raven_peck_1.m4a | 80 CC0 RPG SFX | wood_01.ogg |
| special/raven_peck_2.m4a | 80 CC0 RPG SFX | wood_02.ogg |
| special/tornado_start.m4a | 100 CC0 SFX #2 | sfx100v2_air_02.ogg |
| special/tornado_loop.m4a | 100 CC0 SFX #2 | sfx100v2_air_01.ogg |
| special/flames_ignite.m4a | 80 CC0 RPG SFX | spell_fire_06.ogg |
| special/flames_loop.m4a | Fireplace Sound loop | fire.wav |
| special/holy_pulse_1.m4a | Cure Magic | Cure1.wav |
| special/holy_pulse_2.m4a | Cure Magic | Cure3.wav |
| special/frost_cast.m4a | Magic Spell SFX | magical_1_0.ogg |
| special/frost_shatter_1.m4a | 100 CC0 SFX #2 | sfx100v2_glass_02.ogg |
| special/frost_shatter_2.m4a | 100 CC0 SFX #2 | sfx100v2_glass_03.ogg |
| special/quake_start.m4a | 80 CC0 RPG SFX | stones_03.ogg |
| special/quake_rock_1.m4a | 80 CC0 RPG SFX | stones_01.ogg |
| special/quake_rock_2.m4a | 80 CC0 RPG SFX | stones_02.ogg |
| special/quake_rock_3.m4a | 80 CC0 RPG SFX | stones_04.ogg |
| enemy/die_goblin_1.m4a | 80 CC0 RPG SFX | creature_slime_01.ogg |
| enemy/die_goblin_2.m4a | 80 CC0 RPG SFX | creature_slime_03.ogg |
| enemy/die_goblin_3.m4a | 80 CC0 RPG SFX | creature_slime_04.ogg |
| enemy/die_bone_1.m4a | 100 CC0 metal and wood SFX | wood_falling_02.ogg |
| enemy/die_bone_2.m4a | 100 CC0 metal and wood SFX | wood_falling_03.ogg |
| enemy/die_bone_3.m4a | 100 CC0 metal and wood SFX | wood_falling_05.ogg |
| enemy/die_ogre_1.m4a | 80 CC0 creature SFX | troll_01.ogg |
| enemy/die_ogre_2.m4a | 80 CC0 creature SFX | troll_02.ogg |
| enemy/die_knight.m4a | 100 CC0 metal and wood SFX | metal_falling_02.ogg |
| enemy/die_dragon.m4a | 80 CC0 RPG SFX | creature_roar_02.ogg |
| hero/hero_hurt_1.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3grunt1.wav |
| hero/hero_hurt_2.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3grunt3.wav |
| hero/hero_hurt_3.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3grunt4.wav |
| hero/hero_hurt_4.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3grunt5.wav |
| hero/hero_dodge_1.m4a | 50 RPG sound effects | OGG/cloth1.ogg |
| hero/hero_dodge_2.m4a | 50 RPG sound effects | OGG/cloth2.ogg |
| hero/hero_death.m4a | Death sounds | exewinDeathSoundsPack/6.ogg |
| hero/hero_gasp.m4a | Death sounds | exewinDeathSoundsPack/3.ogg |
| hero/revive_phoenix.m4a | 80 CC0 RPG SFX | spell_fire_03.ogg |
| hero/hero_power_1.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3yell12.wav |
| hero/hero_power_2.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3yell15.wav |
| hero/hero_win.m4a | Male Grunt/Yelling sounds (dipakai di bawah CC0) | yelling sounds/3yell3.wav |
| hero/foot_grass_1.m4a | 50 RPG sound effects | OGG/footstep04.ogg |
| hero/foot_grass_2.m4a | 50 RPG sound effects | OGG/footstep05.ogg |
| hero/foot_grass_3.m4a | 50 RPG sound effects | OGG/footstep06.ogg |
| hero/foot_grass_4.m4a | 50 RPG sound effects | OGG/footstep09.ogg |
| pickup/gem_small.m4a | 80 CC0 RPG SFX | item_coins_01.ogg |
| pickup/gem_big.m4a | 80 CC0 RPG SFX | item_coins_03.ogg |
| ui/card_pick.m4a | 50 RPG sound effects | OGG/metalLatch.ogg |
| ui/card_pick_rare.m4a | 80 CC0 RPG SFX | item_gem_03.ogg |
| ui/card_pick_special.m4a | 80 CC0 RPG SFX | spell_01.ogg |
