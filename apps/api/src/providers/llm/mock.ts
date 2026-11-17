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
      dosisValor: 1,
      dosisUnidad: 'tableta',
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

const defaultExplanationResponse = JSON.stringify({
  queEs: 'Es un medicamento de prueba.',
  paraQueSuele: 'Suele usarse para una situación que debe confirmar un profesional.',
  precauciones: ['Confirma las precauciones con un profesional.'],
  senalesDeAlerta: ['Consulta si notas una reacción inesperada.'],
  preguntasParaMedico: ['¿Qué debo vigilar con este medicamento?'],
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
    return { text: this.responses.shift() ?? (_request.task === 'explain' ? defaultExplanationResponse : defaultResponse) };
  }
}
