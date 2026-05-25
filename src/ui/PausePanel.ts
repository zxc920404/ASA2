import Phaser from 'phaser';
import { uiText, uiTitle } from './UIStyles';
import { ResponsiveLayout } from '../utils/ResponsiveLayout';

/**
 * PausePanel — 暫停面板
 * 包含：繼續遊戲、返回主選單（含二次確認）
 *
 * 重要：所有 GameObjects 必須 setScrollFactor(0)，
 * 否則在 GameScene 攝影機跟隨玩家時座標會偏移，導致點擊熱區失效。
 */
export class PausePanel {
  private scene: Phaser.Scene;

  private overlay!: Phaser.GameObjects.Graphics;
  private titleShadow!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private decorLineTop!: Phaser.GameObjects.Graphics;
  private decorLineBot!: Phaser.GameObjects.Graphics;

  private resumeBtnGraphics!: Phaser.GameObjects.Graphics;
  private resumeBtnText!: Phaser.GameObjects.Text;
  private resumeHitArea!: Phaser.GameObjects.Rectangle;

  private mainMenuBtnGraphics!: Phaser.GameObjects.Graphics;
  private mainMenuBtnText!: Phaser.GameObjects.Text;
  private mainMenuHitArea!: Phaser.GameObjects.Rectangle;

  // 確認面板（所有子物件都要 setScrollFactor(0)）
  private confirmOverlay!: Phaser.GameObjects.Graphics;
  private confirmPanel!: Phaser.GameObjects.Graphics;
  private confirmMsg!: Phaser.GameObjects.Text;
  private cancelG!: Phaser.GameObjects.Graphics;
  private cancelTxt!: Phaser.GameObjects.Text;
  private cancelHit!: Phaser.GameObjects.Rectangle;
  private okG!: Phaser.GameObjects.Graphics;
  private okTxt!: Phaser.GameObjects.Text;
  private okHit!: Phaser.GameObjects.Rectangle;

  private _isShowing: boolean = false;
  private _resumeCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.hide();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const layout = ResponsiveLayout.compute(W, H);
    const s = layout.uiScale;
    const cx = layout.centerX;
    const isPortrait = layout.isPortrait;

    // ── 遮罩 ──────────────────────────────────────────────────────────────
    this.overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.overlay.fillStyle(0x000000, 0.45);
    this.overlay.fillRect(0, 0, W, H);
    if (isPortrait) {
      this.overlay.fillStyle(0x0a0a1a, 0.3);
      this.overlay.fillRect(W * 0.08, H * 0.25, W * 0.84, H * 0.50);
    } else {
      this.overlay.fillStyle(0x0a0a1a, 0.3);
      this.overlay.fillRect(W * 0.25, H * 0.20, W * 0.5, H * 0.60);
    }

    // ── 標題 ──────────────────────────────────────────────────────────────
    const titleY = isPortrait ? Math.round(H * 0.33) : Math.round(H * 0.32);
    this.titleShadow = this.scene.add.text(
      Math.round(cx) + 2, titleY + 2, '已暫停',
      uiTitle(Math.round(36 * s), '#330000')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    this.titleText = this.scene.add.text(
      Math.round(cx), titleY, '已暫停',
      uiTitle(Math.round(36 * s), '#ffffff')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    // ── 裝飾線 ────────────────────────────────────────────────────────────
    const lineTopY = isPortrait ? H * 0.28 : H * 0.26;
    const lineBotY = isPortrait ? H * 0.40 : H * 0.40;
    const lineXL = isPortrait ? W * 0.20 : W * 0.38;
    const lineXR = isPortrait ? W * 0.80 : W * 0.62;

    this.decorLineTop = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.decorLineTop.lineStyle(1.5, 0xd4af37, 0.7);
    this.decorLineTop.lineBetween(lineXL, lineTopY, lineXR, lineTopY);

    this.decorLineBot = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.decorLineBot.lineStyle(1.5, 0xd4af37, 0.7);
    this.decorLineBot.lineBetween(lineXL, lineBotY, lineXR, lineBotY);

    // ── 繼續遊戲按鈕 ──────────────────────────────────────────────────────
    const resumeX = Math.round(cx);
    const resumeY = isPortrait ? Math.round(H * 0.50) : Math.round(H * 0.52);
    const btnW = isPortrait
      ? Math.round(Math.min(W * 0.60, 280))
      : Math.round(Math.min(220, W * 0.28) * s);
    const btnH = layout.btnH;

    this.resumeBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawBtn(this.resumeBtnGraphics, resumeX, resumeY, btnW, btnH, false, 0x6b0f0f, 0xd4af37);

    this.resumeBtnText = this.scene.add.text(resumeX, resumeY, '▶  繼續遊戲',
      uiText(Math.round(18 * s), '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);

    this.resumeHitArea = this.scene.add.rectangle(
      resumeX, resumeY, Math.max(btnW, layout.minTouchTarget), Math.max(btnH, layout.minTouchTarget), 0, 0
    ).setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });

    this.resumeHitArea.on('pointerover', () => {
      this.drawBtn(this.resumeBtnGraphics, resumeX, resumeY, btnW, btnH, true, 0x6b0f0f, 0xd4af37);
      this.resumeBtnText.setColor('#ffd700');
    });
    this.resumeHitArea.on('pointerout', () => {
      this.drawBtn(this.resumeBtnGraphics, resumeX, resumeY, btnW, btnH, false, 0x6b0f0f, 0xd4af37);
      this.resumeBtnText.setColor('#ffffff');
    });

    // ── 返回主選單按鈕 ────────────────────────────────────────────────────
    const menuX = Math.round(cx);
    // 直屏：繼續按鈕下方 btnH + 16px；橫屏：原有位置
    const menuY = isPortrait
      ? Math.round(resumeY + btnH + 16)
      : Math.round(H * 0.66);

    this.mainMenuBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawBtn(this.mainMenuBtnGraphics, menuX, menuY, btnW, btnH, false, 0x0f1828, 0x556677);

    this.mainMenuBtnText = this.scene.add.text(menuX, menuY, '⌂  返回主選單',
      uiText(Math.round(16 * s), '#aaaacc', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);

    this.mainMenuHitArea = this.scene.add.rectangle(
      menuX, menuY, Math.max(btnW, layout.minTouchTarget), Math.max(btnH, layout.minTouchTarget), 0, 0
    ).setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });

    this.mainMenuHitArea.on('pointerover', () => {
      this.drawBtn(this.mainMenuBtnGraphics, menuX, menuY, btnW, btnH, true, 0x0f1828, 0x556677);
      this.mainMenuBtnText.setColor('#ffffff');
    });
    this.mainMenuHitArea.on('pointerout', () => {
      this.drawBtn(this.mainMenuBtnGraphics, menuX, menuY, btnW, btnH, false, 0x0f1828, 0x556677);
      this.mainMenuBtnText.setColor('#aaaacc');
    });
    this.mainMenuHitArea.on('pointerdown', () => {
      console.log('[PausePanel] return main clicked');
      this.showConfirm();
    });

    // ── 確認面板 ──────────────────────────────────────────────────────────
    this.buildConfirmPanel(W, H, layout);
  }

  private buildConfirmPanel(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const panelW = Math.min(340, W * 0.42);
    const panelH = Math.round(170 * s);
    const cx = layout.centerX;
    const cy = layout.centerY;
    const px = Math.round(cx - panelW / 2);
    const py = Math.round(cy - panelH / 2);
    const r = 10;

    // 確認遮罩
    this.confirmOverlay = this.scene.add.graphics().setScrollFactor(0).setDepth(110);
    this.confirmOverlay.fillStyle(0x000000, 0.55);
    this.confirmOverlay.fillRect(0, 0, W, H);

    // 確認面板背景
    this.confirmPanel = this.scene.add.graphics().setScrollFactor(0).setDepth(111);
    this.confirmPanel.fillStyle(0x080818, 0.97);
    this.confirmPanel.fillRoundedRect(px, py, panelW, panelH, r);
    this.confirmPanel.lineStyle(1.5, 0xd4af37, 0.8);
    this.confirmPanel.strokeRoundedRect(px, py, panelW, panelH, r);
    this.confirmPanel.lineStyle(1, 0xffd700, 0.12);
    this.confirmPanel.strokeRoundedRect(px + 3, py + 3, panelW - 6, panelH - 6, r - 2);

    // 提示文字
    this.confirmMsg = this.scene.add.text(cx, cy - 32,
      '確定要返回主選單嗎？\n本局進度將會結束。',
      uiText(14, '#dddddd', { align: 'center', lineSpacing: 6 })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(112);

    // 取消按鈕
    const cancelX = Math.round(cx - 72);
    const confirmX = Math.round(cx + 72);
    const btnY = Math.round(cy + 46);
    const sbW = 116;
    const sbH = 40;

    this.cancelG = this.scene.add.graphics().setScrollFactor(0).setDepth(111);
    this.drawBtn(this.cancelG, cancelX, btnY, sbW, sbH, false, 0x1a1a2a, 0x556677);

    this.cancelTxt = this.scene.add.text(cancelX, btnY, '取消',
      uiText(14, '#aaaacc', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(112);

    this.cancelHit = this.scene.add.rectangle(
      cancelX, btnY, Math.max(sbW, 88), Math.max(sbH, 48), 0, 0
    ).setScrollFactor(0).setDepth(113).setInteractive({ useHandCursor: true });

    this.cancelHit.on('pointerover', () => {
      this.drawBtn(this.cancelG, cancelX, btnY, sbW, sbH, true, 0x1a1a2a, 0x556677);
      this.cancelTxt.setColor('#ffffff');
    });
    this.cancelHit.on('pointerout', () => {
      this.drawBtn(this.cancelG, cancelX, btnY, sbW, sbH, false, 0x1a1a2a, 0x556677);
      this.cancelTxt.setColor('#aaaacc');
    });
    this.cancelHit.on('pointerdown', () => this.hideConfirm());

    // 確定返回按鈕
    this.okG = this.scene.add.graphics().setScrollFactor(0).setDepth(111);
    this.drawBtn(this.okG, confirmX, btnY, sbW, sbH, false, 0x5a0a0a, 0xd4af37);

    this.okTxt = this.scene.add.text(confirmX, btnY, '確定返回',
      uiText(14, '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(112);

    this.okHit = this.scene.add.rectangle(
      confirmX, btnY, Math.max(sbW, 88), Math.max(sbH, 48), 0, 0
    ).setScrollFactor(0).setDepth(113).setInteractive({ useHandCursor: true });

    this.okHit.on('pointerover', () => {
      this.drawBtn(this.okG, confirmX, btnY, sbW, sbH, true, 0x5a0a0a, 0xd4af37);
      this.okTxt.setColor('#ffd700');
    });
    this.okHit.on('pointerout', () => {
      this.drawBtn(this.okG, confirmX, btnY, sbW, sbH, false, 0x5a0a0a, 0xd4af37);
      this.okTxt.setColor('#ffffff');
    });
    this.okHit.on('pointerdown', () => {
      console.log('[PausePanel] confirm return main');
      // 直接從 scene 跳轉，不依賴外部回呼
      this.hideConfirm();
      this.hide();
      this.scene.scene.start('MainMenuScene');
    });

    // 初始隱藏確認面板
    this.setConfirmVisible(false);
  }

  private drawBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
    hovered: boolean, fillColor: number, borderColor: number
  ): void {
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);
    const r = 7;
    g.clear();
    const fill = hovered ? Math.min(fillColor + 0x181818, 0xffffff) : fillColor;
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, r);
    if (hovered) {
      g.lineStyle(5, borderColor, 0.18);
      g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    }
    g.lineStyle(hovered ? 2 : 1.5, borderColor, hovered ? 1 : 0.75);
    g.strokeRoundedRect(x, y, w, h, r);
  }

  private setConfirmVisible(visible: boolean): void {
    this.confirmOverlay.setVisible(visible);
    this.confirmPanel.setVisible(visible);
    this.confirmMsg.setVisible(visible);
    this.cancelG.setVisible(visible);
    this.cancelTxt.setVisible(visible);
    this.cancelHit.setVisible(visible);
    this.okG.setVisible(visible);
    this.okTxt.setVisible(visible);
    this.okHit.setVisible(visible);
  }

  private showConfirm(): void {
    this.setConfirmVisible(true);
  }

  private hideConfirm(): void {
    this.setConfirmVisible(false);
  }

  // ── 公開 API ──────────────────────────────────────────────────────────

  public onResumeClick(callback: () => void): void {
    this._resumeCallback = callback;
    this.resumeHitArea.on('pointerdown', callback);
  }

  /** 保留向下相容，但跳轉邏輯已內建在 okHit.pointerdown */
  public onMainMenuConfirm(_callback: () => void): void {
    // 跳轉邏輯已直接寫在 okHit 的 pointerdown 事件中
    // 此方法保留以避免 GameScene 呼叫時報錯
  }

  public show(): void {
    this._isShowing = true;
    this.overlay.setVisible(true);
    this.titleShadow.setVisible(true);
    this.titleText.setVisible(true);
    this.decorLineTop.setVisible(true);
    this.decorLineBot.setVisible(true);
    this.resumeBtnGraphics.setVisible(true);
    this.resumeBtnText.setVisible(true);
    this.resumeHitArea.setVisible(true);
    this.mainMenuBtnGraphics.setVisible(true);
    this.mainMenuBtnText.setVisible(true);
    this.mainMenuHitArea.setVisible(true);
    this.setConfirmVisible(false);
  }

  public hide(): void {
    this._isShowing = false;
    this.overlay.setVisible(false);
    this.titleShadow.setVisible(false);
    this.titleText.setVisible(false);
    this.decorLineTop.setVisible(false);
    this.decorLineBot.setVisible(false);
    this.resumeBtnGraphics.setVisible(false);
    this.resumeBtnText.setVisible(false);
    this.resumeHitArea.setVisible(false);
    this.mainMenuBtnGraphics.setVisible(false);
    this.mainMenuBtnText.setVisible(false);
    this.mainMenuHitArea.setVisible(false);
    this.setConfirmVisible(false);
  }

  public isShowing(): boolean {
    return this._isShowing;
  }

  public destroy(): void {
    this.overlay?.destroy();
    this.titleShadow?.destroy();
    this.titleText?.destroy();
    this.decorLineTop?.destroy();
    this.decorLineBot?.destroy();
    this.resumeBtnGraphics?.destroy();
    this.resumeBtnText?.destroy();
    this.resumeHitArea?.destroy();
    this.mainMenuBtnGraphics?.destroy();
    this.mainMenuBtnText?.destroy();
    this.mainMenuHitArea?.destroy();
    this.confirmOverlay?.destroy();
    this.confirmPanel?.destroy();
    this.confirmMsg?.destroy();
    this.cancelG?.destroy();
    this.cancelTxt?.destroy();
    this.cancelHit?.destroy();
    this.okG?.destroy();
    this.okTxt?.destroy();
    this.okHit?.destroy();
  }
}
