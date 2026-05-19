/**
 * MetaProgression — 局外升級系統
 * 管理天命點（destinyPoints）與局外升級等級
 * 使用 localStorage 持久化存檔
 */

const STORAGE_KEY = 'wuxia_survivors_meta_progression';

/** 局外升級 ID 型別 */
export type MetaUpgradeId = 'max_hp' | 'hp_recovery' | 'might' | 'area' | 'growth' | 'reroll';

/** 存檔資料格式 */
interface SaveData {
  destinyPoints: number;
  upgradeLevels: Record<MetaUpgradeId, number>;
}

/** 預設存檔 */
function defaultSaveData(): SaveData {
  return {
    destinyPoints: 0,
    upgradeLevels: {
      max_hp: 0,
      hp_recovery: 0,
      might: 0,
      area: 0,
      growth: 0,
      reroll: 0,
    },
  };
}

/** 讀取存檔（失敗時回傳預設值） */
function loadFromStorage(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSaveData();

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const defaults = defaultSaveData();

    // 相容舊存檔：若有 gold 但沒有 destinyPoints，轉換
    const anyParsed = parsed as Record<string, unknown>;
    let dp = typeof parsed.destinyPoints === 'number' ? parsed.destinyPoints : 0;
    if (dp === 0 && typeof anyParsed['gold'] === 'number') {
      dp = anyParsed['gold'] as number;
    }
    if (dp === 0 && typeof anyParsed['coins'] === 'number') {
      dp = anyParsed['coins'] as number;
    }

    const levels = { ...defaults.upgradeLevels };
    if (parsed.upgradeLevels) {
      for (const key of Object.keys(defaults.upgradeLevels) as MetaUpgradeId[]) {
        const v = parsed.upgradeLevels[key];
        if (typeof v === 'number' && v >= 0) {
          levels[key] = v;
        }
      }
    }

    return {
      destinyPoints: Math.max(0, dp),
      upgradeLevels: levels,
    };
  } catch {
    return defaultSaveData();
  }
}

/** 儲存至 localStorage */
function saveToStorage(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用時靜默失敗
  }
}

// ── 單例存檔資料 ──────────────────────────────────────────────────────────
let _data: SaveData = loadFromStorage();

export const MetaProgression = {
  /** 重新從 localStorage 讀取 */
  load(): void {
    _data = loadFromStorage();
  },

  /** 儲存至 localStorage */
  save(): void {
    saveToStorage(_data);
  },

  /** 取得目前天命點 */
  getDestinyPoints(): number {
    return _data.destinyPoints;
  },

  /** 增加天命點（只更新記憶體，不立即寫 localStorage）
   * 局內擊殺請用此方法，結算時再呼叫 save() */
  addDestinyPoints(amount: number): void {
    if (amount <= 0) return;
    _data.destinyPoints += amount;
    // 不在此處寫 localStorage，避免每次擊殺都觸發 I/O
  },

  /** 增加天命點並立即寫入 localStorage（結算時使用） */
  addDestinyPointsAndSave(amount: number): void {
    if (amount <= 0) return;
    _data.destinyPoints += amount;
    saveToStorage(_data);
  },

  /** 花費天命點（不足時回傳 false） */
  spendDestinyPoints(amount: number): boolean {
    if (_data.destinyPoints < amount) return false;
    _data.destinyPoints -= amount;
    saveToStorage(_data);
    return true;
  },

  /** 取得指定升級的目前等級 */
  getUpgradeLevel(id: MetaUpgradeId): number {
    return _data.upgradeLevels[id] ?? 0;
  },

  /** 取得指定升級的加成值（依等級計算） */
  getUpgradeBonus(id: MetaUpgradeId): number {
    const level = this.getUpgradeLevel(id);
    if (level === 0) return 0;

    switch (id) {
      case 'max_hp': {
        // Lv1~5: +5% each, Lv6~10: +2% each
        let bonus = 0;
        for (let i = 1; i <= level; i++) {
          bonus += i <= 5 ? 0.05 : 0.02;
        }
        return bonus;
      }
      case 'hp_recovery':
        // 每級 +0.2 HP/s
        return level * 0.2;
      case 'might': {
        // Lv1~5: +4% each, Lv6~10: +2% each
        let bonus = 0;
        for (let i = 1; i <= level; i++) {
          bonus += i <= 5 ? 0.04 : 0.02;
        }
        return bonus;
      }
      case 'area':
        // 每級 +3%
        return level * 0.03;
      case 'growth':
        // 每級 +4%
        return level * 0.04;
      case 'reroll':
        // 每級 +1 次刷新
        return level;
      default:
        return 0;
    }
  },

  /** 判斷是否可以升級（天命點足夠、未滿級、已解鎖） */
  canUpgrade(id: MetaUpgradeId): boolean {
    const def = META_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const level = this.getUpgradeLevel(id);
    if (level >= def.maxLevel) return false;
    if (!this.isUnlocked(id)) return false;
    const cost = def.costs[level];
    if (cost === undefined) return false;
    return _data.destinyPoints >= cost;
  },

  /** 判斷是否已解鎖 */
  isUnlocked(id: MetaUpgradeId): boolean {
    const def = META_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    if (!def.unlockCondition) return true;
    return def.unlockCondition();
  },

  /** 執行升級（回傳是否成功） */
  upgrade(id: MetaUpgradeId): boolean {
    if (!this.canUpgrade(id)) return false;
    const def = META_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const level = this.getUpgradeLevel(id);
    const cost = def.costs[level];
    if (cost === undefined) return false;
    if (!this.spendDestinyPoints(cost)) return false;
    _data.upgradeLevels[id] = level + 1;
    saveToStorage(_data);
    return true;
  },
};

// ── 局外升級定義 ──────────────────────────────────────────────────────────

export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  name: string;
  category: string;
  maxLevel: number;
  costs: number[];           // 長度 = maxLevel，costs[i] = 升到 i+1 級的費用
  effectDesc: (level: number) => string;  // 目前等級效果描述
  nextEffectDesc: (level: number) => string; // 下一級效果描述
  unlockCondition?: () => boolean;
  unlockDesc?: string;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'max_hp',
    name: '最大生命',
    category: '基礎生存',
    maxLevel: 10,
    costs: [50, 80, 120, 180, 260, 380, 550, 780, 1100, 1500],
    effectDesc: (lv) => {
      if (lv === 0) return '無加成';
      const bonus = MetaProgression.getUpgradeBonus('max_hp');
      return `最大生命 +${(bonus * 100).toFixed(0)}%`;
    },
    nextEffectDesc: (lv) => {
      if (lv >= 10) return '已滿級';
      const nextBonus = lv < 5 ? 0.05 : 0.02;
      return `+${(nextBonus * 100).toFixed(0)}% 最大生命`;
    },
    unlockCondition: undefined, // 一開始開放
  },
  {
    id: 'hp_recovery',
    name: '氣血回復',
    category: '基礎生存',
    maxLevel: 5,
    costs: [100, 180, 320, 560, 900],
    effectDesc: (lv) => {
      if (lv === 0) return '無回復';
      return `每秒回復 ${(lv * 0.2).toFixed(1)} HP`;
    },
    nextEffectDesc: (lv) => {
      if (lv >= 5) return '已滿級';
      return `每秒回復 +0.2 HP`;
    },
    unlockCondition: () => MetaProgression.getUpgradeLevel('max_hp') >= 3,
    unlockDesc: '需要最大生命 Lv.3',
  },
  {
    id: 'might',
    name: '攻擊力',
    category: '戰鬥增益',
    maxLevel: 10,
    costs: [120, 200, 340, 560, 900, 1400, 2100, 3000, 4200, 5800],
    effectDesc: (lv) => {
      if (lv === 0) return '無加成';
      const bonus = MetaProgression.getUpgradeBonus('might');
      return `攻擊力 +${(bonus * 100).toFixed(0)}%`;
    },
    nextEffectDesc: (lv) => {
      if (lv >= 10) return '已滿級';
      const nextBonus = lv < 5 ? 0.04 : 0.02;
      return `+${(nextBonus * 100).toFixed(0)}% 攻擊力`;
    },
    unlockCondition: () => MetaProgression.getUpgradeLevel('max_hp') >= 3,
    unlockDesc: '需要最大生命 Lv.3',
  },
  {
    id: 'area',
    name: '攻擊範圍',
    category: '戰鬥增益',
    maxLevel: 8,
    costs: [180, 320, 560, 900, 1400, 2100, 3000, 4200],
    effectDesc: (lv) => {
      if (lv === 0) return '無加成';
      return `攻擊範圍 +${(lv * 3)}%`;
    },
    nextEffectDesc: (lv) => {
      if (lv >= 8) return '已滿級';
      return `+3% 攻擊範圍`;
    },
    unlockCondition: () => MetaProgression.getUpgradeLevel('might') >= 3,
    unlockDesc: '需要攻擊力 Lv.3',
  },
  {
    id: 'growth',
    name: '經驗獲取',
    category: '功能與運氣',
    maxLevel: 8,
    costs: [250, 450, 800, 1300, 2000, 3000, 4300, 6000],
    effectDesc: (lv) => {
      if (lv === 0) return '無加成';
      return `經驗獲取 +${(lv * 4)}%`;
    },
    nextEffectDesc: (lv) => {
      if (lv >= 8) return '已滿級';
      return `+4% 經驗獲取`;
    },
    unlockCondition: () =>
      MetaProgression.getUpgradeLevel('max_hp') >= 5 &&
      MetaProgression.getUpgradeLevel('might') >= 3,
    unlockDesc: '需要最大生命 Lv.5 且攻擊力 Lv.3',
  },
  {
    id: 'reroll',
    name: '刷新次數',
    category: '功能與運氣',
    maxLevel: 3,
    costs: [600, 1800, 4000],
    effectDesc: (lv) => {
      if (lv === 0) return '無刷新';
      return `每局可刷新 ${lv} 次`;
    },
    nextEffectDesc: (lv) => {
      if (lv >= 3) return '已滿級';
      return `每局刷新次數 +1`;
    },
    unlockCondition: () => MetaProgression.getUpgradeLevel('growth') >= 3,
    unlockDesc: '需要經驗獲取 Lv.3',
  },
];
