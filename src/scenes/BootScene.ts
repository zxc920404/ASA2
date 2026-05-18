import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 預載入資源（目前為空，後續任務加入）
  }

  create(): void {
    // 啟動完成後切換至 MainMenuScene
    this.scene.start('MainMenuScene');
  }
}
