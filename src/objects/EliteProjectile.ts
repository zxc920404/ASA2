import Phaser from 'phaser';

/** 場上精英投射物上限（避免 FPS 掉） */
const MAX_ELITE_PROJECTILES = 45;

/** 全域精英投射物計數 */
let activeEliteProjectiles = 0;
/** 全域精英投射物列表（用於超限時移除最舊） */
const allEliteProjectiles: EliteProjectile[] = [];

export function getActiveEliteProjectileCount(): number {
  return activeEliteProjectiles;
}

/** 超過上限時移除最舊的投射物，回傳是否有空位 */
export function evictOldestIfNeeded(): boolean {
  if (activeEliteProjectiles < MAX_ELITE_PROJECTILES) return true;
  const oldest = allEliteProjectiles[0];
  if (oldest && !oldest.isDead) {
    oldest.destroy();
  }
  return true;
}

/**
 * 重置全域精英投射物狀態（場景重啟 / 新局開始時呼叫）
 * 清除跨場景殘留的計數與引用，確保新局投射物上限判斷正確
 */
export function resetEliteProjectileGlobals(): void {
  activeEliteProjectiles = 0;
  allEliteProjectiles.length = 0;
}

/**
 * EliteProjectile — 精英怪（shooter）發射的敵方投射物
 * 繼承 Phaser.GameObjects.Rectangle（透明碰撞體，12×12）
 * 視覺為紫色光球
 * 飛行 3 秒或超出射程後自動銷毀
 */
export class EliteProjectile extends Phaser.GameObjects.Rectangle {
  public damage: number;
  public velocityX: number;
  public velocityY: number;

  /** 是否已標記銷毀（防止重複處理） */
  public isDead: boolean = false;

  /** 剩餘存活時間（毫秒） */
  private lifetime: number = 3000;

  /** 視覺圖形 */
  private visual!: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    damage: number
  ) {
    super(scene, x, y, 12, 12, 0x000000, 0);

    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.damage = damage;

    scene.add.existing(this);

    this.visual = scene.add.graphics();
    this.drawVisual();

    activeEliteProjectiles++;
    allEliteProjectiles.push(this);
  }

  private drawVisual(): void {
    const g = this.visual;
    g.clear();
    // 外圈紫色光暈
    g.fillStyle(0xaa44ff, 0.35);
    g.fillCircle(0, 0, 9);
    // 中圈
    g.fillStyle(0x8822dd, 0.85);
    g.fillCircle(0, 0, 6);
    // 中心白點
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, 0, 2);
    g.setPosition(this.x, this.y);
    g.setDepth(8);
  }

  private syncVisual(): void {
    if (this.visual && this.visual.active) {
      this.visual.setPosition(this.x, this.y);
    }
  }

  /**
   * 每幀更新：移動 + 計時
   * @returns true 表示應該銷毀
   */
  public updateProjectile(delta: number): boolean {
    if (this.isDead) return true;

    const dt = delta / 1000;
    this.setPosition(this.x + this.velocityX * dt, this.y + this.velocityY * dt);
    this.syncVisual();

    this.lifetime -= delta;
    return this.lifetime <= 0;
  }

  public destroy(fromScene?: boolean): void {
    if (!this.isDead) {
      this.isDead = true;
      activeEliteProjectiles = Math.max(0, activeEliteProjectiles - 1);
      const idx = allEliteProjectiles.indexOf(this);
      if (idx !== -1) allEliteProjectiles.splice(idx, 1);
    }
    if (this.visual && this.visual.active) {
      this.visual.destroy();
    }
    super.destroy(fromScene);
  }
}
