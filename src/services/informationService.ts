import { GameState, Player, LogMessage, Role, Phase } from "../types";

export class InformationExtractor {
  private static readonly roleLabels: Record<Role, string> = {
    [Role.UNKNOWN]: '未知',
    [Role.WEREWOLF]: '狼人',
    [Role.VILLAGER]: '平民',
    [Role.SEER]: '预言家',
    [Role.WITCH]: '女巫',
    [Role.HUNTER]: '猎人',
    [Role.GUARD]: '守卫'
  };

  private static normalizeClaimRole(role: unknown): Role | null {
    if (Object.values(Role).includes(role as Role)) return role as Role;
    if (typeof role !== 'string') return null;

    const normalized = role.trim();
    const aliases: Array<[Role, RegExp]> = [
      [Role.SEER, /预言家|先知|seer/i],
      [Role.WITCH, /女巫|witch/i],
      [Role.HUNTER, /猎人|hunter/i],
      [Role.GUARD, /守卫|guard/i],
      [Role.WEREWOLF, /狼人|wolf|werewolf/i],
      [Role.VILLAGER, /平民|村民|villager/i],
    ];

    return aliases.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
  }

  private static inferRoleClaim(content: string): Role | null {
    const text = content.replace(/\s+/g, '');
    const cue = '(我是|我跳|我起跳|我拍|我认|我底牌是|我的身份是|身份是|这张牌是|我这里是|我这张牌是)';
    const roleAliases: Array<[Role, string]> = [
      [Role.SEER, '(真)?(预言家|先知)'],
      [Role.WITCH, '(真)?女巫'],
      [Role.HUNTER, '(真)?猎人'],
      [Role.GUARD, '(真)?守卫'],
      [Role.WEREWOLF, '狼人'],
      [Role.VILLAGER, '(平民|村民|民牌)'],
    ];

    for (const [role, alias] of roleAliases) {
      if (new RegExp(`${cue}${alias}`).test(text)) return role;
      if (new RegExp(`${alias}(是我|我来跳|我来报|我来拍)`).test(text)) return role;
    }

    return null;
  }

  private static addUnique(items: string[], item: string) {
    if (!items.includes(item)) items.push(item);
  }

  private static extractMentionedPlayer(content: string, patterns: RegExp[]): number | null {
    const text = content.replace(/\s+/g, '');
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return Number(match[1]);
    }
    return null;
  }

  private static extractPublicCheck(log: LogMessage): string | null {
    if (log.type !== 'SPEECH' || !log.senderId) return null;
    const text = log.content.replace(/\s+/g, '');
    const checkMatch =
      text.match(/查(?:验|了|到)?(\d+)号?(金水|银水|好人|查杀|狼人|坏人)/) ||
      text.match(/(\d+)号?(金水|银水|好人|查杀|狼人|坏人)/);

    if (!checkMatch) return null;

    const targetId = Number(checkMatch[1]);
    const result = checkMatch[2].includes('杀') || checkMatch[2].includes('狼') || checkMatch[2].includes('坏')
      ? '查杀'
      : '金水';
    return `${log.senderId}号报${targetId}号${result}`;
  }

  private static getLatestVoteTally(gameState: GameState): string {
    const latestVotePhase = [...gameState.logs]
      .reverse()
      .find(log => log.type === 'ACTION_VOTE')?.phase;

    if (!latestVotePhase) return '暂无公开票型';

    const voteGroups = new Map<string, number[]>();
    gameState.logs
      .filter(log => log.type === 'ACTION_VOTE' && log.phase === latestVotePhase && log.senderId)
      .forEach(log => {
        const target = log.content.match(/-> (\d+)号/)?.[1] ?? '弃票';
        voteGroups.set(target, [...(voteGroups.get(target) || []), log.senderId!]);
      });

    if (voteGroups.size === 0) return '暂无公开票型';

    return Array.from(voteGroups.entries())
      .map(([target, voters]) => `${voters.join('、')}号→${target === '弃票' ? '弃票' : `${target}号`}`)
      .join('；');
  }
  
  // =================================================================
  // 🔥 核心：基于角色和阶段的严格信息过滤
  // =================================================================

  /**
   * 获取玩家在当前阶段能看到的所有信息
   * 这是AI决策的唯一信息来源
   */
  static getPlayerView(player: Player, gameState: GameState): {
    visibleLogs: string[];
    roleSpecificInfo: string;
    phaseSpecificInfo: string;
  } {
    // 1. 过滤出该玩家能看到的原始日志
    const rawVisibleLogs = gameState.logs.filter(log => 
      this.isLogVisibleToPlayer(log, player, gameState.phase)
    );
    
    // 2. 根据阶段进一步过滤（关键！）
    const phaseFilteredLogs = this.applyPhaseFilter(rawVisibleLogs, gameState.phase);
    
    // 3. 格式化为自然语言
    const formattedLogs = phaseFilteredLogs
      .slice(-15) // 保留最近15条
      .map(log => this.formatLog(log, player));
    
    // 4. 获取角色特定信息
    const roleInfo = this.getRoleSpecificInformation(player, gameState);
    
    // 5. 获取阶段特定信息
    const phaseInfo = this.getPhaseSpecificInformation(gameState.phase);
    
    return {
      visibleLogs: formattedLogs,
      roleSpecificInfo: roleInfo,
      phaseSpecificInfo: phaseInfo
    };
  }

  /**
   * 基于角色和游戏状态判断日志是否可见
   */
  private static isLogVisibleToPlayer(log: LogMessage, player: Player, currentPhase: Phase): boolean {
    const isNight = currentPhase.includes('NIGHT');
    
    // 📢 系统公告：根据阶段决定
    if (log.type === 'SYSTEM') {
      // 系统公告的内容也要过滤
      const content = log.content;
      
      // 警长竞选阶段：隐藏所有夜间结果信息
      if (this.isSheriffPhase(currentPhase)) {
        if (content.includes('第') && content.includes('夜')) return false;
        if (content.includes('倒牌')) return false;
        if (content.includes('死亡')) return false;
        if (content.includes('平安夜')) return false;
      }
      return true;
    }
    
    // 💀 死亡信息：只在公布阶段后可见
    if (log.type === 'DEATH') {
      return !this.isSheriffPhase(currentPhase); // 警长竞选阶段不可见
    }
    
    // 🎤 白天发言：所有人都能看到
    if (log.type === 'SPEECH') {
      return !isNight; // 只有白天能看到发言
    }
    
    // 🗳️ 投票动作：所有人都能看到
    if (log.type === 'ACTION_VOTE' || log.type === 'VOTE') {
      return !isNight;
    }
    
    // 🐺 狼队频道：只有狼人在夜间能看到
    if (log.type === 'WOLF_CHANNEL') {
      return player.role === Role.WEREWOLF && isNight;
    }
    
    // 🤔 心声：只有自己能看到
    if (log.type === 'THOUGHT') {
      return log.senderId === player.id;
    }
    
    // 🛡️ 夜间行动：只有执行者能看到
    if (['ACTION_CHECK', 'ACTION_SAVE', 'ACTION_KILL'].includes(log.type)) {
      // 狼人的刀人信息：所有狼人都能看到
      if (log.type === 'ACTION_KILL' && player.role === Role.WEREWOLF && isNight) {
        return true;
      }
      // 自己的行动：总是能看到
      return log.senderId === player.id;
    }
    
    // 👑 警长变动：所有人都能看到
    if (log.type === 'SHERIFF') {
      return true;
    }
    
    return false;
  }

  /**
   * 根据游戏阶段进一步过滤日志
   * 这是解决警长竞选信息泄露的关键！
   */
  private static applyPhaseFilter(logs: LogMessage[], currentPhase: Phase): LogMessage[] {
    if (this.isSheriffPhase(currentPhase)) {
      // 🚫 警长竞选阶段：彻底移除所有夜间信息
      return logs.filter(log => {
        // 移除所有夜间行动日志
        if (['ACTION_CHECK', 'ACTION_SAVE', 'ACTION_KILL'].includes(log.type)) {
          return false;
        }
        
        // 移除狼队频道
        if (log.type === 'WOLF_CHANNEL') {
          return false;
        }
        
        // 移除包含夜间信息的系统公告
        if (log.type === 'SYSTEM') {
          const content = log.content;
          if (content.includes('第') && content.includes('夜')) return false;
          if (content.includes('倒牌')) return false;
          if (content.includes('死亡')) return false;
        }
        
        // 移除死亡信息
        if (log.type === 'DEATH') {
          return false;
        }
        
        return true;
      });
    }
    
    return logs;
  }

  /**
   * 判断当前是否为警长竞选阶段
   */
  private static isSheriffPhase(phase: Phase): boolean {
    return [
      Phase.DAY_SHERIFF_NOM,
      Phase.DAY_SHERIFF_SPEECH,
      Phase.DAY_SHERIFF_VOTE,
      Phase.DAY_SHERIFF_PK_SPEECH,
      Phase.DAY_SHERIFF_PK_VOTE
    ].includes(phase);
  }

  /**
   * 格式化日志为自然语言
   */
  private static formatLog(log: LogMessage, viewer: Player): string {
    const isSelf = log.senderId === viewer.id;
    
    switch(log.type) {
      case 'SYSTEM':
        return `📢 ${log.content}`;
        
      case 'SPEECH':
        const speaker = isSelf ? "我" : `${log.senderId}号`;
        const roleClaim = log.claim?.role ? `(自称${log.claim.role})` : "";
        return `${speaker}${roleClaim}说：${log.content}`;
        
      case 'THOUGHT':
        return isSelf ? `💭 ${log.content}` : '';
        
      case 'WOLF_CHANNEL':
        return `🐺${isSelf ? '我' : log.senderId + '号'}：${log.content}`;
        
      case 'ACTION_CHECK':
        return `🔮 我${log.content}`;
        
      case 'ACTION_SAVE':
        return `🛡️ 我${log.content}`;
        
      case 'ACTION_KILL':
        if (viewer.role === Role.WEREWOLF) {
          return `🔪 狼队${log.content}`;
        }
        return isSelf ? `🔪 我${log.content}` : '';
        
      case 'ACTION_VOTE':
        const match = log.content.match(/-> (\d+)号/);
        if (match) {
          return `🗳️ ${log.senderId}号投给了${match[1]}号`;
        }
        return `🗳️ ${log.senderId}号弃票`;
        
      case 'DEATH':
        return `💀 ${log.content}`;
        
      case 'VOTE':
        return `📊 ${log.content}`;
        
      case 'SHERIFF':
        return `👑 ${log.content}`;
        
      default:
        return log.content;
    }
  }

  /**
   * 获取角色特定信息（基于角色应该知道的信息）
   */
  private static getRoleSpecificInformation(player: Player, gameState: GameState): string {
    const info: string[] = [];
    
    switch(player.role) {
      case Role.WEREWOLF:
        // 狼人知道队友
        const teammates = gameState.players
          .filter(p => p.role === Role.WEREWOLF && p.id !== player.id && p.isAlive)
          .map(p => p.id);
        
        if (teammates.length > 0) {
          info.push(`你的狼队友是：${teammates.join('号、')}号`);
        } else {
          info.push(`你是孤独的狼人，没有队友`);
        }
        
        // 如果是夜间，知道刀口
        if (gameState.phase.includes('NIGHT') && gameState.nightVictimId) {
          info.push(`狼队昨晚的目标是：${gameState.nightVictimId}号`);
        }
        break;
        
      case Role.WITCH:
        info.push(`你是女巫`);
        info.push(gameState.witchPotionUsed ? `解药已使用` : `解药可用`);
        info.push(gameState.witchPoisonUsed ? `毒药已使用` : `毒药可用`);
        
        if (gameState.nightVictimId && !gameState.witchPotionUsed) {
          info.push(`昨晚${gameState.nightVictimId}号倒牌`);
        }
        break;
        
      case Role.SEER:
        info.push(`你是预言家`);
        if (gameState.seerCheckId) {
          const target = gameState.players.find(p => p.id === gameState.seerCheckId);
          const result = target?.role === Role.WEREWOLF ? '狼人' : '好人';
          info.push(`你昨晚查验了${gameState.seerCheckId}号，结果是：${result}`);
        }
        break;
        
      case Role.GUARD:
        info.push(`你是守卫`);
        if (gameState.lastGuardProtectId) {
          info.push(`昨晚你守护了${gameState.lastGuardProtectId}号`);
        }
        break;
        
      case Role.HUNTER:
        info.push(`你是猎人，死亡时可以开枪带走一人`);
        break;
        
      case Role.VILLAGER:
        info.push(`你是平民，没有特殊能力`);
        break;
    }
    
    return info.join('。');
  }

  /**
   * 获取阶段特定信息
   */
  private static getPhaseSpecificInformation(phase: Phase): string {
    if (this.isSheriffPhase(phase)) {
      return `【警长竞选阶段】现在是警长竞选，还不知道昨夜结果。请根据警上玩家发言分析。`;
    }
    
    switch(phase) {
      case Phase.DAY_ANNOUNCE:
        return `【公布昨夜结果】刚刚公布了昨夜情况。`;
      case Phase.DAY_LAST_WORDS:
        return `【遗言阶段】死者发表遗言。`;
      case Phase.DAY_DISCUSS:
        return `【自由讨论阶段】所有人都知道昨夜结果，可以自由发言讨论。`;
      case Phase.NIGHT_START:
        return `【夜晚开始】天黑请闭眼。`;
      default:
        return `【${phase}阶段】`;
    }
  }

  // =================================================================
  // 🔽 兼容性方法（保持现有代码调用不变）🔽
  // =================================================================
  
  static getVisibleLogsForPlayer(gameState: GameState, viewer: Player, limit: number = 10): string[] {
    const view = this.getPlayerView(viewer, gameState);
    return view.visibleLogs.slice(-limit);
  }
  
  static getRecentRawLogs(gameState: GameState, viewer: Player, limit: number): string {
    return this.getVisibleLogsForPlayer(gameState, viewer, limit).join('\n');
  }
  
  static getCompactVoteHistory(gameState: GameState): string {
    const votes: string[] = [];
    gameState.logs.forEach(log => {
      if (log.type === 'ACTION_VOTE') {
        const match = log.content.match(/-> (\d+)号/);
        if (match && log.senderId) {
          votes.push(`${log.senderId}→${match[1]}`);
        } else if (log.content.includes('弃票') && log.senderId) {
          votes.push(`${log.senderId}→弃票`);
        }
      }
    });
    return votes.length > 0 ? `投票记录：${votes.join('、')}` : '暂无投票记录';
  }

  static getSituationAwarenessSummary(gameState: GameState): string {
    const seerLines: string[] = [];
    const supports: string[] = [];
    const attacks: string[] = [];
    const focusScores = new Map<number, number>();

    const scoreFocus = (id: number, score: number) => {
      focusScores.set(id, (focusScores.get(id) || 0) + score);
    };

    gameState.logs.forEach(log => {
      if (log.type === 'SPEECH' && log.senderId) {
        const publicCheck = this.extractPublicCheck(log);
        if (publicCheck) this.addUnique(seerLines, publicCheck);

        const attackedId = this.extractMentionedPlayer(log.content, [
          /(?:怀疑|踩|打|出|抗推|票|投|锤|归|裸打)(\d+)号/,
          /(\d+)号(?:有问题|像狼|不做好|该出|抗推|狼面|匪面)/,
        ]);
        if (attackedId && attackedId !== log.senderId) {
          this.addUnique(attacks, `${log.senderId}号→${attackedId}号`);
          scoreFocus(attackedId, 2);
        }

        const supportedId = this.extractMentionedPlayer(log.content, [
          /(?:站边|认|信|跟|保)(\d+)号/,
          /(\d+)号(?:可信|做好|像好人|是真预言家|是真神)/,
        ]);
        if (supportedId && supportedId !== log.senderId) {
          this.addUnique(supports, `${log.senderId}号→${supportedId}号`);
        }
      }

      if (log.type === 'ACTION_VOTE') {
        const targetId = Number(log.content.match(/-> (\d+)号/)?.[1] || 0);
        if (targetId) scoreFocus(targetId, 1);
      }
    });

    const focus = Array.from(focusScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => `${id}号`);

    return [
      `预言家线：${seerLines.slice(-4).join('、') || '暂无明确预言家线'}`,
      `局势焦点：${focus.join('、') || '暂无明显焦点'}`,
      `站边关系：${supports.slice(-6).join('、') || '暂无明确站边'}`,
      `怀疑攻击：${attacks.slice(-6).join('、') || '暂无明确攻击'}`,
      `最新票型：${this.getLatestVoteTally(gameState)}`,
    ].join('\n');
  }
  
  static getCompactRoleClaims(gameState: GameState): string {
    const claims = new Map<number, Role>();
    [...gameState.logs].reverse().forEach(l => {
      if (l.type !== 'SPEECH' || !l.senderId || claims.has(l.senderId)) return;

      const role = this.normalizeClaimRole(l.claim?.role) ?? this.inferRoleClaim(l.content);
      if (role) {
        claims.set(l.senderId, role);
      }
    });
    
    if (claims.size === 0) return "暂无身份声明";
    return Array.from(claims.entries())
      .map(([id, role]) => `${id}号自称${this.roleLabels[role]}`)
      .join('、');
  }
  
  static getSituationSummary(gameState: GameState): string {
    const alive = gameState.players.filter(p => p.isAlive);
    const dead = gameState.players.filter(p => !p.isAlive);
    
    let summary = `第${gameState.day}天，当前阶段${gameState.phase}，存活${alive.length}人：${alive.map(p => `${p.id}号`).join('、')}`;
    if (dead.length > 0) {
      summary += `；出局：${dead.map(p => `${p.id}号`).join('、')}`;
    }
    
    if (gameState.sheriffId) {
      summary += `，警长：${gameState.sheriffId}号`;
    }
    
    return summary;
  }

  static getPublicMemory(gameState: GameState): string {
    return [
      `局面摘要：${this.getSituationSummary(gameState)}`,
      `公开身份声明：${this.getCompactRoleClaims(gameState)}`,
      `公开票型：${this.getCompactVoteHistory(gameState)}`,
      `局势感知：\n${this.getSituationAwarenessSummary(gameState)}`,
      '注意：身份声明只代表玩家公开自称，不代表真实身份。'
    ].join('\n');
  }
  
  // 保持现有方法签名但不实际使用
  static extractStructuredState(gameState: GameState): any {
    return {};
  }
  
  static getPlayerPerspective(player: Player, gameState: GameState): any {
    return {};
  }
}
