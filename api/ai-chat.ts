import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AIProvider } from '../src/types';
import { getProviderConfig } from './_shared/providerRegistry.js';

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
    const requestBody: Record<string, unknown> = {
      model: config.modelOverride || body.model,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 512,
    };

    const response = await fetch(config.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      res.status(504).json({ error: 'AI provider timed out' });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
