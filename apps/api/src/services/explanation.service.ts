import {
  GeneralMedicationDraftSchema,
  ExplanationSchema,
  interpretFrequency,
  interpretInstruction,
  toSpokenText,
  toSpokenScheduleNumbers,
  type Explanation,
  type ExplanationItem,
  type GeneralMedicationDraft,
  type ValidatedItem,
  type ValidatedPrescription,
} from '@medvoz/shared';
import {
  FIXED_EXPLANATION_CLOSING,
  FIXED_EXPLANATION_INTRODUCTION,
  FIXED_INJECTABLE_NOTE,
  generalMedicationSystemPrompt,
} from '../prompts/explain.js';
import type { LlmProvider } from '../providers/llm/types.js';

export class ExplanationService {
  constructor(private readonly llmProvider: LlmProvider) {}

  async explain(prescription: ValidatedPrescription): Promise<Explanation> {
    const generated = await Promise.all(prescription.items.map((item) => this.generateGeneralInformation(item)));
    const items = prescription.items.map((item, index) => buildExplanationItem(item, generated[index]));
    const hasInjectable = prescription.items.some((item) => isInjectableRoute(item.route));
    const audioChunks = buildAudioChunks(items, hasInjectable);

    return ExplanationSchema.parse({
      introduccion: FIXED_EXPLANATION_INTRODUCTION,
      resumenGeneral: buildSummary(prescription.items.length),
      items,
      cierreSeguridad: FIXED_EXPLANATION_CLOSING,
      ...(hasInjectable ? { notaInyectables: FIXED_INJECTABLE_NOTE } : {}),
      audioScript: audioChunks.join(' '),
      audioChunks,
    });
  }

  private async generateGeneralInformation(item: ValidatedItem): Promise<GeneralMedicationDraft | null> {
    if (item.match.knowledge || item.match.status === 'not_found' || !item.match.canonicalName) return null;

    try {
      const response = await this.llmProvider.generateStructured({
        task: 'explain',
        system: generalMedicationSystemPrompt,
        userText: JSON.stringify({
          nombre: item.match.canonicalName,
          principioActivo: item.activeIngredient,
          fuenteValidacion: item.match.source,
        }),
        schema: GeneralMedicationDraftSchema,
        temperature: 0.1,
        maxOutputTokens: 700,
      });
      return isSafeGeneralDraft(response.data) ? response.data : null;
    } catch {
      return null;
    }
  }
}

export const FIXED_EXPLANATION_DISCLAIMER = FIXED_EXPLANATION_CLOSING;

function buildExplanationItem(item: ValidatedItem, generated: GeneralMedicationDraft | null | undefined): ExplanationItem {
  const administration = buildAdministration(item);
  const timing = buildFrequencyAndDuration(item);
  const ambiguedades = [...new Set([...administration.ambiguedades, ...timing.ambiguedades])];
  const knowledge = item.match.knowledge;

  if (knowledge) {
    return {
      itemId: item.id,
      nombreMostrado: item.match.canonicalName ?? item.name,
      principioActivo: knowledge.principioActivo,
      queEs: knowledge.queEs,
      paraQueSuele: knowledge.paraQueSuele,
      comoSeAdministra: administration.legible,
      frecuenciaYDuracion: timing.legible,
      precauciones: knowledge.precauciones.length > 0 ? knowledge.precauciones : ['Confirma las precauciones con un profesional de la salud.'],
      senalesDeAlerta: knowledge.senalesDeAlerta.length > 0 ? knowledge.senalesDeAlerta : ['Consulta si notas una reacción inesperada.'],
      preguntasParaMedico: knowledge.preguntasParaMedico.length > 0 ? knowledge.preguntasParaMedico : ['¿Qué debo vigilar con este medicamento?'],
      origen: 'catalogo',
      requiereVerificacion: knowledge.revisadoPor === 'pendiente' || ambiguedades.length > 0,
      ambiguedades,
    };
  }

  if (generated) {
    return {
      itemId: item.id,
      nombreMostrado: item.match.canonicalName ?? item.name,
      principioActivo: item.activeIngredient,
      queEs: generated.queEs,
      paraQueSuele: generated.paraQueSuele,
      comoSeAdministra: administration.legible,
      frecuenciaYDuracion: timing.legible,
      precauciones: generated.precauciones,
      senalesDeAlerta: generated.senalesDeAlerta,
      preguntasParaMedico: generated.preguntasParaMedico,
      origen: 'ia_general',
      requiereVerificacion: true,
      ambiguedades,
    };
  }

  return {
    itemId: item.id,
    nombreMostrado: item.name,
    principioActivo: item.activeIngredient,
    queEs: 'No pudimos reconocer este medicamento con certeza.',
    paraQueSuele: 'Revisa el nombre en tu fórmula y pregunta a tu médico o farmacéutico para qué se usa.',
    comoSeAdministra: administration.legible,
    frecuenciaYDuracion: timing.legible,
    precauciones: ['No es posible ofrecer precauciones específicas sin confirmar el medicamento.'],
    senalesDeAlerta: ['Consulta a un profesional si recibes una indicación que no coincide con tu fórmula.'],
    preguntasParaMedico: ['¿Puedes confirmar el nombre y para qué se usa este medicamento?'],
    origen: 'no_identificado',
    requiereVerificacion: true,
    ambiguedades,
  };
}

function buildAdministration(item: ValidatedItem): { legible: string; ambiguedades: string[] } {
  const facts: string[] = [];
  if (item.dose && !containsPromptInjection(item.dose)) facts.push(interpretInstruction(item.dose).legible);
  if (item.form) facts.push(item.form.toLowerCase());
  if (item.route) facts.push(routeToPlainSpanish(item.route));
  if (item.instructions && !containsPromptInjection(item.instructions)) facts.push(interpretInstruction(item.instructions).legible);

  const interpretedInstructions = item.instructions && !containsPromptInjection(item.instructions) ? interpretInstruction(item.instructions) : { legible: '', ambiguedades: [] };
  return {
    legible: facts.length > 0 ? `${facts.join('. ')}.` : 'La fórmula no indica cómo se administra. Confirma este dato con tu médico o farmacéutico.',
    ambiguedades: interpretedInstructions.ambiguedades,
  };
}

function buildFrequencyAndDuration(item: ValidatedItem): { legible: string; ambiguedades: string[] } {
  const frequency = item.frequency && !containsPromptInjection(item.frequency) ? interpretFrequency(item.frequency, 'frequency') : { legible: '', ambiguedades: [] };
  const duration = item.duration && !containsPromptInjection(item.duration) ? interpretFrequency(item.duration, 'duration') : { legible: '', ambiguedades: [] };
  const parts = [
    frequency.legible ? `Frecuencia: ${frequency.legible}` : null,
    item.duration ? `Duración: ${duration.legible}` : null,
  ].filter((part): part is string => Boolean(part));
  return {
    legible: parts.length > 0 ? `${parts.join('. ')}.` : 'La fórmula no indica frecuencia ni duración. Confirma estos datos con tu médico o farmacéutico.',
    ambiguedades: [...frequency.ambiguedades, ...duration.ambiguedades],
  };
}

function buildAudioChunks(items: ExplanationItem[], hasInjectable: boolean): string[] {
  const blocks = items.map((item) => {
    const verification = item.requiereVerificacion ? ' Pide a tu médico o farmacéutico que confirme este dato.' : '';
    const administration = item.ambiguedades.length > 0 ? 'La fórmula contiene un dato de administración que debe confirmarse.' : item.comoSeAdministra;
    return `${item.nombreMostrado}. Para qué suele usarse: ${item.paraQueSuele}. ${administration} ${item.frecuenciaYDuracion} Precaución: ${item.precauciones[0] ?? 'confirma las precauciones con un profesional.'}${verification}`;
  });
  const injectableNote = hasInjectable ? ` ${FIXED_INJECTABLE_NOTE}` : '';
  return [FIXED_EXPLANATION_INTRODUCTION, ...blocks, `${injectableNote} ${FIXED_EXPLANATION_CLOSING}`]
    .map((chunk) => toSpokenScheduleNumbers(toSpokenText(chunk)).trim())
    .filter(Boolean);
}

function buildSummary(count: number): string {
  const noun = count === 1 ? 'medicamento o producto' : 'medicamentos o productos';
  return `Tu fórmula contiene ${count} ${noun}. Esta guía separa la información general de las instrucciones que aparecen en la fórmula. Revisa cada dato y consulta a un profesional antes de tomar decisiones sobre tu tratamiento.`;
}

function routeToPlainSpanish(route: string): string {
  const normalized = route.trim().toLowerCase();
  if (/endovenosa|intravenosa|\bev\b|\biv\b/.test(normalized)) return 'por la vena';
  if (/intramuscular|\bim\b/.test(normalized)) return 'en el músculo';
  if (/subcutánea|subcutanea|\bsc\b/.test(normalized)) return 'por una vía que requiere confirmación';
  if (/oral|boca|\bvo\b/.test(normalized)) return 'por la boca';
  return route;
}

function isInjectableRoute(route: string | null): boolean {
  return Boolean(route && /endovenosa|intravenosa|inyectable|\bev\b|\biv\b|intramuscular|\bim\b|subcutánea|subcutanea|\bsc\b/i.test(route));
}

function isSafeGeneralDraft(draft: GeneralMedicationDraft): boolean {
  return [draft.queEs, draft.paraQueSuele, ...draft.precauciones, ...draft.senalesDeAlerta, ...draft.preguntasParaMedico]
    .every((text) => !containsUnsafeInstruction(text) && !/\b\d+(?:[.,]\d+)?\b/.test(text));
}

function containsUnsafeInstruction(text: string): boolean {
  return /\b(?:puedes|puede|debes|debe|aumenta|aumente|disminuye|disminuya|suspende|suspenda|combina|combine|inicia|inicie)\s+(?:tomar\w*|usar\w*|la dosis|el tratamiento|medicamentos?)\b|\b(?:toma|tome)\s+\d|\b(?:cambia|cambie)\s+(?:la dosis|el tratamiento)\b/i.test(text);
}

function containsPromptInjection(text: string): boolean {
  return /\b(ignora|ignore|instrucciones del sistema|system prompt|prompt injection|cambia las reglas)\b/i.test(text);
}
