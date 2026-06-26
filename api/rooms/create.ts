import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GameState } from '../../src/types';
import { assertHostToken, assertRoomId, hashHostToken } from '../_shared/roomAuth.js';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.js';

interface CreateRoomRequestBody {
  roomId: string;
  hostToken: string;
  state: GameState;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body as CreateRoomRequestBody;
    const roomId = assertRoomId(body.roomId);
    const hostToken = assertHostToken(body.hostToken);
    if (!body.state || typeof body.state !== 'object') {
      res.status(400).json({ error: 'Invalid room state' });
      return;
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        host_token_hash: hashHostToken(roomId, hostToken),
        state: body.state,
        last_event: { type: 'created', at: new Date().toISOString() },
      })
      .select('id, state, last_event, updated_at')
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      res.status(status).json({ error: error.message });
      return;
    }

    res.status(201).json({ room: data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
