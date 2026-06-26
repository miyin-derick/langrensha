import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { GameState, RoomSnapshot } from '../types';

interface RoomRow {
  id: string;
  state: GameState;
  last_event: { type: string; at: string } | null;
  updated_at: string;
}

let cachedClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are not configured');
  }

  cachedClient = createClient(url, anonKey);
  return cachedClient;
}

export function mapRoomRow(row: RoomRow): RoomSnapshot {
  return {
    id: row.id,
    state: row.state,
    lastEvent: row.last_event ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function fetchRoomSnapshot(roomId: string): Promise<RoomSnapshot | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('rooms')
    .select('id, state, last_event, updated_at')
    .eq('id', roomId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? mapRoomRow(data as RoomRow) : null;
}

export function subscribeToRoom(
  roomId: string,
  onSnapshot: (snapshot: RoomSnapshot) => void,
  onStatus?: (status: string) => void,
): () => void {
  const client = getSupabaseClient();
  let channel: RealtimeChannel | null = client
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        onSnapshot(mapRoomRow(payload.new as RoomRow));
      },
    )
    .subscribe((status) => {
      onStatus?.(status);
    });

  return () => {
    if (channel) {
      client.removeChannel(channel);
      channel = null;
    }
  };
}
