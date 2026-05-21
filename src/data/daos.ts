import { DaoData } from '../types/index';

/**
 * 宗門大道資料表
 * 大道是 global modifier（全域規則增強），影響整個 build。
 * 必須透過升級選項取得，不會開局自動啟用。
 */
export const DAOS: DaoData[] = [
  {
    id: 'jinghong_split',
    name: '驚鴻命中後分裂',
    description: '投射物命中敵人後，生成 2 顆分裂子彈，向左右各偏 25 度飛出。',
    requiredCharacterId: 'assassin', // 驚鴻派
    requiredPlayerLevel: 10,
    requiredProjectileWeaponCount: 2,
    requiredProjectileWeaponLevel: 5,
  },
];

export const getDaoById = (id: string): DaoData | undefined => {
  return DAOS.find(d => d.id === id);
};
