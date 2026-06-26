# Watch-Together Vercel/Supabase Design

## Context

The project is a Vite React single-page app that simulates a 12-player AI Werewolf game for spectators. The current implementation runs the game state machine in the browser, calls model and TTS APIs directly from the frontend, and has stream-focused UI modes for OBS-style viewing.

The new goal is to let the owner and one remote friend watch the same AI game together without either person joining as a player. The owner is the host and controls playback; the friend receives a shared room link and watches the synchronized board, subtitles, and logs.

## Goals

- Deploy the app on Vercel.
- Protect LLM and TTS API keys by moving provider calls behind Vercel API routes.
- Add share-link watch rooms where one host controls the game and viewers are read-only.
- Use Supabase Realtime for room state synchronization.
- Keep the first version small: synchronized game state, subtitles, logs, controls, and connection status.
- Preserve the existing stream, desktop, green-screen, role reveal, thought reveal, and local TTS behavior where practical.

## Non-Goals

- No user accounts.
- No room passwords.
- No shared audio playback timeline.
- No backend worker that runs games while every browser is closed.
- No multi-host control or control transfer.
- No audience voting, chat, gifts, or live-platform integration.
- No major rule-system rewrite.

## Product Behavior

The app opens to a simple landing state with a `Create Watch Room` action. Creating a room generates a random `roomId` and host token, stores the host token only in the host browser, creates a Supabase room record through a Vercel API route, and navigates to `/room/<roomId>?host=1`.

The host room shows the normal game board and control panel. It also shows a copyable viewer link without the host token: `/room/<roomId>`.

The viewer room subscribes to the same room state and renders the board in read-only mode. Viewers do not see start, step, reset, or auto-loop controls. They can still use local display preferences that do not mutate the room, such as mute, role visibility if allowed by the host state, and layout mode if kept local.

The host browser remains the authoritative game runner. If the host closes the page, the game stops advancing. Viewers keep seeing the last published snapshot and a stale/host-offline notice after a timeout.

## Architecture

### Frontend

- Keep the React app as the main game runner.
- Add routing for:
  - `/` landing/create room.
  - `/room/:roomId` viewer or host room.
- Split room concerns into small utilities/hooks instead of expanding `App.tsx` further:
  - `src/services/roomClient.ts` for Supabase browser subscription helpers.
  - `src/hooks/useRoomSession.ts` for host/viewer mode, loading, publishing, and connection status.
  - `src/services/apiClient.ts` for calling local Vercel API routes.
- Keep the existing state machine initially, but add a narrow integration point:
  - host publishes snapshots after `GameState` changes.
  - viewer receives snapshots and replaces local render state.

### Vercel API Routes

Use Vercel serverless functions under `api/`:

- `api/ai-chat.ts`
  - Accepts provider, model, messages, temperature, and max token parameters from the frontend.
  - Selects the real provider API key from server environment variables.
  - Proxies to the provider endpoint.
  - Returns the provider response body needed by the app.

- `api/tts.ts`
  - Accepts text, voice, speed, and format.
  - Uses the server-side SiliconFlow key.
  - Returns audio bytes or an error response.

- `api/rooms/create.ts`
  - Generates or accepts a room id and host token.
  - Stores a hashed host token in Supabase.
  - Initializes the room state.

- `api/rooms/update.ts`
  - Accepts room id, host token, game state snapshot, and optional event metadata.
  - Verifies the token against the room record.
  - Writes the latest snapshot to Supabase.

### Supabase

Use Supabase as the sync layer, not as the game engine. The client reads room state through the anon key and subscribes via Realtime. Writes go through Vercel API routes so the service role key and host-token verification stay server-side.

First version table:

```sql
create table public.rooms (
  id text primary key,
  host_token_hash text not null,
  state jsonb not null,
  last_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Read access can be public for room ids that are hard to guess. Write access should be blocked from anon clients; only the service role route updates rows.

## Data Flow

### Host Startup

1. Host creates a room.
2. Frontend generates a host token and stores it in local storage keyed by room id.
3. Frontend calls `/api/rooms/create`.
4. The API route creates the Supabase row with the initial `GameState`.
5. The host navigates to `/room/<roomId>?host=1`.

### Host Game Progress

1. Host clicks auto start, pause, single step, or reset.
2. The existing `App` state machine updates local `GameState`.
3. A publish effect sends a compact snapshot to `/api/rooms/update`.
4. Supabase Realtime notifies subscribed viewers.

### Viewer Sync

1. Viewer opens `/room/<roomId>`.
2. Frontend reads the current room snapshot from Supabase.
3. Frontend subscribes to row changes for that room.
4. Each update replaces the viewer render state.
5. Viewer controls that would mutate game state are hidden or disabled.

## Key Protection

No LLM or TTS provider key should be exposed as `VITE_*` in the browser for production. Server-only keys live in Vercel environment variables:

- `DEEPSEEK_API_KEY` or `SILICONFLOW_API_KEY`
- Optional provider keys such as `GEMINI_API_KEY`, `ALIYUN_API_KEY`, `MOONSHOT_API_KEY`, `MINIMAX_API_KEY`, `ZHIPU_API_KEY`, `TENCENT_API_KEY`, and `GROQ_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Browser-exposed variables are limited to:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The frontend model service should call `/api/ai-chat` instead of provider endpoints directly. The frontend TTS service should call `/api/tts` instead of SiliconFlow directly.

## Error Handling

- If AI generation fails, keep the current fallback behavior: speech `"..."`, thought `"（思考中断）"`, and a safe `voteTarget`.
- If publishing a host snapshot fails, show a sync warning but do not stop the local host game.
- If viewer subscription disconnects, show reconnecting status and keep the last snapshot visible.
- If a room id does not exist, show a not-found room state with a return/create-room action.
- If a viewer opens before the host publishes the first update, render the initial snapshot.
- If host token verification fails, force read-only mode and show a host-control unavailable notice.

## Testing And Verification

Minimum first-version checks:

- `npm run build` passes after fixing current TypeScript errors.
- Local host can create a room and copy a viewer link.
- Two browser windows pointed at the same room show the same day, phase, players, logs, current speaker, and subtitles.
- Viewer cannot trigger game mutation controls.
- LLM requests succeed through `/api/ai-chat` without provider keys in bundled frontend code.
- TTS requests succeed through `/api/tts` or fall back to browser speech without blocking the game.
- Refreshing the viewer page restores the latest Supabase snapshot.
- Closing or pausing the host stops new updates and viewer displays a stale/offline indicator.

## Deployment Notes

The Vercel project needs environment variables for Supabase and the selected AI/TTS provider. The Supabase SQL schema should live in `supabase/schema.sql` so setup is copyable. Vercel builds the React app and API routes together.

For first deployment, use only one model provider path in active game defaults, preferably SiliconFlow/DeepSeek because the existing code already defaults special roles to DeepSeek models and reuses the same key for TTS.

## Open Implementation Choices

- Snapshot frequency should start simple: publish on each committed `GameState` change, with a small debounce if updates are too chatty.
- Viewer local preferences can remain local unless they affect shared truth.
- The first state payload can be the full `GameState`; optimize to event patches later only if Supabase payload size or latency becomes a problem.
