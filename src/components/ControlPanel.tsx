import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ControlPanel = ({ 
    isPlaying, onTogglePlay, onStep, gameSpeed, onSpeedChange, 
    gameOver, enableTTS, onToggleTTS, showRoles, onToggleRoles, 
    viewMode, onToggleViewMode,
    isAutoLoop, onToggleAutoLoop,
    isGreenScreen, onToggleGreenScreen,
    // 🔥 新增 props
    showThoughts, onToggleThoughts,
    readOnly = false
}: any) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const bgClass = isGreenScreen 
    ? 'bg-slate-900/90 border-slate-700 shadow-none' 
    : 'bg-slate-950/40 hover:bg-slate-950/90 border-white/10 hover:border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

  return (
    <motion.div 
      drag
      dragMomentum={false} 
      initial={{ x: "-50%", y: 0 }}
      style={{ left: "50%", bottom: "24px", position: "fixed", x: "-50%" }}
      className={`
        z-[9999] rounded-2xl backdrop-blur-md border transition-all duration-300 flex flex-col items-center overflow-hidden
        ${isMinimized 
          ? 'w-12 h-12 bg-slate-900/80 border-indigo-500/50 cursor-pointer hover:scale-110 shadow-[0_0_15px_rgba(99,102,241,0.5)]' 
          : bgClass
        }
      `}
    >
      {isMinimized && (
        <div 
          onClick={() => setIsMinimized(false)}
          className="w-full h-full flex items-center justify-center text-indigo-400"
          title="展开控制台"
        >
          ⚙️
        </div>
      )}

      {!isMinimized && (
        <>
          <div className="w-full h-5 flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5">
              <div className="w-8 h-1 rounded-full bg-white/20"></div>
              <button 
                 onClick={() => setIsMinimized(true)}
                 className="absolute right-2 top-0.5 text-[10px] text-slate-500 hover:text-white px-2"
              >
                 —
              </button>
          </div>

          <div className="flex items-center gap-2 p-3 pt-1">
            <div className="group relative flex items-center px-3 gap-2 border-r border-white/5">
              <span className="text-[10px] font-mono text-slate-500 uppercase group-hover:text-slate-300 transition-colors">速度</span>
              <input 
                  type="range" min="0" max="1500" step="100" 
                  value={gameSpeed} 
                  onChange={(e) => onSpeedChange(Number(e.target.value))}
                  className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity"
              />
            </div>

            <div className="flex gap-2 border-r border-white/5 pr-3">
                <button 
                  onClick={onToggleViewMode}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    viewMode === 'STREAM'
                      ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
                      : 'bg-slate-800/30 text-slate-600 hover:bg-slate-800/80 hover:text-slate-400'
                  }`}
                  title={viewMode === 'STREAM' ? "直播模式" : "桌面模式"}
                >
                  {viewMode === 'STREAM' ? '📺' : '🖥️'}
                </button>

                {!readOnly && (
                  <button 
                    onClick={onToggleAutoLoop}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      isAutoLoop 
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)] animate-pulse' 
                        : 'bg-slate-800/30 text-slate-600 hover:bg-slate-800/80 hover:text-slate-400'
                    }`}
                    title="自动下一局"
                  >
                    🔄
                  </button>
                )}

                <button 
                  onClick={onToggleTTS}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    enableTTS 
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                      : 'bg-slate-800/30 text-slate-600 hover:bg-slate-800/80 hover:text-slate-400'
                  }`}
                  title="语音开关"
                >
                  {enableTTS ? '🔊' : '🔇'}
                </button>

                {/* 🔥 心声开关 */}
                <button 
                  onClick={onToggleThoughts}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    showThoughts 
                      ? 'bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.2)]' 
                      : 'bg-slate-800/30 text-slate-600 hover:bg-slate-800/80 hover:text-slate-400'
                  }`}
                  title="显示心声"
                >
                  🧠
                </button>

                <button 
                  onClick={onToggleRoles}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    showRoles 
                      ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                      : 'bg-slate-800/30 text-slate-600 hover:bg-slate-800/80 hover:text-slate-400'
                  }`}
                  title="上帝视角"
                >
                  {showRoles ? '👁️' : '🕶️'}
                </button>

                <button 
                  onClick={onToggleGreenScreen} 
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isGreenScreen 
                      ? 'bg-[#00FF00] text-black ring-2 ring-white font-bold' 
                      : 'bg-slate-800/30 text-green-600 hover:bg-green-900/30'
                  }`} 
                  title="绿幕模式"
                >
                   G
                </button>
            </div>

            <div className="flex gap-2 pl-1">
              {!readOnly && !gameOver && (
                  <>
                    {!isPlaying && (
                        <button 
                            onClick={onStep} 
                            className="h-9 px-4 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-white/5 transition-all active:scale-95 hover:text-white"
                        >
                            单步
                        </button>
                    )}
                    
                    <button 
                        onClick={onTogglePlay} 
                        className={`h-9 px-6 rounded-xl font-bold text-xs tracking-wide flex items-center gap-2 transition-all active:scale-95 ${
                            isPlaying 
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 animate-pulse' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                        }`}
                    >
                        {isPlaying ? '暂停' : '自动开始'}
                    </button>
                  </>
              )}

                {!readOnly && gameOver && (
                  <button 
                      onClick={()=>window.location.reload()} 
                      className="h-9 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all"
                  >
                      再来一局
                  </button>
              )}
              {readOnly && (
                  <div className="h-9 px-4 rounded-xl bg-slate-800/40 border border-white/5 text-slate-400 text-xs font-bold flex items-center">
                      观战中
                  </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};
export default ControlPanel;
