/**
 * SFXManager — UI 音效播放工具
 *
 * 使用方式：
 *   SFXManager.playButtonClick(this);
 *
 * 音量受 sfxVolume 設定控制（預設 0.8）。
 */
export class SFXManager {
  private static sfxVolume: number = 0.8;

  /** 設定 SFX 音量（0.0 ~ 1.0），由設定面板呼叫 */
  static setVolume(volume: number): void {
    SFXManager.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
  }

  /**
   * 播放按鈕點擊音效。
   * 若音效未載入則靜默跳過，不影響遊戲流程。
   */
  static playButtonClick(scene: Phaser.Scene): void {
    SFXManager.play(scene, 'sfx_button_click');
  }

  /**
   * 通用 SFX 播放，帶靜默保護。
   */
  static play(scene: Phaser.Scene, key: string, volumeOverride?: number): void {
    try {
      if (!scene.cache.audio.exists(key)) return;
      const vol = volumeOverride !== undefined ? volumeOverride : SFXManager.sfxVolume;
      scene.sound.play(key, { volume: vol });
    } catch {
      // 靜默跳過：音效播放失敗不影響遊戲
    }
  }
}
