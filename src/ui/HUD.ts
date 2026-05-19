import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';
import { uiText } from './UIStyles';

/**
 * HUD — 遊戲內抬頭顯示器
 *
 * 佈局規則（全部動態計算，不硬寫死解析度）：
 *   safeL/safeR/safeT/safeB = 手機安全區 padding
 *
 *   左上主 HUD：x=safeL+16, y=safeT+16，寬度 ≤ 34% 畫面寬
 *   左側武器欄：x=safeL+16, y=safeT+150（主 HUD 下方留空間）
 *   右上按鈕：暫停在最右，屬性在左 64px，y=safeT+32
 *   右側被動欄：x=W-safeR-passiveW-24, y=safeT+130（按鈕下方）
 *   右下資訊：time x=W-safeR-8, kill x=time-130, y=H-safeB-44
 */
export class HUD {
  private scene: Phaser.Scene;

  // ── 主 HUD（左上）──────────────────────────────────────────────────────
  private panelGraphics!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private levelBg!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private expBarBg!: Phaser.GameObjects.Graphics;
  private expBarFg!: Phaser.GameObjects.Graphics;

  // ── 右上按鈕 ────────────────────────────────────────────────────────────
  private pauseBtnGraphics!: Phaser.GameObjects.Graphics;
  private pauseBtnText!: Phaser.GameObjects.Text;
  private pauseHitArea!: Phaser.GameObjects.Rectangle;
  private statsBtnGraphics!: Phaser.GameObjects.Graphics;
  private statsBtnText!: Phaser.GameObjects.Text;
  private statsBtnHitArea!: Phaser.GameObjects.Rectangle;

  // ── 右下資訊 ────────────────────────────────────────────────────────────
  private timerText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  // ── 武器欄（左側）──────────────────────────────────────────────────────
  private weaponPanelBg!: Phaser.GameObjects.Graphics;
  private weaponSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private weaponSlotTexts: Phaser.GameObjects.Text[] = [];
  private weaponHeaderText!: Phaser.GameObjects.Text;

  // ── 被動欄（右側）──────────────────────────────────────────────────────
  private passivePanelBg!: Phaser.GameObjects.Graphics;
  private passiveSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private passiveSlotTexts: Phaser.GameObjects.Text[] = [];
  private passiveHeaderText!: Phaser.GameObjects.Text;

  // ── 計時器 ──────────────────────────────────────────────────────────────
  private updateTimer!: Phaser.Time.TimerEvent;
  private cachedPlayer: Player | null = null;
  private cachedElapsedSeconds: number = 0;
  private cachedKillCount: number = 0;

  // ── HP/EXP 條尺寸（供 drawHpBar/drawExpBar 使用）────────────────────────
  private hpBarWidth: number = 0;
  private hpBarX: number = 0;
  private hpBarY: number = 0;
  private expBarWidth: number = 0;
  private expBarX: number = 0;
  private expBarY: number = 0;

  // ── 按鈕座標（供 hover 重繪使用）────────────────────────────────────────
  private pauseX: number = 0;
  private pauseY: number = 0;
  private statsX: number = 0;
  private statsY: number = 0;

  private statsClickCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildLayout();
    this.startUpdateTimer();
  }

  /** 計算所有 HUD 元件的位置並建立 */
  private buildLayout(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── Safe-area padding（手機橫向）────────────────────────────────────
    const safeL = 16;
    const safeR = 16;
    const safeT = 16;
    const safeB = 20;

    // ── 1. 左上主 HUD ────────────────────────────────────────────────────
    const panelX = Math.round(safeL);
    const panelY = Math.round(safeT);
    const panelW = Math.round(Math.min(W * 0.32, 260));
    const panelH = 68;

    this.panelGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.panelGraphics.fillStyle(0x000000, 0.60);
    this.panelGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    this.panelGraphics.lineStyle(1, 0xd4af37, 0.35);
    this.panelGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);

    // HP 條
    const barInnerW = Math.round(panelW - 44);
    this.hpBarWidth = barInnerW;
    this.hpBarX = Math.round(panelX + 8);
    this.hpBarY = Math.round(panelY + 12);
    const barH = 12;

    this.hpBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.hpBarBg.fillStyle(0x330000, 1);
    this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);
    this.hpBarBg.lineStyle(1, 0xd4af37, 0.5);
    this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);

    this.hpBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawHpBar(1.0);

    this.hpText = this.scene.add.text(
      Math.round(this.hpBarX + this.hpBarWidth + 4),
      Math.round(this.hpBarY + barH / 2),
      '--/--',
      uiText(10, '#ffffff')
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(11);

    // EXP 條
    const expBarH = 7;
    this.expBarWidth = barInnerW;
    this.expBarX = this.hpBarX;
    this.expBarY = Math.round(panelY + 36);

    this.scene.add.text(
      this.expBarX, Math.round(this.expBarY - 1),
      'EXP', uiText(9, '#6699ff')
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(11);

    this.expBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.expBarBg.fillStyle(0x001133, 1);
    this.expBarBg.fillRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);
    this.expBarBg.lineStyle(1, 0x4466aa, 0.5);
    this.expBarBg.strokeRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);

    this.expBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawExpBar(0);

    // Lv 圓形（貼齊主 HUD 右側）
    const lvX = Math.round(panelX + panelW - 18);
    const lvY = Math.round(panelY + panelH / 2);
    this.levelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.levelBg.fillStyle(0x1a1a00, 0.9);
    this.levelBg.fillCircle(lvX, lvY, 16);
    this.levelBg.lineStyle(1.5, 0xffd700, 0.8);
    this.levelBg.strokeCircle(lvX, lvY, 16);
    this.levelText = this.scene.add.text(lvX, lvY, 'Lv.1',
      uiText(11, '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    // ── 2. 右上按鈕（暫停在最右，屬性在左 64px）────────────────────────
    this.pauseX = Math.round(W - safeR - 28);
    this.pauseY = Math.round(safeT + 28);
    this.statsX = Math.round(this.pauseX - 64);
    this.statsY = this.pauseY;

    this.statsBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawStatsBtn(false);
    this.statsBtnText = this.scene.add.text(this.statsX, this.statsY, '屬',
      uiText(14, '#aaddff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
    this.statsBtnHitArea = this.scene.add.rectangle(this.statsX, this.statsY, 56, 56, 0, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.statsBtnHitArea.on('pointerover', () => this.drawStatsBtn(true));
    this.statsBtnHitArea.on('pointerout', () => this.drawStatsBtn(false));
    this.statsBtnHitArea.on('pointerdown', () => {
      if (this.statsClickCallback) this.statsClickCallback();
    });

    this.pauseBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawPauseBtn(false);
    this.pauseBtnText = this.scene.add.text(this.pauseX, this.pauseY, '⏸',
      uiText(17, '#ffffff')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
    this.pauseHitArea = this.scene.add.rectangle(this.pauseX, this.pauseY, 56, 56, 0, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.pauseHitArea.on('pointerover', () => this.drawPauseBtn(true));
    this.pauseHitArea.on('pointerout', () => this.drawPauseBtn(false));

    // ── 3. 右下資訊（計時器 + 擊殺數）──────────────────────────────────
    const infoY = Math.round(H - safeB - 44);
    this.timerText = this.scene.add.text(
      Math.round(W - safeR - 8), infoY,
      '⏱ 00:00', uiText(13, '#dddddd')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);
    this.killText = this.scene.add.text(
      Math.round(W - safeR - 8 - 110), infoY,
      '⚔ 0', uiText(13, '#ffccaa')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 4. 武器欄 + 被動欄 ──────────────────────────────────────────────
    this.buildSlots(W, H, safeL, safeR, safeT, safeB);
  }

  /**
   * 建立武器欄（左側）與被動欄（右側）
   * 武器欄：x=safeL, y=safeT+150（主 HUD 下方留空間，不貼著）
   * 被動欄：x=W-safeR-passiveW-24（右上按鈕左邊），y=safeT+130
   * 兩欄都不與搖桿（左下）重疊
   */
  private buildSlots(
    W: number, H: number,
    safeL: number, safeR: number, safeT: number, safeB: number
  ): void {
    const MAX_SLOTS = 6;
    const slotW = Math.round(Math.min(W * 0.085, 60));
    const slotH = 18;
    const slotGap = 2;
    const totalSlotH = MAX_SLOTS * (slotH + slotGap) + 22;

    // 武器欄 X/Y
    const weaponX = Math.round(safeL);
    const weaponY = Math.round(safeT + 150);

    // 被動欄：右邊界 = 右上按鈕左邊 - 24px
    const passiveRightBound = Math.round(this.statsX - 32 - 24);
    const passiveX = Math.round(passiveRightBound - slotW);
    const passiveY = Math.round(safeT + 130);

    // 搖桿底部 Y（避免武器欄蓋到搖桿）
    // 搖桿在 H*0.75，半徑 60，底部約 H*0.75+60
    const joystickBottom = Math.round(H * 0.75 + 60 + 8);
    const weaponMaxBottom = joystickBottom - totalSlotH;
    const finalWeaponY = Math.min(weaponY, weaponMaxBottom);

    // ── 武器欄背景 ──────────────────────────────────────────────────────
    this.weaponPanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.weaponPanelBg.fillStyle(0x000000, 0.30);
    this.weaponPanelBg.fillRoundedRect(weaponX - 2, finalWeaponY - 18, slotW + 4, totalSlotH, 4);
    this.weaponPanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.weaponPanelBg.strokeRoundedRect(weaponX - 2, finalWeaponY - 18, slotW + 4, totalSlotH, 4);

    this.weaponHeaderText = this.scene.add.text(
      Math.round(weaponX + slotW / 2), Math.round(finalWeaponY - 10),
      '武器', uiText(10, '#ccaa44')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // ── 被動欄背景 ──────────────────────────────────────────────────────
    this.passivePanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.passivePanelBg.fillStyle(0x000000, 0.30);
    this.passivePanelBg.fillRoundedRect(passiveX - 2, passiveY - 18, slotW + 4, totalSlotH, 4);
    this.passivePanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.passivePanelBg.strokeRoundedRect(passiveX - 2, passiveY - 18, slotW + 4, totalSlotH, 4);

    this.passiveHeaderText = this.scene.add.text(
      Math.round(passiveX + slotW / 2), Math.round(passiveY - 10),
      '被動', uiText(10, '#7799cc')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // ── 格子 ────────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_SLOTS; i++) {
      const wY = Math.round(finalWeaponY + i * (slotH + slotGap));
      const pY = Math.round(passiveY + i * (slotH + slotGap));

      const wBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      wBg.fillStyle(0x111111, 0.40);
      wBg.fillRoundedRect(weaponX, wY, slotW, slotH, 2);
      wBg.lineStyle(1, 0x333333, 0.35);
      wBg.strokeRoundedRect(weaponX, wY, slotW, slotH, 2);
      this.weaponSlotBgs.push(wBg);

      const wTxt = this.scene.add.text(
        Math.round(weaponX + slotW / 2), Math.round(wY + slotH / 2),
        '--', uiText(9, '#333333')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.weaponSlotTexts.push(wTxt);

      const pBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      pBg.fillStyle(0x111111, 0.40);
      pBg.fillRoundedRect(passiveX, pY, slotW, slotH, 2);
      pBg.lineStyle(1, 0x333333, 0.35);
      pBg.strokeRoundedRect(passiveX, pY, slotW, slotH, 2);
      this.passiveSlotBgs.push(pBg);

      const pTxt = this.scene.add.text(
        Math.round(passiveX + slotW / 2), Math.round(pY + slotH / 2),
        '--', uiText(9, '#333333')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.passiveSlotTexts.push(pTxt);
    }
  }

  // ── 繪製方法 ──────────────────────────────────────────────────────────────

  private drawHpBar(ratio: number): void {
    const barH = 12;
    const fillW = Math.max(0, ratio) * this.hpBarWidth;
    this.hpBarFg.clear();
    if (fillW > 4) {
      const color = ratio > 0.5 ? 0x22cc55 : ratio > 0.25 ? 0xffaa00 : 0xff3333;
      this.hpBarFg.fillStyle(color, 1);
      this.hpBarFg.fillRoundedRect(this.hpBarX, this.hpBarY, fillW, barH, 3);
    }
  }

  private drawExpBar(ratio: number): void {
    const expBarH = 7;
    const fillW = Math.max(0, Math.min(1, ratio)) * this.expBarWidth;
    this.expBarFg.clear();
    if (fillW > 2) {
      this.expBarFg.fillStyle(0x44aaff, 1);
      this.expBarFg.fillRoundedRect(this.expBarX, this.expBarY, fillW, expBarH, 2);
    }
  }

  private drawPauseBtn(hovered: boolean): void {
    this.pauseBtnGraphics.clear();
    this.pauseBtnGraphics.fillStyle(hovered ? 0x4a1a1a : 0x1a1a1a, 0.88);
    this.pauseBtnGraphics.fillCircle(this.pauseX, this.pauseY, 24);
    this.pauseBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 0.9);
    this.pauseBtnGraphics.strokeCircle(this.pauseX, this.pauseY, 24);
  }

  private drawStatsBtn(hovered: boolean): void {
    this.statsBtnGraphics.clear();
    this.statsBtnGraphics.fillStyle(hovered ? 0x1a2a4a : 0x0a1a2a, 0.88);
    this.statsBtnGraphics.fillCircle(this.statsX, this.statsY, 24);
    this.statsBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0x88ccff : 0x4488aa, 0.9);
    this.statsBtnGraphics.strokeCircle(this.statsX, this.statsY, 24);
  }

  // ── 計時器 ────────────────────────────────────────────────────────────────

  private startUpdateTimer(): void {
    this.updateTimer = this.scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: this.onTimerTick,
      callbackScope: this,
    });
  }

  private onTimerTick(): void {
    if (!this.cachedPlayer) return;
    const player = this.cachedPlayer;

    const hpRatio = Math.max(0, player.currentHP / player.stats.maxHP);
    this.drawHpBar(hpRatio);
    this.hpText.setText(`${Math.ceil(player.currentHP)}/${player.stats.maxHP}`);
    this.levelText.setText(`Lv.${player.level}`);

    const requiredExp = 10 + player.level * 5;
    this.drawExpBar(Math.max(0, Math.min(1, player.currentExp / requiredExp)));

    const totalSec = Math.floor(this.cachedElapsedSeconds);
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');
    this.timerText.setText(`⏱ ${mm}:${ss}`);
    this.killText.setText(`⚔ ${this.cachedKillCount}`);

    this.updateSlots(player);
  }

  private updateSlots(player: Player): void {
    const MAX_SLOTS = 6;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const ws = player.equipment.weapons[i];
      if (ws) {
        const w = getWeaponById(ws.weaponId);
        this.weaponSlotTexts[i].setText(`${w?.name ?? ws.weaponId} L${ws.level}`);
        this.weaponSlotTexts[i].setColor('#ffdd88');
      } else {
        this.weaponSlotTexts[i].setText('--');
        this.weaponSlotTexts[i].setColor('#333333');
      }
    }
    for (let i = 0; i < MAX_SLOTS; i++) {
      const ps = player.equipment.passives[i];
      if (ps) {
        const p = getPassiveById(ps.passiveId);
        this.passiveSlotTexts[i].setText(`${p?.name ?? ps.passiveId} L${ps.level}`);
        this.passiveSlotTexts[i].setColor('#88ccff');
      } else {
        this.passiveSlotTexts[i].setText('--');
        this.passiveSlotTexts[i].setColor('#333333');
      }
    }
  }

  // ── 公開介面 ──────────────────────────────────────────────────────────────

  public onPauseClick(callback: () => void): void {
    this.pauseHitArea.on('pointerdown', callback);
  }

  public onStatsClick(callback: () => void): void {
    this.statsClickCallback = callback;
  }

  public update(player: Player, elapsedSeconds: number, killCount: number): void {
    this.cachedPlayer = player;
    this.cachedElapsedSeconds = elapsedSeconds;
    this.cachedKillCount = killCount;
  }

  public destroy(): void {
    this.updateTimer?.remove();
    this.panelGraphics?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFg?.destroy();
    this.hpText?.destroy();
    this.levelBg?.destroy();
    this.levelText?.destroy();
    this.expBarBg?.destroy();
    this.expBarFg?.destroy();
    this.pauseBtnGraphics?.destroy();
    this.pauseBtnText?.destroy();
    this.pauseHitArea?.destroy();
    this.statsBtnGraphics?.destroy();
    this.statsBtnText?.destroy();
    this.statsBtnHitArea?.destroy();
    this.timerText?.destroy();
    this.killText?.destroy();
    this.weaponPanelBg?.destroy();
    this.weaponHeaderText?.destroy();
    this.passivePanelBg?.destroy();
    this.passiveHeaderText?.destroy();
    for (const g of this.weaponSlotBgs) g?.destroy();
    for (const t of this.weaponSlotTexts) t?.destroy();
    for (const g of this.passiveSlotBgs) g?.destroy();
    for (const t of this.passiveSlotTexts) t?.destroy();
  }
}
