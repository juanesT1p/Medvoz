import { Readable } from 'node:stream';
import { TtsInvalidOutputError } from '../providers/tts/errors.js';
import type { TtsProvider, TtsSynthesizeOptions } from '../providers/tts/types.js';

export const MAX_AUDIO_SCRIPT_WORDS = 250;

export class TtsService {
  constructor(private readonly provider: TtsProvider) {}

  async synthesize(text: string, options?: TtsSynthesizeOptions): Promise<Buffer> {
    const normalized = text.trim();
    if (!normalized) throw new TtsInvalidOutputError('El guion de audio no puede estar vacío.');
    if (countWords(normalized) > MAX_AUDIO_SCRIPT_WORDS) {
      throw new TtsInvalidOutputError(`El guion no puede superar ${MAX_AUDIO_SCRIPT_WORDS} palabras.`);
    }

    const result = await this.provider.synthesize(normalized, options);
    if (Buffer.isBuffer(result)) return result;
    if (result instanceof Readable || isAsyncIterable(result)) {
      const chunks: Buffer[] = [];
      for await (const chunk of result) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const data = Buffer.concat(chunks);
      if (data.length === 0) throw new TtsInvalidOutputError();
      return data;
    }
    throw new TtsInvalidOutputError();
  }
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array | string> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}
