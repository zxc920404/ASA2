import Phaser from 'phaser';
import { AssetLoader } from '../utils/AssetLoader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 載入所有美術資源（PNG 不存在時不崩潰，顯示端自行 fallback）
    AssetLoader.preloadAll(this);

    // 載入失敗時靜默忽略（不讓 console error 影響遊戲流程）
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[AssetLoader] 圖片載入失敗（已 fallback）: ${file.key} → ${file.url}`);
    });
  }

  create(): void {
    // 啟動完成後切換至 MainMenuScene
    this.scene.start('MainMenuScene');
  }
}
