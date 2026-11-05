import * as Phaser from 'phaser';
import { DAY_CYCLE, LIGHTING, type DayKey } from './config';

/** Keadaan siklus waktu saat ini. Satu objek dipakai ulang, tidak ada alokasi per frame. */
export interface DayState extends Omit<DayKey, 't'> {}

export function createDayState(): DayState {
  const k = DAY_CYCLE[0];
  return { ...k, ambient: [...k.ambient], sun: [...k.sun] };
}

export function sampleDay(t: number, out: DayState) {
  let i = 0;
  while (i < DAY_CYCLE.length - 2 && t >= DAY_CYCLE[i + 1].t) i++;
  const a = DAY_CYCLE[i];
  const b = DAY_CYCLE[i + 1];
  const f = Phaser.Math.Clamp((t - a.t) / (b.t - a.t), 0, 1);
  const l = (x: number, y: number) => x + (y - x) * f;
  for (let c = 0; c < 3; c++) {
    out.ambient[c] = l(a.ambient[c], b.ambient[c]);
    out.sun[c] = l(a.sun[c], b.sun[c]);
  }
  out.sunPower = l(a.sunPower, b.sunPower);
  out.sunAngle = l(a.sunAngle, b.sunAngle);
  out.shadowLength = l(a.shadowLength, b.shadowLength);
  out.shadowAlpha = l(a.shadowAlpha, b.shadowAlpha);
  out.cloud = l(a.cloud, b.cloud);
  out.lantern = l(a.lantern, b.lantern);
}

const toInt = (r: number, g: number, b: number) =>
  (Math.round(Phaser.Math.Clamp(r, 0, 1) * 255) << 16) | (Math.round(Phaser.Math.Clamp(g, 0, 1) * 255) << 8) | Math.round(Phaser.Math.Clamp(b, 0, 1) * 255);

/**
 * Pengelola lampu: matahari/bulan dan lentera pemain. Posisi dan warnanya juga disalin
 * ke array untuk shader tanah, sehingga tanah dan sprite diterangi oleh lampu yang sama.
 */
export class Lighting {
  private sun: Phaser.GameObjects.Light;
  private lantern: Phaser.GameObjects.Light;
  private bossLight: Phaser.GameObjects.Light;
  private flashLight: Phaser.GameObjects.Light;
  private flashPower = 0;
  private flashPeak = 1;
  private manager: Phaser.GameObjects.LightsManager;

  readonly groundPos = new Float32Array(LIGHTING.maxLights * 3);
  readonly groundColor = new Float32Array(LIGHTING.maxLights * 3);
  readonly ambient = [1, 1, 1];
  readonly sunOnGround = [0, 0, 0];

  constructor(scene: Phaser.Scene) {
    this.manager = scene.lights;
    this.manager.enable();
    this.sun = this.manager.addLight(0, 0, LIGHTING.sunRadius, 0xffffff, 1, LIGHTING.sunHeight);
    this.lantern = this.manager.addLight(0, 0, LIGHTING.lanternRadius, LIGHTING.lanternColor, 0, LIGHTING.lanternHeight);
    this.bossLight = this.manager.addLight(0, 0, LIGHTING.bossRadius, 0xffffff, 0, LIGHTING.lanternHeight);
    this.flashLight = this.manager.addLight(0, 0, 1, 0xffffff, 0, LIGHTING.lanternHeight);
  }

  /** Kilatan sesaat dari senjata pusaka. Kilatan baru menggantikan yang lama. */
  flash(x: number, y: number, color: number, power: number, radius: number) {
    const f = this.flashLight;
    f.x = x;
    f.y = y;
    f.radius = radius;
    f.setColor(color);
    this.flashPower = power;
    this.flashPeak = power;
  }

  /** Cahaya yang mengikuti bos. `power` 0 untuk mematikan. */
  setBossLight(x: number, y: number, color: number, power: number) {
    const b = this.bossLight;
    b.x = x;
    b.y = y;
    b.intensity = power;
    if (power > 0) b.setColor(color);
  }

  /** Meredupkan kilatan. Dipanggil dari loop utama, jadi ikut berhenti saat jeda. */
  tick(dt: number) {
    if (this.flashPower <= 0) return;
    this.flashPower = Math.max(0, this.flashPower - (this.flashPeak * dt) / LIGHTING.flashSeconds);
    this.flashLight.intensity = this.flashPower;
  }

  clearFlash() {
    this.flashPower = 0;
    this.flashLight.intensity = 0;
  }

  setEnabled(on: boolean) {
    if (on) this.manager.enable();
    else this.manager.disable();
  }

  update(day: DayState, camX: number, camY: number, px: number, py: number) {
    this.manager.setAmbientColor(toInt(day.ambient[0], day.ambient[1], day.ambient[2]));
    this.sun.x = camX + Math.cos(day.sunAngle) * LIGHTING.sunDistance;
    this.sun.y = camY + Math.sin(day.sunAngle) * LIGHTING.sunDistance;
    this.sun.color.set(day.sun[0], day.sun[1], day.sun[2]);
    this.sun.intensity = day.sunPower;

    this.lantern.x = px;
    this.lantern.y = py;
    this.lantern.intensity = day.lantern;

    // Sprite menerima cahaya matahari sebesar faktor difus permukaan datar; tanah mengikutinya.
    const flat = LIGHTING.sunHeight / Math.hypot(LIGHTING.sunHeight, LIGHTING.sunDistance);
    for (let c = 0; c < 3; c++) {
      this.ambient[c] = day.ambient[c];
      this.sunOnGround[c] = day.sun[c] * day.sunPower * flat;
    }

    this.groundPos[0] = px;
    this.groundPos[1] = py;
    this.groundPos[2] = LIGHTING.lanternRadius;
    // Tanah menerima lebih sedikit daripada sprite, supaya karakter tetap menonjol di dalam cahaya
    const lc = this.lantern.color;
    const onGround = day.lantern * LIGHTING.lanternOnGround;
    this.groundColor[0] = lc.r * onGround;
    this.groundColor[1] = lc.g * onGround;
    this.groundColor[2] = lc.b * onGround;

    this.copyToGround(1, this.bossLight);
    this.copyToGround(2, this.flashLight);
  }

  private copyToGround(slot: number, light: Phaser.GameObjects.Light) {
    const i = slot * 3;
    const on = light.intensity * LIGHTING.lanternOnGround;
    this.groundPos[i] = light.x;
    this.groundPos[i + 1] = light.y;
    this.groundPos[i + 2] = Math.max(1, light.radius);
    this.groundColor[i] = light.color.r * on;
    this.groundColor[i + 1] = light.color.g * on;
    this.groundColor[i + 2] = light.color.b * on;
  }
}
