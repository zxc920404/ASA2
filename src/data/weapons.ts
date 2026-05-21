import { WeaponData } from '../types/index';

export const WEAPONS: WeaponData[] = [
  {
    id: 'guardian_ring',
    name: '守心環',
    form: 'orbit',
    effects: [],
    usesAmountBonus: true,
    baseDamagePerLevel: [10, 13, 13, 16, 16, 20, 20, 25], // 向下相容保留
    baseAttackInterval: 1.2,
    baseAttackRange: 120,
    projectileSpeed: 0,
    iconKey: 'weapon_icon_guardian_ring',
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
    form: 'projectile',
    effects: ['autoTarget'],
    usesAmountBonus: true,
    baseDamagePerLevel: [12, 15, 13, 17, 17, 21, 21, 26], // 向下相容保留
    baseAttackInterval: 0.8,
    baseAttackRange: 200,
    projectileSpeed: 400,
    iconKey: 'weapon_icon_swift_blade',
    levelStats: [
      // Lv1：基礎，單發
      { damage: 12, count: 1, interval: 0.8 },
      // Lv2：傷害提升
      { damage: 15, count: 1, interval: 0.8 },
      // Lv3：投射物 +1，傷害略降以壓低爆發跳躍
      { damage: 13, count: 2, interval: 0.8 },
      // Lv4：傷害提升
      { damage: 17, count: 2, interval: 0.8 },
      // Lv5：攻擊範圍小幅提升
      { damage: 17, count: 2, interval: 0.8, range: 230 },
      // Lv6：傷害提升
      { damage: 21, count: 2, interval: 0.8, range: 230 },
      // Lv7：攻擊間隔縮短
      { damage: 21, count: 2, interval: 0.7, range: 230 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 26, count: 2, interval: 0.7, range: 230 },
    ],
  },
  {
    id: 'flame_seal',
    name: '赤焰印',
    form: 'strike',
    effects: [],
    usesAmountBonus: true,
    baseDamagePerLevel: [18, 21, 25, 25, 31, 38, 38, 50], // 向下相容保留
    baseAttackInterval: 1.8,
    baseAttackRange: 150,
    projectileSpeed: 250,
    iconKey: 'weapon_icon_flame_seal',
    levelStats: [
      // Lv1：前期傷害微幅提升
      { damage: 18, radius: 80, interval: 1.8 },
      // Lv2：傷害提升
      { damage: 21, radius: 80, interval: 1.8 },
      // Lv3：傷害提升
      { damage: 25, radius: 80, interval: 1.8 },
      // Lv4：爆炸半徑擴大
      { damage: 25, radius: 100, interval: 1.8 },
      // Lv5：傷害提升
      { damage: 31, radius: 100, interval: 1.8 },
      // Lv6：傷害提升
      { damage: 38, radius: 100, interval: 1.8 },
      // Lv7：爆炸半徑再擴大，攻擊間隔縮短
      { damage: 38, radius: 120, interval: 1.6 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 50, radius: 120, interval: 1.6 },
    ],
  },
  {
    id: 'ice_spike',
    name: '寒冰錐',
    form: 'projectile',
    effects: ['pierce'],
    usesAmountBonus: true,
    baseDamagePerLevel: [16, 19, 22, 24, 30, 30, 38, 50], // 向下相容保留
    baseAttackInterval: 1.0,
    baseAttackRange: 180,
    projectileSpeed: 350,
    iconKey: 'weapon_icon_ice_spike',
    levelStats: [
      // Lv1：基礎，pierce 1
      { damage: 16, pierce: 1 },
      // Lv2：傷害提升
      { damage: 19, pierce: 1 },
      // Lv3：傷害提升 + pierce +1
      { damage: 22, pierce: 2 },
      // Lv4：傷害提升
      { damage: 24, pierce: 2 },
      // Lv5：傷害提升
      { damage: 30, pierce: 2 },
      // Lv6：pierce +1
      { damage: 30, pierce: 3 },
      // Lv7：傷害提升
      { damage: 38, pierce: 3 },
      // Lv8：傷害大幅提升 + pierce +1（滿級獎勵）
      { damage: 50, pierce: 4 },
    ],
  },
  {
    id: 'thunder_claw',
    name: '雷霆爪',
    form: 'strike',
    effects: ['autoTarget'],
    usesAmountBonus: true,
    baseDamagePerLevel: [10, 12, 10, 12, 12, 16, 16, 20], // 向下相容保留
    baseAttackInterval: 0.6,
    baseAttackRange: 160,
    projectileSpeed: 300,
    iconKey: 'weapon_icon_thunder_claw',
    levelStats: [
      // Lv1：基礎，單發，傷害提升
      { damage: 10, count: 1, interval: 0.6 },
      // Lv2：傷害提升
      { damage: 12, count: 1, interval: 0.6 },
      // Lv3：投射物 +1，傷害略降以壓低爆發跳躍
      { damage: 10, count: 2, interval: 0.6 },
      // Lv4：傷害提升
      { damage: 12, count: 2, interval: 0.6 },
      // Lv5：攻擊範圍小幅提升
      { damage: 12, count: 2, interval: 0.6, range: 185 },
      // Lv6：傷害提升
      { damage: 16, count: 2, interval: 0.6, range: 185 },
      // Lv7：攻擊間隔縮短
      { damage: 16, count: 2, interval: 0.5, range: 185 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 20, count: 2, interval: 0.5, range: 185 },
    ],
  },
  {
    id: 'poison_mist',
    name: '毒霧散',
    form: 'field',
    effects: ['dot'],
    usesAmountBonus: false,
    baseDamagePerLevel: [8, 10, 10, 10, 10, 13, 13, 15], // 向下相容保留
    baseAttackInterval: 2.6,
    baseAttackRange: 130,
    projectileSpeed: 220,
    iconKey: 'weapon_icon_poison_mist',
    levelStats: [
      // Lv1：單發小毒霧
      { damage: 8,  range: 130, radius: 45, count: 1, interval: 2.6, duration: 2.2 },
      // Lv2：傷害提升
      { damage: 10, range: 130, radius: 45, count: 1, interval: 2.6, duration: 2.2 },
      // Lv3：尋敵範圍與毒霧半徑擴大
      { damage: 10, range: 150, radius: 55, count: 1, interval: 2.6, duration: 2.2 },
      // Lv4：發射數量 +1（機制提升），interval 維持 2.6 不變慢
      { damage: 10, range: 150, radius: 50, count: 2, interval: 2.6, duration: 2.2 },
      // Lv5：持續時間延長
      { damage: 10, range: 160, radius: 50, count: 2, interval: 2.6, duration: 2.8 },
      // Lv6：傷害提升
      { damage: 13, range: 160, radius: 55, count: 2, interval: 2.6, duration: 2.8 },
      // Lv7：尋敵範圍擴大，冷卻縮短
      { damage: 13, range: 180, radius: 55, count: 2, interval: 2.4, duration: 2.8 },
      // Lv8：發射數量 +1（機制提升），傷害提升，冷卻維持
      { damage: 15, range: 190, radius: 55, count: 3, interval: 2.4, duration: 2.8 },
    ],
  },
  {
    id: 'light_shuttle',
    name: '流光梭',
    form: 'projectile',
    effects: ['pierce'],
    usesAmountBonus: true,
    baseDamagePerLevel: [8, 10, 10, 12, 12, 15, 15, 19], // 向下相容保留
    baseAttackInterval: 0.75,
    baseAttackRange: 220,
    projectileSpeed: 520,
    iconKey: 'weapon_icon_light_shuttle',
    levelStats: [
      // Lv1：基礎，pierce 1
      { damage: 8,  count: 1, pierce: 1, interval: 0.75 },
      // Lv2：傷害提升
      { damage: 10, count: 1, pierce: 1, interval: 0.75 },
      // Lv3：投射物 +1
      { damage: 10, count: 2, pierce: 1, interval: 0.75 },
      // Lv4：傷害提升
      { damage: 12, count: 2, pierce: 1, interval: 0.75 },
      // Lv5：pierce +1，範圍擴大
      { damage: 12, count: 2, pierce: 2, interval: 0.75, range: 250 },
      // Lv6：傷害提升
      { damage: 15, count: 2, pierce: 2, interval: 0.75, range: 250 },
      // Lv7：投射物 +1，攻擊間隔縮短
      { damage: 15, count: 3, pierce: 2, interval: 0.7,  range: 250 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 19, count: 3, pierce: 2, interval: 0.7,  range: 250 },
    ],
  },
  {
    id: 'soul_chasing_needle',
    name: '追魂針',
    form: 'projectile',
    effects: ['autoTarget'],
    usesAmountBonus: true,
    baseDamagePerLevel: [6, 8, 7, 9, 9, 11, 10, 14], // 向下相容保留
    baseAttackInterval: 0.55,
    baseAttackRange: 190,
    projectileSpeed: 460,
    iconKey: 'weapon_icon_soul_chasing_needle',
    levelStats: [
      // Lv1：基礎，單發
      { damage: 6,  count: 1, interval: 0.55 },
      // Lv2：傷害提升
      { damage: 8,  count: 1, interval: 0.55 },
      // Lv3：投射物 +1，傷害略降
      { damage: 7,  count: 2, interval: 0.55 },
      // Lv4：傷害提升
      { damage: 9,  count: 2, interval: 0.55 },
      // Lv5：攻擊間隔縮短，範圍擴大
      { damage: 9,  count: 2, interval: 0.5,  range: 215 },
      // Lv6：傷害提升
      { damage: 11, count: 2, interval: 0.5,  range: 215 },
      // Lv7：投射物 +1，傷害略降
      { damage: 10, count: 3, interval: 0.5,  range: 215 },
      // Lv8：傷害大幅提升，攻擊間隔縮短（滿級獎勵）
      { damage: 14, count: 3, interval: 0.45, range: 215 },
    ],
  },
  {
    id: 'swift_blade_evolved',
    name: '流光返刃',
    form: 'projectile',
    effects: ['autoTarget', 'returning'],
    usesAmountBonus: true,
    baseDamagePerLevel: [22, 26, 26, 31, 31, 36, 36, 42], // 向下相容保留
    baseAttackInterval: 0.65,
    baseAttackRange: 260,
    projectileSpeed: 450,
    iconKey: 'weapon_icon_swift_blade_evolved',
    levelStats: [
      // Lv1：基礎，2 發，返還傷害 70%
      { damage: 22, count: 2, interval: 0.65, range: 260, returnDamageMultiplier: 0.7 },
      // Lv2：傷害提升，返還傷害 75%
      { damage: 26, count: 2, interval: 0.65, range: 260, returnDamageMultiplier: 0.75 },
      // Lv3：投射物 +1，返還傷害 75%
      { damage: 26, count: 3, interval: 0.65, range: 280, returnDamageMultiplier: 0.75 },
      // Lv4：傷害提升，攻擊間隔縮短，返還傷害 80%
      { damage: 31, count: 3, interval: 0.6,  range: 280, returnDamageMultiplier: 0.8 },
      // Lv5：傷害提升，返還傷害 80%
      { damage: 31, count: 3, interval: 0.6,  range: 300, returnDamageMultiplier: 0.8 },
      // Lv6：傷害提升，返還傷害 85%
      { damage: 36, count: 3, interval: 0.6,  range: 300, returnDamageMultiplier: 0.85 },
      // Lv7：投射物 +1，攻擊間隔縮短，返還傷害 85%
      { damage: 36, count: 4, interval: 0.55, range: 300, returnDamageMultiplier: 0.85 },
      // Lv8：傷害大幅提升，返還傷害 90%（滿級獎勵）
      { damage: 42, count: 4, interval: 0.55, range: 320, returnDamageMultiplier: 0.9 },
    ],
  },
];

export const getWeaponById = (id: string): WeaponData | undefined => {
  return WEAPONS.find(w => w.id === id);
};
