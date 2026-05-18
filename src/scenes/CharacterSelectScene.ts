import Phaser from 'phaser';
import { CharacterData } from '../types/index';
import { CHARACTERS } from '../data/characters';
import { getWeaponById } from '../data/weapons';

/** 每個角色的 icon 顏色主題 */
const CHAR_COLORS: Record<string, { primary: number; accent: number }> = {
  swordsman: { primary: 0x2255cc, accent: 0x66aaff },
  assassin:  { primary: 0x662299, accent: 0xcc66ff },
  taoist:    { primary: 0x116633, accent: 0x44cc88 },
};

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex: number = -1;

  // 每張卡片的 Graphics（用於重繪邊框）
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];

  // 確認按鈕相關
  private confirmGraphics!: Phaser.GameObjects.Graphics;
  private confirmText!: Phaser.GameObjects.Text;
  private confirmHitArea!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.selectedIndex = -1;
    this.cardGraphics = [];

    // ── 背景（與主選單一致）──────────────────────────────────────────────
    this.drawBackground(W, H);

    // ── 標題 ────────────────────────────────────────────────────────────
    this.drawTitle(W, H);

    // ── 角色卡片 ─────────────────────────────────────────────────────────
    const cardXPositions = [W * 0.22, W * 0.50, W * 0.78];
    const cardCenterY = H * 0.47;
    const cardW = Math.min(W * 0.22, 180);
    const cardH = H * 0.52;

    CHARACTERS.forEach((char, i) => {
      this.buildCharacterCard(
        char,
        cardXPositions[i],
        cardCenterY,
        cardW,
        cardH,
        i,
        W,
        H
      );
    });

    // ── 確認選擇按鈕 ─────────────────────────────────────────────────────
    this.buildConfirmButton(W, H);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    const bg = this.add.graphics().setDepth(0);
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x0d + (0x0a - 0x0d) * t);
      const g = Math.round(0x1f + (0x0a - 0x1f) * t);
      const b = Math.round(0x0d + (0x2e - 0x0d) * t);
      const color = (r << 16) | (g << 8) | b;
      bg.fillStyle(color, 1);
      bg.fillRect(0, (H / steps) * i, W, H / steps + 1);
    }

    // 山脈輪廓
    const mountains = this.add.graphics().setDepth(1);
    mountains.fillStyle(0x0a1a0a, 0.5);
    mountains.fillTriangle(0, H, W * 0.12, H * 0.60, W * 0.25, H);
    mountains.fillTriangle(W * 0.75, H, W * 0.88, H * 0.55, W, H);
  }

  private drawTitle(W: number, H: number): void {
    // 標題陰影
    this.add.text(W * 0.5 + 2, H * 0.10 + 2, '選擇角色', {
      fontSize: '34px',
      color: '#7a4a00',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // 標題主體
    this.add.text(W * 0.5, H * 0.10, '選擇角色', {
      fontSize: '34px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(11);

    // 底線裝飾
    const line = this.add.graphics().setDepth(11);
    line.lineStyle(1.5, 0xd4af37, 0.7);
    line.lineBetween(W * 0.38, H * 0.155, W * 0.62, H * 0.155);
  }

  private buildCharacterCard(
    char: CharacterData,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    index: number,
    W: number,
    H: number
  ): void {
    const cardTop = cy - cardH / 2;
    const colors = CHAR_COLORS[char.id] ?? { primary: 0x334466, accent: 0x6688aa };
    const weaponData = getWeaponById(char.startingWeaponId);

    // ── 卡片 Graphics（邊框，可重繪）──
    const g = this.add.graphics().setDepth(8);
    this.cardGraphics.push(g);
    this.drawCardFrame(g, cx, cy, cardW, cardH, false, colors.accent);

    // ── 角色 Icon 佔位圖形 ──────────────────────────────────────────────
    const iconY = cardTop + cardH * 0.18;
    this.drawCharacterIcon(cx, iconY, colors, char.id);

    // ── 角色名稱 ────────────────────────────────────────────────────────
    this.add.text(cx, cardTop + cardH * 0.36, char.name, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 初始武器 ────────────────────────────────────────────────────────
    this.add.text(cx, cardTop + cardH * 0.46, `⚔ ${weaponData?.name ?? '—'}`, {
      fontSize: '13px',
      color: '#d4af37',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 角色特性 ────────────────────────────────────────────────────────
    const traitLabel = this.getTraitLabel(char.trait);
    this.add.text(cx, cardTop + cardH * 0.55, traitLabel, {
      fontSize: '12px',
      color: '#aaaacc',
      align: 'center',
      wordWrap: { width: cardW - 16 },
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 屬性摘要 ────────────────────────────────────────────────────────
    const statsY = cardTop + cardH * 0.70;
    const lineH = cardH * 0.085;
    this.add.text(cx, statsY,           `❤ HP  ${char.baseHP}`, { fontSize: '12px', color: '#ff8888' }).setOrigin(0.5, 0.5).setDepth(10);
    this.add.text(cx, statsY + lineH,   `⚡ 攻擊 ×${char.baseAttackPower.toFixed(1)}`, { fontSize: '12px', color: '#ffcc66' }).setOrigin(0.5, 0.5).setDepth(10);
    this.add.text(cx, statsY + lineH*2, `💨 移速 ${char.baseMoveSpeed}`, { fontSize: '12px', color: '#88ddff' }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 互動熱區 ────────────────────────────────────────────────────────
    const hitArea = this.add.rectangle(cx, cy, Math.max(cardW, 88), Math.max(cardH, 88), 0x000000, 0)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.selectCharacter(index));
    hitArea.on('pointerover', () => {
      if (this.selectedIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], cx, cy, cardW, cardH, false, colors.accent, true);
      }
    });
    hitArea.on('pointerout', () => {
      if (this.selectedIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], cx, cy, cardW, cardH, false, colors.accent, false);
      }
    });
  }

  private drawCharacterIcon(
    cx: number,
    cy: number,
    colors: { primary: number; accent: number },
    charId: string
  ): void {
    const g = this.add.graphics().setDepth(9);

    // 頭部（圓形）
    g.fillStyle(colors.accent, 1);
    g.fillCircle(cx, cy - 14, 10);

    // 身體（矩形）
    g.fillStyle(colors.primary, 1);
    g.fillRect(cx - 9, cy - 4, 18, 20);

    // 角色特有裝飾
    if (charId === 'swordsman') {
      // 劍（細長矩形，金色）
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx + 8, cy - 18, 3, 28);
      g.fillRect(cx + 5, cy - 6, 9, 3);
    } else if (charId === 'assassin') {
      // 雙刀（兩側短刀）
      g.fillStyle(0xcc88ff, 1);
      g.fillRect(cx - 14, cy - 10, 3, 18);
      g.fillRect(cx + 11, cy - 10, 3, 18);
    } else if (charId === 'taoist') {
      // 法杖（頂部圓形）
      g.fillStyle(0x44cc88, 1);
      g.fillRect(cx + 9, cy - 22, 3, 30);
      g.fillCircle(cx + 10, cy - 24, 5);
    }

    // 腿部
    g.fillStyle(colors.primary, 0.8);
    g.fillRect(cx - 7, cy + 16, 6, 10);
    g.fillRect(cx + 1, cy + 16, 6, 10);
  }

  private drawCardFrame(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    selected: boolean,
    accentColor: number,
    hovered: boolean = false
  ): void {
    g.clear();
    const x = cx - cardW / 2;
    const y = cy - cardH / 2;
    const r = 8;

    // 卡片背景
    if (selected) {
      g.fillStyle(0x1a2a3a, 0.92);
    } else if (hovered) {
      g.fillStyle(0x1a1a2e, 0.88);
    } else {
      g.fillStyle(0x0f0f1e, 0.85);
    }
    g.fillRoundedRect(x, y, cardW, cardH, r);

    // 邊框
    if (selected) {
      // 選中：金色粗邊框 + 外發光
      g.lineStyle(3, 0xffd700, 1);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(6, 0xffd700, 0.2);
      g.strokeRoundedRect(x - 2, y - 2, cardW + 4, cardH + 4, r + 2);
    } else if (hovered) {
      g.lineStyle(2, accentColor, 0.9);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      g.lineStyle(1.5, accentColor, 0.5);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    }
  }

  private buildConfirmButton(W: number, H: number): void {
    const btnW = 220;
    const btnH = 56;
    const btnX = W * 0.5;
    const btnY = H * 0.88;

    this.confirmGraphics = this.add.graphics().setDepth(11);
    this.drawConfirmBtn(false);

    this.confirmText = this.add.text(btnX, btnY, '請先選擇角色', {
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5, 0.5).setDepth(12);

    const hitH = Math.max(btnH, 48);
    this.confirmHitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, 88), hitH, 0x000000, 0)
      .setDepth(13)
      .setInteractive({ useHandCursor: false });

    this.confirmHitArea.on('pointerdown', () => {
      if (this.selectedIndex < 0) return;
      const characterId = CHARACTERS[this.selectedIndex].id;
      this.scene.start('GameScene', { characterId });
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
    const btnW = 220;
    const btnH = 56;
    const btnX = W * 0.5;
    const btnY = H * 0.88;
    const r = 8;

    this.confirmGraphics.clear();

    if (this.selectedIndex < 0) {
      // 未選角色：灰色不可點擊
      this.confirmGraphics.fillStyle(0x333333, 0.8);
      this.confirmGraphics.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
      this.confirmGraphics.lineStyle(1.5, 0x555555, 0.6);
      this.confirmGraphics.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
    } else {
      // 已選角色：深紅底 + 金色邊框
      this.confirmGraphics.fillStyle(hovered ? 0x8b1a1a : 0x6b0f0f, 1);
      this.confirmGraphics.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
      this.confirmGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 1);
      this.confirmGraphics.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
    }
  }

  private selectCharacter(index: number): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cardXPositions = [W * 0.22, W * 0.50, W * 0.78];
    const cardCenterY = H * 0.47;
    const cardW = Math.min(W * 0.22, 180);
    const cardH = H * 0.52;

    this.selectedIndex = index;

    // 重繪所有卡片邊框
    CHARACTERS.forEach((char, i) => {
      const colors = CHAR_COLORS[char.id] ?? { primary: 0x334466, accent: 0x6688aa };
      this.drawCardFrame(
        this.cardGraphics[i],
        cardXPositions[i],
        cardCenterY,
        cardW,
        cardH,
        i === index,
        colors.accent
      );
    });

    // 更新確認按鈕
    this.drawConfirmBtn(false);
    this.confirmText.setText('確認出戰').setColor('#ffffff').setFontSize('20px');
    this.confirmHitArea.setInteractive({ useHandCursor: true });
  }

  private getTraitLabel(trait: string): string {
    switch (trait) {
      case '屬性加成型': return '特性：屬性加成\n攻擊力全面提升';
      case '條件觸發型': return '特性：條件觸發\n速度快、拾取廣';
      case '行為修改型': return '特性：行為修改\nHP 厚、範圍大';
      default: return trait;
    }
  }
}
