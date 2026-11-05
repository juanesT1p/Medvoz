# Nota para continuar el desarrollo

## Estado actual

MedVoz funciona de extremo a extremo para:

1. Subir una fotografía real de una fórmula.
2. Leerla con Gemini mediante visión/OCR.
3. Mostrar los datos extraídos para confirmación.
4. Validar el nombre contra PostgreSQL y el catálogo local.
5. Pasar los datos validados a Gemini.
6. Generar una explicación sencilla en español.

La aplicación no genera imágenes. Solo procesa temporalmente la imagen enviada por la persona usuaria y luego trabaja con texto estructurado.

## Última prueba exitosa

Se probó `GLUCERNA` con estos datos:

- Producto: `GLUCERNA`
- Cantidad: `230 CC`
- Frecuencia: `CADA 3 HORAS`
- Duración: `30 días`

El catálogo devuelve `verified` y Gemini genera una explicación breve indicando que es un alimento líquido especializado para complementar la alimentación, respetando las indicaciones detectadas.

## Pendiente principal: voz

La explicación escrita funciona. El audio todavía requiere revisión:

- Con `TTS_PROVIDER=browser`, el backend devuelve `TTS_UNAVAILABLE` intencionalmente y el frontend intenta usar `window.speechSynthesis`.
- Con `TTS_PROVIDER=openai`, falta configurar una clave de OpenAI y comprobar la respuesta MP3 real.
- Revisar en navegador que exista una voz en español, que el navegador permita `speechSynthesis` y que los botones reproducir/pausar/repetir actualicen correctamente el estado.

## Configuración local usada

- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- PostgreSQL del proyecto: `localhost:5433`
- Modelo Gemini: `gemini-3.5-flash`
- Catálogo: `data/drugs.csv` y tabla Prisma `Drug`

El archivo `.env` está en la raíz y está excluido por `.gitignore`. Nunca subirlo al repositorio ni incluir claves en el README, commits, capturas o mensajes.

## Archivos relevantes

- `apps/api/src/config/env.ts`: carga `.env` desde la raíz cuando pnpm ejecuta el backend desde `apps/api`.
- `apps/api/src/providers/llm/gemini.ts`: conexión Gemini y respuestas JSON estructuradas.
- `apps/api/src/services/drug-validation.service.ts`: validación y transferencia de datos del catálogo hacia la IA.
- `apps/api/src/services/explanation.service.ts`: sanitización y creación de explicación/audioScript.
- `apps/api/src/catalog/seed.ts`: carga el catálogo CSV en PostgreSQL.
- `apps/web/src/main.tsx`: flujo de captura, confirmación, explicación y audio.
- `data/drugs.csv`: medicamentos y productos conocidos por el catálogo.

## Comandos para continuar

```bash
pnpm db:generate
pnpm db:push
pnpm seed:catalog
pnpm dev
```

Comprobaciones:

```bash
pnpm llm:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
