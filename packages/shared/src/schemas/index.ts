import { z } from 'zod';

const nullableText = z.string().trim().min(1).nullable();

export const ExtractedItemSchema = z.object({
  id: z.string().uuid(),
  rawText: z.string(),
  name: z.string().trim().min(1),
  activeIngredient: nullableText,
  strength: nullableText,
  form: nullableText,
  dose: nullableText,
  frequency: nullableText,
  duration: nullableText,
  route: nullableText,
  instructions: nullableText,
  dosisValor: z.number().finite().nullable().optional(),
  dosisUnidad: nullableText.optional(),
  confidence: z.number().min(0).max(1),
  legibility: z.enum(['clear', 'uncertain', 'illegible']),
});

export const ExtractedItemDraftSchema = ExtractedItemSchema.omit({ id: true });

export const ExtractedPrescriptionSchema = z.object({
  isPrescription: z.boolean(),
  items: z.array(ExtractedItemSchema),
  documentWarnings: z.array(z.string()),
});

export const ExtractedPrescriptionDraftSchema = ExtractedPrescriptionSchema.extend({
  items: z.array(ExtractedItemDraftSchema),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type ExtractedItemDraft = z.infer<typeof ExtractedItemDraftSchema>;
export type ExtractedPrescription = z.infer<typeof ExtractedPrescriptionSchema>;
export type ExtractedPrescriptionDraft = z.infer<typeof ExtractedPrescriptionDraftSchema>;

export const DrugMatchSchema = z.object({
  status: z.enum(['verified', 'probable', 'not_found']),
  canonicalName: z.string().trim().min(1).nullable(),
  source: z.enum(['local_catalog', 'rxnorm', 'openfda']).nullable(),
  knowledge: z.object({
    principioActivo: nullableText,
    nombresComunes: z.array(z.string().trim().min(1)),
    queEs: z.string().trim().min(1),
    paraQueSuele: z.string().trim().min(1),
    comoActua: nullableText,
    precauciones: z.array(z.string().trim().min(1)),
    senalesDeAlerta: z.array(z.string().trim().min(1)),
    preguntasParaMedico: z.array(z.string().trim().min(1)),
    fuente: z.string().url(),
    revisadoPor: z.string().trim().min(1),
  }).nullable().optional(),
});

export const ValidatedItemSchema = ExtractedItemSchema.extend({
  match: DrugMatchSchema,
});

export const ValidatedPrescriptionSchema = z.object({
  isPrescription: z.boolean(),
  items: z.array(ValidatedItemSchema),
  documentWarnings: z.array(z.string()),
});

export type DrugMatch = z.infer<typeof DrugMatchSchema>;
export type ValidatedItem = z.infer<typeof ValidatedItemSchema>;
export type ValidatedPrescription = z.infer<typeof ValidatedPrescriptionSchema>;

export const ExplanationItemSchema = z.object({
  itemId: z.string().uuid(),
  nombreMostrado: z.string().trim().min(1),
  principioActivo: nullableText.optional(),
  queEs: z.string().trim().min(1),
  paraQueSuele: z.string().trim().min(1),
  comoSeAdministra: z.string().trim().min(1),
  frecuenciaYDuracion: z.string().trim().min(1),
  precauciones: z.array(z.string().trim().min(1)).min(1),
  senalesDeAlerta: z.array(z.string().trim().min(1)).min(1),
  preguntasParaMedico: z.array(z.string().trim().min(1)).min(1),
  origen: z.enum(['catalogo', 'ia_general', 'no_identificado']),
  requiereVerificacion: z.boolean(),
  ambiguedades: z.array(z.string().trim().min(1)),
});

export const ExplanationDraftSchema = z.object({
  resumenGeneral: z.string().trim().min(1),
  items: z.array(ExplanationItemSchema),
});

export const ExplanationSchema = ExplanationDraftSchema.extend({
  introduccion: z.string().trim().min(1),
  cierreSeguridad: z.string().trim().min(1),
  notaInyectables: z.string().trim().min(1).optional(),
  audioScript: z.string().trim().min(1),
  audioChunks: z.array(z.string().trim().min(1)).min(1),
});

export type ExplanationItem = z.infer<typeof ExplanationItemSchema>;
export type ExplanationDraft = z.infer<typeof ExplanationDraftSchema>;
export type Explanation = z.infer<typeof ExplanationSchema>;

export const GeneralMedicationDraftSchema = z.object({
  queEs: z.string().trim().min(1),
  paraQueSuele: z.string().trim().min(1),
  precauciones: z.array(z.string().trim().min(1)).min(1),
  senalesDeAlerta: z.array(z.string().trim().min(1)).min(1),
  preguntasParaMedico: z.array(z.string().trim().min(1)).min(1),
});

export type GeneralMedicationDraft = z.infer<typeof GeneralMedicationDraftSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  llmProvider: z.string().min(1),
  llmModel: z.string().min(1),
});

export const TtsRequestSchema = z.object({
  audioScript: z.string().trim().min(1),
});

export type TtsRequest = z.infer<typeof TtsRequestSchema>;

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
