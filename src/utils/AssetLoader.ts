/**
 * AssetLoader — 美術資源安全載入工具
 *
 * 所有圖片均為可選。若 PNG 不存在，遊戲不崩潰，
 * 顯示端自行 fallback 至文字或程式繪製圖形。
 *
 * 載入分三個群組，依場景需求延遲載入：
 *
 * 1. preloadCritical  — BootScene 啟動時載入（SFX + 主選單背景）
 *    目標：讓主選單盡快顯示，不阻塞啟動
 *
 * 2. preloadMenuAssets — CharacterSelectScene preload 時載入
 *    目標：宗門圖示、武器/被動圖示、主選單 BGM
 *
 * 3. preloadGameAssets — GameScene preload 時載入
 *    目標：敵人 sprite、戰鬥 BGM、宗門立繪（戰鬥前才需要）
 *
 * 使用方式（在顯示端判斷是否有圖）：
 *   AssetLoader.hasTexture(scene, key)
 */
export class AssetLoader {

  // ── 群組 1：啟動必要資源（BootScene 載入）────────────────────────────
  /**
   * 啟動時只載入最小必要資源：
   * - UI SFX（按鈕音效，主選單立即需要）
   * - 主選單背景圖（menuback.png）
   * - 主選單 BGM（Chenxi Village.mp3）
   */
  static preloadCritical(scene: Phaser.Scene): void {
    // UI SFX（主選單按鈕立即需要）
    AssetLoader.loadAudio(scene, 'sfx_button_click', 'assets/audio/UI/UIbutton.mp3');

    // 主選單背景圖
    AssetLoader.loadImage(scene, 'ui_bg_main_menu', 'assets/ui/menuback.png');

    // 主選單 BGM（啟動後立即播放）
    AssetLoader.loadAudio(scene, 'bgm_main_menu', 'assets/audio/bgm/Chenxi Village.mp3');
  }

  // ── 群組 2：選單資源（CharacterSelectScene preload 載入）─────────────
  /**
   * 宗門選擇畫面所需資源：
   * - 宗門小圖示（64×64）
   * - 宗門選擇背景圖
   * - 宗門選擇 BGM
   * - 武器圖示（升級面板需要）
   * - 被動圖示（升級面板需要）
   * - 升級面板 UI 圖
   */
  static preloadMenuAssets(scene: Phaser.Scene): void {
    // ── 宗門圖示（64×64）──────────────────────────────────────────────
    AssetLoader.loadImage(scene, 'sect_icon_swordsman', 'assets/sects/icons/Shield.png');
    AssetLoader.loadImage(scene, 'sect_icon_assassin',  'assets/sects/icons/SWORD.png');
    AssetLoader.loadImage(scene, 'sect_icon_taoist',    'assets/sects/icons/GUA.png');

    // ── 宗門選擇背景圖 ────────────────────────────────────────────────
    AssetLoader.loadImage(scene, 'ui_bg_char_select', 'assets/ui/classback.png');

    // ── 宗門選擇 BGM ──────────────────────────────────────────────────
    AssetLoader.loadAudio(scene, 'bgm_char_select', 'assets/audio/bgm/char_select.mp3');

    // ── 關卡選擇 BGM ──────────────────────────────────────────────────
    AssetLoader.loadAudio(scene, 'bgm_map_select', 'assets/audio/bgm/map_select.mp3');

    // ── 武器圖示（32×32，升級面板需要）──────────────────────────────
    AssetLoader.loadImage(scene, 'weapon_icon_guardian_ring',     'assets/icons/weapons/guardian_ring.png');
    AssetLoader.loadImage(scene, 'weapon_icon_swift_blade',       'assets/icons/weapons/swift_blade.png');
    AssetLoader.loadImage(scene, 'weapon_icon_flame_seal',        'assets/icons/weapons/flame_seal.png');
    AssetLoader.loadImage(scene, 'weapon_icon_ice_spike',         'assets/icons/weapons/ice_spike.png');
    AssetLoader.loadImage(scene, 'weapon_icon_ice_spike_evolved', 'assets/icons/weapons/ice_spike_evolved.png');
    AssetLoader.loadImage(scene, 'weapon_icon_swift_blade_evolved', 'assets/icons/weapons/swift_blade_evolved.png');
    AssetLoader.loadImage(scene, 'weapon_icon_thunder_claw',      'assets/icons/weapons/thunder_claw.png');
    AssetLoader.loadImage(scene, 'weapon_icon_poison_mist',       'assets/icons/weapons/poison_mist.png');
    AssetLoader.loadImage(scene, 'weapon_icon_light_shuttle',     'assets/icons/weapons/light_shuttle.png');
    AssetLoader.loadImage(scene, 'weapon_icon_soul_chasing_needle', 'assets/icons/weapons/soul_chasing_needle.png');

    // ── 被動圖示（32×32，升級面板需要）──────────────────────────────
    AssetLoader.loadImage(scene, 'passive_icon_swift_step',    'assets/icons/passives/swift_step.png');
    AssetLoader.loadImage(scene, 'passive_icon_life_jade',     'assets/icons/passives/life_jade.png');
    AssetLoader.loadImage(scene, 'passive_icon_break_seal',    'assets/icons/passives/break_seal.png');
    AssetLoader.loadImage(scene, 'passive_icon_spirit_bead',   'assets/icons/passives/spirit_bead.png');
    AssetLoader.loadImage(scene, 'passive_icon_vein_talisman', 'assets/icons/passives/vein_talisman.png');
    AssetLoader.loadImage(scene, 'passive_icon_swift_strike',  'assets/icons/passives/swift_strike.png');

    // ── UI 面板圖（升級面板）─────────────────────────────────────────
    AssetLoader.loadImage(scene, 'ui_panel_levelup', 'assets/ui/panel_levelup.png');
    AssetLoader.loadImage(scene, 'ui_panel_hud',     'assets/ui/panel_hud.png');
  }

  // ── 群組 3：戰鬥資源（GameScene preload 載入）────────────────────────
  /**
   * 戰鬥場景所需資源：
   * - 敵人 Sprite（48×48）
   * - 宗門立繪（160×220，戰鬥 HUD 可能顯示）
   * - 戰鬥 BGM
   * - 戰鬥背景圖
   */
  static preloadGameAssets(scene: Phaser.Scene): void {
    // ── 敵人 Sprite（48×48）──────────────────────────────────────────
    AssetLoader.loadImage(scene, 'enemy_img_basic',  'assets/sprites/enemies/enemy_basic.png');
    AssetLoader.loadImage(scene, 'enemy_img_fast',   'assets/sprites/enemies/enemy_fast.png');
    AssetLoader.loadImage(scene, 'enemy_img_tank',   'assets/sprites/enemies/enemy_tank.png');
    AssetLoader.loadImage(scene, 'enemy_img_ranged', 'assets/sprites/enemies/enemy_ranged.png');

    // ── 宗門立繪（160×220）───────────────────────────────────────────
    AssetLoader.loadImage(scene, 'sect_portrait_swordsman', 'assets/sects/portraits/swordsman.png');
    AssetLoader.loadImage(scene, 'sect_portrait_assassin',  'assets/sects/portraits/assassin.png');
    AssetLoader.loadImage(scene, 'sect_portrait_taoist',    'assets/sects/portraits/taoist.png');

    // ── 戰鬥 BGM ──────────────────────────────────────────────────────
    AssetLoader.loadAudio(scene, 'bgm_battle', 'assets/audio/bgm/Bandits.mp3');

    // ── 戰鬥背景圖 ────────────────────────────────────────────────────
    AssetLoader.loadImage(scene, 'bg_grass_battle', 'assets/backgrounds/grass_battle_tile.png');
  }

  // ── 向下相容：舊的 preloadAll 改為載入全部三個群組 ───────────────────
  /**
   * @deprecated 請改用 preloadCritical / preloadMenuAssets / preloadGameAssets
   * 保留此方法避免外部呼叫崩潰
   */
  static preloadAll(scene: Phaser.Scene): void {
    AssetLoader.preloadCritical(scene);
    AssetLoader.preloadMenuAssets(scene);
    AssetLoader.preloadGameAssets(scene);
  }

  /**
   * 安全載入單張圖片。
   * 若路徑不存在，Phaser 的 load error 事件會觸發但不會讓遊戲崩潰。
   */
  static loadImage(scene: Phaser.Scene, key: string, path: string): void {
    // 若 texture 已存在（scene restart 情況），跳過重複載入
    if (scene.textures.exists(key)) return;
    scene.load.image(key, path);
  }

  /**
   * 安全載入音頻檔案。
   * 若路徑不存在，load error 事件會觸發但不會讓遊戲崩潰。
   * BGMManager 在播放前會再次確認 key 是否存在，不存在則靜默跳過。
   */
  static loadAudio(scene: Phaser.Scene, key: string, path: string): void {
    // 若 audio cache 已存在（scene restart 情況），跳過重複載入
    if (scene.cache.audio.exists(key)) return;
    scene.load.audio(key, path);
  }

  /**
   * 判斷某個 texture key 是否已成功載入且尺寸有效（可用於 fallback 判斷）。
   * Phaser 載入失敗時會建立 '__MISSING' texture，此處排除它。
   * 同時排除尺寸過小的佔位符圖片（如 1×1 或空白 PNG），
   * 這類檔案在 Phaser 中 key 存在但實際上是無效素材。
   *
   * @param minSize 最小有效尺寸（寬和高都必須 >= 此值），預設 8
   */
  static hasTexture(scene: Phaser.Scene, key: string | undefined, minSize: number = 8): boolean {
    if (!key) return false;
    if (!scene.textures.exists(key)) return false;
    // Phaser 載入失敗時 texture 仍存在但 source 為空或為 missing
    const tex = scene.textures.get(key);
    if (tex.key === '__MISSING' || tex.key === '__DEFAULT') return false;
    // 排除尺寸過小的佔位符圖片（1×1 空白 PNG 等）
    const src = tex.source[0];
    if (!src) return false;
    if (src.width < minSize || src.height < minSize) return false;
    return true;
  }
}
