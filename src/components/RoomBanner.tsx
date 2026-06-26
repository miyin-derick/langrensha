import React, { useState } from 'react';
import type { RoomConnectionStatus } from '../types';

interface RoomBannerProps {
  isRoom: boolean;
  isHost: boolean;
  isViewer: boolean;
  status: RoomConnectionStatus;
  error: string | null;
  shareUrl: string;
}

const statusLabels: Record<RoomConnectionStatus, string> = {
  local: '本地模式',
  loading: '连接中',
  connected: '已同步',
  syncing: '同步中',
  stale: '等待房主',
  error: '同步异常',
};

const RoomBanner: React.FC<RoomBannerProps> = ({ isRoom, isHost, isViewer, status, error, shareUrl }) => {
  const [copied, setCopied] = useState(false);

  if (!isRoom) return null;

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const statusClass =
    status === 'connected' || status === 'syncing'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-950/40'
      : status === 'stale'
        ? 'text-amber-300 border-amber-500/30 bg-amber-950/40'
        : status === 'error'
          ? 'text-red-300 border-red-500/30 bg-red-950/40'
          : 'text-slate-300 border-white/10 bg-slate-900/60';

  return (
    <div className="fixed left-1/2 top-3 z-[9998] w-[min(920px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-slate-200 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-indigo-400/30 bg-indigo-950/50 px-3 py-1 font-black text-indigo-200">
            {isHost ? '房主控制' : isViewer ? '观众只读' : '房间模式'}
          </span>
          <span className={`rounded-full border px-3 py-1 font-bold ${statusClass}`}>
            {statusLabels[status]}
          </span>
          {error && <span className="text-red-300">{error}</span>}
        </div>

        {isHost && (
          <div className="flex items-center gap-2">
            <code className="max-w-[420px] truncate rounded-lg bg-black/40 px-3 py-2 text-xs text-slate-300">
              {shareUrl}
            </code>
            <button
              onClick={copyShareUrl}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500"
            >
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomBanner;
