import { describe, expect, it } from 'vitest';
import { DAY_CYCLE, LIGHTING, RUN_SECONDS } from '../../src/config';
import { Lighting, createDayState, sampleDay } from '../../src/lighting';

describe('data siklus waktu', () => {
  it('urut, mulai dari nol, dan mencakup seluruh ronde', () => {
    expect(DAY_CYCLE[0].t).toBe(0);
    expect(DAY_CYCLE[DAY_CYCLE.length - 1].t).toBeGreaterThanOrEqual(RUN_SECONDS);
    for (let i = 1; i < DAY_CYCLE.length; i++) expect(DAY_CYCLE[i].t).toBeGreaterThan(DAY_CYCLE[i - 1].t);
  });

  it('warna dalam skala 0..1, siap dikirim ke shader', () => {
    for (const k of DAY_CYCLE) {
      for (const v of [...k.ambient, ...k.sun]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('sampleDay', () => {
  const brightness = (t: number) => {
    const d = createDayState();
    sampleDay(t, d);
    return d.ambient[0] + d.ambient[1] + d.ambient[2];
  };

  it('tepat di titik kunci, nilainya sama dengan titik kunci', () => {
    for (const key of DAY_CYCLE) {
      const d = createDayState();
      sampleDay(key.t, d);
      expect(d.ambient).toEqual(key.ambient);
      expect(d.lantern).toBeCloseTo(key.lantern);
    }
  });

  it('di antara dua titik kunci, nilainya tepat di tengah', () => {
    const [a, b] = [DAY_CYCLE[0], DAY_CYCLE[1]];
    const d = createDayState();
    sampleDay((a.t + b.t) / 2, d);
    expect(d.sunPower).toBeCloseTo((a.sunPower + b.sunPower) / 2);
    expect(d.ambient[0]).toBeCloseTo((a.ambient[0] + b.ambient[0]) / 2);
  });

  it('malam lebih gelap dari siang, dan lentera menyala saat malam saja', () => {
    expect(brightness(800)).toBeLessThan(brightness(60) * 0.6);
    const day = createDayState();
    const night = createDayState();
    sampleDay(60, day);
    sampleDay(800, night);
    expect(day.lantern).toBe(0);
    expect(night.lantern).toBeGreaterThan(1);
  });

  it('senja jatuh di menit 6-10,5 dan malam mulai menit ke-10,5, sesuai rencana', () => {
    expect(brightness(360)).toBeGreaterThan(brightness(630));
    expect(brightness(630)).toBeLessThan(brightness(495));
    expect(brightness(630)).toBeCloseTo(brightness(900), 0);
  });

  it('di luar rentang tidak menghasilkan nilai liar', () => {
    const d = createDayState();
    sampleDay(99999, d);
    expect(d.ambient).toEqual(DAY_CYCLE[DAY_CYCLE.length - 1].ambient);
    sampleDay(-5, d);
    expect(d.ambient).toEqual(DAY_CYCLE[0].ambient);
  });

  it('memakai ulang array yang sama (tanpa alokasi per frame) dan tidak merusak data sumber', () => {
    const d = createDayState();
    const { ambient, sun } = d;
    const original = [...DAY_CYCLE[0].ambient];
    sampleDay(500, d);
    expect(d.ambient).toBe(ambient);
    expect(d.sun).toBe(sun);
    expect(DAY_CYCLE[0].ambient).toEqual(original);
  });
});

describe('Lighting', () => {
  function create() {
    const lights: { x: number; y: number; intensity: number; color: { r: number; g: number; b: number; set: (r: number, g: number, b: number) => void } }[] = [];
    const manager = {
      ambient: -1,
      enabled: false,
      enable() {
        this.enabled = true;
      },
      disable() {
        this.enabled = false;
      },
      setAmbientColor(c: number) {
        this.ambient = c;
      },
      addLight(x: number, y: number) {
        const color = {
          r: 1,
          g: 0.72,
          b: 0.41,
          set(r: number, g: number, b: number) {
            this.r = r;
            this.g = g;
            this.b = b;
          },
        };
        const light = { x, y, intensity: 0, color };
        lights.push(light);
        return light;
      },
    };
    const lighting = new Lighting({ lights: manager } as never);
    return { lighting, manager, sun: lights[0], lantern: lights[1] };
  }

  it('matahari mengikuti kamera pada sudutnya, lentera mengikuti pemain', () => {
    const { lighting, sun, lantern } = create();
    const d = createDayState();
    sampleDay(500, d);
    lighting.update(d, 1000, -200, 40, 50);
    expect(sun.x).toBeCloseTo(1000 + Math.cos(d.sunAngle) * LIGHTING.sunDistance);
    expect(sun.y).toBeCloseTo(-200 + Math.sin(d.sunAngle) * LIGHTING.sunDistance);
    expect([lantern.x, lantern.y]).toEqual([40, 50]);
    expect(lantern.intensity).toBe(d.lantern);
  });

  it('data untuk shader tanah sama dengan lampu sprite, dan tanah menerima lebih redup', () => {
    const { lighting, lantern } = create();
    const d = createDayState();
    sampleDay(500, d);
    lighting.update(d, 0, 0, 40, 50);
    expect([...lighting.groundPos.slice(0, 3)]).toEqual([40, 50, LIGHTING.lanternRadius]);
    expect(lighting.groundColor[0]).toBeCloseTo(lantern.color.r * d.lantern * LIGHTING.lanternOnGround);
    expect(lighting.groundColor[0]).toBeLessThan(lantern.color.r * d.lantern);
    expect(lighting.groundPos).toHaveLength(LIGHTING.maxLights * 3);
  });

  it('warna ambient dikirim sebagai integer RGB yang benar', () => {
    const { lighting, manager } = create();
    const d = createDayState();
    d.ambient[0] = 1;
    d.ambient[1] = 0.5;
    d.ambient[2] = 0;
    lighting.update(d, 0, 0, 0, 0);
    expect(manager.ambient).toBe(0xff8000);
  });

  it('toggle menyalakan dan mematikan pengelola lampu', () => {
    const { lighting, manager } = create();
    expect(manager.enabled).toBe(true);
    lighting.setEnabled(false);
    expect(manager.enabled).toBe(false);
    lighting.setEnabled(true);
    expect(manager.enabled).toBe(true);
  });
});
