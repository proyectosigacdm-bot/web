-- Datos de prueba relacionales equivalentes al MOCK_DB.
-- Las cuentas ya deben existir en auth.users.

INSERT INTO public.roles_usuarios (id_usuario, rol) VALUES
('7377c41e-317b-49a6-beb9-613adbd9c3a3', 'ADMIN'),
('8448dcf2-26c0-42ab-9cb1-bc90a48e2549', 'DOCENTE'),
('9f81a6bf-a642-479d-b920-4aa0ec06d33b', 'DOCENTE'),
('865d9b52-db83-4ec7-91d7-738f60b39bab', 'APODERADO')
ON CONFLICT (id_usuario) DO UPDATE SET rol = EXCLUDED.rol;

INSERT INTO public.cursos (id, nombre, nivel) VALUES
('10000000-0000-4000-8000-000000000001', 'Matemáticas 1° Básico', '1° Básico'),
('10000000-0000-4000-8000-000000000002', 'Lenguaje 2° Básico', '2° Básico'),
('10000000-0000-4000-8000-000000000003', 'Ciencias 3° Básico', '3° Básico'),
('10000000-0000-4000-8000-000000000004', 'Historia 4° Básico', '4° Básico'),
('10000000-0000-4000-8000-000000000005', 'Matemáticas 5° Básico', '5° Básico'),
('10000000-0000-4000-8000-000000000006', 'Lenguaje 6° Básico', '6° Básico'),
('10000000-0000-4000-8000-000000000007', 'Ciencias 7° Básico', '7° Básico'),
('10000000-0000-4000-8000-000000000008', 'Historia 8° Básico', '8° Básico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.asignaturas (id, nombre, descripcion) VALUES
('20000000-0000-4000-8000-000000000001', 'Matemáticas', 'Asignatura de razonamiento matemático'),
('20000000-0000-4000-8000-000000000002', 'Lenguaje', 'Asignatura de comunicación y lenguaje'),
('20000000-0000-4000-8000-000000000003', 'Ciencias', 'Asignatura de ciencias naturales'),
('20000000-0000-4000-8000-000000000004', 'Historia', 'Asignatura de historia y ciencias sociales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cursos_asignaturas (id, id_curso, id_asignatura, horas_semanales)
SELECT v.id, v.id_curso, v.id_asignatura, 4
FROM (VALUES
('30000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid),
('30000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid),
('30000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, '20000000-0000-4000-8000-000000000003'::uuid),
('30000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000004'::uuid, '20000000-0000-4000-8000-000000000004'::uuid),
('30000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, '20000000-0000-4000-8000-000000000001'::uuid),
('30000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, '20000000-0000-4000-8000-000000000002'::uuid),
('30000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000007'::uuid, '20000000-0000-4000-8000-000000000003'::uuid),
('30000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000008'::uuid, '20000000-0000-4000-8000-000000000004'::uuid)
) AS v(id, id_curso, id_asignatura)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.asignaciones_docentes (id, id_docente, id_curso_asignatura, responsable_asistencia)
SELECT v.id, v.id_docente, v.id_curso_asignatura, true
FROM (VALUES
('40000000-0000-4000-8000-000000000001'::uuid, '8448dcf2-26c0-42ab-9cb1-bc90a48e2549'::uuid, '30000000-0000-4000-8000-000000000001'::uuid),
('40000000-0000-4000-8000-000000000002'::uuid, '8448dcf2-26c0-42ab-9cb1-bc90a48e2549'::uuid, '30000000-0000-4000-8000-000000000002'::uuid),
('40000000-0000-4000-8000-000000000003'::uuid, '8448dcf2-26c0-42ab-9cb1-bc90a48e2549'::uuid, '30000000-0000-4000-8000-000000000003'::uuid),
('40000000-0000-4000-8000-000000000004'::uuid, '8448dcf2-26c0-42ab-9cb1-bc90a48e2549'::uuid, '30000000-0000-4000-8000-000000000004'::uuid),
('40000000-0000-4000-8000-000000000005'::uuid, '9f81a6bf-a642-479d-b920-4aa0ec06d33b'::uuid, '30000000-0000-4000-8000-000000000005'::uuid),
('40000000-0000-4000-8000-000000000006'::uuid, '9f81a6bf-a642-479d-b920-4aa0ec06d33b'::uuid, '30000000-0000-4000-8000-000000000006'::uuid),
('40000000-0000-4000-8000-000000000007'::uuid, '9f81a6bf-a642-479d-b920-4aa0ec06d33b'::uuid, '30000000-0000-4000-8000-000000000007'::uuid),
('40000000-0000-4000-8000-000000000008'::uuid, '9f81a6bf-a642-479d-b920-4aa0ec06d33b'::uuid, '30000000-0000-4000-8000-000000000008'::uuid)
) AS v(id, id_docente, id_curso_asignatura)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bloques_horarios (id, nombre, hora_inicio, hora_termino) VALUES
('50000000-0000-4000-8000-000000000001', 'Primer bloque', '08:15', '09:00'),
('50000000-0000-4000-8000-000000000002', 'Segundo bloque', '09:00', '09:45')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.estudiantes (id, nombre_completo, rut, correo) VALUES
('60000000-0000-4000-8000-000000000101', 'Sofía González', '12.345.678-9', 'sofia.g@edu.cl'),
('60000000-0000-4000-8000-000000000102', 'Martín Ruiz', '13.456.789-0', 'martin.r@edu.cl'),
('60000000-0000-4000-8000-000000000103', 'Valentina Díaz', '14.567.890-1', 'vale.d@edu.cl')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.estudiantes_cursos (id_estudiante, id_curso) VALUES
('60000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001'),
('60000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001'),
('60000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO public.apoderados_estudiantes (id_apoderado, id_estudiante, parentesco, es_principal) VALUES
('865d9b52-db83-4ec7-91d7-738f60b39bab', '60000000-0000-4000-8000-000000000101', 'Apoderado', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.sesiones_asistencia (id, id_curso_asignatura, fecha_asistencia, id_asignacion_docente) VALUES
('70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '2024-05-20', '40000000-0000-4000-8000-000000000001'),
('70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '2024-05-19', '40000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.registros_asistencia (id, id_sesion_asistencia, id_estudiante, estado, observacion) VALUES
('71000000-0000-4000-8000-000000000101', '70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', 'PRESENTE', ''),
('71000000-0000-4000-8000-000000000102', '70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'TARDANZA', 'Llegó 10 min tarde'),
('71000000-0000-4000-8000-000000000103', '70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000103', 'AUSENTE', 'Sin justificar')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.calificaciones (id, id_estudiante, id_asignacion_docente, tipo_evaluacion, descripcion, nota, ponderacion, fecha_evaluacion) VALUES
('80000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000001', 'Prueba 1', 'Prueba 1', 6.5, 30, '2024-05-10'),
('80000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000001', 'Trabajo Grupal', 'Trabajo Grupal', 5.8, 20, '2024-05-15'),
('80000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000103', '40000000-0000-4000-8000-000000000002', 'Prueba 1', 'Prueba 1', 5.5, 30, '2024-05-10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.anotaciones (id, id_estudiante, id_asignacion_docente, tipo, observacion, fecha_creacion) VALUES
('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000001', 'POSITIVA', 'Excelente participación en clase de álgebra.', '2024-05-12'),
('90000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000102', '40000000-0000-4000-8000-000000000001', 'NEGATIVA', 'Interrumpió constantemente la clase.', '2024-05-14')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.configuraciones_sistema (clave, valor) VALUES
('asistencia', '{"horaInicio":"08:00","horaLimite":"09:45","bloqueResponsable":1,"bloquesPermitidos":[1,2,3,4],"duracionBloque":45,"umbralInasistenciasReiteradas":3,"permitirRegistroFueraDeHora":false,"permitirRegistroFechasDistintasAHoy":true,"permitirDocentesAprobarJustificaciones":true}'::jsonb)
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, fecha_actualizacion = now();
