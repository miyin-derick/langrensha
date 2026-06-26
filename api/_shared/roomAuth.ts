import { createHash, timingSafeEqual } from 'node:crypto';

const roomIdPattern = /^[a-z0-9_-]{8,64}$/i;

export function assertRoomId(value: unknown): string {
  if (typeof value !== 'string' || !roomIdPattern.test(value)) {
    throw new Error('Invalid room id');
  }
  return value;
}

export function assertHostToken(value: unknown): string {
  if (typeof value !== 'string' || value.length < 24 || value.length > 256) {
    throw new Error('Invalid host token');
  }
  return value;
}

export function hashHostToken(roomId: string, token: string, secret = process.env.ROOM_TOKEN_SECRET ?? '') {
  return createHash('sha256').update(`${roomId}:${token}:${secret}`).digest('hex');
}

export function verifyHostTokenHash(roomId: string, token: string, expectedHash: string, secret = process.env.ROOM_TOKEN_SECRET ?? '') {
  const actual = Buffer.from(hashHostToken(roomId, token, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
