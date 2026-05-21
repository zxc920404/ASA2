import { DifficultyConfig, DifficultyId } from '../types/index';

/**
 * 遊戲難度設定表
 *
 * 每個難度對三種敵人 category 套用不同倍率：
 * - normal（普通小怪）：enemyHpMultiplier / enemyDamageMultiplier
 * - elite（精英怪）：eliteHpMultiplier / eliteDamageMultiplier
 * - boss（Boss）：bossHpMultiplier / bossDamageMultiplier
 *
 * spawnRateMultiplier：套用於 spawnInterval（值越小生成越快）
 * maxEnemyMultiplier：套用於 maxEnemies 上限
 */
export const DIFFICULTY_CONFIGS: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: '簡單',
    enemyHpMultiplier:      0.75,
    enemyDamageMultiplier:  0.75,
    spawnRateMultiplier:    0.85,  // spawnInterval × 0.85 → 生成稍慢
    maxEnemyMultiplier:     0.75,
    eliteHpMultiplier:      0.8,
    eliteDamageMultiplier:  0.8,
    bossHpMultiplier:       0.8,
    bossDamageMultiplier:   0.8,
  },
  normal: {
    id: 'normal',
    name: '普通',
    enemyHpMultiplier:      1.0,
    enemyDamageMultiplier:  1.0,
    spawnRateMultiplier:    1.0,
    maxEnemyMultiplier:     1.0,
    eliteHpMultiplier:      1.0,
    eliteDamageMultiplier:  1.0,
    bossHpMultiplier:       1.0,
    bossDamageMultiplier:   1.0,
  },
  hard: {
    id: 'hard',
    name: '困難',
    enemyHpMultiplier:      1.35,
    enemyDamageMultiplier:  1.25,
    spawnRateMultiplier:    1.2,   // spawnInterval × 1.2 → 生成更快（值大 = 間隔短）
    maxEnemyMultiplier:     1.25,
    eliteHpMultiplier:      1.4,
    eliteDamageMultiplier:  1.25,
    bossHpMultiplier:       1.5,
    bossDamageMultiplier:   1.3,
  },
};

/** 取得指定難度設定，找不到時 fallback 至 normal */
export function getDifficultyConfig(id: DifficultyId): DifficultyConfig {
  return DIFFICULTY_CONFIGS[id] ?? DIFFICULTY_CONFIGS['normal'];
}
