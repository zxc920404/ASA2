import Phaser from 'phaser';
import { Player } from './Player';

export type DropItemType = 'heal' | 'speed' | 'bomb';

/** 道具拾取半徑 */
const PICKUP_RADIUS = 22;

/**
 * DropItem — 小怪機率掉落的臨時道具
 * heal：回血  speed：加速  bomb：清怪
 */
export class DropItem {
  private scene: Phaser.Scene;
  public x: number;
  public y: number;
  public type: DropItemType;

  private lifetime: number = 12000; // 12 秒後自動消失
  public isDead: boolean = false;

  private visual!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, type: DropItemType) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    this.buildVisual();
  }

  private buildVisual(): void {
    const g = this.scene.add.graphics();
    g.setPosition(this.x, this.y);
    g.setDepth(12);

    switch (this.type) {
      case 'heal':
        // 綠色光球
        g.fillStyle(0x00cc44, 0.30); g.fillCircle(0, 0, 16);
        g.fillStyle(0x00ff66, 0.85); g.fillCircle(0, 0, 10);
        g.lineStyle(2, 0x00ff88, 0.9); g.strokeCircle(0, 0, 14);
        // 十字
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(-2, -7, 4, 14);
        g.fillRect(-7, -2, 14, 4);
        break;
      case 'speed':
        // 青色風符
        g.fillStyle(0x0088ff, 0.30); g.fillCircle(0, 0, 16);
        g.fillStyle(0x00ccff, 0.85); g.fillCircle(0, 0, 10);
        g.lineStyle(2, 0x44ddff, 0.9); g.strokeCircle(0, 0, 14);
        // 閃電符號
        g.fillStyle(0xffffff, 0.9);
        g.fillTriangle(2, -8, -4, 1, 0, 1);
        g.fillTriangle(-2, 8, 4, -1, 0, -1);
        break;
      case 'bomb':
        // 紅色爆破符
        g.fillStyle(0xff4400, 0.30); g.fillCircle(0, 0, 16);
        g.fillStyle(0xff6600, 0.85); g.fillCircle(0, 0, 10);
        g.lineStyle(2, 0xff8800, 0.9); g.strokeCircle(0, 0, 14);
        // 爆炸星形（4 個三角）
        g.fillStyle(0xffd700, 0.9);
        g.fillTriangle(0, -9, -3, -3, 3, -3);
        g.fillTriangle(0, 9, -3, 3, 3, 3);
        g.fillTriangle(-9, 0, -3, -3, -3, 3);
        g.fillTriangle(9, 0, 3, -3, 3, 3);
        break;
    }

    this.visual = g;

    // 閃爍動畫（快消失時加快閃爍）
    this.scene.tweens.add({
      targets: this.visual,
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * 每幀更新：計時
   * @returns true 表示仍存活
   */
  public update(delta: number): boolean {
    if (this.isDead) return false;
    this.lifetime -= delta;
    return this.lifetime > 0;
  }

  /**
   * 檢查玩家是否拾取
   * @returns true 表示被拾取
   */
  public checkPickup(player: Player): boolean {
    if (this.isDead) return false;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= PICKUP_RADIUS + 16;
  }

  public destroy(): void {
    if (this.isDead) return;
    this.isDead = true;
    if (this.visual && this.visual.active) {
      this.scene.tweens.killTweensOf(this.visual);
      this.scene.tweens.add({
        targets: this.visual,
        alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 200,
        onComplete: () => { if (this.visual?.active) this.visual.destroy(); },
      });
    }
    if (this.label && this.label.active) this.label.destroy();
  }
}
