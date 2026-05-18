# Requirements Document

## Introduction

武俠幻想風格 2D 生存遊戲（Vampire Survivors-like），目標為發布於 Google Play Store 的 MVP 版本。
玩家操控一名武俠角色，在不斷湧現的敵人中自動攻擊、收集經驗、升級強化，盡可能存活更長時間。
MVP 目標為 5～10 分鐘可玩的完整遊戲循環，不包含完整 30 分鐘正式版的所有功能。

---

## Glossary

- **遊戲系統（Game_System）**: 負責整體遊戲流程控制的核心模組，包含遊戲狀態管理、暫停與恢復。
- **玩家（Player）**: 由使用者操控的角色實體，擁有屬性、武器與被動道具。
- **敵人（Enemy）**: 由 AI 控制、自動追蹤玩家的敵對實體。
- **武器（Weapon）**: 玩家持有的攻擊道具，自動發動攻擊，最高 Lv8。
- **被動道具（Passive）**: 提升玩家單一屬性的強化道具，最高 Lv8。
- **經驗球（ExpOrb）**: 敵人死亡後掉落的拾取物，玩家靠近後自動吸收以獲得經驗值。
- **升級選項介面（LevelUpUI）**: 升級時顯示的三選一強化選單。
- **結算介面（ResultUI）**: 玩家死亡後顯示的分數與獎勵畫面。
- **裝備欄（EquipmentSlot）**: 玩家可持有的武器與被動道具欄位，武器欄上限 6 格，被動道具欄上限 6 格。
- **難度縮放器（DifficultyScaler）**: 依照遊戲時間調整敵人強度與數量的模組。
- **屬性計算器（StatCalculator）**: 依照公式計算玩家最終屬性的模組。
- **HP**: 生命值，歸零時玩家死亡。
- **MoveSpeed（移動速度）**: 玩家每秒移動的距離單位（像素/秒）。
- **AttackPower（攻擊力倍率）**: 影響最終傷害的乘數，初始值為 1.0。
- **PickupRange（拾取範圍）**: 玩家自動吸收經驗球的半徑（像素）。
- **AttackRange（攻擊範圍）**: 武器攻擊可觸及的範圍半徑（像素）。
- **AttackSpeed（攻擊速度倍率）**: 縮短武器攻擊間隔的乘數，初始值為 1.0。
- **基礎小怪（BasicEnemy）**: 標準 HP 100、標準移動速度 80 像素/秒、標準接觸傷害 10。
- **快速小怪（FastEnemy）**: HP 60、移動速度 140 像素/秒、接觸傷害 10。
- **厚血小怪（TankEnemy）**: HP 250、移動速度 50 像素/秒、接觸傷害 25。

---

## Requirements

### Requirement 1: 核心遊戲循環

**User Story:** 身為玩家，我希望體驗完整的移動、戰鬥、升級循環，以便在 5～10 分鐘內感受到成長與挑戰。

#### Acceptance Criteria

1. THE Game_System SHALL 依序執行以下循環：玩家移動 → 敵人追蹤玩家 → 武器自動攻擊 → 擊殺敵人 → 掉落 ExpOrb → 玩家吸收 ExpOrb → 累積經驗達標後升級 → 顯示 LevelUpUI → 玩家選擇強化 → 遊戲恢復 → 敵人數量與強度持續成長 → 玩家 HP 歸零後進入結算；每 30 秒觸發一次難度提升，場上敵人數量上限增加 20%，敵人 HP 與攻擊力各提升 10%。
2. WHEN 玩家 HP 歸零，THE Game_System SHALL 立即停止敵人移動、武器攻擊與遊戲計時器，並顯示 ResultUI，ResultUI 須呈現存活時間、擊殺總數與最終等級。
3. WHEN 遊戲開始，THE Game_System SHALL 在 5 秒內於距玩家 150～200 像素的畫面外位置生成至少 5 隻敵人，並使其追蹤玩家。
4. IF 第一次生成嘗試超過 5 秒期限，THEN THE Game_System SHALL 每隔 1 秒重試生成，直到成功為止。
5. WHEN 升級流程觸發，THE Game_System SHALL 立即停止敵人移動、武器攻擊與遊戲計時器；WHEN 玩家在 LevelUpUI 選擇一個選項後，THE Game_System SHALL 恢復敵人移動、武器攻擊與遊戲計時器。

---

### Requirement 2: 玩家移動

**User Story:** 身為玩家，我希望透過虛擬搖桿或方向鍵控制角色移動，以便閃避敵人並收集經驗球。

#### Acceptance Criteria

1. WHEN 玩家輸入移動指令，THE Player SHALL 依照輸入方向以最終移動速度（像素/秒）移動；對角線移動時，THE Player SHALL 將速度向量正規化，使實際移動速度等於最終移動速度，不得超過最終移動速度的 1.05 倍。
2. WHILE 玩家未輸入移動指令，THE Player SHALL 保持靜止，速度為 0 像素/秒。
3. THE Player SHALL 不得移動至地圖邊界以外；WHEN 玩家碰觸地圖邊界，THE Player SHALL 停止朝邊界方向的移動分量，但保留平行於邊界的移動分量。
4. WHEN 玩家使用虛擬搖桿輸入，THE Game_System SHALL 將搖桿偏移量映射為 8 方向或類比方向的移動向量，偏移量小於搖桿半徑 20% 時視為無輸入。

---

### Requirement 3: 核心屬性系統

**User Story:** 身為玩家，我希望角色擁有清晰的六項核心屬性，以便理解強化效果。

#### Acceptance Criteria

1. THE StatCalculator SHALL 僅使用以下六項核心屬性計算玩家最終數值：HP、MoveSpeed、AttackPower、PickupRange、AttackRange、AttackSpeed；不得引入任何其他屬性（如暴擊、護甲、吸血等）。
2. THE StatCalculator SHALL 依照以下公式計算最終屬性：最終 HP = 角色基礎 HP + 被動 HP 加成；最終移動速度 = 角色基礎移動速度 × 移動速度倍率；最終攻擊力 = 角色基礎攻擊力 × 攻擊力倍率；最終拾取範圍 = 角色基礎拾取範圍 + 拾取範圍加成；最終攻擊範圍 = 武器基礎範圍 × 攻擊範圍倍率；最終攻擊間隔 = 武器基礎攻擊間隔 ÷ 攻擊速度倍率。
3. WHEN 被動道具或武器等級變更完成時，THE StatCalculator SHALL 立即重新計算所有最終屬性。
4. IF 任何倍率（移動速度倍率、攻擊力倍率、攻擊範圍倍率、攻擊速度倍率）的值小於 0.01，THEN THE StatCalculator SHALL 將該倍率強制設為 0.01，防止除以零或負值倍率。
5. IF 任何最終屬性計算結果超出合法範圍（最終 HP 上限 999,999；最終移動速度上限 9,999 像素/秒；最終攻擊力上限 999,999；最終拾取範圍上限 9,999 像素；最終攻擊範圍上限 9,999 像素；最終攻擊間隔下限 0.05 秒），THEN THE StatCalculator SHALL 將該屬性值限制在合法範圍內。

---

### Requirement 4: 角色定義

**User Story:** 身為玩家，我希望選擇具有不同特性的角色，以便體驗不同的遊戲風格。

#### Acceptance Criteria

1. THE Game_System SHALL 為每個角色定義以下且僅以下六項屬性：基礎 HP（正整數，範圍 50～500）、基礎移動速度（正數，範圍 80～200 像素/秒）、基礎攻擊力（正數，範圍 0.5～3.0）、基礎拾取範圍（正數，範圍 50～200 像素）、初始武器（必須為遊戲內已定義的武器之一）、一個角色特性（必須為以下類型之一：屬性加成型、條件觸發型、行為修改型）。
2. THE Game_System SHALL 不為任何角色預設被動道具；角色資料結構中不得包含被動道具欄位。
3. WHEN 玩家確認角色選擇並進入遊戲場景的第一幀，THE Player SHALL 持有且僅持有該角色的初始武器，被動道具欄位為空（0 個被動道具）。
4. THE Game_System SHALL 確保每個角色的六項屬性均已定義且不為空值；IF 任何屬性缺失，THEN THE Game_System SHALL 拒絕載入該角色並記錄錯誤。

---

### Requirement 5: 武器自動攻擊

**User Story:** 身為玩家，我希望武器自動攻擊最近的敵人，以便專注於移動與升級決策。

#### Acceptance Criteria

1. WHILE 遊戲進行中且場上存在至少一隻敵人，THE Weapon SHALL 依照最終攻擊間隔（秒）自動向攻擊範圍內距離最近的敵人發動攻擊，無需玩家手動操作。
2. THE Weapon SHALL 依照以下公式計算每次攻擊的最終傷害：最終傷害 = floor(武器等級傷害 × 角色攻擊力 × 被動攻擊倍率)，結果為正整數，最小值為 1。
3. WHEN 攻擊命中敵人，THE Weapon SHALL 對敵人扣除最終傷害對應的 HP；IF 扣除後敵人 HP ≤ 0，THEN THE Enemy SHALL 立即死亡並觸發掉落流程。
4. THE Weapon SHALL 僅攻擊位於最終攻擊範圍（圓形半徑）內的敵人；IF 攻擊範圍內無敵人，THEN THE Weapon SHALL 等待下一個攻擊間隔後再次檢測，不發動攻擊。
5. WHILE 遊戲暫停（LevelUpUI 顯示中），THE Weapon SHALL 停止所有攻擊計時與攻擊行為，暫停期間不累計攻擊間隔。

---

### Requirement 6: 敵人行為

**User Story:** 身為玩家，我希望敵人持續追蹤並攻擊我，以便感受到持續的壓力與挑戰。

#### Acceptance Criteria

1. WHILE 遊戲進行中，THE Enemy SHALL 持續以其移動速度朝玩家當前位置移動，每幀更新追蹤方向。
2. WHEN 敵人碰撞體與玩家碰撞體重疊（碰撞半徑：玩家 16 像素、敵人依種類設定），THE Enemy SHALL 對玩家造成其接觸傷害值的 HP 扣除，且同一隻敵人每次接觸傷害的冷卻時間為 1 秒。
3. WHEN 敵人 HP 歸零，THE Enemy SHALL 從場上移除，並在其死亡位置生成一個 ExpOrb，ExpOrb 的經驗值依敵人種類設定。
4. WHEN 生成敵人時，THE Game_System SHALL 在距玩家 150～200 像素且位於畫面可視範圍外的位置生成敵人；IF 計算出的生成位置位於畫面可視範圍內，THEN THE Game_System SHALL 將生成位置調整至畫面邊緣外最近的合法位置。
5. WHILE 場上敵人數量未達上限（最大 100 隻），THE Game_System SHALL 依照當前生成頻率持續生成敵人；WHEN 場上敵人數量達到上限，THE Game_System SHALL 暫停生成，直到場上敵人數量低於上限。

---

### Requirement 7: 敵人種類（MVP）

**User Story:** 身為玩家，我希望面對具有不同特性的敵人，以便遊戲體驗更有變化。

#### Acceptance Criteria

1. THE Game_System SHALL 提供以下三種敵人，各項數值為難度縮放前的基礎值：基礎小怪（HP 100、移動速度 80 像素/秒、接觸傷害 10、掉落經驗值 5）；快速小怪（HP 60、移動速度 140 像素/秒、接觸傷害 10、掉落經驗值 5）；厚血小怪（HP 250、移動速度 50 像素/秒、接觸傷害 25、掉落經驗值 15）。
2. WHEN 遊戲時間處於 0～60 秒，THE DifficultyScaler SHALL 以基礎小怪 100%、快速小怪 0%、厚血小怪 0% 的比例生成敵人；WHEN 遊戲時間處於 61～120 秒，THE DifficultyScaler SHALL 以基礎小怪 70%、快速小怪 20%、厚血小怪 10% 的比例生成；WHEN 遊戲時間超過 120 秒，THE DifficultyScaler SHALL 以基礎小怪 50%、快速小怪 30%、厚血小怪 20% 的比例生成；任何時間區間的三種敵人生成比例總和必須等於 100%。

---

### Requirement 8: 難度成長

**User Story:** 身為玩家，我希望遊戲難度隨時間提升，以便保持挑戰感。

#### Acceptance Criteria

1. WHEN 遊戲開始後每經過 60 秒，THE DifficultyScaler SHALL 將所有敵人種類的基礎 HP 與基礎接觸傷害各乘以 1.10（即提升 10%），累積計算；第 N 個 60 秒後，敵人基礎 HP = 初始基礎 HP × 1.10^N，傷害同理。
2. THE Game_System SHALL 確保玩家在遊戲開始後 20 至 30 秒內完成第一次升級；為達成此目標，初始敵人生成數量與密度須使玩家在 20～30 秒內累積足夠擊殺數以達到升級所需經驗（Lv1 升 Lv2 所需經驗 = 10 + 1 × 5 = 15）。
3. WHEN 遊戲時間每增加 30 秒，THE DifficultyScaler SHALL 將敵人生成頻率提升 15%（以初始生成頻率為基準累積計算），但生成頻率提升後場上敵人數量不得超過 100 隻的上限。
4. WHILE 場上敵人數量已達 100 隻上限，THE DifficultyScaler SHALL 暫停生成頻率的實際生成行為，但繼續累計生成頻率數值；WHEN 場上敵人數量低於上限，THE DifficultyScaler SHALL 立即恢復生成。

---

### Requirement 9: 經驗球與拾取

**User Story:** 身為玩家，我希望自動吸收附近的經驗球，以便流暢地累積經驗值。

#### Acceptance Criteria

1. WHEN ExpOrb 與玩家的距離小於或等於玩家最終拾取範圍（像素），THE Player SHALL 自動吸收該 ExpOrb，ExpOrb 從場上移除，玩家獲得該 ExpOrb 對應的經驗值。
2. WHEN 玩家吸收 ExpOrb，THE Game_System SHALL 將獲得的經驗值累加至當前經驗值；IF 累加後當前經驗值 ≥ 升下一級所需經驗，THEN THE Game_System SHALL 立即觸發升級流程。
3. WHEN ExpOrb 進入拾取範圍但尚未被吸收，THE ExpOrb SHALL 以每幀向玩家位置移動的磁吸動畫呈現，移動速度為 200 像素/秒，直到被吸收為止。
4. THE Game_System SHALL 為各敵人種類設定固定的 ExpOrb 經驗值：基礎小怪掉落 5 點、快速小怪掉落 5 點、厚血小怪掉落 15 點；IF 玩家當前等級已達等級上限（Lv20），THEN THE Game_System SHALL 不再累加經驗值，ExpOrb 仍可被吸收但不產生效果。

---

### Requirement 10: 升級與經驗公式

**User Story:** 身為玩家，我希望透過明確的升級公式成長，以便預期升級節奏。

#### Acceptance Criteria

1. THE Game_System SHALL 依照以下公式計算升下一級所需經驗：升下一級所需經驗 = 10 + 目前等級 × 5；玩家初始等級為 1，升下一級（Lv1→Lv2）所需經驗為 15。
2. WHEN 玩家當前累積經驗值 ≥ 升下一級所需經驗，THE Game_System SHALL 觸發升級流程；升級後，THE Game_System SHALL 將當前經驗值減去升級所需經驗（保留溢出經驗），並將等級加 1。
3. WHEN 升級流程觸發，THE Game_System SHALL 立即暫停遊戲（停止敵人移動、武器攻擊計時器、遊戲計時器），並顯示 LevelUpUI，LevelUpUI 須呈現 3 個隨機選取的升級選項。
4. WHEN 玩家在 LevelUpUI 點選一個選項，THE Game_System SHALL 套用該選項效果（可透過查詢玩家屬性或裝備欄驗證效果已套用），並恢復遊戲（重啟敵人移動、武器攻擊計時器、遊戲計時器）。
5. WHEN 玩家等級達到 Lv20，THE Game_System SHALL 不再觸發升級流程，LevelUpUI 不再顯示；玩家繼續遊戲直到 HP 歸零。

---

### Requirement 11: 升級選項規則

**User Story:** 身為玩家，我希望升級時出現合理的三個選項，以便做出有意義的強化決策。

#### Acceptance Criteria

1. THE LevelUpUI SHALL 每次顯示恰好 3 個升級選項，選項類型僅限：新武器（玩家未持有且非初始武器）、已持有武器升級（等級未達 Lv8）、新被動道具（玩家未持有）、已持有被動道具升級（等級未達 Lv8）。
2. THE LevelUpUI SHALL 不將玩家初始武器作為新武器選項顯示，即使玩家裝備欄有空位。
3. THE LevelUpUI SHALL 不將玩家已持有的武器作為新武器選項顯示。
4. WHEN 玩家武器欄（6 格）與被動道具欄（6 格）均已滿，THE LevelUpUI SHALL 完全不顯示任何新武器或新被動道具選項，僅從已持有且等級未達 Lv8 的裝備中隨機選取升級選項。
5. WHEN 玩家武器欄或被動道具欄存在空位，THE LevelUpUI SHALL 將新武器與新被動道具納入可選池，與已持有裝備升級選項一同隨機抽取。
6. THE LevelUpUI SHALL 不顯示已達 Lv8 上限的武器或被動道具升級選項；達 Lv8 的裝備從可選池中移除。
7. IF 可用選項總數不足 3 個，THEN THE LevelUpUI SHALL 顯示所有可用選項（可能少於 3 個），不重複顯示同一選項，不以空白或佔位符填充。

---

### Requirement 12: 武器與被動等級上限

**User Story:** 身為玩家，我希望武器與被動道具有明確的等級上限，以便了解強化的邊界。

#### Acceptance Criteria

1. THE Weapon SHALL 從 Lv1 開始，最高升至 Lv8；WHEN 武器等級達到 Lv8，THE LevelUpUI SHALL 將該武器從升級選項池中移除，不再顯示其升級選項。
2. THE Passive SHALL 從 Lv1 開始，最高升至 Lv8；WHEN 被動道具等級達到 Lv8，THE LevelUpUI SHALL 將該被動道具從升級選項池中移除，不再顯示其升級選項。
3. IF 玩家嘗試對已達 Lv8 的武器或被動道具進行升級（例如透過異常狀態），THEN THE Game_System SHALL 忽略該升級操作，等級保持 Lv8 不變。

---

### Requirement 13: 被動道具系統（MVP）

**User Story:** 身為玩家，我希望透過被動道具強化單一屬性，以便針對性地提升角色能力。

#### Acceptance Criteria

1. THE Game_System SHALL 提供以下六種被動道具，每種僅影響一項屬性，每級提升量固定：迅捷步（每級移動速度倍率 +0.10，Lv1 倍率 1.10、Lv8 倍率 1.80）；生命玉（每級最大 HP 加成 +50，Lv1 加成 50、Lv8 加成 400）；破勢印（每級攻擊力倍率 +0.15，Lv1 倍率 1.15、Lv8 倍率 2.05）；引靈珠（每級拾取範圍加成 +20 像素，Lv1 加成 20、Lv8 加成 160）；擴脈符（每級攻擊範圍倍率 +0.10，Lv1 倍率 1.10、Lv8 倍率 1.80）；急攻令（每級攻擊速度倍率 +0.15，Lv1 倍率 1.15、Lv8 倍率 2.05）。
2. THE Passive SHALL 不產生複合屬性效果；每個被動道具的效果計算僅修改其對應的單一屬性參數，不得同時修改其他屬性。
3. WHEN 被動道具等級提升，THE StatCalculator SHALL 在升級選項套用後的同一幀內重新計算受影響的最終屬性，玩家可立即感受到屬性變化。

---

### Requirement 14: 死亡結算

**User Story:** 身為玩家，我希望死亡後看到本局成績與獎勵，以便了解自己的表現。

#### Acceptance Criteria

1. WHEN 玩家 HP 歸零，THE ResultUI SHALL 在遊戲停止後的同一幀內顯示以下資訊：存活時間（格式：MM:SS）、擊殺數（整數）、最高等級（整數）、結算分數（整數）、獲得金幣（整數）。
2. WHEN ResultUI 顯示，THE Game_System SHALL 依照以下公式計算結算分數：結算分數 = 擊殺數 × 10 + 存活秒數 × 2 + 最高等級 × 50；計算結果為非負整數。
3. WHEN ResultUI 顯示，THE Game_System SHALL 依照以下公式計算獲得金幣：獲得金幣 = floor(結算分數 ÷ 10)；計算結果為非負整數。
4. THE ResultUI SHALL 提供「返回主選單」的操作按鈕；WHEN 玩家點擊該按鈕，THE Game_System SHALL 清除本局所有遊戲狀態（玩家屬性、裝備、敵人、ExpOrb）並返回主選單畫面。

---

### Requirement 15: MVP 範圍外項目

**User Story:** 身為開發者，我希望明確定義 MVP 不包含的功能，以便控制開發範圍。

#### Acceptance Criteria

1. THE Game_System SHALL 不實作以下功能，這些功能明確排除於 MVP 範圍之外：30 分鐘完整關卡、永久升級系統、完整存檔系統、Boss 敵人、多地圖、音效系統、課金機制、廣告系統、轉蛋系統、暴擊屬性、護甲屬性、吸血屬性、閃避屬性、幸運屬性、免死屬性、複合全屬性被動道具、回復機制、雙重攻擊機制。
2. IF 上述任何排除功能在開發過程中被意外實作，THEN THE Game_System SHALL 要求將其從程式碼庫中完整移除，不允許以停用、隱藏或條件編譯方式保留。
3. THE Game_System SHALL 不實作跨局次的持久化存檔；MVP 中獲得的金幣僅在 ResultUI 顯示，不寫入任何持久化儲存；WHEN 玩家返回主選單，本局金幣數據隨遊戲狀態一同清除。
