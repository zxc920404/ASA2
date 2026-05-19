import Phaser from 'phaser';
import { EnemyData } from '../types/index';

/** 傷害數字同時上限 */
const MAX_DAMAGE_NUMBERS = 25;
/** 全域傷害數字計數（跨所有敵人） */
let activeDamageNumbers = 0;

/**
 * 重置傷害數字計數器（場景重新開始時呼叫）
 * 防止跨場景殘留計數導致傷害數字無法顯示
 */
export function resetDamageNumberCounter(): void {
  activeDamageNumbers = 0;
}

/**
 * Enemy 遊戲物件
 * 繼承 Phaser.GameObjects.Rectangle（透明碰撞體）
 * 視覺圖形由 Graphics 繪製，跟隨 Rectangle 位置
 */
export class Enemy extends Phaser.GameObjects.Rectangle {
  public dataId: string;
  public currentHP: number;
  public lastDamageTime: number;
  public moveSpeed: number;
  public contactDamage: number;
  public collisionRadius: number;

  /** 是否為精英怪（影響外觀與掉落） */
  public isElite: boolean = false;

  /** 視覺圖形 */
  private visual!: Phaser.GameObjects.Graphics;

  /** 是否正在播放死亡特效（防止重複處理） */
  public isDying: boolean = false;

  /** 受擊閃白計時（毫秒，> 0 時顯示白色） */
  private hitFlashTimer: number = 0;

  /** 擊退偏移（世界座標） */
  private knockbackX: number = 0;
  private knockbackY: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    enemyData: EnemyData,
    hpMultiplier: number,
    damageMultiplier: number
  ) {
    const size = enemyData.collisionRadius * 2;
    super(scene, x, y, size, size, 0x000000, 0);

    this.dataId = enemyData.id;
    this.currentHP = Math.ceil(enemyData.baseHP * hpMultiplier);
    this.moveSpeed = enemyData.baseMoveSpeed;
    this.contactDamage = Math.ceil(enemyData.baseDamage * damageMultiplier);
    this.collisionRadius = enemyData.collisionRadius;
    this.lastDamageTime = -Infinity;

    scene.add.existing(this);

    this.visual = scene.add.graphics();
    this.drawVisual(enemyData.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 公開方法
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 受到傷害：扣血 + 閃白 + 擊退 + 傷害數字
   * @param damage    傷害值（正整數）
   * @param fromX     攻擊來源 X（用於計算擊退方向），不傳則不擊退
   * @param fromY     攻擊來源 Y
   * @returns 是否死亡（currentHP <= 0）
   */
  public takeDamage(damage: number, fromX?: number, fromY?: number): boolean {
    if (this.isDying) return false;

    // 扣血
    this.currentHP -= damage;

    // 閃白（持續 120ms）
    this.hitFlashTimer = 120;
    this.visual.setAlpha(0.0); // 先隱藏原始圖形，改顯示白色覆蓋
    this.showFlashOverlay();

    // 輕微擊退（若有來源位置）
    if (fromX !== undefined && fromY !== undefined) {
      const dx = this.x - fromX;
      const dy = this.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const knockDist = 12; // 擊退距離 px
        this.knockbackX = (dx / dist) * knockDist;
        this.knockbackY = (dy / dist) * knockDist;
        this.setPosition(this.x + this.knockbackX, this.y + this.knockbackY);
        this.syncVisual();
      }
    }

    // 傷害數字
    this.showDamageNumber(damage);

    return this.currentHP <= 0;
  }

  /**
   * 播放死亡特效（縮小 + 淡出），完成後銷毀自身
   * 呼叫後不應再操作此物件
   */
  public playDeathEffect(): void {
    if (this.isDying) return;
    this.isDying = true;

    // 紅色小爆點
    this.spawnDeathParticles();

    // 視覺縮小淡出
    this.scene.tweens.add({
      targets: this.visual,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 220,
      ease: 'Power2',
      onComplete: () => {
        if (this.visual && this.visual.active) {
          this.visual.destroy();
        }
      },
    });

    // 透明碰撞體直接銷毀（不等 tween）
    // 延遲一幀確保 GameScene 已從 group 移除
    this.scene.time.delayedCall(10, () => {
      if (this.active) {
        super.destroy();
      }
    });
  }

  /**
   * 每幀更新受擊閃白計時（由 GameScene.update 呼叫）
   */
  public updateHitFlash(delta: number): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.hitFlashTimer = 0;
        // 恢復原始視覺
        this.visual.setAlpha(1);
      }
    }
  }

  /**
   * 每幀朝玩家位置移動，並套用分離向量避免與其他敵人重疊
   * @param playerX     玩家 X 座標
   * @param playerY     玩家 Y 座標
   * @param delta       幀時間差（毫秒）
   * @param separationX 分離向量 X（由 GameScene 計算，預設 0）
   * @param separationY 分離向量 Y（由 GameScene 計算，預設 0）
   */
  public moveTowardPlayer(
    playerX: number,
    playerY: number,
    delta: number,
    separationX: number = 0,
    separationY: number = 0
  ): void {
    if (this.isDying) return;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) return;

    const dt = delta / 1000;

    // 追玩家方向（正規化）
    const chaseX = dx / dist;
    const chaseY = dy / dist;

    // 最終方向 = 追玩家方向 + 分離向量（分離向量已由 GameScene 正規化並乘以強度）
    let finalX = chaseX + separationX;
    let finalY = chaseY + separationY;

    // 正規化最終方向（確保速度不超過 moveSpeed）
    const finalLen = Math.sqrt(finalX * finalX + finalY * finalY);
    if (finalLen > 0) {
      finalX /= finalLen;
      finalY /= finalLen;
    }

    this.setPosition(
      this.x + finalX * this.moveSpeed * dt,
      this.y + finalY * this.moveSpeed * dt
    );

    this.syncVisual();
  }

  /**
   * 套用精英怪外觀（建構後呼叫，重繪為金色大型武將）
   * 必須在 isElite = true 之後呼叫
   */
  public applyEliteVisual(): void {
    this.drawVisual('elite');
  }

  /**
   * 銷毀時同步清除視覺圖形
   */
  public destroy(fromScene?: boolean): void {
    if (this.visual && this.visual.active) {
      this.visual.destroy();
    }
    super.destroy(fromScene);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────────────────

  private drawVisual(enemyId: string): void {
    const g = this.visual;
    g.clear();

    if (enemyId === 'elite') {
      // ── 精英怪外觀：金色大型武將 ──────────────────────────────────────
      // 外圈金色光暈（半透明，半徑 32px）
      g.fillStyle(0xffd700, 0.18);
      g.fillCircle(0, 0, 32);
      // 中圈橙色光暈（半透明，半徑 24px）
      g.fillStyle(0xff8800, 0.22);
      g.fillCircle(0, 0, 24);
      // 腿部（深紅）
      g.fillStyle(0x660000, 1);
      g.fillRect(-10, 12, 7, 14);
      g.fillRect(3, 12, 7, 14);
      // 身體（深紅）
      g.fillStyle(0x990000, 1);
      g.fillRect(-13, -6, 26, 20);
      // 頭部（膚色）
      g.fillStyle(0xddccaa, 1);
      g.fillCircle(0, -16, 12);
      // 金色頭盔
      g.fillStyle(0xffd700, 1);
      g.fillRect(-12, -24, 24, 10);
      g.fillRect(-4, -30, 8, 8);
      // 大刀（金色）
      g.fillStyle(0xffd700, 1);
      g.fillRect(14, -28, 5, 38);
      g.fillRect(10, -28, 14, 6);
      // 腰帶（金色）
      g.fillStyle(0xffd700, 0.9);
      g.fillRect(-13, 6, 26, 4);
      // 金色外框線
      g.lineStyle(2, 0xffd700, 0.7);
      g.strokeCircle(0, 0, 26);

    } else if (enemyId === 'basic') {
      g.fillStyle(0xcc2222, 0.2);
      g.fillCircle(0, 0, 18);
      g.fillStyle(0x881111, 1);
      g.fillRect(-8, -2, 16, 14);
      g.fillStyle(0xff4444, 1);
      g.fillCircle(0, -10, 9);
      g.lineStyle(2, 0xff6666, 1);
      g.lineBetween(-12, 2, -18, -4);
      g.lineBetween(-12, 6, -20, 6);
      g.lineBetween(-12, 10, -18, 16);
      g.lineBetween(12, 2, 18, -4);
      g.lineBetween(12, 6, 20, 6);
      g.lineBetween(12, 10, 18, 16);

    } else if (enemyId === 'fast') {
      g.fillStyle(0xff6600, 0.2);
      g.fillCircle(0, 0, 14);
      g.fillStyle(0xcc4400, 1);
      g.fillTriangle(0, -14, -10, 2, 10, 2);
      g.fillTriangle(0, 14, -10, 2, 10, 2);
      g.lineStyle(1.5, 0xffaa44, 0.8);
      g.lineBetween(-16, -6, -8, -6);
      g.lineBetween(-18, 0, -10, 0);
      g.lineBetween(-16, 6, -8, 6);

    } else if (enemyId === 'tank') {
      g.fillStyle(0x6600aa, 0.2);
      g.fillCircle(0, 0, 22);
      g.fillStyle(0x440077, 1);
      g.fillCircle(0, 0, 16);
      g.fillStyle(0x8833cc, 1);
      g.fillRect(-14, -6, 10, 12);
      g.fillRect(4, -6, 10, 12);
      g.fillRect(-8, -16, 16, 10);
      g.fillStyle(0xff0000, 1);
      g.fillCircle(-5, -2, 3);
      g.fillCircle(5, -2, 3);
    }

    g.setPosition(this.x, this.y);
    g.setDepth(4);
  }

  private syncVisual(): void {
    if (this.visual && this.visual.active) {
      this.visual.setPosition(this.x, this.y);
    }
  }

  /** 顯示短暫白色覆蓋（閃白效果） */
  private showFlashOverlay(): void {
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.85);
    flash.fillCircle(0, 0, this.collisionRadius + 4);
    flash.setPosition(this.x, this.y);
    flash.setDepth(6);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 120,
      onComplete: () => {
        flash.destroy();
        // 閃白結束後恢復視覺
        if (this.visual && this.visual.active) {
          this.visual.setAlpha(1);
        }
      },
    });
  }

  /** 顯示傷害數字（上浮淡出） */
  private showDamageNumber(damage: number): void {
    if (activeDamageNumbers >= MAX_DAMAGE_NUMBERS) return;

    activeDamageNumbers++;
    const offsetX = (Math.random() - 0.5) * 20;
    const text = this.scene.add.text(
      this.x + offsetX,
      this.y - this.collisionRadius - 4,
      `-${damage}`,
      {
        fontSize: '14px',
        color: '#ff4444',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5, 1).setDepth(20);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 28,
      alpha: 0,
      duration: 500,
      ease: 'Power1',
      onComplete: () => {
        text.destroy();
        activeDamageNumbers--;
      },
    });
  }

  /** 死亡時生成紅色小爆點 */
  private spawnDeathParticles(): void {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dot = this.scene.add.graphics();
      dot.fillStyle(0xff3300, 0.9);
      dot.fillCircle(0, 0, 4);
      dot.setPosition(this.x, this.y);
      dot.setDepth(7);

      const speed = 40 + Math.random() * 40;
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Math.cos(angle) * speed,
        y: dot.y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 300 + Math.random() * 150,
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
