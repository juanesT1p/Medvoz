import { ExtractedPrescriptionSchema, type ExtractedPrescription } from '@medvoz/shared';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function extractPrescription(image: File): Promise<ExtractedPrescription> {
  const formData = new FormData();
  formData.append('image', image);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/prescriptions/extract`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'No pudimos conectarnos con MedVoz. Revisa tu conexión e inténtalo de nuevo.');
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | ExtractedPrescription
    | null;

  if (!response.ok) {
    const errorPayload = payload as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      errorPayload?.error?.code ?? 'API_ERROR',
      errorPayload?.error?.message ?? 'No pudimos leer la imagen. Inténtalo de nuevo.',
    );
  }

  return ExtractedPrescriptionSchema.parse(payload);
}
