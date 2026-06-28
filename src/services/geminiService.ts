import { Player, Role, GameState, AIProvider, AIResponse } from "../types";
import { validateAndFixResponse, ConstraintGenerator } from "./logicService";
import { InformationExtractor } from "./informationService";
import { DecisionEngine } from "./decisionEngine"; // ✅ 确保你已经创建了这个文件
import { getPlayerConfig } from '../constants'; 
import { postJson } from "./apiClient";

const providerQueues = new Map<AIProvider, Promise<void>>();
const providerReadyAt = new Map<AIProvider, number>();
const providerCooldownMs: Partial<Record<AIProvider, number>> = { Zhipu: 3500 };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const fallbackModel = 'deepseek-v4-pro';
const isTransientProviderError = (error: unknown) =>
    error instanceof Error && /1302|1305|速率限制|访问量过大|余额不足|无可用资源包|稍后再试|timed out|Timeout|fetch failed|Failed to fetch/.test(error.message);
const shouldFallbackImmediately = (error: unknown) =>
    error instanceof Error && /timed out|Timeout|fetch failed|Failed to fetch/.test(error.message);

const runWithProviderQueue = async <T>(provider: AIProvider, task: () => Promise<T>): Promise<T> => {
    const previous = providerQueues.get(provider) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    const next = previous.catch(() => undefined).then(() => current);
    providerQueues.set(provider, next);

    await previous.catch(() => undefined);
    const waitMs = Math.max(0, (providerReadyAt.get(provider) ?? 0) - Date.now());
    if (waitMs > 0) await delay(waitMs);

    try {
        return await task();
    } finally {
        providerReadyAt.set(provider, Date.now() + (providerCooldownMs[provider] ?? 0));
        release();
        if (providerQueues.get(provider) === next) providerQueues.delete(provider);
    }
};

// --- JSON 清洗工具 ---
const cleanJSONResponse = (text: string): any => {
    try {
        let cleanText = text.trim();
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        const firstOpen = cleanText.indexOf('{');
        const lastClose = cleanText.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) cleanText = cleanText.substring(firstOpen, lastClose + 1);
        cleanText = cleanText.replace(/[\r\n\t]+/g, ' '); 
        return JSON.parse(cleanText);
    } catch (e) {
        return { speech: "...", thought: "（解析错误，跳过）", voteTarget: 0 };
    }
};

// --- API 请求器 ---
const executeAIRequest = async (provider: AIProvider, initialModel: string, systemPrompt: string, userContent: string, temperature: number): Promise<any> => {
    const request = (requestProvider: AIProvider, model: string) => postJson<{ choices?: Array<{ message?: { content?: string } }> }>('/api/ai-chat', {
        provider: requestProvider,
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
        ],
        temperature,
        max_tokens: 900,
    });
    const data = await runWithProviderQueue(provider, async () => {
        try {
            return await request(provider, initialModel);
        } catch (error) {
            if (!isTransientProviderError(error)) throw error;
            if (provider !== 'DeepSeek' && shouldFallbackImmediately(error)) {
                return runWithProviderQueue('DeepSeek', () => request('DeepSeek', fallbackModel));
            }
            await delay(4000);
            try {
                return await request(provider, initialModel);
            } catch (retryError) {
                if (provider === 'DeepSeek' || !isTransientProviderError(retryError)) throw retryError;
                return runWithProviderQueue('DeepSeek', () => request('DeepSeek', fallbackModel));
            }
        }
    });
    return cleanJSONResponse(data.choices?.[0]?.message?.content || "{}");
};

// --- 🔥 [核心] 生成玩家行动 (深度汉化版) ---
export const generatePlayerTurn = async (player: Player, gameState: GameState, specificInstruction: string): Promise<AIResponse> => {
    
    // 1. 🧠 认知层：生成大脑上下文 (From DecisionEngine)
    const context = DecisionEngine.createDecisionContext(player, gameState);
    
    // 2. 👁️ 感知层：获取视野内的最近日志 (From InformationService)
    const visibleLogs = InformationExtractor.getVisibleLogsForPlayer(gameState, player, 10);
    const publicMemory = InformationExtractor.getPublicMemory(gameState);
    
    // 3. 🔒 物理层：获取合法的行动目标
    const constraints = ConstraintGenerator.generateConstraintsForAI(player, gameState);
    const validTargets = constraints.phaseConstraints.targetOptions;

    // 4. 🗣️ 表达层：构建全中文 Prompt
    const systemPrompt = `
# 核心指令
你正在进行一场真实的狼人杀游戏。你是一个**真人玩家**。
请扮演 ${player.id}号玩家 (${player.role})。

## 🎭 你的角色设定
- **名字**: ${getPlayerConfig(player.id).name}
- **当前心态**: ${context.mindset}
- **发言风格**: ${context.speechStyle}
- **当前目标**: ${context.goals.join(", ")}

## 🧠 你的记忆库 (已知事实)
${context.knows.map(k => `✅ ${k}`).join('\n')}

## 🚫 你的盲区 (严禁出现幻觉)
${context.doesntKnow.map(k => `❌ ${k}`).join('\n')}

## 📜 现场实况 (你最近看到/听到的)
${visibleLogs.length > 0 ? visibleLogs.join('\n') : "(暂无最近消息)"}

## 🧾 公共结构化记忆与局势感知
${publicMemory}
请优先参考这里的公开身份声明、预言家线、站边关系、怀疑攻击和票型来判断局势。不要忽略已经公开跳身份或报查验的玩家。

## 🎯 当前任务
指令: ${specificInstruction}
当前阶段: ${gameState.phase}
合法行动目标 (ID): [${validTargets.join(', ')}] 或填 0 (弃权/空过)

## 📝 输出规则 (严格 JSON 格式)
1. **纯净 JSON**: 只输出 JSON 字符串，严禁包含 \`\`\`json 或其他解释性文字。
2. **第一人称**: 必须用“我”来称呼自己。
3. **内心独白 (thought)**: 诚实地记录你的战术思考（仅观众可见）。
4. **公开言论 (speech)**: 这是最重要的！不仅面向玩家，也面向看游戏的观众！！这是你对所有人说的话（如果你是狼人，必须在 speech 里伪装，但 thought 要诚实）。
5. **公开跳身份 (claim)**: 如果你在 speech 里明确跳身份，填写 claim.role；没跳身份就省略 claim。可选: SEER/WITCH/HUNTER/GUARD/VILLAGER/WEREWOLF。
6. **行动参数**: 必须包含 voteTarget。
7. **长度限制**: speech 控制在60字以内，thought 控制在40字以内，节奏要像真人短发言。

JSON 格式示例:
{
  "speech": "大家听我说，我觉得5号逻辑不通...",
  "thought": "5号踩到我痛脚了，我要把他抗推出去...",
  "claim": { "role": "SEER" },
  "voteTarget": 5,
  "actionParams": { "useAntidote": false, "poisonTarget": 0 }
}
`;

    const userContent = `现在轮到你了 (${player.id}号)。请根据场上局势执行指令。`;

    try {
        // 使用配置的温度，若无则默认 0.7
        const temp = player.profile.temperature?.speak || 0.7;
        
        const rawResponse = await executeAIRequest(player.aiProvider, player.modelName, systemPrompt, userContent, temp);
        
        // 逻辑层兜底修正
        return validateAndFixResponse(player, gameState, rawResponse);
    } catch (e) {
        console.error(`[AI Error] ${player.id}号 生成失败`, e);
        return { 
            speech: "...", 
            thought: "（思考中断）", 
            voteTarget: 0 
        };
    }
};

export const generateWolfStrategy = async (gameState: GameState): Promise<string> => {
    return "自由行动，优先击杀神职"; 
};
