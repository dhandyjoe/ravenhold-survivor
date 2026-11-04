import * as Phaser from 'phaser';
import './style.css';
import { COLORS } from './config';
import { GameScene } from './scenes/GameScene';

/**
 * Canvas dibuat seukuran layar x devicePixelRatio (maks 2) supaya tajam di HP,
 * lalu Scale.FIT mengecilkannya kembali ke ukuran layar.
 */
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const size = () => ({
  width: Math.round(window.innerWidth * dpr()),
  height: Math.round(window.innerHeight * dpr()),
});

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: COLORS.bg,
  ...size(),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Input ditangani lewat DOM (lihat src/input.ts)
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [GameScene],
});

// Buka dengan ?debug untuk mengakses game dari console browser: window.__game
if (import.meta.env.DEV || location.search.includes('debug')) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

let resizeTimer = 0;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const s = size();
    game.scale.setGameSize(s.width, s.height);
  }, 80);
};
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
