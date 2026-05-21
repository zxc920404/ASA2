import { DaoData } from '../types/index';

/**
 * 宗門大道資料表
 * 大道是 global modifier（全域規則增強），影響整個 build。
 * 必須透過升級選項取得，不會開局自動啟用。
 *
 * 注意：jinghong_split 的出現條件已移至 UpgradePool 內部判定，
 * 此處的 requiredPlayerLevel / requiredProjectileWeaponCount 等欄位
 * 僅作為備查，不再由 UpgradePool 的通用迴圈讀取。
 */
export const DAOS: DaoData[] = [
  {
    id: 'jinghong_split',
    name: '驚鴻命中後分裂',
    description: '投射物命中敵人後，生成 2 顆分裂子彈，向左右各偏 25 度飛出。',
    requiredCharacterId: 'assassin', // 驚鴻派
    requiredPlayerLevel: 999,        // 特殊大道：不由通用迴圈判斷，由 UpgradePool 特殊邏輯控制
  },
];

export const getDaoById = (id: string): DaoData | undefined => {
  return DAOS.find(d => d.id === id);
};
