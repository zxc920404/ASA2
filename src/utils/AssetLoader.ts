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
   *
   * 注意：主選單 BGM（bgm_main_menu）已移至 MainMenuScene.preload() 載入，
   * 避免 BootScene 一開始就下載 5.9MB 的音檔拖慢啟動速度。
   */
  static preloadCritical(scene: Phaser.Scene): void {
    // UI SFX（主選單按鈕立即需要）
    AssetLoader.loadAudio(scene, 'sfx_button_click', 'assets/audio/UI/UIbutton.mp3');

    // 主選單背景圖
    AssetLoader.loadImage(scene, 'ui_bg_main_menu', 'assets/ui/menuback.png');

    // 主選單 BGM 已移至 MainMenuScene.preload() 延遲載入
  }

  // ── 群組 1b：主選單 BGM（MainMenuScene preload 載入）─────────────────
  /**
   * 主選單 BGM 單獨拆出，由 MainMenuScene.preload() 呼叫。
   * 原因：Chenxi Village.mp3 約 5.9MB，不應在 BootScene 啟動時就下載。
   * 若 audio key 已存在（場景重入），自動跳過。
   */
  static preloadMainMenuBGM(scene: Phaser.Scene): void {
    AssetLoader.loadAudio(scene, 'bgm_main_menu', 'assets/audio/bgm/Chenxi Village.mp3');
  }

  // ── 群組 2：選單資源（CharacterSelectScene preload 載入）─────────────
  /**
   * 宗門選擇畫面所需資源：
   * - 宗門小圖示（64×64）— 已確認存在
   * - 宗門選擇背景圖 — 已確認存在
   * - 武器圖示（icons/weapons/*.png）— 用於 LevelUpPanel 卡片與 HUD 武器欄
   * - 被動圖示（icons/passives/*.png）— 用於 LevelUpPanel 卡片與 HUD 被動欄
   * - BGM
   */
  static preloadMenuAssets(scene: Phaser.Scene): void {
    // ── 宗門圖示（64×64，已確認存在）────────────────────────────────
    AssetLoader.loadImage(scene, 'sect_icon_swordsman', 'assets/sects/icons/Shield.png');
    AssetLoader.loadImage(scene, 'sect_icon_assassin',  'assets/sects/icons/SWORD.png');
    AssetLoader.loadImage(scene, 'sect_icon_taoist',    'assets/sects/icons/GUA.png');

    // ── 宗門選擇背景圖（已確認存在）──────────────────────────────────
    AssetLoader.loadImage(scene, 'ui_bg_char_select', 'assets/ui/classback.png');

    // ── 武器圖示（用於升級面板和 HUD 武器欄）───────────────────────────
    AssetLoader.loadImage(scene, 'weapon_shouxin_ring',     'assets/icons/weapons/守心環.png');
    AssetLoader.loadImage(scene, 'weapon_jifeng_blade',     'assets/icons/weapons/疾風刃.png');
    AssetLoader.loadImage(scene, 'weapon_chiyan_seal',      'assets/icons/weapons/赤焰印.png');
    AssetLoader.loadImage(scene, 'weapon_hanbing_spike',    'assets/icons/weapons/寒冰錐.png');
    AssetLoader.loadImage(scene, 'weapon_leiting_claw',     'assets/icons/weapons/雷霆爪.png');
    AssetLoader.loadImage(scene, 'weapon_duwu_powder',      'assets/icons/weapons/毒霧散.png');
    AssetLoader.loadImage(scene, 'weapon_liuguang_shuttle', 'assets/icons/weapons/流光梭.png');
    AssetLoader.loadImage(scene, 'weapon_zhuihun_needle',   'assets/icons/weapons/追魂針.png');

    // ── 被動圖示（用於升級面板和 HUD 被動欄）───────────────────────────
    AssetLoader.loadImage(scene, 'passive_icon_swift_step',     'assets/icons/passives/迅捷步.png');
    AssetLoader.loadImage(scene, 'passive_icon_life_jade',      'assets/icons/passives/生命玉.png');
    AssetLoader.loadImage(scene, 'passive_icon_break_seal',     'assets/icons/passives/破勢印.png');
    AssetLoader.loadImage(scene, 'passive_icon_spirit_bead',    'assets/icons/passives/引靈珠.png');
    AssetLoader.loadImage(scene, 'passive_icon_vein_talisman',  'assets/icons/passives/擴脈符.png');
    AssetLoader.loadImage(scene, 'passive_icon_swift_strike',   'assets/icons/passives/急攻令.png');

    // ── 宗門選擇 BGM ──────────────────────────────────────────────────
    AssetLoader.loadAudio(scene, 'bgm_char_select', 'assets/audio/bgm/char_select.mp3');

    // ── 關卡選擇 BGM ──────────────────────────────────────────────────
    AssetLoader.loadAudio(scene, 'bgm_map_select', 'assets/audio/bgm/map_select.mp3');
  }

  // ── 群組 3：戰鬥資源（GameScene preload 載入）────────────────────────
  /**
   * 戰鬥場景所需資源：
   * - 第一關「山賊營寨」地表 tileSprite 素材（ground_tile.png）
   * - 戰鬥 BGM
   * - 驚鴻派（assassin）玩家動畫幀（wave-stand × 5、wave-run × 8）
   *
   * 注意：以下素材目前尚未提供，已移除 preload 避免 404 黑屏：
   * - 敵人 Sprite（enemy_basic/fast/tank/ranged.png）→ Enemy.ts 使用 Graphics fallback
   * - 宗門立繪（swordsman/assassin/taoist.png）→ HUD 使用 icon fallback
   * - 舊背景（grass_battle_tile.png）→ 已改用 bandit_ground_tile
   */
  static preloadGameAssets(scene: Phaser.Scene): void {
    // ── 第一關「山賊營寨」地表 tileSprite 素材 ────────────────────────
    AssetLoader.loadImage(scene, 'bandit_ground_tile', 'assets/backgrounds/ground_tile.png');

    // ── 戰鬥 BGM ──────────────────────────────────────────────────────
    AssetLoader.loadAudio(scene, 'bgm_battle', 'assets/audio/bgm/Bandits.mp3');

    // ── 驚鴻派（assassin）玩家動畫幀 ────────────────────────────────────
    // wave-idle / wave-run 是玩家動畫素材，供 id: 'assassin'（驚鴻派）使用
    // wave-idle：4 幀（wave-idle/01~04.png），frameRate 4 fps
    AssetLoader.loadImage(scene, 'wave_idle_01', 'assets/sprites/player/wave/wave-idle/01.png');
    AssetLoader.loadImage(scene, 'wave_idle_02', 'assets/sprites/player/wave/wave-idle/02.png');
    AssetLoader.loadImage(scene, 'wave_idle_03', 'assets/sprites/player/wave/wave-idle/03.png');
    AssetLoader.loadImage(scene, 'wave_idle_04', 'assets/sprites/player/wave/wave-idle/04.png');

    // wave-run：9 幀（wave-run/01~09.png），frameRate 12 fps
    AssetLoader.loadImage(scene, 'wave_run_01', 'assets/sprites/player/wave/wave-run/01.png');
    AssetLoader.loadImage(scene, 'wave_run_02', 'assets/sprites/player/wave/wave-run/02.png');
    AssetLoader.loadImage(scene, 'wave_run_03', 'assets/sprites/player/wave/wave-run/03.png');
    AssetLoader.loadImage(scene, 'wave_run_04', 'assets/sprites/player/wave/wave-run/04.png');
    AssetLoader.loadImage(scene, 'wave_run_05', 'assets/sprites/player/wave/wave-run/05.png');
    AssetLoader.loadImage(scene, 'wave_run_06', 'assets/sprites/player/wave/wave-run/06.png');
    AssetLoader.loadImage(scene, 'wave_run_07', 'assets/sprites/player/wave/wave-run/07.png');
    AssetLoader.loadImage(scene, 'wave_run_08', 'assets/sprites/player/wave/wave-run/08.png');
    AssetLoader.loadImage(scene, 'wave_run_09', 'assets/sprites/player/wave/wave-run/09.png');

    // ── 墨守閣（swordsman）玩家動畫幀 ────────────────────────────────────
    // ink-idle / ink-run 是玩家動畫素材，供 id: 'swordsman'（墨守閣）使用
    // ink-idle：4 幀（ink_idle/01~04.png），frameRate 4 fps
    AssetLoader.loadImage(scene, 'ink_idle_01', 'assets/sprites/player/ink/ink_idle/01.png');
    AssetLoader.loadImage(scene, 'ink_idle_02', 'assets/sprites/player/ink/ink_idle/02.png');
    AssetLoader.loadImage(scene, 'ink_idle_03', 'assets/sprites/player/ink/ink_idle/03.png');
    AssetLoader.loadImage(scene, 'ink_idle_04', 'assets/sprites/player/ink/ink_idle/04.png');

    // ink-run：8 幀（ink_run/01~08.png），frameRate 12 fps
    AssetLoader.loadImage(scene, 'ink_run_01', 'assets/sprites/player/ink/ink_run/01.png');
    AssetLoader.loadImage(scene, 'ink_run_02', 'assets/sprites/player/ink/ink_run/02.png');
    AssetLoader.loadImage(scene, 'ink_run_03', 'assets/sprites/player/ink/ink_run/03.png');
    AssetLoader.loadImage(scene, 'ink_run_04', 'assets/sprites/player/ink/ink_run/04.png');
    AssetLoader.loadImage(scene, 'ink_run_05', 'assets/sprites/player/ink/ink_run/05.png');
    AssetLoader.loadImage(scene, 'ink_run_06', 'assets/sprites/player/ink/ink_run/06.png');
    AssetLoader.loadImage(scene, 'ink_run_07', 'assets/sprites/player/ink/ink_run/07.png');
    AssetLoader.loadImage(scene, 'ink_run_08', 'assets/sprites/player/ink/ink_run/08.png');

    // ── 歸元宗（taoist）玩家動畫幀 ────────────────────────────────────────
    // Guiyuan-idle / Guiyuan-run 是玩家動畫素材，供 id: 'taoist'（歸元宗）使用
    // Guiyuan-idle：4 幀（Guiyuan_idle/01~04.png），frameRate 4 fps
    AssetLoader.loadImage(scene, 'guiyuan_idle_01', 'assets/sprites/player/Guiyuan/Guiyuan_idle/01.png');
    AssetLoader.loadImage(scene, 'guiyuan_idle_02', 'assets/sprites/player/Guiyuan/Guiyuan_idle/02.png');
    AssetLoader.loadImage(scene, 'guiyuan_idle_03', 'assets/sprites/player/Guiyuan/Guiyuan_idle/03.png');
    AssetLoader.loadImage(scene, 'guiyuan_idle_04', 'assets/sprites/player/Guiyuan/Guiyuan_idle/04.png');

    // Guiyuan-run：8 幀（Guiyuan_run/01~08.png），frameRate 12 fps
    AssetLoader.loadImage(scene, 'guiyuan_run_01', 'assets/sprites/player/Guiyuan/Guiyuan_run/01.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_02', 'assets/sprites/player/Guiyuan/Guiyuan_run/02.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_03', 'assets/sprites/player/Guiyuan/Guiyuan_run/03.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_04', 'assets/sprites/player/Guiyuan/Guiyuan_run/04.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_05', 'assets/sprites/player/Guiyuan/Guiyuan_run/05.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_06', 'assets/sprites/player/Guiyuan/Guiyuan_run/06.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_07', 'assets/sprites/player/Guiyuan/Guiyuan_run/07.png');
    AssetLoader.loadImage(scene, 'guiyuan_run_08', 'assets/sprites/player/Guiyuan/Guiyuan_run/08.png');

    // ── 第一關 Boss 動畫幀 ────────────────────────────────────────────
    // boss1（三當家 / elite_shield）：8 幀奔跑動畫 + 13 幀技能動畫，10 fps
    AssetLoader.loadImage(scene, 'boss1_01', 'assets/sprites/enemies/Level_1/boss1/run/01.png');
    AssetLoader.loadImage(scene, 'boss1_02', 'assets/sprites/enemies/Level_1/boss1/run/02.png');
    AssetLoader.loadImage(scene, 'boss1_03', 'assets/sprites/enemies/Level_1/boss1/run/03.png');
    AssetLoader.loadImage(scene, 'boss1_04', 'assets/sprites/enemies/Level_1/boss1/run/04.png');
    AssetLoader.loadImage(scene, 'boss1_05', 'assets/sprites/enemies/Level_1/boss1/run/05.png');
    AssetLoader.loadImage(scene, 'boss1_06', 'assets/sprites/enemies/Level_1/boss1/run/06.png');
    AssetLoader.loadImage(scene, 'boss1_07', 'assets/sprites/enemies/Level_1/boss1/run/07.png');
    AssetLoader.loadImage(scene, 'boss1_08', 'assets/sprites/enemies/Level_1/boss1/run/08.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_01', 'assets/sprites/enemies/Level_1/boss1/skill1/1.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_02', 'assets/sprites/enemies/Level_1/boss1/skill1/2.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_03', 'assets/sprites/enemies/Level_1/boss1/skill1/3.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_04', 'assets/sprites/enemies/Level_1/boss1/skill1/4.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_05', 'assets/sprites/enemies/Level_1/boss1/skill1/5.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_06', 'assets/sprites/enemies/Level_1/boss1/skill1/6.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_07', 'assets/sprites/enemies/Level_1/boss1/skill1/7.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_08', 'assets/sprites/enemies/Level_1/boss1/skill1/8.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_09', 'assets/sprites/enemies/Level_1/boss1/skill1/9.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_10', 'assets/sprites/enemies/Level_1/boss1/skill1/10.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_11', 'assets/sprites/enemies/Level_1/boss1/skill1/11.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_12', 'assets/sprites/enemies/Level_1/boss1/skill1/12.png');
    AssetLoader.loadImage(scene, 'boss1_skill1_13', 'assets/sprites/enemies/Level_1/boss1/skill1/13.png');

    // ── 第一關 二當家（boss2 / elite_shooter）動畫幀 ────────────────────
    // walk：8 幀移動動畫；attack1：7 幀攻擊動畫（對應 boss2_skill1）
    AssetLoader.loadImage(scene, 'boss2_01', 'assets/sprites/enemies/Level_1/boss2/walk/01.png');
    AssetLoader.loadImage(scene, 'boss2_02', 'assets/sprites/enemies/Level_1/boss2/walk/02.png');
    AssetLoader.loadImage(scene, 'boss2_03', 'assets/sprites/enemies/Level_1/boss2/walk/03.png');
    AssetLoader.loadImage(scene, 'boss2_04', 'assets/sprites/enemies/Level_1/boss2/walk/04.png');
    AssetLoader.loadImage(scene, 'boss2_05', 'assets/sprites/enemies/Level_1/boss2/walk/05.png');
    AssetLoader.loadImage(scene, 'boss2_06', 'assets/sprites/enemies/Level_1/boss2/walk/06.png');
    AssetLoader.loadImage(scene, 'boss2_07', 'assets/sprites/enemies/Level_1/boss2/walk/07.png');
    AssetLoader.loadImage(scene, 'boss2_08', 'assets/sprites/enemies/Level_1/boss2/walk/08.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_01', 'assets/sprites/enemies/Level_1/boss2/attack1/01.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_02', 'assets/sprites/enemies/Level_1/boss2/attack1/02.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_03', 'assets/sprites/enemies/Level_1/boss2/attack1/03.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_04', 'assets/sprites/enemies/Level_1/boss2/attack1/04.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_05', 'assets/sprites/enemies/Level_1/boss2/attack1/05.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_06', 'assets/sprites/enemies/Level_1/boss2/attack1/06.png');
    AssetLoader.loadImage(scene, 'boss2_skill1_07', 'assets/sprites/enemies/Level_1/boss2/attack1/07.png');

    // ── 第一關普通小怪動畫幀 ──────────────────────────────────────────
    // henchman（山賊嘍囉）：8 幀移動動畫，8 fps
    AssetLoader.loadImage(scene, 'henchman_01', 'assets/sprites/enemies/Level_1/henchman/01.png');
    AssetLoader.loadImage(scene, 'henchman_02', 'assets/sprites/enemies/Level_1/henchman/02.png');
    AssetLoader.loadImage(scene, 'henchman_03', 'assets/sprites/enemies/Level_1/henchman/03.png');
    AssetLoader.loadImage(scene, 'henchman_04', 'assets/sprites/enemies/Level_1/henchman/04.png');
    AssetLoader.loadImage(scene, 'henchman_05', 'assets/sprites/enemies/Level_1/henchman/05.png');
    AssetLoader.loadImage(scene, 'henchman_06', 'assets/sprites/enemies/Level_1/henchman/06.png');
    AssetLoader.loadImage(scene, 'henchman_07', 'assets/sprites/enemies/Level_1/henchman/07.png');
    AssetLoader.loadImage(scene, 'henchman_08', 'assets/sprites/enemies/Level_1/henchman/08.png');

    // giant（巨漢）：8 幀移動動畫，8 fps
    AssetLoader.loadImage(scene, 'giant_01', 'assets/sprites/enemies/Level_1/giant/01.png');
    AssetLoader.loadImage(scene, 'giant_02', 'assets/sprites/enemies/Level_1/giant/02.png');
    AssetLoader.loadImage(scene, 'giant_03', 'assets/sprites/enemies/Level_1/giant/03.png');
    AssetLoader.loadImage(scene, 'giant_04', 'assets/sprites/enemies/Level_1/giant/04.png');
    AssetLoader.loadImage(scene, 'giant_05', 'assets/sprites/enemies/Level_1/giant/05.png');
    AssetLoader.loadImage(scene, 'giant_06', 'assets/sprites/enemies/Level_1/giant/06.png');
    AssetLoader.loadImage(scene, 'giant_07', 'assets/sprites/enemies/Level_1/giant/07.png');
    AssetLoader.loadImage(scene, 'giant_08', 'assets/sprites/enemies/Level_1/giant/08.png');

    // scout（赤侯）：6 幀移動動畫，8 fps
    AssetLoader.loadImage(scene, 'scout_01', 'assets/sprites/enemies/Level_1/scout/01.png');
    AssetLoader.loadImage(scene, 'scout_02', 'assets/sprites/enemies/Level_1/scout/02.png');
    AssetLoader.loadImage(scene, 'scout_03', 'assets/sprites/enemies/Level_1/scout/03.png');
    AssetLoader.loadImage(scene, 'scout_04', 'assets/sprites/enemies/Level_1/scout/04.png');
    AssetLoader.loadImage(scene, 'scout_05', 'assets/sprites/enemies/Level_1/scout/05.png');
    AssetLoader.loadImage(scene, 'scout_06', 'assets/sprites/enemies/Level_1/scout/06.png');

    // archer（山賊射手）：6 幀移動動畫 + 10 幀攻擊動畫，8 fps
    AssetLoader.loadImage(scene, 'archer_01', 'assets/sprites/enemies/Level_1/archer/01.png');
    AssetLoader.loadImage(scene, 'archer_02', 'assets/sprites/enemies/Level_1/archer/02.png');
    AssetLoader.loadImage(scene, 'archer_03', 'assets/sprites/enemies/Level_1/archer/03.png');
    AssetLoader.loadImage(scene, 'archer_04', 'assets/sprites/enemies/Level_1/archer/04.png');
    AssetLoader.loadImage(scene, 'archer_05', 'assets/sprites/enemies/Level_1/archer/05.png');
    AssetLoader.loadImage(scene, 'archer_06', 'assets/sprites/enemies/Level_1/archer/06.png');
    AssetLoader.loadImage(scene, 'archer_atk_01', 'assets/sprites/enemies/Level_1/archer/attack/01.png');
    AssetLoader.loadImage(scene, 'archer_atk_02', 'assets/sprites/enemies/Level_1/archer/attack/02.png');
    AssetLoader.loadImage(scene, 'archer_atk_03', 'assets/sprites/enemies/Level_1/archer/attack/03.png');
    AssetLoader.loadImage(scene, 'archer_atk_04', 'assets/sprites/enemies/Level_1/archer/attack/04.png');
    AssetLoader.loadImage(scene, 'archer_atk_05', 'assets/sprites/enemies/Level_1/archer/attack/05.png');
    AssetLoader.loadImage(scene, 'archer_atk_06', 'assets/sprites/enemies/Level_1/archer/attack/06.png');
    AssetLoader.loadImage(scene, 'archer_atk_07', 'assets/sprites/enemies/Level_1/archer/attack/07.png');
    AssetLoader.loadImage(scene, 'archer_atk_08', 'assets/sprites/enemies/Level_1/archer/attack/08.png');
    AssetLoader.loadImage(scene, 'archer_atk_09', 'assets/sprites/enemies/Level_1/archer/attack/09.png');
    AssetLoader.loadImage(scene, 'archer_atk_10', 'assets/sprites/enemies/Level_1/archer/attack/10.png');
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
