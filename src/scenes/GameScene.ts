import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { XPGem } from '../objects/XPGem';
import { DifficultyScaler } from '../systems/DifficultyScaler';
import { WeaponSystem } from '../systems/WeaponSystem';
import { LevelUpSystem, IGameScene } from '../systems/LevelUpSystem';
import { HUD } from '../ui/HUD';
import { PausePanel } from '../ui/PausePanel';
import { GameOverPanel } from '../ui/GameOverPanel';
import { VictoryPanel } from '../ui/VictoryPanel';
import { PlayerStatusPanel } from '../ui/PlayerStatusPanel';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { getCharacterById } from '../data/characters';
import { getEnemyById } from '../data/enemies';
import { resetDamageNumberCounter } from '../objects/Enemy';
import { EliteProjectile, resetEliteProjectileGlobals } from '../objects/EliteProjectile';
import { BlackHoleTrap } from '../objects/BlackHoleTrap';
import { DropItem, DropItemType } from '../objects/DropItem';
import { MetaProgression } from '../systems/MetaProgression';
import { EliteLineAttack } from '../objects/EliteLineAttack';
import { BGMManager } from '../systems/BGMManager';
import { AssetLoader } from '../utils/AssetLoader';

interface GameSceneData {
  characterId: string;
  /** 選擇的地圖 ID（目前只有 'qingyuan'，預留給未來擴充） */
  selectedMapId?: string;
}

// 世界尺寸（邊界限制用）
const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;

/** 場上敵人上限（設計層面 80，Requirement 6.5 / design.md）
 * @deprecated 已由 DifficultyScaler 的公式曲線動態計算，此常數僅作保底上限 */
const MAX_ENEMIES = 200;

/** 場上 XPGem 上限（design.md 效能限制） */
const MAX_XP_GEMS = 80;

/** 玩家等級上限（提高至 99，不再過早封頂） */
const MAX_LEVEL = 99;

/** 敵人生成距離範圍（Requirement 6.4） */
const SPAWN_DIST_MIN = 150;
const SPAWN_DIST_MAX = 200;

/** 玩家碰撞半徑（Requirement 6.2） */
const PLAYER_COLLISION_RADIUS = 14;

/** 接觸傷害冷卻時間（毫秒，Requirement 6.2） */
const CONTACT_DAMAGE_COOLDOWN_MS = 1000;

/** 敵人分離半徑（px）：距離小於此值時產生推力 */
const ENEMY_SEPARATION_RADIUS = 28;

/** 敵人分離強度：分離向量的權重（相對於追玩家方向） */
const ENEMY_SEPARATION_STRENGTH = 0.3;

/** 分離向量更新間隔（幀數）：每 4 幀更新一次 */
const SEPARATION_UPDATE_INTERVAL = 4;

/** 勝利所需存活時間（毫秒）：10 分鐘 */
const VICTORY_TIME_MS = 10 * 60 * 1000;

/** 最後怪潮開始時間（秒）：9 分鐘，與 DifficultyScaler 一致 */
const FINAL_WAVE_START_SEC = 9 * 60;

// ── Enemy Recycle 機制（模仿 Vampire Survivors 怪物重新定位）──────────────
/** 超過此距離的普通小怪會被重新定位（px） */
const RECYCLE_DISTANCE = 1200;
/** 重新定位後距玩家的距離（px），落在視野外 */
const RECYCLE_SPAWN_DISTANCE = 700;
/** Recycle 檢查間隔（ms），不每幀檢查以節省效能 */
const RECYCLE_CHECK_INTERVAL = 800;

export class GameScene extends Phaser.Scene implements IGameScene {
  private characterId: string = '';
  private player!: Player;

  // WASD 鍵盤輸入
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // 敵人群組
  private enemyGroup!: Phaser.GameObjects.Group;

  // XPGem 群組
  private xpGemGroup!: Phaser.GameObjects.Group;

  // 擊殺計數器
  private killCount: number = 0;

  // 難度縮放器
  private difficultyScaler!: DifficultyScaler;

  // 武器系統
  private weaponSystem!: WeaponSystem;

  // 升級系統（Requirement 10.3）
  private levelUpSystem!: LevelUpSystem;

  // 遊戲計時（秒）
  private elapsedSeconds: number = 0;

  // 生成計時器
  private spawnTimer!: Phaser.Time.TimerEvent;

  // HUD（Requirement 任務 9）
  private hud!: HUD;

  // 暫停面板（Requirement 任務 9）
  private pausePanel!: PausePanel;

  // 暫停原因（'none' = 未暫停，'manual' = 手動，'levelup' = 升級，'gameover' = 死亡，'portrait' = 直向警告，'status' = 屬性面板，'victory' = 勝利）
  private pauseReason: 'none' | 'manual' | 'levelup' | 'gameover' | 'portrait' | 'status' | 'victory' = 'none';

  /** 便利 getter：任何原因暫停時回傳 true */
  private get isPaused(): boolean {
    return this.pauseReason !== 'none';
  }

  /** 設定 pauseReason 並在變化時 log */
  private setPauseReason(reason: typeof this.pauseReason): void {
    if (this.pauseReason !== reason) {
      console.log('[PauseReason]', this.pauseReason, '->', reason);
      this.pauseReason = reason;
    }
  }

  // 死亡狀態（Requirement 1.2、14.1）防止重複觸發
  private isGameOver: boolean = false;

  // 結算面板（Requirement 14.1）
  private gameOverPanel: GameOverPanel | null = null;

  // 勝利狀態（防止重複觸發）
  private isVictory: boolean = false;

  // 勝利面板
  private victoryPanel: VictoryPanel | null = null;

  // 屬性面板
  private playerStatusPanel!: PlayerStatusPanel;

  // 虛擬搖桿（Requirement 2.4、任務 11）
  private virtualJoystick!: VirtualJoystick;

  // 直向警告元素（任務 11）
  private portraitBg!: Phaser.GameObjects.Rectangle;
  private portraitIcon!: Phaser.GameObjects.Text;
  private portraitText!: Phaser.GameObjects.Text;

  // 方向偵測：是否為直向模式
  private isPortrait: boolean = false;

  // 方向變更事件處理函式（用於移除監聽）
  private orientationHandler!: () => void;

  // 敵人分離向量快取（key: Enemy 物件，value: {x, y}）
  // 每 4 幀更新一次，避免每幀重算
  private separationCache: Map<Enemy, { x: number; y: number }> = new Map();

  // 分離向量更新幀計數器
  private separationFrameCount: number = 0;

  // ── 精英怪事件 flag（每局各觸發一次）──────────────────────────────────
  /** 第一波精英怪是否已生成（測試用：60 秒 / 1min；正式版：150 秒） */
  private eliteSpawned150: boolean = false;
  /** 第二波精英怪是否已生成（測試用：180 秒 / 3min；正式版：300 秒） */
  private eliteSpawned300: boolean = false;
  /** 第三波精英怪是否已生成（測試用：300 秒 / 5min；正式版：450 秒） */
  private eliteSpawned450: boolean = false;

  // ── 精英投射物陣列（shooter 用）──────────────────────────────────────
  private eliteProjectiles: EliteProjectile[] = [];

  // ── 黑洞陷阱陣列（shield 用）──────────────────────────────────────────
  private blackHoleTraps: BlackHoleTrap[] = [];
  private readonly MAX_BLACK_HOLES = 4;

  // ── 直線攻擊陣列（shield Boss 用）────────────────────────────────────
  private lineAttacks: EliteLineAttack[] = [];

  // ── 掉落道具陣列 ──────────────────────────────────────────────────────
  private dropItems: DropItem[] = [];
  private readonly MAX_DROP_ITEMS = 12;

  // ── 遠程小怪投射物（與精英投射物共用 EliteProjectile 類別）──────────
  private rangedProjectiles: EliteProjectile[] = [];
  private readonly MAX_RANGED_PROJECTILES = 50;

  // ── 加速 buff 計時（ms，> 0 表示加速中）──────────────────────────────
  private speedBoostTimer: number = 0;
  private readonly SPEED_BOOST_DURATION = 5000;
  private readonly SPEED_BOOST_MULT = 1.3;

  // ── 玩家定身計時（ms，> 0 表示定身中，由震撼咆哮觸發）──────────────
  private playerStunTimer: number = 0;
  /** 控場免疫計時（ms，> 0 時不可被再次定身） */
  private playerStunImmunityTimer: number = 0;
  private readonly STUN_IMMUNITY_DURATION = 4000; // 定身結束後 4 秒免疫

  // ── 天命點（局外貨幣）────────────────────────────────────────────────
  /** 本局獲得的天命點（死亡或勝利後加入永久存檔） */
  private runDestinyPoints: number = 0;

  // ── 氣血回復計時（ms）────────────────────────────────────────────────
  private hpRecoveryTimer: number = 0;
  private readonly HP_RECOVERY_INTERVAL = 1000; // 每 1 秒回血一次

  // ── Enemy Recycle 計時（ms）──────────────────────────────────────────
  /** 距離過遠的普通小怪重新定位計時器 */
  private recycleTimer: number = 0;

  // ── 地表 tileSprite（山賊營寨背景，跟隨攝影機更新 tilePosition）────
  private groundTile!: Phaser.GameObjects.TileSprite;
  // ── Debug 顯示 ────────────────────────────────────────────────────────
  private debugText!: Phaser.GameObjects.Text;
  private debugUpdateTimer: number = 0;
  private readonly DEBUG_UPDATE_INTERVAL = 500; // 每 500ms 更新一次
  /** Debug 面板開關：false = 正式遊戲不顯示，true = 開發測試用 */
  private readonly SHOW_DEBUG_HUD = false;
  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // 延遲載入群組 3：敵人 sprite、戰鬥 BGM、宗門立繪
    // 已載入的資源會被 AssetLoader 自動跳過（不重複載入）
    AssetLoader.preloadGameAssets(this);

    // 載入失敗靜默處理（不讓 console error 影響遊戲流程）
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[GameScene] 資源載入失敗（已 fallback）: ${file.key} → ${file.url}`);
    });
  }

  init(data: GameSceneData): void {
    // 接收從 MapSelectScene 傳入的 characterId 與 selectedMapId
    this.characterId = data?.characterId ?? '';
    console.log('[GameScene] init 收到 characterId:', this.characterId);
    // selectedMapId 目前只有 'qingyuan'，預留給未來多地圖擴充
    // const selectedMapId = data?.selectedMapId ?? 'qingyuan';
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // 重置計時
    this.elapsedSeconds = 0;
    this.killCount = 0;
    this.pauseReason = 'none';
    this.isGameOver = false;
    this.gameOverPanel = null;
    this.isVictory = false;
    this.victoryPanel = null;
    this.isPortrait = false;
    this.separationCache = new Map();
    this.separationFrameCount = 0;

    // 重置精英怪 flag
    this.eliteSpawned150 = false;
    this.eliteSpawned300 = false;
    this.eliteSpawned450 = false;

    // 重置精英投射物陣列
    this.eliteProjectiles = [];

    // 重置黑洞陷阱陣列
    this.blackHoleTraps = [];

    // 重置直線攻擊陣列
    this.lineAttacks = [];

    // 重置掉落道具、遠程投射物、加速 buff
    this.dropItems = [];
    this.rangedProjectiles = [];
    this.speedBoostTimer = 0;

    // 重置定身計時
    this.playerStunTimer = 0;
    this.playerStunImmunityTimer = 0;

    // 重置本局天命點
    this.runDestinyPoints = 0;
    this.hpRecoveryTimer = 0;
    this.recycleTimer = 0;

    // 讀取局外進度
    MetaProgression.load();

    // 重置傷害數字計數器（防止跨場景殘留）
    resetDamageNumberCounter();

    // 重置精英投射物全域狀態（防止跨場景計數殘留，BUG-1 修正）
    resetEliteProjectileGlobals();

    // ── 預先生成 Sprite Texture（用 Graphics 繪製後快取）────────────────
    this.generateSpriteTextures();

    // ── 驚鴻派玩家動畫（wave_stand / wave_run，供 assassin 使用）────────
    this.createPlayerAnimations();

    // ── Physics world bounds（6000×6000）────────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // ── 武俠訓練場背景（Polish 3）──────────────────────────────────────
    this.drawGameBackground();

    // 取得角色資料；若找不到則使用預設角色
    const charData = getCharacterById(this.characterId) ?? getCharacterById('swordsman')!;

    console.log('[GameScene] characterId:', this.characterId,
      '| charData.id:', charData.id,
      '| wave_stand_1 valid:', AssetLoader.hasTexture(this, 'wave_stand_1'),
      '| wave_run_01 valid:', AssetLoader.hasTexture(this, 'wave_run_01'),
      '| wave_stand anim:', this.anims.exists('wave_stand'),
      '| wave_run anim:', this.anims.exists('wave_run'));

    // 建立 Player，初始位置於世界中央
    this.player = new Player(this, WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, charData);

    // 套用局外加成至玩家初始屬性
    this.applyMetaBonusToPlayer();

    // 攝影機設定：跟隨玩家，限制在世界邊界內
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // ── 臨時 debug overlay（右下角，固定在畫面上）────────────────────────
    // 只在 localStorage.getItem('asa2_debug') === '1' 時顯示
    // 開啟方式：瀏覽器 console 輸入 localStorage.setItem('asa2_debug','1') 後重整
    const showDebugOverlay = typeof localStorage !== 'undefined'
      && localStorage.getItem('asa2_debug') === '1';
    if (showDebugOverlay) {
      const dbgText = this.add.text(
        this.scale.width - 8,
        this.scale.height - 8,
        this.player.getDebugInfo(),
        {
          fontSize: '10px',
          color: '#00ff88',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'right',
          lineSpacing: 2,
          backgroundColor: '#00000066',
        }
      )
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(300)
        .setAlpha(0.80);
      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (dbgText.active && this.player?.active) {
            dbgText.setText(this.player.getDebugInfo());
          }
        },
      });
    }
    // ── end debug overlay ─────────────────────────────────────────────────

    // 設定 WASD 鍵盤輸入
    const keyboard = this.input.keyboard!;
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // 建立敵人群組
    this.enemyGroup = this.add.group();

    // 建立 XPGem 群組
    this.xpGemGroup = this.add.group();

    // 建立難度縮放器
    this.difficultyScaler = new DifficultyScaler();

    // 建立武器系統並初始化（Requirement 5.1）
    this.weaponSystem = new WeaponSystem(this);
    this.weaponSystem.init(this.player, this.characterId);

    // 建立升級系統（Requirement 10.3）
    this.levelUpSystem = new LevelUpSystem(this);

    // 啟動生成計時器（初始間隔 1000ms，Requirement 1.3）
    this.scheduleNextSpawn();

    // 建立 HUD（Requirement 任務 9）
    this.hud = new HUD(this);

    // 建立暫停面板（Requirement 任務 9）
    this.pausePanel = new PausePanel(this);

    // 設定暫停按鈕點擊事件
    this.hud.onPauseClick(() => {
      this.pauseGame();
    });

    // 設定「繼續遊戲」按鈕點擊事件
    this.pausePanel.onResumeClick(() => {
      this.pausePanel.hide();
      this.resumeGame();
    });

    // 設定「確定返回主選單」回呼（清理暫停狀態後跳回主選單）
    this.pausePanel.onMainMenuConfirm(() => {
      // 清理暫停狀態，避免重新進入遊戲後仍是 paused
      this.setPauseReason('none');
      if (this.spawnTimer) this.spawnTimer.paused = false;
      this.weaponSystem.resume();
      this.scene.start('MainMenuScene');
    });

    // 建立屬性面板
    this.playerStatusPanel = new PlayerStatusPanel(this);

    // 設定屬性按鈕點擊事件（升級/暫停/死亡中不開啟）
    this.hud.onStatsClick(() => {
      if (this.pauseReason !== 'none') return;
      if (this.isGameOver) return;
      const charData = getCharacterById(this.characterId);
      const charName = charData?.name ?? '未知';
      this.pauseForStatus();
      this.playerStatusPanel.show(this.player, charName, () => {
        this.resumeFromStatus();
      });
    });

    // 建立虛擬搖桿（Requirement 2.4、任務 11）
    this.virtualJoystick = new VirtualJoystick(this);
    // 設定 UI 排除區域，避免點擊 HUD 按鈕時觸發搖桿
    this.virtualJoystick.setUIZones(this.hud.getUIZones());

    // 建立直向警告元素（任務 11）
    this.createPortraitWarning();

    // 設定螢幕方向偵測（任務 11）
    this.setupOrientationDetection();

    // ── Debug 效能顯示（預設關閉，SHOW_DEBUG_HUD=true 才建立）────────────
    this.debugUpdateTimer = 0;
    if (this.SHOW_DEBUG_HUD) {
      // Debug 面板：左下角，搖桿上方，不擋操作區
      // 搖桿在 H*0.75，Debug 放在搖桿上方 130px 處
      const dbgY = Math.round(this.scale.height * 0.75 - 130);
      this.debugText = this.add.text(
        8, dbgY,
        '', {
          fontSize: '9px',
          color: '#ffff00',
          backgroundColor: '#00000088',
          padding: { x: 3, y: 2 },
          resolution: 2,
        }
      ).setOrigin(0, 1).setScrollFactor(0).setDepth(200).setAlpha(0.75);
    }

    // 場景關閉時清理方向監聽（任務 11）
    this.events.once('shutdown', () => {
      if (this.orientationHandler) {
        window.removeEventListener('orientationchange', this.orientationHandler);
        window.removeEventListener('resize', this.orientationHandler);
      }
      // 移除 Phaser resize 監聽
      this.scale.off('resize', this.onScaleResize, this);
      if (this.virtualJoystick) {
        this.virtualJoystick.destroy();
      }
      if (this.playerStatusPanel) {
        this.playerStatusPanel.destroy();
      }
      // 清理所有動態物件陣列，防止 scene restart 後殘留
      this.cleanupDynamicObjects();
      // 立即停止戰鬥 BGM（不能用淡出，場景切換後 tween 會被銷毀導致 stop/destroy 永遠不執行）
      BGMManager.stopImmediate();
    });

    // ── Phaser RESIZE 模式：螢幕旋轉時重建 HUD 與搖桿 ──────────────────
    this.scale.on('resize', this.onScaleResize, this);

    // ── 戰鬥 BGM（音量 0.22，不壓過武器 SFX）────────────────────────────
    BGMManager.play(this, 'bgm_battle');
  }

  /**
   * Phaser Scale RESIZE 事件回呼
   * 螢幕旋轉或視口尺寸變更時，重建 HUD 與虛擬搖桿
   */
  private onScaleResize(): void {
    // 重建 HUD（重新計算 safe area 與座標）
    if (this.hud) {
      this.hud.rebuild();
      // 重新綁定按鈕事件
      this.hud.onPauseClick(() => { this.pauseGame(); });
      this.hud.onStatsClick(() => {
        if (this.pauseReason !== 'none') return;
        if (this.isGameOver) return;
        const charData = getCharacterById(this.characterId);
        const charName = charData?.name ?? '未知';
        this.pauseForStatus();
        this.playerStatusPanel.show(this.player, charName, () => {
          this.resumeFromStatus();
        });
      });
    }
    // 重建虛擬搖桿
    if (this.virtualJoystick) {
      this.virtualJoystick.destroy();
      this.virtualJoystick = new VirtualJoystick(this);
      // 重建後更新 UI 排除區域（HUD 已重建，座標可能改變）
      this.virtualJoystick.setUIZones(this.hud.getUIZones());
    }
  }

  update(time: number, delta: number): void {
    // 暫停時停止所有遊戲邏輯（Requirement 1.2、1.5）
    if (this.isPaused) return;

    try {
      this._updateInternal(time, delta);
    } catch (e) {
      console.error('[GameScene] update crash:', e);
    }
  }

  private _updateInternal(time: number, delta: number): void {

    // 累積遊戲時間
    this.elapsedSeconds += delta / 1000;

    // ── 地表 tileSprite 視差更新（模擬世界移動感）──────────────────────
    // 攝影機偏移量 = 玩家世界座標 - 攝影機中心，映射到 tilePosition
    if (this.groundTile) {
      const cam = this.cameras.main;
      this.groundTile.setTilePosition(cam.scrollX, cam.scrollY);
    }

    // 氣血回復（局外升級 hp_recovery）
    const hpRecoveryPerSec = MetaProgression.getUpgradeBonus('hp_recovery');
    if (hpRecoveryPerSec > 0 && this.player.currentHP > 0) {
      this.hpRecoveryTimer += delta;
      if (this.hpRecoveryTimer >= this.HP_RECOVERY_INTERVAL) {
        this.hpRecoveryTimer -= this.HP_RECOVERY_INTERVAL;
        this.player.currentHP = Math.min(
          this.player.stats.maxHP,
          this.player.currentHP + hpRecoveryPerSec
        );
      }
    }

    // 更新 HUD 快取資料（實際渲染由 HUD 內部計時器負責）
    this.hud.update(this.player, this.elapsedSeconds, this.killCount);

    // 更新玩家受傷回饋（無敵幀倒計時、閃白恢復）
    this.player.updateHitFeedback(delta);

    // 低血量 HUD 警告（HP < 30% 時通知 HUD 閃爍）
    const hpRatio = this.player.currentHP / this.player.stats.maxHP;
    this.hud.setLowHpWarning(hpRatio < 0.30);

    // ── Debug 顯示更新（每 500ms，僅 SHOW_DEBUG_HUD=true 時執行）──────────
    if (this.SHOW_DEBUG_HUD && this.debugText) {
      this.debugUpdateTimer += delta;
      if (this.debugUpdateTimer >= this.DEBUG_UPDATE_INTERVAL) {
        this.debugUpdateTimer = 0;
        const fps = Math.round(this.game.loop.actualFps);
        const enemyCount = this.enemyGroup.getLength();
        const xpGems = this.xpGemGroup.getLength();
        const eliteProj = this.eliteProjectiles.length;
        const rangedProj = this.rangedProjectiles.length;
        const drops = this.dropItems.length;
        const holes = this.blackHoleTraps.length;
        const joystickVecDbg = this.virtualJoystick.getVector();
        this.debugText.setText(
          `FPS:${fps} E:${enemyCount} XP:${xpGems}\n` +
          `EP:${eliteProj} RP:${rangedProj} D:${drops} BH:${holes}\n` +
          `Pause:${this.pauseReason} isPaused:${this.isPaused}\n` +
          `P:${Math.round(this.player.x)},${Math.round(this.player.y)}\n` +
          `Input:${joystickVecDbg.x.toFixed(1)},${joystickVecDbg.y.toFixed(1)}\n` +
          `Lv:${this.player.level} Exp:${Math.round(this.player.currentExp)}`
        );
      }
    }

    // 讀取 WASD 輸入並移動玩家（Requirement 2.1、2.2、2.3、2.4）
    // 合併鍵盤與虛擬搖桿輸入（任務 11）
    // 定身中（震撼咆哮效果）：跳過移動
    const joystickVec = this.virtualJoystick.getVector();
    if (this.playerStunTimer <= 0) {
      this.player.moveWithVector(
        {
          up: this.keyW,
          down: this.keyS,
          left: this.keyA,
          right: this.keyD,
        },
        joystickVec,
        delta,
        WORLD_WIDTH,
        WORLD_HEIGHT
      );
    }

    // 更新所有敵人：追蹤玩家 + 接觸傷害 + 死亡檢測
    const enemies = this.enemyGroup.getChildren() as Enemy[];
    const deadEnemies: Enemy[] = [];

    // 每 4 幀更新一次分離向量快取（效能優化）
    this.separationFrameCount++;
    if (this.separationFrameCount >= SEPARATION_UPDATE_INTERVAL) {
      this.separationFrameCount = 0;
      this.updateSeparationCache(enemies);
    }

    for (const enemy of enemies) {
      // 死亡檢測（Requirement 6.3）：HP ≤ 0 或正在死亡的敵人加入待移除清單
      if (enemy.currentHP <= 0 || enemy.isDying || enemy.deathHandled) {
        if (!enemy.deathHandled) deadEnemies.push(enemy);
        continue;
      }

      // 更新受擊閃白計時
      enemy.updateHitFlash(delta);

      // 取得此敵人的分離向量（若無則使用零向量）
      const sep = this.separationCache.get(enemy) ?? { x: 0, y: 0 };

      // 每幀朝玩家移動，並套用分離向量（Requirement 6.1）
      enemy.moveTowardPlayer(this.player.x, this.player.y, delta, sep.x, sep.y);

      // 接觸傷害檢測（Requirement 6.2）
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const overlapDist = PLAYER_COLLISION_RADIUS + enemy.collisionRadius;

      if (dist <= overlapDist) {
        const now = time;
        if (now - enemy.lastDamageTime >= CONTACT_DAMAGE_COOLDOWN_MS) {
          // 使用 takeDamage 集中處理受傷回饋（無敵幀、閃白、浮字、shake）
          this.player.takeDamage(enemy.contactDamage, this);
          enemy.lastDamageTime = now;
        }
      }

      // 精英技能更新
      if (enemy.isElite) {
        enemy.updateEliteSkill(delta, this.player.x, this.player.y);
      }
      // 遠程小怪射擊更新
      if (enemy.isRanged) {
        enemy.updateRangedSkill(delta, this.player.x, this.player.y);
      }
    }

    // ── 精英怪事件觸發（測試用：60 / 180 / 300 秒，即 1:00 / 3:00 / 5:00；正式版：150 / 300 / 450 秒，即 2:30 / 5:00 / 7:30）──
    if (!this.eliteSpawned150 && this.elapsedSeconds >= 60) {
      this.eliteSpawned150 = true;
      this.spawnEliteEnemy(1);
    }
    if (!this.eliteSpawned300 && this.elapsedSeconds >= 180) {
      this.eliteSpawned300 = true;
      this.spawnEliteEnemy(2);
    }
    if (!this.eliteSpawned450 && this.elapsedSeconds >= 300) {
      this.eliteSpawned450 = true;
      this.spawnEliteEnemy(3);
    }

    // 勝利判定優先：存活達 10 分鐘（即使同幀 HP 歸零也以勝利為準）
    if (!this.isVictory && !this.isGameOver && this.elapsedSeconds * 1000 >= VICTORY_TIME_MS) {
      this.triggerVictory();
      return;
    }

    // 死亡偵測（Requirement 1.2、14.1）：玩家 HP 歸零時觸發死亡流程
    if (this.player.currentHP <= 0 && !this.isGameOver && !this.isVictory) {
      this.triggerGameOver();
      return;
    }

    // 更新武器系統（Requirement 5.1～5.5）
    // 傳入存活中的敵人（排除已標記死亡或正在死亡的）
    const aliveEnemies = enemies.filter(e => !deadEnemies.includes(e) && !e.isDying && !e.deathHandled);
    const weaponDeadEnemies = this.weaponSystem.update(time, delta, this.player, aliveEnemies);
    for (const enemy of weaponDeadEnemies) {
      if (!deadEnemies.includes(enemy)) {
        deadEnemies.push(enemy);
      }
    }

    // 處理所有死亡敵人（Requirement 6.3）
    for (const enemy of deadEnemies) {
      this.handleEnemyDeath(enemy);
    }

    // 更新 XPGem：磁吸移動 + 拾取檢測（Requirement 9.1、9.3）
    const gems = this.xpGemGroup.getChildren() as XPGem[];
    const absorbedGems: XPGem[] = [];
    const pickupRange = this.player.stats.pickupRange;

    for (const gem of gems) {
      const dx = this.player.x - gem.x;
      const dy = this.player.y - gem.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 進入拾取範圍時啟動磁吸（Requirement 9.1、9.3）
      if (dist <= pickupRange) {
        gem.isAttracting = true;
      }

      // 磁吸移動，若到達玩家位置則標記為已吸收
      if (gem.isAttracting) {
        const absorbed = gem.updateAttract(this.player.x, this.player.y, delta);
        if (absorbed) {
          absorbedGems.push(gem);
        }
      }
    }

    // 處理被吸收的 XPGem（Requirement 9.2）
    for (const gem of absorbedGems) {
      this.absorbXPGem(gem);
    }

    // ── 精英投射物更新與碰撞檢測 ──────────────────────────────────────
    const deadProjectiles: EliteProjectile[] = [];
    for (const proj of this.eliteProjectiles) {
      if (proj.isDead) { deadProjectiles.push(proj); continue; }

      const expired = proj.updateProjectile(delta);
      if (expired) { deadProjectiles.push(proj); continue; }

      // 碰撞玩家
      const pdx = this.player.x - proj.x;
      const pdy = this.player.y - proj.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist <= PLAYER_COLLISION_RADIUS + 6) {
        this.player.takeDamage(proj.damage, this);
        deadProjectiles.push(proj);
      }
    }
    for (const proj of deadProjectiles) {
      const idx = this.eliteProjectiles.indexOf(proj);
      if (idx !== -1) this.eliteProjectiles.splice(idx, 1);
      if (!proj.isDead) proj.destroy();
    }

    // ── shield 護盾消除玩家投射物 ──────────────────────────────────────
    const shieldEnemies = (this.enemyGroup.getChildren() as Enemy[]).filter(
      e => e.isElite && e.eliteType === 'shield' && e.shieldActive && !e.isDying
    );
    if (shieldEnemies.length > 0) {
      this.weaponSystem.destroyProjectilesInShieldRange(shieldEnemies);
    }

    // ── 黑洞陷阱更新 ──────────────────────────────────────────────────
    const deadHoles: BlackHoleTrap[] = [];
    for (const hole of this.blackHoleTraps) {
      const alive = hole.update(delta, this.player);
      if (!alive) deadHoles.push(hole);
    }
    for (const hole of deadHoles) {
      hole.destroy();
      const idx = this.blackHoleTraps.indexOf(hole);
      if (idx !== -1) this.blackHoleTraps.splice(idx, 1);
    }

    // ── 加速 buff 計時 ────────────────────────────────────────────────
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= delta;
      if (this.speedBoostTimer <= 0) {
        this.speedBoostTimer = 0;
        // 恢復正常速度（重新計算 stats）
        this.player.recalculateStats();
      }
    }

    // ── 玩家定身計時（震撼咆哮效果）────────────────────────────────────
    if (this.playerStunTimer > 0) {
      this.playerStunTimer -= delta;
      if (this.playerStunTimer <= 0) {
        this.playerStunTimer = 0;
        // 定身結束，啟動免疫計時
        this.playerStunImmunityTimer = this.STUN_IMMUNITY_DURATION;
      }
    }
    if (this.playerStunImmunityTimer > 0) {
      this.playerStunImmunityTimer -= delta;
      if (this.playerStunImmunityTimer < 0) this.playerStunImmunityTimer = 0;
    }

    // ── 直線攻擊更新（shield Boss 技能）──────────────────────────────
    const deadLineAttacks: EliteLineAttack[] = [];
    let lineAttackHitThisFrame = false; // 同一輪只允許扣一次血
    for (const la of this.lineAttacks) {
      if (la.isDead) { deadLineAttacks.push(la); continue; }
      const result = la.update(delta, this.player, lineAttackHitThisFrame);
      if (result.hit) {
        lineAttackHitThisFrame = true;
        this.player.takeDamage(la.getDamage(), this);
      }
      if (result.shouldDestroy) {
        deadLineAttacks.push(la);
      }
    }
    for (const la of deadLineAttacks) {
      la.destroy();
      const idx = this.lineAttacks.indexOf(la);
      if (idx !== -1) this.lineAttacks.splice(idx, 1);
    }

    // ── 遠程小怪投射物更新與碰撞 ──────────────────────────────────────
    const deadRangedProj: EliteProjectile[] = [];
    for (const proj of this.rangedProjectiles) {
      if (proj.isDead) { deadRangedProj.push(proj); continue; }
      const expired = proj.updateProjectile(delta);
      if (expired) { deadRangedProj.push(proj); continue; }
      const pdx = this.player.x - proj.x;
      const pdy = this.player.y - proj.y;
      if (Math.sqrt(pdx * pdx + pdy * pdy) <= PLAYER_COLLISION_RADIUS + 6) {
        this.player.takeDamage(proj.damage, this);
        deadRangedProj.push(proj);
      }
    }
    for (const proj of deadRangedProj) {
      const idx = this.rangedProjectiles.indexOf(proj);
      if (idx !== -1) this.rangedProjectiles.splice(idx, 1);
      if (!proj.isDead) proj.destroy();
    }

    // ── 掉落道具更新與拾取 ────────────────────────────────────────────
    const deadItems: DropItem[] = [];
    for (const item of this.dropItems) {
      const alive = item.update(delta);
      if (!alive) { deadItems.push(item); continue; }
      if (item.checkPickup(this.player)) {
        this.applyDropItem(item.type);
        deadItems.push(item);
      }
    }
    for (const item of deadItems) {
      item.destroy();
      const idx = this.dropItems.indexOf(item);
      if (idx !== -1) this.dropItems.splice(idx, 1);
    }

    // ── Enemy Recycle：每 800ms 檢查一次，將太遠的普通小怪重新定位 ──
    this.recycleTimer += delta;
    if (this.recycleTimer >= RECYCLE_CHECK_INTERVAL) {
      this.recycleTimer = 0;
      this.recycleDistantEnemies();
    }
  } // end _updateInternal

  /**
   * 建立直向警告 UI 元素（任務 11）
   * 直屏模式已支援，此方法保留但不顯示警告
   * 元素建立後立即隱藏，不影響直屏遊戲
   */
  private createPortraitWarning(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // 黑色背景（覆蓋全畫面）
    this.portraitBg = this.add.rectangle(W * 0.5, H * 0.5, W, H, 0x000000);
    this.portraitBg.setScrollFactor(0);
    this.portraitBg.setDepth(200);
    this.portraitBg.setVisible(false);

    // 旋轉圖示文字（保留但不顯示）
    this.portraitIcon = this.add.text(W * 0.5, H * 0.38, '⟳', {
      fontSize: '48px',
      color: '#ffffff',
    });
    this.portraitIcon.setOrigin(0.5, 0.5);
    this.portraitIcon.setScrollFactor(0);
    this.portraitIcon.setDepth(201);
    this.portraitIcon.setVisible(false);

    // 提示文字（保留但不顯示）
    this.portraitText = this.add.text(W * 0.5, H * 0.55, '請旋轉手機至橫向\n繼續遊戲', {
      fontSize: '22px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: W * 0.8 },
    });
    this.portraitText.setOrigin(0.5, 0.5);
    this.portraitText.setScrollFactor(0);
    this.portraitText.setDepth(201);
    this.portraitText.setVisible(false);
  }

  /**
   * 設定螢幕方向偵測（任務 11）
   * 監聽 orientationchange 事件，直向時顯示警告並暫停遊戲
   */
  private setupOrientationDetection(): void {
    // 初始檢查
    this.checkOrientation();

    // 監聽方向變更事件
    this.orientationHandler = () => {
      // 延遲一幀確保 innerWidth/innerHeight 已更新
      this.time.delayedCall(100, () => {
        this.checkOrientation();
      });
    };

    window.addEventListener('orientationchange', this.orientationHandler);
    window.addEventListener('resize', this.orientationHandler);
  }

  /**
   * 檢查當前螢幕方向
   * 直屏模式已完整支援，不再顯示警告或暫停遊戲
   * 僅更新 isPortrait 狀態供其他邏輯使用
   */
  private checkOrientation(): void {
    const isPortrait = window.innerWidth < window.innerHeight;

    if (isPortrait === this.isPortrait) return; // 無變化

    this.isPortrait = isPortrait;

    // 直屏與橫屏均支援，不顯示警告，不暫停遊戲
    // 若有 portrait 暫停殘留（舊版邏輯），恢復遊戲
    if (this.pauseReason === 'portrait' && !this.isGameOver) {
      this.setPauseReason('none');
      if (this.spawnTimer) this.spawnTimer.paused = false;
      this.weaponSystem.resume();
      this.weaponSystem.syncWeapons(this.player);
    }
  }

  /**
   * 觸發死亡流程（Requirement 1.2、14.1）
   * - 設定 isGameOver = true，防止重複觸發
   * - 停止所有遊戲邏輯（isPaused = true）
   * - 停止生成計時器
   * - 暫停武器系統
   * - 計算結算資料並顯示 GameOverPanel
   */
  private triggerGameOver(): void {
    this.isGameOver = true;
    this.setPauseReason('gameover');

    // 停止生成計時器
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }

    // 暫停武器系統
    this.weaponSystem.pause();

    // 移除方向偵測監聽（任務 11）
    if (this.orientationHandler) {
      window.removeEventListener('orientationchange', this.orientationHandler);
      window.removeEventListener('resize', this.orientationHandler);
    }

    // 隱藏直向警告（若顯示中）
    if (this.portraitBg) this.portraitBg.setVisible(false);
    if (this.portraitIcon) this.portraitIcon.setVisible(false);
    if (this.portraitText) this.portraitText.setVisible(false);

    // 計算結算資料（Requirement 14.2、14.3）
    const kills = this.killCount;
    const seconds = Math.floor(this.elapsedSeconds);
    const maxLevel = this.player.level; // 等級只增不減，當前等級即最高等級
    const score = kills * 10 + seconds * 2 + maxLevel * 50;

    // 天命點結算：加入永久存檔（只在結算時寫一次 localStorage）
    MetaProgression.addDestinyPointsAndSave(this.runDestinyPoints);

    const result = {
      survivalSeconds: this.elapsedSeconds,
      killCount: kills,
      maxLevel: maxLevel,
      score: score,
      destinyPoints: this.runDestinyPoints,
      totalDestinyPoints: MetaProgression.getDestinyPoints(),
    };

    // 建立並顯示 GameOverPanel（Requirement 14.1）
    this.gameOverPanel = new GameOverPanel(
      this,
      result,
      () => {
        // 返回主選單：清除遊戲狀態並切換場景（Requirement 14.4）
        this.scene.start('MainMenuScene');
      }
    );
  }

  /**
   * 觸發勝利流程（存活 10 分鐘）
   * - 設定 isVictory = true，防止重複觸發
   * - 停止所有遊戲邏輯
   * - 顯示 VictoryPanel
   */
  private triggerVictory(): void {
    this.isVictory = true;
    this.setPauseReason('victory');

    // 停止生成計時器
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }

    // 暫停武器系統
    this.weaponSystem.pause();

    // 移除方向偵測監聽
    if (this.orientationHandler) {
      window.removeEventListener('orientationchange', this.orientationHandler);
      window.removeEventListener('resize', this.orientationHandler);
    }

    // 隱藏直向警告（若顯示中）
    if (this.portraitBg) this.portraitBg.setVisible(false);
    if (this.portraitIcon) this.portraitIcon.setVisible(false);
    if (this.portraitText) this.portraitText.setVisible(false);

    // 勝利天命點結算（本局 + 100 獎勵），只在此處寫一次 localStorage
    const victoryDestinyPoints = this.runDestinyPoints + 100;
    MetaProgression.addDestinyPointsAndSave(victoryDestinyPoints);

    // 顯示 VictoryPanel（傳入已結算的天命點數字，僅供顯示）
    this.victoryPanel = new VictoryPanel(
      this,
      this.player,
      this.elapsedSeconds,
      this.killCount,
      victoryDestinyPoints, // 僅顯示用，不再重複加入
      () => {
        // 重新開始：回到角色選擇
        this.scene.start('CharacterSelectScene');
      },
      () => {
        // 返回主選單
        this.scene.start('MainMenuScene');
      }
    );
  }

  public pauseGame(): void {
    if (this.pauseReason !== 'none') return;
    this.setPauseReason('manual');
    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.weaponSystem.pause();
    this.pausePanel.show();
  }

  public resumeGame(): void {
    if (this.pauseReason !== 'manual') return;
    this.setPauseReason('none');
    if (this.spawnTimer) this.spawnTimer.paused = false;
    this.weaponSystem.resume();
    this.weaponSystem.syncWeapons(this.player);
    this.checkLevelUp();
  }

  public pauseForLevelUp(): void {
    if (this.pauseReason !== 'none') return;
    this.setPauseReason('levelup');
    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.weaponSystem.pause();
  }

  public resumeFromLevelUp(): void {
    if (this.pauseReason !== 'levelup') return;
    this.setPauseReason('none');
    if (this.spawnTimer) this.spawnTimer.paused = false;
    this.weaponSystem.resume();
    this.weaponSystem.syncWeapons(this.player);
    this.checkLevelUp();
  }

  public pauseForStatus(): void {
    if (this.pauseReason !== 'none') return;
    this.setPauseReason('status');
    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.weaponSystem.pause();
  }

  public resumeFromStatus(): void {
    if (this.pauseReason !== 'status') return;
    this.setPauseReason('none');
    if (this.spawnTimer) this.spawnTimer.paused = false;
    this.weaponSystem.resume();
    this.weaponSystem.syncWeapons(this.player);
  }

  /**
   * 實作 IGameScene 介面：回傳 Phaser.Scene 實例
   */
  public getScene(): Phaser.Scene {
    return this;
  }

  /**
   * 處理敵人死亡（Requirement 6.3）
   * 最小安全流程：防重複 → 保存資料 → 計數 → XP → 移除 → destroy
   */
  private handleEnemyDeath(enemy: Enemy): void {
    // 1. 防重複
    if (!enemy || enemy.deathHandled) return;
    enemy.deathHandled = true;
    enemy.isDying = true;
    console.log('[Death] 1 start');

    // 2. 保存資料（destroy 後不可再讀）
    const deathX = enemy.x;
    const deathY = enemy.y;
    const enemyId = enemy.dataId ?? 'unknown';
    const isElite = enemy.isElite === true;
    const isRanged = enemy.isRanged === true;

    // 取得此敵人的 expDrop 值
    const enemyData = getEnemyById(enemyId);
    const expValue = enemyData?.expDrop ?? 5;
    console.log('[Death] 2 data ok');

    // 3. 計數
    this.killCount++;

    // 4. 天命點（只更新記憶體）
    if (isElite) {
      this.runDestinyPoints += 25;
    } else if (isRanged) {
      this.runDestinyPoints += 2;
    } else {
      this.runDestinyPoints += 1;
    }

    // 5. 生成 XP gem
    if (isElite) {
      // 精英 / Boss：掉落 12 顆 XP gem，每顆 expValue=30，以死亡位置為中心散開
      const ELITE_GEM_COUNT = 12;
      const ELITE_GEM_VALUE = 30;
      for (let i = 0; i < ELITE_GEM_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 60; // 20～80px 散開
        const gx = deathX + Math.cos(angle) * dist;
        const gy = deathY + Math.sin(angle) * dist;
        this.spawnXPGem(gx, gy, ELITE_GEM_VALUE);
      }
    } else {
      // 普通怪：1 顆 XP
      this.spawnXPGem(deathX, deathY, expValue);
    }
    console.log('[Death] 3 xp spawn ok');

    // 5b. 普通怪機率掉落道具（精英不掉落道具）
    if (!isElite) {
      this.trySpawnDropItem(deathX, deathY);
    }

    // 6. 從群組移除
    this.enemyGroup.remove(enemy, false, false);
    console.log('[Death] 4 remove ok');

    // 7. destroy（enemy.destroy() 之後不再讀 enemy 的任何欄位）
    enemy.destroy();
    console.log('[Death] 5 destroy ok');

    console.log('[Death] 6 done');
  }

  /**
   * 在指定位置生成 XPGem
   * 若場上 XPGem 已達上限，移除最舊的一個（design.md 效能限制）
   */
  private spawnXPGem(x: number, y: number, expValue: number): void {
    // 超過上限時移除最舊的 XPGem
    if (this.xpGemGroup.getLength() >= MAX_XP_GEMS) {
      const oldest = this.xpGemGroup.getChildren()[0] as XPGem;
      if (oldest) {
        this.xpGemGroup.remove(oldest, true, true);
      }
    }

    const gem = new XPGem(this, x, y, expValue);
    this.xpGemGroup.add(gem);
  }

  /**
   * 玩家吸收 XPGem（Requirement 9.1、9.2）
   * - 從 xpGemGroup 移除並銷毀
   * - 累加經驗值（等級達 Lv20 時不累加，Requirement 9.4）
   * - 若累加後達到升級門檻，觸發升級流程（Requirement 9.2）
   */
  private absorbXPGem(gem: XPGem): void {
    const baseExp = gem.expValue;

    // 從群組移除並銷毀
    this.xpGemGroup.remove(gem, true, true);

    // 累加經驗值（等級達上限時仍可吸收但不累加）
    if (this.player.level >= MAX_LEVEL) {
      return;
    }

    // 套用 growth 局外加成
    const growthBonus = MetaProgression.getUpgradeBonus('growth');
    const finalExp = Math.floor(baseExp * (1 + growthBonus));

    this.player.currentExp += finalExp;
    this.checkLevelUp();
  }

  /**
   * 檢查並執行升級流程（Requirement 9.2、10.1、10.2、10.3、10.5）
   * 升下一級所需經驗 = 10 + 目前等級 × 5
   * 升級後保留溢出經驗，等級 +1
   * 等級達 Lv20 後停止升級（Requirement 10.5）
   */
  private checkLevelUp(): void {
    // 升級 UI 顯示中，不重複觸發（防止建立多個 LevelUpPanel）
    if (this.pauseReason === 'levelup') return;
    // 遊戲已結束，不觸發升級
    if (this.isGameOver || this.isVictory) return;

    // 無等級上限，持續升級直到經驗不足
    while (this.player.level < MAX_LEVEL) {
      const requiredExp = 10 + this.player.level * 5;
      if (this.player.currentExp < requiredExp) break;

      this.player.currentExp -= requiredExp;
      this.player.level += 1;

      // 觸發升級 UI（每次升級都觸發，不論等級）
      this.levelUpSystem.triggerLevelUp(this.player);
      break; // 一次只處理一次升級，等玩家選完再繼續
    }
  }

  /**
   * 排程下一次敵人生成（依當前難度計算間隔）
   */
  private scheduleNextSpawn(): void {
    // spawnInterval 屬於 normal 類別的生成節奏，使用 'normal' category
    const state = this.difficultyScaler.getState(this.elapsedSeconds, 'normal');
    const interval = Math.max(100, state.spawnInterval); // 最短 100ms

    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.onSpawnTick,
      callbackScope: this,
      loop: false,
    });
  }

  /**
   * 生成計時器回呼：生成一隻敵人，然後排程下一次
   */
  private onSpawnTick(): void {
    this.spawnEnemy();
    this.scheduleNextSpawn();
  }

  /**
   * 生成一批普通小怪（category: 'normal'）
   * - 場上敵人達 state.maxEnemies 上限時跳過生成
   * - 每次生成 state.spawnBatchSize 隻，但不超過上限
   * - 在距玩家 150～200px 且位於畫面外的位置生成
   * - 只使用 category: 'normal' 的敵人資料，不混用 elite / boss
   */
  private spawnEnemy(): void {
    // 取得普通小怪難度狀態（category: 'normal'，套用 enemyHp/Damage/spawnRate/maxEnemy 倍率）
    const state = this.difficultyScaler.getState(this.elapsedSeconds, 'normal');

    // 場上敵人上限：使用公式曲線值，並以 MAX_ENEMIES 作為絕對上限保底
    const currentMax = Math.min(state.maxEnemies, MAX_ENEMIES);
    const currentCount = this.enemyGroup.getLength();
    if (currentCount >= currentMax) {
      return;
    }

    // 本次批次生成數量：不超過剩餘空位
    const remaining = currentMax - currentCount;
    const batchSize = Math.min(state.spawnBatchSize, remaining);

    for (let i = 0; i < batchSize; i++) {
      // 依比例隨機選擇普通小怪種類（只從 category: 'normal' 取資料）
      const enemyId = this.pickEnemyType(state.spawnRatio);
      const enemyData = getEnemyById(enemyId);
      if (!enemyData || enemyData.category !== 'normal') continue;

      // 計算生成位置（Requirement 6.4）
      const { x, y } = this.calcSpawnPosition();

      // 建立敵人實例
      const enemy = new Enemy(
        this,
        x,
        y,
        enemyData,
        state.hpMultiplier,
        state.damageMultiplier
      );

      // 遠程小怪注入射擊回呼
      if (enemy.isRanged) {
        enemy.onRangedShoot = (px, py, vx, vy, dmg) => {
          if (this.rangedProjectiles.length >= this.MAX_RANGED_PROJECTILES) {
            const oldest = this.rangedProjectiles.shift();
            if (oldest && !oldest.isDead) oldest.destroy();
          }
          const proj = new EliteProjectile(this, px, py, vx, vy, dmg);
          this.rangedProjectiles.push(proj);
        };
      }

      this.enemyGroup.add(enemy);
    }
  }

  /**
   * 依生成比例隨機選擇敵人種類 ID
   * ranged 射手：1:30 後加入，比例隨時間增加
   */
  private pickEnemyType(ratio: { basic: number; fast: number; tank: number }): string {
    // 遠程射手比例（1:30 後開始，5:00 後提高）
    let rangedRatio = 0;
    if (this.elapsedSeconds >= 90 && this.elapsedSeconds < 300) {
      rangedRatio = 0.10;
    } else if (this.elapsedSeconds >= 300) {
      rangedRatio = 0.15;
    }

    const r = Math.random();
    if (rangedRatio > 0 && r < rangedRatio) return 'ranged';

    // 剩餘比例分配給原有三種
    const remaining = r - rangedRatio;
    const scale = 1 - rangedRatio;
    const adjBasic = ratio.basic * scale;
    const adjFast  = ratio.fast  * scale;
    if (remaining < adjBasic) return 'basic';
    if (remaining < adjBasic + adjFast) return 'fast';
    return 'tank';
  }

  /**
   * 繪製第一關「山賊營寨」地表背景
   *
   * 使用攝影機尺寸的 tileSprite（非世界尺寸），setScrollFactor(0) 固定在畫面上，
   * 每幀在 _updateInternal 中更新 tilePosition 模擬世界移動感。
   * 這樣可避免建立 6000×6000 的超大 WebGL 紋理導致黑屏或崩潰。
   *
   * depth -100，確保在所有遊戲物件之下。
   * 注意：physics.world.setBounds 已移至 create() 呼叫，不在此處設定。
   */
  private drawGameBackground(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    if (AssetLoader.hasTexture(this, 'bandit_ground_tile')) {
      // 素材存在：建立攝影機尺寸的 tileSprite，固定在畫面上
      // 寬高加 128px 緩衝，避免邊緣露出黑邊
      this.groundTile = this.add.tileSprite(0, 0, W + 128, H + 128, 'bandit_ground_tile')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-100);
      console.log('[GameScene] bandit_ground_tile tileSprite 建立成功');
    } else {
      // 素材不存在：fallback 至純色背景，確保不黑屏
      console.warn('[GameScene] bandit_ground_tile 未載入，使用 fallback 底色');
      const bg = this.add.graphics().setScrollFactor(0).setDepth(-100);
      bg.fillStyle(0x2d4a1e, 1);
      bg.fillRect(0, 0, W, H);
    }

    // 地圖裝飾物（靜態，不可碰撞，depth 0，不每幀更新）
    this.spawnMapDecorations();
  }

  /**
   * 生成地圖裝飾物（碎石、草叢、小石塊）
   * 純視覺，不可碰撞，不每幀更新，scene 關閉時由 Phaser 自動清理
   */
  private spawnMapDecorations(): void {
    const COUNT = 100; // 保守數量，避免影響效能
    const MARGIN = 80; // 距邊界最小距離
    const decG = this.add.graphics().setDepth(0);

    // 預先定義裝飾類型：0=碎石, 1=草叢, 2=小石塊
    const rng = (min: number, max: number) => min + Math.random() * (max - min);

    for (let i = 0; i < COUNT; i++) {
      const x = rng(MARGIN, WORLD_WIDTH - MARGIN);
      const y = rng(MARGIN, WORLD_HEIGHT - MARGIN);

      // 避開地圖中央訓練場（半徑 400px 內不放裝飾）
      const dx = x - WORLD_WIDTH / 2;
      const dy = y - WORLD_HEIGHT / 2;
      if (dx * dx + dy * dy < 400 * 400) continue;

      const type = Math.floor(Math.random() * 3);

      if (type === 0) {
        // 碎石：2～3 個小圓，灰褐色
        const count = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < count; j++) {
          const ox = rng(-6, 6);
          const oy = rng(-4, 4);
          const r = rng(2.5, 5);
          const gray = 0x556655 + Math.floor(Math.random() * 0x111111);
          decG.fillStyle(gray, 0.55);
          decG.fillCircle(x + ox, y + oy, r);
        }
      } else if (type === 1) {
        // 草叢：3～4 條短線，深綠色
        const blades = 3 + Math.floor(Math.random() * 2);
        for (let j = 0; j < blades; j++) {
          const ox = rng(-7, 7);
          const h = rng(5, 10);
          const lean = rng(-3, 3);
          decG.lineStyle(1.5, 0x2a5a2a, 0.5);
          decG.lineBetween(x + ox, y, x + ox + lean, y - h);
        }
      } else {
        // 小石塊：不規則多邊形（用矩形模擬）
        const w = rng(6, 12);
        const h = rng(4, 8);
        const angle = rng(0, Math.PI);
        const col = 0x445544 + Math.floor(Math.random() * 0x111111);
        decG.fillStyle(col, 0.45);
        // 用兩個重疊矩形模擬不規則石塊
        decG.fillRect(x - w / 2, y - h / 2, w, h);
        decG.fillRect(x - w * 0.35, y - h * 0.7, w * 0.7, h * 0.5);
      }
    }
  }

  /**
   * 更新敵人分離向量快取（每 4 幀呼叫一次）
   * 每隻敵人只檢查陣列中前後 8 個索引的鄰居，避免 O(n²) 效能問題
   */
  private updateSeparationCache(enemies: Enemy[]): void {
    const count = enemies.length;

    for (let i = 0; i < count; i++) {
      const enemy = enemies[i];
      if (enemy.isDying) {
        this.separationCache.delete(enemy);
        continue;
      }

      let sepX = 0;
      let sepY = 0;

      // 只檢查前後 8 個索引的鄰居（固定範圍，不檢查全部）
      const checkStart = Math.max(0, i - 8);
      const checkEnd = Math.min(count - 1, i + 8);

      for (let j = checkStart; j <= checkEnd; j++) {
        if (j === i) continue;
        const other = enemies[j];
        if (other.isDying) continue;

        const dx = enemy.x - other.x;
        const dy = enemy.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 距離小於分離半徑時，產生遠離對方的推力
        if (dist < ENEMY_SEPARATION_RADIUS && dist > 0) {
          // 推力強度與距離成反比（越近推力越大）
          const force = (ENEMY_SEPARATION_RADIUS - dist) / ENEMY_SEPARATION_RADIUS;
          sepX += (dx / dist) * force;
          sepY += (dy / dist) * force;
        }
      }

      // 正規化分離向量並乘以強度
      const sepLen = Math.sqrt(sepX * sepX + sepY * sepY);
      if (sepLen > 0) {
        this.separationCache.set(enemy, {
          x: (sepX / sepLen) * ENEMY_SEPARATION_STRENGTH,
          y: (sepY / sepLen) * ENEMY_SEPARATION_STRENGTH,
        });
      } else {
        this.separationCache.set(enemy, { x: 0, y: 0 });
      }
    }

    // 清理已不在場上的敵人快取
    for (const [e] of this.separationCache) {
      if (!enemies.includes(e)) {
        this.separationCache.delete(e);
      }
    }
  }

  /**
   * 生成精英怪（正式版：150/300/450 秒，即 2:30 / 5:00 / 7:30，各一隻）
   * wave 1 → elite_shield（三當家，護盾型）
   * wave 2 → elite_shooter（二當家，遠程型）
   * wave 3 → elite_charger（大當家，衝撞型）
   *
   * 精英怪使用獨立 baseData（category: 'elite'），不借用普通小怪資料。
   * 難度倍率（hpMultiplier / damageMultiplier）仍套用，但不再額外乘以 hpScales。
   */
  private spawnEliteEnemy(wave: number): void {
    // 精英怪使用 category: 'elite'，套用 eliteHp/Damage 倍率
    const state = this.difficultyScaler.getState(this.elapsedSeconds, 'elite');

    // 各波次對應的精英怪 id（category: 'elite'）
    // 出場順序：三當家（shield）→ 二當家（shooter）→ 大當家（charger）
    const eliteIds = ['elite_shield', 'elite_shooter', 'elite_charger'];
    const eliteId = eliteIds[wave - 1] ?? 'elite_shield';
    const baseData = getEnemyById(eliteId);
    if (!baseData) return;

    // 各波次移動速度（與 eliteIds 順序對應：shield=50, shooter=45, charger=70）
    const speeds = [50, 45, 70];
    const eliteSpeed = speeds[wave - 1] ?? 60;

    const { x, y } = this.calcEliteSpawnPosition();

    // 精英怪套用難度倍率，但不再額外乘以 hpScales（數值已內建於 baseData）
    const elite = new Enemy(this, x, y, baseData,
      state.hpMultiplier,
      state.damageMultiplier
    );

    elite.isElite = true;
    elite.moveSpeed = eliteSpeed;
    elite.collisionRadius = baseData.collisionRadius;

    // 指定類型並套用外觀（與 eliteIds 順序對應：shield, shooter, charger）
    const types: Array<'charger' | 'shooter' | 'shield'> = ['shield', 'shooter', 'charger'];
    const eliteType = types[wave - 1] ?? 'shield';
    elite.applyEliteVisual(eliteType);

    // shooter（二當家）注入：投射物 + 黑洞 + 直線攻擊
    if (eliteType === 'shooter') {
      // 投射物生成回呼（加入上限保護）
      elite.onShootProjectile = (px, py, vx, vy, dmg) => {
        // 精英投射物上限：超過時移除最舊
        if (this.eliteProjectiles.length >= 40) {
          const oldest = this.eliteProjectiles.shift();
          if (oldest && !oldest.isDead) oldest.destroy();
        }
        const proj = new EliteProjectile(this, px, py, vx, vy, dmg);
        this.eliteProjectiles.push(proj);
      };

      // 黑洞生成回呼（干擾玩家走位）
      elite.onSpawnBlackHole = (_bossX, _bossY) => {
        // 每輪生成 2～3 個移動小黑洞，以玩家位置為中心（干擾走位）
        const count = 2 + Math.floor(Math.random() * 2); // 2 或 3
        for (let i = 0; i < count; i++) {
          // 超過上限時移除最舊的
          if (this.blackHoleTraps.length >= this.MAX_BLACK_HOLES) {
            const oldest = this.blackHoleTraps.shift();
            if (oldest) oldest.destroy();
          }
          // 在玩家附近 90～180px 隨機位置生成（不直接生在腳下）
          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnDist = 90 + Math.random() * 90; // 90～180px
          const hx = Phaser.Math.Clamp(this.player.x + Math.cos(spawnAngle) * spawnDist, 32, 3200 - 32);
          const hy = Phaser.Math.Clamp(this.player.y + Math.sin(spawnAngle) * spawnDist, 32, 3200 - 32);
          // 移動方向：隨機，速度 35～60px/s
          const moveAngle = Math.random() * Math.PI * 2;
          const moveSpeed = 35 + Math.random() * 25;
          const hole = new BlackHoleTrap(this, hx, hy, 100, 4000, moveAngle, moveSpeed);
          this.blackHoleTraps.push(hole);
        }
      };

      // 外圍直線射擊回呼（主要壓迫技能）
      elite.onLineAttack = (targetX: number, targetY: number, count: number) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnLineAttacks(targetX, targetY, count);
      };
    }

    // shield（三當家）注入：震罡功 + 霸山墜 + 震撼咆哮 + 連續重擊
    if (eliteType === 'shield') {
      // 舊版衝擊波回呼（保留相容性）
      elite.onShockwave = (cx: number, cy: number) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnShockwave(cx, cy, elite.contactDamage);
        elite.shieldEndCast();
      };

      // 震罡功：架盾蓄力震波（新版，傳入 elite 供護盾控制）
      elite.onShieldBurst = (cx: number, cy: number, dmg: number, shieldElite: Enemy) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnShieldBurst(cx, cy, dmg, shieldElite);
      };

      // 霸山墜：跳躍砸地（不改）
      elite.onLeapSlam = (fromX: number, fromY: number, targetX: number, targetY: number, dmg: number) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnLeapSlam(fromX, fromY, targetX, targetY, dmg, elite);
      };

      // 震撼咆哮：扇形蓄力咆哮（新版，傳入方向）
      elite.onWarCry = (cx: number, cy: number, dirX: number, dirY: number, warcryElite: Enemy) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnWarCry(cx, cy, dirX, dirY, warcryElite);
      };

      // 連續重擊：近距離連續打擊（新技能）
      elite.onComboStrike = (cx: number, cy: number, dirX: number, dirY: number, comboElite: Enemy) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnShieldComboStrike(cx, cy, dirX, dirY, comboElite);
      };
    }

    // charger（大當家）注入：霸刀橫斬 + 蠻王衝鋒 + 裂寨三斬 + 連環破甲刺
    if (eliteType === 'charger') {
      // 霸刀橫斬前搖開始：顯示預警扇形（前搖期間讓玩家看到攻擊範圍）
      elite.onChargerMeleeWindupStart = (cx, cy, dirX, dirY, windupMs) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.showChargerMeleeWarning(cx, cy, dirX, dirY, windupMs);
      };

      // 霸刀橫斬：普通近戰攻擊
      elite.onChargerMeleeSlash = (cx, cy, dmg, dirX, dirY) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.doChargerMeleeSlash(cx, cy, dmg, dirX, dirY);
      };

      // 蠻王衝鋒：連續衝刺技能
      elite.onChargerDash = (fromX, fromY, targetX, targetY, charger) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnChargerDash(fromX, fromY, targetX, targetY, charger);
      };

      // 裂寨三斬：連續扇形斬擊
      elite.onChargerTripleSlash = (cx, cy, dirX, dirY, charger) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnChargerTripleSlash(cx, cy, dirX, dirY, charger);
      };

      // 連環破甲刺：連續直線戳擊
      elite.onChargerStab = (cx, cy, dirX, dirY, charger) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnChargerStab(cx, cy, dirX, dirY, charger);
      };
    }

    this.enemyGroup.add(elite);

    const typeNames = ['三當家', '二當家', '大當家'];
    console.log(`[Elite] spawn wave ${wave} (${eliteType})`, Math.round(x), Math.round(y));

    const W = this.scale.width;
    const H = this.scale.height;
    const label = this.add.text(W * 0.5, H * 0.3,
      `⚠ ${typeNames[wave - 1] ?? '精英'}出現！`, {
        fontSize: '22px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(50);

    this.tweens.add({
      targets: label, y: H * 0.25, alpha: 0, duration: 2200, ease: 'Power2',
      onComplete: () => label.destroy(),
    });
  }

  /**
   * 機率掉落道具（普通小怪死亡時呼叫）
   * 測試掉落率 12%（heal 5% / speed 4% / bomb 3%）
   * 正式版建議改回 4%（heal 2% / speed 1% / bomb 1%）
   */
  private trySpawnDropItem(x: number, y: number): void {
    const r = Math.random();
    let type: DropItemType | null = null;
    if      (r < 0.05) type = 'heal';
    else if (r < 0.09) type = 'speed';
    else if (r < 0.12) type = 'bomb';
    if (!type) return;

    if (this.dropItems.length >= this.MAX_DROP_ITEMS) {
      const oldest = this.dropItems.shift();
      if (oldest) oldest.destroy();
    }
    const item = new DropItem(this, x, y, type);
    this.dropItems.push(item);
  }

  /**
   * 套用道具效果
   */
  private applyDropItem(type: DropItemType): void {
    switch (type) {
      case 'heal': {
        const healAmt = Math.max(25, Math.floor(this.player.stats.maxHP * 0.20));
        this.player.currentHP = Math.min(this.player.stats.maxHP, this.player.currentHP + healAmt);
        // 綠色閃光提示
        this.showPickupEffect(this.player.x, this.player.y, 0x00ff66, '+ 回血');
        break;
      }
      case 'speed': {
        // 重複拾取時刷新計時，不永久疊加速度
        const wasActive = this.speedBoostTimer > 0;
        this.speedBoostTimer = this.SPEED_BOOST_DURATION;
        if (!wasActive) {
          // 只在未加速時才套用倍率（避免重複疊加）
          this.player.stats.moveSpeed = this.player.stats.moveSpeed * this.SPEED_BOOST_MULT;
        }
        this.showPickupEffect(this.player.x, this.player.y, 0x00ccff, '+ 加速');
        break;
      }
      case 'bomb': {
        // 清除玩家周圍 260px 的普通敵人
        const BOMB_RADIUS = 260;
        const BOMB_DMG_ELITE = 80;
        const enemies = this.enemyGroup.getChildren() as Enemy[];
        const toKill: Enemy[] = [];
        for (const e of enemies) {
          if (e.isDying) continue;
          const dx = e.x - this.player.x;
          const dy = e.y - this.player.y;
          if (Math.sqrt(dx * dx + dy * dy) <= BOMB_RADIUS) {
            if (e.isElite) {
              e.takeDamage(BOMB_DMG_ELITE);
            } else {
              toKill.push(e);
            }
          }
        }
        for (const e of toKill) this.handleEnemyDeath(e);
        // 爆炸視覺
        this.showBombEffect(this.player.x, this.player.y, BOMB_RADIUS);
        this.showPickupEffect(this.player.x, this.player.y, 0xff8800, '清怪！');
        break;
      }
    }
  }

  /** 道具拾取文字提示 */
  private showPickupEffect(x: number, y: number, color: number, text: string): void {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const t = this.add.text(x, y - 30, text, {
      fontSize: '18px', color: hex, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(25).setScrollFactor(1);
    this.tweens.add({
      targets: t, y: y - 70, alpha: 0, duration: 1000, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  /** bomb 爆炸圓形視覺 */
  private showBombEffect(x: number, y: number, radius: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xff6600, 0.30);
    g.fillCircle(x, y, radius);
    g.lineStyle(3, 0xffd700, 0.8);
    g.strokeCircle(x, y, radius);
    g.setDepth(20);
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 400, ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  /**
   * 生成外圍直線射擊（shooter 二當家技能）
   * 攻擊從玩家周圍外側射向玩家施法瞬間位置
   * @param targetX 施法瞬間玩家 X（鎖定，不追蹤）
   * @param targetY 施法瞬間玩家 Y
   * @param count   本次攻擊道數（1～8）
   */
  private spawnLineAttacks(targetX: number, targetY: number, count: number): void {
    if (this.isPaused || this.isGameOver || this.isVictory) return;
    if (!this.scene.isActive()) return;

    // 攻擊參數
    const START_DIST = 600;   // 攻擊起點距目標點距離（px）
    const LINE_LENGTH = 1100; // 攻擊線長度（px）
    const LINE_WIDTH = 28;    // 攻擊線寬度（px）（原 32，-15%）
    const LINE_DAMAGE = 15;   // 傷害值
    const WARNING_TIME = 800; // 預警時間（ms）（原 700，+15%）

    // 第一道的基礎角度（隨機，讓每次方向不同）
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      // 均勻分布攻擊方向
      const incomingAngle = baseAngle + (i / count) * Math.PI * 2;

      // 起點：從目標點外圍 START_DIST 處
      const startX = targetX + Math.cos(incomingAngle) * START_DIST;
      const startY = targetY + Math.sin(incomingAngle) * START_DIST;

      // 攻擊方向：從外圍射向目標點（反向）
      const attackAngle = incomingAngle + Math.PI;

      const la = new EliteLineAttack(
        this,
        startX, startY,
        attackAngle,
        LINE_LENGTH,
        LINE_WIDTH,
        LINE_DAMAGE,
        WARNING_TIME
      );

      this.lineAttacks.push(la);
      la.showWarning();
    }
  }

  /**
   * 生成衝擊波（shield 三當家近戰強化技能）
   * 以三當家為中心，向外擴散圓形衝擊波，對範圍內玩家造成傷害
   * @param cx     三當家中心 X
   * @param cy     三當家中心 Y
   * @param baseDmg 三當家接觸傷害（衝擊波傷害 = baseDmg × 0.8）
   */
  private spawnShockwave(cx: number, cy: number, baseDmg: number): void {
    if (this.isPaused || this.isGameOver || this.isVictory) return;
    if (!this.scene.isActive()) return;

    const SHOCKWAVE_RADIUS = 160;   // 最終半徑（px）
    const SHOCKWAVE_DAMAGE = Math.ceil(baseDmg * 0.8);
    const WARNING_DURATION = 600;   // 預警時間（ms）
    const ACTIVE_DURATION  = 200;   // 傷害判定時間（ms）

    // ── 預警圓圈（靜態，只畫一次）──────────────────────────────────────
    const warnG = this.add.graphics();
    warnG.setDepth(18);
    warnG.lineStyle(3, 0xff6600, 0.75);
    warnG.strokeCircle(cx, cy, SHOCKWAVE_RADIUS);
    warnG.fillStyle(0xff4400, 0.10);
    warnG.fillCircle(cx, cy, SHOCKWAVE_RADIUS);

    // 預警閃爍
    this.tweens.add({
      targets: warnG,
      alpha: 0.35,
      duration: 150,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 預警結束後啟動傷害判定
    this.time.delayedCall(WARNING_DURATION, () => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        this.tweens.killTweensOf(warnG);
        if (warnG && warnG.active) warnG.destroy();
        return;
      }

      // 移除預警
      this.tweens.killTweensOf(warnG);
      if (warnG && warnG.active) warnG.destroy();

      // ── 攻擊圓圈（亮橘白，快速淡出）──────────────────────────────────
      const atkG = this.add.graphics();
      atkG.setDepth(19);
      atkG.lineStyle(SHOCKWAVE_RADIUS * 0.15, 0xffffff, 0.85);
      atkG.strokeCircle(cx, cy, SHOCKWAVE_RADIUS * 0.6);
      atkG.lineStyle(6, 0xff8800, 0.95);
      atkG.strokeCircle(cx, cy, SHOCKWAVE_RADIUS);
      atkG.fillStyle(0xff6600, 0.18);
      atkG.fillCircle(cx, cy, SHOCKWAVE_RADIUS);

      this.tweens.add({
        targets: atkG,
        alpha: 0,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: ACTIVE_DURATION + 100,
        ease: 'Power2',
        onComplete: () => {
          if (atkG && atkG.active) atkG.destroy();
        },
      });

      // ── 傷害判定：玩家在半徑內則扣血 ──────────────────────────────────
      const dx = this.player.x - cx;
      const dy = this.player.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= SHOCKWAVE_RADIUS + 16) {
        this.player.takeDamage(SHOCKWAVE_DAMAGE, this);
      }
    });
  }

  /**
   * 震罡功：架盾蓄力震波
   * 三當家進入架盾狀態（減傷），蓄力後釋放近距離圓形震波
   */
  private spawnShieldBurst(cx: number, cy: number, dmg: number, elite: Enemy): void {
    if (!this.scene.isActive()) return;

    const BURST_RADIUS = 220;   // 震波半徑（px）
    const SHIELD_DUR   = 1000;  // 架盾時間（ms）
    const BURST_DUR    = 300;   // 爆發持續（ms）

    // ── 啟動護盾（減傷 70%）──────────────────────────────────────────
    elite.shieldActivate();

    // 記錄施放瞬間的位置
    const castX = cx;
    const castY = cy;

    // ── 蓄力預警圈（setPosition + 相對座標，不做 scale tween）──────
    const windupG = this.add.graphics();
    windupG.setPosition(castX, castY);
    windupG.setDepth(18);
    windupG.lineStyle(4, 0xddaa00, 0.85);
    windupG.strokeCircle(0, 0, BURST_RADIUS);
    windupG.fillStyle(0xaa8800, 0.12);
    windupG.fillCircle(0, 0, BURST_RADIUS);
    // 內圈提示
    windupG.lineStyle(2, 0xffcc44, 0.5);
    windupG.strokeCircle(0, 0, BURST_RADIUS * 0.5);

    // alpha 閃爍表示蓄力，不做 scale（避免漂移）
    this.tweens.add({
      targets: windupG,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.time.delayedCall(SHIELD_DUR, () => {
      this.tweens.killTweensOf(windupG);
      if (windupG && windupG.active) windupG.destroy();

      // 關閉護盾
      elite.shieldDeactivate();

      if (this.isPaused || this.isGameOver || this.isVictory) {
        elite.shieldEndCast();
        return;
      }

      // BUG-A4 修正：三當家在蓄力期間死亡則不造成傷害
      if (!elite.active || elite.isDying) {
        elite.shieldEndCast();
        return;
      }

      // RISK-B2 修正（方案 A）：傷害判定固定使用 castX/castY，與預警圈位置一致
      // 預警圈已固定在 castX/castY，傷害判定也用相同位置，避免玩家看到 A 點預警卻在 B 點受傷
      const bx = castX;
      const by = castY;

      // ── 爆發圓圈（setPosition + 相對座標，alpha 淡出，不做 scale）──
      const burstG = this.add.graphics();
      burstG.setPosition(bx, by);
      burstG.setDepth(19);
      burstG.lineStyle(10, 0xffcc00, 0.95);
      burstG.strokeCircle(0, 0, BURST_RADIUS * 0.35);
      burstG.lineStyle(5, 0xffaa00, 0.8);
      burstG.strokeCircle(0, 0, BURST_RADIUS);
      burstG.fillStyle(0xcc9900, 0.20);
      burstG.fillCircle(0, 0, BURST_RADIUS);

      this.tweens.add({
        targets: burstG,
        alpha: 0,
        duration: BURST_DUR + 200,
        ease: 'Power2',
        onComplete: () => { if (burstG && burstG.active) burstG.destroy(); },
      });

      // ── 傷害與擊退判定（以 bx/by 為中心）────────────────────────────
      const dx = this.player.x - bx;
      const dy = this.player.y - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= BURST_RADIUS + 14) {
        this.player.takeDamage(dmg, this);
        if (dist > 1) {
          this.player.applyExternalMove(
            (dx / dist) * 90,
            (dy / dist) * 90
          );
        }
      }

      // 技能結束
      this.time.delayedCall(BURST_DUR, () => { elite.shieldEndCast(); });
    });
  }

  /**
   * 霸山墜：跳躍砸地
   * 三當家跳起後朝玩家位置砸落，落地前有預警圈，落地造成範圍傷害與擊退
   */
  private spawnLeapSlam(fromX: number, fromY: number, targetX: number, targetY: number, dmg: number, elite: Enemy): void {
    if (!this.scene.isActive()) return;

    const SLAM_RADIUS  = 130 + Math.random() * 30; // 130～160px
    const WINDUP_DUR   = 400;  // 起跳前搖（ms）
    const LEAP_DUR     = 700;  // 飛行時間（ms）
    const WARN_DUR     = WINDUP_DUR + LEAP_DUR; // 預警圈顯示時間

    // 落點：玩家當前位置（鎖定）
    const landX = Phaser.Math.Clamp(targetX, 32, WORLD_WIDTH  - 32);
    const landY = Phaser.Math.Clamp(targetY, 32, WORLD_HEIGHT - 32);

    // ── 落點預警圈（橘紅色，持續到落地）──────────────────────────────
    const warnG = this.add.graphics();
    warnG.setDepth(17);
    warnG.lineStyle(3, 0xff4400, 0.8);
    warnG.strokeCircle(landX, landY, SLAM_RADIUS);
    warnG.fillStyle(0xff2200, 0.10);
    warnG.fillCircle(landX, landY, SLAM_RADIUS);

    this.tweens.add({
      targets: warnG,
      alpha: 0.4,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── 起跳：三當家視覺縮小（模擬跳起）──────────────────────────────
    const eliteVisual = (elite as any).visual as Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | undefined;
    if (eliteVisual && eliteVisual.active) {
      this.tweens.add({
        targets: eliteVisual,
        scaleX: 0.7, scaleY: 0.7,
        duration: WINDUP_DUR,
        ease: 'Power1',
      });
    }

    // ── 落地 ──────────────────────────────────────────────────────────
    this.time.delayedCall(WARN_DUR, () => {
      this.tweens.killTweensOf(warnG);
      if (warnG && warnG.active) warnG.destroy();

      if (this.isPaused || this.isGameOver || this.isVictory) {
        if (eliteVisual && eliteVisual.active) eliteVisual.setScale(1);
        elite.shieldEndCast();
        return;
      }

      // BUG-A5 修正：三當家在跳躍期間死亡則不瞬移、不造成傷害
      if (!elite.active || elite.isDying) {
        if (eliteVisual && eliteVisual.active) eliteVisual.setScale(1);
        elite.shieldEndCast();
        return;
      }

      // 三當家瞬移到落點
      if (elite.active && !elite.isDying) {
        elite.setPosition(landX, landY);
        (elite as any).syncVisual?.();
      }

      // 恢復視覺縮放
      if (eliteVisual && eliteVisual.active) {
        this.tweens.add({
          targets: eliteVisual,
          scaleX: 1.3, scaleY: 1.3,
          duration: 80,
          ease: 'Back.Out',
          yoyo: true,
          onComplete: () => { if (eliteVisual && eliteVisual.active) eliteVisual.setScale(1); },
        });
      }

      // ── 落地衝擊波（setPosition + 相對座標，alpha 淡出，不做 scale）──
      const impactG = this.add.graphics();
      impactG.setPosition(landX, landY);
      impactG.setDepth(19);
      impactG.lineStyle(10, 0x885500, 0.95);
      impactG.strokeCircle(0, 0, SLAM_RADIUS * 0.3);
      impactG.lineStyle(5, 0xcc7700, 0.8);
      impactG.strokeCircle(0, 0, SLAM_RADIUS);
      impactG.fillStyle(0x774400, 0.20);
      impactG.fillCircle(0, 0, SLAM_RADIUS);

      this.tweens.add({
        targets: impactG,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => { if (impactG && impactG.active) impactG.destroy(); },
      });

      // ── 傷害與擊退判定 ────────────────────────────────────────────────
      const dx = this.player.x - landX;
      const dy = this.player.y - landY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= SLAM_RADIUS + 14) {
        this.player.takeDamage(dmg, this);
        if (dist > 1) {
          const knockDist = 110;
          this.player.applyExternalMove(
            (dx / dist) * knockDist,
            (dy / dist) * knockDist
          );
        }
      }

      // 技能結束
      this.time.delayedCall(300, () => { elite.shieldEndCast(); });
    });
  }

  /**
   * 震撼咆哮：扇形蓄力咆哮
   * 三當家朝玩家方向蓄力，釋放大範圍扇形咆哮，造成傷害與定身
   * 施放時鎖定方向與位置，不做 scale tween，用 alpha 閃爍預警
   */
  private spawnWarCry(cx: number, cy: number, dirX: number, dirY: number, elite: Enemy): void {
    if (!this.scene.isActive()) return;

    // 施放瞬間鎖定位置與方向
    const castX    = cx;
    const castY    = cy;
    const castDirX = dirX;
    const castDirY = dirY;

    const WARCRY_RADIUS = 380;                          // 扇形距離（px）
    const WARCRY_ANGLE  = Math.PI * (120 / 180);        // 扇形角度 120°
    const WINDUP_DUR    = 900;                          // 蓄力時間（ms）
    const STUN_DUR      = 400 + Math.random() * 300;   // 定身 0.4～0.7 秒
    const WARCRY_DMG    = Math.ceil(elite.contactDamage * 0.55);
    const baseAngle     = Math.atan2(castDirY, castDirX);

    // 繪製扇形（相對座標，原點 = 三當家位置）
    const drawFan = (g: Phaser.GameObjects.Graphics, radius: number, lineColor: number, lineAlpha: number, fillColor: number, fillAlpha: number) => {
      g.lineStyle(3, lineColor, lineAlpha);
      g.fillStyle(fillColor, fillAlpha);
      g.beginPath();
      g.moveTo(0, 0);
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const a = baseAngle - WARCRY_ANGLE * 0.5 + WARCRY_ANGLE * (i / steps);
        g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
      g.closePath();
      g.fillPath();
      g.strokePath();
    };

    // ── 扇形預警（setPosition + 相對座標，不做 scale）──────────────────
    const warnG = this.add.graphics();
    warnG.setPosition(castX, castY);
    warnG.setDepth(17);
    drawFan(warnG, WARCRY_RADIUS, 0xdd2200, 0.8, 0xcc1100, 0.12);
    // 外框線加粗
    warnG.lineStyle(4, 0xff4400, 0.6);
    warnG.strokeCircle(0, 0, WARCRY_RADIUS * 0.15); // 中心小圓提示

    // alpha 閃爍表示蓄力，不做 scale
    this.tweens.add({
      targets: warnG,
      alpha: 0.4,
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.time.delayedCall(WINDUP_DUR, () => {
      this.tweens.killTweensOf(warnG);
      if (warnG && warnG.active) warnG.destroy();

      if (this.isPaused || this.isGameOver || this.isVictory) {
        elite.shieldEndCast();
        return;
      }

      // BUG-A4 修正：三當家在蓄力期間死亡則不造成傷害
      if (!elite.active || elite.isDying) {
        elite.shieldEndCast();
        return;
      }

      // 使用三當家當前位置
      const bx = elite.active ? elite.x : castX;
      const by = elite.active ? elite.y : castY;

      // ── 咆哮爆發視覺（setPosition + 相對座標，alpha 淡出）────────────
      const burstG = this.add.graphics();
      burstG.setPosition(bx, by);
      burstG.setDepth(19);
      drawFan(burstG, WARCRY_RADIUS, 0xff6600, 0.9, 0xff4400, 0.20);
      // 內層更亮
      burstG.lineStyle(5, 0xffdd00, 0.8);
      burstG.beginPath();
      burstG.moveTo(0, 0);
      const steps2 = 20;
      for (let i = 0; i <= steps2; i++) {
        const a = baseAngle - WARCRY_ANGLE * 0.5 + WARCRY_ANGLE * (i / steps2);
        burstG.lineTo(Math.cos(a) * WARCRY_RADIUS * 0.5, Math.sin(a) * WARCRY_RADIUS * 0.5);
      }
      burstG.closePath();
      burstG.strokePath();

      this.tweens.add({
        targets: burstG,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => { if (burstG && burstG.active) burstG.destroy(); },
      });

      // ── 傷害與定身判定（以 bx/by 為中心，castDirX/Y 為方向）──────────
      // 重要：用玩家相對位置做角度判斷，不移動任何物件
      const pdx = this.player.x - bx;
      const pdy = this.player.y - by;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

      if (pdist <= WARCRY_RADIUS + 14) {
        const playerAngle = Math.atan2(pdy, pdx);
        let angleDiff = playerAngle - baseAngle;
        while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) <= WARCRY_ANGLE * 0.5 + 0.05) {
          this.player.takeDamage(WARCRY_DMG, this);
          if (this.playerStunImmunityTimer <= 0) {
            this.playerStunTimer = STUN_DUR;
            if (this.player && (this.player as any).visual) {
              const pv = (this.player as any).visual as Phaser.GameObjects.Image;
              if (pv && pv.active) {
                pv.setTint(0xffff00);
                this.time.delayedCall(STUN_DUR, () => {
                  if (pv && pv.active) pv.clearTint();
                });
              }
            }
          }
        }
      }

      // 技能結束
      this.time.delayedCall(350, () => { elite.shieldEndCast(); });
    });
  }

  /**
   * 連續重擊：三當家朝玩家方向前方範圍連續打擊
   * 站定後朝玩家方向連續打擊 3 次，每次前方矩形範圍判定
   */
  /**
   * 連續重擊：三當家朝玩家方向前方範圍連續打擊
   * 站定後朝玩家方向連續打擊 3 次，每次前方扇形範圍判定
   *
   * BUG-A1 修正：視覺改為扇形，傷害判定也改為扇形（與視覺一致）
   * BUG-A2 修正：每次打擊先顯示預警扇形，STRIKE_WARN_DUR 後才判定傷害
   */
  private spawnShieldComboStrike(cx: number, cy: number, dirX: number, dirY: number, elite: Enemy): void {
    if (!this.scene.isActive()) return;

    const STRIKE_COUNT    = 3;
    const STRIKE_RANGE    = 260;                    // 打擊距離（px）
    const STRIKE_ANGLE    = Math.PI * (80 / 180);  // 80° 扇形（視覺與判定一致）
    const STRIKE_DMG      = Math.ceil(elite.contactDamage * 0.5);
    const WINDUP_DUR      = 400;   // 技能前搖（ms）
    const STRIKE_WARN_DUR = 180;   // 每次打擊預警時間（ms）：先顯示預警，再傷害
    const STRIKE_INTERVAL = 380;   // 每次打擊間隔（ms，從 executeStrike 開始計時）

    // ── 前搖提示（三當家身上出現橘色光圈）──────────────────────────
    const windupG = this.add.graphics();
    windupG.setPosition(cx, cy);
    windupG.setDepth(17);
    windupG.lineStyle(3, 0xff8800, 0.8);
    windupG.strokeCircle(0, 0, 42);
    windupG.fillStyle(0xff6600, 0.12);
    windupG.fillCircle(0, 0, 42);
    this.tweens.add({
      targets: windupG,
      alpha: 0,
      duration: WINDUP_DUR,
      ease: 'Power1',
      onComplete: () => { if (windupG && windupG.active) windupG.destroy(); },
    });

    const executeStrike = (strikeIndex: number) => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        elite.shieldEndCast();
        return;
      }
      if (!elite.active || elite.isDying) {
        elite.shieldEndCast();
        return;
      }

      // 每次打擊以三當家當前位置為基準，並重新朝向玩家
      const bx = elite.x;
      const by = elite.y;
      const pdxDir = this.player.x - bx;
      const pdyDir = this.player.y - by;
      const pDist = Math.sqrt(pdxDir * pdxDir + pdyDir * pdyDir);
      // 每次打擊重新朝向玩家（不固定方向）
      const strikeAngle = pDist > 1
        ? Math.atan2(pdyDir, pdxDir)
        : Math.atan2(dirY, dirX);

      // ── 預警扇形（先顯示，STRIKE_WARN_DUR 後才判定傷害）──────────
      // 視覺與判定使用完全相同的 STRIKE_RANGE / STRIKE_ANGLE
      const warnG = this.add.graphics();
      warnG.setPosition(bx, by);
      warnG.setDepth(17);
      warnG.fillStyle(0xff8800, 0.20);
      warnG.lineStyle(3, 0xffcc00, 0.75);
      warnG.beginPath();
      warnG.moveTo(0, 0);
      const warnSteps = 16;
      for (let i = 0; i <= warnSteps; i++) {
        const a = strikeAngle - STRIKE_ANGLE * 0.5 + STRIKE_ANGLE * (i / warnSteps);
        warnG.lineTo(Math.cos(a) * STRIKE_RANGE, Math.sin(a) * STRIKE_RANGE);
      }
      warnG.closePath();
      warnG.fillPath();
      warnG.strokePath();
      // 中心方向線
      warnG.lineStyle(2, 0xffdd88, 0.6);
      warnG.lineBetween(0, 0, Math.cos(strikeAngle) * STRIKE_RANGE, Math.sin(strikeAngle) * STRIKE_RANGE);

      this.tweens.add({
        targets: warnG,
        alpha: 0,
        delay: STRIKE_WARN_DUR * 0.6,
        duration: STRIKE_WARN_DUR * 0.4 + 100,
        ease: 'Power1',
        onComplete: () => { if (warnG && warnG.active) warnG.destroy(); },
      });

      // ── 預警結束後才執行打擊視覺 + 傷害判定 ──────────────────────
      this.time.delayedCall(STRIKE_WARN_DUR, () => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        if (!elite.active || elite.isDying) return;

        // ── 打擊視覺（橘色扇形，與預警扇形完全一致）──────────────────
        const strikeG = this.add.graphics();
        strikeG.setPosition(bx, by);
        strikeG.setDepth(19);
        strikeG.fillStyle(0xff8800, 0.45);
        strikeG.lineStyle(4, 0xffcc00, 0.95);
        strikeG.beginPath();
        strikeG.moveTo(0, 0);
        const hitSteps = 16;
        for (let i = 0; i <= hitSteps; i++) {
          const a = strikeAngle - STRIKE_ANGLE * 0.5 + STRIKE_ANGLE * (i / hitSteps);
          strikeG.lineTo(Math.cos(a) * STRIKE_RANGE, Math.sin(a) * STRIKE_RANGE);
        }
        strikeG.closePath();
        strikeG.fillPath();
        strikeG.strokePath();
        // 中心線
        strikeG.lineStyle(3, 0xffffff, 0.8);
        strikeG.lineBetween(0, 0, Math.cos(strikeAngle) * STRIKE_RANGE, Math.sin(strikeAngle) * STRIKE_RANGE);

        this.tweens.add({
          targets: strikeG,
          alpha: 0,
          duration: 220,
          ease: 'Power2',
          onComplete: () => { if (strikeG && strikeG.active) strikeG.destroy(); },
        });

        // ── 傷害判定（扇形，與視覺完全一致）──────────────────────────
        // 使用 bx/by（施放時記錄的位置）+ strikeAngle + STRIKE_RANGE/STRIKE_ANGLE
        const playerDx = this.player.x - bx;
        const playerDy = this.player.y - by;
        const playerDist = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
        if (playerDist <= STRIKE_RANGE + 12) {
          const playerAngle = Math.atan2(playerDy, playerDx);
          let angleDiff = playerAngle - strikeAngle;
          while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) <= STRIKE_ANGLE * 0.5 + 0.08) {
            this.player.takeDamage(STRIKE_DMG, this);
          }
        }
      });

      // ── 繼續下一次打擊或結束 ──────────────────────────────────────────
      const nextIndex = strikeIndex + 1;
      if (nextIndex < STRIKE_COUNT) {
        this.time.delayedCall(STRIKE_INTERVAL, () => {
          executeStrike(nextIndex);
        });
      } else {
        this.time.delayedCall(300, () => {
          elite.shieldEndCast();
        });
      }
    };

    // 前搖結束後開始第一次打擊
    this.time.delayedCall(WINDUP_DUR, () => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        elite.shieldEndCast();
        return;
      }
      executeStrike(0);
    });
  }

  /**
   * 普通平砍：三當家近戰攻擊視覺效果
   */
  private doMeleeSlash(cx: number, cy: number, dmg: number): void {
    if (!this.scene.isActive()) return;

    // ── 揮砍弧線視覺（暗黃/土色）──────────────────────────────────────
    const slashG = this.add.graphics();
    slashG.setDepth(19);
    slashG.lineStyle(8, 0xcc8800, 0.9);
    // 以三當家為中心，朝玩家方向畫弧
    const dx = this.player.x - cx;
    const dy = this.player.y - cy;
    const baseAngle = Math.atan2(dy, dx);
    const arcSpread = Math.PI * 0.5; // 90° 弧
    slashG.beginPath();
    const arcR = 55;
    for (let i = 0; i <= 12; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 12);
      const px = cx + Math.cos(a) * arcR;
      const py = cy + Math.sin(a) * arcR;
      if (i === 0) slashG.moveTo(px, py);
      else slashG.lineTo(px, py);
    }
    slashG.strokePath();

    this.tweens.add({
      targets: slashG,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => { if (slashG && slashG.active) slashG.destroy(); },
    });

    // ── 傷害判定 ──────────────────────────────────────────────────────
    const pdx = this.player.x - cx;
    const pdy = this.player.y - cy;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdist <= 85) {
      this.player.takeDamage(dmg, this);
    }
  }

  // ── 大當家（charger）技能 ─────────────────────────────────────────────────
  //
  // ══════════════════════════════════════════════════════════════════════════
  // Elite / Boss 技能可讀性規範（所有新增技能必須遵守）
  // ══════════════════════════════════════════════════════════════════════════
  // 1. 所有 elite / boss 主動技能都必須有 warningTime（預警時間）
  // 2. 所有會造成傷害或控制的技能都必須有範圍提示（Graphics）
  // 3. 預警範圍必須和實際傷害 / 控制範圍一致（使用相同常數）
  // 4. 技能不能瞬發命中玩家，除非是非常小範圍普通接觸攻擊
  // 5. 衝撞、跳砸、扇形、直線、圓形 AoE、怒吼、黑洞都必須有明確 telegraph
  // 6. 技能結束後必須清理 warning graphics（tween onComplete 中 destroy）
  // 7. 非投射物技能的 hitbox 不可以每幀自行漂移
  // 8. 不要把 direction vector 當成 world position
  // 9. 技能開始時應記錄 castX / castY / facingDirX / facingDirY
  // 10. 實際判定應根據 cast position + direction + range / width / angle 計算
  //
  // 判定方式：
  // - 直線 / 長條：castX/castY + facingDir + range/width（投影 + 垂直距離）
  // - 扇形：castX/castY + facingDir + range/angle（atan2 角度差）
  // - 圓形：castX/castY + radius（距離）
  // - 衝撞：衝撞路徑方向線 + 落點圓形，衝撞結束後清理所有物件
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * 霸刀橫斬預警：前搖開始時顯示攻擊範圍扇形（橘紅色半透明）
   * 預警持續整個前搖時間，讓玩家有時間閃避
   * 預警範圍與 doChargerMeleeSlash 的傷害範圍完全一致
   *
   * Elite/Boss 技能可讀性規範：
   * - warningTime = windupMs（前搖時間即預警時間）
   * - 預警範圍 = 傷害範圍（SLASH_RANGE / arcSpread 一致）
   * - 使用 castX/castY + facingDir 計算，不漂移
   * - 技能結束後自動 destroy（tween onComplete）
   */
  private showChargerMeleeWarning(cx: number, cy: number, dirX: number, dirY: number, windupMs: number): void {
    if (!this.scene.isActive()) return;

    // 與 doChargerMeleeSlash 完全一致的範圍常數
    const SLASH_RANGE = 160;
    const arcSpread   = Math.PI * 0.611; // 約 110°
    const baseAngle   = Math.atan2(dirY, dirX);

    const warnG = this.add.graphics();
    warnG.setDepth(17);

    // 扇形填充（橘紅半透明，明顯但不遮擋視線）
    warnG.fillStyle(0xff4400, 0.18);
    warnG.beginPath();
    warnG.moveTo(cx, cy);
    for (let i = 0; i <= 20; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 20);
      warnG.lineTo(cx + Math.cos(a) * SLASH_RANGE, cy + Math.sin(a) * SLASH_RANGE);
    }
    warnG.closePath();
    warnG.fillPath();

    // 扇形邊框（橘紅實線）
    warnG.lineStyle(3, 0xff6600, 0.85);
    warnG.beginPath();
    warnG.moveTo(cx, cy);
    for (let i = 0; i <= 20; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 20);
      warnG.lineTo(cx + Math.cos(a) * SLASH_RANGE, cy + Math.sin(a) * SLASH_RANGE);
    }
    warnG.closePath();
    warnG.strokePath();

    // 弧線外緣（更亮的橘色，強調邊界）
    warnG.lineStyle(2, 0xffaa00, 0.7);
    warnG.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 20);
      const px = cx + Math.cos(a) * SLASH_RANGE;
      const py = cy + Math.sin(a) * SLASH_RANGE;
      if (i === 0) warnG.moveTo(px, py);
      else warnG.lineTo(px, py);
    }
    warnG.strokePath();

    // 預警持續前搖時間，前搖結束時淡出並 destroy
    this.tweens.add({
      targets: warnG,
      alpha: 0,
      delay: windupMs * 0.7,   // 前 70% 時間保持可見
      duration: windupMs * 0.3, // 後 30% 時間淡出
      ease: 'Power1',
      onComplete: () => { if (warnG && warnG.active) warnG.destroy(); },
    });
  }

  /**
   * 霸刀橫斬：大當家普通近戰攻擊
   * 前搖結束後執行重型橫斬，命中造成傷害與小幅擊退
   * 攻擊方向使用前搖開始時記錄的方向（與預警一致，不追蹤玩家）
   *
   * Elite/Boss 技能可讀性規範：
   * - 傷害範圍 = 預警範圍（SLASH_RANGE / arcSpread 與 showChargerMeleeWarning 一致）
   * - 使用 castX/castY（cx/cy）+ facingDir（dirX/dirY）計算，不漂移
   * - 技能結束後 slashG 自動 destroy（tween onComplete）
   */
  private doChargerMeleeSlash(cx: number, cy: number, dmg: number, dirX: number, dirY: number): void {
    if (!this.scene.isActive()) return;

    // 與 showChargerMeleeWarning 完全一致的範圍常數
    const SLASH_RANGE = 160;
    const arcSpread   = Math.PI * 0.611; // 約 110°
    const baseAngle   = Math.atan2(dirY, dirX);

    // ── 重型橫斬弧線視覺（深紅/暗金色）──────────────────────────────
    const slashG = this.add.graphics();
    slashG.setDepth(19);
    // 外層弧（深紅）
    slashG.lineStyle(14, 0xcc2200, 0.95);
    slashG.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 16);
      const px = cx + Math.cos(a) * SLASH_RANGE;
      const py = cy + Math.sin(a) * SLASH_RANGE;
      if (i === 0) slashG.moveTo(px, py);
      else slashG.lineTo(px, py);
    }
    slashG.strokePath();
    // 內層弧（金色）
    slashG.lineStyle(5, 0xffaa00, 0.75);
    slashG.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 16);
      const px = cx + Math.cos(a) * (SLASH_RANGE * 0.6);
      const py = cy + Math.sin(a) * (SLASH_RANGE * 0.6);
      if (i === 0) slashG.moveTo(px, py);
      else slashG.lineTo(px, py);
    }
    slashG.strokePath();
    // 扇形填充（淡紅）
    slashG.fillStyle(0xff2200, 0.10);
    slashG.beginPath();
    slashG.moveTo(cx, cy);
    for (let i = 0; i <= 16; i++) {
      const a = baseAngle - arcSpread * 0.5 + arcSpread * (i / 16);
      slashG.lineTo(cx + Math.cos(a) * SLASH_RANGE, cy + Math.sin(a) * SLASH_RANGE);
    }
    slashG.closePath();
    slashG.fillPath();

    this.tweens.add({
      targets: slashG,
      alpha: 0,
      duration: 250,
      ease: 'Power2',
      onComplete: () => { if (slashG && slashG.active) slashG.destroy(); },
    });

    // ── 傷害與擊退判定（扇形範圍，基於施放位置 cx/cy，不漂移）────────
    const pdx = this.player.x - cx;
    const pdy = this.player.y - cy;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdist <= SLASH_RANGE + 14) {
      // 角度判定：玩家是否在扇形內
      const playerAngle = Math.atan2(pdy, pdx);
      let angleDiff = playerAngle - baseAngle;
      while (angleDiff > Math.PI)  angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) <= arcSpread * 0.5 + 0.1) {
        this.player.takeDamage(dmg, this);
        // 小幅擊退
        if (pdist > 1) {
          this.player.applyExternalMove(
            (pdx / pdist) * 50,
            (pdy / pdist) * 50
          );
        }
      }
    }
  }

  /**
   * 蠻王衝鋒：大當家連續衝刺技能
   * 蓄力後連續衝刺 2 次，每次衝刺前有清楚預警線，落點造成小範圍傷害
   *
   * Elite/Boss 技能可讀性規範：
   * - warningTime = WINDUP_DUR（初始蓄力）+ WARN_DUR（每段衝刺前預警）
   * - 衝刺方向在預警開始時鎖定，不追蹤玩家
   * - 落點傷害基於 endX/endY（固定），不漂移
   * - 所有 warning graphics 在 tween onComplete 中 destroy
   */
  private spawnChargerDash(fromX: number, fromY: number, targetX: number, targetY: number, charger: Enemy): void {
    if (!this.scene.isActive()) return;

    const WINDUP_DUR    = 1200;  // 初始蓄力時間（ms）：1.2 秒
    const WARN_DUR      = 700;   // 每段衝刺前預警時間（ms）：0.7 秒
    const DASH_SPEED    = 250;   // 衝刺速度（px/s）：降低至 250，玩家有充足反應時間
    const DASH_DIST     = 210;   // 單次衝刺距離（px）
    const DASH_DUR      = Math.round((DASH_DIST / DASH_SPEED) * 1000); // 約 840ms
    const IMPACT_RADIUS = 120;   // 落點傷害半徑（px）
    const IMPACT_DMG    = Math.ceil(charger.contactDamage * 0.75);
    const COMBO_COUNT   = 2;     // 固定 2 次衝刺
    const PAUSE_BETWEEN = 450;   // 每次衝刺後停頓（ms）：0.45 秒硬直
    const STAGGER_DUR   = 500;   // 最後衝刺後硬直（ms）

    // ── 蓄力視覺（紅色光圈收縮 + 地面震動線）──────────────────────
    const windupG = this.add.graphics();
    windupG.setDepth(17);
    windupG.lineStyle(5, 0xff2200, 0.9);
    windupG.strokeCircle(fromX, fromY, 60);
    windupG.lineStyle(2, 0xff6600, 0.6);
    windupG.strokeCircle(fromX, fromY, 80);
    windupG.fillStyle(0xff0000, 0.12);
    windupG.fillCircle(fromX, fromY, 60);

    this.tweens.add({
      targets: windupG,
      scaleX: 0.2, scaleY: 0.2,
      alpha: 0.4,
      duration: WINDUP_DUR,
      ease: 'Power2',
      onComplete: () => { if (windupG && windupG.active) windupG.destroy(); },
    });

    // ── 執行連續衝刺 ──────────────────────────────────────────────────
    const executeDash = (dashIndex: number, startX: number, startY: number) => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        charger.chargerEndCast();
        return;
      }
      if (!charger.active || charger.isDying) {
        charger.chargerEndCast();
        return;
      }

      // 計算衝刺方向（鎖定預警開始時的玩家位置，不追蹤）
      const px = this.player.x;
      const py = this.player.y;
      const dx = px - startX;
      const dy = py - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dist > 0 ? dx / dist : 1;
      const dirY = dist > 0 ? dy / dist : 0;

      const endX = Phaser.Math.Clamp(startX + dirX * DASH_DIST, 32, WORLD_WIDTH  - 32);
      const endY = Phaser.Math.Clamp(startY + dirY * DASH_DIST, 32, WORLD_HEIGHT - 32);

      // ── 衝刺方向預警線（存在 WARN_DUR 秒，讓玩家有時間閃避）──────
      const warnG = this.add.graphics();
      warnG.setDepth(17);
      // 方向線（橘紅）
      warnG.lineStyle(4, 0xff4400, 0.85);
      warnG.lineBetween(startX, startY, endX, endY);
      // 落點範圍圈
      warnG.lineStyle(3, 0xffaa00, 0.7);
      warnG.strokeCircle(endX, endY, IMPACT_RADIUS);
      warnG.fillStyle(0xff4400, 0.08);
      warnG.fillCircle(endX, endY, IMPACT_RADIUS);
      // 箭頭指示
      warnG.lineStyle(2, 0xffdd00, 0.6);
      const arrowMidX = startX + dirX * DASH_DIST * 0.6;
      const arrowMidY = startY + dirY * DASH_DIST * 0.6;
      const perpX = -dirY * 12;
      const perpY =  dirX * 12;
      warnG.lineBetween(arrowMidX - perpX, arrowMidY - perpY, arrowMidX + dirX * 20, arrowMidY + dirY * 20);
      warnG.lineBetween(arrowMidX + perpX, arrowMidY + perpY, arrowMidX + dirX * 20, arrowMidY + dirY * 20);

      // 預警線在衝刺開始後淡出
      this.tweens.add({
        targets: warnG,
        alpha: 0,
        delay: WARN_DUR,
        duration: DASH_DUR + 150,
        ease: 'Power1',
        onComplete: () => { if (warnG && warnG.active) warnG.destroy(); },
      });

      // ── 預警結束後執行衝刺 ────────────────────────────────────────────
      this.time.delayedCall(WARN_DUR, () => {
        if (this.isPaused || this.isGameOver || this.isVictory) {
          charger.chargerEndCast();
          return;
        }
        if (!charger.active || charger.isDying) {
          charger.chargerEndCast();
          return;
        }

        // ── 大當家移動（tween 模擬衝刺）──────────────────────────────
        this.tweens.add({
          targets: charger,
          x: endX,
          y: endY,
          duration: DASH_DUR,
          ease: 'Power2.In',
          onUpdate: () => {
            // RISK-B1 修正：charger 死亡後不再繼續 syncVisual
            if (!charger.active || charger.isDying) return;
            (charger as any).syncVisual?.();
          },
          onComplete: () => {
            (charger as any).syncVisual?.();

            // BUG-A3 修正：衝刺途中死亡則不造成落點傷害
            if (!charger.active || charger.isDying) {
              charger.chargerEndCast();
              return;
            }

            // ── 落點衝擊視覺（塵土震地）──────────────────────────────
            const impactG = this.add.graphics();
            impactG.setDepth(18);
            impactG.lineStyle(7, 0xcc4400, 0.95);
            impactG.strokeCircle(endX, endY, IMPACT_RADIUS * 0.35);
            impactG.lineStyle(4, 0xff6600, 0.75);
            impactG.strokeCircle(endX, endY, IMPACT_RADIUS);
            impactG.fillStyle(0x884400, 0.20);
            impactG.fillCircle(endX, endY, IMPACT_RADIUS);
            this.tweens.add({
              targets: impactG,
              scaleX: 1.4, scaleY: 1.4,
              alpha: 0,
              duration: 350,
              ease: 'Power2',
              onComplete: () => { if (impactG && impactG.active) impactG.destroy(); },
            });

            // ── 落點傷害判定（基於 endX/endY，不漂移）────────────────
            const pdx = this.player.x - endX;
            const pdy = this.player.y - endY;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist <= IMPACT_RADIUS + 14) {
              this.player.takeDamage(IMPACT_DMG, this);
              if (pdist > 1) {
                this.player.applyExternalMove(
                  (pdx / pdist) * 60,
                  (pdy / pdist) * 60
                );
              }
            }

            // ── 衝刺殘影（3 個漸隱圓點）──────────────────────────────
            for (let t = 0; t < 3; t++) {
              const trailX = startX + (endX - startX) * ((t + 1) / 4);
              const trailY = startY + (endY - startY) * ((t + 1) / 4);
              const trailG = this.add.graphics();
              trailG.setDepth(16);
              trailG.fillStyle(0xff4400, 0.35 - t * 0.1);
              trailG.fillCircle(trailX, trailY, 20 - t * 4);
              this.tweens.add({
                targets: trailG,
                alpha: 0,
                duration: 280,
                delay: t * 50,
                ease: 'Power1',
                onComplete: () => { if (trailG && trailG.active) trailG.destroy(); },
              });
            }

            // ── 繼續下一次衝刺或結束 ──────────────────────────────────
            const nextIndex = dashIndex + 1;
            if (nextIndex < COMBO_COUNT) {
              this.time.delayedCall(PAUSE_BETWEEN, () => {
                if (this.isPaused || this.isGameOver || this.isVictory) {
                  charger.chargerEndCast();
                  return;
                }
                if (!charger.active || charger.isDying) {
                  charger.chargerEndCast();
                  return;
                }
                // 下一段衝刺重新瞄準玩家當前位置
                executeDash(nextIndex, charger.x, charger.y);
              });
            } else {
              // 最後一次衝刺後硬直
              this.time.delayedCall(STAGGER_DUR, () => {
                charger.chargerEndCast();
              });
            }
          },
        });
      });
    };

    // 蓄力結束後開始第一次衝刺（含預警）
    this.time.delayedCall(WINDUP_DUR, () => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        charger.chargerEndCast();
        return;
      }
      if (!charger.active || charger.isDying) {
        charger.chargerEndCast();
        return;
      }
      executeDash(0, charger.x, charger.y);
    });
  }

  /**
   * 裂寨三斬：大當家連續扇形斬擊
   * 連續揮出三次扇形斬擊，每斬朝向玩家，有間隔
   * 判定基於每斬開始時的 charger.x/y，不漂移
   *
   * Elite/Boss 技能可讀性規範：
   * - 每斬有獨立 warningTime（SLASH_WARN_DUR）
   * - 預警扇形先顯示，SLASH_WARN_DUR 後才判定傷害
   * - 預警範圍 = 傷害範圍（SLASH_RANGE / SLASH_ANGLE 一致）
   * - 每段 previewG 在 tween onComplete 中 destroy
   */
  private spawnChargerTripleSlash(cx: number, cy: number, dirX: number, dirY: number, charger: Enemy): void {
    if (!this.scene.isActive()) return;

    const SLASH_RANGE    = 220;              // 斬擊距離（px）
    const SLASH_ANGLE    = Math.PI * 0.611; // 約 110° 扇形
    const SLASH_DMG      = Math.ceil(charger.contactDamage * 0.65);
    const SLASH_COUNT    = 3;
    const SLASH_WARN_DUR = 320;             // 每斬預警時間（ms）：預警先顯示，之後才傷害
    const SLASH_INTERVAL = 480;             // RISK-B3 修正：增加到 480ms，確保上一斬視覺消失後才開始下一斬預警
    const WINDUP_DUR     = 400;             // 第一斬前搖（ms）

    // ── 前搖提示（大當家身上出現紅色光芒，範圍更大）──────────────
    const windupG = this.add.graphics();
    windupG.setDepth(17);
    windupG.lineStyle(4, 0xff2200, 0.85);
    windupG.strokeCircle(cx, cy, 50);
    windupG.lineStyle(2, 0xff6600, 0.5);
    windupG.strokeCircle(cx, cy, 70);
    windupG.fillStyle(0xff0000, 0.10);
    windupG.fillCircle(cx, cy, 50);
    this.tweens.add({
      targets: windupG,
      alpha: 0,
      duration: WINDUP_DUR,
      ease: 'Power1',
      onComplete: () => { if (windupG && windupG.active) windupG.destroy(); },
    });

    const executeSlash = (slashIndex: number) => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        charger.chargerEndCast();
        return;
      }
      if (!charger.active || charger.isDying) {
        charger.chargerEndCast();
        return;
      }

      // 記錄施放時的位置（判定基於此，不漂移）
      const castX = charger.x;
      const castY = charger.y;

      // 每斬重新朝向玩家
      const pdx = this.player.x - castX;
      const pdy = this.player.y - castY;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      const sDirX = pdist > 0 ? pdx / pdist : dirX;
      const sDirY = pdist > 0 ? pdy / pdist : dirY;
      const baseAngle = Math.atan2(sDirY, sDirX);

      // ── 預警扇形（先顯示，SLASH_WARN_DUR 後才判定傷害）────────────
      const previewG = this.add.graphics();
      previewG.setDepth(17);
      previewG.fillStyle(0xff2200, 0.15);
      previewG.beginPath();
      previewG.moveTo(castX, castY);
      for (let i = 0; i <= 20; i++) {
        const a = baseAngle - SLASH_ANGLE * 0.5 + SLASH_ANGLE * (i / 20);
        previewG.lineTo(castX + Math.cos(a) * SLASH_RANGE, castY + Math.sin(a) * SLASH_RANGE);
      }
      previewG.closePath();
      previewG.fillPath();
      previewG.lineStyle(3, 0xff4400, 0.8);
      previewG.beginPath();
      previewG.moveTo(castX, castY);
      for (let i = 0; i <= 20; i++) {
        const a = baseAngle - SLASH_ANGLE * 0.5 + SLASH_ANGLE * (i / 20);
        previewG.lineTo(castX + Math.cos(a) * SLASH_RANGE, castY + Math.sin(a) * SLASH_RANGE);
      }
      previewG.closePath();
      previewG.strokePath();
      // 弧線外緣
      previewG.lineStyle(2, 0xffaa00, 0.6);
      previewG.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = baseAngle - SLASH_ANGLE * 0.5 + SLASH_ANGLE * (i / 20);
        const px = castX + Math.cos(a) * SLASH_RANGE;
        const py = castY + Math.sin(a) * SLASH_RANGE;
        if (i === 0) previewG.moveTo(px, py);
        else previewG.lineTo(px, py);
      }
      previewG.strokePath();
      this.tweens.add({
        targets: previewG,
        alpha: 0,
        delay: SLASH_WARN_DUR * 0.6,
        duration: SLASH_WARN_DUR * 0.4 + 150,
        ease: 'Power1',
        onComplete: () => { if (previewG && previewG.active) previewG.destroy(); },
      });

      // ── 預警結束後才執行揮刀視覺 + 傷害判定 ──────────────────────
      this.time.delayedCall(SLASH_WARN_DUR, () => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        if (!charger.active || charger.isDying) return;

        // ── 揮刀視覺（深紅弧線，與預警扇形一致）──────────────────────
        const slashG = this.add.graphics();
        slashG.setDepth(19);
        // 外層弧（深紅）
        slashG.lineStyle(12, 0xcc1100, 0.95);
        slashG.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = baseAngle - SLASH_ANGLE * 0.5 + SLASH_ANGLE * (i / 16);
          const px = castX + Math.cos(a) * SLASH_RANGE;
          const py = castY + Math.sin(a) * SLASH_RANGE;
          if (i === 0) slashG.moveTo(px, py);
          else slashG.lineTo(px, py);
        }
        slashG.strokePath();
        // 內層弧（橘金）
        slashG.lineStyle(5, 0xff8800, 0.75);
        slashG.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = baseAngle - SLASH_ANGLE * 0.5 + SLASH_ANGLE * (i / 16);
          const px = castX + Math.cos(a) * (SLASH_RANGE * 0.55);
          const py = castY + Math.sin(a) * (SLASH_RANGE * 0.55);
          if (i === 0) slashG.moveTo(px, py);
          else slashG.lineTo(px, py);
        }
        slashG.strokePath();
        this.tweens.add({
          targets: slashG,
          alpha: 0,
          duration: 160, // RISK-B3 修正：縮短淡出時間，確保在下一斬預警開始前消失
          ease: 'Power2',
          onComplete: () => { if (slashG && slashG.active) slashG.destroy(); },
        });

        // ── 傷害判定（扇形範圍，基於 castX/castY，不漂移）────────────
        const playerDx = this.player.x - castX;
        const playerDy = this.player.y - castY;
        const playerDist = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
        if (playerDist <= SLASH_RANGE + 12) {
          const playerAngle = Math.atan2(playerDy, playerDx);
          let angleDiff = playerAngle - baseAngle;
          while (angleDiff > Math.PI)  angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) <= SLASH_ANGLE * 0.5 + 0.1) {
            this.player.takeDamage(SLASH_DMG, this);
          }
        }
      });

      // ── 繼續下一斬或結束 ──────────────────────────────────────────────
      const nextIndex = slashIndex + 1;
      if (nextIndex < SLASH_COUNT) {
        this.time.delayedCall(SLASH_INTERVAL, () => {
          executeSlash(nextIndex);
        });
      } else {
        // 三斬結束，短暫硬直後回到 idle
        this.time.delayedCall(320, () => {
          charger.chargerEndCast();
        });
      }
    };

    // 前搖結束後開始第一斬
    this.time.delayedCall(WINDUP_DUR, () => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        charger.chargerEndCast();
        return;
      }
      executeSlash(0);
    });
  }

  /**
   * 連環破甲刺：大當家連續直線戳擊
   * 站定後朝玩家方向連續戳擊 4 次，每次前方長條直線攻擊判定
   * 判定基於每次戳擊時的 charger.x/y + 方向向量，不漂移
   *
   * Elite/Boss 技能可讀性規範：
   * - 每次戳擊有獨立 warningTime（STAB_WINDUP）
   * - 預警長條先顯示，STAB_WINDUP 後才判定傷害
   * - 傷害範圍 = 預警範圍（STAB_RANGE / STAB_WIDTH 一致）
   * - 使用 castX/castY + sDirX/sDirY 計算，不漂移
   * - 所有 warnG / stabG 在 tween onComplete 中 destroy
   */
  private spawnChargerStab(cx: number, cy: number, dirX: number, dirY: number, charger: Enemy): void {
    if (!this.scene.isActive()) return;

    const STAB_COUNT    = 4;     // 固定 4 次戳擊
    const STAB_RANGE    = 310;   // 戳擊距離（px）
    const STAB_WIDTH    = 88;    // 攻擊寬度（px，用於判定）
    const STAB_DMG      = Math.ceil(charger.contactDamage * 0.50);
    const STAB_WINDUP   = 280;   // 每次戳擊前搖（ms）：預警顯示時間
    const STAB_INTERVAL = 450;   // 每次戳擊間隔（ms，從 executeStab 開始計時）
    const WINDUP_DUR    = 500;   // 技能前搖（ms）

    // ── 技能前搖提示（大當家身上出現藍白光芒，範圍更大）──────────
    const windupG = this.add.graphics();
    windupG.setDepth(17);
    windupG.lineStyle(4, 0xffffff, 0.75);
    windupG.strokeCircle(cx, cy, 45);
    windupG.lineStyle(2, 0xaaddff, 0.55);
    windupG.strokeCircle(cx, cy, 65);
    windupG.fillStyle(0xaaddff, 0.08);
    windupG.fillCircle(cx, cy, 65);
    this.tweens.add({
      targets: windupG,
      alpha: 0,
      duration: WINDUP_DUR,
      ease: 'Power1',
      onComplete: () => { if (windupG && windupG.active) windupG.destroy(); },
    });

    const executeStab = (stabIndex: number) => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        charger.chargerEndCast();
        return;
      }
      if (!charger.active || charger.isDying) {
        charger.chargerEndCast();
        return;
      }

      // 記錄施放時的位置（判定基於此，不漂移）
      const castX = charger.x;
      const castY = charger.y;

      // 每次戳擊方向可略微修正（不可 360 度瞬間轉向）
      const pdx = this.player.x - castX;
      const pdy = this.player.y - castY;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      // 混合原方向與玩家方向（70% 原方向 + 30% 玩家方向）
      const newDirX = dirX * 0.7 + (pdist > 0 ? pdx / pdist : 0) * 0.3;
      const newDirY = dirY * 0.7 + (pdist > 0 ? pdy / pdist : 0) * 0.3;
      const newLen = Math.sqrt(newDirX * newDirX + newDirY * newDirY);
      const sDirX = newLen > 0 ? newDirX / newLen : dirX;
      const sDirY = newLen > 0 ? newDirY / newLen : dirY;
      // 更新方向供下次使用
      dirX = sDirX;
      dirY = sDirY;

      // 終點基於施放位置 + 方向（固定，不追蹤）
      const endX = castX + sDirX * STAB_RANGE;
      const endY = castY + sDirY * STAB_RANGE;

      // ── 前方直線預警（存在 STAB_WINDUP 時間，讓玩家可側移閃避）──
      const warnG = this.add.graphics();
      warnG.setDepth(17);
      // 寬條半透明填充（明確顯示攻擊寬度）
      warnG.lineStyle(STAB_WIDTH, 0xffffff, 0.12);
      warnG.lineBetween(castX, castY, endX, endY);
      // 中心線（亮藍白）
      warnG.lineStyle(4, 0xaaddff, 0.85);
      warnG.lineBetween(castX, castY, endX, endY);
      // 邊緣線（較細，標示寬度邊界）
      const perpX2 = -sDirY * STAB_WIDTH * 0.5;
      const perpY2 =  sDirX * STAB_WIDTH * 0.5;
      warnG.lineStyle(1.5, 0x88ccff, 0.5);
      warnG.lineBetween(castX + perpX2, castY + perpY2, endX + perpX2, endY + perpY2);
      warnG.lineBetween(castX - perpX2, castY - perpY2, endX - perpX2, endY - perpY2);
      // 終點圓圈提示
      warnG.lineStyle(2, 0x88ccff, 0.6);
      warnG.strokeCircle(endX, endY, STAB_WIDTH * 0.5);
      this.tweens.add({
        targets: warnG,
        alpha: 0,
        delay: STAB_WINDUP * 0.65,
        duration: STAB_WINDUP * 0.35 + 100,
        ease: 'Power1',
        onComplete: () => { if (warnG && warnG.active) warnG.destroy(); },
      });

      // ── 前搖後執行戳擊 ────────────────────────────────────────────────
      this.time.delayedCall(STAB_WINDUP, () => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        if (!charger.active || charger.isDying) return;

        // 戳擊視覺基於施放時記錄的 castX/castY（不用 charger.x/y，避免漂移）
        const stabEndX = castX + sDirX * STAB_RANGE;
        const stabEndY = castY + sDirY * STAB_RANGE;

        // ── 戳擊視覺（白藍色直線氣勁，更粗更長）──────────────────────
        const stabG = this.add.graphics();
        stabG.setDepth(19);
        stabG.lineStyle(STAB_WIDTH * 0.7, 0xaaddff, 0.30);
        stabG.lineBetween(castX, castY, stabEndX, stabEndY);
        stabG.lineStyle(5, 0xffffff, 0.95);
        stabG.lineBetween(castX, castY, stabEndX, stabEndY);
        stabG.lineStyle(2, 0x88ccff, 0.85);
        stabG.lineBetween(castX, castY, stabEndX, stabEndY);
        this.tweens.add({
          targets: stabG,
          alpha: 0,
          duration: 200,
          ease: 'Power2',
          onComplete: () => { if (stabG && stabG.active) stabG.destroy(); },
        });

        // ── 傷害判定（直線矩形範圍，基於 castX/castY，不漂移）────────
        const playerDx = this.player.x - castX;
        const playerDy = this.player.y - castY;
        // 投影到戳擊方向
        const proj = playerDx * sDirX + playerDy * sDirY;
        if (proj >= 0 && proj <= STAB_RANGE + 16) {
          // 垂直距離
          const perpX = playerDx - sDirX * proj;
          const perpY = playerDy - sDirY * proj;
          const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
          if (perpDist <= STAB_WIDTH * 0.5 + 10) {
            this.player.takeDamage(STAB_DMG, this);
          }
        }
      });

      // ── 繼續下一次戳擊或結束 ──────────────────────────────────────────
      const nextIndex = stabIndex + 1;
      if (nextIndex < STAB_COUNT) {
        this.time.delayedCall(STAB_INTERVAL, () => {
          executeStab(nextIndex);
        });
      } else {
        // 全部戳擊結束，短暫硬直後回到 idle
        this.time.delayedCall(380, () => {
          charger.chargerEndCast();
        });
      }
    };

    // 技能前搖結束後開始第一次戳擊
    this.time.delayedCall(WINDUP_DUR, () => {
      if (this.isPaused || this.isGameOver || this.isVictory) {
        charger.chargerEndCast();
        return;
      }
      executeStab(0);
    });
  }

  /**
   * 計算精英怪生成位置：距玩家 350～500px，位於畫面外，限制在世界邊界內
   */
  private calcEliteSpawnPosition(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = 350 + Math.random() * 150; // 350～500px

    let spawnX = this.player.x + Math.cos(angle) * dist;
    let spawnY = this.player.y + Math.sin(angle) * dist;

    // 限制在世界邊界內
    spawnX = Phaser.Math.Clamp(spawnX, 32, WORLD_WIDTH  - 32);
    spawnY = Phaser.Math.Clamp(spawnY, 32, WORLD_HEIGHT - 32);

    return { x: spawnX, y: spawnY };
  }

  /**
   * Enemy Recycle 機制（模仿 Vampire Survivors）
   * 每 800ms 呼叫一次，將距離玩家超過 RECYCLE_DISTANCE 的普通小怪
   * 重新定位到玩家視野外的隨機方向，讓怪物看起來像從其他方向重新湧出。
   *
   * 規則：
   * - 只處理普通小怪（isElite === false）
   * - 精英怪 / Boss 不可 recycle
   * - 不刪除 Enemy 物件，只重設位置（保留 HP、速度、回呼等所有狀態）
   * - 新位置距玩家 RECYCLE_SPAWN_DISTANCE px，落在視野外
   * - 限制在世界邊界內
   */
  private recycleDistantEnemies(): void {
    const enemies = this.enemyGroup.getChildren() as Enemy[];
    const px = this.player.x;
    const py = this.player.y;

    // 取得攝影機可視範圍（用於確保新位置在視野外）
    const cam = this.cameras.main;
    const camHalfW = cam.width  * 0.5;
    const camHalfH = cam.height * 0.5;

    for (const enemy of enemies) {
      // 跳過：死亡中、已標記死亡、精英怪
      if (enemy.isDying || enemy.deathHandled || enemy.isDead) continue;
      if (enemy.isElite) continue; // 精英 / Boss 不 recycle

      // 計算與玩家的距離
      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const distSq = dx * dx + dy * dy;

      if (distSq < RECYCLE_DISTANCE * RECYCLE_DISTANCE) continue; // 距離未超標，跳過

      // 選一個隨機角度，重新定位到玩家視野外
      const angle = Math.random() * Math.PI * 2;
      let newX = px + Math.cos(angle) * RECYCLE_SPAWN_DISTANCE;
      let newY = py + Math.sin(angle) * RECYCLE_SPAWN_DISTANCE;

      // 確保新位置在視野外（若落在畫面內則推到邊緣外）
      const relX = newX - px;
      const relY = newY - py;
      const isInsideView = Math.abs(relX) < camHalfW && Math.abs(relY) < camHalfH;
      if (isInsideView) {
        // 沿同方向推到視野邊緣外
        const pushDist = Math.max(camHalfW, camHalfH) + 20;
        newX = px + Math.cos(angle) * pushDist;
        newY = py + Math.sin(angle) * pushDist;
      }

      // 限制在世界邊界內
      newX = Phaser.Math.Clamp(newX, 16, WORLD_WIDTH  - 16);
      newY = Phaser.Math.Clamp(newY, 16, WORLD_HEIGHT - 16);

      // 重新定位（只移動位置，不重建物件）
      enemy.relocate(newX, newY);
    }
  }

  /**
   * 計算合法的生成位置：
   * 1. 在距玩家 150～200px 的隨機方向上取一點
   * 2. 若該點在畫面可視範圍內，則調整至畫面邊緣外最近的合法位置
   * （Requirement 6.4）
   */
  private calcSpawnPosition(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_DIST_MIN + Math.random() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);

    let spawnX = this.player.x + Math.cos(angle) * dist;
    let spawnY = this.player.y + Math.sin(angle) * dist;

    // 取得攝影機可視範圍（畫面座標轉世界座標）
    const cam = this.cameras.main;
    const camLeft   = cam.scrollX;
    const camRight  = cam.scrollX + cam.width;
    const camTop    = cam.scrollY;
    const camBottom = cam.scrollY + cam.height;

    // 若生成點在畫面內，調整至畫面邊緣外最近的位置
    const isInsideView =
      spawnX > camLeft && spawnX < camRight &&
      spawnY > camTop  && spawnY < camBottom;

    if (isInsideView) {
      // 計算到各邊的距離，選最近的邊推出去
      const dLeft   = spawnX - camLeft;
      const dRight  = camRight - spawnX;
      const dTop    = spawnY - camTop;
      const dBottom = camBottom - spawnY;

      const minDist = Math.min(dLeft, dRight, dTop, dBottom);

      if (minDist === dLeft)        spawnX = camLeft - 1;
      else if (minDist === dRight)  spawnX = camRight + 1;
      else if (minDist === dTop)    spawnY = camTop - 1;
      else                          spawnY = camBottom + 1;
    }

    // 限制在世界邊界內（避免生成在地圖外）
    spawnX = Phaser.Math.Clamp(spawnX, 0, WORLD_WIDTH);
    spawnY = Phaser.Math.Clamp(spawnY, 0, WORLD_HEIGHT);

    return { x: spawnX, y: spawnY };
  }

  /**
   * 清理所有動態物件陣列（scene shutdown / restart 時呼叫）
   * 防止 tween / timer 在場景切換後繼續操作已銷毀物件
   */
  private cleanupDynamicObjects(): void {
    for (const proj of this.eliteProjectiles) {
      if (!proj.isDead) proj.destroy();
    }
    this.eliteProjectiles = [];

    for (const proj of this.rangedProjectiles) {
      if (!proj.isDead) proj.destroy();
    }
    this.rangedProjectiles = [];

    for (const hole of this.blackHoleTraps) {
      if (!hole.isDead) hole.destroy();
    }
    this.blackHoleTraps = [];

    for (const item of this.dropItems) {
      if (!item.isDead) item.destroy();
    }
    this.dropItems = [];

    for (const la of this.lineAttacks) {
      if (!la.isDead) la.destroy();
    }
    this.lineAttacks = [];
  }

  /**
   * 套用局外加成至玩家（在 Player 建立後呼叫）
   * max_hp → 最大生命倍率
   * might → 攻擊力倍率
   * area → 攻擊範圍倍率
   */
  private applyMetaBonusToPlayer(): void {
    const maxHpBonus = MetaProgression.getUpgradeBonus('max_hp');
    const mightBonus = MetaProgression.getUpgradeBonus('might');
    const areaBonus  = MetaProgression.getUpgradeBonus('area');

    if (maxHpBonus > 0) {
      this.player.stats.maxHP = Math.floor(this.player.stats.maxHP * (1 + maxHpBonus));
      this.player.currentHP = this.player.stats.maxHP;
    }
    if (mightBonus > 0) {
      this.player.stats.attackPower = this.player.stats.attackPower * (1 + mightBonus);
    }
    if (areaBonus > 0) {
      this.player.stats.attackRange = this.player.stats.attackRange * (1 + areaBonus);
    }
  }

  /**
   * 建立驚鴻派玩家動畫（wave_stand / wave_run）
   * wave_stand / wave_run 是玩家動畫素材，供 id: 'assassin'（驚鴻派）使用。
   * 使用個別載入的 PNG 幀，透過 frames 陣列指定 texture key。
   * 若幀圖未成功載入，動畫建立會靜默跳過（不影響其他角色）。
   */
  private createPlayerAnimations(): void {
    const anims = this.anims;

    // 避免 scene restart 時重複建立
    if (anims.exists('wave_stand') && anims.exists('wave_run')) return;

    // ── wave_stand（idle）：4 幀，4 fps，循環（wave-idle/01~04）────────
    if (!anims.exists('wave_stand')) {
      // 使用 AssetLoader.hasTexture 排除 __MISSING（404 失敗的圖片）
      const standFrames = ['wave_idle_01', 'wave_idle_02', 'wave_idle_03', 'wave_idle_04']
        .filter(key => AssetLoader.hasTexture(this, key))
        .map(key => ({ key }));

      console.log('[GameScene] wave_stand frames valid:', standFrames.length, '/', 4);

      if (standFrames.length > 0) {
        anims.create({
          key: 'wave_stand',
          frames: standFrames,
          frameRate: 4,
          repeat: -1,
        });
      }
    }

    // ── wave_run：9 幀，12 fps，循環（wave-run/01~09）────────────────
    if (!anims.exists('wave_run')) {
      const runFrames = [
        'wave_run_01', 'wave_run_02', 'wave_run_03', 'wave_run_04', 'wave_run_05',
        'wave_run_06', 'wave_run_07', 'wave_run_08', 'wave_run_09',
      ]
        .filter(key => AssetLoader.hasTexture(this, key))
        .map(key => ({ key }));

      console.log('[GameScene] wave_run frames valid:', runFrames.length, '/', 9);

      if (runFrames.length > 0) {
        anims.create({
          key: 'wave_run',
          frames: runFrames,
          frameRate: 12,
          repeat: -1,
        });
      }
    }

    // ── wave_run：8 幀，8 fps，循環（frames_uniform/run_01~08）────────
    // 使用 frames_uniform 版本（等比例裁切），frameRate 8 降低播放速度避免滑步感
    if (!anims.exists('wave_run')) {
      const runFrames = [
        'wave_run_01', 'wave_run_02', 'wave_run_03', 'wave_run_04',
        'wave_run_05', 'wave_run_06', 'wave_run_07', 'wave_run_08',
      ]
        .filter(key => AssetLoader.hasTexture(this, key))
        .map(key => ({ key }));

      console.log('[GameScene] wave_run frames valid:', runFrames.length, '/', 8);

      if (runFrames.length > 0) {
        anims.create({
          key: 'wave_run',
          frames: runFrames,
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }

  /**
   * 預先生成所有 Sprite Texture（用 Phaser Graphics 繪製後 generateTexture 快取）
   * 只在 texture 不存在時生成，避免 scene restart 重複建立。
   * 若外部 PNG 已載入（enemy_img_<id>），則直接複製為 enemy_<id> key，
   * 否則 fallback 至程式繪製圖形。
   * key 清單：
   *   player_swordsman / player_assassin / player_taoist
   *   enemy_basic / enemy_fast / enemy_tank / enemy_ranged
   *   xp_gem
   *   item_heal / item_speed / item_bomb
   */
  private generateSpriteTextures(): void {
    const tex = this.textures;

    // helper：建立離屏 Graphics（不顯示，只用來 generateTexture）
    const makeG = () => {
      const g = this.add.graphics();
      g.setVisible(false);
      return g;
    };

    // helper：若外部 PNG 已載入，複製為目標 key；否則用 cb 程式繪製
    // 注意：不使用 RenderTexture 複製 PNG（Android WebGL 初始化時可能靜默失敗）
    // 外部 PNG 由 Enemy 建構子直接使用 enemy_img_* key，此處只負責程式繪製 fallback
    const ensureTexture = (
      targetKey: string,
      _externalKey: string | undefined,
      w: number,
      h: number,
      cb: (g: Phaser.GameObjects.Graphics) => void
    ) => {
      if (tex.exists(targetKey)) return; // 已存在，跳過
      // 直接程式繪製（不嘗試複製外部 PNG，避免 Android WebGL 初始化問題）
      const g = makeG();
      cb(g);
      g.generateTexture(targetKey, w, h);
      g.destroy();
    };

    // ── 玩家：劍客（藍色武俠人形，64×64）────────────────────────────────
    ensureTexture('player_swordsman', undefined, 64, 64, (g) => {
      const cx = 32, cy = 32;
      g.fillStyle(0x4488ff, 0.15); g.fillCircle(cx, cy, 22);
      g.fillStyle(0x223366, 1); g.fillRect(cx - 8, cy + 8, 6, 12); g.fillRect(cx + 2, cy + 8, 6, 12);
      g.fillStyle(0x2255aa, 1); g.fillRect(cx - 10, cy - 6, 20, 16);
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - 14, 10);
      g.fillStyle(0xffd700, 1); g.fillRect(cx + 10, cy - 20, 3, 28); g.fillRect(cx + 7, cy - 6, 9, 3);
      g.fillStyle(0xd4af37, 0.8); g.fillRect(cx - 10, cy + 2, 20, 3);
    });

    // ── 玩家：刺客（深紫色輕裝，64×64）──────────────────────────────────
    ensureTexture('player_assassin', undefined, 64, 64, (g) => {
      const cx = 32, cy = 32;
      g.fillStyle(0x8800ff, 0.15); g.fillCircle(cx, cy, 20);
      g.fillStyle(0x220044, 1); g.fillRect(cx - 7, cy + 8, 5, 12); g.fillRect(cx + 2, cy + 8, 5, 12);
      g.fillStyle(0x550088, 1); g.fillRect(cx - 8, cy - 6, 16, 16);
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - 13, 9);
      g.fillStyle(0xcccccc, 1); g.fillRect(cx - 14, cy - 18, 2, 22); g.fillRect(cx + 12, cy - 18, 2, 22);
      g.fillStyle(0xaa44ff, 0.8); g.fillRect(cx - 8, cy + 2, 16, 3);
    });

    // ── 玩家：道士（白灰道袍，64×64）────────────────────────────────────
    ensureTexture('player_taoist', undefined, 64, 64, (g) => {
      const cx = 32, cy = 32;
      g.fillStyle(0xffaa00, 0.15); g.fillCircle(cx, cy, 22);
      g.fillStyle(0xaaaaaa, 1); g.fillRect(cx - 10, cy + 6, 20, 14);
      g.fillStyle(0xdddddd, 1); g.fillRect(cx - 9, cy - 8, 18, 16);
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - 15, 10);
      g.fillStyle(0x333333, 1); g.fillRect(cx - 10, cy - 26, 20, 8); g.fillRect(cx - 3, cy - 30, 6, 6);
      g.fillStyle(0xffdd88, 1); g.fillRect(cx + 10, cy - 16, 2, 20);
      g.fillStyle(0xffffff, 0.7); g.fillRect(cx + 8, cy - 16, 6, 4);
      g.fillStyle(0xffaa00, 0.8); g.fillRect(cx - 9, cy + 2, 18, 3);
    });

    // ── 普通小怪 fallback texture（人形 Q 版，確保無 PNG 時也顯示人形）────
    // key 與 Enemy 建構子的 imgKey 一致（enemy_img_<id>），
    // 若外部 PNG 已載入（AssetLoader.hasTexture 回傳 true），Enemy 會優先使用外部 PNG。
    // 此處只在 key 不存在時生成 fallback，避免覆蓋已載入的真實素材。

    // basic：紅衣邪修小兵（36×36，r=18）
    ensureTexture('enemy_img_basic', undefined, 36, 36, (g) => {
      const cx = 18, cy = 18, r = 18;
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - r * 0.55, r * 0.32);
      g.fillStyle(0xaa1111, 1);
      g.fillRect(cx - r * 0.28, cy - r * 0.87, r * 0.56, r * 0.22);
      g.fillRect(cx - r * 0.1,  cy - r * 1.0,  r * 0.2,  r * 0.15);
      g.fillStyle(0xcc2222, 1); g.fillRect(cx - r * 0.32, cy - r * 0.22, r * 0.64, r * 0.5);
      g.fillStyle(0x880000, 1); g.fillRect(cx - r * 0.32, cy + r * 0.22, r * 0.64, r * 0.1);
      g.fillStyle(0xaa1111, 1);
      g.fillRect(cx - r * 0.28, cy + r * 0.32, r * 0.22, r * 0.38);
      g.fillRect(cx + r * 0.06, cy + r * 0.32, r * 0.22, r * 0.38);
      g.fillStyle(0xdddddd, 1); g.fillRect(cx + r * 0.36, cy - r * 0.3, r * 0.1, r * 0.5);
      g.lineStyle(1.5, 0xff6666, 0.9);
      g.strokeRect(cx - r * 0.32, cy - r * 0.22, r * 0.64, r * 0.5);
    });

    // fast：疾行刺客（28×28，r=14）
    ensureTexture('enemy_img_fast', undefined, 28, 28, (g) => {
      const cx = 14, cy = 14, r = 14;
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - r * 0.6, r * 0.26);
      g.fillStyle(0xff5500, 1);
      g.fillRect(cx - r * 0.22, cy - r * 0.88, r * 0.44, r * 0.18);
      g.fillStyle(0xff6600, 1); g.fillRect(cx - r * 0.24, cy - r * 0.28, r * 0.48, r * 0.52);
      g.fillStyle(0xcc4400, 1);
      g.fillRect(cx - r * 0.22, cy + r * 0.24, r * 0.18, r * 0.42);
      g.fillRect(cx + r * 0.04, cy + r * 0.24, r * 0.18, r * 0.42);
      g.lineStyle(2, 0xffdd44, 1);
      g.lineBetween(cx - r * 1.1, cy - r * 0.1, cx - r * 0.3, cy - r * 0.1);
      g.lineBetween(cx - r * 1.2, cy + r * 0.15, cx - r * 0.3, cy + r * 0.15);
      g.fillStyle(0xcccccc, 1); g.fillRect(cx + r * 0.3, cy - r * 0.35, r * 0.08, r * 0.4);
      g.lineStyle(1.5, 0xffaa44, 0.9);
      g.strokeRect(cx - r * 0.24, cy - r * 0.28, r * 0.48, r * 0.52);
    });

    // tank：重甲力士（48×48，r=24）
    ensureTexture('enemy_img_tank', undefined, 48, 48, (g) => {
      const cx = 24, cy = 24, r = 24;
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - r * 0.52, r * 0.35);
      g.fillStyle(0x880000, 1);
      g.fillRect(cx - r * 0.35, cy - r * 0.88, r * 0.7, r * 0.25);
      g.fillRect(cx - r * 0.12, cy - r * 1.05, r * 0.24, r * 0.18);
      g.fillStyle(0xaa0000, 1);
      g.fillRect(cx - r * 0.55, cy - r * 0.28, r * 0.2, r * 0.22);
      g.fillRect(cx + r * 0.35, cy - r * 0.28, r * 0.2, r * 0.22);
      g.fillStyle(0xcc1111, 1); g.fillRect(cx - r * 0.42, cy - r * 0.18, r * 0.84, r * 0.55);
      g.fillStyle(0x880000, 1);
      g.fillRect(cx - r * 0.42, cy + r * 0.05, r * 0.84, r * 0.07);
      g.fillRect(cx - r * 0.42, cy + r * 0.2,  r * 0.84, r * 0.07);
      g.fillStyle(0xcc8800, 1); g.fillRect(cx - r * 0.42, cy + r * 0.32, r * 0.84, r * 0.1);
      g.fillStyle(0xaa0000, 1);
      g.fillRect(cx - r * 0.38, cy + r * 0.42, r * 0.3, r * 0.42);
      g.fillRect(cx + r * 0.08, cy + r * 0.42, r * 0.3, r * 0.42);
      g.lineStyle(2.5, 0xff4444, 1);
      g.strokeRect(cx - r * 0.42, cy - r * 0.18, r * 0.84, r * 0.55);
    });

    // ranged：紫袍術士（36×36，r=18）
    ensureTexture('enemy_img_ranged', undefined, 36, 36, (g) => {
      const cx = 18, cy = 18, r = 18;
      g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - r * 0.55, r * 0.3);
      g.fillStyle(0x440066, 1);
      g.fillTriangle(cx, cy - r * 1.05, cx - r * 0.28, cy - r * 0.7, cx + r * 0.28, cy - r * 0.7);
      g.fillStyle(0x7700aa, 1); g.fillRect(cx - r * 0.3, cy - r * 0.22, r * 0.6, r * 0.52);
      g.fillStyle(0x660099, 1); g.fillRect(cx - r * 0.36, cy + r * 0.22, r * 0.72, r * 0.22);
      g.fillStyle(0xcc8800, 1); g.fillRect(cx - r * 0.3, cy + r * 0.2, r * 0.6, r * 0.08);
      g.fillStyle(0xdd44ff, 1); g.fillCircle(cx - r * 0.48, cy, r * 0.18);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(cx - r * 0.48, cy, r * 0.08);
      g.fillStyle(0xdd44ff, 1); g.fillCircle(cx + r * 0.48, cy, r * 0.18);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(cx + r * 0.48, cy, r * 0.08);
      g.lineStyle(1.5, 0xcc66ff, 0.9);
      g.strokeRect(cx - r * 0.3, cy - r * 0.22, r * 0.6, r * 0.52);
    });

    // ── XP 經驗球（亮綠發光圓，20×20）───────────────────────────────────
    ensureTexture('xp_gem', undefined, 20, 20, (g) => {
      g.fillStyle(0x44ff88, 0.35); g.fillCircle(10, 10, 8);
      g.fillStyle(0x22ee66, 0.85); g.fillCircle(10, 10, 5);
      g.fillStyle(0xffffff, 0.9);  g.fillCircle(10, 10, 2);
    });

    // ── heal 補包（綠色十字球，32×32）────────────────────────────────────
    ensureTexture('item_heal', undefined, 32, 32, (g) => {
      g.fillStyle(0x00cc44, 0.30); g.fillCircle(16, 16, 14);
      g.fillStyle(0x00ff66, 0.85); g.fillCircle(16, 16, 10);
      g.lineStyle(2, 0x00ff88, 0.9); g.strokeCircle(16, 16, 13);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(14, 9, 4, 14); g.fillRect(9, 14, 14, 4);
    });

    // ── speed 加速（青色閃電球，32×32）───────────────────────────────────
    ensureTexture('item_speed', undefined, 32, 32, (g) => {
      g.fillStyle(0x0088ff, 0.30); g.fillCircle(16, 16, 14);
      g.fillStyle(0x00ccff, 0.85); g.fillCircle(16, 16, 10);
      g.lineStyle(2, 0x44ddff, 0.9); g.strokeCircle(16, 16, 13);
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(18, 8, 12, 17, 16, 17);
      g.fillTriangle(14, 24, 20, 15, 16, 15);
    });

    // ── bomb 清場（紅橙爆炸球，32×32）────────────────────────────────────
    ensureTexture('item_bomb', undefined, 32, 32, (g) => {
      g.fillStyle(0xff4400, 0.30); g.fillCircle(16, 16, 14);
      g.fillStyle(0xff6600, 0.85); g.fillCircle(16, 16, 10);
      g.lineStyle(2, 0xff8800, 0.9); g.strokeCircle(16, 16, 13);
      g.fillStyle(0xffd700, 0.9);
      g.fillTriangle(16, 7, 13, 13, 19, 13);
      g.fillTriangle(16, 25, 13, 19, 19, 19);
      g.fillTriangle(7, 16, 13, 13, 13, 19);
      g.fillTriangle(25, 16, 19, 13, 19, 19);
    });
  }
}
