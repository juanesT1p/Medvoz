import { randomUUID } from 'node:crypto';
import { ExtractedPrescriptionDraftSchema, ExtractedPrescriptionSchema, type ExtractedPrescription } from '@medvoz/shared';
import { extractPrescriptionSystemPrompt } from '../prompts/extract.js';
import type { LlmProvider } from '../providers/llm/types.js';

export class ExtractionService {
  constructor(private readonly llmProvider: LlmProvider) {}

  async extract(image: { mimeType: string; data: Buffer }): Promise<ExtractedPrescription> {
    const result = await this.llmProvider.generateStructured({
      task: 'extract',
      system: extractPrescriptionSystemPrompt,
      image,
      schema: ExtractedPrescriptionDraftSchema,
      temperature: 0.1,
      maxOutputTokens: 1_024,
    });

    const prescription = {
      ...result.data,
      items: result.data.items.map((item) => ({ ...item, id: randomUUID() })),
    };

    return ExtractedPrescriptionSchema.parse(prescription);
  }
}
