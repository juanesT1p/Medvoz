import cors from 'cors';
import express from 'express';
import { HealthResponseSchema } from '@medvoz/shared';
import type { Env } from './config/env.js';

export function createApp(config: Pick<Env, 'CORS_ORIGIN' | 'LLM_PROVIDER' | 'LLM_MODEL'>) {
  const app = express();

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

  return app;
}
