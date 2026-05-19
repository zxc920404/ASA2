import Phaser from 'phaser';

/**
 * UIStyles — 全域 UI 文字樣式工具
 * 統一 fontFamily、resolution，消除中文字模糊
 */

/** 支援中文的系統字型 fallback 鏈 */
export const FONT_FAMILY =
  '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", sans-serif';

/**
 * 建立清晰文字樣式
 * @param fontSize  字體大小（px 數字）
 * @param color     顏色字串，例如 '#ffffff'
 * @param extra     額外覆蓋的 TextStyle 屬性
 */
export function uiText(
  fontSize: number,
  color: string,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontSize: `${fontSize}px`,
    color,
    fontFamily: FONT_FAMILY,
    resolution: 2,
    ...extra,
  };
}

/**
 * 帶陰影的標題文字樣式
 */
export function uiTitle(
  fontSize: number,
  color: string,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  return uiText(fontSize, color, {
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
    ...extra,
  });
}
