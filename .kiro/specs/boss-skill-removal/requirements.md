# Boss 技能移除需求文件

## Overview

簡化 Level 1（山賊營寨）三個 Boss 的技能組，移除特定技能以優化戰鬥體驗。

---

## Requirements

### Requirement 1: 三當家（elite_shield）技能調整

**目標：** 移除「震罡功（Shield Burst）」技能

**現況：**
- 三當家目前有 4 個技能：震罡功、霸山墜、震撼咆哮、連續重擊
- 震罡功：架盾蓄力震波，開啟護盾（半徑 100px），減傷 70%
- 冷卻：6～8 秒

**需求變更：**
- 完全移除震罡功技能及相關邏輯
- 移除護盾視覺效果（`shieldVisual`）
- 移除護盾減傷機制（`shieldActive` 相關邏輯）
- 技能池剩下 3 個：霸山墜、震撼咆哮、連續重擊

**保留行為：**
- 技能隨機選擇邏輯不變（從可用技能中隨機選擇）
- 技能選擇間隔（1.5 秒）不變
- 技能施放狀態（`shieldCasting`）控制移動的機制保留

**影響範圍：**
- `src/objects/Enemy.ts`
  - 移除 `burstCooldown` 相關變數
  - 移除 `shieldActive`、`shieldVisual` 相關邏輯
  - 移除 `onShieldBurst` 回呼
  - 移除 `shieldActivate()` 和 `shieldDeactivate()` 方法
  - 移除 `showShieldVisual()` 方法
  - 移除 `takeDamage()` 中的護盾減傷邏輯
  - 更新 `updateShield()` 中的技能選擇，排除 'burst'
- `src/scenes/GameScene.ts`
  - 移除震罡功的回呼實作（如有）
  - 移除護盾相關的投射物消除邏輯（如有）

---

### Requirement 2: 二當家（elite_shooter）技能調整

**目標：** 移除「黑洞（Black Hole）」技能

**現況：**
- 二當家目前有：4 種彈幕模式（扇形、連射、環形、交叉）+ 黑洞 + 外圍直線射擊
- 黑洞：在 Boss 位置生成黑洞，吸引玩家
- 冷卻：8 秒

**需求變更：**
- 完全移除黑洞技能及相關邏輯
- 技能池剩下：4 種彈幕模式 + 外圍直線射擊

**保留行為：**
- 彈幕模式輪替機制（1.7 秒間隔）不變
- 外圍直線射擊（Line Attack）保留，冷卻 6～8 秒
- 道數遞增機制（1→2→...→8→1）保留

**影響範圍：**
- `src/objects/Enemy.ts`
  - 移除 `blackholeCooldown` 相關變數
  - 移除 `onSpawnBlackHole` 回呼
  - 移除 `updateShooter()` 中的黑洞技能邏輯
- `src/scenes/GameScene.ts`
  - 移除黑洞生成的回呼實作
  - 移除黑洞物件類別（如有獨立實作）
  - 移除黑洞相關的視覺效果和吸引力場邏輯

---

### Requirement 3: 大當家（elite_charger）技能調整

**目標：** 移除「霸刀橫斬（Melee Slash）」普通攻擊

**現況：**
- 大當家目前有：3 個大招（蠻王衝鋒、裂寨三斬、連環破甲刺）+ 1 個普通攻擊（霸刀橫斬）
- 霸刀橫斬：靠近玩家（160px 內）時自動觸發，有 450ms 前搖並顯示預警扇形
- 冷卻：1.5～2 秒
- 傷害：接觸傷害 × 0.85

**需求變更：**
- 完全移除霸刀橫斬普通攻擊及相關邏輯
- 移除前搖機制（`melee_windup` 狀態）
- 移除預警扇形顯示
- 技能池剩下 3 個大招：蠻王衝鋒、裂寨三斬、連環破甲刺

**保留行為：**
- 大招隨機選擇邏輯不變（從可用技能中隨機選擇）
- 技能選擇間隔（1.2 秒）不變
- 技能施放狀態（`chargerState = 'casting'`）控制移動的機制保留
- 大當家在沒有技能可放時，只進行追蹤移動，不執行任何攻擊

**影響範圍：**
- `src/objects/Enemy.ts`
  - 移除 `chargerMeleeCooldown` 相關變數
  - 移除 `chargerMeleeWindupTimer`、`chargerMeleeWindupDirX/Y`
  - 移除 `CHARGER_MELEE_RANGE`、`CHARGER_MELEE_WINDUP`、`CHARGER_MELEE_CD_MIN/MAX` 常數
  - 移除 `chargerState` 的 `'melee_windup'` 狀態值（只保留 `'idle'` 和 `'casting'`）
  - 移除 `onChargerMeleeWindupStart` 回呼
  - 移除 `onChargerMeleeSlash` 回呼
  - 移除 `tryChargerMeleeSlash()` 方法
  - 更新 `updateCharger()` 方法，移除前搖計時和普通攻擊觸發邏輯
  - 更新 `moveTowardPlayer()` 方法，移除 `'melee_windup'` 狀態檢查
- `src/scenes/GameScene.ts`
  - 移除霸刀橫斬的回呼實作
  - 移除前搖預警扇形的繪製邏輯
- `src/types/index.ts`
  - 更新 `ChargerState` type 定義（如有獨立定義）

---

## Non-Requirements

本次變更**不包含**：
- 新增任何技能
- 調整保留技能的數值（傷害、冷卻、範圍）
- 修改 Boss 基礎屬性（HP、速度、接觸傷害）
- 修改 Boss 出場時間
- 修改其他敵人或武器系統

---

## Acceptance Criteria

### 三當家
- [ ] 震罡功不再觸發
- [ ] 護盾視覺效果不再出現
- [ ] 受到攻擊時不再有減傷效果（所有攻擊造成完整傷害）
- [ ] 三當家只使用霸山墜、震撼咆哮、連續重擊三個技能
- [ ] 技能選擇隨機性正常（三個技能冷卻完成時隨機選擇）

### 二當家
- [ ] 黑洞不再生成
- [ ] 玩家不再被黑洞吸引
- [ ] 二當家只使用彈幕模式（扇形、連射、環形、交叉）和外圍直線射擊
- [ ] 彈幕模式輪替正常（1.7 秒間隔，4 種模式循環）
- [ ] 外圍直線射擊正常觸發（6～8 秒冷卻，道數遞增）

### 大當家
- [ ] 霸刀橫斬不再觸發
- [ ] 靠近玩家時不再出現預警扇形
- [ ] 大當家只使用三個大招：蠻王衝鋒、裂寨三斬、連環破甲刺
- [ ] 技能選擇隨機性正常（三個大招冷卻完成時隨機選擇）
- [ ] 沒有技能可放時，大當家只進行追蹤移動，不執行任何攻擊

### 通用
- [ ] 執行 `npm run build` 成功無錯誤
- [ ] Boss 戰鬥流程正常（生成、技能釋放、死亡、掉落經驗球）
- [ ] 不影響普通小怪和其他遊戲系統

---

## Implementation Notes

### 程式碼清理建議
1. **保留註解說明**：在移除技能的位置加上註解，說明該技能已移除（避免未來混淆）
2. **回呼清理**：確保 `GameScene` 中對應的回呼實作也一併移除，避免殘留未使用的程式碼
3. **型別定義**：如果 `ChargerState` 在 `types/index.ts` 中有定義，需同步更新
4. **測試重點**：
   - 測試三個 Boss 的完整戰鬥流程（從生成到死亡）
   - 測試技能隨機選擇是否正常（不會卡住或報錯）
   - 測試沒有技能可放時的行為（特別是大當家）

### 向下相容性
- 本次變更不影響存檔資料（遊戲無存檔系統）
- 不影響其他場景和系統
- Boss 資料定義（`enemies.ts`）不需修改

---

## References

- 現有實作：`src/objects/Enemy.ts`（行 1～1365）
- Boss 資料：`src/data/enemies.ts`
- Boss 生成邏輯：`src/scenes/GameScene.ts`
- 專案規範：`.kiro/steering/project-conventions.md`
