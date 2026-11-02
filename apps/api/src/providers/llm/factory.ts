import type { Env } from '../../config/env.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { MockProvider } from './mock.js';
import type { LlmProvider } from './types.js';

export function createLlmProvider(config: Pick<Env, 'LLM_PROVIDER' | 'LLM_MODEL' | 'LLM_EXTRACT_MODEL' | 'LLM_EXPLAIN_MODEL' | 'LLM_TIMEOUT_MS' | 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY'>): LlmProvider {
  const common = {
    model: config.LLM_MODEL,
    extractModel: config.LLM_EXTRACT_MODEL,
    explainModel: config.LLM_EXPLAIN_MODEL,
    timeoutMs: config.LLM_TIMEOUT_MS,
  };

  if (config.LLM_PROVIDER === 'gemini') {
    return new GeminiProvider({ ...common, apiKey: config.GEMINI_API_KEY ?? '' });
  }
  if (config.LLM_PROVIDER === 'anthropic') {
    return new AnthropicProvider({ ...common, apiKey: config.ANTHROPIC_API_KEY ?? '' });
  }
  return new MockProvider();
}
