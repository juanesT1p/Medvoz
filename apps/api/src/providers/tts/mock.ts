import type { TtsProvider, TtsSynthesizeOptions } from './types.js';

export class MockTtsProvider implements TtsProvider {
  readonly name = 'mock' as const;

  async synthesize(_text: string, _options?: TtsSynthesizeOptions): Promise<Buffer> {
    return Buffer.from('ID3\x04\x00\x00MEDVOZ-MOCK-AUDIO');
  }
}
