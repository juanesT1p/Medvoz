export type LlmErrorCode = 'LLM_AUTH' | 'LLM_RATE_LIMIT' | 'LLM_TIMEOUT' | 'LLM_INVALID_OUTPUT';

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: LlmErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class LlmAuthError extends LlmError {
  constructor(message = 'La autenticación del proveedor de IA falló.', options?: ErrorOptions) {
    super(message, 'LLM_AUTH', options);
  }
}

export class LlmRateLimitError extends LlmError {
  constructor(message = 'El proveedor de IA alcanzó su límite de solicitudes.', options?: ErrorOptions) {
    super(message, 'LLM_RATE_LIMIT', options);
  }
}

export class LlmTimeoutError extends LlmError {
  constructor(message = 'El proveedor de IA tardó demasiado en responder.', options?: ErrorOptions) {
    super(message, 'LLM_TIMEOUT', options);
  }
}

export class LlmInvalidOutputError extends LlmError {
  constructor(message = 'El proveedor de IA devolvió una respuesta no válida.', options?: ErrorOptions) {
    super(message, 'LLM_INVALID_OUTPUT', options);
  }
}

export function normalizeLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;

  const status = getErrorStatus(error);
  const message = error instanceof Error ? error.message : 'Error desconocido del proveedor de IA.';

  if (status === 401 || status === 403 || /api key|unauthorized|authentication|permission/i.test(message)) {
    return new LlmAuthError(undefined, { cause: error });
  }

  if (status === 429 || /rate limit|too many requests|resource exhausted/i.test(message)) {
    return new LlmRateLimitError(undefined, { cause: error });
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new LlmTimeoutError(undefined, { cause: error });
  }

  return new LlmError('El proveedor de IA no está disponible.', 'LLM_INVALID_OUTPUT', { cause: error });
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}
