import { EnemyData } from '../types/index';

/**
 * 敵人資料表
 *
 * 分類規則：
 * - category: 'normal' → 普通小怪，由 spawnEnemy() 生成
 * - category: 'elite'  → 精英怪，由 spawnEliteEnemy() 生成，有獨立基礎數值
 * - category: 'boss'   → Boss，由 spawnBossEnemy() 生成（預留），有獨立基礎數值
 *
 * 不同 category 之間不共用 baseData。
 * 新增敵人時必須明確指定 category。
 */
export const ENEMIES: EnemyData[] = [

  // ── 普通小怪（normal）────────────────────────────────────────────────────
  {
    id: 'henchman',
    category: 'normal',
    name: '山賊嘍囉',
    baseHP: 50,
    baseMoveSpeed: 80,
    baseDamage: 8,
    expDrop: 5,
    collisionRadius: 16,
    spriteKey: 'enemy_img_basic',
  },
  {
    id: 'scout',
    category: 'normal',
    name: '赤侯',
    baseHP: 35,
    baseMoveSpeed: 140,
    baseDamage: 7,
    expDrop: 5,
    collisionRadius: 12,
    spriteKey: 'enemy_img_fast',
  },
  {
    id: 'giant',
    category: 'normal',
    name: '巨漢',
    baseHP: 180,
    baseMoveSpeed: 50,
    baseDamage: 18,
    expDrop: 15,
    collisionRadius: 20,
    spriteKey: 'enemy_img_tank',
  },
  {
    id: 'archer',
    category: 'normal',
    name: '山賊射手',
    baseHP: 45,
    baseMoveSpeed: 55,
    baseDamage: 5,
    expDrop: 10,
    collisionRadius: 14,
    attackRange: 290,
    fireInterval: 2.8,
    projectileSpeed: 200,
    projectileDamage: 7,
    spriteKey: 'enemy_img_ranged',
  },

  // ── 精英怪（elite）───────────────────────────────────────────────────────
  // 精英怪有獨立基礎數值，不借用普通小怪資料。
  // DifficultyScaler 的 hpMultiplier / damageMultiplier 仍會套用，
  // 但不再額外乘以 hpScales / dmgScales 倍率（數值已內建於此）。
  {
    id: 'elite_charger',
    category: 'elite',
    name: '大當家',
    // 衝撞型：高速、中等血量、高接觸傷害（第三波出場，最終頭目）
    baseHP: 3500,
    baseMoveSpeed: 70,   // 由 spawnEliteEnemy 直接設定，此值作備查
    baseDamage: 28,
    expDrop: 0,          // 精英怪 expDrop 由 GameScene 統一處理（掉 gem）
    collisionRadius: 28,
  },
  {
    id: 'elite_shooter',
    category: 'elite',
    name: '二當家',
    // 遠程控場型：低速、高血量、投射物彈幕 + 黑洞 + 直線攻擊（第二波出場）
    baseHP: 2500,
    baseMoveSpeed: 45,
    baseDamage: 12,      // 接觸傷害（低，主要靠投射物與控場技能）
    expDrop: 0,
    collisionRadius: 28,
    // 投射物參數由 Enemy.ts 的 SHOOTER_* 常數控制
    // 黑洞與直線攻擊由 Enemy.ts 的 blackholeCooldown / lineAttackCooldown 控制
  },
  {
    id: 'elite_shield',
    category: 'elite',
    name: '三當家',
    // 護盾型：中速、最高血量、護盾 + 衝擊波（第一波出場）
    baseHP: 2000,
    baseMoveSpeed: 50,
    baseDamage: 22,
    expDrop: 0,
    collisionRadius: 28,
  },

  // ── Boss（boss）──────────────────────────────────────────────────────────
  // Boss 預留，目前尚未實作 spawnBossEnemy()。
  // 數值為設計草稿，可依需求調整。
  {
    id: 'boss_1',
    category: 'boss',
    name: '第一階段 Boss',
    baseHP: 8000,
    baseMoveSpeed: 60,
    baseDamage: 35,
    expDrop: 0,
    collisionRadius: 40,
  },
  {
    id: 'boss_2',
    category: 'boss',
    name: '第二階段 Boss',
    baseHP: 14000,
    baseMoveSpeed: 65,
    baseDamage: 45,
    expDrop: 0,
    collisionRadius: 44,
  },
  {
    id: 'boss_3',
    category: 'boss',
    name: '最終 Boss',
    baseHP: 22000,
    baseMoveSpeed: 70,
    baseDamage: 60,
    expDrop: 0,
    collisionRadius: 48,
  },
];

export const getEnemyById = (id: string): EnemyData | undefined => {
  return ENEMIES.find(e => e.id === id);
};

/** 取得指定分類的所有敵人資料 */
export const getEnemiesByCategory = (
  category: 'normal' | 'elite' | 'boss'
): EnemyData[] => {
  return ENEMIES.filter(e => e.category === category);
};
