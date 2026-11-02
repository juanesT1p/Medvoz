import sharp from 'sharp';
import { HttpError } from './http-error.js';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function isAcceptedImageType(mimeType: string): boolean {
  return acceptedMimeTypes.has(mimeType.toLowerCase());
}

export async function normalizeImage(file: { mimetype: string; buffer: Buffer }): Promise<{ mimeType: string; data: Buffer }> {
  if (!isAcceptedImageType(file.mimetype)) {
    throw new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'El archivo debe ser una imagen JPEG, PNG, WebP o HEIC.');
  }

  try {
    const image = sharp(file.buffer).resize({ width: 1_568, height: 1_568, fit: 'inside', withoutEnlargement: true });
    const data = await image.jpeg({ quality: 90 }).toBuffer();
    return { mimeType: 'image/jpeg', data };
  } catch {
    throw new HttpError(400, 'INVALID_IMAGE', 'No se pudo leer la imagen. Toma otra foto e inténtalo de nuevo.');
  }
}
