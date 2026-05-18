import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';

/**
 * PlayerStatusPanel
 * 點擊「屬」按鈕後顯示的玩家屬性面板
 * 顯示角色名稱、等級、HP、各項屬性、武器/被動數量
 */
export class PlayerStatusPanel {
  private scene: Phaser.Scene;

  private overlay!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private closeBtn!: Phaser.GameObjects.Text;
  private closeBtnHit!: Phaser.GameObjects.Rectangle;
  private statTexts: Phaser.GameObjects.Text[] = [];

  private isVisible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.hide();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    const panelW = Math.min(W * 0.55, 320);
    const panelH = H * 0.72;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    // 半透明遮罩（點擊關閉）
    this.overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45)
      .setScrollFactor(0).setDepth(50).setInteractive();
    this.overlay.on('pointerdown', () => this.hide());

    // 面板背景
    this.panelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(51);
    this.panelBg.fillStyle(0x0d1a0d, 0.95);
    this.panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.panelBg.lineStyle(1.5, 0xd4af37, 0.8);
    this.panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    // 標題
    this.titleText = this.scene.add.text(
      W / 2, panelY + 18,
      '── 玩家屬性 ──',
      { fontSize: '15px', color: '#ffd700', fontStyle: 'bold' }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(52);

    // 關閉按鈕（右上角 ✕）
    this.closeBtn = this.scene.add.text(
      panelX + panelW - 14, panelY + 10,
      '✕',
      { fontSize: '16px', color: '#aaaaaa' }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(52);

    this.closeBtnHit = this.scene.add.rectangle(
      panelX + panelW - 14, panelY + 10, 48, 48, 0x000000, 0
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(53).setInteractive({ useHandCursor: true });
    this.closeBtnHit.on('pointerdown', () => this.hide());

    // 預先建立 stat 文字列（最多 14 行）
    for (let i = 0; i < 14; i++) {
      const t = this.scene.add.text(
        panelX + 16,
        panelY + 46 + i * 26,
        '',
        { fontSize: '13px', color: '#dddddd' }
      ).setScrollFactor(0).setDepth(52);
      this.statTexts.push(t);
    }
  }

  /**
   * 顯示面板並填入玩家資料
   */
  public show(player: Player, characterName: string): void {
    this.isVisible = true;

    // 計算攻擊速度倍率（1 / attackInterval 相對於基礎值，簡化顯示）
    const stats = player.stats;

    // 武器清單
    const weaponCount = player.equipment.weapons.length;
    const passiveCount = player.equipment.passives.length;

    const lines: string[] = [
      `角色：${characterName}`,
      `等級：Lv.${player.level}`,
      `HP：${Math.ceil(player.currentHP)} / ${stats.maxHP}`,
      `攻擊力倍率：×${stats.attackPower.toFixed(2)}`,
      `移動速度：${Math.round(stats.moveSpeed)} px/s`,
      `拾取範圍：${Math.round(stats.pickupRange)} px`,
      `攻擊範圍倍率：×${(stats.attackRange / 120).toFixed(2)}`,
      `攻擊速度倍率：×${(1 / stats.attackInterval).toFixed(2)}`,
      ``,
      `武器數量：${weaponCount} / 6`,
    ];

    // 武器列表
    for (const slot of player.equipment.weapons) {
      const w = getWeaponById(slot.weaponId);
      lines.push(`  ${w?.name ?? slot.weaponId} Lv${slot.level}`);
    }

    // 被動列表標題
    lines.push(`被動數量：${passiveCount} / 6`);
    for (const slot of player.equipment.passives) {
      const p = getPassiveById(slot.passiveId);
      lines.push(`  ${p?.name ?? slot.passiveId} Lv${slot.level}`);
    }

    // 填入文字（最多 14 行）
    for (let i = 0; i < this.statTexts.length; i++) {
      this.statTexts[i].setText(lines[i] ?? '');
    }

    this.setVisible(true);
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
    this.closeBtn.setVisible(v);
    this.closeBtnHit.setVisible(v);
    for (const t of this.statTexts) t.setVisible(v);
  }

  public destroy(): void {
    this.overlay?.destroy();
    this.panelBg?.destroy();
    this.titleText?.destroy();
    this.closeBtn?.destroy();
    this.closeBtnHit?.destroy();
    for (const t of this.statTexts) t?.destroy();
  }
}
