import Phaser from 'phaser';
import { EnemyData } from '../types/index';
import { EliteProjectile, getActiveEliteProjectileCount, evictOldestIfNeeded } from './EliteProjectile';

/** 傷害數字同時上限 */
const MAX_DAMAGE_NUMBERS = 25;
/** 全域傷害數字計數（跨所有敵人） */
let activeDamageNumbers = 0;

export function resetDamageNumberCounter(): void {
  activeDamageNumbers = 0;
}

/** 精英怪類型 */
export type EliteType = 'charger' | 'shooter' | 'shield';

/** charger 衝撞狀態 */
type ChargerState = 'idle' | 'windup' | 'dashing';

export class Enemy extends Phaser.GameObjects.Rectangle {
  public dataId: string;
  public currentHP: number;
  public lastDamageTime: number;
  public moveSpeed: number;
  public contactDamage: number;
  public collisionRadius: number;

  /** 防重複死亡處理 flag */
  public deathHandled: boolean = false;
  /** 是否已死亡（destroy 防重複用） */
  public isDead: boolean = false;

  /** 是否為精英怪 */
  public isElite: boolean = false;
  /** 精英怪類型 */
  public eliteType?: EliteType;

  // ── ranged 普通遠程小怪狀態 ──────────────────────────────────────────
  public isRanged: boolean = false;
  private rangedFireTimer: number = 0;
  private rangedFireInterval: number = 2800; // ms
  private rangedProjSpeed: number = 200;
  private rangedProjDamage: number = 7;
  private rangedAttackRange: number = 290;
  /** 回呼：由 GameScene 注入，用於生成遠程小怪投射物 */
  public onRangedShoot?: (x: number, y: number, vx: number, vy: number, dmg: number) => void;

  /** 視覺圖形（Image，使用 generateTexture 生成的 key；fallback 為 Graphics） */
  private visual!: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  /** 護盾光圈（shield 用） */
  private shieldVisual?: Phaser.GameObjects.Graphics;
  /** 衝撞警示線（charger 用） */
  private chargeWarning?: Phaser.GameObjects.Graphics;

  public isDying: boolean = false;
  private hitFlashTimer: number = 0;
  private knockbackX: number = 0;
  private knockbackY: number = 0;

  // ── charger 狀態 ──────────────────────────────────────────────────────
  private chargerCooldown: number = 3000;   // 首次衝撞等待（ms）
  private chargerState: ChargerState = 'idle';
  private chargerWindupTimer: number = 0;
  private chargerDashTimer: number = 0;
  private chargerDirX: number = 0;
  private chargerDirY: number = 0;
  private readonly CHARGER_COOLDOWN   = 6000;  // 每輪間隔
  private readonly CHARGER_WINDUP     = 400;   // 蓄力時間
  private readonly CHARGER_DASH_DUR   = 620;   // 每次衝刺持續
  private readonly CHARGER_DASH_SPEED = 450;   // 衝刺速度
  private readonly CHARGER_PAUSE_DUR  = 250;   // 每次衝刺後停頓
  private readonly CHARGER_COMBO      = 3;     // 每輪衝撞次數
  private chargerComboLeft: number = 0;        // 本輪剩餘次數
  private chargerPauseTimer: number = 0;       // 停頓計時

  // ── shooter 狀態 ──────────────────────────────────────────────────────
  private shooterCooldown: number = 2000;   // 首次射擊等待（ms）
  private readonly SHOOTER_COOLDOWN = 1700; // 攻擊間隔
  private shooterPatternIndex: number = 0;  // 彈道模式輪替索引
  /** 回呼：由 GameScene 注入，用於生成投射物 */
  public onShootProjectile?: (x: number, y: number, vx: number, vy: number, dmg: number) => void;

  // ── shield 狀態 ──────────────────────────────────────────────────────
  private shieldCooldown: number = 3000;    // 首次護盾等待（ms）
  public shieldActive: boolean = false;     // public 供 GameScene 消除投射物
  public readonly SHIELD_RADIUS = 100;      // 護盾範圍（消除投射物用）
  private shieldTimer: number = 0;
  private readonly SHIELD_COOLDOWN = 7000;
  private readonly SHIELD_DURATION = 2500;
  // 黑洞技能
  private blackholeCooldown: number = 5000; // 首次黑洞等待
  private readonly BLACKHOLE_COOLDOWN = 8000;
  /** 回呼：由 GameScene 注入，用於生成黑洞（傳入 Boss 座標） */
  public onSpawnBlackHole?: (bossX: number, bossY: number) => void;
  // 外圍直線射擊技能
  private lineAttackCooldown: number = 4000; // 首次直線攻擊等待（ms）
  private readonly LINE_ATTACK_COOLDOWN_MIN = 6000;
  private readonly LINE_ATTACK_COOLDOWN_MAX = 8000;
  /** 目前直線攻擊道數（1→2→...→8→1 循環） */
  public lineAttackCount: number = 1;
  /** 回呼：由 GameScene 注入，用於觸發直線攻擊 */
  public onLineAttack?: (targetX: number, targetY: number, count: number) => void;

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

    // 建立視覺：優先使用 generateTexture 生成的 Image，fallback 為 Graphics
    const texKey = `enemy_${enemyData.id}`;
    if (scene.textures.exists(texKey)) {
      const img = scene.add.image(x, y, texKey);
      img.setDepth(5);
      img.setAlpha(1);
      this.visual = img;
    } else {
      this.visual = scene.add.graphics();
      this.drawVisual(enemyData.id);
    }

    // 遠程小怪初始化
    if (enemyData.attackRange) {
      this.isRanged = true;
      this.rangedAttackRange = enemyData.attackRange;
      this.rangedFireInterval = (enemyData.fireInterval ?? 2.8) * 1000;
      this.rangedProjSpeed = enemyData.projectileSpeed ?? 200;
      this.rangedProjDamage = Math.ceil((enemyData.projectileDamage ?? 7) * damageMultiplier);
      this.rangedFireTimer = this.rangedFireInterval * 0.5; // 首次射擊延遲半個間隔
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 公開方法
  // ─────────────────────────────────────────────────────────────────────────

  public takeDamage(damage: number, fromX?: number, fromY?: number): boolean {
    if (this.isDying) return false;

    // shield 護盾期間完全無敵
    let actualDamage = damage;
    if (this.shieldActive) {
      // 顯示 0 傷害提示（讓玩家知道護盾在作用）
      this.showDamageNumber(0);
      return false;
    }

    this.currentHP -= actualDamage;

    // 受傷閃爍：只用 hitFlashTimer 控制，不直接設 alpha=0
    // 改為短暫設 alpha=0.3（仍可見），避免多次連擊導致永久透明
    this.hitFlashTimer = 120;
    if (this.visual && this.visual.active) {
      this.visual.setAlpha(0.3);
    }
    this.showFlashOverlay();

    if (fromX !== undefined && fromY !== undefined) {
      const dx = this.x - fromX;
      const dy = this.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const knockDist = this.shieldActive ? 4 : 12;
        this.knockbackX = (dx / dist) * knockDist;
        this.knockbackY = (dy / dist) * knockDist;
        this.setPosition(this.x + this.knockbackX, this.y + this.knockbackY);
        this.syncVisual();
      }
    }

    this.showDamageNumber(actualDamage);
    return this.currentHP <= 0;
  }

  public playDeathEffect(): void {
    if (this.isDying) return;
    this.isDying = true;
    this.destroy();
  }

  public updateHitFlash(delta: number): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.hitFlashTimer = 0;
        if (this.visual && this.visual.active) {
          // 強制恢復完全不透明與正常縮放
          this.visual.setAlpha(1);
          this.visual.setScale(1);
        }
      }
    }
  }

  public moveTowardPlayer(
    playerX: number, playerY: number, delta: number,
    separationX: number = 0, separationY: number = 0
  ): void {
    if (this.isDying) return;
    // charger 衝刺中：沿鎖定方向移動，不追玩家
    if (this.eliteType === 'charger' && this.chargerState === 'dashing') {
      const dt = delta / 1000;
      let nx = this.x + this.chargerDirX * this.CHARGER_DASH_SPEED * dt;
      let ny = this.y + this.chargerDirY * this.CHARGER_DASH_SPEED * dt;
      // 邊界 clamp（防止衝出世界）
      nx = Phaser.Math.Clamp(nx, 32, 3200 - 32);
      ny = Phaser.Math.Clamp(ny, 32, 3200 - 32);
      this.setPosition(nx, ny);
      this.syncVisual();
      return;
    }
    // charger 蓄力或停頓中：停頓（不移動）
    if (this.eliteType === 'charger' &&
        (this.chargerState === 'windup' || this.chargerState === 'idle' && this.chargerPauseTimer > 0)) return;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const dt = delta / 1000;

    // 遠程小怪：進入攻擊範圍後保持距離，不貼臉
    if (this.isRanged && dist < this.rangedAttackRange * 0.75) {
      // 緩慢後退
      const chaseX = -(dx / dist);
      const chaseY = -(dy / dist);
      this.setPosition(
        this.x + chaseX * this.moveSpeed * 0.5 * dt,
        this.y + chaseY * this.moveSpeed * 0.5 * dt
      );
      this.syncVisual();
      return;
    }
    const chaseX = dx / dist;
    const chaseY = dy / dist;
    let finalX = chaseX + separationX;
    let finalY = chaseY + separationY;
    const finalLen = Math.sqrt(finalX * finalX + finalY * finalY);
    if (finalLen > 0) { finalX /= finalLen; finalY /= finalLen; }

    this.setPosition(
      this.x + finalX * this.moveSpeed * dt,
      this.y + finalY * this.moveSpeed * dt
    );
    this.syncVisual();
  }

  /**
   * 重新定位（Enemy Recycle 用）
   * 只移動位置並同步視覺，不重建物件、不重置 HP 或任何狀態
   */
  public relocate(x: number, y: number): void {
    this.setPosition(x, y);
    this.syncVisual();
  }

  /**
   * 套用精英怪外觀（建構後呼叫）
   * 精英怪使用 Graphics 繪製（charger/shooter/shield 有獨特外觀）
   */
  public applyEliteVisual(type: EliteType): void {
    this.eliteType = type;
    // 精英怪：銷毀原本的 Image，改用 Graphics
    if (this.visual && this.visual.active) {
      this.visual.destroy();
    }
    const g = this.scene.add.graphics();
    g.setAlpha(1);
    this.visual = g;
    this.drawVisual(type);
  }

  /**
   * 每幀更新精英技能（由 GameScene.update 呼叫）
   */
  public updateEliteSkill(delta: number, playerX: number, playerY: number): void {
    if (this.isDying || !this.isElite) return;

    switch (this.eliteType) {
      case 'charger': this.updateCharger(delta, playerX, playerY); break;
      case 'shooter': this.updateShooter(delta, playerX, playerY); break;
      case 'shield':  this.updateShield(delta, playerX, playerY); break;
    }
  }

  /**
   * 每幀更新遠程小怪射擊（由 GameScene.update 呼叫）
   */
  public updateRangedSkill(delta: number, playerX: number, playerY: number): void {
    if (this.isDying || !this.isRanged || !this.onRangedShoot) return;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 只在攻擊範圍內射擊
    if (dist > this.rangedAttackRange) return;

    this.rangedFireTimer -= delta;
    if (this.rangedFireTimer <= 0) {
      this.rangedFireTimer = this.rangedFireInterval;
      if (dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.onRangedShoot(this.x, this.y, nx * this.rangedProjSpeed, ny * this.rangedProjSpeed, this.rangedProjDamage);
      }
    }
  }

  public destroy(fromScene?: boolean): void {
    // 防重複 destroy
    if (this.isDead && !fromScene) return;
    this.isDead = true;
    this.isDying = true;
    if (this.visual && this.visual.active) this.visual.destroy();
    if (this.shieldVisual && this.shieldVisual.active) this.shieldVisual.destroy();
    if (this.chargeWarning && this.chargeWarning.active) this.chargeWarning.destroy();
    super.destroy(fromScene);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 精英技能私有方法
  // ─────────────────────────────────────────────────────────────────────────

  private updateCharger(delta: number, playerX: number, playerY: number): void {
    switch (this.chargerState) {
      case 'idle':
        // 停頓計時（每次衝刺後）
        if (this.chargerPauseTimer > 0) {
          this.chargerPauseTimer -= delta;
          return;
        }
        this.chargerCooldown -= delta;
        if (this.chargerCooldown <= 0) {
          // 開始新一輪連續衝撞
          this.chargerComboLeft = this.CHARGER_COMBO;
          this.startChargerWindup(playerX, playerY);
        }
        break;

      case 'windup':
        this.chargerWindupTimer -= delta;
        if (this.chargeWarning && this.chargeWarning.active) {
          this.chargeWarning.setPosition(this.x, this.y);
        }
        if (this.chargerWindupTimer <= 0) {
          this.chargerState = 'dashing';
          this.chargerDashTimer = this.CHARGER_DASH_DUR;
          if (this.chargeWarning && this.chargeWarning.active) {
            this.chargeWarning.destroy();
            this.chargeWarning = undefined;
          }
        }
        break;

      case 'dashing':
        this.chargerDashTimer -= delta;
        if (this.chargerDashTimer <= 0) {
          this.chargerComboLeft--;
          if (this.chargerComboLeft > 0) {
            // 還有剩餘次數：短暫停頓後再蓄力
            this.chargerState = 'idle';
            this.chargerPauseTimer = this.CHARGER_PAUSE_DUR;
            this.chargerCooldown = 0; // 停頓結束後立刻蓄力
          } else {
            // 本輪結束，回到 idle 等待下一輪
            this.chargerState = 'idle';
            this.chargerPauseTimer = 0;
            this.chargerCooldown = this.CHARGER_COOLDOWN;
          }
        }
        break;
    }
  }

  private startChargerWindup(playerX: number, playerY: number): void {
    this.chargerState = 'windup';
    this.chargerWindupTimer = this.CHARGER_WINDUP;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) { this.chargerDirX = dx / dist; this.chargerDirY = dy / dist; }
    this.showChargeWarning();
  }

  private updateShooter(delta: number, playerX: number, playerY: number): void {
    this.shooterCooldown -= delta;
    if (this.shooterCooldown > 0) return;
    this.shooterCooldown = this.SHOOTER_COOLDOWN;

    if (!this.onShootProjectile) return;
    evictOldestIfNeeded();

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const pattern = this.shooterPatternIndex % 4;
    this.shooterPatternIndex++;

    switch (pattern) {
      case 0: this.fireFanPattern(dx, dy, dist); break;
      case 1: this.fireBurstPattern(playerX, playerY); break;
      case 2: this.fireRingPattern(); break;
      case 3: this.fireCrossPattern(dx, dy, dist); break;
    }
  }

  /** 模式 1：扇形散射 5 顆，60° 扇形 */
  private fireFanPattern(dx: number, dy: number, dist: number): void {
    if (!this.onShootProjectile) return;
    const speed = 280;
    const dmg = Math.ceil(this.contactDamage * 0.55);
    const baseAngle = Math.atan2(dy / dist, dx / dist);
    const spread = Math.PI / 3; // 60°
    const count = 5;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + spread * (i / (count - 1) - 0.5);
      this.onShootProjectile(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg);
    }
  }

  /** 模式 2：連射追擊 — 3 波，每波 2 顆，每波重新瞄準 */
  private fireBurstPattern(playerX: number, playerY: number): void {
    if (!this.onShootProjectile || this.isDying) return;
    const speed = 300;
    const dmg = Math.ceil(this.contactDamage * 0.5);
    const delays = [0, 200, 400];
    for (const delay of delays) {
      this.scene.time.delayedCall(delay, () => {
        // 敵人已死亡或場景已結束時跳過
        if (this.isDying || !this.active || !this.onShootProjectile) return;
        if (!this.scene || !this.scene.scene.isActive()) return;
        // 重新瞄準玩家當下位置
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) return;
        const baseA = Math.atan2(dy, dx);
        for (const offset of [-0.12, 0.12]) {
          const a = baseA + offset;
          this.onShootProjectile!(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg);
        }
      });
    }
  }

  /** 模式 3：環形彈幕 8 顆，360° */
  private fireRingPattern(): void {
    if (!this.onShootProjectile) return;
    const speed = 230;
    const dmg = Math.ceil(this.contactDamage * 0.45);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.onShootProjectile(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg);
    }
  }

  /** 模式 4：交叉彈道 — X 字形 6 顆 */
  private fireCrossPattern(dx: number, dy: number, dist: number): void {
    if (!this.onShootProjectile) return;
    const speed = 260;
    const dmg = Math.ceil(this.contactDamage * 0.5);
    const baseAngle = Math.atan2(dy / dist, dx / dist);
    // 兩組斜向：baseAngle ± 45° 各 3 顆（間距 15°）
    const groups = [baseAngle + Math.PI / 4, baseAngle - Math.PI / 4];
    for (const ga of groups) {
      for (const offset of [-0.26, 0, 0.26]) {
        const a = ga + offset;
        this.onShootProjectile(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg);
      }
    }
  }

  private updateShield(delta: number, playerX?: number, playerY?: number): void {
    // 護盾邏輯
    if (this.shieldActive) {
      this.shieldTimer -= delta;
      if (this.shieldVisual && this.shieldVisual.active) {
        this.shieldVisual.setPosition(this.x, this.y);
      }
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.shieldCooldown = this.SHIELD_COOLDOWN;
        if (this.shieldVisual && this.shieldVisual.active) {
          this.shieldVisual.destroy();
          this.shieldVisual = undefined;
        }
      }
    } else {
      this.shieldCooldown -= delta;
      if (this.shieldCooldown <= 0) {
        this.shieldActive = true;
        this.shieldTimer = this.SHIELD_DURATION;
        this.showShieldVisual();
      }
    }

    // 黑洞技能
    this.blackholeCooldown -= delta;
    if (this.blackholeCooldown <= 0) {
      this.blackholeCooldown = this.BLACKHOLE_COOLDOWN;
      if (this.onSpawnBlackHole) {
        this.onSpawnBlackHole(this.x, this.y);
      }
    }

    // 外圍直線射擊技能
    this.lineAttackCooldown -= delta;
    if (this.lineAttackCooldown <= 0) {
      // 下次冷卻時間：6～8 秒隨機
      this.lineAttackCooldown = this.LINE_ATTACK_COOLDOWN_MIN +
        Math.random() * (this.LINE_ATTACK_COOLDOWN_MAX - this.LINE_ATTACK_COOLDOWN_MIN);

      if (this.onLineAttack && playerX !== undefined && playerY !== undefined) {
        this.onLineAttack(playerX, playerY, this.lineAttackCount);
      }

      // 道數遞增，超過 8 重置回 1
      this.lineAttackCount++;
      if (this.lineAttackCount > 8) {
        this.lineAttackCount = 1;
      }
    }
  }

  private showChargeWarning(): void {
    if (this.chargeWarning && this.chargeWarning.active) this.chargeWarning.destroy();
    const g = this.scene.add.graphics();
    g.setPosition(this.x, this.y);
    g.setDepth(9);
    // 紅色方向線（長 200px，更長更明顯）
    g.lineStyle(4, 0xff0000, 0.9);
    g.lineBetween(0, 0, this.chargerDirX * 200, this.chargerDirY * 200);
    // 紅色警示圓圈（雙圈）
    g.lineStyle(3, 0xff2200, 0.8);
    g.strokeCircle(0, 0, 36);
    g.lineStyle(1.5, 0xff6600, 0.5);
    g.strokeCircle(0, 0, 50);
    // 填充紅色光暈
    g.fillStyle(0xff0000, 0.12);
    g.fillCircle(0, 0, 50);
    this.chargeWarning = g;
  }

  private showShieldVisual(): void {
    if (this.shieldVisual && this.shieldVisual.active) this.shieldVisual.destroy();
    const g = this.scene.add.graphics();
    g.setPosition(this.x, this.y);
    g.setDepth(9);
    // 大範圍青色護盾（半徑 100px）
    g.fillStyle(0x00ffcc, 0.15);
    g.fillCircle(0, 0, this.SHIELD_RADIUS);
    g.lineStyle(3, 0x00ffcc, 0.9);
    g.strokeCircle(0, 0, this.SHIELD_RADIUS);
    g.lineStyle(1.5, 0xffffff, 0.4);
    g.strokeCircle(0, 0, this.SHIELD_RADIUS - 8);
    // 內圈
    g.fillStyle(0x00ffcc, 0.08);
    g.fillCircle(0, 0, this.SHIELD_RADIUS * 0.6);
    this.shieldVisual = g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 視覺私有方法
  // ─────────────────────────────────────────────────────────────────────────

  private drawVisual(enemyId: string): void {
    // 只有 Graphics 才能繪製；Image 已有 texture，不需要重繪
    if (!(this.visual instanceof Phaser.GameObjects.Graphics)) return;
    const g = this.visual;
    g.clear();

    if (enemyId === 'charger') {
      // 紅金色衝鋒武將
      g.fillStyle(0xff4400, 0.35); g.fillCircle(0, 0, 30);
      g.fillStyle(0xcc2200, 1);
      g.fillRect(-12, -5, 24, 18);   // 身體
      g.fillStyle(0xffaa00, 1);
      g.fillCircle(0, -15, 11);      // 頭
      g.fillStyle(0xffd700, 1);
      g.fillRect(-11, -22, 22, 9);   // 頭盔
      g.fillRect(-3, -28, 6, 7);
      g.fillRect(13, -26, 4, 34);    // 長矛
      g.fillRect(9, -26, 12, 5);
      g.fillStyle(0xffd700, 0.9);
      g.fillRect(-12, 5, 24, 4);     // 腰帶
      g.lineStyle(2, 0xff6600, 0.8); g.strokeCircle(0, 0, 26);

    } else if (enemyId === 'shooter') {
      // 紫藍色遠程法師
      g.fillStyle(0x6600ff, 0.35); g.fillCircle(0, 0, 26);
      g.fillStyle(0x330088, 1);
      g.fillRect(-10, -4, 20, 16);   // 身體
      g.fillStyle(0x9933ff, 1);
      g.fillCircle(0, -13, 10);      // 頭
      g.fillStyle(0x6600cc, 1);
      g.fillTriangle(0, -28, -10, -13, 10, -13); // 法師帽
      g.fillStyle(0xaaaaff, 1);
      g.fillCircle(-14, 2, 5);       // 左手法球
      g.fillCircle(14, 2, 5);        // 右手法球
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(-14, 2, 2);
      g.fillCircle(14, 2, 2);
      g.lineStyle(2, 0xaa44ff, 0.8); g.strokeCircle(0, 0, 22);

    } else if (enemyId === 'shield') {
      // 金青色重甲護盾怪
      g.fillStyle(0x00ccaa, 0.35); g.fillCircle(0, 0, 32);
      g.fillStyle(0x005544, 1);
      g.fillRect(-14, -6, 28, 22);   // 身體
      g.fillStyle(0xddccaa, 1);
      g.fillCircle(0, -16, 11);      // 頭
      g.fillStyle(0x00aa88, 1);
      g.fillRect(-13, -24, 26, 10);  // 頭盔
      g.fillRect(-4, -30, 8, 7);
      // 盾牌（左側大矩形）
      g.fillStyle(0x008866, 1);
      g.fillRect(-26, -10, 14, 24);
      g.fillStyle(0xffd700, 1);
      g.fillRect(-26, -10, 14, 3);
      g.fillRect(-26, 11, 14, 3);
      g.fillRect(-26, 0, 3, 14);
      g.fillStyle(0xffd700, 0.9);
      g.fillRect(-14, 6, 28, 4);     // 腰帶
      g.lineStyle(2.5, 0x00ffcc, 0.8); g.strokeCircle(0, 0, 28);

    } else if (enemyId === 'elite') {
      // 舊版通用精英（向下相容）
      g.fillStyle(0xffd700, 0.25); g.fillCircle(0, 0, 32);
      g.fillStyle(0xff8800, 0.30); g.fillCircle(0, 0, 24);
      g.fillStyle(0x660000, 1);
      g.fillRect(-10, 12, 7, 14); g.fillRect(3, 12, 7, 14);
      g.fillStyle(0x990000, 1); g.fillRect(-13, -6, 26, 20);
      g.fillStyle(0xddccaa, 1); g.fillCircle(0, -16, 12);
      g.fillStyle(0xffd700, 1);
      g.fillRect(-12, -24, 24, 10); g.fillRect(-4, -30, 8, 8);
      g.fillRect(14, -28, 5, 38); g.fillRect(10, -28, 14, 6);
      g.fillStyle(0xffd700, 0.9); g.fillRect(-13, 6, 26, 4);
      g.lineStyle(2, 0xffd700, 0.8); g.strokeCircle(0, 0, 26);

    } else if (enemyId === 'basic') {
      // 紅色基礎小怪：加深顏色，提高光暈可見度
      g.fillStyle(0xcc2222, 0.35); g.fillCircle(0, 0, 18);
      g.fillStyle(0x881111, 1); g.fillRect(-8, -2, 16, 14);
      g.fillStyle(0xff4444, 1); g.fillCircle(0, -10, 9);
      g.lineStyle(2, 0xff6666, 1);
      g.lineBetween(-12, 2, -18, -4); g.lineBetween(-12, 6, -20, 6);
      g.lineBetween(-12, 10, -18, 16); g.lineBetween(12, 2, 18, -4);
      g.lineBetween(12, 6, 20, 6); g.lineBetween(12, 10, 18, 16);

    } else if (enemyId === 'fast') {
      // 橙色快速小怪：提高光暈可見度
      g.fillStyle(0xff6600, 0.35); g.fillCircle(0, 0, 14);
      g.fillStyle(0xcc4400, 1);
      g.fillTriangle(0, -14, -10, 2, 10, 2);
      g.fillTriangle(0, 14, -10, 2, 10, 2);
      g.lineStyle(1.5, 0xffaa44, 0.9);
      g.lineBetween(-16, -6, -8, -6); g.lineBetween(-18, 0, -10, 0);
      g.lineBetween(-16, 6, -8, 6);

    } else if (enemyId === 'tank') {
      // 紫色厚血小怪：提高光暈可見度
      g.fillStyle(0x6600aa, 0.35); g.fillCircle(0, 0, 22);
      g.fillStyle(0x440077, 1); g.fillCircle(0, 0, 16);
      g.fillStyle(0x8833cc, 1);
      g.fillRect(-14, -6, 10, 12); g.fillRect(4, -6, 10, 12);
      g.fillRect(-8, -16, 16, 10);
      g.fillStyle(0xff0000, 1);
      g.fillCircle(-5, -2, 3); g.fillCircle(5, -2, 3);

    } else if (enemyId === 'ranged') {
      // 橙黃色遠程射手：提高光暈可見度
      g.fillStyle(0xffaa00, 0.35); g.fillCircle(0, 0, 16);
      g.fillStyle(0xcc6600, 1);
      g.fillRect(-7, -3, 14, 14);   // 身體
      g.fillStyle(0xffcc88, 1);
      g.fillCircle(0, -11, 8);      // 頭
      // 弓（左側弧線用兩條線模擬）
      g.lineStyle(2, 0x884400, 1);
      g.lineBetween(-12, -8, -14, 0);
      g.lineBetween(-14, 0, -12, 8);
      // 弓弦
      g.lineStyle(1, 0xffdd88, 0.9);
      g.lineBetween(-12, -8, -12, 8);
      // 箭
      g.fillStyle(0xffdd00, 1);
      g.fillRect(-11, -1, 14, 2);
      g.fillTriangle(3, -3, 3, 3, 8, 0);
      g.lineStyle(1.5, 0xff8800, 0.8); g.strokeCircle(0, 0, 14);
    }

    g.setPosition(this.x, this.y);
    g.setDepth(5);
    // 確保 alpha 為 1（防止殘留狀態）
    g.setAlpha(1);
  }

  private syncVisual(): void {
    if (this.visual && this.visual.active) {
      this.visual.setPosition(this.x, this.y);
    }
  }

  private showFlashOverlay(): void {
    if (this.isDying) return; // 死亡中不建立閃白
    if (!this.scene || !this.scene.sys.isActive()) return; // scene 已失效
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.92);
    flash.fillCircle(0, 0, this.collisionRadius + 5);
    flash.setPosition(this.x, this.y);
    flash.setDepth(6);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 100,
      onComplete: () => {
        if (flash && flash.active) flash.destroy();
        // 確保 alpha 恢復為 1（無論 hitFlashTimer 狀態）
        if (this.visual && this.visual.active && !this.isDying) {
          this.visual.setAlpha(1);
        }
      },
    });

    // 輕量縮放回饋（scale 1.0 → 1.08 → 1.0）
    // yoyo 結束後強制 scale 回 1，防止 Android 上縮放殘留
    if (this.visual && this.visual.active && !this.isDying) {
      this.scene.tweens.add({
        targets: this.visual,
        scaleX: 1.08, scaleY: 1.08,
        duration: 55, ease: 'Power1',
        yoyo: true,
        onComplete: () => {
          if (this.visual && this.visual.active && !this.isDying) {
            this.visual.setScale(1);
          }
        },
      });
    }
  }

  private showDamageNumber(damage: number): void {
    if (activeDamageNumbers >= MAX_DAMAGE_NUMBERS) return;
    if (!this.scene || !this.scene.sys.isActive()) return; // scene 已失效
    activeDamageNumbers++;

    // 隨機偏移：x ±12，y -8 到 +4
    const offsetX = (Math.random() - 0.5) * 24;
    const offsetY = Math.random() * 12 - 8;

    // 飄動方向：隨機往上、左上、右上
    const driftX = (Math.random() - 0.5) * 22;
    const driftY = -(22 + Math.random() * 16);

    const isZero = damage === 0;
    const color = isZero ? '#aaaaaa' : '#ff4444';
    const displayText = isZero ? '格擋' : `-${damage}`;
    const fontSize = isZero ? '12px' : (damage >= 30 ? '17px' : '14px');

    const text = this.scene.add.text(
      this.x + offsetX,
      this.y - this.collisionRadius + offsetY,
      displayText,
      {
        fontSize,
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5, 1).setDepth(20).setScale(0.7);

    // Pop-up 彈跳：scale 0.7 → 1.1 → 1.0，再飄移淡出
    this.scene.tweens.add({
      targets: text,
      scaleX: 1.1, scaleY: 1.1,
      duration: 80, ease: 'Back.Out',
      onComplete: () => {
        if (!text || !text.active) { activeDamageNumbers = Math.max(0, activeDamageNumbers - 1); return; }
        // 確認 scene 仍然有效
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
          if (text && text.active) text.destroy();
          activeDamageNumbers = Math.max(0, activeDamageNumbers - 1);
          return;
        }
        this.scene.tweens.add({
          targets: text,
          scaleX: 1.0, scaleY: 1.0,
          x: text.x + driftX,
          y: text.y + driftY,
          alpha: 0,
          duration: 480, ease: 'Power1',
          onComplete: () => {
            if (text && text.active) text.destroy();
            activeDamageNumbers = Math.max(0, activeDamageNumbers - 1);
          },
        });
      },
    });
  }

  private spawnDeathParticles(): void {
    // 減少粒子數量（3 個足夠，避免大量敵人同時死亡時 Graphics 爆炸）
    const count = 3;
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
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 250 + Math.random() * 100, ease: 'Power2',
        onComplete: () => { if (dot && dot.active) dot.destroy(); },
      });
    }
  }
}
