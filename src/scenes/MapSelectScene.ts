import Phaser from 'phaser';
import { uiText, uiTitle } from '../ui/UIStyles';
import { ResponsiveLayout } from '../utils/ResponsiveLayout';
import { BGMManager } from '../systems/BGMManager';
import { SFXManager } from '../systems/SFXManager';

// ── 地圖資料 ──────────────────────────────────────────────────────────────
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
    description: '靈氣初聚之地，適合宗門弟子試煉。',
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
    console.log('[MapSelectScene] init 收到 characterId:', this.characterId);
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = ResponsiveLayout.compute(W, H);
    const s = layout.uiScale;

    this.drawBackground(W, H);
    this.drawTitle(W, H, layout);

    // 地圖卡片列表
    const cardW = Math.round(Math.min(layout.usableW - 16, 340));
    const cardH = Math.round(Math.min(H * 0.16, 110));
    const cardX = W / 2;
    const startY = layout.safeTop + Math.round(H * 0.18);
    const gap = Math.round(H * 0.022);

    MAPS.forEach((map, i) => {
      const cardY = startY + i * (cardH + gap) + Math.round(cardH / 2);
      this.buildMapCard(map, cardX, cardY, cardW, cardH, s);
    });

    this.buildBackButton(W, H, layout);

    // BGM（有專屬 BGM 則播放，否則 fallback 到主選單 BGM）
    BGMManager.play(this, 'bgm_map_select');
  }

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
    // 背景光暈
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(0x1a4466, 0.10);
    glow.fillCircle(Math.round(W * 0.5), Math.round(H * 0.3), Math.round(W * 0.7));
  }

  private drawTitle(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const cx = W / 2;
    const ty = layout.safeTop + Math.round(H * 0.08);

    this.add.text(cx + 2, ty + 2, '選擇修行之地',
      uiTitle(Math.round(30 * s), '#7a4a00')
    ).setOrigin(0.5, 0.5).setDepth(10);
    this.add.text(cx, ty, '選擇修行之地',
      uiTitle(Math.round(30 * s), '#ffd700')
    ).setOrigin(0.5, 0.5).setDepth(11);

    const lineG = this.add.graphics().setDepth(11);
    lineG.lineStyle(1, 0xd4af37, 0.55);
    lineG.lineBetween(cx - Math.round(W * 0.28), ty + Math.round(H * 0.045), cx + Math.round(W * 0.28), ty + Math.round(H * 0.045));
  }

  private buildMapCard(
    map: MapData, cx: number, cy: number,
    cardW: number, cardH: number, s: number
  ): void {
    const r = 10;
    const x = Math.round(cx - cardW / 2);
    const y = Math.round(cy - cardH / 2);

    const cardG = this.add.graphics().setDepth(8);
    if (map.available) {
      cardG.fillStyle(0x0f1a2e, 0.90);
      cardG.fillRoundedRect(x, y, cardW, cardH, r);
      cardG.lineStyle(1.5, 0x44aaff, 0.55);
      cardG.strokeRoundedRect(x, y, cardW, cardH, r);
    } else {
      cardG.fillStyle(0x080810, 0.88);
      cardG.fillRoundedRect(x, y, cardW, cardH, r);
      cardG.lineStyle(1, 0x333344, 0.40);
      cardG.strokeRoundedRect(x, y, cardW, cardH, r);
    }

    // 地圖圖示
    const iconX = x + Math.round(cardH * 0.50);
    const iconY = cy;
    this.drawMapIcon(iconX, iconY, map, Math.round(cardH * 0.36));

    // 地圖名稱
    const textX = x + Math.round(cardH * 0.90);
    const nameColor = map.available ? '#ffffff' : '#555566';
    this.add.text(textX, cy - Math.round(cardH * 0.18),
      map.name,
      uiText(Math.round(16 * s), nameColor, { fontStyle: 'bold' })
    ).setOrigin(0, 0.5).setDepth(10);

    if (map.available) {
      // 可進入標籤
      const tagG = this.add.graphics().setDepth(9);
      const tagW = Math.round(cardW * 0.28);
      const tagH = Math.round(18 * s);
      const tagX = textX;
      const tagY = cy + Math.round(cardH * 0.08);
      tagG.fillStyle(0x1a5533, 0.9);
      tagG.fillRoundedRect(tagX, tagY - tagH / 2, tagW, tagH, 4);
      tagG.lineStyle(1, 0x44cc88, 0.7);
      tagG.strokeRoundedRect(tagX, tagY - tagH / 2, tagW, tagH, 4);
      this.add.text(tagX + tagW / 2, tagY, '✦ 可進入',
        uiText(Math.round(10 * s), '#44cc88', { fontStyle: 'bold' })
      ).setOrigin(0.5, 0.5).setDepth(10);

      this.add.text(textX, cy + Math.round(cardH * 0.30),
        map.description,
        uiText(Math.round(10 * s), '#8899aa', { wordWrap: { width: cardW - Math.round(cardH * 0.95) } })
      ).setOrigin(0, 0.5).setDepth(10);
    } else {
      this.add.text(textX, cy + Math.round(cardH * 0.12),
        '🔒 待更新',
        uiText(Math.round(11 * s), '#555566')
      ).setOrigin(0, 0.5).setDepth(10);
    }

    if (map.available) {
      const hitArea = this.add.rectangle(cx, cy, Math.max(cardW, 88), Math.max(cardH, 60), 0, 0)
        .setDepth(12).setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => {
        cardG.clear();
        cardG.fillStyle(0x1a2a3a, 0.95);
        cardG.fillRoundedRect(x, y, cardW, cardH, r);
        cardG.lineStyle(2.5, 0x66ccff, 1);
        cardG.strokeRoundedRect(x, y, cardW, cardH, r);
        cardG.lineStyle(8, 0x44aaff, 0.15);
        cardG.strokeRoundedRect(x - 3, y - 3, cardW + 6, cardH + 6, r + 3);
      });
      hitArea.on('pointerout', () => {
        cardG.clear();
        cardG.fillStyle(0x0f1a2e, 0.90);
        cardG.fillRoundedRect(x, y, cardW, cardH, r);
        cardG.lineStyle(1.5, 0x44aaff, 0.55);
        cardG.strokeRoundedRect(x, y, cardW, cardH, r);
      });
      hitArea.on('pointerdown', () => {
        SFXManager.playButtonClick(this);
        console.log('[MapSelectScene] 選擇地圖 → 傳入 GameScene characterId:', this.characterId, '| mapId:', map.id);
        this.scene.start('GameScene', {
          characterId: this.characterId,
          selectedMapId: map.id,
        });
      });
    }
  }

  private drawMapIcon(cx: number, cy: number, map: MapData, size: number): void {
    const g = this.add.graphics().setDepth(9);
    if (!map.available) {
      g.fillStyle(0x333344, 0.8);
      g.fillCircle(cx, cy, size);
      g.lineStyle(1.5, 0x444455, 0.6);
      g.strokeCircle(cx, cy, size);
      g.fillStyle(0x555566, 1);
      g.fillRoundedRect(cx - size * 0.45, cy - size * 0.2, size * 0.9, size * 0.7, 3);
      g.lineStyle(3, 0x555566, 1);
      g.beginPath();
      g.arc(cx, cy - size * 0.2, size * 0.35, Math.PI, 0, false);
      g.strokePath();
      return;
    }
    if (map.id === 'qingyuan') {
      g.fillStyle(0x44aaff, 0.12);
      g.fillCircle(cx, cy, size);
      g.lineStyle(1.5, 0x44aaff, 0.45);
      g.strokeCircle(cx, cy, size);
      g.fillStyle(0x2a6644, 1);
      g.fillTriangle(cx, cy - size * 0.75, cx - size * 0.65, cy + size * 0.38, cx + size * 0.65, cy + size * 0.38);
      g.fillStyle(0x44aa66, 1);
      g.fillTriangle(cx + size * 0.28, cy - size * 0.38, cx - size * 0.18, cy + size * 0.38, cx + size * 0.75, cy + size * 0.38);
      g.fillStyle(0xeeeeff, 0.9);
      g.fillTriangle(cx, cy - size * 0.75, cx - size * 0.24, cy - size * 0.28, cx + size * 0.24, cy - size * 0.28);
    }
  }

  private buildBackButton(W: number, H: number, layout: ReturnType<typeof ResponsiveLayout.compute>): void {
    const s = layout.uiScale;
    const btnW = Math.round(Math.min(W * 0.65, 280));
    const btnH = layout.btnH;
    const btnX = W / 2;
    const btnY = H - layout.safeBottom - Math.round(btnH * 0.80);
    const r = 8;
    const x = Math.round(btnX - btnW / 2);
    const y = Math.round(btnY - btnH / 2);

    const btnG = this.add.graphics().setDepth(11);
    const drawBtn = (hovered: boolean) => {
      btnG.clear();
      btnG.fillStyle(hovered ? 0x1a2a3a : 0x0d1a2a, 0.92);
      btnG.fillRoundedRect(x, y, btnW, btnH, r);
      btnG.lineStyle(hovered ? 2 : 1.5, hovered ? 0xaaaacc : 0x556677, 0.90);
      btnG.strokeRoundedRect(x, y, btnW, btnH, r);
    };
    drawBtn(false);

    this.add.text(btnX, btnY, '← 返回宗門選擇',
      uiText(Math.round(15 * s), '#aaaacc', { fontStyle: 'bold' })
    ).setOrigin(0.5, 0.5).setDepth(12);

    const hitArea = this.add.rectangle(btnX, btnY, Math.max(btnW, layout.minTouchTarget), Math.max(btnH, layout.minTouchTarget), 0, 0)
      .setDepth(13).setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => drawBtn(true));
    hitArea.on('pointerout',  () => drawBtn(false));
    hitArea.on('pointerdown', () => {
      SFXManager.playButtonClick(this);
      this.scene.start('CharacterSelectScene');
    });
  }
}
