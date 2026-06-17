import Phaser from 'phaser';
import { EnemyData } from '../types/index';
import { EliteProjectile, getActiveEliteProjectileCount, evictOldestIfNeeded } from './EliteProjectile';
import { AssetLoader } from '../utils/AssetLoader';

/** 每種普通小怪的視覺顯示尺寸設定（與碰撞半徑無關，純視覺）
 * Sprite 動畫敵人使用目標顯示尺寸（px），Graphics fallback 使用 w/h 作為繪製半徑基準。
 */
const ENEMY_VISUAL_SIZE: Record<string, { w: number; h: number }> = {
  boss1:    { w: 175, h: 180 },   // 三當家 Boss，比小怪大
  boss2:    { w: 140, h: 145 },   // 二當家 Boss（shooter），與三當家相近
  henchman: { w: 125, h: 140 },   // 接近玩家大小
  scout:    { w: 120, h: 105 },   // 快速小怪，略小
  giant:    { w: 155, h: 165 },   // 巨漢略大於玩家
  archer:   { w: 120, h: 135 },   // 射手，接近玩家大小
  // 舊 id 保留作 fallback，避免 scene restart 殘留物件出錯
  basic:  { w: 36, h: 36 },
  fast:   { w: 28, h: 28 },
  tank:   { w: 48, h: 48 },
  ranged: { w: 36, h: 36 },
};

/** 傷害數字同時上限 */
const MAX_DAMAGE_NUMBERS = 25;
/** 全域傷害數字計數（跨所有敵人） */
let activeDamageNumbers = 0;

export function resetDamageNumberCounter(): void {
  activeDamageNumbers = 0;
}

/** 精英怪類型 */
export type EliteType = 'charger' | 'shooter' | 'shield';

/**
 * 大當家（charger）技能狀態
 * - 'idle'：追擊玩家，等待技能冷卻
 * - 'casting'：技能施放中（不可移動、不可普攻、不可再放技能）
 * - 'melee_windup'：霸刀橫斬前搖中（停止移動）
 */
type ChargerState = 'idle' | 'casting' | 'melee_windup';

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
  /** 射手攻擊狀態：'idle'=移動中，'attacking'=攻擊動畫播放中 */
  private archerState: 'idle' | 'attacking' = 'idle';
  /** 射手攻擊動畫 key（有素材時使用） */
  private readonly ARCHER_WALK_ANIM   = 'archer_walk';
  private readonly ARCHER_ATTACK_ANIM = 'archer_attack';
  /** 射手保持距離的理想範圍（px） */
  private readonly ARCHER_IDEAL_MIN = 240;
  private readonly ARCHER_IDEAL_MAX = 390;
  /** 回呼：由 GameScene 注入，用於生成遠程小怪投射物 */
  public onRangedShoot?: (x: number, y: number, vx: number, vy: number, dmg: number) => void;

  /** 視覺圖形（Sprite 動畫 / Image 靜態圖；fallback 為 Graphics） */
  private visual!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  /** visual 的基準縮放（setDisplaySize 後記錄，受擊 tween 以此為基準） */
  private visualBaseScaleX: number = 1;
  private visualBaseScaleY: number = 1;
  // 護盾光圈已移除（震罡功已移除）
  /** 衝撞警示線（charger 用） */
  private chargeWarning?: Phaser.GameObjects.Graphics;

  public isDying: boolean = false;
  private hitFlashTimer: number = 0;
  private knockbackX: number = 0;
  private knockbackY: number = 0;

  // ── charger（大當家）狀態 ────────────────────────────────────────────
  /** 目前技能狀態（霸刀橫斬已移除，只保留 idle 和 casting） */
  private chargerState: ChargerState = 'idle';

  // ── 霸刀橫斬已移除（普通攻擊）──────────────────────────────────────

  // ── 技能冷卻 ──────────────────────────────────────────────────────────
  /** 蠻王衝鋒冷卻（ms） */
  private chargerSkill1Cooldown: number = 3000;
  /** 裂寨三斬冷卻（ms） */
  private chargerSkill2Cooldown: number = 5000;
  /** 連環破甲刺冷卻（ms） */
  private chargerSkill3Cooldown: number = 7000;
  /** 技能結束後的選擇間隔（ms） */
  private chargerSkillSelectTimer: number = 0;
  private readonly CHARGER_SKILL_SELECT_INTERVAL = 1200;

  // ── 回呼（由 GameScene 注入）──────────────────────────────────────────
  // 霸刀橫斬已移除（普通攻擊）
  /** 蠻王衝鋒：連續衝刺技能 */
  public onChargerDash?: (fromX: number, fromY: number, targetX: number, targetY: number, charger: Enemy) => void;
  /** 裂寨三斬：連續扇形斬擊 */
  public onChargerTripleSlash?: (cx: number, cy: number, dirX: number, dirY: number, charger: Enemy) => void;
  /** 連環破甲刺：連續直線戳擊 */
  public onChargerStab?: (cx: number, cy: number, dirX: number, dirY: number, charger: Enemy) => void;

  // ── shooter 狀態 ──────────────────────────────────────────────────────
  private shooterCooldown: number = 2000;   // 首次射擊等待（ms）
  private readonly SHOOTER_COOLDOWN = 1700; // 攻擊間隔
  private shooterPatternIndex: number = 0;  // 彈道模式輪替索引
  /**
   * 二當家施放彈幕技能（非直線射擊）時的動畫狀態：
   * true 時停止移動、播放 boss2_skill1，且不可被 walk 動畫覆蓋。
   * 由 updateShooter 觸發彈幕時設為 true，skill1 動畫結束後設回 false。
   */
  public isCastingSkill: boolean = false;
  /** 回呼：由 GameScene 注入，用於生成投射物 */
  public onShootProjectile?: (x: number, y: number, vx: number, vy: number, dmg: number) => void;

  // ── shield 舊護盾狀態已移除（震罡功已移除）──────────────────────────
  // 衝擊波技能（三當家近戰強化）
  private shockwaveCooldown: number = 4500; // 首次衝擊波等待（ms）
  private readonly SHOCKWAVE_COOLDOWN = 7000;
  /** 回呼：由 GameScene 注入，用於觸發衝擊波 */
  public onShockwave?: (x: number, y: number) => void;

  // ── shield 三當家：新技能組 ──────────────────────────────────────────
  /** 技能施放中（true 時不可再放技能） */
  public shieldCasting: boolean = false;
  /**
   * 霸山墜等技能動畫播放中：true 時不可被走路 / 待機動畫覆蓋。
   * 由 updateShield 在施放霸山墜時設為 true，shieldEndCast 結束時設回 false。
   */
  public isUsingSkill: boolean = false;
  // 震罡功已移除
  /** 霸山墜冷卻（ms）：跳躍砸地 */
  private leapCooldown: number = 5000;
  private readonly LEAP_COOLDOWN_MIN = 6000;
  private readonly LEAP_COOLDOWN_MAX = 9000;
  /** 震撼咆哮冷卻（ms）：扇形蓄力咆哮 */
  private warCryCooldown: number = 7000;
  private readonly WARCRY_COOLDOWN_MIN = 7000;
  private readonly WARCRY_COOLDOWN_MAX = 10000;
  /** 連續重擊冷卻（ms）：近距離連續打擊 */
  private comboStrikeCooldown: number = 4000;
  private readonly COMBO_STRIKE_COOLDOWN_MIN = 4000;
  private readonly COMBO_STRIKE_COOLDOWN_MAX = 6000;
  /** 技能選擇間隔（ms）：技能結束後等待此時間再選下一個 */
  private skillSelectTimer: number = 0;
  private readonly SKILL_SELECT_INTERVAL = 1500;
  // 震罡功回呼已移除
  /** 回呼：霸山墜（跳躍砸地） */
  public onLeapSlam?: (fromX: number, fromY: number, targetX: number, targetY: number, dmg: number) => void;
  /** 回呼：震撼咆哮（扇形蓄力咆哮） */
  public onWarCry?: (cx: number, cy: number, dirX: number, dirY: number, elite: Enemy) => void;
  /** 回呼：連續重擊（近距離連續打擊） */
  public onComboStrike?: (cx: number, cy: number, dirX: number, dirY: number, elite: Enemy) => void;
  /** 回呼：普通平砍（近戰攻擊，保留相容性） */
  public onMeleeSlash?: (x: number, y: number, dmg: number) => void;

  // ── shooter 黑洞技能已移除 ──────────────────────────────────────
  // 直線射擊技能（二當家）：單發高傷害狙擊型
  private lineAttackCooldown: number = 4000; // 首次直線射擊等待（ms）
  private readonly LINE_ATTACK_COOLDOWN_MIN = 6000;
  private readonly LINE_ATTACK_COOLDOWN_MAX = 8000;
  /**
   * 直線射擊施法中：true 時停止移動、播放 boss2_skill2 準備動畫、鎖定方向，
   * 且不可被 walk / idle 動畫覆蓋。由 startLineShotCast 設為 true，
   * lineShotCastTimer 倒數歸零後（endLineShotCast）設回 false 並恢復 walk。
   */
  private lineShotCasting: boolean = false;
  /** 直線射擊施法倒數（ms），由 updateShooter 累減，歸零後結束施法 */
  private lineShotCastTimer: number = 0;
  /** 直線射擊施法總時長（ms）：警示 + 射擊 + 緩衝，期間 Boss 凍結 */
  private readonly LINE_SHOT_CAST_DURATION = 1600;
  /**
   * 回呼：由 GameScene 注入，觸發單發直線射擊。
   * @param originX 射擊起點 X（Boss 自身位置，鎖定）
   * @param originY 射擊起點 Y
   * @param angle   射擊方向角度（Boss → 玩家施法瞬間位置，鎖定不追蹤）
   */
  public onLineShot?: (originX: number, originY: number, angle: number) => void;

  // ── 個體差異（spawn 時隨機產生，讓怪物不完全同速同方向）──────────
  /** 包圍角度偏移（弧度）：讓每隻怪物趨向玩家周圍不同位置 */
  public approachAngleOffset: number = 0;
  /** 速度個體差異倍率（0.88 ~ 1.12） */
  public speedVariance: number = 1.0;
  /** 個人空間半徑（px）：怪物希望與玩家保持的最小距離 */
  public personalSpace: number = 32;

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

    // ── 個體差異初始化（讓怪物不完全同速同方向）──────────────────────
    // 包圍角度偏移：-35° ~ +35°，讓怪物趨向玩家周圍不同位置
    this.approachAngleOffset = (Math.random() - 0.5) * (Math.PI / 2.57);
    // 速度個體差異：±12%
    this.speedVariance = 0.88 + Math.random() * 0.24;
    // 個人空間：普通怪 20~32px，giant 40~56px
    const isLarge = (enemyData.id === 'giant' || enemyData.id === 'tank');
    this.personalSpace = isLarge
      ? 40 + Math.random() * 16
      : 20 + Math.random() * 12;

    scene.add.existing(this);
    // Rectangle 本身只作碰撞邊界用，不顯示
    this.setVisible(false);
    this.setDepth(-10);

    // 建立視覺：
    // 1. 優先使用 AssetLoader 載入的真實 PNG（enemy_img_<id>）
    //    使用 AssetLoader.hasTexture() 確保排除 __MISSING / __DEFAULT
    // 2. 直接用 Graphics 即時繪製（最保險，不依賴 generateTexture / RenderTexture）
    //    generateTexture 在 Android WebGL 初始化時可能靜默產生空白 texture，
    //    因此不再使用 enemy_<id> 的 pre-generated texture key。
    const imgKey = `enemy_img_${enemyData.id}`;
    // 取得此 enemy type 的視覺尺寸（fallback 為碰撞直徑）
    const vSize = ENEMY_VISUAL_SIZE[enemyData.id] ?? { w: enemyData.collisionRadius * 2, h: enemyData.collisionRadius * 2 };

    // 有動畫素材的敵人 id → 初始動畫 key 對照表
    const ANIM_KEY: Record<string, string> = {
      boss1:    'boss1_walk',    // 三當家 Boss
      henchman: 'henchman_walk',
      giant:    'giant_walk',
      scout:    'scout_walk',
      archer:   'archer_walk',
    };
    const animKey = ANIM_KEY[enemyData.id];

    if (animKey && scene.anims.exists(animKey)) {
      // 使用 Sprite 播放逐幀動畫
      const spr = scene.add.sprite(x, y, `${enemyData.id}_01`);
      spr.setDepth(5);
      spr.setDisplaySize(vSize.w, vSize.h);
      spr.play(animKey);
      this.visual = spr;
      // 記錄 setDisplaySize 後的實際 scale，作為受擊 tween 的基準
      this.visualBaseScaleX = spr.scaleX;
      this.visualBaseScaleY = spr.scaleY;
    } else if (AssetLoader.hasTexture(scene, imgKey)) {
      // 真實 PNG（AssetLoader 載入成功）
      const img = scene.add.image(x, y, imgKey);
      img.setDepth(5);
      img.setAlpha(1);
      // 強制設定顯示尺寸，確保 Android WebView 上 texture 尺寸異常時也正確顯示
      img.setDisplaySize(vSize.w, vSize.h);
      this.visual = img;
      this.visualBaseScaleX = img.scaleX;
      this.visualBaseScaleY = img.scaleY;
    } else {
      // 即時 Graphics fallback（最保險，一定可見，不依賴任何外部資源）
      const g = scene.add.graphics();
      g.setAlpha(1);
      this.visual = g;
      // Graphics 不使用 scale，baseScale 保持 1
      this.visualBaseScaleX = 1;
      this.visualBaseScaleY = 1;
      // 傳入視覺半徑，確保 Graphics 繪製尺寸與 vSize 一致
      this.drawVisual(enemyData.id, Math.floor(vSize.w / 2));
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

    // 震罡功護盾減傷已移除
    const actualDamage = damage;

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
        const knockDist = 12; // 震罡功護盾已移除，固定擊退距離
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
    // 清除技能施法狀態，避免死亡後殘留鎖定（動畫監聽隨 destroy 自動失效）
    this.isCastingSkill = false;
    this.isUsingSkill = false;
    this.lineShotCasting = false;
    this.destroy();
  }

  public updateHitFlash(delta: number): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.hitFlashTimer = 0;
        if (this.visual && this.visual.active) {
          // 強制恢復完全不透明與基準縮放（不能硬寫 1，Sprite 有自己的 displaySize scale）
          this.visual.setAlpha(1);
          this.visual.setScale(this.visualBaseScaleX, this.visualBaseScaleY);
        }
      }
    }
  }

  public moveTowardPlayer(
    playerX: number, playerY: number, delta: number,
    separationX: number = 0, separationY: number = 0,
    surroundSlotX: number = 0, surroundSlotY: number = 0,
    sectorRepelX: number = 0, sectorRepelY: number = 0
  ): void {
    if (this.isDying) return;
    // 技能動畫播放中（如霸山墜）：完全停止移動，避免覆蓋技能動畫
    if (this.isUsingSkill) return;
    // 二當家彈幕施法中：停止移動，避免邊走邊放技能
    if (this.isCastingSkill) return;
    // charger 技能施放中：停止移動（霸刀橫斬前搖已移除）
    if (this.eliteType === 'charger' && this.chargerState === 'casting') return;

    // shield 技能施放中：停止移動
    if (this.eliteType === 'shield' && this.shieldCasting) return;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const dt = delta / 1000;

    // ── 射手（archer）：三段距離邏輯 ────────────────────────────────
    if (this.isRanged && this.dataId === 'archer') {
      // 面向玩家（flipX）
      if (this.visual instanceof Phaser.GameObjects.Sprite ||
          this.visual instanceof Phaser.GameObjects.Image) {
        this.visual.setFlipX(dx < 0);
      }

      if (dist > this.ARCHER_IDEAL_MAX) {
        // 太遠：慢跑靠近
        if (this.archerState === 'attacking') {
          // 攻擊動畫播放中不移動，等動畫結束
        } else {
          const chaseX = dx / dist;
          const chaseY = dy / dist;
          this.setPosition(
            this.x + chaseX * this.moveSpeed * 0.6 * dt,
            this.y + chaseY * this.moveSpeed * 0.6 * dt
          );
          this.syncVisual();
          // 確保播放移動動畫
          if (this.visual instanceof Phaser.GameObjects.Sprite) {
            const spr = this.visual;
            if (spr.anims.currentAnim?.key !== this.ARCHER_WALK_ANIM &&
                this.scene.anims.exists(this.ARCHER_WALK_ANIM)) {
              spr.play(this.ARCHER_WALK_ANIM);
            }
          }
        }
      } else if (dist >= this.ARCHER_IDEAL_MIN) {
        // 理想射擊距離：停止移動，等 updateRangedSkill 觸發攻擊
        this.syncVisual();
      } else {
        // 太近：後退並加入側向分離，避免跟近戰怪擠在一起
        if (this.archerState !== 'attacking') {
          const backX = -(dx / dist) + separationX * 0.5;
          const backY = -(dy / dist) + separationY * 0.5;
          const backLen = Math.sqrt(backX * backX + backY * backY);
          const nbx = backLen > 0 ? backX / backLen : -(dx / dist);
          const nby = backLen > 0 ? backY / backLen : -(dy / dist);
          this.setPosition(
            this.x + nbx * this.moveSpeed * 0.5 * dt,
            this.y + nby * this.moveSpeed * 0.5 * dt
          );
          this.syncVisual();
        }
      }
      return;
    }

    // ── 舊版 ranged fallback（非 archer 的遠程怪）────────────────────
    if (this.isRanged && dist < this.rangedAttackRange * 0.75) {
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

    // ── 包圍點偏移：讓怪物趨向玩家周圍不同角度，而非全部擠向中心 ──
    const baseAngle = Math.atan2(dy, dx);
    const targetAngle = baseAngle + this.approachAngleOffset;
    const approachX = Math.cos(targetAngle);
    const approachY = Math.sin(targetAngle);

    // ── 個人空間：已進入最小距離，側向移動形成包圍感 ─────────────────
    if (dist <= this.personalSpace) {
      const sideSign = this.approachAngleOffset >= 0 ? 1 : -1;
      const sideX = -chaseY * sideSign;
      const sideY =  chaseX * sideSign;
      // 混合：60% 側向 + 25% 分離 + 15% sector repel
      const blendX = sideX * 0.60 + separationX * 0.25 + sectorRepelX * 0.15;
      const blendY = sideY * 0.60 + separationY * 0.25 + sectorRepelY * 0.15;
      const blendLen = Math.sqrt(blendX * blendX + blendY * blendY);
      if (blendLen > 0.01) {
        const nx = blendX / blendLen;
        const ny = blendY / blendLen;
        this.setPosition(
          this.x + nx * this.moveSpeed * this.speedVariance * 0.4 * dt,
          this.y + ny * this.moveSpeed * this.speedVariance * 0.4 * dt
        );
        if (nx !== 0 &&
            (this.visual instanceof Phaser.GameObjects.Sprite ||
             this.visual instanceof Phaser.GameObjects.Image)) {
          this.visual.setFlipX(nx < 0);
        }
      }
      this.syncVisual();
      return;
    }

    // ── Surround Slot：進入包圍範圍時，目標改為 slot 點而非玩家中心 ──
    // surroundSlotX/Y 由 GameScene 計算後傳入（非零時代表已分配 slot）
    let targetDx: number;
    let targetDy: number;
    let targetDist: number;

    if (surroundSlotX !== 0 || surroundSlotY !== 0) {
      // 目標是 slot 點（相對於怪物的向量）
      const slotDx = surroundSlotX - this.x;
      const slotDy = surroundSlotY - this.y;
      const slotDist = Math.sqrt(slotDx * slotDx + slotDy * slotDy);
      if (slotDist > 2) {
        targetDx = slotDx;
        targetDy = slotDy;
        targetDist = slotDist;
      } else {
        // 已到達 slot，側向移動
        targetDx = dx;
        targetDy = dy;
        targetDist = dist;
      }
    } else {
      targetDx = dx;
      targetDy = dy;
      targetDist = dist;
    }

    const tChaseX = targetDx / targetDist;
    const tChaseY = targetDy / targetDist;

    // ── 正常追擊：混合包圍方向 + 分離 + sector repel + lateral ──────
    const approachWeight = Math.min(1.0, (this.personalSpace * 2.5) / dist);
    const baseX = tChaseX * (1 - approachWeight) + approachX * approachWeight;
    const baseY = tChaseY * (1 - approachWeight) + approachY * approachWeight;

    // Lateral force：側向分流（距離越遠越弱）
    const lateralStrength = 0.16;
    const sideSign = this.approachAngleOffset >= 0 ? 1 : -1;
    const lateralFade = Math.min(1.0, dist / 300);
    const latX = -chaseY * sideSign * lateralStrength * lateralFade;
    const latY =  chaseX * sideSign * lateralStrength * lateralFade;

    // 合力：chase/surround + separation + sector repel + lateral
    const totalX = baseX + separationX * 0.8 + sectorRepelX * 0.5 + latX;
    const totalY = baseY + separationY * 0.8 + sectorRepelY * 0.5 + latY;
    const mixLen = Math.sqrt(totalX * totalX + totalY * totalY);
    let finalX = mixLen > 0 ? totalX / mixLen : chaseX;
    let finalY = mixLen > 0 ? totalY / mixLen : chaseY;

    this.setPosition(
      this.x + finalX * this.moveSpeed * this.speedVariance * dt,
      this.y + finalY * this.moveSpeed * this.speedVariance * dt
    );
    if (finalX !== 0 &&
        (this.visual instanceof Phaser.GameObjects.Sprite ||
         this.visual instanceof Phaser.GameObjects.Image)) {
      this.visual.setFlipX(finalX < 0);
    }
    this.syncVisual();
  }

  /**
   * 暫停或恢復此敵人的 Sprite 動畫（升級面板開啟時由 GameScene 呼叫）
   */
  public setAnimationPaused(pause: boolean): void {
    if (this.visual instanceof Phaser.GameObjects.Sprite && this.visual.active) {
      if (pause) {
        this.visual.anims.pause();
      } else {
        this.visual.anims.resume();
      }
    }
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
   * 三當家（shield）：如果有 boss1_walk 動畫素材，使用 Sprite；否則 fallback Graphics
   */
  public applyEliteVisual(type: EliteType): void {
    this.eliteType = type;
    
    // 三當家特殊處理：優先使用動畫 Sprite（比照小怪架構）
    if (type === 'shield' && this.scene.anims.exists('boss1_walk')) {
      // 銷毀原本的視覺物件
      if (this.visual && this.visual.active) {
        this.visual.destroy();
      }
      
      // 建立 Sprite 並播放動畫（使用小怪格式：boss1_01 而非 boss1_run_01）
      const spr = this.scene.add.sprite(this.x, this.y, 'boss1_01');
      spr.setDepth(5);
      // 三當家尺寸：200×200（使用 ENEMY_VISUAL_SIZE 中的設定）
      const vSize = ENEMY_VISUAL_SIZE['boss1'] ?? { w: 200, h: 200 };
      spr.setDisplaySize(vSize.w, vSize.h);
      spr.play('boss1_walk');
      this.visual = spr;
      this.visualBaseScaleX = spr.scaleX;
      this.visualBaseScaleY = spr.scaleY;
      return;
    }

    // 二當家特殊處理（shooter）：優先使用動畫 Sprite，比照三當家做法
    if (type === 'shooter' && this.scene.anims.exists('boss2_walk')) {
      if (this.visual && this.visual.active) {
        this.visual.destroy();
      }
      const spr = this.scene.add.sprite(this.x, this.y, 'boss2_01');
      spr.setDepth(5);
      const vSize = ENEMY_VISUAL_SIZE['boss2'] ?? { w: 165, h: 175 };
      spr.setDisplaySize(vSize.w, vSize.h);
      spr.play('boss2_walk');
      this.visual = spr;
      this.visualBaseScaleX = spr.scaleX;
      this.visualBaseScaleY = spr.scaleY;
      return;
    }
    
    // 精英怪：銷毀原本的 Image，改用 Graphics
    if (this.visual && this.visual.active) {
      this.visual.destroy();
    }
    const g = this.scene.add.graphics();
    g.setAlpha(1);
    this.visual = g;
    // 精英怪使用 Graphics，scale 固定為 1
    this.visualBaseScaleX = 1;
    this.visualBaseScaleY = 1;
    // 精英怪使用固定半徑 30（不受 ENEMY_VISUAL_SIZE 影響）
    this.drawVisual(type, 30);
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
   * archer：在理想距離內觸發攻擊動畫，動畫播放到約 30% 時延遲發射箭矢
   */
  public updateRangedSkill(delta: number, playerX: number, playerY: number): void {
    if (this.isDying || !this.isRanged || !this.onRangedShoot) return;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ── archer 專用邏輯 ──────────────────────────────────────────────
    if (this.dataId === 'archer') {
      // 攻擊動畫播放中：等動畫結束，不重複觸發
      if (this.archerState === 'attacking') return;

      // 只在理想射擊距離內觸發
      if (dist < this.ARCHER_IDEAL_MIN || dist > this.rangedAttackRange) return;

      this.rangedFireTimer -= delta;
      if (this.rangedFireTimer > 0) return;

      // 重置冷卻
      this.rangedFireTimer = this.rangedFireInterval;
      this.archerState = 'attacking';

      // 播放攻擊動畫
      if (this.visual instanceof Phaser.GameObjects.Sprite &&
          this.scene.anims.exists(this.ARCHER_ATTACK_ANIM)) {
        const spr = this.visual;
        spr.play(this.ARCHER_ATTACK_ANIM);
        // 動畫結束後回到移動動畫
        spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.archerState = 'idle';
          if (spr.active && this.scene.anims.exists(this.ARCHER_WALK_ANIM)) {
            spr.play(this.ARCHER_WALK_ANIM);
          }
        });
      } else {
        // 無動畫素材：直接結束攻擊狀態
        this.scene.time.delayedCall(300, () => { this.archerState = 'idle'; });
      }

      // 延遲 300ms 發射箭矢（接近拉弓放箭時間點，約攻擊動畫 30% 處）
      if (dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.scene.time.delayedCall(300, () => {
          if (this.isDying || !this.active || !this.onRangedShoot) return;
          if (!this.scene || !this.scene.scene.isActive()) return;
          this.onRangedShoot!(this.x, this.y, nx * this.rangedProjSpeed, ny * this.rangedProjSpeed, this.rangedProjDamage);
        });
      }
      return;
    }

    // ── 舊版 ranged fallback（非 archer）────────────────────────────
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
    // shieldVisual 已移除（震罡功已移除）
    if (this.chargeWarning && this.chargeWarning.active) this.chargeWarning.destroy();
    super.destroy(fromScene);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 精英技能私有方法
  // ─────────────────────────────────────────────────────────────────────────

  private updateCharger(delta: number, playerX: number, playerY: number): void {
    // ── 技能施放中：等待 GameScene 呼叫 chargerEndCast() ──────────────
    if (this.chargerState === 'casting') return;

    // ── 霸刀橫斬前搖已移除 ──────────────────────────────────────────────

    // ── idle 狀態：技能選擇間隔計時 ──────────────────────────────────
    if (this.chargerSkillSelectTimer > 0) {
      this.chargerSkillSelectTimer -= delta;
      // 霸刀橫斬已移除，間隔中不再嘗試普通攻擊
      return;
    }

    // ── 技能冷卻倒計時 ────────────────────────────────────────────────
    this.chargerSkill1Cooldown -= delta;
    this.chargerSkill2Cooldown -= delta;
    this.chargerSkill3Cooldown -= delta;

    // ── 隨機選擇冷卻完成的技能 ────────────────────────────────────────
    const available: Array<'dash' | 'triple' | 'stab'> = [];
    if (this.chargerSkill1Cooldown <= 0) available.push('dash');
    if (this.chargerSkill2Cooldown <= 0) available.push('triple');
    if (this.chargerSkill3Cooldown <= 0) available.push('stab');

    if (available.length > 0) {
      const chosen = available[Math.floor(Math.random() * available.length)];
      this.chargerState = 'casting';

      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dist > 0 ? dx / dist : 1;
      const dirY = dist > 0 ? dy / dist : 0;

      switch (chosen) {
        case 'dash':
          this.chargerSkill1Cooldown = 7000 + Math.random() * 3000; // 7～10 秒
          if (this.onChargerDash) {
            this.onChargerDash(this.x, this.y, playerX, playerY, this);
          }
          break;

        case 'triple':
          this.chargerSkill2Cooldown = 7000 + Math.random() * 3000; // 7～10 秒
          if (this.onChargerTripleSlash) {
            this.onChargerTripleSlash(this.x, this.y, dirX, dirY, this);
          }
          break;

        case 'stab':
          this.chargerSkill3Cooldown = 8000 + Math.random() * 4000; // 8～12 秒
          if (this.onChargerStab) {
            this.onChargerStab(this.x, this.y, dirX, dirY, this);
          }
          break;
      }
    } else {
      // 沒有技能可放：只進行追蹤移動（霸刀橫斬已移除，不再有普通攻擊）
    }
  }

  /**
   * 結束大當家技能施放狀態（由 GameScene 在技能動畫結束後呼叫）
   */
  public chargerEndCast(): void {
    this.chargerState = 'idle';
    this.chargerSkillSelectTimer = this.CHARGER_SKILL_SELECT_INTERVAL;
  }

  // ── tryChargerMeleeSlash 已移除（霸刀橫斬普通攻擊）──────────────────

  private updateShooter(delta: number, playerX: number, playerY: number): void {
    // 直線射擊施法中：倒數計時，期間停止所有 shooter 邏輯與移動（移動由 isCastingSkill 鎖定）
    if (this.lineShotCasting) {
      this.lineShotCastTimer -= delta;
      if (this.lineShotCastTimer <= 0) {
        this.endLineShotCast();
      }
      return;
    }

    // 彈幕技能施法動畫播放中：暫停所有 shooter 邏輯，避免邊走邊放或重複觸發
    if (this.isCastingSkill) return;

    // ── 投射物彈幕 ──────────────────────────────────────────────────────
    this.shooterCooldown -= delta;
    if (this.shooterCooldown <= 0) {
      this.shooterCooldown = this.SHOOTER_COOLDOWN;

      if (this.onShootProjectile) {
        evictOldestIfNeeded();

        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 1) {
          const pattern = this.shooterPatternIndex % 4;
          this.shooterPatternIndex++;

          switch (pattern) {
            case 0: this.fireFanPattern(dx, dy, dist); break;
            case 1: this.fireBurstPattern(playerX, playerY); break;
            case 2: this.fireRingPattern(); break;
            case 3: this.fireCrossPattern(dx, dy, dist); break;
          }

          // 彈幕（非直線射擊）施放時播放 boss2_skill1 攻擊動畫並停止移動
          this.playShooterCastAnim();
        }
      }
    }

    // ── 黑洞技能已移除 ────────────────────────────────────────────────

    // ── 直線射擊技能（單發高傷害狙擊型）────────────────────────────────
    this.lineAttackCooldown -= delta;
    if (this.lineAttackCooldown <= 0) {
      // 下次冷卻時間：6～8 秒隨機
      this.lineAttackCooldown = this.LINE_ATTACK_COOLDOWN_MIN +
        Math.random() * (this.LINE_ATTACK_COOLDOWN_MAX - this.LINE_ATTACK_COOLDOWN_MIN);

      // 記錄玩家當下位置，計算 Boss → 玩家方向（鎖定，不追蹤）
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 1 && this.onLineShot) {
        const angle = Math.atan2(dy, dx);
        // 進入施法狀態：停止移動、面向方向、播放準備動畫
        this.startLineShotCast(dx);
        // 觸發 GameScene 生成警示線 + 單發直線攻擊（方向已鎖定）
        this.onLineShot(this.x, this.y, angle);
      }
    }
  }

  /**
   * 開始直線射擊施法：鎖定方向、停止移動、播放 boss2_skill2 準備動畫。
   * 設定 isCastingSkill = true（moveTowardPlayer 會因此停止移動），
   * 並啟動 lineShotCastTimer，倒數結束後由 endLineShotCast 恢復。
   * 不使用 timer/delayedCall：施法倒數由 updateShooter 累減，暫停 / 死亡時自然停止。
   * @param dx 玩家相對 Boss 的水平向量（用於決定面向）
   */
  private startLineShotCast(dx: number): void {
    this.lineShotCasting = true;
    this.isCastingSkill = true;
    this.lineShotCastTimer = this.LINE_SHOT_CAST_DURATION;

    // 面向射擊方向（朝左時翻轉）
    if (this.visual instanceof Phaser.GameObjects.Sprite ||
        this.visual instanceof Phaser.GameObjects.Image) {
      this.visual.setFlipX(dx < 0);
    }

    // 播放直線射擊專用準備動畫（boss2_skill2，不套用 skill1）
    if (this.visual instanceof Phaser.GameObjects.Sprite &&
        this.scene.anims.exists('boss2_skill2')) {
      this.visual.play('boss2_skill2');
    }
  }

  /**
   * 結束直線射擊施法：解除施法鎖定並恢復走路動畫。
   */
  private endLineShotCast(): void {
    this.lineShotCasting = false;
    this.isCastingSkill = false;
    if (!this.isDying &&
        this.visual instanceof Phaser.GameObjects.Sprite && this.visual.active &&
        this.scene.anims.exists('boss2_walk')) {
      this.visual.play('boss2_walk');
    }
  }

  /**
   * 播放二當家彈幕施法動畫（boss2_skill1）。
   * 僅當使用 Sprite 且 boss2_skill1 動畫存在時才執行；否則保留原本技能邏輯（不凍結、不崩潰）。
   * 播放期間 isCastingSkill = true（停止移動、鎖定走路動畫），動畫結束後恢復 boss2_walk。
   * 使用一次性動畫事件監聽，不使用 timer/delayedCall，Boss 銷毀時監聽自動失效，避免報錯。
   */
  private playShooterCastAnim(): void {
    if (!(this.visual instanceof Phaser.GameObjects.Sprite) ||
        !this.scene.anims.exists('boss2_skill1')) {
      return; // 無動畫素材：保留原本彈幕邏輯，不凍結
    }
    const spr = this.visual;
    this.isCastingSkill = true;
    spr.play('boss2_skill1');

    const onSkillDone = (anim: Phaser.Animations.Animation) => {
      if (anim.key !== 'boss2_skill1') return;
      spr.off(Phaser.Animations.Events.ANIMATION_COMPLETE, onSkillDone);
      this.isCastingSkill = false;
      // 恢復走路動畫（Boss 仍存活且未在播其他技能時）
      if (!this.isDying &&
          this.visual instanceof Phaser.GameObjects.Sprite && this.visual.active &&
          this.scene.anims.exists('boss2_walk')) {
        this.visual.play('boss2_walk');
      }
    };
    spr.on(Phaser.Animations.Events.ANIMATION_COMPLETE, onSkillDone);
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
    // ── 護盾視覺已移除（震罡功已移除）──────────────────────────────────

    // ── 技能施放中：等待 GameScene 呼叫 shieldEndCast() ──────────────
    if (this.shieldCasting) return;

    // ── 技能選擇間隔計時 ──────────────────────────────────────────────
    if (this.skillSelectTimer > 0) {
      this.skillSelectTimer -= delta;
      return;
    }

    // ── 技能冷卻倒計時 ────────────────────────────────────────────────
    // 震罡功已移除
    this.leapCooldown        -= delta;
    this.warCryCooldown      -= delta;
    this.comboStrikeCooldown -= delta;

    // ── 隨機選擇冷卻完成的技能 ────────────────────────────────────────
    const available: Array<'leap' | 'warcry' | 'combo'> = [];
    // 震罡功已移除
    if (this.leapCooldown        <= 0) available.push('leap');
    if (this.warCryCooldown      <= 0) available.push('warcry');
    if (this.comboStrikeCooldown <= 0) available.push('combo');

    if (available.length === 0) return;

    const chosen = available[Math.floor(Math.random() * available.length)];
    this.shieldCasting = true;

    const dx = (playerX ?? this.x + 1) - this.x;
    const dy = (playerY ?? this.y) - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;

    switch (chosen) {
      // 震罡功已移除

      case 'leap':
        this.leapCooldown = this.LEAP_COOLDOWN_MIN +
          Math.random() * (this.LEAP_COOLDOWN_MAX - this.LEAP_COOLDOWN_MIN);
        // 進入霸山墜技能狀態：立即停止移動與走路動畫，改播技能動畫（由 GameScene 處理）
        this.isUsingSkill = true;
        if (this.onLeapSlam && playerX !== undefined && playerY !== undefined) {
          this.onLeapSlam(this.x, this.y, playerX, playerY,
            Math.ceil(this.contactDamage * 1.3));
        }
        break;

      case 'warcry':
        this.warCryCooldown = this.WARCRY_COOLDOWN_MIN +
          Math.random() * (this.WARCRY_COOLDOWN_MAX - this.WARCRY_COOLDOWN_MIN);
        if (this.onWarCry) {
          this.onWarCry(this.x, this.y, dirX, dirY, this);
        }
        break;

      case 'combo':
        this.comboStrikeCooldown = this.COMBO_STRIKE_COOLDOWN_MIN +
          Math.random() * (this.COMBO_STRIKE_COOLDOWN_MAX - this.COMBO_STRIKE_COOLDOWN_MIN);
        if (this.onComboStrike) {
          this.onComboStrike(this.x, this.y, dirX, dirY, this);
        }
        break;
    }
  }

  /**
   * 結束技能施放狀態（由 GameScene 在技能動畫結束後呼叫）
   */
  public shieldEndCast(): void {
    this.shieldCasting = false;
    this.isUsingSkill = false; // 解除技能動畫鎖，恢復走路 / 追蹤
    this.skillSelectTimer = this.SKILL_SELECT_INTERVAL;
  }

  // ── 震罡功護盾方法已移除 ──────────────────────────────────────────────
  // shieldActivate()、shieldDeactivate()、showShieldVisual() 已移除

  // ─────────────────────────────────────────────────────────────────────────
  // 視覺私有方法
  // ─────────────────────────────────────────────────────────────────────────

  private drawVisual(enemyId: string, visualRadius?: number): void {
    // 只有 Graphics 才能繪製；Image 已有 texture，不需要重繪
    if (!(this.visual instanceof Phaser.GameObjects.Graphics)) return;
    const g = this.visual;
    g.clear();

    // 精英怪和普通小怪使用傳入的 visualRadius；若未傳入則用 collisionRadius
    const r = visualRadius ?? this.collisionRadius;

    if (enemyId === 'charger') {
      // 紅金色衝鋒武將（r ≈ 30）
      g.fillStyle(0xff4400, 0.35); g.fillCircle(0, 0, r);
      g.fillStyle(0xcc2200, 1);
      g.fillRect(-r * 0.4, -r * 0.17, r * 0.8, r * 0.6);   // 身體
      g.fillStyle(0xffaa00, 1);
      g.fillCircle(0, -r * 0.5, r * 0.37);                  // 頭
      g.fillStyle(0xffd700, 1);
      g.fillRect(-r * 0.37, -r * 0.73, r * 0.73, r * 0.3); // 頭盔
      g.fillRect(-r * 0.1, -r * 0.93, r * 0.2, r * 0.23);
      g.fillRect(r * 0.43, -r * 0.87, r * 0.13, r * 1.13); // 長矛
      g.fillRect(r * 0.3, -r * 0.87, r * 0.4, r * 0.17);
      g.fillStyle(0xffd700, 0.9);
      g.fillRect(-r * 0.4, r * 0.17, r * 0.8, r * 0.13);   // 腰帶
      g.lineStyle(2, 0xff6600, 0.8); g.strokeCircle(0, 0, r * 0.87);

    } else if (enemyId === 'shooter') {
      // 紫藍色遠程法師（r ≈ 30）
      g.fillStyle(0x6600ff, 0.35); g.fillCircle(0, 0, r);
      g.fillStyle(0x330088, 1);
      g.fillRect(-r * 0.33, -r * 0.13, r * 0.67, r * 0.53); // 身體
      g.fillStyle(0x9933ff, 1);
      g.fillCircle(0, -r * 0.43, r * 0.33);                  // 頭
      g.fillStyle(0x6600cc, 1);
      g.fillTriangle(0, -r * 0.93, -r * 0.33, -r * 0.43, r * 0.33, -r * 0.43); // 法師帽
      g.fillStyle(0xaaaaff, 1);
      g.fillCircle(-r * 0.47, r * 0.07, r * 0.17);           // 左手法球
      g.fillCircle( r * 0.47, r * 0.07, r * 0.17);           // 右手法球
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(-r * 0.47, r * 0.07, r * 0.07);
      g.fillCircle( r * 0.47, r * 0.07, r * 0.07);
      g.lineStyle(2, 0xaa44ff, 0.8); g.strokeCircle(0, 0, r * 0.73);

    } else if (enemyId === 'shield') {
      // 金青色重甲護盾怪（r ≈ 30）
      g.fillStyle(0x00ccaa, 0.35); g.fillCircle(0, 0, r);
      g.fillStyle(0x005544, 1);
      g.fillRect(-r * 0.47, -r * 0.2, r * 0.93, r * 0.73);  // 身體
      g.fillStyle(0xddccaa, 1);
      g.fillCircle(0, -r * 0.53, r * 0.37);                  // 頭
      g.fillStyle(0x00aa88, 1);
      g.fillRect(-r * 0.43, -r * 0.8, r * 0.87, r * 0.33);  // 頭盔
      g.fillRect(-r * 0.13, -r * 1.0, r * 0.27, r * 0.23);
      g.fillStyle(0x008866, 1);
      g.fillRect(-r * 0.87, -r * 0.33, r * 0.47, r * 0.8);  // 盾牌
      g.fillStyle(0xffd700, 1);
      g.fillRect(-r * 0.87, -r * 0.33, r * 0.47, r * 0.1);
      g.fillRect(-r * 0.87, r * 0.37, r * 0.47, r * 0.1);
      g.fillRect(-r * 0.87, 0, r * 0.1, r * 0.47);
      g.fillStyle(0xffd700, 0.9);
      g.fillRect(-r * 0.47, r * 0.2, r * 0.93, r * 0.13);   // 腰帶
      g.lineStyle(2.5, 0x00ffcc, 0.8); g.strokeCircle(0, 0, r * 0.93);

    } else if (enemyId === 'elite') {
      // 舊版通用精英（向下相容，r ≈ 30）
      g.fillStyle(0xffd700, 0.25); g.fillCircle(0, 0, r);
      g.fillStyle(0xff8800, 0.30); g.fillCircle(0, 0, r * 0.8);
      g.fillStyle(0x660000, 1);
      g.fillRect(-r * 0.33, r * 0.4, r * 0.23, r * 0.47); g.fillRect(r * 0.1, r * 0.4, r * 0.23, r * 0.47);
      g.fillStyle(0x990000, 1); g.fillRect(-r * 0.43, -r * 0.2, r * 0.87, r * 0.67);
      g.fillStyle(0xddccaa, 1); g.fillCircle(0, -r * 0.53, r * 0.4);
      g.fillStyle(0xffd700, 1);
      g.fillRect(-r * 0.4, -r * 0.8, r * 0.8, r * 0.33); g.fillRect(-r * 0.13, -r * 1.0, r * 0.27, r * 0.27);
      g.fillRect(r * 0.47, -r * 0.93, r * 0.17, r * 1.27); g.fillRect(r * 0.33, -r * 0.93, r * 0.47, r * 0.2);
      g.fillStyle(0xffd700, 0.9); g.fillRect(-r * 0.43, r * 0.2, r * 0.87, r * 0.13);
      g.lineStyle(2, 0xffd700, 0.8); g.strokeCircle(0, 0, r * 0.87);

    } else if (enemyId === 'henchman') {
      // ── 紅衣邪修小兵（r ≈ 18，尺寸 36×36）──────────────────────────
      // 頭（膚色圓）
      g.fillStyle(0xddccaa, 1); g.fillCircle(0, -r * 0.55, r * 0.32);
      // 頭盔（深紅）
      g.fillStyle(0xaa1111, 1);
      g.fillRect(-r * 0.28, -r * 0.87, r * 0.56, r * 0.22);
      g.fillRect(-r * 0.1,  -r * 1.0,  r * 0.2,  r * 0.15);
      // 身體（紅色）
      g.fillStyle(0xcc2222, 1); g.fillRect(-r * 0.32, -r * 0.22, r * 0.64, r * 0.5);
      // 腰帶（深色）
      g.fillStyle(0x880000, 1); g.fillRect(-r * 0.32, r * 0.22, r * 0.64, r * 0.1);
      // 腿（深紅）
      g.fillStyle(0xaa1111, 1);
      g.fillRect(-r * 0.28, r * 0.32, r * 0.22, r * 0.38);
      g.fillRect( r * 0.06, r * 0.32, r * 0.22, r * 0.38);
      // 短刃（右側，亮灰）
      g.fillStyle(0xdddddd, 1); g.fillRect(r * 0.36, -r * 0.3, r * 0.1, r * 0.5);
      g.fillStyle(0xaaaaaa, 1); g.fillRect(r * 0.3,  -r * 0.3, r * 0.22, r * 0.08);
      // 外框
      g.lineStyle(1.5, 0xff6666, 0.9);
      g.strokeRect(-r * 0.32, -r * 0.22, r * 0.64, r * 0.5);

    } else if (enemyId === 'scout') {
      // ── 疾行刺客（r ≈ 14，尺寸 28×28）──────────────────────────────
      // 頭（小，膚色）
      g.fillStyle(0xddccaa, 1); g.fillCircle(0, -r * 0.6, r * 0.26);
      // 頭巾（橘紅）
      g.fillStyle(0xff5500, 1);
      g.fillRect(-r * 0.22, -r * 0.88, r * 0.44, r * 0.18);
      // 細長身體（橘紅）
      g.fillStyle(0xff6600, 1); g.fillRect(-r * 0.24, -r * 0.28, r * 0.48, r * 0.52);
      // 腿（深橘）
      g.fillStyle(0xcc4400, 1);
      g.fillRect(-r * 0.22, r * 0.24, r * 0.18, r * 0.42);
      g.fillRect( r * 0.04, r * 0.24, r * 0.18, r * 0.42);
      // 速度線（左側兩條，亮黃）
      g.lineStyle(2, 0xffdd44, 1);
      g.lineBetween(-r * 1.1, -r * 0.1, -r * 0.3, -r * 0.1);
      g.lineBetween(-r * 1.2,  r * 0.15, -r * 0.3,  r * 0.15);
      // 短刀（右側）
      g.fillStyle(0xcccccc, 1); g.fillRect(r * 0.3, -r * 0.35, r * 0.08, r * 0.4);
      // 外框
      g.lineStyle(1.5, 0xffaa44, 0.9);
      g.strokeRect(-r * 0.24, -r * 0.28, r * 0.48, r * 0.52);

    } else if (enemyId === 'giant') {
      // ── 重甲力士（r ≈ 24，尺寸 48×48）──────────────────────────────
      // 頭（膚色，較大）
      g.fillStyle(0xddccaa, 1); g.fillCircle(0, -r * 0.52, r * 0.35);
      // 頭盔（深紅，厚重）
      g.fillStyle(0x880000, 1);
      g.fillRect(-r * 0.35, -r * 0.88, r * 0.7, r * 0.25);
      g.fillRect(-r * 0.12, -r * 1.05, r * 0.24, r * 0.18);
      // 寬肩護甲（深紅）
      g.fillStyle(0xaa0000, 1);
      g.fillRect(-r * 0.55, -r * 0.28, r * 0.2, r * 0.22); // 左肩
      g.fillRect( r * 0.35, -r * 0.28, r * 0.2, r * 0.22); // 右肩
      // 厚重身體（深紅）
      g.fillStyle(0xcc1111, 1); g.fillRect(-r * 0.42, -r * 0.18, r * 0.84, r * 0.55);
      // 護甲紋路（暗色橫線）
      g.fillStyle(0x880000, 1);
      g.fillRect(-r * 0.42, r * 0.05, r * 0.84, r * 0.07);
      g.fillRect(-r * 0.42, r * 0.2,  r * 0.84, r * 0.07);
      // 腰帶（金色）
      g.fillStyle(0xcc8800, 1); g.fillRect(-r * 0.42, r * 0.32, r * 0.84, r * 0.1);
      // 腿（深紅，粗）
      g.fillStyle(0xaa0000, 1);
      g.fillRect(-r * 0.38, r * 0.42, r * 0.3, r * 0.42);
      g.fillRect( r * 0.08, r * 0.42, r * 0.3, r * 0.42);
      // 外框（粗，亮紅）
      g.lineStyle(2.5, 0xff4444, 1);
      g.strokeRect(-r * 0.42, -r * 0.18, r * 0.84, r * 0.55);

    } else if (enemyId === 'archer') {
      // ── 紫袍術士（r ≈ 18，尺寸 36×36）──────────────────────────────
      // 頭（膚色）
      g.fillStyle(0xddccaa, 1); g.fillCircle(0, -r * 0.55, r * 0.3);
      // 法師帽（深紫三角）
      g.fillStyle(0x440066, 1);
      g.fillTriangle(0, -r * 1.05, -r * 0.28, -r * 0.7, r * 0.28, -r * 0.7);
      // 紫袍身體
      g.fillStyle(0x7700aa, 1); g.fillRect(-r * 0.3, -r * 0.22, r * 0.6, r * 0.52);
      // 袍子下擺（略寬）
      g.fillStyle(0x660099, 1); g.fillRect(-r * 0.36, r * 0.22, r * 0.72, r * 0.22);
      // 腰帶（金色）
      g.fillStyle(0xcc8800, 1); g.fillRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.08);
      // 左手法球（亮紫）
      g.fillStyle(0xdd44ff, 1); g.fillCircle(-r * 0.48, r * 0.0, r * 0.18);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(-r * 0.48, r * 0.0, r * 0.08);
      // 右手法球（亮紫）
      g.fillStyle(0xdd44ff, 1); g.fillCircle( r * 0.48, r * 0.0, r * 0.18);
      g.fillStyle(0xffffff, 0.8); g.fillCircle( r * 0.48, r * 0.0, r * 0.08);
      // 外框（亮紫）
      g.lineStyle(1.5, 0xcc66ff, 0.9);
      g.strokeRect(-r * 0.3, -r * 0.22, r * 0.6, r * 0.52);
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

    // 輕量縮放回饋（baseScale → baseScale*1.08 → baseScale）
    // 使用 visualBaseScaleX/Y 確保 Sprite 不會被強制 reset 到 scale=1
    if (this.visual && this.visual.active && !this.isDying) {
      const bsx = this.visualBaseScaleX;
      const bsy = this.visualBaseScaleY;
      this.scene.tweens.add({
        targets: this.visual,
        scaleX: bsx * 1.08, scaleY: bsy * 1.08,
        duration: 55, ease: 'Power1',
        yoyo: true,
        onComplete: () => {
          if (this.visual && this.visual.active && !this.isDying) {
            this.visual.setScale(bsx, bsy);
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
