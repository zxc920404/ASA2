/**
 * ResponsiveLayout — 通用手機 UI 適配工具（直屏 Portrait 版）
 *
 * 支援各種 Android / iOS 手機直屏比例：
 *   9:16  (720×1280, 1080×1920)
 *   9:18  (720×1440, 1080×2160)
 *   9:19.5 (1080×2340)
 *   9:20  (1080×2400)
 *   9:21  (1080×2520)
 *   含瀏海 / 挖孔 / 圓角 / 手勢導航列
 *
 * 使用方式：
 *   const layout = ResponsiveLayout.compute(this.scale.width, this.scale.height);
 *   const { W, H, safeLeft, safeRight, safeTop, safeBottom, uiScale } = layout;
 */

export type AspectClass = 'compact' | 'normal' | 'ultrawide';

export interface LayoutMetrics {
  /** 畫布寬度 */
  W: number;
  /** 畫布高度 */
  H: number;
  /** 寬高比（直屏時 < 1） */
  aspectRatio: number;
  /** 比例分類 */
  aspectClass: AspectClass;

  // ── Safe area padding（px）──────────────────────────────────────────
  safeLeft: number;
  safeRight: number;
  /** 上方安全邊距（含瀏海/挖孔補償） */
  safeTop: number;
  /** 下方安全邊距（含手勢導航列補償） */
  safeBottom: number;

  // ── UI 縮放 ──────────────────────────────────────────────────────────
  /**
   * 統一 UI 縮放係數（直屏以寬度為主要基準）
   * clamp 在 0.70 ~ 1.10 之間
   * 360px 寬手機 ≈ 1.0，414px 寬手機 ≈ 1.05
   */
  uiScale: number;

  // ── 常用計算值 ────────────────────────────────────────────────────────
  usableW: number;
  usableH: number;
  usableX: number;
  usableY: number;
  centerX: number;
  centerY: number;

  // ── 按鈕尺寸建議 ─────────────────────────────────────────────────────
  btnH: number;
  minTouchTarget: number;

  // ── 直屏專用 ─────────────────────────────────────────────────────────
  /** 是否為直屏模式（H > W） */
  isPortrait: boolean;
}

/**
 * 從 CSS env(safe-area-inset-*) 讀取實際系統安全邊距（px）
 * 在 Android windowTranslucentStatus 模式下，這會反映真實的瀏海/狀態列高度
 * 若瀏覽器不支援或讀取失敗，回傳 0
 */
function readCssSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  try {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:0',
      'height:0',
      'visibility:hidden',
      'padding-top:env(safe-area-inset-top,0px)',
      'padding-bottom:env(safe-area-inset-bottom,0px)',
      'padding-left:env(safe-area-inset-left,0px)',
      'padding-right:env(safe-area-inset-right,0px)',
    ].join(';');
    document.body.appendChild(el);
    const style = window.getComputedStyle(el);
    const top    = parseFloat(style.paddingTop)    || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    const left   = parseFloat(style.paddingLeft)   || 0;
    const right  = parseFloat(style.paddingRight)  || 0;
    document.body.removeChild(el);
    return { top, bottom, left, right };
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export class ResponsiveLayout {
  /**
   * 根據畫布尺寸計算完整 layout metrics
   * 直屏（portrait）與橫屏（landscape）均支援
   *
   * safe area 優先使用 CSS env(safe-area-inset-*) 的實際值，
   * 確保 HUD 在 canvas 延伸到狀態列後方時仍正確避開瀏海。
   */
  static compute(W: number, H: number): LayoutMetrics {
    const aspectRatio = W / H;
    const isPortrait = H > W;

    // ── 比例分類（直屏時用 H/W 判斷）────────────────────────────────
    let aspectClass: AspectClass;
    if (isPortrait) {
      const hRatio = H / W;
      if (hRatio < 1.85) {
        aspectClass = 'compact';
      } else if (hRatio <= 2.15) {
        aspectClass = 'normal';
      } else {
        aspectClass = 'ultrawide';
      }
    } else {
      if (aspectRatio < 1.85) {
        aspectClass = 'compact';
      } else if (aspectRatio <= 2.15) {
        aspectClass = 'normal';
      } else {
        aspectClass = 'ultrawide';
      }
    }

    // ── Safe area：優先讀取 CSS env()，fallback 至估算值 ────────────
    const cssInsets = readCssSafeAreaInsets();

    const baseSafeH = Math.max(8, Math.round(H * 0.012));
    const baseSafeW = Math.max(8, Math.round(W * 0.010));

    let safeTop: number;
    let safeBottom: number;
    let safeLeft: number;
    let safeRight: number;

    if (isPortrait) {
      // 直屏：優先使用 CSS env() 實際值（Android overlay 模式下最準確）
      // 若 CSS env() 回傳 0（舊裝置不支援），fallback 至比例估算
      if (cssInsets.top > 0) {
        // 有實際 safe-area 資料：直接使用，加 8px 視覺緩衝
        safeTop    = Math.round(cssInsets.top) + 8;
        safeBottom = Math.max(16, Math.round(cssInsets.bottom) + 8);
        safeLeft   = Math.max(baseSafeW, Math.round(cssInsets.left));
        safeRight  = Math.max(baseSafeW, Math.round(cssInsets.right));
      } else {
        // Fallback：依比例估算（舊裝置或不支援 env() 的環境）
        switch (aspectClass) {
          case 'compact':
            safeTop    = Math.max(16, baseSafeH);
            safeBottom = Math.max(16, baseSafeH);
            break;
          case 'normal':
            safeTop    = Math.max(28, baseSafeH);
            safeBottom = Math.max(20, baseSafeH);
            break;
          case 'ultrawide':
            safeTop    = Math.max(44, baseSafeH); // 長型手機瀏海更深
            safeBottom = Math.max(28, baseSafeH);
            break;
        }
        safeLeft  = baseSafeW;
        safeRight = baseSafeW;
      }
    } else {
      safeTop    = cssInsets.top    > 0 ? Math.round(cssInsets.top)    + 4 : baseSafeH;
      safeBottom = cssInsets.bottom > 0 ? Math.round(cssInsets.bottom) + 4 : baseSafeH;
      safeLeft   = cssInsets.left   > 0 ? Math.round(cssInsets.left)       : baseSafeW;
      safeRight  = cssInsets.right  > 0 ? Math.round(cssInsets.right)      : baseSafeW;
    }

    // ── UI 縮放（直屏以寬度為基準）──────────────────────────────────
    // 基準寬度：390px（iPhone 14 邏輯像素寬度，常見中型手機）
    const BASE_W = 390;
    const BASE_H_LANDSCAPE = 720;
    const rawScale = isPortrait ? W / BASE_W : H / BASE_H_LANDSCAPE;
    const uiScale = Math.max(0.70, Math.min(1.10, rawScale));

    // ── 可用區域 ──────────────────────────────────────────────────────
    const usableX = safeLeft;
    const usableY = safeTop;
    const usableW = W - safeLeft - safeRight;
    const usableH = H - safeTop - safeBottom;
    const centerX = safeLeft + usableW / 2;
    const centerY = safeTop + usableH / 2;

    // ── 按鈕尺寸（直屏按鈕更寬更高，手指友善）──────────────────────
    const btnH = Math.round(Math.max(48, 56 * uiScale));
    const minTouchTarget = 48;

    return {
      W, H, aspectRatio, aspectClass,
      safeLeft, safeRight, safeTop, safeBottom,
      uiScale,
      usableW, usableH, usableX, usableY,
      centerX, centerY,
      btnH, minTouchTarget,
      isPortrait,
    };
  }

  static panelSize(
    W: number, H: number,
    maxWRatio: number, maxHRatio: number,
    minW: number = 200, minH: number = 100
  ): { panelW: number; panelH: number } {
    const panelW = Math.max(minW, Math.min(W * maxWRatio, W - 32));
    const panelH = Math.max(minH, Math.min(H * maxHRatio, H - 16));
    return { panelW, panelH };
  }
}
