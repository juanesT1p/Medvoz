import { describe, expect, it, vi } from 'vitest';
import { TtsAuthError } from '../providers/tts/errors.js';
import { OpenAiTtsProvider } from '../providers/tts/openai.js';
import { MockTtsProvider } from '../providers/tts/mock.js';
import { TtsService } from './tts.service.js';

describe('TtsService y OpenAiTtsProvider', () => {
  it('limita el guion y devuelve el audio del proveedor', async () => {
    const audio = await new TtsService(new MockTtsProvider()).synthesize('Texto corto para probar.');
    expect(audio.toString('ascii', 0, 3)).toBe('ID3');
  });

  it('envía texto y formato MP3 al endpoint cloud', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string; input: string; response_format: string };
      expect(body.model).toBe('gpt-4o-mini-tts');
      expect(body.input).toBe('Hola desde MedVoz.');
      expect(body.response_format).toBe('mp3');
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const audio = await new OpenAiTtsProvider({ apiKey: 'test-key', fetchImpl: fetchMock }).synthesize('Hola desde MedVoz.');
    expect(audio).toEqual(Buffer.from([1, 2, 3]));
  });

  it('normaliza un error de autenticación cloud', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(new OpenAiTtsProvider({ apiKey: 'bad-key', fetchImpl: fetchMock }).synthesize('Hola.')).rejects.toBeInstanceOf(TtsAuthError);
  });
});
