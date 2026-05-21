import Phaser from 'phaser';
import { MetaProgression, META_UPGRADES, MetaUpgradeDef, MetaUpgradeId } from '../systems/MetaProgression';
import { uiText, uiTitle } from '../ui/UIStyles';
import { SFXManager } from '../systems/SFXManager';

/**
 * MetaUpgradeScene — 天命修煉局外升級頁面
 * 兩欄布局、天命點右上角、長按連續購買、未解鎖項目清楚顯示
 */
export class MetaUpgradeScene extends Phaser.Scene {
  private dpText!: Phaser.GameObjects.Text;
  private cardElements: Phaser.GameObjects.GameObject[] = [];

  /** 長按連續購買計時器 */
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  /** 長按啟動延遲計時器 */
  private holdDelayTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'MetaUpgradeScene' });
  }

  create(): void {
    MetaProgression.load();

    const W = this.scale.width;
    const H = this.scale.height;

    this.drawBackground(W, H);

    // ── 標題（左上）──────────────────────────────────────────────────────
    this.add.text(Math.round(W * 0.08), Math.round(H * 0.07), '天命修煉',
      uiTitle(26, '#ffd700')
    ).setOrigin(0, 0.5).setDepth(10);

    this.dpText = this.add.text(Math.round(W - 16), 12, '',
      uiText(18, '#88ffcc', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
    ).setOrigin(1, 0).setDepth(15);
    this.refreshDpText();

    // ── 升級卡片（兩欄布局）──────────────────────────────────────────────
    this.buildCards(W, H);

    // ── 返回按鈕 ──────────────────────────────────────────────────────────
    this.buildReturnButton(W, H);

    // scene 關閉時清理長按計時器
    this.events.once('shutdown', () => this.clearHoldTimers());
  }

  // ─────────────────────────────────────────────────────────────────────────

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
    for (const el of this.cardElements) el.destroy();
    this.cardElements = [];

    const cols = 2;
    const cardW = W * 0.43;
    const cardH = H * 0.195;
    const gapX = W * 0.03;
    const gapY = H * 0.022;
    const startX = W * 0.5 - cardW - gapX / 2;
    const startY = H * 0.18;

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
    const r = 7;

    // ── 卡片背景 ──────────────────────────────────────────────────────────
    const cardG = this.add.graphics().setDepth(10);
    this.drawCardBg(cardG, cx, cy, cardW, cardH, r, isUnlocked, isMaxed);
    this.cardElements.push(cardG);

    // 未解鎖時整體半透明
    const alpha = isUnlocked ? 1 : 0.45;

    // ── 類別標籤 ──────────────────────────────────────────────────────────
    const catText = this.add.text(cx - cardW / 2 + 8, cy - cardH / 2 + 5, def.category,
      uiText(9, '#777777')
    ).setOrigin(0, 0).setDepth(11).setAlpha(alpha);
    this.cardElements.push(catText);

    const nameColor = isMaxed ? '#ffd700' : isUnlocked ? '#ffffff' : '#666666';
    const nameText = this.add.text(cx, cy - cardH / 2 + 17, def.name,
      uiText(13, nameColor, { fontStyle: 'bold' })
    ).setOrigin(0.5, 0).setDepth(11);
    this.cardElements.push(nameText);

    const lvLabel = isMaxed ? `Lv.${level} ✦ 滿級` : `Lv.${level} / ${def.maxLevel}`;
    const lvText = this.add.text(cx, cy - cardH / 2 + 32, lvLabel,
      uiText(10, isMaxed ? '#ffd700' : isUnlocked ? '#aaddff' : '#555555')
    ).setOrigin(0.5, 0).setDepth(11);
    this.cardElements.push(lvText);

    if (!isUnlocked) {
      // ── 未解鎖：鎖頭 + 解鎖條件 ──────────────────────────────────────
      const lockBg = this.add.graphics().setDepth(11);
      lockBg.fillStyle(0x000000, 0.45);
      lockBg.fillRoundedRect(cx - cardW / 2 + 6, cy - 2, cardW - 12, cardH * 0.38, 4);
      this.cardElements.push(lockBg);

      const lockIcon = this.add.text(cx, cy + cardH * 0.05, '🔒', {
        fontSize: '16px',
      }).setOrigin(0.5, 0.5).setDepth(12);
      this.cardElements.push(lockIcon);

      const lockDesc = this.add.text(cx, cy + cardH * 0.22, def.unlockDesc ?? '條件未達成',
        uiText(10, '#aaaaaa', { wordWrap: { width: cardW - 20 }, align: 'center' })
      ).setOrigin(0.5, 0).setDepth(12);
      this.cardElements.push(lockDesc);

    } else {
      const effectText = this.add.text(cx, cy - cardH / 2 + 47, def.effectDesc(level),
        uiText(10, '#88ffaa', { wordWrap: { width: cardW - 16 }, align: 'center' })
      ).setOrigin(0.5, 0).setDepth(11);
      this.cardElements.push(effectText);

      if (!isMaxed) {
        const nextText = this.add.text(cx, cy - cardH / 2 + 62, `▶ ${def.nextEffectDesc(level)}`,
          uiText(9, '#aaaacc', { wordWrap: { width: cardW - 16 }, align: 'center' })
        ).setOrigin(0.5, 0).setDepth(11);
        this.cardElements.push(nextText);

        // ── 升級按鈕（支援長按）──────────────────────────────────────────
        const btnW = Math.min(cardW * 0.52, 100);
        const btnH = 28;
        const btnX = cx + cardW / 2 - btnW / 2 - 6;
        const btnY = cy + cardH / 2 - btnH / 2 - 5;

        const btnG = this.add.graphics().setDepth(11);
        this.drawUpgradeBtn(btnG, btnX, btnY, btnW, btnH, canUpgrade, false);
        this.cardElements.push(btnG);

        const costStr = canUpgrade ? `升級 ${cost}✦` : `${cost}✦ 不足`;
        const btnText = this.add.text(btnX, btnY, costStr,
          uiText(11, canUpgrade ? '#ffffff' : '#666666', { fontStyle: 'bold' })
        ).setOrigin(0.5, 0.5).setDepth(12);
        this.cardElements.push(btnText);

        if (canUpgrade) {
          // 點擊熱區（至少 48x48）
          const hitW = Math.max(btnW, 48);
          const hitH2 = Math.max(btnH, 48);
          const hitArea = this.add.rectangle(btnX, btnY, hitW, hitH2, 0, 0)
            .setDepth(13).setInteractive({ useHandCursor: true });
          this.cardElements.push(hitArea);

          hitArea.on('pointerover', () => {
            this.drawUpgradeBtn(btnG, btnX, btnY, btnW, btnH, true, true);
            btnText.setColor('#ffd700');
          });
          hitArea.on('pointerout', () => {
            this.clearHoldTimers();
            this.drawUpgradeBtn(btnG, btnX, btnY, btnW, btnH, true, false);
            btnText.setColor('#ffffff');
          });

          // 點擊：升級一次
          hitArea.on('pointerdown', () => {
            SFXManager.playButtonClick(this);
            this.doUpgrade(def.id);

            // 長按 500ms 後開始連續購買（每 160ms 一次）
            this.holdDelayTimer = this.time.delayedCall(500, () => {
              this.holdTimer = this.time.addEvent({
                delay: 160,
                loop: true,
                callback: () => {
                  if (!MetaProgression.canUpgrade(def.id)) {
                    this.clearHoldTimers();
                    return;
                  }
                  this.doUpgrade(def.id);
                },
              });
            });
          });

          hitArea.on('pointerup', () => this.clearHoldTimers());
        }
      }
    }
  }

  /** 執行一次升級並刷新 UI */
  private doUpgrade(id: MetaUpgradeId): void {
    const success = MetaProgression.upgrade(id);
    if (success) {
      this.refreshDpText();
      this.buildCards(this.scale.width, this.scale.height);
    }
  }

  /** 清除長按計時器 */
  private clearHoldTimers(): void {
    if (this.holdDelayTimer) {
      this.holdDelayTimer.remove();
      this.holdDelayTimer = null;
    }
    if (this.holdTimer) {
      this.holdTimer.remove();
      this.holdTimer = null;
    }
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number,
    isUnlocked: boolean, isMaxed: boolean
  ): void {
    g.clear();
    // 未解鎖：更深的背景
    g.fillStyle(isUnlocked ? 0x0d0d1e : 0x080810, isUnlocked ? 0.92 : 0.75);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    const borderColor = isMaxed ? 0xffd700 : isUnlocked ? 0x4466aa : 0x222233;
    const borderAlpha = isMaxed ? 0.9 : isUnlocked ? 0.55 : 0.25;
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
      g.fillStyle(0x1a1a1a, 0.8);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
      g.lineStyle(1, 0x333333, 0.5);
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
    }
  }

  private buildReturnButton(W: number, H: number): void {
    const btnW = 180;
    const btnH = 44;
    const btnX = W * 0.5;
    const btnY = H * 0.945;
    const r = 8;

    const btnG = this.add.graphics().setDepth(10);
    this.drawReturnBtn(btnG, btnX, btnY, btnW, btnH, r, false);

    const btnText = this.add.text(btnX, btnY, '返回主選單',
      uiText(15, '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(11);

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
      SFXManager.playButtonClick(this);
      this.clearHoldTimers();
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
