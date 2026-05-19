import { EnemyData } from '../types/index';

export const ENEMIES: EnemyData[] = [
  {
    id: 'basic',
    name: '基礎小怪',
    baseHP: 50,
    baseMoveSpeed: 80,
    baseDamage: 8,
    expDrop: 5,
    collisionRadius: 16,
  },
  {
    id: 'fast',
    name: '快速小怪',
    baseHP: 35,
    baseMoveSpeed: 140,
    baseDamage: 7,
    expDrop: 5,
    collisionRadius: 12,
  },
  {
    id: 'tank',
    name: '厚血小怪',
    baseHP: 180,
    baseMoveSpeed: 50,
    baseDamage: 18,
    expDrop: 15,
    collisionRadius: 20,
  },
  {
    id: 'ranged',
    name: '邪修射手',
    baseHP: 45,
    baseMoveSpeed: 55,
    baseDamage: 5,
    expDrop: 10,
    collisionRadius: 14,
    attackRange: 290,
    fireInterval: 2.8,
    projectileSpeed: 200,
    projectileDamage: 7,
  },
];

export const getEnemyById = (id: string): EnemyData | undefined => {
  return ENEMIES.find(e => e.id === id);
};
