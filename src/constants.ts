import { Role, AIProvider, Playstyle } from './types';

// =================================================================
// 1. 玩家基础配置表
// =================================================================

const TTS_MODEL_BASE = "FunAudioLLM/CosyVoice2-0.5B";

export const PLAYER_CONFIG: Record<number, { 
    name: string; 
    gender: 'male' | 'female';
    voice: string;            
    speed: number;            
}> = {
    0: { name: "上帝", gender: 'male', voice: `${TTS_MODEL_BASE}:alex`, speed: 1.0 },
    1: { name: "1号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:david`, speed: 1.0 },
    2: { name: "2号玩家", gender: 'female', voice: `${TTS_MODEL_BASE}:anna`, speed: 1.0 },
    3: { name: "3号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:benjamin`, speed: 1.0 },
    4: { name: "4号玩家", gender: 'female', voice: `${TTS_MODEL_BASE}:bella`, speed: 1.0 },
    5: { name: "5号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:alex`, speed: 1.0 },
    6: { name: "6号玩家", gender: 'female', voice: `${TTS_MODEL_BASE}:diana`, speed: 1.0 },
    7: { name: "7号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:charles`, speed: 1.0 },
    8: { name: "8号玩家", gender: 'female', voice: `${TTS_MODEL_BASE}:anna`, speed: 1.0 },
    9: { name: "9号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:david`, speed: 1.0 },
    10: { name: "10号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:benjamin`, speed: 1.0 },
    11: { name: "11号玩家", gender: 'male', voice: `${TTS_MODEL_BASE}:alex`, speed: 1.0 },
    12: { name: "12号玩家", gender: 'female', voice: `${TTS_MODEL_BASE}:diana`, speed: 1.0 }
};

export const getPlayerConfig = (id: number) => {
    const cfg = PLAYER_CONFIG[id];
    return {
        name: cfg ? cfg.name : `${id}号玩家`,
        gender: (cfg ? cfg.gender : 'male') as 'male' | 'female', 
        voice: cfg ? cfg.voice : `${TTS_MODEL_BASE}:alex`,
        speed: cfg ? cfg.speed : 1.0
    };
};

export const DEFAULT_PLAYSTYLE: Playstyle = {
  label: "自由发挥",
  description: "不预设性格",
  quote: "...",
  temperature: { think: 0.5, speak: 0.7 }
};

export const AI_PROVIDERS: AIProvider[] = ['OpenAI', 'DeepSeek', 'Doubao', 'Aliyun', 'Gemini', 'Zhipu', 'Moonshot', 'MiniMax', 'Tencent', 'Groq'];

export interface AIModelSeat {
  provider: AIProvider;
  model: string;
}

export const DEFAULT_AI_ROSTER: AIModelSeat[] = [
  { provider: 'Aliyun', model: 'qwen3.7-plus' },
  { provider: 'DeepSeek', model: 'deepseek-v4-pro' },
  { provider: 'Doubao', model: 'doubao-seed-2-0-lite-260428' },
  { provider: 'DeepSeek', model: 'deepseek-v4-pro' },
  { provider: 'DeepSeek', model: 'deepseek-v4-pro' },
  { provider: 'Zhipu', model: 'glm-5.2' },
  { provider: 'Zhipu', model: 'glm-5.2' },
  { provider: 'Zhipu', model: 'glm-5.2' },
  { provider: 'Doubao', model: 'doubao-seed-2-0-lite-260428' },
  { provider: 'Moonshot', model: 'kimi-k2.6' },
  { provider: 'Aliyun', model: 'qwen3.7-plus' },
  { provider: 'Aliyun', model: 'qwen3.7-plus' },
];

// 🔥 核心修改：在这里定义 SiliconFlow 支持的真实模型 ID
export const MODEL_CATALOG: Record<string, string[]> = {
  OpenAI: [
      'gpt-4.1-mini',
      'gpt-4.1',
      'gpt-5.5'
  ],
  Doubao: [
      'doubao-seed-2-0-lite-260428',
      'doubao-seed-1-6-flash-250615'
  ],
  DeepSeek: [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-ai/DeepSeek-V3',       // 👑 主力战神 (便宜且强)
      'Qwen/Qwen2.5-7B-Instruct',      // 🆓 免费劳工 (极速)
      'Qwen/Qwen2.5-72B-Instruct',     // 🚀 备用强力模型
      'InternLM/internlm2_5-7b-chat'   // 🚀 备用免费模型
  ], 
  Aliyun:   ['qwen3.7-plus', 'qwen-plus', 'qwen-max'],
  Gemini:   ['gemini-3.5-flash'], 
  Zhipu:    ['glm-5.2', 'glm-4.7-flash', 'glm-4.5-flash'], 
  Moonshot: ['kimi-k2.6', 'moonshot-v1-8k'], 
  MiniMax:  ['abab6.5s-chat'], 
  Tencent:  ['hunyuan-lite'], 
  Groq:     ['llama3-70b-8192'] 
};

export const PROVIDER_CONFIG = {
  OpenAI:   { label: 'OpenAI',   icon: '●', color: 'text-green-400', bg: 'bg-green-900/40', border: 'border-green-500/50' },
  DeepSeek: { label: 'SiliconFlow', icon: '⚡', color: 'text-blue-400', bg: 'bg-blue-900/40', border: 'border-blue-500/50' },
  Doubao:   { label: '豆包',     icon: '豆', color: 'text-pink-400', bg: 'bg-pink-900/40', border: 'border-pink-500/50' },
  Aliyun:   { label: '通义千问', icon: '🔶', color: 'text-orange-400', bg: 'bg-orange-900/40', border: 'border-orange-500/50' },
  Gemini:   { label: 'Gemini',   icon: '🌟', color: 'text-fuchsia-400', bg: 'bg-fuchsia-900/40', border: 'border-fuchsia-500/50' },
  Zhipu:    { label: '智谱GLM',  icon: '🧠', color: 'text-teal-400', bg: 'bg-teal-900/40', border: 'border-teal-500/50' },
  Moonshot: { label: 'Kimi',     icon: '🌙', color: 'text-indigo-400', bg: 'bg-indigo-900/40', border: 'border-indigo-500/50' },
  MiniMax:  { label: '海螺AI',   icon: '🐚', color: 'text-rose-400', bg: 'bg-rose-900/40', border: 'border-rose-500/50' },
  Tencent:  { label: '腾讯混元', icon: '🐧', color: 'text-sky-400', bg: 'bg-sky-900/40', border: 'border-sky-500/50' },
  Groq:     { label: 'Groq',     icon: '🚀', color: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-500/50' }
};

export const ROLE_CONFIG = {
  [Role.UNKNOWN]: { label: '待定', icon: '❓', color: 'text-slate-500', bg: 'bg-slate-800', border: 'border-slate-600' },
  [Role.WEREWOLF]: { label: '狼人', icon: '🐺', color: 'text-red-500', bg: 'bg-red-900/30', border: 'border-red-600' },
  [Role.VILLAGER]: { label: '平民', icon: '🧑‍🌾', color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-600' },
  [Role.SEER]: { label: '预言家', icon: '🔮', color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-600' },
  [Role.WITCH]: { label: '女巫', icon: '🧪', color: 'text-fuchsia-400', bg: 'bg-fuchsia-900/30', border: 'border-fuchsia-600' },
  [Role.HUNTER]: { label: '猎人', icon: '🔫', color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-600' },
  [Role.GUARD]: { label: '守卫', icon: '🛡️', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-600' },
};

export const INITIAL_ROLE_DISTRIBUTION = [
  Role.WEREWOLF, Role.WEREWOLF, Role.WEREWOLF, Role.WEREWOLF,
  Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER,
  Role.SEER, Role.WITCH, Role.GUARD, Role.HUNTER
];

export const AI_NAMES = Object.values(PLAYER_CONFIG).filter(p => p.name !== "上帝").map(p => p.name);

const SFX_POP = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAAAAAAAAAAD/AAAAAAAA";
const SFX_CLICK = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export const REAL_AUDIO_ASSETS = {
    BGM: { DAY: "/sounds/bgm_day.mp3", NIGHT: "/sounds/bgm_night.mp3" },
    SFX: { CLAW: SFX_POP, GUN: SFX_POP, POTION: SFX_POP, VOTE: SFX_POP, SHERIFF: SFX_CLICK, DAY_NIGHT: SFX_CLICK }
};
