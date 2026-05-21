import Phaser from 'phaser';

/**
 * BGMManager — 跨場景 BGM 管理器
 *
 * 功能：
 * - 播放指定 BGM key（若已在播放同一首則不重複播放）
 * - 切換 BGM 時淡出舊曲、淡入新曲
 * - 靜默處理：key 不存在時不崩潰
 * - 分場景音量設定（menuBGMVolume / battleBGMVolume）
 *
 * 音量設計原則（倖存者類遊戲）：
 *   - 戰鬥 BGM 作為背景氣氛，不壓過武器 SFX / 擊殺音效
 *   - 選單 BGM 無大量音效競爭，可稍大聲
 *   - 手機外放低頻容易糊，整體保守
 *
 * 使用方式：
 *   BGMManager.play(scene, 'bgm_main_menu');
 *   BGMManager.play(scene, 'bgm_battle');
 *   BGMManager.stop(scene);
 *   BGMManager.setMenuVolume(0.35);
 *   BGMManager.setBattleVolume(0.22);
 */
export class BGMManager {
  /** 當前播放中的音樂物件 */
  private static currentMusic: Phaser.Sound.BaseSound | null = null;
  /** 當前播放中的 BGM key */
  private static currentKey: string = '';

  /**
   * 選單 / 選關 BGM 音量（0.0 ~ 1.0）
   * 無大量音效競爭，可稍大聲
   * 預設 0.35
   */
  private static menuBGMVolume: number = 0.35;

  /**
   * 戰鬥 BGM 音量（0.0 ~ 1.0）
   * 作為背景氣氛，不壓過武器 SFX / 擊殺音效
   * 預設 0.22（倖存者類遊戲 SFX > BGM 原則）
   */
  private static battleBGMVolume: number = 0.22;

  /** 淡出/淡入時間（毫秒） */
  private static readonly FADE_DURATION = 800;

  /** 戰鬥 BGM key 集合（用於判斷當前是否為戰鬥場景） */
  private static readonly BATTLE_BGM_KEYS = new Set(['bgm_battle']);

  /**
   * 播放指定 BGM
   * - 若已在播放同一首，不重複播放
   * - 若有其他 BGM 在播放，先淡出再淡入新曲
   * - 若 key 不存在於 sound cache，靜默跳過
   * - 音量自動依 key 選擇（戰鬥 BGM 用 battleBGMVolume，其餘用 menuBGMVolume）
   *
   * @param scene  當前 Phaser.Scene（用於存取 sound manager 和 tweens）
   * @param key    BGM 的 sound key（需已在 BootScene 載入）
   * @param volume 可選音量覆蓋（不傳則依 key 自動選擇）
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

    // 自動依 key 選擇音量：戰鬥 BGM 用 battleBGMVolume，其餘用 menuBGMVolume
    const targetVolume = volume ?? (
      BGMManager.BATTLE_BGM_KEYS.has(key)
        ? BGMManager.battleBGMVolume
        : BGMManager.menuBGMVolume
    );

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
   * 設定選單 BGM 音量（立即套用到當前播放中的選單 BGM）
   * @param volume 0.0 ~ 1.0
   */
  static setMenuVolume(volume: number): void {
    BGMManager.menuBGMVolume = Phaser.Math.Clamp(volume, 0, 1);
    // 若當前播放的是選單 BGM，立即套用
    if (BGMManager.currentMusic && !BGMManager.BATTLE_BGM_KEYS.has(BGMManager.currentKey)) {
      (BGMManager.currentMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(BGMManager.menuBGMVolume);
    }
  }

  /**
   * 設定戰鬥 BGM 音量（立即套用到當前播放中的戰鬥 BGM）
   * @param volume 0.0 ~ 1.0
   */
  static setBattleVolume(volume: number): void {
    BGMManager.battleBGMVolume = Phaser.Math.Clamp(volume, 0, 1);
    // 若當前播放的是戰鬥 BGM，立即套用
    if (BGMManager.currentMusic && BGMManager.BATTLE_BGM_KEYS.has(BGMManager.currentKey)) {
      (BGMManager.currentMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(BGMManager.battleBGMVolume);
    }
  }

  /**
   * 設定全域音量（同時更新選單和戰鬥音量，並立即套用到當前 BGM）
   * 保留向下相容，供設定面板的單一滑桿使用
   * @param volume 0.0 ~ 1.0
   */
  static setVolume(volume: number): void {
    const clamped = Phaser.Math.Clamp(volume, 0, 1);
    // 選單音量 = 滑桿值 × 1.0（上限 0.5，避免過大）
    BGMManager.menuBGMVolume = Math.min(clamped, 0.5);
    // 戰鬥音量 = 滑桿值 × 0.63（保持戰鬥 BGM 比選單低約 37%）
    BGMManager.battleBGMVolume = Math.min(clamped * 0.63, 0.35);
    // 立即套用到當前播放中的 BGM
    if (BGMManager.currentMusic) {
      const vol = BGMManager.BATTLE_BGM_KEYS.has(BGMManager.currentKey)
        ? BGMManager.battleBGMVolume
        : BGMManager.menuBGMVolume;
      (BGMManager.currentMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(vol);
    }
  }

  /**
   * 取得選單 BGM 音量
   */
  static getMenuVolume(): number {
    return BGMManager.menuBGMVolume;
  }

  /**
   * 取得戰鬥 BGM 音量
   */
  static getBattleVolume(): number {
    return BGMManager.battleBGMVolume;
  }

  /**
   * 取得當前有效音量（依當前播放的 BGM 類型回傳對應音量）
   * 向下相容舊的 getVolume() 呼叫
   */
  static getVolume(): number {
    if (BGMManager.BATTLE_BGM_KEYS.has(BGMManager.currentKey)) {
      return BGMManager.battleBGMVolume;
    }
    return BGMManager.menuBGMVolume;
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
