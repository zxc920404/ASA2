import Phaser from 'phaser';

/**
 * XPGem（經驗球）遊戲物件
 * 繼承 Phaser.GameObjects.Rectangle（透明碰撞體，12×12）
 * 視覺圖形為發光小圓點（Graphics）
 * 持有 expValue（整數），進入玩家拾取範圍後以 200px/s 磁吸移動（Requirement 9.1、9.3）
 */
export class XPGem extends Phaser.GameObjects.Rectangle {
  public expValue: number;
  public isAttracting: boolean;

  private static readonly ATTRACT_SPEED = 200;

  /** 視覺圖形（發光圓點） */
  private visual!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, expValue: number) {
    // 透明碰撞體 12×12
    super(scene, x, y, 12, 12, 0x000000, 0);

    this.expValue = expValue;
    this.isAttracting = false;

    scene.add.existing(this);

    // 建立發光圓點視覺
    this.visual = scene.add.graphics();
    this.drawVisual();
  }

  /**
   * 繪製發光小圓點
   */
  private drawVisual(): void {
    const g = this.visual;
    g.clear();

    // 外圈光暈（半透明亮綠，半徑 8px）
    g.fillStyle(0x44ff88, 0.35);
    g.fillCircle(0, 0, 8);

    // 中圈（亮綠，半徑 5px）
    g.fillStyle(0x22ee66, 0.85);
    g.fillCircle(0, 0, 5);

    // 中心白點（半徑 2px）
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, 0, 2);

    g.setPosition(this.x, this.y);
    g.setDepth(3);
  }

  /**
   * 同步視覺圖形位置
   */
  private syncVisual(): void {
    if (this.visual) {
      this.visual.setPosition(this.x, this.y);
    }
  }

  /**
   * 銷毀時同步清除視覺圖形
   */
  public destroy(fromScene?: boolean): void {
    if (this.visual) {
      this.visual.destroy();
    }
    super.destroy(fromScene);
  }

  /**
   * 每幀更新：若已進入磁吸狀態，朝玩家位置移動
   * @returns 是否已到達玩家位置（可被吸收）
   */
  public updateAttract(playerX: number, playerY: number, delta: number): boolean {
    if (!this.isAttracting) return false;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) return true;

    const dt = delta / 1000;
    const nx = dx / dist;
    const ny = dy / dist;

    const newX = this.x + nx * XPGem.ATTRACT_SPEED * dt;
    const newY = this.y + ny * XPGem.ATTRACT_SPEED * dt;
    this.setPosition(newX, newY);

    this.syncVisual();

    return false;
  }
}
