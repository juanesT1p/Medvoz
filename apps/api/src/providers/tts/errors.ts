export type TtsErrorCode = 'TTS_AUTH' | 'TTS_TIMEOUT' | 'TTS_UNAVAILABLE' | 'TTS_INVALID_OUTPUT';

export class TtsError extends Error {
  constructor(message: string, readonly code: TtsErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class TtsAuthError extends TtsError {
  constructor(message = 'La autenticación del proveedor de audio falló.', options?: ErrorOptions) {
    super(message, 'TTS_AUTH', options);
  }
}

export class TtsTimeoutError extends TtsError {
  constructor(message = 'El proveedor de audio tardó demasiado en responder.', options?: ErrorOptions) {
    super(message, 'TTS_TIMEOUT', options);
  }
}

export class TtsUnavailableError extends TtsError {
  constructor(message = 'El proveedor de audio no está disponible.', options?: ErrorOptions) {
    super(message, 'TTS_UNAVAILABLE', options);
  }
}

export class TtsInvalidOutputError extends TtsError {
  constructor(message = 'El proveedor de audio devolvió una respuesta inválida.', options?: ErrorOptions) {
    super(message, 'TTS_INVALID_OUTPUT', options);
  }
}
