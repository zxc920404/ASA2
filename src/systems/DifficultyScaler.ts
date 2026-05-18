import { DifficultyState } from '../types/index';

/** 初始生成間隔（毫秒） */
const INITIAL_SPAWN_INTERVAL_MS = 1000;

/**
 * 依遊戲時間計算難度狀態（Requirement 8.1、8.3、7.2）
 *
 * - 每 60 秒：HP 與傷害倍率 × 1.10^N（Requirement 8.1）
 * - 每 30 秒：生成間隔縮短，頻率 × 1.15^M（Requirement 8.3）
 * - 生成比例依時間區間切換（Requirement 7.2）
 *
 * @param elapsedSeconds 遊戲已進行秒數（非負數）
 * @returns DifficultyState
 */
export function getDifficultyState(elapsedSeconds: number): DifficultyState {
  const seconds = Math.max(0, elapsedSeconds);

  // N = 已完成的 60 秒週期數（Requirement 8.1）
  const N = Math.floor(seconds / 60);
  const hpMultiplier = Math.pow(1.10, N);
  const damageMultiplier = Math.pow(1.10, N);

  // M = 已完成的 30 秒週期數（Requirement 8.3）
  const M = Math.floor(seconds / 30);
  const spawnInterval = INITIAL_SPAWN_INTERVAL_MS / Math.pow(1.15, M);

  // 生成比例依時間區間（Requirement 7.2）
  let spawnRatio: DifficultyState['spawnRatio'];
  if (seconds <= 60) {
    spawnRatio = { basic: 1.0, fast: 0.0, tank: 0.0 };
  } else if (seconds <= 120) {
    spawnRatio = { basic: 0.7, fast: 0.2, tank: 0.1 };
  } else {
    spawnRatio = { basic: 0.5, fast: 0.3, tank: 0.2 };
  }

  return {
    hpMultiplier,
    damageMultiplier,
    spawnInterval,
    spawnRatio,
  };
}

/**
 * DifficultyScaler 類別（可選用，包裝純函式以便在 GameScene 中持有狀態）
 */
export class DifficultyScaler {
  /**
   * 依遊戲時間計算難度狀態
   * @param elapsedSeconds 遊戲已進行秒數
   */
  public getState(elapsedSeconds: number): DifficultyState {
    return getDifficultyState(elapsedSeconds);
  }
}
