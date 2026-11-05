import { describe, expect, it } from 'vitest';
import { InMemoryDrugCatalog } from '../providers/drugs/in-memory.js';
import { DrugValidationService } from './drug-validation.service.js';
import type { ExtractedPrescription } from '@medvoz/shared';

const prescription = (name: string): ExtractedPrescription => ({
  isPrescription: true,
  items: [{
    id: '11111111-1111-4111-8111-111111111111',
    rawText: name,
    name,
    activeIngredient: null,
    strength: null,
    form: null,
    dose: null,
    frequency: null,
    duration: null,
    route: null,
    instructions: null,
    confidence: 1,
    legibility: 'clear',
  }],
  documentWarnings: [],
});

describe('DrugValidationService', () => {
  const catalog = new InMemoryDrugCatalog([{ commercialName: 'Amoxicilina', activeIngredient: 'amoxicilina', synonyms: ['amoxicillin'] }]);

  it('verifica coincidencias exactas y sinónimos', async () => {
    const result = await new DrugValidationService(catalog).validate(prescription('amoxicillin'));
    expect(result.items[0]?.activeIngredient).toBe('amoxicilina');
    expect(result.items[0]?.match).toEqual({ status: 'verified', canonicalName: 'Amoxicilina', source: 'local_catalog' });
  });

  it('marca un error tipográfico como probable', async () => {
    const result = await new DrugValidationService(catalog).validate(prescription('amoxicilna'));
    expect(result.items[0]?.match.status).toBe('probable');
  });

  it('marca un nombre inexistente y tolera fallas de los respaldos', async () => {
    const fallback = { find: async () => null };
    const result = await new DrugValidationService(catalog, [fallback]).validate(prescription('medicamento inexistente'));
    expect(result.items[0]?.match).toEqual({ status: 'not_found', canonicalName: null, source: null });
  });

  it('usa un respaldo externo cuando el catálogo local no encuentra el nombre', async () => {
    const fallback = { find: async () => ({ canonicalName: 'Ibuprofen', score: 0.9, source: 'rxnorm' as const }) };
    const result = await new DrugValidationService(catalog, [fallback]).validate(prescription('ibuprofeno'));
    expect(result.items[0]?.match).toEqual({ status: 'verified', canonicalName: 'Ibuprofen', source: 'rxnorm' });
  });
});
