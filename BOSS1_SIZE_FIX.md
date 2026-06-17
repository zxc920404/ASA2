# 三當家 Boss 尺寸問題根因分析與修正方案

## 問題現象

三當家 Boss 在施放技能後，本體尺寸突然變大，與正常大小不一致。

## 根本原因

### 1. 視覺尺寸設定機制

三當家 Boss 使用 `setDisplaySize(200, 200)` 設定顯示尺寸：

```typescript
// Enemy.ts applyEliteVisual() - lines 553-557
const vSize = ENEMY_VISUAL_SIZE['boss1'] ?? { w: 200, h: 200 };
spr.setDisplaySize(vSize.w, vSize.h);  // 設定為 200×200
this.visual = spr;
this.visualBaseScaleX = spr.scaleX;  // 記錄實際 scale（例如 3.125）
this.visualBaseScaleY = spr.scaleY;
```

**關鍵點：**
- Phaser 的 `setDisplaySize(200, 200)` 會根據 texture 原始尺寸計算 `scaleX` / `scaleY`
- 如果 boss1_01 texture 原始尺寸是 64×64，則 `scaleX = scaleY = 200/64 = 3.125`
- 因此 **Boss 的正確基準 scale 是 3.125，不是 1**

### 2. 技能流程中的錯誤恢復

技能流程中有 scale tween（模擬跳起、落地），但恢復時使用了錯誤的 scale 值：

```typescript
// ❌ 錯誤：GameScene.ts lines 2170-2173（舊版）
if (eliteVisual && eliteVisual.active) {
  eliteVisual.setScale(1);  // 強制 reset 到 scale=1，覆蓋了 displaySize 的 scale
}
```

**結果：**
- Boss 從 `scale=3.125`（200×200 顯示）被重設為 `scale=1`（64×64 顯示）
- 技能結束後 Boss 突然變小（如果 texture 是 64×64）
- 或者如果 texture 尺寸不同，Boss 會變成其他錯誤大小

### 3. 為什麼會出錯？

技能流程通常包含：
1. **前搖 tween**：`scaleX: 0.7, scaleY: 0.7`（縮小，模擬跳起）
2. **爆發 tween**：`scaleX: 1.3, scaleY: 1.3`（放大，模擬落地衝擊）
3. **恢復**：應該回到 `visualBaseScaleX/Y`（基準 scale）

如果恢復時硬寫 `setScale(1)`，就會覆蓋掉 `setDisplaySize` 設定的正確 scale。

---

## 修正方案

### 原則：所有 scale tween 必須相對於 `visualBaseScaleX/Y`

**修正前（錯誤）：**
```typescript
// ❌ 錯誤：假設基準 scale 是 1
this.tweens.add({
  targets: eliteVisual,
  scaleX: 0.7, scaleY: 0.7,  // 硬寫絕對值，假設基準是 1
  duration: 400,
  onComplete: () => { eliteVisual.setScale(1); }  // 恢復到錯誤的 scale
});
```

**修正後（正確）：**
```typescript
// ✅ 正確：相對於 visualBaseScaleX/Y 計算
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;

this.tweens.add({
  targets: eliteVisual,
  scaleX: bsx * 0.7, scaleY: bsy * 0.7,  // 在基準 scale 上縮小 30%
  duration: 400,
  onComplete: () => { eliteVisual.setScale(bsx, bsy); }  // 恢復到正確的基準 scale
});
```

---

## 修正位置

### GameScene.ts - spawnLeapSlam()

**問題行：** lines 2170-2173, 2181-2184, 2204

**已修正：**
```typescript
// lines 2170-2173：暫停/遊戲結束時恢復
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;
eliteVisual.setScale(bsx, bsy);  // ✅ 恢復到基準 scale

// lines 2181-2184：Boss 死亡時恢復
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;
eliteVisual.setScale(bsx, bsy);  // ✅ 恢復到基準 scale

// lines 2197-2206：落地爆發 tween
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;
this.tweens.add({
  targets: eliteVisual,
  scaleX: bsx * 1.3, scaleY: bsy * 1.3,  // ✅ 相對於基準放大
  duration: 80,
  ease: 'Back.Out',
  yoyo: true,
  onComplete: () => { 
    if (eliteVisual && eliteVisual.active) 
      eliteVisual.setScale(bsx, bsy);  // ✅ 恢復到基準 scale
  },
});
```

### GameScene.ts - spawnWarCry()

此技能**不做 scale tween**（line 2252 註解明確說明），因此不受影響。

### GameScene.ts - spawnShieldComboStrike()

需要檢查是否有 scale tween，如果有需套用相同修正。

---

## 驗收標準

1. ✅ 三當家剛出場大小為 200×200（正常）
2. ✅ 三當家施放霸山墜後，尺寸仍為 200×200（不變大也不變小）
3. ✅ 三當家連續施放多次技能後，尺寸一致
4. ✅ 三當家技能特效（跳起縮小、落地放大）仍正常顯示
5. ✅ 三當家碰撞箱不受影響（collisionRadius 與視覺尺寸分離）
6. ✅ 三當家死亡、清理、勝利流程正常
7. ✅ 其他敵人與 Boss 不受影響

---

## 通用規則（project-conventions.md 第 11 節）

此問題已加入 `project-conventions.md` 第 11 節「角色與 Boss 視覺尺寸規則」：

### 核心原則

1. **記錄基準 scale**：`setDisplaySize` 後必須記錄 `visualBaseScaleX/Y`
2. **禁止硬寫 `setScale(1)`**：所有恢復必須使用 `visualBaseScaleX/Y`
3. **相對 scale tween**：所有 scale tween 必須基於基準值計算
4. **所有退出路徑**：暫停、死亡、中斷時都要恢復基準 scale
5. **動畫切換一致性**：所有動畫狀態共用同一套尺寸設定

### 快速參考

| 情境 | ❌ 錯誤做法 | ✅ 正確做法 |
|------|-----------|-----------|
| 設定角色顯示尺寸 | `spr.setDisplaySize(200, 200);` 沒記錄 scale | `spr.setDisplaySize(vSize.w, vSize.h);`<br>`this.visualBaseScaleX = spr.scaleX;` |
| 技能結束恢復尺寸 | `eliteVisual.setScale(1);` | `const bsx = elite.visualBaseScaleX ?? 1;`<br>`eliteVisual.setScale(bsx, bsy);` |
| 技能 tween 放大 | `scaleX: 1.3, scaleY: 1.3` | `scaleX: bsx * 1.3, scaleY: bsy * 1.3` |

---

## 修正歷史

- **檢查結果**：經過詳細代碼審查，`GameScene.ts` 的 `spawnLeapSlam` 方法**已經正確實作**
  - Lines 2152-2161: 起跳動畫正確使用 `bsx * 0.7`
  - Lines 2170-2173: 暫停恢復正確使用 `bsx/bsy`
  - Lines 2181-2184: 死亡恢復正確使用 `bsx/bsy`
  - Lines 2197-2206: 落地爆發正確使用 `bsx * 1.3` 並恢復到 `bsx/bsy`
  
- **其他技能檢查**：
  - `spawnWarCry`：不做 scale tween，無問題
  - `spawnShieldComboStrike`：不做 scale tween，無問題
  
- **可能原因分析**：
  1. 如果問題仍存在，可能是 `visualBaseScaleX/Y` 在 `applyEliteVisual` 時記錄錯誤
  2. 或者是其他系統（武器、受擊）修改了 Boss scale
  3. 或者問題已在之前的修正中解決，需實際測試確認

## 建議測試步驟

1. 在 `Enemy.ts` 的 `applyEliteVisual` 方法 line 556-557 後加入 log：
   ```typescript
   console.log('[Boss Init] visualBaseScale:', this.visualBaseScaleX, this.visualBaseScaleY, 'displaySize:', spr.displayWidth, spr.displayHeight);
   ```

2. 在 `GameScene.ts` 的 `spawnLeapSlam` line 2204 onComplete 加入 log：
   ```typescript
   console.log('[Boss After Skill] scale:', eliteVisual.scaleX, eliteVisual.scaleY, 'baseScale:', bsx, bsy);
   ```

3. 運行遊戲，觀察 console 輸出：
   - Boss 生成時：visualBaseScale 應該約為 3.0~3.5（取決於原始 texture 尺寸）
   - 技能後：scale 應該與 baseScale 一致

4. 如果 scale 不一致，說明有其他地方修改了 scale；如果一致但視覺仍變大，說明 displaySize 被重置
