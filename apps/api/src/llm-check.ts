import { ExplanationDraftSchema, ExtractedPrescriptionDraftSchema } from '@medvoz/shared';
import { env } from './config/env.js';
import { createLlmProvider } from './providers/llm/factory.js';

const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const provider = createLlmProvider(env);

await provider.generateStructured({
  task: 'explain',
  system: 'Devuelve únicamente una explicación breve válida en JSON. Esta es una prueba de conectividad.',
  userText: 'Responde con items=[] y audioScript="Prueba de conectividad.".',
  schema: ExplanationDraftSchema,
  maxOutputTokens: 256,
});

await provider.generateStructured({
  task: 'extract',
  system: 'Observa la imagen y devuelve una fórmula vacía válida en JSON. Esta es una prueba de conectividad.',
  image: { mimeType: 'image/png', data: testImage },
  schema: ExtractedPrescriptionDraftSchema,
  maxOutputTokens: 256,
});

console.log(`LLM disponible: ${provider.name}/${env.LLM_MODEL}`);
