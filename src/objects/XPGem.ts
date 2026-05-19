import Phaser from 'phaser';

/**
 * XPGem（經驗球）遊戲物件
 * 繼承 Phaser.GameObjects.Rectangle（透明碰撞體，12×12）
 * 視覺圖形優先使用 'xp_gem' texture（Image），fallback 為 Graphics
 * 持有 expValue（整數），進入玩家拾取範圍後以 200px/s 磁吸移動
 */
export class XPGem extends Phaser.GameObjects.Rectangle {
  public expValue: number;
  public isAttracting: boolean;

  private static readonly ATTRACT_SPEED = 200;

  /** 視覺圖形（Image 或 Graphics） */
  private visual!: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  /** 防重複 destroy */
  private _destroyed: boolean = false;
  /** 防重複 destroy（別名，與 _destroyed 同步） */
  private destroyedFlag: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, expValue: number) {
    // 透明碰撞體 12×12
    super(scene, x, y, 12, 12, 0x000000, 0);

    this.expValue = expValue;
    this.isAttracting = false;

    scene.add.existing(this);

    // 優先使用 texture，fallback 為 Graphics
    if (scene.textures.exists('xp_gem')) {
      const img = scene.add.image(x, y, 'xp_gem');
      img.setDepth(3);
      img.setDisplaySize(16, 16);
      this.visual = img;
    } else {
      const g = scene.add.graphics();
      this.drawFallbackVisual(g, x, y);
      this.visual = g;
    }
  }

  /**
   * fallback：繪製發光小圓點（texture 不存在時使用）
   */
  private drawFallbackVisual(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.clear();
    g.fillStyle(0x44ff88, 0.35); g.fillCircle(0, 0, 8);
    g.fillStyle(0x22ee66, 0.85); g.fillCircle(0, 0, 5);
    g.fillStyle(0xffffff, 0.9);  g.fillCircle(0, 0, 2);
    g.setPosition(x, y);
    g.setDepth(3);
  }

  /**
   * 同步視覺圖形位置
   */
  private syncVisual(): void {
    if (this.visual && this.visual.active) {
      this.visual.setPosition(this.x, this.y);
    }
  }

  /**
   * 銷毀時同步清除視覺圖形（防重複 destroy）
   */
  public destroy(fromScene?: boolean): void {
    if (this._destroyed || this.destroyedFlag) return;
    this._destroyed = true;
    this.destroyedFlag = true;
    if (this.visual && this.visual.active) {
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
