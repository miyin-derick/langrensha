import { useCallback, useEffect, useMemo, useState } from 'react';
import { postJson } from '../services/apiClient';
import { fetchRoomSnapshot, subscribeToRoom } from '../services/roomClient';
import { getRoomIdFromPath, getStoredHostToken, isHostRoute } from '../services/roomIdentity';
import type { GameState, RoomConnectionStatus, RoomSnapshot } from '../types';

interface UseRoomSessionOptions {
  currentState: GameState;
  applyRemoteState: (state: GameState) => void;
}

interface UpdateRoomResponse {
  room: {
    id: string;
    state: GameState;
    last_event: { type: string; at: string } | null;
    updated_at: string;
  };
}

export function useRoomSession({ currentState, applyRemoteState }: UseRoomSessionOptions) {
  const roomId = getRoomIdFromPath();
  const hostRequested = isHostRoute();
  const [hostToken] = useState(() => (roomId ? getStoredHostToken(roomId) : null));
  const [status, setStatus] = useState<RoomConnectionStatus>(roomId ? 'loading' : 'local');
  const [error, setError] = useState<string | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(roomId ? Date.now() : null);

  const isRoom = Boolean(roomId);
  const isHost = Boolean(roomId && hostRequested && hostToken);
  const isViewer = Boolean(roomId && !isHost);

  const shareUrl = useMemo(() => {
    if (!roomId) return '';
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    setStatus('loading');
    setError(null);

    fetchRoomSnapshot(roomId)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot) {
          setStatus('error');
          setError('房间不存在');
          return;
        }
        setLastSnapshotAt(Date.now());
        setStatus('connected');
        if (!isHost) {
          applyRemoteState(snapshot.state);
        }
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setStatus('error');
        setError(fetchError instanceof Error ? fetchError.message : '房间读取失败');
      });

    return () => {
      cancelled = true;
    };
  }, [applyRemoteState, isHost, roomId]);

  useEffect(() => {
    if (!roomId || isHost) return;

    return subscribeToRoom(
      roomId,
      (snapshot: RoomSnapshot) => {
        setLastSnapshotAt(Date.now());
        setStatus('connected');
        setError(null);
        applyRemoteState(snapshot.state);
      },
      (realtimeStatus) => {
        if (realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT') {
          setStatus('error');
          setError('实时同步连接中断');
        }
      },
    );
  }, [applyRemoteState, isHost, roomId]);

  useEffect(() => {
    if (!roomId) return;

    const timer = window.setInterval(() => {
      if (!lastSnapshotAt) return;
      if (Date.now() - lastSnapshotAt > 20000) {
        setStatus((current) => (current === 'connected' ? 'stale' : current));
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [lastSnapshotAt, roomId]);

  const publishSnapshot = useCallback(
    async (state: GameState = currentState, eventType = 'snapshot') => {
      if (!roomId || !hostToken) return;

      setStatus('syncing');
      setError(null);
      try {
        await postJson<UpdateRoomResponse>('/api/rooms/update', {
          roomId,
          hostToken,
          state,
          lastEvent: { type: eventType, at: new Date().toISOString() },
        });
        setLastSnapshotAt(Date.now());
        setStatus('connected');
      } catch (publishError) {
        setStatus('error');
        setError(publishError instanceof Error ? publishError.message : '房间同步失败');
      }
    },
    [currentState, hostToken, roomId],
  );

  return {
    isRoom,
    roomId,
    isHost,
    isViewer,
    status,
    error,
    shareUrl,
    publishSnapshot,
  };
}
