# Boss 技能移除任務清單

## Task 1: 移除二當家黑洞技能

**Priority**: high  
**Estimated effort**: 30 minutes

移除二當家（elite_shooter）的黑洞（Black Hole）技能及相關邏輯。

### Subtasks

#### 1.1 移除 Enemy.ts 中的黑洞邏輯
- 移除建構子中的 `blackholeCooldown` 初始化
- 移除建構子中的 `onSpawnBlackHole` 回呼初始化
- 移除 `updateShooter()` 方法中的黑洞冷卻計時邏輯
- 移除 `updateShooter()` 方法中的黑洞技能觸發邏輯

#### 1.2 移除 GameScene.ts 中的黑洞實作
- 移除二當家生成時的 `onSpawnBlackHole` 回呼實作
- 移除黑洞物件類別或相關 graphics 生成邏輯
- 移除黑洞吸引力場邏輯（玩家速度修改）
- 移除黑洞相關的 timer、event、collider 清理

#### 1.3 清理未使用的 import 和常數
- 移除黑洞相關的 import（如有）
- 移除黑洞相關的常數定義（如有）

### Acceptance Criteria
- [ ] 二當家不再生成黑洞
- [ ] 玩家不再被黑洞吸引（移動速度正常）
- [ ] 二當家只使用彈幕模式和 Line Attack
- [ ] 彈幕模式輪替正常（1.7 秒間隔）
- [ ] Line Attack 正常觸發（6～8 秒冷卻）
- [ ] 無 console 錯誤或警告

---

## Task 2: 移除三當家震罡功技能

**Priority**: high  
**Estimated effort**: 45 minutes  
**Dependencies**: Task 1

移除三當家（elite_shield）的震罡功（Shield Burst）技能及護盾相關邏輯。

### Subtasks

#### 2.1 移除 Enemy.ts 中的護盾變數和回呼
- 移除建構子中的 `burstCooldown` 初始化
- 移除建構子中的 `shieldActive` 初始化
- 移除建構子中的 `shieldVisual` 初始化
- 移除建構子中的 `onShieldBurst` 回呼初始化

#### 2.2 移除護盾相關方法
- 移除 `shieldActivate()` 方法
- 移除 `shieldDeactivate()` 方法
- 移除 `showShieldVisual()` 方法

#### 2.3 更新技能選擇邏輯
- 在 `updateShield()` 方法中移除 `burstCooldown` 計時邏輯
- 在 `updateShield()` 方法中移除技能選擇池中的 'burst' 選項
- 確保技能選擇只包含 ['leap', 'warcry', 'combo']

#### 2.4 移除護盾減傷邏輯
- 在 `takeDamage()` 方法中移除 `if (this.shieldActive)` 減傷邏輯
- 確保三當家受到所有攻擊時造成完整傷害

#### 2.5 清理資源和視覺效果
- 在 `destroy()` 方法中移除 `shieldVisual` 清理邏輯
- 移除 GameScene.ts 中的震罡功回呼實作（如有）
- 移除 WeaponSystem.ts 中的護盾消除投射物邏輯（如有）

#### 2.6 清理未使用的 import 和常數
- 移除震罡功相關的 import（如有）
- 移除震罡功相關的常數定義（如有）

### Acceptance Criteria
- [ ] 三當家不再觸發震罡功
- [ ] 護盾視覺效果不再出現
- [ ] 受到攻擊時造成完整傷害（無減傷）
- [ ] 三當家只使用霸山墜、震撼咆哮、連續重擊三個技能
- [ ] 技能選擇隨機性正常（1.5 秒間隔）
- [ ] 無 console 錯誤或警告

---

## Task 3: 移除大當家霸刀橫斬技能

**Priority**: high  
**Estimated effort**: 60 minutes  
**Dependencies**: Task 2

移除大當家（elite_charger）的霸刀橫斬（Melee Slash）普通攻擊及前搖邏輯。

### Subtasks

#### 3.1 移除常數定義
- 移除 `CHARGER_MELEE_RANGE` 常數（160）
- 移除 `CHARGER_MELEE_WINDUP` 常數（450）
- 移除 `CHARGER_MELEE_CD_MIN` 常數（1500）
- 移除 `CHARGER_MELEE_CD_MAX` 常數（2000）

#### 3.2 移除前搖相關變數和回呼
- 移除建構子中的 `chargerMeleeCooldown` 初始化
- 移除建構子中的 `chargerMeleeWindupTimer` 初始化
- 移除建構子中的 `chargerMeleeWindupDirX/Y` 初始化
- 移除建構子中的 `onChargerMeleeWindupStart` 回呼初始化
- 移除建構子中的 `onChargerMeleeSlash` 回呼初始化

#### 3.3 移除普通攻擊方法
- 移除 `tryChargerMeleeSlash()` 完整方法

#### 3.4 更新技能邏輯
- 在 `updateCharger()` 方法中移除普通攻擊距離檢查邏輯
- 在 `updateCharger()` 方法中移除 `tryChargerMeleeSlash()` 呼叫
- 在 `updateCharger()` 方法中移除前搖計時邏輯
- 確保技能選擇只包含 ['dash', 'triple', 'stab']

#### 3.5 更新移動邏輯
- 在 `moveTowardPlayer()` 方法中移除 `chargerState === 'melee_windup'` 的停止移動邏輯
- 確保 `chargerState` 只在 'idle' 和 'casting' 之間切換

#### 3.6 清理 GameScene 中的回呼實作
- 移除大當家生成時的 `onChargerMeleeWindupStart` 回呼實作
- 移除大當家生成時的 `onChargerMeleeSlash` 回呼實作
- 移除前搖預警扇形繪製邏輯

#### 3.7 更新型別定義（如需要）
- 檢查 `types/index.ts` 中是否有獨立定義的 `ChargerState` type
- 如有，更新為 `type ChargerState = 'idle' | 'casting'`（移除 'melee_windup'）

#### 3.8 清理未使用的 import 和常數
- 移除霸刀橫斬相關的 import（如有）
- 移除霸刀橫斬相關的常數定義（如有）

### Acceptance Criteria
- [ ] 大當家不再觸發霸刀橫斬
- [ ] 靠近玩家時不再出現前搖預警扇形
- [ ] 大當家只使用蠻王衝鋒、裂寨三斬、連環破甲刺三個大招
- [ ] 技能選擇隨機性正常（1.2 秒間隔）
- [ ] 沒有技能可放時，只追蹤移動不攻擊
- [ ] 無 console 錯誤或警告

---

## Task 4: 整合測試與驗證

**Priority**: high  
**Estimated effort**: 30 minutes  
**Dependencies**: Task 3

執行完整的整合測試，驗證所有 Boss 技能移除後的正常運作。

### Subtasks

#### 4.1 執行建置測試
- 執行 `npm run build` 確認建置成功
- 確認無 TypeScript 錯誤
- 確認無 ESLint 警告（如有配置）
- 確認 Bundle 大小正常（應略微減少）

#### 4.2 三當家完整測試
- 啟動遊戲，進入 Level 1
- 等待三當家出現（2 分鐘後）
- 驗證只使用三個保留技能（霸山墜、震撼咆哮、連續重擊）
- 驗證不出現護盾視覺效果
- 驗證受擊時無減傷（造成完整傷害）
- 驗證技能隨機選擇正常

#### 4.3 二當家完整測試
- 等待二當家出現（4 分鐘後）
- 驗證只使用彈幕模式和 Line Attack
- 驗證不生成黑洞
- 驗證玩家移動速度正常（不被吸引）
- 驗證彈幕輪替正常（1.7 秒間隔）
- 驗證 Line Attack 正常（6～8 秒冷卻）

#### 4.4 大當家完整測試
- 等待大當家出現（6 分鐘後）
- 靠近大當家（160px 內）驗證不觸發普通攻擊
- 驗證只使用三個大招（蠻王衝鋒、裂寨三斬、連環破甲刺）
- 驗證不出現前搖預警扇形
- 驗證技能隨機選擇正常
- 驗證沒有技能可放時只追蹤移動

#### 4.5 邊界情況測試
- 測試所有保留技能都在冷卻中的情況（Boss 不卡住）
- 測試 Boss 在施放技能時被擊敗（資源正常清理）
- 測試快速擊殺 Boss（無記憶體洩漏）

#### 4.6 完整關卡測試
- 完整遊玩 Level 1（0～10 分鐘）
- 驗證三個 Boss 依序出場（2/4/6 分鐘）
- 驗證所有 Boss 死亡後正常掉落經驗球
- 驗證擊敗三個 Boss 後正常觸發勝利流程
- 確認無 console 錯誤或警告

### Acceptance Criteria
- [ ] `npm run build` 執行成功無錯誤
- [ ] 所有 Boss 技能移除驗證通過
- [ ] 所有保留技能正常運作
- [ ] 邊界情況測試通過
- [ ] 完整關卡流程測試通過
- [ ] 無任何 console 錯誤或警告
- [ ] 遊戲體驗流暢，無卡頓或異常

---

## Task 5: 程式碼清理與文件更新

**Priority**: medium  
**Estimated effort**: 15 minutes  
**Dependencies**: Task 4

清理程式碼註解並更新相關文件。

### Subtasks

#### 5.1 新增程式碼註解
- 在三當家技能選擇處加上註解說明震罡功已移除
- 在二當家技能邏輯處加上註解說明黑洞已移除
- 在大當家技能選擇處加上註解說明霸刀橫斬已移除

#### 5.2 更新技能文件（如有）
- 更新專案文件中的 Boss 技能列表（如有相關文件）
- 記錄移除原因和保留技能清單

#### 5.3 最終程式碼審查
- 檢查是否有殘留的未使用變數
- 檢查是否有殘留的未使用 import
- 檢查是否有殘留的未使用常數
- 確認所有 TODO 註解已處理

### Acceptance Criteria
- [ ] 程式碼註解清晰明確
- [ ] 相關文件已更新
- [ ] 無殘留未使用的程式碼
- [ ] 程式碼符合專案規範（project-conventions.md）
