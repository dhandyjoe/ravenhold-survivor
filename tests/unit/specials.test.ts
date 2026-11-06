import { beforeEach, describe, expect, it } from 'vitest';
import { SPECIALS, SPECIAL_FX } from '../../src/config';
import { SpecialWeapons, type SpecialHost, type SpecialTarget } from '../../src/specials';

/** Dunia palsu berisi musuh diam, untuk menguji jadwal dan kerusakan pusaka tanpa WebGL. */
function world(positions: [number, number][]) {
  const enemies: SpecialTarget[] = positions.map(([x, y], id) => ({ id, img: { x, y }, radius: 11, alive: true }));
  const hits: Record<number, number[]> = {};
  const healed: number[] = [];
  const pushes: { id: number; kx: number; force: number }[] = [];
  const slows: { id: number; factor: number; seconds: number }[] = [];
  const sounds: string[] = [];
  const host: SpecialHost = {
    player: { x: 0, y: 0 } as SpecialHost['player'],
    fx: { spawn: () => ({ rotation: 0 }), update: () => {}, clear: () => {}, activeCount: 0 } as unknown as SpecialHost['fx'],
    hpMul: () => 1,
    damageMul: () => 1,
    enemies: () => enemies,
    eachInRadius: (x, y, r, fn) => {
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.img.x - x;
        const dy = e.img.y - y;
        const d = Math.hypot(dx, dy);
        if (d < r + e.radius) fn(e, d, dx / (d || 1), dy / (d || 1));
      }
    },
    densest: (range, out) => {
      const e = enemies.find((o) => o.alive && Math.hypot(o.img.x, o.img.y) <= range);
      if (!e) return false;
      out.x = e.img.x;
      out.y = e.img.y;
      return true;
    },
    hit: (e, damage) => {
      (hits[e.id] ??= []).push(damage);
    },
    push: (e, kx, _ky, force) => {
      pushes.push({ id: e.id, kx, force });
    },
    slow: (e, factor, seconds) => {
      slows.push({ id: e.id, factor, seconds });
    },
    heal: (amount) => {
      healed.push(amount);
    },
    debris: () => {},
    shake: () => {},
    slowMotion: () => {},
    flash: () => {},
    sound: (id) => {
      sounds.push(id);
    },
    loop: (id) => {
      sounds.push(id);
    },
  };
  return { host, enemies, hits, healed, pushes, slows, sounds, weapons: new SpecialWeapons(host) };
}

const run = (w: SpecialWeapons, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) w.update(dt);
};

describe('jadwal pusaka', () => {
  let w: ReturnType<typeof world>;
  beforeEach(() => {
    w = world([[50, 0]]);
  });

  it('langsung menembak setelah diambil, lalu menunggu jeda penuh', () => {
    w.weapons.setTier('meteor', 1);
    run(w.weapons, SPECIAL_FX.meteorFall + 0.2 + 0.02);
    const first = w.hits[0][0];
    expect(first).toBe(SPECIALS.meteor[0].damage);
    expect(w.weapons.readiness('meteor')).toBeLessThan(0.2);
  });

  it('kesiapan terisi perlahan sampai satu', () => {
    w.weapons.setTier('thunder', 1);
    run(w.weapons, 0.3);
    const early = w.weapons.readiness('thunder');
    run(w.weapons, SPECIALS.thunder[0].cooldown / 2);
    expect(w.weapons.readiness('thunder')).toBeGreaterThan(early);
  });

  it('tanpa sasaran tidak terbuang: menahan tembakan sampai ada musuh', () => {
    const empty = world([]);
    empty.weapons.setTier('meteor', 1);
    run(empty.weapons, 3);
    empty.enemies.push({ id: 0, img: { x: 40, y: 0 }, radius: 11, alive: true });
    run(empty.weapons, SPECIAL_FX.meteorFall + 0.5);
    expect(empty.hits[0][0]).toBe(SPECIALS.meteor[0].damage);
  });

  it('reset menghapus semua serangan yang masih terjadwal', () => {
    w.weapons.setTier('meteor', 1);
    run(w.weapons, 0.3);
    w.weapons.reset();
    run(w.weapons, 3);
    expect(w.hits[0]).toBeUndefined();
    expect(w.weapons.owned).toEqual([]);
  });
});

describe('bintang jatuh', () => {
  it('meledak di area lalu kawahnya membakar musuh yang masih di sana', () => {
    const w = world([[0, 0]]);
    w.weapons.setTier('meteor', 1);
    run(w.weapons, SPECIAL_FX.meteorFall + 0.2 + SPECIAL_FX.craterLife);
    const [blast, ...burns] = w.hits[0];
    expect(blast).toBe(SPECIALS.meteor[0].damage);
    expect(burns.length).toBeGreaterThanOrEqual(3);
    for (const b of burns) expect(b).toBeCloseTo(blast * SPECIAL_FX.burnDamage);
  });

  it('tidak melukai musuh di luar ledakan', () => {
    const w = world([[0, 0], [900, 0]]);
    w.weapons.setTier('meteor', 1);
    run(w.weapons, SPECIAL_FX.meteorFall + 0.3);
    expect(w.hits[1]).toBeUndefined();
  });
});

describe('tebasan bulan', () => {
  it('setiap gelombang mengenai tiap musuh tepat sekali, di seluruh jangkauannya', () => {
    const w = world([[80, 0], [-300, 40], [0, 440]]);
    w.weapons.setTier('moon', 1);
    run(w.weapons, 1.2);
    for (const id of [0, 1, 2]) expect(w.hits[id], `musuh ${id}`).toHaveLength(SPECIALS.moon[0].count);
  });

  it('tingkat lebih tinggi mengirim lebih banyak gelombang', () => {
    const w = world([[80, 0]]);
    w.weapons.setTier('moon', 3);
    run(w.weapons, 2.2);
    expect(w.hits[0]).toHaveLength(SPECIALS.moon[2].count);
  });
});

describe('hujan panah dan murka petir', () => {
  it('hujan panah mengenai musuh berkali-kali selama durasinya', () => {
    const w = world([[60, 0]]);
    w.weapons.setTier('rain', 1);
    run(w.weapons, SPECIAL_FX.rainDuration + SPECIAL_FX.rainFall + 0.2);
    expect(w.hits[0].length).toBeGreaterThan(10);
  });

  it('petir hanya menyambar sebanyak jumlahnya, dan melukai yang berdekatan', () => {
    const w = world([[60, 0], [100, 0]]);
    w.weapons.setTier('thunder', 1);
    run(w.weapons, SPECIALS.thunder[0].count * SPECIAL_FX.thunderGap + 0.3);
    expect(w.hits[0].length).toBeGreaterThanOrEqual(1);
    expect(w.hits[1].length).toBeGreaterThanOrEqual(1);
    expect(w.hits[0].length + w.hits[1].length).toBeLessThanOrEqual(SPECIALS.thunder[0].count * 2);
  });
});

describe('kawanan gagak', () => {
  it('memburu dan mematuk musuh berkali-kali selama hidupnya, lalu menghilang', () => {
    const w = world([[120, 0]]);
    w.weapons.setTier('ravens', 1);
    run(w.weapons, SPECIAL_FX.ravenLife);
    expect(w.hits[0].length).toBeGreaterThan(SPECIALS.ravens[0].count);
    expect(w.hits[0][0]).toBe(SPECIALS.ravens[0].damage);
    run(w.weapons, 1);
    const after = w.hits[0].length;
    w.enemies[0].alive = false;
    run(w.weapons, 0.5);
    expect(w.hits[0].length).toBe(after);
  });

  it('gagak yang kehilangan sasaran mencari yang lain', () => {
    const w = world([[80, 0], [-80, 0]]);
    w.weapons.setTier('ravens', 1);
    run(w.weapons, 0.8);
    w.enemies[0].alive = false;
    const before = w.hits[1]?.length ?? 0;
    run(w.weapons, 1.5);
    expect(w.hits[1].length).toBeGreaterThan(before);
  });
});

describe('pusaran badai', () => {
  it('menarik musuh ke pusat dan melukai secara berkala', () => {
    const w = world([[80, 0]]);
    w.weapons.setTier('tornado', 1);
    run(w.weapons, SPECIAL_FX.tornadoLife);
    expect(w.hits[0].length).toBeGreaterThanOrEqual(3);
    expect(w.pushes.length).toBeGreaterThan(30);
  });

  it('berhenti setelah umurnya habis', () => {
    const w = world([[80, 0]]);
    w.weapons.setTier('tornado', 1);
    run(w.weapons, SPECIAL_FX.tornadoLife + 0.3);
    const count = w.pushes.length;
    w.enemies[0].img.x = 9000;
    run(w.weapons, 1);
    expect(w.pushes.length).toBe(count);
  });
});

describe('lingkar api', () => {
  it('membakar musuh di cincin berulang kali, tetapi tidak yang tepat di tengah', () => {
    const r = SPECIALS.flames[0].radius;
    const w = world([[r, 0], [0, 0]]);
    w.weapons.setTier('flames', 1);
    run(w.weapons, SPECIAL_FX.flamesLife);
    expect(w.hits[0].length).toBeGreaterThan(3);
    expect(w.hits[1]).toBeUndefined();
  });
});

describe('cahaya suci', () => {
  it('melukai musuh di sekitar dan memulihkan pemain sekali per denyut', () => {
    const w = world([[100, 0]]);
    w.weapons.setTier('holy', 3);
    run(w.weapons, SPECIAL_FX.holyGap * 3);
    expect(w.healed).toEqual([SPECIAL_FX.holyHeal, SPECIAL_FX.holyHeal, SPECIAL_FX.holyHeal]);
    expect(w.hits[0]).toHaveLength(3);
  });
});

describe('badai es', () => {
  it('membekukan musuh dulu, lalu esnya pecah dan melukai', () => {
    const w = world([[100, 0]]);
    w.weapons.setTier('frost', 1);
    const seconds = SPECIALS.frost[0].count;
    run(w.weapons, 0.3);
    expect(w.slows).toEqual([{ id: 0, factor: 0, seconds }]);
    expect(w.hits[0]).toBeUndefined();
    run(w.weapons, seconds);
    expect(w.hits[0]).toEqual([SPECIALS.frost[0].damage]);
  });
});

describe('gempa bumi', () => {
  it('retakan menjalar keluar: yang dekat kena lebih dulu daripada yang jauh', () => {
    const w = world([[60, 0], [280, 0]]);
    w.weapons.setTier('quake', 3);
    run(w.weapons, SPECIAL_FX.quakeGap * 2 + 0.2);
    const near = w.hits[0]?.length ?? 0;
    const far = w.hits[1]?.length ?? 0;
    expect(near).toBeGreaterThan(far);
    run(w.weapons, 1);
    expect(w.hits[1].length).toBeGreaterThan(0);
  });

  it('jangkauannya terbatas', () => {
    const w = world([[1200, 0], [60, 0]]);
    w.weapons.setTier('quake', 1);
    run(w.weapons, 1.5);
    expect(w.hits[0]).toBeUndefined();
  });
});
