import React, { useState } from 'react';
import { postJson } from '../services/apiClient';
import { createHostToken, createRoomId, storeHostToken } from '../services/roomIdentity';
import type { GameState } from '../types';

interface LandingPageProps {
  initialState: GameState;
  onStartLocal: () => void;
}

interface CreateRoomResponse {
  room: {
    id: string;
  };
}

const LandingPage: React.FC<LandingPageProps> = ({ initialState, onStartLocal }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async () => {
    setIsCreating(true);
    setError(null);

    const roomId = createRoomId();
    const hostToken = createHostToken();

    try {
      await postJson<CreateRoomResponse>('/api/rooms/create', {
        roomId,
        hostToken,
        state: initialState,
      });
      storeHostToken(roomId, hostToken);
      window.location.href = `/room/${roomId}?host=1`;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建房间失败');
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <section className="w-full max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <p className="text-indigo-300 font-bold tracking-[0.3em] uppercase text-sm">AI Werewolf Live</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight">异地一起看 AI 狼人杀</h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-xl mx-auto">
            创建一个观战房间，你控制 AI 对局推进，朋友通过分享链接同步观看画面、字幕和日志。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={createRoom}
            disabled={isCreating}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black shadow-[0_0_30px_rgba(79,70,229,0.35)]"
          >
            {isCreating ? '创建中...' : '创建观战房间'}
          </button>
          <button
            onClick={onStartLocal}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold border border-white/10"
          >
            本地试玩
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
      </section>
    </main>
  );
};

export default LandingPage;
