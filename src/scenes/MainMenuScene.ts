import Phaser from 'phaser';
import { uiText, uiTitle } from '../ui/UIStyles';
import { AssetLoader } from '../utils/AssetLoader';
import { BGMManager } from '../systems/BGMManager';
import { SFXManager } from '../systems/SFXManager';
import { SettingsManager, Settings } from '../systems/SettingsManager';
import { FONT_FAMILY } from '../ui/UIStyles';

export class MainMenuScene extends Phaser.Scene {
  private W: number = 960;
  private H: number = 540;

  // 漂浮粒子
  private particles: Phaser.GameObjects.Graphics[] = [];
  private particleTimer: number = 0;

  // LOGO 呼吸光
  private logoGlow!: Phaser.GameObjects.Graphics;
  private logoBreathTimer: number = 0;

  // 設定面板
  private settingsContainer!: Phaser.GameObjects.Container;
  private settingsOpen: boolean = false;
  private settings: Settings = SettingsManager.loadSettings();

  // 遊戲提示彈窗
  private tutorialContainer: Phaser.GameObjects.Container | null = null;
  private tutorialOpen: boolean = false;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  preload(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── 黑色底色（避免白屏）──────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x020810, 1);
    bg.fillRect(0, 0, W, H);

    // ── 簡單 loading 文字（BGM 下載期間顯示）────────────────────────
    const loadingText = this.add.text(
      Math.round(W / 2),
      Math.round(H / 2),
      '載入中...',
      {
        fontSize: '16px',
        color: '#d4af37',
        fontFamily: FONT_FAMILY,
        resolution: 2,
      }
    ).setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      loadingText.setText(`載入中... ${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      loadingText.destroy();
      bg.destroy();
    });

    // ── 主選單 BGM（約 5.9MB，延遲到此處才載入）──────────────────────
    // 若 audio key 已存在（場景重入），AssetLoader 會自動跳過
    AssetLoader.preloadMainMenuBGM(this);

    // ── 遊戲提示教學圖片 ──────────────────────────────────────────────
    AssetLoader.loadImage(this, 'ui_teach', 'assets/ui/teach.png');

    // ── 載入失敗靜默處理 ──────────────────────────────────────────────
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[MainMenuScene] 資源載入失敗（已 fallback）: ${file.key} → ${file.url}`);
    });
  }

  create(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    const W = this.W;
    const H = this.H;

    this.particles = [];
    this.particleTimer = 0;
    this.logoBreathTimer = 0;
    this.settingsOpen = false;
    this.tutorialContainer = null;
    this.tutorialOpen = false;
    
    // 載入設定並套用到 BGM / SFX
    this.settings = SettingsManager.loadSettings();
    BGMManager.setVolume(this.settings.bgmVolume);
    SFXManager.setVolume(this.settings.sfxVolume);

    // ── 背景 ──────────────────────────────────────────────────────────────
    this.drawBackground(W, H);

    // ── 背景圖（menuback.png）────────────────────────────────────────────
    if (AssetLoader.hasTexture(this, 'ui_bg_main_menu')) {
      const bg = this.add.image(W * 0.5, H * 0.5, 'ui_bg_main_menu').setDepth(3);
      const scaleX = W / bg.width;
      const scaleY = H / bg.height;
      bg.setScale(Math.max(scaleX, scaleY));
    }

    // ── 薄霧遮罩（讓背景圖不搶 UI）──────────────────────────────────────
    const fog = this.add.graphics().setDepth(4);
    fog.fillStyle(0x050510, 0.45);
    fog.fillRect(0, 0, W, H);

    // ── LOGO 呼吸光底層 ───────────────────────────────────────────────────
    this.logoGlow = this.add.graphics().setDepth(9);
    this.drawLogoGlow(1.0);

    // ── 標題 LOGO ─────────────────────────────────────────────────────────
    this.buildLogo(W, H);

    // ── 按鈕列 ────────────────────────────────────────────────────────────
    this.buildButtonColumn(W, H);

    // ── 裝飾元素 ──────────────────────────────────────────────────────────
    this.buildDecorations(W, H);

    // ── 版本號 ────────────────────────────────────────────────────────────
    this.add.text(Math.round(W - 12), Math.round(H - 10), 'v0.1 MVP',
      uiText(10, '#444455')
    ).setOrigin(1, 1).setDepth(20);

    // ── 設定面板（初始隱藏）──────────────────────────────────────────────
    this.settingsContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    this.buildSettingsPanel(W, H);

    // ── BGM ───────────────────────────────────────────────────────────────
    BGMManager.play(this, 'bgm_main_menu');
  }

  update(_time: number, delta: number): void {
    // LOGO 呼吸光動畫
    this.logoBreathTimer += delta;
    const breath = 0.55 + 0.45 * Math.sin(this.logoBreathTimer / 900);
    this.drawLogoGlow(breath);

    // 漂浮粒子生成（每 600ms 一顆，最多 18 顆）
    this.particleTimer += delta;
    if (this.particleTimer >= 600 && this.particles.length < 18) {
      this.particleTimer = 0;
      this.spawnParticle();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 背景
  // ─────────────────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    const bg = this.add.graphics().setDepth(0);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x06 + (0x08 - 0x06) * t);
      const g = Math.round(0x08 + (0x06 - 0x08) * t);
      const b = Math.round(0x18 + (0x22 - 0x18) * t);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, Math.round((H / steps) * i), W, Math.round(H / steps) + 1);
    }
    // 山脈
    const mt = this.add.graphics().setDepth(1);
    mt.fillStyle(0x060e06, 0.75);
    mt.fillTriangle(0, H, W * 0.14, H * 0.52, W * 0.28, H);
    mt.fillTriangle(W * 0.04, H, W * 0.20, H * 0.42, W * 0.38, H);
    mt.fillStyle(0x04060e, 0.75);
    mt.fillTriangle(W * 0.68, H, W * 0.82, H * 0.48, W * 0.96, H);
    mt.fillTriangle(W * 0.76, H, W * 0.90, H * 0.40, W, H);
    // 星點
    const st = this.add.graphics().setDepth(2);
    const starPos = [
      [0.07,0.10],[0.14,0.06],[0.24,0.13],[0.71,0.09],[0.79,0.05],
      [0.87,0.12],[0.92,0.07],[0.44,0.04],[0.54,0.08],[0.34,0.06],
      [0.61,0.11],[0.18,0.18],[0.66,0.16],[0.50,0.03],[0.30,0.10],
    ];
    for (const [sx, sy] of starPos) {
      const alpha = 0.4 + Math.random() * 0.5;
      st.fillStyle(0xffffff, alpha);
      st.fillCircle(W * sx, H * sy, 1 + Math.random());
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGO
  // ─────────────────────────────────────────────────────────────────────────

  private drawLogoGlow(intensity: number): void {
    const W = this.W;
    const H = this.H;
    const cx = Math.round(W * 0.5);
    const cy = Math.round(H * 0.28);
    const ellipseW = Math.round(W * 0.85);
    this.logoGlow.clear();
    this.logoGlow.fillStyle(0xffd700, 0.04 * intensity);
    this.logoGlow.fillEllipse(cx, cy, ellipseW, 120);
    this.logoGlow.fillStyle(0xffaa00, 0.07 * intensity);
    this.logoGlow.fillEllipse(cx, cy, Math.round(ellipseW * 0.65), 70);
    this.logoGlow.fillStyle(0xffd700, 0.10 * intensity);
    this.logoGlow.fillEllipse(cx, cy, Math.round(ellipseW * 0.38), 40);
  }

  private buildLogo(W: number, H: number): void {
    const cx = Math.round(W * 0.5);
    const titleY = Math.round(H * 0.28);

    // 頂部裝飾符文線
    const deco = this.add.graphics().setDepth(10);
    deco.lineStyle(1, 0xd4af37, 0.5);
    deco.lineBetween(cx - 160, titleY - 36, cx - 40, titleY - 36);
    deco.lineBetween(cx + 40,  titleY - 36, cx + 160, titleY - 36);
    deco.fillStyle(0xd4af37, 0.7);
    deco.fillTriangle(cx - 40, titleY - 36, cx - 28, titleY - 42, cx - 28, titleY - 30);
    deco.fillTriangle(cx + 40, titleY - 36, cx + 28, titleY - 42, cx + 28, titleY - 30);
    deco.fillCircle(cx, titleY - 36, 3);

    // 主標題陰影
    this.add.text(cx + 3, titleY + 3, '小俠浪天涯',
      uiTitle(50, '#3a1800')
    ).setOrigin(0.5, 0.5).setDepth(10);
    // 主標題
    this.add.text(cx, titleY, '小俠浪天涯',
      uiTitle(50, '#ffd700')
    ).setOrigin(0.5, 0.5).setDepth(11);

    // 副標題
    this.add.text(cx, Math.round(H * 0.42), '生存・成長・超越極限',
      uiText(13, '#c8a84b')
    ).setOrigin(0.5, 0.5).setDepth(11);

    // 底部裝飾線
    const deco2 = this.add.graphics().setDepth(11);
    deco2.lineStyle(1, 0xd4af37, 0.45);
    deco2.lineBetween(cx - 130, Math.round(H * 0.46), cx + 130, Math.round(H * 0.46));
    deco2.fillStyle(0xd4af37, 0.6);
    deco2.fillCircle(cx - 130, Math.round(H * 0.46), 2);
    deco2.fillCircle(cx + 130, Math.round(H * 0.46), 2);
    deco2.fillCircle(cx, Math.round(H * 0.46), 2.5);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 按鈕列
  // ─────────────────────────────────────────────────────────────────────────

  private buildButtonColumn(W: number, H: number): void {
    const cx = Math.round(W * 0.5);
    const btnW = Math.min(Math.round(W * 0.72), 300);
    const btnH = 52;
    const gap = 12;
    // 直屏：按鈕從 48% 開始，垂直居中偏下
    const startY = Math.round(H * 0.48);

    const buttons: Array<{
      label: string;
      color: string;
      borderColor: number;
      fillColor: number;
      action: () => void;
    }> = [
      {
        label: '⚔  開始遊戲',
        color: '#ffffff',
        borderColor: 0xd4af37,
        fillColor: 0x5a0a0a,
        action: () => this.scene.start('CharacterSelectScene'),
      },
      {
        label: '✦  天命修煉',
        color: '#88ccff',
        borderColor: 0x4488aa,
        fillColor: 0x0a1828,
        action: () => this.scene.start('MetaUpgradeScene'),
      },
      {
        label: '⚙  設定',
        color: '#cccccc',
        borderColor: 0x556677,
        fillColor: 0x0e1420,
        action: () => this.openSettings(),
      },
      {
        label: '📖  遊戲提示',
        color: '#ffe0a0',
        borderColor: 0xaa8844,
        fillColor: 0x201608,
        action: () => this.openTutorial(),
      },
    ];

    buttons.forEach((btn, i) => {
      const by = startY + i * (btnH + gap);
      this.buildMenuButton(cx, by, btnW, btnH, btn.label, btn.color, btn.fillColor, btn.borderColor, btn.action);
    });
  }

  private buildMenuButton(
    cx: number, cy: number, w: number, h: number,
    label: string, textColor: string,
    fillColor: number, borderColor: number,
    action: () => void
  ): void {
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);
    const r = 6;

    const g = this.add.graphics().setDepth(12);

    const drawNormal = () => {
      g.clear();
      // 令牌感：左右兩側切角效果（用多邊形）
      g.fillStyle(fillColor, 0.88);
      g.fillRoundedRect(x, y, w, h, r);
      // 頂部高光條
      g.fillStyle(0xffffff, 0.06);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.35, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
      // 邊框
      g.lineStyle(1.5, borderColor, 0.75);
      g.strokeRoundedRect(x, y, w, h, r);
      // 左右裝飾短線
      g.lineStyle(1, borderColor, 0.4);
      g.lineBetween(x + 8, y + h / 2, x + 14, y + h / 2);
      g.lineBetween(x + w - 14, y + h / 2, x + w - 8, y + h / 2);
    };

    const drawHover = () => {
      g.clear();
      const lighterFill = Math.min(fillColor + 0x181818, 0xffffff);
      g.fillStyle(lighterFill, 0.95);
      g.fillRoundedRect(x, y, w, h, r);
      g.fillStyle(0xffffff, 0.10);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.4, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
      // 外發光
      g.lineStyle(6, borderColor, 0.18);
      g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
      g.lineStyle(2, borderColor, 1);
      g.strokeRoundedRect(x, y, w, h, r);
      g.lineStyle(1, borderColor, 0.4);
      g.lineBetween(x + 8, y + h / 2, x + 14, y + h / 2);
      g.lineBetween(x + w - 14, y + h / 2, x + w - 8, y + h / 2);
    };

    drawNormal();

    const txt = this.add.text(cx, cy, label,
      uiText(16, textColor, { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(13);

    const hit = this.add.rectangle(cx, cy, Math.max(w, 88), Math.max(h, 48), 0, 0)
      .setDepth(14).setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      drawHover();
      txt.setColor('#ffd700');
      this.tweens.add({ targets: txt, scaleX: 1.04, scaleY: 1.04, duration: 80, ease: 'Power1' });
    });
    hit.on('pointerout', () => {
      drawNormal();
      txt.setColor(textColor);
      this.tweens.add({ targets: txt, scaleX: 1.0, scaleY: 1.0, duration: 80, ease: 'Power1' });
    });
    hit.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      action();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 裝飾元素
  // ─────────────────────────────────────────────────────────────────────────

  private buildDecorations(W: number, H: number): void {
    // 左側垂直裝飾線
    const dL = this.add.graphics().setDepth(6);
    dL.lineStyle(1, 0xd4af37, 0.18);
    dL.lineBetween(Math.round(W * 0.12), Math.round(H * 0.15), Math.round(W * 0.12), Math.round(H * 0.85));
    dL.fillStyle(0xd4af37, 0.25);
    dL.fillCircle(Math.round(W * 0.12), Math.round(H * 0.15), 2.5);
    dL.fillCircle(Math.round(W * 0.12), Math.round(H * 0.85), 2.5);

    // 右側垂直裝飾線
    const dR = this.add.graphics().setDepth(6);
    dR.lineStyle(1, 0xd4af37, 0.18);
    dR.lineBetween(Math.round(W * 0.88), Math.round(H * 0.15), Math.round(W * 0.88), Math.round(H * 0.85));
    dR.fillStyle(0xd4af37, 0.25);
    dR.fillCircle(Math.round(W * 0.88), Math.round(H * 0.15), 2.5);
    dR.fillCircle(Math.round(W * 0.88), Math.round(H * 0.85), 2.5);

    // 左側文字裝飾（豎排）
    this.add.text(Math.round(W * 0.07), Math.round(H * 0.50), '武\n道\n無\n極',
      uiText(11, '#d4af37', { align: 'center', lineSpacing: 6 })
    ).setOrigin(0.5, 0.5).setDepth(7).setAlpha(0.35);

    // 右側文字裝飾（豎排）
    this.add.text(Math.round(W * 0.93), Math.round(H * 0.50), '仙\n途\n漫\n漫',
      uiText(11, '#d4af37', { align: 'center', lineSpacing: 6 })
    ).setOrigin(0.5, 0.5).setDepth(7).setAlpha(0.35);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 漂浮粒子
  // ─────────────────────────────────────────────────────────────────────────

  private spawnParticle(): void {
    const W = this.W;
    const H = this.H;
    const x = Math.random() * W;
    const startY = H + 8;
    const size = 1 + Math.random() * 2;
    const duration = 4000 + Math.random() * 4000;
    const driftX = (Math.random() - 0.5) * 60;

    const p = this.add.graphics().setDepth(5);
    p.fillStyle(0xffd700, 0.6 + Math.random() * 0.3);
    p.fillCircle(0, 0, size);
    p.setPosition(x, startY);
    this.particles.push(p);

    this.tweens.add({
      targets: p,
      x: x + driftX,
      y: -10,
      alpha: 0,
      duration,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (p && p.active) p.destroy();
        const idx = this.particles.indexOf(p);
        if (idx !== -1) this.particles.splice(idx, 1);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 設定面板
  // ─────────────────────────────────────────────────────────────────────────

  private openSettings(): void {
    this.settingsOpen = true;
    this.settingsContainer.setVisible(true);
  }

  private closeSettings(): void {
    this.settingsOpen = false;
    this.settingsContainer.setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 遊戲提示彈窗
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 開啟教學彈窗：半透明遮罩 + 置中教學圖片 + 右上角關閉按鈕。
   * 不切換場景，僅疊加在主選單上方。
   * 點擊遮罩、圖片本身或關閉按鈕皆可關閉。
   */
  private openTutorial(): void {
    if (this.tutorialOpen) return;
    this.tutorialOpen = true;

    const W = this.W;
    const H = this.H;
    const container = this.add.container(0, 0).setDepth(60);
    this.tutorialContainer = container;

    // ── 半透明黑色遮罩（點擊關閉）────────────────────────────────────
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', () => this.closeTutorial());
    container.add(overlay);

    // ── 教學圖片（置中，依畫面自動縮放）──────────────────────────────
    let imgCenterX = W * 0.5;
    let imgTopY = H * 0.5;
    let imgHalfW = 0;
    let imgHalfH = 0;

    if (AssetLoader.hasTexture(this, 'ui_teach')) {
      const img = this.add.image(W * 0.5, H * 0.5, 'ui_teach').setOrigin(0.5, 0.5);
      // 寬度最多佔畫面 90%、高度最多佔畫面 85%，等比例縮放不變形
      const maxW = W * 0.90;
      const maxH = H * 0.85;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      img.setScale(scale);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.closeTutorial());
      container.add(img);

      imgCenterX = img.x;
      imgTopY = img.y - img.displayHeight / 2;
      imgHalfW = img.displayWidth / 2;
      imgHalfH = img.displayHeight / 2;
    } else {
      // Fallback：圖片不存在時顯示文字提示
      const txt = this.add.text(W * 0.5, H * 0.5, '教學圖片載入失敗',
        uiText(16, '#ffd700', { fontStyle: 'bold' })
      ).setOrigin(0.5, 0.5);
      container.add(txt);
      imgHalfW = txt.width / 2;
      imgHalfH = txt.height / 2;
      imgTopY = txt.y - imgHalfH;
    }

    // ── 右上角關閉按鈕（貼齊圖片右上角，並夾在畫面安全範圍內）──────────
    const closeX = Math.min(imgCenterX + imgHalfW, W - 24);
    const closeY = Math.max(imgTopY, 24);

    const closeG = this.add.graphics();
    closeG.fillStyle(0x330000, 0.85);
    closeG.fillCircle(closeX, closeY, 14);
    closeG.lineStyle(1.5, 0xaa4444, 0.9);
    closeG.strokeCircle(closeX, closeY, 14);
    container.add(closeG);

    const closeTxt = this.add.text(closeX, closeY, '✕',
      uiText(14, '#ff8888', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5);
    container.add(closeTxt);

    const closeHit = this.add.rectangle(closeX, closeY, 48, 48, 0, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.closeTutorial();
    });
    container.add(closeHit);
  }

  private closeTutorial(): void {
    this.tutorialOpen = false;
    if (this.tutorialContainer) {
      this.tutorialContainer.destroy(true);
      this.tutorialContainer = null;
    }
  }

  private buildSettingsPanel(W: number, H: number): void {
    const panelW = Math.min(W * 0.86, 360);
    const panelH = 340;
    const cx = Math.round(W * 0.5);
    const cy = Math.round(H * 0.5);
    const px = Math.round(cx - panelW / 2);
    const py = Math.round(cy - panelH / 2);
    const r = 10;

    // 遮罩（降低透明度到 0.6）
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    this.settingsContainer.add(overlay);

    // 面板背景
    const panel = this.add.graphics();
    panel.fillStyle(0x080818, 0.96);
    panel.fillRoundedRect(px, py, panelW, panelH, r);
    panel.lineStyle(1.5, 0xd4af37, 0.8);
    panel.strokeRoundedRect(px, py, panelW, panelH, r);
    panel.lineStyle(1, 0xffd700, 0.15);
    panel.strokeRoundedRect(px + 3, py + 3, panelW - 6, panelH - 6, r - 2);
    this.settingsContainer.add(panel);

    // 標題
    const titleShadow = this.add.text(cx + 2, py + 28 + 2, '⚙ 設定', uiTitle(22, '#3a2800'));
    titleShadow.setOrigin(0.5, 0.5);
    this.settingsContainer.add(titleShadow);
    const title = this.add.text(cx, py + 28, '⚙ 設定', uiTitle(22, '#ffd700'));
    title.setOrigin(0.5, 0.5);
    this.settingsContainer.add(title);

    // 分隔線
    const sep = this.add.graphics();
    sep.lineStyle(1, 0xd4af37, 0.4);
    sep.lineBetween(px + 20, py + 50, px + panelW - 20, py + 50);
    this.settingsContainer.add(sep);

    // 設定項目起始 y 位置
    const rowStartY = py + 78;
    const rowSpacing = 52;

    // BGM 音量
    this.buildSliderRow('音樂', px, panelW, rowStartY, 'bgmVolume');
    // SFX 音量
    this.buildSliderRow('音效', px, panelW, rowStartY + rowSpacing, 'sfxVolume');
    // 特效簡化
    this.buildToggleRow('特效簡化', px, panelW, rowStartY + rowSpacing * 2, 'reducedEffects');
    // 震動回饋
    this.buildToggleRow('震動回饋', px, panelW, rowStartY + rowSpacing * 3, 'hapticsEnabled');

    // 關閉按鈕（右上角內側，不貼邊）
    const closeX = px + panelW - 32;
    const closeY = py + 22;
    const closeG = this.add.graphics();
    closeG.fillStyle(0x330000, 0.8);
    closeG.fillCircle(closeX, closeY, 12);
    closeG.lineStyle(1.5, 0xaa4444, 0.9);
    closeG.strokeCircle(closeX, closeY, 12);
    this.settingsContainer.add(closeG);

    const closeTxt = this.add.text(closeX, closeY, '✕', uiText(13, '#ff8888', { fontStyle: 'bold' }));
    closeTxt.setOrigin(0.5, 0.5);
    this.settingsContainer.add(closeTxt);

    const closeHit = this.add.rectangle(closeX, closeY, 44, 44, 0, 0).setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.closeSettings();
    });
    this.settingsContainer.add(closeHit);
  }

  private buildSliderRow(label: string, panelX: number, panelW: number, cy: number, key: 'bgmVolume' | 'sfxVolume'): void {
    const labelX = panelX + 28;
    const controlRightX = panelX + panelW - 32;
    const sliderWidth = Math.min(panelW * 0.34, 120);
    const sliderX = controlRightX - sliderWidth / 2;
    
    const lbl = this.add.text(labelX, cy, label, uiText(15, '#cccccc'));
    lbl.setOrigin(0, 0.5);
    this.settingsContainer.add(lbl);

    // 百分比顯示
    const percentText = this.add.text(controlRightX - sliderWidth - 12, cy, '', uiText(13, '#888888'));
    percentText.setOrigin(1, 0.5);
    this.settingsContainer.add(percentText);

    const trackH = 6;
    const trackX = sliderX - sliderWidth / 2;
    const trackY = cy;

    const track = this.add.graphics();
    track.fillStyle(0x222233, 1);
    track.fillRoundedRect(trackX, trackY - trackH / 2, sliderWidth, trackH, 3);
    track.lineStyle(1, 0x444455, 0.8);
    track.strokeRoundedRect(trackX, trackY - trackH / 2, sliderWidth, trackH, 3);
    this.settingsContainer.add(track);

    const fillG = this.add.graphics();
    this.settingsContainer.add(fillG);

    const knob = this.add.graphics();
    this.settingsContainer.add(knob);

    const redraw = () => {
      const val = this.settings[key];
      const fillW = Math.max(6, val * sliderWidth);
      const percent = Math.round(val * 100);
      
      percentText.setText(`${percent}%`);
      
      fillG.clear();
      fillG.fillStyle(0xd4af37, 0.9);
      fillG.fillRoundedRect(trackX, trackY - trackH / 2, fillW, trackH, 3);
      
      knob.clear();
      knob.fillStyle(0xffd700, 1);
      knob.fillCircle(trackX + fillW, trackY, 9);
      knob.lineStyle(2, 0xffffff, 0.5);
      knob.strokeCircle(trackX + fillW, trackY, 9);
    };
    redraw();

    const hitZone = this.add.rectangle(sliderX, trackY, sliderWidth + 24, 48, 0, 0)
      .setInteractive({ useHandCursor: true });
    
    hitZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const rel = Phaser.Math.Clamp((ptr.x - trackX) / sliderWidth, 0, 1);
      this.settings[key] = rel;
      redraw();
      
      // 即時套用並儲存
      if (key === 'bgmVolume') {
        BGMManager.setVolume(rel);
      }
      if (key === 'sfxVolume') {
        SFXManager.setVolume(rel);
        SFXManager.playButtonClick(this);
      }
      SettingsManager.updateSetting(key, rel);
    });
    
    this.settingsContainer.add(hitZone);
  }

  private buildToggleRow(label: string, panelX: number, panelW: number, cy: number, key: 'reducedEffects' | 'hapticsEnabled'): void {
    const labelX = panelX + 28;
    const controlRightX = panelX + panelW - 32;
    
    const lbl = this.add.text(labelX, cy, label, uiText(15, '#cccccc'));
    lbl.setOrigin(0, 0.5);
    this.settingsContainer.add(lbl);

    const toggleW = 44;
    const toggleH = 20;
    const toggleX = controlRightX - toggleW;

    const toggleG = this.add.graphics();
    this.settingsContainer.add(toggleG);
    
    const toggleTxt = this.add.text(controlRightX + 12, cy, '', uiText(13, '#888888'));
    toggleTxt.setOrigin(0, 0.5);
    this.settingsContainer.add(toggleTxt);

    const redraw = () => {
      const on = this.settings[key];
      toggleG.clear();
      
      // Toggle 背景
      toggleG.fillStyle(on ? 0x1a5533 : 0x221a1a, 1);
      toggleG.fillRoundedRect(toggleX, cy - toggleH / 2, toggleW, toggleH, 10);
      toggleG.lineStyle(1.5, on ? 0x44cc88 : 0x444455, 0.9);
      toggleG.strokeRoundedRect(toggleX, cy - toggleH / 2, toggleW, toggleH, 10);
      
      // Toggle 圓鈕
      toggleG.fillStyle(on ? 0x44cc88 : 0x555566, 1);
      const knobX = on ? toggleX + toggleW - 12 : toggleX + 12;
      toggleG.fillCircle(knobX, cy, 8);
      
      toggleTxt.setText(on ? '開' : '關').setColor(on ? '#44cc88' : '#666677');
    };
    redraw();

    const hit = this.add.rectangle(toggleX + toggleW / 2, cy, toggleW + 20, 48, 0, 0)
      .setInteractive({ useHandCursor: true });
    
    hit.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.settings[key] = !this.settings[key];
      redraw();
      SettingsManager.updateSetting(key, this.settings[key]);
    });
    
    this.settingsContainer.add(hit);
  }
}
