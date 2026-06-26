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
    let containerClass = "mb-3 flex flex-col animate-in slide-in-from-left-2 fade-in duration-300";
    let bubbleClass = "p-3 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[90%]";
    const metaClass = "text-[10px] text-slate-500 mb-1 ml-1 flex items-center gap-2";
    
    // Speech
    if (log.type === 'SPEECH') {
        bubbleClass += " bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700";
        
        // Defensive check for claim config
        const roleConf = log.claim?.role ? ROLE_CONFIG[log.claim.role] : null;

        return (
            <div key={log.id} className={containerClass}>
                <div className={metaClass}>
                    <span className="font-bold text-indigo-400">#{log.senderId} 发言</span>
                    {/* Render Explicit Claim Badge */}
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

    // Thoughts
    if (log.type === 'THOUGHT') {
        containerClass += " items-end";
        bubbleClass += " bg-indigo-950/40 text-indigo-300 italic border border-indigo-900/50 rounded-tr-none";
        return (
            <div key={log.id} className={containerClass}>
                <div className={`${metaClass} justify-end`}>
                    <span className="font-bold text-indigo-400">💭 我的想法</span>
                </div>
                <div className={bubbleClass}>{log.content}</div>
            </div>
        );
    }

    // Wolf Channel
    if (log.type === 'WOLF_CHANNEL') {
        bubbleClass += " bg-red-950/40 text-red-300 border border-red-900/50";
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

    // System Events
    if (log.type === 'SYSTEM' || log.type === 'DEATH' || log.type === 'SHERIFF') {
        let sysColor = "text-slate-400 bg-slate-900/50 border-slate-800";
        if (log.type === 'DEATH') sysColor = "text-red-400 bg-red-950/20 border-red-900/30";
        if (log.type === 'SHERIFF') sysColor = "text-amber-400 bg-amber-950/20 border-amber-900/30";

        return (
             <div key={log.id} className="my-4 flex justify-center">
                <span className={`px-4 py-1.5 rounded-full text-xs font-medium border ${sysColor} shadow-sm text-center`}>
                   {log.content}
                </span>
             </div>
        );
    }

    // Actions
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
      {/* Feed Header */}
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

      {/* Main Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {visibleLogs.map((log) => renderLogItem(log))}
        <div ref={bottomRef} />
      </div>

      {/* NEW: Timeline Replay Modal */}
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
