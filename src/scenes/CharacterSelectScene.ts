import Phaser from 'phaser';
import { CharacterData } from '../types/index';
import { CHARACTERS } from '../data/characters';
import { getWeaponById } from '../data/weapons';
import { uiText, uiTitle } from '../ui/UIStyles';
import { AssetLoader } from '../utils/AssetLoader';
import { ResponsiveLayout } from '../utils/ResponsiveLayout';

// ── 宗門資料（UI 顯示用，不影響 id / 戰鬥邏輯）──────────────────────────
const SECT_INFO: Record<string, {
  sectName: string;
  motto: string;
  role: string;
  primary: number;
  accent: number;
  borderColor: number;
  glowColor: number;
}> = {
  swordsman: {
    sectName: '墨守閣',
    motto: '墨心如盾，固若金湯。',
    role: '防禦反擊・血量極高',
    primary: 0x0d1e3a,
    accent:  0x66aaff,
    borderColor: 0x44aaff,
    glowColor: 0x2266cc,
  },
  assassin: {
    sectName: '驚鴻派',
    motto: '劍走驚鴻，影過留痕。',
    role: '極致攻速・移動領先',
    primary: 0x1a0d3a,
    accent:  0xcc88ff,
    borderColor: 0xaa66ff,
    glowColor: 0x7733cc,
  },
  taoist: {
    sectName: '歸元宗',
    motto: '烈陽焚天，萬物俱滅。',
    role: '範圍殺傷・爆發最強',
    primary: 0x3a0d0a,
    accent:  0xff8844,
    borderColor: 0xff6622,
    glowColor: 0xcc3300,
  },
};

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex: number = -1;

  // 每張卡片的 Graphics（邊框 + 背景）
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];
  // 每張卡片的 Image 容器（用於 alpha 控制）
  private cardContainers: Phaser.GameObjects.Container[] = [];
  // 選中光暈 Graphics
  private cardGlowGraphics: Phaser.GameObjects.Graphics[] = [];
  // 漂浮動畫 tween
  private floatTweens: Phaser.Tweens.Tween[] = [];
  // 靈氣粒子
  private particles: Phaser.GameObjects.Graphics[] = [];
  private particleTimer: number = 0;

  // 確認按鈕
  private confirmGraphics!: Phaser.GameObjects.Graphics;
  private confirmText!: Phaser.GameObjects.Text;
  private confirmHitArea!: Phaser.GameObjects.Rectangle;

  // 卡片佈局快取（selectCharacter 用）
  private cardLayout!: { cx: number; cy: number; cardW: number; cardH: number }[];

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);

    this.selectedIndex = -1;
    this.cardGraphics = [];
    this.cardContainers = [];
    this.cardGlowGraphics = [];
    this.floatTweens = [];
    this.particles = [];
    this.particleTimer = 0;

    this.drawBackground(W, H);
    this.drawTitle(W, H, layout.uiScale);
    this.buildCards(W, H, layout);
    this.buildConfirmButton(W, H, layout);
    this.buildBackButton(W, H, layout);
  }

  update(_time: number, delta: number): void {
    // 靈氣粒子（每 500ms 生成一顆，最多 24 顆）
    this.particleTimer += delta;
    if (this.particleTimer >= 500 && this.particles.length < 24) {
      this.particleTimer = 0;
      this.spawnAuraParticle();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 背景：深藍夜色山門 + 月光 + 靈氣霧氣
  // ─────────────────────────────────────────────────────────────────────────
  private drawBackground(W: number, H: number): void {
    // 深夜漸層（深藍 → 近黑）
    const bg = this.add.graphics().setDepth(0);
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x04 + (0x02 - 0x04) * t);
      const g = Math.round(0x08 + (0x04 - 0x08) * t);
      const b = Math.round(0x1e + (0x28 - 0x1e) * t);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, Math.round((H / steps) * i), W, Math.round(H / steps) + 1);
    }

    // 月光光暈（右上角）
    const moon = this.add.graphics().setDepth(1);
    const moonX = Math.round(W * 0.88);
    const moonY = Math.round(H * 0.14);
    moon.fillStyle(0xfff8e0, 0.06); moon.fillCircle(moonX, moonY, 90);
    moon.fillStyle(0xfff8e0, 0.10); moon.fillCircle(moonX, moonY, 55);
    moon.fillStyle(0xfff8e0, 0.18); moon.fillCircle(moonX, moonY, 30);
    moon.fillStyle(0xfff8e0, 0.55); moon.fillCircle(moonX, moonY, 14);
    // 月光射線
    moon.lineStyle(1, 0xfff8e0, 0.06);
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      moon.lineBetween(moonX, moonY, moonX + Math.cos(angle) * 120, moonY + Math.sin(angle) * 120);
    }

    // 遠景山脈剪影（多層次）
    const mt = this.add.graphics().setDepth(2);
    // 遠山（最暗）
    mt.fillStyle(0x020408, 0.9);
    mt.fillTriangle(0, H, Math.round(W * 0.10), Math.round(H * 0.48), Math.round(W * 0.22), H);
    mt.fillTriangle(Math.round(W * 0.08), H, Math.round(W * 0.18), Math.round(H * 0.38), Math.round(W * 0.32), H);
    mt.fillTriangle(Math.round(W * 0.70), H, Math.round(W * 0.82), Math.round(H * 0.40), Math.round(W * 0.94), H);
    mt.fillTriangle(Math.round(W * 0.78), H, Math.round(W * 0.90), Math.round(H * 0.50), W, H);
    // 近山（稍亮）
    mt.fillStyle(0x040810, 0.85);
    mt.fillTriangle(0, H, Math.round(W * 0.06), Math.round(H * 0.62), Math.round(W * 0.16), H);
    mt.fillTriangle(Math.round(W * 0.84), H, Math.round(W * 0.93), Math.round(H * 0.60), W, H);

    // 古代建築剪影（中央遠景）
    const arch = this.add.graphics().setDepth(3);
    arch.fillStyle(0x020508, 0.92);
    const bx = Math.round(W * 0.5);
    const by = Math.round(H * 0.72);
    // 主塔
    arch.fillRect(bx - 6, by - 60, 12, 60);
    arch.fillTriangle(bx - 14, by - 60, bx, by - 82, bx + 14, by - 60);
    // 左翼
    arch.fillRect(bx - 50, by - 28, 8, 28);
    arch.fillTriangle(bx - 56, by - 28, bx - 46, by - 42, bx - 36, by - 28);
    // 右翼
    arch.fillRect(bx + 42, by - 28, 8, 28);
    arch.fillTriangle(bx + 36, by - 28, bx + 46, by - 42, bx + 56, by - 28);
    // 底座橫樑
    arch.fillRect(bx - 70, by - 8, 140, 8);

    // 靈氣霧氣（底部）
    const fog = this.add.graphics().setDepth(4);
    fog.fillStyle(0x0a1a3a, 0.22); fog.fillRect(0, Math.round(H * 0.78), W, Math.round(H * 0.22));
    fog.fillStyle(0x0a1a3a, 0.14); fog.fillRect(0, Math.round(H * 0.68), W, Math.round(H * 0.12));

    // 星點
    const stars = this.add.graphics().setDepth(2);
    const starPos = [
      [0.05,0.06],[0.12,0.03],[0.20,0.08],[0.28,0.04],[0.38,0.07],
      [0.48,0.03],[0.56,0.09],[0.62,0.05],[0.70,0.08],[0.76,0.03],
      [0.15,0.15],[0.33,0.12],[0.52,0.14],[0.67,0.11],[0.82,0.13],
    ];
    for (const [sx, sy] of starPos) {
      stars.fillStyle(0xffffff, 0.3 + Math.random() * 0.4);
      stars.fillCircle(Math.round(W * sx), Math.round(H * sy), 0.8 + Math.random() * 0.8);
    }

    // 中央祭壇光柱（選擇儀式感）
    const altar = this.add.graphics().setDepth(3);
    altar.fillStyle(0x4488ff, 0.04);
    altar.fillRect(Math.round(W * 0.44), 0, Math.round(W * 0.12), H);
    altar.fillStyle(0x4488ff, 0.03);
    altar.fillRect(Math.round(W * 0.40), 0, Math.round(W * 0.20), H);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 標題
  // ─────────────────────────────────────────────────────────────────────────
  private drawTitle(W: number, H: number, s: number): void {
    const tx = Math.round(W * 0.5);
    const ty = Math.round(H * 0.09);

    // 標題光暈底層
    const glow = this.add.graphics().setDepth(9);
    glow.fillStyle(0xd4af37, 0.06);
    glow.fillEllipse(tx, ty, 320, 50);

    // 陰影
    this.add.text(tx + 2, ty + 2, '選擇宗門',
      uiTitle(Math.round(32 * s), '#5a3800', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(10);
    // 主文字
    this.add.text(tx, ty, '選擇宗門',
      uiTitle(Math.round(32 * s), '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(11);

    // 副標題
    this.add.text(tx, Math.round(H * 0.155), '擇一宗門，踏上修仙之路',
      uiText(Math.round(11 * s), '#8899aa')
    ).setOrigin(0.5, 0.5).setDepth(11);

    // 裝飾線
    const line = this.add.graphics().setDepth(11);
    line.lineStyle(1, 0xd4af37, 0.5);
    line.lineBetween(Math.round(W * 0.36), Math.round(H * 0.135), Math.round(W * 0.64), Math.round(H * 0.135));
    line.fillStyle(0xd4af37, 0.6);
    line.fillCircle(Math.round(W * 0.36), Math.round(H * 0.135), 2);
    line.fillCircle(Math.round(W * 0.64), Math.round(H * 0.135), 2);
    line.fillCircle(tx, Math.round(H * 0.135), 2.5);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 卡片群組
  // ─────────────────────────────────────────────────────────────────────────
  private buildCards(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const cardW = Math.round(Math.min(layout.usableW * 0.27, 185));
    const cardH = Math.round(Math.min(H * 0.60, 340));
    const cardCenterY = Math.round(H * 0.50);

    // 三張卡片 X 位置（基於可用區域均分）
    const usableX = layout.usableX;
    const usableW = layout.usableW;
    const cardXPositions = [
      Math.round(usableX + usableW * 0.18),
      Math.round(usableX + usableW * 0.50),
      Math.round(usableX + usableW * 0.82),
    ];

    this.cardLayout = cardXPositions.map(cx => ({ cx, cy: cardCenterY, cardW, cardH }));

    CHARACTERS.forEach((char, i) => {
      this.buildCharacterCard(char, cardXPositions[i], cardCenterY, cardW, cardH, i, s);
    });
  }

  private buildCharacterCard(
    char: CharacterData,
    cx: number, cy: number,
    cardW: number, cardH: number,
    index: number, s: number
  ): void {
    const cardTop = cy - Math.round(cardH / 2);
    const sect = SECT_INFO[char.id] ?? {
      sectName: char.id, motto: '', role: '',
      primary: 0x0d1e3a, accent: 0x6688aa, borderColor: 0x6688aa, glowColor: 0x334466,
    };
    const weaponData = getWeaponById(char.startingWeaponId);

    // ── 光暈（最底層，選中時顯示）────────────────────────────────────────
    const glowG = this.add.graphics().setDepth(6);
    this.cardGlowGraphics.push(glowG);

    // ── 卡片背景 Graphics ─────────────────────────────────────────────────
    const g = this.add.graphics().setDepth(8);
    this.cardGraphics.push(g);
    this.drawCardFrame(g, cx, cy, cardW, cardH, false, sect.borderColor, false);

    // ── 卡片內容 Container（用於整體 alpha 控制）─────────────────────────
    const container = this.add.container(0, 0).setDepth(9).setAlpha(0.55);
    this.cardContainers.push(container);

    // 宗門 icon
    const iconY = cardTop + Math.round(cardH * 0.20);
    this.buildSectIcon(container, cx, iconY, sect, char.id, cardW);

    // 宗門名稱
    const nameText = this.add.text(cx, cardTop + Math.round(cardH * 0.38),
      sect.sectName,
      uiText(Math.round(20 * s), '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(nameText);

    // 格言
    const mottoText = this.add.text(cx, cardTop + Math.round(cardH * 0.48),
      sect.motto,
      uiText(Math.round(10 * s), '#d4af37', { wordWrap: { width: cardW - 16 }, align: 'center' })
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(mottoText);

    // 分隔線
    const sep = this.add.graphics().setDepth(9);
    sep.lineStyle(1, sect.borderColor, 0.3);
    sep.lineBetween(cx - cardW * 0.35, cardTop + Math.round(cardH * 0.54),
                    cx + cardW * 0.35, cardTop + Math.round(cardH * 0.54));
    container.add(sep);

    // 定位描述
    const roleText = this.add.text(cx, cardTop + Math.round(cardH * 0.60),
      sect.role,
      uiText(Math.round(11 * s), '#aabbcc', { wordWrap: { width: cardW - 16 }, align: 'center' })
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(roleText);

    // 初始武器
    const weaponText = this.add.text(cx, cardTop + Math.round(cardH * 0.70),
      `⚔ ${weaponData?.name ?? '—'}`,
      uiText(Math.round(11 * s), '#d4af37')
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(weaponText);

    // 屬性摘要
    const statsY = cardTop + Math.round(cardH * 0.80);
    const lineH = Math.round(cardH * 0.075);
    const hpT  = this.add.text(cx, statsY,           `HP  ${char.baseHP}`,                    uiText(Math.round(10 * s), '#ff8888')).setOrigin(0.5, 0.5).setDepth(9);
    const atkT = this.add.text(cx, statsY + lineH,   `ATK ×${char.baseAttackPower.toFixed(1)}`, uiText(Math.round(10 * s), '#ffcc66')).setOrigin(0.5, 0.5).setDepth(9);
    const spdT = this.add.text(cx, statsY + lineH*2, `SPD ${char.baseMoveSpeed}`,              uiText(Math.round(10 * s), '#88ddff')).setOrigin(0.5, 0.5).setDepth(9);
    container.add([hpT, atkT, spdT]);

    // ── 漂浮動畫（未選中時輕微上下漂浮）─────────────────────────────────
    const floatTween = this.tweens.add({
      targets: container,
      y: { from: -3, to: 3 },
      duration: 2200 + index * 400,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    this.floatTweens.push(floatTween);

    // ── 互動熱區 ──────────────────────────────────────────────────────────
    const hitArea = this.add.rectangle(cx, cy, Math.max(cardW, 88), Math.max(cardH, 88), 0, 0)
      .setDepth(12).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.selectCharacter(index));
    hitArea.on('pointerover', () => {
      if (this.selectedIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], cx, cy, cardW, cardH, false, sect.borderColor, true);
        container.setAlpha(0.80);
      }
    });
    hitArea.on('pointerout', () => {
      if (this.selectedIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], cx, cy, cardW, cardH, false, sect.borderColor, false);
        container.setAlpha(0.55);
      }
    });
  }

  private buildSectIcon(
    container: Phaser.GameObjects.Container,
    cx: number, cy: number,
    sect: { primary: number; accent: number; glowColor: number },
    charId: string,
    cardW: number
  ): void {
    const charData = CHARACTERS.find(c => c.id === charId);

    // icon 光暈底圓
    const iconGlow = this.add.graphics().setDepth(9);
    iconGlow.fillStyle(sect.glowColor, 0.18);
    iconGlow.fillCircle(cx, cy, 38);
    iconGlow.fillStyle(sect.glowColor, 0.10);
    iconGlow.fillCircle(cx, cy, 50);
    container.add(iconGlow);

    if (charData?.iconKey && AssetLoader.hasTexture(this, charData.iconKey)) {
      const img = this.add.image(cx, cy, charData.iconKey).setDepth(9);
      const maxSize = Math.round(Math.min(cardW * 0.42, 68));
      img.setDisplaySize(maxSize, maxSize);
      container.add(img);
      return;
    }

    if (charData?.portraitKey && AssetLoader.hasTexture(this, charData.portraitKey)) {
      const img = this.add.image(cx, cy, charData.portraitKey).setDepth(9);
      const maxW = Math.round(cardW * 0.50);
      const maxH = Math.round(maxW * 1.2);
      img.setDisplaySize(maxW, maxH);
      container.add(img);
      return;
    }

    // Fallback 程式繪製
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(sect.accent, 0.15); g.fillCircle(cx, cy, 22);
    g.fillStyle(sect.accent, 1);    g.fillCircle(cx, cy - 14, 10);
    g.fillStyle(sect.primary, 1);   g.fillRect(cx - 9, cy - 4, 18, 20);
    if (charId === 'swordsman') {
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx + 8, cy - 18, 3, 28); g.fillRect(cx + 5, cy - 6, 9, 3);
    } else if (charId === 'assassin') {
      g.fillStyle(0xcc88ff, 1);
      g.fillRect(cx - 14, cy - 10, 3, 18); g.fillRect(cx + 11, cy - 10, 3, 18);
    } else if (charId === 'taoist') {
      g.fillStyle(0xff8844, 1);
      g.fillRect(cx + 9, cy - 22, 3, 30); g.fillCircle(cx + 10, cy - 24, 5);
    }
    container.add(g);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 卡片邊框繪製
  // ─────────────────────────────────────────────────────────────────────────
  private drawCardFrame(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    cardW: number, cardH: number,
    selected: boolean,
    borderColor: number,
    hovered: boolean = false
  ): void {
    g.clear();
    const x = Math.round(cx - cardW / 2);
    const y = Math.round(cy - cardH / 2);
    const r = 10;

    if (selected) {
      // 選中：深色玉石感背景
      g.fillStyle(0x0a1428, 0.97);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      // 頂部高光
      g.fillStyle(0xffffff, 0.04);
      g.fillRoundedRect(x + 2, y + 2, cardW - 4, cardH * 0.3, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
      // 外發光
      g.lineStyle(10, borderColor, 0.20);
      g.strokeRoundedRect(x - 4, y - 4, cardW + 8, cardH + 8, r + 4);
      g.lineStyle(4, borderColor, 0.60);
      g.strokeRoundedRect(x - 1, y - 1, cardW + 2, cardH + 2, r + 1);
      g.lineStyle(2, borderColor, 1);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    } else if (hovered) {
      g.fillStyle(0x0d1a2e, 0.92);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(4, borderColor, 0.25);
      g.strokeRoundedRect(x - 2, y - 2, cardW + 4, cardH + 4, r + 2);
      g.lineStyle(1.5, borderColor, 0.70);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      // 未選中：半透明暗色
      g.fillStyle(0x060c18, 0.80);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(1, borderColor, 0.28);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 確認按鈕
  // ─────────────────────────────────────────────────────────────────────────
  private buildConfirmButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const btnW = Math.round(Math.min(240, W * 0.28));
    const btnH = layout.btnH;
    const btnX = Math.round(W * 0.5);
    const btnY = Math.round(H * 0.90);

    this.confirmGraphics = this.add.graphics().setDepth(11);
    this.drawConfirmBtn(false);

    this.confirmText = this.add.text(btnX, btnY, '請先選擇宗門',
      uiText(Math.round(16 * s), '#555566')
    ).setOrigin(0.5, 0.5).setDepth(12);

    this.confirmHitArea = this.add.rectangle(
      btnX, btnY, Math.max(btnW, layout.minTouchTarget), Math.max(btnH, layout.minTouchTarget), 0, 0
    ).setDepth(13).setInteractive({ useHandCursor: false });

    this.confirmHitArea.on('pointerdown', () => {
      if (this.selectedIndex < 0) return;
      const characterId = CHARACTERS[this.selectedIndex].id;
      this.scene.start('MapSelectScene', { characterId });
    });
    this.confirmHitArea.on('pointerover', () => {
      if (this.selectedIndex >= 0) this.drawConfirmBtn(true);
    });
    this.confirmHitArea.on('pointerout', () => {
      if (this.selectedIndex >= 0) this.drawConfirmBtn(false);
    });
  }

  private drawConfirmBtn(hovered: boolean): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);
    const btnW = Math.round(Math.min(240, W * 0.28));
    const btnH = layout.btnH;
    const btnX = Math.round(W * 0.5);
    const btnY = Math.round(H * 0.90);
    const r = 8;
    const x = Math.round(btnX - btnW / 2);
    const y = Math.round(btnY - btnH / 2);

    this.confirmGraphics.clear();
    if (this.selectedIndex < 0) {
      // 未選中：暗色禁用
      this.confirmGraphics.fillStyle(0x0a0a14, 0.75);
      this.confirmGraphics.fillRoundedRect(x, y, btnW, btnH, r);
      this.confirmGraphics.lineStyle(1, 0x333344, 0.5);
      this.confirmGraphics.strokeRoundedRect(x, y, btnW, btnH, r);
    } else {
      // 已選中：黑玉金邊修仙風格
      if (hovered) {
        this.confirmGraphics.lineStyle(8, 0xd4af37, 0.18);
        this.confirmGraphics.strokeRoundedRect(x - 3, y - 3, btnW + 6, btnH + 6, r + 3);
      }
      this.confirmGraphics.fillStyle(hovered ? 0x1a1428 : 0x0d0a1e, 0.95);
      this.confirmGraphics.fillRoundedRect(x, y, btnW, btnH, r);
      // 頂部高光
      this.confirmGraphics.fillStyle(0xffffff, 0.05);
      this.confirmGraphics.fillRoundedRect(x + 2, y + 2, btnW - 4, btnH * 0.4, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
      this.confirmGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, hovered ? 1 : 0.85);
      this.confirmGraphics.strokeRoundedRect(x, y, btnW, btnH, r);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 返回主選單按鈕
  // ─────────────────────────────────────────────────────────────────────────
  private buildBackButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const btnX = Math.round(layout.safeLeft + 20);
    const btnY = Math.round(layout.safeTop + 22);

    const g = this.add.graphics().setDepth(11);
    g.fillStyle(0x0a0a14, 0.70);
    g.fillRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
    g.lineStyle(1, 0xd4af37, 0.40);
    g.strokeRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);

    const backText = this.add.text(btnX + 30, btnY, '← 返回',
      uiText(Math.round(12 * s), '#aaaacc')
    ).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX + 30, btnY, 80, 36, 0, 0)
      .setDepth(13).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x1a1428, 0.85);
      g.fillRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      g.lineStyle(1.5, 0xd4af37, 0.80);
      g.strokeRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      backText.setColor('#ffd700');
    });
    hitArea.on('pointerout', () => {
      g.clear();
      g.fillStyle(0x0a0a14, 0.70);
      g.fillRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      g.lineStyle(1, 0xd4af37, 0.40);
      g.strokeRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      backText.setColor('#aaaacc');
    });
    hitArea.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 選擇宗門
  // ─────────────────────────────────────────────────────────────────────────
  private selectCharacter(index: number): void {
    this.selectedIndex = index;

    CHARACTERS.forEach((char, i) => {
      const sect = SECT_INFO[char.id] ?? { borderColor: 0x6688aa, glowColor: 0x334466 };
      const { cx, cy, cardW, cardH } = this.cardLayout[i];
      const isSelected = i === index;

      // 邊框
      this.drawCardFrame(this.cardGraphics[i], cx, cy, cardW, cardH, isSelected, sect.borderColor, false);

      // 光暈
      const glowG = this.cardGlowGraphics[i];
      glowG.clear();
      if (isSelected) {
        const x = Math.round(cx - cardW / 2);
        const y = Math.round(cy - cardH / 2);
        glowG.lineStyle(18, sect.glowColor, 0.12);
        glowG.strokeRoundedRect(x - 7, y - 7, cardW + 14, cardH + 14, 14);
        glowG.lineStyle(8, sect.glowColor, 0.22);
        glowG.strokeRoundedRect(x - 3, y - 3, cardW + 6, cardH + 6, 12);
      }

      // Container alpha：選中全亮，其他降暗
      const container = this.cardContainers[i];
      if (isSelected) {
        container.setAlpha(1.0);
        // 停止漂浮，輕微放大
        this.floatTweens[i]?.pause();
        this.tweens.add({
          targets: container,
          y: 0,
          scaleX: 1.0, scaleY: 1.0,
          duration: 120, ease: 'Power2',
        });
      } else {
        container.setAlpha(0.40);
        this.floatTweens[i]?.resume();
      }
    });

    // 更新確認按鈕
    this.drawConfirmBtn(false);
    const sectName = SECT_INFO[CHARACTERS[index].id]?.sectName ?? '宗門';
    this.confirmText
      .setText(`踏入修行・${sectName}`)
      .setColor('#ffd700')
      .setFontSize(Math.round(16 * ResponsiveLayout.compute(this.scale.width, this.scale.height).uiScale));
    this.confirmHitArea.setInteractive({ useHandCursor: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 靈氣粒子
  // ─────────────────────────────────────────────────────────────────────────
  private spawnAuraParticle(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // 從底部或側邊隨機生成
    const fromSide = Math.random() < 0.4;
    let startX: number, startY: number;
    if (fromSide) {
      startX = Math.random() < 0.5 ? -8 : W + 8;
      startY = H * 0.5 + (Math.random() - 0.5) * H * 0.6;
    } else {
      startX = Math.random() * W;
      startY = H + 8;
    }

    const colors = [0x4488ff, 0x88aaff, 0xd4af37, 0xaaddff, 0x66ccff];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 0.8 + Math.random() * 1.8;
    const duration = 3500 + Math.random() * 3000;
    const driftX = (Math.random() - 0.5) * 80;
    const driftY = -(60 + Math.random() * 80);

    const p = this.add.graphics().setDepth(5);
    p.fillStyle(color, 0.55 + Math.random() * 0.35);
    p.fillCircle(0, 0, size);
    p.setPosition(startX, startY);
    this.particles.push(p);

    this.tweens.add({
      targets: p,
      x: startX + driftX,
      y: startY + driftY,
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
}
