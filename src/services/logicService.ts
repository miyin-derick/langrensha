

import { Faction, GameState, Player, Role, Phase } from "../types";
import { PhaseConstraints, RoleConstraints, GameConstraints, AIProvider } from "../types";

export class ConstraintGenerator {
  
  // 1. 生成阶段硬性约束
  static generatePhaseConstraints(gameState: GameState): PhaseConstraints {
    const phase = gameState.phase;
    
    switch (phase) {
      case Phase.NIGHT_WEREWOLF:
        return {
          currentPhase: phase,
          allowedActions: ['kill', 'discuss_with_wolves'],
          forbiddenActions: ['speak_publicly', 'vote'],
          requiredActions: ['choose_kill_target']
        };
      case Phase.NIGHT_WITCH:
        return {
          currentPhase: phase,
          allowedActions: ['save', 'poison', 'do_nothing'],
          forbiddenActions: ['speak_publicly', 'save_and_poison_same_night'],
          requiredActions: (gameState.nightVictimId && !gameState.witchPotionUsed) ? ['make_decision'] : undefined
        };
      case Phase.NIGHT_GUARD:
        return {
          currentPhase: phase,
          allowedActions: ['protect'],
          forbiddenActions: ['speak_publicly', 'protect_same_target_consecutively'],
          requiredActions: ['choose_protect_target']
        };
      case Phase.NIGHT_SEER:
        return {
          currentPhase: phase,
          allowedActions: ['check'],
          forbiddenActions: ['speak_publicly'],
          requiredActions: ['choose_check_target']
        };
      case Phase.DAY_DISCUSS:
      case Phase.DAY_SHERIFF_SPEECH:
      case Phase.DAY_LAST_WORDS:
        return {
          currentPhase: phase,
          allowedActions: ['speak', 'accuse', 'defend'],
          forbiddenActions: ['discuss_night_actions'],
          requiredActions: ['analyze_situation']
        };
      default:
        return {
          currentPhase: phase,
          allowedActions: ['vote', 'speak'],
          forbiddenActions: [],
          requiredActions: []
        };
    }
  }
  
  // 2. 生成角色权限约束
  static generateRoleConstraints(role: Role, gameState: GameState): RoleConstraints {
    return {
      role,
      informationVisibility: {
        seesWerewolfTeam: role === Role.WEREWOLF,
        seesSeerChecks: role === Role.SEER,
        seesWitchPotions: role === Role.WITCH,
        seesGuardHistory: role === Role.GUARD,
        knowsNightKillTarget: role === Role.WITCH && !gameState.witchPotionUsed
      },
      actionLimits: {
        // 允许自刀，允许自守
        canSelfTarget: role === Role.WEREWOLF || role === Role.GUARD, 
        canTargetTeammates: role === Role.WEREWOLF,
        mustActIfPossible: role === Role.SEER
      }
    };
  }
  
  // 3. 生成最终给AI看的结构体
  static generateConstraintsForAI(player: Player, gameState: GameState): GameConstraints {
    const phaseCons = this.generatePhaseConstraints(gameState);
    const roleCons = this.generateRoleConstraints(player.role, gameState);
    
    // 计算物理可选目标 (Target IDs)
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    let targetOptions = alivePlayers.map(p => p.id);
    
    // 守卫特殊过滤：不能连续守同一人
    if (player.role === Role.GUARD && gameState.lastGuardProtectId) {
        targetOptions = targetOptions.filter(id => id !== gameState.lastGuardProtectId);
    }
    
    // 预言家/狼人/女巫毒药：通常不限制目标(只要活着)，除非特殊规则
    // 这里保持开放，依靠 Prompt 引导

    return {
      currentPhase: gameState.phase,
      playerRole: player.role,
      phaseConstraints: {
        canSpeak: phaseCons.allowedActions.includes('speak'),
        canVote: phaseCons.allowedActions.includes('vote') || phaseCons.allowedActions.includes('kill') || phaseCons.allowedActions.includes('check') || phaseCons.allowedActions.includes('protect'),
        mustVote: !!phaseCons.requiredActions?.length,
        targetOptions,
        allowedActions: phaseCons.allowedActions // Passed through
      },
      roleConstraints: {
        information: this.formatInformationVisibility(roleCons.informationVisibility),
        limits: this.formatActionLimits(roleCons.actionLimits, gameState, player),
        permissions: this.formatPermissions(roleCons)
      }
    };
  }
  
  // Helpers
  private static formatInformationVisibility(v: any): string[] {
    const info: string[] = [];
    if (v.seesWerewolfTeam) info.push('可见狼队友');
    if (v.seesSeerChecks) info.push('可见查验历史');
    if (v.seesWitchPotions) info.push('可见药剂状态');
    if (v.knowsNightKillTarget) info.push('可见今晚刀口');
    return info;
  }

  private static formatActionLimits(l: any, state: GameState, player: Player): string[] {
    const limits: string[] = [];
    if (!l.canSelfTarget) limits.push('不可对自己使用技能');
    if (player.role === Role.GUARD && state.lastGuardProtectId) limits.push(`不可守护 ${state.lastGuardProtectId}号 (同上夜)`);
    if (player.role === Role.WITCH) {
        if (state.witchPotionUsed) limits.push('解药已用');
        if (state.witchPoisonUsed) limits.push('毒药已用');
    }
    return limits;
  }

  private static formatPermissions(c: RoleConstraints): string[] {
    const perms: string[] = [];
    if (c.actionLimits.canSelfTarget) perms.push('允许对自己使用技能(自刀/自守)');
    if (c.actionLimits.canTargetTeammates) perms.push('允许对队友使用技能');
    return perms;
  }
}

export const determineWinner = (players: Pick<Player, 'role' | 'isAlive'>[]): Faction | null => {
    const alive = players.filter(p => p.isAlive);
    const wolves = alive.filter(p => p.role === Role.WEREWOLF).length;
    const villagers = alive.filter(p => p.role === Role.VILLAGER).length;
    const gods = alive.filter(p => [Role.SEER, Role.WITCH, Role.HUNTER, Role.GUARD].includes(p.role)).length;

    if (wolves === 0) return Faction.GOOD;
    if (wolves * 2 >= alive.length) return Faction.BAD;
    if (villagers === 0 || gods === 0) return Faction.BAD;
    return null;
};

// 简单的后处理验证
export const validateAndFixResponse = (player: Player, state: GameState, response: any): any => {
    const normalizeClaimRole = (role: unknown): Role | null => {
        if (Object.values(Role).includes(role as Role)) return role as Role;
        if (typeof role !== 'string') return null;

        const normalized = role.trim();
        if (/预言家|先知|seer/i.test(normalized)) return Role.SEER;
        if (/女巫|witch/i.test(normalized)) return Role.WITCH;
        if (/猎人|hunter/i.test(normalized)) return Role.HUNTER;
        if (/守卫|guard/i.test(normalized)) return Role.GUARD;
        if (/狼人|wolf|werewolf/i.test(normalized)) return Role.WEREWOLF;
        if (/平民|村民|villager/i.test(normalized)) return Role.VILLAGER;
        return null;
    };

    if (response.claim?.role) {
        const role = normalizeClaimRole(response.claim.role);
        if (role) response.claim.role = role;
        else delete response.claim;
    }

    // 1. 基础修正 (原有的 voteTarget 修正)
    if (response.voteTarget) {
        const targetP = state.players.find(p => p.id === response.voteTarget);
        if (!targetP || !targetP.isAlive) {
            // 如果投给了死人或不存在的人，强制修正为 0 (弃票)
            response.voteTarget = 0; 
        }
        // 守卫防呆
        if (player.role === Role.GUARD && response.voteTarget === state.lastGuardProtectId) {
            response.voteTarget = 0; // 强行空守
        }
    }

    // 2. 🔥 女巫防呆修正 (保留！但静默执行，不改发言) 🔥
    if (player.role === Role.WITCH && state.phase === Phase.NIGHT_WITCH) {
        const thought = response.thought || "";
        // 检测心声里的强烈救人意愿
        const hasSaveIntent = /救|捞|use antidote|save/i.test(thought) && !/不救|放弃|no save/i.test(thought);
        
        if (hasSaveIntent && !state.witchPotionUsed) {
            if (!response.actionParams) response.actionParams = {};
            if (!response.actionParams.useAntidote) {
                // 静默修正：只改动作，不改 speech/thought，所以不会有“系统修正”的提示
                console.log(`[LogicFix] 帮女巫(${player.id})按下了救人按钮`);
                response.actionParams.useAntidote = true;
            }
        }
    }

    // 3. ❌ 狼人防自爆安全网 (已彻底删除) ❌
    // 之前这里有代码拦截狼人报队友，现在删掉了，让他自生自灭。

    // 4. 守卫/猎人 术语修正 (防止用错词)
    if (player.role === Role.GUARD && response.speech && response.speech.includes("查验")) {
         response.speech = response.speech.replace(/查验/g, "守护");
    }

    return response;
};
