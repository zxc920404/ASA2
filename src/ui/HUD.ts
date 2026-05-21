import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';
import { uiText } from './UIStyles';
import { AssetLoader } from '../utils/AssetLoader';
import { ResponsiveLayout, LayoutMetrics } from '../utils/ResponsiveLayout';

/**
 * HUD — 遊戲內抬頭顯示器
 * 使用 this.scene.scale.width / height 取得實際尺寸，支援任意解析度。
 *
 * 直屏（Portrait）佈局：
 *   上方 HUD 條（H*0.10）：HP bar、EXP bar、Lv、時間、擊殺數
 *   武器格 + 被動格：上方 HUD 條下方，小圖示水平排列
 *   右下角：暫停按鈕 + 屬性按鈕
 *
 * 橫屏（Landscape）佈局（原有設計）：
 *   左上主 HUD：safeX, safeY，寬 220px，高 52px
 *   左側武器欄：safeX + 64，主 HUD 正下方
 *   右上按鈕：暫停 W-safeX-20, 屬性 W-safeX-76，y=safeY+22
 *   右側被動欄：W-safeX-64-slotW，按鈕正下方
 *   右下資訊：W-safeX, H-safeY
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
  private weaponSlotIcons: (Phaser.GameObjects.Image | null)[] = [];
  private weaponHeaderText!: Phaser.GameObjects.Text;

  private passivePanelBg!: Phaser.GameObjects.Graphics;
  private passiveSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private passiveSlotTexts: Phaser.GameObjects.Text[] = [];
  private passiveSlotIcons: (Phaser.GameObjects.Image | null)[] = [];
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

  /** 低血量警告狀態 */
  private lowHpWarning: boolean = false;
  private lowHpFlashTimer: number = 0;
  private readonly LOW_HP_FLASH_INTERVAL = 400; // ms，閃爍週期

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildLayout();
    this.startUpdateTimer();
  }

  private buildLayout(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const layout = ResponsiveLayout.compute(W, H);

    if (layout.isPortrait) {
      this.buildLayoutPortrait(W, H, layout);
    } else {
      this.buildLayoutLandscape(W, H, layout);
    }
  }

  /** 直屏 HUD 佈局 */
  private buildLayoutPortrait(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const safeX = layout.safeLeft;
    const safeY = layout.safeTop;
    const s = layout.uiScale;

    // ── 上方 HUD 條（高度 H*0.10，固定在頂部）──────────────────────────
    const hudH = Math.round(H * 0.10);
    const hudY = safeY;

    this.panelGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.panelGraphics.fillStyle(0x000000, 0.72);
    this.panelGraphics.fillRoundedRect(0, 0, W, hudY + hudH + 4, 0);
    this.panelGraphics.lineStyle(1, 0xd4af37, 0.30);
    this.panelGraphics.lineBetween(0, hudY + hudH + 4, W, hudY + hudH + 4);

    // HP 條（左側，寬 W*0.42，高 12px）
    this.hpBarWidth = Math.round(W * 0.42);
    this.hpBarX = safeX + 4;
    this.hpBarY = hudY + 6;
    const barH = 12;

    this.hpBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.hpBarBg.fillStyle(0x330000, 1);
    this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);
    this.hpBarBg.lineStyle(1, 0xd4af37, 0.4);
    this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);

    this.hpBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawHpBar(1.0);

    this.hpText = this.scene.add.text(
      Math.round(this.hpBarX + this.hpBarWidth / 2),
      Math.round(this.hpBarY + barH / 2),
      '--/--',
      uiText(9, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(12);

    // EXP 條（HP 條下方，寬 W*0.42，高 7px）
    this.expBarWidth = Math.round(W * 0.42);
    this.expBarX = this.hpBarX;
    this.expBarY = this.hpBarY + barH + 4;
    const expBarH = 7;

    this.expBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.expBarBg.fillStyle(0x001133, 1);
    this.expBarBg.fillRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);
    this.expBarBg.lineStyle(1, 0x4466aa, 0.4);
    this.expBarBg.strokeRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);

    this.expBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawExpBar(0);

    // Lv 圓形（HP 條右側）
    const lvX = this.hpBarX + this.hpBarWidth + 18;
    const lvY = this.hpBarY + barH / 2;
    this.levelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.levelBg.fillStyle(0x1a1a00, 0.9);
    this.levelBg.fillCircle(lvX, lvY, 14);
    this.levelBg.lineStyle(1.5, 0xffd700, 0.8);
    this.levelBg.strokeCircle(lvX, lvY, 14);
    this.levelText = this.scene.add.text(lvX, lvY, 'Lv.1',
      uiText(9, '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    // 時間（右側，上行）
    this.timerText = this.scene.add.text(
      W - safeX - 4, hudY + 8,
      '⏱ 00:00', uiText(Math.round(11 * s), '#dddddd')
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(11);

    // 擊殺數（右側，下行）
    this.killText = this.scene.add.text(
      W - safeX - 4, hudY + 8 + 18,
      '⚔ 0', uiText(Math.round(11 * s), '#ffccaa')
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(11);

    // ── 右下角按鈕（暫停 + 屬性，避開 safe area bottom）────────────────
    const btnBottomY = H - layout.safeBottom - 24;
    this.pauseX = W - safeX - 28;
    this.pauseY = btnBottomY;
    this.statsX = W - safeX - 84;
    this.statsY = btnBottomY;

    this.statsBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawStatsBtn(false);
    this.statsBtnText = this.scene.add.text(this.statsX, this.statsY, '屬',
      uiText(14, '#aaddff', { fontStyle: 'bold' })
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

    // ── 武器格 + 被動格（上方 HUD 條下方，小圖示水平排列）──────────────
    this.buildSlotsPortrait(W, H, hudY + hudH + 6);
  }

  /** 橫屏 HUD 佈局（原有設計） */
  private buildLayoutLandscape(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const safeX = layout.safeLeft;
    const safeY = layout.safeTop;

    // ── 1. 左上主 HUD（緊湊，高 52px）──────────────────────────────────
    const panelX = safeX;
    const panelY = safeY;
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
      Math.round(this.hpBarX + this.hpBarWidth / 2),
      Math.round(this.hpBarY + barH / 2),
      '--/--',
      uiText(9, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(12);

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

    // ── 2. 右上按鈕（暫停最右，屬性左 60px，y=safeY+22）────────────────
    this.pauseX = W - safeX - 20;
    this.pauseY = safeY + 22;
    this.statsX = W - safeX - 76;
    this.statsY = safeY + 22;

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

    // ── 3. 右下資訊（y = H - safeY - 14）────────────────────────────────
    this.timerText = this.scene.add.text(
      W - safeX, H - safeY - 14,
      '⏱ 00:00', uiText(12, '#dddddd')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);
    this.killText = this.scene.add.text(
      W - safeX - 90, H - safeY - 14,
      '⚔ 0', uiText(12, '#ffccaa')
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 4. 武器欄 + 被動欄 ──────────────────────────────────────────────
    this.buildSlots(W, H);
  }

  /**
   * 直屏武器格 + 被動格（上方 HUD 條下方，小圖示水平排列）
   * 武器格：左側，被動格：右側，各最多 6 格
   */
  private buildSlotsPortrait(W: number, _H: number, startY: number): void {
    const MAX_SLOTS = 6;
    const slotSize = 30; // 小圖示尺寸
    const slotGap = 3;
    const rowH = slotSize + 2;

    // 武器格：左側水平排列
    const wStartX = 6;
    const pStartX = W / 2 + 4;
    const slotY = startY + 2;

    // 武器欄背景
    this.weaponPanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.weaponPanelBg.fillStyle(0x000000, 0.30);
    this.weaponPanelBg.fillRoundedRect(wStartX - 2, slotY - 2, MAX_SLOTS * (slotSize + slotGap) + 4, rowH + 4, 3);

    this.weaponHeaderText = this.scene.add.text(
      wStartX, slotY - 1, '武', uiText(8, '#ccaa44')
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(10);

    // 被動欄背景
    this.passivePanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.passivePanelBg.fillStyle(0x000000, 0.30);
    this.passivePanelBg.fillRoundedRect(pStartX - 2, slotY - 2, MAX_SLOTS * (slotSize + slotGap) + 4, rowH + 4, 3);

    this.passiveHeaderText = this.scene.add.text(
      pStartX, slotY - 1, '被', uiText(8, '#7799cc')
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(10);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const wxSlot = wStartX + i * (slotSize + slotGap);
      const pxSlot = pStartX + i * (slotSize + slotGap);

      const wBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      wBg.fillStyle(0x111111, 0.50);
      wBg.fillRoundedRect(wxSlot, slotY, slotSize, slotSize, 3);
      wBg.lineStyle(1, 0x2a2a2a, 0.5);
      wBg.strokeRoundedRect(wxSlot, slotY, slotSize, slotSize, 3);
      this.weaponSlotBgs.push(wBg);

      const wTxt = this.scene.add.text(
        wxSlot + slotSize / 2, slotY + slotSize / 2,
        '--', uiText(8, '#2a2a2a')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.weaponSlotTexts.push(wTxt);
      this.weaponSlotIcons.push(null);

      const pBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      pBg.fillStyle(0x111111, 0.50);
      pBg.fillRoundedRect(pxSlot, slotY, slotSize, slotSize, 3);
      pBg.lineStyle(1, 0x2a2a2a, 0.5);
      pBg.strokeRoundedRect(pxSlot, slotY, slotSize, slotSize, 3);
      this.passiveSlotBgs.push(pBg);

      const pTxt = this.scene.add.text(
        pxSlot + slotSize / 2, slotY + slotSize / 2,
        '--', uiText(8, '#2a2a2a')
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.passiveSlotTexts.push(pTxt);
      this.passiveSlotIcons.push(null);
    }
  }

  /**
   * 武器欄 / 被動欄座標常數（buildSlots 與 updateSlots 共用）
   * 垂直置中：panelY = round((H - totalH) / 2)
   * 水平：武器欄 x=72，被動欄 x=W-72-slotW
   */
  private static slotLayout(W: number, H: number) {
    const MAX_SLOTS = 6;
    const slotW = 60;
    const slotH = 16;
    const slotGap = 2;
    const headerH = 18;
    const totalH = MAX_SLOTS * (slotH + slotGap) + headerH;
    const wX = 72;
    const pX = W - 72 - slotW;
    // 垂直置中，但不低於 y=80（避免和左上 HUD 重疊）
    const panelY = Math.max(80, Math.round((H - totalH) / 2));
    const wY = panelY + headerH;
    const pY = panelY + headerH;
    return { MAX_SLOTS, slotW, slotH, slotGap, totalH, headerH, wX, pX, wY, pY, panelY };
  }

  /**
   * 武器欄（左側，x=72）與被動欄（右側，x=W-72-slotW）
   * 兩欄垂直置中對齊，y 相同
   */
  private buildSlots(W: number, H: number): void {
    const { MAX_SLOTS, slotW, slotH, slotGap, totalH, headerH, wX, pX, wY, pY, panelY } = HUD.slotLayout(W, H);

    // 武器欄背景
    this.weaponPanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.weaponPanelBg.fillStyle(0x000000, 0.35);
    this.weaponPanelBg.fillRoundedRect(wX - 2, panelY - 2, slotW + 4, totalH + 4, 4);
    this.weaponPanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.weaponPanelBg.strokeRoundedRect(wX - 2, panelY - 2, slotW + 4, totalH + 4, 4);

    this.weaponHeaderText = this.scene.add.text(
      wX + slotW / 2, panelY + headerH / 2,
      '武器', uiText(9, '#ccaa44')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // 被動欄背景
    this.passivePanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.passivePanelBg.fillStyle(0x000000, 0.35);
    this.passivePanelBg.fillRoundedRect(pX - 2, panelY - 2, slotW + 4, totalH + 4, 4);
    this.passivePanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.passivePanelBg.strokeRoundedRect(pX - 2, panelY - 2, slotW + 4, totalH + 4, 4);

    this.passiveHeaderText = this.scene.add.text(
      pX + slotW / 2, panelY + headerH / 2,
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
      this.weaponSlotIcons.push(null);

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
      this.passiveSlotIcons.push(null);
    }
  }

  private drawHpBar(ratio: number): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const isPortrait = H > W;
    const barH = isPortrait ? 12 : 10;
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

    // 低血量閃爍：HP < 30% 時血條邊框閃爍紅色
    if (this.lowHpWarning) {
      const W2 = this.scene.scale.width;
      const H2 = this.scene.scale.height;
      const barH2 = H2 > W2 ? 12 : 10;
      this.lowHpFlashTimer += 250; // 每次 tick 約 250ms
      const flashOn = Math.floor(this.lowHpFlashTimer / this.LOW_HP_FLASH_INTERVAL) % 2 === 0;
      this.hpBarBg.clear();
      this.hpBarBg.fillStyle(flashOn ? 0x550000 : 0x330000, 1);
      this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH2, 3);
      this.hpBarBg.lineStyle(flashOn ? 2 : 1, flashOn ? 0xff2222 : 0xd4af37, flashOn ? 1 : 0.4);
      this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH2, 3);
    }

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
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const layout = ResponsiveLayout.compute(W, H);

    if (layout.isPortrait) {
      this.updateSlotsPortrait(player, W, H, layout);
    } else {
      this.updateSlotsLandscape(player, W, H);
    }
  }

  private updateSlotsPortrait(player: Player, W: number, _H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const MAX_SLOTS = 6;
    const slotSize = 30;
    const slotGap = 3;
    const hudH = Math.round(_H * 0.10);
    const slotY = layout.safeTop + hudH + 8;
    const wStartX = 6;
    const pStartX = W / 2 + 4;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const ws = player.equipment.weapons[i];
      const wxSlot = wStartX + i * (slotSize + slotGap);

      if (ws) {
        const w = getWeaponById(ws.weaponId);
        const iconKey = w?.iconKey;
        if (iconKey && AssetLoader.hasTexture(this.scene, iconKey)) {
          if (!this.weaponSlotIcons[i]) {
            const img = this.scene.add.image(wxSlot + slotSize / 2, slotY + slotSize / 2, iconKey)
              .setScrollFactor(0).setDepth(11);
            img.setDisplaySize(slotSize - 4, slotSize - 4);
            this.weaponSlotIcons[i] = img;
          } else {
            this.weaponSlotIcons[i]!.setTexture(iconKey).setVisible(true);
            this.weaponSlotIcons[i]!.setPosition(wxSlot + slotSize / 2, slotY + slotSize / 2);
          }
          this.weaponSlotTexts[i].setText(`L${ws.level}`);
          this.weaponSlotTexts[i].setColor('#ffdd88');
          this.weaponSlotTexts[i].setPosition(wxSlot + slotSize / 2, slotY + slotSize - 6);
        } else {
          if (this.weaponSlotIcons[i]) this.weaponSlotIcons[i]!.setVisible(false);
          this.weaponSlotTexts[i].setText(`L${ws.level}`);
          this.weaponSlotTexts[i].setColor('#ffdd88');
          this.weaponSlotTexts[i].setPosition(wxSlot + slotSize / 2, slotY + slotSize / 2);
        }
      } else {
        if (this.weaponSlotIcons[i]) this.weaponSlotIcons[i]!.setVisible(false);
        this.weaponSlotTexts[i].setText('--');
        this.weaponSlotTexts[i].setColor('#2a2a2a');
        this.weaponSlotTexts[i].setPosition(wxSlot + slotSize / 2, slotY + slotSize / 2);
      }
    }

    for (let i = 0; i < MAX_SLOTS; i++) {
      const ps = player.equipment.passives[i];
      const pxSlot = pStartX + i * (slotSize + slotGap);

      if (ps) {
        const p = getPassiveById(ps.passiveId);
        const iconKey = p?.iconKey;
        if (iconKey && AssetLoader.hasTexture(this.scene, iconKey)) {
          if (!this.passiveSlotIcons[i]) {
            const img = this.scene.add.image(pxSlot + slotSize / 2, slotY + slotSize / 2, iconKey)
              .setScrollFactor(0).setDepth(11);
            img.setDisplaySize(slotSize - 4, slotSize - 4);
            this.passiveSlotIcons[i] = img;
          } else {
            this.passiveSlotIcons[i]!.setTexture(iconKey).setVisible(true);
            this.passiveSlotIcons[i]!.setPosition(pxSlot + slotSize / 2, slotY + slotSize / 2);
          }
          this.passiveSlotTexts[i].setText(`L${ps.level}`);
          this.passiveSlotTexts[i].setColor('#88ccff');
          this.passiveSlotTexts[i].setPosition(pxSlot + slotSize / 2, slotY + slotSize - 6);
        } else {
          if (this.passiveSlotIcons[i]) this.passiveSlotIcons[i]!.setVisible(false);
          this.passiveSlotTexts[i].setText(`L${ps.level}`);
          this.passiveSlotTexts[i].setColor('#88ccff');
          this.passiveSlotTexts[i].setPosition(pxSlot + slotSize / 2, slotY + slotSize / 2);
        }
      } else {
        if (this.passiveSlotIcons[i]) this.passiveSlotIcons[i]!.setVisible(false);
        this.passiveSlotTexts[i].setText('--');
        this.passiveSlotTexts[i].setColor('#2a2a2a');
        this.passiveSlotTexts[i].setPosition(pxSlot + slotSize / 2, slotY + slotSize / 2);
      }
    }
  }

  private updateSlotsLandscape(player: Player, W: number, H: number): void {
    const { MAX_SLOTS, slotW, slotH, slotGap, wX, pX, wY, pY } = HUD.slotLayout(W, H);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const ws = player.equipment.weapons[i];
      const wySlot = wY + i * (slotH + slotGap);

      if (ws) {
        const w = getWeaponById(ws.weaponId);
        const iconKey = w?.iconKey;

        // 嘗試顯示圖示
        if (iconKey && AssetLoader.hasTexture(this.scene, iconKey)) {
          // 有圖示：顯示 icon + 等級文字
          if (!this.weaponSlotIcons[i]) {
            const img = this.scene.add.image(
              wX + slotH / 2, wySlot + slotH / 2, iconKey
            ).setScrollFactor(0).setDepth(11);
            img.setDisplaySize(slotH - 2, slotH - 2);
            this.weaponSlotIcons[i] = img;
          } else {
            this.weaponSlotIcons[i]!.setTexture(iconKey).setVisible(true);
            this.weaponSlotIcons[i]!.setPosition(wX + slotH / 2, wySlot + slotH / 2);
          }
          this.weaponSlotTexts[i].setText(`L${ws.level}`);
          this.weaponSlotTexts[i].setColor('#ffdd88');
          this.weaponSlotTexts[i].setX(wX + slotH + 2 + (slotW - slotH - 2) / 2);
        } else {
          // Fallback：純文字
          if (this.weaponSlotIcons[i]) {
            this.weaponSlotIcons[i]!.setVisible(false);
          }
          this.weaponSlotTexts[i].setText(`${w?.name ?? ws.weaponId} L${ws.level}`);
          this.weaponSlotTexts[i].setColor('#ffdd88');
          this.weaponSlotTexts[i].setX(wX + slotW / 2);
        }
      } else {
        if (this.weaponSlotIcons[i]) {
          this.weaponSlotIcons[i]!.setVisible(false);
        }
        this.weaponSlotTexts[i].setText('--');
        this.weaponSlotTexts[i].setColor('#2a2a2a');
        this.weaponSlotTexts[i].setX(wX + slotW / 2);
      }
    }

    for (let i = 0; i < MAX_SLOTS; i++) {
      const ps = player.equipment.passives[i];
      const pySlot = pY + i * (slotH + slotGap);

      if (ps) {
        const p = getPassiveById(ps.passiveId);
        const iconKey = p?.iconKey;

        if (iconKey && AssetLoader.hasTexture(this.scene, iconKey)) {
          if (!this.passiveSlotIcons[i]) {
            const img = this.scene.add.image(
              pX + slotH / 2, pySlot + slotH / 2, iconKey
            ).setScrollFactor(0).setDepth(11);
            img.setDisplaySize(slotH - 2, slotH - 2);
            this.passiveSlotIcons[i] = img;
          } else {
            this.passiveSlotIcons[i]!.setTexture(iconKey).setVisible(true);
            this.passiveSlotIcons[i]!.setPosition(pX + slotH / 2, pySlot + slotH / 2);
          }
          this.passiveSlotTexts[i].setText(`L${ps.level}`);
          this.passiveSlotTexts[i].setColor('#88ccff');
          this.passiveSlotTexts[i].setX(pX + slotH + 2 + (slotW - slotH - 2) / 2);
        } else {
          if (this.passiveSlotIcons[i]) {
            this.passiveSlotIcons[i]!.setVisible(false);
          }
          this.passiveSlotTexts[i].setText(`${p?.name ?? ps.passiveId} L${ps.level}`);
          this.passiveSlotTexts[i].setColor('#88ccff');
          this.passiveSlotTexts[i].setX(pX + slotW / 2);
        }
      } else {
        if (this.passiveSlotIcons[i]) {
          this.passiveSlotIcons[i]!.setVisible(false);
        }
        this.passiveSlotTexts[i].setText('--');
        this.passiveSlotTexts[i].setColor('#2a2a2a');
        this.passiveSlotTexts[i].setX(pX + slotW / 2);
      }
    }
  }

  public onPauseClick(callback: () => void): void {
    this.pauseHitArea.on('pointerdown', callback);
  }

  public onStatsClick(callback: () => void): void {
    this.statsClickCallback = callback;
  }

  /**
   * 設定低血量警告狀態（HP < 30% 時傳入 true）
   * 由 GameScene 每幀呼叫
   */
  public setLowHpWarning(active: boolean): void {
    if (this.lowHpWarning !== active) {
      this.lowHpWarning = active;
      if (!active) {
        // 恢復正常血條背景
        const W2 = this.scene.scale.width;
        const H2 = this.scene.scale.height;
        const barH2 = H2 > W2 ? 12 : 10;
        this.lowHpFlashTimer = 0;
        this.hpBarBg.clear();
        this.hpBarBg.fillStyle(0x330000, 1);
        this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH2, 3);
        this.hpBarBg.lineStyle(1, 0xd4af37, 0.4);
        this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH2, 3);
      }
    }
  }

  /**
   * 螢幕尺寸變更時重建 HUD（RESIZE 模式下旋轉螢幕時呼叫）
   * 銷毀所有現有元素後重新 buildLayout
   */
  public rebuild(): void {
    this.destroy();
    // 重置陣列
    this.weaponSlotBgs = [];
    this.weaponSlotTexts = [];
    this.weaponSlotIcons = [];
    this.passiveSlotBgs = [];
    this.passiveSlotTexts = [];
    this.passiveSlotIcons = [];
    this.buildLayout();
    this.startUpdateTimer();
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
    for (const img of this.weaponSlotIcons) img?.destroy();
    for (const g of this.passiveSlotBgs) g?.destroy();
    for (const t of this.passiveSlotTexts) t?.destroy();
    for (const img of this.passiveSlotIcons) img?.destroy();
  }
}
