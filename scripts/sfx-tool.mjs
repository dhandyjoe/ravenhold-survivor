#!/usr/bin/env node
// Perkakas efek suara tanpa ffmpeg: decode lewat Chrome (Web Audio), olah, lalu kecilkan ke M4A dengan afconvert (macOS).
//
//   node scripts/sfx-tool.mjs analyze <folder>            tampilkan durasi, puncak, dan RMS tiap file
//   node scripts/sfx-tool.mjs build <manifest.json> [folder-sumber]   buat file M4A di src/audio/files/<kategori>/ (src relatif terhadap folder-sumber)
//
// Manifest: [{ "id": "bow_shot_1", "cat": "weapon", "src": "/jalur/file.ogg", "start": 0, "max": 1.2, "gain": 0, "rate": 1, "mono": true }]
//   start: detik awal yang dipakai; max: panjang maksimal (dipangkas dengan fade-out); gain: dB; rate: kecepatan putar (nada ikut berubah).
// Semua file dinormalkan ke RMS target per kategori agar kerasnya seragam, lalu `gain` ditambahkan di atasnya.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';

const [cmd, arg, rootArg] = process.argv.slice(2);
const AUDIO_EXT = /\.(wav|ogg|mp3|m4a|flac)$/i;
const OUT = resolve('src/audio/files');
const TARGET_RMS = -20; // dBFS, sebelum gain manifest

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : AUDIO_EXT.test(f) ? [p] : [];
  });
}

/** Dijalankan di dalam Chrome: decode, potong, ubah kecepatan, kembalikan sampel mono/stereo float. */
const IN_PAGE = async ({ b64, start, max, rate, mono }) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const ctx = new OfflineAudioContext(2, 44100, 44100);
  const buf = await ctx.decodeAudioData(bin);
  const sr = buf.sampleRate;
  const chans = mono ? 1 : buf.numberOfChannels;
  const data = [];
  for (let c = 0; c < chans; c++) data.push(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)));
  if (mono && buf.numberOfChannels > 1) {
    const m = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < m.length; i++) m[i] += d[i] / buf.numberOfChannels;
    }
    data[0] = m;
  }
  return { sr, chans, len: buf.length, ch: data.map((d) => Array.from(d)), dur: buf.duration };
};

async function withChrome(fn) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

function stats(ch) {
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (const d of ch) {
    for (const v of d) {
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      n++;
    }
  }
  return { peak: db(peak), rms: db(Math.sqrt(sum / Math.max(n, 1))) };
}

if (cmd === 'analyze') {
  const files = walk(resolve(arg)).sort();
  await withChrome(async (page) => {
    for (const f of files) {
      const b64 = readFileSync(f).toString('base64');
      try {
        const r = await page.evaluate(IN_PAGE, { b64, start: 0, max: 0, rate: 1, mono: true });
        const s = stats(r.ch);
        // RMS hanya pada bagian yang berbunyi, supaya hening panjang tidak menyesatkan
        console.log(`${basename(f).padEnd(34)} ${r.dur.toFixed(2).padStart(6)}s  peak ${s.peak.toFixed(1).padStart(6)}  rms ${s.rms.toFixed(1).padStart(6)}`);
      } catch (e) {
        console.log(`${basename(f).padEnd(34)} GAGAL: ${String(e.message).slice(0, 60)}`);
      }
    }
  });
} else if (cmd === 'build') {
  const manifest = JSON.parse(readFileSync(resolve(arg), 'utf8'));
  const tmp = join(tmpdir(), 'sfx-tool');
  mkdirSync(tmp, { recursive: true });
  const SR = 44100;
  await withChrome(async (page) => {
    for (const m of manifest) {
      const b64 = readFileSync(resolve(rootArg ?? '', m.src)).toString('base64');
      const r = await page.evaluate(IN_PAGE, { b64, start: 0, max: 0, rate: 1, mono: m.mono !== false });
      const rate = m.rate ?? 1;
      let from = Math.floor((m.start ?? 0) * r.sr);
      let to = r.len;
      // Pangkas hening di awal (di bawah -40 dBFS), sisakan 4 ms agar serangannya tidak terpotong
      while (from < to - 64 && Math.abs(r.ch[0][from]) < 0.01) from++;
      from = Math.max(0, from - Math.floor(0.004 * r.sr));
      // Pangkas hening di ujung (di bawah -50 dBFS), lalu batasi panjangnya
      const lead = r.ch[0];
      let end = to;
      while (end > from + 64 && Math.abs(lead[end - 1]) < 0.003) end--;
      to = Math.min(end + Math.floor(0.02 * r.sr), r.len);
      if (m.max) to = Math.min(to, from + Math.floor(m.max * r.sr * rate));
      const out = r.ch.map((d) => {
        const slice = d.slice(from, to);
        // Ubah kecepatan dengan interpolasi linear (nada ikut berubah) dan hasilkan pada SR tetap
        const n = Math.floor((slice.length / rate) * (SR / r.sr));
        const o = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const pos = (i * rate * r.sr) / SR;
          const a = Math.floor(pos);
          const t = pos - a;
          o[i] = (slice[a] ?? 0) * (1 - t) + (slice[a + 1] ?? slice[a] ?? 0) * t;
        }
        return o;
      });
      // Fade-in 2 ms (hindari klik) dan fade-out
      const fadeOut = Math.min(out[0].length, Math.floor(SR * (m.max ? 0.06 : 0.03)));
      for (const o of out) {
        for (let i = 0; i < Math.min(o.length, 88); i++) o[i] *= i / 88;
        for (let i = 0; i < fadeOut; i++) o[o.length - 1 - i] *= i / fadeOut;
      }
      // Setarakan RMS (hanya bagian berbunyi), lalu tambah gain manifest; batasi puncak -1 dBFS
      const loud = [];
      for (const o of out) for (let i = 0; i < o.length; i++) if (Math.abs(o[i]) > 0.01) loud.push(o[i]);
      const rms = db(Math.sqrt(loud.reduce((s, v) => s + v * v, 0) / Math.max(loud.length, 1)));
      let gain = TARGET_RMS - rms + (m.gain ?? 0);
      const peak = Math.max(...out.map((o) => o.reduce((p, v) => Math.max(p, Math.abs(v)), 0)));
      const maxGain = db(0.89) - db(peak);
      if (gain > maxGain) gain = maxGain;
      const k = 10 ** (gain / 20);
      // Tulis WAV 16-bit
      const chans = out.length;
      const n = out[0].length;
      const buf = Buffer.alloc(44 + n * chans * 2);
      buf.write('RIFF', 0);
      buf.writeUInt32LE(36 + n * chans * 2, 4);
      buf.write('WAVEfmt ', 8);
      buf.writeUInt32LE(16, 16);
      buf.writeUInt16LE(1, 20);
      buf.writeUInt16LE(chans, 22);
      buf.writeUInt32LE(SR, 24);
      buf.writeUInt32LE(SR * chans * 2, 28);
      buf.writeUInt16LE(chans * 2, 32);
      buf.writeUInt16LE(16, 34);
      buf.write('data', 36);
      buf.writeUInt32LE(n * chans * 2, 40);
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < chans; c++) {
          buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[c][i] * k * 32767))), 44 + (i * chans + c) * 2);
        }
      }
      const wav = join(tmp, `${m.id}.wav`);
      writeFileSync(wav, buf);
      const dir = join(OUT, m.cat);
      mkdirSync(dir, { recursive: true });
      const dest = join(dir, `${m.id}.m4a`);
      execFileSync('afconvert', [wav, dest, '-f', 'm4af', '-d', 'aac', '-b', String(chans === 1 ? 64000 : 96000), '-q', '127']);
      console.log(`${m.id.padEnd(22)} ${(n / SR).toFixed(2)}s  gain ${gain.toFixed(1)} dB  -> ${m.cat}/${m.id}.m4a (${(statSync(dest).size / 1024).toFixed(0)} KB)`);
    }
  });
} else {
  console.log('Pemakaian: node scripts/sfx-tool.mjs analyze <folder> | build <manifest.json>');
  process.exit(1);
}
