import 'dotenv/config';
import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const rawEnvSchema = z.object({
  LLM_PROVIDER: z.enum(['gemini', 'anthropic', 'mock']),
  LLM_MODEL: z.string().trim().min(1),
  LLM_EXTRACT_MODEL: optionalText,
  LLM_EXPLAIN_MODEL: optionalText,
  LLM_TIMEOUT_MS: z.coerce.number().int().positive(),
  GEMINI_API_KEY: z.string().trim().optional(),
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  DATABASE_URL: z.string().url(),
  TTS_PROVIDER: z.string().trim().min(1),
  TTS_API_KEY: z.string().trim().optional(),
  PORT: z.coerce.number().int().min(1).max(65_535),
  CORS_ORIGIN: z.string().url(),
  MAX_IMAGE_MB: z.coerce.number().positive().max(50),
});

export const envSchema = rawEnvSchema.superRefine((env, context) => {
  if (env.LLM_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['GEMINI_API_KEY'], message: 'Es obligatoria cuando LLM_PROVIDER=gemini.' });
  }

  if (env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['ANTHROPIC_API_KEY'], message: 'Es obligatoria cuando LLM_PROVIDER=anthropic.' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuración inválida: ${details}`);
  }

  return result.data;
}

export const env = loadEnv();
