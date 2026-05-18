import Phaser from 'phaser';
import { CharacterData, EquipmentSlot, PlayerStats } from '../types/index';
import { calculateStats } from '../systems/StatCalculator';

/**
 * Player 遊戲物件
 * 繼承 Phaser.GameObjects.Rectangle（透明碰撞體，32×32）
 * 視覺圖形由 Graphics 繪製，跟隨 Rectangle 位置
 */
export class Player extends Phaser.GameObjects.Rectangle {
  public characterId: string;
  public currentHP: number;
  public level: number;
  public currentExp: number;
  public equipment: EquipmentSlot;
  public stats: PlayerStats;

  private charData: CharacterData;

  /** 視覺圖形（武俠人形佔位） */
  private visual!: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    charData: CharacterData
  ) {
    // 透明碰撞體 32×32（不顯示）
    super(scene, x, y, 32, 32, 0x000000, 0);

    this.charData = charData;
    this.characterId = charData.id;
    this.level = 1;
    this.currentExp = 0;

    // 初始裝備欄：僅持有初始武器 Lv1，被動欄為空（Requirement 4.3）
    this.equipment = {
      weapons: [{ weaponId: charData.startingWeaponId, level: 1 }],
      passives: [],
    };

    // 計算初始屬性
    this.stats = calculateStats(charData, this.equipment);
    this.currentHP = this.stats.maxHP;

    // 加入場景並啟用
    scene.add.existing(this);

    // 建立視覺圖形
    this.visual = scene.add.graphics();
    this.drawVisual();
  }

  /**
   * 繪製武俠人形視覺圖形
   */
  private drawVisual(): void {
    const g = this.visual;
    g.clear();

    // 身體光暈（外圈，半透明）
    g.fillStyle(0x4488ff, 0.15);
    g.fillCircle(0, 0, 20);

    // 腿部
    g.fillStyle(0x223366, 1);
    g.fillRect(-7, 10, 5, 10);
    g.fillRect(2, 10, 5, 10);

    // 身體
    g.fillStyle(0x2255aa, 1);
    g.fillRect(-9, -4, 18, 16);

    // 頭部
    g.fillStyle(0xddccaa, 1);
    g.fillCircle(0, -12, 9);

    // 劍（金色細長矩形）
    g.fillStyle(0xffd700, 1);
    g.fillRect(10, -18, 3, 26);
    // 劍柄護手
    g.fillRect(7, -4, 9, 3);

    // 腰帶
    g.fillStyle(0xd4af37, 0.8);
    g.fillRect(-9, 4, 18, 3);

    // 更新位置
    g.setPosition(this.x, this.y);
    g.setDepth(5);
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
   * 重新計算屬性（裝備變更後呼叫）
   */
  public recalculateStats(): void {
    this.stats = calculateStats(this.charData, this.equipment);
  }

  /**
   * 每幀移動更新（僅鍵盤輸入，保留向下相容）
   */
  public move(
    cursors: {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
    },
    delta: number,
    worldWidth: number,
    worldHeight: number
  ): void {
    this.moveWithVector(cursors, { x: 0, y: 0 }, delta, worldWidth, worldHeight);
  }

  /**
   * 每幀移動更新（鍵盤 + 搖桿合併輸入）
   */
  public moveWithVector(
    cursors: {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
    },
    joystickVec: { x: number; y: number },
    delta: number,
    worldWidth: number,
    worldHeight: number
  ): void {
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown) vx -= 1;
    if (cursors.right.isDown) vx += 1;
    if (cursors.up.isDown) vy -= 1;
    if (cursors.down.isDown) vy += 1;

    vx += joystickVec.x;
    vy += joystickVec.y;

    if (vx === 0 && vy === 0) return;

    const len = Math.sqrt(vx * vx + vy * vy);
    vx /= len;
    vy /= len;

    const speed = this.stats.moveSpeed;
    const dt = delta / 1000;

    let newX = this.x + vx * speed * dt;
    let newY = this.y + vy * speed * dt;

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    newX = Phaser.Math.Clamp(newX, halfW, worldWidth - halfW);
    newY = Phaser.Math.Clamp(newY, halfH, worldHeight - halfH);

    this.setPosition(newX, newY);
    this.syncVisual();
  }
}
