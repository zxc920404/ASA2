# 武器圖示整合完成報告

## 變更摘要

已成功整合 8 個武器圖示至升級 UI 和 HUD 武器欄顯示系統。

## 修改檔案

### 1. `src/utils/AssetLoader.ts`
- 在 `preloadMenuAssets()` 方法中新增 8 個武器圖示載入
- 使用實際存在於 `public/assets/icons/weapons/` 的中文檔名
- Texture key 命名規範：`weapon_<拼音>_<類型>`

載入的圖示：
```typescript
AssetLoader.loadImage(scene, 'weapon_shouxin_ring',     'assets/icons/weapons/守心環.png');
AssetLoader.loadImage(scene, 'weapon_jifeng_blade',     'assets/icons/weapons/疾風刃.png');
AssetLoader.loadImage(scene, 'weapon_chiyan_seal',      'assets/icons/weapons/赤焰印.png');
AssetLoader.loadImage(scene, 'weapon_hanbing_spike',    'assets/icons/weapons/寒冰錐.png');
AssetLoader.loadImage(scene, 'weapon_leiting_claw',     'assets/icons/weapons/雷霆爪.png');
AssetLoader.loadImage(scene, 'weapon_duwu_powder',      'assets/icons/weapons/毒霧散.png');
AssetLoader.loadImage(scene, 'weapon_liuguang_shuttle', 'assets/icons/weapons/流光梭.png');
AssetLoader.loadImage(scene, 'weapon_zhuihun_needle',   'assets/icons/weapons/追魂針.png');
```

### 2. `src/data/weapons.ts`
- 更新 8 個基礎武器的 `iconKey` 欄位，從舊命名 `weapon_icon_*` 改為新命名 `weapon_*`

| 武器 ID | 中文名稱 | 舊 iconKey | 新 iconKey |
|---------|---------|-----------|-----------|
| guardian_ring | 守心環 | weapon_icon_guardian_ring | weapon_shouxin_ring |
| swift_blade | 疾風刃 | weapon_icon_swift_blade | weapon_jifeng_blade |
| flame_seal | 赤焰印 | weapon_icon_flame_seal | weapon_chiyan_seal |
| ice_spike | 寒冰錐 | weapon_icon_ice_spike | weapon_hanbing_spike |
| thunder_claw | 雷霆爪 | weapon_icon_thunder_claw | weapon_leiting_claw |
| poison_mist | 毒霧散 | weapon_icon_poison_mist | weapon_duwu_powder |
| light_shuttle | 流光梭 | weapon_icon_light_shuttle | weapon_liuguang_shuttle |
| soul_chasing_needle | 追魂針 | weapon_icon_soul_chasing_needle | weapon_zhuihun_needle |

### 3. 未修改檔案（已驗證正確實作）
- `src/ui/LevelUpPanel.ts`：已正確使用 `getWeaponById(option.id)?.iconKey` 取得武器圖示
- `src/ui/HUD.ts`：已正確使用 `getWeaponById(ws.weaponId)?.iconKey` 取得武器圖示
- `src/types/index.ts`：已定義 `WeaponData.iconKey?: string` 欄位

兩個 UI 元件均使用 `AssetLoader.hasTexture(scene, iconKey)` 檢查圖示是否存在，若不存在則優雅降級至文字顯示。

## 圖示顯示位置

### 升級面板（LevelUpPanel）
- 當玩家升級時顯示三選一面板
- 武器選項卡片會顯示對應的武器圖示（若圖示已載入）
- 圖示尺寸：橫屏 28×28px，直屏 26×26px
- 位置：卡片頂部中央

### HUD 武器欄
- 遊戲過程中持續顯示已裝備武器
- 最多顯示 4 個武器格
- 每個武器格顯示：圖示 + 等級（Lv X）
- 圖示尺寸：橫屏 14×14px，直屏 26×26px
- 位置：橫屏左側，直屏上方

## 進化武器圖示狀態

目前兩個進化武器保留舊的 iconKey 命名：
- `ice_spike_evolved`：`weapon_icon_ice_spike_evolved`
- `swift_blade_evolved`：`weapon_icon_swift_blade_evolved`

原因：`public/assets/icons/weapons/` 資料夾內未提供進化武器圖示檔案。
若未來新增進化武器圖示，需同步更新 `AssetLoader.ts` 載入邏輯和 `weapons.ts` 的 iconKey。

## 驗收結果

### 建置成功
```
✓ 46 modules transformed.
dist/assets/index-CEkXYjup.js     234.74 kB │ gzip:  61.32 kB
✓ built in 6.63s
```

打包尺寸變化：232.71 kB → 234.74 kB（+2.03 kB，新增 8 個圖示載入邏輯）

### TypeScript 診斷
- `AssetLoader.ts`：無錯誤
- `weapons.ts`：無錯誤
- `LevelUpPanel.ts`：無錯誤
- `HUD.ts`：無錯誤

### 優雅降級機制
- 若圖示檔案不存在或載入失敗，UI 會自動降級至文字顯示
- 不會出現 missing texture、black square 或遊戲崩潰

## 測試建議

1. **升級面板測試**：
   - 開始遊戲，升級時檢查三選一面板
   - 驗證武器選項卡片是否顯示正確圖示
   - 嘗試選擇不同武器，確認圖示與名稱對應

2. **HUD 武器欄測試**：
   - 裝備不同武器後，檢查左側（橫屏）或上方（直屏）武器欄
   - 驗證圖示是否清晰可見
   - 確認等級文字（Lv X）正確顯示

3. **圖示資源測試**：
   - 如果圖示檔案移除或路徑錯誤，應該降級至文字顯示而不崩潰
   - 檢查瀏覽器控制台是否有 404 錯誤（正常情況下不應有）

## 技術細節

### 載入時機
- 武器圖示在 `CharacterSelectScene.preload()` 階段載入（`preloadMenuAssets()`）
- 與宗門圖示同批次載入，不阻塞遊戲啟動
- 在玩家進入 GameScene 前已完成載入

### 命名規範
- Texture key：`weapon_<拼音>_<類型>`（英文，用於程式碼引用）
- 檔案路徑：`assets/icons/weapons/<中文名稱>.png`（中文，實際檔案系統）
- 此設計允許程式碼使用英文 key，同時保持檔案系統友好命名

### 相容性
- 所有圖示載入均使用 `AssetLoader.loadImage()`，若檔案不存在會觸發 load error 但不崩潰
- `AssetLoader.hasTexture()` 會排除 `__MISSING` texture 和尺寸過小（< 8px）的圖片
- 確保在任何情況下 UI 都不會出現 undefined texture 錯誤

## 後續工作（可選）

1. **進化武器圖示**：
   - 若設計師提供進化武器圖示，檔名建議：
     - `霜裂冰錐.png`（ice_spike_evolved）
     - `流光返刃.png`（swift_blade_evolved）
   - 更新 `AssetLoader.ts` 載入
   - 更新 `weapons.ts` iconKey

2. **被動道具圖示**：
   - `public/assets/icons/passives/` 資料夾目前空白
   - 若未來新增被動道具圖示，比照武器圖示流程整合

3. **圖示尺寸優化**：
   - 目前圖示在 HUD 武器欄中縮放至 14×14px（橫屏）
   - 若原始圖示過大（如 512×512px），建議提供 64×64px 版本減少記憶體佔用

---

**變更類型**：資產整合  
**影響範圍**：升級 UI、HUD 武器欄  
**破壞性變更**：無  
**向下相容**：是（圖示不存在時優雅降級至文字顯示）
