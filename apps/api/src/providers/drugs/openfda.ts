import type { ExternalDrugMatch, DrugFallback } from './types.js';

type OpenFdaResponse = {
  results?: Array<{
    openfda?: { generic_name?: string[]; brand_name?: string[] };
    active_ingredient?: string[];
  }>;
};

export class OpenFdaClient implements DrugFallback {
  private readonly baseUrl = 'https://api.fda.gov/drug/label.json';

  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly timeoutMs = 4_000) {}

  async find(name: string): Promise<ExternalDrugMatch | null> {
    const params = new URLSearchParams({ search: `active_ingredient:"${name}"`, limit: '1' });
    try {
      const response = await fetchWithTimeout(this.fetchImpl, `${this.baseUrl}?${params.toString()}`, this.timeoutMs);
      if (!response.ok) return null;
      const payload = (await response.json()) as OpenFdaResponse;
      const result = payload.results?.[0];
      const canonicalName = result?.openfda?.generic_name?.[0] ?? result?.active_ingredient?.[0] ?? result?.openfda?.brand_name?.[0];
      return canonicalName ? { canonicalName, score: 0.85, source: 'openfda' } : null;
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
