// 角色特性類型
export type CharacterTrait = '屬性加成型' | '條件觸發型' | '行為修改型';

// ── 武器分類二元結構 ──────────────────────────────────────────────────────
/**
 * WeaponForm：武器在 Phaser 裡的存在方式與運動形態
 * - orbit:      環繞玩家旋轉（守心環）
 * - projectile: 發射投射物飛向目標（疾風刃、寒冰錐）
 * - field:      在場地上生成持續區域（毒霧散）
 * - melee:      近身揮砍，瞬間判定（預留）
 * - strike:     瞬間打擊，有目標定位但無飛行物（赤焰印、雷霆爪）
 * - summon:     召喚擁有獨立 AI、位置、生命週期的實體（劍靈、靈獸、分身、護法、符傀等，預留）
 */
export type WeaponForm =
  | 'orbit'
  | 'projectile'
  | 'field'
  | 'melee'
  | 'strike'
  | 'summon';

/**
 * WeaponEffect：命中後或更新時的特殊戰鬥效果
 * - autoTarget: 自動追蹤最近敵人
 * - pierce:     穿透多個敵人
 * - returning:  命中或到達最大距離後返還玩家，回程可再次傷敵（流光返刃）
 * - bounce:     彈射到下一個目標（預留）
 * - chain:      鏈式傳遞傷害（預留）
 * - knockback:  擊退效果（預留）
 * - defense:    提供防禦/護盾效果（預留）
 * - dot:        持續傷害（Damage over Time）
 */
export type WeaponEffect =
  | 'autoTarget'
  | 'pierce'
  | 'returning'
  | 'bounce'
  | 'chain'
  | 'knockback'
  | 'defense'
  | 'dot';

// 角色定義
export interface CharacterData {
  id: string;
  name: string;
  baseHP: number;          // 50～500
  baseMoveSpeed: number;   // 80～200 px/s
  baseAttackPower: number; // 0.5～3.0
  basePickupRange: number; // 50～200 px
  startingWeaponId: string;
  trait: CharacterTrait;
  /** 宗門選擇畫面小圖示 key（對應 public/assets/sects/icons/<id>.png） */
  iconKey?: string;
  /** 宗門選擇畫面立繪 key（對應 public/assets/sects/portraits/<id>.png） */
  portraitKey?: string;
}

// 武器每級升級數值（統一結構，每級只給一個主要提升）
export interface WeaponLevelStats {
  damage: number;
  count?: number;        // 環繞體數量（守心環）或同時發射數（疾風刃/雷霆爪）
  range?: number;        // 攻擊範圍（px），覆蓋 baseAttackRange
  interval?: number;     // 攻擊間隔（秒），覆蓋 baseAttackInterval
  radius?: number;       // 爆炸半徑（px），赤焰印用
  pierce?: number;       // 穿透數（寒冰錐用，資料保留但暫未啟用）
  duration?: number;     // 持續時間（秒），未來擴充用
  projectileSpeed?: number; // 投射物速度（px/s），覆蓋 baseProjectileSpeed
  /** 返還傷害倍率（流光返刃用），回程傷害 = 去程傷害 × returnDamageMultiplier */
  returnDamageMultiplier?: number;
}

// 武器定義
export interface WeaponData {
  id: string;
  name: string;
  /** 武器的存在方式與運動形態 */
  form: WeaponForm;
  /** 命中後或更新時的特殊戰鬥效果（可為空陣列） */
  effects: WeaponEffect[];
  /**
   * 是否吃 amountBonus（玩家屬性中的武器單位數量加成）
   * - true：finalCount = baseCount + amountBonus（projectile / orbit / summon / strike 類）
   * - false 或未設定：不吃 amountBonus（field 類如毒霧散，避免數量失控）
   */
  usesAmountBonus?: boolean;
  baseDamagePerLevel: number[]; // 保留向下相容，WeaponSystem 優先讀 levelStats
  baseAttackInterval: number;   // 秒（fallback 用）
  baseAttackRange: number;      // px（fallback 用）
  projectileSpeed: number;      // px/s（fallback 用）
  levelStats: WeaponLevelStats[]; // 長度 8，索引 0 = Lv1
  /** HUD / 升級卡 / 武器欄圖示 key（對應 public/assets/icons/weapons/<id>.png） */
  iconKey?: string;
}

// 被動道具定義
export interface PassiveData {
  id: string;
  name: string;
  stat: 'moveSpeed' | 'hp' | 'attackPower' | 'pickupRange' | 'attackRange' | 'attackSpeed';
  bonusPerLevel: number; // 每級加成量
  /** HUD / 升級卡 / 被動欄圖示 key（對應 public/assets/icons/passives/<id>.png） */
  iconKey?: string;
}

// 敵人定義
export interface EnemyData {
  id: string;
  name: string;
  baseHP: number;
  baseMoveSpeed: number;
  baseDamage: number;
  expDrop: number;
  collisionRadius: number;
  /** 遠程攻擊範圍（px），有值表示此敵人為遠程型 */
  attackRange?: number;
  /** 遠程攻擊間隔（秒） */
  fireInterval?: number;
  /** 投射物速度（px/s） */
  projectileSpeed?: number;
  /** 投射物傷害 */
  projectileDamage?: number;
  /** GameScene 生成敵人時顯示的 sprite key（對應 public/assets/enemies/<id>.png） */
  spriteKey?: string;
}

// 玩家最終屬性（StatCalculator 輸出）
export interface PlayerStats {
  maxHP: number;
  moveSpeed: number;
  attackPower: number;
  pickupRange: number;
  attackRange: number;    // 由 WeaponSystem 使用（舊欄位，保留相容）
  attackInterval: number; // 由 WeaponSystem 使用（舊欄位，保留相容）
  /** 武器單位數量加成（+N 個投射物 / 環繞物 / 召喚物 / 打擊次數），預設 0 */
  amountBonus: number;
  /**
   * 武器冷卻倍率，預設 1.0
   * 例：0.8 = 冷卻縮短 20%（值越小攻擊越快）
   * 影響：所有武器的攻擊間隔
   */
  cooldownMultiplier: number;
  /**
   * 範圍倍率，預設 1.0
   * 影響：爆炸半徑、毒霧大小、火海範圍、環繞半徑
   */
  areaMultiplier: number;
  /**
   * 持續時間倍率，預設 1.0
   * 影響：毒霧持續時間、召喚物存在時間、Buff 時間
   */
  durationMultiplier: number;
  /**
   * 投射物速度倍率，預設 1.0
   * 影響：飛劍速度、寒冰錐速度、符咒飛行速度
   */
  projectileSpeedMultiplier: number;
}

// 裝備欄
export interface EquipmentSlot {
  weapons: Array<{ weaponId: string; level: number }>;   // 上限 6
  passives: Array<{ passiveId: string; level: number }>; // 上限 6
}

// 升級選項
export interface UpgradeOption {
  type: 'newWeapon' | 'upgradeWeapon' | 'evolveWeapon' | 'newPassive' | 'upgradePassive' | 'healHp';
  id: string;
  currentLevel: number; // 0 表示新裝備
  nextLevel: number;
}

// 難度縮放輸出
export interface DifficultyState {
  hpMultiplier: number;    // 1.10^N
  damageMultiplier: number;
  spawnInterval: number;   // 毫秒
  spawnRatio: { basic: number; fast: number; tank: number }; // 總和 = 1.0
}

// 結算資料
export interface GameResult {
  survivalSeconds: number;
  killCount: number;
  maxLevel: number;
  score: number;           // kills*10 + seconds*2 + maxLevel*50
  destinyPoints: number;   // 本局獲得天命點
  totalDestinyPoints: number; // 結算後總天命點
}
