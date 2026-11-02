import {
  ExplanationDraftSchema,
  ExplanationSchema,
  type Explanation,
  type ExplanationItem,
  type ValidatedItem,
  type ValidatedPrescription,
} from '@medvoz/shared';
import { FIXED_EXPLANATION_DISCLAIMER, explainPrescriptionSystemPrompt } from '../prompts/explain.js';
import type { LlmProvider } from '../providers/llm/types.js';

export class ExplanationService {
  constructor(private readonly llmProvider: LlmProvider) {}

  async explain(prescription: ValidatedPrescription): Promise<Explanation> {
    const response = await this.llmProvider.generateStructured({
      task: 'explain',
      system: explainPrescriptionSystemPrompt,
      userText: JSON.stringify({
        isPrescription: prescription.isPrescription,
        items: prescription.items.map(({ id, rawText, name, activeIngredient, strength, form, dose, frequency, duration, route, instructions, match }) => ({
          id,
          rawText,
          name,
          activeIngredient,
          strength,
          form,
          dose,
          frequency,
          duration,
          route,
          instructions,
          match,
        })),
        documentWarnings: prescription.documentWarnings,
      }),
      schema: ExplanationDraftSchema,
      temperature: 0.2,
      maxOutputTokens: 1_500,
    });

    const items = prescription.items.map((item, index) => sanitizeItem(response.data.items[index], item));
    const audioScript = buildSafeAudioScript(prescription.items, items);
    return ExplanationSchema.parse({ items, audioScript, disclaimer: FIXED_EXPLANATION_DISCLAIMER });
  }
}

function sanitizeItem(generated: ExplanationItem | undefined, prescriptionItem: ValidatedItem): ExplanationItem {
  const safePurpose = prescriptionItem.match.status === 'verified' && generated && isGeneratedTextSafe(generated.purpose, prescriptionItem)
    ? generated.purpose
    : prescriptionItem.match.status === 'verified'
      ? 'La fórmula no indica para qué se usa este medicamento.'
      : 'El nombre de este medicamento debe confirmarse con un médico o farmacéutico antes de explicar para qué se usa.';
  const safeWarnings = (generated?.commonWarnings ?? []).filter((warning) => isGeneratedTextSafe(warning, prescriptionItem)).slice(0, 5);
  const safeQuestions = (generated?.askDoctorIf ?? []).filter((question) => isGeneratedTextSafe(question, prescriptionItem)).slice(0, 5);
  const howToTakeAsPrescribed = buildPrescriptionInstructions(prescriptionItem);

  return {
    itemId: prescriptionItem.id,
    purpose: safePurpose,
    howToTakeAsPrescribed,
    commonWarnings: safeWarnings.length > 0 ? safeWarnings : ['Si tienes dudas sobre esta fórmula, consulta a tu médico o farmacéutico.'],
    askDoctorIf: safeQuestions.length > 0 ? safeQuestions : ['Consulta al médico o farmacéutico si algo de la fórmula no coincide con lo que te indicaron.'],
  };
}

function buildPrescriptionInstructions(item: ValidatedItem): string {
  const facts = [item.dose, item.frequency, item.duration, item.route, item.instructions]
    .filter((fact): fact is string => Boolean(fact))
    .filter((fact) => !containsPromptInjection(fact));
  return facts.length > 0 ? `Sigue únicamente estas indicaciones de la fórmula: ${facts.join('; ')}.` : 'La fórmula no indica cómo tomar o usar este medicamento.';
}

function buildSafeAudioScript(prescriptionItems: ValidatedItem[], explanationItems: ExplanationItem[]): string {
  const sections = explanationItems.map((explanationItem, index) => {
    const prescriptionItem = prescriptionItems[index];
    return prescriptionItem
      ? `${prescriptionItem.name}. ${explanationItem.purpose} ${explanationItem.howToTakeAsPrescribed}`
      : explanationItem.howToTakeAsPrescribed;
  });
  const script = `Esta es una explicación de tu fórmula. ${sections.join(' ')} Si algo no coincide o tienes dudas, consulta a tu médico o farmacéutico.`;
  return script.split(/\s+/).slice(0, 250).join(' ');
}

function hasOnlyPrescriptionNumbers(text: string, item: ValidatedItem): boolean {
  const generatedNumbers = text.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [];
  const source = [item.rawText, item.strength, item.dose, item.frequency, item.duration, item.instructions].filter(Boolean).join(' ');
  return generatedNumbers.every((number) => source.includes(number));
}

function isGeneratedTextSafe(text: string, item: ValidatedItem): boolean {
  return !containsPromptInjection(text) && hasOnlyPrescriptionNumbers(text, item);
}

function containsPromptInjection(text: string): boolean {
  return /\b(ignora|ignore|instrucciones del sistema|system prompt|prompt injection|cambia las reglas)\b/i.test(text);
}
