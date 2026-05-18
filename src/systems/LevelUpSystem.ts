import { Player } from '../objects/Player';
import { UpgradeOption } from '../types/index';
import { UpgradePool } from './UpgradePool';
import { LevelUpPanel } from '../ui/LevelUpPanel';
import { getWeaponById } from '../data/weapons';
import { getPassiveById } from '../data/passives';

/** 裝備等級上限（Requirement 12.3） */
const MAX_EQUIPMENT_LEVEL = 8;

/**
 * GameScene 需要提供給 LevelUpSystem 的介面
 * 避免循環依賴，使用介面而非直接引用 GameScene
 */
export interface IGameScene {
  pauseGame(): void;
  resumeGame(): void;
  pauseForLevelUp(): void;
  resumeFromLevelUp(): void;
  getScene(): Phaser.Scene;
}

/**
 * LevelUpSystem
 * 負責升級流程：
 * 1. 接收升級觸發（由 GameScene 呼叫 triggerLevelUp()）
 * 2. 呼叫 UpgradePool 取得選項
 * 3. 暫停遊戲（呼叫 GameScene 的 pauseGame()）
 * 4. 建立並顯示 LevelUpPanel
 * 5. 玩家選擇後：套用效果、重算屬性、恢復遊戲（呼叫 GameScene 的 resumeGame()）
 *
 * Requirement 10.3, 10.4
 */
export class LevelUpSystem {
  private gameScene: IGameScene;
  private upgradePool: UpgradePool;
  private currentPanel: LevelUpPanel | null = null;

  constructor(gameScene: IGameScene) {
    this.gameScene = gameScene;
    this.upgradePool = new UpgradePool();
  }

  /**
   * 觸發升級流程
   * @param player 玩家物件
   */
  public triggerLevelUp(player: Player): void {
    // 取得升級選項
    const options = this.upgradePool.getOptions(
      player.equipment,
      player.characterId
    );

    // 升級專用暫停（不顯示 PausePanel）
    this.gameScene.pauseForLevelUp();

    // 建立並顯示 LevelUpPanel（Requirement 10.3）
    const scene = this.gameScene.getScene();
    this.currentPanel = new LevelUpPanel(
      scene,
      options,
      (option: UpgradeOption) => this.onOptionSelected(player, option)
    );
  }

  /**
   * 玩家選擇升級選項後的處理
   * @param player 玩家物件
   * @param option 選擇的升級選項
   */
  private onOptionSelected(player: Player, option: UpgradeOption): void {
    // 套用效果（Requirement 10.4）
    this.applyOption(player, option);

    // 重新計算屬性（Requirement 13.3）
    player.recalculateStats();

    // 清除面板引用
    this.currentPanel = null;

    // 升級專用恢復（不觸發 PausePanel 流程）
    this.gameScene.resumeFromLevelUp();
  }

  /**
   * 套用升級選項效果至玩家裝備欄
   * @param player 玩家物件
   * @param option 升級選項
   */
  private applyOption(player: Player, option: UpgradeOption): void {
    switch (option.type) {
      case 'newWeapon': {
        // 確認武器存在
        const weaponData = getWeaponById(option.id);
        if (!weaponData) break;

        // 確認武器欄未滿且未持有
        const alreadyOwned = player.equipment.weapons.some(w => w.weaponId === option.id);
        if (!alreadyOwned && player.equipment.weapons.length < 6) {
          player.equipment.weapons.push({ weaponId: option.id, level: 1 });
        }
        break;
      }

      case 'upgradeWeapon': {
        // 找到已持有的武器並升級
        const slot = player.equipment.weapons.find(w => w.weaponId === option.id);
        if (slot && slot.level < MAX_EQUIPMENT_LEVEL) {
          slot.level += 1;
        }
        // 若已達 Lv8，忽略（Requirement 12.3）
        break;
      }

      case 'newPassive': {
        // 確認被動存在
        const passiveData = getPassiveById(option.id);
        if (!passiveData) break;

        // 確認被動欄未滿且未持有
        const alreadyOwned = player.equipment.passives.some(p => p.passiveId === option.id);
        if (!alreadyOwned && player.equipment.passives.length < 6) {
          player.equipment.passives.push({ passiveId: option.id, level: 1 });
        }
        break;
      }

      case 'upgradePassive': {
        // 找到已持有的被動並升級
        const slot = player.equipment.passives.find(p => p.passiveId === option.id);
        if (slot && slot.level < MAX_EQUIPMENT_LEVEL) {
          slot.level += 1;
        }
        // 若已達 Lv8，忽略（Requirement 12.3）
        break;
      }

      case 'healHp': {
        // 所有裝備滿級時的 fallback：恢復 30% 最大 HP
        const healAmount = Math.floor(player.stats.maxHP * 0.3);
        player.currentHP = Math.min(player.stats.maxHP, player.currentHP + healAmount);
        break;
      }
    }
  }
}
