import { WeaponData } from '../types/index';

export const WEAPONS: WeaponData[] = [
  {
    id: 'guardian_ring',
    name: '守心環',
    // 環繞型武器，傷害從低到高逐級提升
    baseDamagePerLevel: [8, 12, 16, 22, 28, 36, 46, 60],
    baseAttackInterval: 1.2,
    baseAttackRange: 120,
    projectileSpeed: 0, // 環繞型，不需要投射物速度
  },
  {
    id: 'swift_blade',
    name: '疾風刃',
    // 直線投射型，高速低傷害
    baseDamagePerLevel: [10, 15, 21, 28, 36, 46, 58, 72],
    baseAttackInterval: 0.8,
    baseAttackRange: 200,
    projectileSpeed: 400,
  },
  {
    id: 'flame_seal',
    name: '赤焰印',
    // 範圍爆炸型，高傷害慢攻速
    baseDamagePerLevel: [15, 22, 30, 40, 52, 66, 82, 100],
    baseAttackInterval: 1.8,
    baseAttackRange: 150,
    projectileSpeed: 250,
  },
  {
    id: 'ice_spike',
    name: '寒冰錐',
    // 穿透型，中等傷害
    baseDamagePerLevel: [12, 18, 25, 33, 43, 55, 69, 85],
    baseAttackInterval: 1.0,
    baseAttackRange: 180,
    projectileSpeed: 350,
  },
  {
    id: 'thunder_claw',
    name: '雷霆爪',
    // 連鎖型，快速多段
    baseDamagePerLevel: [7, 11, 16, 22, 29, 38, 49, 62],
    baseAttackInterval: 0.6,
    baseAttackRange: 160,
    projectileSpeed: 300,
  },
  {
    id: 'poison_mist',
    name: '毒霧散',
    // 持續傷害型，低單次傷害但覆蓋廣
    baseDamagePerLevel: [5, 8, 12, 17, 23, 30, 39, 50],
    baseAttackInterval: 0.5,
    baseAttackRange: 130,
    projectileSpeed: 150,
  },
];

export const getWeaponById = (id: string): WeaponData | undefined => {
  return WEAPONS.find(w => w.id === id);
};
