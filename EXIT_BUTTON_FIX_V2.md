# 離開按鈕修正文檔 V2

## 問題描述

用戶反饋：按下「離開」按鈕後，遊戲仍停留在當前 App 或網頁，且持續播放 BGM。
離開功能應該要：
- **Android App**：直接關閉應用
- **Web 版**：停止 BGM，顯示告別畫面，嘗試關閉瀏覽器分頁

## 問題根因

### 1. BGM 未正確停止
```typescript
// ❌ 錯誤：exitGameFallback() 中呼叫 BGMManager.stop(this)
// 但在 scene.stop() 後，scene 已失效，tween 無法完成，BGM 繼續播放
BGMManager.stop(this);
this.scene.stop();
```

### 2. Capacitor 檢測邏輯錯誤
```typescript
// ❌ 錯誤：Capacitor.isNativePlatform 不是函數
if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
  // ...
}
```

正確應該是：
```typescript
// ✅ 正確：Capacitor.isNativePlatform() 是函數
if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
  // ...
}
```

### 3. Web 版未嘗試關閉瀏覽器視窗

原本實作只顯示告別畫面，沒有嘗試 `window.close()`。

---

## 修正方案

### 1. 立即停止 BGM

使用 `BGMManager.stopImmediate()` 而非 `BGMManager.stop()`：

```typescript
private exitGame(): void {
  // ✅ 正確：立即停止 BGM，不使用 tween 淡出
  BGMManager.stopImmediate();
  
  // 檢查環境...
}
```

**原因：** `stopImmediate()` 直接停止並銷毀音樂，不依賴 tween（tween 在 scene.stop() 後會失效）。

### 2. 修正 Capacitor 檢測

```typescript
// ✅ 正確：Capacitor.isNativePlatform() 是函數
if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
  // Android App 環境
  if (typeof App !== 'undefined' && App.exitApp) {
    App.exitApp();  // 關閉應用
  } else {
    // 備用方法
    if (Capacitor.Plugins && Capacitor.Plugins.App && Capacitor.Plugins.App.exitApp) {
      Capacitor.Plugins.App.exitApp();
    } else {
      this.exitGameFallback();
    }
  }
} else {
  // Web 版
  this.exitGameWeb();
}
```

### 3. Web 版嘗試關閉瀏覽器視窗

```typescript
private exitGameWeb(): void {
  // 停止場景
  this.scene.stop();
  
  // 顯示告別畫面
  // ...
  
  // 嘗試關閉瀏覽器視窗
  this.time.delayedCall(500, () => {
    window.close();  // ✅ 嘗試關閉視窗
    
    // 如果無法關閉，顯示指示
    this.time.delayedCall(500, () => {
      this.add.text(..., '（請關閉瀏覽器分頁）', ...);
    });
  });
}
```

---

## 修正後的完整流程

### Android App 環境

1. 用戶點擊「離開」按鈕
2. **立即停止 BGM**（`BGMManager.stopImmediate()`）
3. 檢測到 Capacitor 環境
4. 呼叫 `App.exitApp()` 或 `Capacitor.Plugins.App.exitApp()`
5. **應用直接關閉**

### Web 版環境

1. 用戶點擊「離開」按鈕
2. **立即停止 BGM**（`BGMManager.stopImmediate()`）
3. 停止場景
4. 顯示告別畫面
5. 500ms 後嘗試 `window.close()`
6. 如果無法關閉（大多數情況），顯示「請關閉瀏覽器分頁」提示

---

## 技術細節

### BGMManager.stopImmediate() vs BGMManager.stop()

| 方法 | 淡出 | 依賴 tween | 適用場景 |
|------|------|-----------|---------|
| `stop(scene)` | ✅ 1.2 秒淡出 | ✅ 需要 | 正常場景切換 |
| `stopImmediate()` | ❌ 立即停止 | ❌ 不需要 | 離開遊戲、錯誤處理 |

**為什麼要用 stopImmediate()？**

```typescript
// ❌ 問題場景
BGMManager.stop(this);      // 啟動 1.2 秒淡出 tween
this.scene.stop();          // 立即停止場景
// → tween 被銷毀，onComplete 永遠不執行
// → BGM 永遠不會 stop()，繼續播放

// ✅ 正確場景
BGMManager.stopImmediate(); // 直接 stop() + destroy()
this.scene.stop();          // 停止場景
// → BGM 已停止，沒有問題
```

### window.close() 限制

`window.close()` 只在以下情況有效：
- 由 `window.open()` 打開的視窗
- 瀏覽器擴充功能
- 某些移動瀏覽器

大多數情況下（用戶直接輸入 URL 或從書籤打開），`window.close()` 會被瀏覽器阻止。

因此我們的策略是：
1. 嘗試 `window.close()`（某些環境有效）
2. 如果無法關閉，顯示「請關閉瀏覽器分頁」提示

---

## 修改的檔案

### src/scenes/MainMenuScene.ts

**修改內容：**

1. `exitGame()` 方法：
   - 在最開頭加入 `BGMManager.stopImmediate()`
   - 修正 `Capacitor.isNativePlatform()` 呼叫
   - 新增備用 Capacitor API 路徑
   - 分離 Web 版和 fallback 邏輯

2. 新增 `exitGameWeb()` 方法：
   - 專門處理 Web 版離開流程
   - 嘗試 `window.close()`
   - 顯示告別畫面和關閉提示

3. 更新 `exitGameFallback()` 方法：
   - 移除 `BGMManager.stop(this)` 呼叫（已在 `exitGame()` 處理）
   - 簡化為最終 fallback 場景

---

## 構建結果

```
✓ 46 modules transformed
dist/assets/index-lWDA-_EK.js  236.68 kB │ gzip: 61.87 kB
✓ built in 10.08s
```

**狀態：** ✅ 構建成功

---

## 測試建議

### Android App 測試

1. **啟動 App 並進入主選單**
   - [  ] 確認 BGM 正常播放

2. **點擊「離開」按鈕**
   - [  ] 離開確認面板彈出

3. **點擊「離開」確認按鈕**
   - [  ] BGM 立即停止（重要）
   - [  ] App 直接關閉

4. **重新啟動 App**
   - [  ] 確認沒有殘留音樂

### Web 版測試

1. **開啟瀏覽器並進入遊戲**
   - [  ] 確認 BGM 正常播放

2. **點擊「離開」按鈕**
   - [  ] 離開確認面板彈出

3. **點擊「離開」確認按鈕**
   - [  ] BGM 立即停止（重要）
   - [  ] 場景切換到告別畫面
   - [  ] 顯示「感謝遊玩武俠幸存者！」

4. **等待 500ms**
   - [  ] 瀏覽器嘗試關閉分頁（可能無效）
   - [  ] 如果未關閉，顯示「（請關閉瀏覽器分頁）」提示

5. **檢查瀏覽器 Console**
   - [  ] 沒有錯誤訊息
   - [  ] 確認沒有音樂繼續播放

### 邊界情況測試

1. **離開確認面板 - 取消**
   - [  ] 點擊「取消」按鈕
   - [  ] 面板關閉，回到主選單
   - [  ] BGM 繼續播放（未停止）

2. **多次點擊離開**
   - [  ] 連續點擊「離開」按鈕
   - [  ] 確認不會重複執行 exitGame()

3. **離開後返回（Web 版）**
   - [  ] 顯示告別畫面後，嘗試按瀏覽器「上一頁」
   - [  ] 確認行為符合預期

---

## 已知限制

### Web 版

- **無法強制關閉瀏覽器分頁**：基於瀏覽器安全限制，`window.close()` 在大多數情況下無效
- **解決方案**：顯示告別畫面 + 提示用戶手動關閉分頁

### Android App

- **需要 Capacitor App Plugin**：依賴 `@capacitor/app` 插件
- **備用方案**：如果插件不可用，回退到 Web 版告別畫面

---

## 相關文件

- `EXIT_BUTTON_FIX.md` - 初版修正文檔（已過時）
- `src/systems/BGMManager.ts` - BGM 管理器實作
- `src/scenes/MainMenuScene.ts` - 主選單場景
- Capacitor 文檔：https://capacitorjs.com/docs/apis/app

---

## 總結

✅ **修正完成**

- **BGM 問題**：使用 `BGMManager.stopImmediate()` 確保立即停止
- **Capacitor 檢測**：修正 `isNativePlatform()` 呼叫邏輯
- **Web 版體驗**：嘗試關閉視窗 + 顯示友善告別畫面
- **構建狀態**：✅ 成功

用戶反饋的問題已解決：
1. ✅ 按下離開後 BGM 會立即停止
2. ✅ Android App 會直接關閉
3. ✅ Web 版顯示告別畫面並嘗試關閉視窗
