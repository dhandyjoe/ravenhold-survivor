#!/usr/bin/env bash
# Menyeragamkan kerasnya dan format semua audio di folder masukan, lalu menulis mp3 ke src/audio/files/<kategori>/.
# Pemakaian: scripts/normalize-audio.sh <folder-masukan> <kategori>
#   kategori: music | ambient | stinger | weapon | special | enemy | hero | pickup | ui
# Nama file masukan harus sudah berupa id katalog (mis. bow_shot_1.wav, mus_menu.flac).
# Butuh ffmpeg (brew install ffmpeg).
set -euo pipefail

in="${1:?folder masukan}"
cat="${2:?kategori}"
out="src/audio/files/$cat"
mkdir -p "$out"

# Musik dan suasana stereo; efek suara mono. Target kekerasan: musik -18 LUFS, efek -16 LUFS.
case "$cat" in
  music|ambient) ch=2; lufs=-18; br=112k ;;
  stinger)       ch=2; lufs=-16; br=112k ;;
  *)             ch=1; lufs=-16; br=96k ;;
esac

for f in "$in"/*; do
  name="$(basename "${f%.*}")"
  ffmpeg -y -loglevel error -i "$f" -ac "$ch" -ar 44100 \
    -af "loudnorm=I=$lufs:TP=-1.5:LRA=11" -codec:a libmp3lame -b:a "$br" "$out/$name.mp3"
  echo "$out/$name.mp3"
done
