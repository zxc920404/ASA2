import Phaser from 'phaser';
import { Player } from '../objects/Player';

/**
 * HUD（抬頭顯示器）— Polish 5 美化版
 * 左上角半透明面板 + 有底框進度條 + 重新排版
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

  // 存活計時器文字
  private timerText!: Phaser.GameObjects.Text;

  // 擊殺數文字
  private killText!: Phaser.GameObjects.Text;

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

    // HP 條背景（有邊框）
    this.hpBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.hpBarBg.fillStyle(0x330000, 1);
    this.hpBarBg.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);
    this.hpBarBg.lineStyle(1, 0xd4af37, 0.6);
    this.hpBarBg.strokeRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth, barH, 3);

    // HP 條前景（綠色，初始滿格）
    this.hpBarFg = this.scene.add.graphics().setScrollFactor(0).setDepth(11);
    this.drawHpBar(1.0);

    // HP 數值文字（條右側）
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

    // EXP 標籤
    this.expLabel = this.scene.add.text(
      this.expBarX,
      this.expBarY - 2,
      'EXP',
      { fontSize: '10px', color: '#6699ff' }
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(11);

    // EXP 條背景
    this.expBarBg = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.expBarBg.fillStyle(0x001133, 1);
    this.expBarBg.fillRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);
    this.expBarBg.lineStyle(1, 0x4466aa, 0.6);
    this.expBarBg.strokeRoundedRect(this.expBarX, this.expBarY, this.expBarWidth, expBarH, 2);

    // EXP 條前景
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

    // ── 暫停按鈕（圓形）────────────────────────────────────────────────────
    const pauseX = W * 0.96;
    const pauseY = H * 0.07;

    this.pauseBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawPauseBtn(false);

    this.pauseBtnText = this.scene.add.text(pauseX, pauseY, '⏸', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

    // 觸控熱區（88×88px）
    this.pauseHitArea = this.scene.add.rectangle(pauseX, pauseY, 88, 88, 0x000000, 0)
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
  }

  /** 繪製 HP 條前景 */
  private drawHpBar(ratio: number): void {
    const barH = 11;
    const fillW = Math.max(0, ratio) * this.hpBarWidth;
    this.hpBarFg.clear();
    if (fillW > 4) {
      // 顏色依 HP 比例變化：高 HP 綠色，低 HP 紅色
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
  }

  public onPauseClick(callback: () => void): void {
    this.pauseHitArea.on('pointerdown', callback);
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
    this.timerText?.destroy();
    this.killText?.destroy();
  }
}
