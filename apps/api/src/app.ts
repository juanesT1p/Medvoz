import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer, { MulterError } from 'multer';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { ExtractedPrescriptionSchema, HealthResponseSchema, ValidatedPrescriptionSchema } from '@medvoz/shared';
import type { Env } from './config/env.js';
import { ExtractionService } from './services/extraction.service.js';
import { createLlmProvider } from './providers/llm/factory.js';
import { LlmError } from './providers/llm/errors.js';
import type { LlmProvider } from './providers/llm/types.js';
import { HttpError } from './lib/http-error.js';
import { isAcceptedImageType, normalizeImage } from './lib/image.js';
import { DrugValidationService } from './services/drug-validation.service.js';
import { InMemoryDrugCatalog } from './providers/drugs/in-memory.js';
import type { DrugCatalog, DrugFallback } from './providers/drugs/types.js';
import { ExplanationService } from './services/explanation.service.js';
import { createTtsProvider } from './providers/tts/factory.js';
import { TtsError } from './providers/tts/errors.js';
import type { TtsProvider } from './providers/tts/types.js';
import { TtsService } from './services/tts.service.js';

type AppConfig = Pick<Env, 'CORS_ORIGIN' | 'LLM_PROVIDER' | 'LLM_MODEL'> &
  Partial<Pick<Env, 'MAX_IMAGE_MB' | 'LLM_EXTRACT_MODEL' | 'LLM_EXPLAIN_MODEL' | 'LLM_TIMEOUT_MS' | 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY' | 'TTS_PROVIDER' | 'TTS_API_KEY'>>;
type UsageEventRecorder = (event: { phase: string; success: boolean; latencyMs: number }) => Promise<void>;

export function createApp(config: AppConfig, dependencies: { llmProvider?: LlmProvider; drugCatalog?: DrugCatalog; drugFallbacks?: DrugFallback[]; ttsProvider?: TtsProvider; usageEventRecorder?: UsageEventRecorder } = {}) {
  const app = express();
  const logger = pino({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info', base: null });
  const maxImageMb = config.MAX_IMAGE_MB ?? 10;
  const llmProvider = dependencies.llmProvider ?? createDefaultProvider(config);
  const extractionService = new ExtractionService(llmProvider);
  const drugValidationService = new DrugValidationService(dependencies.drugCatalog ?? new InMemoryDrugCatalog([]), dependencies.drugFallbacks ?? []);
  const explanationService = new ExplanationService(llmProvider);
  const ttsService = new TtsService(dependencies.ttsProvider ?? createDefaultTtsProvider(config));
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
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Inténtalo más tarde.' } }),
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use((request, response, next) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
      const phase = phaseForPath(request.path);
      const latencyMs = Math.round(performance.now() - startedAt);
      logger.info({ requestId, method: request.method, path: request.path, statusCode: response.statusCode, latencyMs }, 'request');
      if (phase && dependencies.usageEventRecorder) {
        void dependencies.usageEventRecorder({ phase, success: response.statusCode < 400, latencyMs }).catch(() => undefined);
      }
    });
    next();
  });

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

  app.post('/api/prescriptions/validate', async (request, response, next) => {
    try {
      const parsed = ExtractedPrescriptionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new HttpError(400, 'INVALID_PRESCRIPTION', 'La lista de medicamentos no tiene un formato válido.');
      }
      const result = await drugValidationService.validate(parsed.data);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/prescriptions/explain', async (request, response, next) => {
    try {
      const parsed = ValidatedPrescriptionSchema.safeParse(request.body?.prescription ?? request.body);
      if (!parsed.success) {
        throw new HttpError(400, 'INVALID_VALIDATED_PRESCRIPTION', 'La fórmula validada no tiene un formato válido.');
      }
      const result = await explanationService.explain(parsed.data);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tts', async (request, response, next) => {
    try {
      const audioScript = request.body?.audioScript;
      if (typeof audioScript !== 'string' || !audioScript.trim()) {
        throw new HttpError(400, 'INVALID_AUDIO_SCRIPT', 'Debes enviar un guion de audio válido.');
      }
      if (audioScript.trim().split(/\s+/).length > 250) {
        throw new HttpError(400, 'AUDIO_SCRIPT_TOO_LONG', 'El guion de audio no puede superar 250 palabras.');
      }
      const audio = await ttsService.synthesize(audioScript);
      response.status(200).type('audio/mpeg').set('Cache-Control', 'no-store').set('Content-Length', String(audio.length)).send(audio);
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

function phaseForPath(path: string): string | null {
  if (path.endsWith('/extract')) return 'extract';
  if (path.endsWith('/validate')) return 'validate';
  if (path.endsWith('/explain')) return 'explain';
  if (path === '/api/tts') return 'tts';
  return null;
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

function createDefaultTtsProvider(config: AppConfig): TtsProvider {
  return createTtsProvider({
    TTS_PROVIDER: config.TTS_PROVIDER ?? 'browser',
    TTS_API_KEY: config.TTS_API_KEY,
    LLM_TIMEOUT_MS: config.LLM_TIMEOUT_MS ?? 30_000,
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

  if (error instanceof TtsError) {
    const statusByCode = { TTS_AUTH: 502, TTS_TIMEOUT: 504, TTS_UNAVAILABLE: 503, TTS_INVALID_OUTPUT: 502 } as const;
    const messages = {
      TTS_AUTH: 'No se pudo autenticar con el proveedor de audio.',
      TTS_TIMEOUT: 'La generación de audio tardó demasiado.',
      TTS_UNAVAILABLE: 'No se pudo generar audio. Puedes usar la voz del navegador.',
      TTS_INVALID_OUTPUT: 'El guion de audio no es válido.',
    } as const;
    return { statusCode: statusByCode[error.code], code: error.code, message: messages[error.code] };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' };
}
