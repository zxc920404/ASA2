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
import { EliteProjectile } from '../objects/EliteProjectile';
import { BlackHoleTrap } from '../objects/BlackHoleTrap';
import { DropItem, DropItemType } from '../objects/DropItem';
import { MetaProgression } from '../systems/MetaProgression';
import { EliteLineAttack } from '../objects/EliteLineAttack';
import { BGMManager } from '../systems/BGMManager';

interface GameSceneData {
  characterId: string;
  /** 選擇的地圖 ID（目前只有 'qingyuan'，預留給未來擴充） */
  selectedMapId?: string;
}

// 世界尺寸（邊界限制用）
const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 3200;

/** 場上敵人上限（設計層面 80，Requirement 6.5 / design.md） */
const MAX_ENEMIES = 80;

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

/** 最後怪潮敵人上限（比平時多，但仍保守）*/
const MAX_ENEMIES_FINAL_WAVE = 100;

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
  /** 15 秒（測試用）精英怪是否已生成 */
  private eliteSpawned150: boolean = false;
  /** 30 秒（測試用）精英怪是否已生成 */
  private eliteSpawned300: boolean = false;
  /** 45 秒（測試用）精英怪是否已生成 */
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

  // ── 天命點（局外貨幣）────────────────────────────────────────────────
  /** 本局獲得的天命點（死亡或勝利後加入永久存檔） */
  private runDestinyPoints: number = 0;

  // ── 氣血回復計時（ms）────────────────────────────────────────────────
  private hpRecoveryTimer: number = 0;
  private readonly HP_RECOVERY_INTERVAL = 1000; // 每 1 秒回血一次

  // ── Enemy Recycle 計時（ms）──────────────────────────────────────────
  /** 距離過遠的普通小怪重新定位計時器 */
  private recycleTimer: number = 0;

  // ── Debug 顯示 ────────────────────────────────────────────────────────
  private debugText!: Phaser.GameObjects.Text;
  private debugUpdateTimer: number = 0;
  private readonly DEBUG_UPDATE_INTERVAL = 500; // 每 500ms 更新一次
  /** Debug 面板開關：false = 正式遊戲不顯示，true = 開發測試用 */
  private readonly SHOW_DEBUG_HUD = false;
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    // 接收從 MapSelectScene 傳入的 characterId 與 selectedMapId
    this.characterId = data?.characterId ?? '';
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

    // 重置本局天命點
    this.runDestinyPoints = 0;
    this.hpRecoveryTimer = 0;
    this.recycleTimer = 0;

    // 讀取局外進度
    MetaProgression.load();

    // 重置傷害數字計數器（防止跨場景殘留）
    resetDamageNumberCounter();

    // ── 預先生成 Sprite Texture（用 Graphics 繪製後快取）────────────────
    this.generateSpriteTextures();

    // ── 武俠訓練場背景（Polish 3）──────────────────────────────────────
    this.drawGameBackground();

    // 取得角色資料；若找不到則使用預設角色
    const charData = getCharacterById(this.characterId) ?? getCharacterById('swordsman')!;

    // 建立 Player，初始位置於世界中央
    this.player = new Player(this, WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, charData);

    // 套用局外加成至玩家初始屬性
    this.applyMetaBonusToPlayer();

    // 攝影機設定：跟隨玩家，限制在世界邊界內
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

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
      // 停止戰鬥 BGM（淡出後切換到下一場景的 BGM）
      BGMManager.stop(this);
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
    const joystickVec = this.virtualJoystick.getVector();
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

    // ── 精英怪事件觸發（正式版：150 / 300 / 450 秒，即 2:30 / 5:00 / 7:30）──
    if (!this.eliteSpawned150 && this.elapsedSeconds >= 150) {
      this.eliteSpawned150 = true;
      this.spawnEliteEnemy(1);
    }
    if (!this.eliteSpawned300 && this.elapsedSeconds >= 300) {
      this.eliteSpawned300 = true;
      this.spawnEliteEnemy(2);
    }
    if (!this.eliteSpawned450 && this.elapsedSeconds >= 450) {
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
    const state = this.difficultyScaler.getState(this.elapsedSeconds);
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
   * 生成一隻敵人（Requirement 6.4、6.5、7.2）
   * - 場上敵人達上限時跳過生成
   * - 在距玩家 150～200px 且位於畫面外的位置生成
   * - 最後怪潮（9 分鐘後）敵人上限提高至 100
   */
  private spawnEnemy(): void {
    // 場上敵人上限檢查（最後怪潮時提高上限）
    const currentMax = this.elapsedSeconds >= FINAL_WAVE_START_SEC
      ? MAX_ENEMIES_FINAL_WAVE
      : MAX_ENEMIES;
    if (this.enemyGroup.getLength() >= currentMax) {
      return;
    }

    // 取得當前難度狀態
    const state = this.difficultyScaler.getState(this.elapsedSeconds);

    // 依比例隨機選擇敵人種類（Requirement 7.2）
    const enemyId = this.pickEnemyType(state.spawnRatio);
    const enemyData = getEnemyById(enemyId);
    if (!enemyData) return;

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
   * 繪製武俠訓練場背景（Polish 3）
   * 靜態背景，depth -1，不影響效能
   */
  private drawGameBackground(): void {
    const bg = this.add.graphics().setDepth(-1);

    // 底色：深橄欖綠
    bg.fillStyle(0x1a2a1a, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 石板格紋（64×64，深色線條，alpha 降至 0.12 避免干擾戰鬥視覺）
    const gridG = this.add.graphics().setDepth(-1);
    gridG.lineStyle(1, 0x000000, 0.12);
    const tileSize = 64;
    for (let x = 0; x <= WORLD_WIDTH; x += tileSize) {
      gridG.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += tileSize) {
      gridG.lineBetween(0, y, WORLD_WIDTH, y);
    }

    // 地面中央訓練場地標（淡色圓形，alpha 0.12）
    const centerG = this.add.graphics().setDepth(-1);
    centerG.lineStyle(3, 0x4a6a4a, 0.12);
    centerG.strokeCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 200);
    centerG.lineStyle(2, 0x4a6a4a, 0.08);
    centerG.strokeCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 350);
    centerG.fillStyle(0x2a3a2a, 0.10);
    centerG.fillCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 200);

    // 四個角落山林輪廓（深色三角形，alpha 0.4）
    const cornerG = this.add.graphics().setDepth(-1);
    cornerG.fillStyle(0x0a1a0a, 0.4);
    // 左上
    cornerG.fillTriangle(0, 0, 180, 0, 0, 160);
    cornerG.fillTriangle(0, 0, 260, 0, 0, 220);
    // 右上
    cornerG.fillTriangle(WORLD_WIDTH, 0, WORLD_WIDTH - 180, 0, WORLD_WIDTH, 160);
    cornerG.fillTriangle(WORLD_WIDTH, 0, WORLD_WIDTH - 260, 0, WORLD_WIDTH, 220);
    // 左下
    cornerG.fillTriangle(0, WORLD_HEIGHT, 180, WORLD_HEIGHT, 0, WORLD_HEIGHT - 160);
    // 右下
    cornerG.fillTriangle(WORLD_WIDTH, WORLD_HEIGHT, WORLD_WIDTH - 180, WORLD_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT - 160);

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
   * wave 1 → charger（衝撞型）
   * wave 2 → shooter（遠程型）
   * wave 3 → shield（護盾型）
   */
  private spawnEliteEnemy(wave: number): void {
    const state = this.difficultyScaler.getState(this.elapsedSeconds);
    const baseData = getEnemyById('tank');
    if (!baseData) return;

    const hpScales  = [8,   12,  18 ];
    const dmgScales = [1.5, 1.8, 2.2];
    const speeds    = [70,  45,  50 ];   // charger 快一點，shooter/shield 慢
    const hpScale  = hpScales [wave - 1] ?? 8;
    const dmgScale = dmgScales[wave - 1] ?? 1.5;
    const eliteSpeed = speeds[wave - 1] ?? 55;

    const { x, y } = this.calcEliteSpawnPosition();

    const elite = new Enemy(this, x, y, baseData,
      state.hpMultiplier * hpScale,
      state.damageMultiplier * dmgScale
    );

    elite.isElite = true;
    elite.moveSpeed = eliteSpeed;
    elite.collisionRadius = 28;

    // 指定類型並套用外觀
    const types: Array<'charger' | 'shooter' | 'shield'> = ['charger', 'shooter', 'shield'];
    const eliteType = types[wave - 1] ?? 'charger';
    elite.applyEliteVisual(eliteType);

    // shooter 注入投射物生成回呼（加入上限保護）
    if (eliteType === 'shooter') {
      elite.onShootProjectile = (px, py, vx, vy, dmg) => {
        // 精英投射物上限：超過時移除最舊
        if (this.eliteProjectiles.length >= 40) {
          const oldest = this.eliteProjectiles.shift();
          if (oldest && !oldest.isDead) oldest.destroy();
        }
        const proj = new EliteProjectile(this, px, py, vx, vy, dmg);
        this.eliteProjectiles.push(proj);
      };
    }

    // shield 注入黑洞生成回呼
    if (eliteType === 'shield') {
      elite.onSpawnBlackHole = (bossX, bossY) => {
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

      // 注入外圍直線射擊回呼
      elite.onLineAttack = (targetX: number, targetY: number, count: number) => {
        if (this.isPaused || this.isGameOver || this.isVictory) return;
        this.spawnLineAttacks(targetX, targetY, count);
      };
    }

    this.enemyGroup.add(elite);

    const typeNames = ['衝撞型精英', '遠程型精英', '護盾型精英'];
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
   * 生成外圍直線射擊（shield Boss 技能）
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

    // ── 普通小怪 texture 已移除：Enemy 建構子直接使用 Graphics 即時繪製，
    // 不再依賴 generateTexture（Android WebGL 初始化時可能靜默產生空白 texture）

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
