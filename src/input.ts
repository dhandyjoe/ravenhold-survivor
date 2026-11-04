/**
 * Input pakai DOM biasa (bukan input Phaser), supaya joystick dan keyboard
 * tidak terpengaruh scaling canvas.
 * - Desktop: WASD / tombol panah. Esc atau P untuk jeda.
 * - Mobile (dan mouse): sentuh di mana saja lalu geser = joystick melayang.
 */
export class Controls {
  private keys = new Set<string>();
  private joyActive = false;
  private joyId = -1;
  private originX = 0;
  private originY = 0;
  private jx = 0;
  private jy = 0;
  private readonly maxDist = 52;
  enabled = false;
  onPause: () => void = () => {};

  constructor(
    private layer: HTMLElement,
    private base: HTMLElement,
    private knob: HTMLElement,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.enabled) this.onPause();
        return;
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });

    layer.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joyActive) return;
      e.preventDefault();
      this.joyActive = true;
      this.joyId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.jx = this.jy = 0;
      layer.setPointerCapture(e.pointerId);
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.base.classList.add('on');
    });
    layer.addEventListener('pointermove', (e) => {
      if (!this.joyActive || e.pointerId !== this.joyId) return;
      let dx = e.clientX - this.originX;
      let dy = e.clientY - this.originY;
      const d = Math.hypot(dx, dy);
      if (d > this.maxDist) {
        // Joystick "ikut" jari kalau ditarik terlalu jauh
        const over = d - this.maxDist;
        this.originX += (dx / d) * over;
        this.originY += (dy / d) * over;
        dx = e.clientX - this.originX;
        dy = e.clientY - this.originY;
        this.base.style.transform = `translate(${this.originX}px, ${this.originY}px)`;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const n = Math.hypot(dx, dy) / this.maxDist;
      this.jx = n < 0.12 ? 0 : dx / this.maxDist;
      this.jy = n < 0.12 ? 0 : dy / this.maxDist;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.joyId) this.release();
    };
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
  }

  release() {
    this.joyActive = false;
    this.joyId = -1;
    this.jx = this.jy = 0;
    this.base.classList.remove('on');
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.layer.classList.toggle('active', on);
    if (!on) this.release();
  }

  /** Vektor gerak, panjang 0..1 */
  vector(out: { x: number; y: number }) {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.joyActive && (this.jx !== 0 || this.jy !== 0)) {
      x = this.jx;
      y = this.jy;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    out.x = x;
    out.y = y;
    return out;
  }
}
