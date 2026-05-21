# ASA2 專案規範（Project Conventions）

本文件記錄 ASA2（武俠 Survivors）的長期開發規範。
新增任何同類內容時，必須遵守這套規則，不要只針對當前案例硬修。

---

## 1. 型別與介面（Types & Interfaces）

### 1.1 所有共用型別集中在 `src/types/index.ts`

- 所有跨模組共用的 `type` / `interface` 都放在這裡。
- 不要在 `src/data/` 或 `src/systems/` 內部定義跨模組型別。
- 模組內部私用的 `interface`（如 `RingOrb`、`FrostCrack`）可留在該檔案內。

### 1.2 Union type 命名規則

使用 `XxxId` 命名 ID 型別，使用 `XxxData` 命名資料介面：

```ts
// ✅ 正確
export type DifficultyId = 'easy' | 'normal' | 'hard';
export type WeaponForm   = 'orbit' | 'projectile' | 'field' | 'strike' | 'summon';
export type EnemyCategory = 'normal' | 'elite' | 'boss';

export interface DifficultyConfig { ... }
export interface EnemyData { ... }
export interface WeaponData { ... }

// ❌ 錯誤：不要用 string 替代 union type
const category: string = 'elite';
```

### 1.3 Union type 必須附說明

每個 union type 的每個值都要有行內或 JSDoc 說明：

```ts
/**
 * 敵人分類：
 * - 'normal'：普通小怪，由 spawnEnemy() 生成
 * - 'elite'：精英怪，由 spawnEliteEnemy() 生成
 * - 'boss'：Boss，由 spawnBossEnemy() 生成（預留）
 */
category: 'normal' | 'elite' | 'boss';
```

### 1.4 預留值要標記

尚未實作的 union 值加上 `（預留）` 說明：

```ts
export type WeaponForm = 'orbit' | 'projectile' | 'field' | 'melee' | 'strike' | 'summon';
// melee / summon 為預留，尚未實作
```

---

## 2. 資料檔案（Data Files）

### 2.1 資料檔案位置

所有靜態設定資料放在 `src/data/`：

| 檔案 | 內容 |
|------|------|
| `enemies.ts` | 所有敵人資料（normal / elite / boss） |
| `weapons.ts` | 所有武器資料（含進化武器） |
| `passives.ts` | 被動道具資料 |
| `characters.ts` | 角色（宗門）資料 |
| `daos.ts` | 宗門大道資料 |
| `difficulties.ts` | 難度設定倍率 |

### 2.2 敵人分類規則（EnemyData.category）

每筆 `EnemyData` 必須明確指定 `category`：

```ts
// ✅ 正確
{ id: 'basic',         category: 'normal', ... }
{ id: 'elite_charger', category: 'elite',  ... }
{ id: 'boss_1',        category: 'boss',   ... }

// ❌ 錯誤：不要省略 category
{ id: 'new_enemy', baseHP: 100, ... }
```

**分類規則：**
- `normal`：普通小怪，由 `spawnEnemy()` 生成，吃 `enemyHpMultiplier` / `enemyDamageMultiplier`
- `elite`：精英怪，由 `spawnEliteEnemy()` 生成，有獨立 baseData，吃 `eliteHpMultiplier` / `eliteDamageMultiplier`
- `boss`：Boss，由 `spawnBossEnemy()` 生成（預留），有獨立 baseData，吃 `bossHpMultiplier` / `bossDamageMultiplier`

**不同 category 之間不共用 baseData。**
精英怪和 Boss 不借用 `tank` / `basic` 等普通小怪資料。

### 2.3 精英怪 / Boss 的 expDrop

精英怪和 Boss 的 `expDrop` 設為 `0`，由 `GameScene.handleEnemyDeath()` 統一處理掉落 gem。

### 2.4 資料檔案必須提供查詢函式

每個資料檔案都要 export 查詢函式：

```ts
export const getEnemyById = (id: string): EnemyData | undefined => ...
export const getEnemiesByCategory = (category: 'normal' | 'elite' | 'boss'): EnemyData[] => ...
export const getDifficultyConfig = (id: DifficultyId): DifficultyConfig => ...
```

---

## 3. 難度系統（Difficulty System）

### 3.1 難度 ID

目前固定三個難度，定義在 `src/types/index.ts`：

```ts
export type DifficultyId = 'easy' | 'normal' | 'hard';
```

### 3.2 難度設定資料

倍率設定在 `src/data/difficulties.ts` 的 `DIFFICULTY_CONFIGS`。
每個難度對三種 category 套用不同倍率：

| 倍率欄位 | 適用對象 |
|---------|---------|
| `enemyHpMultiplier` / `enemyDamageMultiplier` | category: 'normal' |
| `eliteHpMultiplier` / `eliteDamageMultiplier` | category: 'elite' |
| `bossHpMultiplier` / `bossDamageMultiplier` | category: 'boss' |
| `spawnRateMultiplier` | spawnInterval（值越大生成越快） |
| `maxEnemyMultiplier` | maxEnemies 上限 |

### 3.3 DifficultyScaler 使用方式

`DifficultyScaler.getState()` 必須傳入 `category`：

```ts
// ✅ 正確：依 category 取得對應倍率
const state = this.difficultyScaler.getState(this.elapsedSeconds, 'normal');  // 普通小怪
const state = this.difficultyScaler.getState(this.elapsedSeconds, 'elite');   // 精英怪
const state = this.difficultyScaler.getState(this.elapsedSeconds, 'boss');    // Boss

// ❌ 錯誤：不傳 category（會 fallback 至 'normal'，精英怪數值不正確）
const state = this.difficultyScaler.getState(this.elapsedSeconds);
```

### 3.4 預設難度

目前預設難度在 `GameScene.create()` 中：

```ts
this.difficultyScaler = new DifficultyScaler('normal');
```

之後新增難度選擇 UI 時，只需改這一行傳入玩家選擇的 `DifficultyId`。

---

## 4. 武器系統（Weapon System）

### 4.1 武器進化規則

進化武器定義在 `UpgradePool.ts` 的 `WEAPON_EVOLUTION_MAP`，同時在 `LevelUpSystem.ts` 的 `EVOLVED_TO_SOURCE` 維護反查表。兩者必須同步。

新增進化武器時，兩個地方都要更新：

```ts
// UpgradePool.ts
const WEAPON_EVOLUTION_MAP = {
  ice_spike: { evolvedId: 'ice_spike_evolved', requiredLevel: 8, requiredCharacterId: 'assassin' },
};

// LevelUpSystem.ts
const EVOLVED_TO_SOURCE = {
  ice_spike_evolved: 'ice_spike',
};
```

### 4.2 進化武器不進入新武器候選池

進化武器（`WEAPON_EVOLUTION_MAP` 的 `evolvedId`）不能出現在「新武器」選項中，只能透過進化取得。`UpgradePool` 已有此過濾邏輯，新增進化武器時不需額外處理。

### 4.3 武器 levelStats 長度固定為 8

每把武器的 `levelStats` 陣列長度必須為 8（對應 Lv1～Lv8）。

---

## 5. 宗門大道（Dao System）

### 5.1 大道分為兩類

| 類型 | 說明 | 出現方式 |
|------|------|---------|
| 一般大道 | 條件達成後進入隨機候選池 | `DAOS` 通用迴圈 |
| 特殊大道 | 有複雜觸發條件，不進隨機池 | `SPECIAL_DAO_IDS` 黑名單 + 專屬邏輯 |

### 5.2 特殊大道黑名單

`UpgradePool.ts` 中維護 `SPECIAL_DAO_IDS`，列出所有不進隨機池的大道：

```ts
const SPECIAL_DAO_IDS = new Set(['jinghong_split']);
```

新增特殊大道時，必須加入此集合，並實作對應的條件檢查方法。

### 5.3 特殊大道的兩階段延遲機制

特殊大道使用兩階段延遲，確保條件達成的那次升級不出現，下一次才出現：

```
升級 N（條件達成）：conditionsMetDaos.add(daoId)  → 本次不出現
升級 N+1（下次）：conditionsMet → pendingGuaranteed → 強制插入結果
升級 N+2+（未選）：pendingGuaranteed 保留 → 繼續保證出現
玩家選取後：activeDaos 包含 id → 所有路徑排除
```

新增特殊大道時，遵循此模式實作 `checkAndMark<DaoName>Pending()` 方法。

### 5.4 daos.ts 的 requiredPlayerLevel

`daos.ts` 中的 `requiredPlayerLevel` 只對一般大道有效。
特殊大道（在 `SPECIAL_DAO_IDS` 中）的 `requiredPlayerLevel` 不被通用迴圈讀取，設任何值都不影響出現邏輯。
為避免混淆，特殊大道的 `requiredPlayerLevel` 建議設為一個明顯的哨兵值（如 `999`）並加上說明：

```ts
{
  id: 'jinghong_split',
  requiredPlayerLevel: 999, // 不由通用迴圈判斷，由 UpgradePool 特殊邏輯控制
  ...
}
```

---

## 6. 常數命名規則（Constants）

### 6.1 模組頂層常數

模組頂層的數值常數使用 `SCREAMING_SNAKE_CASE`，並附說明：

```ts
/** 場上敵人上限（保底值，實際由 DifficultyScaler 動態計算） */
const MAX_ENEMIES = 200;

/** 最後怪潮開始時間（秒）：9 分鐘 */
const FINAL_WAVE_START_SEC = 9 * 60;
```

### 6.2 不要用魔術數字

```ts
// ✅ 正確
const RING_DAMAGE_COOLDOWN = 500;
if (time - lastHit >= RING_DAMAGE_COOLDOWN) { ... }

// ❌ 錯誤
if (time - lastHit >= 500) { ... }
```

### 6.3 工具函式放在使用它的模組頂部

`clamp` / `lerp` 等工具函式定義在使用它的模組頂部（如 `DifficultyScaler.ts`），不要引入外部工具庫。

---

## 7. 生成邏輯（Spawn Logic）

### 7.1 三條生成路徑嚴格分離

| 方法 | 使用資料 | category 守衛 |
|------|---------|--------------|
| `spawnEnemy()` | `category: 'normal'` | `if (enemyData.category !== 'normal') continue` |
| `spawnEliteEnemy()` | `category: 'elite'` | `getEnemyById('elite_charger')` 等 |
| `spawnBossEnemy()`（預留） | `category: 'boss'` | `getEnemyById('boss_1')` 等 |

### 7.2 難度倍率傳入方式

```ts
// spawnEnemy → 'normal'
const state = this.difficultyScaler.getState(this.elapsedSeconds, 'normal');

// spawnEliteEnemy → 'elite'
const state = this.difficultyScaler.getState(this.elapsedSeconds, 'elite');

// spawnBossEnemy → 'boss'
const state = this.difficultyScaler.getState(this.elapsedSeconds, 'boss');
```

---

## 8. 註解規範（Comments）

### 8.1 區塊分隔線

使用 `// ── 標題 ──...` 格式分隔邏輯區塊：

```ts
// ── 武器進化選項 ──────────────────────────────────────────────────────────
// ── 一般宗門大道選項 ──────────────────────────────────────────────────────
```

### 8.2 JSDoc 用於公開方法和介面欄位

```ts
/**
 * 依遊戲時間與敵人分類計算難度狀態
 * @param elapsedSeconds 遊戲已進行秒數
 * @param category 敵人分類，決定套用哪組倍率
 */
public getState(elapsedSeconds: number, category: 'normal' | 'elite' | 'boss' = 'normal'): DifficultyState
```

### 8.3 TODO 標記

未完成或待確認的地方用 `// TODO:` 標記：

```ts
// TODO: 確認驚鴻派角色 id 後可改為 requiredCharacterId: 'assassin'
```

---

## 9. 檔案結構（File Structure）

```
src/
├── data/           # 靜態設定資料（不含邏輯）
│   ├── characters.ts
│   ├── daos.ts
│   ├── difficulties.ts   ← 難度倍率設定
│   ├── enemies.ts        ← normal / elite / boss 分類
│   ├── passives.ts
│   └── weapons.ts
├── objects/        # Phaser 遊戲物件
│   ├── Enemy.ts
│   ├── Player.ts
│   └── Projectile.ts
├── scenes/         # Phaser 場景
│   └── GameScene.ts
├── systems/        # 遊戲系統邏輯
│   ├── DifficultyScaler.ts   ← 難度曲線 + 倍率套用
│   ├── LevelUpSystem.ts
│   ├── UpgradePool.ts        ← 升級選項生成
│   └── WeaponSystem.ts
├── types/
│   └── index.ts    ← 所有共用型別集中於此
└── ui/             # UI 元件
```

---

## 10. 新增同類內容的 Checklist

### 新增普通小怪
- [ ] 在 `enemies.ts` 加入 `category: 'normal'` 的資料
- [ ] 在 `pickEnemyType()` 的比例邏輯中加入此怪
- [ ] 確認 `spawnEnemy()` 的 category 守衛不會排除它

### 新增精英怪
- [ ] 在 `enemies.ts` 加入 `category: 'elite'` 的獨立資料（不借用 normal 資料）
- [ ] 在 `spawnEliteEnemy()` 中用 `getEnemyById('elite_xxx')` 取資料
- [ ] 呼叫 `difficultyScaler.getState(..., 'elite')`
- [ ] 在 `Enemy.ts` 加入對應的 `EliteType` 值和技能邏輯

### 新增 Boss
- [ ] 在 `enemies.ts` 加入 `category: 'boss'` 的獨立資料
- [ ] 實作 `spawnBossEnemy()` 方法，呼叫 `getState(..., 'boss')`
- [ ] 在 `Enemy.ts` 加入 Boss 技能邏輯

### 新增武器
- [ ] 在 `weapons.ts` 加入武器資料，`levelStats` 長度為 8
- [ ] 在 `WeaponSystem.ts` 加入對應的 firing 邏輯
- [ ] 在 `LevelUpPanel.ts` 加入描述文字

### 新增進化武器
- [ ] 在 `weapons.ts` 加入進化武器資料
- [ ] 在 `UpgradePool.ts` 的 `WEAPON_EVOLUTION_MAP` 加入進化條件
- [ ] 在 `LevelUpSystem.ts` 的 `EVOLVED_TO_SOURCE` 加入反查
- [ ] 在 `WeaponSystem.ts` 加入 firing 邏輯
- [ ] 在 `LevelUpPanel.ts` 加入進化描述

### 新增一般宗門大道
- [ ] 在 `daos.ts` 加入資料，設定合理的 `requiredPlayerLevel`
- [ ] 確認不在 `SPECIAL_DAO_IDS` 中（一般大道不需要）
- [ ] 通用迴圈會自動處理

### 新增特殊宗門大道（複雜觸發條件）
- [ ] 在 `daos.ts` 加入資料，`requiredPlayerLevel: 999`（哨兵值）
- [ ] 在 `UpgradePool.ts` 的 `SPECIAL_DAO_IDS` 加入此 id
- [ ] 實作 `checkAndMark<DaoName>Pending()` 方法（寫入 `conditionsMetDaos`）
- [ ] 在 `getOptions()` 中呼叫此方法
- [ ] 確認兩階段延遲邏輯正確（條件達成當次不出現）

### 新增難度
- [ ] 在 `types/index.ts` 的 `DifficultyId` 加入新值
- [ ] 在 `difficulties.ts` 的 `DIFFICULTY_CONFIGS` 加入完整倍率設定
- [ ] `getDifficultyConfig()` 的 fallback 邏輯不需修改
