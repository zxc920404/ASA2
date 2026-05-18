import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { Projectile } from '../objects/Projectile';
import { getWeaponById } from '../data/weapons';
import { PASSIVES } from '../data/passives';

/** 投射物群組上限（Requirement 效能限制） */
const MAX_PROJECTILES = 100;

/** 最近敵人快取更新間隔（毫秒，效能優化） */
const ENEMY_CACHE_INTERVAL = 250;

/** 守心環旋轉速度（弧度/秒） */
const RING_ROTATION_SPEED = 2.0;

/** 守心環旋轉半徑比例（攻擊範圍的 60%） */
const RING_RADIUS_RATIO = 0.6;

/** 守心環對同一敵人的傷害冷卻（毫秒） */
const RING_DAMAGE_COOLDOWN = 500;

/** 赤焰印爆炸半徑（px） */
const FLAME_EXPLOSION_RADIUS = 80;

/** 命中特效同時上限 */
const MAX_HIT_EFFECTS = 30;

/**
 * 守心環環繞體
 * 繞玩家旋轉，碰到敵人造成傷害
 */
interface RingOrb {
  /** Phaser Rectangle 顯示物件 */
  rect: Phaser.GameObjects.Rectangle;
  /** 當前角度（弧度） */
  angle: number;
  /** 對各敵人的最後傷害時間（key: enemy 物件引用，value: 時間戳） */
  lastHitMap: Map<Enemy, number>;
}

/**
 * 武器實例狀態
 */
interface WeaponInstance {
  weaponId: string;
  level: number;
  /** 距離下次攻擊的剩餘時間（毫秒） */
  attackCooldown: number;
  /** 守心環的環繞體列表（僅 guardian_ring 使用） */
  ringOrbs: RingOrb[];
}

/**
 * WeaponSystem
 * 管理玩家所有武器，依攻擊間隔自動發射投射物（Requirement 5.1～5.5）
 */
export class WeaponSystem {
  private scene: Phaser.Scene;

  /** 投射物群組 */
  private projectiles: Projectile[] = [];

  /** 武器實例列表 */
  private weaponInstances: WeaponInstance[] = [];

  /** 最近敵人快取 */
  private cachedEnemies: Enemy[] = [];

  /** 距離下次快取更新的剩餘時間（毫秒） */
  private cacheTimer: number = 0;

  /** 是否暫停（Requirement 5.5） */
  private paused: boolean = false;

  /** 命中特效計數 */
  private activeHitEffects: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 初始化武器系統，依玩家裝備欄建立武器實例
   * @param player 玩家物件
   */
  public init(player: Player): void {
    this.weaponInstances = [];

    for (const slot of player.equipment.weapons) {
      const instance: WeaponInstance = {
        weaponId: slot.weaponId,
        level: slot.level,
        attackCooldown: 0,
        ringOrbs: [],
      };

      // 守心環：預先建立環繞體
      if (slot.weaponId === 'guardian_ring') {
        this.initRingOrbs(instance, slot.level, player);
      }

      this.weaponInstances.push(instance);
    }
  }

  /**
   * 重新同步武器實例（裝備變更後呼叫）
   * @param player 玩家物件
   */
  public syncWeapons(player: Player): void {
    const newInstances: WeaponInstance[] = [];

    for (const slot of player.equipment.weapons) {
      // 尋找現有實例
      const existing = this.weaponInstances.find(w => w.weaponId === slot.weaponId);

      if (existing) {
        // 更新等級
        existing.level = slot.level;

        // 守心環：若等級改變，重建環繞體
        if (slot.weaponId === 'guardian_ring') {
          if (existing.ringOrbs.length !== slot.level) {
            // 移除舊環繞體
            for (const orb of existing.ringOrbs) {
              orb.rect.destroy();
            }
            existing.ringOrbs = [];
            this.initRingOrbs(existing, slot.level, player);
          }
        }

        newInstances.push(existing);
      } else {
        // 新武器
        const instance: WeaponInstance = {
          weaponId: slot.weaponId,
          level: slot.level,
          attackCooldown: 0,
          ringOrbs: [],
        };

        if (slot.weaponId === 'guardian_ring') {
          this.initRingOrbs(instance, slot.level, player);
        }

        newInstances.push(instance);
      }
    }

    // 移除已不在裝備欄的武器（清理環繞體）
    for (const inst of this.weaponInstances) {
      if (!newInstances.includes(inst)) {
        for (const orb of inst.ringOrbs) {
          orb.rect.destroy();
        }
      }
    }

    this.weaponInstances = newInstances;
  }

  /**
   * 暫停所有攻擊計時（Requirement 5.5）
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * 恢復攻擊計時（Requirement 5.5）
   */
  public resume(): void {
    this.paused = false;
  }

  /**
   * 每幀更新（由 GameScene.update() 呼叫）
   * @param time  當前時間戳（毫秒）
   * @param delta 幀時間差（毫秒）
   * @param player 玩家物件
   * @param enemies 場上所有敵人
   * @returns 需要移除的敵人列表（HP ≤ 0）
   */
  public update(
    time: number,
    delta: number,
    player: Player,
    enemies: Enemy[]
  ): Enemy[] {
    const deadEnemies: Enemy[] = [];

    // 暫停時停止所有攻擊行為（Requirement 5.5）
    if (this.paused) {
      // 暫停時仍需更新守心環位置（視覺上停止旋轉）
      for (const inst of this.weaponInstances) {
        if (inst.weaponId === 'guardian_ring') {
          this.updateRingOrbPositions(inst, player);
        }
      }
      return deadEnemies;
    }

    // 更新最近敵人快取（每 250ms 一次）
    this.cacheTimer -= delta;
    if (this.cacheTimer <= 0) {
      this.cacheTimer = ENEMY_CACHE_INTERVAL;
      this.updateEnemyCache(player, enemies);
    }

    // 更新各武器
    for (const inst of this.weaponInstances) {
      const weaponData = getWeaponById(inst.weaponId);
      if (!weaponData) continue;

      // 計算最終攻擊間隔（毫秒）
      const finalInterval = player.stats.attackInterval * 1000;

      // 計算最終攻擊範圍
      const finalRange = player.stats.attackRange;

      // 計算最終傷害（Requirement 5.2）
      const levelDamage = weaponData.baseDamagePerLevel[inst.level - 1] ?? weaponData.baseDamagePerLevel[0];
      const passiveMultiplier = this.getPassiveAttackMultiplier(player);
      const finalDamage = Math.max(1, Math.floor(levelDamage * player.stats.attackPower * passiveMultiplier));

      if (inst.weaponId === 'guardian_ring') {
        // 守心環：更新旋轉位置，檢測碰撞
        this.updateGuardianRing(inst, time, delta, player, enemies, finalRange, finalDamage, deadEnemies);
      } else {
        // 其他武器：倒計時攻擊
        inst.attackCooldown -= delta;

        if (inst.attackCooldown <= 0) {
          // 尋找攻擊範圍內最近的敵人（Requirement 5.4）
          const target = this.findNearestEnemyInRange(player, finalRange);

          if (target) {
            // 發動攻擊
            if (inst.weaponId === 'swift_blade') {
              this.fireSwiftBlade(player, target, finalDamage, weaponData.projectileSpeed, finalRange);
            } else if (inst.weaponId === 'flame_seal') {
              this.fireFlameSeal(player, target, finalDamage, weaponData.projectileSpeed);
            } else {
              // 其他武器：預設直線投射
              this.fireLinearProjectile(player, target, finalDamage, weaponData.projectileSpeed, finalRange, inst.weaponId);
            }
          }
          // 無論是否有目標，重置冷卻（Requirement 5.4：等待下一個攻擊間隔）
          inst.attackCooldown = finalInterval;
        }
      }
    }

    // 更新所有投射物
    const toRemove: Projectile[] = [];
    for (const proj of this.projectiles) {
      const alive = proj.updateProjectile(delta);

      if (!alive) {
        // 赤焰印到期時爆炸
        if (proj.isExplosive && !proj.hasExploded) {
          const killed = this.explodeFlameSeal(proj, enemies, time);
          for (const e of killed) {
            if (!deadEnemies.includes(e)) deadEnemies.push(e);
          }
        }
        toRemove.push(proj);
        continue;
      }

      // 赤焰印：檢查是否到達目標位置
      if (proj.isExplosive && !proj.hasExploded) {
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget < 10) {
          // 到達目標，爆炸
          const killed = this.explodeFlameSeal(proj, enemies, time);
          for (const e of killed) {
            if (!deadEnemies.includes(e)) deadEnemies.push(e);
          }
          proj.hasExploded = true;
          toRemove.push(proj);
          continue;
        }
      }

      // 非爆炸型投射物：檢測命中敵人（Requirement 5.3）
      if (!proj.isExplosive) {
        let hit = false;
        for (const enemy of enemies) {
          if (deadEnemies.includes(enemy)) continue;
          if (enemy.isDying) continue;

          const dx = proj.x - enemy.x;
          const dy = proj.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= enemy.collisionRadius + 8) {
            // 命中！呼叫 takeDamage（扣血 + 閃白 + 傷害數字）
            const died = enemy.takeDamage(proj.damage, proj.x, proj.y);
            if (died && !deadEnemies.includes(enemy)) {
              deadEnemies.push(enemy);
            }
            // 命中特效（小光圈）
            this.spawnHitEffect(proj.x, proj.y);
            hit = true;
            break;
          }
        }

        if (hit) {
          toRemove.push(proj);
        }
      }
    }

    // 移除死亡投射物
    for (const proj of toRemove) {
      this.removeProjectile(proj);
    }

    return deadEnemies;
  }

  /**
   * 清理所有投射物與環繞體（場景切換時呼叫）
   */
  public destroy(): void {
    for (const proj of this.projectiles) {
      proj.destroy();
    }
    this.projectiles = [];

    for (const inst of this.weaponInstances) {
      for (const orb of inst.ringOrbs) {
        orb.rect.destroy();
      }
    }
    this.weaponInstances = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 計算被動攻擊倍率（破勢印）
   */
  private getPassiveAttackMultiplier(player: Player): number {
    let multiplier = 1.0;
    for (const slot of player.equipment.passives) {
      const passive = PASSIVES.find(p => p.id === slot.passiveId);
      if (passive && passive.stat === 'attackPower') {
        multiplier *= (1 + passive.bonusPerLevel * slot.level);
      }
    }
    return multiplier;
  }

  /**
   * 更新最近敵人快取（依距離排序）
   */
  private updateEnemyCache(player: Player, enemies: Enemy[]): void {
    this.cachedEnemies = [...enemies].sort((a, b) => {
      const dxa = a.x - player.x;
      const dya = a.y - player.y;
      const dxb = b.x - player.x;
      const dyb = b.y - player.y;
      return (dxa * dxa + dya * dya) - (dxb * dxb + dyb * dyb);
    });
  }

  /**
   * 在攻擊範圍內尋找最近的敵人（Requirement 5.4）
   */
  private findNearestEnemyInRange(player: Player, range: number): Enemy | null {
    for (const enemy of this.cachedEnemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * 初始化守心環環繞體
   */
  private initRingOrbs(inst: WeaponInstance, count: number, player: Player): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const rect = this.scene.add.rectangle(player.x, player.y, 12, 12, 0xffdd00);
      inst.ringOrbs.push({
        rect,
        angle,
        lastHitMap: new Map(),
      });
    }
  }

  /**
   * 更新守心環環繞體位置（不旋轉，僅跟隨玩家）
   */
  private updateRingOrbPositions(inst: WeaponInstance, player: Player): void {
    const weaponData = getWeaponById(inst.weaponId);
    if (!weaponData) return;
    const radius = weaponData.baseAttackRange * RING_RADIUS_RATIO;

    for (const orb of inst.ringOrbs) {
      orb.rect.x = player.x + Math.cos(orb.angle) * radius;
      orb.rect.y = player.y + Math.sin(orb.angle) * radius;
    }
  }

  /**
   * 更新守心環：旋轉 + 碰撞傷害
   */
  private updateGuardianRing(
    inst: WeaponInstance,
    time: number,
    delta: number,
    player: Player,
    enemies: Enemy[],
    finalRange: number,
    finalDamage: number,
    deadEnemies: Enemy[]
  ): void {
    const weaponData = getWeaponById(inst.weaponId);
    if (!weaponData) return;

    const radius = finalRange * RING_RADIUS_RATIO;
    const dt = delta / 1000;

    for (const orb of inst.ringOrbs) {
      // 旋轉角度
      orb.angle += RING_ROTATION_SPEED * dt;

      // 更新位置
      orb.rect.x = player.x + Math.cos(orb.angle) * radius;
      orb.rect.y = player.y + Math.sin(orb.angle) * radius;

      // 碰撞檢測
      for (const enemy of enemies) {
        if (deadEnemies.includes(enemy)) continue;
        if (enemy.isDying) continue;

        const dx = orb.rect.x - enemy.x;
        const dy = orb.rect.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= enemy.collisionRadius + 6) {
          // 檢查冷卻（每個環繞體對同一敵人 0.5 秒冷卻）
          const lastHit = orb.lastHitMap.get(enemy) ?? -Infinity;
          if (time - lastHit >= RING_DAMAGE_COOLDOWN) {
            const died = enemy.takeDamage(finalDamage, orb.rect.x, orb.rect.y);
            orb.lastHitMap.set(enemy, time);

            if (died && !deadEnemies.includes(enemy)) {
              deadEnemies.push(enemy);
            }
          }
        }
      }

      // 清理已死亡敵人的冷卻記錄（防止 Map 無限增長）
      for (const [e] of orb.lastHitMap) {
        if (!enemies.includes(e)) {
          orb.lastHitMap.delete(e);
        }
      }
    }
  }

  /**
   * 發射疾風刃（直線投射，命中第一個敵人後消失）
   */
  private fireSwiftBlade(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // 存活時間：飛行距離超過攻擊範圍後消失
    const lifeTime = (range / speed) * 1000;

    const proj = new Projectile(
      this.scene,
      player.x,
      player.y,
      damage,
      nx * speed,
      ny * speed,
      lifeTime,
      'swift_blade',
      0x00ffff // 青色
    );

    this.addProjectile(proj);
  }

  /**
   * 發射赤焰印（飛向目標位置，到達後爆炸）
   */
  private fireFlameSeal(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // 存活時間：足夠飛到目標（加一點餘裕）
    const lifeTime = (dist / speed) * 1000 + 500;

    const proj = new Projectile(
      this.scene,
      player.x,
      player.y,
      damage,
      nx * speed,
      ny * speed,
      lifeTime,
      'flame_seal',
      0xff4400, // 橙紅色
      true,     // isExplosive
      FLAME_EXPLOSION_RADIUS,
      target.x,
      target.y
    );

    this.addProjectile(proj);
  }

  /**
   * 發射通用直線投射物（其他武器預設行為）
   */
  private fireLinearProjectile(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    weaponId: string
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const lifeTime = (range / speed) * 1000;

    const proj = new Projectile(
      this.scene,
      player.x,
      player.y,
      damage,
      nx * speed,
      ny * speed,
      lifeTime,
      weaponId,
      0xffffff
    );

    this.addProjectile(proj);
  }

  /**
   * 赤焰印爆炸：對爆炸半徑內所有敵人造成傷害（Requirement 5.3）
   */
  private explodeFlameSeal(proj: Projectile, enemies: Enemy[], _time: number): Enemy[] {
    const killed: Enemy[] = [];

    // 爆炸波紋特效（兩圈擴散圓）
    this.spawnExplosionEffect(proj.x, proj.y, proj.explosionRadius);

    for (const enemy of enemies) {
      if (enemy.isDying) continue;

      const dx = proj.x - enemy.x;
      const dy = proj.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= proj.explosionRadius) {
        const died = enemy.takeDamage(proj.damage, proj.x, proj.y);
        if (died && !killed.includes(enemy)) {
          killed.push(enemy);
        }
      }
    }

    return killed;
  }

  /**
   * 新增投射物，超過上限時移除最舊的
   */
  private addProjectile(proj: Projectile): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      const oldest = this.projectiles.shift();
      if (oldest) oldest.destroy();
    }
    this.projectiles.push(proj);
  }

  /**
   * 移除並銷毀投射物
   */
  private removeProjectile(proj: Projectile): void {
    const idx = this.projectiles.indexOf(proj);
    if (idx !== -1) {
      this.projectiles.splice(idx, 1);
    }
    proj.destroy();
  }

  /**
   * 命中小光圈特效（投射物命中時）
   */
  private spawnHitEffect(x: number, y: number): void {
    if (this.activeHitEffects >= MAX_HIT_EFFECTS) return;
    this.activeHitEffects++;

    const g = this.scene.add.graphics();
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(0, 0, 8);
    g.setPosition(x, y);
    g.setDepth(8);

    this.scene.tweens.add({
      targets: g,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 180,
      ease: 'Power2',
      onComplete: () => {
        g.destroy();
        this.activeHitEffects--;
      },
    });
  }

  /**
   * 爆炸波紋特效（赤焰印）
   */
  private spawnExplosionEffect(x: number, y: number, radius: number): void {
    if (this.activeHitEffects >= MAX_HIT_EFFECTS) return;
    this.activeHitEffects++;

    // 外圈橙色波紋
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0xff6600, 0.85);
    g.strokeCircle(0, 0, radius * 0.5);
    g.fillStyle(0xff4400, 0.25);
    g.fillCircle(0, 0, radius * 0.5);
    g.setPosition(x, y);
    g.setDepth(8);

    this.scene.tweens.add({
      targets: g,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 280,
      ease: 'Power2',
      onComplete: () => {
        g.destroy();
        this.activeHitEffects--;
      },
    });
  }
}
