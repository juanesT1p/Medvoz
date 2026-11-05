import { GoogleGenAI } from '@google/genai';
import { StructuredLlmProvider } from './structured.js';
import type { LlmProviderConfig } from './types.js';

export class GeminiProvider extends StructuredLlmProvider {
  readonly name = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  protected async requestText(request: Parameters<StructuredLlmProvider['requestText']>[0]) {
    const contents = [];
    if (request.image) {
      contents.push({ inlineData: { mimeType: request.image.mimeType, data: request.image.data.toString('base64') } });
    }
    if (request.userText) contents.push({ text: request.userText });

    const response = await this.client.models.generateContent({
      model: request.model,
      contents,
      config: {
        systemInstruction: request.system,
        responseMimeType: 'application/json',
        abortSignal: request.signal,
        thinkingConfig: { thinkingBudget: 0 },
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }),
        responseSchema: this.schemaForPrompt(request.schema),
      },
    });

    const usage = response.usageMetadata
      ? {
          ...(response.usageMetadata.promptTokenCount === undefined ? {} : { inputTokens: response.usageMetadata.promptTokenCount }),
          ...(response.usageMetadata.candidatesTokenCount === undefined ? {} : { outputTokens: response.usageMetadata.candidatesTokenCount }),
        }
      : undefined;
    return usage === undefined ? { text: response.text ?? '' } : { text: response.text ?? '', usage };
  }
}
