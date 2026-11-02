import { TtsUnavailableError } from './errors.js';
import type { TtsProvider } from './types.js';

export class BrowserTtsProvider implements TtsProvider {
  readonly name = 'browser' as const;

  async synthesize(): Promise<Buffer> {
    throw new TtsUnavailableError('Usa el reproductor de voz del navegador.');
  }
}
