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

export class ResponsiveLayout {
  /**
   * 根據畫布尺寸計算完整 layout metrics
   * 直屏（portrait）與橫屏（landscape）均支援
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

    // ── Safe area ────────────────────────────────────────────────────
    const baseSafeH = Math.max(8, Math.round(H * 0.012));
    const baseSafeW = Math.max(8, Math.round(W * 0.010));

    let safeTop: number;
    let safeBottom: number;
    const safeLeft = baseSafeW;
    const safeRight = baseSafeW;

    if (isPortrait) {
      // 直屏：上方補償瀏海/挖孔，下方補償手勢導航列
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
    } else {
      safeTop    = baseSafeH;
      safeBottom = baseSafeH;
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

  static fontSize(basePx: number, uiScale: number): string {
    return `${Math.round(basePx * uiScale)}px`;
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
