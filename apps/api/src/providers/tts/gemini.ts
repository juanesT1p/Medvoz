import { GoogleGenAI } from '@google/genai';
import { TtsAuthError, TtsError, TtsInvalidOutputError, TtsTimeoutError, TtsUnavailableError } from './errors.js';
import type { TtsProvider, TtsSynthesizeOptions } from './types.js';

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string } }> };
  }>;
};

type GeminiTtsClient = {
  models: {
    generateContent(request: {
      model: string;
      contents: string;
      config: {
        responseModalities: ['AUDIO'];
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } };
        abortSignal: AbortSignal;
      };
    }): Promise<GeminiTtsResponse>;
  };
};

type GeminiTtsConfig = {
  apiKey: string;
  model?: string;
  voice?: string;
  timeoutMs?: number;
  client?: GeminiTtsClient;
};

export class GeminiTtsProvider implements TtsProvider {
  readonly name = 'gemini' as const;
  readonly contentType = 'audio/wav' as const;
  private readonly model: string;
  private readonly voice: string;
  private readonly timeoutMs: number;
  private readonly client: GeminiTtsClient;

  constructor(config: GeminiTtsConfig) {
    this.model = config.model ?? 'gemini-3.8-flash-lite-tts';
    this.voice = config.voice ?? 'Kore';
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.client = config.client ?? (new GoogleGenAI({ apiKey: config.apiKey }) as unknown as GeminiTtsClient);
  }

  async synthesize(text: string, options: TtsSynthesizeOptions = {}): Promise<Buffer> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: text,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: options.voice ?? this.voice },
            },
          },
          abortSignal: controller.signal,
        },
      });
      const encodedAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!encodedAudio) throw new TtsInvalidOutputError();

      const audio = Buffer.from(encodedAudio, 'base64');
      if (audio.length === 0) throw new TtsInvalidOutputError();
      return audio.subarray(0, 4).toString('ascii') === 'RIFF' ? audio : pcmToWav(audio);
    } catch (error) {
      if (timedOut) throw new TtsTimeoutError();
      if (error instanceof TtsError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new TtsTimeoutError();
      const status = getStatus(error);
      if (status === 401 || status === 403) throw new TtsAuthError();
      throw new TtsUnavailableError('No fue posible generar el audio.', { cause: error });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function getStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}
