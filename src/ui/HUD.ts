import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';

/**
 * HUD（抬頭顯示器）— Polish 5 美化版 + 武器/被動欄 + 屬性按鈕
 * 左上角半透明面板 + 有底框進度條 + 重新排版
 * 左側：武器欄（最多 6 格）
 * 右側：被動欄（最多 6 格）
 * 右上角：屬性按鈕（屬）+ 暫停按鈕
 * 所有元素固定於畫面座標（setScrollFactor(0)）
 * 文字每 250ms 更新一次（使用計時器，不每幀重繪）
 */
export class HUD {
  private scene: Phaser.Scene;

  // 面板背景 Graphics
  private panelGraphics!: Phaser.GameObjects.Graphics;

  // HP 條
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;

  // 等級文字
  private levelBg!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;

  // EXP 條
  private expLabel!: Phaser.GameObjects.Text;
  private expBarBg!: Phaser.GameObjects.Graphics;
  private expBarFg!: Phaser.GameObjects.Graphics;

  // 暫停按鈕（圓形）
  private pauseBtnGraphics!: Phaser.GameObjects.Graphics;
  private pauseBtnText!: Phaser.GameObjects.Text;
  private pauseHitArea!: Phaser.GameObjects.Rectangle;

  // 屬性按鈕（圓形）
  private statsBtnGraphics!: Phaser.GameObjects.Graphics;
  private statsBtnText!: Phaser.GameObjects.Text;
  private statsBtnHitArea!: Phaser.GameObjects.Rectangle;

  // 存活計時器文字
  private timerText!: Phaser.GameObjects.Text;

  // 擊殺數文字
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

  // 250ms 更新計時器
  private updateTimer!: Phaser.Time.TimerEvent;

  // 快取資料
  private cachedPlayer: Player | null = null;
  private cachedElapsedSeconds: number = 0;
  private cachedKillCount: number = 0;

  // 條寬度（動態計算）
  private hpBarWidth: number = 0;
  private expBarWidth: number = 0;

  // 條的起始 X（動態計算）
  private hpBarX: number = 0;
  private hpBarY: number = 0;
  private expBarX: number = 0;
  private expBarY: number = 0;

  // 武器/被動欄格子尺寸與位置
  private slotW: number = 0;
  private slotH: number = 0;
  private weaponColX: number = 0;
  private passiveColX: number = 0;
  private slotsStartY: number = 0;

  // 屬性按鈕點擊回呼
  private statsClickCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.startUpdateTimer();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── 左上角半透明面板 ────────────────────────────────────────────────────
    const panelX = W * 0.01;
    const panelY = H * 0.02;
    const panelW = W * 0.38;
    const panelH = H * 0.18;

    this.panelGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.panelGraphics.fillStyle(0x000000, 0.55);
    this.panelGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    this.panelGraphics.lineStyle(1, 0xd4af37, 0.4);
    this.panelGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);

    // ── HP 條 ──────────────────────────────────────────────────────────────
    this.hpBarWidth = W * 0.28;
    this.hpBarX = W * 0.03;
    this.hpBarY = H * 0.055;
    const barH = 11;

    this.hpBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.hpBarBg.fillStyle(0x330000, 1);
    this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);
    this.hpBarBg.lineStyle(1, 0xd4af37, 0.6);
    this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);

    this.hpBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawHpBar(1.0);

    this.hpText = this.scene.add.text(
      this.hpBarX + this.hpBarWidth + 6,
      this.hpBarY + barH / 2,
      '--/--',
      { fontSize: '12px', color: '#ffffff' }
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(11);

    // ── EXP 條 ──────────────────────────────────────────────────────────────
    this.expBarWidth = W * 0.28;
    this.expBarX = W * 0.03;
    this.expBarY = H * 0.115;
    const expBarH = 8;

    this.expLabel = this.scene.add.text(
      this.expBarX,
      this.expBarY - 2,
      'EXP',
      { fontSize: '10px', color: '#6699ff' }
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(11);

    this.expBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.expBarBg.fillStyle(0x001133, 1);
    this.expBarBg.fillRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);
    this.expBarBg.lineStyle(1, 0x4466aa, 0.6);
    this.expBarBg.strokeRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);

    this.expBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawExpBar(0);

    // ── 等級文字（圓形背景）────────────────────────────────────────────────
    const lvX = W * 0.34;
    const lvY = H * 0.085;

    this.levelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.levelBg.fillStyle(0x1a1a00, 0.9);
    this.levelBg.fillCircle(lvX, lvY, 18);
    this.levelBg.lineStyle(1.5, 0xffd700, 0.8);
    this.levelBg.strokeCircle(lvX, lvY, 18);

    this.levelText = this.scene.add.text(lvX, lvY, 'Lv.1', {
      fontSize: '13px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    // ── 屬性按鈕（暫停按鈕左邊）────────────────────────────────────────────
    const statsX = W * 0.88;
    const statsY = H * 0.07;

    this.statsBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawStatsBtn(false);

    this.statsBtnText = this.scene.add.text(statsX, statsY, '屬', {
      fontSize: '16px',
      color: '#aaddff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    this.statsBtnHitArea = this.scene.add.rectangle(statsX, statsY, 52, 52, 0x000000, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });

    this.statsBtnHitArea.on('pointerover', () => this.drawStatsBtn(true));
    this.statsBtnHitArea.on('pointerout', () => this.drawStatsBtn(false));
    this.statsBtnHitArea.on('pointerdown', () => {
      if (this.statsClickCallback) this.statsClickCallback();
    });

    // ── 暫停按鈕（圓形）────────────────────────────────────────────────────
    const pauseX = W * 0.96;
    const pauseY = H * 0.07;

    this.pauseBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawPauseBtn(false);

    this.pauseBtnText = this.scene.add.text(pauseX, pauseY, '⏸', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    this.pauseHitArea = this.scene.add.rectangle(pauseX, pauseY, 52, 52, 0x000000, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });

    this.pauseHitArea.on('pointerover', () => this.drawPauseBtn(true));
    this.pauseHitArea.on('pointerout', () => this.drawPauseBtn(false));

    // ── 存活計時器（右下）──────────────────────────────────────────────────
    this.timerText = this.scene.add.text(W * 0.97, H * 0.92, '⏱ 00:00', {
      fontSize: '15px',
      color: '#dddddd',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 擊殺數（右下，計時器左側）──────────────────────────────────────────
    this.killText = this.scene.add.text(W * 0.82, H * 0.92, '⚔ 0', {
      fontSize: '15px',
      color: '#ffccaa',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(11);

    // ── 武器欄（左側中段）──────────────────────────────────────────────────
    this.createWeaponPassiveSlots(W, H);
  }

  /**
   * 建立左側武器欄與右側被動欄
   * 格子縮小、透明度降低，避免遮擋戰鬥視野
   * 空格顯示極淡的「--」，減少視覺雜訊
   */
  private createWeaponPassiveSlots(W: number, H: number): void {
    const MAX_SLOTS = 6;

    // 格子尺寸縮小：寬度約 9.5%，高度 19px
    this.slotW = Math.min(W * 0.095, 68);
    this.slotH = 19;
    const slotGap = 2;

    // 左側武器欄：從畫面 22% 高度開始，避開左上角 HUD 面板
    // 往內側移動 16px，避開手機安全區
    this.weaponColX = W * 0.005 + 16;
    this.slotsStartY = H * 0.22;

    // 右側被動欄：靠右邊界，往內側移動 16px，不超過暫停/屬性按鈕區域
    this.passiveColX = W - this.slotW - W * 0.005 - 16;

    // ── 武器欄背景面板（透明度降低至 0.28）──────────────────────────
    const weaponPanelH = MAX_SLOTS * (this.slotH + slotGap) + 20;
    this.weaponPanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.weaponPanelBg.fillStyle(0x000000, 0.28);
    this.weaponPanelBg.fillRoundedRect(
      this.weaponColX - 2, this.slotsStartY - 18,
      this.slotW + 4, weaponPanelH, 4
    );
    this.weaponPanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.weaponPanelBg.strokeRoundedRect(
      this.weaponColX - 2, this.slotsStartY - 18,
      this.slotW + 4, weaponPanelH, 4
    );

    // 武器欄標題
    this.weaponHeaderText = this.scene.add.text(
      this.weaponColX + this.slotW / 2,
      this.slotsStartY - 10,
      '武器',
      { fontSize: '10px', color: '#ccaa44' }
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // ── 被動欄背景面板（透明度降低至 0.28）──────────────────────────
    const passivePanelH = MAX_SLOTS * (this.slotH + slotGap) + 20;
    this.passivePanelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(9);
    this.passivePanelBg.fillStyle(0x000000, 0.28);
    this.passivePanelBg.fillRoundedRect(
      this.passiveColX - 2, this.slotsStartY - 18,
      this.slotW + 4, passivePanelH, 4
    );
    this.passivePanelBg.lineStyle(1, 0xd4af37, 0.15);
    this.passivePanelBg.strokeRoundedRect(
      this.passiveColX - 2, this.slotsStartY - 18,
      this.slotW + 4, passivePanelH, 4
    );

    // 被動欄標題
    this.passiveHeaderText = this.scene.add.text(
      this.passiveColX + this.slotW / 2,
      this.slotsStartY - 10,
      '被動',
      { fontSize: '10px', color: '#7799cc' }
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // ── 建立 6 個武器格子 ──────────────────────────────────────────────
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slotY = this.slotsStartY + i * (this.slotH + slotGap);

      const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      bg.fillStyle(0x111111, 0.45);
      bg.fillRoundedRect(this.weaponColX, slotY, this.slotW, this.slotH, 2);
      bg.lineStyle(1, 0x333333, 0.4);
      bg.strokeRoundedRect(this.weaponColX, slotY, this.slotW, this.slotH, 2);
      this.weaponSlotBgs.push(bg);

      // 空格顯示極淡的「--」
      const txt = this.scene.add.text(
        this.weaponColX + this.slotW / 2,
        slotY + this.slotH / 2,
        '--',
        { fontSize: '10px', color: '#222222' }
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.weaponSlotTexts.push(txt);
    }

    // ── 建立 6 個被動格子 ──────────────────────────────────────────────
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slotY = this.slotsStartY + i * (this.slotH + slotGap);

      const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
      bg.fillStyle(0x111111, 0.45);
      bg.fillRoundedRect(this.passiveColX, slotY, this.slotW, this.slotH, 2);
      bg.lineStyle(1, 0x333333, 0.4);
      bg.strokeRoundedRect(this.passiveColX, slotY, this.slotW, this.slotH, 2);
      this.passiveSlotBgs.push(bg);

      // 空格顯示極淡的「--」
      const txt = this.scene.add.text(
        this.passiveColX + this.slotW / 2,
        slotY + this.slotH / 2,
        '--',
        { fontSize: '10px', color: '#222222' }
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);
      this.passiveSlotTexts.push(txt);
    }
  }

  /** 更新武器/被動格子顯示（由 onTimerTick 呼叫） */
  private updateSlots(player: Player): void {
    const MAX_SLOTS = 6;

    // 武器欄
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = player.equipment.weapons[i];
      if (slot) {
        const w = getWeaponById(slot.weaponId);
        const name = w?.name ?? slot.weaponId;
        this.weaponSlotTexts[i].setText(`${name} L${slot.level}`);
        this.weaponSlotTexts[i].setColor('#ffdd88');
        this.weaponSlotTexts[i].setFontSize('10px');
      } else {
        this.weaponSlotTexts[i].setText('--');
        this.weaponSlotTexts[i].setColor('#222222');
        this.weaponSlotTexts[i].setFontSize('10px');
      }
    }

    // 被動欄
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = player.equipment.passives[i];
      if (slot) {
        const p = getPassiveById(slot.passiveId);
        const name = p?.name ?? slot.passiveId;
        this.passiveSlotTexts[i].setText(`${name} L${slot.level}`);
        this.passiveSlotTexts[i].setColor('#88ccff');
        this.passiveSlotTexts[i].setFontSize('10px');
      } else {
        this.passiveSlotTexts[i].setText('--');
        this.passiveSlotTexts[i].setColor('#222222');
        this.passiveSlotTexts[i].setFontSize('10px');
      }
    }
  }

  /** 繪製 HP 條前景 */
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

  /** 繪製 EXP 條前景 */
  private drawExpBar(ratio: number): void {
    const expBarH = 8;
    const fillW = Math.max(0, Math.min(1, ratio)) * this.expBarWidth;
    this.expBarFg.clear();
    if (fillW > 2) {
      this.expBarFg.fillStyle(0x44aaff, 1);
      this.expBarFg.fillRoundedRect(this.expBarX, this.expBarY, fillW, expBarH, 2);
    }
  }

  /** 繪製暫停按鈕圓形 */
  private drawPauseBtn(hovered: boolean): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const pauseX = W * 0.96;
    const pauseY = H * 0.07;

    this.pauseBtnGraphics.clear();
    this.pauseBtnGraphics.fillStyle(hovered ? 0x4a1a1a : 0x1a1a1a, 0.85);
    this.pauseBtnGraphics.fillCircle(pauseX, pauseY, 24);
    this.pauseBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 0.9);
    this.pauseBtnGraphics.strokeCircle(pauseX, pauseY, 24);
  }

  /** 繪製屬性按鈕圓形 */
  private drawStatsBtn(hovered: boolean): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const statsX = W * 0.88;
    const statsY = H * 0.07;

    this.statsBtnGraphics.clear();
    this.statsBtnGraphics.fillStyle(hovered ? 0x1a2a4a : 0x0a1a2a, 0.85);
    this.statsBtnGraphics.fillCircle(statsX, statsY, 24);
    this.statsBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0x88ccff : 0x4488aa, 0.9);
    this.statsBtnGraphics.strokeCircle(statsX, statsY, 24);
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
    const elapsedSeconds = this.cachedElapsedSeconds;
    const killCount = this.cachedKillCount;

    // HP 條
    const hpRatio = Math.max(0, player.currentHP / player.stats.maxHP);
    this.drawHpBar(hpRatio);
    this.hpText.setText(`${Math.ceil(player.currentHP)} / ${player.stats.maxHP}`);

    // 等級
    this.levelText.setText(`Lv.${player.level}`);

    // EXP 條
    const requiredExp = 10 + player.level * 5;
    const expRatio = Math.max(0, Math.min(1, player.currentExp / requiredExp));
    this.drawExpBar(expRatio);

    // 計時器
    const totalSec = Math.floor(elapsedSeconds);
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');
    this.timerText.setText(`⏱ ${mm}:${ss}`);

    // 擊殺數
    this.killText.setText(`⚔ ${killCount}`);

    // 武器/被動欄
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
