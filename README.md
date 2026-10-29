# MedVoz

MedVoz es una aplicación web para leer fórmulas médicas, permitir que la persona confirme lo detectado y ofrecer una explicación sencilla en español. La implementación se desarrolla por fases; la Fase 0 deja listo el monorepo y un endpoint de salud.

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

Las funcionalidades clínicas, los proveedores LLM, la extracción, la validación, la explicación y el audio se incorporarán en sus fases correspondientes. Las claves de proveedores vivirán únicamente en el backend y se configurarán mediante `.env`.
