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

  /** 視覺圖形（建立後只調整 alpha 與 scale，不重繪） */
  private visual: Phaser.GameObjects.Graphics;
  /** 場景引用（用於 tick 時生成綠色小毒點） */
  private scene: Phaser.Scene;
  /** 呼吸縮放 tween（destroy 時需停止，避免操作已銷毀物件） */
  private breatheTween?: Phaser.Tweens.Tween;

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
    this.scene = scene;

    // 建立視覺圖形：以本地原點 (0,0) 繪製、setPosition 定位，
    // 如此可用 setScale 做輕微呼吸縮放而不位移。透明度偏低，不遮住地圖與角色。
    this.visual = scene.add.graphics();
    this.visual.setDepth(4);
    this.visual.fillStyle(0x22ff44, 0.18);
    this.visual.fillCircle(0, 0, radius);
    this.visual.lineStyle(2, 0x44ff66, 0.35);
    this.visual.strokeCircle(0, 0, radius);
    this.visual.setPosition(x, y);
    this.visual.setAlpha(1.0);

    // 輕微呼吸縮放（1.0 ↔ 1.06），營造毒霧緩慢擴散感
    this.breatheTween = scene.tweens.add({
      targets: this.visual,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
          // 受傷回饋：小型綠色毒點，短暫顯示後自動 destroy
          this.spawnPoisonTick(enemy.x, enemy.y);
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
    if (this.breatheTween) {
      this.breatheTween.stop();
      this.breatheTween = undefined;
    }
    this.visual.destroy();
  }

  /**
   * 生成小型綠色毒點（tick 受傷回饋），短暫漂浮後自動 destroy。
   * 僅在 tick（每 0.5 秒）觸發，不會每幀新建。
   */
  private spawnPoisonTick(x: number, y: number): void {
    if (!this.scene || !this.scene.sys?.isActive()) return;
    const dot = this.scene.add.graphics();
    dot.fillStyle(0x66ff88, 0.8);
    dot.fillCircle(0, 0, 3);
    dot.setPosition(x + (Math.random() - 0.5) * 10, y - 6);
    dot.setDepth(7);
    this.scene.tweens.add({
      targets: dot,
      y: dot.y - 12,
      alpha: 0,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}
