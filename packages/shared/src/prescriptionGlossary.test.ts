import { describe, expect, it } from 'vitest';
import { interpretFrequency, interpretInstruction } from './prescriptionGlossary.js';

describe('interpretInstruction', () => {
  it.each([
    ['2 GR EN 100 CC SSNIV', '2 gramos diluidos en 100 mililitros de solución salina, por la vena'],
    ['1 AMP EN 100 CC SSN IV', '1 ampolla en 100 mililitros de solución salina normal por la vena'],
    ['PARA DIL', 'para diluir'],
    ['50 MG SC', '50 miligramos SC'],
  ])('interpreta %s', (input, expected) => {
    expect(interpretInstruction(input).legible).toBe(expected);
  });

  it('marca SC como ambiguo sin expandirlo', () => {
    expect(interpretInstruction('50 MG SC').ambiguedades).toEqual([
      'SC: puede significar subcutáneo u otra cosa según el contexto',
    ]);
  });

  it('expande presentaciones y vías comunes', () => {
    expect(interpretInstruction('1 TAB VO PRN').legible).toBe('1 tableta por la boca (vía oral) si lo necesita (según indicación médica)');
    expect(interpretInstruction('1 CAP IM').legible).toBe('1 cápsula en el músculo (intramuscular)');
  });
});

describe('interpretFrequency', () => {
  it('hace explícita una frecuencia de 24 horas', () => {
    expect(interpretFrequency('24 Horas', 'frequency')).toEqual({ legible: 'cada 24 horas (una vez al día)', ambiguedades: [] });
  });

  it('no interpreta silenciosamente un origen desconocido', () => {
    expect(interpretFrequency('24 Horas')).toEqual({
      legible: '24 Horas',
      ambiguedades: ['24 horas: confirma si corresponde a la frecuencia o a la duración'],
    });
  });
});
