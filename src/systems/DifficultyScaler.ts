import { DifficultyState, DifficultyId, DifficultyConfig } from '../types/index';
import { getDifficultyConfig } from '../data/difficulties';

// ── 工具函式 ──────────────────────────────────────────────────────────────────

/** 將 value 限制在 [min, max] 範圍內 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 線性插值：t=0 回傳 a，t=1 回傳 b */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── 難度曲線常數 ──────────────────────────────────────────────────────────────

/**
 * 難度滿強度時間（秒）
 * difficulty = clamp(elapsedSeconds / FULL_DIFFICULTY_SEC, 0, 1)
 * 0 秒 = 0.0，300 秒（5 分鐘）= 1.0
 */
const FULL_DIFFICULTY_SEC = 300;

/** 最後怪潮開始時間（秒）：9 分鐘 */
const FINAL_WAVE_START_SEC = 9 * 60;

// ── 核心公式（不含難度倍率，純時間曲線）─────────────────────────────────────

/**
 * 依遊戲時間計算基礎難度狀態，再套用難度設定倍率。
 *
 * 時間曲線公式：
 *   difficulty = clamp(elapsedSeconds / 300, 0, 1)
 *   maxEnemies     = floor(25 + difficulty^1.35 * 175)  → 開局 25，5 分鐘 200
 *   spawnInterval  = lerp(1300, 280, difficulty^0.85) ms → 開局 ~1300ms，後期 ~280ms
 *   spawnBatchSize = floor(1 + difficulty^1.2 * 5)       → 開局 1，後期 6
 *   hpMultiplier   = 1.10^N（每 60 秒 ×1.10）
 *   damageMultiplier = 1.10^N
 *
 * 難度倍率（DifficultyConfig）額外套用於：
 *   - normal 小怪：enemyHpMultiplier / enemyDamageMultiplier
 *   - elite 精英：eliteHpMultiplier / eliteDamageMultiplier
 *   - boss Boss：bossHpMultiplier / bossDamageMultiplier
 *   - spawnInterval：÷ spawnRateMultiplier（值越大生成越快）
 *   - maxEnemies：× maxEnemyMultiplier
 *
 * @param elapsedSeconds 遊戲已進行秒數（非負數）
 * @param config 難度設定（由 DifficultyScaler 持有）
 * @param category 敵人分類，決定套用哪組 HP / 傷害倍率
 * @returns DifficultyState
 */
export function getDifficultyState(
  elapsedSeconds: number,
  config: DifficultyConfig,
  category: 'normal' | 'elite' | 'boss' = 'normal'
): DifficultyState {
  const seconds = Math.max(0, elapsedSeconds);

  // ── difficulty：0.0（開局）→ 1.0（5 分鐘後滿強度）────────────────────
  const difficulty = clamp(seconds / FULL_DIFFICULTY_SEC, 0, 1);

  // ── 時間成長倍率：每 60 秒 ×1.10 ────────────────────────────────────
  const N = Math.floor(seconds / 60);
  const timeHpMult    = Math.pow(1.10, N);
  const timeDmgMult   = Math.pow(1.10, N);

  // ── 依 category 套用難度倍率 ─────────────────────────────────────────
  let diffHpMult: number;
  let diffDmgMult: number;
  switch (category) {
    case 'elite':
      diffHpMult  = config.eliteHpMultiplier;
      diffDmgMult = config.eliteDamageMultiplier;
      break;
    case 'boss':
      diffHpMult  = config.bossHpMultiplier;
      diffDmgMult = config.bossDamageMultiplier;
      break;
    case 'normal':
    default:
      diffHpMult  = config.enemyHpMultiplier;
      diffDmgMult = config.enemyDamageMultiplier;
      break;
  }

  const hpMultiplier     = timeHpMult  * diffHpMult;
  const damageMultiplier = timeDmgMult * diffDmgMult;

  // ── maxEnemies：套用 maxEnemyMultiplier ───────────────────────────────
  const baseMaxEnemies = Math.floor(25 + Math.pow(difficulty, 1.35) * 175);
  const maxEnemies = Math.floor(baseMaxEnemies * config.maxEnemyMultiplier);

  // ── spawnInterval（毫秒）：÷ spawnRateMultiplier（值越大生成越快）────
  // spawnRateMultiplier > 1 → 間隔縮短 → 生成更快（hard）
  // spawnRateMultiplier < 1 → 間隔拉長 → 生成更慢（easy）
  const baseInterval = lerp(1300, 280, Math.pow(difficulty, 0.85));
  const adjustedInterval = baseInterval / config.spawnRateMultiplier;
  const spawnInterval = seconds >= FINAL_WAVE_START_SEC
    ? Math.max(200, adjustedInterval * 0.75)
    : Math.max(280, adjustedInterval);

  // ── spawnBatchSize：開局 1，後期 6 ───────────────────────────────────
  const spawnBatchSize = Math.floor(1 + Math.pow(difficulty, 1.2) * 5);

  // ── 生成比例：依 difficulty 平滑過渡 ─────────────────────────────────
  let basicRatio: number;
  let fastRatio: number;
  let tankRatio: number;

  if (seconds >= FINAL_WAVE_START_SEC) {
    basicRatio = 0.3;
    fastRatio  = 0.3;
    tankRatio  = 0.4;
  } else {
    basicRatio = lerp(1.0, 0.5, difficulty);
    fastRatio  = lerp(0.0, 0.3, difficulty);
    tankRatio  = lerp(0.0, 0.2, difficulty);
    const total = basicRatio + fastRatio + tankRatio;
    basicRatio /= total;
    fastRatio  /= total;
    tankRatio  /= total;
  }

  return {
    hpMultiplier,
    damageMultiplier,
    spawnInterval,
    spawnRatio: { basic: basicRatio, fast: fastRatio, tank: tankRatio },
    maxEnemies,
    spawnBatchSize,
  };
}

/**
 * DifficultyScaler 類別
 * 持有當前難度設定，提供 getState() 供 GameScene 呼叫。
 *
 * 預設難度：'normal'
 * 之後新增難度選擇 UI 時，只需在 GameScene.create() 傳入 difficultyId 即可。
 */
export class DifficultyScaler {
  private config: DifficultyConfig;

  /**
   * @param difficultyId 遊戲難度，預設 'normal'
   */
  constructor(difficultyId: DifficultyId = 'normal') {
    this.config = getDifficultyConfig(difficultyId);
  }

  /** 取得當前難度設定 */
  public getConfig(): DifficultyConfig {
    return this.config;
  }

  /**
   * 依遊戲時間與敵人分類計算難度狀態
   * @param elapsedSeconds 遊戲已進行秒數
   * @param category 敵人分類（'normal' | 'elite' | 'boss'），預設 'normal'
   */
  public getState(
    elapsedSeconds: number,
    category: 'normal' | 'elite' | 'boss' = 'normal'
  ): DifficultyState {
    return getDifficultyState(elapsedSeconds, this.config, category);
  }
}
