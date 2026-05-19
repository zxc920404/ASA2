import Phaser from 'phaser';
import { MetaProgression, META_UPGRADES, MetaUpgradeDef, MetaUpgradeId } from '../systems/MetaProgression';

/**
 * MetaUpgradeScene — 天命修煉局外升級頁面
 * 顯示天命點、6 個升級項目、升級按鈕
 * 手機橫向兩欄布局
 */
export class MetaUpgradeScene extends Phaser.Scene {
  private dpText!: Phaser.GameObjects.Text;
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private cardElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'MetaUpgradeScene' });
  }

  create(): void {
    // 每次進入場景重新讀取存檔
    MetaProgression.load();

    const W = this.scale.width;
    const H = this.scale.height;

    // ── 背景 ──────────────────────────────────────────────────────────────
    this.drawBackground(W, H);

    // ── 標題 ──────────────────────────────────────────────────────────────
    this.add.text(W * 0.5, H * 0.07, '天命修煉', {
      fontSize: '32px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── 天命點顯示 ────────────────────────────────────────────────────────
    this.dpText = this.add.text(W * 0.5, H * 0.15, '', {
      fontSize: '18px', color: '#88ffcc', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(10);
    this.refreshDpText();

    // ── 升級卡片（兩欄布局）──────────────────────────────────────────────
    this.buildCards(W, H);

    // ── 返回按鈕 ──────────────────────────────────────────────────────────
    this.buildReturnButton(W, H);
  }

  private drawBackground(W: number, H: number): void {
    const bg = this.add.graphics().setDepth(0);
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x0a + (0x0d - 0x0a) * t);
      const g = Math.round(0x0a + (0x1a - 0x0a) * t);
      const b = Math.round(0x1a + (0x2e - 0x1a) * t);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, (H / steps) * i, W, H / steps + 1);
    }
  }

  private refreshDpText(): void {
    const dp = MetaProgression.getDestinyPoints();
    this.dpText.setText(`✦ 天命點：${dp}`);
  }

  private buildCards(W: number, H: number): void {
    // 清除舊卡片
    for (const el of this.cardElements) el.destroy();
    this.cardElements = [];
    this.cardGraphics = [];

    const cols = 2;
    const rows = Math.ceil(META_UPGRADES.length / cols);
    const cardW = W * 0.42;
    const cardH = H * 0.18;
    const gapX = W * 0.04;
    const gapY = H * 0.025;
    const startX = W * 0.5 - cardW - gapX / 2;
    const startY = H * 0.22;

    for (let i = 0; i < META_UPGRADES.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      this.buildCard(META_UPGRADES[i], cx, cy, cardW, cardH);
    }
  }

  private buildCard(def: MetaUpgradeDef, cx: number, cy: number, cardW: number, cardH: number): void {
    const level = MetaProgression.getUpgradeLevel(def.id);
    const isUnlocked = MetaProgression.isUnlocked(def.id);
    const isMaxed = level >= def.maxLevel;
    const canUpgrade = MetaProgression.canUpgrade(def.id);
    const cost = isMaxed ? 0 : (def.costs[level] ?? 0);

    const r = 8;
    const cardG = this.add.graphics().setDepth(10);
    this.drawCard(cardG, cx, cy, cardW, cardH, r, isUnlocked, isMaxed);
    this.cardGraphics.push(cardG);
    this.cardElements.push(cardG);

    const alpha = isUnlocked ? 1 : 0.5;

    // 類別標籤
    const catText = this.add.text(cx - cardW / 2 + 8, cy - cardH / 2 + 6, def.category, {
      fontSize: '10px', color: '#888888',
    }).setOrigin(0, 0).setDepth(11).setAlpha(alpha);
    this.cardElements.push(catText);

    // 名稱
    const nameText = this.add.text(cx, cy - cardH / 2 + 18, def.name, {
      fontSize: '15px', color: isMaxed ? '#ffd700' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11).setAlpha(alpha);
    this.cardElements.push(nameText);

    // 等級
    const lvLabel = isMaxed ? `Lv.${level} ✦ 滿級` : `Lv.${level} / ${def.maxLevel}`;
    const lvText = this.add.text(cx, cy - cardH / 2 + 34, lvLabel, {
      fontSize: '11px', color: isMaxed ? '#ffd700' : '#aaddff',
    }).setOrigin(0.5, 0).setDepth(11).setAlpha(alpha);
    this.cardElements.push(lvText);

    if (!isUnlocked) {
      // 未解鎖：顯示解鎖條件
      const lockText = this.add.text(cx, cy + 4, `🔒 ${def.unlockDesc ?? '未解鎖'}`, {
        fontSize: '11px', color: '#888888',
        wordWrap: { width: cardW - 16 }, align: 'center',
      }).setOrigin(0.5, 0.5).setDepth(11);
      this.cardElements.push(lockText);
    } else {
      // 目前效果
      const effectText = this.add.text(cx, cy - cardH / 2 + 50, def.effectDesc(level), {
        fontSize: '11px', color: '#88ffaa',
        wordWrap: { width: cardW - 16 }, align: 'center',
      }).setOrigin(0.5, 0).setDepth(11);
      this.cardElements.push(effectText);

      if (!isMaxed) {
        // 下一級效果
        const nextText = this.add.text(cx, cy - cardH / 2 + 66, `▶ ${def.nextEffectDesc(level)}`, {
          fontSize: '10px', color: '#aaaacc',
          wordWrap: { width: cardW - 16 }, align: 'center',
        }).setOrigin(0.5, 0).setDepth(11);
        this.cardElements.push(nextText);

        // 升級按鈕
        const btnW = 90;
        const btnH = 26;
        const btnX = cx + cardW / 2 - btnW / 2 - 6;
        const btnY = cy + cardH / 2 - btnH / 2 - 6;

        const btnG = this.add.graphics().setDepth(11);
        this.drawUpgradeBtn(btnG, btnX, btnY, btnW, btnH, canUpgrade, false);
        this.cardElements.push(btnG);

        const costStr = canUpgrade ? `升級 ${cost}✦` : `${cost}✦ 不足`;
        const btnText = this.add.text(btnX, btnY, costStr, {
          fontSize: '11px',
          color: canUpgrade ? '#ffffff' : '#888888',
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5).setDepth(12);
        this.cardElements.push(btnText);

        if (canUpgrade) {
          const hitArea = this.add.rectangle(btnX, btnY, btnW, btnH, 0, 0)
            .setDepth(13).setInteractive({ useHandCursor: true });
          this.cardElements.push(hitArea);

          hitArea.on('pointerover', () => {
            this.drawUpgradeBtn(btnG, btnX, btnY, btnW, btnH, true, true);
            btnText.setColor('#ffd700');
          });
          hitArea.on('pointerout', () => {
            this.drawUpgradeBtn(btnG, btnX, btnY, btnW, btnH, true, false);
            btnText.setColor('#ffffff');
          });
          hitArea.on('pointerdown', () => {
            const success = MetaProgression.upgrade(def.id);
            if (success) {
              this.refreshDpText();
              this.buildCards(this.scale.width, this.scale.height);
            }
          });
        }
      }
    }
  }

  private drawCard(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number,
    isUnlocked: boolean, isMaxed: boolean
  ): void {
    g.clear();
    g.fillStyle(0x0d0d1e, isUnlocked ? 0.92 : 0.6);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    const borderColor = isMaxed ? 0xffd700 : isUnlocked ? 0x4466aa : 0x333355;
    const borderAlpha = isMaxed ? 0.9 : isUnlocked ? 0.6 : 0.3;
    g.lineStyle(isMaxed ? 2 : 1.5, borderColor, borderAlpha);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  private drawUpgradeBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
    canUpgrade: boolean, hovered: boolean
  ): void {
    g.clear();
    if (canUpgrade) {
      g.fillStyle(hovered ? 0x8b1a1a : 0x6b0f0f, 1);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
      g.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, 1);
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
    } else {
      g.fillStyle(0x222222, 0.8);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
      g.lineStyle(1, 0x444444, 0.5);
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
    }
  }

  private buildReturnButton(W: number, H: number): void {
    const btnW = 180;
    const btnH = 44;
    const btnX = W * 0.5;
    const btnY = H * 0.94;
    const r = 8;

    const btnG = this.add.graphics().setDepth(10);
    this.drawReturnBtn(btnG, btnX, btnY, btnW, btnH, r, false);

    const btnText = this.add.text(btnX, btnY, '返回主選單', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(11);

    const hitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, 88), Math.max(btnH, 48), 0, 0)
      .setDepth(12).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      this.drawReturnBtn(btnG, btnX, btnY, btnW, btnH, r, true);
      btnText.setColor('#ffd700');
    });
    hitArea.on('pointerout', () => {
      this.drawReturnBtn(btnG, btnX, btnY, btnW, btnH, r, false);
      btnText.setColor('#ffffff');
    });
    hitArea.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }

  private drawReturnBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number,
    hovered: boolean
  ): void {
    g.clear();
    g.fillStyle(hovered ? 0x1a3a1a : 0x0f2a0f, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    g.lineStyle(hovered ? 2 : 1.5, hovered ? 0x88ff88 : 0x44aa44, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }
}
