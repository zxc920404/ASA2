import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MapSelectScene } from './scenes/MapSelectScene';
import { GameScene } from './scenes/GameScene';
import { MetaUpgradeScene } from './scenes/MetaUpgradeScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, MainMenuScene, CharacterSelectScene, MapSelectScene, GameScene, MetaUpgradeScene],
  scale: {
    // RESIZE：canvas 跟隨視口大小，消除黑邊
    // 各 Scene 在 create() 中用 this.scale.width / height 取得實際尺寸
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: document.body,
    // 最小尺寸保護：避免極端比例破版
    min: { width: 480, height: 270 },
    // 最大尺寸保護：超大螢幕不過度放大
    max: { width: 1920, height: 1080 },
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);
