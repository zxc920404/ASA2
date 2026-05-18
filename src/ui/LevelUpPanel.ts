import Phaser from 'phaser';
import { UpgradeOption } from '../types/index';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';

/** 取得升級選項的顯示名稱 */
function getOptionName(option: UpgradeOption): string {
  if (option.type === 'healHp') return '氣血回復';
  if (option.type === 'newWeapon' || option.type === 'upgradeWeapon') {
    return getWeaponById(option.id)?.name ?? option.id;
  }
  return getPassiveById(option.id)?.name ?? option.id;
}

/** 取得升級選項的效果描述文字 */
export function getOptionDescription(option: UpgradeOption): string {
  switch (option.type) {
    case 'healHp':
      return '恢復 30% 最大生命值\n（所有裝備已滿級）';
    case 'newWeapon': {
      const weapon = getWeaponById(option.id);
      return weapon ? `自動攻擊敵人\n初始傷害 ${weapon.levelStats[0]?.damage ?? weapon.baseDamagePerLevel[0]}` : '新武器';
    }
    case 'upgradeWeapon': {
      const weapon = getWeaponById(option.id);
      if (!weapon) return '傷害提升';
      const statsCur = weapon.levelStats[option.currentLevel - 1];
      const statsNext = weapon.levelStats[option.nextLevel - 1];
      const dmgCur = statsCur?.damage ?? 0;
      const dmgNext = statsNext?.damage ?? dmgCur;
      return `基礎傷害\n${dmgCur} → ${dmgNext}`;
    }
    case 'newPassive': {
      const passive = getPassiveById(option.id);
      if (!passive) return '新被動道具';
      const bonus = passive.bonusPerLevel;
      switch (passive.stat) {
        case 'moveSpeed':   return `移動速度 +${(bonus * 100).toFixed(0)}%`;
        case 'hp':          return `最大 HP +${bonus}`;
        case 'attackPower': return `攻擊力 +${(bonus * 100).toFixed(0)}%`;
        case 'pickupRange': return `拾取範圍 +${bonus}px`;
        case 'attackRange': return `攻擊範圍 +${(bonus * 100).toFixed(0)}%`;
        case 'attackSpeed': return `攻擊速度 +${(bonus * 100).toFixed(0)}%`;
        default:            return '屬性提升';
      }
    }
    case 'upgradePassive': {
      const passive = getPassiveById(option.id);
      if (!passive) return '效果提升';
      const bonus = passive.bonusPerLevel;
      switch (passive.stat) {
        case 'moveSpeed':   return `移動速度再 +${(bonus * 100).toFixed(0)}%`;
        case 'hp':          return `最大 HP 再 +${bonus}`;
        case 'attackPower': return `攻擊力再 +${(bonus * 100).toFixed(0)}%`;
        case 'pickupRange': return `拾取範圍再 +${bonus}px`;
        case 'attackRange': return `攻擊範圍再 +${(bonus * 100).toFixed(0)}%`;
        case 'attackSpeed': return `攻擊速度再 +${(bonus * 100).toFixed(0)}%`;
        default:            return '效果提升';
      }
    }
  }
}

/** 取得選項類型標籤與顏色 */
function getTypeTag(option: UpgradeOption): { label: string; color: number } {
  if (option.type === 'healHp')         return { label: '氣血回復', color: 0x22aa44 };
  if (option.type === 'newWeapon')      return { label: '新武器', color: 0xaa2222 };
  if (option.type === 'upgradeWeapon')  return { label: '武器升級', color: 0xcc4444 };
  if (option.type === 'newPassive')     return { label: '新被動', color: 0x2244aa };
  return { label: '被動升級', color: 0x4466cc };
}

/**
 * LevelUpPanel — Polish 6b 美化版
 * 正式卡片 UI：深色半透明 + 金色邊框 + 類型標籤 + hover 發光
 */
export class LevelUpPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private onSelect: (option: UpgradeOption) => void;

  constructor(
    scene: Phaser.Scene,
    options: UpgradeOption[],
    onSelect: (option: UpgradeOption) => void
  ) {
    this.scene = scene;
    this.onSelect = onSelect;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.build(options);
  }

  private build(options: UpgradeOption[]): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── 全螢幕遮罩 ──────────────────────────────────────────────────────────
    const overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, W, H);
    this.container.add(overlay);

    // ── 標題 ────────────────────────────────────────────────────────────────
    // 陰影
    const titleShadow = this.scene.add.text(W * 0.5 + 2, H * 0.17 + 2, '升級！選擇強化', {
      fontSize: '30px', color: '#7a4a00', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.container.add(titleShadow);

    const title = this.scene.add.text(W * 0.5, H * 0.17, '升級！選擇強化', {
      fontSize: '30px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.container.add(title);

    // 標題裝飾線
    const titleLine = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    titleLine.lineStyle(1.5, 0xd4af37, 0.6);
    titleLine.lineBetween(W * 0.35, H * 0.22, W * 0.65, H * 0.22);
    this.container.add(titleLine);

    // ── 選項卡片 ─────────────────────────────────────────────────────────────
    const cardXPositions = [W * 0.22, W * 0.50, W * 0.78];
    const cardW = Math.min(W * 0.22, 190);
    const cardH = H * 0.50;
    const cardY = H * 0.52;

    for (let i = 0; i < options.length; i++) {
      this.buildCard(options[i], cardXPositions[i], cardY, cardW, cardH, W, H);
    }
  }

  private buildCard(
    option: UpgradeOption,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    W: number,
    H: number
  ): void {
    const cardTop = cy - cardH * 0.5;
    const r = 8;
    const typeTag = getTypeTag(option);

    // ── 卡片 Graphics（可重繪邊框）──────────────────────────────────────────
    const cardG = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawCardNormal(cardG, cx, cy, cardW, cardH, r);
    this.container.add(cardG);

    // ── 類型標籤（頂部色塊）────────────────────────────────────────────────
    const tagW = cardW * 0.55;
    const tagH = 20;
    const tagG = this.scene.add.graphics().setScrollFactor(0).setDepth(102);
    tagG.fillStyle(typeTag.color, 0.9);
    tagG.fillRoundedRect(cx - tagW / 2, cardTop + 8, tagW, tagH, 4);
    this.container.add(tagG);

    const tagText = this.scene.add.text(cx, cardTop + 18, typeTag.label, {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(103);
    this.container.add(tagText);

    // ── 選項名稱 ────────────────────────────────────────────────────────────
    const nameText = this.scene.add.text(cx, cardTop + cardH * 0.22, getOptionName(option), {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: cardW - 16 }, align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(nameText);

    // ── 分隔線 ──────────────────────────────────────────────────────────────
    const sepLine = this.scene.add.graphics().setScrollFactor(0).setDepth(102);
    sepLine.lineStyle(1, 0x555577, 0.5);
    sepLine.lineBetween(cx - cardW * 0.35, cardTop + cardH * 0.32, cx + cardW * 0.35, cardTop + cardH * 0.32);
    this.container.add(sepLine);

    // ── 效果描述 ────────────────────────────────────────────────────────────
    const descText = this.scene.add.text(cx, cardTop + cardH * 0.52, getOptionDescription(option), {
      fontSize: '13px', color: '#bbbbcc',
      wordWrap: { width: cardW - 20 }, align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(descText);

    // ── 等級標示（卡片底部）────────────────────────────────────────────────
    const cardBottom = cy + cardH * 0.5;
    const levelLabel = option.type === 'healHp'
      ? '✦ 回復生命'
      : (option.type === 'newWeapon' || option.type === 'newPassive')
        ? '✦ 新裝備'
        : `Lv ${option.currentLevel} → ${option.nextLevel}`;

    const levelText = this.scene.add.text(cx, cardBottom - cardH * 0.10, levelLabel, {
      fontSize: '13px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(levelText);

    // ── 互動熱區 ────────────────────────────────────────────────────────────
    const hitW = Math.max(cardW, 88);
    const hitH = Math.max(cardH, 88);
    const hitArea = this.scene.add.rectangle(cx, cy, hitW, hitH, 0x000000, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });
    this.container.add(hitArea);

    hitArea.on('pointerover', () => {
      cardG.clear();
      this.drawCardHover(cardG, cx, cy, cardW, cardH, r);
    });
    hitArea.on('pointerout', () => {
      cardG.clear();
      this.drawCardNormal(cardG, cx, cy, cardW, cardH, r);
    });
    hitArea.on('pointerdown', () => this.handleSelect(option));
  }

  private drawCardNormal(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number
  ): void {
    g.fillStyle(0x0d0d1e, 0.92);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    g.lineStyle(1.5, 0xd4af37, 0.55);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  private drawCardHover(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number
  ): void {
    g.fillStyle(0x1a1a2e, 0.95);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    // 金色發光邊框
    g.lineStyle(2.5, 0xffd700, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    g.lineStyle(5, 0xffd700, 0.18);
    g.strokeRoundedRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, r + 2);
  }

  private handleSelect(option: UpgradeOption): void {
    this.destroy();
    this.onSelect(option);
  }

  public destroy(): void {
    this.container.destroy(true);
  }
}
