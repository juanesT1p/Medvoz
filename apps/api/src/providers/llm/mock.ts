import type { ZodType } from 'zod';
import { StructuredLlmProvider } from './structured.js';
import type { LlmProviderConfig } from './types.js';

const defaultResponse = JSON.stringify({
  isPrescription: true,
  items: [
    {
      rawText: 'Acetaminofén 500 mg, tomar 1 tableta cada 8 horas por 3 días',
      name: 'Acetaminofén',
      activeIngredient: 'acetaminofén',
      strength: '500 mg',
      form: 'tableta',
      dose: '1 tableta',
      frequency: 'cada 8 horas',
      duration: 'por 3 días',
      route: 'oral',
      instructions: null,
      confidence: 0.98,
      legibility: 'clear',
    },
  ],
  documentWarnings: [],
});

export class MockProvider extends StructuredLlmProvider {
  readonly name = 'mock' as const;
  private readonly responses: string[];

  constructor(responses: string[] = [defaultResponse]) {
    super({ apiKey: 'mock', model: 'mock', extractModel: undefined, explainModel: undefined, timeoutMs: 30_000 } satisfies LlmProviderConfig);
    this.responses = [...responses];
  }

  protected async requestText(_request: {
    task: 'extract' | 'explain';
    system: string;
    userText?: string;
    image?: { mimeType: string; data: Buffer };
    schema: ZodType<unknown>;
    temperature?: number;
    maxOutputTokens?: number;
    signal: AbortSignal;
    model: string;
  }): Promise<{ text: string }> {
    return { text: this.responses.shift() ?? defaultResponse };
  }
}
