import Phaser from 'phaser';
import { uiText, uiTitle } from '../ui/UIStyles';
import { AssetLoader } from '../utils/AssetLoader';

// ── 設定面板資料 ──────────────────────────────────────────────────────────
interface SettingsState {
  bgmVolume: number;   // 0.0 ~ 1.0
  sfxVolume: number;   // 0.0 ~ 1.0
  particles: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  bgmVolume: 0.7,
  sfxVolume: 0.8,
  particles: true,
};

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
  private settings: SettingsState = { ...DEFAULT_SETTINGS };

  // 離開確認
  private exitContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MainMenuScene' });
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
    this.settings = { ...DEFAULT_SETTINGS };

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

    // ── 離開確認面板（初始隱藏）──────────────────────────────────────────
    this.exitContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
    this.buildExitPanel(W, H);
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
    this.add.text(cx + 3, titleY + 3, '武俠幸存者',
      uiTitle(50, '#3a1800')
    ).setOrigin(0.5, 0.5).setDepth(10);
    // 主標題
    this.add.text(cx, titleY, '武俠幸存者',
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
        label: '✕  離開',
        color: '#aa8888',
        borderColor: 0x553333,
        fillColor: 0x0e0a0a,
        action: () => this.openExit(),
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
    hit.on('pointerdown', () => action());
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

  private buildSettingsPanel(W: number, H: number): void {
    const panelW = Math.min(360, W * 0.42);
    const panelH = 260;
    const cx = Math.round(W * 0.5);
    const cy = Math.round(H * 0.5);
    const px = Math.round(cx - panelW / 2);
    const py = Math.round(cy - panelH / 2);
    const r = 10;

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
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

    // BGM 音量
    this.buildSliderRow('BGM 音量', cx, py + 90, panelW - 40, 'bgmVolume');
    // SFX 音量
    this.buildSliderRow('SFX 音量', cx, py + 140, panelW - 40, 'sfxVolume');
    // 粒子效果開關
    this.buildToggleRow('粒子效果', cx, py + 190, 'particles');

    // 關閉按鈕
    const closeG = this.add.graphics();
    const closeX = px + panelW - 22;
    const closeY = py + 18;
    closeG.fillStyle(0x330000, 0.8);
    closeG.fillCircle(closeX, closeY, 12);
    closeG.lineStyle(1.5, 0xaa4444, 0.9);
    closeG.strokeCircle(closeX, closeY, 12);
    this.settingsContainer.add(closeG);

    const closeTxt = this.add.text(closeX, closeY, '✕', uiText(13, '#ff8888', { fontStyle: 'bold' }));
    closeTxt.setOrigin(0.5, 0.5);
    this.settingsContainer.add(closeTxt);

    const closeHit = this.add.rectangle(closeX, closeY, 32, 32, 0, 0).setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => this.closeSettings());
    this.settingsContainer.add(closeHit);
  }

  private buildSliderRow(label: string, cx: number, cy: number, rowW: number, key: 'bgmVolume' | 'sfxVolume'): void {
    const lbl = this.add.text(cx - rowW / 2, cy, label, uiText(13, '#cccccc'));
    lbl.setOrigin(0, 0.5);
    this.settingsContainer.add(lbl);

    const trackW = 120;
    const trackH = 6;
    const trackX = cx + rowW / 2 - trackW;
    const trackY = cy;

    const track = this.add.graphics();
    track.fillStyle(0x222233, 1);
    track.fillRoundedRect(trackX, trackY - trackH / 2, trackW, trackH, 3);
    track.lineStyle(1, 0x444455, 0.8);
    track.strokeRoundedRect(trackX, trackY - trackH / 2, trackW, trackH, 3);
    this.settingsContainer.add(track);

    const fillG = this.add.graphics();
    this.settingsContainer.add(fillG);

    const knob = this.add.graphics();
    this.settingsContainer.add(knob);

    const redraw = () => {
      const val = this.settings[key] as number;
      const fillW = Math.max(6, val * trackW);
      fillG.clear();
      fillG.fillStyle(0xd4af37, 0.9);
      fillG.fillRoundedRect(trackX, trackY - trackH / 2, fillW, trackH, 3);
      knob.clear();
      knob.fillStyle(0xffd700, 1);
      knob.fillCircle(trackX + fillW, trackY, 8);
      knob.lineStyle(1.5, 0xffffff, 0.5);
      knob.strokeCircle(trackX + fillW, trackY, 8);
    };
    redraw();

    const hitZone = this.add.rectangle(trackX + trackW / 2, trackY, trackW + 20, 28, 0, 0)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const rel = Phaser.Math.Clamp((ptr.x - trackX) / trackW, 0, 1);
      (this.settings as unknown as Record<string, number | boolean>)[key] = rel;
      redraw();
    });
    this.settingsContainer.add(hitZone);
  }

  private buildToggleRow(label: string, cx: number, cy: number, key: 'particles'): void {
    const rowW = 200;
    const lbl = this.add.text(cx - rowW / 2, cy, label, uiText(13, '#cccccc'));
    lbl.setOrigin(0, 0.5);
    this.settingsContainer.add(lbl);

    const toggleG = this.add.graphics();
    this.settingsContainer.add(toggleG);
    const toggleTxt = this.add.text(cx + rowW / 2, cy, '', uiText(12, '#aaaaaa'));
    toggleTxt.setOrigin(1, 0.5);
    this.settingsContainer.add(toggleTxt);

    const redraw = () => {
      const on = this.settings[key];
      toggleG.clear();
      toggleG.fillStyle(on ? 0x1a5533 : 0x221a1a, 1);
      toggleG.fillRoundedRect(cx + rowW / 2 - 44, cy - 10, 44, 20, 10);
      toggleG.lineStyle(1.5, on ? 0x44cc88 : 0x444455, 0.9);
      toggleG.strokeRoundedRect(cx + rowW / 2 - 44, cy - 10, 44, 20, 10);
      toggleG.fillStyle(on ? 0x44cc88 : 0x555566, 1);
      toggleG.fillCircle(on ? cx + rowW / 2 - 12 : cx + rowW / 2 - 32, cy, 8);
      toggleTxt.setText(on ? '開' : '關').setColor(on ? '#44cc88' : '#666677');
    };
    redraw();

    const hit = this.add.rectangle(cx + rowW / 2 - 22, cy, 60, 32, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.settings[key] = !this.settings[key];
      redraw();
    });
    this.settingsContainer.add(hit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 離開確認面板
  // ─────────────────────────────────────────────────────────────────────────

  private openExit(): void {
    this.exitContainer.setVisible(true);
  }

  private closeExit(): void {
    this.exitContainer.setVisible(false);
  }

  private buildExitPanel(W: number, H: number): void {
    const panelW = Math.min(320, W * 0.38);
    const panelH = 160;
    const cx = Math.round(W * 0.5);
    const cy = Math.round(H * 0.5);
    const px = Math.round(cx - panelW / 2);
    const py = Math.round(cy - panelH / 2);
    const r = 10;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
    this.exitContainer.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x080818, 0.96);
    panel.fillRoundedRect(px, py, panelW, panelH, r);
    panel.lineStyle(1.5, 0xd4af37, 0.8);
    panel.strokeRoundedRect(px, py, panelW, panelH, r);
    this.exitContainer.add(panel);

    const msg = this.add.text(cx, cy - 28, '感謝遊玩武俠幸存者！\n願你武道長進，再見！',
      uiText(14, '#d4af37', { align: 'center', lineSpacing: 6 })
    ).setOrigin(0.5, 0.5);
    this.exitContainer.add(msg);

    // 確認按鈕（Web 版：關閉提示即可）
    const okG = this.add.graphics();
    const okX = cx;
    const okY = cy + 44;
    okG.fillStyle(0x5a0a0a, 0.9);
    okG.fillRoundedRect(okX - 60, okY - 18, 120, 36, 6);
    okG.lineStyle(1.5, 0xd4af37, 0.8);
    okG.strokeRoundedRect(okX - 60, okY - 18, 120, 36, 6);
    this.exitContainer.add(okG);

    const okTxt = this.add.text(okX, okY, '返回主選單', uiText(13, '#ffffff', { fontStyle: 'bold' }));
    okTxt.setOrigin(0.5, 0.5);
    this.exitContainer.add(okTxt);

    const okHit = this.add.rectangle(okX, okY, 140, 44, 0, 0).setInteractive({ useHandCursor: true });
    okHit.on('pointerdown', () => this.closeExit());
    this.exitContainer.add(okHit);
  }
}
