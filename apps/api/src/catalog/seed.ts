import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeDrugName } from '../providers/drugs/normalize.js';

loadDotenv({ path: resolve(process.cwd(), '.env') });
loadDotenv({ path: resolve(process.cwd(), '../../.env') });

const prisma = new PrismaClient();
const csvPath = resolve(process.cwd(), '../../data/drugs.csv');

try {
  const rows = parseCsv(await readFile(csvPath, 'utf8'));
  for (const row of rows) {
    const commercialName = row.commercialName?.trim();
    const activeIngredient = row.activeIngredient?.trim();
    if (!commercialName || !activeIngredient) continue;
    const synonyms = (row.synonyms ?? '')
      .split(';')
      .map((synonym) => normalizeDrugName(synonym))
      .filter(Boolean);
    await prisma.drug.upsert({
      where: { normalizedName: normalizeDrugName(commercialName) },
      create: { commercialName, activeIngredient, normalizedName: normalizeDrugName(commercialName), synonyms },
      update: { commercialName, activeIngredient, synonyms },
    });
  }
  console.log(`Catálogo cargado: ${rows.length} filas procesadas.`);
} finally {
  await prisma.$disconnect();
}

function parseCsv(input: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      record.push(field);
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const headers = records.shift() ?? [];
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ''])));
}
