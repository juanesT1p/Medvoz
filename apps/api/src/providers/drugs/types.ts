export type DrugKnowledge = {
  principioActivo: string;
  nombresComunes: string[];
  queEs: string;
  paraQueSuele: string;
  comoActua: string | null;
  precauciones: string[];
  senalesDeAlerta: string[];
  preguntasParaMedico: string[];
  fuente: string;
  revisadoPor: string;
};

export type DrugCatalogMatch = {
  commercialName: string;
  activeIngredient: string;
  score: number;
  exact: boolean;
  knowledge?: DrugKnowledge | null;
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
