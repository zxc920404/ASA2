import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { Projectile } from '../objects/Projectile';
import { PoisonCloud } from '../objects/PoisonCloud';
import { getWeaponById } from '../data/weapons';

/** ?•å??©ç¾¤çµ„ä??ï?Requirement ?ˆèƒ½?åˆ¶ï¼?*/
const MAX_PROJECTILES = 100;

/** ?€è¿‘æ•µäººå¿«?–æ›´?°é??”ï?æ¯«ç?ï¼Œæ??½å„ª?–ï? */
const ENEMY_CACHE_INTERVAL = 250;

/** å®ˆå??°æ?è½‰é€Ÿåº¦ï¼ˆå¼§åº?ç§’ï? */
const RING_ROTATION_SPEED = 2.0;

/** å®ˆå??°æ?è½‰å?å¾‘æ?ä¾‹ï??»æ?ç¯„å???60%ï¼?*/
const RING_RADIUS_RATIO = 0.6;

/** å®ˆå??°å??Œä??µäºº?„å‚·å®³å†·?»ï?æ¯«ç?ï¼?*/
const RING_DAMAGE_COOLDOWN = 500;

/** èµ¤ç„°?°ç??¸å?å¾‘ï?pxï¼?*/
const FLAME_EXPLOSION_RADIUS = 80;

/** ?½ä¸­?¹æ??Œæ?ä¸Šé? */
const MAX_HIT_EFFECTS = 30;

/** ?Œæ?å­˜åœ¨?„æ??§æ•¸?ä???*/
const MAX_POISON_CLOUDS = 8;

// ?€?€ é©šé´»æ´¾å¤§?“ï??†è??•å??©å????€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
/** é©šé´»æ´¾å??€ character id */
const JINGHONG_CHARACTER_ID = 'assassin';
/** ?†è?å­å??¸é? */
const SPLIT_COUNT = 2;
/** ?†è?å­å??·å®³?ç? */
const SPLIT_DAMAGE_MULTIPLIER = 0.55;
/** ?†è?å­å?å°„ç??ç? */
const SPLIT_RANGE_MULTIPLIER = 0.6;
/** ?†è?è§’åº¦?ç§»ï¼ˆå¼§åº¦ï?ï¼ŒÂ?5 åº?*/
const SPLIT_ANGLE_OFFSET = 25 * (Math.PI / 180);

/**
 * å®ˆå??°ç’°ç¹é?
 * ç¹ç©å®¶æ?è½‰ï?ç¢°åˆ°?µäºº? æ??·å®³
 */
interface RingOrb {
  /** Phaser Rectangle é¡¯ç¤º?©ä»¶ */
  rect: Phaser.GameObjects.Rectangle;
  /** ?¶å?è§’åº¦ï¼ˆå¼§åº¦ï? */
  angle: number;
  /** å°å??µäºº?„æ?å¾Œå‚·å®³æ??“ï?key: enemy ?©ä»¶å¼•ç”¨ï¼Œvalue: ?‚é??³ï? */
  lastHitMap: Map<Enemy, number>;
}

/**
 * æ­¦å™¨å¯¦ä??€??
 */
interface WeaponInstance {
  weaponId: string;
  level: number;
  /** è·é›¢ä¸‹æ¬¡?»æ??„å‰©é¤˜æ??“ï?æ¯«ç?ï¼?*/
  attackCooldown: number;
  /** å®ˆå??°ç??°ç?é«”å?è¡¨ï???guardian_ring ä½¿ç”¨ï¼?*/
  ringOrbs: RingOrb[];
}

/**
 * WeaponSystem
 * ç®¡ç??©å®¶?€?‰æ­¦?¨ï?ä¾æ”»?Šé??”è‡ª?•ç™¼å°„æ?å°„ç‰©ï¼ˆRequirement 5.1ï½?.5ï¼?
 */
export class WeaponSystem {
  private scene: Phaser.Scene;

  /** ?•å??©ç¾¤çµ?*/
  private projectiles: Projectile[] = [];

  /** æ­¦å™¨å¯¦ä??—è¡¨ */
  private weaponInstances: WeaponInstance[] = [];

  /** ?€è¿‘æ•µäººå¿«??*/
  private cachedEnemies: Enemy[] = [];

  /** è·é›¢ä¸‹æ¬¡å¿«å??´æ–°?„å‰©é¤˜æ??“ï?æ¯«ç?ï¼?*/
  private cacheTimer: number = 0;

  /** ?¯å¦?«å?ï¼ˆRequirement 5.5ï¼?*/
  private paused: boolean = false;

  /** ?½ä¸­?¹æ?è¨ˆæ•¸ */
  private activeHitEffects: number = 0;

  /** æ¯’éœ§?€?Ÿå?è¡¨ï?æ¯’éœ§??”¨ï¼?*/
  private poisonClouds: PoisonCloud[] = [];

  /** ?¶å??©å®¶å®—é? character idï¼ˆé?é´»æ´¾å¤§é??¤æ–·?¨ï? */
  private characterId: string = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * ?å??–æ­¦?¨ç³»çµ±ï?ä¾ç©å®¶è??™æ?å»ºç?æ­¦å™¨å¯¦ä?
   * @param player ?©å®¶?©ä»¶
   * @param characterId ?©å®¶å®—é? character idï¼ˆé?é´»æ´¾å¤§é??¤æ–·?¨ï?
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

      // å®ˆå??°ï??å?å»ºç??°ç?é«”ï??¸é?å¾?levelStats.count è®€?–ï?å¥—ç”¨ amountBonusï¼?
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
   * ?æ–°?Œæ­¥æ­¦å™¨å¯¦ä?ï¼ˆè??™è??´å??¼å«ï¼?
   * @param player ?©å®¶?©ä»¶
   */
  public syncWeapons(player: Player): void {
    const newInstances: WeaponInstance[] = [];

    for (const slot of player.equipment.weapons) {
      // å°‹æ‰¾?¾æ?å¯¦ä?
      const existing = this.weaponInstances.find(w => w.weaponId === slot.weaponId);

      if (existing) {
        // ?´æ–°ç­‰ç?
        existing.level = slot.level;

        // å®ˆå??°ï??¥ç?ç´šæ”¹è®Šï??å»º?°ç?é«”ï??¸é?å¾?levelStats.count è®€?–ï?å¥—ç”¨ amountBonusï¼?
        if (slot.weaponId === 'guardian_ring') {
          const weaponData = getWeaponById(slot.weaponId);
          const baseCount = weaponData?.levelStats[slot.level - 1]?.count ?? 1;
          const amountBonus = weaponData?.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
          const newCount = Math.max(1, baseCount + amountBonus);
          if (existing.ringOrbs.length !== newCount) {
            // ç§»é™¤?Šç’°ç¹é?
            for (const orb of existing.ringOrbs) {
              orb.rect.destroy();
            }
            existing.ringOrbs = [];
            this.initRingOrbs(existing, newCount, player);
          }
        }

        newInstances.push(existing);
      } else {
        // ?°æ­¦??
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

    // ç§»é™¤å·²ä??¨è??™æ??„æ­¦?¨ï?æ¸…ç??°ç?é«”ï?
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
   * ?«å??€?‰æ”»?Šè??‚ï?Requirement 5.5ï¼?
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * ?¢å¾©?»æ?è¨ˆæ?ï¼ˆRequirement 5.5ï¼?
   */
  public resume(): void {
    this.paused = false;
  }

  /**
   * æ¯å??´æ–°ï¼ˆç”± GameScene.update() ?¼å«ï¼?
   * @param time  ?¶å??‚é??³ï?æ¯«ç?ï¼?
   * @param delta å¹€?‚é?å·®ï?æ¯«ç?ï¼?
   * @param player ?©å®¶?©ä»¶
   * @param enemies ?´ä??€?‰æ•µäº?
   * @returns ?€è¦ç§»?¤ç??µäºº?—è¡¨ï¼ˆHP ??0ï¼?
   */
  public update(
    time: number,
    delta: number,
    player: Player,
    enemies: Enemy[]
  ): Enemy[] {
    const deadEnemies: Enemy[] = [];

    // ?«å??‚å?æ­¢æ??‰æ”»?Šè??ºï?Requirement 5.5ï¼?
    if (this.paused) {
      // ?«å??‚ä??€?´æ–°å®ˆå??°ä?ç½®ï?è¦–è¦ºä¸Šå?æ­¢æ?è½‰ï?
      for (const inst of this.weaponInstances) {
        if (inst.weaponId === 'guardian_ring') {
          this.updateRingOrbPositions(inst, player);
        }
      }
      return deadEnemies;
    }

    // ?´æ–°?€è¿‘æ•µäººå¿«?–ï?æ¯?250ms ä¸€æ¬¡ï?
    this.cacheTimer -= delta;
    if (this.cacheTimer <= 0) {
      this.cacheTimer = ENEMY_CACHE_INTERVAL;
      this.updateEnemyCache(player, enemies);
    }

    // ?´æ–°?„æ­¦??
    for (const inst of this.weaponInstances) {
      const weaponData = getWeaponById(inst.weaponId);
      if (!weaponData) continue;

      // å¾?levelStats è®€?–ç•¶?ç?ç´šç??¸å€¼ï??ªå?è®€ levelStatsï¼Œfallback ??base ?¼ï?
      const stats = weaponData.levelStats[inst.level - 1] ?? weaponData.levelStats[0];

      // ?»æ??“é?ï¼šå„ª?ˆè? stats.intervalï¼Œfallback ??baseAttackInterval
      const baseInterval = stats.interval ?? weaponData.baseAttackInterval;

      // è¨ˆç??€çµ‚æ”»?Šé??”ï?æ¯«ç?ï¼‰ï?å¥—ç”¨?·å»?ç?è¢«å?ï¼ˆæ€¥æ”»ä»¤ï?
      // cooldownMultiplier < 1 è¡¨ç¤º?·å»ç¸®çŸ­ï¼ˆä?ï¼?.94 = ç¸®çŸ­ 6%ï¼?
      const finalInterval = baseInterval * player.stats.cooldownMultiplier * 1000;

      // ?»æ?ç¯„å?ï¼šå„ª?ˆè? stats.rangeï¼Œfallback ??baseAttackRange
      // æ³¨æ?ï¼šæ”»?Šç??ï?ç´¢æ•µè·é›¢ï¼‰ä??å??´è?ç¬¦å½±?¿ï??´è?ç¬¦æ”¹?ºå½±?¿ç???æ¯’éœ§?Šå?
      const baseRange = stats.range ?? weaponData.baseAttackRange;
      const finalRange = baseRange;

      // ?·å®³ï¼šå? stats.damage è®€?–ï?å¥—ç”¨?»æ???
      // player.stats.attackPower å·²ç”± StatCalculator å¥—ç”¨?€?‰è¢«?•å€ç?ï¼ˆå«?´å‹¢?°ï?
      // ä¸å?é¡å??¼å« getPassiveAttackMultiplierï¼Œé¿?é??è?ç®?
      const levelDamage = stats.damage;
      const finalDamage = Math.max(1, Math.floor(levelDamage * player.stats.attackPower));

      if (inst.weaponId === 'guardian_ring') {
        // å®ˆå??°ï??´æ–°?‹è?ä½ç½®ï¼Œæª¢æ¸¬ç¢°??
        this.updateGuardianRing(inst, time, delta, player, enemies, finalRange, finalDamage, deadEnemies, stats);
      } else {
        // ?¶ä?æ­¦å™¨ï¼šå€’è??‚æ”»??
        inst.attackCooldown -= delta;

        if (inst.attackCooldown <= 0) {
          // å°‹æ‰¾?»æ?ç¯„å??§æ?è¿‘ç??µäººï¼ˆRequirement 5.4ï¼?
          const target = this.findNearestEnemyInRange(player, finalRange);

          if (target) {
            // ?•å??©é€Ÿåº¦ï¼šå???projectileSpeedMultiplierï¼ˆTODO: ?®å??¡è¢«?•å??æ­¤å±¬æ€§ï??è¨­ 1.0ï¼?
            const projSpeed = (stats.projectileSpeed ?? weaponData.projectileSpeed) * player.stats.projectileSpeedMultiplier;

            // è¨ˆç??€çµ‚æ•¸?ï?baseCount + amountBonusï¼ˆå? usesAmountBonus === true ?‚å??¨ï?
            const baseCount = stats.count ?? 1;
            const amountBonus = weaponData.usesAmountBonus ? (player.stats.amountBonus ?? 0) : 0;
            const finalCount = Math.max(1, baseCount + amountBonus);

            if (inst.weaponId === 'swift_blade') {
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'swift_blade', 0x00ffff, finalCount);
            } else if (inst.weaponId === 'flame_seal') {
              const explosionRadius = (stats.radius ?? 80) * player.stats.areaMultiplier;
              this.fireFlameSeal(player, target, finalDamage, projSpeed, explosionRadius, finalCount);
            } else if (inst.weaponId === 'thunder_claw') {
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'thunder_claw', 0xffff00, finalCount);
            } else if (inst.weaponId === 'ice_spike') {
              // å¯’å†°?ï??Ÿç”¨ç©¿é€ï?pierce ?¸å? levelStats è®€?–ï?finalCount ?§åˆ¶?Œæ??¼å???
              const pierceCount = stats.pierce ?? 1;
              for (let i = 0; i < finalCount; i++) {
                this.firePiercingProjectile(player, target, finalDamage, projSpeed, finalRange, pierceCount);
              }
            } else if (inst.weaponId === 'light_shuttle') {
              // æµå?æ¢­ï?ç©¿é€æ?å°„ç‰©ï¼Œæ²¿?¨å??°é??è¼¯
              const pierceCount = stats.pierce ?? 1;
              for (let i = 0; i < finalCount; i++) {
                this.firePiercingProjectile(player, target, finalDamage, projSpeed, finalRange, pierceCount, 'light_shuttle');
              }
            } else if (inst.weaponId === 'soul_chasing_needle') {
              // è¿½é??ï??ªå?è¿½å°¾?•å??©ï?æ²¿ç”¨?¾é¢¨?ƒé?è¼?
              this.fireMultiProjectile(player, target, finalDamage, projSpeed, finalRange, 'soul_chasing_needle', 0xff88ff, finalCount);
            } else if (inst.weaponId === 'swift_blade_evolved') {
              // æµå?è¿”å?ï¼šç™¼å°„å??½ä¸­?–åˆ°?”æ?å¤§è??¢æ?è¿”é?ï¼Œå?ç¨‹å?æ¬¡å‚·??
              const returnMult = stats.returnDamageMultiplier ?? 0.7;
              this.fireReturningProjectile(player, target, finalDamage, projSpeed, finalRange, finalCount, returnMult);
            } else if (inst.weaponId === 'poison_mist') {
              // æ¯’éœ§???ä¸å? amountBonusï¼Œç›´?¥ç”¨ baseCount
              const cloudCount = baseCount;
              const cloudRadius = (stats.radius ?? 45) * player.stats.areaMultiplier;
              // ?ç??‚é?å¥—ç”¨ durationMultiplierï¼ˆTODO: ?®å??¡è¢«?•å??æ­¤å±¬æ€§ï??è¨­ 1.0ï¼?
              const cloudDuration = (stats.duration ?? 2.2) * player.stats.durationMultiplier * 1000;
              this.firePoisonMist(player, finalDamage, projSpeed, finalRange, cloudCount, cloudRadius, cloudDuration, enemies);
            } else {
              // ?¶ä?æ­¦å™¨ï¼šé?è¨­ç›´ç·šæ?å°?
              this.fireLinearProjectile(player, target, finalDamage, projSpeed, finalRange, inst.weaponId);
            }          }
          // ?¡è??¯å¦?‰ç›®æ¨™ï??ç½®?·å»
          inst.attackCooldown = finalInterval;
        }
      }
    }

    // ?´æ–°?€?‰æ?å°„ç‰©
    const toRemove: Projectile[] = [];
    for (const proj of this.projectiles) {
      const alive = proj.updateProjectile(delta);

      if (!alive) {
        // èµ¤ç„°?°åˆ°?Ÿæ??†ç‚¸
        if (proj.isExplosive && !proj.hasExploded) {
          const killed = this.explodeFlameSeal(proj, enemies, time);
          for (const e of killed) {
            if (!deadEnemies.includes(e)) deadEnemies.push(e);
          }
        }
        // æ¯’éœ§??ˆ°?Ÿæ?ï¼Œåœ¨?¶å?ä½ç½®?Ÿæ?æ¯’éœ§ï¼ˆé˜²æ­¢é??é ­å°è‡´æ¯’éœ§ä¸ç??ï?
        if (proj.weaponId === 'poison_mist') {
          this.spawnPoisonCloud(proj.x, proj.y, proj.damage, proj.explosionRadius, proj.cloudDuration);
        }
        // æµå?è¿”å?ï¼šå»ç¨‹åˆ°?Ÿæ??²å…¥è¿”é??€?‹ï?ä¸ç??»éŠ·æ¯€
        if (proj.canReturn && !proj.isReturning && !proj.hasReturned) {
          proj.isReturning = true;
          proj.lifeTime = 3000; // çµ?3 ç§’é??ç©å®?
          continue; // ä¸å???toRemoveï¼Œç¹¼çºŒå?æ´?
        }
        toRemove.push(proj);
        continue;
      }

      // èµ¤ç„°?°ï?æª¢æŸ¥?¯å¦?°é??®æ?ä½ç½®
      if (proj.isExplosive && !proj.hasExploded) {
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget < 10) {
          // ?°é??®æ?ï¼Œç???
          const killed = this.explodeFlameSeal(proj, enemies, time);
          for (const e of killed) {
            if (!deadEnemies.includes(e)) deadEnemies.push(e);
          }
          proj.hasExploded = true;
          toRemove.push(proj);
          continue;
        }
      }

      // æ¯’éœ§???å°„ç‰©ï¼šæª¢?¥æ˜¯?¦åˆ°?”ç›®æ¨™ä?ç½®ï??°é?å¾Œç??æ???
      if (proj.weaponId === 'poison_mist' && !proj.isExplosive) {
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget < 20) {
          // ?°é??®æ?ï¼Œç??æ???
          this.spawnPoisonCloud(proj.x, proj.y, proj.damage, proj.explosionRadius, proj.cloudDuration);
          toRemove.push(proj);
          continue;
        }
      }

      // ?ç??¸å??•å??©ï?æª¢æ¸¬?½ä¸­?µäººï¼ˆRequirement 5.3ï¼?
      // æ¯’éœ§???å°„ç‰©ä¸ç›´?¥å‘½ä¸­æ•µäººï??±æ??§å??Ÿè?è²¬å‚·å®?
      if (!proj.isExplosive && proj.weaponId !== 'poison_mist') {

        // ?€?€ æµå?è¿”å?ï¼šè??„ä¸­?„æ?å°„ç‰©?ç©å®¶é????€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
        if (proj.canReturn && proj.isReturning && !proj.hasReturned) {
          // ?´æ–°?Ÿåº¦?¹å?ï¼Œæ??©å®¶?¶å?ä½ç½®
          const rdx = player.x - proj.x;
          const rdy = player.y - proj.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);

          if (rdist < 20) {
            // ?°é??©å®¶?„è?ï¼ŒéŠ·æ¯€
            proj.hasReturned = true;
            toRemove.push(proj);
            continue;
          }

          const speed = Math.sqrt(proj.velocityX * proj.velocityX + proj.velocityY * proj.velocityY);
          proj.velocityX = (rdx / rdist) * speed;
          proj.velocityY = (rdy / rdist) * speed;

          // ?ç??½ä¸­?µäºº
          for (const enemy of enemies) {
            if (deadEnemies.includes(enemy)) continue;
            if (enemy.isDying) continue;
            if (proj.returnHitEnemies.has(enemy)) continue; // ?ç?å·²å‘½ä¸­é?

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
          continue; // è¿”é?ä¸­ç??•å??©ä?èµ°ä??¬å‘½ä¸­é?è¼?
        }

        let hit = false;
        for (const enemy of enemies) {
          if (deadEnemies.includes(enemy)) continue;
          if (enemy.isDying) continue;
          // ç©¿é€æ?å°„ç‰©ï¼šè·³?å·²?½ä¸­?ç??µäºº
          if (proj.hitEnemies.has(enemy)) continue;

          const dx = proj.x - enemy.x;
          const dy = proj.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= enemy.collisionRadius + 8) {
            // ?½ä¸­ï¼å‘¼??takeDamageï¼ˆæ‰£è¡€ + ?ƒç™½ + ?·å®³?¸å?ï¼?
            const died = enemy.takeDamage(proj.damage, proj.x, proj.y);
            if (died && !deadEnemies.includes(enemy)) {
              deadEnemies.push(enemy);
            }
            // ?½ä¸­?¹æ?ï¼ˆå??‰å?ï¼?
            this.spawnHitEffect(proj.x, proj.y);

            if (proj.canReturn && !proj.isReturning) {
              // æµå?è¿”å?ï¼šå‘½ä¸­å??²å…¥è¿”é??€?‹ï?ä¸éŠ·æ¯€
              proj.outboundHitEnemies.add(enemy);
              proj.isReturning = true;
              // å»¶é•·å­˜æ´»?‚é?ç¢ºä??½é??ç©å®¶ï?3 ç§’è¶³å¤ ï?
              proj.lifeTime = 3000;
              // ä¸è¨­ hit = trueï¼Œç¹¼çºŒé?è¡Œï??²å…¥è¿”é?æ¨¡å?ï¼?

              // é©šé´»æ´¾å¤§?“ï??»ç?ç¬¬ä?æ¬¡å‘½ä¸­æ??†è?ï¼ˆå?ç¨‹ä?è§¸ç™¼ï¼?
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
              // ç©¿é€æ¨¡å¼ï?è¨˜é?å·²å‘½ä¸­æ•µäººï?æ¶ˆè€—ä?æ¬¡ç©¿?æ¬¡?¸ï?ç¹¼ç?é£›è?
              proj.hitEnemies.add(enemy);
              proj.pierceRemaining -= 1;
              // ä¸è¨­ hit = trueï¼Œç¹¼çºŒæª¢?¥å…¶ä»–æ•µäººï??Œå??¯ç©¿?å??‹ï?

              // é©šé´»æ´¾å¤§?“ï?ç©¿é€æ?å°„ç‰©?ªåœ¨ç¬¬ä?æ¬¡å‘½ä¸­æ??†è?ä¸€æ¬?
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
              // ?ç©¿?æ¨¡å¼ï??½ä¸­?³éŠ·æ¯€

              // é©šé´»æ´¾å¤§?“ï??½ä¸­?‚å?è£?
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

    // ç§»é™¤æ­»äº¡?•å???
    for (const proj of toRemove) {
      this.removeProjectile(proj);
    }

    // ?´æ–°?€?‰æ??§å??Ÿï?tick ?·å®³ + ?Ÿå‘½?±æ?ï¼?
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
   * æ¶ˆé™¤?²å…¥ shield è­·ç›¾ç¯„å??§ç??©å®¶?•å???
   * ?ªæ??¤ç?æ­?? Projectileï¼ˆä?å½±éŸ¿å®ˆå??°ç’°ç¹é?ï¼?
   */
  public destroyProjectilesInShieldRange(shieldEnemies: import('../objects/Enemy').Enemy[]): void {
    const toRemove: Projectile[] = [];
    for (const proj of this.projectiles) {
      // å®ˆå??°ç’°ç¹é?ä¸åœ¨ projectiles ???ï¼Œè·³??
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
   * æ¸…ç??€?‰æ?å°„ç‰©?‡ç’°ç¹é?ï¼ˆå ´?¯å??›æ??¼å«ï¼?
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

  // ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  // ç§æ??¹æ?
  // ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€

  /**
   * ?´æ–°?€è¿‘æ•µäººå¿«?–ï?ä¾è??¢æ?åºï?
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
   * ?¨æ”»?Šç??å…§å°‹æ‰¾?€è¿‘ç??µäººï¼ˆRequirement 5.4ï¼?
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
   * ?å??–å?å¿ƒç’°?°ç?é«?
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
   * ?´æ–°å®ˆå??°ç’°ç¹é?ä½ç½®ï¼ˆä??‹è?ï¼Œå?è·Ÿéš¨?©å®¶ï¼?
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
   * ?´æ–°å®ˆå??°ï??‹è? + ç¢°æ??·å®³
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
      // ?‹è?è§’åº¦
      orb.angle += RING_ROTATION_SPEED * dt;

      // ?´æ–°ä½ç½®
      orb.rect.x = player.x + Math.cos(orb.angle) * radius;
      orb.rect.y = player.y + Math.sin(orb.angle) * radius;

      // ç¢°æ?æª¢æ¸¬
      for (const enemy of enemies) {
        if (deadEnemies.includes(enemy)) continue;
        if (enemy.isDying) continue;

        const dx = orb.rect.x - enemy.x;
        const dy = orb.rect.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= enemy.collisionRadius + 6) {
          // æª¢æŸ¥?·å»ï¼ˆæ??‹ç’°ç¹é?å°å?ä¸€?µäºº 0.5 ç§’å†·?»ï?
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

      // æ¸…ç?å·²æ­»äº¡æ•µäººç??·å»è¨˜é?ï¼ˆé˜²æ­?Map ?¡é?å¢é•·ï¼?
      for (const [e] of orb.lastHitMap) {
        if (!enemies.includes(e)) {
          orb.lastHitMap.delete(e);
        }
      }
    }
  }

  /**
   * ?¼å?å¤šç™¼?•å??©ï??¾é¢¨?ƒã€é›·?†çˆª?¨ï?
   * count > 1 ?‚å??¥å?è§’åº¦?ç§»ï¼Œé¿?å??¨é???
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

    // å¤šç™¼?‚å??»å????åº¦ï?æ¯ç™¼?“é?ç´?0.15 å¼§åº¦ ??8.6 åº¦ï?
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
   * ?¼å?èµ¤ç„°?°ï?é£›å??®æ?ä½ç½®ï¼Œåˆ°?”å??†ç‚¸ï¼?
   * count > 1 ?‚ä»¥å°è?åº¦å?ç§»ç™¼å°„å??¼ï?usesAmountBonus å¥—ç”¨å¾Œï?
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

      // å­˜æ´»?‚é?ï¼šè¶³å¤ é??°ç›®æ¨™ï?? ä?é»é?è£•ï?
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
        0xff4400, // æ©™ç???
        true,     // isExplosive
        explosionRadius,
        target.x,
        target.y
      );

      this.addProjectile(proj);
    }
  }

  /**
   * ?¼å??šç”¨?´ç??•å??©ï??¶ä?æ­¦å™¨?è¨­è¡Œç‚ºï¼?
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
   * ?¼å?ç©¿é€æ?å°„ç‰©ï¼ˆå??°é??æ??‰æ¢­?¨ï?
   * pierceCount ?ºå¯ç©¿é€ç??µäºº?¸é?ï¼ˆå‘½ä¸­ç¬¬ pierceCount+1 ?‹æ??·æ?ï¼?
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

    // pierceRemaining = pierceCount - 1ï¼?
    // ç¬¬ä?æ¬¡å‘½ä¸­æ??—ä?æ¬¡ï??¨å‘½ä¸­åˆ¤?·ä¸­ï¼‰ï?ä¹‹å?æ¯æ¬¡?½ä¸­?æ??—ä?æ¬?
    // ??pierceRemaining ?åˆ° 0 ?‚ï?ä¸‹ä?æ¬¡å‘½ä¸­æ??·æ?
    const proj = new Projectile(
      this.scene,
      player.x,
      player.y,
      damage,
      nx * speed,
      ny * speed,
      lifeTime,
      weaponId,
      0x88ddff, // æ·¡è??²ï??€?¥æ–¼?¶ä??•å???
      false,    // ?ç??¸å?
      0,        // explosionRadius
      0,        // targetX
      0,        // targetY
      pierceCount - 1  // pierceRemainingï¼šå·²??™¤ç¬¬ä?æ¬¡å‘½ä¸?
    );

    this.addProjectile(proj);
  }

  /**
   * ?¼å?æµå?è¿”å??•å??©ï??½ä¸­?–åˆ°?”æ?å¤§è??¢å?è¿”é??©å®¶ï¼Œå?ç¨‹å?æ¬¡å‚·?µï?
   * count > 1 ?‚å??¥å?è§’åº¦?ç§»ï¼Œé¿?å??¨é???
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
        0x88ffee // ?’ç™½?²ï??€?¥æ–¼?¾é¢¨?ƒç??’è‰²
      );
      proj.canReturn = true;
      proj.returnDamageMultiplier = returnDamageMultiplier;

      this.addProjectile(proj);
    }
  }

  /**
   * ?¼å?æ¯’éœ§???å°„ç‰©ï¼ˆæ”¯?´å??¼ï?ä¾?count æ±ºå??¸é?ï¼?
   * ?ªå??¸æ? range ?§ä??Œæ•µäººä??ºç›®æ¨™ï??µäººä¸è¶³?‚åœ¨ç¬¬ä??®æ??„è?? éš¨æ©Ÿå?ç§?
   * ?•å??©åˆ°?”ç›®æ¨™ä?ç½®å??Ÿæ? PoisonCloud
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
    // ?¶é? range ?§æ??‰æ•µäººï?ä¾è??¢æ?åºï?å·²ç”± cachedEnemies ?’å¥½ï¼?
    const targetsInRange: Enemy[] = [];
    for (const enemy of this.cachedEnemies) {
      if (enemy.isDying) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        targetsInRange.push(enemy);
      }
    }

    if (targetsInRange.length === 0) return; // æ²’æ??®æ?ï¼Œä??¼å?

    for (let i = 0; i < count; i++) {
      let targetX: number;
      let targetY: number;

      if (i < targetsInRange.length) {
        // ?ªå??¸æ?ä¸å??µäºº
        targetX = targetsInRange[i].x;
        targetY = targetsInRange[i].y;
      } else {
        // ?µäººä¸è¶³ï¼šåœ¨ç¬¬ä??®æ??„è?? éš¨æ©Ÿå?ç§»ï?30ï½?0pxï¼?
        const baseTarget = targetsInRange[0];
        const offsetDist = 30 + Math.random() * 40; // 30ï½?0px
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

      // å­˜æ´»?‚é?ï¼šè¶³å¤ é??°ç›®æ¨™ï?? ä?é»é?è£•ï?
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
        0x44ff66,    // ç¶ è‰²
        false,       // ?ç??¸å?
        cloudRadius, // ??explosionRadius æ¬„ä??²å?æ¯’éœ§?Šå?
        targetX,     // targetX
        targetY      // targetY
      );
      proj.cloudDuration = cloudDuration; // æ¯’éœ§?ç??‚é?

      this.addProjectile(proj);
    }
  }

  /**
   * ?¨æ?å®šä?ç½®ç??æ??§å???
   * è¶…é?ä¸Šé??‚ç§»?¤æ??Šç?æ¯’éœ§
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
   * èµ¤ç„°?°ç??¸ï?å°ç??¸å?å¾‘å…§?€?‰æ•µäººé€ æ??·å®³ï¼ˆRequirement 5.3ï¼?
   */
  private explodeFlameSeal(proj: Projectile, enemies: Enemy[], _time: number): Enemy[] {
    const killed: Enemy[] = [];

    // ?†ç‚¸æ³¢ç??¹æ?ï¼ˆå…©?ˆæ“´???ï¼?
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
   * ?°å??•å??©ï?è¶…é?ä¸Šé??‚ç§»?¤æ??Šç?
   */
  private addProjectile(proj: Projectile): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      const oldest = this.projectiles.shift();
      if (oldest) oldest.destroy();
    }
    this.projectiles.push(proj);
  }

  /**
   * ç§»é™¤ä¸¦éŠ·æ¯€?•å???
   */
  private removeProjectile(proj: Projectile): void {
    const idx = this.projectiles.indexOf(proj);
    if (idx !== -1) {
      this.projectiles.splice(idx, 1);
    }
    proj.destroy();
  }

  /**
   * ?½ä¸­å°å??ˆç‰¹?ˆï??•å??©å‘½ä¸­æ?ï¼?
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
   * ?†ç‚¸æ³¢ç??¹æ?ï¼ˆèµ¤?°å°ï¼?
   */
  private spawnExplosionEffect(x: number, y: number, radius: number): void {
    if (this.activeHitEffects >= MAX_HIT_EFFECTS) return;
    this.activeHitEffects++;

    // å¤–å?æ©™è‰²æ³¢ç?
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
   * é©šé´»æ´¾å¤§?“ï??¨å‘½ä¸­é??Ÿæ??†è??•å???
   * @param sourceProj ?Ÿå??•å???
   * @param hitX ?½ä¸­é»?X
   * @param hitY ?½ä¸­é»?Y
   */
  private spawnSplitProjectiles(sourceProj: Projectile, hitX: number, hitY: number): void {
    // è¨ˆç??Ÿå?é£›è??¹å?è§’åº¦
    const speed = Math.sqrt(sourceProj.velocityX * sourceProj.velocityX + sourceProj.velocityY * sourceProj.velocityY);
    if (speed < 1) return;

    const baseAngle = Math.atan2(sourceProj.velocityY, sourceProj.velocityX);

    // ?†è?å­å??Ÿåº¦ï¼šå??Ÿåº¦??105%ï¼ˆç•¥å¿«ä?é»è?è¦ºæ?ï¼?
    const splitSpeed = speed * 1.05;

    // ?†è?å­å??·å®³
    const splitDamage = Math.max(1, Math.floor(sourceProj.damage * SPLIT_DAMAGE_MULTIPLIER));

    // ?†è?å­å?å­˜æ´»?‚é?ï¼šä»¥?Ÿå??•å??©å‰©é¤?lifeTime ? å°„ç??ç?
    // ?³å? 200msï¼Œé¿?ç¬?“æ?å¤?
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
        0xaaffee, // ?¥å¸¶?’ç™½?²ï?è¦–è¦º?€??
        false,    // ?ç??¸å?
        0,
        0,
        0,
        0         // pierceRemaining = 0ï¼ˆå?è£‚å?å½ˆä?ç©¿é€ï?
      );

      // æ¨™è??ºå?è£‚æ?å°„ç‰©ï¼Œé˜²æ­¢å?æ¬¡å?è£?
      splitProj.isSplitProjectile = true;
      splitProj.splitDepth = 1;
      splitProj.sourceWeaponId = sourceProj.sourceWeaponId;

      // ?¥å??ç•¥?æ?ï¼Œè?è¦ºä??€?¥å?å§‹æ?å°„ç‰©
      splitProj.setSize(7, 7);
      splitProj.setAlpha(0.85);

      this.addProjectile(splitProj);
    }
  }
}
