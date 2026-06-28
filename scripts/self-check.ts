import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashHostToken, verifyHostTokenHash } from '../api/_shared/roomAuth';
import { getProviderConfig } from '../api/_shared/providerRegistry';
import { DEFAULT_AI_ROSTER } from '../src/constants';
import { InformationExtractor } from '../src/services/informationService';
import { determineWinner } from '../src/services/logicService';
import { Faction, Phase, Role, type GameState, type Player } from '../src/types';

const roomId = 'room_abc123';
const token = 'abcdefghijklmnopqrstuvwxyz123456';
const hash = hashHostToken(roomId, token, 'secret-a');

assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(hashHostToken(roomId, token, 'secret-a'), hash);
assert.notEqual(hashHostToken(roomId, token, 'secret-b'), hash);
assert.equal(verifyHostTokenHash(roomId, token, hash, 'secret-a'), true);
assert.equal(verifyHostTokenHash(roomId, `${token}x`, hash, 'secret-a'), false);

process.env.OPENAI_API_KEY = 'test-openai-key';
const openaiConfig = getProviderConfig('OpenAI');
assert.equal(openaiConfig.endpoint, 'https://api.openai.com/v1/chat/completions');
assert.equal(openaiConfig.apiKey, 'test-openai-key');

process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
const deepseekConfig = getProviderConfig('DeepSeek');
assert.equal(deepseekConfig.endpoint, 'https://api.deepseek.com/chat/completions');
assert.equal(deepseekConfig.apiKey, 'test-deepseek-key');

process.env.DOUBAO_API_KEY = 'test-doubao-key';
process.env.DOUBAO_MODEL = 'test-doubao-model';
const doubaoConfig = getProviderConfig('Doubao');
assert.equal(doubaoConfig.endpoint, 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
assert.equal(doubaoConfig.apiKey, 'test-doubao-key');
assert.equal(doubaoConfig.modelOverride, 'test-doubao-model');

process.env.ALIYUN_API_KEY = 'test-aliyun-key';
process.env.ALIYUN_MODEL = 'test-aliyun-model';
const aliyunConfig = getProviderConfig('Aliyun');
assert.equal(aliyunConfig.endpoint, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
assert.equal(aliyunConfig.apiKey, 'test-aliyun-key');
assert.equal(aliyunConfig.modelOverride, 'test-aliyun-model');

const providerCounts = DEFAULT_AI_ROSTER.reduce<Record<string, number>>((counts, seat) => {
  counts[seat.provider] = (counts[seat.provider] || 0) + 1;
  return counts;
}, {});

assert.equal(DEFAULT_AI_ROSTER.length, 12);
assert.deepEqual(providerCounts, {
  DeepSeek: 3,
  Zhipu: 3,
  Doubao: 2,
  Moonshot: 1,
  Aliyun: 3,
});

const rosterModelsByProvider = DEFAULT_AI_ROSTER.reduce<Record<string, string[]>>((models, seat) => {
  models[seat.provider] = [...(models[seat.provider] || []), seat.model];
  return models;
}, {});

assert.deepEqual(rosterModelsByProvider.DeepSeek, ['deepseek-v4-pro', 'deepseek-v4-pro', 'deepseek-v4-pro']);
assert.equal(rosterModelsByProvider.OpenAI, undefined);
assert.equal(rosterModelsByProvider.Gemini, undefined);
assert.deepEqual(rosterModelsByProvider.Doubao, ['doubao-seed-2-0-lite-260428', 'doubao-seed-2-0-lite-260428']);
assert.deepEqual(rosterModelsByProvider.Zhipu, ['glm-5.2', 'glm-5.2', 'glm-5.2']);
assert.deepEqual(rosterModelsByProvider.Moonshot, ['kimi-k2.6']);
assert.deepEqual(rosterModelsByProvider.Aliyun, ['qwen3.7-plus', 'qwen3.7-plus', 'qwen3.7-plus']);

const claimMemoryState = {
  day: 2,
  phase: Phase.DAY_DISCUSS,
  players: [
    { id: 1, isAlive: true, role: Role.SEER },
    { id: 2, isAlive: true, role: Role.WITCH },
    { id: 3, isAlive: true, role: Role.WEREWOLF },
    { id: 4, isAlive: true, role: Role.VILLAGER },
  ],
  logs: [
    {
      id: 'claim-1',
      tick: 1,
      day: 1,
      phase: Phase.DAY_SHERIFF_SPEECH,
      senderId: 1,
      type: 'SPEECH',
      content: '我是预言家，昨晚查了3号金水。',
    },
    {
      id: 'claim-accuse',
      tick: 2,
      day: 1,
      phase: Phase.DAY_SHERIFF_SPEECH,
      senderId: 4,
      type: 'SPEECH',
      content: '我怀疑3号，先站边1号预言家。',
    },
    {
      id: 'claim-2',
      tick: 3,
      day: 1,
      phase: Phase.DAY_DISCUSS,
      senderId: 2,
      type: 'SPEECH',
      content: '我跳女巫，今天先听票型。',
    },
    {
      id: 'vote-1',
      tick: 4,
      day: 1,
      phase: Phase.DAY_VOTE,
      senderId: 1,
      type: 'ACTION_VOTE',
      content: '1号 投票给了 -> 3号',
    },
    {
      id: 'vote-4',
      tick: 5,
      day: 1,
      phase: Phase.DAY_VOTE,
      senderId: 4,
      type: 'ACTION_VOTE',
      content: '4号 投票给了 -> 3号',
    },
  ],
  sheriffId: 1,
} as GameState;

assert.match(InformationExtractor.getCompactRoleClaims(claimMemoryState), /1号自称预言家/);
assert.match(InformationExtractor.getCompactRoleClaims(claimMemoryState), /2号自称女巫/);
assert.match(InformationExtractor.getPublicMemory(claimMemoryState), /公开身份声明：.*1号自称预言家/);
assert.doesNotMatch(InformationExtractor.getSituationSummary(claimMemoryState), /狼人\d|好人\d/);
assert.match(InformationExtractor.getSituationAwarenessSummary(claimMemoryState), /预言家线：.*1号报3号金水/);
assert.match(InformationExtractor.getSituationAwarenessSummary(claimMemoryState), /局势焦点：.*3号/);
assert.match(InformationExtractor.getSituationAwarenessSummary(claimMemoryState), /站边关系：.*4号→1号/);
assert.match(InformationExtractor.getSituationAwarenessSummary(claimMemoryState), /怀疑攻击：.*4号→3号/);
assert.match(InformationExtractor.getPublicMemory(claimMemoryState), /局势感知：/);
assert.doesNotMatch(InformationExtractor.getPublicMemory(claimMemoryState), /3号.*狼人/);

const playerForVictory = (id: number, role: Role, isAlive = true) => ({ id, role, isAlive }) as Player;

assert.equal(
  determineWinner([
    playerForVictory(1, Role.WEREWOLF),
    playerForVictory(2, Role.WEREWOLF),
    playerForVictory(3, Role.SEER),
    playerForVictory(4, Role.VILLAGER),
    playerForVictory(5, Role.WITCH, false),
  ]),
  Faction.BAD,
);
assert.equal(
  determineWinner([
    playerForVictory(1, Role.WEREWOLF),
    playerForVictory(2, Role.SEER),
    playerForVictory(3, Role.VILLAGER),
    playerForVictory(4, Role.WITCH),
  ]),
  null,
);
assert.equal(
  determineWinner([
    playerForVictory(1, Role.WEREWOLF, false),
    playerForVictory(2, Role.SEER),
    playerForVictory(3, Role.VILLAGER),
  ]),
  Faction.GOOD,
);

const supabaseSchema = readFileSync('supabase/schema.sql', 'utf8');
assert.match(supabaseSchema, /grant select on public\.rooms to anon, authenticated;/);
assert.match(supabaseSchema, /alter publication supabase_realtime add table public\.rooms;/);

const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
assert.deepEqual(vercelConfig.rewrites, [
  { source: '/room/:path*', destination: '/' },
]);

const aiChatSource = readFileSync('api/ai-chat.ts', 'utf8');
assert.match(aiChatSource, /AbortSignal\.timeout\(25_000\)/);
assert.match(aiChatSource, /status\(504\)/);
assert.doesNotMatch(aiChatSource, /enable_thinking\s*=\s*false/);
assert.doesNotMatch(aiChatSource, /thinking\s*=\s*\{\s*type:\s*'disabled'\s*\}/);
assert.match(aiChatSource, /temperature: isKimiK26 \? 1 :/);

const aiTurnSource = readFileSync('src/services/geminiService.ts', 'utf8');
assert.match(aiTurnSource, /max_tokens:\s*900/);
assert.match(aiTurnSource, /speech.*60字以内/);
assert.doesNotMatch(aiTurnSource, /当前心态|发言风格|当前目标/);
assert.match(aiTurnSource, /providerQueues/);
assert.match(aiTurnSource, /providerCooldownMs/);
assert.match(aiTurnSource, /isTransientProviderError/);
assert.match(aiTurnSource, /shouldFallbackImmediately/);
assert.match(aiTurnSource, /fallbackModel/);
assert.match(aiTurnSource, /deepseek-v4-pro/);
assert.match(aiTurnSource, /余额不足/);
assert.match(aiTurnSource, /runWithProviderQueue\(provider/);
assert.match(aiTurnSource, /getPublicMemory/);
assert.match(aiTurnSource, /公共结构化记忆与局势感知/);
assert.match(aiTurnSource, /不要忽略已经公开跳身份或报查验的玩家/);

const appSource = readFileSync('src/App.tsx', 'utf8');
assert.match(appSource, /AI_BATCH_SIZE\s*=\s*12/);
assert.doesNotMatch(appSource, /processWithStagger<[^>]+>\([^,\n]+,\s*[24],/);
assert.doesNotMatch(appSource, /PLAYSTYLES\[|Math\.random\(\) \* PLAYSTYLES\.length/);
assert.match(appSource, /profile:\s*DEFAULT_PLAYSTYLE/);

const constantsSource = readFileSync('src/constants.ts', 'utf8');
assert.doesNotMatch(constantsSource, /PLAYSTYLES/);
assert.doesNotMatch(constantsSource, /personality/);
assert.doesNotMatch(constantsSource, /理智哥|小甜心|暴躁大叔|高冷御姐|乐子人|温柔阿姨|逻辑帝|胆小妹|冲动男|深沉男|焦虑女/);
assert.doesNotMatch(constantsSource, /逻辑缜密|绿茶性格|脾气火爆|话少高傲|阴阳怪气|知心大姐姐|严谨论文风|谨慎|直肠子|城府深|神经质/);

const decisionEngineSource = readFileSync('src/services/decisionEngine.ts', 'utf8');
assert.doesNotMatch(decisionEngineSource, /getSpeechStyle|config\.personality|性格描述/);
assert.doesNotMatch(decisionEngineSource, /mindset|speechStyle|goals/);

const typesSource = readFileSync('src/types.ts', 'utf8');
assert.doesNotMatch(typesSource, /mindset|speechStyle|goals|心理模型|说话风格/);

const ttsServiceSource = readFileSync('src/services/ttsService.ts', 'utf8');
assert.doesNotMatch(ttsServiceSource, /postForBlob\("\/api\/tts"/);
assert.match(ttsServiceSource, /export const prefetch[\s\S]+return null;/);

const collectTsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? collectTsFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

const extensionlessRuntimeImports = collectTsFiles('api').flatMap((file) => {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/import\s+(?!type\b)[^'"]+from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
    .map((match) => ({ file, specifier: match[1] }))
    .filter(({ specifier }) => !/\.(js|json)$/.test(specifier));
});

assert.deepEqual(extensionlessRuntimeImports, []);

console.log('self-check passed');
