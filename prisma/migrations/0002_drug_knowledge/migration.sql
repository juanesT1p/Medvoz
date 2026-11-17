ALTER TABLE "Drug"
  ADD COLUMN "principioActivo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "nombresComunes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "queEs" TEXT,
  ADD COLUMN "paraQueSuele" TEXT,
  ADD COLUMN "comoActua" TEXT,
  ADD COLUMN "precauciones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "senalesDeAlerta" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "preguntasParaMedico" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "fuente" TEXT,
  ADD COLUMN "revisadoPor" TEXT NOT NULL DEFAULT 'pendiente';
