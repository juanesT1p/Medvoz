import { describe, expect, it } from 'vitest';
import { toSpokenText } from './spokenText.js';

describe('toSpokenText', () => {
  it.each([
    ['500 mg', 'quinientos miligramos'],
    ['1 mg', 'un miligramo'],
    ['0,5 mg', 'cero coma cinco miligramos'],
    ['0.05 mg', 'cero coma cero cinco miligramos'],
    ['1.000 mg', 'mil miligramos'],
    ['250 mg/5 ml', 'doscientos cincuenta miligramos por cada cinco mililitros'],
    ['100 mcg', 'cien microgramos'],
    ['c/8h', 'cada 8 horas'],
    ['21 mg', 'veintiún miligramos'],
    ['2,5 ml', 'dos coma cinco mililitros'],
    ['10 mg/ml', 'diez miligramos por mililitro'],
    ['5 %', 'cinco por ciento'],
    ['x 7 días', 'por 7 días'],
    ['c/d', 'cada día'],
    ['VO', 'por vía oral'],
  ])('convierte %s', (input, expected) => {
    expect(toSpokenText(input)).toBe(expected);
  });

  it('conserva texto que no contiene patrones hablables', () => {
    expect(toSpokenText('Tomar según indicación médica.')).toBe('Tomar según indicación médica.');
  });
});
