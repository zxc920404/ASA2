import Phaser from 'phaser';
import { CharacterData } from '../types/index';
import { CHARACTERS } from '../data/characters';
import { getWeaponById } from '../data/weapons';
import { uiText, uiTitle } from '../ui/UIStyles';
import { AssetLoader } from '../utils/AssetLoader';
import { ResponsiveLayout } from '../utils/ResponsiveLayout';

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
  private selectedIndex: number = 0; // 預設選中中央（index 0 = swordsman）

  // 宗門選擇輪播狀態（中央顯示哪個）
  private centerIndex: number = 0;

  // 卡片 Graphics / Container
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private cardGlowGraphics: Phaser.GameObjects.Graphics[] = [];
  private floatTweens: Phaser.Tweens.Tween[] = [];

  // 靈氣粒子
  private particles: Phaser.GameObjects.Graphics[] = [];
  private particleTimer: number = 0;

  // 左側資訊面板元素
  private infoPanelGraphics!: Phaser.GameObjects.Graphics;
  private infoSectName!: Phaser.GameObjects.Text;
  private infoRole!: Phaser.GameObjects.Text;
  private infoDesc!: Phaser.GameObjects.Text;
  private infoHpBar!: Phaser.GameObjects.Graphics;
  private infoAtkBar!: Phaser.GameObjects.Graphics;
  private infoSpdBar!: Phaser.GameObjects.Graphics;
  private infoWeapon!: Phaser.GameObjects.Text;
  private infoTrait!: Phaser.GameObjects.Text;
  private infoHpVal!: Phaser.GameObjects.Text;
  private infoAtkVal!: Phaser.GameObjects.Text;
  private infoSpdVal!: Phaser.GameObjects.Text;

  // 確認按鈕
  private confirmGraphics!: Phaser.GameObjects.Graphics;
  private confirmText!: Phaser.GameObjects.Text;
  private confirmHitArea!: Phaser.GameObjects.Rectangle;

  // 卡片佈局快取
  private cardLayout!: { cx: number; cy: number; cardW: number; cardH: number; scale: number }[];

  // 左右切換箭頭
  private arrowLeft!: Phaser.GameObjects.Text;
  private arrowRight!: Phaser.GameObjects.Text;

  // 分頁點
  private dotGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);

    this.selectedIndex = 0;
    this.centerIndex = 0;
    this.cardGraphics = [];
    this.cardContainers = [];
    this.cardGlowGraphics = [];
    this.floatTweens = [];
    this.particles = [];
    this.particleTimer = 0;

    this.drawBackground(W, H);
    this.drawTitle(W, H, layout);
    this.buildInfoPanel(W, H, layout);
    this.buildCardArea(W, H, layout);
    this.buildConfirmButton(W, H, layout);
    this.buildBackButton(W, H, layout);
    this.buildNavArrows(W, H, layout);
    this.buildDots(W, H);

    // 初始化資訊面板顯示
    this.refreshInfoPanel();
    this.refreshCards();
  }

  update(_time: number, delta: number): void {
    this.particleTimer += delta;
    if (this.particleTimer >= 600 && this.particles.length < 18) {
      this.particleTimer = 0;
      this.spawnAuraParticle();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 背景：柔和修仙山水，不壓迫
  // ─────────────────────────────────────────────────────────────────────────
  private drawBackground(W: number, H: number): void {
    // 主背景漸層：深藍青 → 深靛藍（比原版更柔和，不那麼黑暗）
    const bg = this.add.graphics().setDepth(0);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(0x06 + (0x03 - 0x06) * t);
      const g = Math.round(0x10 + (0x08 - 0x10) * t);
      const b = Math.round(0x28 + (0x20 - 0x28) * t);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, Math.round((H / steps) * i), W, Math.round(H / steps) + 1);
    }

    // 右側大面積留白氛圍：柔和青藍光暈（背景氣氛，不搶 UI）
    const rightGlow = this.add.graphics().setDepth(1);
    rightGlow.fillStyle(0x1a4466, 0.12);
    rightGlow.fillCircle(Math.round(W * 0.82), Math.round(H * 0.42), Math.round(H * 0.55));
    rightGlow.fillStyle(0x0d2233, 0.18);
    rightGlow.fillCircle(Math.round(W * 0.82), Math.round(H * 0.42), Math.round(H * 0.35));

    // 月亮（右上，柔和不刺眼）
    const moon = this.add.graphics().setDepth(1);
    const moonX = Math.round(W * 0.84);
    const moonY = Math.round(H * 0.18);
    moon.fillStyle(0xfff8e0, 0.04); moon.fillCircle(moonX, moonY, 80);
    moon.fillStyle(0xfff8e0, 0.08); moon.fillCircle(moonX, moonY, 50);
    moon.fillStyle(0xfff8e0, 0.16); moon.fillCircle(moonX, moonY, 28);
    moon.fillStyle(0xfff8e0, 0.50); moon.fillCircle(moonX, moonY, 13);

    // 遠山剪影（右側，柔和輪廓）
    const mt = this.add.graphics().setDepth(2);
    mt.fillStyle(0x040c18, 0.70);
    mt.fillTriangle(
      Math.round(W * 0.60), H,
      Math.round(W * 0.72), Math.round(H * 0.38),
      Math.round(W * 0.84), H
    );
    mt.fillTriangle(
      Math.round(W * 0.72), H,
      Math.round(W * 0.82), Math.round(H * 0.48),
      Math.round(W * 0.96), H
    );
    mt.fillStyle(0x060e1e, 0.60);
    mt.fillTriangle(
      Math.round(W * 0.68), H,
      Math.round(W * 0.78), Math.round(H * 0.55),
      Math.round(W * 0.90), H
    );

    // 古建築剪影（右側遠景，小而精緻）
    const arch = this.add.graphics().setDepth(2);
    arch.fillStyle(0x030810, 0.80);
    const bx = Math.round(W * 0.88);
    const by = Math.round(H * 0.68);
    arch.fillRect(bx - 4, by - 44, 8, 44);
    arch.fillTriangle(bx - 10, by - 44, bx, by - 60, bx + 10, by - 44);
    arch.fillRect(bx - 34, by - 20, 6, 20);
    arch.fillTriangle(bx - 38, by - 20, bx - 31, by - 30, bx - 24, by - 20);
    arch.fillRect(bx + 28, by - 20, 6, 20);
    arch.fillTriangle(bx + 24, by - 20, bx + 31, by - 30, bx + 38, by - 20);
    arch.fillRect(bx - 50, by - 6, 100, 6);

    // 底部霧氣（柔和，增加空間感）
    const fog = this.add.graphics().setDepth(3);
    fog.fillStyle(0x0a1a3a, 0.18); fog.fillRect(0, Math.round(H * 0.80), W, Math.round(H * 0.20));
    fog.fillStyle(0x0a1a3a, 0.10); fog.fillRect(0, Math.round(H * 0.70), W, Math.round(H * 0.12));

    // 星點（稀疏，右側為主）
    const stars = this.add.graphics().setDepth(2);
    const starPos = [
      [0.62,0.06],[0.70,0.03],[0.76,0.09],[0.82,0.04],[0.90,0.07],
      [0.66,0.14],[0.78,0.11],[0.86,0.15],[0.94,0.10],[0.72,0.20],
      [0.58,0.08],[0.96,0.05],[0.88,0.22],
    ];
    for (const [sx, sy] of starPos) {
      stars.fillStyle(0xffffff, 0.25 + Math.random() * 0.35);
      stars.fillCircle(Math.round(W * sx), Math.round(H * sy), 0.7 + Math.random() * 0.9);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 標題區：主標題 + 副標題 + 裝飾線
  // ─────────────────────────────────────────────────────────────────────────
  private drawTitle(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    // 標題置中偏右（避開左側資訊面板）
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));
    const contentX = layout.usableX + panelW + Math.round((W - layout.usableX - panelW) * 0.5);
    const ty = Math.round(H * 0.10);

    // 副標題（上方小字）
    this.add.text(contentX, ty - Math.round(18 * s), '選擇你的修行之路',
      uiText(Math.round(11 * s), '#7799bb')
    ).setOrigin(0.5, 0.5).setDepth(10);

    // 裝飾線（副標題兩側）
    const lineY = ty - Math.round(18 * s);
    const lineLen = Math.round(60 * s);
    const lineG = this.add.graphics().setDepth(10);
    lineG.lineStyle(1, 0x4477aa, 0.45);
    lineG.lineBetween(contentX - lineLen - 8, lineY, contentX - 8, lineY);
    lineG.lineBetween(contentX + 8, lineY, contentX + lineLen + 8, lineY);
    lineG.fillStyle(0x4477aa, 0.5);
    lineG.fillCircle(contentX - lineLen - 8, lineY, 2);
    lineG.fillCircle(contentX + lineLen + 8, lineY, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 左側資訊面板
  // ─────────────────────────────────────────────────────────────────────────
  private buildInfoPanel(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));
    const panelH = Math.round(H * 0.82);
    const panelX = layout.usableX + Math.round(panelW * 0.5);
    const panelY = Math.round(H * 0.50);
    const px = panelX - Math.round(panelW / 2); // 左上角 x
    const py = panelY - Math.round(panelH / 2); // 左上角 y

    // 面板背景
    this.infoPanelGraphics = this.add.graphics().setDepth(8);
    this.infoPanelGraphics.fillStyle(0x060e1e, 0.82);
    this.infoPanelGraphics.fillRoundedRect(px, py, panelW, panelH, 10);
    this.infoPanelGraphics.lineStyle(1, 0x2a4466, 0.70);
    this.infoPanelGraphics.strokeRoundedRect(px, py, panelW, panelH, 10);
    // 頂部高光線
    this.infoPanelGraphics.lineStyle(1, 0x4488aa, 0.25);
    this.infoPanelGraphics.lineBetween(px + 12, py + 1, px + panelW - 12, py + 1);

    // 「宗門資訊」小標籤
    this.add.text(panelX, py + Math.round(18 * s), '宗門資訊',
      uiText(Math.round(10 * s), '#4488aa')
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 分隔線
    const sepG = this.add.graphics().setDepth(9);
    sepG.lineStyle(1, 0x2a4466, 0.50);
    sepG.lineBetween(px + 12, py + Math.round(30 * s), px + panelW - 12, py + Math.round(30 * s));

    // icon 區（佔頂部空間）
    const iconY = py + Math.round(panelH * 0.16);
    this.buildInfoIcon(panelX, iconY, panelW, s);

    // 宗門名稱
    this.infoSectName = this.add.text(panelX, py + Math.round(panelH * 0.30),
      '', uiTitle(Math.round(18 * s), '#e8d4a0', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 定位
    this.infoRole = this.add.text(panelX, py + Math.round(panelH * 0.38),
      '', uiText(Math.round(10 * s), '#88aabb')
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 描述
    this.infoDesc = this.add.text(panelX, py + Math.round(panelH * 0.46),
      '', uiText(Math.round(9 * s), '#667788', {
        wordWrap: { width: panelW - 20 }, align: 'center'
      })
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 分隔線 2
    const sep2G = this.add.graphics().setDepth(9);
    sep2G.lineStyle(1, 0x1e3044, 0.60);
    sep2G.lineBetween(px + 12, py + Math.round(panelH * 0.52), px + panelW - 12, py + Math.round(panelH * 0.52));

    // 「基礎屬性」小標
    this.add.text(px + 14, py + Math.round(panelH * 0.55),
      '基礎屬性', uiText(Math.round(9 * s), '#4488aa')
    ).setOrigin(0, 0.5).setDepth(9);

    // 屬性列（HP / ATK / SPD）
    const barX = px + 14;
    const barW = panelW - 28;
    const barH = Math.round(5 * s);
    const row1Y = py + Math.round(panelH * 0.61);
    const row2Y = py + Math.round(panelH * 0.68);
    const row3Y = py + Math.round(panelH * 0.75);

    // HP 標籤
    this.add.text(barX, row1Y, '♥ HP', uiText(Math.round(9 * s), '#ff8888')).setOrigin(0, 0.5).setDepth(9);
    this.infoHpVal = this.add.text(px + panelW - 14, row1Y, '', uiText(Math.round(9 * s), '#ff8888')).setOrigin(1, 0.5).setDepth(9);
    this.infoHpBar = this.add.graphics().setDepth(9);

    // ATK 標籤
    this.add.text(barX, row2Y, '⚔ ATK', uiText(Math.round(9 * s), '#ffcc66')).setOrigin(0, 0.5).setDepth(9);
    this.infoAtkVal = this.add.text(px + panelW - 14, row2Y, '', uiText(Math.round(9 * s), '#ffcc66')).setOrigin(1, 0.5).setDepth(9);
    this.infoAtkBar = this.add.graphics().setDepth(9);

    // SPD 標籤
    this.add.text(barX, row3Y, '✦ SPD', uiText(Math.round(9 * s), '#88ddff')).setOrigin(0, 0.5).setDepth(9);
    this.infoSpdVal = this.add.text(px + panelW - 14, row3Y, '', uiText(Math.round(9 * s), '#88ddff')).setOrigin(1, 0.5).setDepth(9);
    this.infoSpdBar = this.add.graphics().setDepth(9);

    // 分隔線 3
    const sep3G = this.add.graphics().setDepth(9);
    sep3G.lineStyle(1, 0x1e3044, 0.60);
    sep3G.lineBetween(px + 12, py + Math.round(panelH * 0.80), px + panelW - 12, py + Math.round(panelH * 0.80));

    // 起始武器
    this.add.text(px + 14, py + Math.round(panelH * 0.83),
      '起始武器', uiText(Math.round(9 * s), '#4488aa')
    ).setOrigin(0, 0.5).setDepth(9);
    this.infoWeapon = this.add.text(panelX, py + Math.round(panelH * 0.88),
      '', uiText(Math.round(10 * s), '#d4af37')
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 宗門特性
    this.add.text(px + 14, py + Math.round(panelH * 0.93),
      '宗門特性', uiText(Math.round(9 * s), '#4488aa')
    ).setOrigin(0, 0.5).setDepth(9);
    this.infoTrait = this.add.text(panelX, py + Math.round(panelH * 0.97),
      '', uiText(Math.round(9 * s), '#aabbcc')
    ).setOrigin(0.5, 0.5).setDepth(9);

    // 儲存 bar 位置供 refresh 使用
    (this as any)._barX = barX;
    (this as any)._barW = barW;
    (this as any)._barH = barH;
    (this as any)._row1Y = row1Y;
    (this as any)._row2Y = row2Y;
    (this as any)._row3Y = row3Y;
    (this as any)._labelOffX = Math.round(30 * s);
  }

  private buildInfoIcon(cx: number, cy: number, panelW: number, s: number): void {
    // icon 光暈底圓（靜態，refresh 時不重建）
    const iconGlow = this.add.graphics().setDepth(9);
    iconGlow.fillStyle(0x2266cc, 0.12);
    iconGlow.fillCircle(cx, cy, Math.round(32 * s));
    iconGlow.fillStyle(0x2266cc, 0.07);
    iconGlow.fillCircle(cx, cy, Math.round(42 * s));
    // 儲存 icon 容器位置供 refreshInfoPanel 使用
    (this as any)._iconCX = cx;
    (this as any)._iconCY = cy;
    (this as any)._iconPanelW = panelW;
    (this as any)._iconS = s;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 刷新左側資訊面板內容
  // ─────────────────────────────────────────────────────────────────────────
  private refreshInfoPanel(): void {
    const char = CHARACTERS[this.centerIndex];
    const sect = SECT_INFO[char.id] ?? {
      sectName: char.id, motto: '', role: '', description: '',
      accent: 0x6688aa, glowColor: 0x334466,
    };
    const weaponData = getWeaponById(char.startingWeaponId);

    this.infoSectName.setText(sect.sectName);
    this.infoRole.setText(sect.role);
    this.infoDesc.setText(sect.description);
    this.infoWeapon.setText(`⚔ ${weaponData?.name ?? '—'}`);
    this.infoTrait.setText(char.trait ?? '');

    // 屬性數值
    this.infoHpVal.setText(`${char.baseHP}`);
    this.infoAtkVal.setText(`×${char.baseAttackPower.toFixed(1)}`);
    this.infoSpdVal.setText(`${char.baseMoveSpeed}`);

    // 屬性條（相對最大值）
    const maxHP = 200; const maxATK = 1.5; const maxSPD = 190;
    const barX: number = (this as any)._barX;
    const barW: number = (this as any)._barW;
    const barH: number = (this as any)._barH;
    const row1Y: number = (this as any)._row1Y;
    const row2Y: number = (this as any)._row2Y;
    const row3Y: number = (this as any)._row3Y;
    const labelOffX: number = (this as any)._labelOffX;
    const fillBarY = Math.round(barH / 2);

    const drawBar = (g: Phaser.GameObjects.Graphics, y: number, ratio: number, color: number) => {
      g.clear();
      const bx = barX + labelOffX;
      const bw = barW - labelOffX - 28;
      // 底色
      g.fillStyle(0x1a2a3a, 0.80);
      g.fillRoundedRect(bx, y - fillBarY, bw, barH, 2);
      // 填充
      g.fillStyle(color, 0.85);
      g.fillRoundedRect(bx, y - fillBarY, Math.round(bw * Math.min(ratio, 1)), barH, 2);
    };

    drawBar(this.infoHpBar,  row1Y, char.baseHP / maxHP,                  0xff6666);
    drawBar(this.infoAtkBar, row2Y, char.baseAttackPower / maxATK,         0xffaa33);
    drawBar(this.infoSpdBar, row3Y, char.baseMoveSpeed / maxSPD,           0x44bbff);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 中央宗門選擇區：中央放大 + 左右縮小
  // ─────────────────────────────────────────────────────────────────────────
  private buildCardArea(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));

    // 卡片區域：左側面板右邊到畫面右側 60% 處
    const cardAreaX = layout.usableX + panelW + Math.round(layout.usableW * 0.04);
    const cardAreaW = Math.round(layout.usableW * 0.56);
    const cardCenterX = cardAreaX + Math.round(cardAreaW * 0.50);
    const cardCenterY = Math.round(H * 0.48);

    // 中央卡尺寸（較大）
    const mainCardW = Math.round(Math.min(cardAreaW * 0.38, 160));
    const mainCardH = Math.round(Math.min(H * 0.62, 360));
    // 側邊卡尺寸（縮小）
    const sideCardW = Math.round(mainCardW * 0.72);
    const sideCardH = Math.round(mainCardH * 0.78);
    const sideOffset = Math.round(mainCardW * 0.88 + sideCardW * 0.50 + 12);

    this.cardLayout = [
      { cx: cardCenterX - sideOffset, cy: cardCenterY, cardW: sideCardW, cardH: sideCardH, scale: 0.72 }, // 左側
      { cx: cardCenterX,              cy: cardCenterY, cardW: mainCardW, cardH: mainCardH, scale: 1.00 }, // 中央
      { cx: cardCenterX + sideOffset, cy: cardCenterY, cardW: sideCardW, cardH: sideCardH, scale: 0.72 }, // 右側
    ];

    CHARACTERS.forEach((char, i) => {
      this.buildCharacterCard(char, i, s);
    });
  }

  private buildCharacterCard(char: CharacterData, index: number, s: number): void {
    const { cx, cy, cardW, cardH } = this.cardLayout[index];
    const sect = SECT_INFO[char.id] ?? {
      sectName: char.id, motto: '', role: '',
      primary: 0x0d1e3a, accent: 0x6688aa, borderColor: 0x6688aa, glowColor: 0x334466, dimColor: 0x0a1428,
    };

    // 光暈（選中時顯示）
    const glowG = this.add.graphics().setDepth(6);
    this.cardGlowGraphics.push(glowG);

    // 卡片背景
    const g = this.add.graphics().setDepth(8);
    this.cardGraphics.push(g);

    // 卡片內容 Container
    const container = this.add.container(0, 0).setDepth(9);
    this.cardContainers.push(container);

    // icon
    const iconY = cy - Math.round(cardH * 0.22);
    this.buildCardIcon(container, cx, iconY, sect, char.id, cardW, s);

    // 宗門名稱（卡片上只顯示名稱 + 定位，資訊移到左側面板）
    const nameText = this.add.text(cx, cy + Math.round(cardH * 0.08),
      sect.sectName,
      uiTitle(Math.round(16 * s), '#e8d4a0', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(nameText);

    const roleText = this.add.text(cx, cy + Math.round(cardH * 0.20),
      sect.role,
      uiText(Math.round(9 * s), '#7799aa', { wordWrap: { width: cardW - 12 }, align: 'center' })
    ).setOrigin(0.5, 0.5).setDepth(9);
    container.add(roleText);

    // 漂浮動畫
    const floatTween = this.tweens.add({
      targets: container,
      y: { from: -4, to: 4 },
      duration: 2400 + index * 350,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    this.floatTweens.push(floatTween);

    // 互動熱區
    const hitArea = this.add.rectangle(cx, cy, Math.max(cardW, 80), Math.max(cardH, 80), 0, 0)
      .setDepth(12).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.navigateTo(index));
    hitArea.on('pointerover', () => {
      if (this.centerIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], index, true);
        container.setAlpha(0.75);
      }
    });
    hitArea.on('pointerout', () => {
      if (this.centerIndex !== index) {
        this.drawCardFrame(this.cardGraphics[index], index, false);
        container.setAlpha(0.38);
      }
    });
  }

  private buildCardIcon(
    container: Phaser.GameObjects.Container,
    cx: number, cy: number,
    sect: { primary: number; accent: number; glowColor: number },
    charId: string,
    cardW: number,
    s: number
  ): void {
    const charData = CHARACTERS.find(c => c.id === charId);

    const iconGlow = this.add.graphics().setDepth(9);
    iconGlow.fillStyle(sect.glowColor, 0.14);
    iconGlow.fillCircle(cx, cy, Math.round(32 * s));
    iconGlow.fillStyle(sect.glowColor, 0.07);
    iconGlow.fillCircle(cx, cy, Math.round(44 * s));
    container.add(iconGlow);

    if (charData?.iconKey && AssetLoader.hasTexture(this, charData.iconKey)) {
      const img = this.add.image(cx, cy, charData.iconKey).setDepth(9);
      const maxSize = Math.round(Math.min(cardW * 0.44, 64));
      img.setDisplaySize(maxSize, maxSize);
      container.add(img);
      return;
    }

    if (charData?.portraitKey && AssetLoader.hasTexture(this, charData.portraitKey)) {
      const img = this.add.image(cx, cy, charData.portraitKey).setDepth(9);
      const maxW = Math.round(cardW * 0.48);
      img.setDisplaySize(maxW, Math.round(maxW * 1.2));
      container.add(img);
      return;
    }

    // Fallback 程式繪製
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(sect.accent, 0.12); g.fillCircle(cx, cy, Math.round(22 * s));
    g.fillStyle(sect.accent, 1);    g.fillCircle(cx, cy - Math.round(13 * s), Math.round(9 * s));
    g.fillStyle(sect.primary, 1);   g.fillRect(cx - Math.round(8 * s), cy - Math.round(3 * s), Math.round(16 * s), Math.round(18 * s));
    if (charId === 'swordsman') {
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx + Math.round(7 * s), cy - Math.round(16 * s), Math.round(3 * s), Math.round(26 * s));
      g.fillRect(cx + Math.round(4 * s), cy - Math.round(5 * s), Math.round(9 * s), Math.round(3 * s));
    } else if (charId === 'assassin') {
      g.fillStyle(0xcc88ff, 1);
      g.fillRect(cx - Math.round(13 * s), cy - Math.round(9 * s), Math.round(3 * s), Math.round(16 * s));
      g.fillRect(cx + Math.round(10 * s), cy - Math.round(9 * s), Math.round(3 * s), Math.round(16 * s));
    } else if (charId === 'taoist') {
      g.fillStyle(0xff8844, 1);
      g.fillRect(cx + Math.round(8 * s), cy - Math.round(20 * s), Math.round(3 * s), Math.round(28 * s));
      g.fillCircle(cx + Math.round(9 * s), cy - Math.round(22 * s), Math.round(5 * s));
    }
    container.add(g);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 卡片邊框繪製（依 index 決定中央/側邊樣式）
  // ─────────────────────────────────────────────────────────────────────────
  private drawCardFrame(g: Phaser.GameObjects.Graphics, index: number, hovered: boolean = false): void {
    g.clear();
    const { cx, cy, cardW, cardH } = this.cardLayout[index];
    const char = CHARACTERS[this.getDisplayIndex(index)];
    const sect = SECT_INFO[char.id] ?? { borderColor: 0x6688aa, glowColor: 0x334466, dimColor: 0x0a1428 };
    const isCenter = index === 1;
    const x = Math.round(cx - cardW / 2);
    const y = Math.round(cy - cardH / 2);
    const r = 10;

    if (isCenter) {
      // 中央卡：深色玉石感，金邊發光
      g.fillStyle(0x081422, 0.94);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      // 頂部高光
      g.fillStyle(0xffffff, 0.04);
      g.fillRoundedRect(x + 2, y + 2, cardW - 4, Math.round(cardH * 0.28), { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
      // 外發光
      g.lineStyle(12, sect.glowColor, 0.14);
      g.strokeRoundedRect(x - 5, y - 5, cardW + 10, cardH + 10, r + 5);
      g.lineStyle(3, sect.borderColor, 0.55);
      g.strokeRoundedRect(x - 1, y - 1, cardW + 2, cardH + 2, r + 1);
      g.lineStyle(1.5, sect.borderColor, 0.90);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
      // 底部裝飾線
      g.lineStyle(1, sect.borderColor, 0.30);
      g.lineBetween(x + 12, y + cardH - 8, x + cardW - 12, y + cardH - 8);
    } else if (hovered) {
      g.fillStyle(0x0a1628, 0.85);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(2, sect.borderColor, 0.45);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      // 側邊卡：暗淡，低對比
      g.fillStyle(sect.dimColor ?? 0x060c18, 0.72);
      g.fillRoundedRect(x, y, cardW, cardH, r);
      g.lineStyle(1, sect.borderColor, 0.18);
      g.strokeRoundedRect(x, y, cardW, cardH, r);
    }
  }

  // 取得 display index 對應的 CHARACTERS index（輪播邏輯）
  private getDisplayIndex(slotIndex: number): number {
    const n = CHARACTERS.length;
    // slotIndex: 0=左, 1=中, 2=右
    // centerIndex 是中央顯示的 CHARACTERS index
    const offset = slotIndex - 1; // -1, 0, +1
    return (this.centerIndex + offset + n) % n;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 刷新所有卡片視覺（切換宗門後呼叫）
  // ─────────────────────────────────────────────────────────────────────────
  private refreshCards(): void {
    CHARACTERS.forEach((_char, slotIndex) => {
      const charIndex = this.getDisplayIndex(slotIndex);
      const char = CHARACTERS[charIndex];
      const sect = SECT_INFO[char.id] ?? { borderColor: 0x6688aa, glowColor: 0x334466 };
      const isCenter = slotIndex === 1;
      const { cx, cy, cardW, cardH } = this.cardLayout[slotIndex];

      // 重繪邊框
      this.drawCardFrame(this.cardGraphics[slotIndex], slotIndex, false);

      // 光暈
      const glowG = this.cardGlowGraphics[slotIndex];
      glowG.clear();
      if (isCenter) {
        const x = Math.round(cx - cardW / 2);
        const y = Math.round(cy - cardH / 2);
        glowG.lineStyle(20, sect.glowColor, 0.10);
        glowG.strokeRoundedRect(x - 8, y - 8, cardW + 16, cardH + 16, 14);
        glowG.lineStyle(8, sect.glowColor, 0.20);
        glowG.strokeRoundedRect(x - 3, y - 3, cardW + 6, cardH + 6, 12);
      }

      // Container alpha + scale
      const container = this.cardContainers[slotIndex];
      if (isCenter) {
        container.setAlpha(1.0);
        this.floatTweens[slotIndex]?.resume();
      } else {
        container.setAlpha(0.35);
        this.floatTweens[slotIndex]?.resume();
      }

      // 更新卡片文字（重建 container 內容太複雜，改用 setData 標記後在 container 子物件更新）
      // 由於 container 子物件是靜態建立的，這裡透過直接更新 Text 物件
      // 找到 container 中的 Text 物件並更新
      container.list.forEach((child) => {
        if (child instanceof Phaser.GameObjects.Text) {
          const sect2 = SECT_INFO[char.id];
          if (!sect2) return;
          // 判斷是名稱還是定位（用字型大小區分）
          const style = child.style as any;
          const fs = parseInt(style.fontSize ?? '0');
          if (fs >= 14) {
            child.setText(sect2.sectName);
          } else {
            child.setText(sect2.role);
          }
        }
      });
    });

    // 更新分頁點
    this.refreshDots();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 導航：切換中央宗門
  // ─────────────────────────────────────────────────────────────────────────
  private navigateTo(slotIndex: number): void {
    if (slotIndex === 1) {
      // 點中央 = 確認選擇
      this.selectedIndex = this.centerIndex;
      this.updateConfirmButton();
      return;
    }
    // 點左右 = 切換
    const offset = slotIndex - 1; // -1 or +1
    const n = CHARACTERS.length;
    this.centerIndex = (this.centerIndex + offset + n) % n;
    this.selectedIndex = this.centerIndex;
    this.refreshCards();
    this.refreshInfoPanel();
    this.updateConfirmButton();
  }

  private navigateLeft(): void {
    const n = CHARACTERS.length;
    this.centerIndex = (this.centerIndex - 1 + n) % n;
    this.selectedIndex = this.centerIndex;
    this.refreshCards();
    this.refreshInfoPanel();
    this.updateConfirmButton();
  }

  private navigateRight(): void {
    const n = CHARACTERS.length;
    this.centerIndex = (this.centerIndex + 1) % n;
    this.selectedIndex = this.centerIndex;
    this.refreshCards();
    this.refreshInfoPanel();
    this.updateConfirmButton();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 左右切換箭頭
  // ─────────────────────────────────────────────────────────────────────────
  private buildNavArrows(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));
    const cardAreaX = layout.usableX + panelW + Math.round(layout.usableW * 0.04);
    const cardAreaW = Math.round(layout.usableW * 0.56);
    const cardCenterX = cardAreaX + Math.round(cardAreaW * 0.50);
    const arrowY = Math.round(H * 0.48);

    // 左箭頭
    const leftG = this.add.graphics().setDepth(13);
    const leftX = cardAreaX + Math.round(cardAreaW * 0.04);
    leftG.fillStyle(0x060e1e, 0.70);
    leftG.fillCircle(leftX, arrowY, Math.round(18 * s));
    leftG.lineStyle(1, 0x4488aa, 0.50);
    leftG.strokeCircle(leftX, arrowY, Math.round(18 * s));

    this.arrowLeft = this.add.text(leftX, arrowY, '‹',
      uiText(Math.round(22 * s), '#88aabb')
    ).setOrigin(0.5, 0.5).setDepth(14);

    const leftHit = this.add.rectangle(leftX, arrowY, Math.round(44 * s), Math.round(44 * s), 0, 0)
      .setDepth(15).setInteractive({ useHandCursor: true });
    leftHit.on('pointerdown', () => this.navigateLeft());
    leftHit.on('pointerover', () => { this.arrowLeft.setColor('#ffd700'); });
    leftHit.on('pointerout',  () => { this.arrowLeft.setColor('#88aabb'); });

    // 右箭頭
    const rightG = this.add.graphics().setDepth(13);
    const rightX = cardAreaX + Math.round(cardAreaW * 0.96);
    rightG.fillStyle(0x060e1e, 0.70);
    rightG.fillCircle(rightX, arrowY, Math.round(18 * s));
    rightG.lineStyle(1, 0x4488aa, 0.50);
    rightG.strokeCircle(rightX, arrowY, Math.round(18 * s));

    this.arrowRight = this.add.text(rightX, arrowY, '›',
      uiText(Math.round(22 * s), '#88aabb')
    ).setOrigin(0.5, 0.5).setDepth(14);

    const rightHit = this.add.rectangle(rightX, arrowY, Math.round(44 * s), Math.round(44 * s), 0, 0)
      .setDepth(15).setInteractive({ useHandCursor: true });
    rightHit.on('pointerdown', () => this.navigateRight());
    rightHit.on('pointerover', () => { this.arrowRight.setColor('#ffd700'); });
    rightHit.on('pointerout',  () => { this.arrowRight.setColor('#88aabb'); });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 分頁點
  // ─────────────────────────────────────────────────────────────────────────
  private buildDots(W: number, H: number): void {
    this.dotGraphics = this.add.graphics().setDepth(13);
    this.refreshDots();
  }

  private refreshDots(): void {
    this.dotGraphics.clear();
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));
    const cardAreaX = layout.usableX + panelW + Math.round(layout.usableW * 0.04);
    const cardAreaW = Math.round(layout.usableW * 0.56);
    const dotY = Math.round(H * 0.82);
    const dotSpacing = 14;
    const n = CHARACTERS.length;
    const startX = cardAreaX + Math.round(cardAreaW * 0.50) - Math.round((n - 1) * dotSpacing * 0.5);

    for (let i = 0; i < n; i++) {
      const dx = startX + i * dotSpacing;
      if (i === this.centerIndex) {
        this.dotGraphics.fillStyle(0xd4af37, 0.90);
        this.dotGraphics.fillCircle(dx, dotY, 4);
      } else {
        this.dotGraphics.fillStyle(0x4477aa, 0.45);
        this.dotGraphics.fillCircle(dx, dotY, 3);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 確認按鈕（踏入修行）
  // ─────────────────────────────────────────────────────────────────────────
  private buildConfirmButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));
    const cardAreaX = layout.usableX + panelW + Math.round(layout.usableW * 0.04);
    const cardAreaW = Math.round(layout.usableW * 0.56);
    const btnX = cardAreaX + Math.round(cardAreaW * 0.50);
    const btnY = Math.round(H * 0.90);
    const btnW = Math.round(Math.min(220, cardAreaW * 0.55));
    const btnH = layout.btnH;

    this.confirmGraphics = this.add.graphics().setDepth(11);
    this.drawConfirmBtn(false, btnX, btnY, btnW, btnH);

    this.confirmText = this.add.text(btnX, btnY, '踏入修行',
      uiText(Math.round(16 * s), '#d4af37', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(12);

    // 副文字
    this.add.text(btnX, btnY + Math.round(btnH * 0.75), '可隨時在遊戲內更換宗門',
      uiText(Math.round(8 * s), '#445566')
    ).setOrigin(0.5, 0.5).setDepth(12);

    this.confirmHitArea = this.add.rectangle(
      btnX, btnY, Math.max(btnW, layout.minTouchTarget), Math.max(btnH, layout.minTouchTarget), 0, 0
    ).setDepth(13).setInteractive({ useHandCursor: true });

    this.confirmHitArea.on('pointerdown', () => {
      const characterId = CHARACTERS[this.centerIndex].id;
      this.scene.start('MapSelectScene', { characterId });
    });
    this.confirmHitArea.on('pointerover', () => this.drawConfirmBtn(true, btnX, btnY, btnW, btnH));
    this.confirmHitArea.on('pointerout',  () => this.drawConfirmBtn(false, btnX, btnY, btnW, btnH));

    // 儲存按鈕位置供 updateConfirmButton 使用
    (this as any)._btnX = btnX;
    (this as any)._btnY = btnY;
    (this as any)._btnW = btnW;
    (this as any)._btnH = btnH;
  }

  private drawConfirmBtn(hovered: boolean, btnX: number, btnY: number, btnW: number, btnH: number): void {
    const r = 8;
    const x = Math.round(btnX - btnW / 2);
    const y = Math.round(btnY - btnH / 2);
    this.confirmGraphics.clear();

    if (hovered) {
      this.confirmGraphics.lineStyle(10, 0xd4af37, 0.15);
      this.confirmGraphics.strokeRoundedRect(x - 4, y - 4, btnW + 8, btnH + 8, r + 4);
    }
    this.confirmGraphics.fillStyle(hovered ? 0x1a1428 : 0x0c0a1a, 0.92);
    this.confirmGraphics.fillRoundedRect(x, y, btnW, btnH, r);
    // 頂部高光
    this.confirmGraphics.fillStyle(0xffffff, 0.04);
    this.confirmGraphics.fillRoundedRect(x + 2, y + 2, btnW - 4, Math.round(btnH * 0.38), { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
    this.confirmGraphics.lineStyle(hovered ? 2 : 1.5, hovered ? 0xffd700 : 0xd4af37, hovered ? 1 : 0.80);
    this.confirmGraphics.strokeRoundedRect(x, y, btnW, btnH, r);
  }

  private updateConfirmButton(): void {
    const btnX: number = (this as any)._btnX;
    const btnY: number = (this as any)._btnY;
    const btnW: number = (this as any)._btnW;
    const btnH: number = (this as any)._btnH;
    if (!btnX) return;
    this.drawConfirmBtn(false, btnX, btnY, btnW, btnH);
    const sect = SECT_INFO[CHARACTERS[this.centerIndex].id];
    this.confirmText.setText('踏入修行');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 返回按鈕
  // ─────────────────────────────────────────────────────────────────────────
  private buildBackButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const btnX = Math.round(layout.safeLeft + 16);
    const btnY = Math.round(layout.safeTop + 20);

    const g = this.add.graphics().setDepth(11);
    g.fillStyle(0x060e1e, 0.72);
    g.fillRoundedRect(btnX - 4, btnY - 13, 68, 26, 6);
    g.lineStyle(1, 0x2a4466, 0.55);
    g.strokeRoundedRect(btnX - 4, btnY - 13, 68, 26, 6);

    const backText = this.add.text(btnX + 28, btnY, '← 返回',
      uiText(Math.round(11 * s), '#6688aa')
    ).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX + 28, btnY, 76, 36, 0, 0)
      .setDepth(13).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x0d1a2e, 0.88);
      g.fillRoundedRect(btnX - 4, btnY - 13, 68, 26, 6);
      g.lineStyle(1.5, 0xd4af37, 0.70);
      g.strokeRoundedRect(btnX - 4, btnY - 13, 68, 26, 6);
      backText.setColor('#ffd700');
    });
    hitArea.on('pointerout', () => {
      g.clear();
      g.fillStyle(0x060e1e, 0.72);
      g.fillRoundedRect(btnX - 4, btnY - 13, 68, 26, 6);
      g.lineStyle(1, 0x2a4466, 0.55);
      g.strokeRoundedRect(btnX - 4, btnY - 13, 68, 26, 6);
      backText.setColor('#6688aa');
    });
    hitArea.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 靈氣粒子（柔和，不搶 UI）
  // ─────────────────────────────────────────────────────────────────────────
  private spawnAuraParticle(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);
    const panelW = Math.round(Math.min(layout.usableW * 0.28, 210));

    // 粒子只在右側氛圍區生成（不干擾左側資訊面板）
    const spawnX = layout.usableX + panelW + Math.random() * (W - layout.usableX - panelW);
    const spawnY = H * 0.6 + Math.random() * H * 0.4;

    const colors = [0x4488cc, 0x66aadd, 0xaaccee, 0xd4af37, 0x88bbcc];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 0.6 + Math.random() * 1.4;
    const duration = 4000 + Math.random() * 3000;

    const p = this.add.graphics().setDepth(4);
    p.fillStyle(color, 0.35 + Math.random() * 0.30);
    p.fillCircle(0, 0, size);
    p.setPosition(spawnX, spawnY);
    this.particles.push(p);

    this.tweens.add({
      targets: p,
      x: spawnX + (Math.random() - 0.5) * 60,
      y: spawnY - (50 + Math.random() * 70),
      alpha: 0,
      duration,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (p?.active) p.destroy();
        const idx = this.particles.indexOf(p);
        if (idx !== -1) this.particles.splice(idx, 1);
      },
    });
  }
}
