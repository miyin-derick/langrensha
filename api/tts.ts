import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TtsRequestBody {
  text: string;
  voice: string;
  speed?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body as TtsRequestBody;
    const apiKey = process.env.SILICONFLOW_API_KEY || '';
    if (!apiKey) {
      res.status(503).json({ error: 'TTS key is not configured' });
      return;
    }
    if (!body.text || !body.voice) {
      res.status(400).json({ error: 'Invalid TTS request' });
      return;
    }

    const response = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'FunAudioLLM/CosyVoice2-0.5B',
        input: body.text,
        voice: body.voice,
        response_format: 'mp3',
        sample_rate: 32000,
        stream: false,
        speed: body.speed ?? 1,
        gain: 0,
      }),
    });

    const arrayBuffer = await response.arrayBuffer();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
