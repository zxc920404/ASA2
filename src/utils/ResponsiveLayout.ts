/**
 * ResponsiveLayout — 通用手機橫向 UI 適配工具
 *
 * 支援各種 Android / iOS 手機橫向比例：
 *   16:9  (1280×720, 1920×1080)
 *   18:9  (1440×720, 2160×1080)
 *   19.5:9 (2340×1080)
 *   20:9  (2400×1080)
 *   21:9  (2520×1080)
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
  /** 寬高比 */
  aspectRatio: number;
  /** 比例分類 */
  aspectClass: AspectClass;

  // ── Safe area padding（px）──────────────────────────────────────────
  /** 左側安全邊距（含瀏海/挖孔補償） */
  safeLeft: number;
  /** 右側安全邊距 */
  safeRight: number;
  /** 上方安全邊距 */
  safeTop: number;
  /** 下方安全邊距（含手勢導航列補償） */
  safeBottom: number;

  // ── UI 縮放 ──────────────────────────────────────────────────────────
  /**
   * 統一 UI 縮放係數（以高度為主要基準）
   * clamp 在 0.70 ~ 1.05 之間
   * 720p 手機 ≈ 1.0，1080p 手機 ≈ 1.0，超寬手機不過度放大
   */
  uiScale: number;

  // ── 常用計算值 ────────────────────────────────────────────────────────
  /** 可用寬度（W - safeLeft - safeRight） */
  usableW: number;
  /** 可用高度（H - safeTop - safeBottom） */
  usableH: number;
  /** 可用區域左起點 */
  usableX: number;
  /** 可用區域上起點 */
  usableY: number;
  /** 可用區域水平中心 */
  centerX: number;
  /** 可用區域垂直中心 */
  centerY: number;

  // ── 按鈕尺寸建議 ─────────────────────────────────────────────────────
  /** 標準按鈕高度（px） */
  btnH: number;
  /** 最小觸控目標（px） */
  minTouchTarget: number;
}

export class ResponsiveLayout {
  /**
   * 根據畫布尺寸計算完整 layout metrics
   * 每次 resize 後重新呼叫
   */
  static compute(W: number, H: number): LayoutMetrics {
    const aspectRatio = W / H;

    // ── 比例分類 ──────────────────────────────────────────────────────
    let aspectClass: AspectClass;
    if (aspectRatio < 1.85) {
      aspectClass = 'compact';      // 16:9 ≈ 1.78
    } else if (aspectRatio <= 2.15) {
      aspectClass = 'normal';       // 18:9 ~ 19.5:9 ≈ 1.89 ~ 2.17
    } else {
      aspectClass = 'ultrawide';    // 20:9+ ≈ 2.22+
    }

    // ── Safe area（從 CSS env() 讀取，fallback 為保守預設值）──────────
    // 在 Phaser 環境中無法直接讀 CSS env()，使用保守固定值
    // 超寬手機（20:9+）左右各補 24px 給瀏海/挖孔
    const baseSafeH = Math.max(8, Math.round(H * 0.012));
    const baseSafeW = Math.max(8, Math.round(W * 0.010));

    let safeLeft: number;
    let safeRight: number;
    const safeTop = baseSafeH;
    const safeBottom = baseSafeH;

    switch (aspectClass) {
      case 'compact':
        safeLeft  = baseSafeW;
        safeRight = baseSafeW;
        break;
      case 'normal':
        // 18:9 ~ 19.5:9：左右各加 16px 補償圓角/挖孔
        safeLeft  = Math.max(16, baseSafeW);
        safeRight = Math.max(16, baseSafeW);
        break;
      case 'ultrawide':
        // 20:9+：左右各加 28px 補償瀏海/挖孔
        safeLeft  = Math.max(28, baseSafeW);
        safeRight = Math.max(28, baseSafeW);
        break;
    }

    // ── UI 縮放（以高度為主要基準）────────────────────────────────────
    // 基準高度：720px（大多數手機橫向高度）
    const BASE_H = 720;
    const rawScale = H / BASE_H;
    // clamp：最小 0.70（小螢幕），最大 1.05（大螢幕不過度放大）
    const uiScale = Math.max(0.70, Math.min(1.05, rawScale));

    // ── 可用區域 ──────────────────────────────────────────────────────
    const usableX = safeLeft;
    const usableY = safeTop;
    const usableW = W - safeLeft - safeRight;
    const usableH = H - safeTop - safeBottom;
    const centerX = safeLeft + usableW / 2;
    const centerY = safeTop + usableH / 2;

    // ── 按鈕尺寸 ──────────────────────────────────────────────────────
    const btnH = Math.round(Math.max(44, 52 * uiScale));
    const minTouchTarget = 44;

    return {
      W, H, aspectRatio, aspectClass,
      safeLeft, safeRight, safeTop, safeBottom,
      uiScale,
      usableW, usableH, usableX, usableY,
      centerX, centerY,
      btnH, minTouchTarget,
    };
  }

  /**
   * 縮放字型大小（以 uiScale 為基準）
   * @param basePx 基準字型大小（px，以 720p 為準）
   * @param uiScale 來自 LayoutMetrics.uiScale
   * @returns 縮放後的字型大小字串，例如 '16px'
   */
  static fontSize(basePx: number, uiScale: number): string {
    return `${Math.round(basePx * uiScale)}px`;
  }

  /**
   * 計算面板尺寸，確保不超出畫布
   * @param W 畫布寬
   * @param H 畫布高
   * @param maxWRatio 最大寬度比例（0~1）
   * @param maxHRatio 最大高度比例（0~1）
   * @param minW 最小寬度（px）
   * @param minH 最小高度（px）
   */
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
