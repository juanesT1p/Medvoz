import Anthropic from '@anthropic-ai/sdk';
import { StructuredLlmProvider } from './structured.js';
import type { LlmProviderConfig } from './types.js';

export class AnthropicProvider extends StructuredLlmProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  protected async requestText(request: Parameters<StructuredLlmProvider['requestText']>[0]) {
    const content: Anthropic.ContentBlockParam[] = [];
    if (request.image) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: request.image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: request.image.data.toString('base64'),
        },
      });
    }
    content.push({ type: 'text', text: `${request.userText ?? 'Responde usando la imagen.'}\nEsquema JSON esperado: ${JSON.stringify(this.schemaForPrompt(request.schema))}` });

    const response = await this.client.messages.create(
      {
        model: request.model,
        max_tokens: request.maxOutputTokens ?? 1_024,
        system: request.system,
        messages: [{ role: 'user', content }],
      },
      { signal: request.signal },
    );

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    return {
      text: textBlock?.text ?? '',
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
