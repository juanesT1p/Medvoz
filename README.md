# MedVoz

MedVoz es una aplicación web para leer fórmulas médicas, permitir que la persona confirme lo detectado y ofrecer una explicación sencilla en español. La implementación se desarrolla por fases; la Fase 1 deja lista la extracción estructurada desde imágenes.

## Requisitos

- Node.js 20 o superior
- pnpm 9 o superior
- Docker (opcional, para PostgreSQL local)

## Inicio rápido

```bash
pnpm install
cp .env.example .env
pnpm dev
```

La API queda en `http://localhost:3001` y la web en `http://localhost:5173`. Comprueba la API con:

```bash
curl http://localhost:3001/health
```

Con `LLM_PROVIDER=mock`, la extracción local no consume ninguna API externa. Para usar un proveedor real, configura en `.env` el proveedor, el modelo y su clave, y reinicia la API:

```bash
LLM_PROVIDER=gemini       # gemini | anthropic | mock
LLM_MODEL=<modelo-vigente>
GEMINI_API_KEY=<clave-de-Google-AI-Studio>
```

También puedes usar `ANTHROPIC_API_KEY` con `LLM_PROVIDER=anthropic`. Los identificadores de modelo cambian con el tiempo: consulta la documentación vigente del proveedor y escríbelos únicamente en `.env`.

La extracción recibe una imagen en memoria mediante `POST /api/prescriptions/extract`, usando el campo multipart `image`. Acepta JPEG, PNG, WebP y HEIC; redimensiona el lado mayor a 1568 píxeles y nunca guarda la imagen en disco.

Para comprobar las credenciales y que el modelo admite texto e imagen:

```bash
pnpm llm:check
```

Para levantar la base de datos local:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm db:push
```

## Arquitectura por fases

- `apps/api`: API Express y servicios del backend.
- `apps/web`: PWA React.
- `packages/shared`: contratos Zod compartidos entre frontend y backend.
- `prisma`: catálogo de fármacos y métricas anónimas.
- `apps/api/src/providers/llm`: interfaz y proveedores intercambiables Gemini, Anthropic y mock.
- `apps/api/src/services/extraction.service.ts`: extracción validada con Zod y UUID generados en backend.

Las claves de proveedores viven únicamente en el backend y se configuran mediante `.env`; no se registran ni se envían al frontend. La imagen y el texto de la fórmula se procesan en memoria y no se incluyen en logs.
