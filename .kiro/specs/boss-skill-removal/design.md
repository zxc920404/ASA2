# Boss 技能移除設計文件

## Design Overview

本設計採用「最小必要修改」原則，針對三個 Boss 的指定技能進行精準移除，不重構整體 Boss 系統架構。所有變更集中在技能邏輯層，保留 Boss 基礎行為（移動、受擊、死亡）和其他技能。

---

## Architecture

### 系統架構圖

```
Enemy.ts (Boss 實例)
├── updateShield()      # 三當家技能邏輯
├── updateShooter()     # 二當家技能邏輯
├── updateCharger()     # 大當家技能邏輯
└── takeDamage()        # 共用受擊邏輯

GameScene.ts (場景管理)
├── spawnEliteEnemy()   # Boss 生成
└── Boss 技能回呼註冊   # onShieldLeap、onChargerDash 等
```

### 移除策略

每個技能的移除遵循以下步驟：

1. **識別技能觸發點**：找到技能在 `update()` 方法中的觸發邏輯
2. **追蹤技能生命週期**：冷卻計時 → 技能選擇 → 回呼呼叫 → 視覺效果 → 狀態重置
3. **清理技能相關資源**：
   - 移除冷卻計時器變數
   - 移除技能狀態變數（如 `shieldActive`）
   - 移除回呼函式
   - 移除視覺效果（graphics、sprites）
   - 移除技能選擇池中的引用
4. **驗證保留邏輯**：確保其他技能和基礎行為不受影響

---

## Component Design

### 1. 三當家（elite_shield）：移除震罡功

#### 1.1 移除項目清單

| 項目 | 位置 | 說明 |
|------|------|------|
| 冷卻計時器 | `burstCooldown` | 震罡功冷卻計時 |
| 護盾狀態 | `shieldActive` | 護盾是否開啟 |
| 護盾視覺 | `shieldVisual` | 護盾圓形 graphics |
| 回呼函式 | `onShieldBurst` | 震罡功觸發回呼 |
| 護盾方法 | `shieldActivate()`、`shieldDeactivate()`、`showShieldVisual()` | 護盾啟動/停用/顯示 |
| 減傷邏輯 | `takeDamage()` 中的護盾減傷判斷 | 護盾開啟時減傷 70% |
| 技能選擇 | `updateShield()` 中的 'burst' 選項 | 從技能池移除 |

#### 1.2 程式碼位置

**Enemy.ts：**
- 建構子：移除 `burstCooldown`、`shieldActive`、`shieldVisual`、`onShieldBurst` 初始化
- `updateShield()`：移除 `burstCooldown` 計時和 'burst' 技能選擇邏輯
- `takeDamage()`：移除護盾減傷邏輯（`if (this.shieldActive) { ... }`）
- `destroy()`：移除 `shieldVisual` 清理

**GameScene.ts：**
- 三當家生成：移除 `onShieldBurst` 回呼實作（如有）
- WeaponSystem：移除護盾消除投射物的邏輯（如有）

#### 1.3 保留邏輯

```typescript
// 保留技能：霸山墜、震撼咆哮、連續重擊
const skills = ['leap', 'warcry', 'combo'].filter(...);
const chosenSkill = Phaser.Math.RND.pick(skills);
```

技能選擇間隔（1.5 秒）和隨機選擇機制保持不變。

---

### 2. 二當家（elite_shooter）：移除黑洞

#### 2.1 移除項目清單

| 項目 | 位置 | 說明 |
|------|------|------|
| 冷卻計時器 | `blackholeCooldown` | 黑洞技能冷卻計時 |
| 回呼函式 | `onSpawnBlackHole` | 黑洞生成回呼 |
| 技能觸發 | `updateShooter()` 中的黑洞觸發邏輯 | 黑洞技能判斷和呼叫 |

#### 2.2 程式碼位置

**Enemy.ts：**
- 建構子：移除 `blackholeCooldown`、`onSpawnBlackHole` 初始化
- `updateShooter()`：移除黑洞冷卻計時和技能觸發邏輯

**GameScene.ts：**
- 二當家生成：移除 `onSpawnBlackHole` 回呼實作
- 移除黑洞物件類別（如 `BlackHole` class 或相關 graphics）
- 移除黑洞吸引力場邏輯（玩家速度修改）

#### 2.3 保留邏輯

```typescript
// 保留技能：
// 1. 彈幕模式（扇形、連射、環形、交叉）
if (time - this.shooterLastFire >= this.shooterFireInterval) {
  // 1.7 秒間隔，4 種模式循環
}

// 2. 外圍直線射擊（Line Attack）
if (time - this.lineAttackCooldown >= lineAttackCD) {
  // 6～8 秒冷卻，道數遞增 1→2→...→8→1
}
```

彈幕輪替和 Line Attack 保持完全獨立，不受黑洞移除影響。

---

### 3. 大當家（elite_charger）：移除霸刀橫斬

#### 3.1 移除項目清單

| 項目 | 位置 | 說明 |
|------|------|------|
| 冷卻計時器 | `chargerMeleeCooldown` | 普通攻擊冷卻計時 |
| 前搖計時器 | `chargerMeleeWindupTimer` | 前搖時間計時 |
| 前搖方向 | `chargerMeleeWindupDirX/Y` | 前搖時攻擊方向 |
| 常數定義 | `CHARGER_MELEE_RANGE`、`CHARGER_MELEE_WINDUP`、`CHARGER_MELEE_CD_MIN/MAX` | 普通攻擊相關常數 |
| 狀態值 | `chargerState = 'melee_windup'` | 前搖狀態 |
| 回呼函式 | `onChargerMeleeWindupStart`、`onChargerMeleeSlash` | 前搖開始和橫斬觸發回呼 |
| 方法 | `tryChargerMeleeSlash()` | 普通攻擊嘗試方法 |
| 觸發邏輯 | `updateCharger()` 中的普通攻擊判斷 | 距離檢查和技能觸發 |
| 移動檢查 | `moveTowardPlayer()` 中的 `'melee_windup'` 狀態檢查 | 前搖時停止移動 |

#### 3.2 程式碼位置

**Enemy.ts：**
- 常數定義區：移除 `CHARGER_MELEE_RANGE`、`CHARGER_MELEE_WINDUP`、`CHARGER_MELEE_CD_MIN/MAX`
- 建構子：移除 `chargerMeleeCooldown`、前搖相關變數、回呼函式初始化
- `updateCharger()`：移除普通攻擊距離檢查和 `tryChargerMeleeSlash()` 呼叫，移除前搖計時邏輯
- `tryChargerMeleeSlash()`：整個方法刪除
- `moveTowardPlayer()`：移除 `chargerState === 'melee_windup'` 的停止移動邏輯

**GameScene.ts：**
- 大當家生成：移除 `onChargerMeleeWindupStart`、`onChargerMeleeSlash` 回呼實作
- 移除前搖預警扇形繪製邏輯

**types/index.ts：**
- 如果有獨立定義 `ChargerState` type，更新為：
  ```typescript
  type ChargerState = 'idle' | 'casting';
  ```

#### 3.3 保留邏輯

```typescript
// 保留技能：蠻王衝鋒、裂寨三斬、連環破甲刺
const skills = ['dash', 'triple', 'stab'].filter(...);
const chosenSkill = Phaser.Math.RND.pick(skills);

// 沒有技能可放時，只進行追蹤移動
if (this.chargerState === 'idle') {
  this.moveTowardPlayer(player, delta);
}
```

技能選擇間隔（1.2 秒）和隨機選擇機制保持不變。大當家在沒有技能可放時，不執行任何攻擊，只追蹤玩家。

---

## Data Model Changes

### 無資料模型變更

本次變更**不涉及**資料檔案修改：
- `src/data/enemies.ts`：Boss 基礎屬性（HP、速度、傷害）保持不變
- `src/data/weapons.ts`：武器系統不受影響
- `src/types/index.ts`：除非有獨立 `ChargerState` 定義需更新，否則不修改

---

## API Changes

### Enemy.ts 公開介面變更

#### 移除的回呼介面

```typescript
// 移除：震罡功回呼（三當家）
onShieldBurst?: () => void;

// 移除：黑洞回呼（二當家）
onSpawnBlackHole?: (x: number, y: number) => void;

// 移除：霸刀橫斬回呼（大當家）
onChargerMeleeWindupStart?: (x: number, y: number, dirX: number, dirY: number) => void;
onChargerMeleeSlash?: (x: number, y: number, dirX: number, dirY: number) => void;
```

#### 移除的公開方法

```typescript
// 移除：三當家護盾相關方法
shieldActivate(): void;
shieldDeactivate(): void;
showShieldVisual(): void;

// 移除：大當家普通攻擊方法
tryChargerMeleeSlash(): void;
```

#### 保留的公開介面

所有基礎方法和其他技能回呼保持不變：
- `update()`
- `takeDamage()`
- `destroy()`
- `onShieldLeap`、`onShieldWarcry`、`onShieldCombo`（三當家保留技能）
- `onChargerDash`、`onChargerTriple`、`onChargerStab`（大當家保留技能）

---

## Edge Cases & Error Handling

### 1. 技能池為空的情況

**情境：** 所有保留技能都在冷卻中，Boss 沒有技能可放。

**處理：**
- 三當家/二當家：技能選擇邏輯會 `filter()` 出可用技能，若為空陣列則不執行 `pick()`，Boss 保持移動狀態
- 大當家：`chargerState = 'idle'` 時只追蹤移動，不執行任何攻擊

**驗證：** 確保 `skills.length === 0` 時不會報錯或卡住。

### 2. 技能施放中被打斷

**情境：** Boss 在施放保留技能時被玩家擊敗。

**處理：**
- `destroy()` 方法會清理所有 graphics、timers、colliders
- 保留技能的回呼實作需包含 Boss 存活檢查（`if (!this.active) return`）

**驗證：** 測試 Boss 在施放技能時死亡是否正常清理。

### 3. 護盾減傷邏輯殘留

**情境：** 移除震罡功後，`takeDamage()` 中的護盾減傷邏輯未清理。

**處理：**
- 在 `takeDamage()` 中完全移除 `if (this.shieldActive)` 邏輯
- 三當家受到所有攻擊時造成完整傷害

**驗證：** 測試三當家受擊時傷害數值是否正確（無減傷）。

### 4. 前搖狀態殘留

**情境：** 移除霸刀橫斬後，`chargerState` 仍可能進入 `'melee_windup'` 狀態。

**處理：**
- 完全移除 `tryChargerMeleeSlash()` 方法，確保 `chargerState` 只在 `'idle'` 和 `'casting'` 之間切換
- 移除 `moveTowardPlayer()` 中的 `'melee_windup'` 檢查

**驗證：** 測試大當家移動時不會卡在前搖狀態。

---

## Performance Considerations

### 效能影響評估

| 項目 | 移除前 | 移除後 | 影響 |
|------|--------|--------|------|
| 三當家 update() | 4 個技能 + 護盾邏輯 | 3 個技能 | -25% 邏輯分支 |
| 二當家 update() | 5 個技能 | 4 個技能 + Line Attack | -20% 邏輯分支 |
| 大當家 update() | 3 個大招 + 1 個普通攻擊 | 3 個大招 | -25% 邏輯分支 |
| Graphics 渲染 | 護盾圓形 + 前搖扇形 | 無 | 減少 2 個 graphics 物件 |
| 記憶體佔用 | 黑洞物件池（如有） | 無 | 減少物件池開銷 |

**結論：** 移除技能後，Boss update() 邏輯分支減少 20～25%，對效能有輕微正面影響。

### 優化建議

1. **避免無效迴圈**：確保技能 `filter()` 後不對空陣列執行 `pick()`
2. **Graphics 清理**：確保 `destroy()` 中清理所有 graphics 物件（`shieldVisual` 等）
3. **Timer 清理**：確保所有 `scene.time` 相關的 timer 在 Boss 死亡時正確清理

---

## Testing Strategy

### 單元測試（手動測試）

#### 測試案例 1：三當家技能驗證

**步驟：**
1. 啟動遊戲，進入 Level 1
2. 等待三當家出現（2 分鐘後）
3. 觀察三當家技能釋放

**預期結果：**
- ✅ 只使用霸山墜、震撼咆哮、連續重擊三個技能
- ✅ 不出現護盾圓形視覺效果
- ✅ 受到攻擊時造成完整傷害（無減傷）
- ✅ 技能隨機選擇，間隔約 1.5 秒

#### 測試案例 2：二當家技能驗證

**步驟：**
1. 啟動遊戲，進入 Level 1
2. 等待二當家出現（4 分鐘後）
3. 觀察二當家技能釋放

**預期結果：**
- ✅ 只使用彈幕模式（扇形、連射、環形、交叉）和外圍直線射擊
- ✅ 不生成黑洞
- ✅ 玩家不被吸引（移動速度正常）
- ✅ 彈幕模式 1.7 秒輪替，Line Attack 6～8 秒冷卻

#### 測試案例 3：大當家技能驗證

**步驟：**
1. 啟動遊戲，進入 Level 1
2. 等待大當家出現（6 分鐘後）
3. 靠近大當家（160px 內）觀察行為

**預期結果：**
- ✅ 只使用蠻王衝鋒、裂寨三斬、連環破甲刺三個大招
- ✅ 靠近時不出現前搖預警扇形
- ✅ 靠近時不執行霸刀橫斬
- ✅ 技能隨機選擇，間隔約 1.2 秒
- ✅ 沒有技能可放時，只追蹤移動不攻擊

#### 測試案例 4：邊界情況驗證

**步驟：**
1. 測試所有保留技能都在冷卻中的情況
2. 測試 Boss 在施放技能時被擊敗
3. 測試快速擊殺 Boss（確認資源清理）

**預期結果：**
- ✅ 技能池為空時 Boss 不卡住、不報錯
- ✅ 施放技能時死亡，資源正常清理
- ✅ 快速擊殺 Boss，無記憶體洩漏

### 整合測試

**步驟：**
1. 完整遊玩 Level 1（0～10 分鐘）
2. 依序擊敗三個 Boss
3. 確認勝利流程正常

**預期結果：**
- ✅ 三個 Boss 依序出場（2/4/6 分鐘）
- ✅ 所有保留技能正常釋放
- ✅ Boss 死亡後正常掉落經驗球
- ✅ 擊敗三個 Boss 後正常觸發勝利流程
- ✅ 無 console 錯誤或警告

### 建置測試

**步驟：**
```bash
npm run build
```

**預期結果：**
- ✅ 建置成功，無 TypeScript 錯誤
- ✅ 無 ESLint 警告（如有配置）
- ✅ Bundle 大小無異常增長（應略微減少）

---

## Implementation Notes

### 實作順序建議

建議按以下順序移除技能，每次移除後進行測試：

1. **階段一：二當家黑洞移除**（最簡單）
   - 移除 Enemy.ts 中的 `blackholeCooldown` 和 `onSpawnBlackHole`
   - 移除 GameScene.ts 中的黑洞回呼實作
   - 測試二當家彈幕和 Line Attack 正常

2. **階段二：三當家震罡功移除**（中等複雜度）
   - 移除 Enemy.ts 中的護盾相關邏輯
   - 移除 GameScene.ts 中的護盾回呼實作
   - 測試三當家保留技能正常，受擊無減傷

3. **階段三：大當家霸刀橫斬移除**（最複雜）
   - 移除 Enemy.ts 中的前搖邏輯和普通攻擊方法
   - 移除 GameScene.ts 中的前搖回呼實作
   - 測試大當家大招正常，靠近時不觸發普通攻擊

### 程式碼註解規範

在移除技能的位置加上註解，避免未來混淆：

```typescript
// ── 三當家技能選擇 ──────────────────────────────────────────────────────
// 震罡功（Shield Burst）已移除，目前只保留三個技能
const skills = ['leap', 'warcry', 'combo'].filter(...);
```

### 回呼清理檢查表

確保 GameScene 中的回呼實作與 Enemy 中的回呼定義同步移除：

```typescript
// Enemy.ts 移除回呼定義
onShieldBurst?: () => void; // ← 刪除

// GameScene.ts 移除回呼實作
elite.onShieldBurst = () => { ... }; // ← 刪除
```

### 型別定義檢查

確認是否需要更新 `types/index.ts`：

```typescript
// 如果有獨立定義 ChargerState
export type ChargerState = 'idle' | 'casting'; // 移除 'melee_windup'
```

---

## Rollback Plan

### 回滾策略

如果移除後出現嚴重問題，可透過 Git 回滾：

```bash
# 查看修改
git diff

# 回滾單一檔案
git checkout HEAD -- src/objects/Enemy.ts

# 回滾所有修改
git reset --hard HEAD
```

### 漸進式回滾

如果只有特定 Boss 出問題，可選擇性回滾：

1. **二當家問題**：恢復 `blackholeCooldown` 和黑洞邏輯
2. **三當家問題**：恢復 `shieldActive` 和護盾邏輯
3. **大當家問題**：恢復 `tryChargerMeleeSlash()` 和前搖邏輯

### 備份建議

在開始實作前，建議建立分支：

```bash
git checkout -b feature/boss-skill-removal
```

實作完成並測試通過後，再合併至主分支：

```bash
git checkout main
git merge feature/boss-skill-removal
```

---

## References

- **需求文件**：`.kiro/specs/boss-skill-removal/requirements.md`
- **專案規範**：`.kiro/steering/project-conventions.md`
- **主要修改檔案**：
  - `src/objects/Enemy.ts`（行 1～1365）
  - `src/scenes/GameScene.ts`（Boss 生成和回呼）
  - `src/types/index.ts`（型別定義）
- **測試參考**：
  - Level 1 測試地圖：2 分鐘三當家、4 分鐘二當家、6 分鐘大當家
  - 建置指令：`npm run build`

---

## Appendix

### 技能移除前後對照表

| Boss | 移除前技能數 | 移除後技能數 | 移除技能 | 保留技能 |
|------|------------|------------|---------|---------|
| 三當家（elite_shield） | 4 | 3 | 震罡功 | 霸山墜、震撼咆哮、連續重擊 |
| 二當家（elite_shooter） | 5 | 5 | 黑洞 | 彈幕模式×4、Line Attack |
| 大當家（elite_charger） | 4 | 3 | 霸刀橫斬 | 蠻王衝鋒、裂寨三斬、連環破甲刺 |

### 常數定義對照表

| 常數名稱 | Boss | 移除前值 | 移除後 |
|---------|------|---------|--------|
| `CHARGER_MELEE_RANGE` | 大當家 | 160 | 刪除 |
| `CHARGER_MELEE_WINDUP` | 大當家 | 450 | 刪除 |
| `CHARGER_MELEE_CD_MIN` | 大當家 | 1500 | 刪除 |
| `CHARGER_MELEE_CD_MAX` | 大當家 | 2000 | 刪除 |

### 視覺效果對照表

| 視覺效果 | Boss | 類型 | 移除後 |
|---------|------|------|--------|
| 護盾圓形 | 三當家 | Graphics | 刪除 `shieldVisual` |
| 前搖預警扇形 | 大當家 | Graphics | 刪除前搖回呼繪製 |
| 黑洞圓形 | 二當家 | Sprite/Graphics | 刪除黑洞物件 |

---

**設計文件版本**：1.0  
**最後更新**：2025-01-XX
