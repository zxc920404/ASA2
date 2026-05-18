import Phaser from 'phaser';
import { GameResult } from '../types/index';

/**
 * GameOverPanel（死亡結算面板）— Polish 6c 美化版
 * 結算報告面板風格：圖示 + 數據兩欄排版 + 圓角按鈕
 */
export class GameOverPanel {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    result: GameResult,
    onReturnToMenu: () => void
  ) {
    this.scene = scene;
    this.createElements(result, onReturnToMenu);
  }

  private createElements(result: GameResult, onReturnToMenu: () => void): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── 全螢幕遮罩 ──────────────────────────────────────────────────────────
    const overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    overlay.fillStyle(0x000000, 0.82);
    overlay.fillRect(0, 0, W, H);
    this.elements.push(overlay);

    // ── 中央面板背景 ────────────────────────────────────────────────────────
    const panelW = W * 0.62;
    const panelH = H * 0.78;
    const panelX = W * 0.5 - panelW / 2;
    const panelY = H * 0.5 - panelH / 2;

    const panelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    panelBg.fillStyle(0x0a0a1a, 0.95);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(2, 0xd4af37, 0.8);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(1, 0xffd700, 0.15);
    panelBg.strokeRoundedRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 8);
    this.elements.push(panelBg);

    // ── 「遊戲結束」標題 ────────────────────────────────────────────────────
    const titleShadow = this.scene.add.text(W * 0.5 + 2, H * 0.14 + 2, '遊戲結束', {
      fontSize: '42px', color: '#660000', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.elements.push(titleShadow);

    const title = this.scene.add.text(W * 0.5, H * 0.14, '遊戲結束', {
      fontSize: '42px', color: '#ff3333', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.elements.push(title);

    // 標題裝飾線
    const titleLine = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    titleLine.lineStyle(1.5, 0xd4af37, 0.6);
    titleLine.lineBetween(W * 0.32, H * 0.20, W * 0.68, H * 0.20);
    this.elements.push(titleLine);

    // ── 結算數據（兩欄排版）────────────────────────────────────────────────
    const totalSec = Math.floor(result.survivalSeconds);
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');

    const dataRows: Array<{ icon: string; label: string; value: string; color: string; x: number; y: number }> = [
      { icon: '⏱', label: '存活時間', value: `${mm}:${ss}`,          color: '#dddddd', x: W * 0.30, y: H * 0.30 },
      { icon: '⚔', label: '擊殺數',   value: `${result.killCount}`,   color: '#ffccaa', x: W * 0.70, y: H * 0.30 },
      { icon: '⭐', label: '最高等級', value: `Lv ${result.maxLevel}`, color: '#aaddff', x: W * 0.30, y: H * 0.42 },
      { icon: '🏆', label: '結算分數', value: `${result.score}`,       color: '#ffffff', x: W * 0.70, y: H * 0.42 },
      { icon: '💰', label: '獲得金幣', value: `${result.coins}`,       color: '#ffd700', x: W * 0.50, y: H * 0.54 },
    ];

    for (const row of dataRows) {
      // 小標籤
      const label = this.scene.add.text(row.x, row.y - 10, `${row.icon} ${row.label}`, {
        fontSize: '12px', color: '#888888',
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(101);
      this.elements.push(label);

      // 數值
      const value = this.scene.add.text(row.x, row.y + 8, row.value, {
        fontSize: '22px', color: row.color, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
      this.elements.push(value);
    }

    // 分隔線
    const midLine = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    midLine.lineStyle(1, 0x333355, 0.8);
    midLine.lineBetween(W * 0.32, H * 0.62, W * 0.68, H * 0.62);
    this.elements.push(midLine);

    // ── 「返回主選單」圓角按鈕 ──────────────────────────────────────────────
    const btnX = W * 0.5;
    const btnY = H * 0.76;
    const btnW = 230;
    const btnH = 56;
    const r = 8;

    const btnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawReturnBtn(btnGraphics, btnX, btnY, btnW, btnH, r, false);
    this.elements.push(btnGraphics);

    const btnText = this.scene.add.text(btnX, btnY, '返回主選單', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.elements.push(btnText);

    const hitH = Math.max(btnH, 48);
    const hitArea = this.scene.add.rectangle(btnX, btnY, Math.max(btnW, 88), hitH, 0x000000, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });
    this.elements.push(hitArea);

    hitArea.on('pointerover', () => {
      this.drawReturnBtn(btnGraphics, btnX, btnY, btnW, btnH, r, true);
      btnText.setColor('#ffd700');
    });
    hitArea.on('pointerout', () => {
      this.drawReturnBtn(btnGraphics, btnX, btnY, btnW, btnH, r, false);
      btnText.setColor('#ffffff');
    });
    hitArea.on('pointerdown', () => onReturnToMenu());
  }

  private drawReturnBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number,
    hovered: boolean
  ): void {
    g.clear();
    g.fillStyle(hovered ? 0x8b1a1a : 0x6b0f0f, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    g.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  public destroy(): void {
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
  }
}
