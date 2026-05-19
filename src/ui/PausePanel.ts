import Phaser from 'phaser';
import { uiText, uiTitle } from './UIStyles';

/**
 * PausePanel — 暫停面板
 * 包含：繼續遊戲、返回主選單（含二次確認）
 */
export class PausePanel {
  private scene: Phaser.Scene;

  // ── 主暫停面板元素 ────────────────────────────────────────────────────
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

  // ── 二次確認面板元素 ──────────────────────────────────────────────────
  private confirmContainer!: Phaser.GameObjects.Container;

  private _isShowing: boolean = false;
  private _onMainMenuConfirm: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.hide();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── 遮罩 ──────────────────────────────────────────────────────────────
    this.overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.overlay.fillStyle(0x000000, 0.65);
    this.overlay.fillRect(0, 0, W, H);
    this.overlay.fillStyle(0x0a0a1a, 0.3);
    this.overlay.fillRect(W * 0.25, H * 0.22, W * 0.5, H * 0.56);

    // ── 標題 ──────────────────────────────────────────────────────────────
    this.titleShadow = this.scene.add.text(
      Math.round(W * 0.5) + 2, Math.round(H * 0.34) + 2, '已暫停',
      uiTitle(36, '#330000')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    this.titleText = this.scene.add.text(
      Math.round(W * 0.5), Math.round(H * 0.34), '已暫停',
      uiTitle(36, '#ffffff')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    // ── 裝飾線 ────────────────────────────────────────────────────────────
    this.decorLineTop = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.decorLineTop.lineStyle(1.5, 0xd4af37, 0.7);
    this.decorLineTop.lineBetween(W * 0.38, H * 0.28, W * 0.62, H * 0.28);

    this.decorLineBot = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.decorLineBot.lineStyle(1.5, 0xd4af37, 0.7);
    this.decorLineBot.lineBetween(W * 0.38, H * 0.41, W * 0.62, H * 0.41);

    // ── 繼續遊戲按鈕（y = H*0.52）────────────────────────────────────────
    const resumeX = W * 0.5;
    const resumeY = H * 0.52;
    const btnW = 220;
    const btnH = 50;

    this.resumeBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawBtn(this.resumeBtnGraphics, resumeX, resumeY, btnW, btnH, false, 0x6b0f0f, 0xd4af37);

    this.resumeBtnText = this.scene.add.text(resumeX, resumeY, '▶  繼續遊戲',
      uiText(18, '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);

    this.resumeHitArea = this.scene.add.rectangle(resumeX, resumeY, Math.max(btnW, 88), Math.max(btnH, 48), 0, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });
    this.resumeHitArea.on('pointerover', () => {
      this.drawBtn(this.resumeBtnGraphics, resumeX, resumeY, btnW, btnH, true, 0x6b0f0f, 0xd4af37);
      this.resumeBtnText.setColor('#ffd700');
    });
    this.resumeHitArea.on('pointerout', () => {
      this.drawBtn(this.resumeBtnGraphics, resumeX, resumeY, btnW, btnH, false, 0x6b0f0f, 0xd4af37);
      this.resumeBtnText.setColor('#ffffff');
    });

    // ── 返回主選單按鈕（y = H*0.65）──────────────────────────────────────
    const menuX = W * 0.5;
    const menuY = H * 0.65;

    this.mainMenuBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawBtn(this.mainMenuBtnGraphics, menuX, menuY, btnW, btnH, false, 0x0f1828, 0x556677);

    this.mainMenuBtnText = this.scene.add.text(menuX, menuY, '⌂  返回主選單',
      uiText(16, '#aaaacc', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);

    this.mainMenuHitArea = this.scene.add.rectangle(menuX, menuY, Math.max(btnW, 88), Math.max(btnH, 48), 0, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });
    this.mainMenuHitArea.on('pointerover', () => {
      this.drawBtn(this.mainMenuBtnGraphics, menuX, menuY, btnW, btnH, true, 0x0f1828, 0x556677);
      this.mainMenuBtnText.setColor('#ffffff');
    });
    this.mainMenuHitArea.on('pointerout', () => {
      this.drawBtn(this.mainMenuBtnGraphics, menuX, menuY, btnW, btnH, false, 0x0f1828, 0x556677);
      this.mainMenuBtnText.setColor('#aaaacc');
    });
    this.mainMenuHitArea.on('pointerdown', () => this.showConfirm());

    // ── 二次確認面板 ──────────────────────────────────────────────────────
    this.confirmContainer = this.scene.add.container(0, 0).setDepth(110).setVisible(false);
    this.buildConfirmPanel(W, H);
  }

  private buildConfirmPanel(W: number, H: number): void {
    const panelW = Math.min(340, W * 0.40);
    const panelH = 170;
    const cx = Math.round(W * 0.5);
    const cy = Math.round(H * 0.5);
    const px = Math.round(cx - panelW / 2);
    const py = Math.round(cy - panelH / 2);
    const r = 10;

    // 遮罩
    const overlay2 = this.scene.add.graphics();
    overlay2.fillStyle(0x000000, 0.55);
    overlay2.fillRect(0, 0, W, H);
    this.confirmContainer.add(overlay2);

    // 面板背景
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x080818, 0.97);
    panel.fillRoundedRect(px, py, panelW, panelH, r);
    panel.lineStyle(1.5, 0xd4af37, 0.8);
    panel.strokeRoundedRect(px, py, panelW, panelH, r);
    panel.lineStyle(1, 0xffd700, 0.12);
    panel.strokeRoundedRect(px + 3, py + 3, panelW - 6, panelH - 6, r - 2);
    this.confirmContainer.add(panel);

    // 提示文字
    const msg = this.scene.add.text(cx, cy - 32,
      '確定要返回主選單嗎？\n本局進度將會結束。',
      uiText(14, '#dddddd', { align: 'center', lineSpacing: 6 })
    ).setOrigin(0.5, 0.5);
    this.confirmContainer.add(msg);

    // 取消按鈕
    const cancelX = Math.round(cx - 70);
    const confirmX = Math.round(cx + 70);
    const btnY = Math.round(cy + 44);
    const sbW = 110;
    const sbH = 38;

    const cancelG = this.scene.add.graphics();
    this.drawBtn(cancelG, cancelX, btnY, sbW, sbH, false, 0x1a1a2a, 0x556677);
    this.confirmContainer.add(cancelG);

    const cancelTxt = this.scene.add.text(cancelX, btnY, '取消',
      uiText(14, '#aaaacc', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5);
    this.confirmContainer.add(cancelTxt);

    const cancelHit = this.scene.add.rectangle(cancelX, btnY, Math.max(sbW, 88), Math.max(sbH, 48), 0, 0)
      .setInteractive({ useHandCursor: true });
    cancelHit.on('pointerover', () => {
      this.drawBtn(cancelG, cancelX, btnY, sbW, sbH, true, 0x1a1a2a, 0x556677);
      cancelTxt.setColor('#ffffff');
    });
    cancelHit.on('pointerout', () => {
      this.drawBtn(cancelG, cancelX, btnY, sbW, sbH, false, 0x1a1a2a, 0x556677);
      cancelTxt.setColor('#aaaacc');
    });
    cancelHit.on('pointerdown', () => this.hideConfirm());
    this.confirmContainer.add(cancelHit);

    // 確定返回按鈕
    const okG = this.scene.add.graphics();
    this.drawBtn(okG, confirmX, btnY, sbW, sbH, false, 0x5a0a0a, 0xd4af37);
    this.confirmContainer.add(okG);

    const okTxt = this.scene.add.text(confirmX, btnY, '確定返回',
      uiText(14, '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5);
    this.confirmContainer.add(okTxt);

    const okHit = this.scene.add.rectangle(confirmX, btnY, Math.max(sbW, 88), Math.max(sbH, 48), 0, 0)
      .setInteractive({ useHandCursor: true });
    okHit.on('pointerover', () => {
      this.drawBtn(okG, confirmX, btnY, sbW, sbH, true, 0x5a0a0a, 0xd4af37);
      okTxt.setColor('#ffd700');
    });
    okHit.on('pointerout', () => {
      this.drawBtn(okG, confirmX, btnY, sbW, sbH, false, 0x5a0a0a, 0xd4af37);
      okTxt.setColor('#ffffff');
    });
    okHit.on('pointerdown', () => {
      this.hideConfirm();
      this.hide();
      if (this._onMainMenuConfirm) this._onMainMenuConfirm();
    });
    this.confirmContainer.add(okHit);
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

  private showConfirm(): void {
    this.confirmContainer.setVisible(true);
  }

  private hideConfirm(): void {
    this.confirmContainer.setVisible(false);
  }

  // ── 公開 API ──────────────────────────────────────────────────────────

  public onResumeClick(callback: () => void): void {
    this.resumeHitArea.on('pointerdown', callback);
  }

  /** 設定「確定返回主選單」的回呼 */
  public onMainMenuConfirm(callback: () => void): void {
    this._onMainMenuConfirm = callback;
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
    this.confirmContainer.setVisible(false); // 確認面板預設隱藏
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
    this.confirmContainer.setVisible(false);
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
    this.confirmContainer?.destroy(true);
  }
}
