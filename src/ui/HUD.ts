import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';
import { uiText } from './UIStyles';

/**
 * HUD — 遊戲內抬頭顯示器
 * 設計解析度 960×540
 *
 * 佈局（所有數值基於 960×540）：
 *   左上主 HUD：x=8, y=6，寬 220px，高 52px（緊湊）
 *   左側武器欄：x=8, y=68（主 HUD 正下方 10px），每格 16px 高
 *   右上按鈕：暫停 x=W-32, 屬性 x=W-88，y=28
 *   右側被動欄：x=W-76, y=68（按鈕正下方），每格 16px 高
 *   右下資訊：y=H-20
 */
export class HUD {
  private scene: Phaser.Scene;

  private panelGraphics!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private levelBg!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
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
  private hpBarX: number = 0;
  private hpBarY: number = 0;
  private expBarWidth: number = 0;
  private expBarX: number = 0;
  private expBarY: number = 0;
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

  private buildLayout(): void {
    const W = this.scene.scale.width;   // 960
    const H = this.scene.scale.height;  // 540

    // ── 1. 左上主 HUD（緊湊，高 52px）──────────────────────────────────
    const panelX = 8;
    const panelY = 6;
    const panelW = 210;
    const panelH = 52;

    this.panelGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.panelGraphics.fillStyle(0x000000, 0.60);
    this.panelGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, 5);
    this.panelGraphics.lineStyle(1, 0xd4af37, 0.35);
    this.panelGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 5);

    // HP 條（寬 160px，高 10px）
    this.hpBarWidth = 160;
    this.hpBarX = panelX + 8;
    this.hpBarY = panelY + 10;
    const barH = 10;

    this.hpBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.hpBarBg.fillStyle(0x330000, 1);
    this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);
    this.hpBarBg.lineStyle(1, 0xd4af37, 0.4);
    this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);

    this.hpBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawHpBar(1.0);

    this.hpText = this.scene.add.text(
      this.hpBarX + this.hpBarWidth + 4,
      this.hpBarY + barH / 2,
      '--/--',
      uiText(9, '#ffffff')
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(11);

    // EXP 條（寬 160px，高 6px）
    this.expBarWidth = 160;
    this.expBarX = this.hpBarX;
    this.expBarY = panelY + 32;
    const expBarH = 6;

    this.scene.add.text(
      this.expBarX, this.expBarY - 1,
      'EXP', uiText(8, '#6699ff')
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(11);

    this.expBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.expBarBg.fillStyle(0x001133, 1);
    this.expBarBg.fillRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);
    this.expBarBg.lineStyle(1, 0x4466aa, 0.4);
    this.expBarBg.strokeRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);

    this.expBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawExpBar(0);

    // Lv 圓形（貼齊面板右側內部）
    const lvX = panelX + panelW - 20;
    const lvY = panelY + panelH / 2;
    this.levelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.levelBg.fillStyle(0x1a1a00, 0.9);
    this.levelBg.fillCircle(lvX, lvY, 16);
    this.levelBg.lineStyle(1.5, 0xffd700, 0.8);
    this.levelBg.strokeCircle(lvX, lvY, 16);
    this.levelText = this.scene.add.text(lvX, lvY, 'Lv.1',
      uiText(10, '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    // ── 2. 右上按鈕（暫停最右，屬性左 60px，y=28）──────────────────────
    this.pauseX = W - 32;
    this.pauseY = 28;
    this.statsX = W - 88;
    this.statsY = 28;

    this.statsBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawStatsBtn(false);
    this.statsBtnText = this.scene.add.text(this.statsX, this.statsY, '屬',
      uiText(13, '#aaddff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
    this.statsBtnHitArea = this.scene.add.rectangle(this.statsX, this.statsY, 52, 52, 0, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.statsBtnHitArea.on('pointerover', () => this.drawStatsBtn(true));
    this.statsBtnHitArea.on('pointerout', () => this.drawStatsBtn(false));
    this.statsBtnHitArea.on('pointerdown', () => {
      if (this.statsClickCallback) this.statsClickCallback();
    });

    this.pauseBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawPauseBtn(false);
    this.pauseBtnText = this.scene.add.text(this.pauseX, this.pauseY, '⏸',
      uiText(16, '#ffffff')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
    this.pauseHitArea = this.scene.add.rectangle(this.pauseX, this.pauseY, 52, 52, 0, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });
    this.pauseHitArea.on('pointerover', () => this.drawPauseBtn(true));
    this.pauseHitArea.on('pointerout', () => this.drawPauseBtn(false));

    // ── 3. 右下資訊（y = H-20）──────────────────────────────────────────
    this.timerText = this.scene.add.text(
      W - 8, H - 20,
      '⏱ 00:00', uiText(12, '#dddddd')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);
    this.killText = this.scene.add.text(
      W - 8 - 90, H - 20,
      '⚔ 0', uiText(12, '#ffccaa')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 4. 武器欄 + 被動欄 ──────────────────────────────────────────────
    this.buildSlots(W, H);
  }

  /**
   * 武器欄（左側貼邊）與被動欄（右側貼邊）
   * 武器欄：x=8, y=68（主 HUD 下方 10px），每格 16px 高
   * 被動欄：x=W-72, y=68（右上按鈕下方），每格 16px 高
   * 兩欄寬度 60px，透明度低，不擋戰鬥
   */
  private buildSlots(W: number, H: number): void {
    const MAX_SLOTS = 6;
    const slotW = 60;
    const slotH = 16;
    const slotGap = 2;
    const totalH = MAX_SLOTS * (slotH + slotGap) + 18;

    // 武器欄：左側，主 HUD 下方 10px
    const wX = 8;
    const wY = 68;  // panelY(6) + panelH(52) + 10

    // 被動欄：右側，右上按鈕下方 12px
    // 暫停按鈕 x=W-32，半徑 20，右邊界 = W-12
    // 被動欄右邊界 = W-8，左邊界 = W-8-slotW = W-68
    const pX = W - 8 - slotW;
    const pY = 68;  // 按鈕 y=28，半徑 20，底部=48，+20=68

    // 武器欄背景
    this.weaponPanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.weaponPanelBg.fillStyle(0x000000, 0.35);
    this.weaponPanelBg.fillRoundedRect(wX - 2, wY - 14, slotW + 4, totalH, 4);
    this.weaponPanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.weaponPanelBg.strokeRoundedRect(wX - 2, wY - 14, slotW + 4, totalH, 4);

    this.weaponHeaderText = this.scene.add.text(
      wX + slotW / 2, wY - 7,
      '武器', uiText(9, '#ccaa44')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // 被動欄背景
    this.passivePanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.passivePanelBg.fillStyle(0x000000, 0.35);
    this.passivePanelBg.fillRoundedRect(pX - 2, pY - 14, slotW + 4, totalH, 4);
    this.passivePanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.passivePanelBg.strokeRoundedRect(pX - 2, pY - 14, slotW + 4, totalH, 4);

    this.passiveHeaderText = this.scene.add.text(
      pX + slotW / 2, pY - 7,
      '被動', uiText(9, '#7799cc')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const wySlot = wY + i * (slotH + slotGap);
      const pySlot = pY + i * (slotH + slotGap);

      const wBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      wBg.fillStyle(0x111111, 0.40);
      wBg.fillRoundedRect(wX, wySlot, slotW, slotH, 2);
      wBg.lineStyle(1, 0x2a2a2a, 0.5);
      wBg.strokeRoundedRect(wX, wySlot, slotW, slotH, 2);
      this.weaponSlotBgs.push(wBg);

      const wTxt = this.scene.add.text(
        wX + slotW / 2, wySlot + slotH / 2,
        '--', uiText(9, '#2a2a2a')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.weaponSlotTexts.push(wTxt);

      const pBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      pBg.fillStyle(0x111111, 0.40);
      pBg.fillRoundedRect(pX, pySlot, slotW, slotH, 2);
      pBg.lineStyle(1, 0x2a2a2a, 0.5);
      pBg.strokeRoundedRect(pX, pySlot, slotW, slotH, 2);
      this.passiveSlotBgs.push(pBg);

      const pTxt = this.scene.add.text(
        pX + slotW / 2, pySlot + slotH / 2,
        '--', uiText(9, '#2a2a2a')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.passiveSlotTexts.push(pTxt);
    }
  }

  private drawHpBar(ratio: number): void {
    const barH = 10;
    const fillW = Math.max(0, ratio) * this.hpBarWidth;
    this.hpBarFg.clear();
    if (fillW > 3) {
      const color = ratio > 0.5 ? 0x22cc55 : ratio > 0.25 ? 0xffaa00 : 0xff3333;
      this.hpBarFg.fillStyle(color, 1);
      this.hpBarFg.fillRoundedRect(this.hpBarX, this.hpBarY, fillW, barH, 3);
    }
  }

  private drawExpBar(ratio: number): void {
    const expBarH = 6;
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
    this.pauseBtnGraphics.fillCircle(this.pauseX, this.pauseY, 20);
    this.pauseBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 0.9);
    this.pauseBtnGraphics.strokeCircle(this.pauseX, this.pauseY, 20);
  }

  private drawStatsBtn(hovered: boolean): void {
    this.statsBtnGraphics.clear();
    this.statsBtnGraphics.fillStyle(hovered ? 0x1a2a4a : 0x0a1a2a, 0.88);
    this.statsBtnGraphics.fillCircle(this.statsX, this.statsY, 20);
    this.statsBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0x88ccff : 0x4488aa, 0.9);
    this.statsBtnGraphics.strokeCircle(this.statsX, this.statsY, 20);
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
        this.weaponSlotTexts[i].setColor('#2a2a2a');
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
        this.passiveSlotTexts[i].setColor('#2a2a2a');
      }
    }
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
