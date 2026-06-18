import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { Projectile } from '../objects/Projectile';
import { PoisonCloud } from '../objects/PoisonCloud';
import { getWeaponById } from '../data/weapons';

/** ?��??�群組�??��?Requirement ?�能?�制�?*/
const MAX_PROJECTILES = 100;

/** ?�近敵人快?�更?��??��?毫�?，�??�優?��? */
const ENEMY_CACHE_INTERVAL = 250;

/** 守�??��?轉速度（弧�?秒�? */
const RING_ROTATION_SPEED = 2.0;

/** 守�??��?轉�?徑�?例�??��?範�???60%�?*/
const RING_RADIUS_RATIO = 0.6;

/** 守�??��??��??�人?�傷害冷?��?毫�?�?*/
const RING_DAMAGE_COOLDOWN = 500;

/** 赤焰?��??��?徑�?px�?*/
const FLAME_EXPLOSION_RADIUS = 80;

/** ?�中?��??��?上�? */
const MAX_HIT_EFFECTS = 30;

/** ?��?存在?��??�數?��???*/
const MAX_POISON_CLOUDS = 8;

/** 霜裂冰痕最大數量（效能限制） */
const MAX_FROST_CRACKS = 40;

// ?�?� 驚鴻派大?��??��??��??��????�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
/** 驚鴻派�??� character id */
const JINGHONG_CHARACTER_ID = 'assassin';
/** ?��?子�??��? */
const SPLIT_COUNT = 2;
/** ?��?子�??�害?��? */
const SPLIT_DAMAGE_MULTIPLIER = 0.55;
/** ?��?子�?射�??��? */
const SPLIT_RANGE_MULTIPLIER = 0.6;
/** ?��?角度?�移（弧度�?，�?5 �?*/
const SPLIT_ANGLE_OFFSET = 25 * (Math.PI / 180);

/**
 * 守�??�環繞�?
 * 繞玩家�?轉�?碰到?�人?��??�害
 */
interface RingOrb {
  /** Phaser Arc 顯示物件（小型法器圓盤） */
  rect: Phaser.GameObjects.Arc;
  /** ?��?角度（弧度�? */
  angle: number;
  /** 對�??�人?��?後傷害�??��?key: enemy ?�件引用，value: ?��??��? */
  lastHitMap: Map<Enemy, number>;
}

/**
 * 霜裂冰痕（frostCrack）
 * 霜裂冰錐命中敵人時在命中位置生成，延遲後爆裂造成範圍傷害
 */
interface FrostCrack {
  /** 冰痕位置 X */
  x: number;
  /** 冰痕位置 Y */
  y: number;
  /** 爆裂傷害（已套用 attackPower） */
  damage: number;
  /** 爆裂半徑（已套用 areaMultiplier） */
  radius: number;
  /** 剩餘延遲時間（毫秒） */
  delayRemaining: number;
  /** 視覺圖形物件 */
  graphics: Phaser.GameObjects.Graphics;
  /** 是否已爆裂 */
  exploded: boolean;
}

/**
 * 武器實�??�??
 */
interface WeaponInstance {
  weaponId: string;
  level: number;
  /** 距離下次?��??�剩餘�??��?毫�?�?*/
  attackCooldown: number;
  /** 守�??��??��?體�?表�???guardian_ring 使用�?*/
  ringOrbs: RingOrb[];
  /** 守心環軌道圈（淡半透明圓，跟隨玩家，每幀重繪；僅 guardian_ring 使用） */
  orbitGfx?: Phaser.GameObjects.Graphics;
}

/**
 * WeaponSystem
 * 管�??�家?�?�武?��?依攻?��??�自?�發射�?射物（Requirement 5.1�?.5�?
 */
export class WeaponSystem {
  private scene: Phaser.Scene;

  /** ?��??�群�?*/
  private projectiles: Projectile[] = [];

  /** 武器實�??�表 */
  private weaponInstances: WeaponInstance[] = [];

  /** ?�近敵人快??*/
  private cachedEnemies: Enemy[] = [];

  /** 距離下次快�??�新?�剩餘�??��?毫�?�?*/
  private cacheTimer: number = 0;

  /** ?�否?��?（Requirement 5.5�?*/
  private paused: boolean = false;

  /** ?�中?��?計數 */
  private activeHitEffects: number = 0;

  /** 毒霧?�?��?表�?毒霧??���?*/
  private poisonClouds: PoisonCloud[] = [];

  /** 霜裂冰痕列表 */
  private frostCracks: FrostCrack[] = [];

  /** ?��??�家宗�? character id（�?鴻派大�??�斷?��? */
  private characterId: string = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * ?��??�武?�系統�?依玩家�??��?建�?武器實�?
   * @param player ?�家?�件
   * @param characterId ?�家宗�? character id（�?鴻派大�??�斷?��?
   */
  public init(player: Player, characterId: string = ''): void {
    this.characterId = characterId;
    this.weaponInstances = [];

    for (const slot of player.equipment.weapons) {
      const instance: WeaponInstance = {
        weaponId: slot.weaponId,
        level: slot.level,
        attackCooldown: 0,
        ringOrbs: [],
      };

      // 守�??��??��?建�??��?體�??��?�?levelStats.count 讀?��?套用 amountBonus�?
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
   * ?�新?�步武器實�?（�??��??��??�叫�?
   * @param player ?�家?�件
   */
  public syncWeapons(player: Player): void {
    const newInstances: WeaponInstance[] = [];

    for (const slot of player.equipment.weapons) {
      // 尋找?��?實�?
      const existing = this.weaponInstances.find(w => w.weaponId === slot.weaponId);

      if (existing) {
        // ?�新等�?
        existing.level = slot.level;

        // 守�??��??��?級改變�??�建?��?體�??��?�?levelStats.count 讀?��?套用 amountBonus�?
        if (slot.weaponId === 'guardian_ring') {
          const weaponData = getWeaponById(slot.weaponId);
          const baseCount = weaponData?.levelStats[slot.level - 1]?.count ?? 1;
          const amountBonus = weaponData?.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
          const newCount = Math.max(1, baseCount + amountBonus);
          if (existing.ringOrbs.length !== newCount) {
            // 移除?�環繞�?
            for (const orb of existing.ringOrbs) {
              orb.rect.destroy();
            }
            existing.ringOrbs = [];
            this.initRingOrbs(existing, newCount, player);
          }
        }

        newInstances.push(existing);
      } else {
        // ?�武??
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

    // 移除已�??��??��??�武?��?清�??��?體�?
    for (const inst of this.weaponInstances) {
      if (!newInstances.includes(inst)) {
        for (const orb of inst.ringOrbs) {
          orb.rect.destroy();
        }
        inst.orbitGfx?.destroy();
        inst.orbitGfx = undefined;
      }
    }

    this.weaponInstances = newInstances;
  }

  /**
   * ?��??�?�攻?��??��?Requirement 5.5�?
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * ?�復?��?計�?（Requirement 5.5�?
   */
  public resume(): void {
    this.paused = false;
  }

  /**
   * 每�??�新（由 GameScene.update() ?�叫�?
   * @param time  ?��??��??��?毫�?�?
   * @param delta 幀?��?差�?毫�?�?
   * @param player ?�家?�件
   * @param enemies ?��??�?�敵�?
   * @returns ?�要移?��??�人?�表（HP ??0�?
   */
  public update(
    time: number,
    delta: number,
    player: Player,
    enemies: Enemy[]
  ): Enemy[] {
    const deadEnemies: Enemy[] = [];

    // ?��??��?止�??�攻?��??��?Requirement 5.5�?
    if (this.paused) {
      // ?��??��??�?�新守�??��?置�?視覺上�?止�?轉�?
      for (const inst of this.weaponInstances) {
        if (inst.weaponId === 'guardian_ring') {
          this.updateRingOrbPositions(inst, player);
        }
      }
      return deadEnemies;
    }

    // ?�新?�近敵人快?��?�?250ms 一次�?
    this.cacheTimer -= delta;
    if (this.cacheTimer <= 0) {
      this.cacheTimer = ENEMY_CACHE_INTERVAL;
      this.updateEnemyCache(player, enemies);
    }

    // ?�新?�武??
    for (const inst of this.weaponInstances) {
      const weaponData = getWeaponById(inst.weaponId);
      if (!weaponData) continue;

      // �?levelStats 讀?�當?��?級�??�值�??��?讀 levelStats，fallback ??base ?��?
      const stats = weaponData.levelStats[inst.level - 1] ?? weaponData.levelStats[0];

      // ?��??��?：優?��? stats.interval，fallback ??baseAttackInterval
      const baseInterval = stats.interval ?? weaponData.baseAttackInterval;

      // 計�??�終攻?��??��?毫�?）�?套用?�卻?��?被�?（急攻令�?
      // cooldownMultiplier < 1 表示?�卻縮短（�?�?.94 = 縮短 6%�?
      const finalInterval = baseInterval * player.stats.cooldownMultiplier * 1000;

      // ?��?範�?：優?��? stats.range，fallback ??baseAttackRange
      // 注�?：攻?��??��?索敵距離）�??��??��?符影?��??��?符改?�影?��???毒霧?��?
      const baseRange = stats.range ?? weaponData.baseAttackRange;
      const finalRange = baseRange;

      // ?�害：�? stats.damage 讀?��?套用?��???
      // player.stats.attackPower 已由 StatCalculator 套用?�?�被?�倍�?（含?�勢?��?
      // 不�?額�??�叫 getPassiveAttackMultiplier，避?��??��?�?
      const levelDamage = stats.damage;
      const finalDamage = Math.max(1, Math.floor(levelDamage * player.stats.attackPower));

      if (inst.weaponId === 'guardian_ring') {
        // 守�??��??�新?��?位置，檢測碰??
        this.updateGuardianRing(inst, time, delta, player, enemies, finalRange, finalDamage, deadEnemies, stats);
      } else {
        // ?��?武器：倒�??�攻??
        inst.attackCooldown -= delta;

        if (inst.attackCooldown <= 0) {
          // 尋找?��?範�??��?近�??�人（Requirement 5.4�?
          const target = this.findNearestEnemyInRange(player, finalRange);

          if (target) {
            // ?��??�速度：�???projectileSpeedMultiplier（TODO: ?��??�被?��??�此屬性�??�設 1.0�?
            const projSpeed = (stats.projectileSpeed ?? weaponData.projectileSpeed) * player.stats.projectileSpeedMultiplier;

            // 計�??�終數?��?baseCount + amountBonus（�? usesAmountBonus === true ?��??��?
            const baseCount = stats.count ?? 1;
            const amountBonus = weaponData.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
            const finalCount = Math.max(1, baseCount + amountBonus);

            if (inst.weaponId === 'swift_blade') {
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'swift_blade', 0x00ffff, finalCount);
            } else if (inst.weaponId === 'flame_seal') {
              const explosionRadius = (stats.radius ?? 80) * player.stats.areaMultiplier;
              this.fireFlameSeal(player, target, finalDamage, projSpeed, explosionRadius, finalCount);
            } else if (inst.weaponId === 'thunder_claw') {
              // 雷霆爪：朝玩家面朝方向揮出一次扇形爪擊，命中扇形內所有敵人
              const arcRad = Phaser.Math.DegToRad(stats.arcDegrees ?? 90);
              this.fireThunderClaw(player, finalDamage, finalRange, arcRad, enemies, deadEnemies);
            } else if (inst.weaponId === 'ice_spike') {
              // 寒冰?��??�用穿透�?pierce ?��? levelStats 讀?��?finalCount ?�制?��??��???
              const pierceCount = stats.pierce ?? 1;
              for (let i = 0; i < finalCount; i++) {
                this.firePiercingProjectile(player, target, finalDamage, projSpeed, finalRange, pierceCount);
              }
            } else if (inst.weaponId === 'light_shuttle') {
              // 流�?梭�?高速折返光梭，去程穿透 + 抵達最大射程後折返，去回程皆可命中
              this.fireLightShuttle(player, target, finalDamage, projSpeed, finalRange, finalCount);
            } else if (inst.weaponId === 'soul_chasing_needle') {
              // 追�??��?多發細小飛針，分別鎖定不同敵人（沿用?�風?��?�?
              this.fireSeekingNeedles(player, finalDamage, projSpeed, finalRange, finalCount);
            } else if (inst.weaponId === 'swift_blade_evolved') {
              // 流�?返�?：發射�??�中?�到?��?大�??��?返�?，�?程�?次傷??
              const returnMult = stats.returnDamageMultiplier ?? 0.7;
              this.fireReturningProjectile(player, target, finalDamage, projSpeed, finalRange, finalCount, returnMult);
            } else if (inst.weaponId === 'ice_spike_evolved') {
              // 霜裂冰錐：穿透投射物，命中時生成霜裂冰痕，延遲後爆裂
              const pierceCount = stats.pierce ?? 3;
              const crackDamage = Math.max(1, Math.floor((stats.crackDamage ?? 14) * player.stats.attackPower));
              const crackRadius = (stats.crackRadius ?? 42) * player.stats.areaMultiplier;
              const crackDelay = stats.crackDelay ?? 0.25;
              for (let i = 0; i < finalCount; i++) {
                this.fireFrostCrackProjectile(player, target, finalDamage, projSpeed, finalRange, pierceCount, crackDamage, crackRadius, crackDelay);
              }
            } else if (inst.weaponId === 'poison_mist') {
              // 毒霧???不�? amountBonus，直?�用 baseCount
              const cloudCount = baseCount;
              const cloudRadius = (stats.radius ?? 45) * player.stats.areaMultiplier;
              // ?��??��?套用 durationMultiplier（TODO: ?��??�被?��??�此屬性�??�設 1.0�?
              const cloudDuration = (stats.duration ?? 2.2) * player.stats.durationMultiplier * 1000;
              this.firePoisonMist(player, finalDamage, projSpeed, finalRange, cloudCount, cloudRadius, cloudDuration, enemies);
            } else {
              // ?��?武器：�?設直線�?�?
              this.fireLinearProjectile(player, target, finalDamage, projSpeed, finalRange, inst.weaponId);
            }          }
          // ?��??�否?�目標�??�置?�卻
          inst.attackCooldown = finalInterval;
        }
      }
    }

    // ?�新?�?��?射物
    const toRemove: Projectile[] = [];
    for (const proj of this.projectiles) {
      const alive = proj.updateProjectile(delta);

      if (!alive) {
        // 赤焰?�到?��??�炸
        if (proj.isExplosive && !proj.hasExploded) {
          const killed = this.explodeFlameSeal(proj, enemies, time);
          for (const e of killed) {
            if (!deadEnemies.includes(e)) deadEnemies.push(e);
          }
        }
        // 毒霧??��?��?，在?��?位置?��?毒霧（防止�??�頭導致毒霧不�??��?
        if (proj.weaponId === 'poison_mist') {
          this.spawnPoisonCloud(proj.x, proj.y, proj.damage, proj.explosionRadius, proj.cloudDuration);
        }
        // 流�?返�?：去程到?��??�入返�??�?��?不�??�銷毀
        if (proj.canReturn && !proj.isReturning && !proj.hasReturned) {
          proj.isReturning = true;
          proj.lifeTime = 3000; // �?3 秒�??�玩�?
          continue; // 不�???toRemove，繼續�?�?
        }
        toRemove.push(proj);
        continue;
      }

      // 赤焰?��?檢查?�否?��??��?位置
      if (proj.isExplosive && !proj.hasExploded) {
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget < 10) {
          // ?��??��?，�???
          const killed = this.explodeFlameSeal(proj, enemies, time);
          for (const e of killed) {
            if (!deadEnemies.includes(e)) deadEnemies.push(e);
          }
          proj.hasExploded = true;
          toRemove.push(proj);
          continue;
        }
      }

      // 毒霧???射物：檢?�是?�到?�目標�?置�??��?後�??��???
      if (proj.weaponId === 'poison_mist' && !proj.isExplosive) {
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget < 20) {
          // ?��??��?，�??��???
          this.spawnPoisonCloud(proj.x, proj.y, proj.damage, proj.explosionRadius, proj.cloudDuration);
          toRemove.push(proj);
          continue;
        }
      }

      // ?��??��??��??��?檢測?�中?�人（Requirement 5.3�?
      // 毒霧???射物不直?�命中敵人�??��??��??��?責傷�?
      if (!proj.isExplosive && proj.weaponId !== 'poison_mist') {

        // ?�?� 流�?返�?：�??�中?��?射物?�玩家�????�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
        if (proj.canReturn && proj.isReturning && !proj.hasReturned) {
          // ?�新?�度?��?，�??�家?��?位置
          const rdx = player.x - proj.x;
          const rdy = player.y - proj.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);

          if (rdist < 20) {
            // ?��??�家?��?，銷毀
            proj.hasReturned = true;
            toRemove.push(proj);
            continue;
          }

          const speed = Math.sqrt(proj.velocityX * proj.velocityX + proj.velocityY * proj.velocityY);
          proj.velocityX = (rdx / rdist) * speed;
          proj.velocityY = (rdy / rdist) * speed;

          // ?��??�中?�人
          for (const enemy of enemies) {
            if (deadEnemies.includes(enemy)) continue;
            if (enemy.isDying) continue;
            if (proj.returnHitEnemies.has(enemy)) continue; // ?��?已命中�?

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
          continue; // 返�?中�??��??��?走�??�命中�?�?
        }

        let hit = false;
        for (const enemy of enemies) {
          if (deadEnemies.includes(enemy)) continue;
          if (enemy.isDying) continue;
          // 穿透�?射物：跳?�已?�中?��??�人
          if (proj.hitEnemies.has(enemy)) continue;

          const dx = proj.x - enemy.x;
          const dy = proj.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= enemy.collisionRadius + 8) {
            // ?�中！呼??takeDamage（扣血 + ?�白 + ?�害?��?�?
            const died = enemy.takeDamage(proj.damage, proj.x, proj.y);
            if (died && !deadEnemies.includes(enemy)) {
              deadEnemies.push(enemy);
            }
            // ?�中?��?（�??��?�?
            this.spawnHitEffect(proj.x, proj.y);

            // 霜裂冰痕：命中時在命中位置生成冰痕
            if (proj.hasFrostCrack) {
              this.spawnFrostCrack(proj.x, proj.y, proj.crackDamage, proj.crackRadius, proj.crackDelay);
            }

            if (proj.canReturn && !proj.isReturning && !proj.returnsAtRange) {
              // 流�?返�?：命中�??�入返�??�?��?不銷毀
              proj.outboundHitEnemies.add(enemy);
              proj.isReturning = true;
              // 延長存活?��?確�??��??�玩家�?3 秒足夠�?
              proj.lifeTime = 3000;
              // 不設 hit = true，繼續�?行�??�入返�?模�?�?

              // 驚鴻派大?��??��?第�?次命中�??��?（�?程�?觸發�?
              if (
                player.activeDaos.has('jinghong_split') &&
                !proj.isSplitProjectile &&
                proj.splitDepth === 0 &&
                !proj.hasSplit
              ) {
                proj.hasSplit = true;
                this.spawnSplitProjectiles(proj, proj.x, proj.y);
              }
            } else if (proj.pierceRemaining > 0) {
              // 穿透模式�?記�?已命中敵人�?消耗�?次穿?�次?��?繼�?飛�?
              proj.hitEnemies.add(enemy);
              proj.pierceRemaining -= 1;
              // 不設 hit = true，繼續檢?�其他敵人�??��??�穿?��??��?

              // 驚鴻派大?��?穿透�?射物?�在第�?次命中�??��?一�?
              if (
                player.activeDaos.has('jinghong_split') &&
                !proj.isSplitProjectile &&
                proj.splitDepth === 0 &&
                !proj.hasSplit
              ) {
                proj.hasSplit = true;
                this.spawnSplitProjectiles(proj, proj.x, proj.y);
              }
            } else {
              // ?�穿?�模式�??�中?�銷毀

              // 驚鴻派大?��??�中?��?�?
              if (
                player.activeDaos.has('jinghong_split') &&
                !proj.isSplitProjectile &&
                proj.splitDepth === 0 &&
                !proj.hasSplit
              ) {
                proj.hasSplit = true;
                this.spawnSplitProjectiles(proj, proj.x, proj.y);
              }

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

    // 移除死亡?��???
    for (const proj of toRemove) {
      this.removeProjectile(proj);
    }

    // ?�新?�?��??��??��?tick ?�害 + ?�命?��?�?
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

    // 更新霜裂冰痕（frostCrack）：倒計時後爆裂
    const cracksToRemove: FrostCrack[] = [];
    for (const crack of this.frostCracks) {
      if (crack.exploded) {
        cracksToRemove.push(crack);
        continue;
      }
      crack.delayRemaining -= delta;
      if (crack.delayRemaining <= 0) {
        // 爆裂：對範圍內敵人造成傷害
        crack.exploded = true;
        this.explodeFrostCrack(crack, enemies, deadEnemies);
        cracksToRemove.push(crack);
      }
    }
    for (const crack of cracksToRemove) {
      crack.graphics.destroy();
      const idx = this.frostCracks.indexOf(crack);
      if (idx !== -1) this.frostCracks.splice(idx, 1);
    }

    return deadEnemies;
  }

  /**
   * 護盾範圍內銷毀玩家投射物（震罡功已移除，此方法已廢棄）
   */
  public destroyProjectilesInShieldRange(shieldEnemies: import('../objects/Enemy').Enemy[]): void {
    // 震罡功已移除，此方法不再使用，保留空實作以避免編譯錯誤
    return;
  }

  /**
   * 清�??�?��?射物?�環繞�?（場?��??��??�叫�?
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
      inst.orbitGfx?.destroy();
      inst.orbitGfx = undefined;
    }
    this.weaponInstances = [];

    for (const cloud of this.poisonClouds) {
      cloud.destroy();
    }
    this.poisonClouds = [];

    for (const crack of this.frostCracks) {
      crack.graphics.destroy();
    }
    this.frostCracks = [];
  }

  // ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  // 私�??��?
  // ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

  /**
   * ?�新?�近敵人快?��?依�??��?序�?
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
   * ?�攻?��??�內尋找?�近�??�人（Requirement 5.4�?
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
   * ?��??��?心環?��?�?
   */
  private initRingOrbs(inst: WeaponInstance, count: number, player: Player): void {
    // 軌道圈（淡半透明，跟隨玩家，每幀重繪）；僅建立一次
    if (!inst.orbitGfx) {
      inst.orbitGfx = this.scene.add.graphics();
      inst.orbitGfx.setDepth(4); // 在環繞體與投射物下方
    }

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // 小型法器圓盤：淡金色內盤 + 描邊，不過大以免遮住玩家
      const orb = this.scene.add.circle(player.x, player.y, 6, 0xffe08a, 0.92);
      orb.setStrokeStyle(2, 0xfff4cf, 0.95);
      orb.setDepth(6);
      inst.ringOrbs.push({
        rect: orb,
        angle,
        lastHitMap: new Map(),
      });
    }
  }

  /**
   * 重繪守心環軌道圈（淡半透明圓，跟隨玩家）
   */
  private redrawOrbitRing(inst: WeaponInstance, player: Player, radius: number): void {
    const g = inst.orbitGfx;
    if (!g || !g.active) return;
    g.clear();
    g.lineStyle(1.5, 0xffe08a, 0.18);
    g.strokeCircle(player.x, player.y, radius);
  }

  /**
   * ?�新守�??�環繞�?位置（�??��?，�?跟隨?�家�?
   */
  private updateRingOrbPositions(inst: WeaponInstance, player: Player): void {
    const weaponData = getWeaponById(inst.weaponId);
    if (!weaponData) return;
    const radius = weaponData.baseAttackRange * RING_RADIUS_RATIO;

    for (const orb of inst.ringOrbs) {
      orb.rect.x = player.x + Math.cos(orb.angle) * radius;
      orb.rect.y = player.y + Math.sin(orb.angle) * radius;
    }
    // 軌道圈跟隨玩家
    this.redrawOrbitRing(inst, player, radius);
  }

  /**
   * ?�新守�??��??��? + 碰�??�害
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

    // 軌道圈跟隨玩家（淡半透明）
    this.redrawOrbitRing(inst, player, radius);

    for (const orb of inst.ringOrbs) {
      // ?��?角度
      orb.angle += RING_ROTATION_SPEED * dt;

      // ?�新位置
      orb.rect.x = player.x + Math.cos(orb.angle) * radius;
      orb.rect.y = player.y + Math.sin(orb.angle) * radius;

      // 碰�?檢測
      for (const enemy of enemies) {
        if (deadEnemies.includes(enemy)) continue;
        if (enemy.isDying) continue;

        const dx = orb.rect.x - enemy.x;
        const dy = orb.rect.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= enemy.collisionRadius + 6) {
          // 檢查?�卻（�??�環繞�?對�?一?�人 0.5 秒冷?��?
          const lastHit = orb.lastHitMap.get(enemy) ?? -Infinity;
          if (time - lastHit >= RING_DAMAGE_COOLDOWN) {
            const died = enemy.takeDamage(finalDamage, orb.rect.x, orb.rect.y);
            orb.lastHitMap.set(enemy, time);
            // 命中回饋：小型白/淡金閃光
            this.spawnHitEffect(orb.rect.x, orb.rect.y);

            if (died && !deadEnemies.includes(enemy)) {
              deadEnemies.push(enemy);
            }
          }
        }
      }

      // 清�?已死亡敵人�??�卻記�?（防�?Map ?��?增長�?
      for (const [e] of orb.lastHitMap) {
        if (!enemies.includes(e)) {
          orb.lastHitMap.delete(e);
        }
      }
    }
  }

  /**
   * ?��?多發?��??��??�風?�、雷?�爪?��?
   * count > 1 ?��??��?角度?�移，避?��??��???
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

    // 多發?��??��????度�?每發?��?�?0.15 弧度 ??8.6 度�?
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
      // 疾風刃：大而明顯的風刃造型（雷霆爪等沿用預設尺寸）
      if (weaponId === 'swift_blade') {
        proj.setSize(24, 8);
      }
      this.addProjectile(proj);
    }
  }

  /**
   * ?��?赤焰?��?飛�??��?位置，到?��??�炸�?
   * count > 1 ?�以小�?度�?移發射�??��?usesAmountBonus 套用後�?
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

      // 存活?��?：足夠�??�目標�??��?點�?裕�?
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
        0xff4400, // 橙�???
        true,     // isExplosive
        explosionRadius,
        target.x,
        target.y
      );

      this.addProjectile(proj);
    }
  }

  /**
   * ?��??�用?��??��??��??��?武器?�設行為�?
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
   * ?��?穿透�?射物（�??��??��??�梭?��?
   * pierceCount ?�可穿透�??�人?��?（命中第 pierceCount+1 ?��??��?�?
   */
  private firePiercingProjectile(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    pierceCount: number,
    weaponId: string = 'ice_spike'
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const lifeTime = (range / speed) * 1000;

    // pierceRemaining = pierceCount - 1�?
    // 第�?次命中�??��?次�??�命中判?�中）�?之�?每次?�中?��??��?�?
    // ??pierceRemaining ?�到 0 ?��?下�?次命中�??��?
    const proj = new Projectile(
      this.scene,
      player.x,
      player.y,
      damage,
      nx * speed,
      ny * speed,
      lifeTime,
      weaponId,
      0x88ddff, // 淡�??��??�?�於?��??��???
      false,    // ?��??��?
      0,        // explosionRadius
      0,        // targetX
      0,        // targetY
      pierceCount - 1  // pierceRemaining：已??��第�?次命�?
    );

    // 寒冰錐：較粗明顯的冰錐造型，強調穿透感
    if (weaponId === 'ice_spike') {
      proj.setSize(18, 11);
    }

    this.addProjectile(proj);
  }

  /**
   * 追魂針：一次射出多根細小飛針，分別鎖定範圍內不同敵人。
   * 敵人不足時循環鎖定（同一敵人或附近敵人），並加入小幅角度抖動避免完全重疊。
   * 沿用既有 Projectile 直線飛行 + 命中流程，僅造型較小。
   */
  private fireSeekingNeedles(
    player: Player,
    damage: number,
    speed: number,
    range: number,
    count: number
  ): void {
    // 收集範圍內敵人（cachedEnemies 已依距離排序）
    const inRange: Enemy[] = [];
    for (const enemy of this.cachedEnemies) {
      if (enemy.isDying) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        inRange.push(enemy);
      }
    }
    if (inRange.length === 0) return;

    const lifeTime = (range / speed) * 1000;

    for (let i = 0; i < count; i++) {
      const target = inRange[i % inRange.length]; // 敵人不足時循環鎖定
      let dx = target.x - player.x;
      let dy = target.y - player.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) { dx = 1; dy = 0; dist = 1; }

      // 小幅角度抖動，避免多針完全重疊
      const jitter = (Math.random() - 0.5) * 0.2;
      const angle = Math.atan2(dy, dx) + jitter;
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
        'soul_chasing_needle',
        0xddeeff // 銀白色細針
      );
      proj.setSize(11, 3); // 細小飛針
      this.addProjectile(proj);
    }
  }

  /**
   * 流光梭：高速折返光梭。
   * 去程穿透敵人（不折返），抵達最大射程後折返回玩家方向，去程與回程皆可命中。
   * 沿用既有 returning 投射物機制（canReturn + 最大射程到期折返 + 回程命中判定），
   * 透過 returnsAtRange 旗標讓去程穿透而非命中即折返；以大量 pierceRemaining 達成去程不消失。
   */
  private fireLightShuttle(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    count: number
  ): void {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const baseAngle = Math.atan2(dy, dx);
    const lifeTime = (range / speed) * 1000;
    const angleSpread = count > 1 ? 0.12 : 0;

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
        'light_shuttle',
        0xaaf0ff,  // 亮白藍
        false,
        0,
        0,
        0,
        999        // pierceRemaining：去程穿透所有敵人，直到最大射程才折返
      );
      proj.canReturn = true;
      proj.returnsAtRange = true;       // 抵達最大射程才折返（去程不命中即折返）
      proj.returnDamageMultiplier = 0.9; // 回程傷害略低
      proj.setSize(22, 4);              // 細長造型
      this.addProjectile(proj);
    }
  }

  /**
   * 雷霆爪：朝玩家面朝方向揮出一次扇形爪擊。
   * 命中扇形（半徑 range、總角度 arcRad、以玩家面朝方向為中心）內的所有敵人，各造成一次傷害
   * （同步處理，立即結算死亡），並顯示一道紫藍色扇形爪痕。
   * 等級提升會擴大扇形範圍（半徑與角度，由 levelStats 的 range / arcDegrees 控制）。
   * 不使用 delayedCall 處理傷害，避免場景關閉 / 武器銷毀時的清理風險。
   */
  private fireThunderClaw(
    player: Player,
    damage: number,
    range: number,
    arcRad: number,
    enemies: Enemy[],
    deadEnemies: Enemy[]
  ): void {
    // 朝玩家面朝方向（最後移動方向，預設朝右）
    const facingAngle = Math.atan2(player.facingY, player.facingX);
    const halfArc = arcRad / 2;

    // 命中扇形內所有敵人（半徑內 + 與面朝方向夾角在半扇形角內）
    let hitAny = false;
    for (const enemy of enemies) {
      if (enemy.isDying) continue;
      if (deadEnemies.includes(enemy)) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range) continue;

      // 夾角判定（極近距離 dist≈0 視為命中）
      if (dist > 0.001) {
        const angleTo = Math.atan2(dy, dx);
        const diff = Phaser.Math.Angle.Wrap(angleTo - facingAngle);
        if (Math.abs(diff) > halfArc) continue;
      }

      const died = enemy.takeDamage(damage, player.x, player.y);
      if (died && !deadEnemies.includes(enemy)) {
        deadEnemies.push(enemy);
      }
      this.spawnHitEffect(enemy.x, enemy.y, 0xaa66ff);
      hitAny = true;
    }

    // 扇形爪痕視覺（無論是否命中都揮出，朝面朝方向）
    void hitAny;
    this.spawnClawFan(player, facingAngle, range, arcRad);
  }

  /**
   * 紫藍色扇形爪痕特效：以玩家為圓心、朝面朝方向揮出一道扇形 + 3 條爪痕，
   * 連續閃 1~2 次後自動 destroy。純視覺，短促有打擊感，不造成傷害。
   */
  private spawnClawFan(player: Player, facingAngle: number, radius: number, arcRad: number): void {
    const halfArc = arcRad / 2;
    const startA = facingAngle - halfArc;
    const endA = facingAngle + halfArc;

    const g = this.scene.add.graphics();
    g.setPosition(player.x, player.y);
    g.setDepth(8);

    // 扇形填色（淡紫，半透明）
    g.fillStyle(0x9966ff, 0.22);
    g.slice(0, 0, radius, startA, endA, false);
    g.fillPath();

    // 扇形外弧線（亮紫）
    g.lineStyle(3, 0xaa88ff, 0.9);
    g.beginPath();
    g.arc(0, 0, radius, startA, endA, false);
    g.strokePath();

    // 3 條放射狀爪痕（紫 → 藍），分布於扇形內
    const clawColors = [0x9966ff, 0xaa88ff, 0x6699ff];
    for (let i = 0; i < 3; i++) {
      const t = 3 > 1 ? i / 2 : 0.5; // 0, 0.5, 1
      const a = startA + (endA - startA) * t;
      g.lineStyle(3, clawColors[i], 0.9);
      g.lineBetween(
        Math.cos(a) * radius * 0.25,
        Math.sin(a) * radius * 0.25,
        Math.cos(a) * radius,
        Math.sin(a) * radius
      );
    }

    // 連續閃 1~2 次後 destroy
    this.scene.tweens.add({
      targets: g,
      alpha: 0.15,
      duration: 80,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => g.destroy(),
    });
  }

  /**
   * ?��?流�?返�??��??��??�中?�到?��?大�??��?返�??�家，�?程�?次傷?��?
   * count > 1 ?��??��?角度?�移，避?��??��???
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
        0x88ffee // ?�白?��??�?�於?�風?��??�色
      );
      proj.canReturn = true;
      proj.returnDamageMultiplier = returnDamageMultiplier;

      this.addProjectile(proj);
    }
  }

  /**
   * ?��?毒霧???射物（支?��??��?�?count 決�??��?�?
   * ?��??��? range ?��??�敵人�??�目標�??�人不足?�在第�??��??��??�隨機�?�?
   * ?��??�到?�目標�?置�??��? PoisonCloud
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
    // ?��? range ?��??�敵人�?依�??��?序�?已由 cachedEnemies ?�好�?
    const targetsInRange: Enemy[] = [];
    for (const enemy of this.cachedEnemies) {
      if (enemy.isDying) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        targetsInRange.push(enemy);
      }
    }

    if (targetsInRange.length === 0) return; // 沒�??��?，�??��?

    for (let i = 0; i < count; i++) {
      let targetX: number;
      let targetY: number;

      if (i < targetsInRange.length) {
        // ?��??��?不�??�人
        targetX = targetsInRange[i].x;
        targetY = targetsInRange[i].y;
      } else {
        // ?�人不足：在第�??��??��??�隨機�?移�?30�?0px�?
        const baseTarget = targetsInRange[0];
        const offsetDist = 30 + Math.random() * 40; // 30�?0px
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

      // 存活?��?：足夠�??�目標�??��?點�?裕�?
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
        false,       // ?��??��?
        cloudRadius, // ??explosionRadius 欄�??��?毒霧?��?
        targetX,     // targetX
        targetY      // targetY
      );
      proj.cloudDuration = cloudDuration; // 毒霧?��??��?

      this.addProjectile(proj);
    }
  }

  /**
   * ?��?定�?置�??��??��???
   * 超�?上�??�移?��??��?毒霧
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
   * 赤焰?��??��?對�??��?徑內?�?�敵人造�??�害（Requirement 5.3�?
   */
  private explodeFlameSeal(proj: Projectile, enemies: Enemy[], _time: number): Enemy[] {
    const killed: Enemy[] = [];

    // ?�炸波�??��?（兩?�擴???�?
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
   * ?��??��??��?超�?上�??�移?��??��?
   */
  private addProjectile(proj: Projectile): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      const oldest = this.projectiles.shift();
      if (oldest) oldest.destroy();
    }
    // 為非爆炸、非毒霧投射物啟用拖尾（疾風刃/寒冰錐/雷霆爪/流光梭/追魂針/進化武器）
    if (!proj.isExplosive && proj.weaponId !== 'poison_mist') {
      proj.enableTrailEffect(proj.fillColor);
    }
    this.projectiles.push(proj);
  }

  /**
   * 移除並銷毀?��???
   */
  private removeProjectile(proj: Projectile): void {
    const idx = this.projectiles.indexOf(proj);
    if (idx !== -1) {
      this.projectiles.splice(idx, 1);
    }
    proj.destroy();
  }

  /**
   * ?�中小�??�特?��??��??�命中�?�?
   */
  private spawnHitEffect(x: number, y: number, color: number = 0xffffff): void {
    if (this.activeHitEffects >= MAX_HIT_EFFECTS) return;
    this.activeHitEffects++;

    const g = this.scene.add.graphics();
    g.lineStyle(2, color, 0.9);
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
   * ?�炸波�??��?（赤?�印�?
   */
  private spawnExplosionEffect(x: number, y: number, radius: number): void {
    if (this.activeHitEffects >= MAX_HIT_EFFECTS) return;
    this.activeHitEffects++;

    // 外�?橙色波�?
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

  /**
   * 赤焰印落點預兆圈（淡紅色圓，短暫顯示後淡出，提示爆炸位置）
   * @param x 落點 X
   * @param y 落點 Y
   * @param radius 爆炸半徑（預兆圈大小與其一致）
   * @param durationMs 顯示時間（約等於投射物飛行時間），限制在合理範圍
   */
  private spawnFlameTelegraph(x: number, y: number, radius: number, durationMs: number): void {
    const dur = Math.max(120, Math.min(600, durationMs));

    const g = this.scene.add.graphics();
    g.lineStyle(2, 0xff5533, 0.55);
    g.strokeCircle(0, 0, radius);
    g.fillStyle(0xff3322, 0.12);
    g.fillCircle(0, 0, radius);
    g.setPosition(x, y);
    g.setDepth(7);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: dur,
      ease: 'Sine.easeIn',
      onComplete: () => g.destroy(),
    });
  }

  /**
   * 發射霜裂冰錐投射物（穿透 + frostCrack）
   */
  private fireFrostCrackProjectile(
    player: Player,
    target: Enemy,
    damage: number,
    speed: number,
    range: number,
    pierceCount: number,
    crackDamage: number,
    crackRadius: number,
    crackDelay: number
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
      'ice_spike_evolved',
      0xaaddff, // 淡藍白色
      false,
      0,
      0,
      0,
      pierceCount - 1 // pierceRemaining：已算第一次命中
    );

    // 設定霜裂冰痕參數
    proj.hasFrostCrack = true;
    proj.crackDamage = crackDamage;
    proj.crackRadius = crackRadius;
    proj.crackDelay = crackDelay;

    this.addProjectile(proj);
  }

  /**
   * 在指定位置生成霜裂冰痕（frostCrack）
   * 延遲 crackDelay 秒後爆裂
   */
  private spawnFrostCrack(x: number, y: number, damage: number, radius: number, delaySeconds: number): void {
    if (this.frostCracks.length >= MAX_FROST_CRACKS) {
      // 移除最舊的冰痕
      const oldest = this.frostCracks.shift();
      if (oldest) oldest.graphics.destroy();
    }

    // 繪製藍白裂痕視覺效果
    const g = this.scene.add.graphics();
    g.setPosition(x, y);
    g.setDepth(7);

    // 外圈：淡藍色半透明圓
    g.fillStyle(0x88ccff, 0.25);
    g.fillCircle(0, 0, radius * 0.5);
    // 內圈：白藍色裂痕線條
    g.lineStyle(2, 0xcceeff, 0.8);
    g.strokeCircle(0, 0, radius * 0.3);
    // 十字裂痕
    g.lineStyle(1.5, 0xffffff, 0.7);
    const cr = radius * 0.4;
    g.lineBetween(-cr, 0, cr, 0);
    g.lineBetween(0, -cr, 0, cr);
    g.lineBetween(-cr * 0.7, -cr * 0.7, cr * 0.7, cr * 0.7);
    g.lineBetween(cr * 0.7, -cr * 0.7, -cr * 0.7, cr * 0.7);

    // 閃爍動畫（存在期間輕微脈動）
    this.scene.tweens.add({
      targets: g,
      alpha: { from: 0.9, to: 0.5 },
      duration: delaySeconds * 1000 * 0.8,
      yoyo: false,
      ease: 'Sine.easeIn',
    });

    const crack: FrostCrack = {
      x,
      y,
      damage,
      radius,
      delayRemaining: delaySeconds * 1000,
      graphics: g,
      exploded: false,
    };

    this.frostCracks.push(crack);
  }

  /**
   * 霜裂冰痕爆裂：對範圍內敵人造成傷害，並播放爆裂視覺效果
   */
  private explodeFrostCrack(crack: FrostCrack, enemies: Enemy[], deadEnemies: Enemy[]): void {
    // 爆裂視覺效果
    if (this.activeHitEffects < MAX_HIT_EFFECTS) {
      this.activeHitEffects++;
      const g = this.scene.add.graphics();
      g.lineStyle(2.5, 0x88ddff, 0.9);
      g.strokeCircle(0, 0, crack.radius * 0.5);
      g.fillStyle(0xaaddff, 0.2);
      g.fillCircle(0, 0, crack.radius * 0.5);
      g.setPosition(crack.x, crack.y);
      g.setDepth(8);

      this.scene.tweens.add({
        targets: g,
        scaleX: 2.0,
        scaleY: 2.0,
        alpha: 0,
        duration: 250,
        ease: 'Power2',
        onComplete: () => {
          g.destroy();
          this.activeHitEffects--;
        },
      });
    }

    // 傷害判定
    for (const enemy of enemies) {
      if (enemy.isDying) continue;
      if (deadEnemies.includes(enemy)) continue;

      const dx = crack.x - enemy.x;
      const dy = crack.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= crack.radius) {
        const died = enemy.takeDamage(crack.damage, crack.x, crack.y);
        if (died && !deadEnemies.includes(enemy)) {
          deadEnemies.push(enemy);
        }
      }
    }
  }

  /**
   * 驚鴻派大道：命中後生成分裂子投射物
   * 分裂子彈透過 inheritMechanicsFrom() 繼承來源投射物的所有機制 flag，
   * 包含 returning（流光返刃）、pierce（穿透）、frostCrack（霜裂冰痕）等。
   * @param sourceProj 原始投射物
   * @param hitX 命中位置 X
   * @param hitY 命中位置 Y
   */
  private spawnSplitProjectiles(sourceProj: Projectile, hitX: number, hitY: number): void {
    // 計算飛行方向角度
    const speed = Math.sqrt(sourceProj.velocityX * sourceProj.velocityX + sourceProj.velocityY * sourceProj.velocityY);
    if (speed < 1) return;

    const baseAngle = Math.atan2(sourceProj.velocityY, sourceProj.velocityX);

    // 分裂子彈速度：來源速度 ×105%（略快一點，視覺感更好）
    const splitSpeed = speed * 1.05;

    // 分裂子彈傷害
    const splitDamage = Math.max(1, Math.floor(sourceProj.damage * SPLIT_DAMAGE_MULTIPLIER));

    // 分裂子彈存活時間：以來源剩餘 lifeTime × 射程比例
    // 最少 200ms，避免瞬間消失
    const splitLifeTime = Math.max(200, sourceProj.lifeTime * SPLIT_RANGE_MULTIPLIER);

    const angles = [baseAngle - SPLIT_ANGLE_OFFSET, baseAngle + SPLIT_ANGLE_OFFSET];

    for (const angle of angles) {
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);

      const splitProj = new Projectile(
        this.scene,
        hitX,
        hitY,
        splitDamage,
        nx * splitSpeed,
        ny * splitSpeed,
        splitLifeTime,
        sourceProj.sourceWeaponId,
        0xaaffee, // 帶青白色，視覺區別於原始投射物
        false,    // 非爆炸型
        0,
        0,
        0,
        0         // pierceRemaining 先設 0，由 inheritMechanicsFrom 覆蓋
      );

      // ── 繼承來源投射物的所有機制 flag ──────────────────────────────────
      // 包含 returning / pierce / frostCrack 等，確保分裂子彈行為與來源一致
      splitProj.inheritMechanicsFrom(sourceProj);

      // ── 分裂子彈專屬標記（防止無限分裂）──────────────────────────────
      splitProj.isSplitProjectile = true;
      splitProj.splitDepth = 1;
      splitProj.hasSplit = true;           // 分裂子彈不可再次觸發分裂
      splitProj.sourceWeaponId = sourceProj.sourceWeaponId;

      // 視覺略小，區別於原始投射物
      splitProj.setSize(7, 7);
      splitProj.setAlpha(0.85);

      this.addProjectile(splitProj);
    }
  }
}
