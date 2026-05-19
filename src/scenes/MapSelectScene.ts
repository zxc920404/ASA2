import Phaser from 'phaser';
import { uiText, uiTitle } from '../ui/UIStyles';

// ── 地圖資料定義 ──────────────────────────────────────────────────────────
interface MapData {
  id: string;
  name: string;
  description: string;
  available: boolean;
}

const MAPS: MapData[] = [
  {
    id: 'qingyuan',
    name: '青原試煉場',
    description: '靈氣初聚之地，\n適合宗門弟子試煉。',
    available: true,
  },
  {
    id: 'youzhu',
    name: '幽竹秘境',
    description: '待更新',
    available: false,
  },
  {
    id: 'chisha',
    name: '赤砂古道',
    description: '待更新',
    available: false,
  },
];

interface MapSelectSceneData {
  characterId: string;
}

export class MapSelectScene extends Phaser.Scene {
  private characterId: string = '';

  constructor() {
    super({ key: 'MapSelectScene' });
  }

  init(data: MapSelectSceneData): void {
    this.characterId = data?.characterId ?? '';
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── 背景（與宗門選擇畫面一致）────────────────────────────────────────
    this.drawBackground(W, H);

    // ── 標題 ──────────────────────────────────────────────────────────────
    this.drawTitle(W, H);

    // ── 地圖卡片 ──────────────────────────────────────────────────────────
    const cardCount = MAPS.length;
    const cardW = Math.round(Math.min(W * 0.22, 180));
    const cardH = Math.round(H * 0.52);
    const cardCenterY = Math.round(H * 0.50);

    // 三張卡片均勻分布
    const cardXPositions = [
      Math.round(W * 0.22),
      Math.round(W * 0.50),
      Math.round(W * 0.78),
    ];

    MAPS.forEach((map, i) => {
      this.buildMapCard(map, cardXPositions[i], cardCenterY, cardW, cardH);
    });

    // ── 返回按鈕 ──────────────────────────────────────────────────────────
    this.buildBackButton(W, H);
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
      bg.fillRect(0, Math.round((H / steps) * i), W, Math.round(H / steps) + 1);
    }
    const mountains = this.add.graphics().setDepth(1);
    mountains.fillStyle(0x0a1a0a, 0.5);
    mountains.fillTriangle(0, H, Math.round(W * 0.12), Math.round(H * 0.60), Math.round(W * 0.25), H);
    mountains.fillTriangle(Math.round(W * 0.75), H, Math.round(W * 0.88), Math.round(H * 0.55), W, H);
  }

  private drawTitle(W: number, H: number): void {
    const tx = Math.round(W * 0.5);
    const ty = Math.round(H * 0.09);
    // 陰影層
    this.add.text(tx + 2, ty + 2, '選擇地圖',
      uiText(34, '#7a4a00', { fontStyle: 'bold', resolution: 2 })
    ).setOrigin(0.5, 0.5).setDepth(10);
    // 主文字
    this.add.text(tx, ty, '選擇地圖',
      uiText(34, '#ffd700', { fontStyle: 'bold', resolution: 2 })
    ).setOrigin(0.5, 0.5).setDepth(11);

    const line = this.add.graphics().setDepth(11);
    line.lineStyle(1.5, 0xd4af37, 0.7);
    line.lineBetween(
      Math.round(W * 0.38), Math.round(H * 0.145),
      Math.round(W * 0.62), Math.round(H * 0.145)
    );
  }

  private buildMapCard(
    map: MapData,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number
  ): void {
    const cardTop = cy - Math.round(cardH / 2);
    const r = 8;
    const x = Math.round(cx - cardW / 2);
    const y = Math.round(cy - cardH / 2);

    // ── 卡片背景 ──────────────────────────────────────────────────────────
    const cardG = this.add.graphics().setDepth(8);
    if (map.available) {
      cardG.fillStyle(0x0f0f1e, 0.90);
      cardG.fillRoundedRect(x, y, cardW, cardH, r);
      cardG.lineStyle(1.5, 0x44aaff, 0.55);
      cardG.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      // 鎖定地圖：更暗
      cardG.fillStyle(0x080810, 0.92);
      cardG.fillRoundedRect(x, y, cardW, cardH, r);
      cardG.lineStyle(1.5, 0x333344, 0.5);
      cardG.strokeRoundedRect(x, y, cardW, cardH, r);
    }

    // ── 地圖圖示區（上方 1/4）────────────────────────────────────────────
    const iconY = cardTop + Math.round(cardH * 0.17);
    this.drawMapIcon(cx, iconY, map);

    // ── 地圖名稱 ──────────────────────────────────────────────────────────
    const nameColor = map.available ? '#ffffff' : '#555566';
    this.add.text(
      cx,
      cardTop + Math.round(cardH * 0.36),
      map.name,
      uiText(18, nameColor, { fontStyle: 'bold', resolution: 2 })
    ).setOrigin(0.5, 0.5).setDepth(10);

    // ── 狀態標籤 ──────────────────────────────────────────────────────────
    if (map.available) {
      // 已開放標籤
      const tagG = this.add.graphics().setDepth(9);
      const tagW = cardW * 0.55;
      const tagH = 18;
      const tagY = cardTop + Math.round(cardH * 0.46);
      tagG.fillStyle(0x1a5533, 0.9);
      tagG.fillRoundedRect(cx - tagW / 2, tagY - tagH / 2, tagW, tagH, 4);
      tagG.lineStyle(1, 0x44cc88, 0.7);
      tagG.strokeRoundedRect(cx - tagW / 2, tagY - tagH / 2, tagW, tagH, 4);
      this.add.text(cx, tagY, '✦ 已開放',
        uiText(11, '#44cc88', { fontStyle: 'bold', resolution: 2 })
      ).setOrigin(0.5, 0.5).setDepth(10);
    } else {
      // 待更新標籤
      const tagG = this.add.graphics().setDepth(9);
      const tagW = cardW * 0.55;
      const tagH = 18;
      const tagY = cardTop + Math.round(cardH * 0.46);
      tagG.fillStyle(0x1a1a2a, 0.9);
      tagG.fillRoundedRect(cx - tagW / 2, tagY - tagH / 2, tagW, tagH, 4);
      tagG.lineStyle(1, 0x444455, 0.6);
      tagG.strokeRoundedRect(cx - tagW / 2, tagY - tagH / 2, tagW, tagH, 4);
      this.add.text(cx, tagY, '🔒 待更新',
        uiText(11, '#555566', { resolution: 2 })
      ).setOrigin(0.5, 0.5).setDepth(10);
    }

    // ── 地圖說明 ──────────────────────────────────────────────────────────
    const descColor = map.available ? '#aaaacc' : '#444455';
    this.add.text(
      cx,
      cardTop + Math.round(cardH * 0.60),
      map.description,
      uiText(11, descColor, { wordWrap: { width: cardW - 16 }, align: 'center', resolution: 2 })
    ).setOrigin(0.5, 0.5).setDepth(10);

    // ── 互動熱區（只有 available 才可點擊）──────────────────────────────
    if (map.available) {
      const hitArea = this.add.rectangle(
        cx, cy,
        Math.max(cardW, 88), Math.max(cardH, 88),
        0x000000, 0
      ).setDepth(12).setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => {
        cardG.clear();
        cardG.fillStyle(0x1a2a3a, 0.95);
        cardG.fillRoundedRect(x, y, cardW, cardH, r);
        cardG.lineStyle(2.5, 0x66ccff, 1);
        cardG.strokeRoundedRect(x, y, cardW, cardH, r);
        cardG.lineStyle(6, 0x44aaff, 0.18);
        cardG.strokeRoundedRect(x - 3, y - 3, cardW + 6, cardH + 6, r + 3);
      });

      hitArea.on('pointerout', () => {
        cardG.clear();
        cardG.fillStyle(0x0f0f1e, 0.90);
        cardG.fillRoundedRect(x, y, cardW, cardH, r);
        cardG.lineStyle(1.5, 0x44aaff, 0.55);
        cardG.strokeRoundedRect(x, y, cardW, cardH, r);
      });

      hitArea.on('pointerdown', () => {
        this.scene.start('GameScene', {
          characterId: this.characterId,
          selectedMapId: map.id,
        });
      });
    }
  }

  private drawMapIcon(cx: number, cy: number, map: MapData): void {
    const g = this.add.graphics().setDepth(9);

    if (!map.available) {
      // 鎖定圖示：灰色鎖頭
      g.fillStyle(0x333344, 0.8);
      g.fillCircle(cx, cy, 20);
      g.lineStyle(1.5, 0x444455, 0.6);
      g.strokeCircle(cx, cy, 20);
      // 鎖頭本體
      g.fillStyle(0x555566, 1);
      g.fillRoundedRect(cx - 9, cy - 4, 18, 14, 3);
      // 鎖頭弧形
      g.lineStyle(3, 0x555566, 1);
      g.beginPath();
      g.arc(cx, cy - 4, 7, Math.PI, 0, false);
      g.strokePath();
      return;
    }

    // 青原試煉場：青綠色山形圖示
    if (map.id === 'qingyuan') {
      g.fillStyle(0x44aaff, 0.15);
      g.fillCircle(cx, cy, 22);
      g.lineStyle(1.5, 0x44aaff, 0.5);
      g.strokeCircle(cx, cy, 22);
      // 山形
      g.fillStyle(0x2a6644, 1);
      g.fillTriangle(cx, cy - 16, cx - 14, cy + 8, cx + 14, cy + 8);
      g.fillStyle(0x44aa66, 1);
      g.fillTriangle(cx + 6, cy - 8, cx - 4, cy + 8, cx + 16, cy + 8);
      // 雪頂
      g.fillStyle(0xeeeeff, 0.9);
      g.fillTriangle(cx, cy - 16, cx - 5, cy - 6, cx + 5, cy - 6);
    }
  }

  private buildBackButton(W: number, H: number): void {
    const btnW = 160;
    const btnH = 44;
    const btnX = Math.round(W * 0.5);
    const btnY = Math.round(H * 0.88);
    const r = 8;
    const x = Math.round(btnX - btnW / 2);
    const y = Math.round(btnY - btnH / 2);

    const btnG = this.add.graphics().setDepth(11);
    const drawBtn = (hovered: boolean) => {
      btnG.clear();
      btnG.fillStyle(hovered ? 0x2a2a3a : 0x1a1a2a, 0.9);
      btnG.fillRoundedRect(x, y, btnW, btnH, r);
      btnG.lineStyle(hovered ? 2 : 1.5, hovered ? 0xaaaacc : 0x666677, 0.9);
      btnG.strokeRoundedRect(x, y, btnW, btnH, r);
    };
    drawBtn(false);

    this.add.text(btnX, btnY, '← 返回宗門選擇',
      uiText(14, '#aaaacc', { resolution: 2 })
    ).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, 88), Math.max(btnH, 48), 0x000000, 0)
      .setDepth(13).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => drawBtn(true));
    hitArea.on('pointerout', () => drawBtn(false));
    hitArea.on('pointerdown', () => {
      this.scene.start('CharacterSelectScene');
    });
  }
}
