import Phaser from 'phaser';

/**
 * VirtualJoystick — 全螢幕浮動虛擬搖桿
 *
 * 行為：
 * - 預設隱藏，玩家按下螢幕任意空白位置時以按下點為中心顯示
 * - 拖曳時搖桿圓點跟隨手指，最大偏移 BASE_RADIUS（60px）
 * - 放開手指後隱藏搖桿，輸出向量歸零
 * - 若按下位置落在 UI 排除區域內，不觸發搖桿
 * - 偏移量 < 死區（12px）時視為無輸入，回傳 {x:0, y:0}
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
  private readonly DEAD_ZONE = 12;

  /** 底座圖形（浮動，按下時才顯示） */
  private baseGraphic!: Phaser.GameObjects.Graphics;

  /** 旋鈕圖形 */
  private knobGraphic!: Phaser.GameObjects.Graphics;

  /** 當前搖桿中心（按下時設定） */
  private baseX: number = 0;
  private baseY: number = 0;

  /** 當前旋鈕偏移量 */
  private offsetX: number = 0;
  private offsetY: number = 0;

  /** 是否有觸控輸入中 */
  private isTouching: boolean = false;

  /** 追蹤中的 pointer ID（避免多點觸控干擾） */
  private activePointerId: number = -1;

  /**
   * UI 排除區域（矩形陣列）
   * 若 pointerdown 落在這些區域內，不觸發搖桿
   * 格式：{ x, y, w, h }，x/y 為左上角座標
   */
  private uiZones: Array<{ x: number; y: number; w: number; h: number }> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createGraphics();
    this.setupInputListeners();
  }

  /**
   * 設定 UI 排除區域（由 GameScene 在 HUD 建立後呼叫）
   * 落在這些區域內的 pointerdown 不會觸發搖桿
   */
  public setUIZones(zones: Array<{ x: number; y: number; w: number; h: number }>): void {
    this.uiZones = zones;
  }

  /**
   * 建立底座與旋鈕圖形（預設隱藏）
   */
  private createGraphics(): void {
    // 底座：半透明圓形，alpha 0.45
    this.baseGraphic = this.scene.add.graphics();
    this.baseGraphic.fillStyle(0xffffff, 0.20);
    this.baseGraphic.fillCircle(0, 0, this.BASE_RADIUS);
    this.baseGraphic.lineStyle(2.5, 0xffffff, 0.55);
    this.baseGraphic.strokeCircle(0, 0, this.BASE_RADIUS);
    // 內圈輔助線
    this.baseGraphic.lineStyle(1, 0xffffff, 0.20);
    this.baseGraphic.strokeCircle(0, 0, this.BASE_RADIUS * 0.5);
    this.baseGraphic.setScrollFactor(0);
    this.baseGraphic.setDepth(50);
    this.baseGraphic.setVisible(false);

    // 旋鈕：較亮的圓形，alpha 0.75
    this.knobGraphic = this.scene.add.graphics();
    this.knobGraphic.fillStyle(0xffffff, 0.75);
    this.knobGraphic.fillCircle(0, 0, this.KNOB_RADIUS);
    this.knobGraphic.lineStyle(2, 0xffffff, 0.9);
    this.knobGraphic.strokeCircle(0, 0, this.KNOB_RADIUS);
    this.knobGraphic.setScrollFactor(0);
    this.knobGraphic.setDepth(51);
    this.knobGraphic.setVisible(false);
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
   * 判斷座標是否落在 UI 排除區域內
   */
  private isInUIZone(x: number, y: number): boolean {
    for (const zone of this.uiZones) {
      if (x >= zone.x && x <= zone.x + zone.w &&
          y >= zone.y && y <= zone.y + zone.h) {
        return true;
      }
    }
    return false;
  }

  /**
   * 觸控按下：以按下位置為搖桿中心，顯示搖桿
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // 若已有觸控中，忽略新的觸控
    if (this.isTouching) return;

    // 若按在 UI 排除區域內，不觸發搖桿
    if (this.isInUIZone(pointer.x, pointer.y)) return;

    this.isTouching = true;
    this.activePointerId = pointer.id;
    this.offsetX = 0;
    this.offsetY = 0;

    // 以按下位置為搖桿中心
    this.baseX = pointer.x;
    this.baseY = pointer.y;

    // 顯示搖桿
    this.baseGraphic.setPosition(this.baseX, this.baseY);
    this.baseGraphic.setVisible(true);
    this.knobGraphic.setPosition(this.baseX, this.baseY);
    this.knobGraphic.setVisible(true);
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
   * 觸控結束：隱藏搖桿，輸出向量歸零
   */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) return;

    this.isTouching = false;
    this.activePointerId = -1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 隱藏搖桿
    this.baseGraphic.setVisible(false);
    this.knobGraphic.setVisible(false);
  }

  /**
   * 取得當前移動向量（已正規化）
   * - 偏移量 < 死區（12px）時回傳 {x:0, y:0}
   * - 偏移量 ≥ 死區時，正規化偏移向量作為移動方向
   */
  public getVector(): { x: number; y: number } {
    const dist = Math.sqrt(this.offsetX * this.offsetX + this.offsetY * this.offsetY);

    if (dist < this.DEAD_ZONE) {
      return { x: 0, y: 0 };
    }

    return {
      x: this.offsetX / dist,
      y: this.offsetY / dist,
    };
  }

  /**
   * 顯示或隱藏搖桿（外部控制用，例如暫停時強制隱藏）
   */
  public setVisible(visible: boolean): void {
    if (!visible) {
      // 強制隱藏時也重置觸控狀態
      this.isTouching = false;
      this.activePointerId = -1;
      this.offsetX = 0;
      this.offsetY = 0;
    }
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

    if (this.baseGraphic && this.baseGraphic.active) this.baseGraphic.destroy();
    if (this.knobGraphic && this.knobGraphic.active) this.knobGraphic.destroy();
  }
}
