import { ExtractedPrescriptionDraftSchema } from '@medvoz/shared';
import { env } from './config/env.js';
import { createLlmProvider } from './providers/llm/factory.js';

const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const provider = createLlmProvider(env);

await provider.generateStructured({
  task: 'explain',
  system: 'Devuelve una fórmula vacía válida en JSON. Esta es una prueba de conectividad.',
  userText: 'Prueba de texto. Responde con isPrescription=false, items=[] y documentWarnings=[].',
  schema: ExtractedPrescriptionDraftSchema,
  maxOutputTokens: 16,
});

await provider.generateStructured({
  task: 'extract',
  system: 'Observa la imagen y devuelve una fórmula vacía válida en JSON. Esta es una prueba de conectividad.',
  image: { mimeType: 'image/png', data: testImage },
  schema: ExtractedPrescriptionDraftSchema,
  maxOutputTokens: 16,
});

console.log(`LLM disponible: ${provider.name}/${env.LLM_MODEL}`);
