import Phaser from 'phaser';
import { Player } from './Player';

/**
 * EliteLineAttack — 二當家（shooter Boss）的單發直線射擊（狙擊型）技能
 *
 * 從 Boss 自身位置沿鎖定方向發射一次高傷害直線攻擊。
 * 流程：
 *   1. showWarning()  → 顯示紅 / 橘紅警示線（約 1.3 秒）
 *   2. activate()     → 發射亮色光束，啟動傷害判定（0.2 秒，僅命中一次）
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

  /** 是否已造成傷害：確保整段攻擊只在射擊瞬間命中一次，不每幀持續傷害 */
  private hasDealtDamage: boolean = false;

  /** 預警倒數計時（ms），> 0 表示預警中 */
  private warningTimer: number = 0;

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
   * 顯示預警線，預警倒數由 update() 負責計時（不用 delayedCall，暫停時正確停止）
   */
  public showWarning(): void {
    if (this.isDead) return;

    // 設定預警倒數（由 update() 累積，暫停時自動停止）
    this.warningTimer = this.warningTime;

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const endX = this.startX + cos * this.length;
    const endY = this.startY + sin * this.length;

    // 預警線：紅 / 橘紅半透明（清楚但不過亮）
    const g = this.scene.add.graphics();
    g.setDepth(18);

    // 外層光暈（橘紅，低透明度）
    g.lineStyle(this.width + 6, 0xff6600, 0.16);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 主預警線（紅色）
    g.lineStyle(3, 0xff3322, 0.55);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 起點箭頭提示（小三角，指向射擊方向）
    g.fillStyle(0xff8844, 0.7);
    g.fillTriangle(
      this.startX + cos * 12 - sin * 8,
      this.startY + sin * 12 + cos * 8,
      this.startX + cos * 12 + sin * 8,
      this.startY + sin * 12 - cos * 8,
      this.startX + cos * 28,
      this.startY + sin * 28
    );

    this.warningGraphic = g;

    // 預警線淡入淡出閃爍動畫
    this.scene.tweens.add({
      targets: g,
      alpha: 0.35,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
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

    // 攻擊線：亮黃白核心 + 橘紅光暈（比警示線更亮，快速光束）
    const g = this.scene.add.graphics();
    g.setDepth(19);

    // 外層光暈（橘紅）
    g.lineStyle(this.width + 10, 0xff7722, 0.30);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 主攻擊線（亮橘黃）
    g.lineStyle(this.width, 0xffcc44, 0.9);
    g.lineBetween(this.startX, this.startY, endX, endY);

    // 內層白色核心
    g.lineStyle(Math.max(2, this.width - 12), 0xffffff, 0.95);
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
   * 每幀更新：預警倒數 → 啟動攻擊 → 傷害判定
   * 由 GameScene._updateInternal() 呼叫，暫停時不呼叫，計時自然停止
   */
  public update(delta: number, player: Player, alreadyHit: boolean): { shouldDestroy: boolean; hit: boolean } {
    if (this.isDead) return { shouldDestroy: true, hit: false };

    // 預警倒數階段
    if (!this.isActive) {
      this.warningTimer -= delta;
      if (this.warningTimer <= 0) {
        this.activate();
      }
      return { shouldDestroy: false, hit: false };
    }

    // 傷害判定階段（僅命中一次）
    this.activeTimer -= delta;

    let hit = false;
    if (!alreadyHit && !this.hasDealtDamage && this.checkHitPlayer(player)) {
      hit = true;
      this.hasDealtDamage = true;
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
