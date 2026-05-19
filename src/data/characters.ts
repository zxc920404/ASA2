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
  },
];

export const getCharacterById = (id: string): CharacterData | undefined => {
  return CHARACTERS.find(c => c.id === id);
};
