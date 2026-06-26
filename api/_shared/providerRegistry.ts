import type { AIProvider } from '../../src/types';

interface ProviderConfig {
  endpoint: string;
  apiKey: string;
  modelOverride?: string;
}

function getDeepSeekConfig(): ProviderConfig {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      modelOverride: process.env.DEEPSEEK_MODEL,
    };
  }

  return {
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: process.env.SILICONFLOW_API_KEY || '',
    modelOverride: process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V3',
  };
}

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  const registry: Record<AIProvider, ProviderConfig> = {
    OpenAI: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY || '',
      modelOverride: process.env.OPENAI_MODEL,
    },
    DeepSeek: getDeepSeekConfig(),
    Doubao: {
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      apiKey: process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY || '',
      modelOverride: process.env.DOUBAO_MODEL,
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
