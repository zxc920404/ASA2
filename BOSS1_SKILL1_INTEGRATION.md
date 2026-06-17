# 三當家霸山墜（Boss1 Skill1）動畫整合報告

## 完成時間
2025-01-XX

## 修改檔案
1. `src/scenes/GameScene.ts`（spawnLeapSlam 方法，lines 2117-2332）

## 技術實作摘要

### 1. 動畫素材確認 ✅
- **素材位置**：`public/assets/sprites/enemies/Level_1/boss1/skill1/`
- **幀數**：13 幀（1.png ~ 13.png）
- **資產載入**：已在 `AssetLoader.ts` lines 174-186 完成
- **動畫建立**：已在 `GameScene.ts` lines 3651-3665 完成
- **動畫 key**：`boss1_skill1`（10 fps, no repeat）

### 2. 技能流程設計

#### 原邏輯（Timer-based）
- 使用固定 timer（1100ms）控制技能時間軸
- 用 scale tween 模擬跳起與落地
- 落地時瞬移到落點並觸發傷害

#### 新邏輯（Animation-based）
使用 Phaser 動畫事件監聽實現幀級精準同步：

| 幀範圍 | 視覺狀態 | 技能效果 |
|--------|---------|---------|
| 第 1-2 幀 | Boss 在地面，起跳蓄力 | 預警圈出現並閃爍 |
| 第 3-8 幀 | **Boss 隱藏**（setVisible(false)） | 只顯示預警圈，表示 Boss 在空中 |
| **第 9 幀** | **Boss 重新出現在落點** | **觸發傷害、擊退、衝擊波、螢幕震動** |
| 第 10-13 幀 | Boss 在落點，收招動作 | 不再造成傷害 |

### 3. 核心實作要點

#### A. 動畫幀監聽
```typescript
// 監聽動畫幀更新
spr.on(Phaser.Animations.Events.ANIMATION_UPDATE, onAnimUpdate);

// 第 3-8 幀隱藏 Boss
if (frameIndex >= 2 && frameIndex <= 7) {
  spr.setVisible(false);
}

// 第 9 幀：落地 + 傷害觸發
if (frameIndex === 8 && !hasImpacted) {
  hasImpacted = true;  // 防止重複傷害
  // 瞬移到落點、顯示 Boss、觸發傷害...
}
```

#### B. 傷害觸發保證
- 使用 `hasImpacted` flag 確保傷害只觸發一次
- 在第 9 幀（frameIndex === 8）觸發
- 傷害觸發條件：
  - 遊戲未暫停（`!isPaused`）
  - Boss 未死亡（`!isDying`）
  - 玩家在範圍內（`dist <= SLAM_RADIUS + 14`）

#### C. Boss 隱藏與重現
- **隱藏**：第 3 幀開始（frameIndex >= 2），使用 `setVisible(false)`
- **重現**：第 9 幀（frameIndex === 8），使用：
  1. `elite.setPosition(landX, landY)` - 瞬移到落點
  2. `syncVisual()` - 同步視覺物件位置
  3. `spr.setVisible(true)` - 顯示 Boss

#### D. 預警圈管理
- **顯示**：技能開始時建立 Graphics 物件
- **閃爍**：使用 tween（alpha: 0.4, yoyo, repeat: -1）
- **清除**：第 9 幀落地時銷毀（`warnG.destroy()`）

#### E. 清理與中斷處理
實作 `cleanup()` 函式統一處理所有退出路徑：
- 遊戲暫停（`isPaused`）
- Boss 死亡（`isDying`）
- 場景切換（`isGameOver`、`isVictory`）
- 動畫意外中斷

清理內容：
- 停止預警圈 tween
- 銷毀預警圈 Graphics
- 恢復 Boss 可見性與 scale
- 恢復移動動畫（`boss1_walk`）
- 結束技能施放狀態（`shieldEndCast()`）

### 4. Fallback 機制

保留舊版 timer-based 邏輯作為 fallback：
```typescript
if (!(eliteVisual instanceof Phaser.GameObjects.Sprite) || 
    !this.anims.exists('boss1_skill1')) {
  // 使用舊版 timer-based 邏輯
  this.time.delayedCall(900, () => { ... });
  return;
}
```

**觸發條件**：
- Boss 不是 Sprite（Graphics fallback）
- `boss1_skill1` 動畫不存在（資產載入失敗）

### 5. 技能參數調整

| 參數 | 舊版 | 新版 | 說明 |
|------|------|------|------|
| SLAM_RADIUS | 130~160（隨機） | 150（固定） | 統一傷害半徑，避免動畫與範圍不一致 |
| 落地時間 | 1100ms（固定） | 動畫第 9 幀（約 900ms） | 由動畫時間軸決定 |
| 擊退距離 | 110px | 180px | 增強擊退效果 |
| 螢幕震動 | 無 | 120ms, 強度 0.006 | 新增落地震動效果 |
| scale tween | 0.7x → 1.3x（起跳/落地） | 移除 | 由動畫本身呈現 |

### 6. 技能效果同步

#### 第 9 幀同步觸發：
1. ✅ **Boss 瞬移到落點中心**（`elite.setPosition(landX, landY)`）
2. ✅ **Boss 重新顯示**（`spr.setVisible(true)`）
3. ✅ **預警圈消失**（`warnG.destroy()`）
4. ✅ **落地衝擊波出現**（橘紅色圓圈，alpha 淡出）
5. ✅ **螢幕震動**（`cameras.main.shake(120, 0.006)`）
6. ✅ **傷害判定**（範圍內玩家扣血）
7. ✅ **擊退效果**（180px 徑向擊退）

### 7. 遵循專案規範

#### Section 11: 角色與 Boss 視覺尺寸規則
- ✅ 使用 `visualBaseScaleX/Y` 記錄基準 scale
- ✅ 所有 scale 恢復使用 `setScale(bsx, bsy)` 而非硬寫 `setScale(1)`
- ✅ 動畫切換後恢復基準 scale（`onAnimComplete` 中）
- ✅ 所有退出路徑（暫停/死亡/中斷）都恢復 Boss 尺寸

#### 最小必要修改原則
- ✅ 只修改 `spawnLeapSlam()` 方法
- ✅ 未修改 Boss 系統其他部分
- ✅ 未修改其他技能（震撼咆哮、連續重擊）
- ✅ 未修改 Boss 狀態管理（`shieldCasting` flag）
- ✅ 保留現有傷害計算與冷卻機制

### 8. 測試檢查清單

請測試以下場景：

#### 基本功能
- [ ] Boss 施放霸山墜時播放 `boss1_skill1` 動畫
- [ ] 第 1-2 幀：Boss 在地面，預警圈出現
- [ ] 第 3-8 幀：Boss 隱藏，只顯示預警圈
- [ ] 第 9 幀：Boss 在落點重新出現
- [ ] 第 9 幀：傷害只觸發一次（不重複扣血）
- [ ] 第 9 幀：預警圈消失
- [ ] 第 9 幀：衝擊波、擊退、螢幕震動同步觸發
- [ ] 第 10-13 幀：Boss 收招，不再造成傷害
- [ ] 動畫結束後恢復 `boss1_walk` 動畫

#### 視覺一致性
- [ ] Boss 施放技能前尺寸正常
- [ ] Boss 施放技能後尺寸正常（不變大或變小）
- [ ] Boss 重新出現時位置在預警圈中心
- [ ] Boss 隱藏期間不閃爍或出現異常

#### 中斷處理
- [ ] Boss 在技能期間死亡：正確清理，不殘留預警圈
- [ ] 玩家在技能期間升級（暫停）：正確暫停，恢復後繼續
- [ ] 玩家在技能期間死亡（Game Over）：正確清理
- [ ] 遊戲勝利時 Boss 正在施放技能：正確清理

#### Fallback 測試
- [ ] 刪除 boss1_skill1 資產後，使用舊版 timer-based 邏輯
- [ ] Boss 使用 Graphics fallback 時不崩潰

### 9. 效能注意事項

- 每次霸山墜只建立一組動畫監聽器（`onAnimUpdate`、`onAnimComplete`）
- 動畫結束時正確移除監聽器（避免記憶體洩漏）
- 預警圈 tween 正確停止並銷毀（避免殘留動畫）
- 衝擊波 Graphics 淡出後自動銷毀（不累積物件）

### 10. 已知限制

1. **動畫幀率固定**：目前設定為 10 fps，總時長 1.3 秒
   - 如需調整技能節奏，修改 `createEnemyAnimations()` 中的 `frameRate`
2. **落地幀固定為第 9 幀**：如果動畫素材調整，需同步修改 `IMPACT_FRAME` 常數
3. **Fallback 邏輯時間軸不同**：無動畫素材時使用 900ms 固定時間，與動畫版略有差異

---

## 回答使用者問題

### 1. 修改了哪些檔案？
只修改了 `src/scenes/GameScene.ts` 中的 `spawnLeapSlam()` 方法（lines 2117-2332）。

### 2. boss1_skill1 是否成功建立？
是，動畫已在 `GameScene.createEnemyAnimations()` 中建立（lines 3651-3665）。

### 3. 霸山墜是否已經播放 skill1 動畫？
是，在 `spawnLeapSlam()` 方法最後呼叫 `spr.play('boss1_skill1')`。

### 4. Boss 是否會在第 3-8 幀左右暫時隱藏？
是，使用 `spr.setVisible(false)` 在第 3-8 幀隱藏 Boss。

### 5. Boss 是否會在落地幀回到預警圈中心重新出現？
是，在第 9 幀使用 `elite.setPosition(landX, landY)` 瞬移到落點，並用 `spr.setVisible(true)` 重新顯示。

### 6. 傷害是否只在落地幀觸發一次？
是，使用 `hasImpacted` flag 確保傷害只在第 9 幀觸發一次。

### 7. 預警圈、震波、擊退、螢幕震動是否和落地幀同步？
是，所有效果都在第 9 幀的 `onAnimUpdate` 回呼中觸發。

### 8. 是否有修改其他 Boss 技能或 Boss 系統流程？
沒有，只修改了霸山墜技能，其他技能（震撼咆哮、連續重擊）與 Boss 系統保持不變。

### 9. 是否需要執行 npm run build 測試？
已執行，build 成功，產出檔案：
- `dist/assets/index-Da7x589_.js` (237.84 kB)
- `dist/assets/phaser-0RJB29YE.js` (1,478.57 kB)

---

## 建議後續測試

1. 啟動遊戲，進入戰鬥場景
2. 等待三當家 Boss 生成
3. 觀察 Boss 施放霸山墜技能
4. 確認動畫播放流暢
5. 確認 Boss 在第 3-8 幀隱藏
6. 確認第 9 幀落地時：
   - Boss 重新出現在預警圈中心
   - 傷害只觸發一次
   - 衝擊波、擊退、螢幕震動同步
7. 確認技能結束後 Boss 尺寸正常
8. 測試中斷場景（暫停、死亡、升級）

如果測試發現問題，請提供：
- 問題現象描述
- 發生時機（技能第幾幀）
- 瀏覽器 console 錯誤訊息（如有）
