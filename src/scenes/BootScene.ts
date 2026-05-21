import Phaser from 'phaser';
import { AssetLoader } from '../utils/AssetLoader';
import { FONT_FAMILY } from '../ui/UIStyles';

/**
 * BootScene — 啟動場景
 *
 * 只載入最小必要資源（群組 1：SFX + 主選單背景 + 主選單 BGM），
 * 顯示簡單的 loading 進度條，避免黑屏。
 * 載入完成後切換至 MainMenuScene。
 *
 * 宗門圖示、武器圖示、敵人 sprite、戰鬥 BGM 等資源
 * 改由各自的場景在進入時才載入（延遲載入）。
 */
export class BootScene extends Phaser.Scene {
  private loadingText!: Phaser.GameObjects.Text;
  private progressBarBg!: Phaser.GameObjects.Graphics;
  private progressBarFg!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── 黑色底色（避免白屏閃爍）──────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x020810, 1);
    bg.fillRect(0, 0, W, H);

    // ── Loading 文字 ──────────────────────────────────────────────────
    this.loadingText = this.add.text(
      Math.round(W / 2),
      Math.round(H / 2) - 30,
      '載入中...',
      {
        fontSize: '18px',
        color: '#d4af37',
        fontFamily: FONT_FAMILY,
        resolution: 2,
      }
    ).setOrigin(0.5, 0.5);

    // ── 進度條背景 ────────────────────────────────────────────────────
    const barW = Math.round(Math.min(W * 0.55, 280));
    const barH = 8;
    const barX = Math.round(W / 2 - barW / 2);
    const barY = Math.round(H / 2) + 4;

    this.progressBarBg = this.add.graphics();
    this.progressBarBg.fillStyle(0x1a1a2e, 1);
    this.progressBarBg.fillRoundedRect(barX, barY, barW, barH, 4);
    this.progressBarBg.lineStyle(1, 0x333355, 0.8);
    this.progressBarBg.strokeRoundedRect(barX, barY, barW, barH, 4);

    this.progressBarFg = this.add.graphics();

    // ── 進度條更新 ────────────────────────────────────────────────────
    this.load.on('progress', (value: number) => {
      this.progressBarFg.clear();
      const fillW = Math.max(6, Math.round(barW * value));
      this.progressBarFg.fillStyle(0xd4af37, 0.9);
      this.progressBarFg.fillRoundedRect(barX, barY, fillW, barH, 4);

      // 進度文字
      const pct = Math.round(value * 100);
      this.loadingText.setText(`載入中... ${pct}%`);
    });

    // ── 載入失敗靜默處理（不讓 console error 影響遊戲流程）──────────
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[AssetLoader] 資源載入失敗（已 fallback）: ${file.key} → ${file.url}`);
    });

    // ── 只載入啟動必要資源（群組 1）──────────────────────────────────
    AssetLoader.preloadCritical(this);
  }

  create(): void {
    // 進度條填滿後短暫停留再切換，避免閃爍
    this.time.delayedCall(120, () => {
      this.scene.start('MainMenuScene');
    });
  }
}
