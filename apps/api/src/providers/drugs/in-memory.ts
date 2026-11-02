import { normalizeDrugName } from './normalize.js';
import type { DrugCatalog, DrugCatalogMatch } from './types.js';

export type InMemoryDrug = {
  commercialName: string;
  activeIngredient: string;
  synonyms?: string[];
};

export class InMemoryDrugCatalog implements DrugCatalog {
  constructor(private readonly drugs: InMemoryDrug[]) {}

  async find(name: string): Promise<DrugCatalogMatch | null> {
    const normalized = normalizeDrugName(name);
    let best: DrugCatalogMatch | null = null;

    for (const drug of this.drugs) {
      const candidates = [drug.commercialName, ...(drug.synonyms ?? [])].map(normalizeDrugName);
      const exact = candidates.includes(normalized);
      const score = exact ? 1 : Math.max(...candidates.map((candidate) => similarity(normalized, candidate)));
      if (best === null || score > best.score) {
        best = { commercialName: drug.commercialName, activeIngredient: drug.activeIngredient, score, exact };
      }
    }

    return best && best.score >= 0.35 ? best : null;
  }
}

function similarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union === 0 ? 0 : intersection / union;
  const editScore = 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  return editScore * 0.7 + tokenScore * 0.3;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex] ?? 0;
      const replacement = diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      previous[rightIndex] = Math.min((previous[rightIndex - 1] ?? 0) + 1, above + 1, replacement);
      diagonal = above;
    }
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}
