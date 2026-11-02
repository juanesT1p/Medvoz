import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { MockProvider } from './providers/llm/mock.js';

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

describe('POST /api/prescriptions/extract', () => {
  it('procesa la imagen en memoria y devuelve una fórmula estructurada', async () => {
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const response = await request(
      createApp(
        { CORS_ORIGIN: 'http://localhost:5173', LLM_PROVIDER: 'mock', LLM_MODEL: 'mock', MAX_IMAGE_MB: 1 },
        { llmProvider: new MockProvider() },
      ),
    )
      .post('/api/prescriptions/extract')
      .attach('image', image, { filename: 'formula.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.isPrescription).toBe(true);
    expect(response.body.items[0].id).toEqual(expect.any(String));
  });

  it('rechaza una solicitud sin imagen', async () => {
    const response = await request(
      createApp({ CORS_ORIGIN: 'http://localhost:5173', LLM_PROVIDER: 'mock', LLM_MODEL: 'mock' }, { llmProvider: new MockProvider() }),
    ).post('/api/prescriptions/extract');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('IMAGE_REQUIRED');
  });

  it('rechaza tipos de archivo no permitidos', async () => {
    const response = await request(
      createApp({ CORS_ORIGIN: 'http://localhost:5173', LLM_PROVIDER: 'mock', LLM_MODEL: 'mock' }, { llmProvider: new MockProvider() }),
    )
      .post('/api/prescriptions/extract')
      .attach('image', Buffer.from('not an image'), { filename: 'formula.txt', contentType: 'text/plain' });

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
  });
});
