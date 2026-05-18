import Phaser from 'phaser';

/**
 * PausePanel（暫停面板）— Polish 6a 美化版
 * 深色漸層遮罩 + 金色裝飾線 + 圓角深紅按鈕
 */
export class PausePanel {
  private scene: Phaser.Scene;

  private overlay!: Phaser.GameObjects.Graphics;
  private titleShadow!: Phaser.GameObjects.Text;  // 陰影文字（需納入 show/hide）
  private titleText!: Phaser.GameObjects.Text;
  private decorLineTop!: Phaser.GameObjects.Graphics;
  private decorLineBot!: Phaser.GameObjects.Graphics;

  private resumeBtnGraphics!: Phaser.GameObjects.Graphics;
  private resumeBtnText!: Phaser.GameObjects.Text;
  private resumeHitArea!: Phaser.GameObjects.Rectangle;

  private _isShowing: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();
    this.hide();
  }

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── 深色漸層遮罩 ────────────────────────────────────────────────────────
    this.overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.overlay.fillStyle(0x000000, 0.65);
    this.overlay.fillRect(0, 0, W, H);
    // 中央稍亮的矩形（模擬漸層）
    this.overlay.fillStyle(0x0a0a1a, 0.3);
    this.overlay.fillRect(W * 0.25, H * 0.25, W * 0.5, H * 0.5);

    // ── 「已暫停」文字 ──────────────────────────────────────────────────────
    // 陰影（賦值給 class 屬性，才能被 hide() 控制）
    this.titleShadow = this.scene.add.text(W * 0.5 + 2, H * 0.38 + 2, '已暫停', {
      fontSize: '38px', color: '#330000', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    this.titleText = this.scene.add.text(W * 0.5, H * 0.38, '已暫停', {
      fontSize: '38px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    // ── 金色裝飾線（標題上下各一條）────────────────────────────────────────
    this.decorLineTop = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.decorLineTop.lineStyle(1.5, 0xd4af37, 0.7);
    this.decorLineTop.lineBetween(W * 0.38, H * 0.33, W * 0.62, H * 0.33);

    this.decorLineBot = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.decorLineBot.lineStyle(1.5, 0xd4af37, 0.7);
    this.decorLineBot.lineBetween(W * 0.38, H * 0.44, W * 0.62, H * 0.44);

    // ── 「繼續遊戲」圓角按鈕 ────────────────────────────────────────────────
    const btnX = W * 0.5;
    const btnY = H * 0.57;
    const btnW = 220;
    const btnH = 56;

    this.resumeBtnGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawResumeBtn(false);

    this.resumeBtnText = this.scene.add.text(btnX, btnY, '繼續遊戲', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);

    const hitH = Math.max(btnH, 48);
    this.resumeHitArea = this.scene.add.rectangle(btnX, btnY, Math.max(btnW, 88), hitH, 0x000000, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });

    this.resumeHitArea.on('pointerover', () => this.drawResumeBtn(true));
    this.resumeHitArea.on('pointerout', () => this.drawResumeBtn(false));
  }

  private drawResumeBtn(hovered: boolean): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const btnX = W * 0.5;
    const btnY = H * 0.57;
    const btnW = 220;
    const btnH = 56;
    const r = 8;

    this.resumeBtnGraphics.clear();
    this.resumeBtnGraphics.fillStyle(hovered ? 0x8b1a1a : 0x6b0f0f, 1);
    this.resumeBtnGraphics.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
    this.resumeBtnGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 1);
    this.resumeBtnGraphics.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
  }

  public onResumeClick(callback: () => void): void {
    this.resumeHitArea.on('pointerdown', callback);
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
  }
}
