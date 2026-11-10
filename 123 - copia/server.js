const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { neon } = require('@neondatabase/serverless');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');

const BCRYPT_ROUNDS = 12;

dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env' });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no esta configurada');

const sql = neon(process.env.DATABASE_URL);
const app = express();
const PORT = process.env.PORT || 3000;
const sessions = new Map();

app.use(cors());

// Rate limiting general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1500, // límite de peticiones por ventana
  skip: (req) => !req.originalUrl.startsWith('/api/'), // no cuenta archivos estáticos (html, js, css, imágenes)
  message: { error: 'Demasiadas peticiones, intenta de nuevo en 15 minutos' }
});

// Rate limiting estricto para login: 
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true, // los logins correctos no cuentan, solo los fallidos
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' }
});

app.use(limiter);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false, // ← evita los defaults ocultos de helmet (como script-src-attr 'none')
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.tailwindcss.com",
        "https://cdn.sheetjs.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // ← ★ ESTO REVIVE TUS BOTONES (onclick, onsubmit, onchange)
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.tailwindcss.com",
        "https://fonts.googleapis.com"
      ],
      styleSrcAttr: ["'unsafe-inline'"], // ← permite style="..." inline si lo usas
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const q = (text, values = []) => sql.query(text, values);
const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function ensureDefaultBlocks() {
  const blocks = [
    [1, 'Primer bloque', '08:15', '09:00'],
    [2, 'Segundo bloque', '09:00', '09:45'],
    [3, 'Tercer bloque', '10:05', '10:50'],
    [4, 'Cuarto bloque', '10:50', '11:35'],
    [5, 'Quinto bloque', '11:55', '12:40'],
    [6, 'Sexto bloque', '12:40', '13:25'],
    [7, 'Septimo bloque', '14:10', '14:55'],
    [8, 'Octavo bloque', '14:55', '15:40']
  ];
  for (const [id, name, start, end] of blocks) {
    await q('INSERT INTO bloques_horarios (id, nombre, hora_inicio, hora_fin) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [id, name, start, end]);
  }
}

const publicUser = (row, token) => ({
  identificador: row.identificador,
  nombre: [row.nombre, row.apellido].filter(Boolean).join(' '),
  rol: row.rol,
  token
});
const userFromCredential = (row) => ({
  idCredencial: row.id_usuario,
  identificador: row.identificador,
  nombre: [row.nombre, row.apellido].filter(Boolean).join(' '),
  rol: row.rol,
  idDocente: row.rol === 'DOCENTE' ? row.id_usuario : null,
  idApoderado: row.rol === 'APODERADO' ? row.id_usuario : null,
  idEstudiante: row.id_estudiante || null,
  idInspector: row.rol === 'INSPECTOR' ? row.id_usuario : null
});

async function findUser(identifier, password) {
  const rows = await q(`
    SELECT u.id AS id_usuario, u.identificador, u.contrasena, u.rol, u.id_estudiante,
           u.nombre, u.apellido
    FROM usuarios u
    WHERE lower(u.identificador) = lower($1)
    LIMIT 1`, [identifier]);
  const row = rows[0];
  if (!row) return null;

  const ok = await verifyPassword(password, row.contrasena);
  if (!ok) return null;

  // Rehash perezoso: si el usuario todavía tiene un hash viejo (sha256 o texto plano),
  // lo reemplazamos por bcrypt ahora que sabemos que la contraseña es correcta.
  if (!row.contrasena.startsWith('$2')) {
    const nuevoHash = await hashPassword(password);
    await q('UPDATE usuarios SET contrasena = $1 WHERE id = $2', [nuevoHash, row.id_usuario]);
    row.contrasena = nuevoHash;
  }

  return row;
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  // Hash bcrypt (formato nuevo, ya migrado)
  if (stored.startsWith('$2')) return bcrypt.compare(String(password), stored);
  // Hash sha256 legado (se migra a bcrypt automáticamente si coincide, ver findUser)
  if (stored.startsWith('sha256:')) return stored.slice(7) === crypto.createHash('sha256').update(String(password)).digest('hex');
  // Texto plano legado, por si quedó algún registro sin migrar nunca
  return String(password) === stored;
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS);
}

function auth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = sessions.get(token);
  if (!user) return res.status(401).json({ error: 'Sesion expirada' });
  req.user = user;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.rol) ? next() : res.status(403).json({ error: 'No autorizado' });
}

// Middleware de validación
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Datos inválidos', 
      detalles: errors.array().map(e => ({ campo: e.path, mensaje: e.msg }))
    });
  }
  next();
};

function sendError(res, error) {
  console.error(error);
  const message = error.code === '23505' ? 'El registro ya existe.' : error.message || 'Error de base de datos';
  res.status(error.code === '23505' ? 409 : 500).json({ error: message });
}

async function getCourses(user) {
  const params = [];
  let where = '';
  if (user.rol === 'DOCENTE') {
  params.push(user.idDocente);
  where = 'WHERE dc.id_docente = $1';
  }
  return q(`SELECT DISTINCT c.id AS "idCurso", c.nombre AS "nombreCurso", c.nivel, c.anio_escolar AS "anioEscolar", c.notas_por_curso AS "notasPorCurso", c.asignatura, c.profesor_asignado AS "profesorAsignado", c.profesor_bloque1 AS "profesorBloque1", c.profesor_bloque2 AS "profesorBloque2", c.bloques_asignados AS "bloquesAsignados", c.dias_semana AS "diasSemana", c.horarios_semana AS "horariosSemana" 
    FROM cursos c LEFT JOIN docentes_cursos dc ON dc.id_curso = c.id 
    ${where} ORDER BY c.nivel, c.nombre`, params);
}

async function getStudents(user, courseId) {
  const params = [];
  let where = '';

  if (courseId) {
    params.push(Number(courseId));
    if (user.rol === 'INSPECTOR') {
    // ★ FIX INSPECTOR: la asistencia es por curso (nivel), no por asignatura.
    // Se incluyen los alumnos matriculados en CUALQUIER asignatura
    // del mismo nivel y año escolar del curso seleccionado.
    where = `AND ec.id_curso IN (
      SELECT c2.id
      FROM cursos c2
      JOIN cursos c3 ON c3.id = $1
      WHERE c2.nivel = c3.nivel
        AND c2.anio_escolar = c3.anio_escolar
    )`;
    } else {
    where = 'AND ec.id_curso = $1';
    }
  }

  if (user.rol === 'DOCENTE') {
      params.push(user.idDocente);
      where += ` AND EXISTS (
          SELECT 1
          FROM docentes_cursos dc
          WHERE dc.id_curso = ec.id_curso
            AND dc.id_docente = $${params.length}
      )`;
  }

  const rows = await q(`
      SELECT
          e.id AS "idEstudiante",
          e.nombre,
          e.apellido,
          e.rut,
          e.correo,
          ec.id_curso AS "idCurso",
          c.nombre AS "nombreCurso",
          c.nivel AS curso,
          u_apod.nombre AS "apoderadoNombre",
          u_apod.identificador AS "apoderadoCorreo"
      FROM estudiantes e
      LEFT JOIN estudiantes_cursos ec ON e.id = ec.id_estudiante
      LEFT JOIN cursos c ON ec.id_curso = c.id
      LEFT JOIN usuarios u_apod ON e.id_apoderado = u_apod.id
      WHERE TRUE ${where}
      ORDER BY e.apellido, e.nombre
  `, params);

  return rows.map(r => ({
      ...r,
      nombre: [r.nombre, r.apellido].filter(Boolean).join(' '),
      curso: r.curso || r.nombreCurso || 'Sin curso'
  }));
}

app.get('/api/test', async (req, res) => { try { res.json({ mensaje: 'Conexion activa con Neon', data: await q('SELECT NOW() AS hora_servidor') }); } catch (e) { sendError(res, e); } });

app.post('/api/auth/login', loginLimiter, [
  body('identificador')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Identificador debe tener entre 3 y 100 caracteres')
    .matches(/^[a-zA-Z0-9@._-]+$/)
    .withMessage('Identificador contiene caracteres inválidos'),
  body('contrasena')
    .isLength({ min: 4, max: 128 })
    .withMessage('Contraseña debe tener entre 4 y 128 caracteres'),
  validate
], async (req, res) => {
  try {
    const user = await findUser(req.body.identificador || '', req.body.contrasena || '');
    if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });
    const token = crypto.randomBytes(32).toString('hex');
    const sessionUser = userFromCredential(user);
    sessions.set(token, sessionUser);
    res.json({ ...publicUser(user, token), ...sessionUser });
  } catch (e) { sendError(res, e); }
});
app.post('/api/auth/logout', auth, (req, res) => { sessions.delete(req.token); res.json({ ok: true }); });
app.get('/api/auth/me', auth, (req, res) => res.json({ ...req.user, token: req.token }));

app.get('/api/cursos', auth, async (req, res) => { try { res.json(await getCourses(req.user)); } catch (e) { sendError(res, e); } });
app.post('/api/cursos', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  const b = req.body;
  if (!b.nombreCurso) return res.status(400).json({ error: 'nombreCurso es requerido' });
  await ensureDefaultBlocks();
  const rows = await q(`INSERT INTO cursos(nombre, nivel, anio_escolar, asignatura, profesor_asignado, profesor_bloque1, profesor_bloque2, bloques_asignados, dias_semana, horarios_semana) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id AS "idCurso", nombre AS "nombreCurso", nivel, anio_escolar AS "anioEscolar", notas_por_curso AS "notasPorCurso", asignatura, profesor_asignado AS "profesorAsignado"`, [
  b.nombreCurso,
  b.nivel || 'Sin nivel',
  b.anioEscolar || new Date().getFullYear(),
  b.asignatura || null,
  b.profesorAsignado || null,
  b.profesorBloque1 || b.profesorAsignado || null,
  b.profesorBloque2 || b.profesorAsignado || null,
  b.bloquesAsignados ? `{${b.bloquesAsignados.join(',')}}` : '{1,2,3,4,5,6,7,8}',
  b.diasSemana ? `{${b.diasSemana.join(',')}}` : '{1,2,3,4,5}',
  JSON.stringify(b.horariosSemana || {})
  ]);
  const course = rows[0];
  if (b.profesorAsignado) {
  const teacher = await q('SELECT id FROM usuarios WHERE lower(identificador)=lower($1) AND rol=$2', [b.profesorAsignado, 'DOCENTE']);
  if (teacher[0]) await q('INSERT INTO docentes_cursos(id_docente, id_curso) VALUES($1,$2) ON CONFLICT DO NOTHING', [teacher[0].id, course.idCurso]);
  }
  res.status(201).json(course);
  } catch (e) { sendError(res, e); }
});

app.patch('/api/cursos/:id', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  const b = req.body;
  const notas = b.notasPorCurso != null ? Math.min(10, Math.max(1, parseInt(b.notasPorCurso, 10) || 6)) : null;
  const rows = await q(`UPDATE cursos SET nombre = COALESCE($1, nombre), nivel = COALESCE($2, nivel), anio_escolar = COALESCE($3, anio_escolar), asignatura = COALESCE($4, asignatura), profesor_asignado = COALESCE($5, profesor_asignado), profesor_bloque1 = COALESCE($6, profesor_bloque1), profesor_bloque2 = COALESCE($7, profesor_bloque2), notas_por_curso = COALESCE($8, notas_por_curso), horarios_semana = COALESCE($9, horarios_semana) WHERE id = $10 RETURNING id AS "idCurso", nombre AS "nombreCurso", nivel, anio_escolar AS "anioEscolar", notas_por_curso AS "notasPorCurso", asignatura, profesor_asignado AS "profesorAsignado"`, [
  b.nombreCurso || null, b.nivel || null, b.anioEscolar || null,
  b.asignatura || null, b.profesorAsignado || null,
  b.profesorBloque1 || null, b.profesorBloque2 || null,
  notas,
  b.horariosSemana ? JSON.stringify(b.horariosSemana) : null,
  req.params.id
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Curso no encontrado' });
  if (b.profesorAsignado) {
  const teacher = await q('SELECT id FROM usuarios WHERE lower(identificador)=lower($1) AND rol=$2', [b.profesorAsignado, 'DOCENTE']);
  if (teacher[0]) {
  await q('DELETE FROM docentes_cursos WHERE id_curso = $1', [req.params.id]);
  await q('INSERT INTO docentes_cursos(id_docente, id_curso) VALUES($1,$2) ON CONFLICT DO NOTHING', [teacher[0].id, req.params.id]);
  }
  }
  res.json(rows[0]);
  } catch (e) { sendError(res, e); }
});

app.get('/api/cursos/:id/docentes', auth, async (req, res) => {
  try {
  res.json(await q(`SELECT dc.id_docente AS "idDocente", u.identificador, concat(u.nombre, ' ', COALESCE(u.apellido,'')) AS "nombreDocente", c.asignatura AS asignatura, TRUE AS "responsableAsistencia" FROM docentes_cursos dc JOIN usuarios u ON u.id = dc.id_docente JOIN cursos c ON c.id = dc.id_curso WHERE dc.id_curso = $1`, [req.params.id]));
  } catch (e) { sendError(res, e); }
});

app.get('/api/estudiantes', auth, async (req, res) => { try { res.json(await getStudents(req.user, req.query.idCurso)); } catch (e) { sendError(res, e); } });
app.post('/api/estudiantes', auth, requireRole('ADMIN'), [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/)
    .withMessage('Nombre contiene caracteres inválidos'),
  body('rut')
    .trim()
    .matches(/^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/)
    .withMessage('Formato de RUT inválido'),
  body('correo')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Correo inválido'),
  validate
], async (req, res) => {
  try {
  const b = req.body;
  const rows = await q('INSERT INTO estudiantes(rut, nombre, apellido, correo) VALUES ($1,$2,$3,$4) RETURNING id AS "idEstudiante", nombre, apellido, rut, correo', [b.rut, b.nombre, b.apellido || '', b.correo || null]);
  if (b.idCurso) await q('INSERT INTO estudiantes_cursos(id_estudiante, id_curso) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].idEstudiante, b.idCurso]);
  res.status(201).json({ ...rows[0], nombre: [rows[0].nombre, rows[0].apellido].filter(Boolean).join(' '), idCurso: b.idCurso || null });
  } catch (e) { sendError(res, e); }
});

app.patch('/api/estudiantes/:id', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  const b = req.body;
  const rows = await q('UPDATE estudiantes SET nombre=COALESCE($1,nombre), apellido=COALESCE($2,apellido), rut=COALESCE($3,rut) WHERE id=$4 RETURNING id AS "idEstudiante", nombre, apellido, rut', [b.nombre, b.apellido, b.rut, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });
  if (Array.isArray(b.cursosAsignados)) {
  const cursoIds = [];
  for (const c of b.cursosAsignados) {
  if (typeof c === 'number') { cursoIds.push(c); }
  else { const found = await q('SELECT id FROM cursos WHERE nombre = $1 LIMIT 1', [c]); if (found[0]) cursoIds.push(found[0].id); }
  }
  if (cursoIds.length > 0) {
  await q('DELETE FROM estudiantes_cursos WHERE id_estudiante = $1', [req.params.id]);
  for (const cid of cursoIds) {
  await q('INSERT INTO estudiantes_cursos(id_estudiante, id_curso) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, cid]);
  }
  }
  }
  res.json(rows[0]);
  } catch (e) { sendError(res, e); }
});

app.delete('/api/estudiantes/:id', auth, requireRole('ADMIN'), async (req, res) => { try { await q('DELETE FROM estudiantes WHERE id=$1', [req.params.id]); res.json({ ok: true }); } catch (e) { sendError(res, e); } });

async function profiles(role) {
  let extra = '';
  if (role === 'APODERADO') {
    extra = `, (SELECT e.id FROM estudiantes e WHERE e.id_apoderado = u.id ORDER BY e.id LIMIT 1) AS "pupiloId",
      COALESCE((SELECT json_agg(e.id ORDER BY e.id) FROM estudiantes e WHERE e.id_apoderado = u.id), '[]'::json) AS "pupilosIds"`;
  } else {
  extra = `, NULL::integer AS "pupiloId"`;
  }
  const rows = await q(`SELECT u.id AS "idCredencial", u.identificador, u.rol, u.id AS "idPerfil", u.nombre, u.apellido, COALESCE((SELECT json_agg(dc.id_curso ORDER BY dc.id_curso) FROM docentes_cursos dc WHERE dc.id_docente = u.id), '[]'::json) AS "cursosAsignados" ${extra} FROM usuarios u WHERE u.rol = $1 ORDER BY u.apellido, u.nombre`, [role]);
  return rows.map(r => ({
  ...r,
  nombre: [r.nombre, r.apellido].filter(Boolean).join(' '),
  cursosAsignados: Array.isArray(r.cursosAsignados) ? r.cursosAsignados : [],
  idDocente: role === 'DOCENTE' ? r.idPerfil : undefined,
  idApoderado: role === 'APODERADO' ? r.idPerfil : undefined,
  contrasena: '1234'
  }));
}

app.get('/api/docentes', auth, requireRole('ADMIN'), async (req, res) => { try { res.json(await profiles('DOCENTE')); } catch (e) { sendError(res, e); } });
app.get('/api/apoderados', auth, requireRole('ADMIN'), async (req, res) => { try { res.json(await profiles('APODERADO')); } catch (e) { sendError(res, e); } });

async function createProfile(req, res, role) {
  try {
    const b = req.body;
    const password = String(b.contrasena || '1234');
    if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    const first = b.nombre || '';
    const last = b.apellido || '';
    const identificador = b.identificador || b.correo;
    let idsPupilos = [];
    if (role === 'APODERADO') {
      for (const idEst of idsPupilos) {
        await q('UPDATE estudiantes SET id_apoderado = $1 WHERE id = $2 AND id_apoderado IS NULL', [row[0].id, idEst]);
      }
    }
    const row = await q('INSERT INTO usuarios(identificador, contrasena, nombre, apellido, rol) VALUES ($1,$2,$3,$4,$5) RETURNING id, identificador, nombre, apellido, rol', [identificador, await hashPassword(password), first, last, role]);
    if (role === 'DOCENTE' && b.cursosAsignados) {
      for (const courseId of b.cursosAsignados) {
        await q('INSERT INTO docentes_cursos(id_docente, id_curso) VALUES($1,$2) ON CONFLICT DO NOTHING', [row[0].id, courseId]);
      }
    }
    if (role === 'APODERADO') {
      const ids = Array.isArray(b.pupilosIds) ? b.pupilosIds : (b.pupiloId ? [b.pupiloId] : []);
      for (const idEst of ids) {
        await q('UPDATE estudiantes SET id_apoderado = $1 WHERE id = $2', [row[0].id, Number(idEst)]);
      }
    }
    res.status(201).json({ ...row[0], identificador, nombre: [first, last].filter(Boolean).join(' '), rol: role });
  } catch (e) { sendError(res, e); }
}
app.post('/api/docentes', auth, requireRole('ADMIN'), (req, res) => createProfile(req, res, 'DOCENTE'));
app.post('/api/apoderados', auth, requireRole('ADMIN'), (req, res) => createProfile(req, res, 'APODERADO'));
app.delete('/api/docentes/:identifier', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  await q(`DELETE FROM docentes_cursos WHERE id_docente = (SELECT id FROM usuarios WHERE lower(identificador)=lower($1) AND rol='DOCENTE')`, [req.params.identifier]);
  const rows = await q(`DELETE FROM usuarios WHERE lower(identificador)=lower($1) AND rol='DOCENTE' RETURNING id`, [req.params.identifier]);
  res.json({ ok: rows.length > 0 });
  } catch (e) { sendError(res, e); }
});

app.delete('/api/apoderados/:identifier', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  await q(`UPDATE estudiantes SET id_apoderado = NULL WHERE id_apoderado = (SELECT id FROM usuarios WHERE lower(identificador)=lower($1) AND rol='APODERADO')`, [req.params.identifier]);
  const rows = await q(`DELETE FROM usuarios WHERE lower(identificador)=lower($1) AND rol='APODERADO' RETURNING id`, [req.params.identifier]);
  res.json({ ok: rows.length > 0 });
  } catch (e) { sendError(res, e); }
});

app.patch('/api/docentes/:identifier', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  const b = req.body;
  let first = null, last = null;
  if (b.apellido) { first = String(b.nombre || '').trim() || null; last = String(b.apellido).trim() || null; }
  else { const parts = String(b.nombre || '').trim().split(/\s+/); first = parts.shift() || null; last = parts.join(' ') || null; }
  const userRow = await q(`SELECT id FROM usuarios WHERE lower(identificador)=lower($1::text) AND rol='DOCENTE'`, [req.params.identifier]);
  if (!userRow[0]) return res.status(404).json({ error: 'Docente no encontrado' });
  const idDocente = userRow[0].id;
  if (b.identificador && String(b.identificador).toLowerCase() !== String(req.params.identifier).toLowerCase()) {
  const ocupado = await q(`SELECT 1 FROM usuarios WHERE lower(identificador)=lower($1::text) AND id <> $2::bigint LIMIT 1`, [b.identificador, idDocente]);
  if (ocupado[0]) return res.status(409).json({ error: 'El registro ya existe.' });
  }
  await q(`UPDATE usuarios SET nombre=COALESCE($1::varchar, nombre), apellido=COALESCE($2::varchar, apellido), identificador=COALESCE($3::varchar, identificador), contrasena=CASE WHEN $4::varchar IS NOT NULL THEN $4::varchar ELSE contrasena END WHERE id=$5::bigint AND rol='DOCENTE'`, [first, last, b.identificador || null, b.contrasena ? await hashPassword(b.contrasena) : null, idDocente]);
  if (Array.isArray(b.cursosAsignados)) {
  await q('DELETE FROM docentes_cursos WHERE id_docente = $1::bigint', [idDocente]);
  for (const courseId of b.cursosAsignados) {
  await q('INSERT INTO docentes_cursos(id_docente, id_curso) VALUES($1::bigint,$2::bigint) ON CONFLICT DO NOTHING', [idDocente, Number(courseId)]);
  }
  }
  res.json({ ok: true, id: idDocente });
  } catch (e) { sendError(res, e); }
});

app.patch('/api/apoderados/:identifier', auth, requireRole('ADMIN'), async (req, res) => {
  try {
  const b = req.body;
  let first = null, last = null;
  if (b.apellido) { first = String(b.nombre || '').trim() || null; last = String(b.apellido).trim() || null; }
  else { const parts = String(b.nombre || '').trim().split(/\s+/); first = parts.shift() || null; last = parts.join(' ') || null; }
  const userRow = await q(`SELECT id FROM usuarios WHERE lower(identificador)=lower($1::text) AND rol='APODERADO'`, [req.params.identifier]);
  if (!userRow[0]) return res.status(404).json({ error: 'Apoderado no encontrado' });
  const idApoderado = userRow[0].id;
  const nuevos = Array.isArray(b.pupilosIds)
  ? b.pupilosIds.map(Number).filter(Boolean)
  : (b.pupiloId ? [Number(b.pupiloId)] : null);
if (nuevos && nuevos.length) {
  const ocupados = await q(`SELECT concat_ws(' ', nombre, apellido) AS nombre FROM estudiantes WHERE id = ANY($1::bigint[]) AND id_apoderado IS NOT NULL AND id_apoderado <> $2::bigint`, [`{${nuevos.join(',')}}`, idApoderado]);
  if (ocupados.length) return res.status(409).json({ error: `Estos alumnos ya tienen otro apoderado: ${ocupados.map(o => o.nombre).join(', ')}` });
}
  if (b.identificador && String(b.identificador).toLowerCase() !== String(req.params.identifier).toLowerCase()) {
  const ocupado = await q(`SELECT 1 FROM usuarios WHERE lower(identificador)=lower($1::text) AND id <> $2::bigint LIMIT 1`, [b.identificador, idApoderado]);
  if (ocupado[0]) return res.status(409).json({ error: 'El registro ya existe.' });
  }
  await q(`UPDATE usuarios SET nombre=COALESCE($1::varchar, nombre), apellido=COALESCE($2::varchar, apellido), identificador=COALESCE($3::varchar, identificador), contrasena=CASE WHEN $4::varchar IS NOT NULL THEN $4::varchar ELSE contrasena END WHERE id=$5::bigint AND rol='APODERADO'`, [first, last, b.identificador || null, b.contrasena ? await hashPassword(b.contrasena) : null, idApoderado]);
  if (nuevos) {
    await q('UPDATE estudiantes SET id_apoderado = NULL WHERE id_apoderado = $1::bigint', [idApoderado]);
    for (const idEst of nuevos) {
      await q('UPDATE estudiantes SET id_apoderado = $1::bigint WHERE id = $2::bigint', [idApoderado, idEst]);
    }
  }
  res.json({ ok: true, id: idApoderado });
  } catch (e) { sendError(res, e); }
});

// ════════════════════════════════════════════════════════
//  ASISTENCIA: permisos, trazabilidad, auditoría y notificaciones
// ════════════════════════════════════════════════════════
const VENTANA_REGISTRO = { inicio: '08:15', fin: '09:45', bloquesCreacion: [1, 2] };
const ahoraHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const hoyISO = () => new Date().toISOString().slice(0, 10);

function puedeRegistrarAsistencia(user, { crear, fecha, idBloque }) {
  if (user.rol === 'ADMIN') return true;

  if (user.rol === 'INSPECTOR') {
      // MODIFICAR registros existentes: permitido durante todo el día.
      if (!crear) return true;

      // CREAR registros nuevos: solo bloques 1 y 2.
      if (!VENTANA_REGISTRO.bloquesCreacion.includes(Number(idBloque || 1))) {
          return false;
      }

      // Si es hoy, CREAR solo dentro de la ventana 08:15 a 09:45.
      if (fecha === hoyISO()) {
          const ahora = ahoraHHMM();
          return ahora >= VENTANA_REGISTRO.inicio && ahora <= VENTANA_REGISTRO.fin;
      }

      // Fechas pasadas o futuras: permitir creación solo en bloques 1 y 2.
      return true;
  }

  if (user.rol === 'DOCENTE') return !crear;

  return false;
}

async function docenteTieneCurso(user, idCurso) {
  if (!user.idDocente) return false;
  const rows = await q('SELECT 1 FROM docentes_cursos WHERE id_curso=$1 AND id_docente=$2 LIMIT 1', [Number(idCurso), user.idDocente]);
  return Boolean(rows[0]);
}

async function notificarApoderadoAsistencia(idEstudiante, fecha, estado) {
  try {
    if (!['AUSENTE', 'TARDANZA'].includes(estado)) return;
    const titulo = estado === 'AUSENTE' ? '📋 Inasistencia registrada' : '⏰ Atraso registrado';
    const est = await q(`SELECT concat_ws(' ', nombre, apellido) AS nombre FROM estudiantes WHERE id=$1`, [idEstudiante]);
    const nombreEstudiante = est[0]?.nombre || 'El estudiante';
    const guardianes = await q('SELECT u.id FROM usuarios u JOIN estudiantes e ON e.id_apoderado = u.id WHERE e.id = $1 AND u.rol = $2', [idEstudiante, 'APODERADO']);
    for (const g of guardianes) {
      const dup = await q('SELECT 1 FROM notificaciones WHERE id_usuario=$1 AND titulo=$2 AND mensaje LIKE $3 LIMIT 1', [g.id, titulo, `%${fecha}%`]);
      if (dup[0]) continue;
      await q('INSERT INTO notificaciones(id_usuario, titulo, mensaje, icono) VALUES($1,$2,$3,$4)', [g.id, titulo, `${nombreEstudiante} fue registrado/a como ${estado} el día ${fecha}.`, estado === 'AUSENTE' ? '📋' : '⏰']);
    }
  } catch (e) { console.error('Notificación de asistencia:', e.message); }
}

app.get('/api/asistencia', auth, async (req, res) => {
  try {
      const p = [];
      let where = '';

      if (req.query.idCurso) {
        p.push(Number(req.query.idCurso));
        // La asistencia registrada por Inspector/Admin se considera diaria
        // y asociada al estudiante, no a una asignatura específica.
        if (req.user.rol === 'INSPECTOR') {
            // ★ FIX INSPECTOR: coincide con getStudents(). Trae los registros
            // de alumnos matriculados en CUALQUIER asignatura del mismo
            // nivel y año escolar del curso seleccionado.
            where = `AND EXISTS (
                SELECT 1
                FROM estudiantes_cursos ec
                JOIN cursos c2 ON c2.id = ec.id_curso
                JOIN cursos c3 ON c3.id = $1
                WHERE ec.id_estudiante = a.id_estudiante
                  AND c2.nivel = c3.nivel
                  AND c2.anio_escolar = c3.anio_escolar
            )`;
        } else {
            where = `AND EXISTS (
                SELECT 1
                FROM estudiantes_cursos ec
                WHERE ec.id_estudiante = a.id_estudiante
                  AND ec.id_curso = $1
            )`;
        }
    }

      if (req.query.fecha) {
          p.push(req.query.fecha);
          where += ` AND a.fecha=$${p.length}`;
      }

      if (req.user.rol === 'DOCENTE') {
          p.push(req.user.idDocente);

          where += ` AND EXISTS (
              SELECT 1
              FROM estudiantes_cursos ec
              JOIN docentes_cursos dc ON dc.id_curso = ec.id_curso
              WHERE ec.id_estudiante = a.id_estudiante
                AND dc.id_docente = $${p.length}
          )`;
      }

      if (req.user.rol === 'APODERADO') {
          p.push(req.user.idApoderado);

          where += ` AND EXISTS (
              SELECT 1
              FROM estudiantes e
              WHERE e.id = a.id_estudiante
                AND e.id_apoderado = $${p.length}
          )`;
      }

      const rows = await q(`
          SELECT
              a.id AS "idAsistencia",
              a.id_estudiante AS "idEstudiante",
              a.id_curso AS "idCurso",
              a.id_bloque AS "idBloque",
              a.id_bloque AS "idBloqueRegistro",
              a.fecha,
              a.estado,
              a.observacion,
              a.creado_el AS "creadoEl",
              a.actualizado_en AS "actualizadoEn",
              a.creado_por AS "creadoPor",
              a.modificado_por AS "modificadoPor",
              j.id AS "idJustificacion",
              j.motivo AS "justificacionMotivo",
              j.estado_justificacion AS "justificacionEstado",
              j.observacion AS "justificacionObservacion"
          FROM asistencia a
          LEFT JOIN justificaciones j
              ON j.id_estudiante = a.id_estudiante
             AND j.fecha = a.fecha
             AND j.id_curso = a.id_curso
          WHERE TRUE ${where}
          ORDER BY a.fecha DESC
      `, p);

      res.json(rows.map(r => ({
          ...r,
          fecha: toDate(r.fecha),
          justificacion: r.idJustificacion
              ? {
                  motivo: r.justificacionMotivo,
                  estadoJustificacion: r.justificacionEstado,
                  observacion: r.justificacionObservacion
              }
              : null
      })));
  } catch (e) {
      sendError(res, e);
  }
});

app.put('/api/asistencia', auth, async (req, res) => {
  try {
      const user = req.user;

      if (!['ADMIN', 'INSPECTOR', 'DOCENTE'].includes(user.rol)) {
          return res.status(403).json({ error: 'No autorizado para registrar asistencia' });
      }

      const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
      const out = [];

      for (const item of items) {
          const idCurso = Number(item.idCurso);
          const fecha = item.fecha || req.body.fecha;
          const idBloque = Number(item.idBloque || 1);
          const estado = String(item.estado || 'PRESENTE').toUpperCase();

          if (!idCurso || !fecha) {
              return res.status(400).json({
                  error: 'Debe indicar curso y fecha para guardar asistencia'
              });
          }

          const esAsistenciaDiaria = ['ADMIN', 'INSPECTOR'].includes(user.rol);

          if (esAsistenciaDiaria) {
              // Buscar si ya existe asistencia para ese estudiante en esa fecha.
              const registrosDelDia = await q(
                  `SELECT id
                   FROM asistencia
                   WHERE id_estudiante=$1
                     AND fecha=$2`,
                  [item.idEstudiante, fecha]
              );

              const esCreacion = registrosDelDia.length === 0;

              if (!puedeRegistrarAsistencia(user, { crear: esCreacion, fecha, idBloque })) {
                  return res.status(403).json({
                      error: esCreacion
                          ? 'No puede crear asistencia nueva fuera de la ventana de los bloques 1 y 2 (08:15 a 09:45). Solo puede modificar asistencia ya registrada.'
                          : 'No tiene permisos para modificar la asistencia'
                  });
              }

              const nombreUsuario = [user.nombre, user.apellido].filter(Boolean).join(' ');
              let r;

              if (esCreacion) {
                  r = await q(
                      `INSERT INTO asistencia(
                          id_estudiante,
                          id_curso,
                          id_bloque,
                          fecha,
                          estado,
                          observacion,
                          creado_por,
                          creado_identificador,
                          modificado_por,
                          modificado_identificador
                      )
                      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7,$8)
                      RETURNING
                          id AS "idAsistencia",
                          id_estudiante AS "idEstudiante",
                          id_curso AS "idCurso",
                          id_bloque AS "idBloqueRegistro",
                          fecha,
                          estado,
                          observacion,
                          creado_el AS "creadoEl",
                          actualizado_en AS "actualizadoEn"`,
                      [
                          item.idEstudiante,
                          idCurso,
                          idBloque,
                          fecha,
                          estado,
                          item.observacion || null,
                          nombreUsuario,
                          user.identificador
                      ]
                  );
              } else {
                  r = await q(
                      `UPDATE asistencia
                       SET
                          estado=$1,
                          observacion=$2,
                          actualizado_en=CURRENT_TIMESTAMP,
                          modificado_por=$3,
                          modificado_identificador=$4
                       WHERE id_estudiante=$5
                         AND fecha=$6
                       RETURNING
                          id AS "idAsistencia",
                          id_estudiante AS "idEstudiante",
                          id_curso AS "idCurso",
                          id_bloque AS "idBloqueRegistro",
                          fecha,
                          estado,
                          observacion,
                          creado_el AS "creadoEl",
                          actualizado_en AS "actualizadoEn"`,
                      [
                          estado,
                          item.observacion || null,
                          nombreUsuario,
                          user.identificador,
                          item.idEstudiante,
                          fecha
                      ]
                  );
              }

              await notificarApoderadoAsistencia(item.idEstudiante, fecha, estado);

              if (r[0]) {
                  out.push(r[0]);
              }
          } else {
              // Flujo docente
              const existente = await q(
                  `SELECT id, estado
                   FROM asistencia
                   WHERE id_estudiante=$1
                     AND fecha=$2
                     AND id_bloque=$3
                   LIMIT 1`,
                  [item.idEstudiante, fecha, idBloque]
              );

              const esCreacion = !existente[0];

              if (!puedeRegistrarAsistencia(user, { crear: esCreacion, fecha, idBloque })) {
                  return res.status(403).json({
                      error: esCreacion
                          ? 'No puede crear registros de asistencia en este bloque/fecha.'
                          : 'No tiene permisos para modificar la asistencia'
                  });
              }

              if (!esCreacion && !(await docenteTieneCurso(user, idCurso))) {
                  return res.status(403).json({
                      error: 'No tiene permisos para modificar la asistencia de este curso'
                  });
              }

              const r = await q(
                  `INSERT INTO asistencia(
                      id_estudiante,
                      id_curso,
                      id_bloque,
                      fecha,
                      estado,
                      observacion,
                      creado_por,
                      creado_identificador,
                      modificado_por,
                      modificado_identificador
                  )
                  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7,$8)
                  ON CONFLICT(id_estudiante, fecha, id_bloque) DO UPDATE SET
                      estado=EXCLUDED.estado,
                      observacion=EXCLUDED.observacion,
                      actualizado_en=CURRENT_TIMESTAMP,
                      modificado_por=EXCLUDED.modificado_por,
                      modificado_identificador=EXCLUDED.modificado_identificador
                  RETURNING
                      id AS "idAsistencia",
                      id_estudiante AS "idEstudiante",
                      id_curso AS "idCurso",
                      id_bloque AS "idBloqueRegistro",
                      fecha,
                      estado,
                      observacion,
                      creado_el AS "creadoEl",
                      actualizado_en AS "actualizadoEn"`,
                  [
                      item.idEstudiante,
                      idCurso,
                      idBloque,
                      fecha,
                      estado,
                      item.observacion || null,
                      [user.nombre, user.apellido].filter(Boolean).join(' '),
                      user.identificador
                  ]
              );

              await notificarApoderadoAsistencia(item.idEstudiante, fecha, estado);

              out.push(r[0]);
          }
      }

      res.json(out);
  } catch (e) {
      sendError(res, e);
  }
});

app.get('/api/calificaciones', auth, async (req, res) => {
  try {
    const p = [];
    let where = '';
    if (req.query.idCurso) { p.push(Number(req.query.idCurso)); where = 'AND cl.id_curso=$1'; }
    if (req.user.rol === 'DOCENTE') { p.push(req.user.idDocente); where += ` AND EXISTS (SELECT 1 FROM docentes_cursos dc WHERE dc.id_curso=cl.id_curso AND dc.id_docente=$${p.length})`; }
    if (req.user.rol === 'APODERADO') { p.push(req.user.idApoderado); where += ` AND EXISTS (SELECT 1 FROM estudiantes e WHERE e.id=cl.id_estudiante AND e.id_apoderado=$${p.length})`; }
    const rows = await q(`SELECT cl.id AS "idCalificacion", cl.id_estudiante AS "idEstudiante", concat(es.nombre, ' ', COALESCE(es.apellido,'')) AS "nombreEstudiante", cl.id_curso AS "idCurso", cl.nota, cl.coeficiente, cl.descripcion, cl.tipo_evaluacion AS "tipoEvaluacion", cl.ponderacion, cl.fecha_nota AS "fechaNota", cl.fecha_registro AS "fechaRegistro", cl.asignatura, cl.posicion, c.nombre AS "nombreCurso" FROM calificaciones cl JOIN estudiantes es ON es.id = cl.id_estudiante LEFT JOIN cursos c ON c.id = cl.id_curso WHERE TRUE ${where} ORDER BY cl.fecha_nota DESC`, p);
    res.json(rows.map(r => ({ ...r, fechaNota: toDate(r.fechaNota), fechaRegistro: toDate(r.fechaRegistro) })));
  } catch (e) { sendError(res, e); }
});

app.post('/api/calificaciones', auth, requireRole('DOCENTE', 'ADMIN'), [
  body('idEstudiante').isInt({ min: 1 }),
  body('idCurso').isInt({ min: 1 }),
  body('nota')
    .isFloat({ min: 2.0, max: 7.0 })
    .withMessage('La nota debe estar entre 2.0 y 7.0'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 200 }),
  body('fechaNota')
    .optional()
    .isISO8601()
    .withMessage('Fecha inválida'),
  body('posicion').optional({ nullable: true }).isInt({ min: 1, max: 10 }),
  validate
], async (req, res) => {
  try {
    const b = req.body;
    const notaNum = parseFloat(b.nota);
    if (isNaN(notaNum) || notaNum < 2 || notaNum > 7) return res.status(400).json({ error: 'La nota debe estar entre 2.0 y 7.0' });
    const pos = parseInt(b.posicion, 10) || null;
    if (pos) {
      const ocupada = await q('SELECT 1 FROM calificaciones WHERE id_estudiante=$1 AND id_curso=$2 AND posicion=$3 LIMIT 1', [b.idEstudiante, b.idCurso, pos]);
      if (ocupada[0]) return res.status(409).json({ error: `La Nota ${pos} de este alumno ya está registrada.` });
    }
    const r = await q(`INSERT INTO calificaciones(id_estudiante, id_curso, nota, tipo_evaluacion, descripcion, coeficiente, ponderacion, fecha_nota, asignatura, posicion) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id AS "idCalificacion", id_estudiante AS "idEstudiante", id_curso AS "idCurso", nota, coeficiente, tipo_evaluacion AS "tipoEvaluacion", descripcion, fecha_nota AS "fechaNota", posicion`, [b.idEstudiante, b.idCurso, notaNum, b.tipoEvaluacion || 'Evaluación', b.descripcion || null, b.coeficiente || 1, b.ponderacion || 0, b.fechaNota || new Date().toISOString().slice(0, 10), b.asignatura || null, pos]);
    res.status(201).json(r[0]);
  } catch (e) { sendError(res, e); }
});
app.patch('/api/calificaciones/:id', auth, requireRole('DOCENTE', 'ADMIN'), async (req, res) => {
  try {
    if (req.body.nota != null) { const n = parseFloat(req.body.nota); if (isNaN(n) || n < 2 || n > 7) return res.status(400).json({ error: 'La nota debe estar entre 2.0 y 7.0' }); }
    const r = await q(`UPDATE calificaciones SET nota=COALESCE($1,nota), descripcion=COALESCE($2,descripcion), fecha_nota=COALESCE($3,fecha_nota) WHERE id=$4 RETURNING id AS "idCalificacion", nota, descripcion, fecha_nota AS "fechaNota"`, [req.body.nota || null, req.body.descripcion || null, req.body.fechaNota || null, req.params.id]);
    if (!r[0]) return res.status(404).json({ error: 'Calificación no encontrada' });
    res.json(r[0]);
  } catch (e) { sendError(res, e); }
});
app.delete('/api/calificaciones/:id', auth, requireRole('DOCENTE', 'ADMIN'), async (req, res) => { try { await q('DELETE FROM calificaciones WHERE id=$1', [req.params.id]); res.json({ ok: true }); } catch (e) { sendError(res, e); } });

app.get('/api/anotaciones', auth, async (req, res) => {
  try {
    const p = [];
    let where = '';
    if (req.user.rol === 'DOCENTE') { p.push(req.user.idDocente); where = `AND EXISTS (SELECT 1 FROM docentes_cursos dc WHERE dc.id_curso = an.id_curso AND dc.id_docente = $${p.length})`; }
    if (req.user.rol === 'APODERADO') { p.push(req.user.idApoderado); where = `AND EXISTS (SELECT 1 FROM estudiantes e WHERE e.id = an.id_estudiante AND e.id_apoderado = $${p.length})`; }
    const rows = await q(`SELECT an.id, an.id_estudiante AS "idEstudiante", concat(es.nombre, ' ', COALESCE(es.apellido,'')) AS "nombreEstudiante", an.id_curso AS "idCurso", an.tipo AS "tipoAnotacion", an.observacion, an.detalles, an.nombre_docente AS "nombreDocente", an.fecha_registro AS "fechaRegistro", c.nombre AS "nombreCurso" FROM anotaciones an JOIN estudiantes es ON es.id = an.id_estudiante LEFT JOIN cursos c ON c.id = an.id_curso WHERE TRUE ${where} ORDER BY an.fecha_registro DESC`, p);
    res.json(rows.map(r => ({ ...r, fechaRegistro: toDate(r.fechaRegistro) })));
  } catch (e) { sendError(res, e); }
});
app.post('/api/anotaciones', auth, requireRole('DOCENTE', 'ADMIN'), async (req, res) => {
  try {
    const b = req.body;
    const r = await q('INSERT INTO anotaciones(id_estudiante, id_curso, tipo, observacion, detalles, nombre_docente, identificador_docente) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [b.idEstudiante, b.idCurso || null, b.tipoAnotacion || b.tipo || 'NEGATIVA', b.detalles || b.observacion || '', b.detalles || null, [req.user.nombre, req.user.apellido].filter(Boolean).join(' '), req.user.identificador]);
    res.status(201).json(r[0]);
  } catch (e) { sendError(res, e); }
});

app.get('/api/materiales', auth, async (req, res) => {
  try {
    const p = [];
    let where = '';
    if (req.query.idCurso) { p.push(Number(req.query.idCurso)); where = `AND m.id_curso=$${p.length}`; }
    if (req.user.rol === 'DOCENTE') { p.push(req.user.idDocente); where += ` AND EXISTS (SELECT 1 FROM docentes_cursos dc WHERE dc.id_curso=m.id_curso AND dc.id_docente=$${p.length})`; }
    if (req.user.rol === 'APODERADO') {
      p.push(req.user.idApoderado);
      const iApo = p.length;
      let filtroPupilo = '';
      if (req.query.idEstudiante) { p.push(Number(req.query.idEstudiante)); filtroPupilo = ` AND e.id=$${p.length}`; }
      where += ` AND EXISTS (SELECT 1 FROM estudiantes_cursos ec JOIN estudiantes e ON e.id=ec.id_estudiante WHERE e.id_apoderado=$${iApo} AND ec.id_curso=m.id_curso${filtroPupilo})`;
    }
    res.json(await q(`SELECT m.id AS "idMaterial", m.titulo, m.asignatura, m.tipo_archivo AS "tipoArchivo", m.contenido, m.id_curso AS "idCurso", c.nombre AS "nombreCurso" FROM materiales m LEFT JOIN cursos c ON c.id = m.id_curso WHERE TRUE ${where} ORDER BY m.fecha_creacion DESC`, p));
  } catch (e) { sendError(res, e); }
});
app.post('/api/materiales', auth, requireRole('DOCENTE', 'ADMIN'), async (req, res) => {
  try {
    const b = req.body;
    const r = await q('INSERT INTO materiales(id_curso, titulo, tipo_archivo, contenido, subido_por, asignatura) VALUES($1,$2,$3,$4,$5, COALESCE($6, (SELECT asignatura FROM cursos WHERE id = $1::bigint))) RETURNING id AS "idMaterial", titulo', [b.idCurso, b.titulo || 'Material', b.tipoArchivo || 'OTRO', b.contenido || '', [req.user.nombre, req.user.apellido].filter(Boolean).join(' '), b.asignatura || null]);
    res.status(201).json(r[0]);
  } catch (e) { sendError(res, e); }
});
app.delete('/api/materiales/:id', auth, requireRole('DOCENTE', 'ADMIN'), async (req, res) => { try { await q('DELETE FROM materiales WHERE id=$1', [req.params.id]); res.json({ ok: true }); } catch (e) { sendError(res, e); } });
app.get('/api/materiales/:id/descargar', auth, async (req, res) => {
  try {
    const rows = await q('SELECT contenido AS url, titulo FROM materiales WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Material no encontrado' });
    if (String(rows[0].url).startsWith('data:')) {
      const match = String(rows[0].url).match(/^data:([^;]+);base64,(.*)$/);
      if (match) { res.setHeader('Content-Type', match[1]); return res.send(Buffer.from(match[2], 'base64')); }
    }
    res.redirect(rows[0].url);
  } catch (e) { sendError(res, e); }
});

app.get('/api/justificaciones', auth, async (req, res) => {
  try {
    const p = [];
    let where = '';
    if (req.query.idEstudiante) { p.push(Number(req.query.idEstudiante)); where = 'AND j.id_estudiante=$1'; }
    if (req.query.fecha) { p.push(req.query.fecha); where += ` AND j.fecha=$${p.length}`; }
    res.json(await q(`SELECT j.id AS "idJustificacion", j.id_estudiante AS "idEstudiante", j.id_curso AS "idCurso", j.fecha, j.motivo, j.documento_nombre AS "documentoNombre", j.estado_justificacion AS "estadoJustificacion"
      FROM justificaciones j WHERE TRUE ${where} ORDER BY j.creado_el DESC`, p));
  } catch (e) { sendError(res, e); }
});
app.post('/api/justificaciones', auth, async (req, res) => {
  try {
    const b = req.body;
    const r = await q(`INSERT INTO justificaciones(id_estudiante, id_curso, fecha, motivo, estado_justificacion, observacion, documento_nombre, creado_por, creado_identificador) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id_estudiante, fecha, id_curso) DO UPDATE SET motivo=EXCLUDED.motivo, estado_justificacion=EXCLUDED.estado_justificacion, observacion=EXCLUDED.observacion, documento_nombre=EXCLUDED.documento_nombre, modificado_por=EXCLUDED.creado_por, modificado_identificador=EXCLUDED.creado_identificador, modificado_el=CURRENT_TIMESTAMP RETURNING id AS "idJustificacion", estado_justificacion AS "estadoJustificacion"`, [b.idEstudiante, b.idCurso, b.fecha, b.motivo || '', b.estadoJustificacion || 'PENDIENTE', b.observacion || null, b.documentoNombre || null, [req.user.nombre, req.user.apellido].filter(Boolean).join(' '), req.user.identificador]);
    res.status(201).json(r[0] || { ok: true });
  } catch (e) { sendError(res, e); }
});

app.get('/api/notificaciones', auth, async (req, res) => { try { res.json(await q('SELECT id, titulo, mensaje, icono, leida, fecha, titulo AS tipo, NULL AS link, NULL AS color FROM notificaciones WHERE id_usuario=$1 ORDER BY fecha DESC', [req.user.idCredencial])); } catch (e) { sendError(res, e); } });
app.patch('/api/notificaciones/:id/leida', auth, async (req, res) => { try { await q('UPDATE notificaciones SET leida=TRUE WHERE id=$1 AND id_usuario=$2', [req.params.id, req.user.idCredencial]); res.json({ ok: true }); } catch (e) { sendError(res, e); } });
app.post('/api/notificaciones/leidas', auth, async (req, res) => { try { await q('UPDATE notificaciones SET leida=TRUE WHERE id_usuario=$1', [req.user.idCredencial]); res.json({ ok: true }); } catch (e) { sendError(res, e); } });

app.get('/api/guardian', auth, requireRole('APODERADO'), async (req, res) => {
  try {
    const students = await q(`SELECT e.id AS "idEstudiante", e.nombre, e.apellido, e.rut, c.nombre AS "nombreCurso", c.nivel AS curso FROM estudiantes e LEFT JOIN estudiantes_cursos ec ON ec.id_estudiante = e.id LEFT JOIN cursos c ON c.id = ec.id_curso WHERE e.id_apoderado = $1`, [req.user.idApoderado]);
    const id = req.query.idEstudiante || students[0]?.idEstudiante;
    res.json({ students, idEstudiante: id || null });
  } catch (e) { sendError(res, e); }
});

// ════════════════════════════════════════════════════════
//  CALENDARIO DE ACTIVIDADES (solo ADMIN edita; todos ven)
// ════════════════════════════════════════════════════════
app.get('/api/actividades', auth, async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
    const rows = await q(
      `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, titulo, descripcion
       FROM actividades
       WHERE EXTRACT(YEAR FROM fecha) = $1
       ORDER BY fecha, id`, [anio]);
    res.json(rows);
  } catch (e) { sendError(res, e); }
});

app.post('/api/actividades', auth, requireRole('ADMIN'), [
  body('fecha').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Fecha inválida'),
  body('titulo').trim().isLength({ min: 2, max: 150 }).withMessage('El título debe tener entre 2 y 150 caracteres'),
  body('descripcion').optional({ nullable: true }).isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const b = req.body;
    const r = await q(
      `INSERT INTO actividades(fecha, titulo, descripcion, creado_por)
       VALUES($1,$2,$3,$4)
       RETURNING id, to_char(fecha,'YYYY-MM-DD') AS fecha, titulo, descripcion`,
      [b.fecha, b.titulo, b.descripcion || null, [req.user.nombre, req.user.apellido].filter(Boolean).join(' ')]);
    res.status(201).json(r[0]);
  } catch (e) { sendError(res, e); }
});

app.patch('/api/actividades/:id', auth, requireRole('ADMIN'), [
  body('fecha').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Fecha inválida'),
  body('titulo').optional().trim().isLength({ min: 2, max: 150 }),
  body('descripcion').optional({ nullable: true }).isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const b = req.body;
    const r = await q(
      `UPDATE actividades
       SET fecha = COALESCE($1::date, fecha),
           titulo = COALESCE($2, titulo),
           descripcion = $3
       WHERE id = $4
       RETURNING id, to_char(fecha,'YYYY-MM-DD') AS fecha, titulo, descripcion`,
      [b.fecha || null, b.titulo || null, b.descripcion || null, req.params.id]);
    if (!r[0]) return res.status(404).json({ error: 'Actividad no encontrada' });
    res.json(r[0]);
  } catch (e) { sendError(res, e); }
});

app.delete('/api/actividades/:id', auth, requireRole('ADMIN'), async (req, res) => {
  try {
    await q('DELETE FROM actividades WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { sendError(res, e); }
});

// ════════════════════════════════════════════════════════
//  CALENDARIO DE EVALUACIONES
//  DOCENTE (del curso) crea/edita/elimina · ADMIN y APODERADO solo ven
// ════════════════════════════════════════════════════════
app.get('/api/evaluaciones-calendario', auth, requireRole('DOCENTE', 'ADMIN', 'APODERADO'), async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
    const p = [anio];
    let where = '';
    let puedeEditar = 'FALSE';
    if (req.user.rol === 'DOCENTE') {
      p.push(req.user.idDocente);
      const n = p.length;
      // Ve sus cursos + cursos de otros docentes que comparten alumnos con él
      where = `AND (
        EXISTS (SELECT 1 FROM docentes_cursos dc WHERE dc.id_curso = ev.id_curso AND dc.id_docente = $${n})
        OR EXISTS (
          SELECT 1 FROM estudiantes_cursos ec_otro
          JOIN estudiantes_cursos ec_mio ON ec_mio.id_estudiante = ec_otro.id_estudiante
          JOIN docentes_cursos dcm ON dcm.id_curso = ec_mio.id_curso AND dcm.id_docente = $${n}
          WHERE ec_otro.id_curso = ev.id_curso
        )
      )`;
      puedeEditar = `EXISTS (SELECT 1 FROM docentes_cursos dc2 WHERE dc2.id_curso = ev.id_curso AND dc2.id_docente = $${n})`;
    } else if (req.user.rol === 'APODERADO') {
      p.push(req.user.idApoderado);
      const iApo = p.length;
      let filtroPupilo = '';
      if (req.query.idEstudiante) { p.push(Number(req.query.idEstudiante)); filtroPupilo = ` AND e.id = $${p.length}`; }
      where = `AND EXISTS (
        SELECT 1 FROM estudiantes_cursos ec
        JOIN estudiantes e ON e.id = ec.id_estudiante
        WHERE ec.id_curso = ev.id_curso AND e.id_apoderado = $${iApo}${filtroPupilo})`;
    }
    const rows = await q(
      `SELECT ev.id, ev.id_curso AS "idCurso", c.nombre AS "nombreCurso",
              to_char(ev.fecha, 'YYYY-MM-DD') AS fecha,
              ev.titulo, ev.descripcion, ev.creado_por AS "creadoPor",
              ${puedeEditar} AS "puedeEditar"
       FROM evaluaciones_calendario ev
       LEFT JOIN cursos c ON c.id = ev.id_curso
       WHERE EXTRACT(YEAR FROM ev.fecha) = $1 ${where}
       ORDER BY ev.fecha, ev.id`, p);
    res.json(rows);
  } catch (e) { sendError(res, e); }
});

app.post('/api/evaluaciones-calendario', auth, requireRole('DOCENTE'), [
  body('idCurso').isInt({ min: 1 }).withMessage('Curso inválido'),
  body('fecha').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Fecha inválida'),
  body('titulo').trim().isLength({ min: 2, max: 150 }).withMessage('El título debe tener entre 2 y 150 caracteres'),
  body('descripcion').optional({ nullable: true }).isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const b = req.body;
    if (!(await docenteTieneCurso(req.user, b.idCurso))) {
      return res.status(403).json({ error: 'Solo el docente asignado a este curso puede agregar evaluaciones' });
    }
    const r = await q(
      `INSERT INTO evaluaciones_calendario(id_curso, fecha, titulo, descripcion, creado_por, creado_identificador)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id, id_curso AS "idCurso", to_char(fecha,'YYYY-MM-DD') AS fecha, titulo, descripcion`,
      [Number(b.idCurso), b.fecha, b.titulo, b.descripcion || null,
       [req.user.nombre, req.user.apellido].filter(Boolean).join(' '), req.user.identificador]);
    res.status(201).json(r[0]);
  } catch (e) { sendError(res, e); }
});

app.patch('/api/evaluaciones-calendario/:id', auth, requireRole('DOCENTE'), [
  body('idCurso').optional().isInt({ min: 1 }),
  body('fecha').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Fecha inválida'),
  body('titulo').optional().trim().isLength({ min: 2, max: 150 }),
  body('descripcion').optional({ nullable: true }).isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const b = req.body;
    const actual = await q('SELECT id_curso FROM evaluaciones_calendario WHERE id=$1', [req.params.id]);
    if (!actual[0]) return res.status(404).json({ error: 'Evaluación no encontrada' });
    if (!(await docenteTieneCurso(req.user, actual[0].id_curso)) ||
        (b.idCurso && !(await docenteTieneCurso(req.user, b.idCurso)))) {
      return res.status(403).json({ error: 'Solo el docente asignado a este curso puede editar esta evaluación' });
    }
    const r = await q(
      `UPDATE evaluaciones_calendario
       SET id_curso = COALESCE($1::bigint, id_curso),
           fecha = COALESCE($2::date, fecha),
           titulo = COALESCE($3, titulo),
           descripcion = $4
       WHERE id = $5
       RETURNING id, id_curso AS "idCurso", to_char(fecha,'YYYY-MM-DD') AS fecha, titulo, descripcion`,
      [b.idCurso || null, b.fecha || null, b.titulo || null, b.descripcion || null, req.params.id]);
    res.json(r[0]);
  } catch (e) { sendError(res, e); }
});

app.delete('/api/evaluaciones-calendario/:id', auth, requireRole('DOCENTE'), async (req, res) => {
  try {
    const actual = await q('SELECT id_curso FROM evaluaciones_calendario WHERE id=$1', [req.params.id]);
    if (!actual[0]) return res.status(404).json({ error: 'Evaluación no encontrada' });
    if (!(await docenteTieneCurso(req.user, actual[0].id_curso))) {
      return res.status(403).json({ error: 'Solo el docente asignado a este curso puede eliminar esta evaluación' });
    }
    await q('DELETE FROM evaluaciones_calendario WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { sendError(res, e); }
});

app.use(express.static(path.join(__dirname, 'Proyecto')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Proyecto/pages/12.html')));
app.listen(PORT, () => console.log(`Servidor SIGA en http://localhost:${PORT}`));