import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';
import { MetaProgression } from '../systems/MetaProgression';

/**
 * VictoryPanel — 10 分鐘生存勝利結算面板
 * 顯示：存活時間、等級、擊殺數、天命點、持有武器、持有被動
 * 按鈕：重新開始（CharacterSelectScene）、返回主選單（MainMenuScene）
 */
export class VictoryPanel {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    player: Player,
    survivalSeconds: number,
    killCount: number,
    runDestinyPoints: number,
    onRestart: () => void,
    onReturnToMenu: () => void
  ) {
    this.scene = scene;
    this.createElements(player, survivalSeconds, killCount, runDestinyPoints, onRestart, onReturnToMenu);
  }

  private createElements(
    player: Player,
    survivalSeconds: number,
    killCount: number,
    runDestinyPoints: number,
    onRestart: () => void,
    onReturnToMenu: () => void
  ): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // ── 全螢幕遮罩 ──────────────────────────────────────────────────────────
    const overlay = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    overlay.fillStyle(0x000000, 0.80);
    overlay.fillRect(0, 0, W, H);
    this.elements.push(overlay);

    // ── 中央面板背景 ────────────────────────────────────────────────────────
    const panelW = Math.min(W * 0.72, 520);
    const panelH = H * 0.86;
    const panelX = W * 0.5 - panelW / 2;
    const panelY = H * 0.5 - panelH / 2;

    const panelBg = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    panelBg.fillStyle(0x0a1a0a, 0.97);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(2, 0xffd700, 0.85);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(1, 0xffd700, 0.18);
    panelBg.strokeRoundedRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 8);
    this.elements.push(panelBg);

    // ── 標題 ────────────────────────────────────────────────────────────────
    const titleShadow = this.scene.add.text(W * 0.5 + 2, panelY + 28 + 2, '✦ 勝利 ✦', {
      fontSize: '40px', color: '#886600', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.elements.push(titleShadow);

    const title = this.scene.add.text(W * 0.5, panelY + 28, '✦ 勝利 ✦', {
      fontSize: '40px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.elements.push(title);

    const subtitle = this.scene.add.text(W * 0.5, panelY + 58, '你成功撐過了 10 分鐘！', {
      fontSize: '14px', color: '#aaddaa',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);
    this.elements.push(subtitle);

    // 標題分隔線
    const titleLine = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    titleLine.lineStyle(1.5, 0xffd700, 0.5);
    titleLine.lineBetween(panelX + 16, panelY + 76, panelX + panelW - 16, panelY + 76);
    this.elements.push(titleLine);

    // ── 基本數據（兩欄）────────────────────────────────────────────────────
    const totalSec = Math.floor(survivalSeconds);
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');

    const statsY = panelY + 100;
    const col1X = panelX + panelW * 0.25;
    const col2X = panelX + panelW * 0.75;

    const statsData = [
      { label: '⏱ 存活時間', value: `${mm}:${ss}`, color: '#dddddd', x: col1X },
      { label: '⚔ 擊殺數',   value: `${killCount}`, color: '#ffccaa', x: col2X },
      { label: '⭐ 等級',     value: `Lv.${player.level}`, color: '#aaddff', x: col1X },
    ];

    for (let i = 0; i < statsData.length; i++) {
      const d = statsData[i];
      const rowY = statsY + Math.floor(i / 2) * 44;
      const xPos = i < 2 ? d.x : W * 0.5;

      const lbl = this.scene.add.text(xPos, rowY, d.label, {
        fontSize: '11px', color: '#888888',
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
      this.elements.push(lbl);

      const val = this.scene.add.text(xPos, rowY + 16, d.value, {
        fontSize: '20px', color: d.color, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
      this.elements.push(val);
    }

    // 天命點（勝利額外 +100）
    MetaProgression.addDestinyPoints(runDestinyPoints);
    const totalDp = MetaProgression.getDestinyPoints();
    const dpLbl = this.scene.add.text(W * 0.5, statsY + 88, '✦ 天命點', {
      fontSize: '11px', color: '#888888',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.elements.push(dpLbl);
    const dpVal = this.scene.add.text(W * 0.5, statsY + 104, `+${runDestinyPoints} (含勝利獎勵 +100)  總計：${totalDp}`, {
      fontSize: '13px', color: '#88ffcc', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.elements.push(dpVal);    // 分隔線
    const midLine = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    midLine.lineStyle(1, 0x334433, 0.8);
    midLine.lineBetween(panelX + 16, panelY + 192, panelX + panelW - 16, panelY + 192);
    this.elements.push(midLine);

    // ── 武器清單 ────────────────────────────────────────────────────────────
    let listY = panelY + 202;

    const weaponHeader = this.scene.add.text(panelX + 16, listY, '⚔ 持有武器', {
      fontSize: '12px', color: '#ccaa44', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(101);
    this.elements.push(weaponHeader);
    listY += 18;

    if (player.equipment.weapons.length === 0) {
      const none = this.scene.add.text(panelX + 24, listY, '（無）', {
        fontSize: '11px', color: '#555555',
      }).setScrollFactor(0).setDepth(101);
      this.elements.push(none);
      listY += 16;
    } else {
      // 兩欄顯示武器
      const wCols = 2;
      player.equipment.weapons.forEach((slot, idx) => {
        const w = getWeaponById(slot.weaponId);
        const name = w?.name ?? slot.weaponId;
        const colX = panelX + 24 + (idx % wCols) * (panelW / wCols - 8);
        const rowY = listY + Math.floor(idx / wCols) * 16;
        const t = this.scene.add.text(colX, rowY, `${name} Lv${slot.level}`, {
          fontSize: '11px', color: '#ffdd88',
        }).setScrollFactor(0).setDepth(101);
        this.elements.push(t);
      });
      listY += Math.ceil(player.equipment.weapons.length / wCols) * 16;
    }

    listY += 6;

    // ── 被動清單 ────────────────────────────────────────────────────────────
    const passiveHeader = this.scene.add.text(panelX + 16, listY, '✦ 持有被動', {
      fontSize: '12px', color: '#7799cc', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(101);
    this.elements.push(passiveHeader);
    listY += 18;

    if (player.equipment.passives.length === 0) {
      const none = this.scene.add.text(panelX + 24, listY, '（無）', {
        fontSize: '11px', color: '#555555',
      }).setScrollFactor(0).setDepth(101);
      this.elements.push(none);
      listY += 16;
    } else {
      const pCols = 2;
      player.equipment.passives.forEach((slot, idx) => {
        const p = getPassiveById(slot.passiveId);
        const name = p?.name ?? slot.passiveId;
        const colX = panelX + 24 + (idx % pCols) * (panelW / pCols - 8);
        const rowY = listY + Math.floor(idx / pCols) * 16;
        const t = this.scene.add.text(colX, rowY, `${name} Lv${slot.level}`, {
          fontSize: '11px', color: '#88ccff',
        }).setScrollFactor(0).setDepth(101);
        this.elements.push(t);
      });
    }

    // ── 按鈕區 ──────────────────────────────────────────────────────────────
    const btnY = panelY + panelH - 52;
    const btnW = 180;
    const btnH = 48;
    const btnR = 8;
    const btn1X = W * 0.5 - btnW / 2 - 10;
    const btn2X = W * 0.5 + btnW / 2 + 10;

    // 重新開始按鈕
    const restartG = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawBtn(restartG, btn1X, btnY, btnW, btnH, btnR, false, 0x1a3a1a, 0x44aa44);
    this.elements.push(restartG);

    const restartT = this.scene.add.text(btn1X, btnY, '重新開始', {
      fontSize: '16px', color: '#aaffaa', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.elements.push(restartT);

    const restartHit = this.scene.add.rectangle(btn1X, btnY, btnW, btnH, 0, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });
    this.elements.push(restartHit);
    restartHit.on('pointerover', () => {
      this.drawBtn(restartG, btn1X, btnY, btnW, btnH, btnR, true, 0x1a3a1a, 0x44aa44);
      restartT.setColor('#ffffff');
    });
    restartHit.on('pointerout', () => {
      this.drawBtn(restartG, btn1X, btnY, btnW, btnH, btnR, false, 0x1a3a1a, 0x44aa44);
      restartT.setColor('#aaffaa');
    });
    restartHit.on('pointerdown', () => onRestart());

    // 返回主選單按鈕
    const menuG = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawBtn(menuG, btn2X, btnY, btnW, btnH, btnR, false, 0x1a1a3a, 0x4444aa);
    this.elements.push(menuG);

    const menuT = this.scene.add.text(btn2X, btnY, '返回主選單', {
      fontSize: '16px', color: '#aaaaff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(102);
    this.elements.push(menuT);

    const menuHit = this.scene.add.rectangle(btn2X, btnY, btnW, btnH, 0, 0)
      .setScrollFactor(0).setDepth(103).setInteractive({ useHandCursor: true });
    this.elements.push(menuHit);
    menuHit.on('pointerover', () => {
      this.drawBtn(menuG, btn2X, btnY, btnW, btnH, btnR, true, 0x1a1a3a, 0x4444aa);
      menuT.setColor('#ffffff');
    });
    menuHit.on('pointerout', () => {
      this.drawBtn(menuG, btn2X, btnY, btnW, btnH, btnR, false, 0x1a1a3a, 0x4444aa);
      menuT.setColor('#aaaaff');
    });
    menuHit.on('pointerdown', () => onReturnToMenu());
  }

  private drawBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, r: number,
    hovered: boolean,
    fillColor: number,
    borderColor: number
  ): void {
    g.clear();
    g.fillStyle(hovered ? (fillColor + 0x111111) : fillColor, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    g.lineStyle(hovered ? 2 : 1.5, borderColor, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
  }

  public destroy(): void {
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
  }
}
