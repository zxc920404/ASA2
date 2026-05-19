import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── 深色武俠風漸層背景 ──────────────────────────────────────────────────
    this.drawBackground(W, H);

    // ── 半透明中央面板 ──────────────────────────────────────────────────────
    this.drawCenterPanel(W, H);

    // ── 金色大標題 ──────────────────────────────────────────────────────────
    // 標題文字陰影（偏移 3px）
    this.add.text(W * 0.5 + 3, H * 0.35 + 3, '武俠幸存者', {
      fontSize: '56px',
      color: '#7a4a00',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // 標題主體（金色）
    this.add.text(W * 0.5, H * 0.35, '武俠幸存者', {
      fontSize: '56px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(11);

    // 副標題
    this.add.text(W * 0.5, H * 0.47, '生存・成長・超越極限', {
      fontSize: '16px',
      color: '#d4af37',
    }).setOrigin(0.5, 0.5).setDepth(11);

    // ── 裝飾分隔線 ──────────────────────────────────────────────────────────
    const divider = this.add.graphics().setDepth(11);
    divider.lineStyle(1, 0xd4af37, 0.6);
    divider.lineBetween(W * 0.35, H * 0.52, W * 0.65, H * 0.52);

    // ── 開始遊戲按鈕 ────────────────────────────────────────────────────────
    this.drawStartButton(W, H);

    // ── 天命修煉按鈕 ────────────────────────────────────────────────────────
    this.drawMetaButton(W, H);

    // ── 版本號 ──────────────────────────────────────────────────────────────
    this.add.text(W - 20, H - 12, 'v0.1 MVP', {
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(1, 1).setDepth(11);
  }

  /**
   * 繪製深色武俠風漸層背景
   */
  private drawBackground(W: number, H: number): void {
    const bg = this.add.graphics().setDepth(0);

    // 主背景：深墨綠到深靛藍漸層（用多層矩形模擬）
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      // 從深墨綠 (0x0d1f0d) 到深靛藍 (0x0a0a2e)
      const r = Math.round(0x0d + (0x0a - 0x0d) * t);
      const g = Math.round(0x1f + (0x0a - 0x1f) * t);
      const b = Math.round(0x0d + (0x2e - 0x0d) * t);
      const color = (r << 16) | (g << 8) | b;
      bg.fillStyle(color, 1);
      bg.fillRect(0, (H / steps) * i, W, H / steps + 1);
    }

    // 山脈輪廓裝飾（左側）
    const mountains = this.add.graphics().setDepth(1);
    mountains.fillStyle(0x0a1a0a, 0.7);
    mountains.fillTriangle(0, H, W * 0.15, H * 0.55, W * 0.30, H);
    mountains.fillTriangle(W * 0.05, H, W * 0.22, H * 0.45, W * 0.40, H);

    // 山脈輪廓裝飾（右側）
    mountains.fillStyle(0x080818, 0.7);
    mountains.fillTriangle(W * 0.70, H, W * 0.82, H * 0.50, W * 0.95, H);
    mountains.fillTriangle(W * 0.78, H, W * 0.90, H * 0.42, W, H);

    // 星點裝飾
    const stars = this.add.graphics().setDepth(2);
    stars.fillStyle(0xffffff, 0.6);
    const starPositions = [
      [0.08, 0.12], [0.15, 0.08], [0.25, 0.15], [0.72, 0.10],
      [0.80, 0.06], [0.88, 0.14], [0.93, 0.08], [0.45, 0.05],
      [0.55, 0.09], [0.35, 0.07], [0.62, 0.13],
    ];
    for (const [sx, sy] of starPositions) {
      stars.fillCircle(W * sx, H * sy, 1.5);
    }
  }

  /**
   * 繪製半透明中央面板
   */
  private drawCenterPanel(W: number, H: number): void {
    const panelW = W * 0.50;
    const panelH = H * 0.65;
    const panelX = W * 0.5 - panelW / 2;
    const panelY = H * 0.5 - panelH / 2;
    const radius = 12;

    const panel = this.add.graphics().setDepth(5);

    // 面板背景（半透明深色）
    panel.fillStyle(0x0a0a1a, 0.72);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, radius);

    // 面板邊框（金色）
    panel.lineStyle(1.5, 0xd4af37, 0.8);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, radius);

    // 面板內側光暈（頂部）
    panel.lineStyle(1, 0xffd700, 0.2);
    panel.strokeRoundedRect(panelX + 3, panelY + 3, panelW - 6, panelH - 6, radius - 2);
  }

  /**
   * 繪製開始遊戲按鈕
   */
  private drawStartButton(W: number, H: number): void {
    const btnW = 220;
    const btnH = 56;
    const btnX = W * 0.5;
    const btnY = H * 0.63;
    const radius = 8;

    // 按鈕圖形（圓角矩形）
    const btnGraphics = this.add.graphics().setDepth(11);
    this.drawRoundedButton(btnGraphics, btnX, btnY, btnW, btnH, radius, false, 0x6b0f0f, 0xd4af37);

    // 按鈕文字
    const btnText = this.add.text(btnX, btnY, '開始遊戲', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(12);

    // 透明互動熱區（觸控範圍至少 48px 高）
    const hitH = Math.max(btnH, 48);
    const hitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, 88), hitH, 0x000000, 0)
      .setDepth(13)
      .setInteractive({ useHandCursor: true });

    // 點擊後切換至 CharacterSelectScene
    hitArea.on('pointerdown', () => {
      this.scene.start('CharacterSelectScene');
    });

    // 懸停效果
    hitArea.on('pointerover', () => {
      btnGraphics.clear();
      this.drawRoundedButton(btnGraphics, btnX, btnY, btnW, btnH, radius, true, 0x6b0f0f, 0xd4af37);
      btnText.setColor('#ffd700');
    });
    hitArea.on('pointerout', () => {
      btnGraphics.clear();
      this.drawRoundedButton(btnGraphics, btnX, btnY, btnW, btnH, radius, false, 0x6b0f0f, 0xd4af37);
      btnText.setColor('#ffffff');
    });
  }

  /**
   * 繪製天命修煉按鈕
   */
  private drawMetaButton(W: number, H: number): void {
    const btnW = 220;
    const btnH = 48;
    const btnX = W * 0.5;
    const btnY = H * 0.76;
    const radius = 8;

    const btnGraphics = this.add.graphics().setDepth(11);
    this.drawRoundedButton(btnGraphics, btnX, btnY, btnW, btnH, radius, false, 0x0f1a2a, 0x4488aa);

    const btnText = this.add.text(btnX, btnY, '✦ 天命修煉', {
      fontSize: '18px',
      color: '#88ccff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, 88), Math.max(btnH, 48), 0x000000, 0)
      .setDepth(13)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      this.scene.start('MetaUpgradeScene');
    });
    hitArea.on('pointerover', () => {
      btnGraphics.clear();
      this.drawRoundedButton(btnGraphics, btnX, btnY, btnW, btnH, radius, true, 0x0f1a2a, 0x4488aa);
      btnText.setColor('#ffffff');
    });
    hitArea.on('pointerout', () => {
      btnGraphics.clear();
      this.drawRoundedButton(btnGraphics, btnX, btnY, btnW, btnH, radius, false, 0x0f1a2a, 0x4488aa);
      btnText.setColor('#88ccff');
    });
  }

  /**
   * 繪製圓角按鈕圖形
   * @param g       Graphics 物件
   * @param cx      中心 X
   * @param cy      中心 Y
   * @param w       寬度
   * @param h       高度
   * @param r       圓角半徑
   * @param hovered 是否為 hover 狀態
   * @param fillColor 填充色（預設深紅）
   * @param borderColor 邊框色（預設金色）
   */
  private drawRoundedButton(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    w: number,
    h: number,
    r: number,
    hovered: boolean,
    fillColor: number = 0x6b0f0f,
    borderColor: number = 0xd4af37
  ): void {
    const x = cx - w / 2;
    const y = cy - h / 2;

    // 按鈕背景
    const lighterFill = Math.min(fillColor + 0x1a1a1a, 0xffffff);
    g.fillStyle(hovered ? lighterFill : fillColor, 1);
    g.fillRoundedRect(x, y, w, h, r);

    // 按鈕邊框
    const lighterBorder = Math.min(borderColor + 0x222222, 0xffffff);
    g.lineStyle(hovered ? 2 : 1.5, hovered ? lighterBorder : borderColor, 1);
    g.strokeRoundedRect(x, y, w, h, r);

    // hover 時加入頂部高光
    if (hovered) {
      g.lineStyle(1, 0xffffff, 0.15);
      g.strokeRoundedRect(x + 2, y + 2, w - 4, h / 2, r - 1);
    }
  }
}
