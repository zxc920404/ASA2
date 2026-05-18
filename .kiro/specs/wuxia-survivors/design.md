# 技術設計文件：武俠幸存者（wuxia-survivors）

## Overview

武俠幸存者是一款 2D 生存遊戲，風格參考 Vampire Survivors，目標平台為 Android（Google Play Store）。
玩家操控武俠角色，在持續湧現的敵人中自動攻擊、收集經驗球、升級強化，盡可能存活更長時間。

MVP 目標：5～10 分鐘可玩的完整遊戲循環。

技術棧：Phaser 3（TypeScript），單一 HTML5 Canvas，打包為 Android WebView APK。

---

## Architecture

### Scene 結構

```
MainMenuScene
  └─ 顯示遊戲標題、「開始遊戲」按鈕
  └─ 點擊後切換至 CharacterSelectScene

CharacterSelectScene
  └─ 顯示可選角色列表（讀取 characters.ts）
  └─ 確認選擇後切換至 GameScene，傳入 characterId

GameScene
  └─ 初始化玩家、武器系統、HUD
  └─ 執行主遊戲循環
  └─ 玩家死亡後顯示 GameOverPanel
```

### 模組依賴關係

```
GameScene
  ├─ Player
  │    └─ StatCalculator（計算六項最終屬性）
  ├─ WeaponSystem（管理所有武器實例，自動攻擊）
  ├─ LevelUpSystem
  │    └─ UpgradePool（篩選合法升級選項）
  ├─ DifficultyScaler（依時間調整敵人強度與生成頻率）
  ├─ HUD（顯示 HP、等級、經驗條、計時器）
  └─ GameOverPanel（死亡結算）
```

---

## Components and Interfaces

### Scene

| Scene | 職責 |
|---|---|
| `MainMenuScene` | 標題畫面，進入角色選擇 |
| `CharacterSelectScene` | 角色選擇，傳遞 `characterId` 給 GameScene |
| `GameScene` | 主遊戲場景，管理所有遊戲物件與系統 |

### 遊戲物件（GameScene 內）

| 物件 | 職責 |
|---|---|
| `Player` | 玩家實體：移動、受傷、死亡、持有裝備欄 |
| `Enemy` | 敵人實體：追蹤玩家、接觸傷害、死亡掉落 |
| `Projectile` | 投射物：由 WeaponSystem 生成，命中後扣血 |
| `XPGem` | 經驗球：敵人死亡掉落，進入拾取範圍後磁吸吸收 |

### 系統（GameScene 內）

| 系統 | 職責 |
|---|---|
| `WeaponSystem` | 管理玩家所有武器，依攻擊間隔自動攻擊最近敵人 |
| `LevelUpSystem` | 監聽升級事件，暫停遊戲，顯示 LevelUpUI |
| `UpgradePool` | 依規則篩選合法升級選項，回傳最多 3 個選項 |
| `DifficultyScaler` | 依遊戲時間調整敵人 HP/傷害倍率與生成頻率 |
| `StatCalculator` | 純函式：依公式計算玩家六項最終屬性 |
| `HUD` | 顯示 HP 條、等級、經驗條、存活計時器 |
| `GameOverPanel` | 死亡後顯示結算資訊，提供返回主選單按鈕 |

### 介面定義

```typescript
// 角色定義
interface CharacterData {
  id: string;
  name: string;
  baseHP: number;          // 50～500
  baseMoveSpeed: number;   // 80～200 px/s
  baseAttackPower: number; // 0.5～3.0
  basePickupRange: number; // 50～200 px
  startingWeaponId: string;
  trait: CharacterTrait;
}

// 武器定義
interface WeaponData {
  id: string;
  name: string;
  baseDamagePerLevel: number[]; // 長度 8，索引 0 = Lv1
  baseAttackInterval: number;   // 秒
  baseAttackRange: number;      // px
  projectileSpeed: number;      // px/s
}

// 被動道具定義
interface PassiveData {
  id: string;
  name: string;
  stat: 'moveSpeed' | 'hp' | 'attackPower' | 'pickupRange' | 'attackRange' | 'attackSpeed';
  bonusPerLevel: number; // 每級加成量
}

// 敵人定義
interface EnemyData {
  id: string;
  name: string;
  baseHP: number;
  baseMoveSpeed: number;
  baseDamage: number;
  expDrop: number;
  collisionRadius: number;
}

// 玩家最終屬性（StatCalculator 輸出）
interface PlayerStats {
  maxHP: number;
  moveSpeed: number;
  attackPower: number;
  pickupRange: number;
  attackRange: number;    // 由 WeaponSystem 使用
  attackInterval: number; // 由 WeaponSystem 使用
}

// 裝備欄
interface EquipmentSlot {
  weapons: Array<{ weaponId: string; level: number }>;   // 上限 6
  passives: Array<{ passiveId: string; level: number }>; // 上限 6
}

// 升級選項
interface UpgradeOption {
  type: 'newWeapon' | 'upgradeWeapon' | 'newPassive' | 'upgradePassive';
  id: string;
  currentLevel: number; // 0 表示新裝備
  nextLevel: number;
}

// 難度縮放輸出
interface DifficultyState {
  hpMultiplier: number;    // 1.10^N
  damageMultiplier: number;
  spawnInterval: number;   // 毫秒，初始值 / (1.15^M)
  spawnRatio: { basic: number; fast: number; tank: number }; // 總和 = 1.0
}

// 結算資料
interface GameResult {
  survivalSeconds: number;
  killCount: number;
  maxLevel: number;
  score: number;  // kills*10 + seconds*2 + maxLevel*50
  coins: number;  // floor(score/10)
}
```

---

## 資料檔案

### `src/data/characters.ts`

定義 MVP 可選角色（建議 2～3 個）。每個角色包含：
- `id`、`name`
- 六項基礎屬性（baseHP、baseMoveSpeed、baseAttackPower、basePickupRange）
- `startingWeaponId`：初始武器 ID，必須對應 weapons.ts 中已定義的武器
- `trait`：角色特性（屬性加成型 / 條件觸發型 / 行為修改型）

角色資料為靜態常數陣列，不含被動道具欄位。

### `src/data/weapons.ts`

定義所有武器（建議 MVP 4～6 種）。每個武器包含：
- `id`、`name`
- `baseDamagePerLevel`：長度 8 的數字陣列，索引 0 對應 Lv1
- `baseAttackInterval`（秒）、`baseAttackRange`（px）、`projectileSpeed`（px/s）

### `src/data/passives.ts`

定義六種被動道具（固定）：

| id | name | stat | bonusPerLevel |
|---|---|---|---|
| `swift_step` | 迅捷步 | `moveSpeed`（倍率） | +0.10 |
| `life_jade` | 生命玉 | `hp`（加值） | +50 |
| `break_seal` | 破勢印 | `attackPower`（倍率） | +0.15 |
| `spirit_bead` | 引靈珠 | `pickupRange`（加值） | +20 |
| `vein_talisman` | 擴脈符 | `attackRange`（倍率） | +0.10 |
| `swift_strike` | 急攻令 | `attackSpeed`（倍率） | +0.15 |

### `src/data/enemies.ts`

定義三種敵人（固定）：

| id | name | baseHP | baseMoveSpeed | baseDamage | expDrop | collisionRadius |
|---|---|---|---|---|---|---|
| `basic` | 基礎小怪 | 100 | 80 | 10 | 5 | 16 |
| `fast` | 快速小怪 | 60 | 140 | 10 | 5 | 12 |
| `tank` | 厚血小怪 | 250 | 50 | 25 | 15 | 20 |

---

## Data Models

### 玩家狀態（執行期）

```
PlayerState {
  characterId: string
  currentHP: number
  level: number          // 1～20
  currentExp: number
  equipment: EquipmentSlot
  stats: PlayerStats     // 由 StatCalculator 計算，裝備變更後立即更新
}
```

### 敵人狀態（執行期）

```
EnemyInstance {
  dataId: string         // 對應 enemies.ts 中的 id
  currentHP: number      // = baseHP × hpMultiplier
  position: { x, y }
  lastDamageTime: number // 用於 1 秒接觸傷害冷卻
}
```

### 遊戲場景狀態

```
GameSceneState {
  elapsedSeconds: number
  killCount: number
  isPaused: boolean
  difficulty: DifficultyState
  enemies: EnemyInstance[]    // 上限 80（效能限制）
  projectiles: Projectile[]   // 上限 100
  xpGems: XPGem[]             // 上限 80
}
```

### StatCalculator 計算規則

輸入：`CharacterData` + `EquipmentSlot`（被動道具清單）

計算步驟：

1. 收集所有被動道具的加成值
2. 套用公式：
   - `maxHP = baseHP + Σ(hp 被動加成)`
   - `moveSpeed = baseMoveSpeed × Π(moveSpeed 倍率)`
   - `attackPower = baseAttackPower × Π(attackPower 倍率)`
   - `pickupRange = basePickupRange + Σ(pickupRange 加成)`
   - `attackRange = weapon.baseAttackRange × Π(attackRange 倍率)`
   - `attackInterval = weapon.baseAttackInterval ÷ Π(attackSpeed 倍率)`
3. 安全下限強制：所有倍率 ≥ 0.01
4. 上限限制：
   - maxHP ≤ 999,999
   - moveSpeed ≤ 9,999
   - attackPower ≤ 999,999
   - pickupRange ≤ 9,999
   - attackRange ≤ 9,999
   - attackInterval ≥ 0.05 秒

### 武器傷害計算

```
finalDamage = max(1, floor(weapon.baseDamagePerLevel[level-1] × stats.attackPower × passiveAttackMultiplier))
```

### 升級所需經驗

```
requiredExp(level) = 10 + level × 5
```

### 結算公式

```
score = killCount × 10 + survivalSeconds × 2 + maxLevel × 50
coins = floor(score / 10)
```

---

## 效能限制

| 項目 | 上限 | 說明 |
|---|---|---|
| 場上敵人 | 80 | 超過上限時暫停生成 |
| 場上投射物 | 100 | 超過上限時最舊的投射物自動移除 |
| 場上經驗球 | 80 | 超過上限時最舊的經驗球自動移除 |
| 最近敵人搜尋 | 每 250ms | WeaponSystem 快取最近敵人，不每幀搜尋 |
| HUD 文字更新 | 每 250ms | HP、等級、經驗條不每幀重繪文字 |

> 注意：需求文件中敵人上限為 100，但考量 Android 效能，設計層面將場上物件上限設為 80，以確保流暢度。若測試後效能充裕可調整。

---

## 升級池規則（UpgradePool）

UpgradePool 接收玩家當前裝備欄狀態，依以下規則篩選合法選項：

1. **排除初始武器**：玩家角色的 `startingWeaponId` 永遠不出現在「新武器」選項中
2. **排除已持有武器作為新武器**：已在裝備欄的武器只能以「升級」形式出現
3. **排除已達 Lv8 的裝備**：武器或被動道具達 Lv8 後從選項池移除
4. **裝備欄滿時不顯示新裝備**：武器欄（6 格）滿時不顯示新武器；被動欄（6 格）滿時不顯示新被動
5. **選項不足時**：可用選項少於 3 個時，顯示所有可用選項，不補空白

篩選流程：

```
候選池 = []
IF 武器欄未滿:
  候選池 += 所有未持有且非初始武器的武器（作為新武器）
候選池 += 所有已持有且等級 < 8 的武器（作為升級）
IF 被動欄未滿:
  候選池 += 所有未持有的被動道具（作為新被動）
候選池 += 所有已持有且等級 < 8 的被動道具（作為升級）
從候選池隨機抽取 min(3, 候選池長度) 個選項
```

---

## 難度縮放（DifficultyScaler）

| 觸發條件 | 效果 |
|---|---|
| 每 60 秒 | 敵人 HP 與傷害 × 1.10（累積：第 N 個週期後 = 初始值 × 1.10^N） |
| 每 30 秒 | 生成頻率 +15%（累積：初始頻率 × 1.15^M，M = 30 秒週期數） |
| 場上敵人達上限 | 暫停生成，繼續累計頻率數值 |

敵人生成比例（依遊戲時間）：

| 時間區間 | 基礎小怪 | 快速小怪 | 厚血小怪 |
|---|---|---|---|
| 0～60 秒 | 100% | 0% | 0% |
| 61～120 秒 | 70% | 20% | 10% |
| 120 秒以上 | 50% | 30% | 20% |

---

## Correctness Properties

*屬性（Property）是指在系統所有合法執行情境下都應成立的特性——本質上是對系統行為的形式化陳述。屬性作為人類可讀規格與機器可驗證正確性保證之間的橋樑。*

---

### Property 1: StatCalculator 屬性公式正確性

*對任意* 合法的角色基礎屬性與被動道具裝備組合，StatCalculator 計算出的六項最終屬性必須完全符合需求文件中定義的公式（加法加成用加法、倍率用乘法、攻擊間隔用除法）。

**Validates: Requirements 3.2**

---

### Property 2: StatCalculator 安全下限與上限

*對任意* 輸入（包含極端值：倍率趨近於 0、被動加成疊加至極大值），StatCalculator 輸出的所有最終屬性必須落在合法範圍內（倍率 ≥ 0.01；各屬性不超過上限；攻擊間隔 ≥ 0.05 秒）。

**Validates: Requirements 3.4, 3.5**

---

### Property 3: 武器傷害最小值保證

*對任意* 合法的武器等級傷害值、角色攻擊力倍率、被動攻擊倍率組合，最終傷害計算結果（floor 後）必須 ≥ 1，永遠不為 0 或負數。

**Validates: Requirements 5.2**

---

### Property 4: 升級所需經驗公式正確性

*對任意* 等級 L（1 ≤ L ≤ 19），`requiredExp(L)` 的回傳值必須等於 `10 + L × 5`。

**Validates: Requirements 10.1**

---

### Property 5: 結算公式正確性

*對任意* 非負整數的擊殺數、存活秒數、最高等級，結算分數必須等於 `kills × 10 + seconds × 2 + maxLevel × 50`，且獲得金幣必須等於 `floor(score / 10)`，兩者均為非負整數。

**Validates: Requirements 14.2, 14.3**

---

### Property 6: UpgradePool 不包含初始武器

*對任意* 玩家裝備狀態，UpgradePool 回傳的選項中，「新武器」類型的選項 ID 永遠不等於該角色的 `startingWeaponId`。

**Validates: Requirements 11.2**

---

### Property 7: UpgradePool 不包含已達上限的裝備

*對任意* 玩家裝備狀態，UpgradePool 回傳的選項中，不存在任何等級已達 Lv8 的武器或被動道具升級選項。

**Validates: Requirements 11.6, 12.1, 12.2**

---

### Property 8: UpgradePool 裝備欄滿時不顯示新裝備

*對任意* 武器欄已滿（6 格）的玩家裝備狀態，UpgradePool 回傳的選項中不存在任何「新武器」類型的選項；被動欄已滿（6 格）時同理。

**Validates: Requirements 11.4**

---

### Property 9: 難度縮放公式正確性

*對任意* 非負整數 N（60 秒週期數），DifficultyScaler 輸出的 HP 倍率必須等於 `1.10^N`，傷害倍率同理；*對任意* 非負整數 M（30 秒週期數），生成頻率倍率必須等於 `1.15^M`。

**Validates: Requirements 8.1, 8.3**

---

### Property 10: 敵人生成比例總和恆為 100%

*對任意* 遊戲時間 T，DifficultyScaler 輸出的三種敵人生成比例（basic + fast + tank）總和必須等於 1.0（即 100%）。

**Validates: Requirements 7.2**

---

## Error Handling

| 情境 | 處理方式 |
|---|---|
| 角色資料缺少必要屬性 | 拒絕載入，記錄錯誤，不進入遊戲 |
| StatCalculator 倍率 < 0.01 | 強制設為 0.01，繼續計算 |
| 最終屬性超出合法範圍 | 限制在上下限內，繼續執行 |
| 武器/被動嘗試升至 Lv9 | 忽略操作，等級保持 Lv8 |
| 升級選項不足 3 個 | 顯示所有可用選項，不補空白 |
| 場上物件達效能上限 | 停止生成新物件（敵人/投射物/經驗球），不拋出例外 |
| 玩家移動超出地圖邊界 | 停止朝邊界方向的移動分量，保留平行分量 |

---

## Testing Strategy

### 單元測試（Example-Based）

針對具體行為與邊界條件：

- 玩家死亡後遊戲狀態正確停止（Requirement 1.2）
- 遊戲開始後 5 秒內生成至少 5 隻敵人（Requirement 1.3）
- 對角線移動速度不超過最終移動速度的 1.05 倍（Requirement 2.1）
- 升級後溢出經驗正確保留（Requirement 10.2）
- 可用選項不足 3 個時不補空白（Requirement 11.7）
- 玩家達 Lv20 後不再觸發升級（Requirement 10.5）

### 屬性測試（Property-Based）

使用屬性測試函式庫（TypeScript 建議使用 `fast-check`），每個屬性測試執行最少 100 次迭代：

| 測試標籤 | 對應屬性 |
|---|---|
| `Feature: wuxia-survivors, Property 1: StatCalculator 屬性公式正確性` | 屬性 1 |
| `Feature: wuxia-survivors, Property 2: StatCalculator 安全下限與上限` | 屬性 2 |
| `Feature: wuxia-survivors, Property 3: 武器傷害最小值保證` | 屬性 3 |
| `Feature: wuxia-survivors, Property 4: 升級所需經驗公式正確性` | 屬性 4 |
| `Feature: wuxia-survivors, Property 5: 結算公式正確性` | 屬性 5 |
| `Feature: wuxia-survivors, Property 6: UpgradePool 不包含初始武器` | 屬性 6 |
| `Feature: wuxia-survivors, Property 7: UpgradePool 不包含已達上限的裝備` | 屬性 7 |
| `Feature: wuxia-survivors, Property 8: UpgradePool 裝備欄滿時不顯示新裝備` | 屬性 8 |
| `Feature: wuxia-survivors, Property 9: 難度縮放公式正確性` | 屬性 9 |
| `Feature: wuxia-survivors, Property 10: 敵人生成比例總和恆為 100%` | 屬性 10 |

### 整合測試

- 完整遊戲循環：從角色選擇到死亡結算的端對端流程
- 升級流程：升級暫停遊戲、選擇選項、恢復遊戲
- 難度縮放：驗證 60 秒與 30 秒觸發點的實際效果
