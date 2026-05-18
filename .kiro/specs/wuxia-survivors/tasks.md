# Implementation Plan: 武俠幸存者（wuxia-survivors）

## Overview

以 Phaser 3 + TypeScript + Vite 建構武俠風格 2D 生存遊戲 MVP。
實作順序從專案骨架開始，逐步加入 Scene 流程、資料層、玩家移動、敵人、武器、升級、HUD、結算、手機適配，最後收斂效能限制。
每個任務完成後均可獨立執行 `npm run build` 成功。

---

## Tasks

- [x] 1. 建立 Vite + TypeScript + Phaser 基礎專案
  - 使用 `npm create vite` 建立 TypeScript 專案骨架
  - 安裝 `phaser@3` 依賴
  - 建立 `src/main.ts`：初始化 Phaser.Game，設定 800×450 畫布、WebGL renderer
  - 建立 `src/scenes/BootScene.ts`：空白 Scene，作為進入點
  - 設定 `vite.config.ts`，確保打包輸出至 `dist/`
  - 建立 `index.html` 引入打包後的 JS
  - _需求：Requirement 1（核心遊戲循環基礎）_

- [x] 2. 建立 Scene 流程
  - 建立 `src/scenes/MainMenuScene.ts`：顯示遊戲標題與「開始遊戲」按鈕，點擊後切換至 CharacterSelectScene
  - 建立 `src/scenes/CharacterSelectScene.ts`：讀取 `characters.ts` 顯示角色列表，確認後以 `{ characterId }` 切換至 GameScene
  - 建立 `src/scenes/GameScene.ts`：接收 `characterId`，顯示佔位文字「遊戲場景」
  - 在 `src/main.ts` 中將三個 Scene 加入 Phaser.Game 的 scene 陣列
  - _需求：Requirement 1.1、Requirement 4.3_

- [x] 3. 建立資料檔案
  - 建立 `src/data/characters.ts`：定義 `CharacterData` 介面與 3 個角色（劍客、刺客、道士），各自設定 baseHP、baseMoveSpeed、baseAttackPower、basePickupRange、startingWeaponId、trait
  - 建立 `src/data/weapons.ts`：定義 `WeaponData` 介面與 6 種武器（守心環、疾風刃、赤焰印、寒冰錐、雷霆爪、毒霧散），各含 8 級傷害陣列、攻擊間隔、攻擊範圍、投射物速度
  - 建立 `src/data/passives.ts`：定義 `PassiveData` 介面與 6 種被動（迅捷步、生命玉、破勢印、引靈珠、擴脈符、急攻令）
  - 建立 `src/data/enemies.ts`：定義 `EnemyData` 介面與 3 種敵人（basic、fast、tank）
  - 建立 `src/types/index.ts`：匯出所有共用介面（`CharacterData`、`WeaponData`、`PassiveData`、`EnemyData`、`PlayerStats`、`EquipmentSlot`、`UpgradeOption`、`DifficultyState`、`GameResult`）
  - _需求：Requirement 4、Requirement 7、Requirement 12、Requirement 13_

- [x] 4. 建立玩家移動
  - 建立 `src/objects/Player.ts`：繼承 `Phaser.GameObjects.Rectangle`（佔位圖形），持有 `characterId`、`currentHP`、`level`、`currentExp`、`equipment`、`stats`
  - 在 `GameScene` 中建立 `Player` 實例，設定初始位置於畫面中央
  - 在 `GameScene.update()` 中讀取 WASD 鍵盤輸入，計算正規化移動向量，套用最終移動速度
  - 實作邊界限制：玩家不得超出 `[0, 0, worldWidth, worldHeight]` 範圍
  - 建立 `src/systems/StatCalculator.ts`：純函式 `calculateStats(char, equipment)`，依公式計算六項最終屬性，含安全下限與上限
  - _需求：Requirement 2.1、Requirement 2.2、Requirement 2.3、Requirement 3.2、Requirement 3.4、Requirement 3.5_

- [x] 5. 建立敵人生成與追蹤
  - 建立 `src/objects/Enemy.ts`：繼承 `Phaser.GameObjects.Rectangle`，持有 `dataId`、`currentHP`、`lastDamageTime`
  - 在 `GameScene` 中建立敵人群組（`Phaser.GameObjects.Group`），實作 `spawnEnemy()` 方法：在距玩家 150～200px 的畫面外隨機位置生成敵人
  - 在 `GameScene.update()` 中讓每隻敵人每幀朝玩家位置移動
  - 實作接觸傷害：敵人與玩家重疊時，每 1 秒扣除玩家 HP
  - 建立 `src/systems/DifficultyScaler.ts`：依遊戲時間計算 `DifficultyState`（HP 倍率、傷害倍率、生成間隔、生成比例）
  - 遊戲開始 5 秒內生成至少 5 隻敵人
  - _需求：Requirement 1.3、Requirement 6.1、Requirement 6.2、Requirement 6.4、Requirement 6.5、Requirement 7.2、Requirement 8.1、Requirement 8.3_

- [x] 6. 建立初始武器自動攻擊
  - 建立 `src/objects/Projectile.ts`：繼承 `Phaser.GameObjects.Rectangle`，持有傷害值、速度向量、存活時間
  - 建立 `src/systems/WeaponSystem.ts`：管理玩家所有武器，每 250ms 快取最近敵人，依攻擊間隔自動發射投射物
  - 實作三種初始武器行為：守心環（環繞型）、疾風刃（直線投射）、赤焰印（範圍爆炸）
  - 投射物命中敵人後扣血，依 `finalDamage = max(1, floor(levelDamage × attackPower × passiveMultiplier))` 計算
  - 在 `GameScene` 中整合 `WeaponSystem`，暫停時停止攻擊計時
  - _需求：Requirement 5.1、Requirement 5.2、Requirement 5.3、Requirement 5.4、Requirement 5.5_

- [x] 7. 建立敵人死亡與經驗球
  - 建立 `src/objects/XPGem.ts`：繼承 `Phaser.GameObjects.Rectangle`，持有 `expValue`
  - 敵人 HP ≤ 0 時從場上移除，在死亡位置生成 `XPGem`
  - 在 `GameScene.update()` 中檢測 XPGem 與玩家距離，進入拾取範圍後以 200px/s 磁吸移動
  - 玩家吸收 XPGem 後累加經驗值，達標時觸發升級流程（暫時僅加等級，LevelUpUI 在 Task 8 實作）
  - 更新 `GameScene` 的擊殺計數器
  - _需求：Requirement 6.3、Requirement 9.1、Requirement 9.2、Requirement 9.3、Requirement 9.4_

- [x] 8. 建立屬性計算與升級三選一
  - 建立 `src/systems/UpgradePool.ts`：依規則篩選合法升級選項（排除初始武器、排除已持有武器作為新武器、排除 Lv8 裝備、裝備欄滿時不顯示新裝備），回傳最多 3 個 `UpgradeOption`
  - 建立 `src/systems/LevelUpSystem.ts`：監聽升級事件，呼叫 `UpgradePool` 取得選項，暫停遊戲，顯示升級 UI
  - 建立 `src/ui/LevelUpPanel.ts`：Phaser DOM 或 Graphics 實作三選一面板，顯示選項名稱與效果描述
  - 玩家選擇後套用效果（更新 `equipment`），呼叫 `StatCalculator` 重新計算屬性，恢復遊戲
  - 等級達 Lv20 後不再觸發升級
  - _需求：Requirement 10.1、Requirement 10.2、Requirement 10.3、Requirement 10.4、Requirement 10.5、Requirement 11.1～11.7、Requirement 12.1～12.3、Requirement 13.3_

- [x] 9. 建立 HUD 與暫停
  - 建立 `src/ui/HUD.ts`：使用 Phaser Text 物件顯示 HP 條、EXP 條、等級（Lv）、存活計時器（MM:SS）、擊殺數
  - HUD 文字每 250ms 更新一次（使用計時器，不每幀重繪）
  - 在畫面右上角加入暫停按鈕，點擊後暫停遊戲（停止敵人移動、武器攻擊、計時器）並顯示「已暫停」提示
  - 再次點擊恢復遊戲
  - _需求：Requirement 1.2、Requirement 1.5_

- [x] 10. 建立死亡與結算
  - 建立 `src/ui/GameOverPanel.ts`：玩家 HP 歸零時顯示結算面板
  - 面板顯示：存活時間（MM:SS）、擊殺數、最高等級、結算分數（`kills×10 + seconds×2 + maxLevel×50`）、獲得金幣（`floor(score/10)`）
  - 提供「返回主選單」按鈕，點擊後清除遊戲狀態並切換至 `MainMenuScene`
  - _需求：Requirement 1.2、Requirement 14.1、Requirement 14.2、Requirement 14.3、Requirement 14.4_

- [x] 11. 手機橫向基本適配
  - 在 `index.html` 加入 `<meta name="viewport">` 設定，強制橫向顯示
  - 建立 `src/ui/VirtualJoystick.ts`：觸控搖桿，偏移量 < 搖桿半徑 20% 視為無輸入，輸出 8 方向或類比移動向量
  - 在 `GameScene` 中整合虛擬搖桿輸入（與 WASD 並存）
  - 偵測螢幕方向：直向時在畫面中央顯示「請旋轉手機至橫向」提示，隱藏遊戲畫面
  - 確保所有 UI 元素距畫面邊緣至少 20px（安全區域）
  - _需求：Requirement 2.4_

- [x] 12. 效能限制與 MVP 驗收
  - 在 `GameScene` 中加入物件數量上限檢查：敵人上限 80、投射物上限 100、經驗球上限 80
  - 超過上限時：敵人暫停生成；投射物移除最舊的；經驗球移除最舊的
  - 確認 `WeaponSystem` 最近敵人搜尋快取為每 250ms 一次
  - 確認 `HUD` 文字更新為每 250ms 一次
  - 執行 `npm run build`，確認打包成功無錯誤
  - _需求：Requirement 6.5、Requirement 8.4（效能設計層面調整為 80）_

---

## MVP UI 設計規格

> 所有 UI 元素定位一律使用 `this.scale.width` / `this.scale.height` 動態計算，禁止寫死 800×450 或任何固定像素座標。
> 觸控目標最小尺寸：寬 88px × 高 88px（符合 Android 觸控建議）。
> 安全邊距：所有 UI 元素距畫面邊緣至少 20px。
> 基準版面：手機橫向（Landscape），長邊為寬、短邊為高。

---

### 1. MainMenuScene

**版面配置（橫向）**

```
┌─────────────────────────────────────────┐
│                                         │
│         武俠幸存者（遊戲標題）            │  ← 垂直置中偏上 40%
│                                         │
│           ┌──────────────┐              │
│           │   開始遊戲   │              │  ← 垂直置中偏下 60%
│           └──────────────┘              │
│                                         │
└─────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 |
|---|---|---|---|
| 遊戲標題文字 | `x: W×0.5, y: H×0.38` | 字型 48px，置中對齊 | 顯示遊戲名稱 |
| 「開始遊戲」按鈕 | `x: W×0.5, y: H×0.60` | 寬 200px、高 60px，觸控區 min 88px | 點擊後切換至 CharacterSelectScene |

---

### 2. CharacterSelectScene

**版面配置（橫向）**

```
┌─────────────────────────────────────────┐
│  選擇角色（標題）                         │  ← y: H×0.12
│                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │ 劍客   │  │ 刺客   │  │ 道士   │    │  ← y: H×0.45，三欄均分
│  │ 名稱   │  │ 名稱   │  │ 名稱   │    │
│  │ 特性   │  │ 特性   │  │ 特性   │    │
│  └────────┘  └────────┘  └────────┘    │
│                                         │
│              ┌──────────┐               │
│              │  確認選擇 │               │  ← y: H×0.82
│              └──────────┘               │
└─────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 |
|---|---|---|---|
| 標題文字「選擇角色」 | `x: W×0.5, y: H×0.12` | 字型 32px，置中 | 場景標題 |
| 角色卡片（×3） | `x: W×0.22 / 0.50 / 0.78, y: H×0.45` | 寬 `W×0.22`、高 `H×0.50`，觸控區 min 88×88px | 顯示角色名稱、基礎屬性摘要、角色特性；點擊後高亮選中 |
| 角色名稱文字 | 卡片內 `y: 卡片頂 + H×0.06` | 字型 22px，置中 | 顯示角色名稱 |
| 角色特性文字 | 卡片內 `y: 卡片頂 + H×0.16` | 字型 14px，置中，換行 | 顯示角色特性描述（單行截斷） |
| 「確認選擇」按鈕 | `x: W×0.5, y: H×0.82` | 寬 200px、高 60px，觸控區 min 88px | 確認後傳入 `characterId` 切換至 GameScene；未選角色時呈灰色不可點擊 |

---

### 3. GameScene HUD

**版面配置（橫向）**

```
┌─────────────────────────────────────────┐
│ [HP條]          [Lv] [EXP條]   [⏸ 暫停] │  ← y: H×0.04～0.10（頂部橫條）
│                                         │
│                                         │
│              （遊戲畫面）                │
│                                         │
│                                         │
│ [虛擬搖桿]                  [擊殺數][時間]│  ← 底部左右角
└─────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 | 更新頻率 |
|---|---|---|---|---|
| HP 條（背景） | `x: W×0.02, y: H×0.04` | 寬 `W×0.25`、高 12px | HP 條底色（深紅） | 每 250ms |
| HP 條（前景） | 同上，寬度依 `currentHP/maxHP` 縮放 | 高 12px，綠色 | 顯示當前 HP 比例 | 每 250ms |
| HP 數值文字 | `x: W×0.02, y: H×0.09` | 字型 13px | 顯示 `HP: 120/200` | 每 250ms |
| 等級文字 | `x: W×0.50, y: H×0.04` | 字型 18px，置中 | 顯示 `Lv 5` | 每 250ms |
| EXP 條（背景） | `x: W×0.38, y: H×0.09` | 寬 `W×0.24`、高 8px | EXP 條底色（深藍） | 每 250ms |
| EXP 條（前景） | 同上，寬度依 `currentExp/requiredExp` 縮放 | 高 8px，亮藍色 | 顯示當前經驗進度 | 每 250ms |
| 暫停按鈕 | `x: W×0.96, y: H×0.06` | 寬 60px、高 60px，觸控區 88×88px | 點擊暫停遊戲，顯示 PausePanel | 常駐 |
| 存活計時器 | `x: W×0.96, y: H×0.92` | 字型 16px，右對齊 | 顯示 `03:42`（MM:SS） | 每 250ms |
| 擊殺數 | `x: W×0.84, y: H×0.92` | 字型 16px，右對齊 | 顯示 `擊殺: 87` | 每 250ms |
| 虛擬搖桿底座 | `x: W×0.14, y: H×0.75` | 半徑 60px，觸控區 120×120px | 搖桿底座（半透明圓形） | 常駐（手機模式） |
| 虛擬搖桿旋鈕 | 跟隨觸控偏移，最大偏移 60px | 半徑 28px | 顯示搖桿方向 | 每幀（觸控時） |

> HUD 所有文字與條狀元素設定 `setScrollFactor(0)` 固定於畫面座標，不隨攝影機移動。

---

### 4. LevelUpPanel

**版面配置（橫向，全螢幕半透明遮罩）**

```
┌─────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← 半透明黑色遮罩（alpha 0.7）
│░░░░  升級！選擇強化  ░░░░░░░░░░░░░░░░░░░│  ← y: H×0.18
│░░░░                  ░░░░░░░░░░░░░░░░░░│
│░░  ┌──────────┐  ┌──────────┐  ┌──────────┐  ░░│  ← y: H×0.50（三欄）
│░░  │ 選項 A   │  │ 選項 B   │  │ 選項 C   │  ░░│
│░░  │ 名稱     │  │ 名稱     │  │ 名稱     │  ░░│
│░░  │ 效果描述 │  │ 效果描述 │  │ 效果描述 │  ░░│
│░░  │ Lv X→Y  │  │ Lv X→Y  │  │ 新裝備   │  ░░│
│░░  └──────────┘  └──────────┘  └──────────┘  ░░│
└─────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 |
|---|---|---|---|
| 半透明遮罩 | `x: 0, y: 0`，覆蓋全畫面 | `W × H`，alpha 0.7，黑色 | 遮蔽遊戲畫面，強調升級選單 |
| 標題文字「升級！選擇強化」 | `x: W×0.5, y: H×0.18` | 字型 28px，置中，金色 | 提示玩家選擇 |
| 選項卡片（×1～3） | `x: W×0.22 / 0.50 / 0.78, y: H×0.50` | 寬 `W×0.22`、高 `H×0.48`，觸控區 min 88×88px | 顯示升級選項；可用選項少於 3 個時僅顯示實際數量，不補空白 |
| 選項名稱文字 | 卡片內 `y: 卡片頂 + H×0.05` | 字型 18px，置中，白色 | 武器或被動道具名稱 |
| 效果描述文字 | 卡片內 `y: 卡片頂 + H×0.14` | 字型 13px，置中，淺灰色，自動換行 | 說明效果（例：「攻擊力倍率 +0.15」） |
| 等級標示文字 | 卡片內 `y: 卡片底 - H×0.07` | 字型 13px，置中，黃色 | 顯示 `Lv 3 → 4` 或 `新裝備` |

---

### 5. PausePanel

**版面配置（橫向，全螢幕半透明遮罩）**

```
┌─────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░  已暫停  ░░░░░░░░░░░░░░░░░░░░│  ← y: H×0.38
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░  ┌──────────────┐  ░░░░░░░░░░░│
│░░░░░░░░  │   繼續遊戲   │  ░░░░░░░░░░░│  ← y: H×0.55
│░░░░░░░░  └──────────────┘  ░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 |
|---|---|---|---|
| 半透明遮罩 | `x: 0, y: 0`，覆蓋全畫面 | `W × H`，alpha 0.6，黑色 | 遮蔽遊戲畫面 |
| 「已暫停」文字 | `x: W×0.5, y: H×0.38` | 字型 36px，置中，白色 | 提示暫停狀態 |
| 「繼續遊戲」按鈕 | `x: W×0.5, y: H×0.55` | 寬 200px、高 60px，觸控區 min 88px | 點擊後關閉 PausePanel，恢復遊戲 |

---

### 6. GameOverPanel

**版面配置（橫向，全螢幕半透明遮罩）**

```
┌─────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░  遊戲結束  ░░░░░░░░░░░░░░░░░░│  ← y: H×0.12
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░  存活時間: 04:32   擊殺數: 143  ░░░░░│  ← y: H×0.30
│░░  最高等級: Lv 12                ░░░░░│  ← y: H×0.42
│░░  結算分數: 2,894   獲得金幣: 289 ░░░░│  ← y: H×0.54
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░  ┌──────────────┐  ░░░░░░░░░░░│
│░░░░░░░░  │  返回主選單  │  ░░░░░░░░░░░│  ← y: H×0.76
│░░░░░░░░  └──────────────┘  ░░░░░░░░░░░│
└─────────────────────────────────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 |
|---|---|---|---|
| 半透明遮罩 | `x: 0, y: 0`，覆蓋全畫面 | `W × H`，alpha 0.8，黑色 | 遮蔽遊戲畫面 |
| 「遊戲結束」標題 | `x: W×0.5, y: H×0.12` | 字型 40px，置中，紅色 | 死亡提示 |
| 存活時間 | `x: W×0.28, y: H×0.30` | 字型 20px，左對齊 | 顯示 `存活時間: MM:SS` |
| 擊殺數 | `x: W×0.72, y: H×0.30` | 字型 20px，左對齊 | 顯示 `擊殺數: N` |
| 最高等級 | `x: W×0.28, y: H×0.42` | 字型 20px，左對齊 | 顯示 `最高等級: Lv N` |
| 結算分數 | `x: W×0.28, y: H×0.54` | 字型 20px，左對齊 | 顯示 `結算分數: N`（`kills×10 + seconds×2 + maxLevel×50`） |
| 獲得金幣 | `x: W×0.72, y: H×0.54` | 字型 20px，左對齊，金色 | 顯示 `獲得金幣: N`（`floor(score/10)`） |
| 「返回主選單」按鈕 | `x: W×0.5, y: H×0.76` | 寬 220px、高 60px，觸控區 min 88px | 點擊後清除遊戲狀態，切換至 MainMenuScene |

---

### 7. PortraitWarning（直向警告）

**版面配置（直向時全螢幕顯示）**

```
┌──────────────┐
│              │
│   🔄         │
│  請旋轉手機  │  ← 垂直置中
│  至橫向繼續  │
│  遊戲        │
│              │
└──────────────┘
```

| 元素 | 位置 | 尺寸 / 字型 | 用途 |
|---|---|---|---|
| 黑色背景 | `x: 0, y: 0`，覆蓋全畫面 | `W × H`，黑色 | 完全遮蔽遊戲畫面 |
| 旋轉圖示文字 | `x: W×0.5, y: H×0.38` | 字型 48px，置中 | 視覺提示（使用 Unicode 符號 ⟳ 或文字） |
| 提示文字 | `x: W×0.5, y: H×0.55` | 字型 22px，置中，白色，自動換行 | 顯示「請旋轉手機至橫向繼續遊戲」 |

> 偵測方式：監聽 `window.addEventListener('orientationchange')` 或比較 `window.innerWidth < window.innerHeight`。直向時顯示 PortraitWarning 並暫停遊戲計時器；恢復橫向後隱藏並恢復遊戲。

---

### UI 通用規則

| 規則 | 說明 |
|---|---|
| 動態定位 | 所有座標使用 `this.scale.width`（W）與 `this.scale.height`（H）計算，禁止寫死數值 |
| 觸控目標 | 所有可點擊元素的觸控熱區最小 88×88px（視覺尺寸可小於此值，但互動區域不得小於） |
| 安全邊距 | 所有 UI 元素距畫面四邊至少 20px |
| 固定於畫面 | HUD、Panel 類元素一律 `setScrollFactor(0)`，不隨攝影機捲動 |
| 遮罩層級 | 遮罩 depth 設為 100，Panel 內容 depth 設為 101，確保覆蓋遊戲物件 |
| 字型 | 使用 Phaser 內建 BitmapText 或 `this.add.text()`，不依賴外部字型檔案 |

---

## Notes

- 所有任務均不包含測試（依使用者指示）
- 每個任務完成後均可獨立執行 `npm run build` 成功
- MVP 明確不做項目：永久升級、存檔、音效、Boss、多地圖、課金、廣告、轉蛋、暴擊、護甲、吸血、閃避、幸運、免死
- 效能上限依設計文件設為 80（敵人）/ 100（投射物）/ 80（經驗球），優先確保 Android WebView 流暢度

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6", "7"] },
    { "id": 5, "tasks": ["8", "9"] },
    { "id": 6, "tasks": ["10", "11"] },
    { "id": 7, "tasks": ["12"] }
  ]
}
```
