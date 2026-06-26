import assert from 'node:assert/strict';
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

process.env.DOUBAO_API_KEY = 'test-doubao-key';
process.env.DOUBAO_MODEL = 'test-doubao-model';
const doubaoConfig = getProviderConfig('Doubao');
assert.equal(doubaoConfig.endpoint, 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
assert.equal(doubaoConfig.apiKey, 'test-doubao-key');
assert.equal(doubaoConfig.modelOverride, 'test-doubao-model');

const providerCounts = DEFAULT_AI_ROSTER.reduce<Record<string, number>>((counts, seat) => {
  counts[seat.provider] = (counts[seat.provider] || 0) + 1;
  return counts;
}, {});

assert.equal(DEFAULT_AI_ROSTER.length, 12);
assert.deepEqual(providerCounts, {
  OpenAI: 2,
  Gemini: 1,
  DeepSeek: 2,
  Zhipu: 3,
  Doubao: 1,
  Moonshot: 1,
  Aliyun: 2,
});

console.log('self-check passed');
