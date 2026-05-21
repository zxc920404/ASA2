import Phaser from 'phaser';

/**
 * BGMManager — 跨場景 BGM 管理器
 *
 * 功能：
 * - 播放指定 BGM key（若已在播放同一首則不重複播放）
 * - 切換 BGM 時淡出舊曲、淡入新曲
 * - 靜默處理：key 不存在時不崩潰
 * - 音量控制（0.0 ~ 1.0）
 *
 * 使用方式：
 *   BGMManager.play(scene, 'bgm_main_menu');
 *   BGMManager.stop(scene);
 *   BGMManager.setVolume(0.5);
 */
export class BGMManager {
  /** 當前播放中的音樂物件 */
  private static currentMusic: Phaser.Sound.BaseSound | null = null;
  /** 當前播放中的 BGM key */
  private static currentKey: string = '';
  /** 全域音量（0.0 ~ 1.0） */
  private static volume: number = 0.7;
  /** 淡出/淡入時間（毫秒） */
  private static readonly FADE_DURATION = 800;

  /**
   * 播放指定 BGM
   * - 若已在播放同一首，不重複播放
   * - 若有其他 BGM 在播放，先淡出再淡入新曲
   * - 若 key 不存在於 sound cache，靜默跳過
   *
   * @param scene  當前 Phaser.Scene（用於存取 sound manager 和 tweens）
   * @param key    BGM 的 sound key（需已在 BootScene 載入）
   * @param volume 可選音量覆蓋（不傳則使用全域音量）
   */
  static play(scene: Phaser.Scene, key: string, volume?: number): void {
    // 已在播放同一首，不重複
    if (BGMManager.currentKey === key && BGMManager.currentMusic?.isPlaying) {
      return;
    }

    // 確認 key 是否存在於 sound cache
    if (!scene.sound.get(key) && !scene.cache.audio.exists(key)) {
      // 靜默跳過：BGM 檔案不存在
      return;
    }

    const targetVolume = volume ?? BGMManager.volume;

    // 有舊 BGM 在播放：淡出後再播新曲
    if (BGMManager.currentMusic && BGMManager.currentMusic.isPlaying) {
      const oldMusic = BGMManager.currentMusic;
      BGMManager.currentMusic = null;
      BGMManager.currentKey = '';

      scene.tweens.add({
        targets: oldMusic,
        volume: 0,
        duration: BGMManager.FADE_DURATION,
        ease: 'Linear',
        onComplete: () => {
          oldMusic.stop();
          oldMusic.destroy();
          BGMManager.startNew(scene, key, targetVolume);
        },
      });
    } else {
      // 無舊 BGM：直接播放
      if (BGMManager.currentMusic) {
        BGMManager.currentMusic.destroy();
        BGMManager.currentMusic = null;
      }
      BGMManager.startNew(scene, key, targetVolume);
    }
  }

  /**
   * 停止當前 BGM（帶淡出）
   * @param scene 當前 Phaser.Scene
   */
  static stop(scene: Phaser.Scene): void {
    if (!BGMManager.currentMusic || !BGMManager.currentMusic.isPlaying) {
      BGMManager.currentKey = '';
      return;
    }

    const oldMusic = BGMManager.currentMusic;
    BGMManager.currentMusic = null;
    BGMManager.currentKey = '';

    scene.tweens.add({
      targets: oldMusic,
      volume: 0,
      duration: BGMManager.FADE_DURATION,
      ease: 'Linear',
      onComplete: () => {
        oldMusic.stop();
        oldMusic.destroy();
      },
    });
  }

  /**
   * 設定全域音量（立即套用到當前播放中的 BGM）
   * @param volume 0.0 ~ 1.0
   */
  static setVolume(volume: number): void {
    BGMManager.volume = Phaser.Math.Clamp(volume, 0, 1);
    if (BGMManager.currentMusic) {
      (BGMManager.currentMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(BGMManager.volume);
    }
  }

  /**
   * 取得當前全域音量
   */
  static getVolume(): number {
    return BGMManager.volume;
  }

  /**
   * 取得當前播放中的 BGM key（空字串表示無）
   */
  static getCurrentKey(): string {
    return BGMManager.currentKey;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 建立並播放新 BGM（帶淡入）
   */
  private static startNew(scene: Phaser.Scene, key: string, targetVolume: number): void {
    try {
      const music = scene.sound.add(key, {
        loop: true,
        volume: 0,
      });
      music.play();
      BGMManager.currentMusic = music;
      BGMManager.currentKey = key;

      // 淡入
      scene.tweens.add({
        targets: music,
        volume: targetVolume,
        duration: BGMManager.FADE_DURATION,
        ease: 'Linear',
      });
    } catch (e) {
      // 靜默處理：音頻播放失敗（如瀏覽器自動播放限制）
      console.warn(`[BGMManager] 播放失敗: ${key}`, e);
      BGMManager.currentMusic = null;
      BGMManager.currentKey = '';
    }
  }
}
