export type DrugCatalogMatch = {
  commercialName: string;
  activeIngredient: string;
  score: number;
  exact: boolean;
};

export interface DrugCatalog {
  find(name: string): Promise<DrugCatalogMatch | null>;
}

export type ExternalDrugMatch = {
  canonicalName: string;
  score: number;
  source: 'rxnorm' | 'openfda';
};

export interface DrugFallback {
  find(name: string): Promise<ExternalDrugMatch | null>;
}
