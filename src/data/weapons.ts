import { WeaponData } from '../types/index';

export const WEAPONS: WeaponData[] = [
  {
    id: 'guardian_ring',
    name: '守心環',
    baseDamagePerLevel: [10, 13, 13, 16, 16, 20, 20, 25], // 向下相容保留
    baseAttackInterval: 1.2,
    baseAttackRange: 120,
    projectileSpeed: 0,
    levelStats: [
      // Lv1：基礎，1 個環繞體
      { damage: 10, count: 1 },
      // Lv2：傷害提升
      { damage: 13, count: 1 },
      // Lv3：環繞體 +1（機制提升）
      { damage: 13, count: 2 },
      // Lv4：傷害提升
      { damage: 16, count: 2 },
      // Lv5：環繞體 +1（機制提升）
      { damage: 16, count: 3 },
      // Lv6：傷害提升
      { damage: 20, count: 3 },
      // Lv7：環繞體 +1（機制提升）
      { damage: 20, count: 4 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 25, count: 4 },
    ],
  },
  {
    id: 'swift_blade',
    name: '疾風刃',
    baseDamagePerLevel: [12, 15, 15, 18, 18, 22, 22, 28], // 向下相容保留
    baseAttackInterval: 0.8,
    baseAttackRange: 200,
    projectileSpeed: 400,
    levelStats: [
      // Lv1：基礎，單發
      { damage: 12, count: 1, interval: 0.8 },
      // Lv2：傷害提升
      { damage: 15, count: 1, interval: 0.8 },
      // Lv3：投射物 +1（機制提升）
      { damage: 15, count: 2, interval: 0.8 },
      // Lv4：傷害提升
      { damage: 18, count: 2, interval: 0.8 },
      // Lv5：攻擊範圍小幅提升（機制提升）
      { damage: 18, count: 2, interval: 0.8, range: 230 },
      // Lv6：傷害提升
      { damage: 22, count: 2, interval: 0.8, range: 230 },
      // Lv7：攻擊間隔縮短（機制提升）
      { damage: 22, count: 2, interval: 0.7, range: 230 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 28, count: 2, interval: 0.7, range: 230 },
    ],
  },
  {
    id: 'flame_seal',
    name: '赤焰印',
    baseDamagePerLevel: [15, 19, 24, 24, 30, 37, 37, 50], // 向下相容保留
    baseAttackInterval: 1.8,
    baseAttackRange: 150,
    projectileSpeed: 250,
    levelStats: [
      // Lv1：基礎，爆炸半徑 80
      { damage: 15, radius: 80, interval: 1.8 },
      // Lv2：傷害提升
      { damage: 19, radius: 80, interval: 1.8 },
      // Lv3：傷害提升
      { damage: 24, radius: 80, interval: 1.8 },
      // Lv4：爆炸半徑擴大（機制提升）
      { damage: 24, radius: 100, interval: 1.8 },
      // Lv5：傷害提升
      { damage: 30, radius: 100, interval: 1.8 },
      // Lv6：傷害提升
      { damage: 37, radius: 100, interval: 1.8 },
      // Lv7：爆炸半徑再擴大（機制提升）
      { damage: 37, radius: 120, interval: 1.8 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 50, radius: 120, interval: 1.8 },
    ],
  },
  {
    id: 'ice_spike',
    name: '寒冰錐',
    baseDamagePerLevel: [12, 15, 15, 19, 24, 24, 30, 40], // 向下相容保留
    baseAttackInterval: 1.0,
    baseAttackRange: 180,
    projectileSpeed: 350,
    levelStats: [
      // Lv1：基礎，pierce 1（資料保留，穿透邏輯暫未啟用）
      { damage: 12, pierce: 1 },
      // Lv2：傷害提升
      { damage: 15, pierce: 1 },
      // Lv3：穿透數 +1（資料保留，暫未啟用）
      { damage: 15, pierce: 2 },
      // Lv4：傷害提升
      { damage: 19, pierce: 2 },
      // Lv5：傷害提升
      { damage: 24, pierce: 2 },
      // Lv6：穿透數 +1（資料保留，暫未啟用）
      { damage: 24, pierce: 3 },
      // Lv7：傷害提升
      { damage: 30, pierce: 3 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 40, pierce: 3 },
    ],
  },
  {
    id: 'thunder_claw',
    name: '雷霆爪',
    baseDamagePerLevel: [8, 10, 10, 13, 13, 17, 17, 22], // 向下相容保留
    baseAttackInterval: 0.6,
    baseAttackRange: 160,
    projectileSpeed: 300,
    levelStats: [
      // Lv1：基礎，單發
      { damage: 8, count: 1, interval: 0.6 },
      // Lv2：傷害提升
      { damage: 10, count: 1, interval: 0.6 },
      // Lv3：投射物 +1（機制提升）
      { damage: 10, count: 2, interval: 0.6 },
      // Lv4：傷害提升
      { damage: 13, count: 2, interval: 0.6 },
      // Lv5：攻擊範圍小幅提升（機制提升）
      { damage: 13, count: 2, interval: 0.6, range: 185 },
      // Lv6：傷害提升
      { damage: 17, count: 2, interval: 0.6, range: 185 },
      // Lv7：攻擊間隔縮短（機制提升）
      { damage: 17, count: 2, interval: 0.5, range: 185 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 22, count: 2, interval: 0.5, range: 185 },
    ],
  },
  {
    id: 'poison_mist',
    name: '毒霧散',
    baseDamagePerLevel: [6, 8, 8, 11, 14, 14, 18, 24], // 向下相容保留
    baseAttackInterval: 0.5,
    baseAttackRange: 130,
    projectileSpeed: 150,
    levelStats: [
      // Lv1：基礎，range 130
      { damage: 6, range: 130 },
      // Lv2：傷害提升
      { damage: 8, range: 130 },
      // Lv3：攻擊範圍擴大（機制提升）
      { damage: 8, range: 160 },
      // Lv4：傷害提升
      { damage: 11, range: 160 },
      // Lv5：傷害提升
      { damage: 14, range: 160 },
      // Lv6：攻擊範圍再擴大（機制提升）
      { damage: 14, range: 190 },
      // Lv7：傷害提升
      { damage: 18, range: 190 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 24, range: 190 },
    ],
  },
];

export const getWeaponById = (id: string): WeaponData | undefined => {
  return WEAPONS.find(w => w.id === id);
};
