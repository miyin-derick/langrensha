const ROOM_ID_BYTES = 9;
const HOST_TOKEN_BYTES = 24;

function randomBase64Url(byteCount: number) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .toLowerCase();
}

export function createRoomId() {
  return randomBase64Url(ROOM_ID_BYTES);
}

export function createHostToken() {
  return randomBase64Url(HOST_TOKEN_BYTES);
}

export function hostTokenStorageKey(roomId: string) {
  return `ai-werewolf-live:host-token:${roomId}`;
}

export function getStoredHostToken(roomId: string) {
  return window.localStorage.getItem(hostTokenStorageKey(roomId));
}

export function storeHostToken(roomId: string, token: string) {
  window.localStorage.setItem(hostTokenStorageKey(roomId), token);
}

export function getRoomIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/room\/([a-z0-9_-]+)$/i);
  return match?.[1] ?? null;
}

export function isHostRoute(search = window.location.search) {
  return new URLSearchParams(search).get('host') === '1';
}
