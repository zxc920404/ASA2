import Phaser from 'phaser';
import { Player } from './Player';

const WORLD_MIN = 32;
const WORLD_MAX = 3200 - 32;

/**
 * BlackHoleTrap — shield 精英怪的移動小黑洞干擾技能
 * - 緩慢移動，不造成傷害
 * - 在吸引半徑內對玩家施加輕微吸力（干擾走位，玩家可逃脫）
 * - 不影響敵人、不影響經驗球
 */
export class BlackHoleTrap {
  private scene: Phaser.Scene;
  public x: number;
  public y: number;

  /** 吸引半徑 */
  public readonly radius: number;

  private lifetime: number;   // 剩餘存活時間（ms）
  private moveAngle: number;  // 移動方向（弧度）
  private moveSpeed: number;  // 移動速度（px/s）

  private readonly PULL_STRENGTH = 60; // 吸力強度（px/s，邊緣處）

  /** 是否已標記銷毀 */
  public isDead: boolean = false;

  /** 視覺圖形（靜態，不每幀重繪） */
  private visual!: Phaser.GameObjects.Graphics;
  /** 旋轉容器（用 rotation 做動畫，不 clear+redraw） */
  private spinContainer!: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    durationMs: number,
    moveAngle: number,
    moveSpeed: number
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.lifetime = durationMs;
    this.moveAngle = moveAngle;
    this.moveSpeed = moveSpeed;

    this.buildVisual();
  }

  private buildVisual(): void {
    // 靜態底層：外圈光暈 + 中心黑洞（只畫一次）
    this.visual = this.scene.add.graphics();
    this.visual.setDepth(15);
    this.visual.setPosition(this.x, this.y);

    // 外圈淡紫色吸引範圍提示
    this.visual.fillStyle(0x220033, 0.30);
    this.visual.fillCircle(0, 0, this.radius);
    this.visual.lineStyle(1.5, 0x8800cc, 0.45);
    this.visual.strokeCircle(0, 0, this.radius);

    // 中圈深紫
    this.visual.fillStyle(0x440066, 0.70);
    this.visual.fillCircle(0, 0, this.radius * 0.45);

    // 中心黑洞
    this.visual.fillStyle(0x000000, 0.95);
    this.visual.fillCircle(0, 0, this.radius * 0.18);

    // 旋轉容器：放旋渦線條，用 Phaser tween 旋轉
    const spinG = this.scene.add.graphics();
    spinG.lineStyle(1.5, 0xaa44ff, 0.55);
    const r1 = this.radius * 0.22;
    const r2 = this.radius * 0.75;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      spinG.lineBetween(
        Math.cos(a) * r1, Math.sin(a) * r1,
        Math.cos(a + 0.9) * r2, Math.sin(a + 0.9) * r2
      );
    }

    this.spinContainer = this.scene.add.container(this.x, this.y, [spinG]);
    this.spinContainer.setDepth(16);

    // 用 tween 持續旋轉，不需要每幀 redraw
    this.scene.tweens.add({
      targets: this.spinContainer,
      rotation: Math.PI * 2,
      duration: 1800,
      repeat: -1,
      ease: 'Linear',
    });
  }

  private syncVisualPosition(): void {
    if (this.visual && this.visual.active) {
      this.visual.setPosition(this.x, this.y);
    }
    if (this.spinContainer && this.spinContainer.active) {
      this.spinContainer.setPosition(this.x, this.y);
    }
  }

  /**
   * 每幀更新：移動 + 吸引玩家
   * @returns true 表示仍存活
   */
  public update(delta: number, player: Player): boolean {
    if (this.isDead) return false;

    this.lifetime -= delta;
    if (this.lifetime <= 0) return false;

    // 移動
    const dt = delta / 1000;
    this.x += Math.cos(this.moveAngle) * this.moveSpeed * dt;
    this.y += Math.sin(this.moveAngle) * this.moveSpeed * dt;

    // 邊界反彈
    if (this.x < WORLD_MIN || this.x > WORLD_MAX) {
      this.moveAngle = Math.PI - this.moveAngle;
      this.x = Phaser.Math.Clamp(this.x, WORLD_MIN, WORLD_MAX);
    }
    if (this.y < WORLD_MIN || this.y > WORLD_MAX) {
      this.moveAngle = -this.moveAngle;
      this.y = Phaser.Math.Clamp(this.y, WORLD_MIN, WORLD_MAX);
    }

    this.syncVisualPosition();

    // 吸引玩家（不造成傷害）
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius && dist > 1) {
      // 越靠近吸力越強，邊緣吸力最弱
      const strengthFactor = 1 - dist / this.radius;
      const pull = this.PULL_STRENGTH * strengthFactor * dt;
      player.setPosition(
        player.x + (dx / dist) * pull,
        player.y + (dy / dist) * pull
      );
    }

    return true;
  }

  public destroy(): void {
    if (this.isDead) return;
    this.isDead = true;

    // 淡出消失
    if (this.visual && this.visual.active) {
      this.scene.tweens.add({
        targets: this.visual,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 250,
        onComplete: () => {
          if (this.visual && this.visual.active) this.visual.destroy();
        },
      });
    }
    if (this.spinContainer && this.spinContainer.active) {
      this.scene.tweens.killTweensOf(this.spinContainer);
      this.scene.tweens.add({
        targets: this.spinContainer,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          if (this.spinContainer && this.spinContainer.active) this.spinContainer.destroy();
        },
      });
    }
  }
}
