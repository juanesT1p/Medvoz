import { ValidatedPrescriptionSchema, type ExtractedItem, type ExtractedPrescription, type ValidatedPrescription } from '@medvoz/shared';
import type { DrugCatalog, DrugFallback } from '../providers/drugs/types.js';
import { normalizeDrugName } from '../providers/drugs/normalize.js';

export class DrugValidationService {
  constructor(
    private readonly localCatalog: DrugCatalog,
    private readonly fallbacks: DrugFallback[] = [],
  ) {}

  async validate(prescription: ExtractedPrescription): Promise<ValidatedPrescription> {
    const items = await Promise.all(prescription.items.map((item) => this.validateItem(item)));
    return ValidatedPrescriptionSchema.parse({ ...prescription, items });
  }

  private async validateItem(item: ExtractedItem) {
    const localMatch = await this.localCatalog.find(item.name);
    if (localMatch) {
      return {
        ...item,
        match: {
          status: localMatch.exact ? ('verified' as const) : ('probable' as const),
          canonicalName: localMatch.commercialName,
          source: 'local_catalog' as const,
        },
      };
    }

    for (const fallback of this.fallbacks) {
      const externalMatch = await fallback.find(item.activeIngredient ?? item.name);
      if (externalMatch) {
        return {
          ...item,
          match: {
            status: externalMatch.score >= 0.8 ? ('verified' as const) : ('probable' as const),
            canonicalName: externalMatch.canonicalName,
            source: externalMatch.source,
          },
        };
      }
    }

    return {
      ...item,
      match: {
        status: 'not_found' as const,
        canonicalName: null,
        source: null,
      },
    };
  }

  static isSafeToContinue(prescription: ValidatedPrescription): boolean {
    return prescription.items.every((item) => item.match.status === 'verified' && normalizeDrugName(item.name) !== '');
  }
}
