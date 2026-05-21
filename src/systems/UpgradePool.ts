import { EquipmentSlot, UpgradeOption } from '../types/index';
import { WEAPONS } from '../data/weapons';
import { PASSIVES } from '../data/passives';
import { DAOS } from '../data/daos';

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
  // 寒冰錐 Lv8 → 霜裂冰錐（assassin 驚鴻派）
  ice_spike: {
    evolvedId: 'ice_spike_evolved',
    requiredLevel: 8,
    requiredCharacterId: 'assassin',
  },
};

/**
 * 進化武器 id 集合（由 WEAPON_EVOLUTION_MAP 衍生）
 * 用於判斷某武器是否為進化後武器
 */
const EVOLVED_WEAPON_IDS: Set<string> = new Set(
  Object.values(WEAPON_EVOLUTION_MAP).map(e => e.evolvedId)
);

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
 *
 * 驚鴻派分裂大道特殊邏輯（兩階段延遲）：
 * - 條件：assassin + projectile 武器 >= 3 + 已進化武器 >= 1
 * - 條件達成的那次 getOptions() → 加入 conditionsMetDaos（不插入本次結果）
 * - 下一次 getOptions() → 從 conditionsMetDaos 移至 pendingGuaranteedDaos → 必定出現
 * - 玩家未選時，pendingGuaranteedDaos 保留，每次升級繼續保證出現
 * - 玩家選取後，activeDaos 包含此 id，不再出現
 */
export class UpgradePool {
  /**
   * 條件已達成但尚未進入 pending 的大道 id 集合（第一階段）
   * 條件達成的那次 getOptions() 加入此集合，不插入本次結果。
   * 下一次 getOptions() 開始時，移至 pendingGuaranteedDaos。
   */
  private conditionsMetDaos: Set<string> = new Set();

  /**
   * 待保證出現的大道 id 集合（第二階段 / pending 狀態）
   * 從 conditionsMetDaos 晉升後，下次 getOptions() 時強制插入結果。
   * 玩家未選時保留，每次升級繼續保證出現。
   */
  private pendingGuaranteedDaos: Set<string> = new Set();

  /**
   * 取得升級選項
   * @param equipment   玩家當前裝備欄
   * @param startingWeaponId 玩家角色的初始武器 ID
   * @param characterId 玩家角色 ID（用於判斷進化條件與大道條件）
   * @param playerLevel 玩家當前等級（用於大道解鎖條件）
   * @param activeDaos  已啟用的大道 id 集合（排除已取得的大道）
   * @returns 最多 3 個合法升級選項（隨機抽取）
   */
  public getOptions(
    equipment: EquipmentSlot,
    startingWeaponId: string,
    characterId?: string,
    playerLevel: number = 1,
    activeDaos: Set<string> = new Set()
  ): UpgradeOption[] {
    const candidates: UpgradeOption[] = [];

    const ownedWeaponIds = new Set(equipment.weapons.map(w => w.weaponId));
    const ownedPassiveIds = new Set(equipment.passives.map(p => p.passiveId));

    const weaponsFull = equipment.weapons.length >= MAX_WEAPON_SLOTS;
    const passivesFull = equipment.passives.length >= MAX_PASSIVE_SLOTS;

    // ── 兩階段延遲：將上次達成條件的大道晉升為 pending（本次才插入結果）──
    // conditionsMetDaos → pendingGuaranteedDaos（在本次結果生成前晉升）
    for (const daoId of this.conditionsMetDaos) {
      if (!activeDaos.has(daoId)) {
        this.pendingGuaranteedDaos.add(daoId);
      }
    }
    this.conditionsMetDaos.clear();

    // ── 驚鴻派分裂大道：條件檢查，達成時寫入 conditionsMetDaos（不影響本次結果）──
    this.checkAndMarkJinghongSplitPending(equipment, characterId, activeDaos);

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

    // ── 一般宗門大道選項（通用條件迴圈，排除已由特殊邏輯處理的大道）──
    // jinghong_split 永遠不進入一般候選池，只能由 pending 保證邏輯插入
    const SPECIAL_DAO_IDS = new Set(['jinghong_split']);

    for (const dao of DAOS) {
      // 已取得的大道不再顯示
      if (activeDaos.has(dao.id)) continue;
      // 特殊大道（由專屬邏輯控制）：永遠排除在一般候選池之外
      if (SPECIAL_DAO_IDS.has(dao.id)) continue;
      // 已在 pending 集合中的大道，不加入一般候選池（避免重複）
      if (this.pendingGuaranteedDaos.has(dao.id)) continue;
      // 宗門限制
      if (dao.requiredCharacterId && characterId !== dao.requiredCharacterId) continue;
      // 玩家等級門檻
      if (playerLevel < dao.requiredPlayerLevel) continue;
      // projectile 類武器數量條件（若有設定）
      if (dao.requiredProjectileWeaponCount !== undefined) {
        const projWeapons = equipment.weapons.filter(slot => {
          const w = WEAPONS.find(wd => wd.id === slot.weaponId);
          return w?.form === 'projectile';
        });
        if (projWeapons.length < dao.requiredProjectileWeaponCount) continue;
        if (dao.requiredProjectileWeaponLevel !== undefined) {
          const hasHighLevel = projWeapons.some(slot => slot.level >= dao.requiredProjectileWeaponLevel!);
          if (!hasHighLevel) continue;
        }
      }
      candidates.push({
        type: 'activateDao',
        id: dao.id,
        currentLevel: 0,
        nextLevel: 1,
      });
    }

    // ── 從候選池隨機抽取，再插入保證出現的大道 ──────────────────────────
    // 先從候選池抽取（保留空位給保證大道）
    const guaranteedOptions = this.buildGuaranteedDaoOptions(activeDaos);
    const remainingSlots = Math.max(0, OPTIONS_COUNT - guaranteedOptions.length);
    const picked = this.pickRandom(candidates, remainingSlots);

    // 合併：保證大道優先放在最前面
    const result = [...guaranteedOptions, ...picked];

    // 清除本次已插入的 pending 大道（已出現在選項中，不再重複保證）
    for (const opt of guaranteedOptions) {
      this.pendingGuaranteedDaos.delete(opt.id);
    }

    // 若候選池完全為空（所有武器/被動均滿級），加入 fallback：恢復生命
    if (result.length === 0) {
      return [
        { type: 'healHp', id: 'heal_hp', currentLevel: 0, nextLevel: 0 },
      ];
    }

    return result;
  }

  /**
   * 檢查驚鴻派分裂大道的觸發條件
   * 條件達成時寫入 conditionsMetDaos（不是 pendingGuaranteedDaos）
   * → 下一次 getOptions() 開始時才晉升為 pending，確保不在條件達成當次出現
   *
   * 條件：
   * 1. 玩家宗門為 assassin（驚鴻派）
   * 2. 持有 >= 3 個 projectile form 武器
   * 3. 持有 >= 1 個已進化武器（id 在 EVOLVED_WEAPON_IDS 中）
   * 4. 尚未取得此大道
   * 5. 尚未在 conditionsMetDaos 或 pendingGuaranteedDaos 中
   */
  private checkAndMarkJinghongSplitPending(
    equipment: EquipmentSlot,
    characterId: string | undefined,
    activeDaos: Set<string>
  ): void {
    const DAO_ID = 'jinghong_split';

    // 已取得、已在 conditionsMet 或已在 pending，不重複標記
    if (activeDaos.has(DAO_ID)) return;
    if (this.conditionsMetDaos.has(DAO_ID)) return;
    if (this.pendingGuaranteedDaos.has(DAO_ID)) return;

    // 宗門限制：僅驚鴻派（assassin）
    if (characterId !== 'assassin') return;

    // 條件 1：projectile 武器數量 >= 3
    const projWeaponCount = equipment.weapons.filter(slot => {
      const w = WEAPONS.find(wd => wd.id === slot.weaponId);
      return w?.form === 'projectile';
    }).length;
    if (projWeaponCount < 3) return;

    // 條件 2：已進化武器數量 >= 1
    const evolvedCount = equipment.weapons.filter(slot =>
      EVOLVED_WEAPON_IDS.has(slot.weaponId)
    ).length;
    if (evolvedCount < 1) return;

    // 兩個條件同時達成 → 寫入 conditionsMetDaos
    // 下一次 getOptions() 開始時才晉升為 pending，本次不出現
    this.conditionsMetDaos.add(DAO_ID);
    console.log('[UpgradePool] jinghong_split 條件達成，下次升級必定出現');
  }

  /**
   * 將 pending 大道轉換為保證出現的 UpgradeOption 陣列
   * 排除已取得的大道（防呆）
   */
  private buildGuaranteedDaoOptions(activeDaos: Set<string>): UpgradeOption[] {
    const result: UpgradeOption[] = [];
    for (const daoId of this.pendingGuaranteedDaos) {
      if (activeDaos.has(daoId)) {
        // 已取得，從 pending 移除（防呆清理）
        this.pendingGuaranteedDaos.delete(daoId);
        continue;
      }
      result.push({
        type: 'activateDao',
        id: daoId,
        currentLevel: 0,
        nextLevel: 1,
      });
    }
    return result;
  }

  /**
   * 從陣列中隨機抽取 count 個不重複元素
   */
  private pickRandom<T>(arr: T[], count: number): T[] {
    if (count <= 0) return [];
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
