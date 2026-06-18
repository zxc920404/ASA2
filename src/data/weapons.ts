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
    iconKey: 'weapon_shouxin_ring',
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
    iconKey: 'weapon_jifeng_blade',
    levelStats: [
      // Lv1：基礎，單發
      { damage: 12, count: 1, interval: 0.8 },
      // Lv2：傷害提升
      { damage: 15, count: 1, interval: 0.8 },
      // Lv3：投射物 +1（每兩級 +1）
      { damage: 15, count: 2, interval: 0.8 },
      // Lv4：傷害提升
      { damage: 18, count: 2, interval: 0.8 },
      // Lv5：投射物 +1
      { damage: 18, count: 3, interval: 0.8, range: 230 },
      // Lv6：傷害提升
      { damage: 22, count: 3, interval: 0.8, range: 230 },
      // Lv7：投射物 +1，攻擊間隔縮短
      { damage: 22, count: 4, interval: 0.7, range: 230 },
      // Lv8：傷害大幅提升（滿級獎勵）
      { damage: 28, count: 4, interval: 0.7, range: 230 },
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
    iconKey: 'weapon_chiyan_seal',
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
    iconKey: 'weapon_hanbing_spike',
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
    effects: [],
    usesAmountBonus: false,
    baseDamagePerLevel: [10, 12, 12, 14, 14, 18, 18, 24], // 向下相容保留
    baseAttackInterval: 0.6,
    baseAttackRange: 150,
    projectileSpeed: 300,
    iconKey: 'weapon_leiting_claw',
    levelStats: [
      // 扇形攻擊：朝玩家面朝方向揮出一次扇形爪擊，等級提升增加扇形範圍（半徑 + 角度）
      // Lv1：基礎扇形
      { damage: 10, interval: 0.6,  range: 150, arcDegrees: 60 },
      // Lv2：傷害提升，扇形角度擴大
      { damage: 12, interval: 0.6,  range: 160, arcDegrees: 70 },
      // Lv3：半徑與角度擴大
      { damage: 12, interval: 0.6,  range: 170, arcDegrees: 80 },
      // Lv4：傷害提升，扇形範圍續增
      { damage: 14, interval: 0.6,  range: 180, arcDegrees: 95 },
      // Lv5：扇形範圍續增
      { damage: 14, interval: 0.6,  range: 190, arcDegrees: 110 },
      // Lv6：傷害提升，攻擊間隔略縮
      { damage: 18, interval: 0.55, range: 200, arcDegrees: 120 },
      // Lv7：攻擊間隔縮短，扇形範圍續增
      { damage: 18, interval: 0.5,  range: 215, arcDegrees: 135 },
      // Lv8：傷害大幅提升，扇形範圍最大（滿級獎勵）
      { damage: 24, interval: 0.5,  range: 230, arcDegrees: 150 },
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
    iconKey: 'weapon_duwu_powder',
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
    effects: ['returning'],
    usesAmountBonus: true,
    baseDamagePerLevel: [8, 10, 10, 12, 12, 15, 15, 19], // 向下相容保留
    baseAttackInterval: 0.75,
    baseAttackRange: 220,
    projectileSpeed: 560,
    iconKey: 'weapon_liuguang_shuttle',
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
    projectileSpeed: 480,
    iconKey: 'weapon_zhuihun_needle',
    levelStats: [
      // Lv1：基礎 3 根細針（單發傷害偏低，靠數量）
      { damage: 4, count: 3, interval: 0.55 },
      // Lv2：針數 +1
      { damage: 5, count: 4, interval: 0.55 },
      // Lv3：針數 +1
      { damage: 5, count: 5, interval: 0.55 },
      // Lv4：針數 +1，傷害提升
      { damage: 6, count: 6, interval: 0.55 },
      // Lv5：針數 +1，攻擊間隔縮短，範圍擴大
      { damage: 6, count: 7, interval: 0.5, range: 215 },
      // Lv6：針數 +1
      { damage: 7, count: 8, interval: 0.5, range: 215 },
      // Lv7：針數 +1
      { damage: 7, count: 9, interval: 0.5, range: 215 },
      // Lv8：針數 +1，傷害提升，攻擊間隔縮短（滿級獎勵）
      { damage: 9, count: 10, interval: 0.45, range: 215 },
    ],
  },
  {
    id: 'ice_spike_evolved',
    name: '霜裂冰錐',
    form: 'projectile',
    effects: ['pierce', 'frostCrack'],
    usesAmountBonus: true,
    baseDamagePerLevel: [34, 39, 39, 48, 48, 52, 52, 58], // 向下相容保留
    baseAttackInterval: 0.95,
    baseAttackRange: 260,
    projectileSpeed: 360,
    iconKey: 'weapon_icon_ice_spike_evolved',
    levelStats: [
      // Lv1：基礎，pierce 3，霜裂冰痕
      { damage: 34, count: 1, pierce: 3, interval: 0.95, range: 260, crackDamage: 14, crackRadius: 42, crackDelay: 0.25 },
      // Lv2：傷害提升，pierce +1
      { damage: 39, count: 1, pierce: 4, interval: 0.95, range: 270, crackDamage: 16, crackRadius: 44, crackDelay: 0.25 },
      // Lv3：投射物 +1
      { damage: 39, count: 2, pierce: 4, interval: 0.95, range: 280, crackDamage: 16, crackRadius: 44, crackDelay: 0.25 },
      // Lv4：傷害提升，pierce +1，攻擊間隔縮短
      { damage: 48, count: 2, pierce: 5, interval: 0.9,  range: 290, crackDamage: 20, crackRadius: 48, crackDelay: 0.2 },
      // Lv5：傷害提升，冰痕傷害提升
      { damage: 48, count: 2, pierce: 5, interval: 0.9,  range: 300, crackDamage: 22, crackRadius: 50, crackDelay: 0.2 },
      // Lv6：傷害提升，pierce +1
      { damage: 52, count: 2, pierce: 6, interval: 0.9,  range: 310, crackDamage: 24, crackRadius: 52, crackDelay: 0.2 },
      // Lv7：投射物 +1，攻擊間隔縮短
      { damage: 52, count: 3, pierce: 6, interval: 0.85, range: 320, crackDamage: 24, crackRadius: 54, crackDelay: 0.18 },
      // Lv8：傷害大幅提升，冰痕爆裂強化（滿級獎勵）
      { damage: 58, count: 3, pierce: 7, interval: 0.85, range: 330, crackDamage: 30, crackRadius: 58, crackDelay: 0.18 },
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
