import Phaser from 'phaser';
import { CharacterData } from '../types/index';
import { CHARACTERS } from '../data/characters';
import { getWeaponById } from '../data/weapons';

// ── 宗門資料（UI 顯示用，不影響 id / 戰鬥邏輯）──────────────────────────
const SECT_INFO: Record<string, {
  sectName: string;
  motto: string;
  role: string;
  primary: number;
  accent: number;
  borderColor: number;
}> = {
  swordsman: {
    sectName: '墨守閣',
    motto: '墨心如盾，固若金湯。',
    role: '防禦反擊・血量極高',
    primary: 0x1a3a6a,
    accent:  0x66aaff,
    borderColor: 0x44aaff,
  },
  assassin: {
    sectName: '驚鴻派',
    motto: '劍走驚鴻，影過留痕。',
    role: '極致攻速・移動領先',
    primary: 0x2a1a4a,
    accent:  0xcc88ff,
    borderColor: 0xaaddff,
  },
  taoist: {
    sectName: '烈炎宗',
    motto: '烈陽焚天，萬物俱滅。',
    role: '範圍殺傷・爆發最強',
    primary: 0x4a1a0a,
    accent:  0xff8844,
    borderColor: 0xff6622,
  },
};

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex: number = -1;

  // 每張卡片的 Graphics（用於重繪邊框）
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];
  // 每張卡片的 Container（用於 scale 動畫）
  private cardContainers: Phaser.GameObjects.Container[] = [];

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
    this.cardContainers = [];

    // ── 背景 ──────────────────────────────────────────────────────────────
    this.drawBackground(W, H);

    // ── 標題 ──────────────────────────────────────────────────────────────
    this.drawTitle(W, H);

    // ── 角色卡片 ──────────────────────────────────────────────────────────
    const cardXPositions = [W * 0.22, W * 0.50, W * 0.78];
    const cardCenterY = H * 0.47;
    const cardW = Math.min(W * 0.22, 180);
    const cardH = H * 0.52;

    CHARACTERS.forEach((char, i) => {
      this.buildCharacterCard(char, cardXPositions[i], cardCenterY, cardW, cardH, i, W, H);
    });

    // ── 確認選擇按鈕 ──────────────────────────────────────────────────────
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
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, (H / steps) * i, W, H / steps + 1);
    }
    const mountains = this.add.graphics().setDepth(1);
    mountains.fillStyle(0x0a1a0a, 0.5);
    mountains.fillTriangle(0, H, W * 0.12, H * 0.60, W * 0.25, H);
    mountains.fillTriangle(W * 0.75, H, W * 0.88, H * 0.55, W, H);
  }

  private drawTitle(W: number, H: number): void {
    this.add.text(W * 0.5 + 2, H * 0.09 + 2, '選擇宗門', {
      fontSize: '34px', color: '#7a4a00', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);
    this.add.text(W * 0.5, H * 0.09, '選擇宗門', {
      fontSize: '34px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(11);
    const line = this.add.graphics().setDepth(11);
    line.lineStyle(1.5, 0xd4af37, 0.7);
    line.lineBetween(W * 0.38, H * 0.145, W * 0.62, H * 0.145);
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
    const sect = SECT_INFO[char.id] ?? {
      sectName: char.id, motto: '', role: '',
      primary: 0x334466, accent: 0x6688aa, borderColor: 0x6688aa,
    };
    const weaponData = getWeaponById(char.startingWeaponId);

    // ── Container（用於 scale 動畫）──────────────────────────────────────
    const container = this.add.container(cx, cy).setDepth(8);
    this.cardContainers.push(container);

    // ── 卡片 Graphics（邊框，可重繪）──────────────────────────────────────
    const g = this.add.graphics().setDepth(8);
    this.cardGraphics.push(g);
    this.drawCardFrame(g, cx, cy, cardW, cardH, false, sect.borderColor);

    // ── 角色 Icon ────────────────────────────────────────────────────────
    const iconY = cardTop + cardH * 0.17;
    this.drawCharacterIcon(cx, iconY, sect, char.id);

    // ── 宗門名稱（大字）──────────────────────────────────────────────────
    this.add.text(cx, cardTop + cardH * 0.35, sect.sectName, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 格言 ──────────────────────────────────────────────────────────────
    this.add.text(cx, cardTop + cardH * 0.44, sect.motto, {
      fontSize: '10px', color: '#d4af37',
      wordWrap: { width: cardW - 12 }, align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 定位描述 ──────────────────────────────────────────────────────────
    this.add.text(cx, cardTop + cardH * 0.53, sect.role, {
      fontSize: '11px', color: '#aaaacc',
      wordWrap: { width: cardW - 12 }, align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 初始武器 ──────────────────────────────────────────────────────────
    this.add.text(cx, cardTop + cardH * 0.61, `⚔ ${weaponData?.name ?? '—'}`, {
      fontSize: '12px', color: '#d4af37',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 屬性摘要（帶圖示）────────────────────────────────────────────────
    const statsY = cardTop + cardH * 0.71;
    const lineH = cardH * 0.082;
    this.add.text(cx, statsY,
      `HP  ${char.baseHP}`,
      { fontSize: '11px', color: '#ff8888' }
    ).setOrigin(0.5, 0.5).setDepth(10);
    this.add.text(cx, statsY + lineH,
      `ATK x${char.baseAttackPower.toFixed(1)}`,
      { fontSize: '11px', color: '#ffcc66' }
    ).setOrigin(0.5, 0.5).setDepth(10);
    this.add.text(cx, statsY + lineH * 2,
      `SPD ${char.baseMoveSpeed}`,
      { fontSize: '11px', color: '#88ddff' }
    ).setOrigin(0.5, 0.5).setDepth(10);

    // ── 高等流派預留標籤 ──────────────────────────────────────────────────
    const tagY = cardTop + cardH * 0.96;
    const tagG = this.add.graphics().setDepth(9);
    tagG.fillStyle(0x000000, 0.35);
    tagG.fillRoundedRect(cx - cardW / 2 + 4, tagY - 9, cardW - 8, 18, 4);
    this.add.text(cx, tagY, '解鎖高等流派（Lv.20 轉職）', {
      fontSize: '9px', color: '#888888',
    }).setOrigin(0.5, 0.5).setDepth(10).setAlpha(0.6);

    // ── 互動熱區 ──────────────────────────────────────────────────────────
    const hitArea = this.add.rectangle(cx, cy, Math.max(cardW, 88), Math.max(cardH, 88), 0x000000, 0)
      .setDepth(12).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.selectCharacter(index));
    hitArea.on('pointerover', () => {
      if (this.selectedIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], cx, cy, cardW, cardH, false, sect.borderColor, true);
      }
    });
    hitArea.on('pointerout', () => {
      if (this.selectedIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], cx, cy, cardW, cardH, false, sect.borderColor, false);
      }
    });
  }

  private drawCharacterIcon(
    cx: number,
    cy: number,
    sect: { primary: number; accent: number },
    charId: string
  ): void {
    const g = this.add.graphics().setDepth(9);
    // 光暈
    g.fillStyle(sect.accent, 0.12);
    g.fillCircle(cx, cy, 22);
    // 頭部
    g.fillStyle(sect.accent, 1);
    g.fillCircle(cx, cy - 14, 10);
    // 身體
    g.fillStyle(sect.primary, 1);
    g.fillRect(cx - 9, cy - 4, 18, 20);
    // 角色特有裝飾
    if (charId === 'swordsman') {
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx + 8, cy - 18, 3, 28);
      g.fillRect(cx + 5, cy - 6, 9, 3);
    } else if (charId === 'assassin') {
      g.fillStyle(0xcc88ff, 1);
      g.fillRect(cx - 14, cy - 10, 3, 18);
      g.fillRect(cx + 11, cy - 10, 3, 18);
    } else if (charId === 'taoist') {
      g.fillStyle(0xff8844, 1);
      g.fillRect(cx + 9, cy - 22, 3, 30);
      g.fillCircle(cx + 10, cy - 24, 5);
    }
    // 腿部
    g.fillStyle(sect.primary, 0.8);
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
    borderColor: number,
    hovered: boolean = false
  ): void {
    g.clear();
    const x = cx - cardW / 2;
    const y = cy - cardH / 2;
    const r = 8;

    if (selected) {
      g.fillStyle(0x1a2a3a, 0.95);
    } else if (hovered) {
      g.fillStyle(0x1a1a2e, 0.88);
    } else {
      g.fillStyle(0x0f0f1e, 0.85);
    }
    g.fillRoundedRect(x, y, cardW, cardH, r);

    if (selected) {
      // 選中：宗門代表色粗邊框 + 外發光
      g.lineStyle(3, borderColor, 1);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(7, borderColor, 0.22);
      g.strokeRoundedRect(x - 3, y - 3, cardW + 6, cardH + 6, r + 3);
    } else if (hovered) {
      g.lineStyle(2, borderColor, 0.85);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      g.lineStyle(1.5, borderColor, 0.45);
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

    this.confirmText = this.add.text(btnX, btnY, '請先選擇宗門', {
      fontSize: '18px', color: '#666666',
    }).setOrigin(0.5, 0.5).setDepth(12);

    const hitH = Math.max(btnH, 48);
    this.confirmHitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, 88), hitH, 0x000000, 0)
      .setDepth(13).setInteractive({ useHandCursor: false });

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
      this.confirmGraphics.fillStyle(0x333333, 0.8);
      this.confirmGraphics.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
      this.confirmGraphics.lineStyle(1.5, 0x555555, 0.6);
      this.confirmGraphics.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, r);
    } else {
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

    const prevIndex = this.selectedIndex;
    this.selectedIndex = index;

    // 重繪所有卡片邊框 + 縮放動畫
    CHARACTERS.forEach((char, i) => {
      const sect = SECT_INFO[char.id] ?? { borderColor: 0x6688aa };
      const isSelected = i === index;

      this.drawCardFrame(
        this.cardGraphics[i],
        cardXPositions[i],
        cardCenterY,
        cardW,
        cardH,
        isSelected,
        sect.borderColor
      );

      // 縮放動畫：選中 → 1.08，其他 → 1.0
      const targetScale = isSelected ? 1.08 : 1.0;
      if (i !== prevIndex || isSelected) {
        this.tweens.add({
          targets: this.cardGraphics[i],
          scaleX: targetScale,
          scaleY: targetScale,
          duration: 120,
          ease: 'Back.Out',
        });
      }
    });

    // 更新確認按鈕
    this.drawConfirmBtn(false);
    const sectName = SECT_INFO[CHARACTERS[index].id]?.sectName ?? '角色';
    this.confirmText.setText(`出戰 ${sectName}`).setColor('#ffffff').setFontSize('20px');
    this.confirmHitArea.setInteractive({ useHandCursor: true });
  }
}
