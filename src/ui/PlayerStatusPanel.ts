import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';

/**
 * PlayerStatusPanel
 * 點擊「屬」按鈕後顯示的玩家屬性面板（兩欄排版）
 * 左欄：角色、等級、HP、移動速度、拾取範圍
 * 右欄：攻擊力、攻擊範圍、攻擊速度、武器數量、被動數量
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

  // 左欄文字（最多 8 行）
  private leftTexts: Phaser.GameObjects.Text[] = [];
  // 右欄文字（最多 8 行）
  private rightTexts: Phaser.GameObjects.Text[] = [];
  // 裝備列表（武器 + 被動，橫跨兩欄底部）
  private equipTexts: Phaser.GameObjects.Text[] = [];

  private isVisible: boolean = false;
  private onCloseCallback: (() => void) | null = null;

  // 面板尺寸（建立時計算，供 show() 更新文字位置用）
  private panelX: number = 0;
  private panelY: number = 0;
  private panelW: number = 0;
  private panelH: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.hide();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // 面板尺寸：寬度約 46%（比前版縮小 ~15%），高度 62%
    this.panelW = Math.min(W * 0.46, 290);
    this.panelH = H * 0.62;
    this.panelX = (W - this.panelW) / 2;
    this.panelY = (H - this.panelH) / 2;

    const { panelX, panelY, panelW, panelH } = this;

    // ── 半透明遮罩（點擊關閉）──────────────────────────────────────────
    this.overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.40)
      .setScrollFactor(0).setDepth(50).setInteractive();
    this.overlay.on('pointerdown', () => this.close());

    // ── 面板背景 ────────────────────────────────────────────────────────
    this.panelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(51);
    this.panelBg.fillStyle(0x0a1a0a, 0.96);
    this.panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.panelBg.lineStyle(1.5, 0xd4af37, 0.75);
    this.panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    // ── 標題 ────────────────────────────────────────────────────────────
    this.titleText = this.scene.add.text(
      panelX + panelW / 2, panelY + 14,
      '玩家屬性',
      { fontSize: '14px', color: '#ffd700', fontStyle: 'bold' }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(52);

    // ── 標題分隔線 ──────────────────────────────────────────────────────
    this.divider = this.scene.add.graphics().setScrollFactor(0).setDepth(52);
    this.divider.lineStyle(1, 0xd4af37, 0.35);
    this.divider.lineBetween(panelX + 10, panelY + 36, panelX + panelW - 10, panelY + 36);

    // ── 關閉按鈕（右上角 ✕）────────────────────────────────────────────
    this.closeBtn = this.scene.add.text(
      panelX + panelW - 12, panelY + 8,
      '✕',
      { fontSize: '15px', color: '#888888' }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(52);

    this.closeBtnHit = this.scene.add.rectangle(
      panelX + panelW - 12, panelY + 8, 48, 48, 0x000000, 0
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(53).setInteractive({ useHandCursor: true });
    this.closeBtnHit.on('pointerdown', () => this.close());

    // ── 左欄文字（8 行）────────────────────────────────────────────────
    const leftX = panelX + 12;
    const rightX = panelX + panelW / 2 + 4;
    const rowH = 22;
    const startY = panelY + 44;

    for (let i = 0; i < 8; i++) {
      const t = this.scene.add.text(leftX, startY + i * rowH, '', {
        fontSize: '12px', color: '#cccccc',
      }).setScrollFactor(0).setDepth(52);
      this.leftTexts.push(t);
    }

    // ── 右欄文字（8 行）────────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const t = this.scene.add.text(rightX, startY + i * rowH, '', {
        fontSize: '12px', color: '#cccccc',
      }).setScrollFactor(0).setDepth(52);
      this.rightTexts.push(t);
    }

    // ── 裝備列表（底部，最多 14 行）────────────────────────────────────
    const equipStartY = startY + 8 * rowH + 6;
    for (let i = 0; i < 14; i++) {
      const t = this.scene.add.text(leftX, equipStartY + i * 18, '', {
        fontSize: '11px', color: '#aaaaaa',
      }).setScrollFactor(0).setDepth(52);
      this.equipTexts.push(t);
    }
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

    // ── 左欄 ──────────────────────────────────────────────────────────
    const leftLines = [
      `角色：${characterName}`,
      `等級：Lv.${player.level}`,
      `HP：${Math.ceil(player.currentHP)}/${stats.maxHP}`,
      `移動速度`,
      `  ${Math.round(stats.moveSpeed)} px/s`,
      `拾取範圍`,
      `  ${Math.round(stats.pickupRange)} px`,
      ``,
    ];

    // ── 右欄 ──────────────────────────────────────────────────────────
    const rightLines = [
      `武器：${weaponCount}/6`,
      `被動：${passiveCount}/6`,
      `攻擊力`,
      `  ×${stats.attackPower.toFixed(2)}`,
      `攻擊範圍`,
      `  ×${(stats.attackRange / 120).toFixed(2)}`,
      `攻擊速度`,
      `  ×${(1 / stats.attackInterval).toFixed(2)}`,
    ];

    for (let i = 0; i < this.leftTexts.length; i++) {
      this.leftTexts[i].setText(leftLines[i] ?? '');
    }
    for (let i = 0; i < this.rightTexts.length; i++) {
      this.rightTexts[i].setText(rightLines[i] ?? '');
    }

    // ── 裝備列表 ──────────────────────────────────────────────────────
    const equipLines: string[] = [];

    if (weaponCount > 0) {
      equipLines.push('── 武器 ──');
      for (const slot of player.equipment.weapons) {
        const w = getWeaponById(slot.weaponId);
        equipLines.push(`  ${w?.name ?? slot.weaponId}  Lv${slot.level}`);
      }
    }

    if (passiveCount > 0) {
      if (equipLines.length > 0) equipLines.push('');
      equipLines.push('── 被動 ──');
      for (const slot of player.equipment.passives) {
        const p = getPassiveById(slot.passiveId);
        equipLines.push(`  ${p?.name ?? slot.passiveId}  Lv${slot.level}`);
      }
    }

    for (let i = 0; i < this.equipTexts.length; i++) {
      this.equipTexts[i].setText(equipLines[i] ?? '');
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
    for (const t of this.leftTexts) t.setVisible(v);
    for (const t of this.rightTexts) t.setVisible(v);
    for (const t of this.equipTexts) t.setVisible(v);
  }

  public destroy(): void {
    this.overlay?.destroy();
    this.panelBg?.destroy();
    this.titleText?.destroy();
    this.divider?.destroy();
    this.closeBtn?.destroy();
    this.closeBtnHit?.destroy();
    for (const t of this.leftTexts) t?.destroy();
    for (const t of this.rightTexts) t?.destroy();
    for (const t of this.equipTexts) t?.destroy();
  }
}
