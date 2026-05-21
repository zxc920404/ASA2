import { CharacterData, EquipmentSlot, PlayerStats } from '../types/index';
import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';

// 倍率安全下限（Requirement 3.4）
const MIN_MULTIPLIER = 0.01;

// 各屬性上限 / 下限（Requirement 3.5）
const MAX_HP = 999_999;
const MAX_MOVE_SPEED = 9_999;
const MAX_ATTACK_POWER = 999_999;
const MAX_PICKUP_RANGE = 9_999;
const MAX_ATTACK_RANGE = 9_999;
const MIN_ATTACK_INTERVAL = 0.05;

/**
 * 將倍率強制限制在安全下限以上（Requirement 3.4）
 */
function clampMultiplier(value: number): number {
  return Math.max(MIN_MULTIPLIER, value);
}

/**
 * 依公式計算玩家六項最終屬性（Requirement 3.2）
 *
 * 公式：
 *   maxHP             = baseHP + Σ(hp 被動加成)
 *   moveSpeed         = baseMoveSpeed × Π(moveSpeed 倍率)
 *   attackPower       = baseAttackPower × Π(attackPower 倍率)
 *   pickupRange       = basePickupRange + Σ(pickupRange 加成)
 *   areaMultiplier    = 1.0 × Π(areaMultiplier 倍率)（擴脈符）
 *   cooldownMultiplier = 1.0 × Π(cooldownMultiplier 倍率)（急攻令）
 *   attackRange       = weapon.baseAttackRange（舊欄位，保留相容）
 *   attackInterval    = weapon.baseAttackInterval（舊欄位，保留相容）
 */
export function calculateStats(
  char: CharacterData,
  equipment: EquipmentSlot
): PlayerStats {
  // 取得初始武器資料（用於 attackRange / attackInterval 計算）
  // 優先使用裝備欄中第一把武器；若裝備欄為空則使用角色初始武器
  const activeWeaponId =
    equipment.weapons.length > 0
      ? equipment.weapons[0].weaponId
      : char.startingWeaponId;

  const weaponData = WEAPONS.find(w => w.id === activeWeaponId);
  const baseAttackRange = weaponData?.baseAttackRange ?? 120;
  const baseAttackInterval = weaponData?.baseAttackInterval ?? 1.0;

  // 累積各被動加成
  let hpBonus = 0;
  let moveSpeedMultiplier = 1.0;
  let attackPowerMultiplier = 1.0;
  let pickupRangeBonus = 0;
  let areaMultiplier = 1.0;
  let cooldownMultiplier = 1.0;

  for (const slot of equipment.passives) {
    const passive = PASSIVES.find(p => p.id === slot.passiveId);
    if (!passive) continue;

    const totalBonus = passive.bonusPerLevel * slot.level;

    switch (passive.stat) {
      case 'hp':
        hpBonus += totalBonus;
        break;
      case 'moveSpeed':
        // 倍率：1 + bonusPerLevel * level（例：Lv1 → 1.10，Lv8 → 1.80）
        moveSpeedMultiplier *= clampMultiplier(1 + totalBonus);
        break;
      case 'attackPower':
        attackPowerMultiplier *= clampMultiplier(1 + totalBonus);
        break;
      case 'pickupRange':
        pickupRangeBonus += totalBonus;
        break;
      case 'areaMultiplier':
        // 範圍倍率：1 + bonusPerLevel * level（例：Lv1 → 1.12，Lv8 → 1.96）
        areaMultiplier *= clampMultiplier(1 + totalBonus);
        break;
      case 'cooldownMultiplier':
        // 冷卻倍率：1 + bonusPerLevel * level（bonusPerLevel 為負值，例：Lv1 → 0.94，Lv8 → 0.52）
        cooldownMultiplier *= clampMultiplier(1 + totalBonus);
        break;
    }
  }

  // 套用公式計算最終屬性
  const rawMaxHP = char.baseHP + hpBonus;
  const rawMoveSpeed = char.baseMoveSpeed * moveSpeedMultiplier;
  const rawAttackPower = char.baseAttackPower * attackPowerMultiplier;
  const rawPickupRange = char.basePickupRange + pickupRangeBonus;
  // attackRange / attackInterval 保留舊欄位相容，WeaponSystem 直接讀 player.stats.areaMultiplier / cooldownMultiplier
  const rawAttackRange = baseAttackRange;
  const rawAttackInterval = baseAttackInterval;

  // 套用上限 / 下限（Requirement 3.5）
  return {
    maxHP: Math.min(rawMaxHP, MAX_HP),
    moveSpeed: Math.min(rawMoveSpeed, MAX_MOVE_SPEED),
    attackPower: Math.min(rawAttackPower, MAX_ATTACK_POWER),
    pickupRange: Math.min(rawPickupRange, MAX_PICKUP_RANGE),
    attackRange: Math.min(rawAttackRange, MAX_ATTACK_RANGE),
    attackInterval: Math.max(rawAttackInterval, MIN_ATTACK_INTERVAL),
    amountBonus: 0,
    cooldownMultiplier: Math.max(0.1, cooldownMultiplier), // 最低 0.1，避免冷卻歸零
    areaMultiplier: Math.max(0.1, areaMultiplier),
    durationMultiplier: 1.0,
    projectileSpeedMultiplier: 1.0,
  };
}
