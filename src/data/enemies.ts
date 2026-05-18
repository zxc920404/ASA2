import { EnemyData } from '../types/index';

export const ENEMIES: EnemyData[] = [
  {
    id: 'basic',
    name: '基礎小怪',
    baseHP: 100,
    baseMoveSpeed: 80,
    baseDamage: 10,
    expDrop: 5,
    collisionRadius: 16,
  },
  {
    id: 'fast',
    name: '快速小怪',
    baseHP: 60,
    baseMoveSpeed: 140,
    baseDamage: 10,
    expDrop: 5,
    collisionRadius: 12,
  },
  {
    id: 'tank',
    name: '厚血小怪',
    baseHP: 250,
    baseMoveSpeed: 50,
    baseDamage: 25,
    expDrop: 15,
    collisionRadius: 20,
  },
];

export const getEnemyById = (id: string): EnemyData | undefined => {
  return ENEMIES.find(e => e.id === id);
};
