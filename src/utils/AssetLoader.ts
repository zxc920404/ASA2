/**
 * AssetLoader — 美術資源安全載入工具
 *
 * 所有圖片均為可選。若 PNG 不存在，遊戲不崩潰，
 * 顯示端自行 fallback 至文字或程式繪製圖形。
 *
 * 使用方式（在 BootScene.preload() 中呼叫）：
 *   AssetLoader.preloadAll(this);
 *
 * 使用方式（在顯示端判斷是否有圖）：
 *   AssetLoader.hasTexture(scene, key)
 */
export class AssetLoader {
  /**
   * 在 Phaser Scene 的 preload() 中呼叫，載入所有美術資源。
   * 每張圖片都用 try/catch 包住，載入失敗不影響其他資源。
   */
  static preloadAll(scene: Phaser.Scene): void {
    // ── 宗門圖示（64×64）────────────────────────────────────────────────
    // 墨守閣 → Shield.png，驚鴻派 → SWORD.png，歸元宗 → GUA.png
    AssetLoader.loadImage(scene, 'sect_icon_swordsman',   'assets/sects/icons/Shield.png');
    AssetLoader.loadImage(scene, 'sect_icon_assassin',    'assets/sects/icons/SWORD.png');
    AssetLoader.loadImage(scene, 'sect_icon_taoist',      'assets/sects/icons/GUA.png');

    // ── 宗門立繪（建議 160×220）──────────────────────────────────────────
    AssetLoader.loadImage(scene, 'sect_portrait_swordsman', 'assets/sects/portraits/swordsman.png');
    AssetLoader.loadImage(scene, 'sect_portrait_assassin',  'assets/sects/portraits/assassin.png');
    AssetLoader.loadImage(scene, 'sect_portrait_taoist',    'assets/sects/portraits/taoist.png');

    // ── 敵人 Sprite（建議 48×48）─────────────────────────────────────────
    // 實際檔案位於 assets/sprites/enemies/，檔名帶 enemy_ 前綴
    AssetLoader.loadImage(scene, 'enemy_img_basic',  'assets/sprites/enemies/enemy_basic.png');
    AssetLoader.loadImage(scene, 'enemy_img_fast',   'assets/sprites/enemies/enemy_fast.png');
    AssetLoader.loadImage(scene, 'enemy_img_tank',   'assets/sprites/enemies/enemy_tank.png');
    AssetLoader.loadImage(scene, 'enemy_img_ranged', 'assets/sprites/enemies/enemy_ranged.png');

    // ── 武器圖示（建議 32×32）────────────────────────────────────────────
    AssetLoader.loadImage(scene, 'weapon_icon_guardian_ring', 'assets/icons/weapons/guardian_ring.png');
    AssetLoader.loadImage(scene, 'weapon_icon_swift_blade',   'assets/icons/weapons/swift_blade.png');
    AssetLoader.loadImage(scene, 'weapon_icon_flame_seal',    'assets/icons/weapons/flame_seal.png');
    AssetLoader.loadImage(scene, 'weapon_icon_ice_spike',     'assets/icons/weapons/ice_spike.png');
    AssetLoader.loadImage(scene, 'weapon_icon_thunder_claw',  'assets/icons/weapons/thunder_claw.png');
    AssetLoader.loadImage(scene, 'weapon_icon_poison_mist',   'assets/icons/weapons/poison_mist.png');

    // ── 被動圖示（建議 32×32）────────────────────────────────────────────
    AssetLoader.loadImage(scene, 'passive_icon_swift_step',    'assets/icons/passives/swift_step.png');
    AssetLoader.loadImage(scene, 'passive_icon_life_jade',     'assets/icons/passives/life_jade.png');
    AssetLoader.loadImage(scene, 'passive_icon_break_seal',    'assets/icons/passives/break_seal.png');
    AssetLoader.loadImage(scene, 'passive_icon_spirit_bead',   'assets/icons/passives/spirit_bead.png');
    AssetLoader.loadImage(scene, 'passive_icon_vein_talisman', 'assets/icons/passives/vein_talisman.png');
    AssetLoader.loadImage(scene, 'passive_icon_swift_strike',  'assets/icons/passives/swift_strike.png');

    // ── UI 背景與面板（預留）─────────────────────────────────────────────
    AssetLoader.loadImage(scene, 'ui_bg_main_menu',    'assets/ui/menuback.png');
    AssetLoader.loadImage(scene, 'ui_bg_char_select',  'assets/ui/classback.png');
    AssetLoader.loadImage(scene, 'ui_panel_levelup',   'assets/ui/panel_levelup.png');
    AssetLoader.loadImage(scene, 'ui_panel_hud',       'assets/ui/panel_hud.png');

    // ── BGM 音頻 ──────────────────────────────────────────────────────────
    // 主選單 BGM（Chenxi Village.mp3）
    AssetLoader.loadAudio(scene, 'bgm_main_menu',   'assets/audio/bgm/Chenxi Village.mp3');
    // 戰鬥 BGM（Bandits.mp3）
    AssetLoader.loadAudio(scene, 'bgm_battle',      'assets/audio/bgm/Bandits.mp3');
    // 宗門選擇 BGM（檔案不存在時靜默跳過）
    AssetLoader.loadAudio(scene, 'bgm_char_select', 'assets/audio/bgm/char_select.mp3');
    // 關卡選擇 BGM（檔案不存在時靜默跳過）
    AssetLoader.loadAudio(scene, 'bgm_map_select',  'assets/audio/bgm/map_select.mp3');

    // ── UI SFX ────────────────────────────────────────────────────────────
    // 按鈕點擊音效
    AssetLoader.loadAudio(scene, 'sfx_button_click', 'assets/audio/UI/button.aiff');
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
