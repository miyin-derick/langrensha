import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashHostToken, verifyHostTokenHash } from '../api/_shared/roomAuth';
import { getProviderConfig } from '../api/_shared/providerRegistry';
import { DEFAULT_AI_ROSTER } from '../src/constants';

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
assert.match(aiTurnSource, /providerQueues/);
assert.match(aiTurnSource, /providerCooldownMs/);
assert.match(aiTurnSource, /isTransientProviderError/);
assert.match(aiTurnSource, /shouldFallbackImmediately/);
assert.match(aiTurnSource, /fallbackModel/);
assert.match(aiTurnSource, /deepseek-v4-pro/);
assert.match(aiTurnSource, /余额不足/);
assert.match(aiTurnSource, /runWithProviderQueue\(provider/);

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
