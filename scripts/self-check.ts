import assert from 'node:assert/strict';
import { hashHostToken, verifyHostTokenHash } from '../api/_shared/roomAuth';
import { getProviderConfig } from '../api/_shared/providerRegistry';

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

console.log('self-check passed');
