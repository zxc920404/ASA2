import { CharacterData } from '../types/index';

export const CHARACTERS: CharacterData[] = [
  {
    id: 'swordsman',
    name: '劍客',
    baseHP: 200,
    baseMoveSpeed: 160,
    baseAttackPower: 1.2,
    basePickupRange: 80,
    startingWeaponId: 'guardian_ring', // 守心環
    trait: '屬性加成型',
    iconKey: 'sect_icon_swordsman',
    portraitKey: 'sect_portrait_swordsman',
  },
  {
    id: 'wave',
    name: '驚濤派',
    baseHP: 170,
    baseMoveSpeed: 170,
    baseAttackPower: 1.1,
    basePickupRange: 90,
    startingWeaponId: 'guardian_ring', // 守心環（預設武器）
    trait: '屬性加成型', // 暫用，待正式設計後更新
    iconKey: 'sect_icon_wave',     // 驚濤派專用 icon（美術補充後替換）
    portraitKey: 'sect_portrait_wave', // 驚濤派專用立繪（美術補充後替換）
  },
  {
    id: 'taoist',
    name: '道士',
    baseHP: 160,
    baseMoveSpeed: 145,
    baseAttackPower: 1.0,
    basePickupRange: 140,
    startingWeaponId: 'flame_seal', // 赤焰印
    trait: '行為修改型',
    iconKey: 'sect_icon_taoist',
    portraitKey: 'sect_portrait_taoist',
  },
  {
    id: 'assassin',
    name: '刺客',
    baseHP: 130,
    baseMoveSpeed: 190,
    baseAttackPower: 1.5,
    basePickupRange: 100,
    startingWeaponId: 'swift_blade', // 疾風刃
    trait: '條件觸發型',
    iconKey: 'sect_icon_assassin',
    portraitKey: 'sect_portrait_assassin',
  },
];

export const getCharacterById = (id: string): CharacterData | undefined => {
  return CHARACTERS.find(c => c.id === id);
};
