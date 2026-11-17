export type GlossaryEntry = {
  abreviatura: string;
  expansion: string;
  ambigua: boolean;
  contexto?: string;
};

export type InstructionInterpretation = {
  legible: string;
  ambiguedades: string[];
};

export type FrequencyOrigin = 'frequency' | 'duration' | 'unknown';

export const PRESCRIPTION_GLOSSARY: readonly GlossaryEntry[] = [
  { abreviatura: 'GR', expansion: 'gramos', ambigua: false },
  { abreviatura: 'GRS', expansion: 'gramos', ambigua: false },
  { abreviatura: 'MG', expansion: 'miligramos', ambigua: false },
  { abreviatura: 'MCG', expansion: 'microgramos', ambigua: false },
  { abreviatura: 'ML', expansion: 'mililitros', ambigua: false },
  { abreviatura: 'CC', expansion: 'mililitros', ambigua: false, contexto: 'centímetros cúbicos; equivale a mililitros' },
  { abreviatura: 'SSN', expansion: 'solución salina normal', ambigua: false },
  { abreviatura: 'SSNIV', expansion: 'solución salina normal por la vena', ambigua: false },
  { abreviatura: 'SSN IV', expansion: 'solución salina normal por la vena', ambigua: false },
  { abreviatura: 'IV', expansion: 'por la vena', ambigua: false },
  { abreviatura: 'EV', expansion: 'por la vena', ambigua: false },
  { abreviatura: 'IM', expansion: 'en el músculo', ambigua: false },
  { abreviatura: 'VO', expansion: 'por la boca (vía oral)', ambigua: false },
  { abreviatura: 'PARA DIL', expansion: 'para diluir', ambigua: false },
  { abreviatura: 'AMP', expansion: 'ampolla', ambigua: false },
  { abreviatura: 'AMPOLLA', expansion: 'ampolla', ambigua: false },
  { abreviatura: 'TAB', expansion: 'tableta', ambigua: false },
  { abreviatura: 'CAP', expansion: 'cápsula', ambigua: false },
  { abreviatura: 'JBE', expansion: 'jarabe', ambigua: false },
  { abreviatura: 'PRN', expansion: 'si lo necesita (según indicación médica)', ambigua: false },
  { abreviatura: 'SC', expansion: '', ambigua: true, contexto: 'puede significar subcutáneo u otra cosa según el contexto' },
];

export function interpretInstruction(text: string): InstructionInterpretation {
  let legible = text.trim().replace(/\s+/g, ' ');
  const ambiguedades: string[] = [];

  if (/\bSC\b/i.test(legible)) {
    ambiguedades.push('SC: puede significar subcutáneo u otra cosa según el contexto');
  }

  legible = legible.replace(
    /(\d+(?:[.,]\d+)?)\s*G(?:RS?)?\s+EN\s+(\d+(?:[.,]\d+)?)\s*CC\s*(?:SSN\s*IV|SSNIV)\b/gi,
    '$1 gramos diluidos en $2 mililitros de solución salina, por la vena',
  );

  legible = legible.replace(/(\d+(?:[.,]\d+)?)\s*(GRS?|G|MG|MCG|ML|CC)\b/gi, (_match, quantity: string, unit: string) => {
    return `${quantity} ${expandMeasuredUnit(unit, quantity)}`;
  });

  legible = legible
    .replace(/\bSSN\s*IV\b/gi, 'solución salina normal por la vena')
    .replace(/\bSSNIV\b/gi, 'solución salina normal por la vena')
    .replace(/\bSSN\b/gi, 'solución salina normal')
    .replace(/(\d+(?:[.,]\d+)?\s+mililitros)\s+(solución)/gi, '$1 de $2')
    .replace(/\bPARA\s+DIL\b/gi, 'para diluir')
    .replace(/\bAMPOLLA\b/gi, 'ampolla')
    .replace(/\bAMP\b/gi, 'ampolla')
    .replace(/\bTAB\b/gi, 'tableta')
    .replace(/\bCAP\b/gi, 'cápsula')
    .replace(/\bJBE\b/gi, 'jarabe')
    .replace(/\bPRN\b/gi, 'si lo necesita (según indicación médica)')
    .replace(/\bEN\b/gi, 'en')
    .replace(/\bVO\b/gi, 'por la boca (vía oral)')
    .replace(/\bIM\b/gi, 'en el músculo (intramuscular)')
    .replace(/\b(?:IV|EV)\b/gi, 'por la vena');

  return { legible, ambiguedades };
}

export function interpretFrequency(text: string | null, origin: FrequencyOrigin = 'unknown'): InstructionInterpretation {
  if (!text) return { legible: '', ambiguedades: [] };
  if (origin === 'frequency' && /^\s*(?:cada\s*)?24\s*horas?\s*$/i.test(text)) {
    return { legible: 'cada 24 horas (una vez al día)', ambiguedades: [] };
  }
  if (origin === 'unknown' && /^\s*24\s*horas?\s*$/i.test(text)) {
    return { legible: text.trim(), ambiguedades: ['24 horas: confirma si corresponde a la frecuencia o a la duración'] };
  }
  return { legible: text.trim(), ambiguedades: [] };
}

function expandMeasuredUnit(unit: string, quantity: string): string {
  const singular = isExactlyOne(quantity);
  switch (unit.toLowerCase()) {
    case 'g':
    case 'gr':
    case 'grs':
      return singular ? 'gramo' : 'gramos';
    case 'mg':
      return singular ? 'miligramo' : 'miligramos';
    case 'mcg':
      return singular ? 'microgramo' : 'microgramos';
    case 'ml':
    case 'cc':
      return singular ? 'mililitro' : 'mililitros';
    default:
      return unit;
  }
}

function isExactlyOne(value: string): boolean {
  return Number(value.replace(',', '.')) === 1;
}
