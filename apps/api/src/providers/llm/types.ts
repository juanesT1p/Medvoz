import type { ZodType } from 'zod';

export interface LlmProvider {
  readonly name: 'gemini' | 'anthropic' | 'mock';
  generateStructured<T>(request: {
    task: 'extract' | 'explain';
    system: string;
    userText?: string;
    image?: { mimeType: string; data: Buffer };
    schema: ZodType<T>;
    temperature?: number;
    maxOutputTokens?: number;
    signal?: AbortSignal;
  }): Promise<{ data: T; usage?: { inputTokens?: number; outputTokens?: number } }>;
}

export type LlmProviderConfig = {
  model: string;
  extractModel: string | undefined;
  explainModel: string | undefined;
  apiKey: string;
  timeoutMs: number;
};
