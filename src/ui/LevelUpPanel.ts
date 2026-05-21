import Phaser from 'phaser';
import { UpgradeOption } from '../types/index';
import { getWeaponById, WEAPONS } from '../data/weapons';
import { getPassiveById } from '../data/passives';
import { uiText, uiTitle } from './UIStyles';
import { AssetLoader } from '../utils/AssetLoader';
import { ResponsiveLayout } from '../utils/ResponsiveLayout';

// ─────────────────────────────────────────────────────────────────────────────
// Helper：武器升級差異描述
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 levelStats 陣列中取得「繼承上一級有效值」的完整 stats
 * 例如 Lv3 只有 count，則 damage 繼承 Lv2 的值
 */
function resolveStats(levelStats: unknown[], levelIndex: number): Record<string, number> {
  const merged: Record<string, number> = {};
  for (let i = 0; i <= levelIndex && i < levelStats.length; i++) {
    const s = levelStats[i] as Record<string, number> | undefined;
    if (!s) continue;
    for (const key of Object.keys(s)) {
      const val = s[key];
      if (val !== undefined && val !== null) {
        merged[key] = val;
      }
    }
  }
  return merged;
}

/** 欄位中文對照 */
const FIELD_LABELS: Record<string, string> = {
  damage:          '傷害',
  count:           '數量',
  range:           '射程',
  radius:          '範圍',
  pierce:          '穿透',
  duration:        '持續時間',
  projectileSpeed: '投射物速度',
};

/**
 * 計算武器升級差異，回傳描述字串陣列（最多 3 條）
 */
export function getWeaponUpgradeDeltaDescription(
  weaponId: string,
  currentLevel: number,
  nextLevel: number
): string[] {
  const weapon = getWeaponById(weaponId);
  if (!weapon || !weapon.levelStats) return ['整體性能提升'];

  const curStats = resolveStats(weapon.levelStats as unknown[], currentLevel - 1);
  const nxtStats = resolveStats(weapon.levelStats as unknown[], nextLevel - 1);

  const lines: string[] = [];

  // 比較常見欄位
  const fieldsToCheck = ['damage', 'count', 'range', 'radius', 'pierce', 'duration', 'projectileSpeed'];
  for (const field of fieldsToCheck) {
    const cur = curStats[field];
    const nxt = nxtStats[field];
    if (cur === undefined && nxt === undefined) continue;
    const curVal = cur ?? 0;
    const nxtVal = nxt ?? 0;
    if (curVal === nxtVal) continue;

    const diff = nxtVal - curVal;
    const label = FIELD_LABELS[field] ?? field;

    if (field === 'duration') {
      lines.push(`${label} +${diff.toFixed(1)} 秒`);
    } else if (Number.isInteger(diff)) {
      lines.push(`${label} +${diff}`);
    } else {
      lines.push(`${label} +${diff.toFixed(1)}`);
    }
  }

  // 單獨處理 interval（冷卻）
  const curInterval = curStats['interval'];
  const nxtInterval = nxtStats['interval'];
  if (curInterval !== undefined && nxtInterval !== undefined && curInterval !== nxtInterval) {
    const diff = curInterval - nxtInterval; // 縮短為正數
    if (diff > 0) {
      lines.push(`冷卻縮短 ${diff.toFixed(1)} 秒`);
    } else {
      lines.push(`發射節奏調整`);
    }
  }

  if (lines.length === 0) return ['整體性能提升'];
  return lines.slice(0, 3);
}

/**
 * 取得新武器 Lv1 基礎效果描述
 */
function getNewWeaponDescription(weaponId: string): string[] {
  const weapon = getWeaponById(weaponId);
  if (!weapon || !weapon.levelStats || weapon.levelStats.length === 0) return ['自動攻擊敵人'];

  const s = weapon.levelStats[0] as unknown as Record<string, number>;
  const lines: string[] = [];

  // 簡短功能描述（依武器特性）
  const funcDesc: Record<string, string> = {
    guardian_ring: '環繞體持續傷害敵人',
    swift_blade:   '向最近敵人投擲飛刃',
    flame_seal:    '投出爆炸火印',
    ice_spike:     '發射穿透冰錐',
    thunder_claw:  '快速發射雷電爪',
    poison_mist:   '投出毒霧，造成範圍持續傷害',
  };
  lines.push(funcDesc[weaponId] ?? '自動攻擊敵人');

  if (s['damage'] !== undefined)   lines.push(`傷害：${s['damage']}`);
  if (s['count'] !== undefined)    lines.push(`數量：${s['count']}`);
  if (s['radius'] !== undefined)   lines.push(`範圍：${s['radius']}`);
  if (s['duration'] !== undefined) lines.push(`持續時間：${s['duration'].toFixed(1)} 秒`);

  return lines.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper：被動升級差異描述
// ─────────────────────────────────────────────────────────────────────────────

function getPassiveDeltaLines(passiveId: string, isNew: boolean): string[] {
  const passive = getPassiveById(passiveId);
  if (!passive) return ['屬性提升'];

  const bonus = passive.bonusPerLevel;
  let line = '';
  switch (passive.stat) {
    case 'moveSpeed':   line = `移動速度 +${(bonus * 100).toFixed(0)}%`; break;
    case 'hp':          line = `最大生命 +${bonus}`; break;
    case 'attackPower': line = `攻擊力 +${(bonus * 100).toFixed(0)}%`; break;
    case 'pickupRange': line = `拾取範圍 +${bonus}`; break;
    case 'attackRange': line = `攻擊範圍 +${(bonus * 100).toFixed(0)}%`; break;
    case 'attackSpeed': line = `攻擊速度 +${(bonus * 100).toFixed(0)}%`; break;
    default:            line = '屬性提升';
  }
  return [line];
}

// ─────────────────────────────────────────────────────────────────────────────
// 主要顯示邏輯
// ─────────────────────────────────────────────────────────────────────────────

/** 取得升級選項的顯示名稱 */
function getOptionName(option: UpgradeOption): string {
  if (option.type === 'healHp') return '氣血回復';
  if (option.type === 'newWeapon' || option.type === 'upgradeWeapon') {
    return getWeaponById(option.id)?.name ?? option.id;
  }
  return getPassiveById(option.id)?.name ?? option.id;
}

/** 取得等級標示文字 */
function getLevelLabel(option: UpgradeOption): string {
  if (option.type === 'healHp') return '✦ 回復生命';
  if (option.type === 'newWeapon' || option.type === 'newPassive') return '✦ 新裝備';
  return `Lv.${option.currentLevel} → Lv.${option.nextLevel}`;
}

/**
 * 取得「本次提升」標題文字
 */
function getUpgradeTitle(option: UpgradeOption): string {
  switch (option.type) {
    case 'healHp':        return '效果：';
    case 'newWeapon':     return '新武器效果：';
    case 'upgradeWeapon': return '本次提升：';
    case 'newPassive':    return '新被動效果：';
    case 'upgradePassive':return '本次提升：';
  }
}

/**
 * 取得升級詳細描述行（最多 3 條）
 */
function getUpgradeLines(option: UpgradeOption): string[] {
  switch (option.type) {
    case 'healHp':
      return ['恢復 30% 最大生命值'];

    case 'newWeapon':
      return getNewWeaponDescription(option.id);

    case 'upgradeWeapon':
      return getWeaponUpgradeDeltaDescription(option.id, option.currentLevel, option.nextLevel);

    case 'newPassive':
      return getPassiveDeltaLines(option.id, true);

    case 'upgradePassive':
      return getPassiveDeltaLines(option.id, false);
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

/** 取得升級選項的圖示 key（用於升級卡顯示） */
function getOptionIconKey(option: UpgradeOption): string | undefined {
  if (option.type === 'healHp') return undefined;
  if (option.type === 'newWeapon' || option.type === 'upgradeWeapon') {
    return getWeaponById(option.id)?.iconKey;
  }
  return getPassiveById(option.id)?.iconKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// LevelUpPanel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LevelUpPanel — 升級三選一面板
 * 每張卡片顯示：名稱、等級、本次提升內容
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
    const layout = ResponsiveLayout.compute(W, H);
    const s = layout.uiScale;
    const cx = layout.centerX;

    // ── 全螢幕遮罩 ──────────────────────────────────────────────────────────
    const overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, W, H);
    this.container.add(overlay);

    // ── 標題 ────────────────────────────────────────────────────────────────
    const titleY = layout.isPortrait ? Math.round(layout.safeTop + 28) : Math.round(H * 0.17);
    const titleShadow = this.scene.add.text(Math.round(cx) + 2, titleY + 2, '升級！選擇強化',
      uiTitle(Math.round(28 * s), '#7a4a00')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.container.add(titleShadow);

    const title = this.scene.add.text(Math.round(cx), titleY, '升級！選擇強化',
      uiTitle(Math.round(28 * s), '#ffd700')
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.container.add(title);

    const titleLine = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    titleLine.lineStyle(1.5, 0xd4af37, 0.6);
    if (layout.isPortrait) {
      titleLine.lineBetween(W * 0.15, titleY + 18, W * 0.85, titleY + 18);
    } else {
      titleLine.lineBetween(W * 0.35, H * 0.22, W * 0.65, H * 0.22);
    }
    this.container.add(titleLine);

    // ── 選項卡片 ─────────────────────────────────────────────────────────────
    if (layout.isPortrait) {
      // 直屏：垂直排列，每張卡片寬 W*0.85，高 H*0.20
      const cardW = Math.round(Math.min(W * 0.85, W - 24));
      const cardH = Math.round(Math.min(H * 0.20, 160));
      const startY = titleY + 30;
      const cardGap = Math.round((layout.usableH - startY + layout.safeTop - cardH * options.length) / (options.length + 1));
      const safeGap = Math.max(8, cardGap);

      for (let i = 0; i < options.length; i++) {
        const cardY = startY + safeGap + i * (cardH + safeGap) + cardH / 2;
        this.buildCardPortrait(options[i], cx, cardY, cardW, cardH, s);
      }
    } else {
      // 橫屏：水平排列（原有設計）
      const usableW = layout.usableW;
      const cardSpacing = usableW / 3;
      const cardXPositions = [
        layout.usableX + cardSpacing * 0.5,
        layout.usableX + cardSpacing * 1.5,
        layout.usableX + cardSpacing * 2.5,
      ];
      const cardW = Math.min(usableW * 0.28, 200);
      const cardH = Math.min(layout.usableH * 0.62, 320);
      const cardY = layout.usableY + layout.usableH * 0.56;

      for (let i = 0; i < options.length; i++) {
        this.buildCard(options[i], cardXPositions[i], cardY, cardW, cardH, W, H, s);
      }
    }
  }

  /** 直屏卡片（橫向寬卡，垂直排列） */
  private buildCardPortrait(
    option: UpgradeOption,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    s: number
  ): void {
    const cardLeft = cx - cardW / 2;
    const r = 10;
    const typeTag = getTypeTag(option);

    // ── 卡片背景 ────────────────────────────────────────────────────────────
    const cardG = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawCardNormal(cardG, cx, cy, cardW, cardH, r);
    this.container.add(cardG);

    // ── 左側：類型標籤 + 圖示 + 名稱 ────────────────────────────────────
    const iconSize = Math.round(cardH * 0.55);
    const iconX = cardLeft + 16 + iconSize / 2;
    const iconY = cy;

    // 類型標籤（左上角）
    const tagW = 64;
    const tagH = 20;
    const tagG = this.scene.add.graphics().setScrollFactor(0).setDepth(102);
    tagG.fillStyle(typeTag.color, 0.9);
    tagG.fillRoundedRect(cardLeft + 8, cy - cardH / 2 + 6, tagW, tagH, 4);
    this.container.add(tagG);

    const tagText = this.scene.add.text(cardLeft + 8 + tagW / 2, cy - cardH / 2 + 16, typeTag.label,
      uiText(10, '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(103);
    this.container.add(tagText);

    // 圖示
    const iconKey = getOptionIconKey(option);
    if (iconKey && AssetLoader.hasTexture(this.scene, iconKey)) {
      const iconImg = this.scene.add.image(iconX, iconY, iconKey)
        .setDisplaySize(iconSize, iconSize)
        .setScrollFactor(0).setDepth(102);
      this.container.add(iconImg);
    }

    // 名稱（圖示右側）
    const textX = cardLeft + 16 + iconSize + 10;
    const textAreaW = cardW - iconSize - 32;

    const nameText = this.scene.add.text(textX, cy - cardH * 0.18, getOptionName(option),
      uiText(Math.round(16 * s), '#ffffff', { fontStyle: 'bold', wordWrap: { width: textAreaW }, align: 'left' })
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(nameText);

    const levelText = this.scene.add.text(textX, cy + cardH * 0.06, getLevelLabel(option),
      uiText(Math.round(12 * s), '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(levelText);

    // 升級描述（最多 2 行）
    const upgradeLines = getUpgradeLines(option);
    const descText = upgradeLines.slice(0, 2).map(l => `• ${l}`).join('\n');
    const descT = this.scene.add.text(textX, cy + cardH * 0.28, descText,
      uiText(Math.round(11 * s), '#88ffaa', { wordWrap: { width: textAreaW }, align: 'left' })
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(descT);

    // ── 互動熱區 ────────────────────────────────────────────────────────────
    const hitW = Math.max(cardW, 88);
    const hitH = Math.max(cardH, 48);
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

  private buildCard(
    option: UpgradeOption,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    W: number,
    H: number,
    s: number = 1.0
  ): void {
    const cardTop = cy - cardH * 0.5;
    const r = 8;
    const typeTag = getTypeTag(option);

    // ── 卡片背景 ────────────────────────────────────────────────────────────
    const cardG = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawCardNormal(cardG, cx, cy, cardW, cardH, r);
    this.container.add(cardG);

    // ── 類型標籤 ────────────────────────────────────────────────────────────
    const tagW = cardW * 0.55;
    const tagH = 20;
    const tagG = this.scene.add.graphics().setScrollFactor(0).setDepth(102);
    tagG.fillStyle(typeTag.color, 0.9);
    tagG.fillRoundedRect(cx - tagW / 2, cardTop + 8, tagW, tagH, 4);
    this.container.add(tagG);

    const tagText = this.scene.add.text(cx, cardTop + 18, typeTag.label,
      uiText(11, '#ffffff', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(103);
    this.container.add(tagText);

    // ── 圖示（武器/被動 icon，若有的話）────────────────────────────────────
    const iconKey = getOptionIconKey(option);
    const iconSize = 28;
    const iconY = cardTop + cardH * 0.155;
    if (iconKey && AssetLoader.hasTexture(this.scene, iconKey)) {
      const iconImg = this.scene.add.image(cx, iconY, iconKey)
        .setDisplaySize(iconSize, iconSize)
        .setScrollFactor(0).setDepth(102);
      this.container.add(iconImg);
    }

    const nameText = this.scene.add.text(cx, cardTop + cardH * 0.18, getOptionName(option),
      uiText(Math.round(15 * s), '#ffffff', { fontStyle: 'bold', wordWrap: { width: cardW - 16 }, align: 'center' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(nameText);

    const levelText = this.scene.add.text(cx, cardTop + cardH * 0.28, getLevelLabel(option),
      uiText(Math.round(12 * s), '#ffd700', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(levelText);

    // ── 分隔線 ──────────────────────────────────────────────────────────────
    const sepLine = this.scene.add.graphics().setScrollFactor(0).setDepth(102);
    sepLine.lineStyle(1, 0x555577, 0.5);
    sepLine.lineBetween(cx - cardW * 0.38, cardTop + cardH * 0.35, cx + cardW * 0.38, cardTop + cardH * 0.35);
    this.container.add(sepLine);

    // ── 本次提升標題 ────────────────────────────────────────────────────────
    const upgradeTitle = getUpgradeTitle(option);
    const titleY = cardTop + cardH * 0.42;
    const upgradeTitleText = this.scene.add.text(cx, titleY, upgradeTitle,
      uiText(11, '#aaaacc', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.container.add(upgradeTitleText);

    const upgradeLines = getUpgradeLines(option);
    const lineSpacing = cardH * 0.11;
    const firstLineY = cardTop + cardH * 0.52;

    for (let i = 0; i < upgradeLines.length; i++) {
      const lineText = this.scene.add.text(cx, firstLineY + i * lineSpacing, `• ${upgradeLines[i]}`,
        uiText(12, '#88ffaa', { wordWrap: { width: cardW - 16 }, align: 'center' })
      ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
      this.container.add(lineText);
    }

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

/** 向下相容：保留舊的 getOptionDescription export（供外部可能的引用） */
export function getOptionDescription(option: UpgradeOption): string {
  return getUpgradeLines(option).join('\n');
}
