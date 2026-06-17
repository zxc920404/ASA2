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


---

## 11. 角色與 Boss 視覺尺寸規則（Visual Size Management）

### 11.1 問題背景

**典型問題場景：**
- 角色 / 敵人 / Boss 使用 `setDisplaySize` 或 `displayHeight` 控制顯示大小
- 技能流程中使用 `boss.setScale(1)` 或 tween 修改 `scaleX` / `scaleY`
- 技能結束後呼叫 `setScale(1)` 恢復，導致覆蓋原本的視覺縮放
- **結果：角色放完技能後尺寸突然變大或變小**

**根本原因：**
- `setDisplaySize(w, h)` 會根據 texture 原始尺寸計算 `scaleX` / `scaleY`
- 例如：texture 是 64×64，`setDisplaySize(200, 200)` 會設定 `scaleX = scaleY = 3.125`
- 技能流程中硬寫 `setScale(1)` 會把 scale 重設為 1，讓角色變回原始 texture 大小（64×64）
- 正確做法：**恢復到 `visualBaseScaleX` / `visualBaseScaleY`（setDisplaySize 後的實際 scale 值）**

---

### 11.2 統一視覺尺寸控制

**原則 1：視覺尺寸必須由統一的 config 控制**

所有角色、敵人、Boss 的顯示尺寸必須在模組頂層定義：

```ts
// ✅ 正確：統一管理視覺尺寸
const ENEMY_VISUAL_SIZE: Record<string, { w: number; h: number }> = {
  boss1:    { w: 200, h: 200 },   // 三當家 Boss
  henchman: { w: 125, h: 140 },
  giant:    { w: 175, h: 175 },
};

const PLAYER_VISUAL_CONFIG = {
  wave_stand: { displayHeight: 64, aspect: 1.0 },
  wave_run:   { displayHeight: 80, aspect: 1.2 },
};

// ❌ 錯誤：在建構函式或 create() 中硬寫數字
boss.setDisplaySize(200, 200);  // 魔術數字，無法追蹤來源
```

**原則 2：記錄基準 scale 值**

使用 `setDisplaySize` 後，必須記錄實際的 scale 值：

```ts
// ✅ 正確
const spr = scene.add.sprite(x, y, 'boss1_01');
spr.setDisplaySize(vSize.w, vSize.h);  // 根據 texture 大小計算 scale
this.visual = spr;
this.visualBaseScaleX = spr.scaleX;    // 記錄基準 scale
this.visualBaseScaleY = spr.scaleY;

// ❌ 錯誤：沒有記錄基準 scale，技能流程無法正確恢復
const spr = scene.add.sprite(x, y, 'boss1_01');
spr.setDisplaySize(200, 200);
this.visual = spr;  // 遺失 scale 資訊
```

---

### 11.3 技能流程中的 scale 操作

**原則 3：禁止在角色本體上硬寫 `setScale(1)`**

技能、受擊、死亡流程中不要直接重設角色 scale：

```ts
// ❌ 錯誤：硬寫 setScale(1) 會覆蓋 displaySize 設定的 scale
if (eliteVisual && eliteVisual.active) {
  eliteVisual.setScale(1);  // 會讓 Boss 變回 texture 原始大小
}

// ✅ 正確：恢復到記錄的基準 scale
if (eliteVisual && eliteVisual.active) {
  const bsx = (elite as any).visualBaseScaleX ?? 1;
  const bsy = (elite as any).visualBaseScaleY ?? 1;
  eliteVisual.setScale(bsx, bsy);
}
```

**原則 4：技能特效優先使用獨立 sprite / graphics**

技能需要放大效果時，不要直接縮放角色本體：

```ts
// ❌ 錯誤：直接放大 Boss 本體
this.tweens.add({
  targets: boss.visual,
  scaleX: 2.0, scaleY: 2.0,  // Boss 本體變大，容易忘記恢復
  duration: 500,
});

// ✅ 正確：建立獨立的特效 sprite
const effectSprite = this.add.sprite(boss.x, boss.y, 'skill_effect');
effectSprite.setDepth(boss.visual.depth + 1);
this.tweens.add({
  targets: effectSprite,
  scaleX: 2.0, scaleY: 2.0,
  alpha: 0,
  duration: 500,
  onComplete: () => effectSprite.destroy(),
});
```

**原則 5：技能 tween 必須相對於基準 scale**

技能流程中的 scale tween 必須基於基準值計算：

```ts
// ❌ 錯誤：硬寫絕對 scale 值
this.tweens.add({
  targets: eliteVisual,
  scaleX: 1.3, scaleY: 1.3,  // 假設基準是 1，但實際可能是 3.125
  duration: 80,
  yoyo: true,
  onComplete: () => { eliteVisual.setScale(1); },  // 恢復錯誤
});

// ✅ 正確：基於基準 scale 計算相對倍率
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;
this.tweens.add({
  targets: eliteVisual,
  scaleX: bsx * 1.3, scaleY: bsy * 1.3,  // 在基準上放大 1.3 倍
  duration: 80,
  yoyo: true,
  onComplete: () => { eliteVisual.setScale(bsx, bsy); },  // 正確恢復
});
```

---

### 11.4 技能清理與中斷處理

**原則 6：所有退出路徑都要恢復 scale**

技能結束、中斷、死亡、暫停時都要恢復角色 scale：

```ts
// ✅ 正確：所有退出路徑都恢復基準 scale
private spawnSkill(boss: Enemy): void {
  const eliteVisual = (boss as any).visual;
  const bsx = (boss as any).visualBaseScaleX ?? 1;
  const bsy = (boss as any).visualBaseScaleY ?? 1;

  // 技能前搖
  this.tweens.add({
    targets: eliteVisual,
    scaleX: bsx * 0.7, scaleY: bsy * 0.7,
    duration: 400,
  });

  this.time.delayedCall(1000, () => {
    // 退出路徑 1：遊戲暫停
    if (this.isPaused || this.isGameOver || this.isVictory) {
      if (eliteVisual && eliteVisual.active) {
        eliteVisual.setScale(bsx, bsy);  // 恢復基準 scale
      }
      boss.skillEndCast();
      return;
    }

    // 退出路徑 2：Boss 死亡
    if (!boss.active || boss.isDying) {
      if (eliteVisual && eliteVisual.active) {
        eliteVisual.setScale(bsx, bsy);  // 恢復基準 scale
      }
      boss.skillEndCast();
      return;
    }

    // 技能爆發
    this.tweens.add({
      targets: eliteVisual,
      scaleX: bsx * 1.3, scaleY: bsy * 1.3,
      duration: 80,
      yoyo: true,
      onComplete: () => {
        if (eliteVisual && eliteVisual.active) {
          eliteVisual.setScale(bsx, bsy);  // 退出路徑 3：正常結束
        }
      },
    });

    // 技能結束
    this.time.delayedCall(300, () => { boss.skillEndCast(); });
  });
}
```

---

### 11.5 動畫切換與尺寸一致性

**原則 7：動畫切換後確保尺寸不變**

`anims.play`、`setTexture` 後要確認角色尺寸、origin、body 未被重置：

```ts
// ✅ 正確：切換動畫後重新套用 displaySize
if (this.visual instanceof Phaser.GameObjects.Sprite) {
  const spr = this.visual;
  spr.play('boss1_attack');  // 切換動畫
  // 重新套用顯示尺寸，確保大小一致
  const vSize = ENEMY_VISUAL_SIZE['boss1'] ?? { w: 200, h: 200 };
  spr.setDisplaySize(vSize.w, vSize.h);
  this.visualBaseScaleX = spr.scaleX;  // 更新基準 scale
  this.visualBaseScaleY = spr.scaleY;
}
```

**原則 8：所有動畫狀態共用同一套尺寸設定**

新增角色動畫時，idle / run / attack / skill / hurt / death 必須使用統一的顯示尺寸：

```ts
// ✅ 正確：所有動畫狀態使用統一尺寸
const BOSS1_DISPLAY_SIZE = { w: 200, h: 200 };

// idle 動畫
spr.play('boss1_idle');
spr.setDisplaySize(BOSS1_DISPLAY_SIZE.w, BOSS1_DISPLAY_SIZE.h);

// run 動畫
spr.play('boss1_run');
spr.setDisplaySize(BOSS1_DISPLAY_SIZE.w, BOSS1_DISPLAY_SIZE.h);

// attack 動畫
spr.play('boss1_attack');
spr.setDisplaySize(BOSS1_DISPLAY_SIZE.w, BOSS1_DISPLAY_SIZE.h);

// ❌ 錯誤：不同動畫使用不同尺寸
spr.play('boss1_idle');
spr.setDisplaySize(200, 200);
spr.play('boss1_attack');
spr.setDisplaySize(250, 250);  // attack 時變大，破壞一致性
```

---

### 11.6 修改前檢查與測試

**原則 9：修改前必須搜尋 scale 相關呼叫**

修改角色技能或動畫時，必須搜尋以下關鍵字，確認不會覆蓋基礎尺寸：

```bash
# 必須檢查的關鍵字
setScale
setDisplaySize
scaleX
scaleY
tween.*scale
displayWidth
displayHeight
```

搜尋到後逐一確認：
- 是否在角色本體上直接呼叫？
- 是否有恢復到基準 scale？
- 是否在所有退出路徑（暫停、死亡、中斷）都有恢復？

**原則 10：修改後必須完整測試角色尺寸**

修改完成後，必須測試角色在以下情境的大小是否一致：

測試 Checklist：
- [ ] 角色生成時的尺寸正確
- [ ] 角色移動時尺寸不變
- [ ] 角色施放技能時尺寸正確（可以暫時放大/縮小）
- [ ] **技能結束後尺寸恢復正常（重點）**
- [ ] 角色受擊時尺寸不變（閃白效果不影響 scale）
- [ ] 角色死亡時尺寸不變
- [ ] 暫停/繼續遊戲後尺寸不變
- [ ] 切換動畫（idle ↔ run ↔ attack）後尺寸一致

---

### 11.7 實戰案例：三當家技能尺寸修正

**問題描述：**
三當家 Boss 使用 `setDisplaySize(200, 200)` 設定顯示大小，技能流程中使用 `setScale(1)` 恢復，導致技能後尺寸變大。

**錯誤代碼：**
```ts
// GameScene.ts - spawnLeapSlam()
if (this.isPaused || this.isGameOver || this.isVictory) {
  if (eliteVisual && eliteVisual.active) {
    eliteVisual.setScale(1);  // ❌ 錯誤：覆蓋了 setDisplaySize 的 scale
  }
  elite.shieldEndCast();
  return;
}

this.tweens.add({
  targets: eliteVisual,
  scaleX: 1.3, scaleY: 1.3,  // ❌ 錯誤：假設基準是 1
  duration: 80,
  yoyo: true,
  onComplete: () => {
    if (eliteVisual && eliteVisual.active) {
      eliteVisual.setScale(1);  // ❌ 錯誤：恢復到錯誤的 scale
    }
  },
});
```

**正確代碼：**
```ts
// GameScene.ts - spawnLeapSlam()
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;

if (this.isPaused || this.isGameOver || this.isVictory) {
  if (eliteVisual && eliteVisual.active) {
    eliteVisual.setScale(bsx, bsy);  // ✅ 正確：恢復到基準 scale
  }
  elite.shieldEndCast();
  return;
}

this.tweens.add({
  targets: eliteVisual,
  scaleX: bsx * 1.3, scaleY: bsy * 1.3,  // ✅ 正確：相對於基準放大
  duration: 80,
  yoyo: true,
  onComplete: () => {
    if (eliteVisual && eliteVisual.active) {
      eliteVisual.setScale(bsx, bsy);  // ✅ 正確：恢復到基準 scale
    }
  },
});
```

**修正步驟：**
1. 確認 `Enemy.ts` 中建立 sprite 時有記錄 `visualBaseScaleX` / `visualBaseScaleY`
2. 在 `applyEliteVisual()` 中也記錄 Boss 的 `visualBaseScaleX` / `visualBaseScaleY`
3. 搜尋 `GameScene.ts` 中所有 `setScale(1)` 呼叫，改為使用基準 scale
4. 搜尋所有 scale tween，改為相對於基準 scale 計算
5. 測試 Boss 生成、移動、施法、技能結束後的尺寸是否一致

**參考文件：**
- `BOSS1_SIZE_FIX.md`：詳細記錄此問題的根因與修正過程
- `Enemy.ts` lines 237-243, 252-253, 557-558：`visualBaseScaleX/Y` 記錄位置
- `GameScene.ts` lines 2165-2194：三當家技能 scale 恢復修正

---

### 11.8 快速參考

| 情境 | ❌ 錯誤做法 | ✅ 正確做法 |
|------|-----------|-----------|
| 設定角色顯示尺寸 | `spr.setDisplaySize(200, 200);` 沒記錄 scale | `spr.setDisplaySize(vSize.w, vSize.h);`<br>`this.visualBaseScaleX = spr.scaleX;` |
| 技能結束恢復尺寸 | `eliteVisual.setScale(1);` | `const bsx = elite.visualBaseScaleX ?? 1;`<br>`eliteVisual.setScale(bsx, bsy);` |
| 技能 tween 放大 | `scaleX: 1.3, scaleY: 1.3` | `scaleX: bsx * 1.3, scaleY: bsy * 1.3` |
| 技能特效 | `boss.visual.setScale(2.0);` | 建立獨立 `effectSprite` 並縮放 |
| 動畫切換 | `spr.play('attack');` 不重新設定尺寸 | `spr.play('attack');`<br>`spr.setDisplaySize(vSize.w, vSize.h);` |
| 受擊閃白 | `visual.setAlpha(0); visual.setScale(1);` | `visual.setAlpha(0);`<br>`visual.setScale(bsx, bsy);` |

