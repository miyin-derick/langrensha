import React, { forwardRef, useState, useEffect } from 'react';
import { ROLE_CONFIG, PROVIDER_CONFIG } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '../types';

const TypewriterText = ({ text }: { text: string }) => {
    const [displayLength, setDisplayLength] = useState(0);
    useEffect(() => {
        setDisplayLength(0);
        if (!text) return;
        const speed = 30;
        let i = 0;
        const timer = setInterval(() => {
            if (i < text.length) {
                i++;
                setDisplayLength(i);
            } else {
                clearInterval(timer);
            }
        }, speed);
        return () => clearInterval(timer);
    }, [text]);
    return <span>{text.slice(0, displayLength)}</span>;
};

const LiveBubble = ({ text, type, position, align }: { text: string, type: 'SPEECH' | 'THOUGHT' | 'WOLF', position: 'top' | 'bottom', align: 'left' | 'center' | 'right' }) => {
    const styles = {
        SPEECH: "bg-slate-100/95 text-slate-900 border-white shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-md",
        THOUGHT: "bg-indigo-900/90 text-indigo-100 border-indigo-500/50 shadow-[0_8px_30px_rgba(99,102,241,0.4)] backdrop-blur-md",
        WOLF:    "bg-red-950/90 text-red-100 border-red-500/50 shadow-[0_8px_30px_rgba(239,68,68,0.4)] backdrop-blur-md"
    };
    // 气泡位置微调，防止遮挡
    const posClass = position === 'top' ? "bottom-[110%] mb-2 origin-bottom" : "top-[110%] mt-2 origin-top";
    let alignClass = "left-1/2 -translate-x-1/2 origin-center";
    
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.8 }} 
            className={`absolute z-[100] w-max max-w-[260px] pointer-events-none ${posClass} ${alignClass}`}
        >
            <div className={`px-4 py-3 rounded-2xl border ${styles[type]} relative text-sm font-bold leading-relaxed shadow-2xl`}>
                {type === 'THOUGHT' && <span className="opacity-60 text-xs block mb-1">💭 心声:</span>}
                <TypewriterText text={text} />
            </div>
        </motion.div>
    );
};

const AmbitionGlitch = () => {
    return (
        <div className="absolute inset-0 z-[60] bg-indigo-500/10 mix-blend-overlay animate-pulse pointer-events-none"></div>
    );
};

const getModelBadgeStyle = (modelName: string) => {
    const name = (modelName || '').toLowerCase();
    if (name.includes('deepseek')) return 'bg-blue-600 text-white border border-blue-400 shadow-md';
    if (name.includes('qwen')) return 'bg-violet-600 text-white border border-violet-400 shadow-md';
    return 'bg-slate-700 text-slate-200 border border-slate-500';
};

const PlayerCard = forwardRef<HTMLDivElement, any>(({ player, isSpeaking, revealRole, isUser, onSelect, isThinking, currentSpeech, currentThought, isAnyActive, votesReceived, hideBubble, compact, isGreenScreen, isScanning, showThoughts }, ref) => {
  
  const config = (ROLE_CONFIG as any)[player.role] || { 
      label: '未知', icon: '❓', color: 'text-slate-500', bg: 'bg-slate-800', border: 'border-slate-600' 
  };
  const provider = (PROVIDER_CONFIG as any)[player.aiProvider] || { 
      label: 'DeepSeek', icon: '⚡', color: 'text-blue-400', bg: 'bg-blue-900/40', border: 'border-blue-500/50' 
  };

  const isDead = !player.isAlive;
  // 简单的上下布局判定：ID小的在下面显示气泡，ID大的在上面
  const bubblePos = player.id <= 6 ? 'top' : 'bottom'; 
  
  // --- 🔥 双气泡逻辑开始 ---
  
  // 1. 主气泡 (SPEECH)：用于显示当前说的话
  let speechBubbleText = null;
  if (isSpeaking && currentSpeech) {
      speechBubbleText = currentSpeech;
  }

  // 2. 副气泡 (THOUGHT)：用于显示心声
  // 只有当 showThoughts=true 且有心声内容时才显示
  let thoughtBubbleText = null;
  if (showThoughts) {
      if (currentThought) {
          thoughtBubbleText = currentThought;
      } else if (isThinking) {
          thoughtBubbleText = "思考中...";
      }
  } else if (!isSpeaking && currentThought) {
      // 如果没开心声开关，但现在没说话只有心声（比如思考阶段），也可以显示一下
      // thoughtBubbleText = currentThought; 
      // (为了严格控制，如果你只想在开关开启时显示，就注释掉上面这行)
  }

  // 如果两者都有，调整位置：心声在反方向
  const thoughtPos = (speechBubbleText && bubblePos === 'top') ? 'bottom' : (speechBubbleText && bubblePos === 'bottom' ? 'top' : bubblePos);

  // --- 🔥 双气泡逻辑结束 ---

  const isActive = isSpeaking || isThinking || !!currentThought;
  const modelBadgeStyle = getModelBadgeStyle(player.modelName);

  const cardBgClass = isDead 
    ? 'bg-slate-950/95 border-slate-800' 
    : isActive 
        ? 'bg-slate-900/90 border-indigo-400/80 backdrop-blur-2xl' 
        : 'bg-slate-900/70 border-slate-600/40 backdrop-blur-lg';

  return (
    <motion.div 
        ref={ref} 
        onClick={onSelect} 
        className={`relative w-full h-full rounded-3xl select-none flex flex-col overflow-hidden transition-all duration-500 
            ${isActive ? 'scale-105 z-30' : 'scale-100 z-10'} 
            ${!isActive && isAnyActive ? 'opacity-80 grayscale-[0.3]' : 'opacity-100'} 
            ${isDead ? 'grayscale brightness-50' : ''}`}
    >
       {isScanning && player.isAlive && <AmbitionGlitch />}
       
       <div className={`absolute inset-0 transition-colors border-2 rounded-3xl ${cardBgClass} shadow-inner`}></div>
       
       {/* 🗣️ 发言气泡 */}
       <AnimatePresence>
           {speechBubbleText && isActive && !hideBubble && !compact && 
               <LiveBubble text={speechBubbleText} type="SPEECH" position={bubblePos} align="center" />
           }
       </AnimatePresence>

       {/* 💭 心声气泡 (根据开关显示) */}
       <AnimatePresence>
           {thoughtBubbleText && isActive && !hideBubble && !compact && 
               <LiveBubble text={thoughtBubbleText} type="THOUGHT" position={thoughtPos} align="center" />
           }
       </AnimatePresence>
       
       {isSpeaking && !compact && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none">
                <span className="bg-red-600 text-white font-black px-3 py-0.5 rounded-full shadow-lg border border-red-400 text-[10px] whitespace-nowrap tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>ING
                </span>
            </div>
       )}

       <div className={`relative z-10 w-full h-full flex flex-col p-3`}>
           <div className="flex justify-between items-start w-full h-12">
               <div className="relative z-20">
                    {player.isSheriff && <span className="absolute -top-4 -left-2 text-4xl z-50 drop-shadow-lg animate-bounce">🤠</span>}
                    <span className={`text-5xl font-black font-mono leading-none tracking-tighter drop-shadow-md ${isSpeaking ? 'text-yellow-400' : 'text-slate-400'} ${isUser ? 'text-blue-400' : ''}`}>
                        {player.id < 10 ? `0${player.id}` : player.id}
                    </span>
               </div>
               <div className={`relative z-20 -mr-1 -mt-1 px-3 py-1 rounded-lg flex items-center gap-1.5 ${modelBadgeStyle}`}>
                   <span className="text-sm opacity-100 font-bold">{provider.icon}</span>
                   <span className="text-xs font-bold tracking-tight uppercase">{provider.label}</span>
               </div>
           </div>

           <div className="flex-1 flex flex-col justify-center items-center relative -mt-2">
               <div className={`text-6xl filter drop-shadow-lg transition-transform duration-300 transform ${isActive ? 'scale-110' : 'scale-100'}`}>
                   {revealRole ? config.icon : '👤'}
               </div>
               {revealRole && (
                   <span className={`text-xs font-extrabold tracking-widest uppercase mt-2 px-3 py-0.5 rounded-full bg-slate-950/50 border border-white/10 ${config.color}`}>
                       {config.label}
                   </span>
               )}
               {isDead && (
                   <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                       <span className="text-red-600/90 text-7xl font-black opacity-90 rotate-12 drop-shadow-lg">✕</span>
                   </div>
               )}
           </div>

           <div className="absolute bottom-3 left-3 right-3 bg-slate-950/40 rounded-lg py-1 border border-white/5 z-20">
               <div className={`text-sm text-center font-bold truncate px-1 ${isDead ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                   {player.name}
               </div>
           </div>

           {votesReceived > 0 && (
               <div className="absolute top-14 right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xl z-20 animate-pulse">
                   <span className="text-sm font-bold text-white">{votesReceived}</span>
               </div>
           )}
       </div>
    </motion.div>
  );
});

export default PlayerCard;
