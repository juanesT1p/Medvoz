import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  rawText: 'Acetaminofén 500 mg',
  name: 'Acetaminofén',
  activeIngredient: 'acetaminofén',
  strength: '500 mg',
  form: 'tableta',
  dose: '1 tableta',
  frequency: 'cada 8 horas',
  duration: 'por 3 días',
  route: 'oral',
  instructions: null,
  dosisValor: 1,
  dosisUnidad: 'tableta',
  confidence: 0.98,
  legibility: 'clear',
};

test.describe('flujo accesible de MedVoz', () => {
  test('sube, revisa, confirma, reproduce y muestra la guía', async ({ page }) => {
    let ttsRequests = 0;
    await page.route('http://localhost:3001/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/api/prescriptions/extract')) {
        await route.fulfill({ json: { isPrescription: true, items: [item], documentWarnings: [] } });
      } else if (url.endsWith('/api/prescriptions/validate')) {
        await route.fulfill({ json: { isPrescription: true, items: [{ ...item, match: { status: 'verified', canonicalName: 'Acetaminofén', source: 'local_catalog' } }], documentWarnings: [] } });
      } else if (url.endsWith('/api/prescriptions/explain')) {
        await route.fulfill({ json: { items: [{ itemId: item.id, purpose: 'Se usa para aliviar molestias.', howToTakeAsPrescribed: 'Sigue únicamente las indicaciones de la fórmula.', commonWarnings: ['Consulta si tienes dudas.'], askDoctorIf: ['Si algo no coincide.'] }], audioScript: 'Acetaminofén: 1 tableta, cada 8 horas, durante 3 días, por vía oral. Se usa para aliviar molestias.', disclaimer: 'No reemplaza la orientación profesional.' } });
      } else if (url.endsWith('/api/tts')) {
        ttsRequests += 1;
        await route.fulfill({ status: 200, contentType: 'audio/wav', body: createWavSilence() });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Entiende tu receta médica con total claridad y escúchala a tu ritmo' })).toBeVisible();
    await checkSeriousA11y(page);
    await expect(page.getByRole('button', { name: 'Tomar foto' })).toBeDisabled();
    await page.getByRole('checkbox').check();
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'formula.png', mimeType: 'image/png', buffer: Buffer.from('formula') });
    await page.getByRole('button', { name: /Leer mi fórmula/ }).click();

    await expect(page.getByRole('heading', { name: 'Revisa lo que leímos' })).toBeVisible();
    await expect(page.getByLabel('Nombre')).toHaveValue('Acetaminofén');
    await expect(page.getByText('Pendiente de validar')).toBeVisible();
    await checkSeriousA11y(page);
    await page.getByRole('button', { name: /Confirmar y generar guía fácil/ }).click();

    await expect(page.getByRole('heading', { name: 'Escucha y revisa tu fórmula' })).toBeVisible();
    await expect(page.getByText('Cronograma de dosis')).toBeVisible();
    await expect(page.getByText('Precauciones y advertencias')).toBeVisible();
    await checkSeriousA11y(page);
    await page.getByRole('button', { name: 'Reproducir explicación' }).click();
    await expect.poll(() => ttsRequests).toBe(1);
  });

  test('mantiene la captura usable en 360, 768 y 1280 px', async ({ page }) => {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Entiende tu receta médica con total claridad y escúchala a tu ritmo' })).toBeVisible();
      expect(await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  });
});

async function checkSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')).toEqual([]);
}

function createWavSilence(): Buffer {
  const pcm = Buffer.alloc(4_800);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24_000, 24);
  header.writeUInt32LE(48_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
