// 角色特性類型
export type CharacterTrait = '屬性加成型' | '條件觸發型' | '行為修改型';

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
}

// 武器定義
export interface WeaponData {
  id: string;
  name: string;
  baseDamagePerLevel: number[]; // 保留向下相容，WeaponSystem 優先讀 levelStats
  baseAttackInterval: number;   // 秒（fallback 用）
  baseAttackRange: number;      // px（fallback 用）
  projectileSpeed: number;      // px/s（fallback 用）
  levelStats: WeaponLevelStats[]; // 長度 8，索引 0 = Lv1
}

// 被動道具定義
export interface PassiveData {
  id: string;
  name: string;
  stat: 'moveSpeed' | 'hp' | 'attackPower' | 'pickupRange' | 'attackRange' | 'attackSpeed';
  bonusPerLevel: number; // 每級加成量
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
}

// 玩家最終屬性（StatCalculator 輸出）
export interface PlayerStats {
  maxHP: number;
  moveSpeed: number;
  attackPower: number;
  pickupRange: number;
  attackRange: number;    // 由 WeaponSystem 使用
  attackInterval: number; // 由 WeaponSystem 使用
}

// 裝備欄
export interface EquipmentSlot {
  weapons: Array<{ weaponId: string; level: number }>;   // 上限 6
  passives: Array<{ passiveId: string; level: number }>; // 上限 6
}

// 升級選項
export interface UpgradeOption {
  type: 'newWeapon' | 'upgradeWeapon' | 'newPassive' | 'upgradePassive' | 'healHp';
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
  score: number;  // kills*10 + seconds*2 + maxLevel*50
  coins: number;  // floor(score/10)
}
