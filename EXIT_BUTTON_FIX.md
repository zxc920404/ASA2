# 主選單離開按鈕修正報告

## 問題描述

主選單的「✕ 離開」按鈕無法正確結束程式關閉遊戲。

## 原因分析

### 原有實作問題

1. **離開確認面板誤導性文字**：
   - 顯示「感謝遊玩武俠幸存者！願你武道長進，再見！」
   - 給使用者錯覺已離開遊戲

2. **確認按鈕功能錯誤**：
   - 按鈕標籤為「返回主選單」
   - 實際行為只是關閉確認面板（`closeExit()`）
   - 沒有執行任何離開遊戲的邏輯

3. **缺少平台區分**：
   - Web 版無法關閉瀏覽器視窗（瀏覽器安全限制）
   - Android App 版應呼叫 Capacitor App.exitApp()
   - 原實作未區分兩種情況

## 修正方案

### 1. 離開確認對話框重新設計

**修改前**：
- 單一「返回主選單」按鈕
- 誤導性的告別訊息

**修改後**：
- 明確詢問「確定要離開遊戲嗎？」
- 兩個按鈕：「取消」和「離開」
- 面板尺寸調整：360×190px，按鈕橫向排列

### 2. 離開邏輯實作

新增兩個私有方法：

#### `exitGame()` - 離開遊戲入口

```typescript
private exitGame(): void {
  // 檢查是否在 Capacitor App 環境
  if (typeof Capacitor !== 'undefined' && 
      Capacitor.isNativePlatform && 
      Capacitor.isNativePlatform()) {
    
    // Android App：呼叫原生 API 關閉應用
    if (typeof App !== 'undefined' && App.exitApp) {
      App.exitApp();  // 關閉 Android 應用
    } else {
      this.exitGameFallback();  // 降級處理
    }
  } else {
    // Web 版：顯示告別畫面
    this.exitGameFallback();
  }
}
```

#### `exitGameFallback()` - Web 版離開處理

```typescript
private exitGameFallback(): void {
  // 停止 BGM
  BGMManager.stop(this);
  
  // 停止當前場景
  this.scene.stop();
  
  // 建立全螢幕告別畫面
  const W = this.scale.width;
  const H = this.scale.height;
  
  // 黑色背景
  const bg = this.add.graphics().setDepth(100);
  bg.fillStyle(0x020810, 1);
  bg.fillRect(0, 0, W, H);
  
  // 告別訊息
  this.add.text(W * 0.5, H * 0.42, '感謝遊玩武俠幸存者！',
    uiTitle(32, '#ffd700')
  ).setOrigin(0.5, 0.5).setDepth(101);
  
  this.add.text(W * 0.5, H * 0.56, 
    '願你武道長進，再見！\n\n（請關閉瀏覽器分頁）',
    uiText(14, '#d4af37', { align: 'center', lineSpacing: 6 })
  ).setOrigin(0.5, 0.5).setDepth(101);
}
```

### 3. 平台偵測邏輯

使用 Capacitor 全域 API 判斷執行環境：

```typescript
// 檢查 Capacitor 是否存在
typeof Capacitor !== 'undefined'

// 檢查是否為原生平台（Android/iOS）
Capacitor.isNativePlatform && Capacitor.isNativePlatform()

// 檢查 App 插件是否可用
typeof App !== 'undefined' && App.exitApp
```

### 4. TypeScript 相容性

使用 `@ts-ignore` 註解處理 Capacitor 全域變數：
- Capacitor 在 Web 版不存在，但在 App 版由 Capacitor 運行時注入
- TypeScript 無法靜態分析全域變數，需要忽略類型檢查
- 使用 `typeof` 檢查確保運行時安全

## 修改檔案

- `src/scenes/MainMenuScene.ts`
  - 修改 `buildExitPanel()` 方法（新增取消/離開雙按鈕）
  - 新增 `exitGame()` 方法（平台檢測與離開邏輯）
  - 新增 `exitGameFallback()` 方法（Web 版告別畫面）

## 驗收結果

### 建置成功

```
✓ 46 modules transformed.
dist/assets/index-BfPwjtYx.js     235.83 kB │ gzip:  61.63 kB
✓ built in 8.30s
```

打包尺寸變化：234.74 kB → 235.83 kB（+1.09 kB，新增離開邏輯）

### TypeScript 診斷

- `MainMenuScene.ts`：無錯誤

### 功能測試

#### Web 版（瀏覽器）測試步驟：

1. 開啟主選單
2. 點擊「✕ 離開」按鈕
3. 出現確認對話框：「確定要離開遊戲嗎？」
4. 點擊「離開」按鈕
5. **預期行為**：
   - BGM 停止播放
   - 場景停止運作
   - 顯示全螢幕告別訊息：
     - 主標題：「感謝遊玩武俠幸存者！」
     - 副標題：「願你武道長進，再見！」
     - 提示：「（請關閉瀏覽器分頁）」
6. 手動關閉瀏覽器分頁完成離開

#### Android App 版測試步驟：

1. 開啟主選單
2. 點擊「✕ 離開」按鈕
3. 出現確認對話框：「確定要離開遊戲嗎？」
4. 點擊「離開」按鈕
5. **預期行為**：
   - 應用程式直接關閉（呼叫 `App.exitApp()`）
   - Android 返回桌面或應用切換畫面

#### 取消功能測試：

1. 開啟主選單
2. 點擊「✕ 離開」按鈕
3. 出現確認對話框
4. 點擊「取消」按鈕
5. **預期行為**：
   - 對話框關閉
   - 返回主選單
   - BGM 繼續播放

## 技術細節

### Web 版限制

Web 應用無法呼叫 `window.close()` 關閉非腳本開啟的視窗（安全限制）：
- 只能關閉由 `window.open()` 開啟的視窗
- 使用者主動開啟的分頁無法被腳本關閉
- 因此採用「停止遊戲 + 顯示告別訊息」方案

### Capacitor App API

Android App 版使用 Capacitor 的 `@capacitor/app` 插件：
- `App.exitApp()` 方法關閉 Android 應用
- 在 Capacitor 運行時環境中，插件會注入全域變數
- 使用 `typeof` 檢查確保 API 可用性

### 建置相容性

避免使用動態 import：
- ❌ `import('@capacitor/app')` 會導致 Vite 建置失敗（無法解析模組）
- ✅ 使用全域變數檢查 + `@ts-ignore` 註解

### 告別畫面設計

- 全螢幕黑色背景（0x020810，深藍黑色）
- 金色標題（#ffd700）32px
- 金棕色副標題（#d4af37）14px
- depth 100-101 確保覆蓋所有 UI 元素
- 文字置中對齊，行距 6px

## 使用者體驗改進

### 修改前問題：

1. ❌ 點擊「離開」後仍停留在主選單
2. ❌ 顯示「感謝遊玩」但遊戲未關閉，造成困惑
3. ❌ 按鈕標籤「返回主選單」名不符實
4. ❌ 無法在 Android App 版正常關閉應用

### 修改後改進：

1. ✅ 明確的確認對話框（「確定要離開遊戲嗎？」）
2. ✅ 取消/離開雙按鈕，防止誤操作
3. ✅ Web 版：顯示告別畫面並停止遊戲
4. ✅ Android 版：直接關閉應用
5. ✅ 使用者意圖清晰，操作結果符合預期

## 後續建議

1. **iOS 版測試**：
   - 若未來支援 iOS，需測試 `App.exitApp()` 在 iOS 的行為
   - iOS 可能有不同的應用生命週期限制

2. **告別畫面優化**（可選）：
   - 新增淡入動畫（tween alpha 0→1）
   - 新增裝飾元素（粒子效果、邊框裝飾）
   - 顯示遊戲統計（總遊玩時間、最高紀錄等）

3. **快捷鍵支援**（可選）：
   - ESC 鍵呼叫離開確認
   - Enter 鍵確認離開
   - ESC 鍵取消離開

4. **Android 返回鍵處理**：
   - 監聽 Android 實體返回鍵（`App.addListener('backButton')`）
   - 主選單按返回鍵時呼叫離開確認對話框

---

**修正類型**：功能修復  
**影響範圍**：主選單離開按鈕  
**破壞性變更**：無  
**使用者體驗**：改善（明確的離開流程，符合預期行為）
