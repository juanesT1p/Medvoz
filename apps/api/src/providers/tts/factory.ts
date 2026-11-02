import type { Env } from '../../config/env.js';
import { BrowserTtsProvider } from './browser.js';
import { MockTtsProvider } from './mock.js';
import { OpenAiTtsProvider } from './openai.js';
import type { TtsProvider } from './types.js';

export function createTtsProvider(config: Pick<Env, 'TTS_PROVIDER' | 'TTS_API_KEY' | 'LLM_TIMEOUT_MS'>): TtsProvider {
  if (config.TTS_PROVIDER === 'openai') {
    return new OpenAiTtsProvider({ apiKey: config.TTS_API_KEY ?? '', timeoutMs: config.LLM_TIMEOUT_MS });
  }
  if (config.TTS_PROVIDER === 'mock') return new MockTtsProvider();
  return new BrowserTtsProvider();
}
