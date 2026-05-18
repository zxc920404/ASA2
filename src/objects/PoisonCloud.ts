import Phaser from 'phaser';
import { Enemy } from './Enemy';

/** 毒霧 tick 間隔（毫秒）：每 0.5 秒造成一次傷害，固定不變 */
const CLOUD_TICK_MS = 500;

/**
 * PoisonCloud — 毒霧散的毒霧區域
 * 在指定位置生成半透明綠色圓形
 * 持續時間由外部傳入（對應 levelStats.duration）
 * 每 0.5 秒對範圍內所有敵人造成一次傷害
 * 持續時間結束後自動銷毀
 *
 * 視覺優化：建立時只畫一次圓形，之後用 setAlpha() 淡出
 * 避免每幀 clear+redraw 造成手機 FPS 下降
 */
export class PoisonCloud {
  /** 中心 X */
  public readonly x: number;
  /** 中心 Y */
  public readonly y: number;
  /** 傷害半徑（px） */
  public readonly radius: number;
  /** 每次 tick 造成的傷害 */
  public readonly damage: number;

  /** 總持續時間（毫秒），用於計算淡出比例 */
  private readonly totalDuration: number;
  /** 剩餘存活時間（毫秒） */
  private lifeRemaining: number;
  /** 距離下次 tick 的剩餘時間（毫秒） */
  private tickTimer: number;
  /** 是否已銷毀 */
  private destroyed: boolean = false;

  /** 視覺圖形（建立後只調整 alpha，不重繪） */
  private visual: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    damage: number,
    durationMs: number
  ) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.totalDuration = durationMs;
    this.lifeRemaining = durationMs;
    this.tickTimer = 0; // 生成後立即觸發第一次 tick

    // 建立視覺圖形，只畫一次，之後只改 alpha
    this.visual = scene.add.graphics();
    this.visual.setDepth(4);
    this.visual.fillStyle(0x22ff44, 0.35);
    this.visual.fillCircle(x, y, radius);
    this.visual.lineStyle(2, 0x44ff66, 0.6);
    this.visual.strokeCircle(x, y, radius);
    this.visual.setAlpha(1.0);
  }

  /**
   * 每幀更新毒霧狀態
   * @param delta 幀時間差（毫秒）
   * @param enemies 場上所有存活敵人
   * @param deadEnemies 本幀已死亡的敵人（避免重複處理）
   * @returns { alive, newDead }
   */
  public update(
    delta: number,
    enemies: Enemy[],
    deadEnemies: Enemy[]
  ): { alive: boolean; newDead: Enemy[] } {
    const newDead: Enemy[] = [];

    this.lifeRemaining -= delta;
    this.tickTimer -= delta;

    // tick 到期：對範圍內敵人造成傷害
    if (this.tickTimer <= 0) {
      this.tickTimer = CLOUD_TICK_MS;

      for (const enemy of enemies) {
        if (deadEnemies.includes(enemy)) continue;
        if (enemy.isDying) continue;

        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.radius + enemy.collisionRadius) {
          const died = enemy.takeDamage(this.damage, this.x, this.y);
          if (died && !deadEnemies.includes(enemy) && !newDead.includes(enemy)) {
            newDead.push(enemy);
          }
        }
      }
    }

    // 視覺淡出：只用 setAlpha()，不重繪圓形
    const lifeRatio = Math.max(0, this.lifeRemaining / this.totalDuration);
    this.visual.setAlpha(lifeRatio);

    if (this.lifeRemaining <= 0) {
      return { alive: false, newDead };
    }

    return { alive: true, newDead };
  }

  /** 銷毀毒霧（移除視覺物件） */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.visual.destroy();
  }
}
