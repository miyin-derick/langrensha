import assert from 'node:assert/strict';
import { hashHostToken, verifyHostTokenHash } from '../api/_shared/roomAuth';

const roomId = 'room_abc123';
const token = 'abcdefghijklmnopqrstuvwxyz123456';
const hash = hashHostToken(roomId, token, 'secret-a');

assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(hashHostToken(roomId, token, 'secret-a'), hash);
assert.notEqual(hashHostToken(roomId, token, 'secret-b'), hash);
assert.equal(verifyHostTokenHash(roomId, token, hash, 'secret-a'), true);
assert.equal(verifyHostTokenHash(roomId, `${token}x`, hash, 'secret-a'), false);

console.log('self-check passed');
