import type { AddressInfo } from 'node:net';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Menjalankan game sungguhan di Chrome: WebGL, shader, lampu, dan UI.
 * Hal-hal ini tidak bisa diuji di Node. Butuh Google Chrome terpasang;
 * ganti kanal lewat E2E_CHROME_CHANNEL, misalnya `chromium`.
 */
declare const __game: any;
declare const __s: any;
declare const browserImport: (path: string) => Promise<any>;

const NEXT_FRAME_TIMEOUT = 15000;

let server: ViteDevServer;
let browser: Browser;
let url: string;
let page: Page;
let problems: string[];

beforeAll(async () => {
  server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
  await server.listen();
  url = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}/?debug`;
  browser = await chromium.launch({
    channel: process.env.E2E_CHROME_CHANNEL ?? 'chrome',
    headless: true,
    args: [...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function open(width = 1000, height = 700) {
  const context = await browser.newContext({ viewport: { width, height } });
  page = await context.newPage();
  problems = [];
  page.on('console', (m) => {
    if (!['error', 'warning'].includes(m.type())) return;
    // Font Google bisa gagal saat tanpa jaringan.
    if (/fonts\.g/.test(m.location().url)) return;
    problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    Object.defineProperty(window, '__s', { get: () => (window as any).__game?.scene.getScene('game') });
    // Lewat eval, supaya import() ini berjalan di browser dan tidak ikut diubah oleh Vitest
    (window as any).browserImport = (path: string) => window.eval(`import('${path}')`);
  });
  await page.goto(url);
  await page.waitForFunction(() => __s?.player && __s.state === 'menu', null, { timeout: 30000 });
}

/** Mulai ronde dari tombol UI, lalu matikan sumber acak supaya hasil test stabil. */
async function startQuiet() {
  await page.click('#btn-start');
  await page.waitForFunction(() => __s.state === 'playing');
  await page.evaluate(() => {
    const s = __s;
    s.spawn = () => {};
    s.spawnSwarm = () => {};
    s.updateWeapons = () => {};
    s.bossIndex = 99;
    s.nextSwarm = 1e9;
    s.stats.maxHp = 1e9;
    s.hp = 1e9;
    s.clearWorld();
  });
}

const framesPass = (n = 3) =>
  page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );

/** Membaca piksel kanvas tepat setelah Phaser selesai menggambar (buffer belum dibersihkan). */
const sampleScreen = () =>
  page.evaluate(
    () =>
      new Promise<{ avg: number; spread: number; center: number; corners: number }>((done) => {
        __game.events.once('postrender', () => {
          const gl = __game.renderer.gl as WebGLRenderingContext;
          const w = gl.drawingBufferWidth;
          const h = gl.drawingBufferHeight;
          const pixels = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const lum = (x: number, y: number) => {
            const p = (y * w + x) * 4;
            return pixels[p] * 0.3 + pixels[p + 1] * 0.59 + pixels[p + 2] * 0.11;
          };
          const all: number[] = [];
          for (let y = 0; y < h; y += 7) for (let x = 0; x < w; x += 7) all.push(lum(x, y));
          const avg = all.reduce((a, b) => a + b, 0) / all.length;
          const spread = Math.sqrt(all.reduce((a, b) => a + (b - avg) ** 2, 0) / all.length);
          const box = (cx: number, cy: number, r: number) => {
            let sum = 0;
            let n = 0;
            for (let y = cy - r; y <= cy + r; y += 4) for (let x = cx - r; x <= cx + r; x += 4) (sum += lum(x, y)), n++;
            return sum / n;
          };
          const m = Math.round(Math.min(w, h) * 0.12);
          const center = box(w >> 1, (h >> 1) + Math.round(m * 1.4), Math.round(m * 0.4));
          const corners = (box(m, m, m >> 1) + box(w - m, m, m >> 1) + box(m, h - m, m >> 1) + box(w - m, h - m, m >> 1)) / 4;
          done({ avg, spread, center, corners });
        });
      }),
  );

beforeEach(() => open(), 40000);
afterEach(async () => {
  await page.context().close();
});

describe('pemuatan aset', () => {
  it('semua atlas terbuat dengan jumlah frame dan normal map yang benar, tanpa error', async () => {
    const info = await page.evaluate(() => {
      const a = __s.art;
      const hasNormal = (k: string) => __game.textures.get(k).dataSource.length > 0;
      return {
        hero: a.hero.frames.length,
        cape: a.cape.frames.length,
        bow: a.bow.frames.length,
        monsters: Object.values(a.enemies).map((m: any) => [m.strip.frames.length, m.walk * 2]),
        normals: ['hero', 'heroCape', 'bow', 'arrow', 'goblin', 'skeleton', 'ogre', 'knight', 'dragon'].map(hasNormal),
        fx: ['fxRaven', 'fxTornado', 'fxPillar', 'puff', 'chip', 'fxRune', 'fxTarget', 'fxShock', 'fxBlast', 'fxCrater', 'fxMeteor', 'fxRainArrow', 'fxBolt0', 'fxArc', 'fxMoon', 'guardSword'].filter((k) => !__game.textures.exists(k)),
        grounds: ['groundGrass', 'groundDirt', 'groundStone', 'groundNoise'].map((k) => {
          const src = __game.textures.get(k).getSourceImage();
          return (src.width & (src.width - 1)) === 0 && src.width === src.height;
        }),
        bakeMs: __s.bakeMs,
      };
    });
    expect(info.hero).toBe(40);
    expect(info.cape).toBe(16);
    expect(info.bow).toBe(3);
    expect(info.monsters).toHaveLength(5);
    for (const [frames, expected] of info.monsters) expect(frames).toBe(expected);
    expect(info.normals.every(Boolean)).toBe(true);
    expect(info.fx).toEqual([]);
    // Pangkat dua wajib: shader tanah mengandalkan mode REPEAT GPU
    expect(info.grounds).toEqual([true, true, true, true]);
    expect(info.bakeMs).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});

describe('rendering', () => {
  it('shader tanah benar-benar menggambar dunia, dan malam lebih gelap dari siang', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.runTime = 150;
    });
    await framesPass(4);
    const day = await sampleScreen();
    await page.evaluate(() => {
      __s.runTime = 800;
    });
    await framesPass(4);
    const night = await sampleScreen();

    // Tidak hitam dan tidak satu warna: berarti shader terkompilasi dan teksturnya terbaca
    expect(day.avg).toBeGreaterThan(40);
    expect(day.spread).toBeGreaterThan(3);
    expect(night.avg).toBeLessThan(day.avg * 0.7);
    // Lentera: sekitar pemain jauh lebih terang daripada sudut layar.
    // Vignette kini lapisan CSS, jadi tidak ikut terbaca dari canvas.
    expect(night.center).toBeGreaterThan(night.corners * 1.5);
    expect(problems).toEqual([]);
  });

  it('efek cahaya mati: tanah cadangan tampil, lampu mati, dan malam tetap gelap', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.spawnEnemy('drone', 200, 0);
      __s.setGlow(false);
      __s.runTime = 150;
    });
    await framesPass(4);
    const day = await sampleScreen();
    await page.evaluate(() => {
      __s.runTime = 800;
    });
    await framesPass(4);
    const night = await sampleScreen();
    const state = await page.evaluate(() => ({
      ground: __s.ground.visible,
      fallback: __s.bg.visible,
      overlay: __s.dayTint.visible,
      bloom: __s.bloom.active,
      lit: [__s.player.lighting, __s.cape.lighting, __s.bow.lighting, __s.enemies[0].img.lighting],
    }));
    expect(state).toEqual({ ground: false, fallback: true, overlay: true, bloom: false, lit: [false, false, false, false] });
    expect(day.avg).toBeGreaterThan(40);
    expect(day.spread).toBeGreaterThan(3);
    expect(night.avg).toBeLessThan(day.avg * 0.7);

    // Dan bisa kembali normal, termasuk musuh dari pool yang dibuat saat efek mati
    const back = await page.evaluate(() => {
      __s.spawnEnemy('drone', -200, 0);
      __s.setGlow(true);
      __s.spawnEnemy('drone', 0, 200);
      return { ground: __s.ground.visible, fallback: __s.bg.visible, lit: __s.enemies.every((e: any) => e.img.lighting) };
    });
    expect(back).toEqual({ ground: true, fallback: false, lit: true });
    await framesPass(3);
    expect(problems).toEqual([]);
  });

  it('musuh yang dibuat saat efek mati tidak diterangi', async () => {
    await startQuiet();
    const result = await page.evaluate(() => {
      __s.setGlow(false);
      // Pool harus benar-benar bertambah: objek lama sudah diatur oleh setGlow, jadi tidak membuktikan apa-apa
      const before = __s.enemies.length;
      for (let i = 0; i < before + 3; i++) __s.spawnEnemy('drone', 200 + i * 30, 0);
      return { grew: __s.enemies.length > before, lit: __s.enemies.some((e: any) => e.img.lighting) };
    });
    expect(result).toEqual({ grew: true, lit: false });
  });
});

describe('rig pemain', () => {
  const heroFrame = () => page.evaluate(() => Number(__s.player.frame.name));

  it.each([
    ['d', 2, 'kanan'],
    ['a', 3, 'kiri'],
    ['w', 1, 'atas'],
    ['s', 0, 'bawah'],
  ])('tombol %s memakai frame arah %i (%s) dan animasi lari', async (key, view) => {
    await startQuiet();
    await page.keyboard.down(key);
    await page.waitForFunction(() => Math.hypot(__s.vx, __s.vy) > 120);
    const seen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      await framesPass(4);
      seen.add(await heroFrame());
    }
    await page.keyboard.up(key);
    for (const f of seen) {
      expect(Math.floor(f / 10)).toBe(view);
      expect(f % 10).toBeGreaterThanOrEqual(4); // 0-3 idle, 4-9 lari
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('jubah tertinggal di belakang gerakan, lalu kembali saat berhenti', async () => {
    await startQuiet();
    await page.keyboard.down('d');
    await page.waitForFunction(() => Math.hypot(__s.vx, __s.vy) > 150);
    await framesPass(10);
    expect(await page.evaluate(() => __s.capeAngle)).toBeGreaterThan(0.15);
    await page.keyboard.up('d');
    await page.keyboard.down('a');
    await page.waitForFunction(() => __s.vx < -150);
    await framesPass(10);
    expect(await page.evaluate(() => __s.capeAngle)).toBeLessThan(-0.15);
    await page.keyboard.up('a');
    await page.waitForFunction(() => Math.abs(__s.capeAngle) < 0.12, null, { timeout: NEXT_FRAME_TIMEOUT });
  });

  it('jubah berada di depan tubuh hanya saat membelakangi kamera', async () => {
    await startQuiet();
    const depthWhile = async (key: string) => {
      await page.keyboard.down(key);
      await page.waitForFunction(() => Math.hypot(__s.vx, __s.vy) > 120);
      await framesPass(3);
      const d = await page.evaluate(() => __s.cape.depth - __s.player.depth);
      await page.keyboard.up(key);
      await page.waitForFunction(() => Math.hypot(__s.vx, __s.vy) < 40);
      return d;
    };
    expect(await depthWhile('w')).toBeGreaterThan(0);
    expect(await depthWhile('s')).toBeLessThan(0);
  });

  it('senjata sungguhan: busur membidik musuh, menembak, dan panah melukai musuh', async () => {
    await page.click('#btn-start');
    await page.waitForFunction(() => __s.state === 'playing');
    await page.evaluate(() => {
      const s = __s;
      s.spawn = () => {};
      s.bossIndex = 99;
      s.nextSwarm = 1e9;
      s.clearWorld();
      s.spawnEnemy('drone', s.player.x, s.player.y + 200);
      const e = s.enemies.find((x: any) => x.alive);
      e.speed = 0;
      e.hp = 1e6;
    });
    await page.waitForFunction(() => __s.enemies.find((x: any) => x.alive).hp < 1e6, null, { timeout: NEXT_FRAME_TIMEOUT });
    await framesPass(30);
    const aim = await page.evaluate(() => ({ goal: __s.aimGoal, rot: __s.bow.rotation, arrows: __s.bolts.length }));
    expect(aim.goal).toBeCloseTo(Math.PI / 2, 1); // musuh tepat di bawah pemain
    expect(aim.rot).toBeCloseTo(Math.PI / 2, 0);
    expect(aim.arrows).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});

describe('musuh', () => {
  const add = (x: number, y: number) =>
    page.evaluate(
      ([ex, ey]) => {
        __s.spawnEnemy('drone', __s.player.x + ex, __s.player.y + ey);
        const e = __s.enemies.filter((o: any) => o.alive).pop();
        e.speed = 0;
        e.hp = 1e6;
        return e.id;
      },
      [x, y],
    );

  it('menghadap pemain dengan frame arah yang tepat, karena flipX tidak membalik normal map', async () => {
    await startQuiet();
    const right = await add(250, 0); // di kanan pemain, jadi menghadap kiri
    const left = await add(-250, 0);
    await framesPass(4);
    const r = await page.evaluate(
      ([a, b]) => ({ a: __s.enemies[a].frame, b: __s.enemies[b].frame, walk: __s.art.enemies.drone.walk, flip: __s.enemies[a].img.flipX || __s.enemies[b].img.flipX }),
      [right, left],
    );
    expect(r.a).toBeGreaterThanOrEqual(r.walk);
    expect(r.b).toBeLessThan(r.walk);
    expect(r.flip).toBe(false);
  });

  it('langkah goblin berganti dan tidak serempak antar musuh', async () => {
    await startQuiet();
    const ids: number[] = [];
    for (let i = 0; i < 8; i++) ids.push(await add(-250, i * 30));
    await framesPass(3);
    const frames = await page.evaluate((list) => list.map((id) => __s.enemies[id].frame), ids);
    expect(new Set(frames).size).toBeGreaterThan(1);
    await framesPass(12);
    const later = await page.evaluate((list) => list.map((id) => __s.enemies[id].frame), ids);
    expect(later).not.toEqual(frames);
  });

  it('kilatan putih saat terkena, lalu kembali normal', async () => {
    await startQuiet();
    const id = await add(250, 0);
    await framesPass(2);
    const during = await page.evaluate((i) => {
      const e = __s.enemies[i];
      __s.damageEnemy(e, 1, 0, 0, 0);
      return { flashing: e.flashing, mode: e.img.tintMode };
    }, id);
    expect(during).toEqual({ flashing: true, mode: 1 });
    await page.waitForFunction((i) => !__s.enemies[i].flashing, id, { timeout: NEXT_FRAME_TIMEOUT });
    expect(await page.evaluate((i) => __s.enemies[i].img.tintMode, id)).toBe(0);
  });

  it('pool dipakai ulang: bayangan ikut hilang dan tidak ada objek baru', async () => {
    await startQuiet();
    for (let i = 0; i < 6; i++) await add(200 + i * 20, 0);
    const before = await page.evaluate(() => {
      const list = __s.enemies.filter((e: any) => e.alive);
      list.forEach((e: any) => __s.removeEnemy(e));
      return {
        pool: __s.enemies.length,
        objects: __s.children.list.length,
        shadows: list.every((e: any) => !e.shadow.visible && !e.img.visible),
        alive: __s.aliveEnemies,
      };
    });
    expect(before.shadows).toBe(true);
    expect(before.alive).toBe(0);
    for (let i = 0; i < 6; i++) await add(200 + i * 20, 0);
    const after = await page.evaluate(() => ({
      pool: __s.enemies.length,
      objects: __s.children.list.length,
      shadowsBack: __s.enemies.filter((e: any) => e.alive).every((e: any) => e.shadow.visible),
    }));
    expect(after.pool).toBe(before.pool);
    expect(after.objects).toBe(before.objects);
    expect(after.shadowsBack).toBe(true);
  });

  it('semua monster berjalan dengan frame, tidak ada yang berputar, dan bisa terkena lalu mati', async () => {
    await startQuiet();
    const kinds = ['drone', 'blob', 'brute', 'titan', 'wyrm'];
    const ids = await page.evaluate((list) => {
      return list.map((kind: string, i: number) => {
        __s.spawnEnemy(kind, __s.player.x + 260, __s.player.y - 200 + i * 100);
        const e = __s.enemies.filter((o: any) => o.alive).pop();
        e.speed = 0;
        return e.id;
      });
    }, kinds);
    // Dicatat beberapa kali, karena dua sampel bisa kebetulan jatuh di frame yang sama
    const seen = kinds.map(() => new Set<number>());
    for (let i = 0; i < 10; i++) {
      await framesPass(6);
      const now = await page.evaluate((list) => list.map((id: number) => [__s.enemies[id].frame, __s.enemies[id].img.rotation]), ids);
      now.forEach(([frame, rotation]: number[], k: number) => {
        seen[k].add(frame);
        expect(Math.abs(rotation)).toBeLessThan(0.5);
      });
    }
    seen.forEach((frames, k) => expect(frames.size, kinds[k]).toBeGreaterThan(1));

    const result = await page.evaluate((list) => {
      const before = __s.kills;
      list.forEach((id: number) => __s.damageEnemy(__s.enemies[id], 1e9, 1, 0, 0));
      return { killed: __s.kills - before, boss: __s.boss };
    }, ids);
    expect(result).toEqual({ killed: 5, boss: null });
    await framesPass(3);
    expect(problems).toEqual([]);
  });

  it('berhenti di tepi tubuh pemain, tidak menumpuk di atasnya', async () => {
    await startQuiet();
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        __s.spawnEnemy('drone', __s.player.x + Math.cos(a) * 60, __s.player.y + Math.sin(a) * 60);
      }
    });
    await page.waitForFunction(() => __s.enemies.filter((e: any) => e.alive).every((e: any) => Math.hypot(e.img.x - __s.player.x, e.img.y - __s.player.y) < 32), null, { timeout: NEXT_FRAME_TIMEOUT });
    await framesPass(30);
    const nearest = await page.evaluate(() => Math.min(...__s.enemies.filter((e: any) => e.alive).map((e: any) => Math.hypot(e.img.x - __s.player.x, e.img.y - __s.player.y))));
    expect(nearest).toBeGreaterThan(15);
  });

  it('panah cepat pada frame panjang tidak menembus musuh', async () => {
    await startQuiet();
    const hit = await page.evaluate(() => {
      const s = __s;
      s.spawnEnemy('drone', s.player.x + 120, s.player.y);
      const e = s.enemies.filter((o: any) => o.alive).pop();
      e.hp = 1e6;
      s.stats.boltSpeedMul = 3;
      s.rebuildHash();
      s.fireBolt(0);
      const before = e.hp;
      for (let i = 0; i < 4; i++) s.updateBolts(0.05);
      return e.hp < before;
    });
    expect(hit).toBe(true);
  });
});

describe('keseimbangan di game sungguhan', () => {
  it('populasi mengikuti sasaran selama dua menit permainan cepat, tidak membengkak seperti dulu', async () => {
    await page.click('#btn-start');
    await page.waitForFunction(() => __s.state === 'playing');
    const r = await page.evaluate(async () => {
      const s = __s;
      s.stats.maxHp = 1e9;
      s.hp = 1e9;
      s.update = () => {};
      let t = 0;
      s.controls.vector = (v: { x: number; y: number }) => {
        t += 0.02;
        v.x = Math.cos(t);
        v.y = Math.sin(t * 0.7);
      };
      let peak = 0;
      while (s.runTime < 120) {
        for (let i = 0; i < 300; i++) {
          if (s.state === 'levelup') {
            (document.querySelector('#cards .card') as HTMLElement).click();
            continue;
          }
          s.step(1 / 30);
          peak = Math.max(peak, s.aliveEnemies);
        }
        await new Promise((done) => setTimeout(done, 0));
      }
      return { peak, level: s.level, kills: s.kills };
    });
    // Sebelum penyeimbangan, menit ke-2 sudah berisi sekitar 240 musuh saat pemain level 6
    expect(r.peak).toBeLessThan(110);
    expect(r.level).toBeGreaterThanOrEqual(5);
    expect(r.kills).toBeGreaterThan(50);
    expect(problems).toEqual([]);
  }, 60000);
});

describe('senjata pusaka', () => {
  const crowd = () =>
    page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        __s.spawnEnemy('drone', __s.player.x + Math.cos(a) * 170, __s.player.y + Math.sin(a) * 170);
      }
    });

  it('level 5 menawarkan kartu pusaka, dan memilihnya langsung menghantam kerumunan', async () => {
    await startQuiet();
    await crowd();
    await page.evaluate(() => {
      __s.level = 4;
      __s.xp = 1e4;
    });
    await page.waitForFunction(() => __s.state === 'levelup');
    expect(await page.textContent('#levelup-eyebrow')).toBe('Pusaka terbuka');
    expect(await page.locator('#cards .card.tag-pusaka').count()).toBe(3);
    await page.evaluate(() => {
      __s.xp = 0;
    });
    await page.keyboard.press('1');
    await page.waitForFunction(() => __s.state === 'playing');
    expect(await page.locator('#specials .special-slot').count()).toBe(1);
    await page.waitForFunction(() => __s.kills >= 10, null, { timeout: NEXT_FRAME_TIMEOUT });
    expect(problems).toEqual([]);
  });

  it.each(['meteor', 'rain', 'thunder', 'moon', 'ravens', 'tornado', 'flames', 'holy', 'frost', 'quake'])('%s membersihkan gelombang, dan jeda membekukan serangannya', async (id) => {
    await startQuiet();
    await crowd();
    await page.evaluate((special) => {
      __s.specials.setTier(special, 3);
    }, id);
    await page.waitForFunction(() => __s.fx.activeCount > 0, null, { timeout: NEXT_FRAME_TIMEOUT });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => __s.state === 'paused');
    const frozen = await page.evaluate(() => [__s.kills, __s.specials.strikes.length, __s.fx.activeCount]);
    await framesPass(15);
    expect(await page.evaluate(() => [__s.kills, __s.specials.strikes.length, __s.fx.activeCount])).toEqual(frozen);
    await page.click('#btn-resume');
    await page.waitForFunction(() => __s.state === 'playing');
    await page.waitForFunction(() => __s.kills >= 20, null, { timeout: 20000 });
    expect(problems).toEqual([]);
  }, 40000);

  it('aktivasi berulang memakai pool efek yang terbatas, dan semuanya kembali ke pool', async () => {
    await startQuiet();
    const run = () =>
      page.evaluate(() => {
        const s = __s;
        for (const id of ['meteor', 'thunder', 'moon', 'rain', 'ravens', 'tornado', 'flames', 'holy', 'frost', 'quake']) s.specials.setTier(id, 3);
        for (let i = 0; i < 30; i++) {
          const a = (i / 30) * Math.PI * 2;
          s.spawnEnemy('blob', s.player.x + Math.cos(a) * 170, s.player.y + Math.sin(a) * 170);
        }
        for (let i = 0; i < 300; i++) {
          s.rebuildHash();
          s.specials.update(1 / 30);
          s.fx.update(1 / 30);
        }
        s.specials.reset();
        for (let i = 0; i < 120; i++) s.fx.update(1 / 30);
        return { pool: s.fx.pool.length, active: s.fx.activeCount, free: s.fx.free.length };
      });
    for (let i = 0; i < 3; i++) {
      const r = await run();
      expect(r.pool).toBeLessThanOrEqual(260);
      expect(r.active).toBe(0);
      expect(r.free).toBe(r.pool);
    }
    expect(problems).toEqual([]);
  });

  it('ronde baru menghapus semua pusaka dan efeknya', async () => {
    await startQuiet();
    await crowd();
    await page.evaluate(() => {
      __s.specials.setTier('rain', 3);
    });
    await page.waitForFunction(() => __s.specials.strikes.length > 0);
    await page.evaluate(() => __s.startRun());
    const r = await page.evaluate(() => ({ owned: __s.specials.owned.length, strikes: __s.specials.strikes.length, fx: __s.fx.activeCount }));
    expect(r).toEqual({ owned: 0, strikes: 0, fx: 0 });
    expect(await page.isVisible('#specials')).toBe(false);
  });

  it('bar HP bos muncul, berkurang saat dilukai, dan hilang saat bos tumbang', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.setBoss(__s.spawnEnemy('titan', __s.player.x + 300, __s.player.y));
    });
    expect(await page.isVisible('#boss-bar')).toBe(true);
    expect(await page.textContent('#boss-name')).toBe('Ksatria Terkutuk');
    // Seperempat HP, supaya serangan kritis (dua kali lipat) pun tidak langsung menumbangkan bos
    await page.evaluate(() => __s.damageEnemy(__s.boss, __s.boss.maxHp / 4, 1, 0, 0));
    const scale = await page.evaluate(() => document.getElementById('boss-fill')!.style.transform);
    expect(scale).toMatch(/scaleX\(0\.(5|75)\)/);
    await page.evaluate(() => __s.damageEnemy(__s.boss, 1e9, 1, 0, 0));
    expect(await page.isVisible('#boss-bar')).toBe(false);
    expect(await page.evaluate(() => __s.boss)).toBeNull();
  });
});

describe('performa', () => {
  it('angka damage tidak mengunggah tekstur, dan semuanya memakai pool', async () => {
    await startQuiet();
    const r = await page.evaluate(() => {
      const s = __s;
      s.spawnEnemy('drone', s.player.x + 200, s.player.y);
      const e = s.enemies.filter((o: any) => o.alive).pop();
      e.hp = 1e9;
      const gl = __game.renderer.gl;
      let uploads = 0;
      const real = gl.texImage2D.bind(gl);
      gl.texImage2D = (...a: unknown[]) => {
        uploads++;
        return (real as (...x: unknown[]) => void)(...a);
      };
      return new Promise<{ uploads: number; numbers: number; type: string }>((done) => {
        let frames = 0;
        const tick = () => {
          s.numbersLeft = 5;
          s.damageEnemy(e, 7 + frames, 0, 0, 0);
          if (++frames < 40) requestAnimationFrame(tick);
          else {
            gl.texImage2D = real;
            done({ uploads, numbers: s.numbers.length, type: s.numbers[0].text.type });
          }
        };
        tick();
      });
    });
    expect(r.uploads).toBe(0);
    expect(r.numbers).toBeLessThanOrEqual(28);
    expect(r.type).toBe('BitmapText');
    expect(problems).toEqual([]);
  });

  it('angka damage berhenti saat jeda, lalu lenyap setelah dilanjutkan', async () => {
    await startQuiet();
    await page.evaluate(() => __s.showNumber(__s.player.x, __s.player.y, 123, false, false));
    await framesPass(3);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => __s.state === 'paused');
    const frozen = await page.evaluate(() => __s.numbers[0].age);
    await framesPass(10);
    expect(await page.evaluate(() => __s.numbers[0].age)).toBe(frozen);
    await page.click('#btn-resume');
    await page.waitForFunction(() => !__s.numbers[0].text.active, null, { timeout: NEXT_FRAME_TIMEOUT });
  });

  it('tidak ada shader yang dikompilasi di tengah permainan, termasuk saat pusaka pertama dipakai', async () => {
    await framesPass(5);
    await page.evaluate(() => {
      const gl = __game.renderer.gl;
      (window as any).__links = 0;
      const real = gl.linkProgram.bind(gl);
      gl.linkProgram = (p: unknown) => {
        (window as any).__links++;
        return real(p);
      };
    });
    await startQuiet();
    await page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        __s.spawnEnemy(['drone', 'blob', 'brute'][i % 3], __s.player.x + Math.cos(a) * 170, __s.player.y + Math.sin(a) * 170);
      }
      __s.setBoss(__s.spawnEnemy('titan', __s.player.x + 260, __s.player.y));
      for (const id of ['meteor', 'rain', 'thunder', 'moon']) __s.specials.setTier(id, 3);
      __s.xp = 0;
    });
    await page.waitForFunction(() => __s.kills >= 15, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__links)).toBe(0);
  }, 40000);

  it('setiap jenis musuh punya lapisan sendiri, supaya gambarnya dibatch', async () => {
    await startQuiet();
    const depths = await page.evaluate(() =>
      ['drone', 'blob', 'brute', 'titan', 'wyrm'].map((k) => {
        const e = __s.spawnEnemy(k, __s.player.x + 400, __s.player.y);
        return e.img.depth;
      }),
    );
    expect(new Set(depths).size).toBe(5);
  });

  it('pengurutan objek tidak berjalan setiap frame saat pemain diam', async () => {
    await startQuiet();
    await framesPass(5);
    const sorts = await page.evaluate(
      () =>
        new Promise<number>((done) => {
          const list = __s.children;
          let n = 0;
          const real = list.queueDepthSort.bind(list);
          list.queueDepthSort = () => {
            n++;
            real();
          };
          let frames = 30;
          const tick = () => (--frames > 0 ? requestAnimationFrame(tick) : done(n));
          requestAnimationFrame(tick);
        }),
    );
    expect(sorts).toBeLessThanOrEqual(2);
  });

  it('turun tingkat kualitas: bloom mati dulu, lalu resolusi turun, dan game tetap jalan', async () => {
    await page.context().close();
    await open(2000, 1200);
    await startQuiet();
    const stepDown = () =>
      page.evaluate(() => {
        __s.governor.sample = () => true;
        __s.watchFrames();
        __s.governor.sample = () => false;
        return { tier: __s.qualityTier, w: __s.scale.width, bloom: __s.bloom.active, lit: __s.lit };
      });
    const start = await page.evaluate(() => ({ w: __s.scale.width, bloom: __s.bloom.active }));
    expect(start.bloom).toBe(true);
    const first = await stepDown();
    expect(first).toMatchObject({ w: start.w, bloom: false, lit: true });
    const second = await stepDown();
    expect(second.w).toBeLessThan(start.w);
    expect(second.lit).toBe(true);
    await framesPass(4);
    const size = await page.evaluate(() => ({ groundW: __s.ground.width, viewW: __s.viewW, zoom: __s.cameras.main.zoom }));
    expect(size.groundW).toBeCloseTo(size.viewW);
    const screen = await sampleScreen();
    expect(screen.spread).toBeGreaterThan(3);
    expect(problems).toEqual([]);
  }, 40000);

  it('bloom tidak menyala di layar yang piksel-nya sangat banyak', async () => {
    await page.context().close();
    await open(2400, 1500);
    expect(await page.evaluate(() => __s.bloom.active)).toBe(false);
  }, 40000);

  it('pilihan pengguna dihormati: lampu tidak dimatikan otomatis kalau efek cahaya dipilih manual', async () => {
    await page.locator('#screen-start label.toggle').click();
    await page.locator('#screen-start label.toggle').click();
    await startQuiet();
    const lit = await page.evaluate(() => {
      __s.qualityTier = 3;
      __s.governor.sample = () => true;
      __s.watchFrames();
      return __s.lit;
    });
    expect(lit).toBe(true);
  });
});

describe('alur main lewat UI', () => {
  it('mulai, naik level, jeda, ganti efek, kalah, ke menu, lalu main lagi', async () => {
    const state = () => page.evaluate(() => __s.state);
    expect(await page.isVisible('#screen-start')).toBe(true);

    await page.click('#btn-start');
    await page.waitForFunction(() => __s.state === 'playing');
    expect(await page.isVisible('#hud')).toBe(true);

    // Naik level lewat XP sungguhan
    await page.evaluate(() => {
      __s.spawn = () => {};
      __s.xp = 6;
    });
    await page.waitForFunction(() => __s.state === 'levelup');
    expect(await page.locator('#cards .card').count()).toBe(3);
    await page.keyboard.press('1');
    await page.waitForFunction(() => __s.state === 'playing');
    expect(await page.evaluate(() => [__s.level, Object.keys(__s.levels).length])).toEqual([2, 1]);

    // Jeda membekukan semua waktu permainan
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => __s.state === 'paused');
    const frozen = await page.evaluate(() => [__s.clock, __s.runTime, __s.walkPhase]);
    await framesPass(15);
    expect(await page.evaluate(() => [__s.clock, __s.runTime, __s.walkPhase])).toEqual(frozen);

    // Toggle efek dari UI tersimpan ke localStorage
    await page.locator('#screen-pause label.toggle').click();
    expect(await page.evaluate(() => __s.lit)).toBe(false);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lumen-survivor-v1')!).glow)).toBe(false);

    await page.click('#btn-resume');
    await page.waitForFunction(() => __s.state === 'playing');

    // Kalah: seluruh bagian pemain hilang
    await page.evaluate(() => {
      __s.hp = 0;
    });
    await page.waitForSelector('#screen-end:not([hidden])');
    expect(await state()).toBe('over');
    expect(await page.evaluate(() => [__s.player, __s.cape, __s.bow, __s.heroShadow].some((o: any) => o.visible))).toBe(false);

    // Kembali ke menu dan main lagi: pemain muncul lagi dan statistik bersih
    await page.click('#btn-menu');
    await page.waitForFunction(() => __s.state === 'menu');
    expect(await page.evaluate(() => [__s.player, __s.cape, __s.bow, __s.heroShadow].every((o: any) => o.visible))).toBe(true);
    await page.click('#btn-start');
    await page.waitForFunction(() => __s.state === 'playing');
    expect(await page.evaluate(() => [__s.level, __s.kills, Math.round(__s.hp)])).toEqual([1, 0, 100]);
    await framesPass(5);
    expect(problems).toEqual([]);
  }, 40000);

  it('pilihan efek cahaya bertahan setelah dimuat ulang', async () => {
    await page.locator('#screen-start label.toggle').click();
    expect(await page.evaluate(() => __s.lit)).toBe(false);
    await page.reload();
    await page.waitForFunction(() => __s?.player && __s.state === 'menu');
    expect(await page.evaluate(() => [__s.lit, __s.bg.visible, __s.ground.visible])).toEqual([false, true, false]);
    expect(await page.isChecked('#opt-glow')).toBe(false);
  });

  it('resize menyesuaikan area tanah dengan layar baru', async () => {
    await startQuiet();
    const size = () => page.evaluate(() => ({ w: __s.ground.width, h: __s.ground.height, viewW: __s.viewW, viewH: __s.viewH, canvas: [__game.canvas.width, __game.canvas.height] }));
    const before = await size();
    await page.setViewportSize({ width: 420, height: 880 });
    await page.waitForFunction((w) => __game.canvas.width !== w, before.canvas[0]);
    await framesPass(3);
    const after = await size();
    expect(after.h).toBeGreaterThan(after.w);
    expect(after.w).toBeCloseTo(after.viewW);
    expect(after.h).toBeCloseTo(after.viewH);
    const s = await sampleScreen();
    expect(s.spread).toBeGreaterThan(3);
    expect(problems).toEqual([]);
  });
});

describe('akhir ronde 15 menit', () => {
  it('saat waktu habis ada pemberitahuan, hitung mundur, lalu otomatis kembali ke menu', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.runTime = 899.9;
    });
    await page.waitForSelector('#screen-end:not([hidden])');
    expect(await page.textContent('#end-title')).toBe('Game selesai!');
    expect(await page.textContent('#end-eyebrow')).toBe('Waktu 15 menit habis');
    expect(await page.isVisible('#end-redirect')).toBe(true);
    expect(await page.textContent('#end-redirect')).toContain('menu utama');
    expect(await page.evaluate(() => __s.state)).toBe('over');
    await page.waitForFunction(() => __s.state === 'menu', null, { timeout: 9000 });
    expect(await page.isVisible('#screen-start')).toBe(true);
    expect(await page.isVisible('#screen-end')).toBe(false);
    expect(problems).toEqual([]);
  }, 30000);

  it('memilih main lagi membatalkan perpindahan otomatis ke menu', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.runTime = 899.9;
    });
    await page.waitForSelector('#screen-end:not([hidden])');
    await page.click('#btn-again');
    await page.waitForFunction(() => __s.state === 'playing');
    await page.waitForTimeout(7000);
    expect(await page.evaluate(() => __s.state)).toBe('playing');
    expect(await page.evaluate(() => __s.runTime)).toBeLessThan(100);
  }, 30000);

  it('kalah sebelum waktu habis tidak berpindah otomatis', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.stats.maxHp = 100;
      __s.hp = 0;
    });
    await page.waitForSelector('#screen-end:not([hidden])');
    expect(await page.isVisible('#end-redirect')).toBe(false);
    await page.waitForTimeout(7000);
    expect(await page.evaluate(() => __s.state)).toBe('over');
  }, 30000);

  it('peringatan muncul saat satu menit terakhir', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.runTime = 841;
    });
    await page.waitForFunction(() => document.getElementById('toast')!.textContent === 'Satu menit lagi!', null, { timeout: NEXT_FRAME_TIMEOUT });
  });
});

describe('level maksimum', () => {
  it('berhenti naik di level 50, bar XP penuh, dan tidak ada pemilihan kartu lagi', async () => {
    await startQuiet();
    expect(await page.textContent('#lvl-max')).toBe('/50');
    await page.evaluate(() => {
      __s.level = 49;
      __s.xp = 1e7;
    });
    await page.waitForFunction(() => __s.state === 'levelup');
    expect(await page.textContent('#levelup-title')).toBe('Level 50');
    await page.keyboard.press('1');
    await page.waitForFunction(() => __s.state === 'playing');
    await framesPass(10);
    const r = await page.evaluate(() => ({ state: __s.state, level: __s.level, fill: document.getElementById('xp-fill')!.style.transform }));
    expect(r).toEqual({ state: 'playing', level: 50, fill: 'scaleX(1)' });
  });
});

describe('efek perlengkapan', () => {
  const setup = (gear: Record<string, number>) =>
    page.evaluate((g) => {
      const s = __s;
      s.spawn = () => {};
      Object.assign(s.stats, g);
      s.spawnEnemy('drone', s.player.x + 120, s.player.y);
      const e = s.enemies.filter((o: any) => o.alive).pop();
      e.speed = 0;
      e.hp = e.maxHp = 1e6;
      s.rebuildHash();
      return e.id;
    }, gear);
  const shoot = (id: number) =>
    page.evaluate((i) => {
      const s = __s;
      const e = s.enemies[i];
      s.fireBolt(Math.atan2(e.img.y - s.player.y, e.img.x - s.player.x));
      s.bolts.filter((b: any) => b.alive).forEach((b: any) => (b.damage = 10));
      for (let k = 0; k < 45; k++) s.updateBolts(1 / 60);
    }, id);

  it('panah racun terus mengurangi HP setelah terkena', async () => {
    await startQuiet();
    const id = await setup({ poison: 2 });
    await shoot(id);
    const before = await page.evaluate((i) => __s.enemies[i].hp, id);
    await page.waitForFunction(([i, hp]) => __s.enemies[i].hp < hp, [id, before], { timeout: NEXT_FRAME_TIMEOUT });
    expect(await page.evaluate((i) => __s.enemies[i].dotDps, id)).toBeCloseTo(6);
  });

  it('panah beku memperlambat, dan bos tidak pernah benar-benar membeku', async () => {
    await startQuiet();
    const id = await setup({ frost: 2 });
    await shoot(id);
    const r = await page.evaluate((i) => {
      const s = __s;
      const slowed = s.enemies[i].slowFactor;
      const boss = s.spawnEnemy('titan', s.player.x - 300, s.player.y);
      s.slowEnemy(boss, 0, 2);
      return { slowed, boss: boss.slowFactor };
    }, id);
    expect(r.slowed).toBeCloseTo(0.64);
    expect(r.boss).toBeGreaterThan(0);
  });

  it('panah ledak melukai musuh di dekatnya', async () => {
    await startQuiet();
    const id = await setup({ explode: 2 });
    const near = await page.evaluate((i) => {
      const s = __s;
      const e = s.enemies[i];
      const o = s.spawnEnemy('drone', e.img.x + 30, e.img.y);
      o.speed = 0;
      o.hp = o.maxHp = 1e6;
      s.rebuildHash();
      return o.id;
    }, id);
    await shoot(id);
    expect(await page.evaluate((i) => __s.enemies[i].hp, near)).toBeLessThan(1e6);
  });

  it('panah pantul berpindah ke musuh lain', async () => {
    await startQuiet();
    const id = await setup({ ricochet: 1 });
    const other = await page.evaluate((i) => {
      const s = __s;
      const e = s.enemies[i];
      const o = s.spawnEnemy('drone', e.img.x, e.img.y - 150);
      o.speed = 0;
      o.hp = o.maxHp = 1e6;
      s.rebuildHash();
      return o.id;
    }, id);
    await shoot(id);
    expect(await page.evaluate((i) => __s.enemies[i].hp, other)).toBeLessThan(1e6);
  });

  it('perisai mengurangi kerusakan, dan jubah bisa membuat serangan meleset', async () => {
    await startQuiet();
    const r = await page.evaluate(() => {
      const s = __s;
      s.stats.maxHp = s.hp = 1000;
      s.stats.armor = 0.5;
      s.hurtPlayer(100);
      const armored = 1000 - s.hp;
      s.hp = 1000;
      s.stats.dodge = 1;
      s.hurtPlayer(100);
      return { armored, dodged: 1000 - s.hp };
    });
    expect(r).toEqual({ armored: 50, dodged: 0 });
  });

  it('bulu phoenix membangkitkan sekali, setelah itu game over', async () => {
    await startQuiet();
    await page.evaluate(() => {
      __s.stats.maxHp = 100;
      __s.stats.revives = 1;
      __s.hp = 0;
    });
    await page.waitForFunction(() => __s.hp > 0 && __s.stats.revives === 0, null, { timeout: NEXT_FRAME_TIMEOUT });
    expect(await page.evaluate(() => [__s.state, Math.round(__s.hp)])).toEqual(['playing', 50]);
    await page.evaluate(() => {
      __s.hp = 0;
    });
    await page.waitForFunction(() => __s.state === 'over', null, { timeout: NEXT_FRAME_TIMEOUT });
  });

  it('titah algojo menumbangkan musuh biasa yang nyaris mati, tetapi tidak bos', async () => {
    await startQuiet();
    const r = await page.evaluate(() => {
      const s = __s;
      s.stats.execute = 0.5;
      s.stats.critChance = 0;
      const e = s.spawnEnemy('drone', s.player.x + 300, s.player.y);
      e.hp = e.maxHp = 100;
      s.damageEnemy(e, 60, 0, 0, 0);
      // Dicatat sekarang: pool bisa memakai ulang objek yang sama untuk bos di bawah
      const dead = !e.alive;
      const boss = s.spawnEnemy('titan', s.player.x - 300, s.player.y);
      boss.hp = boss.maxHp = 100;
      s.damageEnemy(boss, 60, 0, 0, 0);
      return { dead, bossAlive: boss.alive };
    });
    expect(r).toEqual({ dead: true, bossAlive: true });
  });

  it('kitab pengetahuan menambah XP dari kristal', async () => {
    await startQuiet();
    const xp = await page.evaluate(() => {
      const s = __s;
      s.stats.xpMul = 2;
      s.xp = 0;
      s.dropGem(s.player.x, s.player.y, 1, false);
      const g = s.gems.find((o: any) => o.alive);
      g.pulled = true;
      for (let i = 0; i < 30; i++) s.updateGems(1 / 60, true);
      return s.xp;
    });
    expect(xp).toBe(2);
  });

  it('kristal yang tertinggal jauh terbang sendiri ke pemain', async () => {
    await startQuiet();
    const pulled = await page.evaluate(() => {
      const s = __s;
      s.dropGem(s.player.x + 3000, s.player.y, 1, false);
      s.updateGems(1 / 60, true);
      return s.gems.find((o: any) => o.alive).pulled;
    });
    expect(pulled).toBe(true);
  });

  it('pedang kaca menurunkan HP maksimum tanpa membuat HP melebihi batas', async () => {
    await startQuiet();
    const r = await page.evaluate(async () => {
      const { UPGRADES } = await browserImport('/src/upgrades.ts');
      const s = __s;
      s.stats.maxHp = s.hp = 100;
      s.applyUpgrade(UPGRADES.find((u: any) => u.id === 'glass'));
      return { max: s.stats.maxHp, hp: s.hp };
    });
    expect(r).toEqual({ max: 75, hp: 75 });
  });

  it('kartu langka dan epik punya tanda kelangkaan', async () => {
    await startQuiet();
    const r = await page.evaluate(async () => {
      const { ui } = await browserImport('/src/ui.ts');
      const { UPGRADES } = await browserImport('/src/upgrades.ts');
      const pick = (id: string) => UPGRADES.find((u: any) => u.id === id);
      __s.state = 'levelup';
      ui.showLevelUp(9, [pick('tome'), pick('axe'), pick('phoenix')], {}, () => {});
      return [...document.querySelectorAll('#cards .card')].map((c) => [c.className.match(/rarity-\w+/)![0], c.querySelector('.card-rarity')?.textContent ?? null]);
    });
    expect(r).toEqual([
      ['rarity-common', null],
      ['rarity-rare', 'Langka'],
      ['rarity-epic', 'Epik'],
    ]);
  });
});

describe('identitas game', () => {
  it('judul tab, teks layar, dan tidak ada nama lama yang tampil', async () => {
    expect(await page.title()).toBe('Ravenhold Survivor');
    expect(await page.textContent('h1.logo')).toBe('RavenholdSurvivor');
    // Hanya teks yang terlihat: server dev menyisipkan path folder proyek ke atribut HTML
    const text = await page.evaluate(() => document.body.innerText + document.body.textContent);
    expect(text).not.toMatch(/lumen/i);
  });

  it('semua ikon tab benar-benar bisa dimuat', async () => {
    const icons = await page.evaluate(async () => {
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')];
      return Promise.all(
        links.map(async (l) => {
          const r = await fetch(l.href);
          return { rel: l.rel, status: r.status, type: r.headers.get('content-type') };
        }),
      );
    });
    expect(icons).toHaveLength(3);
    for (const i of icons) expect(i.status).toBe(200);
    expect(icons.map((i) => i.type)).toEqual(expect.arrayContaining(['image/svg+xml', 'image/png']));
  });

  it('logo dan tombol mulai tidak terpotong di HP mode lanskap', async () => {
    await page.context().close();
    await open(780, 360);
    const r = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return { top: box('.brand-crest').top, right: box('h1.logo').right, bottom: box('#btn-start').bottom, w: innerWidth, h: innerHeight };
    });
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(r.w);
    expect(r.bottom).toBeLessThanOrEqual(r.h);
  }, 40000);

  it('logo tampil di menu, layar jeda, dan layar akhir', async () => {
    const loaded = (selector: string) =>
      page.evaluate((s) => {
        const img = [...document.querySelectorAll<HTMLImageElement>(s)].find((o) => o.offsetParent !== null);
        return !!img && img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().width > 40;
      }, selector);
    expect(await loaded('.brand-crest')).toBe(true);
    await page.click('#btn-start');
    await page.waitForFunction(() => __s.state === 'playing');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => __s.state === 'paused');
    expect(await loaded('#screen-pause .panel-crest')).toBe(true);
    await page.click('#btn-resume');
    await page.evaluate(() => {
      __s.hp = 0;
    });
    await page.waitForSelector('#screen-end:not([hidden])');
    expect(await loaded('#screen-end .panel-crest')).toBe(true);
    expect(await page.textContent('#end-eyebrow')).toBe('Perjalanan berakhir');
  });
});

describe('mode menu', () => {
  it('demo berjalan: pemain bergerak dan musuh muncul', async () => {
    const start = await page.evaluate(() => [__s.player.x, __s.player.y]);
    await page.waitForFunction(() => __s.aliveEnemies > 0, null, { timeout: NEXT_FRAME_TIMEOUT });
    await framesPass(10);
    const end = await page.evaluate(() => [__s.player.x, __s.player.y]);
    expect(end).not.toEqual(start);
    expect(problems).toEqual([]);
  });
});

describe('audio', () => {
  /** Mencatat setiap suara yang lolos penjaga state, tanpa perlu ada file audio. */
  const spy = () =>
    page.evaluate(() => {
      const played: string[] = [];
      const a = __s.audio;
      const orig = a.play.bind(a);
      a.play = (id: string, ...rest: unknown[]) => {
        played.push(id);
        return orig(id, ...rest);
      };
      (window as any).__played = played;
    });
  const played = () => page.evaluate(() => [...(window as any).__played] as string[]);

  it('demo di menu tidak memutar suara pertempuran', async () => {
    await spy();
    await page.waitForFunction(() => __s.aliveEnemies > 0, null, { timeout: NEXT_FRAME_TIMEOUT });
    await page.evaluate(() => {
      for (let i = 0; i < 300; i++) __s.step(1 / 60);
    });
    expect(await played()).toEqual([]);
    expect(problems).toEqual([]);
  });

  it('saat bermain, tembakan dan luka pemain berbunyi; saat jeda, tidak', async () => {
    await startQuiet();
    await page.waitForFunction(() => __s.audio.live);
    await spy();
    await page.evaluate(() => {
      __s.spawnEnemy('drone', __s.player.x + 120, __s.player.y);
      __s.fireVolley(__s.nearestEnemy(480));
      __s.hurtPlayer(1);
    });
    const ids = await played();
    expect(ids).toContain('bow_shot');
    expect(ids).toContain('hero_hurt');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => __s.state === 'paused' && __s.audio.live === false);
    await page.evaluate(() => {
      (window as any).__played.length = 0;
      __s.audio.sfx('bow_shot');
      __s.audio.loop('rain_loop', 1);
    });
    expect(await played()).toEqual([]);
  });

  it('penggeser dan tombol M disimpan dan memengaruhi pemutar', async () => {
    await page.evaluate(() => {
      const el = document.getElementById('opt-music') as HTMLInputElement;
      el.value = '30';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await page.evaluate(() => [__s.audio.musicVolume, __s.save.musicVol])).toEqual([0.3, 0.3]);
    expect(await page.evaluate(() => (document.getElementById('opt-music-2') as HTMLInputElement).value)).toBe('30');

    await page.keyboard.press('KeyM');
    expect(await page.evaluate(() => [__s.audio.muted, __s.save.muted])).toEqual([true, true]);
    await page.keyboard.press('KeyM');
    expect(await page.evaluate(() => [__s.audio.muted, __s.save.muted])).toEqual([false, false]);
  });

  it('musik: menu, lalu pagi saat bermain, lalu trek bos; memori tidak menumpuk', async () => {
    await page.waitForFunction(() => __s.audio.music.current?.id === 'mus_menu', null, { timeout: 30000 });
    await page.click('#btn-start');
    await page.waitForFunction(() => __s.audio.music.current?.id === 'mus_pagi', null, { timeout: 30000 });
    // Setelah fade-in selesai, volume = penggeser × takaran trek di katalog
    await page.waitForFunction(() => __s.audio.music.current.level >= 1, null, { timeout: 15000 });
    const vol = await page.evaluate(() => [__s.audio.music.current.snd.volume, __s.audio.musicVolume, __s.audio.music.current.gain]);
    expect(vol[0]).toBeCloseTo(vol[1] * vol[2], 2);
    expect(vol[0]).toBeGreaterThan(0.05);

    await page.evaluate(() => {
      __s.runTime = 299.9;
    });
    await page.waitForFunction(() => __s.audio.music.current?.id === 'mus_bos_ksatria', null, { timeout: 30000 });
    await page.waitForFunction(() => __s.audio.music.layers.length === 1, null, { timeout: 15000 });
    const cached = await page.evaluate(() => __s.cache.audio.getKeys().filter((k: string) => k.startsWith('mus_')));
    expect(cached.length).toBeLessThanOrEqual(3);
    expect(cached).not.toContain('mus_menu');
    expect(problems).toEqual([]);
  }, 90000);

  it('musik yang bukan loop menyambung dirinya dengan crossfade sebelum habis', async () => {
    await page.click('#btn-start');
    await page.waitForFunction(() => __s.audio.music.current?.id === 'mus_pagi' && __s.audio.music.layers.length === 1, null, { timeout: 30000 });
    await page.evaluate(() => {
      (window as any).__first = __s.audio.music.current;
      const snd = __s.audio.music.current.snd;
      snd.seek = snd.duration - 2;
    });
    await page.waitForFunction(() => __s.audio.music.current !== (window as any).__first, null, { timeout: 10000 });
    expect(await page.evaluate(() => [(window as any).__first.restarted, __s.audio.music.current.id])).toEqual([true, 'mus_pagi']);
    await page.waitForFunction(() => __s.audio.music.layers.length === 1, null, { timeout: 15000 });
    expect(problems).toEqual([]);
  }, 90000);

  it('semua efek suara termuat dan ter-decode', async () => {
    await page.waitForFunction(() => __s.cache.audio.exists('bow_shot_1') && __s.cache.audio.exists('hero_hurt_4') && __s.cache.audio.exists('quake_rock_3'), null, { timeout: 30000 });
    const bad = await page.evaluate(() =>
      (__s.cache.audio.getKeys() as string[]).filter((k) => !k.startsWith('mus_') && !(__s.cache.audio.get(k)?.duration > 0.05)),
    );
    expect(bad).toEqual([]);
    const count = await page.evaluate(() => (__s.cache.audio.getKeys() as string[]).filter((k) => !k.startsWith('mus_') && !k.startsWith('amb_')).length);
    expect(count).toBeGreaterThanOrEqual(90);
    expect(problems).toEqual([]);
  }, 60000);

  it('volume, nada, dan pan dari katalog diterapkan: dekat-kanan lebih keras dari jauh-kiri', async () => {
    await startQuiet();
    await page.waitForFunction(() => __s.audio.live && __s.cache.audio.exists('hit_armor_1'), null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const a = __s.audio;
      const playing = () => [...a.pool.values()].flat().filter((snd: any) => snd.isPlaying);
      // Dibaca dari currentConfig: getter `volume` Phaser membaca gain node yang tertinggal satu langkah
      a.sfx('hit_armor', __s.player.x + 200, __s.player.y);
      const near = playing().map((snd: any) => ({ vol: snd.currentConfig.volume, pan: snd.currentConfig.pan }))[0];
      a.limiter.clear();
      for (const snd of playing()) snd.stop();
      a.sfx('hit_armor', __s.player.x - 900, __s.player.y);
      const far = playing().map((snd: any) => ({ vol: snd.currentConfig.volume, pan: snd.currentConfig.pan }))[0];
      return { near, far };
    });
    expect(r.near.vol).toBeGreaterThan(0.1);
    expect(r.near.vol).toBeLessThan(0.7 * 0.86);
    expect(r.near.pan).toBeGreaterThan(0);
    expect(r.far.pan).toBeLessThan(0);
    expect(r.far.vol).toBeLessThan(r.near.vol);
  }, 60000);

  it('tembakan, kena, dan tumbang benar-benar berbunyi', async () => {
    await page.waitForFunction(() => __s.cache.audio.exists('bow_shot_1'), null, { timeout: 30000 });
    await startQuiet();
    await page.waitForFunction(() => __s.audio.live);
    await spy();
    await page.evaluate(() => {
      __s.spawnEnemy('blob', __s.player.x + 120, __s.player.y);
      __s.fireVolley(__s.nearestEnemy(480));
      __s.hurtPlayer(1);
    });
    const ids = await played();
    expect(ids).toContain('bow_shot');
    expect(ids).toContain('hero_hurt');
    expect(await page.evaluate(() => __s.audio.active)).toBeGreaterThanOrEqual(1);
    // Musuh kena (bukan mati) memutar suara menurut jenisnya, lalu tumbang memutar suara tumbang
    await page.evaluate(() => {
      (window as any).__played.length = 0;
      const e = __s.enemies.find((o: any) => o.alive && o.kind === 'blob');
      __s.damageEnemy(e, 1, 1, 0, 0);
      __s.damageEnemy(e, 1e9, 1, 0, 0);
    });
    const after = await played();
    expect(after).toContain('hit_bone');
    expect(after).toContain('die_bone');
  }, 60000);

  it.each([
    ['meteor', 'meteor_impact'],
    ['rain', 'rain_release'],
    ['thunder', 'thunder_crack'],
    ['moon', 'moon_slash'],
    ['ravens', 'raven_wings'],
    ['tornado', 'tornado_loop'],
    ['flames', 'flames_ignite'],
    ['holy', 'holy_pulse'],
    ['frost', 'frost_cast'],
    ['quake', 'quake_start'],
  ])('pusaka %s meminta suaranya (%s)', async (id, sound) => {
    await startQuiet();
    await page.waitForFunction(() => __s.audio.live);
    await page.evaluate(() => {
      const asked: string[] = [];
      const a = __s.audio;
      for (const fn of ['sfx', 'loop'] as const) {
        const orig = a[fn].bind(a);
        a[fn] = (sid: string, ...rest: unknown[]) => {
          asked.push(sid);
          return orig(sid, ...rest);
        };
      }
      (window as any).__asked = asked;
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * Math.PI * 2;
        __s.spawnEnemy('drone', __s.player.x + Math.cos(t) * 170, __s.player.y + Math.sin(t) * 170);
      }
    });
    await page.evaluate((special) => __s.specials.setTier(special, 3), id);
    await page.waitForFunction((want) => (window as any).__asked.includes(want), sound, { timeout: NEXT_FRAME_TIMEOUT });
    expect(problems).toEqual([]);
  });

  it('level-up membunyikan stinger dan kartu', async () => {
    await startQuiet();
    await spy();
    await page.evaluate(() => {
      __s.level = 2;
      __s.xp = 1e6;
    });
    await page.waitForFunction(() => __s.state === 'levelup');
    await page.click('.card');
    const ids = await played();
    expect(ids).toContain('stg_levelup');
    expect(ids).toContain('card_appear');
    expect(ids.some((id) => id.startsWith('card_pick'))).toBe(true);
  });
});
