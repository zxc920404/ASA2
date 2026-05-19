import Phaser from 'phaser';

/**
 * VirtualJoystick — 觸控虛擬搖桿
 *
 * 規格（tasks.md MVP UI 設計規格）：
 * - 底座：x: W×0.14, y: H×0.75，半徑 60px，觸控區 120×120px
 * - 旋鈕：跟隨觸控偏移，最大偏移 60px，半徑 28px
 * - 偏移量 < 搖桿半徑 × 20%（< 12px）時視為無輸入，回傳 {x:0, y:0}
 * - 偏移量 ≥ 12px 時，正規化偏移向量作為移動方向
 *
 * Validates: Requirement 2.4
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;

  /** 搖桿底座半徑（px） */
  private readonly BASE_RADIUS = 60;

  /** 搖桿旋鈕半徑（px） */
  private readonly KNOB_RADIUS = 28;

  /** 死區：偏移量小於此值視為無輸入（BASE_RADIUS × 20% = 12px） */
  private readonly DEAD_ZONE = 12; // 60 * 0.20

  /** 底座圖形 */
  private baseGraphic!: Phaser.GameObjects.Graphics;

  /** 旋鈕圖形 */
  private knobGraphic!: Phaser.GameObjects.Graphics;

  /** 底座中心位置（固定） */
  private baseX: number = 0;
  private baseY: number = 0;

  /** 當前旋鈕偏移量 */
  private offsetX: number = 0;
  private offsetY: number = 0;

  /** 是否有觸控輸入中 */
  private isTouching: boolean = false;

  /** 追蹤中的 pointer ID（避免多點觸控干擾） */
  private activePointerId: number = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createGraphics();
    this.setupInputListeners();
  }

  /**
   * 建立底座與旋鈕圖形
   */
  private createGraphics(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // 搖桿位置：左下角，基於 960×540 設計解析度
    // x=120（距左邊 120px），y=H-90（距底部 90px）
    this.baseX = 120;
    this.baseY = H - 90;

    // 底座：半透明圓形，alpha 0.4
    this.baseGraphic = this.scene.add.graphics();
    this.baseGraphic.fillStyle(0xffffff, 0.4);
    this.baseGraphic.fillCircle(0, 0, this.BASE_RADIUS);
    this.baseGraphic.lineStyle(2, 0xffffff, 0.6);
    this.baseGraphic.strokeCircle(0, 0, this.BASE_RADIUS);
    this.baseGraphic.setPosition(this.baseX, this.baseY);
    this.baseGraphic.setScrollFactor(0);
    this.baseGraphic.setDepth(50);

    // 旋鈕：較亮的圓形，alpha 0.7
    this.knobGraphic = this.scene.add.graphics();
    this.knobGraphic.fillStyle(0xffffff, 0.7);
    this.knobGraphic.fillCircle(0, 0, this.KNOB_RADIUS);
    this.knobGraphic.setPosition(this.baseX, this.baseY);
    this.knobGraphic.setScrollFactor(0);
    this.knobGraphic.setDepth(51);
  }

  /**
   * 設定觸控輸入監聽
   */
  private setupInputListeners(): void {
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  /**
   * 觸控按下：記錄起始點，啟動搖桿
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // 只接受左半邊螢幕的觸控（搖桿區域）
    const W = this.scene.scale.width;
    if (pointer.x > W * 0.5) return;

    // 若已有觸控中，忽略新的觸控
    if (this.isTouching) return;

    this.isTouching = true;
    this.activePointerId = pointer.id;
    this.offsetX = 0;
    this.offsetY = 0;

    // 更新旋鈕位置至底座中心
    this.knobGraphic.setPosition(this.baseX, this.baseY);
  }

  /**
   * 觸控移動：計算偏移量，限制在半徑內，更新旋鈕位置
   */
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isTouching || pointer.id !== this.activePointerId) return;

    // 計算相對底座中心的偏移
    let dx = pointer.x - this.baseX;
    let dy = pointer.y - this.baseY;

    // 限制偏移量在 BASE_RADIUS 內
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.BASE_RADIUS) {
      const scale = this.BASE_RADIUS / dist;
      dx *= scale;
      dy *= scale;
    }

    this.offsetX = dx;
    this.offsetY = dy;

    // 更新旋鈕位置
    this.knobGraphic.setPosition(this.baseX + dx, this.baseY + dy);
  }

  /**
   * 觸控結束：重置旋鈕至中心，輸出向量歸零
   */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) return;

    this.isTouching = false;
    this.activePointerId = -1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 旋鈕回到底座中心
    this.knobGraphic.setPosition(this.baseX, this.baseY);
  }

  /**
   * 取得當前移動向量（已正規化）
   * - 偏移量 < 死區（12px）時回傳 {x:0, y:0}（Requirement 2.4）
   * - 偏移量 ≥ 死區時，正規化偏移向量作為移動方向
   */
  public getVector(): { x: number; y: number } {
    const dist = Math.sqrt(this.offsetX * this.offsetX + this.offsetY * this.offsetY);

    // 死區判斷（Requirement 2.4：偏移量 < 搖桿半徑 20% 視為無輸入）
    if (dist < this.DEAD_ZONE) {
      return { x: 0, y: 0 };
    }

    // 正規化向量
    return {
      x: this.offsetX / dist,
      y: this.offsetY / dist,
    };
  }

  /**
   * 顯示或隱藏搖桿
   */
  public setVisible(visible: boolean): void {
    this.baseGraphic.setVisible(visible);
    this.knobGraphic.setVisible(visible);
  }

  /**
   * 銷毀搖桿（移除監聽器與圖形）
   */
  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);

    this.baseGraphic.destroy();
    this.knobGraphic.destroy();
  }
}
