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

interface GameSceneData {
  characterId: string;
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
const PLAYER_COLLISION_RADIUS = 16;

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
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    // 接收從 CharacterSelectScene 傳入的 characterId（Requirement 4.3）
    this.characterId = data?.characterId ?? '';
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

    // 重置掉落道具、遠程投射物、加速 buff
    this.dropItems = [];
    this.rangedProjectiles = [];
    this.speedBoostTimer = 0;

    // 重置本局天命點
    this.runDestinyPoints = 0;
    this.hpRecoveryTimer = 0;

    // 讀取局外進度
    MetaProgression.load();

    // 重置傷害數字計數器（防止跨場景殘留）
    resetDamageNumberCounter();

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
    this.weaponSystem.init(this.player);

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

    // 場景關閉時清理方向監聽（任務 11）
    this.events.once('shutdown', () => {
      if (this.orientationHandler) {
        window.removeEventListener('orientationchange', this.orientationHandler);
        window.removeEventListener('resize', this.orientationHandler);
      }
      if (this.virtualJoystick) {
        this.virtualJoystick.destroy();
      }
      if (this.playerStatusPanel) {
        this.playerStatusPanel.destroy();
      }
    });
  }

  update(time: number, delta: number): void {
    // 暫停時停止所有遊戲邏輯（Requirement 1.2、1.5）
    if (this.isPaused) return;

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
      if (enemy.currentHP <= 0 || enemy.isDying) {
        if (!enemy.isDying) deadEnemies.push(enemy);
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
          this.player.currentHP -= enemy.contactDamage;
          enemy.lastDamageTime = now;

          // 確保 HP 不低於 0
          if (this.player.currentHP < 0) {
            this.player.currentHP = 0;
          }
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

    // ── 精英怪事件觸發（測試：15 / 30 / 45 秒；正式：150 / 300 / 450 秒）──
    if (!this.eliteSpawned150 && this.elapsedSeconds >= 15) {
      this.eliteSpawned150 = true;
      this.spawnEliteEnemy(1);
    }
    if (!this.eliteSpawned300 && this.elapsedSeconds >= 30) {
      this.eliteSpawned300 = true;
      this.spawnEliteEnemy(2);
    }
    if (!this.eliteSpawned450 && this.elapsedSeconds >= 45) {
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
    const aliveEnemies = enemies.filter(e => !deadEnemies.includes(e) && !e.isDying);
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
        this.player.currentHP = Math.max(0, this.player.currentHP - proj.damage);
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

    // ── 遠程小怪投射物更新與碰撞 ──────────────────────────────────────
    const deadRangedProj: EliteProjectile[] = [];
    for (const proj of this.rangedProjectiles) {
      if (proj.isDead) { deadRangedProj.push(proj); continue; }
      const expired = proj.updateProjectile(delta);
      if (expired) { deadRangedProj.push(proj); continue; }
      const pdx = this.player.x - proj.x;
      const pdy = this.player.y - proj.y;
      if (Math.sqrt(pdx * pdx + pdy * pdy) <= PLAYER_COLLISION_RADIUS + 6) {
        this.player.currentHP = Math.max(0, this.player.currentHP - proj.damage);
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
  }

  /**
   * 建立直向警告 UI 元素（任務 11）
   * 初始隱藏，偵測到直向時顯示
   */
  private createPortraitWarning(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // 黑色背景（覆蓋全畫面）
    this.portraitBg = this.add.rectangle(W * 0.5, H * 0.5, W, H, 0x000000);
    this.portraitBg.setScrollFactor(0);
    this.portraitBg.setDepth(200);
    this.portraitBg.setVisible(false);

    // 旋轉圖示文字（x: W×0.5, y: H×0.38）
    this.portraitIcon = this.add.text(W * 0.5, H * 0.38, '⟳', {
      fontSize: '48px',
      color: '#ffffff',
    });
    this.portraitIcon.setOrigin(0.5, 0.5);
    this.portraitIcon.setScrollFactor(0);
    this.portraitIcon.setDepth(201);
    this.portraitIcon.setVisible(false);

    // 提示文字（x: W×0.5, y: H×0.55）
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
   * 檢查當前螢幕方向，更新直向警告顯示狀態
   */
  private checkOrientation(): void {
    const isPortrait = window.innerWidth < window.innerHeight;

    if (isPortrait === this.isPortrait) return; // 無變化

    this.isPortrait = isPortrait;

    if (isPortrait) {
      this.portraitBg.setVisible(true);
      this.portraitIcon.setVisible(true);
      this.portraitText.setVisible(true);

      // 直向暫停：只在目前未暫停時才暫停，使用獨立的 'portrait' 狀態
      if (this.pauseReason === 'none' && !this.isGameOver) {
        this.pauseReason = 'portrait';
        if (this.spawnTimer) this.spawnTimer.paused = true;
        this.weaponSystem.pause();
      }
    } else {
      this.portraitBg.setVisible(false);
      this.portraitIcon.setVisible(false);
      this.portraitText.setVisible(false);

      // 恢復：只在 portrait 暫停時恢復，不影響 manual / levelup / gameover
      if (this.pauseReason === 'portrait' && !this.isGameOver) {
        this.pauseReason = 'none';
        if (this.spawnTimer) this.spawnTimer.paused = false;
        this.weaponSystem.resume();
        this.weaponSystem.syncWeapons(this.player);
      }
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
    this.pauseReason = 'gameover';

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

    // 天命點結算：加入永久存檔
    MetaProgression.addDestinyPoints(this.runDestinyPoints);

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
    this.pauseReason = 'victory';

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

    // 顯示 VictoryPanel
    this.victoryPanel = new VictoryPanel(
      this,
      this.player,
      this.elapsedSeconds,
      this.killCount,
      this.runDestinyPoints + 100, // 勝利額外 +100 天命點
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

  /**
   * 手動暫停（玩家點擊暫停按鈕）
   * 只在 pauseReason === 'none' 時才暫停，不干擾升級或死亡狀態
   */
  public pauseGame(): void {
    if (this.pauseReason !== 'none') return; // 升級或死亡中，不允許手動暫停覆蓋

    this.pauseReason = 'manual';

    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.weaponSystem.pause();

    // 只有手動暫停才顯示 PausePanel
    this.pausePanel.show();
  }

  /**
   * 手動恢復（點擊「繼續遊戲」）
   * 只解除 manual pause，不影響 levelup 或 gameover
   */
  public resumeGame(): void {
    if (this.pauseReason !== 'manual') return;

    this.pauseReason = 'none';

    if (this.spawnTimer) this.spawnTimer.paused = false;
    this.weaponSystem.resume();
    this.weaponSystem.syncWeapons(this.player);

    // 恢復後檢查是否有溢出升級
    this.checkLevelUp();
  }

  /**
   * 升級專用暫停（由 LevelUpSystem 呼叫）
   * 不顯示 PausePanel，不顯示「已暫停」
   */
  public pauseForLevelUp(): void {
    if (this.pauseReason !== 'none') return; // 防止重複暫停

    this.pauseReason = 'levelup';

    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.weaponSystem.pause();
    // 不呼叫 pausePanel.show()
  }

  /**
   * 升級專用恢復（由 LevelUpSystem 呼叫，玩家選完升級選項後）
   * 只在 pauseReason === 'levelup' 時恢復，不觸發 PausePanel 流程
   */
  public resumeFromLevelUp(): void {
    if (this.pauseReason !== 'levelup') return;

    this.pauseReason = 'none';

    if (this.spawnTimer) this.spawnTimer.paused = false;
    this.weaponSystem.resume();
    this.weaponSystem.syncWeapons(this.player);

    // 恢復後檢查是否有溢出升級（保留溢出經驗處理）
    this.checkLevelUp();
  }

  /**
   * 屬性面板專用暫停（玩家點擊「屬」按鈕）
   * 只在 pauseReason === 'none' 時才暫停
   */
  public pauseForStatus(): void {
    if (this.pauseReason !== 'none') return;

    this.pauseReason = 'status';

    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.weaponSystem.pause();
  }

  /**
   * 屬性面板專用恢復（關閉屬性面板時呼叫）
   * 只在 pauseReason === 'status' 時恢復
   */
  public resumeFromStatus(): void {
    if (this.pauseReason !== 'status') return;

    this.pauseReason = 'none';

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
   * - 從 enemyGroup 移除並銷毀
   * - 在死亡位置生成 XPGem
   * - 更新擊殺計數器
   */
  private handleEnemyDeath(enemy: Enemy): void {
    // 防止同一敵人被重複處理
    if (!this.enemyGroup.contains(enemy)) return;

    const deathX = enemy.x;
    const deathY = enemy.y;

    // 取得此敵人的 expDrop 值
    const enemyData = getEnemyById(enemy.dataId);
    const expValue = enemyData?.expDrop ?? 5;

    // 從群組移除（防止繼續被 update 處理）
    this.enemyGroup.remove(enemy, false, false);

    // 播放死亡特效（特效完成後自動銷毀物件）
    enemy.playDeathEffect();

    // 精英怪掉落多顆 XP gem（散落在死亡位置附近）
    if (enemy.isElite) {
      console.log('[Elite] killed');
      const gemCount = 12;
      for (let i = 0; i < gemCount; i++) {
        const angle = (i / gemCount) * Math.PI * 2;
        const r = 10 + Math.random() * 20;
        this.spawnXPGem(
          deathX + Math.cos(angle) * r,
          deathY + Math.sin(angle) * r,
          30
        );
      }
    } else {
      // 在死亡位置生成 XPGem
      this.spawnXPGem(deathX, deathY, expValue);
      // 機率掉落道具（測試掉落率 12%，正式建議改回 4%）
      this.trySpawnDropItem(deathX, deathY);
    }

    // 更新擊殺計數器
    this.killCount++;

    // 天命點獲取（依敵人類型）
    if (enemy.isElite) {
      this.runDestinyPoints += 25;
    } else if (enemy.isRanged) {
      this.runDestinyPoints += 2;
    } else {
      this.runDestinyPoints += 1;
    }
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
   * 生成精英怪（測試：15/30/45 秒；正式：150/300/450 秒，各一隻）
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

    // shooter 注入投射物生成回呼
    if (eliteType === 'shooter') {
      elite.onShootProjectile = (px, py, vx, vy, dmg) => {
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
        this.speedBoostTimer = this.SPEED_BOOST_DURATION;
        // 直接修改 stats.moveSpeed（乘以倍率）
        this.player.stats.moveSpeed = this.player.stats.moveSpeed * this.SPEED_BOOST_MULT;
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
}
