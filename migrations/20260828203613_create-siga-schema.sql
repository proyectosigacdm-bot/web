-- Nota: esquema legado (no usado por el backend Neon actual, ver Proyecto/database).
CREATE TABLE public.roles_usuarios (
    id_usuario UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('ADMIN', 'DOCENTE', 'APODERADO'))
);

CREATE TABLE public.cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    nivel TEXT NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (nombre, nivel)
);

CREATE TABLE public.estudiantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo TEXT NOT NULL,
    rut TEXT UNIQUE,
    correo TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.estudiantes_cursos (
    id_estudiante UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    id_curso UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    fecha_ingreso DATE NOT NULL DEFAULT current_date,
    fecha_retiro DATE,
    PRIMARY KEY (id_estudiante, id_curso),
    CHECK (fecha_retiro IS NULL OR fecha_retiro >= fecha_ingreso)
);

CREATE TABLE public.asignaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activa BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.cursos_asignaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_curso UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    id_asignatura UUID NOT NULL REFERENCES public.asignaturas(id) ON DELETE RESTRICT,
    horas_semanales SMALLINT CHECK (horas_semanales IS NULL OR horas_semanales > 0),
    UNIQUE (id_curso, id_asignatura)
);

CREATE TABLE public.asignaciones_docentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_docente UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    id_curso_asignatura UUID NOT NULL REFERENCES public.cursos_asignaturas(id) ON DELETE CASCADE,
    responsable_asistencia BOOLEAN NOT NULL DEFAULT false,
    fecha_asignacion DATE NOT NULL DEFAULT current_date,
    UNIQUE (id_docente, id_curso_asignatura)
);

CREATE TABLE public.bloques_horarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    hora_inicio TIME NOT NULL,
    hora_termino TIME NOT NULL,
    CHECK (hora_termino > hora_inicio)
);

CREATE TABLE public.horarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_curso_asignatura UUID NOT NULL REFERENCES public.cursos_asignaturas(id) ON DELETE CASCADE,
    id_bloque_horario UUID NOT NULL REFERENCES public.bloques_horarios(id) ON DELETE RESTRICT,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    id_asignacion_docente UUID REFERENCES public.asignaciones_docentes(id) ON DELETE SET NULL,
    UNIQUE (id_curso_asignatura, id_bloque_horario, dia_semana)
);

CREATE TABLE public.sesiones_asistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_curso_asignatura UUID NOT NULL REFERENCES public.cursos_asignaturas(id) ON DELETE RESTRICT,
    fecha_asistencia DATE NOT NULL,
    id_asignacion_docente UUID NOT NULL REFERENCES public.asignaciones_docentes(id) ON DELETE RESTRICT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id_curso_asignatura, fecha_asistencia)
);

CREATE TABLE public.registros_asistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_sesion_asistencia UUID NOT NULL REFERENCES public.sesiones_asistencia(id) ON DELETE CASCADE,
    id_estudiante UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE RESTRICT,
    estado TEXT NOT NULL CHECK (estado IN ('PRESENTE', 'AUSENTE', 'TARDANZA', 'JUSTIFICADO')),
    observacion TEXT NOT NULL DEFAULT '',
    UNIQUE (id_sesion_asistencia, id_estudiante)
);

CREATE TABLE public.justificaciones_asistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_registro_asistencia UUID NOT NULL UNIQUE REFERENCES public.registros_asistencia(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    observacion TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    nombre_documento TEXT,
    url_documento TEXT,
    clave_documento TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ
);

CREATE TABLE public.eventos_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad TEXT NOT NULL,
    id_entidad UUID NOT NULL,
    accion TEXT NOT NULL,
    id_usuario_actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.calificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_estudiante UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE RESTRICT,
    id_asignacion_docente UUID NOT NULL REFERENCES public.asignaciones_docentes(id) ON DELETE RESTRICT,
    tipo_evaluacion TEXT NOT NULL,
    descripcion TEXT,
    nota NUMERIC(3,1) NOT NULL CHECK (nota BETWEEN 1.0 AND 7.0),
    ponderacion NUMERIC(5,2) CHECK (ponderacion IS NULL OR ponderacion BETWEEN 0 AND 100),
    fecha_evaluacion DATE NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.anotaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_estudiante UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE RESTRICT,
    id_asignacion_docente UUID REFERENCES public.asignaciones_docentes(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('POSITIVA', 'NEGATIVA')),
    observacion TEXT NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.materiales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_curso_asignatura UUID NOT NULL REFERENCES public.cursos_asignaturas(id) ON DELETE CASCADE,
    id_asignacion_docente UUID REFERENCES public.asignaciones_docentes(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    tipo_archivo TEXT NOT NULL,
    url_almacenamiento TEXT NOT NULL,
    clave_almacenamiento TEXT NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.apoderados_estudiantes (
    id_apoderado UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id_estudiante UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    parentesco TEXT,
    es_principal BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (id_apoderado, id_estudiante)
);

CREATE TABLE public.configuraciones_sistema (
    clave TEXT PRIMARY KEY,
    valor JSONB NOT NULL,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sesiones_asistencia_fecha ON public.sesiones_asistencia (fecha_asistencia);
CREATE INDEX idx_registros_asistencia_estudiante ON public.registros_asistencia (id_estudiante);
CREATE INDEX idx_calificaciones_estudiante ON public.calificaciones (id_estudiante, fecha_evaluacion DESC);
CREATE INDEX idx_anotaciones_estudiante ON public.anotaciones (id_estudiante, fecha_creacion DESC);
CREATE INDEX idx_materiales_curso_asignatura ON public.materiales (id_curso_asignatura, fecha_creacion DESC);
CREATE INDEX idx_apoderados_estudiantes_estudiante ON public.apoderados_estudiantes (id_estudiante);
CREATE INDEX idx_eventos_auditoria_entidad ON public.eventos_auditoria (entidad, id_entidad, fecha_creacion DESC);

CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT EXISTS (
    SELECT 1 FROM public.roles_usuarios
    WHERE id_usuario = (SELECT auth.uid()) AND rol = 'ADMIN'
); $$;

CREATE OR REPLACE FUNCTION public.es_docente_asignacion(id_asignacion UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT EXISTS (
    SELECT 1 FROM public.asignaciones_docentes
    WHERE id = id_asignacion AND id_docente = (SELECT auth.uid())
); $$;

CREATE OR REPLACE FUNCTION public.es_apoderado_estudiante(id_estudiante_consultado UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT EXISTS (
    SELECT 1 FROM public.apoderados_estudiantes
    WHERE id_apoderado = (SELECT auth.uid()) AND id_estudiante = id_estudiante_consultado
); $$;

DO $$
DECLARE nombre_tabla TEXT;
BEGIN
    FOREACH nombre_tabla IN ARRAY ARRAY[
        'roles_usuarios', 'cursos', 'estudiantes', 'estudiantes_cursos', 'asignaturas',
        'cursos_asignaturas', 'asignaciones_docentes', 'bloques_horarios', 'horarios',
        'sesiones_asistencia', 'registros_asistencia', 'justificaciones_asistencia',
        'eventos_auditoria', 'calificaciones', 'anotaciones', 'materiales',
        'apoderados_estudiantes', 'configuraciones_sistema'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nombre_tabla);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', nombre_tabla);
    END LOOP;
END $$;

CREATE POLICY roles_usuarios_lectura ON public.roles_usuarios FOR SELECT TO authenticated
USING (public.es_administrador() OR id_usuario = (SELECT auth.uid()));
CREATE POLICY roles_usuarios_admin ON public.roles_usuarios FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY cursos_admin ON public.cursos FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY estudiantes_admin ON public.estudiantes FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY estudiantes_cursos_admin ON public.estudiantes_cursos FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY asignaturas_admin ON public.asignaturas FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY cursos_asignaturas_admin ON public.cursos_asignaturas FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY asignaciones_docentes_acceso ON public.asignaciones_docentes FOR SELECT TO authenticated
USING (public.es_administrador() OR id_docente = (SELECT auth.uid()));
CREATE POLICY asignaciones_docentes_admin ON public.asignaciones_docentes FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY bloques_horarios_admin ON public.bloques_horarios FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY horarios_acceso ON public.horarios FOR SELECT TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY horarios_admin ON public.horarios FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY sesiones_asistencia_acceso ON public.sesiones_asistencia FOR SELECT TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY sesiones_asistencia_insertar ON public.sesiones_asistencia FOR INSERT TO authenticated
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY sesiones_asistencia_actualizar ON public.sesiones_asistencia FOR UPDATE TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente))
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY registros_asistencia_acceso ON public.registros_asistencia FOR SELECT TO authenticated
USING (
    public.es_administrador()
    OR EXISTS (SELECT 1 FROM public.sesiones_asistencia s WHERE s.id = id_sesion_asistencia AND public.es_docente_asignacion(s.id_asignacion_docente))
    OR public.es_apoderado_estudiante(id_estudiante)
);
CREATE POLICY registros_asistencia_insertar ON public.registros_asistencia FOR INSERT TO authenticated
WITH CHECK (public.es_administrador() OR EXISTS (SELECT 1 FROM public.sesiones_asistencia s WHERE s.id = id_sesion_asistencia AND public.es_docente_asignacion(s.id_asignacion_docente)));
CREATE POLICY registros_asistencia_actualizar ON public.registros_asistencia FOR UPDATE TO authenticated
USING (public.es_administrador() OR EXISTS (SELECT 1 FROM public.sesiones_asistencia s WHERE s.id = id_sesion_asistencia AND public.es_docente_asignacion(s.id_asignacion_docente)))
WITH CHECK (public.es_administrador() OR EXISTS (SELECT 1 FROM public.sesiones_asistencia s WHERE s.id = id_sesion_asistencia AND public.es_docente_asignacion(s.id_asignacion_docente)));

CREATE POLICY justificaciones_asistencia_acceso ON public.justificaciones_asistencia FOR SELECT TO authenticated
USING (public.es_administrador() OR EXISTS (
    SELECT 1 FROM public.registros_asistencia r
    WHERE r.id = id_registro_asistencia AND public.es_apoderado_estudiante(r.id_estudiante)
));
CREATE POLICY justificaciones_asistencia_insertar ON public.justificaciones_asistencia FOR INSERT TO authenticated
WITH CHECK (public.es_administrador());
CREATE POLICY justificaciones_asistencia_actualizar ON public.justificaciones_asistencia FOR UPDATE TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY auditoria_lectura ON public.eventos_auditoria FOR SELECT TO authenticated
USING (public.es_administrador() OR id_usuario_actor = (SELECT auth.uid()));
CREATE POLICY auditoria_escritura ON public.eventos_auditoria FOR INSERT TO authenticated
WITH CHECK (public.es_administrador() OR id_usuario_actor = (SELECT auth.uid()));

CREATE POLICY calificaciones_acceso ON public.calificaciones FOR SELECT TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente) OR public.es_apoderado_estudiante(id_estudiante));
CREATE POLICY calificaciones_insertar ON public.calificaciones FOR INSERT TO authenticated
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY calificaciones_actualizar ON public.calificaciones FOR UPDATE TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente))
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY anotaciones_acceso ON public.anotaciones FOR SELECT TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente) OR public.es_apoderado_estudiante(id_estudiante));
CREATE POLICY anotaciones_insertar ON public.anotaciones FOR INSERT TO authenticated
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY anotaciones_actualizar ON public.anotaciones FOR UPDATE TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente))
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY materiales_acceso ON public.materiales FOR SELECT TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY materiales_insertar ON public.materiales FOR INSERT TO authenticated
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY materiales_actualizar ON public.materiales FOR UPDATE TO authenticated
USING (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente))
WITH CHECK (public.es_administrador() OR public.es_docente_asignacion(id_asignacion_docente));
CREATE POLICY apoderados_estudiantes_acceso ON public.apoderados_estudiantes FOR SELECT TO authenticated
USING (public.es_administrador() OR id_apoderado = (SELECT auth.uid()));
CREATE POLICY apoderados_estudiantes_admin ON public.apoderados_estudiantes FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
CREATE POLICY configuraciones_sistema_admin ON public.configuraciones_sistema FOR ALL TO authenticated
USING (public.es_administrador()) WITH CHECK (public.es_administrador());
