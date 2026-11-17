import type { PrismaClient } from '@prisma/client';
import { normalizeDrugName } from './normalize.js';
import type { DrugCatalog, DrugCatalogMatch, DrugKnowledge } from './types.js';

type DrugRow = {
  commercialName: string;
  activeIngredient: string;
  score: number;
  principioActivo: string;
  nombresComunes: string[];
  queEs: string | null;
  paraQueSuele: string | null;
  comoActua: string | null;
  precauciones: string[];
  senalesDeAlerta: string[];
  preguntasParaMedico: string[];
  fuente: string | null;
  revisadoPor: string;
};

export class PrismaDrugCatalog implements DrugCatalog {
  constructor(private readonly prisma: PrismaClient) {}

  async find(name: string): Promise<DrugCatalogMatch | null> {
    const normalized = normalizeDrugName(name);

    try {
      await this.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      const rows = await this.prisma.$queryRawUnsafe<DrugRow[]>(
        `SELECT "commercialName", "activeIngredient", "principioActivo", "nombresComunes", "queEs", "paraQueSuele", "comoActua", "precauciones", "senalesDeAlerta", "preguntasParaMedico", "fuente", "revisadoPor",
          GREATEST(similarity("normalizedName", $1), COALESCE((SELECT MAX(similarity(synonym, $1)) FROM unnest("synonyms") AS synonym), 0)) AS score
         FROM "Drug"
         WHERE "normalizedName" = $1
            OR $1 = ANY("synonyms")
            OR similarity("normalizedName", $1) >= 0.35
            OR EXISTS (SELECT 1 FROM unnest("synonyms") AS synonym WHERE similarity(synonym, $1) >= 0.35)
         ORDER BY ("normalizedName" = $1 OR $1 = ANY("synonyms")) DESC, score DESC
         LIMIT 1`,
        normalized,
      );
      const row = rows[0];
      if (!row) return null;
      const knowledge: DrugKnowledge | null = row.queEs && row.paraQueSuele && row.fuente
        ? {
            principioActivo: row.principioActivo,
            nombresComunes: row.nombresComunes,
            queEs: row.queEs,
            paraQueSuele: row.paraQueSuele,
            comoActua: row.comoActua,
            precauciones: row.precauciones,
            senalesDeAlerta: row.senalesDeAlerta,
            preguntasParaMedico: row.preguntasParaMedico,
            fuente: row.fuente,
            revisadoPor: row.revisadoPor,
          }
        : null;
      return { commercialName: row.commercialName, activeIngredient: row.activeIngredient, score: Number(row.score), exact: Number(row.score) >= 0.9999, knowledge };
    } catch {
      return null;
    }
  }
}
