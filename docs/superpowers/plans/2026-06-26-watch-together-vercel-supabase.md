# Watch-Together Vercel/Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel-deployable watch-together mode where one host controls an AI Werewolf game and remote viewers watch synchronized state without exposing model or TTS keys.

**Architecture:** Keep the browser-hosted game state machine as the first-version authority. Move provider calls behind Vercel API routes, add Supabase as the room snapshot and Realtime sync layer, and wire React through a small room session hook instead of pushing all room logic into `App.tsx`.

**Tech Stack:** React 18, Vite, TypeScript, Vercel API Routes, Supabase JS, Supabase Realtime, Node crypto, minimal TS self-check via `tsx`.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add Supabase, Vercel route types, and a minimal self-check script.
- Create `api/_shared/providerRegistry.ts`: server-only provider endpoint/key selection.
- Create `api/_shared/roomAuth.ts`: host token hashing and validation helpers.
- Create `api/_shared/supabaseAdmin.ts`: service-role Supabase client for API routes.
- Create `api/ai-chat.ts`: server-side LLM proxy.
- Create `api/tts.ts`: server-side SiliconFlow TTS proxy.
- Create `api/rooms/create.ts`: create room with initial state and host token hash.
- Create `api/rooms/update.ts`: verify host token and publish room snapshot.
- Create `supabase/schema.sql`: copyable room table, RLS, and Realtime setup.
- Create `src/services/apiClient.ts`: browser calls to local API routes.
- Create `src/services/roomIdentity.ts`: browser-safe room id, token, and storage helpers.
- Create `src/services/roomClient.ts`: Supabase browser client, snapshot loading, and room subscription.
- Create `src/hooks/useRoomSession.ts`: route parsing, host/viewer mode, snapshot publishing, and stale detection.
- Create `src/components/LandingPage.tsx`: create-room entry point.
- Create `src/components/RoomBanner.tsx`: share link and sync status.
- Modify `src/services/geminiService.ts`: call `/api/ai-chat` instead of provider endpoints.
- Modify `src/services/ttsService.ts`: call `/api/tts` instead of SiliconFlow directly.
- Modify `src/components/ControlPanel.tsx`: add read-only mode.
- Modify `src/components/GameLog.tsx`: fix current TypeScript build errors.
- Modify `src/App.tsx`: integrate landing, room session, viewer state application, read-only controls, and share banner.
- Create `scripts/self-check.ts`: assert core room/token helpers.

## Task 1: Baseline Build Repair And Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/GameLog.tsx`

- [ ] **Step 1: Install required packages**

Run:

```bash
npm install @supabase/supabase-js
npm install -D @vercel/node @types/node tsx
```

Expected: package files update and `node_modules` contains the new packages.

- [ ] **Step 2: Add self-check script**

Modify `package.json` scripts to include:

```json
"selfcheck": "tsx scripts/self-check.ts"
```

Keep existing scripts:

```json
"dev": "vite",
"build": "tsc && vite build",
"preview": "vite preview"
```

- [ ] **Step 3: Fix `GameLog` typing**

Replace `src/components/GameLog.tsx` props and role config lookup with typed values:

```ts
import React, { useEffect, useRef, useState } from 'react';
import GameHistoryModal from './GameHistoryModal';
import { ROLE_CONFIG } from '../constants';
import { LogMessage, Player, Role } from '../types';

interface GameLogProps {
  logs: LogMessage[];
  userPlayerId: number | null;
  userRole?: Role;
  showRoles: boolean;
  players: Player[];
}

const GameLog = ({ logs, userPlayerId, userRole, showRoles, players }: GameLogProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (!isHistoryOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isHistoryOpen]);

  const isLogVisible = (log: LogMessage) => {
    if (log.type === 'THOUGHT' && !showRoles && log.senderId !== userPlayerId) return false;
    if (log.type === 'WOLF_CHANNEL' && !showRoles && userRole !== Role.WEREWOLF) return false;
    return true;
  };

  const visibleLogs = logs.filter(isLogVisible);

  const renderLogItem = (log: LogMessage) => {
    let containerClass = 'mb-3 flex flex-col animate-in slide-in-from-left-2 fade-in duration-300';
    let bubbleClass = 'p-3 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[90%]';
    const metaClass = 'text-[10px] text-slate-500 mb-1 ml-1 flex items-center gap-2';

    if (log.type === 'SPEECH') {
      bubbleClass += ' bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700';
      const roleConf = log.claim?.role ? ROLE_CONFIG[log.claim.role] : null;

      return (
        <div key={log.id} className={containerClass}>
          <div className={metaClass}>
            <span className="font-bold text-indigo-400">#{log.senderId} 发言</span>
            {roleConf && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${roleConf.bg} ${roleConf.color} ${roleConf.border} border-opacity-50`}>
                跳身份: {roleConf.label}
              </span>
            )}
          </div>
          <div className={bubbleClass}>{log.content}</div>
        </div>
      );
    }

    if (log.type === 'THOUGHT') {
      containerClass += ' items-end';
      bubbleClass += ' bg-indigo-950/40 text-indigo-300 italic border border-indigo-900/50 rounded-tr-none';
      return (
        <div key={log.id} className={containerClass}>
          <div className={`${metaClass} justify-end`}>
            <span className="font-bold text-indigo-400">💭 我的想法</span>
          </div>
          <div className={bubbleClass}>{log.content}</div>
        </div>
      );
    }

    if (log.type === 'WOLF_CHANNEL') {
      bubbleClass += ' bg-red-950/40 text-red-300 border border-red-900/50';
      return (
        <div key={log.id} className={containerClass}>
          <div className={metaClass}>
            <span className="font-bold text-red-500">🐺 狼队语音</span>
            <span className="text-red-800">#{log.senderId}</span>
          </div>
          <div className={bubbleClass}>{log.content}</div>
        </div>
      );
    }

    if (log.type === 'SYSTEM' || log.type === 'DEATH' || log.type === 'SHERIFF') {
      let sysColor = 'text-slate-400 bg-slate-900/50 border-slate-800';
      if (log.type === 'DEATH') sysColor = 'text-red-400 bg-red-950/20 border-red-900/30';
      if (log.type === 'SHERIFF') sysColor = 'text-amber-400 bg-amber-950/20 border-amber-900/30';

      return (
        <div key={log.id} className="my-4 flex justify-center">
          <span className={`px-4 py-1.5 rounded-full text-xs font-medium border ${sysColor} shadow-sm text-center`}>
            {log.content}
          </span>
        </div>
      );
    }

    if (log.type.startsWith('ACTION')) {
      return (
        <div key={log.id} className="mb-2 px-2 text-xs text-slate-500 font-mono flex items-center gap-2 opacity-70">
          <span>⚡</span>
          <span>{log.content}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900/90 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="font-bold text-xs text-slate-300 uppercase tracking-wider">实时动态</span>
        </div>
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1 bg-slate-800 px-2 py-1 rounded hover:bg-slate-700"
        >
          <span>📜</span> 复盘
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {visibleLogs.map((log) => renderLogItem(log))}
        <div ref={bottomRef} />
      </div>

      {isHistoryOpen && (
        <GameHistoryModal
          logs={logs}
          players={players || []}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  );
};

export default GameLog;
```

- [ ] **Step 4: Verify baseline build**

Run:

```bash
npm run build
```

Expected: TypeScript no longer fails on `GameLog.tsx`. Any new errors should be addressed before continuing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/GameLog.tsx
git commit -m "fix: repair baseline build"
```

## Task 2: Room Identity, Token Hashing, And Self-Check

**Files:**
- Create: `src/services/roomIdentity.ts`
- Create: `api/_shared/roomAuth.ts`
- Create: `scripts/self-check.ts`
- Modify: `package.json`

- [ ] **Step 1: Create browser room identity helpers**

Create `src/services/roomIdentity.ts`:

```ts
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
```

- [ ] **Step 2: Create server room auth helpers**

Create `api/_shared/roomAuth.ts`:

```ts
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

export function verifyHostTokenHash(roomId: string, token: string, expectedHash: string) {
  const actual = Buffer.from(hashHostToken(roomId, token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 3: Add self-check**

Create `scripts/self-check.ts`:

```ts
import assert from 'node:assert/strict';
import { hashHostToken, verifyHostTokenHash } from '../api/_shared/roomAuth';

const roomId = 'room_abc123';
const token = 'abcdefghijklmnopqrstuvwxyz123456';
const hash = hashHostToken(roomId, token, 'secret-a');

assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(hashHostToken(roomId, token, 'secret-a'), hash);
assert.notEqual(hashHostToken(roomId, token, 'secret-b'), hash);
assert.equal(verifyHostTokenHash(roomId, token, hash), true);
assert.equal(verifyHostTokenHash(roomId, `${token}x`, hash), false);

console.log('self-check passed');
```

- [ ] **Step 4: Run self-check**

Run:

```bash
npm run selfcheck
```

Expected:

```text
self-check passed
```

- [ ] **Step 5: Commit**

```bash
git add src/services/roomIdentity.ts api/_shared/roomAuth.ts scripts/self-check.ts package.json package-lock.json
git commit -m "feat: add room identity helpers"
```

## Task 3: Vercel API Routes And Supabase Schema

**Files:**
- Create: `api/_shared/providerRegistry.ts`
- Create: `api/_shared/supabaseAdmin.ts`
- Create: `api/ai-chat.ts`
- Create: `api/tts.ts`
- Create: `api/rooms/create.ts`
- Create: `api/rooms/update.ts`
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create provider registry**

Create `api/_shared/providerRegistry.ts` with server-only key lookup:

```ts
import type { AIProvider } from '../../src/types';

interface ProviderConfig {
  endpoint: string;
  apiKey: string;
}

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  const registry: Record<AIProvider, ProviderConfig> = {
    DeepSeek: {
      endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY || process.env.SILICONFLOW_API_KEY || '',
    },
    Aliyun: {
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: process.env.ALIYUN_API_KEY || '',
    },
    Gemini: {
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: process.env.GEMINI_API_KEY || '',
    },
    Moonshot: {
      endpoint: 'https://api.moonshot.cn/v1/chat/completions',
      apiKey: process.env.MOONSHOT_API_KEY || '',
    },
    MiniMax: {
      endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
      apiKey: process.env.MINIMAX_API_KEY || '',
    },
    Zhipu: {
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: process.env.ZHIPU_API_KEY || '',
    },
    Tencent: {
      endpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
      apiKey: process.env.TENCENT_API_KEY || '',
    },
    Groq: {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY || '',
    },
  };

  const config = registry[provider];
  if (!config?.apiKey) {
    throw new Error(`Missing API key for provider ${provider}`);
  }
  return config;
}
```

- [ ] **Step 2: Create Supabase admin client**

Create `api/_shared/supabaseAdmin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 3: Create `api/ai-chat.ts`**

Create a POST-only route that accepts a normalized chat request and proxies provider response:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AIProvider } from '../src/types';
import { getProviderConfig } from './_shared/providerRegistry';

interface ChatRequestBody {
  provider: AIProvider;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body as ChatRequestBody;
    if (!body.provider || !body.model || !Array.isArray(body.messages)) {
      res.status(400).json({ error: 'Invalid chat request' });
      return;
    }

    const config = getProviderConfig(body.provider);
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 512,
      }),
    });

    const text = await response.text();
    res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
```

- [ ] **Step 4: Create `api/tts.ts`**

Create a POST-only route for SiliconFlow speech:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TtsRequestBody {
  text: string;
  voice: string;
  speed?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body as TtsRequestBody;
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.SILICONFLOW_API_KEY || '';
    if (!apiKey) {
      res.status(503).json({ error: 'TTS key is not configured' });
      return;
    }
    if (!body.text || !body.voice) {
      res.status(400).json({ error: 'Invalid TTS request' });
      return;
    }

    const response = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'FunAudioLLM/CosyVoice2-0.5B',
        input: body.text,
        voice: body.voice,
        response_format: 'mp3',
        sample_rate: 32000,
        stream: false,
        speed: body.speed ?? 1,
        gain: 0,
      }),
    });

    const arrayBuffer = await response.arrayBuffer();
    res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
```

- [ ] **Step 5: Create room API routes**

Create `api/rooms/create.ts` and `api/rooms/update.ts` with host-token validation. `create.ts` inserts `{ id, host_token_hash, state, last_event }`; `update.ts` fetches the room, verifies `hostToken`, then updates `{ state, last_event, updated_at }`.

- [ ] **Step 6: Create Supabase schema**

Create `supabase/schema.sql`:

```sql
create table if not exists public.rooms (
  id text primary key,
  host_token_hash text not null,
  state jsonb not null,
  last_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

drop policy if exists "rooms are publicly readable" on public.rooms;
create policy "rooms are publicly readable"
on public.rooms for select
using (true);

alter publication supabase_realtime add table public.rooms;
```

- [ ] **Step 7: Verify**

Run:

```bash
npm run build
npm run selfcheck
```

Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add api supabase package.json package-lock.json
git commit -m "feat: add vercel room api routes"
```

## Task 4: Move AI And TTS Calls Behind Local API Routes

**Files:**
- Create: `src/services/apiClient.ts`
- Modify: `src/services/geminiService.ts`
- Modify: `src/services/ttsService.ts`

- [ ] **Step 1: Create API client**

Create `src/services/apiClient.ts`:

```ts
export async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function postForBlob(url: string, body: unknown): Promise<Blob> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.blob();
}
```

- [ ] **Step 2: Update `geminiService`**

Remove browser environment key reads and provider endpoints. Change `executeAIRequest` to call `/api/ai-chat` with `{ provider, model, messages, temperature, max_tokens }`, then keep `cleanJSONResponse` and `validateAndFixResponse`.

- [ ] **Step 3: Update `ttsService`**

Replace direct SiliconFlow fetch calls in `speak` and `prefetch` with `postForBlob('/api/tts', { text, voice: voiceModel, speed: playerConfig.speed || 1 })`. Keep browser TTS fallback if the route fails.

- [ ] **Step 4: Verify no browser key reads remain for providers**

Run:

```bash
rg -n "VITE_.*API_KEY|import\\.meta\\.env\\.VITE_.*KEY|api\\.siliconflow\\.cn|chat/completions" src
```

Expected: no frontend provider key reads or direct provider chat/TTS endpoints remain. `VITE_SUPABASE_*` may remain later.

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add src/services/apiClient.ts src/services/geminiService.ts src/services/ttsService.ts
git commit -m "feat: proxy ai and tts requests"
```

## Task 5: Supabase Browser Room Client

**Files:**
- Create: `src/services/roomClient.ts`
- Create: `src/hooks/useRoomSession.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add room sync types**

Add room sync interfaces to `src/types.ts`:

```ts
export interface RoomSnapshot {
  id: string;
  state: GameState;
  lastEvent?: {
    type: string;
    at: string;
  };
  updatedAt: string;
}

export type RoomConnectionStatus = 'local' | 'loading' | 'connected' | 'syncing' | 'stale' | 'error';
```

- [ ] **Step 2: Create Supabase client helpers**

Create `src/services/roomClient.ts` that:
- creates a browser Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`;
- reads a room by id;
- subscribes to `rooms` row updates by room id;
- maps Supabase rows to `RoomSnapshot`.

- [ ] **Step 3: Create `useRoomSession` hook**

Create `src/hooks/useRoomSession.ts` that:
- parses room id and host flag from the URL;
- loads stored host token;
- exposes `isRoom`, `roomId`, `isHost`, `isViewer`, `status`, `shareUrl`, `error`, and `publishSnapshot`;
- subscribes viewers to snapshots;
- accepts a callback to apply remote `GameState`;
- marks the room stale if no update arrives for 20 seconds.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/services/roomClient.ts src/hooks/useRoomSession.ts
git commit -m "feat: add room sync client"
```

## Task 6: Landing Page, Room Banner, And Read-Only Controls

**Files:**
- Create: `src/components/LandingPage.tsx`
- Create: `src/components/RoomBanner.tsx`
- Modify: `src/components/ControlPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create landing page**

Create a minimal landing page with one primary action, `创建观战房间`, and one secondary local demo action if needed. The create action calls `createRoomId`, `createHostToken`, stores the token, calls `/api/rooms/create`, and navigates to `/room/<roomId>?host=1`.

- [ ] **Step 2: Create room banner**

Create `RoomBanner` to show:
- host/viewer label;
- connection status;
- copyable viewer link for host;
- stale/offline warning.

- [ ] **Step 3: Make `ControlPanel` read-only aware**

Add a `readOnly` prop. In read-only mode, hide `单步`, `自动开始`, `暂停`, `自动下一局`, and reset controls. Leave display-only toggles such as view mode, TTS, thought display, and green screen.

- [ ] **Step 4: Wire App**

Modify `App.tsx` so:
- `/` renders `LandingPage`;
- `/room/:roomId?host=1` runs host mode;
- `/room/:roomId` runs viewer mode;
- host publishes snapshots after committed `GameState` changes;
- viewer applies remote snapshots and never calls `advanceGame`;
- `ControlPanel` receives `readOnly={roomSession.isViewer}`.

- [ ] **Step 5: Verify two-window sync locally**

Run:

```bash
npm run dev
```

Manual check:
- create a room in one browser window;
- copy viewer link to another window;
- click single step on host;
- viewer updates day/phase/logs;
- viewer does not show mutation controls.

- [ ] **Step 6: Commit**

```bash
git add src/components/LandingPage.tsx src/components/RoomBanner.tsx src/components/ControlPanel.tsx src/App.tsx
git commit -m "feat: add watch room interface"
```

## Task 7: Deployment Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `README_zh-CN.md`
- Create: `.env.example`

- [ ] **Step 1: Add environment template**

Create `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ROOM_TOKEN_SECRET=
DEEPSEEK_API_KEY=
# Optional provider keys:
GEMINI_API_KEY=
ALIYUN_API_KEY=
MOONSHOT_API_KEY=
MINIMAX_API_KEY=
ZHIPU_API_KEY=
TENCENT_API_KEY=
GROQ_API_KEY=
```

- [ ] **Step 2: Update docs**

Update README files to say:
- dev command is `npm run dev`;
- deploy target is Vercel;
- copy `supabase/schema.sql` into Supabase SQL Editor;
- server keys belong in Vercel environment variables;
- browser keys are limited to Supabase public URL and anon key.

- [ ] **Step 3: Full verification**

Run:

```bash
npm run selfcheck
npm run build
rg -n "VITE_.*API_KEY|import\\.meta\\.env\\.VITE_.*KEY|api\\.siliconflow\\.cn|dashscope|bigmodel|moonshot|hunyuan|groq\\.com" src
git status --short
```

Expected:
- self-check passes;
- build passes;
- no frontend provider key reads or direct provider endpoints remain;
- only intended files are modified before final commit.

- [ ] **Step 4: Commit**

```bash
git add README.md README_zh-CN.md .env.example supabase/schema.sql
git commit -m "docs: document watch room deployment"
```

## Task 8: Final Smoke And Handoff

**Files:**
- No planned source changes unless verification finds issues.

- [ ] **Step 1: Start local dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 2: Manual app smoke**

In browser:
- open landing page;
- create room;
- open viewer link;
- verify viewer cannot control;
- verify sync status renders.

- [ ] **Step 3: Final status**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: clean worktree after final commits, with conventional commit messages.
