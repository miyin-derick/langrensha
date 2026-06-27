const playBrowserTTS = (text: string): Promise<void> => {
    return new Promise((resolve) => {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.1;
        utterance.pitch = 1.0;

        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.error("Browser TTS Error:", e);
            resolve();
        };

        window.speechSynthesis.speak(utterance);
    });
};

export const speak = async (text: string, playerId: number): Promise<void> => {
    if (!text) return;
    console.log(`[Browser TTS] ${playerId}号: ${text.substring(0, 10)}...`);
    await playBrowserTTS(text);
};

export const prefetch = async (text: string, playerId: number): Promise<string | null> => {
    return null;
};

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
};

export const loadVoices = () => {
    window.speechSynthesis.getVoices();
};

export const testAudio = async () => {
    const audio = new Audio("/sounds/bgm_day.mp3"); 
    try {
        await audio.play();
        setTimeout(() => audio.pause(), 3000); // 响3秒证明能响
    } catch (e) {
        console.error("测试音频失败:", e);
    }
};
