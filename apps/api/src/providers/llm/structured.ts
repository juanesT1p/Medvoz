import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';
import { LlmInvalidOutputError, LlmTimeoutError, normalizeLlmError } from './errors.js';
import type { LlmProvider, LlmProviderConfig } from './types.js';

type RawRequest = {
  task: 'extract' | 'explain';
  system: string;
  userText?: string;
  image?: { mimeType: string; data: Buffer };
  schema: ZodType<unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
};

export abstract class StructuredLlmProvider implements LlmProvider {
  abstract readonly name: LlmProvider['name'];

  protected constructor(protected readonly config: LlmProviderConfig) {}

  protected abstract requestText(request: RawRequest & { model: string }): Promise<{ text: string; usage?: { inputTokens?: number; outputTokens?: number } }>;

  async generateStructured<T>(request: {
    task: 'extract' | 'explain';
    system: string;
    userText?: string;
    image?: { mimeType: string; data: Buffer };
    schema: ZodType<T>;
    temperature?: number;
    maxOutputTokens?: number;
    signal?: AbortSignal;
  }): Promise<{ data: T; usage?: { inputTokens?: number; outputTokens?: number } }> {
    let lastIssue = 'JSON no válido.';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const requestWithSignal = request.signal === undefined ? { ...request } : { ...request, signal: request.signal };
        const response = await this.withTimeout(requestWithSignal);
        const parsed = parseJson(response.text);
        const result = request.schema.safeParse(parsed);

        if (result.success) {
          return response.usage === undefined ? { data: result.data } : { data: result.data, usage: response.usage };
        }

        lastIssue = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      } catch (error) {
        if (error instanceof LlmInvalidOutputError) {
          lastIssue = error.message;
        } else {
          throw normalizeLlmError(error);
        }
      }
    }

    throw new LlmInvalidOutputError(`La respuesta estructurada no pasó la validación: ${lastIssue}`);
  }

  protected modelFor(task: RawRequest['task']): string {
    return task === 'extract' ? this.config.extractModel ?? this.config.model : this.config.explainModel ?? this.config.model;
  }

  protected schemaForPrompt(schema: ZodType<unknown>): Record<string, unknown> {
    return zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>;
  }

  private async withTimeout(request: Omit<RawRequest, 'signal'> & { signal?: AbortSignal }) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      return await this.requestText({ ...request, signal: controller.signal, model: this.modelFor(request.task) });
    } catch (error) {
      if (timedOut) throw new LlmTimeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new LlmInvalidOutputError('La respuesta del proveedor no contiene JSON válido.', { cause: error });
  }
}
