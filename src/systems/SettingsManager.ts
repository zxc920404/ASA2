/**
 * SettingsManager — 輕量設定管理器
 * 
 * 功能：
 * - 載入/儲存設定到 localStorage
 * - 4 個核心設定：BGM 音量、SFX 音量、特效簡化、震動回饋
 * - 提供 getter/setter，自動同步到 localStorage
 * 
 * 使用方式：
 *   const settings = SettingsManager.loadSettings();
 *   SettingsManager.updateSetting('bgmVolume', 0.7);
 *   const current = SettingsManager.getSettings();
 */

export interface Settings {
  bgmVolume: number;        // 0.0 ~ 1.0, 預設 0.7
  sfxVolume: number;        // 0.0 ~ 1.0, 預設 0.8
  reducedEffects: boolean;  // 預設 false
  hapticsEnabled: boolean;  // 預設 true
}

export class SettingsManager {
  private static readonly STORAGE_KEY = 'wuxia_survivors_settings';
  
  private static readonly DEFAULT_SETTINGS: Settings = {
    bgmVolume: 0.7,
    sfxVolume: 0.8,
    reducedEffects: false,
    hapticsEnabled: true,
  };

  private static currentSettings: Settings = { ...SettingsManager.DEFAULT_SETTINGS };

  /**
   * 從 localStorage 載入設定
   * 若無資料或格式錯誤，回傳預設值
   */
  static loadSettings(): Settings {
    try {
      const stored = localStorage.getItem(SettingsManager.STORAGE_KEY);
      if (!stored) {
        SettingsManager.currentSettings = { ...SettingsManager.DEFAULT_SETTINGS };
        return SettingsManager.currentSettings;
      }

      const parsed = JSON.parse(stored) as Partial<Settings>;
      
      // 合併預設值（處理新增設定項目的向下相容）
      SettingsManager.currentSettings = {
        bgmVolume: parsed.bgmVolume ?? SettingsManager.DEFAULT_SETTINGS.bgmVolume,
        sfxVolume: parsed.sfxVolume ?? SettingsManager.DEFAULT_SETTINGS.sfxVolume,
        reducedEffects: parsed.reducedEffects ?? SettingsManager.DEFAULT_SETTINGS.reducedEffects,
        hapticsEnabled: parsed.hapticsEnabled ?? SettingsManager.DEFAULT_SETTINGS.hapticsEnabled,
      };

      return SettingsManager.currentSettings;
    } catch (e) {
      console.warn('[SettingsManager] 載入設定失敗，使用預設值', e);
      SettingsManager.currentSettings = { ...SettingsManager.DEFAULT_SETTINGS };
      return SettingsManager.currentSettings;
    }
  }

  /**
   * 儲存設定到 localStorage
   */
  static saveSettings(settings: Settings): void {
    try {
      SettingsManager.currentSettings = { ...settings };
      localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SettingsManager] 儲存設定失敗', e);
    }
  }

  /**
   * 取得當前設定
   */
  static getSettings(): Settings {
    return { ...SettingsManager.currentSettings };
  }

  /**
   * 更新單一設定項目並自動儲存
   */
  static updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    SettingsManager.currentSettings[key] = value;
    SettingsManager.saveSettings(SettingsManager.currentSettings);
  }

  /**
   * 重置為預設值
   */
  static resetToDefaults(): void {
    SettingsManager.currentSettings = { ...SettingsManager.DEFAULT_SETTINGS };
    SettingsManager.saveSettings(SettingsManager.currentSettings);
  }
}
