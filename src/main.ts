import * as Phaser from 'phaser';
import './style.css';
import { COLORS, LIGHTING, QUALITY } from './config';
import { gameSize } from './quality';
import { GameScene } from './scenes/GameScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: COLORS.bg,
  ...gameSize(),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Input ditangani lewat DOM (lihat src/input.ts)
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  render: { antialias: true, powerPreference: 'high-performance', maxLights: LIGHTING.maxLights, maxTextures: QUALITY.maxTextures },
  fps: { target: 60 },
  scene: [GameScene],
});

// Buka dengan ?debug untuk mengakses game dari console browser: window.__game
if (import.meta.env.DEV || location.search.includes('debug')) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

// Panel uji dengar suara: buka dengan ?debug&soundtest
if (location.search.includes('soundtest')) void import('./soundtest');

let resizeTimer = 0;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const s = gameSize();
    game.scale.setGameSize(s.width, s.height);
  }, 80);
};
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
