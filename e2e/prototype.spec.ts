import { expect, test } from '@playwright/test';

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
  confidence: 0.98,
  legibility: 'clear',
};

test('permite consentimiento, confirmación y explicación con backend mockeado', async ({ page }) => {
  await page.route('http://localhost:3001/**', async (route) => {
    if (route.request().url().endsWith('/api/prescriptions/extract')) {
      await route.fulfill({ json: { isPrescription: true, items: [item], documentWarnings: [] } });
    } else if (route.request().url().endsWith('/api/prescriptions/validate')) {
      await route.fulfill({ json: { isPrescription: true, items: [{ ...item, match: { status: 'verified', canonicalName: 'Acetaminofén', source: 'local_catalog' } }], documentWarnings: [] } });
    } else if (route.request().url().endsWith('/api/prescriptions/explain')) {
      await route.fulfill({ json: { items: [{ itemId: item.id, purpose: 'Se usa para aliviar molestias.', howToTakeAsPrescribed: 'Sigue únicamente las indicaciones de la fórmula.', commonWarnings: ['Consulta si tienes dudas.'], askDoctorIf: ['Si algo no coincide.'] }], audioScript: 'Esta es una explicación de prueba.', disclaimer: 'No reemplaza la orientación profesional.' } });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');
  const cameraButton = page.getByRole('button', { name: 'Tomar foto' });
  await expect(cameraButton).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(cameraButton).toBeEnabled();

  await page.locator('input[type="file"]').first().setInputFiles({ name: 'formula.png', mimeType: 'image/png', buffer: Buffer.from('formula') });
  await page.getByRole('button', { name: 'Leer fórmula' }).click();
  await expect(page.getByRole('heading', { name: 'Confirma lo que aparece en la fórmula.' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar y explicar' }).click();
  await expect(page.getByRole('heading', { name: 'Esto es lo que dice tu fórmula' })).toBeVisible();
});
