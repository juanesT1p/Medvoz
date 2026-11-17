import { toCardinal } from 'n2words/es';

type SpokenUnit = {
  singular: string;
  plural: string;
};

const quantityPattern = String.raw`\d+(?:[.,]\d+)?`;
const unitPattern = String.raw`mcg|µg|ug|mg|kg|ml|ui|iu|g|l`;
const units: Record<string, SpokenUnit> = {
  mg: { singular: 'miligramo', plural: 'miligramos' },
  mcg: { singular: 'microgramo', plural: 'microgramos' },
  µg: { singular: 'microgramo', plural: 'microgramos' },
  ug: { singular: 'microgramo', plural: 'microgramos' },
  g: { singular: 'gramo', plural: 'gramos' },
  kg: { singular: 'kilogramo', plural: 'kilogramos' },
  ml: { singular: 'mililitro', plural: 'mililitros' },
  l: { singular: 'litro', plural: 'litros' },
  ui: { singular: 'unidad internacional', plural: 'unidades internacionales' },
  iu: { singular: 'unidad internacional', plural: 'unidades internacionales' },
};

const digitWords = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];

/**
 * Convierte únicamente patrones inequívocos de una fórmula a texto hablado.
 * No convierte números sueltos: así se conserva cualquier texto clínico que
 * no tenga una unidad, proporción o abreviatura de posología reconocible.
 */
export function toSpokenText(input: string): string {
  let output = input;

  output = output.replace(
    new RegExp(String.raw`\b(${quantityPattern})\s*(${unitPattern})\s*/\s*(?:(\d+(?:[.,]\d+)?)\s*)?(${unitPattern})\b`, 'gi'),
    (_match, numerator: string, numeratorUnit: string, denominator: string | undefined, denominatorUnit: string) => {
      const first = `${numberToSpanish(numerator)} ${unitToSpanish(numeratorUnit, numerator)}`;
      if (!denominator) return `${first} por ${unitToSpanish(denominatorUnit, '1')}`;
      return `${first} por cada ${numberToSpanish(denominator)} ${unitToSpanish(denominatorUnit, denominator)}`;
    },
  );

  output = output.replace(
    new RegExp(String.raw`\b(${quantityPattern})\s*(%|${unitPattern})(?!\w)`, 'gi'),
    (_match, quantity: string, rawUnit: string) => {
      if (rawUnit === '%') return `${numberToSpanish(quantity)} por ciento`;
      return `${numberToSpanish(quantity)} ${unitToSpanish(rawUnit, quantity)}`;
    },
  );

  output = output
    .replace(/\bc\s*\/\s*(\d+)\s*h\b/gi, 'cada $1 horas')
    .replace(/\bx\s+(\d+)\s+d[ií]as?\b/gi, 'por $1 días')
    .replace(/\bc\s*\/\s*d\b/gi, 'cada día')
    .replace(/\bVO\b/gi, 'por vía oral');

  output = output.replace(/\b(\d+(?:[.,]\d+)?)\s+(miligramo|miligramos|microgramo|microgramos|gramo|gramos|kilogramo|kilogramos|mililitro|mililitros|litro|litros)\b/gi, (_match, quantity: string, unit: string) => {
    const singular = isExactlyOne(quantity);
    const normalizedUnit = unit.toLowerCase();
    const unitWords: Record<string, SpokenUnit> = {
      miligramo: units.mg!,
      miligramos: units.mg!,
      microgramo: units.mcg!,
      microgramos: units.mcg!,
      gramo: units.g!,
      gramos: units.g!,
      kilogramo: units.kg!,
      kilogramos: units.kg!,
      mililitro: units.ml!,
      mililitros: units.ml!,
      litro: units.l!,
      litros: units.l!,
    };
    return `${numberToSpanish(quantity)} ${singular ? unitWords[normalizedUnit]?.singular ?? unit : unitWords[normalizedUnit]?.plural ?? unit}`;
  });

  return output;
}

export function toSpokenScheduleNumbers(input: string): string {
  return input.replace(/\b\d+(?:[.,]\d+)?\b/g, (number) => numberToSpanish(number));
}

function unitToSpanish(rawUnit: string, quantity: string): string {
  const unit = units[rawUnit.toLowerCase()];
  if (!unit) return rawUnit;
  return isExactlyOne(quantity) ? unit.singular : unit.plural;
}

function isExactlyOne(value: string): boolean {
  const parsed = parseNumber(value);
  return parsed !== null && parsed === 1;
}

function numberToSpanish(rawValue: string): string {
  const parsed = parseNumberParts(rawValue);
  if (!parsed) return rawValue;

  const integerWords = apocope(toCardinal(parsed.integer, { gender: 'masculine' }));
  if (!parsed.decimalDigits) return integerWords;
  return `${integerWords} coma ${[...parsed.decimalDigits].map((digit) => digitWords[Number(digit)]).join(' ')}`;
}

function parseNumber(value: string): number | null {
  const parts = parseNumberParts(value);
  if (!parts || parts.decimalDigits) return parts ? Number(`${parts.integer}.${parts.decimalDigits}`) : null;
  return Number(parts.integer);
}

function parseNumberParts(value: string): { integer: bigint; decimalDigits: string } | null {
  const normalized = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(normalized)) return null;

  const separatorIndex = normalized.search(/[.,]/);
  if (separatorIndex === -1) return { integer: BigInt(normalized), decimalDigits: '' };

  const integerPart = normalized.slice(0, separatorIndex);
  const fractionalPart = normalized.slice(separatorIndex + 1);
  // In Colombian notation 1.000 is a thousands separator. A leading zero
  // remains decimal so that 0.125 is spoken digit by digit instead of losing
  // its leading zero; structured doses remove this ambiguity at /explain.
  if (normalized[separatorIndex] === '.' && integerPart !== '0' && fractionalPart.length === 3) {
    return { integer: BigInt(`${integerPart}${fractionalPart}`), decimalDigits: '' };
  }
  return { integer: BigInt(integerPart), decimalDigits: fractionalPart };
}

function apocope(value: string): string {
  return value
    .replace(/\bveintiuno\b/g, 'veintiún')
    .replace(/\buno(?=\s+(?:mil|millón|millones|billón|billones|trillón|trillones)|$)/g, 'un');
}
