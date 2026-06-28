// 📂 services/decisionEngine.ts (新建文件)
import { Player, GameState, Role, DecisionContext } from "../types";

export class DecisionEngine {
  
  static createDecisionContext(player: Player, gameState: GameState): DecisionContext {
    const roleContext = this.getRoleSpecificContext(player, gameState);
    
    return {
      playerId: player.id,
      role: player.role,
      phase: gameState.phase,
      isAlive: player.isAlive,
      
      knows: roleContext.knows,
      doesntKnow: roleContext.doesntKnow
    };
  }

  private static getRoleSpecificContext(player: Player, gameState: GameState) {
    const isNight = gameState.phase.includes("NIGHT");

    // --- 1. 狼人 (Werewolf) ---
    if (player.role === Role.WEREWOLF) {
      const teammates = gameState.players
        .filter(p => p.role === Role.WEREWOLF && p.id !== player.id)
        .map(p => p.id);
      
      const nightTarget = gameState.nightVictimId ? `${gameState.nightVictimId}号` : "未知";

      return {
        knows: isNight 
          ? [`我是狼人`, `我的狼队友是: ${teammates.length ? teammates.join(',')+'号' : '无'}`]
          : [`我是狼人 (白天必须死命伪装成好人!)`, `昨晚我们刀了: ${nightTarget}`],
        doesntKnow: [`谁是女巫`, `谁是猎人`, `谁是守卫`]
      };
    }

    // --- 2. 预言家 (Seer) ---
    if (player.role === Role.SEER) {
      const checkHistory = gameState.logs
        .filter(l => l.type === 'ACTION_CHECK' && l.senderId === player.id)
        .map(l => l.content); // 例如 "查验 3号 -> 狼人"

      return {
        knows: [`我是预言家`, ...checkHistory],
        doesntKnow: [`谁是女巫`, `谁是守卫`, `除查验外的狼人是谁`]
      };
    }

    // --- 3. 女巫 (Witch) ---
    if (player.role === Role.WITCH) {
      const potionStatus = `解药:${gameState.witchPotionUsed?'已用':'可用'}, 毒药:${gameState.witchPoisonUsed?'已用':'可用'}`;
      const silverWater = (!gameState.witchPotionUsed && gameState.nightVictimId) 
          ? `今晚 ${gameState.nightVictimId}号 倒牌了(我可以救)。` 
          : ``;

      return {
        knows: [`我是女巫`, potionStatus, silverWater].filter(Boolean),
        doesntKnow: [`谁是预言家`, `谁是猎人`, `我救的人到底是好人还是自刀狼`]
      };
    }

    // --- 4. 猎人 (Hunter) ---
    if (player.role === Role.HUNTER) {
        return {
            knows: ["我是猎人", "我死后可以开枪带走一人（除非被毒杀）"],
            doesntKnow: ["谁是好人", "谁是狼人"]
        };
    }

    // --- 5. 守卫 (Guard) ---
    if (player.role === Role.GUARD) {
        const lastProtect = gameState.lastGuardProtectId ? `昨晚守了 ${gameState.lastGuardProtectId}号` : "昨晚空守";
        return {
            knows: ["我是守卫", lastProtect, "我不能连续两晚守同一个人"],
            doesntKnow: ["谁是女巫", "谁是预言家"]
        };
    }

    // --- 6. 平民 (Villager) ---
    return {
      knows: [`我是平民`, `我没有任何特殊技能`, `我是一个闭眼玩家`],
      doesntKnow: [`谁是好人`, `谁是狼人`, `谁是神职`]
    };
  }
}
