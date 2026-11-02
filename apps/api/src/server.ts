import { env } from './config/env.js';
import { createApp } from './app.js';
import { PrismaClient } from '@prisma/client';
import { PrismaDrugCatalog } from './providers/drugs/prisma-catalog.js';
import { OpenFdaClient } from './providers/drugs/openfda.js';
import { RxNormClient } from './providers/drugs/rxnorm.js';
import { createLlmProvider } from './providers/llm/factory.js';
import { createTtsProvider } from './providers/tts/factory.js';

const prisma = new PrismaClient();
const app = createApp(env, {
  llmProvider: createLlmProvider(env),
  ttsProvider: createTtsProvider(env),
  drugCatalog: new PrismaDrugCatalog(prisma),
  drugFallbacks: [new RxNormClient(), new OpenFdaClient()],
});

app.listen(env.PORT, () => {
  console.log(`MedVoz API escuchando en http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
