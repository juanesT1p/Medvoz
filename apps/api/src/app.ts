import cors from 'cors';
import express from 'express';
import multer, { MulterError } from 'multer';
import { HealthResponseSchema } from '@medvoz/shared';
import type { Env } from './config/env.js';
import { ExtractionService } from './services/extraction.service.js';
import { createLlmProvider } from './providers/llm/factory.js';
import { LlmError } from './providers/llm/errors.js';
import type { LlmProvider } from './providers/llm/types.js';
import { HttpError } from './lib/http-error.js';
import { isAcceptedImageType, normalizeImage } from './lib/image.js';

type AppConfig = Pick<Env, 'CORS_ORIGIN' | 'LLM_PROVIDER' | 'LLM_MODEL'> &
  Partial<Pick<Env, 'MAX_IMAGE_MB' | 'LLM_EXTRACT_MODEL' | 'LLM_EXPLAIN_MODEL' | 'LLM_TIMEOUT_MS' | 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY'>>;

export function createApp(config: AppConfig, dependencies: { llmProvider?: LlmProvider } = {}) {
  const app = express();
  const maxImageMb = config.MAX_IMAGE_MB ?? 10;
  const llmProvider = dependencies.llmProvider ?? createDefaultProvider(config);
  const extractionService = new ExtractionService(llmProvider);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(maxImageMb * 1024 * 1024), files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!isAcceptedImageType(file.mimetype)) {
        callback(new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'El archivo debe ser una imagen JPEG, PNG, WebP o HEIC.'));
        return;
      }
      callback(null, true);
    },
  });

  app.disable('x-powered-by');
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    const payload = HealthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      llmProvider: config.LLM_PROVIDER,
      llmModel: config.LLM_MODEL,
    });

    response.status(200).json(payload);
  });

  app.post('/api/prescriptions/extract', upload.single('image'), async (request, response, next) => {
    try {
      if (!request.file) {
        throw new HttpError(400, 'IMAGE_REQUIRED', 'Debes adjuntar una imagen de la fórmula.');
      }

      const image = await normalizeImage(request.file);
      const result = await extractionService.extract(image);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const normalized = normalizeHttpError(error);
    response.status(normalized.statusCode).json({ error: { code: normalized.code, message: normalized.message } });
  });

  return app;
}

function createDefaultProvider(config: AppConfig): LlmProvider {
  return createLlmProvider({
    LLM_PROVIDER: config.LLM_PROVIDER,
    LLM_MODEL: config.LLM_MODEL,
    LLM_EXTRACT_MODEL: config.LLM_EXTRACT_MODEL,
    LLM_EXPLAIN_MODEL: config.LLM_EXPLAIN_MODEL,
    LLM_TIMEOUT_MS: config.LLM_TIMEOUT_MS ?? 30_000,
    GEMINI_API_KEY: config.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY,
  });
}

function normalizeHttpError(error: unknown): { statusCode: number; code: string; message: string } {
  if (error instanceof HttpError) return error;

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return { statusCode: 413, code: 'IMAGE_TOO_LARGE', message: 'La imagen supera el tamaño máximo permitido.' };
    }
    return { statusCode: 400, code: 'INVALID_UPLOAD', message: 'No se pudo procesar el archivo enviado.' };
  }

  if (error instanceof LlmError) {
    const statusByCode = { LLM_AUTH: 502, LLM_RATE_LIMIT: 429, LLM_TIMEOUT: 504, LLM_INVALID_OUTPUT: 502 } as const;
    const messages = {
      LLM_AUTH: 'No se pudo autenticar con el proveedor de IA.',
      LLM_RATE_LIMIT: 'El proveedor de IA está temporalmente limitado. Inténtalo de nuevo.',
      LLM_TIMEOUT: 'La lectura tardó demasiado. Inténtalo de nuevo.',
      LLM_INVALID_OUTPUT: 'El proveedor de IA no devolvió una lectura válida.',
    } as const;
    return { statusCode: statusByCode[error.code], code: error.code, message: messages[error.code] };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' };
}
