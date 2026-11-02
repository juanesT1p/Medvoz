import { describe, expect, it } from 'vitest';
import { ExtractedPrescriptionSchema } from '@medvoz/shared';
import { ExtractionService } from './extraction.service.js';
import { MockProvider } from '../providers/llm/mock.js';

describe('ExtractionService', () => {
  it('agrega ids UUID en backend y conserva null cuando no está indicado', async () => {
    const result = await new ExtractionService(
      new MockProvider([
        JSON.stringify({
          isPrescription: true,
          items: [
            {
              rawText: 'Medicamento',
              name: 'Medicamento',
              activeIngredient: null,
              strength: null,
              form: null,
              dose: null,
              frequency: null,
              duration: null,
              route: null,
              instructions: null,
              confidence: 0.5,
              legibility: 'uncertain',
            },
          ],
          documentWarnings: ['imagen borrosa'],
        }),
      ]),
    ).extract({ mimeType: 'image/jpeg', data: Buffer.from('image') });

    expect(ExtractedPrescriptionSchema.parse(result)).toEqual(result);
    expect(result.items[0]?.id).toMatch(/[0-9a-f-]{36}/);
    expect(result.items[0]?.dose).toBeNull();
  });
});
