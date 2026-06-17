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

  /**
   * 毒霧持續時間（毫秒，毒霧散用）
   * 投射物到達目標後生成的 PoisonCloud 使用此值
   */
  public cloudDuration: number;

  // ── 驚鴻派大道：分裂投射物狀態 ──────────────────────────────────────
  /** 是否為分裂投射物（分裂子彈不可再次分裂） */
  public isSplitProjectile: boolean;
  /** 分裂深度（0 = 原始投射物，1 = 分裂子彈，防止無限遞迴） */
  public splitDepth: number;
  /** 來源武器 ID（分裂子彈繼承原始投射物的武器 ID） */
  public sourceWeaponId: string;
  /** 是否已觸發過分裂（每顆原始投射物最多分裂一次） */
  public hasSplit: boolean;

  // ── 返還投射物狀態（流光返刃用）──────────────────────────────────────
  /** 是否啟用返還機制 */
  public canReturn: boolean;
  /** 是否正在返還（回程中） */
  public isReturning: boolean;
  /** 是否已完成返還（防止重複返還） */
  public hasReturned: boolean;
  /** 返還傷害倍率（回程傷害 = 去程傷害 × returnDamageMultiplier） */
  public returnDamageMultiplier: number;
  /**
   * 折返時機：
   * - false（預設，流光返刃）：命中第一個敵人後立即折返
   * - true（流光梭）：去程穿透敵人不折返，直到飛抵最大射程才折返
   */
  public returnsAtRange: boolean;
  /** 去程命中的敵人集合（防止回程對同一敵人重複傷害） */
  public outboundHitEnemies: Set<Enemy>;
  /** 回程命中的敵人集合（防止回程對同一敵人重複傷害） */
  public returnHitEnemies: Set<Enemy>;

  // ── 霜裂冰痕狀態（霜裂冰錐用）──────────────────────────────────────
  /** 是否啟用霜裂冰痕機制 */
  public hasFrostCrack: boolean;
  /** 霜裂冰痕爆裂傷害（已套用 attackPower） */
  public crackDamage: number;
  /** 霜裂冰痕爆裂半徑（已套用 areaMultiplier） */
  public crackRadius: number;
  /** 霜裂冰痕爆裂延遲（秒） */
  public crackDelay: number;

  // ── 視覺：拖尾效果（純視覺，不影響碰撞判定）──────────────────────────
  /** 拖尾繪圖物件（每幀清除重繪，不新建物件） */
  private trailGfx?: Phaser.GameObjects.Graphics;
  /** 拖尾近期座標點（最多保留數點） */
  private trailPoints: { x: number; y: number }[] = [];
  /** 拖尾顏色 */
  private trailColor: number = 0xffffff;

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
    this.cloudDuration = 0;

    // 返還狀態初始化
    this.canReturn = false;
    this.isReturning = false;
    this.hasReturned = false;
    this.returnDamageMultiplier = 0.7;
    this.outboundHitEnemies = new Set<Enemy>();
    this.returnHitEnemies = new Set<Enemy>();
    this.returnsAtRange = false;

    // 驚鴻派大道：分裂狀態初始化
    this.isSplitProjectile = false;
    this.splitDepth = 0;
    this.sourceWeaponId = weaponId;
    this.hasSplit = false;

    // 霜裂冰痕狀態初始化
    this.hasFrostCrack = false;
    this.crackDamage = 0;
    this.crackRadius = 0;
    this.crackDelay = 0.25;

    scene.add.existing(this);
    this.setDepth(6);

    // ── 視覺造型：非爆炸、非毒霧投射物拉長並朝飛行方向旋轉（刃/錐/針感）──
    // 純視覺調整，碰撞判定使用中心點與敵人半徑，不受顯示尺寸影響。
    if (!isExplosive && weaponId !== 'poison_mist') {
      this.setSize(16, 5);
      this.setRotation(Math.atan2(velocityY, velocityX));
    }
  }

  /**
   * 啟用拖尾效果（純視覺）。由 WeaponSystem 在 addProjectile 時呼叫。
   * 使用單一 Graphics 每幀清除重繪，不會每幀新建物件。
   */
  public enableTrailEffect(color: number): void {
    this.trailColor = color;
    if (!this.trailGfx) {
      this.trailGfx = this.scene.add.graphics();
      this.trailGfx.setDepth(5); // 在投射物（depth 6）下方
    }
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

    // 視覺：朝目前飛行方向旋轉（返還/追尾改變方向時造型同步）
    if (this.width !== this.height) {
      this.setRotation(Math.atan2(this.velocityY, this.velocityX));
    }

    // 視覺：更新拖尾（清除重繪，不新建物件）
    if (this.trailGfx && this.trailGfx.active) {
      this.trailPoints.push({ x: this.x, y: this.y });
      if (this.trailPoints.length > 6) this.trailPoints.shift();
      const g = this.trailGfx;
      g.clear();
      const n = this.trailPoints.length;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        g.lineStyle(3 * t, this.trailColor, 0.45 * t);
        g.lineBetween(
          this.trailPoints[i - 1].x, this.trailPoints[i - 1].y,
          this.trailPoints[i].x, this.trailPoints[i].y
        );
      }
    }

    // 更新存活時間
    if (this.lifeTime > 0) {
      this.lifeTime -= delta;
      if (this.lifeTime <= 0) {
        return false; // 存活時間到期
      }
    }

    return true; // 仍然存活
  }

  /**
   * 銷毀投射物時一併清除拖尾 Graphics，避免殘留物件。
   */
  public destroy(fromScene?: boolean): void {
    if (this.trailGfx) {
      this.trailGfx.destroy();
      this.trailGfx = undefined;
    }
    super.destroy(fromScene);
  }

  /**
   * 從來源投射物繼承所有機制 flag（驚鴻派分裂子彈用）
   *
   * 繼承項目：
   * - returning：canReturn / returnDamageMultiplier（流光返刃）
   * - pierce：pierceRemaining（寒冰錐 / 流光梭）
   * - frostCrack：hasFrostCrack / crackDamage / crackRadius / crackDelay（霜裂冰錐）
   *
   * 不繼承項目（分裂子彈專屬限制）：
   * - isSplitProjectile / splitDepth / hasSplit（防止無限分裂，由呼叫端設定）
   * - damage / velocityX / velocityY / lifeTime（由呼叫端依分裂比例設定）
   * - hitEnemies / outboundHitEnemies / returnHitEnemies（各自獨立的命中記錄）
   *
   * 新增武器機制時，若該機制需要被分裂子彈繼承，請在此方法加入對應欄位。
   *
   * @param source 原始投射物
   */
  public inheritMechanicsFrom(source: Projectile): void {
    // ── returning（流光返刃）────────────────────────────────────────────
    this.canReturn = source.canReturn;
    this.returnDamageMultiplier = source.returnDamageMultiplier;
    this.returnsAtRange = source.returnsAtRange;
    // isReturning / hasReturned 保持預設 false（分裂子彈從去程開始）

    // ── pierce（寒冰錐 / 流光梭）────────────────────────────────────────
    // 分裂子彈繼承來源的穿透次數（已在 spawnSplitProjectiles 中設為 0，
    // 此處覆蓋為來源值，讓分裂子彈也能穿透）
    this.pierceRemaining = source.pierceRemaining;

    // ── frostCrack（霜裂冰錐）───────────────────────────────────────────
    this.hasFrostCrack = source.hasFrostCrack;
    this.crackDamage = source.crackDamage;
    this.crackRadius = source.crackRadius;
    this.crackDelay = source.crackDelay;
  }
}
