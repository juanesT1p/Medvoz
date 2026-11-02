import type { ExternalDrugMatch, DrugFallback } from './types.js';

type RxNormResponse = {
  approximateGroup?: { candidate?: Array<{ rxcui?: string; rank?: string; name?: string; score?: string }> };
};

export class RxNormClient implements DrugFallback {
  private readonly baseUrl = 'https://rxnav.nlm.nih.gov/REST/approximateTerm.json';

  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly timeoutMs = 4_000) {}

  async find(name: string): Promise<ExternalDrugMatch | null> {
    const url = `${this.baseUrl}?term=${encodeURIComponent(name)}&maxEntries=5`;
    try {
      const response = await fetchWithTimeout(this.fetchImpl, url, this.timeoutMs);
      if (!response.ok) return null;
      const payload = (await response.json()) as RxNormResponse;
      const candidate = payload.approximateGroup?.candidate?.[0];
      if (!candidate?.name) return null;
      const score = candidate.score ? Math.min(Number(candidate.score) / 100, 1) : 0.8;
      return { canonicalName: candidate.name, score, source: 'rxnorm' };
    } catch {
      return null;
    }
  }
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
