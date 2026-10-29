import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /health', () => {
  it('devuelve el estado y la configuración pública activa', async () => {
    const response = await request(
      createApp({ CORS_ORIGIN: 'http://localhost:5173', LLM_PROVIDER: 'mock', LLM_MODEL: 'mock' }),
    ).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'api',
      llmProvider: 'mock',
      llmModel: 'mock',
    });
    expect(JSON.stringify(response.body)).not.toContain('API_KEY');
  });
});
