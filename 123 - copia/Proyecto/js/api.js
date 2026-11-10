/** Cliente REST de SIGA. La base de datos se consulta exclusivamente mediante el servidor. */

const API_BASE = '/api';
const MOCK_DB = { users: [], cursos: [], estudiantes: [], asistencia: [], calificaciones: [], anotaciones: [], materiales: [], justificaciones: [], notificaciones: [], bloques: [], horarios: [], alertas: [], configuracion: { asistencia: {} }, asistenciaAuditoria: [] };
let authToken = localStorage.getItem('siga_token') || '';
let authUser = null;

function setToken(token) { authToken = token || ''; if (authToken) localStorage.setItem('siga_token', authToken); else localStorage.removeItem('siga_token'); }
function getCurrentUser() { return authUser; }
function getDocenteCursosIds() { return (authUser?.cursosAsignados || []).map(Number); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function hoyLocalStr() { return todayStr(); }
function delay() { return Promise.resolve(); }
function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// Los BIGINT de Postgres (Neon) llegan como string en el JSON (id, idCurso,
// idEstudiante, idDocente, idApoderado, etc.) para no perder precisión.
// El frontend los compara en varios lados con === contra numbers, así que
// normalizamos esos campos a Number apenas entran, en un solo punto.
const ID_KEYS = /^(id|idCurso|idEstudiante|idDocente|idApoderado|idCredencial|idPerfil|idAsistencia|idBloque|idBloqueRegistro|idCalificacion|idMaterial|idJustificacion|idInspector|pupiloId)$/;
function normalizeIds(value) {
  if (Array.isArray(value)) return value.map(normalizeIds);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (ID_KEYS.test(k) && v !== null && v !== '' && !isNaN(v)) out[k] = Number(v);
      else out[k] = normalizeIds(v);
    }
    return out;
  }
  return value;
}

async function request(path, options = {}) {
  // Sanitizar body si es JSON
  if (options.body && typeof options.body === 'string' && !options.body.includes('FormData')) {
    try {
      const parsed = JSON.parse(options.body);
      const sanitized = typeof sanitizeObject === 'function' ? sanitizeObject(parsed) : parsed;
      options.body = JSON.stringify(sanitized);
    } catch (e) { /* no es JSON, dejar como está */ }
  }
  
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Error HTTP ${response.status}`);
  return normalizeIds(body);
}
function syncUsers(rows) {
  // Reemplaza COMPLETO el rol que viene en `rows` (mata filas fantasma
  // tras cambiar nombre/correo) y conserva los demás roles cargados.
  const nuevos = rows || [];
  const roles = new Set(nuevos.map(n => n.rol).filter(Boolean));
  const existentes = (MOCK_DB.users || []).filter(u => !roles.has(u.rol) && !nuevos.some(n => n.identificador === u.identificador));
  MOCK_DB.users = [...existentes, ...nuevos];
  return MOCK_DB.users;
}

function syncCourses(rows) { MOCK_DB.cursos = rows || []; return MOCK_DB.cursos; }
function syncStudents(rows) {
  // ★ FIX: el endpoint devuelve una fila por (estudiante, curso).
  // Las fusionamos por idEstudiante para que cada alumno exista UNA
  // sola vez, con todos sus cursos en cursosAsignados (nombres) y
  // cursosIds (ids). Cuando la llamada viene filtrada por idCurso,
  // ya hay 1 fila por alumno, así que el agrupado no cambia nada.
  const agrupados = [];
  const mapa = {};
  (rows || []).forEach(f => {
    const key = Number(f.idEstudiante);
    if (!mapa[key]) {
      mapa[key] = { ...f, cursosAsignados: [], cursosIds: [] };
      agrupados.push(mapa[key]);
    }
    const idc = f.idCurso != null && f.idCurso !== '' ? Number(f.idCurso) : null;
    const nombre = f.nombreCurso || f.curso || null;
    if (idc != null) {
      if (!mapa[key].cursosIds.includes(idc)) mapa[key].cursosIds.push(idc);
      if (nombre && !mapa[key].cursosAsignados.includes(nombre)) mapa[key].cursosAsignados.push(nombre);
    } else if (nombre && !mapa[key].cursosAsignados.includes(nombre)) {
      mapa[key].cursosAsignados.push(nombre);
    }
  });
  MOCK_DB.estudiantes = agrupados;
  return MOCK_DB.estudiantes;
}
function syncAttendance(rows) { MOCK_DB.asistencia = rows || []; return MOCK_DB.asistencia; }
function syncGrades(rows) { MOCK_DB.calificaciones = rows || []; return MOCK_DB.calificaciones; }
function syncAnnotations(rows) { MOCK_DB.anotaciones = rows || []; return MOCK_DB.anotaciones; }
function getConfigAsistencia() { return { horaInicio: '08:15', horaLimite: '09:45', bloqueResponsable: 1, umbralInasistenciasReiteradas: 3, permitirRegistroFueraDeHora: false, permitirRegistroFechasDistintasAHoy: true, permitirDocentesAprobarJustificaciones: true, ...(MOCK_DB.configuracion.asistencia || {}) }; }
function obtenerHorarioResponsable(idCurso, fecha, idBloque = null) { const course = MOCK_DB.cursos.find(row => Number(row.idCurso) === Number(idCurso)); if (!course) return null; return { idCurso: Number(idCurso), idBloque: Number(idBloque || getConfigAsistencia().bloqueResponsable), docenteIdentificador: course.profesorAsignado || course.profesorBloque1 || null, horaInicio: getConfigAsistencia().horaInicio, horaFin: getConfigAsistencia().horaLimite }; }
function existeAsistenciaCursoFecha(idCurso, fecha, idBloque = null) { return MOCK_DB.asistencia.some(row => Number(row.idCurso) === Number(idCurso) && row.fecha === fecha && (!idBloque || Number(row.idBloque) === Number(idBloque))); }
function puedeCrearAsistenciaInicial(user, idCurso) { return Boolean(user && (user.rol === 'ADMIN' || (user.rol === 'DOCENTE' && getDocenteCursosIds().includes(Number(idCurso))))); }
function puedeModificarAsistencia(user, idCurso) { return puedeCrearAsistenciaInicial(user, idCurso); }
function splitName(data) { if (data.apellido) return { nombre: data.nombre || '', apellido: data.apellido }; const parts = String(data.nombre || '').trim().split(/\s+/); return { nombre: parts.shift() || '', apellido: parts.join(' ') }; }

async function loadCourses() { const courses = syncCourses(await request('/cursos')); if (authUser?.rol === 'DOCENTE') authUser.cursosAsignados = courses.map(row => Number(row.idCurso)); return courses; }

async function ensurePupiloId() {
  // Carga todos los alumnos del apoderado (sin duplicados por curso) y deja uno seleccionado.
  if (authUser?.rol !== 'APODERADO') return;
  try {
    const data = await request('/guardian');
    const vistos = new Map();
    (data.students || []).forEach(s => {
      if (!vistos.has(Number(s.idEstudiante))) vistos.set(Number(s.idEstudiante), s);
    });
    const pupilos = [...vistos.values()].sort((a, b) =>
      [a.nombre, a.apellido].join(' ').localeCompare([b.nombre, b.apellido].join(' ')));
    authUser.pupilos = pupilos;

    const guardado = Number(localStorage.getItem(`siga_pupilo_${authUser.idCredencial}`));
    const actual = Number(authUser.idEstudiante);
    const valido = id => id && pupilos.some(p => Number(p.idEstudiante) === id);
    authUser.idEstudiante = valido(guardado) ? guardado : (valido(actual) ? actual : (pupilos[0]?.idEstudiante ?? null));
  } catch (_) { /* sin pupilo asignado todavía */ }
}

  const AuthApi = {
  login: async (identificador, contrasena) => { const user = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identificador, contrasena }) }); setToken(user.token); authUser = user; await loadCourses(); await ensurePupiloId(); return user; },
  logout: async () => { if (authToken) await request('/auth/logout', { method: 'POST' }).catch(() => {}); setToken(''); authUser = null; return true; },
  me: async () => { const user = await request('/auth/me'); authUser = user; await ensurePupiloId(); return user; }
  };

async function usersByRole(role) { return syncUsers(await request(role === 'DOCENTE' ? '/docentes' : '/apoderados')); }

const AdminApi = {
  dashboard: async () => { const [students, courses, attendance, grades] = await Promise.all([AdminApi.estudiantes(), AdminApi.cursos(), AdminApi.asistencia(), AdminApi.calificaciones()]); const today = attendance.filter(row => row.fecha === todayStr()); const valid = today.filter(row => ['PRESENTE', 'TARDANZA'].includes(row.estado)).length; return { totalEstudiantes: students.length, totalCursos: courses.length, asistenciasHoy: today.length ? `${Math.round(valid / today.length * 100)}%` : '0%', promedioGeneral: grades.length ? (grades.reduce((sum, row) => sum + Number(row.nota), 0) / grades.length).toFixed(1) : '0.0' }; },
  cursos: loadCourses, obtenerCursos: () => AdminApi.cursos(), estudiantes: async idCurso => syncStudents(await request(`/estudiantes${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`)),
  docentes: async () => (await usersByRole('DOCENTE')).filter(row => row.rol === 'DOCENTE'), obtenerDocentes: () => AdminApi.docentes(), apoderados: async () => (await usersByRole('APODERADO')).filter(row => row.rol === 'APODERADO'),
  crearDocente: async data => { const result = await request('/docentes', { method: 'POST', body: JSON.stringify({ ...data, ...splitName(data) }) }); await AdminApi.docentes(); return result; }, agregarDocente: data => AdminApi.crearDocente(data),
  crearApoderado: async data => { const result = await request('/apoderados', { method: 'POST', body: JSON.stringify({ ...data, ...splitName(data) }) }); await AdminApi.apoderados(); return result; },
  crearEstudiante: async data => { const result = await request('/estudiantes', { method: 'POST', body: JSON.stringify({ ...data, ...splitName(data) }) }); await AdminApi.estudiantes(); return result; },
  crearCurso: async data => { const result = await request('/cursos', { method: 'POST', body: JSON.stringify(data) }); await AdminApi.cursos(); return result; }, editarCurso: async (id, data) => { const result = await request(`/cursos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); await AdminApi.cursos(); return result; },
  editarEstudiante: async (id, data) => { const result = await request(`/estudiantes/${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, ...splitName(data) }) }); await AdminApi.estudiantes(); return result; }, eliminarEstudiante: async id => { const result = await request(`/estudiantes/${id}`, { method: 'DELETE' }); await AdminApi.estudiantes(); return result; },
  editarDocente: async (id, data) => { const result = await request(`/docentes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }); await AdminApi.docentes(); return result; }, editarApoderado: async (id, data) => { const result = await request(`/apoderados/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }); await AdminApi.apoderados(); return result; }, eliminarDocente: id => request(`/docentes/${encodeURIComponent(id)}`, { method: 'DELETE' }), eliminarApoderado: id => request(`/apoderados/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  docentesCurso: idCurso => request(`/cursos/${idCurso}/docentes`), asistencia: async idCurso => syncAttendance(await request(`/asistencia${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`)), calificaciones: async idCurso => syncGrades(await request(`/calificaciones${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`)),
  alertas: async () => { const [students, grades] = await Promise.all([AdminApi.estudiantes(), AdminApi.calificaciones()]); return typeof calcularSemaforoEstudiante === 'function' ? students.map(student => ({ ...student, ...calcularSemaforoEstudiante(student, grades.filter(row => Number(row.idEstudiante) === Number(student.idEstudiante))) })).filter(row => row.semaforo && row.semaforo !== 'VERDE') : []; },
  resumenAsistenciaCurso: async (idCurso, fecha) => { const [students, rows] = await Promise.all([AdminApi.estudiantes(idCurso), AdminApi.asistencia(idCurso)]); const selected = rows.filter(row => row.fecha === fecha); const present = selected.filter(row => row.estado === 'PRESENTE').length; const late = selected.filter(row => row.estado === 'TARDANZA').length; return { curso: MOCK_DB.cursos.find(row => Number(row.idCurso) === Number(idCurso))?.nombreCurso || '', fecha, total: students.length, presentes: present, ausentes: selected.filter(row => row.estado === 'AUSENTE').length, tardanzas: late, sinRegistro: Math.max(students.length - selected.length, 0), pctAsistencia: students.length ? (((present + late) / students.length) * 100).toFixed(1) : '0.0' }; },
  notificaciones: async () => { MOCK_DB.notificaciones = await request('/notificaciones'); return MOCK_DB.notificaciones; }, marcarNotificacionLeida: id => request(`/notificaciones/${id}/leida`, { method: 'PATCH' }), marcarTodasNotificacionesLeidas: () => request('/notificaciones/leidas', { method: 'POST' }), contarNotificacionesNoLeidas: async () => (await AdminApi.notificaciones()).filter(row => !row.leida).length
};

const DocenteApi = {
  dashboard: async () => { const courses = await DocenteApi.cursos(); const students = (await Promise.all(courses.map(row => DocenteApi.estudiantes(row.idCurso)))).flat(); const grades = await DocenteApi.calificaciones(); return { totalEstudiantes: new Set(students.map(row => row.idEstudiante)).size, totalClases: courses.length, asistenciasHoy: '0%', promedioGeneral: grades.length ? (grades.reduce((sum, row) => sum + Number(row.nota), 0) / grades.length).toFixed(1) : '0.0' }; }, cursos: loadCourses,
  estudiantes: async idCurso => syncStudents(await request(`/estudiantes${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`)),
  asistencia: async (idCurso, fecha, idBloque) => { const query = `?idCurso=${encodeURIComponent(idCurso)}${fecha ? `&fecha=${encodeURIComponent(fecha)}` : ''}${idBloque ? `&idBloque=${encodeURIComponent(idBloque)}` : ''}`; const rows = syncAttendance(await request(`/asistencia${query}`)); const students = await DocenteApi.estudiantes(idCurso); const esAdmin = authUser?.rol === 'ADMIN'; const esDocente = authUser?.rol === 'DOCENTE'; return students.map(student => { const saved = rows.find(row => Number(row.idEstudiante) === Number(student.idEstudiante)); return { ...student, idCurso: Number(idCurso), fecha, estado: saved?.estado || '', observacion: saved?.observacion || '', registroGuardado: Boolean(saved), creadoEl: saved?.creadoEl || '', modificadoEl: saved?.actualizadoEn || '', creadoPor: saved?.creadoPor || '', modificadoPor: saved?.modificadoPor || '', idBloqueRegistro: saved?.idBloqueRegistro || null, puedeCrear: esAdmin, puedeModificar: esAdmin, soloLectura: esDocente }; }); }, asistenciaHistorica: idCurso => AdminApi.asistencia(idCurso),
  guardarAsistencia: async (items, meta = {}) => { const result = await request('/asistencia', { method: 'PUT', body: JSON.stringify({ items: items.map(item => ({ ...item, idCurso: meta.idCurso || item.idCurso, fecha: meta.fecha || item.fecha, idBloque: meta.idBloque || item.idBloque })), ...meta }) }); await DocenteApi.asistencia(meta.idCurso, meta.fecha, meta.idBloque); return result; },
  asistenciaHoyPorCurso: async idCurso => { const rows = await AdminApi.asistencia(idCurso); const selected = rows.filter(row => row.fecha === todayStr()); return selected.length ? `${Math.round(selected.filter(row => ['PRESENTE', 'TARDANZA'].includes(row.estado)).length / selected.length * 100)}%` : '0%'; }, promedioPorCurso: async idCurso => { const rows = await DocenteApi.calificaciones(idCurso); return rows.length ? (rows.reduce((sum, row) => sum + Number(row.nota), 0) / rows.length).toFixed(1) : '0.0'; },
  calificaciones: async idCurso => syncGrades(await request(`/calificaciones${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`)), crearCalificacion: async data => { const result = await request('/calificaciones', { method: 'POST', body: JSON.stringify(data) }); await DocenteApi.calificaciones(data.idCurso); return result; },
  editarCalificacion: async (id, data) => { const result = await request(`/calificaciones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); await DocenteApi.calificaciones(); return result; }, eliminarCalificacion: id => request(`/calificaciones/${id}`, { method: 'DELETE' }),
  anotaciones: async () => syncAnnotations(await request('/anotaciones')), crearAnotacion: async data => { const result = await request('/anotaciones', { method: 'POST', body: JSON.stringify(data) }); await DocenteApi.anotaciones(); return result; }, materiales: async idCurso => { const rows = await request(`/materiales${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`); MOCK_DB.materiales = rows; return rows; },
  subirMaterial: async formData => { const file = formData.get('file'); const contenido = file ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }) : ''; const result = await request('/materiales', { method: 'POST', body: JSON.stringify({ idCurso: formData.get('idCurso'), titulo: file?.name || 'Material', tipoArchivo: file?.name?.split('.').pop()?.toUpperCase() || 'OTRO', contenido }) }); await DocenteApi.materiales(); return result; }, eliminarMaterial: id => request(`/materiales/${id}`, { method: 'DELETE' }),
  obtenerJustificacion: async (idEstudiante, fecha) => (await request(`/justificaciones?idEstudiante=${idEstudiante}&fecha=${encodeURIComponent(fecha)}`))[0] || null, 
  guardarJustificacion: data => request('/justificaciones', { method: 'POST', body: JSON.stringify(data) }), resumenAsistenciaCurso: (idCurso, fecha) => AdminApi.resumenAsistenciaCurso(idCurso, fecha), notificaciones: () => AdminApi.notificaciones(), marcarNotificacionLeida: id => AdminApi.marcarNotificacionLeida(id), marcarTodasNotificacionesLeidas: () => AdminApi.marcarTodasNotificacionesLeidas(), contarNotificacionesNoLeidas: () => AdminApi.contarNotificacionesNoLeidas()
};

// ==========================================
// INSPECTOR API (nuevo modelo: la asistencia la registra el Inspector)
// ==========================================
const VENTANA_REGISTRO_FRONT = { inicio: '08:15', fin: '09:45', bloquesCreacion: [1, 2] };
function puedeCrearAsistenciaInspector(fecha, idBloque) {
  const user = authUser;

  if (!user) return false;

  if (user.rol === 'ADMIN') return true;

  if (user.rol !== 'INSPECTOR') return false;

  // Solo bloques 1 y 2 para crear asistencia nueva.
  if (!VENTANA_REGISTRO_FRONT.bloquesCreacion.includes(Number(idBloque || 1))) {
      return false;
  }

  // Si es hoy, solo dentro de la ventana 08:15 a 09:45.
  if (fecha === todayStr()) {
      const ahora = new Date().toTimeString().slice(0, 5);
      return ahora >= VENTANA_REGISTRO_FRONT.inicio && ahora <= VENTANA_REGISTRO_FRONT.fin;
  }

  return true;
}

const InspectorApi = {
  dashboard: async () => { const [courses, students, rows] = await Promise.all([InspectorApi.cursos(), request('/estudiantes'), request('/asistencia')]); const hoy = todayStr(); const registrosHoy = rows.filter(row => row.fecha === hoy); const valid = registrosHoy.filter(row => ['PRESENTE', 'TARDANZA'].includes(row.estado)).length; return { totalEstudiantes: students.length, totalCursos: courses.length, asistenciaHoy: registrosHoy.length ? `${Math.round(valid / registrosHoy.length * 100)}%` : 'Sin registro' }; },
  cursos: () => request('/cursos'),
  estudiantes: async idCurso => syncStudents(await request(`/estudiantes${idCurso ? `?idCurso=${encodeURIComponent(idCurso)}` : ''}`)),
  asistencia: async (idCurso, fecha, idBloque) => { const query = `?idCurso=${encodeURIComponent(idCurso)}${fecha ? `&fecha=${encodeURIComponent(fecha)}` : ''}${idBloque ? `&idBloque=${encodeURIComponent(idBloque)}` : ''}`; const rows = syncAttendance(await request(`/asistencia${query}`)); const students = await InspectorApi.estudiantes(idCurso); const puedeCrear = puedeCrearAsistenciaInspector(fecha, idBloque); return students.map(student => { const saved = rows.find(row => Number(row.idEstudiante) === Number(student.idEstudiante)); return { ...student, idCurso: Number(idCurso), fecha, estado: saved?.estado || '', observacion: saved?.observacion || '', registroGuardado: Boolean(saved), creadoEl: saved?.creadoEl || '', modificadoEl: saved?.actualizadoEn || '', creadoPor: saved?.creadoPor || '', modificadoPor: saved?.modificadoPor || '', idBloqueRegistro: saved?.idBloqueRegistro || null, puedeCrear, puedeModificar: true, soloLectura: false }; }); },
  guardarAsistencia: (items, meta) => DocenteApi.guardarAsistencia(items, meta),
  asistenciaHistorica: idCurso => AdminApi.asistencia(idCurso),
  resumenAsistenciaCurso: (idCurso, fecha) => AdminApi.resumenAsistenciaCurso(idCurso, fecha),
  notificaciones: () => AdminApi.notificaciones(),
  marcarNotificacionLeida: id => AdminApi.marcarNotificacionLeida(id),
  marcarTodasNotificacionesLeidas: () => AdminApi.marcarTodasNotificacionesLeidas(),
  contarNotificacionesNoLeidas: () => AdminApi.contarNotificacionesNoLeidas()
};

const ApoderadoApi = {
  getidEstudiante: () => authUser?.idEstudiante || null,
  dashboard: async () => { const id = ApoderadoApi.getidEstudiante(); const data = await request(`/guardian${id ? `?idEstudiante=${id}` : ''}`); const student = (data.students || []).find(row => Number(row.idEstudiante) === Number(id)) || data.students?.[0]; const grades = await ApoderadoApi.calificaciones(); return { nombrePupilo: student ? [student.nombre, student.apellido].filter(Boolean).join(' ') : 'No asignado', curso: student?.curso || student?.nivel || student?.nombreCurso || 'N/A', promedio: grades.length ? (grades.reduce((sum, row) => sum + Number(row.nota), 0) / grades.length).toFixed(1) : '0.0' }; },
  calificaciones: async () => { const rows = await request('/calificaciones'); const id = ApoderadoApi.getidEstudiante(); return id == null ? rows : rows.filter(row => Number(row.idEstudiante) === Number(id)); }, asistencia: async () => { const rows = await request('/asistencia'); const id = ApoderadoApi.getidEstudiante(); const mias = id == null ? rows : rows.filter(row => Number(row.idEstudiante) === Number(id)); return mias.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))); }, anotaciones: async () => { const rows = await request('/anotaciones'); const id = ApoderadoApi.getidEstudiante(); return id == null ? rows : rows.filter(row => Number(row.idEstudiante) === Number(id)); }, materiales: () => DocenteApi.materiales(), descargarMaterial: id => `/api/materiales/${id}/descargar`, notificaciones: () => AdminApi.notificaciones(), marcarNotificacionLeida: id => AdminApi.marcarNotificacionLeida(id), contarNotificacionesNoLeidas: () => AdminApi.contarNotificacionesNoLeidas(), marcarTodasNotificacionesLeidas: () => AdminApi.marcarTodasNotificacionesLeidas(), asistenciaHoy: async () => (await ApoderadoApi.asistencia()).filter(row => row.fecha === todayStr()),
  estadisticasAsistencia: async () => { const rows = await ApoderadoApi.asistencia(); const count = states => rows.filter(row => states.includes(row.estado)).length; const current = rows.filter(row => String(row.fecha).startsWith(todayStr().slice(0, 7))); return { total: rows.length, presentes: count(['PRESENTE']), ausentes: count(['AUSENTE']), tardanzas: count(['TARDANZA']), pct: rows.length ? (count(['PRESENTE', 'TARDANZA']) / rows.length * 100).toFixed(1) : '0.0', totalMes: current.length, presentesMes: current.filter(row => row.estado === 'PRESENTE').length, ausentesMes: current.filter(row => row.estado === 'AUSENTE').length, tardanzasMes: current.filter(row => row.estado === 'TARDANZA').length, pctMes: current.length ? (current.filter(row => ['PRESENTE', 'TARDANZA'].includes(row.estado)).length / current.length * 100).toFixed(1) : '0.0' }; }
};

// ==========================================
// CALENDARIO DE ACTIVIDADES
// ==========================================
const CalendarioApi = {
  listar: anio => request(`/actividades?anio=${encodeURIComponent(anio)}`),
  crear: data => request('/actividades', { method: 'POST', body: JSON.stringify(data) }),
  editar: (id, data) => request(`/actividades/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: id => request(`/actividades/${id}`, { method: 'DELETE' })
};

// ==========================================
// CALENDARIO DE EVALUACIONES
// ==========================================
const EvaluacionesApi = {
  listar: anio => {
    const id = authUser?.rol === 'APODERADO' ? authUser.idEstudiante : null;
    return request(`/evaluaciones-calendario?anio=${encodeURIComponent(anio)}${id ? `&idEstudiante=${encodeURIComponent(id)}` : ''}`);
  },
  crear: data => request('/evaluaciones-calendario', { method: 'POST', body: JSON.stringify(data) }),
  editar: (id, data) => request(`/evaluaciones-calendario/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: id => request(`/evaluaciones-calendario/${id}`, { method: 'DELETE' })
};

// ==========================================
// APODERADO CON VARIOS ALUMNOS
// ==========================================
ApoderadoApi.listarPupilos = () => authUser?.pupilos || [];
ApoderadoApi.seleccionarPupilo = id => {
  if (!authUser || authUser.rol !== 'APODERADO') return;
  authUser.idEstudiante = Number(id);
  localStorage.setItem(`siga_pupilo_${authUser.idCredencial}`, String(id));
};
// Materiales: solo los cursos del alumno seleccionado
ApoderadoApi.materiales = async () => {
  const id = authUser?.idEstudiante;
  const rows = await request(`/materiales${id ? `?idEstudiante=${encodeURIComponent(id)}` : ''}`);
  MOCK_DB.materiales = rows;
  return rows;
};