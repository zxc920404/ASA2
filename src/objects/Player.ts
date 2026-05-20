import Phaser from 'phaser';
import { CharacterData, EquipmentSlot, PlayerStats } from '../types/index';
import { calculateStats } from '../systems/StatCalculator';

/** 傷害浮字同時上限 */
const MAX_PLAYER_DAMAGE_NUMBERS = 20;
let activePlayerDamageNumbers = 0;

/**
 * Player 遊戲物件
 * 繼承 Phaser.GameObjects.Rectangle（透明碰撞體，32×32）
 * 視覺圖形由 Image（Sprite Texture）顯示，跟隨 Rectangle 位置
 */
export class Player extends Phaser.GameObjects.Rectangle {
  public characterId: string;
  public currentHP: number;
  public level: number;
  public currentExp: number;
  public equipment: EquipmentSlot;
  public stats: PlayerStats;

  private charData: CharacterData;

  /** 視覺圖形（Image，使用 generateTexture 生成的 key） */
  private visual!: Phaser.GameObjects.Image;

  // ── 受傷回饋狀態 ──────────────────────────────────────────────────────
  /** 無敵幀計時（ms）：> 0 時不受傷 */
  public invincibleTimer: number = 0;
  /** 無敵幀持續時間（ms） */
  private readonly INVINCIBLE_DURATION = 600;
  /** 閃白計時（ms） */
  private hitFlashTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    charData: CharacterData
  ) {
    // 透明碰撞體 32×32（不顯示）
    super(scene, x, y, 32, 32, 0x000000, 0);

    this.charData = charData;
    this.characterId = charData.id;
    this.level = 1;
    this.currentExp = 0;

    // 初始裝備欄：僅持有初始武器 Lv1，被動欄為空（Requirement 4.3）
    this.equipment = {
      weapons: [{ weaponId: charData.startingWeaponId, level: 1 }],
      passives: [],
    };

    // 計算初始屬性
    this.stats = calculateStats(charData, this.equipment);
    this.currentHP = this.stats.maxHP;

    // 加入場景並啟用
    scene.add.existing(this);

    // 建立視覺 Image（使用對應角色的 texture key）
    const textureKey = `player_${charData.id}`;
    // fallback：若 texture 不存在則用 Graphics 繪製
    if (scene.textures.exists(textureKey)) {
      this.visual = scene.add.image(x, y, textureKey);
    } else {
      // fallback：建立 Graphics 並轉為 Image
      this.visual = scene.add.image(x, y, '__DEFAULT');
      this.drawFallbackVisual();
    }
    this.visual.setDepth(5);
    this.visual.setDisplaySize(64, 64);
  }

  /**
   * fallback：texture 不存在時用 Graphics 繪製（不應發生，generateSpriteTextures 已預先生成）
   */
  private drawFallbackVisual(): void {
    // 用 Graphics 直接繪製在 visual 位置（僅作保底）
    const g = this.scene.add.graphics();
    const cx = this.x, cy = this.y;
    g.fillStyle(0x4488ff, 0.15); g.fillCircle(cx, cy, 22);
    g.fillStyle(0x2255aa, 1); g.fillRect(cx - 10, cy - 6, 20, 16);
    g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - 14, 10);
    g.fillStyle(0xffd700, 1); g.fillRect(cx + 10, cy - 20, 3, 28);
    g.setDepth(5);
    // 不儲存 g，讓它留在場景（不影響碰撞）
  }

  /**
   * 同步視覺圖形位置
   */
  private syncVisual(): void {
    if (this.visual && this.visual.active) {
      this.visual.setPosition(this.x, this.y);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 受傷回饋
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 玩家受傷：扣血 + 觸發所有受傷回饋
   * 回傳 true 表示實際扣血（未在無敵幀中）
   * @param damage 傷害量
   * @param scene  GameScene（用於 camera shake）
   */
  public takeDamage(damage: number, scene: Phaser.Scene): boolean {
    // 無敵幀中：不扣血、不觸發回饋
    if (this.invincibleTimer > 0) return false;

    // 扣血
    this.currentHP = Math.max(0, this.currentHP - damage);

    // 啟動無敵幀
    this.invincibleTimer = this.INVINCIBLE_DURATION;

    // 【1】閃白：visual 短暫設為高亮
    if (this.visual && this.visual.active) {
      this.visual.setTint(0xff8888);
      this.hitFlashTimer = 110;
    }

    // 【2】縮放抖動（scale 1.0 → 0.88 → 1.0）
    if (this.visual && this.visual.active && scene.tweens) {
      scene.tweens.add({
        targets: this.visual,
        scaleX: 0.88, scaleY: 0.88,
        duration: 55, ease: 'Power2',
        yoyo: true,
        onComplete: () => {
          if (this.visual && this.visual.active) {
            this.visual.setScale(1);
          }
        },
      });
    }

    // 【3】傷害浮字
    this.showDamageNumber(damage, scene);

    // 【2】Camera shake（由 GameScene 呼叫，這裡觸發事件）
    // 直接在此 shake，避免 GameScene 需要額外監聽
    if (!scene.cameras?.main) return true;
    const cam = scene.cameras.main;
    // 只在非 GameOver 狀態 shake（GameScene 會在 GameOver 後停止更新）
    cam.shake(100, 0.003);

    return true;
  }

  /**
   * 每幀更新受傷回饋計時（由 GameScene.update 呼叫）
   */
  public updateHitFeedback(delta: number): void {
    // 無敵幀倒計時
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer < 0) this.invincibleTimer = 0;
    }

    // 閃白恢復
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.hitFlashTimer = 0;
        if (this.visual && this.visual.active) {
          this.visual.clearTint();
          this.visual.setScale(1);
        }
      }
    }
  }

  /**
   * 顯示玩家受傷浮字（紅色，往上漂浮後消失）
   */
  private showDamageNumber(damage: number, scene: Phaser.Scene): void {
    if (activePlayerDamageNumbers >= MAX_PLAYER_DAMAGE_NUMBERS) return;
    if (!scene || !scene.sys?.isActive()) return;

    activePlayerDamageNumbers++;

    const offsetX = (Math.random() - 0.5) * 20;
    const text = scene.add.text(
      this.x + offsetX,
      this.y - 28,
      `-${damage}`,
      {
        fontSize: '14px',
        color: '#ff4444',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5, 1).setDepth(25);

    scene.tweens.add({
      targets: text,
      y: text.y - 36,
      alpha: 0,
      duration: 700,
      ease: 'Power1',
      onComplete: () => {
        if (text && text.active) text.destroy();
        activePlayerDamageNumbers = Math.max(0, activePlayerDamageNumbers - 1);
      },
    });
  }

  /**
   * 重新計算屬性（裝備變更後呼叫）
   */
  public recalculateStats(): void {
    this.stats = calculateStats(this.charData, this.equipment);
  }

  /**
   * 外部強制位移（黑洞吸引、擊退等效果用）
   * 移動碰撞體並同步視覺圖形
   */
  public applyExternalMove(dx: number, dy: number, worldWidth: number = 3200, worldHeight: number = 3200): void {
    // 防呆：NaN 或 Infinity 直接跳過
    if (!isFinite(dx) || !isFinite(dy)) return;
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const newX = Phaser.Math.Clamp(this.x + dx, halfW, worldWidth - halfW);
    const newY = Phaser.Math.Clamp(this.y + dy, halfH, worldHeight - halfH);
    this.setPosition(newX, newY);
    this.syncVisual();
  }

  /**
   * 每幀移動更新（僅鍵盤輸入，保留向下相容）
   */
  public move(
    cursors: {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
    },
    delta: number,
    worldWidth: number,
    worldHeight: number
  ): void {
    this.moveWithVector(cursors, { x: 0, y: 0 }, delta, worldWidth, worldHeight);
  }

  /**
   * 每幀移動更新（鍵盤 + 搖桿合併輸入）
   */
  public moveWithVector(
    cursors: {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
    },
    joystickVec: { x: number; y: number },
    delta: number,
    worldWidth: number,
    worldHeight: number
  ): void {
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown) vx -= 1;
    if (cursors.right.isDown) vx += 1;
    if (cursors.up.isDown) vy -= 1;
    if (cursors.down.isDown) vy += 1;

    vx += joystickVec.x;
    vy += joystickVec.y;

    if (vx === 0 && vy === 0) return;

    const len = Math.sqrt(vx * vx + vy * vy);
    vx /= len;
    vy /= len;

    const speed = this.stats.moveSpeed;
    const dt = delta / 1000;

    let newX = this.x + vx * speed * dt;
    let newY = this.y + vy * speed * dt;

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    newX = Phaser.Math.Clamp(newX, halfW, worldWidth - halfW);
    newY = Phaser.Math.Clamp(newY, halfH, worldHeight - halfH);

    this.setPosition(newX, newY);
    this.syncVisual();
  }
}
