import Phaser from 'phaser';
import { Player } from './Player';

/**
 * EliteLineAttack — shield Boss 的外圍直線射擊技能
 *
 * 攻擊從玩家周圍外側射向玩家施法瞬間的位置。
 * 流程：
 *   1. showWarning()  → 顯示預警線（0.7 秒）
 *   2. activate()     → 啟動傷害判定（0.2 秒）
 *   3. 自動 destroy
 */
export class EliteLineAttack {
  private scene: Phaser.Scene;

  /** 攻擊線起點（玩家外圍） */
  public startX: number;
  public startY: number;

  /** 攻擊方向角度（從外圍射向目標點） */
  private angle: number;

  /** 攻擊線長度（px） */
  private length: number;

  /** 攻擊線寬度（px，用於碰撞判定） */
  private width: number;

  /** 傷害值 */
  private damage: number;

  /** 預警時間（ms） */
  private warningTime: number;

  /** 是否已啟動傷害判定 */
  private isActive: boolean = false;

  /** 是否已銷毀 */
  public isDead: boolean = false;

  /** 傷害判定剩餘時間（ms） */
  private activeTimer: number = 0;
  private readonly ACTIVE_DURATION = 200; // 傷害判定持續 0.2 秒

  /** 預警線 Graphics */
  private warningGraphic?: Phaser.GameObjects.Graphics;
  /** 攻擊線 Graphics */
  private attackGraphic?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    angle: number,
    length: number,
    width: number,
    damage: number,
    warningTime: number
  ) {
    this.scene = scene;
    this.startX = startX;
    this.startY = startY;
    this.angle = angle;
    this.length = length;
    this.width = width;
    this.damage = damage;
    this.warningTime = warningTime;
  }

  /**
   * 顯示預警線，warningTime 後自動呼叫 activate()
   */
  public showWarning(): void {
    if (this.isDead) return;

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const endX = this.startX + cos * this.length;
    const endY = this.startY + sin * this.length;

    // 預警線：紫色虛線效果（兩條線疊加）
    const g = this.scene.add.graphics();
    g.setDepth(18);

    // 外層光暈
    g.lineStyle(this.width + 6, 0xaa00ff, 0.18);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 主預警線（紫色）
    g.lineStyle(3, 0xcc44ff, 0.75);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 起點箭頭提示（小三角）
    g.fillStyle(0xff88ff, 0.85);
    g.fillTriangle(
      this.startX + cos * 12 - sin * 8,
      this.startY + sin * 12 + cos * 8,
      this.startX + cos * 12 + sin * 8,
      this.startY + sin * 12 - cos * 8,
      this.startX + cos * 28,
      this.startY + sin * 28
    );

    this.warningGraphic = g;

    // 預警線閃爍動畫
    this.scene.tweens.add({
      targets: g,
      alpha: 0.4,
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // warningTime 後啟動攻擊
    this.scene.time.delayedCall(this.warningTime, () => {
      if (this.isDead) return;
      if (!this.scene || !this.scene.scene.isActive()) return;
      this.activate();
    });
  }

  /**
   * 啟動傷害判定，顯示攻擊線
   */
  public activate(): void {
    if (this.isDead) return;

    // 移除預警線
    if (this.warningGraphic && this.warningGraphic.active) {
      this.scene.tweens.killTweensOf(this.warningGraphic);
      this.warningGraphic.destroy();
      this.warningGraphic = undefined;
    }

    this.isActive = true;
    this.activeTimer = this.ACTIVE_DURATION;

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const endX = this.startX + cos * this.length;
    const endY = this.startY + sin * this.length;

    // 攻擊線：亮白 + 紫色光暈
    const g = this.scene.add.graphics();
    g.setDepth(19);

    // 外層光暈
    g.lineStyle(this.width + 10, 0xdd88ff, 0.25);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 主攻擊線（亮白）
    g.lineStyle(this.width, 0xffffff, 0.95);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 內層紫色核心
    g.lineStyle(Math.max(2, this.width - 8), 0xee88ff, 0.8);
    g.lineBetween(this.startX, this.startY, endX, endY);

    this.attackGraphic = g;

    // 攻擊線快速淡出
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: this.ACTIVE_DURATION,
      ease: 'Power2',
      onComplete: () => {
        if (g && g.active) g.destroy();
      },
    });
  }

  /**
   * 每幀更新：計時 + 傷害判定
   * @returns true 表示應該銷毀
   */
  public update(delta: number, player: Player, alreadyHit: boolean): { shouldDestroy: boolean; hit: boolean } {
    if (this.isDead) return { shouldDestroy: true, hit: false };

    if (!this.isActive) {
      // 預警中，不造成傷害
      return { shouldDestroy: false, hit: false };
    }

    this.activeTimer -= delta;

    let hit = false;
    if (!alreadyHit) {
      hit = this.checkHitPlayer(player);
    }

    if (this.activeTimer <= 0) {
      return { shouldDestroy: true, hit };
    }

    return { shouldDestroy: false, hit };
  }

  /**
   * 幾何投影判斷玩家是否在線段範圍內
   */
  public checkHitPlayer(player: Player): boolean {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    const dx = player.x - this.startX;
    const dy = player.y - this.startY;

    // 沿攻擊方向的投影（along）
    const along = dx * cos + dy * sin;
    // 垂直距離（perpendicular）
    const perp = Math.abs(-dx * sin + dy * cos);

    return along >= 0 && along <= this.length && perp <= this.width / 2 + 8;
  }

  public getDamage(): number {
    return this.damage;
  }

  public destroy(): void {
    if (this.isDead) return;
    this.isDead = true;

    if (this.warningGraphic && this.warningGraphic.active) {
      this.scene.tweens.killTweensOf(this.warningGraphic);
      this.warningGraphic.destroy();
      this.warningGraphic = undefined;
    }
    if (this.attackGraphic && this.attackGraphic.active) {
      this.scene.tweens.killTweensOf(this.attackGraphic);
      this.attackGraphic.destroy();
      this.attackGraphic = undefined;
    }
  }
}
