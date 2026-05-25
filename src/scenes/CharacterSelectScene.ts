import Phaser from 'phaser';
import { CharacterData } from '../types/index';
import { CHARACTERS } from '../data/characters';
import { getWeaponById } from '../data/weapons';
import { uiText, uiTitle } from '../ui/UIStyles';
import { AssetLoader } from '../utils/AssetLoader';
import { ResponsiveLayout } from '../utils/ResponsiveLayout';
import { BGMManager } from '../systems/BGMManager';
import { SFXManager } from '../systems/SFXManager';

// ── 宗門資料（UI 顯示用）────────────────────────────────────────────────────
const SECT_INFO: Record<string, {
  sectName: string;
  motto: string;
  role: string;
  description: string;
  primary: number;
  accent: number;
  borderColor: number;
  glowColor: number;
  dimColor: number;
}> = {
  swordsman: {
    sectName: '墨守閣',
    motto: '墨心如盾，固若金湯。',
    role: '防禦反擊・生存穩健',
    description: '以守為攻，以靜制動。擅長防禦與反擊，在持久戰中越戰越強。',
    primary: 0x0d1e3a,
    accent:  0x66aaff,
    borderColor: 0x44aaff,
    glowColor: 0x2266cc,
    dimColor: 0x112244,
  },
  assassin: {
    sectName: '驚鴻派',
    motto: '劍走驚鴻，影過留痕。',
    role: '高機動・進擊迅猛',
    description: '身法如風，出手如電。以速度壓制敵人，一擊必殺。',
    primary: 0x1a0d3a,
    accent:  0xcc88ff,
    borderColor: 0xaa66ff,
    glowColor: 0x7733cc,
    dimColor: 0x1a1133,
  },
  taoist: {
    sectName: '歸元宗',
    motto: '烈陽焚天，萬物俱滅。',
    role: '爆發輸出・火焰傷害',
    description: '掌控天地靈火，以術法橫掃千軍。爆發力最強的宗門。',
    primary: 0x3a0d0a,
    accent:  0xff8844,
    borderColor: 0xff6622,
    glowColor: 0xcc3300,
    dimColor: 0x2a1008,
  },
};

export class CharacterSelectScene extends Phaser.Scene {
  private centerIndex: number = 0;

  // 卡片物件
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private cardGlowGraphics: Phaser.GameObjects.Graphics[] = [];
  private floatTweens: Phaser.Tweens.Tween[] = [];
  private cardLayout!: { cx: number; cy: number; cardW: number; cardH: number }[];

  // 靈氣粒子
  private particles: Phaser.GameObjects.Graphics[] = [];
  private particleTimer: number = 0;

  // 下方資訊面板
  private infoSectName!: Phaser.GameObjects.Text;
  private infoRole!: Phaser.GameObjects.Text;
  private infoDesc!: Phaser.GameObjects.Text;
  private infoHpBar!: Phaser.GameObjects.Graphics;
  private infoAtkBar!: Phaser.GameObjects.Graphics;
  private infoSpdBar!: Phaser.GameObjects.Graphics;
  private infoHpVal!: Phaser.GameObjects.Text;
  private infoAtkVal!: Phaser.GameObjects.Text;
  private infoSpdVal!: Phaser.GameObjects.Text;
  private infoWeapon!: Phaser.GameObjects.Text;
  private infoTrait!: Phaser.GameObjects.Text;

  // 確認按鈕
  private confirmGraphics!: Phaser.GameObjects.Graphics;
  private confirmText!: Phaser.GameObjects.Text;

  // 分頁點
  private dotGraphics!: Phaser.GameObjects.Graphics;

  // 箭頭
  private arrowLeft!: Phaser.GameObjects.Text;
  private arrowRight!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  preload(): void {
    // 延遲載入群組 2：宗門圖示、武器/被動圖示、選單 BGM
    // 已載入的資源會被 AssetLoader 自動跳過（不重複載入）
    AssetLoader.preloadMenuAssets(this);

    // 載入失敗靜默處理
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[CharacterSelectScene] 資源載入失敗（已 fallback）: ${file.key} → ${file.url}`);
    });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);

    this.centerIndex = 1; // 預設選中驚鴻派（assassin，index 1）
    this.cardGraphics = [];
    this.cardContainers = [];
    this.cardGlowGraphics = [];
    this.floatTweens = [];
    this.particles = [];
    this.particleTimer = 0;

    this.drawBackground(W, H);
    this.drawTitle(W, H, layout);
    this.buildCardArea(W, H, layout);
    this.buildInfoPanel(W, H, layout);
    this.buildConfirmButton(W, H, layout);
    this.buildBackButton(W, H, layout);
    this.buildNavArrows(W, H, layout);
    this.buildDots(W, H, layout);

    this.refreshInfoPanel();
    this.refreshCards();

    // ── BGM（有專屬 BGM 則播放，否則 fallback 到主選單 BGM）────────────
    BGMManager.play(this, 'bgm_char_select');
  }

  update(_time: number, delta: number): void {
    this.particleTimer += delta;
    if (this.particleTimer >= 700 && this.particles.length < 14) {
      this.particleTimer = 0;
      this.spawnAuraParticle();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 背景
  // ─────────────────────────────────────────────────────────────────────────
  private drawBackground(W: number, H: number): void {
    if (AssetLoader.hasTexture(this, 'ui_bg_char_select')) {
      const bg = this.add.image(W / 2, H / 2, 'ui_bg_char_select').setDepth(0);
      const scaleX = W / bg.width;
      const scaleY = H / bg.height;
      bg.setScale(Math.max(scaleX, scaleY));
      // 半透明遮罩讓 UI 可讀
      const overlay = this.add.graphics().setDepth(1);
      overlay.fillStyle(0x020810, 0.50);
      overlay.fillRect(0, 0, W, H);
      // 底部加深（資訊面板區域）
      const fog = this.add.graphics().setDepth(2);
      fog.fillStyle(0x020810, 0.35);
      fog.fillRect(0, Math.round(H * 0.60), W, Math.round(H * 0.40));
      return;
    }
    // Fallback 程式繪製
    const bg = this.add.graphics().setDepth(0);
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x06 + (0x03 - 0x06) * t);
      const g = Math.round(0x10 + (0x08 - 0x10) * t);
      const b = Math.round(0x28 + (0x20 - 0x28) * t);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, Math.round((H / steps) * i), W, Math.round(H / steps) + 1);
    }
    // 月亮（右上）
    const moon = this.add.graphics().setDepth(1);
    const moonX = Math.round(W * 0.82); const moonY = Math.round(H * 0.10);
    moon.fillStyle(0xfff8e0, 0.05); moon.fillCircle(moonX, moonY, 60);
    moon.fillStyle(0xfff8e0, 0.12); moon.fillCircle(moonX, moonY, 36);
    moon.fillStyle(0xfff8e0, 0.50); moon.fillCircle(moonX, moonY, 14);
    // 星點
    const stars = this.add.graphics().setDepth(1);
    [[0.15,0.05],[0.30,0.03],[0.55,0.06],[0.70,0.04],[0.88,0.18],
     [0.10,0.12],[0.45,0.08],[0.65,0.11],[0.92,0.07]].forEach(([sx,sy]) => {
      stars.fillStyle(0xffffff, 0.3 + Math.random() * 0.4);
      stars.fillCircle(Math.round(W*sx), Math.round(H*sy), 0.8 + Math.random());
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 標題區（直屏：頂部）
  // ─────────────────────────────────────────────────────────────────────────
  private drawTitle(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const cx = W / 2;
    const titleY = layout.safeTop + Math.round(H * 0.055);

    // 副標題
    this.add.text(cx, titleY, '選擇你的修行之路',
      uiText(Math.round(12 * s), '#99bbcc')
    ).setOrigin(0.5, 0.5).setDepth(10);

    // 裝飾線
    const lineLen = Math.round(55 * s);
    const lineG = this.add.graphics().setDepth(10);
    lineG.lineStyle(1, 0x5588aa, 0.50);
    lineG.lineBetween(cx - lineLen - 8, titleY, cx - 8, titleY);
    lineG.lineBetween(cx + 8, titleY, cx + lineLen + 8, titleY);
    lineG.fillStyle(0x5588aa, 0.60);
    lineG.fillCircle(cx - lineLen - 8, titleY, 2);
    lineG.fillCircle(cx + lineLen + 8, titleY, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 中央輪播卡片區（直屏：中央偏上）
  // ─────────────────────────────────────────────────────────────────────────
  private buildCardArea(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    // 卡片區垂直中心：畫面上方 36%
    const cardCenterY = Math.round(H * 0.34);
    const cardCenterX = W / 2;

    // 主卡尺寸（直屏：寬度佔畫面 46%，高度略縮）
    const mainCardW = Math.round(Math.min(W * 0.46, 200));
    const mainCardH = Math.round(Math.min(H * 0.30, 250));
    // 側邊卡縮小
    const sideCardW = Math.round(mainCardW * 0.65);
    const sideCardH = Math.round(mainCardH * 0.74);
    // sideOffset 縮小，讓側卡不被裁切
    const sideOffset = Math.round(mainCardW * 0.55 + sideCardW * 0.50 + 6);

    this.cardLayout = [
      { cx: cardCenterX - sideOffset, cy: cardCenterY, cardW: sideCardW, cardH: sideCardH },
      { cx: cardCenterX,              cy: cardCenterY, cardW: mainCardW, cardH: mainCardH },
      { cx: cardCenterX + sideOffset, cy: cardCenterY, cardW: sideCardW, cardH: sideCardH },
    ];

    // 固定建立 3 個槽位（左、中、右），與 CHARACTERS 陣列長度無關
    for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
      this.buildCharacterCard(slotIndex, s);
    }
  }

  private buildCharacterCard(slotIndex: number, s: number): void {
    const { cx, cy, cardW, cardH } = this.cardLayout[slotIndex];

    const glowG = this.add.graphics().setDepth(6);
    this.cardGlowGraphics.push(glowG);

    const g = this.add.graphics().setDepth(8);
    this.cardGraphics.push(g);

    const container = this.add.container(0, 0).setDepth(9);
    container.setData('slotIndex', slotIndex);
    container.setData('s', s);
    this.cardContainers.push(container);

    this.fillCardContainer(container, slotIndex, s);

    const floatTween = this.tweens.add({
      targets: container,
      y: { from: -4, to: 4 },
      duration: 2400 + slotIndex * 350,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    this.floatTweens.push(floatTween);

    const hitArea = this.add.rectangle(cx, cy, Math.max(cardW, 60), Math.max(cardH, 60), 0, 0)
      .setDepth(12).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.navigateTo(slotIndex);
    });
    hitArea.on('pointerover', () => {
      if (slotIndex !== 1) {
        this.drawCardFrame(this.cardGraphics[slotIndex], slotIndex, true);
        container.setAlpha(0.75);
      }
    });
    hitArea.on('pointerout', () => {
      if (slotIndex !== 1) {
        this.drawCardFrame(this.cardGraphics[slotIndex], slotIndex, false);
        container.setAlpha(0.35);
      }
    });
  }

  private fillCardContainer(container: Phaser.GameObjects.Container, slotIndex: number, s: number): void {
    container.removeAll(true);
    const charIndex = this.getDisplayIndex(slotIndex);
    const char = CHARACTERS[charIndex];
    const sect = SECT_INFO[char.id] ?? {
      sectName: char.id, role: '',
      primary: 0x0d1e3a, accent: 0x6688aa, borderColor: 0x6688aa, glowColor: 0x334466,
    };
    console.log(`[CardDebug] slotIndex=${slotIndex} char.id=${char.id} sect.sectName=${sect.sectName} char.iconKey=${char.iconKey}`);
    const { cx, cy, cardW, cardH } = this.cardLayout[slotIndex];
    const isCenter = slotIndex === 1;

    // icon
    const iconY = cy - Math.round(cardH * 0.20);
    const iconGlow = this.add.graphics().setDepth(9);
    iconGlow.fillStyle(sect.glowColor, 0.18);
    iconGlow.fillCircle(cx, iconY, Math.round((isCenter ? 36 : 26) * s));
    iconGlow.fillStyle(sect.glowColor, 0.08);
    iconGlow.fillCircle(cx, iconY, Math.round((isCenter ? 50 : 36) * s));
    container.add(iconGlow);

    if (char.iconKey && AssetLoader.hasTexture(this, char.iconKey)) {
      const img = this.add.image(cx, iconY, char.iconKey).setDepth(9);
      const maxSize = Math.round(Math.min(cardW * 0.46, isCenter ? 72 : 52));
      img.setDisplaySize(maxSize, maxSize);
      container.add(img);
    } else {
      // Fallback 程式繪製
      const g = this.add.graphics().setDepth(9);
      const r = isCenter ? s : s * 0.75;
      g.fillStyle(sect.accent, 0.15); g.fillCircle(cx, iconY, Math.round(22 * r));
      g.fillStyle(sect.accent, 1);    g.fillCircle(cx, iconY - Math.round(13 * r), Math.round(9 * r));
      g.fillStyle(sect.primary, 1);   g.fillRect(cx - Math.round(8 * r), iconY - Math.round(3 * r), Math.round(16 * r), Math.round(18 * r));
      if (char.id === 'swordsman') {
        g.fillStyle(0xffd700, 1);
        g.fillRect(cx + Math.round(7 * r), iconY - Math.round(16 * r), Math.round(3 * r), Math.round(26 * r));
        g.fillRect(cx + Math.round(4 * r), iconY - Math.round(5 * r), Math.round(9 * r), Math.round(3 * r));
      } else if (char.id === 'assassin') {
        g.fillStyle(0xcc88ff, 1);
        g.fillRect(cx - Math.round(13 * r), iconY - Math.round(9 * r), Math.round(3 * r), Math.round(16 * r));
        g.fillRect(cx + Math.round(10 * r), iconY - Math.round(9 * r), Math.round(3 * r), Math.round(16 * r));
      } else if (char.id === 'taoist') {
        g.fillStyle(0xff8844, 1);
        g.fillRect(cx + Math.round(8 * r), iconY - Math.round(20 * r), Math.round(3 * r), Math.round(28 * r));
        g.fillCircle(cx + Math.round(9 * r), iconY - Math.round(22 * r), Math.round(5 * r));
      }
      container.add(g);
    }

    // 宗門名稱
    const nameSize = isCenter ? Math.round(20 * s) : Math.round(13 * s);
    const nameText = this.add.text(cx, cy + Math.round(cardH * 0.10),
      sect.sectName,
      uiTitle(nameSize, isCenter ? '#f0dfa8' : '#b8a878', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(nameText);

    // 定位（只有中央卡顯示）
    if (isCenter) {
      const roleText = this.add.text(cx, cy + Math.round(cardH * 0.26),
        sect.role,
        uiText(Math.round(11 * s), '#99bbcc', { wordWrap: { width: cardW - 16 }, align: 'center' })
      ).setOrigin(0.5, 0.5).setDepth(9);
      container.add(roleText);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 卡片邊框
  // ─────────────────────────────────────────────────────────────────────────
  private drawCardFrame(g: Phaser.GameObjects.Graphics, slotIndex: number, hovered: boolean = false): void {
    g.clear();
    const { cx, cy, cardW, cardH } = this.cardLayout[slotIndex];
    const char = CHARACTERS[this.getDisplayIndex(slotIndex)];
    const sect = SECT_INFO[char.id] ?? { borderColor: 0x6688aa, glowColor: 0x334466, dimColor: 0x0a1428 };
    const isCenter = slotIndex === 1;
    const x = Math.round(cx - cardW / 2);
    const y = Math.round(cy - cardH / 2);
    const r = 10;

    if (isCenter) {
      g.fillStyle(0x081422, 0.94);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.fillStyle(0xffffff, 0.04);
      g.fillRoundedRect(x + 2, y + 2, cardW - 4, Math.round(cardH * 0.28), { tl: r-1, tr: r-1, bl: 0, br: 0 });
      g.lineStyle(14, sect.glowColor, 0.12);
      g.strokeRoundedRect(x - 6, y - 6, cardW + 12, cardH + 12, r + 6);
      g.lineStyle(3, sect.borderColor, 0.55);
      g.strokeRoundedRect(x - 1, y - 1, cardW + 2, cardH + 2, r + 1);
      g.lineStyle(1.5, sect.borderColor, 0.90);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(1, sect.borderColor, 0.28);
      g.lineBetween(x + 12, y + cardH - 8, x + cardW - 12, y + cardH - 8);
    } else if (hovered) {
      g.fillStyle(0x0a1628, 0.85);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(2, sect.borderColor, 0.45);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      g.fillStyle(sect.dimColor ?? 0x060c18, 0.68);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(1, sect.borderColor, 0.16);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    }
  }

  private getDisplayIndex(slotIndex: number): number {
    const n = CHARACTERS.length;
    return (this.centerIndex + (slotIndex - 1) + n) % n;
  }

  private refreshCards(): void {
    // 固定刷新 3 個槽位（左、中、右）
    for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
      const charIndex = this.getDisplayIndex(slotIndex);
      const char = CHARACTERS[charIndex];
      const sect = SECT_INFO[char.id] ?? { borderColor: 0x6688aa, glowColor: 0x334466 };
      const isCenter = slotIndex === 1;
      const { cx, cy, cardW, cardH } = this.cardLayout[slotIndex];
      const s: number = this.cardContainers[slotIndex].getData('s') ?? 1;

      this.drawCardFrame(this.cardGraphics[slotIndex], slotIndex, false);

      const glowG = this.cardGlowGraphics[slotIndex];
      glowG.clear();
      if (isCenter) {
        const x = Math.round(cx - cardW / 2);
        const y = Math.round(cy - cardH / 2);
        glowG.lineStyle(22, sect.glowColor, 0.09);
        glowG.strokeRoundedRect(x - 9, y - 9, cardW + 18, cardH + 18, 14);
        glowG.lineStyle(8, sect.glowColor, 0.18);
        glowG.strokeRoundedRect(x - 3, y - 3, cardW + 6, cardH + 6, 12);
      }

      this.fillCardContainer(this.cardContainers[slotIndex], slotIndex, s);
      this.cardContainers[slotIndex].setAlpha(isCenter ? 1.0 : 0.35);
      this.floatTweens[slotIndex]?.resume();
    }
    this.refreshDots();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 導航
  // ─────────────────────────────────────────────────────────────────────────
  private navigateTo(slotIndex: number): void {
    if (slotIndex === 1) return; // 點中央不切換
    const offset = slotIndex - 1;
    const n = CHARACTERS.length;
    this.centerIndex = (this.centerIndex + offset + n) % n;
    console.log('[CharacterSelectScene] navigateTo slot', slotIndex, '→ centerIndex:', this.centerIndex, '| id:', CHARACTERS[this.centerIndex].id);
    this.refreshCards();
    this.refreshInfoPanel();
  }

  private navigateLeft(): void {
    this.centerIndex = (this.centerIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
    console.log('[CharacterSelectScene] navigateLeft → centerIndex:', this.centerIndex, '| id:', CHARACTERS[this.centerIndex].id);
    this.refreshCards();
    this.refreshInfoPanel();
  }

  private navigateRight(): void {
    this.centerIndex = (this.centerIndex + 1) % CHARACTERS.length;
    console.log('[CharacterSelectScene] navigateRight → centerIndex:', this.centerIndex, '| id:', CHARACTERS[this.centerIndex].id);
    this.refreshCards();
    this.refreshInfoPanel();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 下方資訊面板（直屏：卡片下方）
  // ─────────────────────────────────────────────────────────────────────────
  private buildInfoPanel(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const panelTop = Math.round(H * 0.60);
    const panelH = Math.round(H * 0.22);
    const panelX = layout.usableX + 8;
    const panelW = layout.usableW - 16;
    const cx = W / 2;

    // 面板背景
    const panelG = this.add.graphics().setDepth(8);
    panelG.fillStyle(0x060e1e, 0.80);
    panelG.fillRoundedRect(panelX, panelTop, panelW, panelH, 10);
    panelG.lineStyle(1, 0x2a4466, 0.65);
    panelG.strokeRoundedRect(panelX, panelTop, panelW, panelH, 10);
    panelG.lineStyle(1, 0x4488aa, 0.20);
    panelG.lineBetween(panelX + 14, panelTop + 1, panelX + panelW - 14, panelTop + 1);

    // 宗門名稱（面板頂部）
    this.infoSectName = this.add.text(cx, panelTop + Math.round(panelH * 0.12),
      '', uiTitle(Math.round(20 * s), '#f0dfa8', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 定位
    this.infoRole = this.add.text(cx, panelTop + Math.round(panelH * 0.24),
      '', uiText(Math.round(12 * s), '#99ccdd')
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 描述
    this.infoDesc = this.add.text(cx, panelTop + Math.round(panelH * 0.38),
      '', uiText(Math.round(10 * s), '#8899aa', {
        wordWrap: { width: panelW - 24 }, align: 'center'
      })
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 分隔線
    const sepG = this.add.graphics().setDepth(9);
    sepG.lineStyle(1, 0x1e3044, 0.55);
    sepG.lineBetween(panelX + 14, panelTop + Math.round(panelH * 0.50), panelX + panelW - 14, panelTop + Math.round(panelH * 0.50));

    // 屬性列（水平排列，直屏空間有限）
    const attrY = panelTop + Math.round(panelH * 0.62);
    const col1X = panelX + Math.round(panelW * 0.16);
    const col2X = panelX + Math.round(panelW * 0.50);
    const col3X = panelX + Math.round(panelW * 0.84);

    this.add.text(col1X, attrY, '♥ HP', uiText(Math.round(10 * s), '#ff9999')).setOrigin(0.5, 0.5).setDepth(9);
    this.add.text(col2X, attrY, '⚔ ATK', uiText(Math.round(10 * s), '#ffcc66')).setOrigin(0.5, 0.5).setDepth(9);
    this.add.text(col3X, attrY, '✦ SPD', uiText(Math.round(10 * s), '#88ddff')).setOrigin(0.5, 0.5).setDepth(9);

    const valY = panelTop + Math.round(panelH * 0.74);
    this.infoHpVal  = this.add.text(col1X, valY, '', uiText(Math.round(13 * s), '#ff9999', { fontStyle: 'bold' })).setOrigin(0.5, 0.5).setDepth(9);
    this.infoAtkVal = this.add.text(col2X, valY, '', uiText(Math.round(13 * s), '#ffcc66', { fontStyle: 'bold' })).setOrigin(0.5, 0.5).setDepth(9);
    this.infoSpdVal = this.add.text(col3X, valY, '', uiText(Math.round(13 * s), '#88ddff', { fontStyle: 'bold' })).setOrigin(0.5, 0.5).setDepth(9);

    // 屬性條（細條，水平）
    const barY = panelTop + Math.round(panelH * 0.84);
    const barW = Math.round(panelW * 0.22);
    const barH = Math.round(5 * s);
    this.infoHpBar  = this.add.graphics().setDepth(9);
    this.infoAtkBar = this.add.graphics().setDepth(9);
    this.infoSpdBar = this.add.graphics().setDepth(9);

    // 武器 + 特性（底部一行）
    const bottomY = panelTop + Math.round(panelH * 0.93);
    this.infoWeapon = this.add.text(panelX + Math.round(panelW * 0.25), bottomY,
      '', uiText(Math.round(11 * s), '#e8c060')
    ).setOrigin(0.5, 0.5).setDepth(9);
    this.infoTrait = this.add.text(panelX + Math.round(panelW * 0.75), bottomY,
      '', uiText(Math.round(11 * s), '#bbccdd')
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 儲存 bar 位置
    (this as any)._barY = barY;
    (this as any)._barH = barH;
    (this as any)._barW = barW;
    (this as any)._col1X = col1X;
    (this as any)._col2X = col2X;
    (this as any)._col3X = col3X;
  }

  private refreshInfoPanel(): void {
    const char = CHARACTERS[this.centerIndex];
    const sect = SECT_INFO[char.id] ?? { sectName: char.id, role: '', description: '' };
    const weaponData = getWeaponById(char.startingWeaponId);

    this.infoSectName.setText(sect.sectName);
    this.infoRole.setText(sect.role);
    this.infoDesc.setText(sect.description);
    this.infoHpVal.setText(`${char.baseHP}`);
    this.infoAtkVal.setText(`×${char.baseAttackPower.toFixed(1)}`);
    this.infoSpdVal.setText(`${char.baseMoveSpeed}`);
    this.infoWeapon.setText(`⚔ ${weaponData?.name ?? '—'}`);
    this.infoTrait.setText(char.trait ?? '');

    const maxHP = 200; const maxATK = 1.5; const maxSPD = 190;
    const barY: number = (this as any)._barY;
    const barH: number = (this as any)._barH;
    const barW: number = (this as any)._barW;
    const col1X: number = (this as any)._col1X;
    const col2X: number = (this as any)._col2X;
    const col3X: number = (this as any)._col3X;
    const fh = Math.round(barH / 2);

    const drawBar = (g: Phaser.GameObjects.Graphics, cx: number, ratio: number, color: number) => {
      g.clear();
      const bx = cx - Math.round(barW / 2);
      g.fillStyle(0x1a2a3a, 0.80);
      g.fillRoundedRect(bx, barY - fh, barW, barH, 2);
      g.fillStyle(color, 0.88);
      g.fillRoundedRect(bx, barY - fh, Math.round(barW * Math.min(ratio, 1)), barH, 2);
    };
    drawBar(this.infoHpBar,  col1X, char.baseHP / maxHP,              0xff6666);
    drawBar(this.infoAtkBar, col2X, char.baseAttackPower / maxATK,    0xffaa33);
    drawBar(this.infoSpdBar, col3X, char.baseMoveSpeed / maxSPD,      0x44bbff);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 確認按鈕（直屏：底部居中，寬按鈕）
  // ─────────────────────────────────────────────────────────────────────────
  private buildConfirmButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const btnW = Math.round(Math.min(W * 0.72, 320));
    const btnH = layout.btnH;
    const btnX = W / 2;
    const btnY = H - layout.safeBottom - Math.round(btnH * 1.4);
    const r = 10;
    const x = Math.round(btnX - btnW / 2);
    const y = Math.round(btnY - btnH / 2);

    this.confirmGraphics = this.add.graphics().setDepth(11);
    this.drawConfirmBtn(false, btnX, btnY, btnW, btnH);

    this.confirmText = this.add.text(btnX, btnY, '踏入修行',
      uiText(Math.round(18 * s), '#e8c060', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, layout.minTouchTarget), Math.max(btnH, layout.minTouchTarget), 0, 0)
      .setDepth(13).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      // 中央卡片永遠是 slot 1，用 getDisplayIndex(1) 取得與畫面顯示完全一致的角色
      const centerCharIndex = this.getDisplayIndex(1);
      const selectedChar = CHARACTERS[centerCharIndex];
      const characterId = selectedChar.id;
      const sectInfo = SECT_INFO[characterId];
      console.log(
        '[CharacterSelectScene] 踏入修行',
        '| centerIndex:', this.centerIndex,
        '| centerCharIndex:', centerCharIndex,
        '| selectedChar.id:', selectedChar.id,
        '| sectName:', sectInfo?.sectName ?? selectedChar.name,
        '| 傳入 MapSelectScene characterId:', characterId
      );
      this.scene.start('MapSelectScene', { characterId });
    });
    hitArea.on('pointerover', () => this.drawConfirmBtn(true, btnX, btnY, btnW, btnH));
    hitArea.on('pointerout',  () => this.drawConfirmBtn(false, btnX, btnY, btnW, btnH));
  }

  private drawConfirmBtn(hovered: boolean, btnX: number, btnY: number, btnW: number, btnH: number): void {
    const r = 10;
    const x = Math.round(btnX - btnW / 2);
    const y = Math.round(btnY - btnH / 2);
    this.confirmGraphics.clear();
    if (hovered) {
      this.confirmGraphics.lineStyle(12, 0xd4af37, 0.14);
      this.confirmGraphics.strokeRoundedRect(x - 5, y - 5, btnW + 10, btnH + 10, r + 5);
    }
    this.confirmGraphics.fillStyle(hovered ? 0x1a1428 : 0x0c0a1a, 0.94);
    this.confirmGraphics.fillRoundedRect(x, y, btnW, btnH, r);
    this.confirmGraphics.fillStyle(0xffffff, 0.04);
    this.confirmGraphics.fillRoundedRect(x + 2, y + 2, btnW - 4, Math.round(btnH * 0.38), { tl: r-1, tr: r-1, bl: 0, br: 0 });
    this.confirmGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, hovered ? 1 : 0.82);
    this.confirmGraphics.strokeRoundedRect(x, y, btnW, btnH, r);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 返回按鈕（左上角）
  // ─────────────────────────────────────────────────────────────────────────
  private buildBackButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const btnX = layout.safeLeft + 16;
    const btnY = layout.safeTop + 22;

    const g = this.add.graphics().setDepth(11);
    g.fillStyle(0x060e1e, 0.72);
    g.fillRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
    g.lineStyle(1, 0x2a4466, 0.55);
    g.strokeRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);

    const backText = this.add.text(btnX + 30, btnY, '← 返回',
      uiText(Math.round(13 * s), '#88aacc')
    ).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX + 30, btnY, 80, 40, 0, 0)
      .setDepth(13).setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x0d1a2e, 0.88);
      g.fillRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      g.lineStyle(1.5, 0xd4af37, 0.70);
      g.strokeRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      backText.setColor('#ffd700');
    });
    hitArea.on('pointerout', () => {
      g.clear();
      g.fillStyle(0x060e1e, 0.72);
      g.fillRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      g.lineStyle(1, 0x2a4466, 0.55);
      g.strokeRoundedRect(btnX - 4, btnY - 14, 72, 28, 6);
      backText.setColor('#88aacc');
    });
    hitArea.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.scene.start('MainMenuScene');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 左右箭頭（卡片兩側）
  // ─────────────────────────────────────────────────────────────────────────
  private buildNavArrows(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const arrowY = Math.round(H * 0.36);
    const arrowRadius = Math.round(18 * s);
    const leftX  = Math.max(arrowRadius + 4, Math.round(W * 0.06));
    const rightX = Math.min(W - arrowRadius - 4, Math.round(W * 0.94));

    const drawCircle = (g: Phaser.GameObjects.Graphics, x: number) => {
      g.fillStyle(0x060e1e, 0.68);
      g.fillCircle(x, arrowY, Math.round(18 * s));
      g.lineStyle(1, 0x4488aa, 0.45);
      g.strokeCircle(x, arrowY, Math.round(18 * s));
    };

    const leftG = this.add.graphics().setDepth(13);
    drawCircle(leftG, leftX);
    this.arrowLeft = this.add.text(leftX, arrowY, '‹',
      uiText(Math.round(28 * s), '#99bbcc')
    ).setOrigin(0.5, 0.5).setDepth(14);

    const leftHit = this.add.rectangle(leftX, arrowY, Math.round(48 * s), Math.round(48 * s), 0, 0)
      .setDepth(15).setInteractive({ useHandCursor: true });
    leftHit.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.navigateLeft();
    });
    leftHit.on('pointerover', () => this.arrowLeft.setColor('#ffd700'));
    leftHit.on('pointerout',  () => this.arrowLeft.setColor('#99bbcc'));

    const rightG = this.add.graphics().setDepth(13);
    drawCircle(rightG, rightX);
    this.arrowRight = this.add.text(rightX, arrowY, '›',
      uiText(Math.round(28 * s), '#99bbcc')
    ).setOrigin(0.5, 0.5).setDepth(14);

    const rightHit = this.add.rectangle(rightX, arrowY, Math.round(48 * s), Math.round(48 * s), 0, 0)
      .setDepth(15).setInteractive({ useHandCursor: true });
    rightHit.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.navigateRight();
    });
    rightHit.on('pointerover', () => this.arrowRight.setColor('#ffd700'));
    rightHit.on('pointerout',  () => this.arrowRight.setColor('#99bbcc'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 分頁點
  // ─────────────────────────────────────────────────────────────────────────
  private buildDots(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    this.dotGraphics = this.add.graphics().setDepth(13);
    this.refreshDots();
  }

  private refreshDots(): void {
    this.dotGraphics.clear();
    const W = this.scale.width;
    const H = this.scale.height;
    const dotY = Math.round(H * 0.55);
    const dotSpacing = 16;
    const n = CHARACTERS.length;
    const startX = W / 2 - Math.round((n - 1) * dotSpacing * 0.5);
    for (let i = 0; i < n; i++) {
      const dx = startX + i * dotSpacing;
      if (i === this.centerIndex) {
        this.dotGraphics.fillStyle(0xd4af37, 0.90);
        this.dotGraphics.fillCircle(dx, dotY, 4.5);
      } else {
        this.dotGraphics.fillStyle(0x4477aa, 0.45);
        this.dotGraphics.fillCircle(dx, dotY, 3);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 靈氣粒子
  // ─────────────────────────────────────────────────────────────────────────
  private spawnAuraParticle(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const spawnX = Math.random() * W;
    const spawnY = H * 0.55 + Math.random() * H * 0.45;
    const colors = [0x4488cc, 0x66aadd, 0xaaccee, 0xd4af37];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 0.6 + Math.random() * 1.4;
    const p = this.add.graphics().setDepth(4);
    p.fillStyle(color, 0.30 + Math.random() * 0.25);
    p.fillCircle(0, 0, size);
    p.setPosition(spawnX, spawnY);
    this.particles.push(p);
    this.tweens.add({
      targets: p,
      x: spawnX + (Math.random() - 0.5) * 50,
      y: spawnY - (40 + Math.random() * 60),
      alpha: 0,
      duration: 4000 + Math.random() * 3000,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (p?.active) p.destroy();
        const idx = this.particles.indexOf(p);
        if (idx !== -1) this.particles.splice(idx, 1);
      },
    });
  }
}
