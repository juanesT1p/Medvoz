import { TtsAuthError, TtsError, TtsInvalidOutputError, TtsTimeoutError, TtsUnavailableError } from './errors.js';
import type { TtsProvider, TtsSynthesizeOptions } from './types.js';

type OpenAiTtsConfig = {
  apiKey: string;
  model?: string;
  voice?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class OpenAiTtsProvider implements TtsProvider {
  readonly name = 'openai' as const;
  private readonly model: string;
  private readonly voice: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OpenAiTtsConfig) {
    this.model = config.model ?? 'gpt-4o-mini-tts';
    this.voice = config.voice ?? 'coral';
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
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
      const response = await this.fetchImpl('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: options.voice ?? this.voice,
          instructions: 'Habla en español claro, cálido y pausado, con pronunciación comprensible para Colombia.',
          response_format: 'mp3',
          ...(options.speed === undefined ? {} : { speed: options.speed }),
        }),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) throw new TtsAuthError();
      if (!response.ok) throw new TtsUnavailableError(`El proveedor de audio respondió con estado ${response.status}.`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length === 0) throw new TtsInvalidOutputError();
      return data;
    } catch (error) {
      if (timedOut) throw new TtsTimeoutError();
      if (error instanceof TtsError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new TtsTimeoutError();
      throw new TtsUnavailableError('No fue posible generar el audio.', { cause: error });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}
