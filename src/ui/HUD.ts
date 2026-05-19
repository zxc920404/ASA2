import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';
import { uiText } from './UIStyles';

/**
 * HUD — 遊戲內抬頭顯示器
 * 修正：
 * - 所有文字加 resolution:2 + fontFamily 消除模糊
 * - 武器欄/被動欄不與右上按鈕重疊
 * - 座標全部 Math.round()
 * - Debug 面板縮小並移至不擋操作位置
 */
export class HUD {
  private scene: Phaser.Scene;

  private panelGraphics!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private levelBg!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private expLabel!: Phaser.GameObjects.Text;
  private expBarBg!: Phaser.GameObjects.Graphics;
  private expBarFg!: Phaser.GameObjects.Graphics;
  private pauseBtnGraphics!: Phaser.GameObjects.Graphics;
  private pauseBtnText!: Phaser.GameObjects.Text;
  private pauseHitArea!: Phaser.GameObjects.Rectangle;
  private statsBtnGraphics!: Phaser.GameObjects.Graphics;
  private statsBtnText!: Phaser.GameObjects.Text;
  private statsBtnHitArea!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  private weaponPanelBg!: Phaser.GameObjects.Graphics;
  private weaponSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private weaponSlotTexts: Phaser.GameObjects.Text[] = [];
  private weaponHeaderText!: Phaser.GameObjects.Text;
  private passivePanelBg!: Phaser.GameObjects.Graphics;
  private passiveSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private passiveSlotTexts: Phaser.GameObjects.Text[] = [];
  private passiveHeaderText!: Phaser.GameObjects.Text;

  private updateTimer!: Phaser.Time.TimerEvent;
  private cachedPlayer: Player | null = null;
  private cachedElapsedSeconds: number = 0;
  private cachedKillCount: number = 0;

  private hpBarWidth: number = 0;
  private expBarWidth: number = 0;
  private hpBarX: number = 0;
  private hpBarY: number = 0;
  private expBarX: number = 0;
  private expBarY: number = 0;
  private slotW: number = 0;
  private slotH: number = 0;
  private weaponColX: number = 0;
  private passiveColX: number = 0;
  private slotsStartY: number = 0;

  private statsClickCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.startUpdateTimer();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // safe-area padding（手機橫向）
    const safeL = 8;
    const safeR = 8;
    const safeT = 6;

    // ── 左上角半透明面板（縮小，不超過 36% 寬）──────────────────────────
    const panelX = Math.round(W * 0.01 + safeL);
    const panelY = Math.round(H * 0.02 + safeT);
    const panelW = Math.round(Math.min(W * 0.34, 300));
    const panelH = Math.round(H * 0.18);

    this.panelGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.panelGraphics.fillStyle(0x000000, 0.55);
    this.panelGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    this.panelGraphics.lineStyle(1, 0xd4af37, 0.4);
    this.panelGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);

    // ── HP 條 ──────────────────────────────────────────────────────────────
    this.hpBarWidth = Math.round(panelW * 0.72);
    this.hpBarX = Math.round(panelX + panelW * 0.04);
    this.hpBarY = Math.round(panelY + panelH * 0.28);
    const barH = 11;

    this.hpBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.hpBarBg.fillStyle(0x330000, 1);
    this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);
    this.hpBarBg.lineStyle(1, 0xd4af37, 0.6);
    this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);

    this.hpBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawHpBar(1.0);

    this.hpText = this.scene.add.text(
      this.hpBarX + this.hpBarWidth + 5,
      Math.round(this.hpBarY + barH / 2),
      '--/--',
      uiText(11, '#ffffff')
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(11);

    // ── EXP 條 ──────────────────────────────────────────────────────────────
    this.expBarWidth = Math.round(panelW * 0.72);
    this.expBarX = this.hpBarX;
    this.expBarY = Math.round(panelY + panelH * 0.62);
    const expBarH = 8;

    this.expLabel = this.scene.add.text(
      this.expBarX,
      Math.round(this.expBarY - 2),
      'EXP',
      uiText(10, '#6699ff')
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(11);

    this.expBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.expBarBg.fillStyle(0x001133, 1);
    this.expBarBg.fillRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);
    this.expBarBg.lineStyle(1, 0x4466aa, 0.6);
    this.expBarBg.strokeRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);

    this.expBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawExpBar(0);

    // ── 等級文字（圓形背景）────────────────────────────────────────────────
    const lvX = Math.round(panelX + panelW * 0.88);
    const lvY = Math.round(panelY + panelH * 0.50);

    this.levelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.levelBg.fillStyle(0x1a1a00, 0.9);
    this.levelBg.fillCircle(lvX, lvY, 18);
    this.levelBg.lineStyle(1.5, 0xffd700, 0.8);
    this.levelBg.strokeCircle(lvX, lvY, 18);

    this.levelText = this.scene.add.text(lvX, lvY, 'Lv.1',
      uiText(12, '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    // ── 右上按鈕區（暫停 + 屬性）────────────────────────────────────────
    // 暫停按鈕：右上角，距右邊 safeR + 28px
    const pauseX = Math.round(W - safeR - 28);
    const pauseY = Math.round(H * 0.07 + safeT);
    // 屬性按鈕：暫停按鈕左邊，間距 60px
    const statsX = Math.round(pauseX - 60);
    const statsY = pauseY;

    this.statsBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawStatsBtn(false, statsX, statsY);

    this.statsBtnText = this.scene.add.text(statsX, statsY, '屬',
      uiText(15, '#aaddff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    this.statsBtnHitArea = this.scene.add.rectangle(statsX, statsY, 52, 52, 0x000000, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.statsBtnHitArea.on('pointerover', () => this.drawStatsBtn(true, statsX, statsY));
    this.statsBtnHitArea.on('pointerout', () => this.drawStatsBtn(false, statsX, statsY));
    this.statsBtnHitArea.on('pointerdown', () => {
      if (this.statsClickCallback) this.statsClickCallback();
    });

    this.pauseBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawPauseBtn(false, pauseX, pauseY);

    this.pauseBtnText = this.scene.add.text(pauseX, pauseY, '⏸',
      uiText(18, '#ffffff')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    this.pauseHitArea = this.scene.add.rectangle(pauseX, pauseY, 52, 52, 0x000000, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.pauseHitArea.on('pointerover', () => this.drawPauseBtn(true, pauseX, pauseY));
    this.pauseHitArea.on('pointerout', () => this.drawPauseBtn(false, pauseX, pauseY));

    // ── 存活計時器（右下）──────────────────────────────────────────────────
    this.timerText = this.scene.add.text(
      Math.round(W - safeR - 4), Math.round(H * 0.93),
      '⏱ 00:00',
      uiText(14, '#dddddd')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 擊殺數（計時器左側）────────────────────────────────────────────────
    this.killText = this.scene.add.text(
      Math.round(W - safeR - 90), Math.round(H * 0.93),
      '⚔ 0',
      uiText(14, '#ffccaa')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 武器欄 + 被動欄 ────────────────────────────────────────────────────
    this.createWeaponPassiveSlots(W, H, safeL, safeR, safeT, pauseY);
  }

  /**
   * 建立武器欄（左側）與被動欄（右側）
   * 被動欄右邊界不超過右上按鈕左邊，避免重疊
   */
  private createWeaponPassiveSlots(
    W: number, H: number,
    safeL: number, safeR: number, safeT: number,
    btnBottomY: number
  ): void {
    const MAX_SLOTS = 6;
    this.slotW = Math.round(Math.min(W * 0.09, 64));
    this.slotH = 19;
    const slotGap = 2;

    // 武器欄：左側，從 HUD 面板下方開始
    this.weaponColX = Math.round(W * 0.005 + safeL);
    // 被動欄：右側，右邊界留出 safeR + 按鈕寬度（約 130px）
    const rightBoundary = Math.round(W - safeR - 130);
    this.passiveColX = Math.round(rightBoundary - this.slotW);

    // 欄位起始 Y：HUD 面板下方 + 間距，且不低於按鈕底部
    const hudPanelBottom = Math.round(H * 0.02 + safeT + H * 0.18 + 6);
    this.slotsStartY = Math.max(hudPanelBottom, Math.round(btnBottomY + 36));

    const panelH = MAX_SLOTS * (this.slotH + slotGap) + 20;

    // 武器欄背景
    this.weaponPanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.weaponPanelBg.fillStyle(0x000000, 0.28);
    this.weaponPanelBg.fillRoundedRect(
      this.weaponColX - 2, this.slotsStartY - 18,
      this.slotW + 4, panelH, 4
    );
    this.weaponPanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.weaponPanelBg.strokeRoundedRect(
      this.weaponColX - 2, this.slotsStartY - 18,
      this.slotW + 4, panelH, 4
    );

    this.weaponHeaderText = this.scene.add.text(
      Math.round(this.weaponColX + this.slotW / 2),
      Math.round(this.slotsStartY - 10),
      '武器',
      uiText(10, '#ccaa44')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // 被動欄背景
    this.passivePanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.passivePanelBg.fillStyle(0x000000, 0.28);
    this.passivePanelBg.fillRoundedRect(
      this.passiveColX - 2, this.slotsStartY - 18,
      this.slotW + 4, panelH, 4
    );
    this.passivePanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.passivePanelBg.strokeRoundedRect(
      this.passiveColX - 2, this.slotsStartY - 18,
      this.slotW + 4, panelH, 4
    );

    this.passiveHeaderText = this.scene.add.text(
      Math.round(this.passiveColX + this.slotW / 2),
      Math.round(this.slotsStartY - 10),
      '被動',
      uiText(10, '#7799cc')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const slotY = Math.round(this.slotsStartY + i * (this.slotH + slotGap));

      const wBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      wBg.fillStyle(0x111111, 0.45);
      wBg.fillRoundedRect(this.weaponColX, slotY, this.slotW, this.slotH, 2);
      wBg.lineStyle(1, 0x333333, 0.4);
      wBg.strokeRoundedRect(this.weaponColX, slotY, this.slotW, this.slotH, 2);
      this.weaponSlotBgs.push(wBg);

      const wTxt = this.scene.add.text(
        Math.round(this.weaponColX + this.slotW / 2),
        Math.round(slotY + this.slotH / 2),
        '--',
        uiText(10, '#222222')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.weaponSlotTexts.push(wTxt);

      const pBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      pBg.fillStyle(0x111111, 0.45);
      pBg.fillRoundedRect(this.passiveColX, slotY, this.slotW, this.slotH, 2);
      pBg.lineStyle(1, 0x333333, 0.4);
      pBg.strokeRoundedRect(this.passiveColX, slotY, this.slotW, this.slotH, 2);
      this.passiveSlotBgs.push(pBg);

      const pTxt = this.scene.add.text(
        Math.round(this.passiveColX + this.slotW / 2),
        Math.round(slotY + this.slotH / 2),
        '--',
        uiText(10, '#222222')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.passiveSlotTexts.push(pTxt);
    }
  }

  private updateSlots(player: Player): void {
    const MAX_SLOTS = 6;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = player.equipment.weapons[i];
      if (slot) {
        const w = getWeaponById(slot.weaponId);
        this.weaponSlotTexts[i].setText(`${w?.name ?? slot.weaponId} L${slot.level}`);
        this.weaponSlotTexts[i].setColor('#ffdd88');
      } else {
        this.weaponSlotTexts[i].setText('--');
        this.weaponSlotTexts[i].setColor('#222222');
      }
    }
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = player.equipment.passives[i];
      if (slot) {
        const p = getPassiveById(slot.passiveId);
        this.passiveSlotTexts[i].setText(`${p?.name ?? slot.passiveId} L${slot.level}`);
        this.passiveSlotTexts[i].setColor('#88ccff');
      } else {
        this.passiveSlotTexts[i].setText('--');
        this.passiveSlotTexts[i].setColor('#222222');
      }
    }
  }

  private drawHpBar(ratio: number): void {
    const barH = 11;
    const fillW = Math.max(0, ratio) * this.hpBarWidth;
    this.hpBarFg.clear();
    if (fillW > 4) {
      const color = ratio > 0.5 ? 0x22cc55 : ratio > 0.25 ? 0xffaa00 : 0xff3333;
      this.hpBarFg.fillStyle(color, 1);
      this.hpBarFg.fillRoundedRect(this.hpBarX, this.hpBarY, fillW, barH, 3);
    }
  }

  private drawExpBar(ratio: number): void {
    const expBarH = 8;
    const fillW = Math.max(0, Math.min(1, ratio)) * this.expBarWidth;
    this.expBarFg.clear();
    if (fillW > 2) {
      this.expBarFg.fillStyle(0x44aaff, 1);
      this.expBarFg.fillRoundedRect(this.expBarX, this.expBarY, fillW, expBarH, 2);
    }
  }

  private drawPauseBtn(hovered: boolean, x: number, y: number): void {
    this.pauseBtnGraphics.clear();
    this.pauseBtnGraphics.fillStyle(hovered ? 0x4a1a1a : 0x1a1a1a, 0.85);
    this.pauseBtnGraphics.fillCircle(x, y, 24);
    this.pauseBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 0.9);
    this.pauseBtnGraphics.strokeCircle(x, y, 24);
  }

  private drawStatsBtn(hovered: boolean, x: number, y: number): void {
    this.statsBtnGraphics.clear();
    this.statsBtnGraphics.fillStyle(hovered ? 0x1a2a4a : 0x0a1a2a, 0.85);
    this.statsBtnGraphics.fillCircle(x, y, 24);
    this.statsBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0x88ccff : 0x4488aa, 0.9);
    this.statsBtnGraphics.strokeCircle(x, y, 24);
  }

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
    this.hpText.setText(`${Math.ceil(player.currentHP)} / ${player.stats.maxHP}`);
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
    this.expLabel?.destroy();
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
