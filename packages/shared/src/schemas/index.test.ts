import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './index.js';

describe('HealthResponseSchema', () => {
  it('acepta la respuesta pública del endpoint de salud', () => {
    expect(
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        llmProvider: 'mock',
        llmModel: 'mock',
      }),
    ).toMatchObject({ status: 'ok', service: 'api' });
  });
});
