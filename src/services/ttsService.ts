import { REAL_AUDIO_ASSETS, getPlayerConfig } from "../constants";
import { postForBlob } from "./apiClient";

// 缓存：用于存储已生成的语音 URL，避免重复扣费
const audioCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50; // LRU 缓存大小

// 简单的 LRU 缓存清理
const trimCache = () => {
    if (audioCache.size > MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) audioCache.delete(firstKey);
    }
};

// ==========================================
// 🆓 免费：浏览器原生语音 (用于上帝/系统)
// ==========================================
const playBrowserTTS = (text: string): Promise<void> => {
    return new Promise((resolve) => {
        // 1. 打断之前的说话
        window.speechSynthesis.cancel();

        // 2. 创建新的发音对象
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; // 强制中文
        utterance.rate = 1.1;     // 语速稍微快一点，显得干练
        utterance.pitch = 1.0;    // 正常音调

        // 3. 事件监听
        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.error("Browser TTS Error:", e);
            resolve(); // 出错也不要卡死游戏
        };

        // 4. 播放
        window.speechSynthesis.speak(utterance);
    });
};

// ==========================================
// 💰 付费：API 语音 (用于玩家)
// ==========================================

export const speak = async (text: string, playerId: number): Promise<void> => {
    // 🛑 1. 省钱拦截：如果是上帝 (ID=0)，使用免费浏览器语音
    if (playerId === 0) {
        console.log("💰 [省钱模式] 上帝发言，使用浏览器免费TTS");
        await playBrowserTTS(text);
        return;
    }

    if (!text) return;

    // 2. 检查缓存 (LRU)
    const cacheKey = `${playerId}:${text}`;
    if (audioCache.has(cacheKey)) {
        console.log(`[TTS] 命中缓存: ${cacheKey}`);
        await playAudio(audioCache.get(cacheKey)!);
        return;
    }

    // 3. 准备 API 请求
    // 获取角色音色配置
    const playerConfig = getPlayerConfig(playerId);
    // 默认音色，如果 constants 里没配，就用个默认的
    let voiceModel = "FunAudioLLM/CosyVoice2-0.5B:alex"; 
    if (playerConfig && playerConfig.voice) {
        voiceModel = playerConfig.voice;
    }

    try {
        console.log(`[TTS] 生成中 (${playerId}号): ${text.substring(0, 10)}...`);
        const blob = await postForBlob("/api/tts", {
            text,
            voice: voiceModel,
            speed: playerConfig.speed || 1.0,
        });
        const audioUrl = URL.createObjectURL(blob);

        // 存入缓存
        trimCache();
        audioCache.set(cacheKey, audioUrl);

        await playAudio(audioUrl);

    } catch (error) {
        console.error("TTS 生成失败:", error);
        // 兜底：如果 API 挂了，为了不卡流程，临时用浏览器语音顶一下
        await playBrowserTTS(text); 
    }
};

// 预加载函数 (用于 FastTrack)
export const prefetch = async (text: string, playerId: number): Promise<string | null> => {
    // 🛑 省钱拦截：上帝不需要预加载 API，因为他是本地生成的
    if (playerId === 0) return null;

    if (!text) return null;
    const cacheKey = `${playerId}:${text}`;
    if (audioCache.has(cacheKey)) return audioCache.get(cacheKey)!;

    const playerConfig = getPlayerConfig(playerId);
    let voiceModel = "FunAudioLLM/CosyVoice2-0.5B:alex"; 
    if (playerConfig && playerConfig.voice) {
        voiceModel = playerConfig.voice;
    }

    try {
        console.log(`[TTS] 预加载中 (${playerId}号)...`);
        const blob = await postForBlob("/api/tts", {
            text,
            voice: voiceModel,
            speed: playerConfig.speed || 1.0,
        });
        const audioUrl = URL.createObjectURL(blob);
        trimCache();
        audioCache.set(cacheKey, audioUrl);
        return audioUrl;
    } catch (e) {
        console.error("预加载失败", e);
        return null;
    }
};

// 播放音频的基础函数
export const playAudio = (url: string): Promise<void> => {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = (e) => {
            console.error("音频播放错误:", e);
            resolve(); // 播放失败也继续，防止卡死
        };
        audio.play().catch(e => {
            console.warn("自动播放被拦截:", e);
            resolve();
        });
    });
};

export const cancelSpeech = () => {
    window.speechSynthesis.cancel();
    // 停止所有正在播放的 Audio 元素 (简单粗暴的方法：重置页面音频?)
    // 暂时只需停止浏览器语音即可，Audio 元素通常会自然播放完或被垃圾回收
};

export const loadVoices = () => {
    // 触发浏览器加载语音列表（部分浏览器需要）
    window.speechSynthesis.getVoices();
};

// 测试音频
export const testAudio = async () => {
    const audio = new Audio("/sounds/bgm_day.mp3"); 
    try {
        await audio.play();
        setTimeout(() => audio.pause(), 3000); // 响3秒证明能响
    } catch (e) {
        console.error("测试音频失败:", e);
    }
};
