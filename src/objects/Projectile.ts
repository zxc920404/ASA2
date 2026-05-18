import Phaser from 'phaser';
import { Enemy } from '../objects/Enemy';

/**
 * Projectile 遊戲物件
 * 繼承 Phaser.GameObjects.Rectangle 作為佔位圖形
 * 持有傷害值、速度向量、存活時間（Requirement 5.1、5.3）
 */
export class Projectile extends Phaser.GameObjects.Rectangle {
  /** 此投射物造成的傷害值 */
  public damage: number;
  /** X 軸速度（px/s） */
  public velocityX: number;
  /** Y 軸速度（px/s） */
  public velocityY: number;
  /** 剩餘存活時間（毫秒），-1 表示無限制 */
  public lifeTime: number;
  /** 武器 ID，用於識別武器類型 */
  public weaponId: string;
  /** 是否為範圍爆炸型（赤焰印） */
  public isExplosive: boolean;
  /** 爆炸半徑（px），僅 isExplosive 時有效 */
  public explosionRadius: number;
  /** 目標位置 X（赤焰印用） */
  public targetX: number;
  /** 目標位置 Y（赤焰印用） */
  public targetY: number;
  /** 是否已爆炸（防止重複爆炸） */
  public hasExploded: boolean;

  /**
   * 剩餘穿透次數（寒冰錐用）
   * 0 表示不穿透（命中即銷毀）；> 0 表示還能繼續穿透的次數
   */
  public pierceRemaining: number;

  /**
   * 已命中的敵人集合（寒冰錐用）
   * 防止同一發投射物對同一敵人重複造成傷害
   */
  public hitEnemies: Set<Enemy>;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    damage: number,
    velocityX: number,
    velocityY: number,
    lifeTime: number,
    weaponId: string,
    color: number = 0xffff00,
    isExplosive: boolean = false,
    explosionRadius: number = 0,
    targetX: number = 0,
    targetY: number = 0,
    pierceRemaining: number = 0
  ) {
    // 投射物尺寸依武器類型調整（更明顯）
    const size = isExplosive ? 12 : 10;
    super(scene, x, y, size, size, color);

    this.damage = damage;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.lifeTime = lifeTime;
    this.weaponId = weaponId;
    this.isExplosive = isExplosive;
    this.explosionRadius = explosionRadius;
    this.targetX = targetX;
    this.targetY = targetY;
    this.hasExploded = false;
    this.pierceRemaining = pierceRemaining;
    this.hitEnemies = new Set<Enemy>();

    scene.add.existing(this);
    this.setDepth(6);
  }

  /**
   * 每幀更新投射物位置與存活時間
   * @param delta 幀時間差（毫秒）
   * @returns false 表示投射物應被移除
   */
  public updateProjectile(delta: number): boolean {
    const dt = delta / 1000;

    // 更新位置（使用 setPosition 確保 Phaser 正確追蹤座標）
    this.setPosition(
      this.x + this.velocityX * dt,
      this.y + this.velocityY * dt
    );

    // 更新存活時間
    if (this.lifeTime > 0) {
      this.lifeTime -= delta;
      if (this.lifeTime <= 0) {
        return false; // 存活時間到期
      }
    }

    return true; // 仍然存活
  }
}
