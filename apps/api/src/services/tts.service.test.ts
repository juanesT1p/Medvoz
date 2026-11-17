import { describe, expect, it, vi } from 'vitest';
import { TtsAuthError } from '../providers/tts/errors.js';
import { OpenAiTtsProvider } from '../providers/tts/openai.js';
import { MockTtsProvider } from '../providers/tts/mock.js';
import { GeminiTtsProvider, pcmToWav } from '../providers/tts/gemini.js';
import { TtsService } from './tts.service.js';

describe('TtsService y OpenAiTtsProvider', () => {
  it('limita el guion y devuelve el audio del proveedor', async () => {
    const audio = await new TtsService(new MockTtsProvider()).synthesize('Texto corto para probar.');
    expect(audio.toString('ascii', 0, 3)).toBe('ID3');
  });

  it('normaliza unidades antes de llamar al proveedor', async () => {
    const synthesize = vi.fn(async (text: string) => {
      expect(text).toBe('quinientos miligramos por cada cinco mililitros');
      return Buffer.from([1, 2, 3]);
    });
    await new TtsService({ name: 'mock', contentType: 'audio/mpeg', synthesize }).synthesize('500 mg/5 ml');
    expect(synthesize).toHaveBeenCalledOnce();
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

  it('envuelve PCM crudo de Gemini en WAV', async () => {
    const pcm = Buffer.from([0, 1, 2, 3]);
    const provider = new GeminiTtsProvider({
      apiKey: 'test-key',
      client: { models: { generateContent: vi.fn(async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: pcm.toString('base64') } }] } }] })) } },
    });
    const audio = await provider.synthesize('Hola.');
    expect(audio.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(audio.length).toBe(44 + pcm.length);
    expect(audio.readUInt32LE(24)).toBe(24_000);
    expect(audio.subarray(44)).toEqual(pcm);
  });

  it('conserva un WAV que Gemini ya entrega con cabecera', async () => {
    const wav = pcmToWav(Buffer.from([4, 5]));
    const provider = new GeminiTtsProvider({
      apiKey: 'test-key',
      client: { models: { generateContent: vi.fn(async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: wav.toString('base64') } }] } }] })) } },
    });
    await expect(provider.synthesize('Hola.')).resolves.toEqual(wav);
  });
});
