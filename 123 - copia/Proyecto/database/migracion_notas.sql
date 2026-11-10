-- =============================================================================
-- MIGRACIÓN: CALIFICACIONES (FORMATO TABLA)
-- Motor: PostgreSQL (Neon)
-- =============================================================================
--   1. curso.notas_por_curso: cantidad de columnas de notas por curso (1..10),
--      ajustable por el administrador (default 6).
--   2. Rango de notas válido: 2.0 - 7.0 (se reemplaza el CHECK de 1.0-7.0).
--      NOT VALID: no revalida notas antiguas ya existentes.
-- =============================================================================

-- 1. Cantidad de notas por curso
ALTER TABLE curso ADD COLUMN IF NOT EXISTS notas_por_curso SMALLINT NOT NULL DEFAULT 6;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'curso_notas_check') THEN
    ALTER TABLE curso ADD CONSTRAINT curso_notas_check CHECK (notas_por_curso BETWEEN 1 AND 10);
  END IF;
END $$;

-- 2. Rango de notas 2.0 - 7.0
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'calificacion'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%nota%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE calificacion DROP CONSTRAINT ' || c;
  END IF;
  ALTER TABLE calificacion ADD CONSTRAINT calificacion_nota_check CHECK (nota >= 2.0 AND nota <= 7.0) NOT VALID;
END $$;