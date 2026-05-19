import Phaser from 'phaser';
import { Player } from './Player';

/**
 * BlackHoleTrap — shield 精英怪的黑洞陷阱技能
 * 持續吸引玩家，中心小範圍造成持續傷害
 */
export class BlackHoleTrap {
  private scene: Phaser.Scene;
  public x: number;
  public y: number;
  public radius: number;

  private lifetime: number;       // 剩餘存活時間（ms）
  private damageTimer: number = 0; // 傷害計時（每 500ms 造成一次）
  private readonly DAMAGE_INTERVAL = 500;
  private readonly DAMAGE_PER_TICK = 4;
  private readonly PULL_STRENGTH = 55; // 吸引速度 px/s（玩家仍可逃脫）
  private readonly DAMAGE_RADIUS = 28; // 中心傷害半徑

  /** 是否已標記銷毀 */
  public isDead: boolean = false;

  /** 視覺圖形 */
  private visual!: Phaser.GameObjects.Graphics;
  /** 旋渦動畫計時 */
  private rotationAngle: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, durationMs: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.lifetime = durationMs;

    this.visual = scene.add.graphics();
    this.drawVisual();
  }

  private drawVisual(): void {
    const g = this.visual;
    g.clear();
    g.setPosition(this.x, this.y);
    g.setDepth(15);

    // 外圈紫黑色光暈
    g.fillStyle(0x220033, 0.55);
    g.fillCircle(0, 0, this.radius);

    // 中圈深紫
    g.fillStyle(0x440066, 0.65);
    g.fillCircle(0, 0, this.radius * 0.6);

    // 中心黑洞
    g.fillStyle(0x000000, 0.9);
    g.fillCircle(0, 0, this.radius * 0.25);

    // 外圈邊框
    g.lineStyle(2, 0xaa00ff, 0.7);
    g.strokeCircle(0, 0, this.radius);

    // 旋渦線條（靜態，4 條）
    g.lineStyle(1.5, 0x8800cc, 0.5);
    for (let i = 0; i < 4; i++) {
      const a = this.rotationAngle + (i / 4) * Math.PI * 2;
      const r1 = this.radius * 0.3;
      const r2 = this.radius * 0.85;
      g.lineBetween(
        Math.cos(a) * r1, Math.sin(a) * r1,
        Math.cos(a + 0.8) * r2, Math.sin(a + 0.8) * r2
      );
    }
  }

  /**
   * 每幀更新：吸引玩家 + 傷害 + 旋渦動畫
   * @returns true 表示仍存活
   */
  public update(delta: number, player: Player): boolean {
    if (this.isDead) return false;

    this.lifetime -= delta;
    if (this.lifetime <= 0) return false;

    // 旋渦動畫
    this.rotationAngle += delta * 0.003;
    this.drawVisual();

    // 吸引玩家
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius && dist > 1) {
      const dt = delta / 1000;
      // 越靠近中心吸力越強（線性）
      const pullFactor = 1 - (dist / this.radius) * 0.5;
      const pullX = (dx / dist) * this.PULL_STRENGTH * pullFactor * dt;
      const pullY = (dy / dist) * this.PULL_STRENGTH * pullFactor * dt;
      player.setPosition(player.x + pullX, player.y + pullY);
    }

    // 中心傷害
    this.damageTimer += delta;
    if (this.damageTimer >= this.DAMAGE_INTERVAL) {
      this.damageTimer -= this.DAMAGE_INTERVAL;
      if (dist < this.DAMAGE_RADIUS) {
        player.currentHP = Math.max(0, player.currentHP - this.DAMAGE_PER_TICK);
      }
    }

    return true;
  }

  public destroy(): void {
    if (this.isDead) return;
    this.isDead = true;
    if (this.visual && this.visual.active) {
      // 淡出消失
      this.scene.tweens.add({
        targets: this.visual,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 300,
        onComplete: () => {
          if (this.visual && this.visual.active) this.visual.destroy();
        },
      });
    }
  }
}
