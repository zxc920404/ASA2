import Phaser from 'phaser';
import { Player } from '../objects/Player';

/**
 * PlayerStatusPanel
 * 點擊「屬」按鈕後顯示的玩家屬性面板（兩欄緊湊排版）
 * 左欄：角色、等級、HP、移動速度、拾取範圍
 * 右欄：武器/被動數量、攻擊力、攻擊範圍、攻擊速度
 * 底部：暫停提示小字
 * 不再列出完整武器/被動清單（由左右常駐欄顯示）
 * 關閉時呼叫 onCloseCallback，讓 GameScene 恢復遊戲
 */
export class PlayerStatusPanel {
  private scene: Phaser.Scene;

  private overlay!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private divider!: Phaser.GameObjects.Graphics;
  private closeBtn!: Phaser.GameObjects.Text;
  private closeBtnHit!: Phaser.GameObjects.Rectangle;
  private pauseHintText!: Phaser.GameObjects.Text;

  // 左欄文字（最多 6 行）
  private leftTexts: Phaser.GameObjects.Text[] = [];
  // 右欄文字（最多 6 行）
  private rightTexts: Phaser.GameObjects.Text[] = [];

  private isVisible: boolean = false;
  private onCloseCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.hide();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // 面板尺寸：寬度 44%，高度 50%（比前版更緊湊）
    const panelW = Math.min(W * 0.44, 280);
    const panelH = H * 0.50;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    // ── 半透明遮罩（點擊關閉）──────────────────────────────────────────
    this.overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.38)
      .setScrollFactor(0).setDepth(50).setInteractive();
    this.overlay.on('pointerdown', () => this.close());

    // ── 面板背景 ────────────────────────────────────────────────────────
    this.panelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(51);
    this.panelBg.fillStyle(0x081408, 0.97);
    this.panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.panelBg.lineStyle(1.5, 0xd4af37, 0.7);
    this.panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    // ── 標題 ────────────────────────────────────────────────────────────
    this.titleText = this.scene.add.text(
      panelX + panelW / 2, panelY + 12,
      '玩家屬性',
      { fontSize: '14px', color: '#ffd700', fontStyle: 'bold' }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(52);

    // ── 標題分隔線 ──────────────────────────────────────────────────────
    this.divider = this.scene.add.graphics().setScrollFactor(0).setDepth(52);
    this.divider.lineStyle(1, 0xd4af37, 0.30);
    this.divider.lineBetween(panelX + 10, panelY + 34, panelX + panelW - 10, panelY + 34);

    // ── 關閉按鈕（右上角 ✕）────────────────────────────────────────────
    this.closeBtn = this.scene.add.text(
      panelX + panelW - 10, panelY + 8,
      '✕',
      { fontSize: '14px', color: '#777777' }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(52);

    this.closeBtnHit = this.scene.add.rectangle(
      panelX + panelW - 10, panelY + 8, 48, 48, 0x000000, 0
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(53).setInteractive({ useHandCursor: true });
    this.closeBtnHit.on('pointerdown', () => this.close());

    // ── 左欄文字（6 行，每行同一行顯示標籤+值）────────────────────────
    const leftX = panelX + 12;
    const rightX = panelX + panelW / 2 + 6;
    const rowH = 24;
    const startY = panelY + 42;

    for (let i = 0; i < 6; i++) {
      const t = this.scene.add.text(leftX, startY + i * rowH, '', {
        fontSize: '12px', color: '#cccccc',
      }).setScrollFactor(0).setDepth(52);
      this.leftTexts.push(t);
    }

    // ── 右欄文字（6 行）────────────────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const t = this.scene.add.text(rightX, startY + i * rowH, '', {
        fontSize: '12px', color: '#cccccc',
      }).setScrollFactor(0).setDepth(52);
      this.rightTexts.push(t);
    }

    // ── 底部暫停提示小字 ────────────────────────────────────────────────
    this.pauseHintText = this.scene.add.text(
      panelX + panelW / 2, panelY + panelH - 12,
      '查看屬性中，遊戲已暫停',
      { fontSize: '10px', color: '#666666' }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(52);
  }

  /**
   * 顯示面板並填入玩家資料
   * @param player 玩家物件
   * @param characterName 角色名稱
   * @param onClose 關閉時的回呼（用於恢復遊戲）
   */
  public show(player: Player, characterName: string, onClose?: () => void): void {
    this.isVisible = true;
    this.onCloseCallback = onClose ?? null;

    const stats = player.stats;
    const weaponCount = player.equipment.weapons.length;
    const passiveCount = player.equipment.passives.length;

    // ── 左欄：角色、等級、HP、移動速度、拾取範圍 ──────────────────────
    const leftLines = [
      `角色：${characterName}`,
      `等級：Lv.${player.level}`,
      `HP：${Math.ceil(player.currentHP)}/${stats.maxHP}`,
      `移速：${Math.round(stats.moveSpeed)}`,
      `拾取：${Math.round(stats.pickupRange)} px`,
      ``,
    ];

    // ── 右欄：武器/被動數量、攻擊力、攻擊範圍、攻擊速度 ──────────────
    const rightLines = [
      `武器：${weaponCount}/6`,
      `被動：${passiveCount}/6`,
      `攻擊力：×${stats.attackPower.toFixed(2)}`,
      `攻擊範圍：×${(stats.attackRange / 120).toFixed(2)}`,
      `攻擊速度：×${(1 / stats.attackInterval).toFixed(2)}`,
      ``,
    ];

    for (let i = 0; i < this.leftTexts.length; i++) {
      this.leftTexts[i].setText(leftLines[i] ?? '');
    }
    for (let i = 0; i < this.rightTexts.length; i++) {
      this.rightTexts[i].setText(rightLines[i] ?? '');
    }

    this.setVisible(true);
  }

  /** 關閉面板並觸發回呼 */
  private close(): void {
    this.hide();
    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = null;
    }
  }

  public hide(): void {
    this.isVisible = false;
    this.setVisible(false);
  }

  public get visible(): boolean {
    return this.isVisible;
  }

  private setVisible(v: boolean): void {
    this.overlay.setVisible(v);
    this.panelBg.setVisible(v);
    this.titleText.setVisible(v);
    this.divider.setVisible(v);
    this.closeBtn.setVisible(v);
    this.closeBtnHit.setVisible(v);
    this.pauseHintText.setVisible(v);
    for (const t of this.leftTexts) t.setVisible(v);
    for (const t of this.rightTexts) t.setVisible(v);
  }

  public destroy(): void {
    this.overlay?.destroy();
    this.panelBg?.destroy();
    this.titleText?.destroy();
    this.divider?.destroy();
    this.closeBtn?.destroy();
    this.closeBtnHit?.destroy();
    this.pauseHintText?.destroy();
    for (const t of this.leftTexts) t?.destroy();
    for (const t of this.rightTexts) t?.destroy();
  }
}
