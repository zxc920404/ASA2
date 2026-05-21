import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { Projectile } from '../objects/Projectile';
import { PoisonCloud } from '../objects/PoisonCloud';
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

/** 同時存在的毒霧數量上限 */
const MAX_POISON_CLOUDS = 8;

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

  /** 毒霧區域列表（毒霧散用） */
  private poisonClouds: PoisonCloud[] = [];

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

      // 守心環：預先建立環繞體（數量從 levelStats.count 讀取，套用 amountBonus）
      if (slot.weaponId === 'guardian_ring') {
        const weaponData = getWeaponById(slot.weaponId);
        const baseCount = weaponData?.levelStats[slot.level - 1]?.count ?? 1;
        const amountBonus = weaponData?.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
        const orbCount = Math.max(1, baseCount + amountBonus);
        this.initRingOrbs(instance, orbCount, player);
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

        // 守心環：若等級改變，重建環繞體（數量從 levelStats.count 讀取，套用 amountBonus）
        if (slot.weaponId === 'guardian_ring') {
          const weaponData = getWeaponById(slot.weaponId);
          const baseCount = weaponData?.levelStats[slot.level - 1]?.count ?? 1;
          const amountBonus = weaponData?.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
          const newCount = Math.max(1, baseCount + amountBonus);
          if (existing.ringOrbs.length !== newCount) {
            // 移除舊環繞體
            for (const orb of existing.ringOrbs) {
              orb.rect.destroy();
            }
            existing.ringOrbs = [];
            this.initRingOrbs(existing, newCount, player);
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
          const weaponData = getWeaponById(slot.weaponId);
          const baseCount = weaponData?.levelStats[slot.level - 1]?.count ?? 1;
          const amountBonus = weaponData?.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
          const orbCount = Math.max(1, baseCount + amountBonus);
          this.initRingOrbs(instance, orbCount, player);
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

      // 從 levelStats 讀取當前等級的數值（優先讀 levelStats，fallback 到 base 值）
      const stats = weaponData.levelStats[inst.level - 1] ?? weaponData.levelStats[0];

      // 攻擊間隔：優先讀 stats.interval，fallback 到 baseAttackInterval
      const baseInterval = stats.interval ?? weaponData.baseAttackInterval;

      // 計算最終攻擊間隔（毫秒），套用攻擊速度被動
      const finalInterval = (baseInterval / this.getAttackSpeedMultiplier(player)) * 1000;

      // 攻擊範圍：優先讀 stats.range，fallback 到 baseAttackRange，再套用被動倍率
      const baseRange = stats.range ?? weaponData.baseAttackRange;
      const finalRange = baseRange * this.getAttackRangeMultiplier(player);

      // 傷害：從 stats.damage 讀取，套用攻擊力與被動倍率
      const levelDamage = stats.damage;
      const passiveMultiplier = this.getPassiveAttackMultiplier(player);
      const finalDamage = Math.max(1, Math.floor(levelDamage * player.stats.attackPower * passiveMultiplier));

      if (inst.weaponId === 'guardian_ring') {
        // 守心環：更新旋轉位置，檢測碰撞
        this.updateGuardianRing(inst, time, delta, player, enemies, finalRange, finalDamage, deadEnemies, stats);
      } else {
        // 其他武器：倒計時攻擊
        inst.attackCooldown -= delta;

        if (inst.attackCooldown <= 0) {
          // 尋找攻擊範圍內最近的敵人（Requirement 5.4）
          const target = this.findNearestEnemyInRange(player, finalRange);

          if (target) {
            const projSpeed = stats.projectileSpeed ?? weaponData.projectileSpeed;

            // 計算最終數量：baseCount + amountBonus（僅 usesAmountBonus === true 時套用）
            const baseCount = stats.count ?? 1;
            const amountBonus = weaponData.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
            const finalCount = Math.max(1, baseCount + amountBonus);

            if (inst.weaponId === 'swift_blade') {
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'swift_blade', 0x00ffff, finalCount);
            } else if (inst.weaponId === 'flame_seal') {
              const explosionRadius = stats.radius ?? 80;
              this.fireFlameSeal(player, target, finalDamage, projSpeed, explosionRadius, finalCount);
            } else if (inst.weaponId === 'thunder_claw') {
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'thunder_claw', 0xffff00, finalCount);
            } else if (inst.weaponId === 'ice_spike') {
              // 寒冰錐：啟用穿透，pierce 數從 levelStats 讀取；finalCount 控制同時發射數
              const pierceCount = stats.pierce ?? 1;
              for (let i = 0; i < finalCount; i++) {
                this.firePiercingProjectile(player, target, finalDamage, projSpeed, finalRange, pierceCount);
              }
            } else if (inst.weaponId === 'light_shuttle') {
              // 流光梭：穿透投射物，沿用寒冰錐邏輯
              const pierceCount = stats.pierce ?? 1;
              for (let i = 0; i < finalCount; i++) {
                this.firePiercingProjectile(player, target, finalDamage, projSpeed, finalRange, pierceCount);
              }
            } else if (inst.weaponId === 'soul_chasing_needle') {
              // 追魂針：自動追尾投射物，沿用疾風刃邏輯
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'soul_chasing_needle', 0xff88ff, finalCount);
            } else if (inst.weaponId === 'swift_blade_evolved') {
              // 流光返刃：發射後命中或到達最大距離時返還，回程再次傷敵
              const returnMult = stats.returnDamageMultiplier ?? 0.7;
              this.fireReturningProjectile(player, target, finalDamage, projSpeed, finalRange, finalCount, returnMult);
            } else if (inst.weaponId === 'poison_mist') {
              // 毒霧散：不吃 amountBonus，直接用 baseCount
              const cloudCount = baseCount;
              const cloudRadius = stats.radius ?? 45;
              const cloudDuration = (stats.duration ?? 2.2) * 1000; // 秒轉毫秒
              this.firePoisonMist(player, finalDamage, projSpeed, finalRange, cloudCount, cloudRadius, cloudDuration, enemies);
            } else {
              // 其他武器：預設直線投射
              this.fireLinearProjectile(player, target, finalDamage, projSpeed, finalRange, inst.weaponId);
            }          }
          // 無論是否有目標，重置冷卻
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
        // 毒霧散到期時，在當前位置生成毒霧（防止飛過頭導致毒霧不生成）
        if (proj.weaponId === 'poison_mist') {
          this.spawnPoisonCloud(proj.x, proj.y, proj.damage, proj.explosionRadius, proj.cloudDuration);
        }
        // 流光返刃：去程到期時進入返還狀態，不立刻銷毀
        if (proj.canReturn && !proj.isReturning && !proj.hasReturned) {
          proj.isReturning = true;
          proj.lifeTime = 3000; // 給 3 秒飛回玩家
          continue; // 不加入 toRemove，繼續存活
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

      // 毒霧散投射物：檢查是否到達目標位置，到達後生成毒霧
      if (proj.weaponId === 'poison_mist' && !proj.isExplosive) {
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget < 20) {
          // 到達目標，生成毒霧
          this.spawnPoisonCloud(proj.x, proj.y, proj.damage, proj.explosionRadius, proj.cloudDuration);
          toRemove.push(proj);
          continue;
        }
      }

      // 非爆炸型投射物：檢測命中敵人（Requirement 5.3）
      // 毒霧散投射物不直接命中敵人，由毒霧區域負責傷害
      if (!proj.isExplosive && proj.weaponId !== 'poison_mist') {

        // ── 流光返刃：返還中的投射物朝玩家飛回 ──────────────────────
        if (proj.canReturn && proj.isReturning && !proj.hasReturned) {
          // 更新速度方向，朝玩家當前位置
          const rdx = player.x - proj.x;
          const rdy = player.y - proj.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);

          if (rdist < 20) {
            // 到達玩家附近，銷毀
            proj.hasReturned = true;
            toRemove.push(proj);
            continue;
          }

          const speed = Math.sqrt(proj.velocityX * proj.velocityX + proj.velocityY * proj.velocityY);
          proj.velocityX = (rdx / rdist) * speed;
          proj.velocityY = (rdy / rdist) * speed;

          // 回程命中敵人
          for (const enemy of enemies) {
            if (deadEnemies.includes(enemy)) continue;
            if (enemy.isDying) continue;
            if (proj.returnHitEnemies.has(enemy)) continue; // 回程已命中過

            const dx = proj.x - enemy.x;
            const dy = proj.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= enemy.collisionRadius + 8) {
              const returnDamage = Math.max(1, Math.floor(proj.damage * proj.returnDamageMultiplier));
              const died = enemy.takeDamage(returnDamage, proj.x, proj.y);
              if (died && !deadEnemies.includes(enemy)) {
                deadEnemies.push(enemy);
              }
              this.spawnHitEffect(proj.x, proj.y);
              proj.returnHitEnemies.add(enemy);
            }
          }
          continue; // 返還中的投射物不走一般命中邏輯
        }

        let hit = false;
        for (const enemy of enemies) {
          if (deadEnemies.includes(enemy)) continue;
          if (enemy.isDying) continue;
          // 穿透投射物：跳過已命中過的敵人
          if (proj.hitEnemies.has(enemy)) continue;

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

            if (proj.canReturn && !proj.isReturning) {
              // 流光返刃：命中後進入返還狀態，不銷毀
              proj.outboundHitEnemies.add(enemy);
              proj.isReturning = true;
              // 延長存活時間確保能飛回玩家（3 秒足夠）
              proj.lifeTime = 3000;
              // 不設 hit = true，繼續飛行（進入返還模式）
            } else if (proj.pierceRemaining > 0) {
              // 穿透模式：記錄已命中敵人，消耗一次穿透次數，繼續飛行
              proj.hitEnemies.add(enemy);
              proj.pierceRemaining -= 1;
              // 不設 hit = true，繼續檢查其他敵人（同幀可穿透多個）
            } else {
              // 非穿透模式：命中即銷毀
              hit = true;
              break;
            }
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

    // 更新所有毒霧區域（tick 傷害 + 生命週期）
    const cloudsToRemove: PoisonCloud[] = [];
    for (const cloud of this.poisonClouds) {
      const result = cloud.update(delta, enemies, deadEnemies);
      for (const e of result.newDead) {
        if (!deadEnemies.includes(e)) deadEnemies.push(e);
      }
      if (!result.alive) {
        cloudsToRemove.push(cloud);
      }
    }
    for (const cloud of cloudsToRemove) {
      cloud.destroy();
      const idx = this.poisonClouds.indexOf(cloud);
      if (idx !== -1) this.poisonClouds.splice(idx, 1);
    }

    return deadEnemies;
  }

  /**
   * 消除進入 shield 護盾範圍內的玩家投射物
   * 只消除真正的 Projectile（不影響守心環環繞體）
   */
  public destroyProjectilesInShieldRange(shieldEnemies: import('../objects/Enemy').Enemy[]): void {
    const toRemove: Projectile[] = [];
    for (const proj of this.projectiles) {
      // 守心環環繞體不在 projectiles 陣列，跳過
      if (proj.weaponId === 'guardian_ring') continue;
      for (const shield of shieldEnemies) {
        const dx = proj.x - shield.x;
        const dy = proj.y - shield.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= shield.SHIELD_RADIUS) {
          toRemove.push(proj);
          break;
        }
      }
    }
    for (const proj of toRemove) {
      this.removeProjectile(proj);
    }
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

    for (const cloud of this.poisonClouds) {
      cloud.destroy();
    }
    this.poisonClouds = [];
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
   * 計算被動攻擊速度倍率（急攻令）
   */
  private getAttackSpeedMultiplier(player: Player): number {
    let multiplier = 1.0;
    for (const slot of player.equipment.passives) {
      const passive = PASSIVES.find(p => p.id === slot.passiveId);
      if (passive && passive.stat === 'attackSpeed') {
        multiplier *= (1 + passive.bonusPerLevel * slot.level);
      }
    }
    return Math.max(0.01, multiplier);
  }

  /**
   * 計算被動攻擊範圍倍率（擴脈符）
   */
  private getAttackRangeMultiplier(player: Player): number {
    let multiplier = 1.0;
    for (const slot of player.equipment.passives) {
      const passive = PASSIVES.find(p => p.id === slot.passiveId);
      if (passive && passive.stat === 'attackRange') {
        multiplier *= (1 + passive.bonusPerLevel * slot.level);
      }
    }
    return Math.max(0.01, multiplier);
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
    deadEnemies: Enemy[],
    _stats?: { count?: number }
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
   * 發射多發投射物（疾風刃、雷霆爪用）
   * count > 1 時加入小角度偏移，避免完全重疊
   */
  private fireMultiProjectile(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    weaponId: string,
    color: number,
    count: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const baseAngle = Math.atan2(dy, dx);
    const lifeTime = (range / speed) * 1000;

    // 多發時均勻分散角度（每發間隔約 0.15 弧度 ≈ 8.6 度）
    const angleSpread = count > 1 ? 0.15 : 0;

    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? (i - (count - 1) / 2) * angleSpread : 0;
      const angle = baseAngle + offset;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);

      const proj = new Projectile(
        this.scene,
        player.x,
        player.y,
        damage,
        nx * speed,
        ny * speed,
        lifeTime,
        weaponId,
        color
      );
      this.addProjectile(proj);
    }
  }

  /**
   * 發射赤焰印（飛向目標位置，到達後爆炸）
   * count > 1 時以小角度偏移發射多發（usesAmountBonus 套用後）
   */
  private fireFlameSeal(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    explosionRadius: number,
    count: number = 1
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const baseAngle = Math.atan2(dy, dx);
    const angleSpread = count > 1 ? 0.18 : 0;

    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? (i - (count - 1) / 2) * angleSpread : 0;
      const angle = baseAngle + offset;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);

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
        explosionRadius,
        target.x,
        target.y
      );

      this.addProjectile(proj);
    }
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
   * 發射穿透投射物（寒冰錐專用）
   * pierceCount 為可穿透的敵人數量（命中第 pierceCount+1 個時銷毀）
   */
  private firePiercingProjectile(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    pierceCount: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const lifeTime = (range / speed) * 1000;

    // pierceRemaining = pierceCount - 1：
    // 第一次命中消耗一次（在命中判斷中），之後每次命中再消耗一次
    // 當 pierceRemaining 降到 0 時，下一次命中才銷毀
    const proj = new Projectile(
      this.scene,
      player.x,
      player.y,
      damage,
      nx * speed,
      ny * speed,
      lifeTime,
      'ice_spike',
      0x88ddff, // 淡藍色，區別於其他投射物
      false,    // 非爆炸型
      0,        // explosionRadius
      0,        // targetX
      0,        // targetY
      pierceCount - 1  // pierceRemaining：已扣除第一次命中
    );

    this.addProjectile(proj);
  }

  /**
   * 發射流光返刃投射物（命中或到達最大距離後返還玩家，回程再次傷敵）
   * count > 1 時加入小角度偏移，避免完全重疊
   */
  private fireReturningProjectile(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    count: number,
    returnDamageMultiplier: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const baseAngle = Math.atan2(dy, dx);
    const lifeTime = (range / speed) * 1000;
    const angleSpread = count > 1 ? 0.15 : 0;

    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? (i - (count - 1) / 2) * angleSpread : 0;
      const angle = baseAngle + offset;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);

      const proj = new Projectile(
        this.scene,
        player.x,
        player.y,
        damage,
        nx * speed,
        ny * speed,
        lifeTime,
        'swift_blade_evolved',
        0x88ffee // 青白色，區別於疾風刃的青色
      );
      proj.canReturn = true;
      proj.returnDamageMultiplier = returnDamageMultiplier;

      this.addProjectile(proj);
    }
  }

  /**
   * 發射毒霧散投射物（支援多發，依 count 決定數量）
   * 優先選擇 range 內不同敵人作為目標；敵人不足時在第一目標附近加隨機偏移
   * 投射物到達目標位置後生成 PoisonCloud
   */
  private firePoisonMist(
    player: Player,
    damage: number,
    speed: number,
    range: number,
    count: number,
    cloudRadius: number,
    cloudDuration: number,
    enemies: Enemy[]
  ): void {
    // 收集 range 內所有敵人（依距離排序，已由 cachedEnemies 排好）
    const targetsInRange: Enemy[] = [];
    for (const enemy of this.cachedEnemies) {
      if (enemy.isDying) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        targetsInRange.push(enemy);
      }
    }

    if (targetsInRange.length === 0) return; // 沒有目標，不發射

    for (let i = 0; i < count; i++) {
      let targetX: number;
      let targetY: number;

      if (i < targetsInRange.length) {
        // 優先選擇不同敵人
        targetX = targetsInRange[i].x;
        targetY = targetsInRange[i].y;
      } else {
        // 敵人不足：在第一目標附近加隨機偏移（30～70px）
        const baseTarget = targetsInRange[0];
        const offsetDist = 30 + Math.random() * 40; // 30～70px
        const offsetAngle = Math.random() * Math.PI * 2;
        targetX = baseTarget.x + Math.cos(offsetAngle) * offsetDist;
        targetY = baseTarget.y + Math.sin(offsetAngle) * offsetDist;
      }

      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const nx = dx / dist;
      const ny = dy / dist;

      // 存活時間：足夠飛到目標（加一點餘裕）
      const lifeTime = (dist / speed) * 1000 + 300;

      const proj = new Projectile(
        this.scene,
        player.x,
        player.y,
        damage,
        nx * speed,
        ny * speed,
        lifeTime,
        'poison_mist',
        0x44ff66,    // 綠色
        false,       // 非爆炸型
        cloudRadius, // 用 explosionRadius 欄位儲存毒霧半徑
        targetX,     // targetX
        targetY      // targetY
      );
      proj.cloudDuration = cloudDuration; // 毒霧持續時間

      this.addProjectile(proj);
    }
  }

  /**
   * 在指定位置生成毒霧區域
   * 超過上限時移除最舊的毒霧
   */
  private spawnPoisonCloud(x: number, y: number, damage: number, radius: number, durationMs: number): void {
    if (this.poisonClouds.length >= MAX_POISON_CLOUDS) {
      const oldest = this.poisonClouds.shift();
      if (oldest) oldest.destroy();
    }

    const cloud = new PoisonCloud(this.scene, x, y, radius, damage, durationMs);
    this.poisonClouds.push(cloud);
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
