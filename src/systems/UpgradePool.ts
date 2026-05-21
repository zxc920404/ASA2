import { EquipmentSlot, UpgradeOption } from '../types/index';
import { WEAPONS } from '../data/weapons';
import { PASSIVES } from '../data/passives';

/** 武器欄上限 */
const MAX_WEAPON_SLOTS = 4;

/** 被動欄上限 */
const MAX_PASSIVE_SLOTS = 4;

/** 裝備等級上限 */
const MAX_EQUIPMENT_LEVEL = 8;

/** 每次升級顯示的選項數量 */
const OPTIONS_COUNT = 3;

/**
 * 武器進化條件表
 * key: 原武器 id，value: { evolvedId, requiredLevel, requiredCharacterId? }
 * requiredCharacterId 為 undefined 時表示任何角色均可進化
 */
const WEAPON_EVOLUTION_MAP: Record<string, {
  evolvedId: string;
  requiredLevel: number;
  requiredCharacterId?: string;
}> = {
  // 疾風刃 Lv8 → 流光返刃（assassin 宗門，或任何角色均可）
  // TODO: 確認驚鴻派角色 id 後可改為 requiredCharacterId: 'assassin'
  swift_blade: {
    evolvedId: 'swift_blade_evolved',
    requiredLevel: 8,
  },
};

/**
 * UpgradePool
 * 依規則篩選合法升級選項，回傳最多 3 個 UpgradeOption
 *
 * 篩選規則（Requirement 11.1～11.7, 12.1～12.3）：
 * 1. 排除初始武器作為新武器選項（Requirement 11.2）
 * 2. 排除已持有武器作為新武器選項（Requirement 11.3）
 * 3. 武器欄滿時不顯示新武器（Requirement 11.4）
 * 4. 被動欄滿時不顯示新被動（Requirement 11.4）
 * 5. 排除已達 Lv8 的裝備（Requirement 11.6, 12.1, 12.2）
 * 6. 可用選項不足 3 個時顯示全部（Requirement 11.7）
 */
export class UpgradePool {
  /**
   * 取得升級選項
   * @param equipment   玩家當前裝備欄
   * @param startingWeaponId 玩家角色的初始武器 ID
   * @param characterId 玩家角色 ID（用於判斷進化條件）
   * @returns 最多 3 個合法升級選項（隨機抽取）
   */
  public getOptions(
    equipment: EquipmentSlot,
    startingWeaponId: string,
    characterId?: string
  ): UpgradeOption[] {
    const candidates: UpgradeOption[] = [];

    const ownedWeaponIds = new Set(equipment.weapons.map(w => w.weaponId));
    const ownedPassiveIds = new Set(equipment.passives.map(p => p.passiveId));

    const weaponsFull = equipment.weapons.length >= MAX_WEAPON_SLOTS;
    const passivesFull = equipment.passives.length >= MAX_PASSIVE_SLOTS;

    // ── 武器進化選項（優先加入，不受武器欄滿限制，因為是取代而非新增）──
    for (const slot of equipment.weapons) {
      const evo = WEAPON_EVOLUTION_MAP[slot.weaponId];
      if (!evo) continue;
      if (slot.level < evo.requiredLevel) continue;
      // 若有角色限制，檢查是否符合
      if (evo.requiredCharacterId && characterId !== evo.requiredCharacterId) continue;
      // 若已持有進化武器，不再顯示
      if (ownedWeaponIds.has(evo.evolvedId)) continue;

      candidates.push({
        type: 'evolveWeapon' as UpgradeOption['type'],
        id: evo.evolvedId,
        currentLevel: slot.level,
        nextLevel: 1,
      });
    }

    // 武器欄未滿：加入所有未持有且非初始武器的武器（作為新武器）
    // Requirement 11.2, 11.3, 11.5
    if (!weaponsFull) {
      for (const weapon of WEAPONS) {
        if (weapon.id === startingWeaponId) continue;   // 排除初始武器
        if (ownedWeaponIds.has(weapon.id)) continue;    // 排除已持有武器
        // 排除進化武器（不能直接取得，只能透過進化）
        const isEvolvedWeapon = Object.values(WEAPON_EVOLUTION_MAP).some(e => e.evolvedId === weapon.id);
        if (isEvolvedWeapon) continue;
        candidates.push({
          type: 'newWeapon',
          id: weapon.id,
          currentLevel: 0,
          nextLevel: 1,
        });
      }
    }

    // 加入所有已持有且等級 < 8 的武器（作為升級）
    // Requirement 11.6, 12.1
    for (const slot of equipment.weapons) {
      if (slot.level < MAX_EQUIPMENT_LEVEL) {
        candidates.push({
          type: 'upgradeWeapon',
          id: slot.weaponId,
          currentLevel: slot.level,
          nextLevel: slot.level + 1,
        });
      }
    }

    // 被動欄未滿：加入所有未持有的被動道具（作為新被動）
    // Requirement 11.4, 11.5
    if (!passivesFull) {
      for (const passive of PASSIVES) {
        if (ownedPassiveIds.has(passive.id)) continue;  // 排除已持有被動
        candidates.push({
          type: 'newPassive',
          id: passive.id,
          currentLevel: 0,
          nextLevel: 1,
        });
      }
    }

    // 加入所有已持有且等級 < 8 的被動道具（作為升級）
    // Requirement 11.6, 12.2
    for (const slot of equipment.passives) {
      if (slot.level < MAX_EQUIPMENT_LEVEL) {
        candidates.push({
          type: 'upgradePassive',
          id: slot.passiveId,
          currentLevel: slot.level,
          nextLevel: slot.level + 1,
        });
      }
    }

    // 從候選池隨機抽取 min(3, 候選池長度) 個選項（Requirement 11.1, 11.7）
    const picked = this.pickRandom(candidates, OPTIONS_COUNT);

    // 若候選池完全為空（所有武器/被動均滿級），加入 fallback：恢復生命
    if (picked.length === 0) {
      return [
        { type: 'healHp', id: 'heal_hp', currentLevel: 0, nextLevel: 0 },
      ];
    }

    return picked;
  }

  /**
   * 從陣列中隨機抽取 count 個不重複元素
   */
  private pickRandom<T>(arr: T[], count: number): T[] {
    if (arr.length <= count) {
      return [...arr];
    }

    // Fisher-Yates shuffle 取前 count 個
    const copy = [...arr];
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  }
}
