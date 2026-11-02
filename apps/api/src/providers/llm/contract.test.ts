import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LlmAuthError, LlmInvalidOutputError, LlmTimeoutError } from './errors.js';
import { MockProvider } from './mock.js';
import { StructuredLlmProvider } from './structured.js';

const ResponseSchema = z.object({ ok: z.literal(true) });

describe('contrato LlmProvider', () => {
  it('devuelve una salida estructurada validada', async () => {
    const provider = new MockProvider(['{"ok":true}']);

    await expect(
      provider.generateStructured({ task: 'explain', system: 'test', schema: ResponseSchema }),
    ).resolves.toMatchObject({ data: { ok: true } });
  });

  it('reintenta exactamente una vez cuando la salida no valida', async () => {
    const provider = new MockProvider(['{"ok":false}', '{"ok":true}']);

    await expect(
      provider.generateStructured({ task: 'explain', system: 'test', schema: ResponseSchema }),
    ).resolves.toMatchObject({ data: { ok: true } });
  });

  it('devuelve un error controlado después del segundo resultado inválido', async () => {
    const provider = new MockProvider(['{"ok":false}', 'no es json']);

    await expect(provider.generateStructured({ task: 'explain', system: 'test', schema: ResponseSchema })).rejects.toBeInstanceOf(
      LlmInvalidOutputError,
    );
  });

  it('normaliza errores de autenticación y timeout', async () => {
    class ErrorProvider extends StructuredLlmProvider {
      readonly name = 'mock' as const;
      constructor(private readonly failure: Error) {
        super({ apiKey: 'test', model: 'test', extractModel: undefined, explainModel: undefined, timeoutMs: 10 });
      }

      protected async requestText(request: { signal: AbortSignal }): Promise<{ text: string }> {
        if (this.failure instanceof LlmTimeoutError) {
          await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => resolve(), { once: true }));
          throw new DOMException('Aborted', 'AbortError');
        }
        throw this.failure;
      }
    }

    await expect(new ErrorProvider(new LlmAuthError()).generateStructured({ task: 'extract', system: 'test', schema: ResponseSchema })).rejects.toBeInstanceOf(
      LlmAuthError,
    );
    await expect(new ErrorProvider(new LlmTimeoutError()).generateStructured({ task: 'extract', system: 'test', schema: ResponseSchema })).rejects.toBeInstanceOf(
      LlmTimeoutError,
    );
  });
});
