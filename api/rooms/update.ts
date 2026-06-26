import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GameState } from '../../src/types';
import { assertHostToken, assertRoomId, verifyHostTokenHash } from '../_shared/roomAuth';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin';

interface UpdateRoomRequestBody {
  roomId: string;
  hostToken: string;
  state: GameState;
  lastEvent?: {
    type: string;
    at?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body as UpdateRoomRequestBody;
    const roomId = assertRoomId(body.roomId);
    const hostToken = assertHostToken(body.hostToken);
    if (!body.state || typeof body.state !== 'object') {
      res.status(400).json({ error: 'Invalid room state' });
      return;
    }

    const supabase = createSupabaseAdmin();
    const { data: room, error: readError } = await supabase
      .from('rooms')
      .select('id, host_token_hash')
      .eq('id', roomId)
      .single();

    if (readError || !room) {
      res.status(404).json({ error: readError?.message || 'Room not found' });
      return;
    }

    if (!verifyHostTokenHash(roomId, hostToken, room.host_token_hash)) {
      res.status(403).json({ error: 'Host token mismatch' });
      return;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('rooms')
      .update({
        state: body.state,
        last_event: body.lastEvent ? { ...body.lastEvent, at: body.lastEvent.at || now } : { type: 'snapshot', at: now },
        updated_at: now,
      })
      .eq('id', roomId)
      .select('id, state, last_event, updated_at')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ room: data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
