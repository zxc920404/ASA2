import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MapSelectScene } from './scenes/MapSelectScene';
import { GameScene } from './scenes/GameScene';
import { MetaUpgradeScene } from './scenes/MetaUpgradeScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, CharacterSelectScene, MapSelectScene, GameScene, MetaUpgradeScene],
  scale: {
    // RESIZE：canvas 跟隨視口大小，直屏 portrait 模式
    // 使用 window.innerWidth / innerHeight 確保 canvas 從 (0,0) 開始吃滿整個螢幕
    // 包含狀態列後方區域（Android windowTranslucentStatus 模式下有效）
    mode: Phaser.Scale.RESIZE,
    parent: document.body,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);
