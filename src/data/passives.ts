import { PassiveData } from '../types/index';

export const PASSIVES: PassiveData[] = [
  {
    id: 'swift_step',
    name: '迅捷步',
    stat: 'moveSpeed',
    bonusPerLevel: 0.10, // 每級移動速度倍率 +0.10，Lv1 倍率 1.10、Lv8 倍率 1.80
  },
  {
    id: 'life_jade',
    name: '生命玉',
    stat: 'hp',
    bonusPerLevel: 50, // 每級最大 HP 加成 +50，Lv1 加成 50、Lv8 加成 400
  },
  {
    id: 'break_seal',
    name: '破勢印',
    stat: 'attackPower',
    bonusPerLevel: 0.15, // 每級攻擊力倍率 +0.15，Lv1 倍率 1.15、Lv8 倍率 2.05
  },
  {
    id: 'spirit_bead',
    name: '引靈珠',
    stat: 'pickupRange',
    bonusPerLevel: 20, // 每級拾取範圍加成 +20 像素，Lv1 加成 20、Lv8 加成 160
  },
  {
    id: 'vein_talisman',
    name: '擴脈符',
    stat: 'attackRange',
    bonusPerLevel: 0.10, // 每級攻擊範圍倍率 +0.10，Lv1 倍率 1.10、Lv8 倍率 1.80
  },
  {
    id: 'swift_strike',
    name: '急攻令',
    stat: 'attackSpeed',
    bonusPerLevel: 0.15, // 每級攻擊速度倍率 +0.15，Lv1 倍率 1.15、Lv8 倍率 2.05
  },
];

export const getPassiveById = (id: string): PassiveData | undefined => {
  return PASSIVES.find(p => p.id === id);
};
