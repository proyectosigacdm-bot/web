/**
FUNCIONALIDADES GENERALES DE LA APLICACIÓN SIGA
*/

let currentUser = null;
let currentView = 'dashboard';
let cacheCursos = [];
// Función de sanitización para prevenir XSS
function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/<[^>]*>/g, '')           // Elimina tags HTML
    .replace(/javascript:/gi, '')       // Elimina javascript:
    .replace(/on\w+=/gi, '')            // Elimina onclick, onload, etc.
    .slice(0, 1000);                    // Limita longitud
}

// Sanitiza un objeto completo antes de enviarlo
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ════════════════════════════════════════════════════════
//  FEATURE 9: CAMPANA DE NOTIFICACIONES
// ════════════════════════════════════════════════════════

async function renderNotificationBell() {
  // Eliminar campana anterior si existe
  const existente = document.getElementById('notiBellContainer');
  if (existente) existente.remove();

  const user = getCurrentUser();
  if (!user) return;

  let noLeidas = 0;
  try {
    if (user.rol === 'ADMIN') noLeidas = await AdminApi.contarNotificacionesNoLeidas();
    else if (user.rol === 'DOCENTE') noLeidas = await DocenteApi.contarNotificacionesNoLeidas();
    else if (user.rol === 'APODERADO') noLeidas = await ApoderadoApi.contarNotificacionesNoLeidas();
    else if (user.rol === 'INSPECTOR') noLeidas = await InspectorApi.contarNotificacionesNoLeidas();
  } catch (e) { /* sin problema */ }

  // Insertar campana en el header (buscar el contenedor del header)
  const header = document.querySelector('header') || document.querySelector('nav') || document.querySelector('.top-bar');
  if (!header) return;

  const bellContainer = document.createElement('div');
  bellContainer.id = 'notiBellContainer';
  bellContainer.className = 'relative inline-flex items-center';
  bellContainer.innerHTML = `
    <button onclick="toggleNotificationsPanel()" class="relative p-2 rounded-lg hover:bg-gray-100 transition" title="Notificaciones">
      <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      </svg>
      ${noLeidas > 0 ? `
        <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm animate-pulse">
          ${noLeidas > 9 ? '9+' : noLeidas}
        </span>
      ` : ''}
    </button>
  `;

  // Buscar un buen lugar para insertar (al lado del nombre del usuario, antes del logout)
  const userArea = header.querySelector('.flex.items-center.gap') || header.querySelector('.ml-auto') || header;
  if (userArea.firstChild) {
    userArea.insertBefore(bellContainer, userArea.firstChild);
  } else {
    userArea.appendChild(bellContainer);
  }
}

async function toggleNotificationsPanel() {
  let panel = document.getElementById('notiPanel');
  if (panel) {
    panel.remove();
    return;
  }

  const user = getCurrentUser();
  let notificaciones = [];
  try {
    if (user.rol === 'ADMIN') notificaciones = await AdminApi.notificaciones();
    else if (user.rol === 'DOCENTE') notificaciones = await DocenteApi.notificaciones();
    else if (user.rol === 'APODERADO') notificaciones = await ApoderadoApi.notificaciones();
    else if (user.rol === 'INSPECTOR') notificaciones = await InspectorApi.notificaciones();
  } catch (e) { /* */ }

  panel = document.createElement('div');
  panel.id = 'notiPanel';
  panel.className = 'fixed top-16 right-4 w-96 max-h-[70vh] bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] overflow-hidden fade-in';
  panel.innerHTML = `
    <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
      <h3 class="font-bold text-gray-900 text-sm">🔔 Notificaciones</h3>
      <div class="flex gap-2">
        <button onclick="marcarTodasNotisLeidas()" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Marcar todas leídas</button>
        <button onclick="document.getElementById('notiPanel').remove()" class="text-gray-400 hover:text-gray-600 text-lg">×</button>
      </div>
    </div>
    <div class="overflow-y-auto max-h-[55vh] divide-y divide-gray-50">
      ${notificaciones.length === 0
        ? '<div class="p-8 text-center text-gray-400 text-sm">Sin notificaciones</div>'
        : notificaciones.slice(0, 20).map(n => `
          <div class="p-3 hover:bg-gray-50 cursor-pointer transition ${n.leida ? 'opacity-60' : ''}" onclick="marcarNotiLeida(${n.id})">
            <div class="flex gap-3">
              <span class="text-xl">${n.icono || '🔔'}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-gray-900 ${n.leida ? 'font-normal' : ''}">${escapeHtml(n.titulo)}</div>
                <div class="text-xs text-gray-500 mt-0.5 truncate">${escapeHtml(n.mensaje)}</div>
                <div class="text-[10px] text-gray-400 mt-1">${new Date(n.fecha).toLocaleString('es-CL')}</div>
              </div>
              ${!n.leida ? '<span class="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></span>' : ''}
            </div>
          </div>
        `).join('')
      }
    </div>
  `;

  document.body.appendChild(panel);

  // Cerrar al hacer click fuera
  setTimeout(() => {
    document.addEventListener('click', function closePanel(e) {
      const p = document.getElementById('notiPanel');
      const bell = document.getElementById('notiBellContainer');
      if (p && !p.contains(e.target) && bell && !bell.contains(e.target)) {
        p.remove();
        document.removeEventListener('click', closePanel);
      }
    });
  }, 100);
}

async function marcarNotiLeida(id) {
  const user = getCurrentUser();
  try {
    if (user.rol === 'ADMIN') await AdminApi.marcarNotificacionLeida(id);
    else if (user.rol === 'DOCENTE') await DocenteApi.marcarNotificacionLeida(id);
    else if (user.rol === 'APODERADO') await ApoderadoApi.marcarNotificacionLeida(id);
    else if (user.rol === 'INSPECTOR') await InspectorApi.marcarNotificacionLeida(id);
  } catch (e) { /* */ }
  await toggleNotificationsPanel(); // cerrar
  await toggleNotificationsPanel(); // reabrir actualizado
  await renderNotificationBell();
}

async function marcarTodasNotisLeidas() {
  const user = getCurrentUser();
  try {
    if (user.rol === 'ADMIN') await AdminApi.marcarTodasNotificacionesLeidas();
    else if (user.rol === 'DOCENTE') await DocenteApi.marcarTodasNotificacionesLeidas();
    else if (user.rol === 'APODERADO') await ApoderadoApi.marcarTodasNotificacionesLeidas();
    else if (user.rol === 'INSPECTOR') await InspectorApi.marcarTodasNotificacionesLeidas();
  } catch (e) { /* */ }
  document.getElementById('notiPanel')?.remove();
  await renderNotificationBell();
  toast('✅ Todas las notificaciones marcadas como leídas');
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fechaES(value, conDiaSemana = true) {
  if (!value) return '';
  let d;
  if (value instanceof Date) d = value;
  else {
  const s = String(value);
  const m = s.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  }
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-CL', conDiaSemana
  ? { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }
  : { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function formatDateTime(isoString) {
  if (!isoString) return 'Sin registro';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Sin registro';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// AGRUPACIÓN DE CURSOS Y ASIGNATURAS
// ==========================================

function obtenerNombreCursoGrupo(curso) {
  if (curso?.nivel) return curso.nivel;
  return curso?.nombreCurso || '';
}

function obtenerClaveCursoGrupo(curso) {
  return `${curso?.nivel || ''}|${curso?.anioEscolar || ''}`;
}

function agruparCursosPorNivel(cursos) {
  const grupos = {};

  (cursos || []).forEach(curso => {
    const clave = obtenerClaveCursoGrupo(curso);

    if (!grupos[clave]) {
      grupos[clave] = {
        nombre: obtenerNombreCursoGrupo(curso),
        nivel: curso.nivel,
        anioEscolar: curso.anioEscolar,
        asignaturas: []
      };
    }

    grupos[clave].asignaturas.push(curso);
  });

  return Object.values(grupos);
}

function roleLabel(rol) {
  return {
    ADMIN: 'Administrador(a)',
    DOCENTE: 'Profesor(a)',
    APODERADO: 'Apoderado(a)',
    INSPECTOR: 'Inspector(a)'
  }[rol] || rol;
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2500);
  }
}

function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.classList.add('hidden');
}

function openSidebar() {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.remove('hidden');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

function fillLogin(user) {
  document.getElementById('loginUser').value = user;
  document.getElementById('loginPass').value = '1234';
  document.getElementById('loginPass').focus();
}

function statCard(icon, label, value, colorClass) {
  return `
    <div class="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 stat-card">
      <div class="w-12 h-12 ${colorClass} text-white rounded-lg flex items-center justify-center text-2xl">${icon}</div>
      <div>
        <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">${label}</div>
        <div class="text-2xl font-bold text-slate-900">${value}</div>
      </div>
    </div>
  `;
}

async function doLogin() {
  const identificador = document.getElementById('loginUser').value.trim();
  const contrasena = document.getElementById('loginPass').value.trim();
  const err = document.getElementById('loginError');

  err.classList.add('hidden');

  try {
    const user = await AuthApi.login(identificador, contrasena);
    setToken(user.token);
    currentUser = user;

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('app').classList.add('flex');

    await initApp();
  } catch (e) {
    err.textContent = e.message || 'Credenciales inválidas';
    err.classList.remove('hidden');
  }
}

async function logout() {
  try {
    await AuthApi.logout();
  } catch (_) {}

  setToken('');
  currentUser = null;

  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

async function initApp() {
  document.getElementById('userName').textContent = currentUser.nombre;
  document.getElementById('userRole').textContent = roleLabel(currentUser.rol);

  const initials = currentUser.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const avatar = document.getElementById('userAvatar');
  avatar.textContent = initials;

  if (currentUser.rol === 'ADMIN') avatar.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold bg-indigo-500 text-white';
  if (currentUser.rol === 'DOCENTE') avatar.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold bg-emerald-500 text-white';
  if (currentUser.rol === 'APODERADO') avatar.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold bg-amber-500 text-white';
  if (currentUser.rol === 'INSPECTOR') avatar.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold bg-cyan-500 text-white';

  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (currentUser.rol === 'DOCENTE') cacheCursos = await DocenteApi.cursos();
  if (currentUser.rol === 'ADMIN') cacheCursos = await AdminApi.cursos();
  if (currentUser.rol === 'INSPECTOR') cacheCursos = await InspectorApi.cursos();

  buildNav();
  navigate('dashboard');
  renderSelectorPupilo();
}

function buildNav() {
  const menus = {
    ADMIN: [
      { id: 'dashboard', icon: '📊', label: 'Panel Principal' },
      { id: 'cursos', icon: '📚', label: 'Cursos' },
      { id: 'docentes', icon: '👨‍🏫', label: 'Docentes' },
      { id: 'estudiantes', icon: '👥', label: 'Alumnos' },
      { id: 'apoderados', icon: '👨‍👧', label: 'Apoderados' },
      { id: 'absences', icon: '📉', label: 'Inasistencias' },
      { id: 'alertas', icon: '⚠️', label: 'Semáforo Académico' },
      { id: 'actividades', icon: '📅', label: 'Calendario de Actividades' },
      { id: 'evaluaciones', icon: '🗓️', label: 'Calendario de Evaluaciones' }
    ],
    DOCENTE: [
      { id: 'dashboard', icon: '📊', label: 'Panel Principal' },
      { id: 'attendance', icon: '✅', label: 'Asistencia' },
      { id: 'grades', icon: '📝', label: 'Calificaciones' },
      { id: 'anotaciones', icon: '📋', label: 'Anotaciones' },
      { id: 'materials', icon: '📚', label: 'Materiales' },
      { id: 'students', icon: '👥', label: 'Alumnos' },
      { id: 'horario', icon: '🕐', label: 'Mi Horario' },
      { id: 'actividades', icon: '📅', label: 'Calendario de Actividades' },
      { id: 'evaluaciones', icon: '🗓️', label: 'Calendario de Evaluaciones' }
    ],
    APODERADO: [
      { id: 'dashboard', icon: '📊', label: 'Panel Principal' },
      { id: 'attendance', icon: '✅', label: 'Asistencia Pupilo' },
      { id: 'grades', icon: '📝', label: 'Calificaciones' },
      { id: 'anotaciones', icon: '📋', label: 'Anotaciones' },
      { id: 'materials', icon: '📚', label: 'Materiales' },
      { id: 'horario', icon: '🕐', label: 'Horario de Clases' },
      { id: 'actividades', icon: '📅', label: 'Calendario de Actividades' },
      { id: 'evaluaciones', icon: '🗓️', label: 'Calendario de Evaluaciones' }
    ],
    INSPECTOR: [
      { id: 'dashboard', icon: '📊', label: 'Panel Principal' },
      { id: 'attendance', icon: '✅', label: 'Asistencia Colegio' },
      { id: 'horarios', icon: '🕐', label: 'Horarios de Clases' },
      { id: 'actividades', icon: '📅', label: 'Calendario de Actividades' }
    ]
  };
  const items = menus[currentUser.rol] || [];
  const navHtml = items.map(it =>
    `<button onclick="navigate('${it.id}')" data-nav="${it.id}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-gray-800 transition text-slate-400 font-medium"> <span class="text-lg opacity-90">${it.icon}</span><span class="text-left">${it.label}</span> </button>`
  ).join('');
  document.getElementById('navMenu').innerHTML = navHtml;
  const mobileNav = document.getElementById('navMenuMobile');
  if (mobileNav) mobileNav.innerHTML = navHtml;
}

function navigate(view) {
  currentView = view;
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('nav-active', b.dataset.nav === view));
  closeSidebar();
  render();
}

async function render() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="flex items-center justify-center h-64"><div class="animate-spin text-2xl text-indigo-600">⟳</div></div>';

  // Refresca la lista de cursos antes de cada navegación, así los cambios
  // hechos por el admin (nuevas asignaciones de curso a un docente) se
  // reflejan sin necesidad de cerrar sesión y volver a entrar.
  try {
    if (currentUser.rol === 'DOCENTE') cacheCursos = await DocenteApi.cursos();
    else if (currentUser.rol === 'ADMIN') cacheCursos = await AdminApi.cursos();
    else if (currentUser.rol === 'INSPECTOR') cacheCursos = await InspectorApi.cursos();
  } catch (e) {
    console.error('No se pudo refrescar la lista de cursos:', e);
  }

  const key = `${currentUser.rol}_${currentView}`;

  const renderers = {
    ADMIN_dashboard: renderAdminDashboard,
    ADMIN_cursos: renderAdminCursos,
    ADMIN_docentes: renderAdminDocentes,
    ADMIN_estudiantes: renderAdminEstudiantes,
    ADMIN_apoderados: renderAdminApoderados,
    ADMIN_absences: renderAdminAbsences,
    ADMIN_alertas: renderAdminAlertas,

    DOCENTE_dashboard: renderDocenteDashboard,
    DOCENTE_attendance: renderDocenteAttendance,
    DOCENTE_grades: renderDocenteGrades,
    DOCENTE_anotaciones: renderDocenteAnotaciones,
    DOCENTE_materials: renderDocenteMaterials,
    DOCENTE_students: renderDocenteStudents,
    DOCENTE_horario: renderDocenteHorario,

    APODERADO_dashboard: renderApoderadoDashboard,
    APODERADO_attendance: renderApoderadoAttendance,
    APODERADO_grades: renderApoderadoGrades,
    APODERADO_anotaciones: renderApoderadoAnotaciones,
    APODERADO_materials: renderApoderadoMaterials,
    APODERADO_horario: renderApoderadoHorario,

    INSPECTOR_dashboard: renderInspectorDashboard,
    INSPECTOR_attendance: renderInspectorAttendance,
    INSPECTOR_horarios: renderInspectorHorarios,

    ADMIN_actividades: renderCalendario,
    DOCENTE_actividades: renderCalendario,
    APODERADO_actividades: renderCalendario,
    INSPECTOR_actividades: renderCalendario,

    ADMIN_evaluaciones: renderCalendarioEvaluaciones,
    DOCENTE_evaluaciones: renderCalendarioEvaluaciones,
    APODERADO_evaluaciones: renderCalendarioEvaluaciones
  };

  try {
    await (renderers[key] || renderAdminDashboard)();
  } catch (e) {
    c.innerHTML = `<div class="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700 text-center">${e.message}</div>`;
  }
}

// --- ADMIN RENDERS ---

// --- ADMIN RENDERS ---
async function renderAdminDashboard() {
  document.getElementById('pageTitle').textContent = 'Panel Administrativo';
  document.getElementById('pageSubtitle').textContent = 'Visión general del establecimiento';
  const d = await AdminApi.dashboard();

  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      ${statCard('👥', 'Total Alumnos', d.totalEstudiantes, 'bg-blue-500')}
      ${statCard('📚', 'Cursos Activos', d.totalCursos, 'bg-purple-500')}
      ${statCard('✅', 'Asistencia Hoy', d.asistenciasHoy, 'bg-emerald-500')}
      ${statCard('📝', 'Promedio Gral.', d.promedioGeneral, 'bg-orange-500')}
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 class="font-bold text-gray-900 mb-4">Accesos Rápidos</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">

        <button onclick="navigate('cursos')" class="p-4 bg-blue-50 hover:bg-blue-100/70 rounded-lg text-left border border-blue-100 transition">
          <div class="text-2xl mb-2">📚</div>
          <div class="font-semibold text-sm text-blue-900">Gestión Cursos</div>
        </button>

        <button onclick="navigate('estudiantes')" class="p-4 bg-purple-50 hover:bg-purple-100/70 rounded-lg text-left border border-purple-100 transition">
          <div class="text-2xl mb-2">👥</div>
          <div class="font-semibold text-sm text-purple-900">Matrícula</div>
        </button>

        <button onclick="navigate('alertas')" class="p-4 bg-amber-50 hover:bg-amber-100/70 rounded-lg text-left border border-amber-100 transition">
          <div class="text-2xl mb-2">⚠️</div>
          <div class="font-semibold text-sm text-amber-900">Semáforo Académico</div>
          <div class="text-[10px] text-amber-600">Rendimiento estudiantil</div>
        </button>

        <button onclick="navigate('absences')" class="p-4 bg-rose-50 hover:bg-rose-100/70 rounded-lg text-left border border-rose-100 transition">
          <div class="text-2xl mb-2">📉</div>
          <div class="font-semibold text-sm text-rose-900">Reporte Inasistencias</div>
          <div class="text-[10px] text-rose-600">Ausencias reiteradas</div>
        </button>

      </div>
    </div>
  `;

  // Feature 9: Campana de notificaciones
  await renderNotificationBell();
}

// ==========================================
// FIX: MODAL PARA EDITAR CURSOS
// ==========================================

function openCursoEditModal(idCurso) {
  const curso = MOCK_DB.cursos.find(c => Number(c.idCurso) === Number(idCurso));
  if (!curso) { toast('❌ No se encontró el curso. Recarga la página.'); return; }

  // ★ FIX 1: asegurar que los docentes estén cargados antes de abrir el modal
  const docentes = getDocentesParaCursoSelect();
  if (!docentes.length) {
    // carga asíncrona y luego abre el modal
    AdminApi.docentes().then(() => _pintarModalEditCurso(curso, idCurso));
    return;
  }
  _pintarModalEditCurso(curso, idCurso);
}

async function _pintarModalEditCurso(curso, idCurso) {
  const docentes = getDocentesParaCursoSelect();
  const m = document.getElementById('modal');
  if (!m) return;

  // ★ FIX 2: normalizar horariosSemana (puede venir como string JSON desde Neon)
  let hs = curso.horariosSemana;
  if (typeof hs === 'string') { try { hs = JSON.parse(hs); } catch (_) { hs = {}; } }
  hs = hs || {};

  const profesorActual = curso.profesorAsignado || curso.profesorBloque1 || curso.profesorBloque2 || '';

  document.getElementById('modalContent').innerHTML = `
  <div class="p-6 border-b border-gray-100 flex justify-between items-center">
    <h3 class="font-bold text-gray-900 text-lg">Editar Curso</h3>
    <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
  </div>
  <form id="formCursoEdit" onsubmit="saveCursoEdit(event, ${idCurso})" class="p-6 space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Curso</label>
        <input type="text" id="editCursoNombre" value="${escapeHtml(curso.nombreCurso || '')}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Asignatura</label>
        <input type="text" id="editCursoAsignatura" value="${escapeHtml(curso.asignatura || '')}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nivel</label>
        <input type="text" id="editCursoNivel" value="${escapeHtml(curso.nivel || '')}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Año Escolar</label>
        <input type="number" id="editCursoAnio" value="${escapeHtml(curso.anioEscolar || new Date().getFullYear())}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
    </div>
    <div>
      <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Profesor responsable</label>
      <select id="editCursoProfesor" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
        <option value="">Selecciona un profesor</option>
        ${docentes.map(d => `<option value="${escapeHtml(d.identificador)}" ${profesorActual === d.identificador ? 'selected' : ''}>${escapeHtml(d.nombre)}</option>`).join('')}
      </select>
      ${!docentes.length ? '<p class="text-xs text-rose-500 mt-1">⚠️ No hay docentes registrados. Crea uno primero en "Docentes".</p>' : ''}
    </div>
    <div>
      <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Horario semanal de la asignatura</label>
      ${horariosSemanaSelectorHtml('cursoHorariosSemanaEdit', hs)}
      <p class="text-[10px] text-gray-400 mt-2">Puedes marcar varios días con distintos horarios. Todo lo marcado se guarda.</p>
    </div>
    <div>
      <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad de notas por alumno (máx. 10)</label>
      <input type="number" id="editCursoNotasPorCurso" min="1" max="10" required
             value="${parseInt(curso.notasPorCurso, 10) || 6}"
             class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      <p class="text-[10px] text-gray-400 mt-1">Define cuántas columnas de notas verá el docente en el libro de calificaciones.</p>
    </div>
    <div class="pt-4 flex justify-end gap-2">
      <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
      <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Guardar Cambios</button>
    </div>
  </form>`;

  renderBloquesDisponibles(profesorActual, idCurso);
  m.classList.remove('hidden');
}

async function guardarEdicionCurso(idCurso) {
  // Recopilar la información del formulario
  const data = {
    nombre: document.getElementById('editCursoNombre').value.trim(),
    nivel: document.getElementById('editCursoNivel').value.trim(),
    asignatura: document.getElementById('editCursoAsignatura').value.trim()
  };

  try {
    // Llamar a la API para hacer el PATCH (segun tu api.js)
    await AdminApi.editarCurso(idCurso, data);
    
    // Cerrar el modal
    document.getElementById('editCursoModal').remove();
    toast('✅ Curso actualizado correctamente');
    
    // Recargar la vista actual para reflejar los cambios sin perder la pestaña
    const selector = document.getElementById('adminCursoGrupo');
    const grupoActual = selector ? selector.value : null;
    await renderAdminCursos(grupoActual);
    
  } catch (error) {
    toast('❌ Error al editar: ' + error.message);
  }
}

// ═══ Barra de carga para la sección de cursos (admin) ═══
function cursosLoaderHtml(texto = 'Cargando cursos...') {
  if (!document.getElementById('cursosLoaderStyle')) {
    const st = document.createElement('style');
    st.id = 'cursosLoaderStyle';
    st.textContent = `
      @keyframes cursosBarra {
        0%   { left: -40%; }
        100% { left: 100%; }
      }
      .cursos-barra-anim {
        position: absolute;
        top: 0; bottom: 0;
        width: 40%;
        border-radius: 9999px;
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        animation: cursosBarra 1.2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(st);
  }
  return `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center">
      <p class="text-sm font-semibold text-gray-700 mb-1">${texto}</p>
      <p class="text-xs text-gray-400 mb-4">Esto puede tardar unos segundos</p>
      <div class="relative w-full max-w-sm h-2 bg-gray-200 rounded-full overflow-hidden">
        <div class="cursos-barra-anim"></div>
      </div>
    </div>`;
}

async function renderAdminCursos(claveGrupoPreseleccionada = null) {
  document.getElementById('pageTitle').textContent = 'Gestión de Cursos';
  document.getElementById('pageSubtitle').textContent =
    'Cursos, asignaturas, docentes y alumnos';

    document.getElementById('content').innerHTML = cursosLoaderHtml('Cargando cursos...');

    const cursos = await AdminApi.cursos();
    const grupos = agruparCursosPorNivel(cursos);

  if (!grupos.length) {
    document.getElementById('content').innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="font-bold text-gray-900 text-lg">Gestión de Cursos</h3>
          <p class="text-sm text-gray-500">Selecciona un curso para visualizar sus asignaturas y alumnos.</p>
        </div>
        <button
          onclick="openCursoModal()"
          class="btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md transition flex items-center gap-2"
        >
          <span>+</span> Agregar Nuevo Curso
        </button>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <p class="text-gray-400 italic">No hay cursos registrados en la base de datos.</p>
        <p class="text-sm text-gray-500 mt-2">Crea el primer curso para comenzar a cargar asignaturas y alumnos.</p>
      </div>
    `;
    return;
  }

  const primerGrupo = grupos[0];

  let html = `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h3 class="font-bold text-gray-900 text-lg">
          Gestión de Cursos
        </h3>

        <p class="text-sm text-gray-500">
          Selecciona un curso para visualizar sus asignaturas y alumnos.
        </p>
      </div>

      <button
        onclick="openCursoModal()"
        class="btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md transition flex items-center gap-2"
      >
        <span>+</span> Agregar Nuevo Curso
      </button>
    </div>

    <!-- SELECTOR DE CURSO -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">

      <label class="block text-xs font-bold text-gray-500 uppercase mb-2">
        Curso
      </label>

      <select
        id="adminCursoGrupo"
        class="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
      >
        ${grupos.map((grupo, index) => `
          <option
            value="${escapeHtml(obtenerClaveCursoGrupo(grupo.asignaturas[0]))}"
            ${index === 0 ? 'selected' : ''}
          >
            ${escapeHtml(grupo.nombre)}
          </option>
        `).join('')}
      </select>

    </div>

    <!-- CONTENIDO DEL CURSO -->
    <div id="adminCursoContenido"></div>
  `;

  document.getElementById('content').innerHTML = html;
  const selector = document.getElementById('adminCursoGrupo');

  // Si se pasó una clave de grupo, la seleccionamos en el dropdown
  if (claveGrupoPreseleccionada) {
      const optionExists = Array.from(selector.options).some(opt => opt.value === claveGrupoPreseleccionada);
      if (optionExists) {
          selector.value = claveGrupoPreseleccionada;
      }
  }

  selector.addEventListener('change', async () => {
  await renderAdminCursoGrupo(selector.value, grupos);
  });

  // Renderizamos el grupo que quedó seleccionado (el preselccionado o el primero por defecto)
  await renderAdminCursoGrupo(
  selector.value,
  grupos
  );
}

async function renderAdminCursoGrupo(claveGrupo, grupos) {
  const container = document.getElementById('adminCursoContenido');

  if (!container) return;

  container.innerHTML = cursosLoaderHtml('Cargando asignaturas, docentes y alumnos...');

  const grupo = grupos.find(
    g => obtenerClaveCursoGrupo(g.asignaturas[0]) === claveGrupo
  );

  if (!grupo) {
    container.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p class="text-gray-400">
          No se encontró información del curso.
        </p>
      </div>
    `;
    return;
  }
    // ★ FIX: precargar docentes en MOCK_DB.users para nombreDocenteCurso()
    if (!(MOCK_DB.users || []).some(u => u.rol === 'DOCENTE')) {
      try { await AdminApi.docentes(); } catch (_) {}
    }

  let html = `
    <div class="mb-4">
    <h3 class="font-bold text-gray-900 text-xl">
    Curso ${escapeHtml(grupo.nombre)}
    </h3>
      <p class="text-sm text-gray-500">
        ${escapeHtml(grupo.nivel || '')}
        · ${escapeHtml(grupo.anioEscolar || '')}
      </p>
    </div>
    ${horarioClasesHtml(grupo.asignaturas, `Curso ${grupo.nombre}`)}
    <div class="space-y-4">
  `;

  for (const c of grupo.asignaturas) {

    const docentes = await AdminApi.docentesCurso(c.idCurso);
    const estudiantes = await AdminApi.estudiantes(c.idCurso);

    html += `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        <!-- ASIGNATURA -->
        <div class="p-5">

          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">

            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">📘</span>

                <h3 class="font-bold text-lg text-gray-900">
                  ${escapeHtml(c.asignatura || c.nombreCurso)}
                </h3>
              </div>

              <p class="text-sm text-gray-500 ml-7">
                Asignatura del curso ${escapeHtml(grupo.nombre)}
              </p>
            </div>

            <div class="flex flex-wrap gap-2">

              <span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
                ${estudiantes.length} Alumnos
              </span>

              <button
                onclick="exportarCursoAExcel(${c.idCurso}, '${String(c.nombreCurso).replace(/'/g, "\\'")}')"
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                📊 Exportar
              </button>

              <button
                onclick="openCursoEditModal(${c.idCurso})"
                class="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold rounded-lg transition"
              >
                ✏️ Editar
              </button>

              <button
                onclick="toggleCourseDetails(${c.idCurso})"
                class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                <span id="icon-${c.idCurso}">▶</span>
                Ver detalles
              </button>

            </div>
          </div>

          <!-- DOCENTES -->
          <div class="mt-4">
            <div class="text-xs font-bold text-gray-500 uppercase mb-2">
              Docentes por bloque
            </div>

            ${
              docentes.length
                ? `
                  <div class="flex flex-wrap gap-2">
                    ${docentes.map(d => `
                      <span class="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 shadow-sm">
                        👨‍🏫 ${escapeHtml(d.nombreDocente)}${d.bloqueResponsable ? ` · Bloque ${d.bloqueResponsable}` : ''}
                      </span>
                    `).join('')}
                  </div>
                `
                : `
                  <p class="text-sm text-gray-400 italic">
                    Sin docentes asignados
                  </p>
                `
            }
          </div>

        </div>

        <!-- DETALLES -->
        <div
          id="details-${c.idCurso}"
          class="hidden border-t border-gray-100 p-5 bg-slate-50"
        >

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

            <!-- ALUMNOS -->
            <div class="bg-white p-4 rounded-lg border border-slate-200">

              <h5 class="font-bold text-gray-700 mb-3 text-sm uppercase">
                👥 Estudiantes
              </h5>

              <div
                id="students-${c.idCurso}"
                class="text-sm text-gray-600 space-y-1"
              >
                ${
                  estudiantes.length
                    ? estudiantes.map(e => `
                        <div class="flex justify-between border-b border-gray-100 py-1">
                          <span>${escapeHtml(e.nombre)}</span>
                          <span class="text-xs text-gray-400">
                            ${escapeHtml(e.rut)}
                          </span>
                        </div>
                      `).join('')
                    : '<p class="text-xs italic text-gray-400">Sin alumnos</p>'
                }
              </div>

            </div>

            <!-- ASISTENCIA -->
            <div class="bg-white p-4 rounded-lg border border-slate-200 flex flex-col justify-between">

              <div>
                <h5 class="font-bold text-gray-700 mb-2 text-sm uppercase">
                  📅 Asistencia
                </h5>

                <p class="text-xs text-gray-500 mb-3">
                  Visualiza la asistencia de los alumnos de esta asignatura.
                </p>
              </div>

              <button
                onclick="toggleAttendanceDetails(${c.idCurso})"
                class="w-full btn-primary text-white py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition"
              >
                Ver Detalle de Asistencia
              </button>

            </div>

            <!-- CALIFICACIONES -->
            <div class="bg-white p-4 rounded-lg border border-slate-200 flex flex-col justify-between">

              <div>
                <h5 class="font-bold text-gray-700 mb-2 text-sm uppercase">
                  📝 Calificaciones
                </h5>

                <p class="text-xs text-gray-500 mb-3">
                  Revisa las notas de los alumnos de esta asignatura.
                </p>
              </div>

              <button
                onclick="toggleGradesDetails(${c.idCurso})"
                class="w-full btn-primary text-white py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition"
              >
                Ver Detalle de Notas
              </button>

            </div>

          </div>

          <!-- DETALLE ASISTENCIA -->
          <div
            id="att-details-${c.idCurso}"
            class="hidden mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm fade-in"
          >

            <div class="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">

              <h5 class="font-bold text-gray-800 text-base">
                📅 Gestión de Asistencia por Estudiante
              </h5>

              <button
                onclick="toggleAttendanceDetails(${c.idCurso})"
                class="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>

            </div>

            <div
              id="att-content-${c.idCurso}"
              class="space-y-4"
            >
              Cargando asistencia...
            </div>

          </div>

          <!-- DETALLE NOTAS -->
          <div
            id="grades-details-${c.idCurso}"
            class="hidden mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm fade-in"
          >

            <div class="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">

              <h5 class="font-bold text-gray-800 text-base">
                📝 Detalle de Calificaciones por Asignatura
              </h5>

              <button
                onclick="toggleGradesDetails(${c.idCurso})"
                class="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>

            </div>

            <input
              type="text"
              id="grades-buscar-${c.idCurso}"
              oninput="filtrarAlumnosDetalleNotas(${c.idCurso}, this.value)"
              placeholder="🔍 Buscar alumno por nombre..."
              class="w-full md:w-72 mb-4 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
            />

            <div
              id="grades-content-${c.idCurso}"
              class="space-y-4"
            >
              Cargando calificaciones...
            </div>

          </div>

        </div>

      </div>
    `;
  }

  html += `</div>`;

  container.innerHTML = html;
}

// ==========================================
// HORARIO DE CLASES (VISTA ADMIN)
// ==========================================
function nombreDocenteCurso(curso, bloque) {
  // ★ FIX 1: prioridad → docente realmente vinculado en docentes_cursos
  const docenteReal = (MOCK_DB.users || []).find(u =>
    u.rol === 'DOCENTE' &&
    Array.isArray(u.cursosAsignados) &&
    u.cursosAsignados.map(Number).includes(Number(curso.idCurso))
  );
  if (docenteReal) return docenteReal.nombre;

  // Fallback: profesor_asignado del curso
  const id = curso.profesorAsignado ||
    (Number(bloque) === 2 ? curso.profesorBloque2 : curso.profesorBloque1) ||
    curso.profesorBloque1 || curso.profesorBloque2 || '';
    const user = (MOCK_DB.users || []).find(u => u.identificador === id);
    if (user) return user.nombre;
    // Último recurso: si solo existe el correo, se muestra legible en vez de un texto fijo
    if (id && String(id).includes('@')) {
    return String(id).split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    }
    return id || 'Sin docente asignado';
  }

function construirCeldasHorario(cursos) {
  const celdas = {};
  (cursos || []).forEach((curso, idx) => {
    const mapa = getHorariosSemanaCurso(curso);
    let diasCurso, bloquesPorDia;
    if (mapa) {
      diasCurso = Object.keys(mapa).map(Number);
      bloquesPorDia = (d) => mapa[d] || [];
    } else {
      diasCurso = getCursoDiasSemana(curso);
      bloquesPorDia = () => obtenerBloquesCurso(curso);
    }
    diasCurso.forEach(d => {
      bloquesPorDia(d).forEach(b => {
        if (b > getMaxBloquesPorDia(d)) return;
        const key = `${d}-${b}`;
        if (!celdas[key]) celdas[key] = [];
        if (!celdas[key].some(item => item.curso.idCurso === curso.idCurso)) {
          celdas[key].push({ curso, color: colorMateriaHorario(idx) });
        }
      });
    });
  });
  return celdas;
}

function construirCeldasHorarioDocente(cursos, docenteId) {
  const celdas = {};
  const agregar = (curso, idx, dia, bloque) => {
  if (bloque > getMaxBloquesPorDia(dia)) return;
  const key = `${dia}-${bloque}`;
  if (!celdas[key]) celdas[key] = [];
  if (!celdas[key].some(item => item.curso.idCurso === curso.idCurso)) {
  celdas[key].push({ curso, color: colorMateriaHorario(idx) });
  }
  };
  (cursos || []).forEach((curso, idx) => {
    // 1) Asignación manual día por día
    if (curso.horariosSemana && Object.keys(curso.horariosSemana).length) {
      Object.entries(curso.horariosSemana).forEach(([d, bloques]) => {
      (bloques || []).forEach(b => agregar(curso, idx, Number(d), Number(b)));
      });
      return;
    }
    // 2) Tabla de horarios (solo clases del docente)
    const horariosCurso = (MOCK_DB.horarios || []).filter(h => h.idCurso == curso.idCurso);
    if (horariosCurso.length) {
      horariosCurso.forEach(h => {
        if (docenteId && h.docenteIdentificador && h.docenteIdentificador !== docenteId) return;
        const dias = Array.isArray(h.diaSemana)
          ? h.diaSemana.map(Number)
          : (h.diaSemana === '*' ? [1, 2, 3, 4, 5] : [Number(h.diaSemana)]);
        dias.forEach(d => agregar(curso, idx, d, Number(h.idBloque)));
      });
      return; 
    }
    // 3) Legado: solo si el docente es responsable del curso
    const esDocenteDeCurso = docenteId && (
      curso.profesorAsignado === docenteId ||
      curso.profesorBloque1 === docenteId ||
      curso.profesorBloque2 === docenteId ||
      (currentUser?.cursosAsignados || []).includes(curso.idCurso)
    );
    if (!esDocenteDeCurso) return;
    getCursoDiasSemana(curso).forEach(d => {
      obtenerBloquesCurso(curso).forEach(b => agregar(curso, idx, d, b));
    });
  });
  return celdas;
}

function horarioClasesHtml(cursos, titulo) {
  const jornada = getJornadaCompleta();
  const dias = [1, 2, 3, 4, 5];
  const nombresDias = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie' };
  const celdas = construirCeldasHorario(cursos);
  return `<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-xl">🕐</span>
      <h3 class="font-bold text-gray-900 text-lg">Horario de Clases — ${escapeHtml(titulo || '')}</h3>
    </div>
    <p class="text-xs text-gray-500 mb-4">Bloques, asignaturas y docente a cargo de cada clase.</p>
    <div class="overflow-x-auto">
      <div class="min-w-[720px] grid gap-1.5" style="grid-template-columns: 110px repeat(5, minmax(0, 1fr));">
        <div></div>
        ${dias.map(d => `<div class="text-center text-xs font-bold text-gray-500 uppercase py-1">${nombresDias[d]}</div>`).join('')}
        ${jornada.map(b => {
          if (b.tipo === 'recreo') {
            return `<div style="grid-column: 1 / -1;" class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-700 text-[11px] font-bold uppercase tracking-wide py-1.5">☕ ${b.label} · ${b.hora}</div>`;
          }
          return `
            <div class="flex flex-col items-center justify-center text-[11px] font-bold text-gray-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-center">
              <span>${b.label}</span>
              <span class="text-[10px] font-medium text-gray-400">${b.hora}</span>
            </div>
            ${dias.map(d => {
              if (b.id > getMaxBloquesPorDia(d)) {
                return `<div class="rounded-lg border border-dashed border-gray-200 bg-gray-100/70 min-h-[64px] flex items-center justify-center text-[10px] text-gray-400 italic">Sin clases</div>`;
              }
              const lista = celdas[`${d}-${b.id}`] || [];
              if (!lista.length) {
                return `<div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 min-h-[64px]"></div>`;
              }
              return `<div class="space-y-1">
                ${lista.map(item => `
                  <div class="rounded-lg border px-3 py-1.5 ${item.color}">
                    <div class="text-[10px] font-bold opacity-60">${b.label} · ${b.hora}</div>
                    <div class="text-xs font-bold truncate">${escapeHtml(item.curso.asignatura || item.curso.nombreCurso)}</div>
                    <div class="text-[10px] opacity-70 truncate">👨‍🏫 ${escapeHtml(nombreDocenteCurso(item.curso, b.id))}</div>
                  </div>
                `).join('')}
              </div>`;
            }).join('')}
          `;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// ═══ Buscador por nombre reutilizable para tablas ═══
// persistente = true  → el buscador queda ANTES del contenedor (para tablas que se redibujan solas)
// persistente = false → el buscador se inserta ANTES de la tabla dentro del contenedor
function agregarBuscadorNombre(contenedorId, inputId, placeholder = '🔍 Buscar por nombre...', persistente = false) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const norm = t => String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const cajaHtml = `
    <div class="mb-4">
      <input type="text" id="${inputId}" placeholder="${placeholder}"
        class="w-full md:w-80 px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
      <p id="${inputId}Vacio" class="hidden text-sm text-gray-400 italic mt-2">Ningún resultado coincide con la búsqueda.</p>
    </div>`;

  if (persistente) {
    contenedor.insertAdjacentHTML('beforebegin', cajaHtml);
  } else {
    const tabla = contenedor.querySelector('table');
    if (!tabla) return;
    (tabla.closest('.overflow-hidden') || tabla).insertAdjacentHTML('beforebegin', cajaHtml);
  }

  const input = document.getElementById(inputId);
  const vacio = document.getElementById(`${inputId}Vacio`);
  if (!input) return;

  const aplicar = () => {
    const q = norm(input.value);
    const filas = Array.from(contenedor.querySelectorAll('tbody tr'))
      .filter(tr => !tr.querySelector('td[colspan]'));

    let visibles = 0;
    filas.forEach(tr => {
      const td = tr.querySelector('td');
      const sp = td && td.querySelector('span.font-medium');
      const nombre = (sp || td)?.textContent || '';
      const ok = !q || norm(nombre).includes(q);
      tr.style.display = ok ? '' : 'none';
      if (ok) visibles++;
    });

    if (vacio) vacio.classList.toggle('hidden', !(q && filas.length && !visibles));
  };

  input.addEventListener('input', aplicar);

  // Si la tabla se redibuja (cambio de curso, nueva anotación), reaplica el filtro
  if (persistente) {
    new MutationObserver(aplicar).observe(contenedor, { childList: true });
  }
}

async function renderAdminDocentes() {
  if (document.getElementById('pageTitle')) {
    document.getElementById('pageTitle').textContent = 'Gestión de Personal Docente';
  }

  const docentes = await AdminApi.obtenerDocentes();
  const cursos = await AdminApi.obtenerCursos();

  const cursosMap = {};
  cursos.forEach(c => {
    cursosMap[c.idCurso] = c.nombreCurso;
  });

  let html = `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <p class="text-sm text-gray-500">Administra las credenciales de acceso y asignaciones académicas del profesorado.</p>
      </div>

      <button onclick="abrirModalCrearDocente()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-2">
        <span>➕</span> Agregar Docente
      </button>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th class="p-4">Nombre Docente</th>
              <th class="p-4">Correo / Usuario</th>
              <th class="p-4">Cursos Asignados</th>
              <th class="p-4 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100 text-sm text-slate-700">
  `;

  if (docentes.length === 0) {
    html += `<tr><td colspan="4" class="p-8 text-center text-gray-400 italic">No hay docentes registrados en el sistema.</td></tr>`;
  } else {
    docentes.forEach(d => {
      const chipsCursos = d.cursosAsignados && d.cursosAsignados.length > 0
        ? d.cursosAsignados.map(id => `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 mr-1 mb-1 shadow-2xs">
              ${cursosMap[id] || `Curso ID: ${id}`}
            </span>
          `).join('')
        : '<span class="text-xs text-gray-400 italic">Sin cursos asignados</span>';

      html += `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="p-4 font-semibold text-slate-900">${d.nombre}</td>
          <td class="p-4 text-slate-500 font-mono text-xs">${d.identificador}</td>
          <td class="p-4">${chipsCursos}</td>
          <td class="p-4 text-center space-x-3">
            <button onclick="openEditDocenteModal('${d.identificador}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">✏️ Editar</button>
            <button onclick="deleteDocente('${d.identificador}')" class="text-xs font-bold text-rose-600 hover:text-rose-800 transition">🗑️ Eliminar</button>
          </td>
        </tr>
      `;
    });
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('content').innerHTML = html;
  agregarBuscadorNombre('content', 'buscarDocenteAdmin', '🔍 Buscar docente por nombre...');
}

function openDocenteModal() {
  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Registrar Nuevo Docente</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form id="formDocente" onsubmit="saveDocente(event)" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
        <input type="text" id="modalDocNombre" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: María González Pérez"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Institucional</label>
        <input type="email" id="modalDocCorreo" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: m.gonzalez@edu.cl"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña Inicial</label>
        <input type="text" id="modalDocPass" required value="1234" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        <p class="text-xs text-gray-400 mt-1">El docente podrá cambiarla después de iniciar sesión</p>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cursos Asignados</label>
        <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
          ${MOCK_DB.cursos.map(c => `
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="${c.idCurso}" class="modalDocCursos rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
              <span class="text-sm text-gray-700">${c.nombreCurso}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Registrar Docente</button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');
}

async function saveDocente(e) {
  e.preventDefault();
  const nombre = sanitizeInput(document.getElementById('modalDocNombre').value);
  const correo = sanitizeInput(document.getElementById('modalDocCorreo').value);
  const pass = sanitizeInput(document.getElementById('modalDocPass').value);
  const cursosSeleccionados = Array.from(document.querySelectorAll('.modalDocCursos:checked')).map(cb => parseInt(cb.value));

  if (MOCK_DB.users.find(u => u.identificador === correo)) {
    toast('❌ Ya existe un usuario con ese correo');
    return;
  }

  await AdminApi.crearDocente({
    nombre,
    identificador: correo,
    contrasena: pass,
    cursosAsignados: cursosSeleccionados
  });

  closeModal();
  toast('✅ Docente registrado exitosamente');
  await renderAdminDocentes();
}

async function deleteDocente(identificador) {
  if (confirm('¿Seguro que desea eliminar este docente?')) {
    await AdminApi.eliminarDocente(identificador);
    toast('Docente eliminado');
    await renderAdminDocentes();
  }
}

function toggleCourseDetails(idCurso) {
  const details = document.getElementById(`details-${idCurso}`);
  const icon = document.getElementById(`icon-${idCurso}`);

  if (details.classList.contains('hidden')) {
    details.classList.remove('hidden');
    icon.style.transform = 'rotate(90deg)';
    loadCourseDetails(idCurso);
  } else {
    details.classList.add('hidden');
    icon.style.transform = 'rotate(0deg)';
  }
}

async function loadCourseDetails(idCurso) {
  const estudiantes = await AdminApi.estudiantes(idCurso);
  const studentsContainer = document.getElementById(`students-${idCurso}`);

  if (estudiantes.length) {
    studentsContainer.innerHTML = estudiantes.map(e =>
      `<div class="flex justify-between"><span>${e.nombre}</span><span class="text-xs text-gray-400">${e.rut}</span></div>`
    ).join('');
  } else {
    studentsContainer.innerHTML = '<p class="text-xs italic text-gray-400">Sin alumnos</p>';
  }

  const today = todayStr();
  const asistencia = await AdminApi.asistencia(idCurso);
  const attContainer = document.getElementById(`att-content-${idCurso}`);

  if (attContainer) {
    if (asistencia.length) {
      attContainer.innerHTML = asistencia.map(a =>
        `<div class="flex justify-between"><span>${a.nombre}</span><span class="text-xs font-bold ${a.estado === 'PRESENTE' ? 'text-emerald-600' : a.estado === 'AUSENTE' ? 'text-rose-600' : 'text-amber-600'}">${a.estado || 'Sin registro'}</span></div>`
      ).join('');
    } else {
      attContainer.innerHTML = '<p class="text-xs italic text-gray-400">Sin registros de asistencia</p>';
    }
  }

  const calificaciones = await DocenteApi.calificaciones(idCurso);
  const gradesContainer = document.getElementById(`grades-content-${idCurso}`);

  if (gradesContainer) {
    if (calificaciones.length) {
      gradesContainer.innerHTML = calificaciones.map(g =>
        `<div class="flex justify-between"><span>${g.nombreEstudiante}</span><span class="text-xs font-bold ${parseFloat(g.nota) >= 4 ? 'text-emerald-600' : 'text-rose-600'}">${parseFloat(g.nota).toFixed(1)}</span></div>`
      ).join('');
    } else {
      gradesContainer.innerHTML = '<p class="text-xs italic text-gray-400">Sin calificaciones</p>';
    }
  }
}

function toggleAttendanceDetails(idCurso) {
  const details = document.getElementById(`att-details-${idCurso}`);
  details.classList.toggle('hidden');

  if (!details.classList.contains('hidden')) {
    loadAttendanceDetails(idCurso);
  }
}

async function loadAttendanceDetails(idCurso) {
  const container = document.getElementById(`att-content-${idCurso}`);
  const estudiantes = await AdminApi.estudiantes(idCurso);

  if (!estudiantes.length) {
    container.innerHTML = '<p class="text-sm text-gray-400 italic">No hay estudiantes en este curso.</p>';
    return;
  }

  const today = todayStr();
  let html = '';

  const registros = await AdminApi.asistencia(idCurso);

  estudiantes.forEach(e => {
    const registro = registros.find(a => a.idEstudiante === e.idEstudiante);
    const fechaRegistro = registro?.fecha || today;
    const justificacion = registro?.justificacion;
    html += `
      <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
              ${e.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>

            <span class="font-semibold text-gray-800 text-sm">${e.nombre}</span>
            <span class="text-xs text-gray-400">${e.rut}</span>
          </div>

          <div class="flex items-center gap-3">
            <label class="text-xs font-bold text-gray-500 uppercase">📅 Ver día:</label>

            <input
              type="date"
              id="att-date-${idCurso}-${e.idEstudiante}"
              value="${fechaRegistro}"
              onchange="updateAttStatus(${idCurso}, ${e.idEstudiante})"
              class="px-2 py-1 border border-gray-300 rounded text-xs focus:border-indigo-500 outline-none bg-white cursor-pointer"
            />

            <span id="att-status-${idCurso}-${e.idEstudiante}" class="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
              Cargando...
            </span>
            <button onclick="openJustificacionModal(${e.idEstudiante}, ${idCurso}, '${encodeURIComponent(e.nombre)}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100">Justificar</button>
          </div>
        </div>

        <div id="att-obs-${idCurso}-${e.idEstudiante}" class="text-xs text-gray-500 italic pl-10 mt-1">
          ${justificacion ? `Justificación: ${escapeHtml(justificacion.motivo || 'Sin motivo')} (${escapeHtml(justificacion.estadoJustificacion || 'PENDIENTE')})` : 'Seleccione un día para ver el estado.'}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  estudiantes.forEach(e => updateAttStatus(idCurso, e.idEstudiante));
}

function updateAttStatus(idCurso, idEstudiante) {
  const fecha = document.getElementById(`att-date-${idCurso}-${idEstudiante}`).value;
  const statusBadge = document.getElementById(`att-status-${idCurso}-${idEstudiante}`);
  const obsDiv = document.getElementById(`att-obs-${idCurso}-${idEstudiante}`);

  const registro = MOCK_DB.asistencia.find(a => a.idEstudiante === idEstudiante && a.fecha === fecha);

  if (registro && registro.estado) {
    const estado = registro.estado.toUpperCase();

    let badgeClass = '';
    let icon = '❓';

    if (estado === 'PRESENTE') {
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      icon = '✅';
    } else if (estado === 'AUSENTE') {
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
      icon = '❌';
    } else if (estado === 'TARDANZA') {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
      icon = '⏰';
    } else if (estado === 'JUSTIFICADO') {
      badgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
      icon = '📄';
    }

    statusBadge.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}`;
    statusBadge.textContent = `${icon} ${estado}`;

    let texto = registro.observacion ? `📝 Obs: ${registro.observacion}` : 'Sin observaciones registradas.';

    const justificacion = (MOCK_DB.justificaciones || []).find(j =>
      j.idEstudiante === idEstudiante &&
      j.fecha === fecha
    );

    if (justificacion) {
      texto += ` | ⚖️ Justificación: ${justificacion.motivo || 'S/M'} (${justificacion.estadoJustificacion || 'PENDIENTE'})`;
    }

    obsDiv.textContent = texto;
    obsDiv.classList.remove('text-gray-400');
    obsDiv.classList.add('text-gray-600');
  } else {
    statusBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-400 border border-gray-200';
    statusBadge.textContent = 'Sin registro';

    obsDiv.textContent = 'No se ha tomado asistencia en esta fecha.';
    obsDiv.classList.add('text-gray-400');
    obsDiv.classList.remove('text-gray-600');
  }
}

function toggleGradesDetails(idCurso) {
  const details = document.getElementById(`grades-details-${idCurso}`);
  details.classList.toggle('hidden');

  if (!details.classList.contains('hidden')) {
    loadGradesDetails(idCurso);
  }
}

async function loadGradesDetails(idCurso) {
  const container = document.getElementById(`grades-content-${idCurso}`);
  const estudiantes = await AdminApi.estudiantes(idCurso);

  if (!estudiantes.length) {
    container.innerHTML = '<p class="text-sm text-gray-400 italic">No hay estudiantes en este curso.</p>';
    return;
  }

  const todasNotas = await AdminApi.calificaciones(idCurso);

  let html = '';
  let estudiantesConNotas = 0;

  estudiantes.forEach(e => {
    const notasAlumno = todasNotas.filter(n => n.idEstudiante === e.idEstudiante);

    let promedioHtml = '';

    if (notasAlumno.length > 0) {
      const promedio = calcularPromedioFinal(notasAlumno) || 0;
      const colorProm = promedio >= 4.0 ? 'text-emerald-700' : 'text-rose-700';

      promedioHtml = `
        <div class="text-right">
          <div class="text-xs text-gray-500 uppercase font-bold">Promedio</div>
          <div class="text-lg font-bold ${colorProm}">${promedio.toFixed(1)}</div>
        </div>
      `;

      estudiantesConNotas++;
    } else {
      promedioHtml = `
        <div class="text-right">
          <div class="text-xs text-gray-500 uppercase font-bold">Promedio</div>
          <div class="text-lg font-bold text-gray-400">—</div>
        </div>
      `;
    }

    let notasHtml = '';

    if (notasAlumno.length > 0) {
      notasHtml = `
        <div class="space-y-2 pl-10">
        ${notasAlumno.map(n => {
          const notaNum = parseFloat(n.nota);
          const coef = parseInt(n.coeficiente) === 2 ? 2 : 1;
          const color = notaNum >= 4.0 ? 'text-emerald-600' : 'text-rose-600';
          const bg = notaNum >= 4.0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';
          return `
            <div class="flex justify-between items-center p-2 rounded border ${bg}">
              <div>
                <div class="text-xs font-bold text-gray-700">${n.descripcion || n.tipoEvaluacion || 'Sin descripción'}</div>
                <div class="text-[10px] text-gray-400">${n.fechaNota || n.fechaRegistro || 'Sin fecha'}</div>
                ${n.asignatura ? `<div class="text-[10px] text-indigo-500 font-medium">${n.asignatura}</div>` : ''}
              </div>
              <div class="text-lg font-bold ${color}">${notaNum.toFixed(1)}</div>
            </div>
          `;
        }).join('')}
        </div>
      `;
    } else {
      notasHtml = `
        <div class="pl-10 py-3">
          <p class="text-xs text-gray-400 italic">Sin calificaciones registradas para este alumno.</p>
        </div>
      `;
    }

    html += `
      <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
              ${e.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>

            <span class="font-semibold text-gray-800 text-sm">${e.nombre}</span>
          </div>

          ${promedioHtml}
        </div>

        ${notasHtml}
      </div>
    `;
  });

  const promedioGeneralCurso = calcularPromedioFinal(todasNotas);
  const colorPromGenCurso = (promedioGeneralCurso || 0) >= 4.0 ? 'text-emerald-700' : 'text-rose-700';
  const resumen = `<div class="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg"> <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm"> <span class="text-indigo-700 font-semibold"> 📊 Total estudiantes: ${estudiantes.length} · Con notas: ${estudiantesConNotas} · Sin notas: ${estudiantes.length - estudiantesConNotas} </span> <span class="text-indigo-700 font-semibold"> Promedio General del Curso: <strong class="text-lg ${colorPromGenCurso}">${promedioGeneralCurso !== null ? promedioGeneralCurso.toFixed(1) : '—'}</strong> </span> </div> </div>`;

  container.innerHTML = html + resumen;
  filtrarAlumnosDetalleNotas(idCurso, document.getElementById(`grades-buscar-${idCurso}`)?.value || '');
}

async function exportarCursoAExcel(idCurso, nombreCurso) {
  try {
    const estudiantes = await AdminApi.estudiantes(idCurso);
    const todaAsistencia = await AdminApi.asistencia(idCurso);

    const asistenciaData = todaAsistencia.map(a => {
      const est = estudiantes.find(e => e.idEstudiante === a.idEstudiante);

      const just = a.justificacion || (MOCK_DB.justificaciones || []).find(j =>
        j.idEstudiante === a.idEstudiante &&
        j.fecha === a.fecha
      ) || null;

      return {
        Alumno: est ? est.nombre : 'Desconocido',
        RUT: est ? est.rut : 'Sin RUT',
        Curso: nombreCurso,
        Fecha: a.fecha,
        'Profesor registro inicial': a.profesorResponsable || a.creadoPor || '',
        Estado: a.estado,
        'Motivo justificación': just?.motivo || '',
        'Estado justificación': just?.estadoJustificacion || '',
        'Observación justificación': just?.observacion || '',
        'Observación asistencia': a.observacion || ''
      };
    });

    const calificaciones = await AdminApi.calificaciones(idCurso);

    const notasData = calificaciones.map(n => ({
      Estudiante: n.nombreEstudiante,
      RUT: estudiantes.find(e => e.idEstudiante === n.idEstudiante)?.rut || '',
      Asignatura: n.asignatura || n.nombreCurso,
      Evaluación: n.descripcion || n.tipoEvaluacion,
      Nota: n.nota,
      Ponderación: n.ponderacion,
      Fecha: n.fechaNota || n.fechaRegistro
    }));

    const wb = XLSX.utils.book_new();

    if (asistenciaData.length > 0) {
      const wsAsistencia = XLSX.utils.json_to_sheet(asistenciaData);
      XLSX.utils.book_append_sheet(wb, wsAsistencia, 'Asistencia');
    } else {
      const wsAsistencia = XLSX.utils.aoa_to_sheet([['Sin registros de asistencia para este curso']]);
      XLSX.utils.book_append_sheet(wb, wsAsistencia, 'Asistencia');
    }

    if (notasData.length > 0) {
      const wsNotas = XLSX.utils.json_to_sheet(notasData);
      XLSX.utils.book_append_sheet(wb, wsNotas, 'Calificaciones');
    } else {
      const wsNotas = XLSX.utils.aoa_to_sheet([['Sin calificaciones registradas para este curso']]);
      XLSX.utils.book_append_sheet(wb, wsNotas, 'Calificaciones');
    }

    const nombreArchivo = `${nombreCurso.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(wb, nombreArchivo);
    toast('✅ Archivo Excel descargado exitosamente');
  } catch (error) {
    console.error('Error al exportar:', error);
    toast('❌ Error al exportar datos. Revisa la consola para más detalles.');
  }
}

async function updateGradesView(idCurso, idEstudiante) {
  const asignatura = document.getElementById(`grade-subj-${idCurso}-${idEstudiante}`).value;
  const listDiv = document.getElementById(`grades-list-${idCurso}-${idEstudiante}`);

  const todasNotas = await AdminApi.calificaciones(idCurso);

  const notasAlumno = todasNotas.filter(n =>
    n.idEstudiante === idEstudiante &&
    (n.asignatura === asignatura || n.nombreCurso === asignatura)
  );

  if (!notasAlumno.length) {
    listDiv.innerHTML = `<p class="text-xs text-gray-400 italic">No hay notas registradas en ${asignatura}.</p>`;
    return;
  }

  let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">';

  notasAlumno.forEach(n => {
    const notaNum = parseFloat(n.nota);
    const color = notaNum >= 4.0 ? 'text-emerald-600' : 'text-rose-600';
    const bg = notaNum >= 4.0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';

    html += `
      <div class="flex justify-between items-center p-2 rounded border ${bg}">
        <div>
          <div class="text-xs font-bold text-gray-700">${n.descripcion || n.tipoEvaluacion}</div>
          <div class="text-[10px] text-gray-400">${n.fechaNota || n.fechaRegistro}</div>
        </div>

        <div class="text-lg font-bold ${color}">${notaNum.toFixed(1)}</div>
      </div>
    `;
  });

  html += '</div>';

  const promedio = notasAlumno.reduce((acc, n) => acc + parseFloat(n.nota), 0) / notasAlumno.length;
  const colorProm = promedio >= 4.0 ? 'text-emerald-700' : 'text-rose-700';

  html += `<div class="mt-2 text-right text-xs font-bold text-gray-600">Promedio: <span class="${colorProm} text-sm">${promedio.toFixed(1)}</span></div>`;

  listDiv.innerHTML = html;
}

async function renderAdminEstudiantes() {
    document.getElementById('pageTitle').textContent = 'Directorio de Alumnos';
    document.getElementById('pageSubtitle').textContent = 'Listado general de estudiantes y sus cursos asignados';
    
    const headerHtml = `
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex justify-between items-center shadow-sm">
        <div>
            <h3 class="font-bold text-gray-900 text-lg">Gestión de Estudiantes</h3>
            <p class="text-sm text-gray-500">Administra la matrícula y asignación de cursos</p>
        </div>
        <button onclick="openStudentModal()" class="btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md transition">
            + Agregar Nuevo Alumno
        </button>
    </div>
    `;

    const estudiantes = await AdminApi.estudiantes();
    
    let tableHtml = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Alumno</th>
                        <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">RUT</th>
                        <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Cursos Asignados</th>
                        <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Apoderado</th>
                        <th class="px-6 py-3 text-center text-xs font-bold uppercase text-gray-500">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
    `;

    if (!estudiantes.length) {
        tableHtml += `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400 italic">No hay alumnos matriculados en el sistema.</td></tr>`;
    } else {
        estudiantes.forEach(s => {
            // Compatibilidad con alumnos antiguos que solo tienen nombreCurso
            const cursosAlumno = Array.isArray(s.cursosAsignados) && s.cursosAsignados.length > 0 
                ? s.cursosAsignados 
                : [s.nombreCurso || 'Sin curso'];
            
            // Generamos los chips visuales para cada curso asignado
            const cursosChips = cursosAlumno.map(c => 
                `<span class="inline-block px-2 py-0.5 mr-1 mb-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">${c}</span>`
            ).join('');

            tableHtml += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-3">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                ${s.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <span class="font-medium text-gray-900">${s.nombre}</span>
                        </div>
                    </td>
                    <td class="px-6 py-3 text-sm text-gray-500">${s.rut}</td>
                    <td class="px-6 py-3">
                        <div class="flex flex-wrap">
                            ${cursosChips}
                        </div>
                    </td>
                    <td class="px-6 py-3 text-sm text-gray-600">
                        <strong class="text-slate-800">${s.apoderadoNombre || 'Sin asignar'}</strong><br>
                        <span class="text-xs text-indigo-500 font-medium">${s.apoderadoCorreo || ''}</span>
                    </td>
                    <td class="px-6 py-3 text-center space-x-3">
                        <button onclick="openEditStudentModal(${s.idEstudiante})" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">✏️ Editar</button>
                        <button onclick="deleteStudent(${s.idEstudiante})" class="text-xs font-bold text-rose-600 hover:text-rose-800 transition">🗑️ Eliminar</button>
                    </td>
                </tr>
            `;
        });
    }

    tableHtml += `
                </tbody>
            </table>
        </div>
    </div>
    `;

    document.getElementById('content').innerHTML = headerHtml + tableHtml;
    agregarBuscadorNombre('content', 'buscarAlumnoAdmin', '🔍 Buscar alumno por nombre...');
}

// ==========================================
// SELECTOR EN CASCADA: CURSO (NIVEL) → MATERIAS
// (Admin → Alumnos)
// ==========================================
let cursosModalEstudiante = [];
let selectedCursosEstudianteSet = new Set();

function nivelesDeCursosEstudiante(cursos) {
  return [...new Set((cursos || []).map(c => c.nivel || c.nombreCurso || 'Sin nivel'))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
}

function sincronizarSeleccionEstudiante(containerId, checkboxName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(`input[name="${checkboxName}"]`).forEach(cb => {
    const id = Number(cb.value);
    if (cb.checked) selectedCursosEstudianteSet.add(id);
    else selectedCursosEstudianteSet.delete(id);
  });
}

function renderChipsCursosEstudiante(chipContainerId) {
  const cont = document.getElementById(chipContainerId);
  if (!cont) return;

  const sel = cursosModalEstudiante
    .filter(c => selectedCursosEstudianteSet.has(Number(c.idCurso)))
    .sort((a, b) =>
      String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es', { numeric: true }) ||
      String(a.asignatura || a.nombreCurso || '').localeCompare(String(b.asignatura || b.nombreCurso || ''), 'es')
    );

  if (!sel.length) {
    cont.innerHTML = '<span class="text-xs text-gray-400 italic">Sin materias seleccionadas.</span>';
    return;
  }

  cont.innerHTML = sel.map(c => `
    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
      ${escapeHtml(c.asignatura || c.nombreCurso)} · ${escapeHtml(c.nivel || '')}
    </span>
  `).join('');
}

function actualizarMateriasEstudiante(selectNivelId, containerId, checkboxName, chipContainerId) {
  sincronizarSeleccionEstudiante(containerId, checkboxName);

  const select = document.getElementById(selectNivelId);
  const container = document.getElementById(containerId);
  if (!select || !container) return;

  const nivel = select.value;

  if (!nivel) {
    container.innerHTML = '<p class="text-xs text-gray-400 p-2">Selecciona primero un curso (1° Básico, 2° Básico, etc.).</p>';
  } else {
    const materias = cursosModalEstudiante
      .filter(c => (c.nivel || c.nombreCurso || 'Sin nivel') === nivel)
      .sort((a, b) =>
        String(a.asignatura || a.nombreCurso || '').localeCompare(String(b.asignatura || b.nombreCurso || ''), 'es')
      );

    if (!materias.length) {
      container.innerHTML = '<p class="text-xs text-gray-400 p-2">No hay materias para este curso.</p>';
    } else {
      container.innerHTML = materias.map(c => {
        const checked = selectedCursosEstudianteSet.has(Number(c.idCurso)) ? 'checked' : '';
        const etiqueta = c.asignatura || c.nombreCurso || 'Sin asignatura';
        const detalle = c.nombreCurso && c.nombreCurso !== etiqueta ? c.nombreCurso : (c.nivel || '');

        return `
          <label class="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer border border-gray-100 transition">
            <input type="checkbox"
                   name="${checkboxName}"
                   value="${c.idCurso}"
                   ${checked}
                   class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
            <span class="text-sm text-slate-700 font-medium">
              ${escapeHtml(etiqueta)}
              <span class="text-xs text-gray-400">(${escapeHtml(detalle)})</span>
            </span>
          </label>
        `;
      }).join('');
    }
  }

  if (chipContainerId) renderChipsCursosEstudiante(chipContainerId);
}

function openStudentModal() {
  const m = document.getElementById('modal');

  cursosModalEstudiante = MOCK_DB.cursos || [];
  selectedCursosEstudianteSet = new Set();

  const niveles = nivelesDeCursosEstudiante(cursosModalEstudiante);

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Matricular Nuevo Alumno</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
    </div>
    <form id="formStudent" onsubmit="saveStudent(event)" class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
          <input type="text" id="modalEstNombre" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: Juan Carlos Pérez"/>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">RUT</label>
          <input type="text" id="modalEstRut" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: 12.345.678-9"/>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">1) Curso (nivel)</label>
        <select id="modalEstNivel" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                onchange="actualizarMateriasEstudiante('modalEstNivel', 'modalEstMaterias', 'modalEstCursos', 'modalEstChips')">
          <option value="">Seleccione un curso...</option>
          ${niveles.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">2) Materias del curso</label>
        <div id="modalEstMaterias" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-slate-50/50">
          <p class="text-xs text-gray-400 p-2">Selecciona primero un curso.</p>
        </div>
        <p class="text-[10px] text-gray-400 mt-1">Puedes marcar varias materias. La primera (por orden de curso) será el curso principal.</p>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Materias seleccionadas</label>
        <div id="modalEstChips" class="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-slate-50/50 min-h-[42px]">
          <span class="text-xs text-gray-400 italic">Sin materias seleccionadas.</span>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Correo del Estudiante</label>
        <input type="email" id="modalEstCorreo" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: juan.perez@edu.cl"/>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Matricular Alumno</button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');
}

async function saveStudent(e) {
  e.preventDefault();
  const nombre = sanitizeInput(document.getElementById('modalEstNombre').value);
  const rut = sanitizeInput(document.getElementById('modalEstRut').value);
  const correo = sanitizeInput(document.getElementById('modalEstCorreo').value);

  sincronizarSeleccionEstudiante('modalEstMaterias', 'modalEstCursos');
  const idsSeleccionados = Array.from(selectedCursosEstudianteSet).map(Number);

  if (!idsSeleccionados.length) {
    toast('❌ Debes seleccionar al menos una materia para matricular al alumno');
    return;
  }

  const cursosSel = cursosModalEstudiante
    .filter(c => idsSeleccionados.includes(Number(c.idCurso)))
    .sort((a, b) =>
      String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es', { numeric: true }) ||
      String(a.asignatura || a.nombreCurso || '').localeCompare(String(b.asignatura || b.nombreCurso || ''), 'es')
    );

  const cursoPrincipal = cursosSel[0];

  // 1) Se crea el alumno con el curso principal
  const creado = await AdminApi.crearEstudiante({
    nombre,
    rut,
    idCurso: cursoPrincipal.idCurso,
    nombreCurso: cursoPrincipal.nombreCurso,
    curso: cursoPrincipal.nivel,
    correo,
    cursosAsignados: [cursoPrincipal.nombreCurso]
  });

  // 2) Si marcó más materias, se asignan todas con el mismo endpoint de edición
  if (idsSeleccionados.length > 1 && creado?.idEstudiante) {
    await AdminApi.editarEstudiante(creado.idEstudiante, {
      nombre,
      rut,
      cursosAsignados: idsSeleccionados
    });
  }

  closeModal();
  toast('✅ Alumno matriculado exitosamente');
  await renderAdminEstudiantes();
}

function getDocentesParaCursoSelect() {
  return (MOCK_DB.users || []).filter(u => u.rol === 'DOCENTE');
}

function getHoraBloqueTexto(bloque) {
  const horarios = {
    1: '08:15-09:00',
    2: '09:00-09:45',
    3: '10:05-10:50',
    4: '10:50-11:35',
    5: '11:55-12:40',
    6: '12:40-13:25',
    7: '14:10-14:55',
    8: '14:55-15:40'
  };
  return horarios[bloque] || 'Horario no definido';
}

function getOpcionesHorarioAsignatura() {
  return [
    { bloques: [1, 2], label: 'Horario 1 · 08:15 - 09:45' },
    { bloques: [3, 4], label: 'Horario 2 · 10:05 - 11:35' },
    { bloques: [5, 6], label: 'Horario 3 · 11:55 - 13:25' },
    { bloques: [7, 8], label: 'Horario 4 · 14:10 - 15:40' }
  ];
}

function getCursoDiasSemana(curso) {
  if (curso?.horariosSemana && Object.keys(curso.horariosSemana).length) {
    return Object.keys(curso.horariosSemana).map(Number).sort((a, b) => a - b);
  }
  if (Array.isArray(curso?.diasSemana) && curso.diasSemana.length) return curso.diasSemana.map(Number);
  if (curso?.diaSemana != null) return [Number(curso.diaSemana)];
  return [];
}

function obtenerBloquesCurso(curso) {
  if (curso?.horariosSemana && Object.keys(curso.horariosSemana).length) {
    return [...new Set(Object.values(curso.horariosSemana).flat().map(Number))];
  }
  if (Array.isArray(curso.bloquesAsignados) && curso.bloquesAsignados.length) {
    return curso.bloquesAsignados.map(Number);
  }
  const horarios = (MOCK_DB.horarios || []).filter(h => h.idCurso === curso.idCurso);
  if (horarios.length) return [...new Set(horarios.map(h => Number(h.idBloque)))];
  return [];
}

function getHorariosSemanaCurso(curso) {
  // 1) Asignación manual guardada desde el modal de cursos
  if (curso?.horariosSemana && Object.keys(curso.horariosSemana).length) {
    const map = {};
    Object.entries(curso.horariosSemana).forEach(([dia, bloques]) => {
      const d = Number(dia);
      if (Array.isArray(bloques) && bloques.length) map[d] = bloques.map(Number);
    });
    if (Object.keys(map).length) return map;
  }
  // 2) Tabla de horarios
  const horarios = (MOCK_DB.horarios || []).filter(h => h.idCurso === curso.idCurso);
  if (horarios.length) {
    const map = {};
    horarios.forEach(h => {
      const dias = Array.isArray(h.diaSemana)
        ? h.diaSemana.map(Number)
        : (h.diaSemana === '*' ? [1, 2, 3, 4, 5] : [Number(h.diaSemana)]);
      dias.forEach(d => {
        if (!map[d]) map[d] = [];
        const b = Number(h.idBloque);
        if (!map[d].includes(b)) map[d].push(b);
      });
    });
    return map;
  }
  return null; // sin horario definido
}

function getBloquesHorarioDisponibles(docenteId, cursoIdActual = null, diaSemana = null) {
  const ocupados = new Set();
  const propios = new Set();
  const diaElegido = diaSemana != null ? Number(diaSemana) : null;

  // Bloques que OTROS cursos ocupan ese día (solo si tienen horariosSemana guardado)
  const bloquesOcupadosDeCursoEnDia = (curso, dia) => {
    if (curso.horariosSemana && Object.keys(curso.horariosSemana).length) {
      return (curso.horariosSemana[dia] || curso.horariosSemana[String(dia)] || []).map(Number);
    }
    return [];
  };

  // Bloques que el curso EN EDICIÓN ya tiene ese día (para no bloquearse a sí mismo)
  const bloquesPropiosDeCursoEnDia = (curso, dia) => {
    if (curso.horariosSemana && Object.keys(curso.horariosSemana).length) {
      return (curso.horariosSemana[dia] || curso.horariosSemana[String(dia)] || []).map(Number);
    }
    const mapa = getHorariosSemanaCurso(curso);
    if (mapa) return dia != null ? (mapa[dia] || []) : [...new Set(Object.values(mapa).flat())];
    return [];
  };

  const cursoActual = cursoIdActual != null
    ? (MOCK_DB.cursos || []).find(c => c.idCurso === Number(cursoIdActual))
    : null;

  // Clave del curso/nivel que se está editando o creando.
  // SOLO las asignaturas del MISMO curso/nivel (mismos alumnos) pueden bloquear bloques.
  const claveGrupoActual = cursoActual
    ? obtenerClaveCursoGrupo(cursoActual)
    : `${document.getElementById('modalCursoNivel')?.value?.trim() || ''}|${document.getElementById('modalCursoAnio')?.value?.trim() || ''}`;

  if (cursoActual && diaElegido != null) {
    bloquesPropiosDeCursoEnDia(cursoActual, diaElegido).forEach(b => propios.add(b));
  }

  (MOCK_DB.cursos || []).forEach(curso => {
    if (Number(curso.idCurso) === Number(cursoIdActual)) return;

    // ⭐ REGLA CLAVE: los demás cursos/niveles son totalmente independientes.
    // Solo bloquean las asignaturas del MISMO curso/nivel (mismos estudiantes).
    if (obtenerClaveCursoGrupo(curso) !== claveGrupoActual) return;

    const diasCurso = getCursoDiasSemana(curso);
    const mismoDia = diaElegido == null || diasCurso.includes(diaElegido);
    if (!mismoDia) return;

    bloquesOcupadosDeCursoEnDia(curso, diaElegido).forEach(b => ocupados.add(b));
  });

  return [1, 2, 3, 4, 5, 6, 7, 8].map(bloque => ({
    bloque,
    disponible: !ocupados.has(bloque) || propios.has(bloque),
    label: `Bloque ${bloque} · ${getHoraBloqueTexto(bloque)}`
  }));
}

function openCursoModal() {
  const m = document.getElementById('modal');
  const docentes = getDocentesParaCursoSelect();

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Registrar Nuevo Curso</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form id="formCurso" onsubmit="saveCurso(event)" class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Curso</label>
          <input type="text" id="modalCursoNombre" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: Matemáticas 1° Básico"/>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Asignatura</label>
          <input type="text" id="modalCursoAsignatura" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: Matemáticas"/>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nivel</label>
          <input type="text" id="modalCursoNivel" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: 1° Básico"/>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Año Escolar</label>
          <input type="number" id="modalCursoAnio" required value="2024" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Profesor responsable</label>
<select id="modalCursoProfesor" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" onchange="renderBloquesDisponibles(this.value, null)">
          <option value="">Selecciona un profesor</option>
          ${docentes.map(d => `<option value="${d.identificador}">${escapeHtml(d.nombre)}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Horario semanal de la asignatura</label>
        ${horariosSemanaSelectorHtml('cursoHorariosSemana', null)}
        <p class="text-[10px] text-gray-400 mt-2">Puedes marcar varios días con distintos horarios. Todo lo marcado se guarda.</p>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Crear Curso</button>
      </div>
    </form>
  `;  

  renderBloquesDisponibles('', null);
  m.classList.remove('hidden');
}

function openCursoEditModal(idCurso) {
  const curso = MOCK_DB.cursos.find(c => Number(c.idCurso) === Number(idCurso));
  const docentes = getDocentesParaCursoSelect();
  const m = document.getElementById('modal');

  if (!curso) return;

  const bloquesSeleccionados = Array.isArray(curso.bloquesAsignados) ? curso.bloquesAsignados : [1, 2];

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Editar Curso</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form id="formCursoEdit" onsubmit="saveCursoEdit(event, ${idCurso})" class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Curso</label>
          <input type="text" id="editCursoNombre" value="${escapeHtml(curso.nombreCurso)}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Asignatura</label>
          <input type="text" id="editCursoAsignatura" value="${escapeHtml(curso.asignatura || '')}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nivel</label>
          <input type="text" id="editCursoNivel" value="${escapeHtml(curso.nivel || '')}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Año Escolar</label>
          <input type="number" id="editCursoAnio" value="${escapeHtml(curso.anioEscolar || new Date().getFullYear())}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Profesor responsable</label>
        <select id="editCursoProfesor" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" onchange="renderBloquesDisponibles(this.value, ${idCurso})">
          <option value="">Selecciona un profesor</option>
          ${docentes.map(d => `<option value="${d.identificador}" ${((curso.profesorAsignado || curso.profesorBloque1 || curso.profesorBloque2) === d.identificador ? 'selected' : '')}>${escapeHtml(d.nombre)}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Horario semanal de la asignatura</label>
        ${horariosSemanaSelectorHtml('cursoHorariosSemanaEdit', curso.horariosSemana)}
        <p class="text-[10px] text-gray-400 mt-2">Puedes marcar varios días con distintos horarios. Todo lo marcado se guarda.</p>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad de notas por alumno (máx. 10)</label>
        <input type="number" id="editCursoNotasPorCurso" min="1" max="10" required value="${parseInt(curso.notasPorCurso, 10) || 6}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        <p class="text-[10px] text-gray-400 mt-1">Define cuántas columnas de notas verá el docente en el libro de calificaciones.</p>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Guardar Cambios</button>
      </div>
    </form>
  `;

  const diaInicial = Array.isArray(curso.diasSemana) && curso.diasSemana.length ? Number(curso.diasSemana[0]) : Number(curso.diaSemana || 1);
  renderBloquesDisponibles((curso.profesorAsignado || curso.profesorBloque1 || curso.profesorBloque2 || ''), idCurso);
  m.classList.remove('hidden');
}

function horariosSemanaSelectorHtml(name, horariosSemanaActual) {
  const nombresDia = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
  // ★ FIX: normalizar si viene como string JSON
  let hs = horariosSemanaActual;
  if (typeof hs === 'string') { try { hs = JSON.parse(hs); } catch (_) { hs = {}; } }
  hs = hs || {};

  return `<div class="space-y-2 max-h-72 overflow-y-auto pr-1">
    ${[1, 2, 3, 4, 5].map(dia => `
      <div class="border border-gray-200 rounded-lg p-2.5 bg-slate-50">
        <div class="text-[11px] font-bold text-gray-600 uppercase mb-1.5">📅 ${nombresDia[dia]}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${getOpcionesHorarioAsignatura().map(({ bloques, label }) => {
            const marcada = (hs[dia] || hs[String(dia)] || []).some(b => bloques.includes(Number(b)));
            return `<label class="flex items-center gap-2 p-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white">
              <input type="checkbox" name="${name}" data-dia="${dia}" data-bloques="${bloques.join(',')}"
                     ${marcada ? 'checked' : ''}
                     class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
              <span>${label}</span>
            </label>`;
          }).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

function leerHorariosSemanaDelForm(name) {
  const horariosSemana = {};
  document.querySelectorAll(`input[name="${name}"]:checked`).forEach(cb => {
    const dia = Number(cb.dataset.dia);
    const bloques = (cb.dataset.bloques || '').split(',').map(Number).filter(Boolean);
    if (!horariosSemana[dia]) horariosSemana[dia] = [];
    bloques.forEach(b => { if (!horariosSemana[dia].includes(b)) horariosSemana[dia].push(b); });
  });
  return horariosSemana;
}

function renderBloquesDisponibles(docenteId, cursoIdActual = null) {
  const isEdit = cursoIdActual != null;
  document.querySelectorAll('#modalContent input[name="cursoHorariosSemana"], #modalContent input[name="cursoHorariosSemanaEdit"]').forEach(input => {
    const dia = Number(input.dataset.dia || 1);
    const bloques = getBloquesHorarioDisponibles(docenteId, cursoIdActual, dia);
    const bloquesDelHorario = (input.dataset.bloques || input.value || '').split(',').map(Number).filter(Boolean);
    const ocupada = bloquesDelHorario.some(block => {
      const disp = bloques.find(b => b.bloque === block);
      return disp ? !disp.disponible : false;
    });
    input.disabled = ocupada || (!docenteId && !isEdit);
    input.checked = input.checked && !ocupada;
    const label = input.closest('label');
    if (label) {
      label.classList.toggle('opacity-50', ocupada);
      label.classList.toggle('line-through', ocupada);
    }
  });
}

async function saveCurso(e) {
  e.preventDefault();
  const profesorAsignado = document.getElementById('modalCursoProfesor').value;
  const horariosSemana = leerHorariosSemanaDelForm('cursoHorariosSemana');
  if (!profesorAsignado) {
    toast('❌ Debes seleccionar el profesor responsable');
    return;
  }
  if (!Object.keys(horariosSemana).length) {
    toast('❌ Debes seleccionar al menos un horario para la asignatura');
    return;
  }
  const diasSemana = Object.keys(horariosSemana).map(Number).sort((a, b) => a - b);
  const bloquesAsignados = [...new Set(Object.values(horariosSemana).flat())].sort((a, b) => a - b);
  const data = {
    nombreCurso: document.getElementById('modalCursoNombre').value.trim(),
    asignatura: document.getElementById('modalCursoAsignatura').value.trim(),
    nivel: document.getElementById('modalCursoNivel').value.trim(),
    anioEscolar: document.getElementById('modalCursoAnio').value,
    profesorAsignado,
    profesorBloque1: profesorAsignado,
    profesorBloque2: profesorAsignado,
    diaSemana: diasSemana[0],
    diasSemana,
    bloquesAsignados,
    horariosSemana
  };
  await AdminApi.crearCurso(data);
  closeModal();
  toast('✅ Curso creado exitosamente');

  // Buscamos el curso recién creado por su nivel y año para mantener la vista
  const cursoCreado = MOCK_DB.cursos.find(c => c.nivel === data.nivel && c.anioEscolar == data.anioEscolar);
  const claveGrupo = cursoCreado ? obtenerClaveCursoGrupo(cursoCreado) : null;

  await renderAdminCursos(claveGrupo);
}

async function saveCursoEdit(e, idCurso) {
  e.preventDefault();
  const profesorAsignado = document.getElementById('editCursoProfesor').value;
  const horariosSemana = leerHorariosSemanaDelForm('cursoHorariosSemanaEdit');
  if (!profesorAsignado) {
    toast('❌ Debes seleccionar el profesor responsable');
    return;
  }
  if (!Object.keys(horariosSemana).length) {
    toast('❌ Debes seleccionar al menos un horario para la asignatura');
    return;
  }
  const diasSemana = Object.keys(horariosSemana).map(Number).sort((a, b) => a - b);
  const bloquesAsignados = [...new Set(Object.values(horariosSemana).flat())].sort((a, b) => a - b);
  const data = {
    nombreCurso: document.getElementById('editCursoNombre').value.trim(),
    asignatura: document.getElementById('editCursoAsignatura').value.trim(),
    nivel: document.getElementById('editCursoNivel').value.trim(),
    anioEscolar: document.getElementById('editCursoAnio').value,
    profesorAsignado,
    profesorBloque1: profesorAsignado,
    profesorBloque2: profesorAsignado,
    diaSemana: diasSemana[0],
    diasSemana,
    bloquesAsignados,
    horariosSemana,
    notasPorCurso: parseInt(document.getElementById('editCursoNotasPorCurso')?.value, 10) || 6
  };
  await AdminApi.editarCurso(idCurso, data);
  closeModal();
  toast('✅ Curso actualizado exitosamente');

  // Obtenemos la clave del grupo al que pertenece el curso editado para no perder la vista
  const cursoEditado = MOCK_DB.cursos.find(c => c.idCurso === idCurso);
  const claveGrupo = cursoEditado ? obtenerClaveCursoGrupo(cursoEditado) : null;

  await renderAdminCursos(claveGrupo);
}

async function renderAdminAbsences() {
  document.getElementById('pageTitle').textContent = 'Reporte de Inasistencias';
  document.getElementById('pageSubtitle').textContent = 'Seguimiento de estudiantes con ausencias reiteradas';

  const cursos = await AdminApi.cursos();
  const estudiantes = await AdminApi.estudiantes();
  const asistencia = await AdminApi.asistencia();
  const cfg = getConfigAsistencia();
  const fechaInicio = new Date().getFullYear() + '-01-01';
  const fechaFin = new Date().toISOString().split('T')[0];

  const calcularReporte = () => {
    const cursoSeleccionado = document.getElementById('absenceCurso')?.value || '';
    const inicio = document.getElementById('absenceInicio')?.value || fechaInicio;
    const fin = document.getElementById('absenceFin')?.value || fechaFin;
    const umbral = Math.max(1, parseInt(document.getElementById('absenceUmbral')?.value || cfg.umbralInasistenciasReiteradas, 10));
    const registros = asistencia.filter(a => {
      const estudiante = estudiantes.find(e => e.idEstudiante === a.idEstudiante);
      const perteneceCurso = !cursoSeleccionado || estudiante?.nombreCurso === cursoSeleccionado || String(a.idCurso) === cursoSeleccionado;
      return a.estado === 'AUSENTE' && a.fecha >= inicio && a.fecha <= fin && perteneceCurso;
    });
    const reporte = estudiantes.map(estudiante => {
      const ausencias = registros.filter(a => a.idEstudiante === estudiante.idEstudiante);
      const totalRegistros = asistencia.filter(a => a.idEstudiante === estudiante.idEstudiante && a.fecha >= inicio && a.fecha <= fin && (!cursoSeleccionado || estudiante.nombreCurso === cursoSeleccionado)).length;
      return {
        ...estudiante,
        ausencias: ausencias.length,
        porcentaje: totalRegistros ? Math.round((1 - ausencias.length / totalRegistros) * 100) : 100,
        fechas: ausencias.map(a => a.fecha),
        riesgo: ausencias.length >= umbral
      };
    }).filter(e => e.riesgo).sort((a, b) => b.ausencias - a.ausencias);

    document.getElementById('absenceResults').innerHTML = reporte.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b border-gray-200"><tr>
            <th class="px-5 py-3 text-xs uppercase font-bold text-gray-500">Estudiante</th>
            <th class="px-5 py-3 text-xs uppercase font-bold text-gray-500">Curso</th>
            <th class="px-5 py-3 text-xs uppercase font-bold text-gray-500 text-center">Asistencia</th>
            <th class="px-5 py-3 text-xs uppercase font-bold text-gray-500 text-center">Ausencias</th>
            <th class="px-5 py-3 text-xs uppercase font-bold text-gray-500">Nivel de riesgo</th>
            <th class="px-5 py-3 text-xs uppercase font-bold text-gray-500">Contacto</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">${reporte.map(e => `
            <tr class="hover:bg-gray-50">
              <td class="px-5 py-4"><strong class="text-sm text-gray-900">${escapeHtml(e.nombre)}</strong><span class="block text-xs text-gray-400">${escapeHtml(e.rut || '')}</span></td>
              <td class="px-5 py-4 text-sm text-gray-700">${escapeHtml(e.nombreCurso || e.curso || 'Sin curso')}</td>
              <td class="px-5 py-4 text-center text-sm font-bold ${e.porcentaje < 85 ? 'text-rose-700' : 'text-amber-700'}">${e.porcentaje}%</td>
              <td class="px-5 py-4 text-center"><span class="font-bold text-rose-700">${e.ausencias}</span><span class="block text-xs text-gray-400">${e.fechas.map(f => fechaES(f, false)).join(', ')}</span></td>
              <td class="px-5 py-4"><span class="px-2 py-1 rounded border text-xs font-bold bg-rose-100 text-rose-800 border-rose-200">ROJO</span></td>
              <td class="px-5 py-4"><a class="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100" href="mailto:${encodeURIComponent(e.apoderadoCorreo || '')}?subject=${encodeURIComponent('Seguimiento de asistencia de ' + e.nombre)}">✉ Contactar</a></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>` : '<div class="p-10 text-center text-gray-400">No hay estudiantes que superen el umbral seleccionado.</div>';
  };

  document.getElementById('content').innerHTML = `
    <div class="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <label class="text-xs font-bold text-gray-500 uppercase">Curso<select id="absenceCurso" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Todos los cursos</option>${cursos.map(c => `<option value="${escapeHtml(c.nombreCurso)}">${escapeHtml(c.nombreCurso)}</option>`).join('')}</select></label>
        <label class="text-xs font-bold text-gray-500 uppercase">Desde<input id="absenceInicio" type="date" value="${fechaInicio}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></label>
        <label class="text-xs font-bold text-gray-500 uppercase">Hasta<input id="absenceFin" type="date" value="${fechaFin}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></label>
        <label class="text-xs font-bold text-gray-500 uppercase">Umbral de riesgo<input id="absenceUmbral" type="number" min="1" value="${cfg.umbralInasistenciasReiteradas}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></label>
      </div>
      <button onclick="actualizarReporteInasistencias()" class="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Actualizar reporte</button>
    </div>
    <div id="absenceResults" class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"></div>`;
  window.actualizarReporteInasistencias = calcularReporte;
  calcularReporte();
}

// ════════════════════════════════════════════════════════
//  SEMÁFORO ACADÉMICO — Motor de cálculo mejorado
//  (ventana de 45 días, ponderación por coeficiente, tendencia,
//  y estado "insuficiente" para 1-2 notas)
// ════════════════════════════════════════════════════════

const SEMAFORO_VENTANA_DIAS = 45;
const SEMAFORO_MIN_NOTAS_CONFIABLE = 3;
const SEMAFORO_SALTO_TENDENCIA = 0.5;

function calcularSemaforoEstudiante(est, todasCalificaciones) {
  const notasEstudiante = todasCalificaciones.filter(c => c.idEstudiante === est.idEstudiante);

  if (notasEstudiante.length === 0) {
    return {
      ...est,
      promedio: 0,
      estado: 'SIN_DATOS',
      semaforo: 'GRIS',
      cantidadNotas: 0,
      notasBajo4: 0,
      notasBajo35: 0,
      ultimaNota: null,
      asignaturaDebil: 'Sin evaluaciones',
      motivo: 'Aún no tiene calificaciones registradas',
      sinEvaluacionesRecientes: false
    };
  }

  const notasOrdenadas = [...notasEstudiante].sort((a, b) => {
    return new Date(a.fechaNota || a.fechaRegistro) - new Date(b.fechaNota || b.fechaRegistro);
  });

  const ultimaNota = notasOrdenadas[notasOrdenadas.length - 1];

  // Ventana de los últimos 45 días
  const hoy = new Date();
  const limiteVentana = new Date(hoy);
  limiteVentana.setDate(limiteVentana.getDate() - SEMAFORO_VENTANA_DIAS);

  const notasEnVentana = notasOrdenadas.filter(n => {
    const f = new Date(n.fechaNota || n.fechaRegistro);
    return f >= limiteVentana;
  });

  const sinEvaluacionesRecientes = notasEnVentana.length === 0;

  // Si no hay notas recientes, se conserva el último estado calculado
  // usando todo el histórico disponible (según lo definido con el cliente).
  const notasParaCalculo = sinEvaluacionesRecientes ? notasOrdenadas : notasEnVentana;

  // Menos de 3 notas totales -> estado "insuficiente", no se emite veredicto de riesgo
  if (notasEstudiante.length < SEMAFORO_MIN_NOTAS_CONFIABLE) {
    const promedioSimple = notasEstudiante.reduce((acc, n) => acc + parseFloat(n.nota), 0) / notasEstudiante.length;
    return {
      ...est,
      promedio: promedioSimple.toFixed(1),
      estado: 'Insuficiente',
      semaforo: 'AZUL',
      cantidadNotas: notasEstudiante.length,
      notasBajo4: notasEstudiante.filter(n => parseFloat(n.nota) < 4.0).length,
      notasBajo35: notasEstudiante.filter(n => parseFloat(n.nota) < 3.5).length,
      ultimaNota,
      asignaturaDebil: 'N/A',
      motivo: `Aún no hay suficientes evaluaciones (${notasEstudiante.length} de ${SEMAFORO_MIN_NOTAS_CONFIABLE} mínimas) para un diagnóstico confiable.`,
      sinEvaluacionesRecientes: false
    };
  }

  // Promedio ponderado por coeficiente, sobre la ventana (o histórico si no hay recientes)
  const sumaPonderada = notasParaCalculo.reduce((acc, n) => acc + (parseFloat(n.nota) * (parseInt(n.coeficiente) === 2 ? 2 : 1)), 0);
  const sumaCoeficientes = notasParaCalculo.reduce((acc, n) => acc + (parseInt(n.coeficiente) === 2 ? 2 : 1), 0);
  const promedio = sumaPonderada / sumaCoeficientes;

  const notasBajo4 = notasParaCalculo.filter(n => parseFloat(n.nota) < 4.0).length;
  const notasBajo35 = notasParaCalculo.filter(n => parseFloat(n.nota) < 3.5).length;

  const asignaturas = {};
  notasEstudiante.forEach(n => {
    const asig = n.asignatura || n.nombreCurso || 'General';
    if (!asignaturas[asig]) asignaturas[asig] = [];
    asignaturas[asig].push(parseFloat(n.nota));
  });

  let asignaturaDebil = 'N/A';
  let promedioMasBajo = 7;
  for (const [asig, notas] of Object.entries(asignaturas)) {
    const promAsig = notas.reduce((a, b) => a + b, 0) / notas.length;
    if (promAsig < promedioMasBajo) {
      promedioMasBajo = promAsig;
      asignaturaDebil = asig;
    }
  }

  let estado, semaforo, motivo;

  if (promedio >= 4.0) {
    estado = 'Estable';
    semaforo = 'VERDE';
    motivo = `Buen desempeño académico. Promedio ponderado sobre 4.0.`;
  } else if (promedio >= 3.5) {
    estado = 'Riesgo';
    semaforo = 'AMARILLO';
    motivo = `Zona de alerta. Promedio ponderado entre 3.5 y 3.9. Requiere seguimiento.`;
  } else {
    estado = 'Crítico';
    semaforo = 'ROJO';
    motivo = `Bajo rendimiento. Promedio ponderado inferior a 3.5. Intervención urgente necesaria.`;
  }

  if (notasBajo35 >= 2 && semaforo !== 'ROJO') {
    semaforo = 'ROJO';
    estado = 'Crítico';
    motivo = `Múltiples notas bajo 3.5 detectadas (${notasBajo35} evaluaciones recientes). Riesgo de reprobación.`;
  }

  // Tendencia: compara 1ª mitad vs 2ª mitad de las notas usadas en el cálculo
  if (notasParaCalculo.length >= 4) {
    const mitad = Math.floor(notasParaCalculo.length / 2);
    const primeraMitad = notasParaCalculo.slice(0, mitad);
    const segundaMitad = notasParaCalculo.slice(mitad);

    const promPrimera = primeraMitad.reduce((a, n) => a + parseFloat(n.nota), 0) / primeraMitad.length;
    const promSegunda = segundaMitad.reduce((a, n) => a + parseFloat(n.nota), 0) / segundaMitad.length;
    const delta = promSegunda - promPrimera;

    if (delta <= -SEMAFORO_SALTO_TENDENCIA) {
      if (semaforo === 'VERDE') {
        semaforo = 'AMARILLO';
        estado = 'Riesgo';
        motivo = `Tendencia a la baja detectada (bajó ${Math.abs(delta).toFixed(1)} pts). Seguimiento preventivo.`;
      } else if (semaforo === 'AMARILLO') {
        semaforo = 'ROJO';
        estado = 'Crítico';
        motivo = `Tendencia a la baja sostenida (bajó ${Math.abs(delta).toFixed(1)} pts). Riesgo creciente.`;
      }
    } else if (delta >= SEMAFORO_SALTO_TENDENCIA && promedio >= 3.5) {
      if (semaforo === 'ROJO') {
        semaforo = 'AMARILLO';
        estado = 'Riesgo';
        motivo = `Mejora reciente detectada (subió ${delta.toFixed(1)} pts), pero aún requiere seguimiento.`;
      } else if (semaforo === 'AMARILLO') {
        semaforo = 'VERDE';
        estado = 'Estable';
        motivo = `Mejora reciente sostenida (subió ${delta.toFixed(1)} pts). Buen progreso.`;
      }
    }
  }

  return {
    ...est,
    promedio: promedio.toFixed(1),
    estado,
    semaforo,
    cantidadNotas: notasEstudiante.length,
    notasBajo4,
    notasBajo35,
    ultimaNota,
    asignaturaDebil,
    motivo,
    sinEvaluacionesRecientes
  };
}

async function renderAdminAlertas() {
  document.getElementById('pageTitle').textContent = 'Semáforo de Riesgo Académico';
  document.getElementById('pageSubtitle').textContent = 'Monitoreo automático del rendimiento estudiantil';

  const estudiantes = await AdminApi.estudiantes();
  const todasCalificaciones = await AdminApi.calificaciones();

  const alertasEstudiantes = estudiantes.map(est => calcularSemaforoEstudiante(est, todasCalificaciones));

  const ordenPrioridad = { 'ROJO': 0, 'AMARILLO': 1, 'VERDE': 2, 'GRIS': 3 };

  alertasEstudiantes.sort((a, b) => ordenPrioridad[a.semaforo] - ordenPrioridad[b.semaforo]);

  const totalRojos = alertasEstudiantes.filter(a => a.semaforo === 'ROJO').length;
  const totalAmarillos = alertasEstudiantes.filter(a => a.semaforo === 'AMARILLO').length;
  const totalVerdes = alertasEstudiantes.filter(a => a.semaforo === 'VERDE').length;
  const totalSinDatos = alertasEstudiantes.filter(a => a.semaforo === 'GRIS').length;

  let html = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border-2 border-rose-200 p-5 shadow-sm flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-3xl">🔴</div>
        <div>
          <div class="text-xs text-rose-600 uppercase font-bold tracking-wide">Críticos</div>
          <div class="text-3xl font-bold text-rose-700">${totalRojos}</div>
          <div class="text-xs text-gray-500">Requieren intervención</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border-2 border-amber-200 p-5 shadow-sm flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-3xl">🟡</div>
        <div>
          <div class="text-xs text-amber-600 uppercase font-bold tracking-wide">En Riesgo</div>
          <div class="text-3xl font-bold text-amber-700">${totalAmarillos}</div>
          <div class="text-xs text-gray-500">Seguimiento necesario</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border-2 border-emerald-200 p-5 shadow-sm flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">🟢</div>
        <div>
          <div class="text-xs text-emerald-600 uppercase font-bold tracking-wide">Estables</div>
          <div class="text-3xl font-bold text-emerald-700">${totalVerdes}</div>
          <div class="text-xs text-gray-500">Buen desempeño</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border-2 border-gray-200 p-5 shadow-sm flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-3xl">⚪</div>
        <div>
          <div class="text-xs text-gray-600 uppercase font-bold tracking-wide">Sin Datos</div>
          <div class="text-3xl font-bold text-gray-700">${totalSinDatos}</div>
          <div class="text-xs text-gray-500">Sin evaluaciones</div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
      <h4 class="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Criterios de Evaluación Automática</h4>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <span class="text-2xl">🟢</span>
          <div>
            <div class="font-bold text-emerald-800 text-sm">Verde — Estable</div>
            <div class="text-xs text-emerald-700">El estudiante tiene buen desempeño (nota promedio ≥ 4.0)</div>
          </div>
        </div>

        <div class="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <span class="text-2xl">🟡</span>
          <div>
            <div class="font-bold text-amber-800 text-sm">Amarillo — Riesgo</div>
            <div class="text-xs text-amber-700">El estudiante está en zona de alerta (nota promedio entre 3.5 y 3.9)</div>
          </div>
        </div>

        <div class="flex items-start gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
          <span class="text-2xl">🔴</span>
          <div>
            <div class="font-bold text-rose-800 text-sm">Rojo — Crítico</div>
            <div class="text-xs text-rose-700">El estudiante tiene bajo rendimiento (nota promedio < 3.5) o múltiples notas bajo 3.5</div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
        <div>
          <h3 class="font-bold text-gray-900 text-base">Detalle por Estudiante</h3>
          <p class="text-xs text-gray-500">Información actualizada automáticamente según calificaciones registradas</p>
        </div>

        <div class="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg">
          Última actualización: ${new Date().toLocaleString('es-CL')}
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Estado</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Estudiante</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Curso</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500 text-center">Promedio</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500 text-center">Evaluaciones</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Asignatura Débil</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Motivo de Alerta</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
  `;

  alertasEstudiantes.forEach(a => {
    let semaforoClass = '';
    let semaforoIcon = '';
    let estadoText = '';
    let promedioClass = '';
    let filaBg = '';

    switch (a.semaforo) {
      case 'ROJO':
        semaforoClass = 'bg-rose-100 text-rose-800 border-rose-200';
        semaforoIcon = '🔴';
        estadoText = 'CRÍTICO';
        promedioClass = 'text-rose-700 font-bold';
        filaBg = 'bg-rose-50/30';
        break;

      case 'AMARILLO':
        semaforoClass = 'bg-amber-100 text-amber-800 border-amber-200';
        semaforoIcon = '🟡';
        estadoText = 'RIESGO';
        promedioClass = 'text-amber-700 font-bold';
        filaBg = 'bg-amber-50/30';
        break;

      case 'VERDE':
        semaforoClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        semaforoIcon = '🟢';
        estadoText = 'ESTABLE';
        promedioClass = 'text-emerald-700 font-bold';
        filaBg = '';
        break;

      case 'AZUL':
        semaforoClass = 'bg-sky-100 text-sky-800 border-sky-200';
        semaforoIcon = '🔵';
        estadoText = 'INSUFICIENTE';
        promedioClass = 'text-sky-700 font-bold';
        filaBg = '';
        break;

      default:
        semaforoClass = 'bg-gray-100 text-gray-600 border-gray-200';
        semaforoIcon = '⚪';
        estadoText = 'SIN DATOS';
        promedioClass = 'text-gray-500';
        filaBg = '';
    }

    const ultimaNotaInfo = a.ultimaNota
      ? `<div class="text-[10px] text-gray-400 mt-0.5">Última: <strong class="${parseFloat(a.ultimaNota.nota) < 4 ? 'text-rose-600' : 'text-emerald-600'}">${parseFloat(a.ultimaNota.nota).toFixed(1)}</strong> en ${a.ultimaNota.descripcion || a.ultimaNota.tipoEvaluacion || 'N/A'} (${fechaES(a.ultimaNota.fechaNota || a.ultimaNota.fechaRegistro) || 'sin fecha'})</div>`
      : '';

    const notasBajoInfo = a.cantidadNotas > 0
      ? `<div class="text-[10px] text-gray-400 mt-0.5">${a.notasBajo4} de ${a.cantidadNotas} notas bajo 4.0${a.notasBajo35 > 0 ? ` · ${a.notasBajo35} bajo 3.5` : ''}</div>`
      : '';

    html += `
      <tr class="hover:bg-gray-50 transition ${filaBg}">
        <td class="px-6 py-4">
          <span class="chip px-3 py-1.5 rounded-full text-xs font-bold border ${semaforoClass}">
            ${semaforoIcon} ${estadoText}
          </span>
        </td>

        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full ${a.semaforo === 'ROJO' ? 'bg-rose-100 text-rose-700' : a.semaforo === 'AMARILLO' ? 'bg-amber-100 text-amber-700' : a.semaforo === 'VERDE' ? 'bg-emerald-100 text-emerald-700' : a.semaforo === 'AZUL' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'} flex items-center justify-center text-xs font-bold">
              ${a.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>

            <div>
              <div class="font-semibold text-gray-900 text-sm">${a.nombre}</div>
              <div class="text-xs text-gray-400">${a.rut}</div>
            </div>
          </div>
        </td>

        <td class="px-6 py-4">
          <div class="text-sm text-gray-700 font-medium">${a.nombreCurso || a.curso || 'N/A'}</div>
          <div class="text-xs text-gray-400">Apod: ${a.apoderadoNombre || 'Sin asignar'}</div>
        </td>

        <td class="px-6 py-4 text-center">
          <div class="text-lg ${promedioClass}">${a.promedio}</div>
          ${notasBajoInfo}
        </td>

        <td class="px-6 py-4 text-center">
          <span class="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">
            ${a.cantidadNotas} eval.
          </span>
        </td>

        <td class="px-6 py-4">
          <div class="text-sm text-gray-700 font-medium">${a.asignaturaDebil}</div>
          ${ultimaNotaInfo}
        </td>

        <td class="px-6 py-4">
          <div class="text-xs text-gray-700 max-w-xs">
            <strong class="${a.semaforo === 'ROJO' ? 'text-rose-700' : a.semaforo === 'AMARILLO' ? 'text-amber-700' : 'text-emerald-700'}">${a.estado}:</strong>
            ${a.motivo}
          </div>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2">
      <span class="text-lg">💡</span>
      <div>
        <strong>Información importante:</strong> Este semáforo se calcula automáticamente en base a las calificaciones registradas en el sistema.
        Los estudiantes sin evaluaciones aparecen en estado "Sin Datos". Se recomienda registrar al menos 2 evaluaciones para obtener un diagnóstico confiable.
        Los estudiantes con 2 o más notas bajo 3.5 se clasifican automáticamente como <strong>CRÍTICOS</strong> independientemente de su promedio.
      </div>
    </div>
  `;

  document.getElementById('content').innerHTML = html;
}

// ==========================================
// FIX: devolver el NIVEL del curso (1° Básico, 2° Básico, ...)
// en vez de la asignatura, para el pupilo del apoderado
// ==========================================
function nivelDePupilo(pupilo) {
  if (!pupilo) return null;

  // 1) Campo directo que trae /estudiantes (c.nivel)
  if (pupilo.curso && pupilo.curso !== 'Sin curso') return pupilo.curso;

  // 2) Respaldo: buscar el nivel en la caché de cursos por id
  const ids = pupilo.cursosIds || [];
  for (const id of ids) {
    const c = (MOCK_DB.cursos || []).find(cc => Number(cc.idCurso) === Number(id));
    if (c && c.nivel) return c.nivel;
  }

  // 3) Respaldo: buscar por nombre de curso
  const nombres = pupilo.cursosAsignados || [];
  for (const n of nombres) {
    const c = (MOCK_DB.cursos || []).find(cc => cc.nombreCurso === n);
    if (c && c.nivel) return c.nivel;
  }

  return null;
}

async function renderAdminApoderados() {
  document.getElementById('pageTitle').textContent = 'Directorio de Apoderados';
  document.getElementById('pageSubtitle').textContent = 'Gestión de tutores y accesos al portal familiar';

  const apoderados = await AdminApi.apoderados();
  await AdminApi.estudiantes();

  let html = `
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex justify-between items-center shadow-sm">
      <div>
        <h3 class="font-bold text-gray-900 text-lg">Cuentas de Apoderados</h3>
        <p class="text-sm text-gray-500">Asigna apoderados a alumnos y genera sus accesos</p>
      </div>

      <button onclick="openApoderadoModal()" class="btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md transition">
        + Registrar Apoderado
      </button>
    </div>
  `;

  if (!apoderados.length) {
    html += `<div class="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-400 shadow-sm">No hay apoderados registrados.</div>`;
  } else {
    html += `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Apoderado</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Correo (Login)</th>
              <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Pupilo Asignado</th>
              <th class="px-6 py-3 text-center text-xs font-bold uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
          ${apoderados.map(a => {
            const ids = (a.pupilosIds && a.pupilosIds.length) ? a.pupilosIds : (a.pupiloId ? [a.pupiloId] : []);
            const pupilosDe = ids.map(id => MOCK_DB.estudiantes.find(e => Number(e.idEstudiante) === Number(id))).filter(Boolean);
            return `
                <tr class="hover:bg-gray-50 transition">
                  <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
                        ${a.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>

                      <span class="font-medium text-gray-900">${a.nombre}</span>
                    </div>
                  </td>

                  <td class="px-6 py-3 text-sm text-gray-600">${a.identificador}</td>

                  <td class="px-6 py-3">
                    ${pupilosDe.length
                      ? `<div class="flex flex-wrap gap-1">${pupilosDe.map(p => `<span class="chip px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">${p.nombre} (${nivelDePupilo(p) || 'Sin curso'})</span>`).join('')}</div>`
                      : '<span class="text-xs text-rose-500 font-medium">Sin pupilo asignado</span>'}
                  </td>

                  <td class="px-6 py-3 text-center space-x-3">
                    <button onclick="openEditApoderadoModal('${a.identificador}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">✏️ Editar</button>
                    <button onclick="deleteApoderado('${a.identificador}')" class="text-xs font-bold text-rose-600 hover:text-rose-800 transition">🗑️ Eliminar</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }

  document.getElementById('content').innerHTML = html;
  agregarBuscadorNombre('content', 'buscarApoderadoAdmin', '🔍 Buscar apoderado por nombre...');
}

// Lista de alumnos con casillas (para asignar varios a un apoderado)
// Los alumnos que ya tienen OTRO apoderado quedan bloqueados.
function pupilosCheckboxHtml(estudiantes, seleccionados = [], correoActual = null) {
  const sel = new Set(seleccionados.map(Number));
  const miCorreo = String(correoActual || '').toLowerCase();
  return `
    <input type="text" placeholder="🔍 Buscar alumno..." oninput="filtrarPupilosCheckbox(this.value)"
           class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none mb-2"/>
    <div id="apoPupilosLista" class="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
      ${estudiantes.map(e => {
        const duenio = String(e.apoderadoCorreo || '').toLowerCase();
        const bloqueado = Boolean(duenio) && duenio !== miCorreo;
        return `
        <label class="apo-pupilo-item flex items-center gap-3 px-3 py-2 text-sm ${bloqueado ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}" data-texto="${escapeHtml((e.nombre + ' ' + (e.rut || '')).toLowerCase())}">
          <input type="checkbox" name="apoPupilos" value="${e.idEstudiante}" ${sel.has(Number(e.idEstudiante)) && !bloqueado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''} class="rounded border-gray-300"/>
          <span class="flex-1">
            ${escapeHtml(e.nombre)} <span class="text-gray-400">(${escapeHtml(nivelDePupilo(e) || 'Sin curso')})</span>
            ${bloqueado ? `<span class="block text-[10px] text-amber-600">Ya asignado a: ${escapeHtml(e.apoderadoNombre || e.apoderadoCorreo)}</span>` : ''}
          </span>
        </label>`;
      }).join('')}
    </div>
    <p class="text-xs text-gray-400 mt-1">Puedes marcar varios alumnos. Los que ya tienen apoderado aparecen bloqueados; para cambiarlos, quítalos primero del otro apoderado.</p>`;
}

function filtrarPupilosCheckbox(texto) {
  const t = String(texto || '').toLowerCase().trim();
  document.querySelectorAll('#apoPupilosLista .apo-pupilo-item').forEach(el => {
    el.style.display = !t || el.dataset.texto.includes(t) ? '' : 'none';
  });
}

function pupilosSeleccionados() {
  return [...document.querySelectorAll('input[name="apoPupilos"]:checked')].map(i => Number(i.value));
}

async function openApoderadoModal() {
  const estudiantes = await AdminApi.estudiantes();
  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Registrar Apoderado</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form id="formApoderado" onsubmit="saveApoderado(event)" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
        <input type="text" id="modalApoNombre" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: Roberto Méndez"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico (Usuario de acceso)</label>
        <input type="email" id="modalApoCorreo" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: roberto.m@email.cl"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña de Acceso</label>
        <input type="text" id="modalApoPass" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: ClaveSegura123"/>
        <p class="text-xs text-gray-400 mt-1">Con esta clave y el correo, el apoderado ingresará al portal.</p>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Asignar Alumnos</label>
        ${pupilosCheckboxHtml(estudiantes, [])}
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Generar Acceso</button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');
}

async function saveApoderado(e) {
  e.preventDefault();

  const nombre = document.getElementById('modalApoNombre').value.trim();
  const correo = document.getElementById('modalApoCorreo').value.trim();
  const contrasena = document.getElementById('modalApoPass').value.trim();
  const pupilosIds = pupilosSeleccionados();
  if (!pupilosIds.length) { toast('❌ Selecciona al menos un alumno'); return; }

  if (MOCK_DB.users.find(u => u.identificador === correo)) {
    toast('❌ Ya existe un usuario registrado con ese correo');
    return;
  }

  try {
    await AdminApi.crearApoderado({
      nombre,
      correo,
      contrasena,
      pupilosIds
    });
  } catch (err) {
    toast('❌ ' + (err.message || 'No se pudo crear el apoderado'));
    return;
  }

  closeModal();
  toast('✅ Apoderado creado. Ya puede iniciar sesión.');
  await renderAdminApoderados();
}

async function deleteApoderado(identificador) {
  if (confirm('¿Eliminar acceso de este apoderado?')) {
    await AdminApi.eliminarApoderado(identificador);
    toast('Apoderado eliminado');
    await renderAdminApoderados();
  }
}

// --- DOCENTE RENDERS ---

async function renderDocenteDashboard() {
  document.getElementById('pageTitle').textContent = 'Panel Docente';
  document.getElementById('pageSubtitle').textContent = 'Resumen de actividad académica';

  const d = await DocenteApi.dashboard();
  const cursos = cacheCursos;

  const recentAnotaciones = await DocenteApi.anotaciones();
  const recentAsistencia = MOCK_DB.asistencia.slice(-5).reverse();

  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      ${statCard('👥', 'Mis Alumnos', d.totalEstudiantes, 'bg-blue-500')}
      ${statCard('📚', 'Clases Activas', d.totalClases, 'bg-purple-500')}

      <div class="bg-white rounded-xl shadow-sm p-5 flex flex-col stat-card border border-gray-200">
        <div class="flex items-center gap-4 mb-3">
          <div class="w-12 h-12 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-2xl shadow-lg">✅</div>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Asistencia Hoy</div>
            <div class="text-2xl font-bold text-slate-900" id="attHoyValor">0%</div>
          </div>
        </div>

        <select id="selectCursoAsistencia" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-emerald-500 outline-none bg-white">
          <option value="">Seleccione curso...</option>
          ${cursos.map(c => `<option value="${c.idCurso}">${c.nombreCurso}</option>`).join('')}
        </select>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-5 flex flex-col stat-card border border-gray-200">
        <div class="flex items-center gap-4 mb-3">
          <div class="w-12 h-12 bg-orange-500 text-white rounded-lg flex items-center justify-center text-2xl shadow-lg">📝</div>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Promedio Curso</div>
            <div class="text-2xl font-bold text-slate-900" id="promCursoValor">0.0</div>
          </div>
        </div>

        <select id="selectCursoPromedio" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-orange-500 outline-none bg-white">
          <option value="">Seleccione curso...</option>
          ${cursos.map(c => `<option value="${c.idCurso}">${c.nombreCurso}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📋</span> Últimas Anotaciones Registradas
        </h3>

        <div class="space-y-2">
          ${recentAnotaciones.length
            ? recentAnotaciones.slice(0, 4).map(a => {
                const isPos = (a.tipoAnotacion || a.tipo || '').toUpperCase() === 'POSITIVA';

                return `
                  <div class="p-3 rounded-lg border text-xs ${isPos ? 'bg-emerald-50/50 border-emerald-100 text-slate-700' : 'bg-rose-50/50 border-rose-100 text-slate-700'}">
                    <div class="flex justify-between font-bold mb-1">
                      <span>${a.nombreEstudiante}</span>
                      <span>${fechaES(a.fechaRegistro)}</span>
                    </div>

                    <p class="text-gray-600">${a.detalles || a.observacion}</p>
                  </div>
                `;
              }).join('')
            : '<p class="text-sm text-gray-400 italic py-4">Sin anotaciones recientes.</p>'}
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>✅</span> Registro de Asistencia Reciente
        </h3>

        <div class="space-y-2">
          ${recentAsistencia.length
            ? recentAsistencia.map(a => {
                const est = MOCK_DB.estudiantes.find(e => e.idEstudiante === a.idEstudiante);
                const nombre = est ? est.nombre : 'Alumno';

                const color = a.estado === 'PRESENTE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : a.estado === 'AUSENTE'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800';

                return `
                  <div class="flex justify-between items-center text-sm p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <span class="font-medium text-gray-700">${nombre} <span class="text-xs text-gray-400">(${a.fecha})</span></span>
                    <span class="chip px-2 py-0.5 rounded text-xs font-bold ${color}">${a.estado}</span>
                  </div>
                `;
              }).join('')
            : '<p class="text-sm text-gray-400 italic py-4">No hay registros de asistencia recientes. ¡Toma asistencia hoy!</p>'}
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 class="font-bold text-gray-900 mb-4">Accesos Rápidos</h3>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onclick="navigate('attendance')" class="p-4 bg-white border border-gray-200 hover:border-indigo-500 rounded-xl text-left transition shadow-sm hover:shadow-md">
          <div class="text-2xl mb-2">✅</div>
          <div class="font-bold text-sm text-slate-800">Tomar Asistencia</div>
        </button>

        <button onclick="navigate('grades')" class="p-4 bg-white border border-gray-200 hover:border-indigo-500 rounded-xl text-left transition shadow-sm hover:shadow-md">
          <div class="text-2xl mb-2">📝</div>
          <div class="font-bold text-sm text-slate-800">Registrar Nota</div>
        </button>

        <button onclick="navigate('materials')" class="p-4 bg-white border border-gray-200 hover:border-indigo-500 rounded-xl text-left transition shadow-sm hover:shadow-md">
          <div class="text-2xl mb-2">📚</div>
          <div class="font-bold text-sm text-slate-800">Subir Recurso</div>
        </button>

        <button onclick="navigate('anotaciones')" class="p-4 bg-white border border-gray-200 hover:border-indigo-500 rounded-xl text-left transition shadow-sm hover:shadow-md">
          <div class="text-2xl mb-2">📋</div>
          <div class="font-bold text-sm text-slate-800">Anotaciones</div>
        </button>
      </div>
    </div>
  `;

  setTimeout(() => {
    const selectAtt = document.getElementById('selectCursoAsistencia');
    const selectProm = document.getElementById('selectCursoPromedio');

    if (selectAtt) {
      selectAtt.addEventListener('change', async (e) => {
        if (e.target.value) {
          const porcentaje = await DocenteApi.asistenciaHoyPorCurso(parseInt(e.target.value));
          document.getElementById('attHoyValor').textContent = porcentaje;
        } else {
          document.getElementById('attHoyValor').textContent = '0%';
        }
      });
    }

    if (selectProm) {
      selectProm.addEventListener('change', async (e) => {
        if (e.target.value) {
          const promedio = await DocenteApi.promedioPorCurso(parseInt(e.target.value));
          document.getElementById('promCursoValor').textContent = promedio;
        } else {
          document.getElementById('promCursoValor').textContent = '0.0';
        }
      });
    }
  }, 100);
}
// ==========================================
// HELPERS HORARIO SEMANAL (DOCENTE)
// ==========================================
function getBloquesJornada() {
  return [
    { id: 1, label: '1ª hora', hora: '08:15 - 09:00' },
    { id: 2, label: '2ª hora', hora: '09:00 - 09:45' },
    { id: 3, label: '3ª hora', hora: '10:05 - 10:50' },
    { id: 4, label: '4ª hora', hora: '10:50 - 11:35' },
    { id: 5, label: '5ª hora', hora: '11:55 - 12:40' },
    { id: 6, label: '6ª hora', hora: '12:40 - 13:25' },
    { id: 7, label: '7ª hora', hora: '14:10 - 14:55' },
    { id: 8, label: '8ª hora', hora: '14:55 - 15:40' }
  ];
}

// Jornada completa con recreos y almuerzo (para dibujar la grilla)
function getJornadaCompleta() {
  return [
    { tipo: 'bloque', id: 1, label: '1ª hora', hora: '08:15 - 09:00' },
    { tipo: 'bloque', id: 2, label: '2ª hora', hora: '09:00 - 09:45' },
    { tipo: 'recreo', label: 'Recreo', hora: '09:45 - 10:05' },
    { tipo: 'bloque', id: 3, label: '3ª hora', hora: '10:05 - 10:50' },
    { tipo: 'bloque', id: 4, label: '4ª hora', hora: '10:50 - 11:35' },
    { tipo: 'recreo', label: 'Recreo', hora: '11:35 - 11:55' },
    { tipo: 'bloque', id: 5, label: '5ª hora', hora: '11:55 - 12:40' },
    { tipo: 'bloque', id: 6, label: '6ª hora', hora: '12:40 - 13:25' },
    { tipo: 'recreo', label: 'Almuerzo', hora: '13:25 - 14:10' },
    { tipo: 'bloque', id: 7, label: '7ª hora', hora: '14:10 - 14:55' },
    { tipo: 'bloque', id: 8, label: '8ª hora', hora: '14:55 - 15:40' }
  ];
}

// Todos los días (Lun a Vie) con 8 bloques
function getMaxBloquesPorDia(dia) {
  return 8;
}

function obtenerBloquesCurso(curso) {
  if (Array.isArray(curso.bloquesAsignados) && curso.bloquesAsignados.length) {
  return curso.bloquesAsignados.map(Number);
  }
  const horarios = (MOCK_DB.horarios || []).filter(h => h.idCurso === curso.idCurso);
  if (horarios.length) return [...new Set(horarios.map(h => Number(h.idBloque)))];
  return [];
}

function colorMateriaHorario(index) {
  const palette = [
    'bg-sky-100 border-sky-300 text-sky-900',
    'bg-emerald-100 border-emerald-300 text-emerald-900',
    'bg-amber-100 border-amber-300 text-amber-900',
    'bg-violet-100 border-violet-300 text-violet-900',
    'bg-rose-100 border-rose-300 text-rose-900',
    'bg-lime-100 border-lime-300 text-lime-900'
  ];
  return palette[index % palette.length];
}
function fechaParaDiaSemana(dia) {
  const hoy = new Date();
  const diaHoy = hoy.getDay() === 0 ? 7 : hoy.getDay();
  const d = new Date(hoy.getTime() + (dia - diaHoy) * 86400000);
  return d.toISOString().split('T')[0];
}
function buscarCeldaInicial(celdas, bloques, dias) {
  const hoyDia = new Date().getDay();
  if (hoyDia >= 1 && hoyDia <= 5) {
    for (const b of bloques) {
      if ((celdas[`${hoyDia}-${b.id}`] || []).length) {
        return { idCurso: celdas[`${hoyDia}-${b.id}`][0].curso.idCurso, bloque: b.id, dia: hoyDia };
      }
    }
  }
  for (const b of bloques) {
    for (const d of dias) {
      if ((celdas[`${d}-${b.id}`] || []).length) {
        return { idCurso: celdas[`${d}-${b.id}`][0].curso.idCurso, bloque: b.id, dia: d };
      }
    }
  }
  return null;
}
function seleccionarCeldaHorario(idCurso, bloque, dia) {
  const sel = document.getElementById('attCurso');
  if (sel) sel.value = String(idCurso);
  const inpBloque = document.getElementById('attBloque');
  if (inpBloque) inpBloque.value = String(bloque);
  const dateInput = document.getElementById('attDate');
  if (dateInput && dia) dateInput.value = fechaParaDiaSemana(dia);
  document.querySelectorAll('[data-celda]').forEach(btn => {
    const activo = btn.dataset.celda === `${dia}-${bloque}-${idCurso}`;
    btn.classList.toggle('ring-2', activo);
    btn.classList.toggle('ring-indigo-500', activo);
  });
  actualizarBloquesHorarioBtns(bloque);
  actualizarInfoSeleccionHorario();
  renderAttList();
}

function seleccionarBloqueHorario(bloque) {
  const inp = document.getElementById('attBloque');
  if (inp) inp.value = String(bloque);
  actualizarBloquesHorarioBtns(bloque);
  renderAttList();
}

// Devuelve 1-7 (lunes-domingo) a partir de 'YYYY-MM-DD'. Sin restriccion horaria.
function getDiaSemanaJS(fechaStr) {
  try {
    if (!fechaStr) {
      const js = new Date().getDay();
      return js === 0 ? 7 : js;
    }
    const p = String(fechaStr).slice(0, 10).split('-');
    if (p.length === 3) {
      const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      if (!isNaN(d.getTime())) {
        const js = d.getDay();
        return js === 0 ? 7 : js;
      }
    }
    const d2 = new Date(fechaStr);
    if (!isNaN(d2.getTime())) {
      const js = d2.getDay();
      return js === 0 ? 7 : js;
    }
  } catch (_) {}
  return 1;
}
function getDiaSemana(fechaStr) { return getDiaSemanaJS(fechaStr); }

function actualizarBloquesHorarioBtns(bloqueActivo) {
  const container = document.getElementById('attBloquesBtns');
  if (!container) return;
  const fecha = document.getElementById('attDate')?.value || '';
  const dia = getDiaSemanaJS(fecha);
  const maxBloques = (dia >= 1 && dia <= 5) ? getMaxBloquesPorDia(dia) : 8;
  container.innerHTML = getBloquesJornada().map(b => {
    const deshabilitado = b.id > maxBloques;
    const activo = b.id === Number(bloqueActivo);
    return `
      <button type="button" ${deshabilitado ? 'disabled' : ''} onclick="seleccionarBloqueHorario(${b.id})"
        class="px-3 py-2 rounded-lg border text-xs font-semibold transition ${
          deshabilitado
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
            : activo
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50'
        }">
        🕐 ${b.label} (${b.hora})${deshabilitado ? ' · Sin clases' : ''}
      </button>
    `;
  }).join('');
}

function actualizarInfoSeleccionHorario() {
  const info = document.getElementById('attSeleccionInfo');
  if (!info) return;
  const idCurso = parseInt(document.getElementById('attCurso')?.value || '0', 10);
  const curso = cacheCursos.find(c => c.idCurso === idCurso);
  const bloque = Number(document.getElementById('attBloque')?.value || 1);
  const b = getBloquesJornada().find(x => x.id === bloque);
  if (!curso) { info.innerHTML = ''; return; }
  info.innerHTML = `
    <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
      <span class="text-2xl">📘</span>
      <div>
        <div class="font-bold text-indigo-900 text-sm">${escapeHtml(curso.nombreCurso)}</div>
        <div class="text-xs text-indigo-700">${b ? `${b.label} · ${b.hora}` : ''} — Asistencia de los estudiantes de este curso</div>
      </div>
    </div>
  `;
}

async function renderDocenteAttendance() {
  document.getElementById('pageTitle').textContent = 'Control de Asistencia';
  if (document.getElementById('pageSubtitle')) {
    document.getElementById('pageSubtitle').textContent = 'Consulta la asistencia de tus cursos (la registra el Inspector)';
  }
  const cursos = cacheCursos;

  document.getElementById('content').innerHTML = `
  <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Curso</label>
        <select id="attCurso" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          ${cursos.map(c => `<option value="${c.idCurso}">${escapeHtml(c.nombreCurso)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha</label>
        <input type="date" id="attDate" value="${todayStr()}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
    </div>
    <input type="hidden" id="attBloque" value="1"/>
  </div>
  <div id="attSeleccionInfo" class="mb-4"></div>
   <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm flex flex-wrap items-center gap-3">
    <div class="ml-auto flex flex-wrap gap-2">
      <button onclick="exportarExcelDocente('asistencia')"
        class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm flex items-center gap-2">
        <span>📊</span> Exportar Excel
      </button>
      ${currentUser?.rol !== 'DOCENTE' ? `
      <button onclick="markAllPresent()"
        class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm">
        ✓ Todos Presente
      </button>
      <button onclick="saveAttendance()" class="px-4 py-2 btn-primary text-white rounded-lg text-sm font-medium">
        💾 Guardar Registro
      </button>` : `
      <span class="text-xs text-sky-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-lg font-medium">
        👁️ Solo lectura — La asistencia la registra el Inspector
      </span>`}
    </div>
  </div>
  <div id="attList"></div>
  `;

  document.getElementById('attDate').addEventListener('change', () => {
    renderAttList();
  });
  document.getElementById('attCurso').addEventListener('change', () => {
    actualizarInfoSeleccionHorario();
    renderAttList();
  });

  // Preselección desde la vista "Mi Horario" (si existe)
  const pre = window.__attPreselect;
  if (pre) {
    const sel = document.getElementById('attCurso');
    if (sel && cursos.some(c => c.idCurso === pre.idCurso)) sel.value = String(pre.idCurso);
    const dateInput = document.getElementById('attDate');
    if (dateInput && pre.dia) dateInput.value = fechaParaDiaSemana(pre.dia);
    const inpBloque = document.getElementById('attBloque');
    if (inpBloque) inpBloque.value = String(pre.bloque || 1);
    window.__attPreselect = null;
  }

  actualizarInfoSeleccionHorario();
  await renderAttList();
}

// ==========================================
// MI HORARIO SEMANAL (DOCENTE) — sección aparte
// ==========================================
async function renderDocenteHorario() {
  document.getElementById('pageTitle').textContent = 'Mi Horario Semanal';
  document.getElementById('pageSubtitle').textContent = 'Toca una clase para ir a su asistencia';
  const cursos = cacheCursos;
  const bloques = getBloquesJornada();
  const jornada = getJornadaCompleta();
  const dias = [1, 2, 3, 4, 5];
  const nombresDias = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie' };

  const celdas = construirCeldasHorarioDocente(cursos, currentUser?.identificador);

  document.getElementById('content').innerHTML = `
  <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-xl">📅</span>
      <h3 class="font-bold text-gray-900 text-lg">Mi Horario Semanal</h3>
    </div>
    <p class="text-xs text-gray-500 mb-4">Toca una clase de tu horario para abrir la asistencia de ese curso.</p>
    <div class="overflow-x-auto">
      <div class="min-w-[720px] grid gap-1.5" style="grid-template-columns: 110px repeat(5, minmax(0, 1fr));">
        <div></div>
        ${dias.map(d => `<div class="text-center text-xs font-bold text-gray-500 uppercase py-1">${nombresDias[d]}</div>`).join('')}
        ${jornada.map(b => {
          if (b.tipo === 'recreo') {
            return `<div style="grid-column: 1 / -1;" class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-700 text-[11px] font-bold uppercase tracking-wide py-1.5">☕ ${b.label} · ${b.hora}</div>`;
          }
          return `
            <div class="flex flex-col items-center justify-center text-[11px] font-bold text-gray-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-center">
              <span>${b.label}</span>
              <span class="text-[10px] font-medium text-gray-400">${b.hora}</span>
            </div>
            ${dias.map(d => {
              if (b.id > getMaxBloquesPorDia(d)) {
                return `<div class="rounded-lg border border-dashed border-gray-200 bg-gray-100/70 min-h-[56px] flex items-center justify-center text-[10px] text-gray-400 italic">Sin clases</div>`;
              }
              const lista = celdas[`${d}-${b.id}`] || [];
              if (!lista.length) {
                return `<div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 min-h-[56px]"></div>`;
              }
              return `<div class="space-y-1">
                ${lista.map(item => `
                  <button type="button"
                    onclick="irAAsistenciaDesdeHorario(${item.curso.idCurso}, ${b.id}, ${d})"
                    class="w-full rounded-lg border text-left px-3 py-1.5 transition hover:shadow-md ${item.color}">
                    <div class="text-[10px] font-bold opacity-60">${b.hora}</div>
                    <div class="text-xs font-bold truncate">${escapeHtml(item.curso.asignatura || item.curso.nombreCurso)}</div>
                    <div class="text-[10px] opacity-60 truncate">${escapeHtml(item.curso.nivel || '')}</div>
                  </button>
                `).join('')}
              </div>`;
            }).join('')}
          `;
        }).join('')}
      </div>
    </div>
  </div>`;
}

function irAAsistenciaDesdeHorario(idCurso, bloque, dia) {
  window.__attPreselect = { idCurso, bloque, dia };
  navigate('attendance');
}


function seleccionarMateriaAsistencia(idCurso) {
  const select = document.getElementById('attCurso');

  if (!select) return;

  select.value = idCurso;

  actualizarMateriaSeleccionada();

  renderAttList();
}

function actualizarMateriaSeleccionada() {
  const idCurso = document.getElementById('attCurso')?.value;

  document.querySelectorAll('[data-att-materia]').forEach(btn => {

    const activo = String(btn.dataset.attMateria) === String(idCurso);

    btn.classList.toggle('bg-indigo-600', activo);
    btn.classList.toggle('text-white', activo);
    btn.classList.toggle('border-indigo-600', activo);

    btn.classList.toggle('bg-white', !activo);
    btn.classList.toggle('text-gray-600', !activo);
    btn.classList.toggle('border-gray-200', !activo);
  });
}

function actualizarMateriasVisual(asignaturas) {
  const container = document.getElementById('attMaterias');

  if (!container) return;

  const idCursoActual = document.getElementById('attCurso')?.value;

  container.innerHTML = `
    <div class="text-xs font-bold text-gray-500 uppercase mb-2">
      Asignaturas del curso
    </div>

    <div class="flex flex-wrap gap-2">
      ${
        asignaturas.length
          ? asignaturas.map(asig => {
              const activo = String(asig.idCurso) === String(idCursoActual);

              return `
                <button
                  type="button"
                  onclick="seleccionarMateriaAsistencia(${asig.idCurso})"
                  data-att-materia="${asig.idCurso}"
                  class="
                    px-3 py-2 rounded-lg border text-xs font-semibold transition
                    ${
                      activo
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50'
                    }
                  "
                >
                  📘 ${escapeHtml(asig.asignatura || asig.nombreCurso)}
                </button>
              `;
            }).join('')
          : '<span class="text-sm text-gray-400">Sin asignaturas</span>'
      }
    </div>
  `;
}

function justificacionCellHtml(s, idCurso) {
  const j = s.justificacion;

  let estadoHtml =
    '<span class="text-xs text-gray-400 italic">Sin justificación</span>';

  if (j) {
    const colors = {
      PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-200',
      APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      RECHAZADA: 'bg-rose-100 text-rose-800 border-rose-200'
    };

    const labels = {
      PENDIENTE: 'Pendiente',
      APROBADA: 'Aprobada',
      RECHAZADA: 'Rechazada'
    };

    const colorClass =
      colors[j.estadoJustificacion] ||
      'bg-gray-100 text-gray-700 border-gray-200';

    const label =
      labels[j.estadoJustificacion] ||
      j.estadoJustificacion;

    // Si la justificación fue modificada,
    // mostramos la fecha de modificación.
    // Si es nueva, mostramos la fecha de creación.
    const fechaJustificacion =
      j.modificadoEl || j.creadoEl || '';

    const fechaTexto = fechaJustificacion
      ? formatDateTime(fechaJustificacion)
      : '';

    estadoHtml = `
      <span class="chip px-2 py-0.5 rounded text-xs font-bold border ${colorClass}">
        ${label}
      </span>
    `;
    
    return `
      <div class="flex flex-col gap-1.5">

        <div class="flex flex-wrap items-center gap-2">
          <button
            onclick="openJustificacionModal(
              ${s.idEstudiante},
              ${idCurso},
              '${encodeURIComponent(s.nombre)}'
            )"
            class="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition"
          >
            Justificar
          </button>

          ${estadoHtml}
        </div>

        ${
          j.motivo
            ? `
              <div class="text-xs text-gray-600">
                <strong>Motivo:</strong>
                ${escapeHtml(j.motivo)}
              </div>
            `
            : ''
        }

        ${
          fechaTexto
            ? `
              <div class="text-xs text-gray-400">
                🕐 Justificada el: ${fechaTexto}
              </div>
            `
            : ''
        }

      </div>
    `;
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick="openJustificacionModal(
          ${s.idEstudiante},
          ${idCurso},
          '${encodeURIComponent(s.nombre)}'
        )"
        class="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition"
      >
        Justificar
      </button>

      ${estadoHtml}
    </div>
  `;
}

async function renderAttList() {
  const idCurso = document.getElementById('attCurso').value;
  const fecha = document.getElementById('attDate').value;
  const idBloque = document.getElementById('attBloque')?.value || 1;

  const esInspector = currentUser?.rol === 'INSPECTOR';
  const soloLectura = currentUser?.rol === 'DOCENTE';

  const list = esInspector
    ? await InspectorApi.asistencia(idCurso, fecha, idBloque)
    : await DocenteApi.asistencia(idCurso, fecha, idBloque);
  const container = document.getElementById('attList');

  if (!list.length) {
    container.innerHTML = '<div class="text-center py-12 text-gray-400">Sin alumnos matriculados en este curso</div>';
    return;
  }

  const idCursoNum = parseInt(idCurso) || 0;

  const sinRegistroYBloqueado = list.some(s => !s.registroGuardado && !s.puedeCrear);

  const banner = sinRegistroYBloqueado && !soloLectura
    ? `
      <div class="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl mb-4">
        ⚠️ Ya pasó la ventana normal de registro inicial o no corresponde al profesor responsable del primer bloque.
        Puede modificar registros existentes, pero no crear nuevos registros iniciales sin permisos.
      </div>
    `
    : '';

  const bannerSoloLectura = soloLectura
    ? `
      <div class="bg-sky-50 border border-sky-200 text-sky-800 text-sm p-4 rounded-xl mb-4">
        👁️ Modo solo lectura — La asistencia es registrada por el Inspector o Administración.
      </div>
    `
    : '';

  container.innerHTML = bannerSoloLectura + banner + `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
      <table class="w-full">
         <thead class="bg-gray-50 border-b">
            <tr>
                <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Alumno</th>
                <th class="px-6 py-3 text-center text-xs uppercase font-bold text-gray-500">Estado</th>
                <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Justificación</th>
                <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Historial / Hora</th>
                ${soloLectura ? '' : '<th class="px-6 py-3 text-center text-xs uppercase font-bold text-gray-500">Acciones</th>'}
            </tr>
         </thead>

        <tbody class="divide-y divide-gray-100">
            ${list.map(s => {
            const st = (s.estado || '').toUpperCase();
            const creadoEl = s.creadoEl ? formatDateTime(s.creadoEl) : 'Sin registro';
            const modificadoEl = s.modificadoEl ? formatDateTime(s.modificadoEl) : '';
            
            return `
            <tr class="hover:bg-gray-50" data-sid="${s.idEstudiante}">
                <td class="px-6 py-3 font-medium text-gray-900">
                ${s.nombre}
                <span class="text-xs text-gray-400 ml-2 block">${s.rut}</span>
                </td>
                <td class="px-6 py-3 text-center">
                <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden shadow-sm ${soloLectura ? 'opacity-70 cursor-not-allowed' : ''}">
                    <button data-att-tipo="PRESENTE" ${soloLectura ? 'disabled title="La asistencia la registra el Inspector"' : `onclick="setAttBtn(${s.idEstudiante},'PRESENTE')"`} class="px-3 py-1.5 text-xs font-semibold transition ${st === 'PRESENTE' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">Presente</button>
                    <button data-att-tipo="AUSENTE" ${soloLectura ? 'disabled title="La asistencia la registra el Inspector"' : `onclick="setAttBtn(${s.idEstudiante},'AUSENTE')"`} class="px-3 py-1.5 text-xs font-semibold transition border-l border-gray-200 ${st === 'AUSENTE' ? 'bg-rose-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">Ausente</button>
                    <button data-att-tipo="TARDANZA" ${soloLectura ? 'disabled title="La asistencia la registra el Inspector"' : `onclick="setAttBtn(${s.idEstudiante},'TARDANZA')"`} class="px-3 py-1.5 text-xs font-semibold transition border-l border-gray-200 ${st === 'TARDANZA' ? 'bg-amber-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">Atraso</button>
                </div>
                <input type="hidden" data-estado="${s.idEstudiante}" value="${st}"/>
                </td>
                <td class="px-6 py-3">
                ${justificacionCellHtml(s, idCursoNum)}
                </td>
                <td class="px-6 py-3 text-xs text-gray-500">
                <div class="flex flex-col gap-0.5">
                    <span class="text-slate-600"><strong class="text-slate-800">Creado:</strong> ${creadoEl}${s.idBloqueRegistro ? ` · Bloque ${s.idBloqueRegistro}` : ''}</span>
                    ${s.creadoPor ? `<span class="text-gray-400">por ${escapeHtml(s.creadoPor)}</span>` : ''}
                    ${s.modificadoEl 
                    ? `<span class="text-amber-700"><strong class="text-amber-800">Modificado:</strong> ${modificadoEl}${s.modificadoPor ? ` · ${escapeHtml(s.modificadoPor)}` : ''}</span>` 
                    : '<span class="text-gray-400 italic">Sin modificaciones</span>'}
                </div>
                </td>
                ${soloLectura ? '' : `
                <td class="px-6 py-3 text-center">
                <button 
                    onclick="openModificarAsistenciaModal(${s.idEstudiante}, ${idCursoNum}, '${fecha}')" 
                    class="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition"
                    ${!s.puedeModificar && s.registroGuardado ? 'disabled title="No tiene permisos"' : ''}
                >
                    ✏️ Modificar
                </button>
                </td>`}
            </tr>
            `;
        }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
    // Feature 5: Resumen automático
    await renderResumenAsistenciaCurso();
}

// ════════════════════════════════════════════════════════
//  FEATURE 5: RESUMEN AUTOMÁTICO POR CURSO
// ════════════════════════════════════════════════════════

async function renderResumenAsistenciaCurso() {
  const idCurso = document.getElementById('attCurso')?.value;
  const fecha = document.getElementById('attDate')?.value;
  if (!idCurso || !fecha) return;

  let resumenContainer = document.getElementById('resumenAsistenciaBox');
  if (!resumenContainer) {
    resumenContainer = document.createElement('div');
    resumenContainer.id = 'resumenAsistenciaBox';
    // Insertar antes de la tabla de asistencia
    const attTable = document.getElementById('attList') || document.getElementById('attendanceList');
    if (attTable) {
      attTable.parentNode.insertBefore(resumenContainer, attTable);
    } else {
      const content = document.getElementById('content');
      if (content) content.insertBefore(resumenContainer, content.firstChild);
    }
  }

  try {
    const resumen = await DocenteApi.resumenAsistenciaCurso(idCurso, fecha);
    if (!resumen) return;

    const pct = parseFloat(resumen.pctAsistencia);
    let pctColor = 'text-emerald-600';
    let pctBg = 'bg-emerald-50 border-emerald-200';
    if (pct < 75) { pctColor = 'text-red-600'; pctBg = 'bg-red-50 border-red-200'; }
    else if (pct < 90) { pctColor = 'text-amber-600'; pctBg = 'bg-amber-50 border-amber-200'; }

    resumenContainer.innerHTML = `
      <div class="mb-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div class="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
          <div class="text-xl font-bold text-gray-900">${resumen.total}</div>
          <div class="text-[10px] uppercase font-semibold text-gray-500 tracking-wide">Total</div>
        </div>
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center shadow-sm">
          <div class="text-xl font-bold text-emerald-700">${resumen.presentes}</div>
          <div class="text-[10px] uppercase font-semibold text-emerald-600 tracking-wide">Presentes</div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-xl p-3 text-center shadow-sm">
          <div class="text-xl font-bold text-red-700">${resumen.ausentes}</div>
          <div class="text-[10px] uppercase font-semibold text-red-600 tracking-wide">Ausentes</div>
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center shadow-sm">
          <div class="text-xl font-bold text-amber-700">${resumen.tardanzas}</div>
          <div class="text-[10px] uppercase font-semibold text-amber-600 tracking-wide">Atrasos</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center shadow-sm">
          <div class="text-xl font-bold text-gray-500">${resumen.sinRegistro}</div>
          <div class="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">Sin registro</div>
        </div>
        <div class="${pctBg} border rounded-xl p-3 text-center shadow-sm">
          <div class="text-xl font-bold ${pctColor}">${resumen.pctAsistencia}%</div>
          <div class="text-[10px] uppercase font-semibold ${pctColor} tracking-wide">Asistencia</div>
        </div>
      </div>
    `;
  } catch (e) {
    resumenContainer.innerHTML = '';
  }
}

function setAttBtn(sid, estado) {
  const inp = document.querySelector(`[data-estado="${sid}"]`);
  if (inp) inp.value = estado;
  renderAttListVisual(sid, estado);
}

function renderAttListVisual(sid, estado) {
  const row = document.querySelector(`[data-sid="${sid}"]`);
  if (!row) return;

  row.querySelectorAll('[data-att-tipo]').forEach(btn => {
    const currentType = btn.dataset.attTipo;

    let activeClass = 'bg-indigo-600 text-white';
    if (currentType === 'PRESENTE') activeClass = 'bg-emerald-600 text-white';
    if (currentType === 'AUSENTE') activeClass = 'bg-rose-600 text-white';
    if (currentType === 'TARDANZA') activeClass = 'bg-amber-400 text-white';

    btn.className = `
      px-3 py-1.5 text-xs font-semibold transition
      ${currentType === estado ? activeClass : 'bg-white text-gray-600 hover:bg-gray-50'}
      ${currentType !== 'PRESENTE' ? 'border-l border-gray-200' : ''}
    `;
  });
}

function markAllPresent() {
  document.querySelectorAll('[data-estado]').forEach(inp => {
    inp.value = 'PRESENTE';
    renderAttListVisual(parseInt(inp.dataset.estado), 'PRESENTE');
  });

  toast('Todos marcados como presentes');
}

async function saveAttendance() {
  const idCurso = parseInt(document.getElementById('attCurso').value);
  const fecha = document.getElementById('attDate').value;
  const idBloque = parseInt(document.getElementById('attBloque')?.value || 1);

  const items = [];

  document.querySelectorAll('[data-sid]').forEach(row => {
    const sid = parseInt(row.dataset.sid);

    items.push({
      idEstudiante: sid,
      idCurso,
      fecha,
      estado: document.querySelector(`[data-estado="${sid}"]`)?.value || 'PRESENTE',
      observacion: undefined
    });
  });

  try {
    await DocenteApi.guardarAsistencia(items, { idCurso, fecha, idBloque });
    toast('✅ Asistencia diaria guardada correctamente');
    await renderAttList();
  } catch (e) {
    toast('❌ ' + (e.message || 'No fue posible guardar la asistencia'));
  }
}

async function openJustificacionModal(idEstudiante, idCurso, nombreEncoded) {
  const nombre = decodeURIComponent(nombreEncoded || '');
  const fecha = document.getElementById('attDate').value;

  const just = await DocenteApi.obtenerJustificacion(idEstudiante, fecha);

  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Justificar Asistencia</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form onsubmit="saveJustificacion(event, ${idEstudiante}, ${idCurso})" class="p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Alumno</label>
          <input type="text" disabled value="${escapeHtml(nombre)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none"/>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
          <input type="date" id="jusFecha" value="${fecha}" disabled class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none"/>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo</label>
        <input
          type="text"
          id="jusMotivo"
          required
          value="${escapeHtml(just?.motivo || '')}"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
          placeholder="ej: Problema médico, aviso previo del apoderado"
        />
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Estado de justificación</label>
        <select id="jusEstado" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          <option value="PENDIENTE" ${!just || just.estadoJustificacion === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
          <option value="APROBADA" ${just?.estadoJustificacion === 'APROBADA' ? 'selected' : ''}>Aprobada</option>
          <option value="RECHAZADA" ${just?.estadoJustificacion === 'RECHAZADA' ? 'selected' : ''}>Rechazada</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Observación adicional</label>
        <textarea
          id="jusObservacion"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
          placeholder="Observación adicional, contexto o indicaciones"
        >${escapeHtml(just?.observacion || '')}</textarea>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Documento de respaldo (opcional)</label>
        <input type="file" id="jusDocumento" class="w-full text-sm text-gray-500"/>
        <p class="text-xs text-gray-400 mt-1">
          Por ahora se guarda solo el nombre del archivo. La arquitectura queda preparada para adjuntar documentos reales.
        </p>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">
          Cancelar
        </button>

        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">
          Guardar Justificación
        </button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');
}

async function saveJustificacion(e, idEstudiante, idCurso) {
  e.preventDefault();

  const fecha = document.getElementById('jusFecha').value;
  const motivo = document.getElementById('jusMotivo').value.trim();
  const estadoJustificacion = document.getElementById('jusEstado').value;
  const observacion = document.getElementById('jusObservacion').value.trim();
  const documentoNombre = document.getElementById('jusDocumento').files[0]?.name || '';

  try {
    await DocenteApi.guardarJustificacion({
      idEstudiante,
      idCurso,
      fecha,
      motivo,
      estadoJustificacion,
      observacion,
      documentoNombre
    });

    closeModal();
    toast('✅ Justificación guardada correctamente');
    await renderAttList();
  } catch (err) {
    toast('❌ ' + (err.message || 'No fue posible guardar la justificación'));
  }
}

// ==========================================
// SELECTOR EN CASCADA: CURSO (NIVEL) → ASIGNATURA
// (Vista Docente → Calificaciones)
// ==========================================
function nivelesDeCursosDocente(cursos) {
  return [...new Set((cursos || []).map(c => c.nivel || c.nombreCurso || 'Sin nivel'))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
}

function rellenarSelectCursosPorNivel(selectNivelId, selectCursoId, opciones = {}) {
  const { todosLabel = null } = opciones;
  const selNivel = document.getElementById(selectNivelId);
  const selCurso = document.getElementById(selectCursoId);
  if (!selNivel || !selCurso) return;

  const nivel = selNivel.value;

  // En el modal (sin todosLabel), si aún no hay nivel elegido no se listan asignaturas.
  if (!todosLabel && !nivel) {
    selCurso.innerHTML = '<option value="" disabled selected>Selecciona primero un nivel...</option>';
    return;
  }

  const cursos = (cacheCursos || [])
    .filter(c => !nivel || (c.nivel || c.nombreCurso || 'Sin nivel') === nivel)
    .slice()
    .sort((a, b) =>
      String(a.asignatura || a.nombreCurso || '').localeCompare(
        String(b.asignatura || b.nombreCurso || ''),
        'es'
      )
    );

  let html = todosLabel
    ? `<option value="">${escapeHtml(todosLabel)}</option>`
    : '<option value="" disabled selected>Selecciona una asignatura...</option>';

  html += cursos.map(c =>
    `<option value="${c.idCurso}">${escapeHtml(c.asignatura || c.nombreCurso)}${c.nivel ? ' · ' + escapeHtml(c.nivel) : ''}</option>`
  ).join('');

  selCurso.innerHTML = html;
}

// ═══ Buscador por nombre de alumno en calificaciones ═══
function normalizarBusqueda(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// DOCENTE: filtra la tabla (curso específico) o las tarjetas (todos mis cursos)
function filtrarAlumnosCalificaciones() {
  const input = document.getElementById('gradeBuscarAlumno');
  const tabla = document.getElementById('gradesTable');
  const vacio = document.getElementById('gradesSinResultados');
  if (!input || !tabla) return;

  const q = normalizarBusqueda(input.value);

  const tarjetas = Array.from(tabla.querySelectorAll(':scope > div'))
    .filter(d => d.querySelector('h4'));

  const items = tarjetas.length
    ? tarjetas.map(el => ({ el, nombre: el.querySelector('h4').textContent }))
    : Array.from(tabla.querySelectorAll('tbody tr'))
        .map(el => ({ el, nombre: el.querySelector('td')?.textContent || '' }));

  let visibles = 0;
  items.forEach(({ el, nombre }) => {
    const ok = !q || normalizarBusqueda(nombre).includes(q);
    el.style.display = ok ? '' : 'none';
    if (ok) visibles++;
  });

  if (vacio) vacio.classList.toggle('hidden', !(q && items.length && !visibles));
}

// ADMIN: filtra las tarjetas de alumnos dentro del detalle de notas de un curso
function filtrarAlumnosDetalleNotas(idCurso, valor) {
  const cont = document.getElementById(`grades-content-${idCurso}`);
  if (!cont) return;
  const q = normalizarBusqueda(valor);

  cont.querySelectorAll(':scope > div.bg-slate-50').forEach(card => {
    const nombre = card.querySelector('span.font-semibold')?.textContent || '';
    card.style.display = (!q || normalizarBusqueda(nombre).includes(q)) ? '' : 'none';
  });
}

async function renderDocenteGrades() {
  document.getElementById('pageTitle').textContent = 'Libro de Calificaciones';
  const cursos = cacheCursos || [];
  const niveles = nivelesDeCursosDocente(cursos);

  document.getElementById('content').innerHTML = `
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto md:min-w-[480px]">
        <div>
          <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">1) Curso (nivel)</label>
          <select id="gradeNivel" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
            <option value="">Todos mis cursos</option>
            ${niveles.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">2) Asignatura</label>
          <select id="gradeCurso" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
            <option value="">Todos mis cursos</option>
            ${cursos
              .slice()
              .sort((a, b) => String(a.asignatura || a.nombreCurso || '').localeCompare(String(b.asignatura || b.nombreCurso || ''), 'es'))
              .map(c => `<option value="${c.idCurso}">${escapeHtml(c.asignatura || c.nombreCurso)}${c.nivel ? ' · ' + escapeHtml(c.nivel) : ''}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="w-full md:w-64">
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">3) Buscar alumno</label>
        <input type="text" id="gradeBuscarAlumno" placeholder="🔍 Nombre del alumno..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" />
      </div>
      <div class="ml-auto flex gap-2">
        <button onclick="exportarExcelDocente('notas')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm flex items-center gap-2">
          <span>📊</span> Exportar Excel
        </button>
        <button onclick="openGradeModal()" class="btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white">
          + Nueva Calificación
        </button>
      </div>
    </div>
    <div id="gradesTable"></div>
    <div id="gradesSinResultados" class="hidden text-center bg-white border border-gray-200 rounded-xl py-8 text-gray-400 text-sm">
      Ningún alumno coincide con la búsqueda.
    </div>
  `;

  document.getElementById('gradeNivel').addEventListener('change', () => {
    rellenarSelectCursosPorNivel('gradeNivel', 'gradeCurso', { todosLabel: 'Todos mis cursos' });
    renderGradesTable();
  });

  document.getElementById('gradeCurso').addEventListener('change', renderGradesTable);

  document.getElementById('gradeBuscarAlumno').addEventListener('input', filtrarAlumnosCalificaciones);

  // Reaplica el filtro cada vez que la tabla se vuelve a dibujar
  // (al cambiar de curso, guardar o eliminar una nota)
  new MutationObserver(filtrarAlumnosCalificaciones)
    .observe(document.getElementById('gradesTable'), { childList: true });

  await renderGradesTable();
}

// Calcula el Promedio Final de un alumno según la regla de coeficientes:
// Coeficiente 1 = 1 vez la nota, Coeficiente 2 = 2 veces la misma nota (peso doble)
function calcularPromedioFinal(notas) {
  if (!notas || !notas.length) return null;

  let sumaTotal = 0;
  let divisor = 0;

  notas.forEach(g => {
    const notaNum = parseFloat(g.nota);
    if (isNaN(notaNum)) return;

    const coef = parseInt(g.coeficiente) === 2 ? 2 : 1;

    if (coef === 2) {
      sumaTotal += notaNum * 2; // la misma nota cuenta 2 veces
      divisor += 2;
    } else {
      sumaTotal += notaNum;
      divisor += 1;
    }
  });

  if (divisor === 0) return null;

  return sumaTotal / divisor;
}

// ════════════════════════════════════════════════════════
//  LIBRO DE CALIFICACIONES — TABLA ESTILO EXCEL
//  (columnas de notas configuradas por Administración, máx 10)
// ════════════════════════════════════════════════════════
let cacheGradesCurso = [];

function promedioSimple(notas) {
  const validas = (notas || []).map(n => parseFloat(n.nota)).filter(n => !isNaN(n));
  if (!validas.length) return null;
  return validas.reduce((a, b) => a + b, 0) / validas.length;
}

function obtenerNotasPorCurso(idCurso) {
  const curso = cacheCursos.find(c => c.idCurso === Number(idCurso));
  return Math.min(10, Math.max(1, parseInt(curso?.notasPorCurso, 10) || 6));
}

async function renderTablaNotasCurso(idCurso) {
  const [alumnos, grades] = await Promise.all([
    DocenteApi.estudiantes(idCurso),
    DocenteApi.calificaciones(idCurso)
  ]);
  cacheGradesCurso = grades || [];

  const container = document.getElementById('gradesTable');
  if (!alumnos.length) {
    container.innerHTML = `
      <div class="text-center bg-white border border-gray-200 rounded-xl py-12 text-gray-400">
        No hay estudiantes registrados en este curso.
      </div>
    `;
    return;
  }

  const nCols = obtenerNotasPorCurso(idCurso);

  const notasPorAlumno = {};
  (grades || []).forEach(g => {
    if (!notasPorAlumno[g.idEstudiante]) notasPorAlumno[g.idEstudiante] = [];
    notasPorAlumno[g.idEstudiante].push(g);
  });
  Object.values(notasPorAlumno).forEach(lista => lista.sort((a, b) =>
    new Date(a.fechaNota || a.fechaRegistro || 0) - new Date(b.fechaNota || b.fechaRegistro || 0)
  ));

    // Reparte cada nota en SU columna. Las notas antiguas (sin posición)
  // ocupan los huecos libres en orden cronológico, como antes.
  const slotsPorAlumno = {};
  Object.entries(notasPorAlumno).forEach(([idAl, lista]) => {
    const slots = new Array(nCols).fill(null);
    const sinPos = [];
    lista.forEach(g => {
      const p = parseInt(g.posicion, 10);
      if (p >= 1 && p <= nCols && !slots[p - 1]) slots[p - 1] = g;
      else sinPos.push(g);
    });
    sinPos.forEach(g => {
      const libre = slots.indexOf(null);
      if (libre !== -1) slots[libre] = g;
    });
    slotsPorAlumno[idAl] = slots;
  });

  const celdaNota = (alumno, idx) => {
    const g = (slotsPorAlumno[alumno.idEstudiante] || [])[idx];
    if (g) {
      const notaNum = parseFloat(g.nota);
      const colorNota = notaNum >= 4.0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
      return `
        <div class="flex items-center justify-center gap-1">
          <button onclick="openEditGradeModal(${g.idCalificacion})" title="Editar nota" class="px-2.5 py-1 rounded-lg border text-sm font-bold ${colorNota} hover:shadow-sm transition">${notaNum.toFixed(1)}</button>
          <button onclick="deleteGrade(${g.idCalificacion})" title="Eliminar nota" class="text-[10px] text-rose-500 hover:text-rose-700 font-bold px-1">✕</button>
        </div>
      `;
    }
    return `
      <button onclick="openNuevaNotaModal(${idCurso}, ${alumno.idEstudiante}, '${encodeURIComponent(alumno.nombre)}', ${idx + 1})"
        title="Agregar Nota ${idx + 1}" class="px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm font-bold hover:border-indigo-400 hover:text-indigo-500 transition">+</button>
    `;
  };

  let html = `
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3 shadow-sm">
      <span class="text-xs font-bold text-gray-500 uppercase">Cantidad de notas del curso:</span>
      <span class="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold">${nCols} columnas</span>
      <span class="text-[10px] text-gray-400">Ajustada por Administración (máximo 10)</span>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
      <table class="w-full border-collapse min-w-[900px]">
        <thead class="bg-slate-900 text-white">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase font-bold sticky left-0 bg-slate-900">Alumno</th>
            ${Array.from({ length: nCols }, (_, i) => `<th class="px-3 py-3 text-center text-xs uppercase font-bold border-l border-slate-700">Nota ${i + 1}</th>`).join('')}
            <th class="px-3 py-3 text-center text-xs uppercase font-bold border-l border-slate-700">Promedio</th>
            <th class="px-3 py-3 text-center text-xs uppercase font-bold border-l border-slate-700">Reporte</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
  `;

  alumnos.forEach(alumno => {
    html += `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-white">${escapeHtml(alumno.nombre)}</td>
        ${Array.from({ length: nCols }, (_, i) => `<td class="px-3 py-3 text-center border-l border-gray-100">${celdaNota(alumno, i)}</td>`).join('')}
        <td class="px-3 py-3 text-center border-l border-gray-100">
          <button onclick="mostrarPromedioAlumno(${alumno.idEstudiante}, '${encodeURIComponent(alumno.nombre)}')" title="Ver promedio" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">📊 Promedio</button>
        </td>
        <td class="px-3 py-3 text-center border-l border-gray-100">
          <button onclick="mostrarReporteAlumno(${idCurso}, ${alumno.idEstudiante}, '${encodeURIComponent(alumno.nombre)}')" title="Ver reporte" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition">📄 Reporte</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function openNuevaNotaModal(idCurso, idEstudiante, nombreEncoded, posicion) {
  const nombre = decodeURIComponent(nombreEncoded || '');
  const m = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Agregar Nota ${posicion}</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>
    <form onsubmit="saveNotaPosicion(event, ${idCurso}, ${idEstudiante}, ${posicion})" class="p-6 space-y-4">
      <div class="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm text-indigo-700 font-medium">
        Alumno: <strong>${escapeHtml(nombre)}</strong> · Nota ${posicion}
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (2.0 - 7.0)</label>
        <input type="number" id="modalNotaPosValor" step="0.1" min="2" max="7" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: 5.5"/>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
        <input type="date" id="modalNotaPosFecha" value="${todayStr()}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Detalle (opcional)</label>
        <input type="text" id="modalNotaPosDesc" value="Nota ${posicion}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Guardar Nota</button>
      </div>
    </form>
  `;
  m.classList.remove('hidden');
}

async function saveNotaPosicion(e, idCurso, idEstudiante, posicion) {
  e.preventDefault();
  const nota = parseFloat(document.getElementById('modalNotaPosValor').value);
  if (isNaN(nota) || nota < 2 || nota > 7) { toast('❌ La nota debe estar entre 2.0 y 7.0'); return; }
  try {
    await DocenteApi.crearCalificacion({
      idCurso,
      idEstudiante,
      nota,
      posicion,
      fechaNota: document.getElementById('modalNotaPosFecha').value,
      descripcion: document.getElementById('modalNotaPosDesc').value
    });
    closeModal();
    toast('✅ Nota registrada exitosamente');
    await renderGradesTable();
  } catch (err) {
    toast('❌ ' + (err.message || 'No fue posible registrar la nota'));
  }
}

function mostrarPromedioAlumno(idEstudiante, nombreEncoded) {
  const nombre = decodeURIComponent(nombreEncoded || '');
  const notas = (cacheGradesCurso || []).filter(g => g.idEstudiante === idEstudiante);
  const promedio = promedioSimple(notas);
  const m = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Promedio de Notas</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>
    <div class="p-6 text-center">
      <div class="text-sm text-gray-500 mb-2">${escapeHtml(nombre)}</div>
      <div class="text-5xl font-extrabold ${promedio === null ? 'text-gray-300' : promedio >= 4.0 ? 'text-emerald-600' : 'text-rose-600'}">${promedio === null ? '—' : promedio.toFixed(1)}</div>
      <div class="text-xs text-gray-400 mt-2">${notas.length} ${notas.length === 1 ? 'nota registrada' : 'notas registradas'}</div>
    </div>
  `;
  m.classList.remove('hidden');
}

async function mostrarReporteAlumno(idCurso, idEstudiante, nombreEncoded) {
  const nombre = decodeURIComponent(nombreEncoded || '');
  const notas = (cacheGradesCurso || []).filter(g => g.idEstudiante === idEstudiante);
  const promedio = promedioSimple(notas);

  let asistencia = [];
  try {
    asistencia = (await DocenteApi.asistenciaHistorica(idCurso)).filter(a => a.idEstudiante === idEstudiante);
  } catch (_) {}

  const total = asistencia.length;
  const presentes = asistencia.filter(a => a.estado === 'PRESENTE').length;
  const tardanzas = asistencia.filter(a => a.estado === 'TARDANZA').length;
  const ausentes = asistencia.filter(a => a.estado === 'AUSENTE').length;
  const justificados = asistencia.filter(a => a.estado === 'JUSTIFICADO').length;
  const pct = total ? (((presentes + tardanzas) / total) * 100).toFixed(1) : null;

  const m = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Reporte del Alumno</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>
    <div class="p-6 space-y-4">
      <div class="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm text-indigo-700 font-medium">${escapeHtml(nombre)}</div>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div class="text-xs text-gray-500 uppercase font-bold mb-1">Promedio Notas</div>
          <div class="text-3xl font-extrabold ${promedio === null ? 'text-gray-300' : promedio >= 4.0 ? 'text-emerald-600' : 'text-rose-600'}">${promedio === null ? '—' : promedio.toFixed(1)}</div>
          <div class="text-[10px] text-gray-400 mt-1">${notas.length} notas</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div class="text-xs text-gray-500 uppercase font-bold mb-1">Asistencia</div>
          <div class="text-3xl font-extrabold ${pct === null ? 'text-gray-300' : parseFloat(pct) >= 85 ? 'text-emerald-600' : 'text-rose-600'}">${pct === null ? '—' : pct + '%'}</div>
          <div class="text-[10px] text-gray-400 mt-1">${total} registros</div>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-2"><div class="font-bold text-emerald-700">${presentes}</div><div class="text-emerald-600">Presentes</div></div>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-2"><div class="font-bold text-amber-700">${tardanzas}</div><div class="text-amber-600">Atrasos</div></div>
        <div class="bg-rose-50 border border-rose-200 rounded-lg p-2"><div class="font-bold text-rose-700">${ausentes}</div><div class="text-rose-600">Ausentes</div></div>
        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-2"><div class="font-bold text-indigo-700">${justificados}</div><div class="text-indigo-600">Justificados</div></div>
      </div>

      <div>
        <div class="text-xs font-bold text-gray-500 uppercase mb-2">Detalle de notas</div>
        ${notas.length ? `
          <div class="space-y-1 max-h-48 overflow-y-auto">
            ${notas.map(g => {
              const n = parseFloat(g.nota);
              return `<div class="flex justify-between items-center text-sm p-2 bg-slate-50 border border-slate-100 rounded-lg">
                <span class="text-gray-700">${escapeHtml(g.descripcion || g.tipoEvaluacion || 'S/D')} <span class="text-xs text-gray-400">(${g.fechaNota || g.fechaRegistro || ''})</span></span>
                <span class="font-bold ${n >= 4.0 ? 'text-emerald-600' : 'text-rose-600'}">${n.toFixed(1)}</span>
              </div>`;
            }).join('')}
          </div>
        ` : '<p class="text-xs text-gray-400 italic">Sin notas registradas.</p>'}
      </div>
    </div>
  `;
  m.classList.remove('hidden');
}

async function renderGradesTable() {
  const idCurso = document.getElementById('gradeCurso')?.value;

  // ==========================================
  // CURSO ESPECÍFICO SELECCIONADO
  // Se listan TODOS los estudiantes del curso (tengan o no nota)
  // y sus notas se apilan verticalmente por Coeficiente 1 / Coeficiente 2
  // ==========================================
  if (idCurso) {
    await renderTablaNotasCurso(idCurso);
    return;
  }

  // ==========================================
  // SIN CURSO SELECCIONADO (TODOS MIS CURSOS)
  // Se mantiene el comportamiento agrupado por alumno, solo con notas existentes
  // ==========================================
  const grades = await DocenteApi.calificaciones(null);

  if (!grades.length) {
    document.getElementById('gradesTable').innerHTML = `
      <div class="text-center bg-white border border-gray-200 rounded-xl py-12 text-gray-400">
        No hay calificaciones registradas.
      </div>
    `;
    return;
  }

  const grouped = {};

  grades.forEach(g => {
    const key = g.idEstudiante;
    if (!grouped[key]) grouped[key] = { nombre: g.nombreEstudiante, notas: [] };
    grouped[key].notas.push(g);
  });

  let html = '';

  for (const [idAlumno, grupo] of Object.entries(grouped)) {
    const promedioGrupo = calcularPromedioFinal(grupo.notas);
    const promedioGrupoHtml = promedioGrupo === null
      ? ''
      : `<span class="text-sm font-bold ${promedioGrupo >= 4.0 ? 'text-emerald-600' : 'text-rose-600'}">Promedio Final: ${promedioGrupo.toFixed(1)}</span>`;

    html += `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-4">
        <div class="bg-slate-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="font-bold text-gray-900 text-base">${grupo.nombre}</h4>
          ${promedioGrupoHtml}
        </div>

        <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Curso</th>
              <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Evaluación</th>
              <th class="px-6 py-3 text-center text-xs uppercase font-bold text-gray-500">Nota</th>
              <th class="px-6 py-3 text-center text-xs uppercase font-bold text-gray-500">Acción</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
    `;

    grupo.notas.forEach(g => {
      const notaNum = parseFloat(g.nota);
      const colorNota = notaNum >= 4.0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
      const coef = parseInt(g.coeficiente) === 2 ? 2 : 1;

      html += `
        <tr>
          <td class="px-6 py-3 text-sm text-gray-600">${g.nombreCurso || g.asignatura || 'S/D'}</td>
          <td class="px-6 py-3 text-sm">
            <div>${g.descripcion || g.tipoEvaluacion || 'S/D'}</div>
            <span class="text-xs text-gray-400 block">${g.fechaNota || g.fechaRegistro || ''}</span>
          </td>

          <td class="px-6 py-3 text-center text-base ${colorNota}">${notaNum.toFixed(1)}</td>

          <td class="px-6 py-3 text-center space-x-2">
            <button onclick="openEditGradeModal(${g.idCalificacion})" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1 transition">Editar</button>
            <button onclick="deleteGrade(${g.idCalificacion})" class="text-xs font-semibold text-rose-600 hover:text-rose-800 p-1 transition">Eliminar</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
  }

  document.getElementById('gradesTable').innerHTML = html;
}

function openGradeModal() {
  const m = document.getElementById('modal');

  // Si el filtro de la pantalla ya tiene una asignatura elegida, se preselecciona en el modal
  const idCursoFiltrado = document.getElementById('gradeCurso')?.value || '';
  const cursoFiltrado = (cacheCursos || []).find(c => String(c.idCurso) === String(idCursoFiltrado));
  const niveles = nivelesDeCursosDocente(cacheCursos);

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Registrar Nueva Nota</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
    </div>
    <form id="formGrade" onsubmit="saveGrade(event)" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">1) Curso (nivel)</label>
        <select id="modalGradeNivel" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          <option value="" disabled ${cursoFiltrado ? '' : 'selected'}>Selecciona un curso (nivel)...</option>
          ${niveles.map(n => `
            <option value="${escapeHtml(n)}" ${cursoFiltrado && (cursoFiltrado.nivel || cursoFiltrado.nombreCurso) === n ? 'selected' : ''}>
              ${escapeHtml(n)}
            </option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">2) Asignatura</label>
        <select id="modalGradeCurso" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          <option value="" disabled selected>Selecciona primero un nivel...</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Seleccionar Alumno</label>
        <select id="modalGradeAlumno" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          <option value="" disabled selected>Selecciona una asignatura primero...</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (2.0 - 7.0)</label>
        <input type="number" id="modalGradeValue" step="0.1" min="2" max="7" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: 6.5"/>
      </div>
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
          <input type="date" id="modalGradeDate" value="${todayStr()}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Detalle / Nombre de la evaluación</label>
        <input type="text" id="modalGradeDesc" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="ej: Prueba 1, Acumulativa, Trabajo Grupal"/>
      </div>
      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Guardar Nota</button>
      </div>
    </form>
  `;

  // Rellena las asignaturas del nivel preseleccionado (si el filtro traía una)
  rellenarSelectCursosPorNivel('modalGradeNivel', 'modalGradeCurso', {});

  if (idCursoFiltrado) {
    const selCurso = document.getElementById('modalGradeCurso');
    if (selCurso) selCurso.value = String(idCursoFiltrado);
    updateModalAlumnos();
  }

  // Al cambiar el nivel, se recargan solo las asignaturas de ese nivel
  document.getElementById('modalGradeNivel').addEventListener('change', () => {
    rellenarSelectCursosPorNivel('modalGradeNivel', 'modalGradeCurso', {});
    const selAlumno = document.getElementById('modalGradeAlumno');
    if (selAlumno) {
      selAlumno.innerHTML = '<option value="" disabled selected>Selecciona una asignatura primero...</option>';
    }
  });

  // Al cambiar la asignatura, se cargan los alumnos de ese curso
  document.getElementById('modalGradeCurso').addEventListener('change', updateModalAlumnos);

  m.classList.remove('hidden');
}

async function updateModalAlumnos() {
  const idCurso = document.getElementById('modalGradeCurso').value;
  const selectAlumno = document.getElementById('modalGradeAlumno');

  if (!idCurso) {
    selectAlumno.innerHTML = '<option value="" disabled selected>Selecciona un curso primero...</option>';
    return;
  }

  const alumnos = await DocenteApi.estudiantes(idCurso);

  if (!alumnos.length) {
    selectAlumno.innerHTML = '<option value="" disabled selected>Este curso no tiene estudiantes</option>';
    return;
  }

  selectAlumno.innerHTML = alumnos.map(a =>
    `<option value="${a.idEstudiante}">${a.nombre}</option>`
  ).join('');
}

async function saveGrade(e) {
  e.preventDefault();
  const idCurso = parseInt(document.getElementById('modalGradeCurso').value);
  const idEstudiante = parseInt(document.getElementById('modalGradeAlumno').value);
  const selAlu = document.getElementById('modalGradeAlumno');
  const nombreEstudiante = sanitizeInput(selAlu.options[selAlu.selectedIndex].text);
  const selCur = document.getElementById('modalGradeCurso');
  const nombreCurso = sanitizeInput(selCur.options[selCur.selectedIndex].text);
  const notaNueva = parseFloat(document.getElementById('modalGradeValue').value);
  if (isNaN(notaNueva) || notaNueva < 2 || notaNueva > 7) {
    toast('❌ La nota debe estar entre 2.0 y 7.0');
    return;
  }

  await DocenteApi.crearCalificacion({
    idCurso,
    idEstudiante,
    nombreEstudiante,
    nombreCurso,
    nota: notaNueva,
    fechaNota: document.getElementById('modalGradeDate').value,
    descripcion: document.getElementById('modalGradeDesc').value
  });

  closeModal();
  toast('✅ Nota registrada exitosamente');
  await renderGradesTable();
}

async function deleteGrade(id) {
  const grade = (cacheGradesCurso || []).find(c => c.idCalificacion === id);
  const detalle = grade ? (grade.descripcion || grade.tipoEvaluacion || '') : '';
  const etiqueta = grade ? `${detalle ? detalle + ' - ' : ''}${grade.nombreEstudiante}` : 'esta calificación';

  if (confirm(`¿Seguro que desea eliminar ${etiqueta}?`)) {
    await DocenteApi.eliminarCalificacion(id);
    toast('Calificación eliminada');
    await renderGradesTable();
  }
}

async function openEditGradeModal(idCalificacion) {
  const grade = (cacheGradesCurso || []).find(c => c.idCalificacion === idCalificacion);
  if (!grade) return;

  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Editar Calificación</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form id="formEditGrade" onsubmit="saveEditedGrade(event, ${idCalificacion})" class="p-6 space-y-4">
      <div class="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm text-indigo-700 font-medium">
        Editando: <strong>${grade.nombreEstudiante}</strong> · ${grade.descripcion || grade.tipoEvaluacion || 'S/D'}
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Alumno</label>
        <input type="text" disabled value="${grade.nombreEstudiante}" class="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 outline-none cursor-not-allowed"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (2.0 - 7.0)</label>
        <input type="number" id="modalEditGradeValue" step="0.1" min="2" max="7" required value="${parseFloat(grade.nota).toFixed(1)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
          <input type="date" id="modalEditGradeDate" required value="${grade.fechaNota || grade.fechaRegistro}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Detalle / Nombre de la evaluación</label>
        <input type="text" id="modalEditGradeDesc" required value="${grade.descripcion || grade.tipoEvaluacion}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 transition">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white transition">Actualizar Nota</button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');
}

async function saveEditedGrade(e, idCalificacion) {
  e.preventDefault();

  const nuevaNota = parseFloat(document.getElementById('modalEditGradeValue').value);
  if (isNaN(nuevaNota) || nuevaNota < 2 || nuevaNota > 7) {
    toast('❌ La nota debe estar entre 2.0 y 7.0');
    return;
  }
  const nuevaFecha = document.getElementById('modalEditGradeDate').value;
  const nuevaDesc = document.getElementById('modalEditGradeDesc').value;

  await DocenteApi.editarCalificacion(idCalificacion, {
    nota: nuevaNota,
    fechaNota: nuevaFecha,
    descripcion: nuevaDesc
  });

  closeModal();
  toast('✅ Nota actualizada exitosamente');
  await renderGradesTable();
}

async function renderDocenteAnotaciones() {
  document.getElementById('pageTitle').textContent = 'Registro de Anotaciones u Observaciones';
  document.getElementById('pageSubtitle').textContent = 'Hoja de vida digital de los estudiantes';

  document.getElementById('content').innerHTML = `
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
      <button onclick="openAnotacionModal()" class="ml-auto btn-primary px-4 py-2 rounded-lg text-sm font-medium text-white">
        + Nueva Hoja de Vida
      </button>
    </div>

    <div id="anotacionesTable"></div>
  `;

  agregarBuscadorNombre('anotacionesTable', 'buscarAnotacionDocente', '🔍 Buscar estudiante por nombre...', true);

  await renderAnotacionesTable();
}

async function renderAnotacionesTable() {
  const list = await DocenteApi.anotaciones();
  const container = document.getElementById('anotacionesTable');

  if (!container) return;

  if (!list || !list.length) {
    container.innerHTML = '<div class="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200 shadow-sm">Sin anotaciones vigentes en la base de datos</div>';
    return;
  }

  let html = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Estudiante</th>
            <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Tipo</th>
            <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Detalle</th>
            <th class="px-6 py-3 text-left text-xs uppercase font-bold text-gray-500">Registrado por</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
  `;

  list.forEach(a => {
    const isPos = (a.tipoAnotacion || a.tipo || '').toUpperCase() === 'POSITIVA';
    const badgeClass = isPos ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100';

    html += `
      <tr class="hover:bg-gray-50 transition">
        <td class="px-6 py-3 font-medium text-gray-900">${a.nombreEstudiante || 'Sin nombre'}</td>

        <td class="px-6 py-3 text-sm">
          <span class="chip px-2.5 py-0.5 rounded border text-xs font-bold ${badgeClass}">
            ${a.tipoAnotacion || a.tipo || 'GENERAL'}
          </span>
        </td>

        <td class="px-6 py-3 text-sm text-gray-600">
          ${a.detalles || a.observacion || 'Sin detalles'}
          <span class="text-xs text-gray-400 block mt-0.5">${fechaES(a.fechaRegistro)}</span>
        </td>

        <td class="px-6 py-3 text-xs text-gray-500 font-medium">${a.nombreDocente || 'Desconocido'}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div></div>`;

  container.innerHTML = html;
}

function openAnotacionModal() {
  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Ingresar Observación / Anotación</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form id="formAnotacion" onsubmit="saveAnotacion(event)" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Curso</label>
        <select id="modalAnCurso" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          ${cacheCursos.map(c => `<option value="${c.idCurso}">${c.nombreCurso}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Estudiante</label>
        <select id="modalAnAlumno" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"></select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Comportamiento</label>
        <select id="modalAnTipo" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          <option value="POSITIVA">Anotación Destacable (Positiva)</option>
          <option value="NEGATIVA">Falta o Incumplimiento (Negativa)</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Detalles de la observación</label>
        <textarea id="modalAnDet" required rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="Escriba los hechos observados de forma objetiva..."></textarea>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm font-medium text-white">Registrar en Hoja de Vida</button>
      </div>
    </form>
  `;

  const selectCurso = document.getElementById('modalAnCurso');
  selectCurso.addEventListener('change', updateModalAnAlumnos);

  updateModalAnAlumnos();

  m.classList.remove('hidden');
}

async function updateModalAnAlumnos() {
  const idCurso = document.getElementById('modalAnCurso').value;
  const alumnos = await DocenteApi.estudiantes(idCurso);

  document.getElementById('modalAnAlumno').innerHTML = alumnos.map(a =>
    `<option value="${a.idEstudiante}">${a.nombre}</option>`
  ).join('');
}

async function saveAnotacion(e) {
  e.preventDefault();

  const selAlu = document.getElementById('modalAnAlumno');

  await DocenteApi.crearAnotacion({
    idEstudiante: parseInt(selAlu.value),
    nombreEstudiante: selAlu.options[selAlu.selectedIndex].text,
    tipoAnotacion: document.getElementById('modalAnTipo').value,
    detalles: document.getElementById('modalAnDet').value
  });

  closeModal();
  toast('📋 Observación registrada en bitácora digital');
  await renderAnotacionesTable();
}

async function renderDocenteMaterials() {
  document.getElementById('pageTitle').textContent = 'Repositorio y Material de Estudio';

  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm self-start">
        <h4 class="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Subir Nuevo Archivo</h4>

        <form id="formMat" onsubmit="uploadMaterial(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Asociar a Curso</label>
            <select id="matCurso" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
              ${cacheCursos.map(c => `<option value="${c.idCurso}">${c.nombreCurso}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Seleccione Documento</label>

            <div class="file-drop p-6 rounded-lg text-center cursor-pointer bg-slate-50" onclick="document.getElementById('matFile').click()">
              <div class="text-3xl mb-1">📤</div>
              <span id="fileNameLabel" class="text-xs text-gray-500 font-medium">Click para buscar archivo (PDF, Word, PPTX)</span>
              <input type="file" id="matFile" class="hidden" required onchange="document.getElementById('fileNameLabel').textContent=this.files[0]?.name||''"/>
            </div>

            <p class="text-[10px] text-gray-400 mt-1">⚠️ Tamaño máximo permitido: 1 MB</p>
          </div>

          <button type="submit" class="w-full btn-primary py-2.5 rounded-lg text-sm font-medium text-white shadow-sm">
            Publicar Recurso
          </button>
        </form>
      </div>

      <div class="md:col-span-2 space-y-4">
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Filtrar Materiales por Curso</label>
          <select id="matFiltroCurso" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
            <option value="">Todos mis cursos</option>
            ${cacheCursos.map(c => `<option value="${c.idCurso}">${c.nombreCurso}</option>`).join('')}
          </select>
        </div>

        <div id="materialsList"></div>
      </div>
    </div>
  `;

  document.getElementById('matFiltroCurso').addEventListener('change', () => {
    const idCurso = document.getElementById('matFiltroCurso').value;
    renderMaterialsList(idCurso || null);
  });

  await renderMaterialsList();
}

async function renderMaterialsList(idCurso) {
  const list = await DocenteApi.materiales(idCurso || null);
  const container = document.getElementById('materialsList');

  if (!list.length) {
    container.innerHTML = '<div class="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-400 shadow-sm">No hay materiales publicados para esta selección.</div>';
    return;
  }

  container.innerHTML = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-3 text-xs font-bold uppercase">Título Recurso</th>
            <th class="px-6 py-3 text-xs font-bold uppercase">Curso</th>
            <th class="px-6 py-3 text-xs font-bold uppercase">Tipo</th>
            <th class="px-6 py-3 text-center text-xs font-bold uppercase">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
          ${list.map(m => {
            const curso = MOCK_DB.cursos.find(c => c.idCurso === m.idCurso);

            return `
              <tr class="hover:bg-gray-50 transition">
                <td class="px-6 py-3 font-medium text-gray-900">
                  <div class="flex items-center space-x-2">
                    <span class="text-xl">📄</span>
                    <span>${m.titulo}</span>
                  </div>
                </td>

                <td class="px-6 py-3 text-sm text-indigo-600 font-semibold">${curso ? curso.nombreCurso : m.asignatura}</td>

                <td class="px-6 py-3">
                  <span class="chip px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    ${m.tipoArchivo || 'PDF'}
                  </span>
                </td>

                <td class="px-6 py-3 text-center space-x-3">
                  <button onclick="downloadMaterial(${m.idMaterial}, '${m.titulo.replace(/'/g, "\\'")}')" class="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition">📥 Descargar</button>
                  <button onclick="deleteMaterial(${m.idMaterial})" class="text-xs font-bold text-rose-600 hover:text-rose-800 transition">🗑️ Remover</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

async function uploadMaterial(e) {
  e.preventDefault();

  const fileInput = document.getElementById('matFile');
  const file = fileInput.files[0];

  if (!file) {
    toast('⚠️ Debes seleccionar un archivo');
    return;
  }

  const MAX_SIZE_MB = 1;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  if (file.size > MAX_SIZE_BYTES) {
    toast(`❌ El archivo pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo permitido es ${MAX_SIZE_MB} MB.`);
    fileInput.value = '';
    document.getElementById('fileNameLabel').textContent = 'Click para buscar archivo (PDF, Word, PPTX)';
    return;
  }

  const fd = new FormData();
  fd.append('idCurso', document.getElementById('matCurso').value);
  fd.append('file', file);

  await DocenteApi.subirMaterial(fd);

  document.getElementById('formMat').reset();
  document.getElementById('fileNameLabel').textContent = 'Click para buscar archivo (PDF, Word, PPTX)';

  toast('✅ Documento publicado en el portal de alumnos');

  const filtroActivo = document.getElementById('matFiltroCurso')?.value;
  await renderMaterialsList(filtroActivo || null);
}

async function deleteMaterial(id) {
  if (confirm('¿Desea despublicar este archivo?')) {
    await DocenteApi.eliminarMaterial(id);
    toast('Recurso removido');
    await renderMaterialsList();
  }
}

function downloadMaterial(idMaterial, titulo) {
  const material = MOCK_DB.materiales.find(m => m.idMaterial === idMaterial);

  if (!material) {
    toast('❌ Archivo no encontrado');
    return;
  }

  if (material.contenido) {
    const byteString = atob(material.contenido.split(',')[1]);
    const mimeString = material.contenido.split(',')[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeString });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = material.titulo;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    toast('📥 Archivo descargado correctamente');
  } else {
    const nombreCurso = MOCK_DB.cursos.find(c => c.idCurso === material.idCurso)?.nombreCurso || 'General';

    const contenido = [
      `========================================`,
      `  SIGA - Sistema Integrado de Gestión Académica`,
      `========================================`,
      ``,
      `Recurso: ${titulo}`,
      `Curso: ${nombreCurso}`,
      `Tipo: ${material.tipoArchivo || 'PDF'}`,
      ``,
      `Este es un archivo de ejemplo precargado.`,
      `Los archivos que subas tú tendrán contenido real.`,
      ``,
      `========================================`
    ].join('\n');

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_')}.txt`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    toast('📥 Archivo de ejemplo descargado');
  }
}

async function renderDocenteStudents() {
  document.getElementById('pageTitle').textContent = 'Mis Alumnos y Contacto de Apoderados';

  const cursos = cacheCursos;

  document.getElementById('content').innerHTML = `
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
      <div>
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Filtrar por Curso</label>
        <select id="studCurso" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
          ${cursos.map(c => `<option value="${c.idCurso}">${c.nombreCurso}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="studentsList"></div>
  `;

  document.getElementById('studCurso').addEventListener('change', renderStudentsListTable);

  agregarBuscadorNombre('studentsList', 'buscarAlumnoDocente', '🔍 Buscar alumno por nombre...', true);

  await renderStudentsListTable();
}

async function renderStudentsListTable() {
  const idCurso = document.getElementById('studCurso').value;
  const alumnos = await DocenteApi.estudiantes(idCurso);

  document.getElementById('studentsList').innerHTML = alumnos.length
    ? `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-xs font-bold uppercase">Alumno</th>
              <th class="px-6 py-3 text-xs font-bold uppercase">RUT</th>
              <th class="px-6 py-3 text-xs font-bold uppercase">Apoderado Responsable</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            ${alumnos.map(a => `
              <tr>
                <td class="px-6 py-3 font-medium text-gray-900">${a.nombre}</td>
                <td class="px-6 py-3 text-sm text-gray-500">${a.rut}</td>
                <td class="px-6 py-3 text-sm text-gray-600">
                  <strong class="text-slate-800">${a.apoderadoNombre}</strong><br>
                  <span class="text-xs text-indigo-500 font-medium">${a.apoderadoCorreo}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
    : '<div class="text-center py-12 text-gray-400">Sin registros</div>';
}

// --- APODERADO RENDERS ---

async function renderApoderadoDashboard() {
  const d = await ApoderadoApi.dashboard();

  document.getElementById('pageTitle').textContent = `Portal del Apoderado — Alumno: ${d.nombrePupilo}`;
  document.getElementById('pageSubtitle').textContent = `Curso actual: ${d.curso} · Rendimiento Promedio: ${d.promedio}`;

  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      ${statCard('👨‍🎓', 'Pupilo Matriculado', d.nombrePupilo, 'bg-blue-500')}
      ${statCard('🏫', 'Curso Asignado', d.curso, 'bg-purple-500')}
      ${statCard('📈', 'Promedio General', d.promedio, 'bg-orange-500')}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 class="font-bold text-gray-900 mb-4 flex items-center space-x-2"><span>✅</span> Resumen Asistencia</h3>
        <div id="apoderadoAttWidget"></div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 class="font-bold text-gray-900 mb-4 flex items-center space-x-2"><span>📝</span> Últimas Calificaciones</h3>
        <div id="apoderadoGradesWidget"></div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 class="font-bold text-gray-900 mb-4 flex items-center space-x-2"><span>📋</span> Últimas Observaciones</h3>
        <div id="apoderadoAnWidget"></div>
      </div>
    </div>
  `;

  const att = await ApoderadoApi.asistencia();

  document.getElementById('apoderadoAttWidget').innerHTML = `<div class="space-y-2"> ${att.slice(0, 6).map(a => {
  const colorMap = {
    'PRESENTE': 'bg-emerald-50 border-emerald-200 text-emerald-700',
    'AUSENTE': 'bg-rose-50 border-rose-200 text-rose-700',
    'TARDANZA': 'bg-amber-50 border-amber-200 text-amber-700'
  };
  const colorClass = colorMap[a.estado] || 'bg-gray-50 border-gray-200 text-gray-500';
  const iconMap = { 'PRESENTE': '✅', 'AUSENTE': '❌', 'TARDANZA': '⏰' };
  const icon = iconMap[a.estado] || '❔';

  let detalle = '';
  if (a.estado === 'TARDANZA') {
    detalle += a.horaLlegada ? '<br><span class="text-xs text-amber-600">🕐 Llegó: ' + a.horaLlegada + '</span>' : '';
    detalle += a.observacion ? '<br><span class="text-xs text-amber-600">📝 ' + a.observacion + '</span>' : '';
  }
  if (a.estado === 'AUSENTE' && a.observacion) {
    detalle += '<br><span class="text-xs text-rose-600">📝 ' + a.observacion + '</span>';
  }

  let justHtml = '';
  const just = a.justificacion || null;
  if (just) {
    const jColor = just.estadoJustificacion === 'APROBADA' ? 'text-emerald-600' : just.estadoJustificacion === 'RECHAZADA' ? 'text-rose-600' : 'text-yellow-600';
    justHtml = '<br><span class="text-xs ' + jColor + '">📋 Justificación: ' + just.estadoJustificacion + (just.motivo ? ' — ' + just.motivo : '') + '</span>';
  }

  return '<div class="p-2 rounded-lg border ' + colorClass + '">' +
    '<div class="flex justify-between items-center text-sm">' +
      ' <span class= "font-medium " >' + icon + ' ' + fechaES(a.fecha) + ' </span >' +
      '<span class="text-xs font-bold">' + a.estado + '</span>' +
    '</div>' +
    detalle + justHtml +
  '</div>';
}).join('')}
</div>`;

  const grades = await ApoderadoApi.calificaciones();

  document.getElementById('apoderadoGradesWidget').innerHTML = grades.length
    ? `
      <div class="space-y-2">
        ${grades.slice(0, 4).map(g => {
          const n = parseFloat(g.nota);

          return `
            <div class="flex justify-between items-center text-sm p-2 bg-slate-50 border border-slate-100 rounded-lg">
              <span class="font-medium text-gray-700">${g.nombreCurso || g.asignatura || 'S/D'}</span>
              <span class="chip px-2 py-0.5 rounded text-xs font-bold ${n >= 4 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${n.toFixed(1)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '<p class="text-sm text-gray-400 italic py-4">Sin calificaciones recientes.</p>';

  const an = await ApoderadoApi.anotaciones();

  document.getElementById('apoderadoAnWidget').innerHTML = an.length
    ? `
      <div class="space-y-2">
        ${an.slice(0, 3).map(a =>
          `<div class="p-3 rounded-lg border text-xs ${(a.tipoAnotacion || a.tipo) === 'POSITIVA' ? 'bg-emerald-50/50 border-emerald-100 text-slate-700' : 'bg-rose-50/50 border-rose-100 text-slate-700'}">
            <div class="flex justify-between font-bold mb-1">
              <span>Anotación ${a.tipoAnotacion || a.tipo}</span>
              <span>${a.fechaRegistro}</span>
            </div>

            <p class="text-gray-600">${a.detalles || a.observacion}</p>
          </div>`
        ).join('')}
      </div>
    `
    : '<div class="text-sm text-gray-400 italic py-4">Sin anotaciones registradas en el período.</div>';
      // Feature 21: Panel proactivo
  await renderApoderadoProactivo();
  // Feature 9: Campana
  await renderNotificationBell();
}

// ════════════════════════════════════════════════════════
//  FEATURE 21: PANEL DE APODERADO PROACTIVO
// ════════════════════════════════════════════════════════

async function renderApoderadoProactivo() {
  // Esta función se llama DESPUÉS del dashboard principal del apoderado
  // Agrega tarjetas proactivas al contenido existente

  const content = document.getElementById('content');
  if (!content) return;

  let stats, asistHoy, notificaciones;
  try {
    stats = await ApoderadoApi.estadisticasAsistencia();
    asistHoy = await ApoderadoApi.asistenciaHoy();
    notificaciones = await ApoderadoApi.notificaciones();
  } catch (e) {
    return;
  }

  const noLeidas = notificaciones.filter(n => !n.leida);

  // Estado hoy
  let estadoHoyHTML = '';
  if (asistHoy.length > 0) {
    estadoHoyHTML = asistHoy.map(r => {
      const iconoEstado = r.estado === 'PRESENTE' ? '✅' : r.estado === 'AUSENTE' ? '❌' : r.estado === 'TARDANZA' ? '⏰' : '📋';
      const colorEstado = r.estado === 'PRESENTE' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : r.estado === 'AUSENTE' ? 'text-red-600 bg-red-50 border-red-200' : 'text-amber-600 bg-amber-50 border-amber-200';
      return `
        <div class="flex items-center justify-between p-2 rounded-lg border ${colorEstado}">
          <div class="flex items-center gap-2">
            <span>${iconoEstado}</span>
            <span class="text-xs font-semibold">${escapeHtml(r.nombreCurso)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold">${r.estado}</span>
            ${r.horaRegistro ? `<span class="text-[10px] text-gray-500">${r.horaRegistro}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } else {
    estadoHoyHTML = '<div class="text-center py-3 text-gray-400 text-xs">Sin registros de hoy aún</div>';
  }

  const proactivoHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <!-- Estado de hoy -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 class="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">📋 Asistencia de Hoy</h3>
        <div class="space-y-2">${estadoHoyHTML}</div>
      </div>

      <!-- Estadísticas del mes -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 class="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">📊 Estadísticas del Mes</h3>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-emerald-700">${stats.presentesMes}</div>
            <div class="text-[10px] font-semibold text-emerald-600 uppercase">Presentes</div>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-red-700">${stats.ausentesMes}</div>
            <div class="text-[10px] font-semibold text-red-600 uppercase">Ausentes</div>
          </div>
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-amber-700">${stats.tardanzasMes}</div>
            <div class="text-[10px] font-semibold text-amber-600 uppercase">Atrasos</div>
          </div>
          <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-indigo-700">${stats.pctMes}%</div>
            <div class="text-[10px] font-semibold text-indigo-600 uppercase">Asistencia</div>
          </div>
        </div>
        <div class="text-[10px] text-gray-500">
          Global: ${stats.pct}% asistencia | ${stats.total} registros totales
        </div>
      </div>

      <!-- Notificaciones recientes -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-5 md:col-span-2">
        <h3 class="font-bold text-gray-900 text-sm mb-3">🔔 Notificaciones Recientes</h3>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          ${noLeidas.length === 0
            ? '<div class="text-center py-3 text-gray-400 text-xs">Sin notificaciones nuevas</div>'
            : noLeidas.slice(0, 5).map(n => `
              <div class="flex gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                <span>${n.icono || '🔔'}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-gray-800 truncate">${escapeHtml(n.titulo)}</div>
                  <div class="text-[10px] text-gray-500 truncate">${escapeHtml(n.mensaje)}</div>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;

  content.insertAdjacentHTML('beforeend', proactivoHTML);
}

async function renderApoderadoAttendance() {
  document.getElementById('pageTitle').textContent = 'Registro Histórico de Asistencia';

  const list = await ApoderadoApi.asistencia();


  // Calcular estadísticas
  const totalRegistros = list.length;
  const presentes = list.filter(a => a.estado === 'PRESENTE').length;
  const tardanzas = list.filter(a => a.estado === 'TARDANZA').length;
  const ausentes = list.filter(a => a.estado === 'AUSENTE').length;
  const porcentajeAsis = totalRegistros > 0 ? (((presentes + tardanzas) / totalRegistros) * 100).toFixed(1) : 0;

  let html = `
  <!-- RESUMEN ESTADÍSTICO -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
      <div class="text-2xl font-bold text-indigo-600">${totalRegistros}</div>
      <div class="text-xs text-gray-500 uppercase font-semibold mt-1">Total Días</div>
    </div>
    <div class="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm text-center">
      <div class="text-2xl font-bold text-emerald-600">${presentes}</div>
      <div class="text-xs text-gray-500 uppercase font-semibold mt-1">Presente</div>
    </div>
    <div class="bg-white rounded-xl border border-amber-200 p-4 shadow-sm text-center">
      <div class="text-2xl font-bold text-amber-600">${tardanzas}</div>
      <div class="text-xs text-gray-500 uppercase font-semibold mt-1">Tardanzas</div>
    </div>
    <div class="bg-white rounded-xl border border-rose-200 p-4 shadow-sm text-center">
      <div class="text-2xl font-bold text-rose-600">${ausentes}</div>
      <div class="text-xs text-gray-500 uppercase font-semibold mt-1">Ausentes</div>
    </div>
  </div>

  <!-- BARRA DE ASISTENCIA -->
  <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-6">
    <div class="flex justify-between items-center mb-2">
      <span class="text-sm font-bold text-gray-700">Porcentaje de Asistencia</span>
      <span class="text-sm font-bold ${parseFloat(porcentajeAsis) >= 85 ? 'text-emerald-600' : 'text-rose-600'}">${porcentajeAsis}%</span>
    </div>
    <div class="w-full bg-gray-200 rounded-full h-3">
      <div class="h-3 rounded-full transition-all ${parseFloat(porcentajeAsis) >= 85 ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${porcentajeAsis}%"></div>
    </div>
  </div>

  <!-- TABLA DETALLE -->
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
    <div class="overflow-x-auto">
    <table class="w-full text-left">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Fecha</th>
          <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Estado</th>
          <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Estado Just.</th>          
          <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Justificación</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">`;

  if (!list || !list.length) {
    html += `
        <tr>
          <td colspan="4" class="px-6 py-12 text-center text-gray-400 italic">
            No existen registros de asistencia en este período.
          </td>
        </tr>`;
        
  } else {
    list.forEach(a => {
      const just = a.justificacion || null;

      const estadoColor = {
        'PRESENTE': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'TARDANZA': 'bg-amber-100 text-amber-700 border-amber-200',
        'AUSENTE':  'bg-rose-100 text-rose-700 border-rose-200'
      };
      const estadoIcon = { 'PRESENTE': '✅', 'TARDANZA': '⏰', 'AUSENTE': '❌' };
      const color = estadoColor[a.estado] || 'bg-gray-100 text-gray-600 border-gray-200';
      const icon = estadoIcon[a.estado] || '❔';

      let justColor = 'bg-gray-50 text-gray-400 border-gray-200';
      let justText = 'N/A';
      if (just) {
        if (just.estadoJustificacion === 'APROBADA') {
          justColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (just.estadoJustificacion === 'RECHAZADA') {
          justColor = 'bg-rose-50 text-rose-700 border-rose-200';
        } else {
          justColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
        }
        justText = just.estadoJustificacion;
      }

      html += `
        <tr class="hover:bg-gray-50 transition">
          <td class="px-6 py-3 text-sm font-medium text-gray-800">${fechaES(a.fecha)}</td>
          <td class="px-6 py-3">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${color}">
              ${icon} ${a.estado}
            </span>
          </td>
          <td class="px-6 py-3">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${justColor}">
              ${justText}
            </span>
          </td>
          <td class="px-6 py-3 text-sm text-gray-600">
            ${just && just.motivo ? just.motivo : '<span class="text-gray-400 italic">—</span>'}
          </td>
        </tr>`;
    });
  }

  html += `
      </tbody>
    </table>
    </div>
  </div>`;

  document.getElementById('content').innerHTML = html;
}

async function renderApoderadoGrades() {
  document.getElementById('pageTitle').textContent = 'Calificaciones del Estudiante';
  document.getElementById('pageSubtitle').textContent = 'Notas agrupadas por asignatura';

  const list = await ApoderadoApi.calificaciones();

  if (!list || !list.length) {
    document.getElementById('content').innerHTML = '<div class="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200 shadow-sm">No hay calificaciones registradas para este estudiante.</div>';
    return;
  }

  const grupos = {};

  list.forEach(g => {
    const key = g.nombreCurso || g.asignatura || 'Sin asignatura';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(g);
  });

  const asignaturasOrdenadas = Object.keys(grupos).sort();

  let html = '';

  asignaturasOrdenadas.forEach(nombreAsignatura => {
    const notas = grupos[nombreAsignatura];
    const promedio = calcularPromedioFinal(notas) || 0;
    const colorProm = promedio >= 4.0 ? 'text-emerald-700' : 'text-rose-700';
    const bgProm = promedio >= 4.0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200';

    html += `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-6 fade-in">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xl font-bold">
              📚
            </div>

            <div>
              <h3 class="font-bold text-gray-900 text-base">${nombreAsignatura}</h3>
              <p class="text-xs text-gray-500">${notas.length} ${notas.length === 1 ? 'Evaluación' : 'Evaluaciones'}</p>
            </div>
          </div>

          <div class="text-right">
            <div class="text-xs text-gray-500 uppercase font-bold mb-1">Promedio</div>
            <div class="px-3 py-1.5 rounded-lg border ${bgProm} ${colorProm} text-lg font-bold">
              ${promedio.toFixed(1)}
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Evaluación</th>
                <th class="px-6 py-3 text-xs font-bold uppercase text-gray-500">Fecha</th>
                <th class="px-6 py-3 text-center text-xs font-bold uppercase text-gray-500">Nota</th>
                <th class="px-6 py-3 text-center text-xs font-bold uppercase text-gray-500">Estado</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-gray-100">
              ${notas.map(g => {
                const notaNum = parseFloat(g.nota);
                const coef = parseInt(g.coeficiente) === 2 ? 2 : 1;
                const colorNota = notaNum >= 4.0 ? 'text-emerald-600' : 'text-rose-600';
                const bgNota = notaNum >= 4.0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';
                const estado = notaNum >= 4.0 ? 'Aprobado' : 'Reprobado';
                const iconEstado = notaNum >= 4.0 ? '✅' : '❌';
                const colorEstado = notaNum >= 4.0 ? 'text-emerald-700' : 'text-rose-700';

                return `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-3">
                      <div class="font-medium text-gray-900">${g.descripcion || g.tipoEvaluacion || 'Sin descripción'}</div>
                    </td>

                    <td class="px-6 py-3 text-sm text-gray-500">${fechaES(g.fechaNota || g.fechaRegistro) || 'Sin fecha'}</td>

                    <td class="px-6 py-3 text-center">
                      <span class="inline-block px-3 py-1 rounded-lg border ${bgNota} ${colorNota} text-base font-bold">
                        ${notaNum.toFixed(1)}
                      </span>
                    </td>

                    <td class="px-6 py-3 text-center">
                      <span class="text-xs font-bold ${colorEstado}">
                        ${iconEstado} ${estado}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  const promedioGeneral = calcularPromedioFinal(list) || 0;
  const colorPromGen = promedioGeneral >= 4.0 ? 'text-emerald-700' : 'text-rose-700';

  html += `
    <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 shadow-sm mt-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-white text-indigo-700 flex items-center justify-center text-2xl font-bold shadow-sm">
            📊
          </div>

          <div>
            <h4 class="font-bold text-gray-900 text-base">Resumen General</h4>
            <p class="text-xs text-gray-600">${list.length} evaluaciones en ${asignaturasOrdenadas.length} asignaturas</p>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs text-gray-600 uppercase font-bold mb-1">Promedio General</div>
          <div class="text-3xl font-bold ${colorPromGen}">
            ${promedioGeneral.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('content').innerHTML = html;
}

async function renderApoderadoAnotaciones() {
  document.getElementById('pageTitle').textContent = 'Hoja de Vida Digital del Alumno';

  const list = await ApoderadoApi.anotaciones();

  if (!list || !list.length) {
    document.getElementById('content').innerHTML = '<div class="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400 shadow-sm">No existen anotaciones ni observaciones en este año escolar</div>';
    return;
  }

  document.getElementById('content').innerHTML = `
    <div class="space-y-3">
      ${list.map(a => {
        const isPos = (a.tipoAnotacion || a.tipo || '').toUpperCase() === 'POSITIVA';

        return `
          <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center space-x-2 mb-1.5">
                <span class="chip px-2 py-0.5 rounded text-xs font-bold border ${isPos ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}">
                  Anotación ${a.tipoAnotacion || a.tipo}
                </span>

                <span class="text-xs text-gray-400">${fechaES(a.fechaRegistro)}</span>
              </div>

              <p class="text-sm text-slate-700 font-medium">${a.detalles || a.observacion}</p>
            </div>

            <div class="text-xs font-medium text-gray-500 bg-slate-50 border px-3 py-1.5 rounded-lg self-start md:self-auto">
              Registrado por: ${a.nombreDocente}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderApoderadoMaterials() {
  document.getElementById('pageTitle').textContent = 'Material de Estudio Disponible';

  const mats = await ApoderadoApi.materiales();

  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${mats.map(m =>
        `<div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col hover:border-indigo-400 transition">
          <div class="text-3xl mb-3">📄</div>
          <h4 class="font-bold text-sm text-gray-900">${m.titulo}</h4>
           <p class="text-xs text-gray-500 mt-1 mb-4 flex-1 font-semibold text-indigo-600">${escapeHtml(m.asignatura || m.nombreCurso || 'Material del curso')}</p>

          <button onclick="downloadMaterialApoderado(${m.idMaterial}, '${m.titulo.replace(/'/g, "\\'")}')"
                  class="text-xs font-bold uppercase text-indigo-600 border-b border-indigo-600 hover:text-indigo-800 pb-0.5 self-start transition cursor-pointer bg-transparent border-0 p-0">
            Descargar Archivo
          </button>
        </div>`
      ).join('')}
    </div>
  `;
}

function downloadMaterialApoderado(idMaterial, titulo) {
  const material = MOCK_DB.materiales.find(m => m.idMaterial === idMaterial);

  if (!material) {
    toast('❌ Archivo no encontrado');
    return;
  }

  if (material.contenido) {
    const byteString = atob(material.contenido.split(',')[1]);
    const mimeString = material.contenido.split(',')[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeString });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = material.titulo;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    toast('📥 Archivo descargado correctamente');
  } else {
    const nombreCurso = MOCK_DB.cursos.find(c => c.idCurso === material.idCurso)?.nombreCurso || 'General';

    const contenido = [
      `========================================`,
      `  SIGA - Sistema Integrado de Gestión Académica`,
      `========================================`,
      ``,
      `Recurso: ${titulo}`,
      `Curso: ${nombreCurso}`,
      `Tipo: ${material.tipoArchivo || 'PDF'}`,
      ``,
      `Este es un archivo de ejemplo precargado.`,
      `Los archivos que suba el profesor tendrán contenido real.`,
      ``,
      `========================================`
    ].join('\n');

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_')}.txt`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    toast('📥 Archivo de ejemplo descargado');
  }
}

// ==========================================
// EXPORTAR DATOS A EXCEL (DOCENTE)
// ==========================================
function formatearFechaHoraChile(fecha) {
  if (!fecha) return '';

  try {
    const date = new Date(fecha);

    if (isNaN(date.getTime())) {
      return fecha;
    }

    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date).replace(',', '');
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return fecha;
  }
}

async function exportarExcelDocente(origen) {
  try {
    const selectId = origen === 'asistencia' ? 'attCurso' : 'gradeCurso';
    const idCursoStr = document.getElementById(selectId).value;

    if (!idCursoStr) {
      toast('⚠️ Por favor, seleccione un curso en específico para exportar');
      return;
    }

    const idCurso = parseInt(idCursoStr);
    const cursoInfo = cacheCursos.find(c => c.idCurso === idCurso);
    const nombreCurso = cursoInfo ? cursoInfo.nombreCurso : 'Curso';

    const estudiantes = await DocenteApi.estudiantes(idCurso);

    const wb = XLSX.utils.book_new();
    let nombreArchivo = '';

    if (origen === 'asistencia') {
      const asistenciaHistorica = await DocenteApi.asistenciaHistorica(idCurso);

      const asistenciaData = asistenciaHistorica.map(a => {
        const est = estudiantes.find(e => e.idEstudiante === a.idEstudiante);
        const just = a.justificacion || null;

        return {
          Alumno: est ? est.nombre : 'Desconocido',
          RUT: est ? est.rut : 'Sin RUT',
          Curso: nombreCurso,
          Fecha: a.fecha,
          'Profesor registro inicial': a.profesorResponsable || a.creadoPor || '',
          Estado: a.estado,
          'Motivo justificación': just?.motivo || '',
          'Estado justificación': just?.estadoJustificacion || '',
          'Observación justificación': just?.observacion || '',
          'Observación asistencia': a.observacion || '',
          'Creado el': formatearFechaHoraChile(a.creadoEl),
          'Modificado el': formatearFechaHoraChile(a.modificadoEl),
          'Modificado por': a.modificadoPor || ''
        };
      });

      if (asistenciaData.length > 0) {
        const wsAsistencia = XLSX.utils.json_to_sheet(asistenciaData);
        XLSX.utils.book_append_sheet(wb, wsAsistencia, 'Asistencia');
      } else {
        const wsAsistencia = XLSX.utils.aoa_to_sheet([['Sin registros de asistencia para este curso']]);
        XLSX.utils.book_append_sheet(wb, wsAsistencia, 'Asistencia');
      }

      nombreArchivo = `${nombreCurso.replace(/[^a-z0-9]/gi, '_')}_Asistencia_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    else if (origen === 'notas') {
      const calificaciones = await DocenteApi.calificaciones(idCurso);

      const notasData = calificaciones.map(n => ({
        Estudiante: n.nombreEstudiante,
        RUT: estudiantes.find(e => e.idEstudiante === n.idEstudiante)?.rut || '',
        Asignatura: n.asignatura || n.nombreCurso,
        Evaluación: n.descripcion || n.tipoEvaluacion,
        Nota: parseFloat(n.nota),
        Fecha: n.fechaNota || n.fechaRegistro
      }));

      if (notasData.length > 0) {
        const wsNotas = XLSX.utils.json_to_sheet(notasData);
        XLSX.utils.book_append_sheet(wb, wsNotas, 'Calificaciones');
      } else {
        const wsNotas = XLSX.utils.aoa_to_sheet([['Sin calificaciones registradas para este curso']]);
        XLSX.utils.book_append_sheet(wb, wsNotas, 'Calificaciones');
      }

      nombreArchivo = `${nombreCurso.replace(/[^a-z0-9]/gi, '_')}_Notas_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    XLSX.writeFile(wb, nombreArchivo);
    toast(`✅ Excel de ${origen} descargado exitosamente`);
  } catch (error) {
    console.error('Error al exportar:', error);
    toast('❌ Error al exportar datos. Revisa la consola.');
  }
}

// ==========================================
// MODALES DE EDICIÓN Y ELIMINACIÓN (ADMIN)
// ==========================================

async function openEditStudentModal(idEstudiante) {
  const estudiante = MOCK_DB.estudiantes.find(e => e.idEstudiante === idEstudiante);
  if (!estudiante) return;

  const m = document.getElementById('modal');

  cursosModalEstudiante = MOCK_DB.cursos || [];

  // IDs actuales del alumno (con respaldo por nombre para datos antiguos)
  const idsActuales = (Array.isArray(estudiante.cursosIds) && estudiante.cursosIds.length)
    ? estudiante.cursosIds.map(Number)
    : cursosModalEstudiante
        .filter(c => (estudiante.cursosAsignados || []).includes(c.nombreCurso))
        .map(c => Number(c.idCurso));

  selectedCursosEstudianteSet = new Set(idsActuales);

  const niveles = nivelesDeCursosEstudiante(cursosModalEstudiante);
  const primerCurso = cursosModalEstudiante.find(c => selectedCursosEstudianteSet.has(Number(c.idCurso)));

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Editar Alumno</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
    </div>
    <form id="formEditStudent" onsubmit="saveEditedStudent(event, ${idEstudiante})" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
        <input type="text" id="editEstNombre" required value="${escapeHtml(estudiante.nombre || '')}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">RUT</label>
        <input type="text" id="editEstRut" required value="${escapeHtml(estudiante.rut || '')}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cursos Asignados</label>
        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">1) Curso (nivel)</label>
            <select id="editEstNivel" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    onchange="actualizarMateriasEstudiante('editEstNivel', 'editEstMaterias', 'editEstCursos', 'editEstChips')">
              <option value="">Seleccione un curso...</option>
              ${niveles.map(n => `
                <option value="${escapeHtml(n)}" ${primerCurso && (primerCurso.nivel || primerCurso.nombreCurso) === n ? 'selected' : ''}>
                  ${escapeHtml(n)}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">2) Materias del curso</label>
            <div id="editEstMaterias" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-slate-50/50">
              <p class="text-xs text-gray-400 p-2">Selecciona primero un curso.</p>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">Materias seleccionadas</label>
            <div id="editEstChips" class="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-slate-50/50 min-h-[42px]">
              <span class="text-xs text-gray-400 italic">Sin materias seleccionadas.</span>
            </div>
            <p class="text-[10px] text-gray-400 mt-1">La primera materia (por orden de curso) se tomará como curso principal.</p>
          </div>
        </div>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm text-white font-medium">Actualizar Alumno</button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');

  // Dibuja las materias del nivel preseleccionado y los chips de lo que ya tiene
  actualizarMateriasEstudiante('editEstNivel', 'editEstMaterias', 'editEstCursos', 'editEstChips');
}

async function saveEditedStudent(e, idEstudiante) {
  e.preventDefault();

  sincronizarSeleccionEstudiante('editEstMaterias', 'editEstCursos');
  const nuevosCursosIds = Array.from(selectedCursosEstudianteSet).map(Number);

  const cursosSeleccionados = cursosModalEstudiante
    .filter(c => nuevosCursosIds.includes(Number(c.idCurso)))
    .sort((a, b) =>
      String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es', { numeric: true }) ||
      String(a.asignatura || a.nombreCurso || '').localeCompare(String(b.asignatura || b.nombreCurso || ''), 'es')
    );

  let nombreCursoPrincipal = '';
  let cursoPrincipalStr = '';
  if (cursosSeleccionados.length > 0) {
    nombreCursoPrincipal = cursosSeleccionados[0].nombreCurso;
    cursoPrincipalStr = cursosSeleccionados[0].nivel;
  }

  await AdminApi.editarEstudiante(idEstudiante, {
    nombre: document.getElementById('editEstNombre').value,
    rut: document.getElementById('editEstRut').value,
    nombreCurso: nombreCursoPrincipal,
    curso: cursoPrincipalStr,
    cursosAsignados: nuevosCursosIds
  });

  closeModal();
  toast('✅ Alumno actualizado');
  await renderAdminEstudiantes();
}

async function deleteStudent(idEstudiante) {
  if (confirm('¿Seguro que desea dar de baja a este alumno?')) {
    await AdminApi.eliminarEstudiante(idEstudiante);
    toast('🗑️ Alumno eliminado del sistema');
    await renderAdminEstudiantes();
  }
}

// ════════════════════════════════════════════════════════
//  SELECTOR DE CURSOS POR NIVEL PARA DOCENTES
// ════════════════════════════════════════════════════════
let cursosModalDocente = [];
let selectedCursosDocenteSet = new Set();

// ════════════════════════════════════════════════════════
//  CONTROL DE MATERIAS OCUPADAS POR DOCENTE
// ════════════════════════════════════════════════════════
let docenteModalActualIdentificador = null;
let cursosOriginalesDocenteSet = new Set();
let cursosOcupadosDocenteMap = new Map();

async function construirCursosOcupadosDocentes(exceptoIdentificador = null, exceptoCursosSet = new Set()) {
  try {
    await AdminApi.obtenerDocentes();
  } catch (_) {}

  const mapa = new Map();
  const docentes = (MOCK_DB.users || []).filter(u => u.rol === 'DOCENTE');

  const marcarOcupado = (idCurso, ocupante) => {
    const id = Number(idCurso);
    if (!id) return;

    // Si el curso ya pertenece al docente que estamos editando, no lo marcamos como bloqueado.
    if (exceptoCursosSet.has(id)) return;

    if (
      exceptoIdentificador &&
      ocupante?.identificador &&
      String(ocupante.identificador).toLowerCase() === String(exceptoIdentificador).toLowerCase()
    ) {
      return;
    }

    if (!mapa.has(id)) {
      mapa.set(id, ocupante);
    }
  };

  // 1) Cursos asignados oficialmente en docentes_cursos
  docentes.forEach(d => {
    (d.cursosAsignados || []).forEach(idCurso => {
      marcarOcupado(idCurso, d);
    });
  });

  // 2) Cursos que tengan profesor_asignado / profesor_bloque1 / profesor_bloque2
  (cursosModalDocente || []).forEach(c => {
    const emailProfesor = c.profesorAsignado || c.profesorBloque1 || c.profesorBloque2;
    if (!emailProfesor) return;

    const usuario = (MOCK_DB.users || []).find(
      u => String(u.identificador || '').toLowerCase() === String(emailProfesor).toLowerCase()
    );

    marcarOcupado(
      c.idCurso,
      usuario || {
        nombre: emailProfesor,
        identificador: emailProfesor,
        cursosAsignados: []
      }
    );
  });

  cursosOcupadosDocenteMap = mapa;
  return mapa;
}

function obtenerOcupanteCursoDocente(idCurso) {
  return cursosOcupadosDocenteMap.get(Number(idCurso)) || null;
}

function validarCursosSeleccionadosDocente(cursosAsignados) {
  for (const idCurso of cursosAsignados) {
    const ocupante = obtenerOcupanteCursoDocente(idCurso);

    if (ocupante) {
      const curso = cursosModalDocente.find(c => Number(c.idCurso) === Number(idCurso));
      const nombreCurso = curso
        ? (curso.asignatura || curso.nombreCurso || `Curso ID ${idCurso}`)
        : `Curso ID ${idCurso}`;

      toast(`❌ ${nombreCurso} ya está asignado a ${ocupante.nombre}. No se puede asignar a otro docente.`);
      return false;
    }
  }

  return true;
}

function obtenerNivelesDocente(cursos) {
  return [...new Set((cursos || []).map(c => c.nivel || c.nombreCurso || 'Sin nivel'))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
}

function sincronizarSeleccionDocente(containerId, checkboxName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.querySelectorAll(`input[name="${checkboxName}"]`).forEach(cb => {
    const id = Number(cb.value);
    if (cb.checked) selectedCursosDocenteSet.add(id);
    else selectedCursosDocenteSet.delete(id);
  });
}

function renderChipsCursosDocente(chipContainerId) {
  const chipContainer = document.getElementById(chipContainerId);
  if (!chipContainer) return;

  const seleccionados = cursosModalDocente
    .filter(c => selectedCursosDocenteSet.has(Number(c.idCurso)))
    .sort((a, b) =>
      String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es', { numeric: true }) ||
      String(a.asignatura || a.nombreCurso || '').localeCompare(String(b.asignatura || b.nombreCurso || ''), 'es')
    );

  const faltantes = Array.from(selectedCursosDocenteSet).filter(
    id => !cursosModalDocente.some(c => Number(c.idCurso) === Number(id))
  );

  if (!seleccionados.length && !faltantes.length) {
    chipContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Sin cursos seleccionados.</span>';
    return;
  }

  let html = seleccionados.map(c => {
    const etiqueta = c.asignatura || c.nombreCurso || 'Sin asignatura';
    const nivel = c.nivel || '';
    return `
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
        ${escapeHtml(etiqueta)} · ${escapeHtml(nivel)}
      </span>
    `;
  }).join('');

  if (faltantes.length) {
    html += faltantes.map(id => `
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        Curso ID ${id}
      </span>
    `).join('');
  }

  chipContainer.innerHTML = html;
}

function actualizarMateriasDocente(selectNivelId, containerId, checkboxName, chipContainerId) {
  sincronizarSeleccionDocente(containerId, checkboxName);

  const select = document.getElementById(selectNivelId);
  const container = document.getElementById(containerId);

  if (!select || !container) return;

  const nivel = select.value;

  if (!nivel) {
    container.innerHTML = '<p class="text-xs text-gray-400 p-2">Selecciona primero un nivel (1° Básico, 2° Básico, etc.).</p>';
  } else {
    const materias = cursosModalDocente
      .filter(c => (c.nivel || c.nombreCurso || 'Sin nivel') === nivel)
      .sort((a, b) =>
        String(a.asignatura || a.nombreCurso || '').localeCompare(
          String(b.asignatura || b.nombreCurso || ''),
          'es',
          { numeric: true }
        )
      );

    if (!materias.length) {
      container.innerHTML = '<p class="text-xs text-gray-400 p-2">No hay asignaturas para este nivel.</p>';
    } else {
      container.innerHTML = materias.map(c => {
        const idCurso = Number(c.idCurso);
        const ocupante = obtenerOcupanteCursoDocente(idCurso);
        const ocupado = Boolean(ocupante);

        // Si está ocupado por otro docente, lo quitamos de la selección.
        if (ocupado) {
          selectedCursosDocenteSet.delete(idCurso);
        }

        const checked = !ocupado && selectedCursosDocenteSet.has(idCurso) ? 'checked' : '';
        const disabled = ocupado ? 'disabled' : '';

        const etiqueta = c.asignatura || c.nombreCurso || 'Sin asignatura';
        const detalle = c.nombreCurso && c.nombreCurso !== etiqueta
          ? c.nombreCurso
          : (c.nivel || '');

        const labelClass = ocupado
          ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200'
          : 'hover:bg-slate-50 cursor-pointer border-gray-100';

        const bloqueo = ocupado
          ? `
            <div class="text-[10px] text-rose-600 font-semibold mt-0.5">
              🔒 Asignado a ${escapeHtml(ocupante.nombre)} (${escapeHtml(ocupante.identificador)})
            </div>
          `
          : '';

        return `
          <label class="flex items-start gap-3 p-2.5 rounded-lg border transition ${labelClass}">
            <input type="checkbox"
                   name="${checkboxName}"
                   value="${c.idCurso}"
                   ${checked}
                   ${disabled}
                   class="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
            <span class="text-sm text-slate-700 font-medium">
              ${escapeHtml(etiqueta)}
              <span class="text-xs text-gray-400">(${escapeHtml(detalle)})</span>
              ${bloqueo}
            </span>
          </label>
        `;
      }).join('');
    }
  }

  if (chipContainerId) renderChipsCursosDocente(chipContainerId);
}

async function abrirModalCrearDocente() {
  const cursos = await AdminApi.obtenerCursos();
  cursosModalDocente = cursos || [];
  selectedCursosDocenteSet = new Set();
  
  docenteModalActualIdentificador = null;
  cursosOriginalesDocenteSet = new Set();
  
  await construirCursosOcupadosDocentes(null, cursosOriginalesDocenteSet);

  const niveles = obtenerNivelesDocente(cursosModalDocente);

  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');

  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="p-6">
      <div class="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
        <h3 class="text-lg font-bold text-slate-900">Registrar Nuevo Docente</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-2xl font-light">×</button>
      </div>

      <form id="formNuevoDocente" onsubmit="guardarNuevoDocente(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Nombre Completo</label>
          <input type="text"
                 id="regNombre"
                 required
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                 placeholder="Ej. Juan Carlos Pérez">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Correo Electrónico (Usuario de Acceso)</label>
          <input type="email"
                 id="regEmail"
                 required
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                 placeholder="ejemplo@upla.cl">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Contraseña de Ingreso</label>
          <input type="password"
                 id="regContrasena"
                 required
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                 placeholder="Establece una contraseña segura">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Asignación de Cursos existentes</label>

          <div class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">1) Nivel</label>
              <select id="nuevoDocenteNivel"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      onchange="actualizarMateriasDocente('nuevoDocenteNivel', 'nuevoDocenteMaterias', 'cursosSeleccionados', 'nuevoDocenteChips')">
                <option value="">Selecciona un nivel...</option>
                ${niveles.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">2) Materias / asignaturas del nivel</label>
              <div id="nuevoDocenteMaterias"
                   class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-slate-50/50 scrollbar">
                <p class="text-xs text-gray-400 p-2">Selecciona primero un nivel.</p>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">Cursos seleccionados</label>
              <div id="nuevoDocenteChips"
                   class="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-slate-50/50 min-h-[42px]">
                <span class="text-xs text-gray-400 italic">Sin cursos seleccionados.</span>
              </div>
              <p class="text-[10px] text-gray-400 mt-1">
                Para quitar un curso, selecciona su nivel y desmarca la materia.
              </p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
          <button type="button"
                  onclick="closeModal()"
                  class="px-4 py-2 border border-gray-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button type="submit"
                  class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition">
            Guardar y Habilitar
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');

  actualizarMateriasDocente(
    'nuevoDocenteNivel',
    'nuevoDocenteMaterias',
    'cursosSeleccionados',
    'nuevoDocenteChips'
  );
}

async function guardarNuevoDocente(event) {
  event.preventDefault();

  const nombre = document.getElementById('regNombre').value.trim();
  const identificador = document.getElementById('regEmail').value.trim();
  const contrasena = document.getElementById('regContrasena').value;

  sincronizarSeleccionDocente('nuevoDocenteMaterias', 'cursosSeleccionados');

  docenteModalActualIdentificador = null;
  cursosOriginalesDocenteSet = new Set();
  
  await construirCursosOcupadosDocentes(null, cursosOriginalesDocenteSet);
  
  const cursosAsignados = Array.from(selectedCursosDocenteSet);
  
  if (!validarCursosSeleccionadosDocente(cursosAsignados)) {
    actualizarMateriasDocente(
      'nuevoDocenteNivel',
      'nuevoDocenteMaterias',
      'cursosSeleccionados',
      'nuevoDocenteChips'
    );
    return;
  }

  try {
    await AdminApi.agregarDocente({
      nombre,
      identificador,
      contrasena,
      cursosAsignados
    });

    closeModal();
    toast('Docente guardado y habilitado correctamente');
    await renderAdminDocentes();
  } catch (error) {
    toast(error.message || 'Error al intentar registrar al docente');
  }
}

async function openEditDocenteModal(identificador) {
  const docente = MOCK_DB.users.find(u => u.rol === 'DOCENTE' && u.identificador === identificador);
  if (!docente) return;

  const cursos = await AdminApi.obtenerCursos();
  cursosModalDocente = cursos || [];
  
  docenteModalActualIdentificador = identificador;
  cursosOriginalesDocenteSet = new Set((docente.cursosAsignados || []).map(Number));
  
  await construirCursosOcupadosDocentes(identificador, cursosOriginalesDocenteSet);
  
  selectedCursosDocenteSet = new Set(cursosOriginalesDocenteSet);

  const niveles = obtenerNivelesDocente(cursosModalDocente);

  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Editar Docente</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
    </div>

    <form onsubmit="saveEditedDocente(event, '${identificador}')" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
        <input type="text"
               id="editDocNombre"
               required
               value="${escapeHtml(docente.nombre || '')}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico (Usuario de Acceso)</label>
        <input type="email"
               id="editDocCorreo"
               required
               value="${escapeHtml(docente.identificador || '')}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña de Ingreso</label>
        <input type="text"
               id="editDocContrasena"
               value=""
               placeholder="Dejar en blanco para NO cambiarla"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
        <p class="text-xs text-gray-400 mt-1">
          Si escribes una clave nueva se actualizará; en blanco se conserva la actual.
        </p>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cursos Asignados</label>

        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">1) Nivel</label>
            <select id="editDocenteNivel"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    onchange="actualizarMateriasDocente('editDocenteNivel', 'editDocenteMaterias', 'editDocCursos', 'editDocenteChips')">
              <option value="">Selecciona un nivel...</option>
              ${niveles.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">2) Materias / asignaturas del nivel</label>
            <div id="editDocenteMaterias"
                 class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-slate-50/50 scrollbar">
              <p class="text-xs text-gray-400 p-2">Selecciona primero un nivel.</p>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">Cursos seleccionados</label>
            <div id="editDocenteChips"
                 class="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-slate-50/50 min-h-[42px]">
              <span class="text-xs text-gray-400 italic">Sin cursos seleccionados.</span>
            </div>
            <p class="text-[10px] text-gray-400 mt-1">
              Para quitar un curso, selecciona su nivel y desmarca la materia.
            </p>
          </div>
        </div>
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button"
                onclick="closeModal()"
                class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit"
                class="px-4 py-2 btn-primary rounded-lg text-sm text-white font-medium">
          Actualizar Docente
        </button>
      </div>
    </form>
  `;

  const primerCursoSeleccionado = cursosModalDocente.find(c =>
    selectedCursosDocenteSet.has(Number(c.idCurso))
  );

  if (primerCursoSeleccionado) {
    const selectorNivel = document.getElementById('editDocenteNivel');
    if (selectorNivel) {
      selectorNivel.value = primerCursoSeleccionado.nivel || primerCursoSeleccionado.nombreCurso || 'Sin nivel';
    }
  }

  m.classList.remove('hidden');

  actualizarMateriasDocente(
    'editDocenteNivel',
    'editDocenteMaterias',
    'editDocCursos',
    'editDocenteChips'
  );
}

async function saveEditedDocente(e, identificadorOriginal) {
  e.preventDefault();

  sincronizarSeleccionDocente('editDocenteMaterias', 'editDocCursos');

  docenteModalActualIdentificador = identificadorOriginal;
  
  await construirCursosOcupadosDocentes(identificadorOriginal, cursosOriginalesDocenteSet);
  
  const nuevosCursos = Array.from(selectedCursosDocenteSet);
  
  if (!validarCursosSeleccionadosDocente(nuevosCursos)) {
    actualizarMateriasDocente(
      'editDocenteNivel',
      'editDocenteMaterias',
      'editDocCursos',
      'editDocenteChips'
    );
    return;
  }

  const nuevoCorreo = document.getElementById('editDocCorreo').value.trim();
  const nuevaContrasena = document.getElementById('editDocContrasena').value.trim();

  if (
    nuevoCorreo !== identificadorOriginal &&
    MOCK_DB.users.find(u => u.identificador === nuevoCorreo)
  ) {
    toast('❌ Ya existe un usuario con ese correo');
    return;
  }

  try {
    await AdminApi.editarDocente(identificadorOriginal, {
      nombre: document.getElementById('editDocNombre').value.trim(),
      identificador: nuevoCorreo,
      contrasena: nuevaContrasena || null,
      cursosAsignados: nuevosCursos
    });

    closeModal();
    toast('✅ Docente actualizado');
    await renderAdminDocentes();
  } catch (err) {
    console.error('Error al actualizar docente:', err);
    toast('❌ ' + (err?.message || 'No fue posible actualizar el docente'));
  }
}

async function openEditApoderadoModal(identificador) {
  const apoderado = MOCK_DB.users.find(u => u.rol === 'APODERADO' && u.identificador === identificador);
  if (!apoderado) return;

  const m = document.getElementById('modal');

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-lg">Editar Apoderado</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">&times;</button>
    </div>

    <form onsubmit="saveEditedApoderado(event, '${identificador}')" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
        <input type="text" id="editApoNombre" required value="${apoderado.nombre}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico (Usuario de Acceso)</label>
        <input type="email" id="editApoCorreo" required value="${apoderado.identificador}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña de Ingreso</label>
          <input type="text" id="editApoContrasena" value="" placeholder="Dejar en blanco para NO cambiarla" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
          <p class="text-xs text-gray-400 mt-1">Si escribes una clave nueva se actualizará; en blanco se conserva la actual.</p>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Alumnos a Cargo</label>
        ${pupilosCheckboxHtml(MOCK_DB.estudiantes, (apoderado.pupilosIds && apoderado.pupilosIds.length) ? apoderado.pupilosIds : (apoderado.pupiloId ? [apoderado.pupiloId] : []), apoderado.identificador)}
      </div>

      <div class="pt-4 flex justify-end gap-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
        <button type="submit" class="px-4 py-2 btn-primary rounded-lg text-sm text-white font-medium">Actualizar Apoderado</button>
      </div>
    </form>
  `;

  m.classList.remove('hidden');
}

async function saveEditedApoderado(e, identificadorOriginal) {
  e.preventDefault();
  const nuevoCorreo = document.getElementById('editApoCorreo').value.trim();
  const nuevaContrasena = document.getElementById('editApoContrasena').value.trim();
  const pupilosIds = pupilosSeleccionados();
  if (!pupilosIds.length) { toast('❌ Selecciona al menos un alumno'); return; }
  if (nuevoCorreo !== identificadorOriginal && MOCK_DB.users.find(u => u.identificador === nuevoCorreo)) {
    toast('❌ Ya existe un usuario con ese correo');
    return;
  }
  try {
    await AdminApi.editarApoderado(identificadorOriginal, {
      nombre: document.getElementById('editApoNombre').value.trim(),
      identificador: nuevoCorreo,
      contrasena: nuevaContrasena || null,
      pupilosIds
    });
    closeModal();
    toast('✅ Apoderado actualizado');
    await renderAdminApoderados();
  } catch (err) {
    console.error('Error al actualizar apoderado:', err);
    toast('❌ ' + (err?.message || 'No fue posible actualizar al apoderado'));
  }
}

async function openModificarAsistenciaModal(idEstudiante, idCurso, fecha) {
    const estudiante = MOCK_DB.estudiantes.find(e => e.idEstudiante === idEstudiante);
    if (!estudiante) return;
    
    // Buscamos el registro actual directamente en la base de datos simulada
    const registroActual = (MOCK_DB.asistencia || []).find(a => Number(a.idEstudiante) === Number(idEstudiante) && a.fecha === fecha && (!idCurso || Number(a.idCurso) === Number(idCurso)))
      || MOCK_DB.asistencia.find(a => a.idEstudiante === idEstudiante && a.fecha === fecha);
    const estadoActual = registroActual?.estado || 'PRESENTE';
    const obsActual = registroActual?.observacion || '';

    const m = document.getElementById('modal');
    document.getElementById('modalContent').innerHTML = `
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-gray-900 text-lg">Modificar Asistencia Individual</h3>
            <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
        </div>
        <form onsubmit="saveModifiedAttendance(event, ${idEstudiante}, ${idCurso}, '${fecha}')" class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Alumno</label>
                    <input type="text" disabled value="${estudiante.nombre}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none"/>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                    <input type="text" disabled value="${fecha}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none"/>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nuevo Estado</label>
                <select id="modAttEstado" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
                    <option value="PRESENTE" ${estadoActual === 'PRESENTE' ? 'selected' : ''}>✅ PRESENTE</option>
                    <option value="AUSENTE" ${estadoActual === 'AUSENTE' ? 'selected' : ''}>❌ AUSENTE</option>
                    <option value="TARDANZA" ${estadoActual === 'TARDANZA' ? 'selected' : ''}>⏰ TARDANZA</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Observación / Motivo de Modificación</label>
                <textarea id="modAttObs" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none" placeholder="Ej: Se corrigió por error de tipeo, llegó tarde pero con justificación...">${obsActual}</textarea>
            </div>
            <div class="pt-4 flex justify-end gap-2">
                <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
                <button type="submit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium shadow-sm">Guardar Modificación</button>
            </div>
        </form>
    `;
    m.classList.remove('hidden');
}

async function saveModifiedAttendance(e, idEstudiante, idCurso, fecha) {
    e.preventDefault();
    const estado = document.getElementById('modAttEstado').value;
    const observacion = document.getElementById('modAttObs').value.trim();
    // La modificacion se permite en todo momento: se conserva el bloque original
    // para que el backend lo trate como ACTUALIZAR y no como CREAR fuera de horario.
    const registroPrevio = (MOCK_DB.asistencia || []).find(a => Number(a.idEstudiante) === Number(idEstudiante) && a.fecha === fecha && (!idCurso || Number(a.idCurso) === Number(idCurso)));
    const idBloque = Number(registroPrevio?.idBloqueRegistro ?? registroPrevio?.idBloque ?? document.getElementById('attBloque')?.value ?? 1) || 1;

    try {
        // Llamamos a la misma API de guardado, pero para un solo alumno
        await DocenteApi.guardarAsistencia([{
            idEstudiante,
            idCurso,
            fecha,
            estado,
            observacion,
            idBloque
        }], { idCurso, fecha, idBloque });
        
        closeModal();
        toast('✅ Asistencia modificada y guardada correctamente');
        await renderAttList(); // Refrescamos la lista para ver la nueva hora
    } catch (err) {
        toast('❌ ' + (err.message || 'No fue posible modificar la asistencia'));
    }
}
// ==========================================
// HORARIO DEL PUPILO (APODERADO)
// ==========================================
async function obtenerCursosDelPupilo() {
  // ★ FIX: ya no depende de MOCK_DB.estudiantes (el apoderado nunca lo carga).
  // Usa /guardian (matrículas reales del pupilo) + caché de cursos bajo demanda.
  if (!MOCK_DB.cursos.length) {
  try { await loadCourses(); } catch (_) { /* sin cursos disponibles */ }
  }
  const id = ApoderadoApi.getidEstudiante();
  let students = [];
  try {
  const data = await request(`/guardian${id ? `?idEstudiante=${id}` : ''}`);
  students = data.students || [];
  } catch (_) { students = []; }
  const mias = id == null ? students : students.filter(r => Number(r.idEstudiante) === Number(id));
  const lista = mias.length ? mias : students;
  const estudiante = MOCK_DB.estudiantes.find(e => Number(e.idEstudiante) === Number(id)) || null;
  const asignaciones = [...new Set([
  ...(Array.isArray(estudiante?.cursosAsignados) && estudiante.cursosAsignados.length ? estudiante.cursosAsignados : []),
  ...lista.map(r => r.nombreCurso).filter(Boolean)
  ])];
  const nivel = lista[0]?.curso || estudiante?.curso || null;
  let cursos = MOCK_DB.cursos.filter(c =>
  asignaciones.some(valor => String(valor) === String(c.idCurso) || valor === c.nombreCurso)
  );
  if (!cursos.length && nivel) cursos = MOCK_DB.cursos.filter(c => c.nivel === nivel);
  return cursos.sort((a, b) =>
  (a.asignatura || a.nombreCurso || '').localeCompare(b.asignatura || b.nombreCurso || '')
  );
  }
  async function renderApoderadoHorario() {
    const info = await ApoderadoApi.dashboard();
    const cursos = await obtenerCursosDelPupilo();
    // ★ FIX: carga los docentes REALES de cada asignatura (el endpoint
    // /cursos/:id/docentes está permitido para cualquier rol logueado)
    // y los inyecta en MOCK_DB.users para que nombreDocenteCurso()
    // pueda resolver el nombre en la grilla del apoderado.
    for (const c of cursos) {
    try {
    const docs = await request(`/cursos/${c.idCurso}/docentes`);
    (docs || []).forEach(d => {
    if (!d.identificador) return;
    const existente = MOCK_DB.users.find(u => u.identificador === d.identificador);
    if (!existente) {
    MOCK_DB.users.push({ identificador: d.identificador, nombre: d.nombreDocente, rol: 'DOCENTE', cursosAsignados: [Number(c.idCurso)] });
    } else {
    if (!Array.isArray(existente.cursosAsignados)) existente.cursosAsignados = [];
    if (!existente.cursosAsignados.includes(Number(c.idCurso))) existente.cursosAsignados.push(Number(c.idCurso));
    if (!existente.nombre) existente.nombre = d.nombreDocente;
    }
    });
    } catch (_) { /* curso sin docentes vinculados */ }
    }
  document.getElementById('pageTitle').textContent = `Horario de Clases — ${info.nombrePupilo}`;
  document.getElementById('pageSubtitle').textContent =
  `Curso: ${info.curso} · Asignaturas que cursa el estudiante`;
  const content = document.getElementById('content');
  if (!cursos.length) {
  content.innerHTML = `<div class="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 shadow-sm"> El estudiante no tiene asignaturas o cursos asignados todavía. </div>`;
  return;
  }
  const asignaturasHtml = `<div class="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm"> <h3 class="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide"> 📚 Asignaturas del estudiante </h3> <div class="flex flex-wrap gap-2"> ${cursos.map(c => `<span class="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">
  ${escapeHtml(c.asignatura || c.nombreCurso)}
  </span>
  `).join('')} </div> </div>`;
  content.innerHTML = asignaturasHtml + horarioClasesHtml(cursos, info.nombrePupilo);
}

// ════════════════════════════════════════════════════════
//  VISTA INSPECTOR (rol INSPECTOR)
// ════════════════════════════════════════════════════════
async function renderInspectorDashboard() {
  document.getElementById('pageTitle').textContent = 'Panel de Inspectoría';
  document.getElementById('pageSubtitle').textContent = 'Control de asistencia del establecimiento';
  const d = await InspectorApi.dashboard();
  document.getElementById('content').innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    ${statCard('👥', 'Total Alumnos', d.totalEstudiantes, 'bg-cyan-500')}
    ${statCard('📚', 'Cursos Activos', d.totalCursos, 'bg-purple-500')}
    ${statCard('✅', 'Asistencia Hoy', d.asistenciaHoy, 'bg-emerald-500')}
  </div>
  <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
    <h3 class="font-bold text-gray-900 mb-4">Accesos Rápidos</h3>
    <div class="grid grid-cols-2 md:grid-cols-2 gap-4">
      <button onclick="navigate('attendance')" class="p-4 bg-white border border-gray-200 hover:border-cyan-500 rounded-xl text-left transition shadow-sm hover:shadow-md">
        <div class="text-2xl mb-2">✅</div>
        <div class="font-bold text-sm text-slate-800">Tomar Asistencia</div>
        <div class="text-xs text-gray-500">Todos los cursos del colegio</div>
      </button>
      <button onclick="navigate('horarios')" class="p-4 bg-white border border-gray-200 hover:border-cyan-500 rounded-xl text-left transition shadow-sm hover:shadow-md">
        <div class="text-2xl mb-2">🕐</div>
        <div class="font-bold text-sm text-slate-800">Horarios de Clases</div>
        <div class="text-xs text-gray-500">Todos los cursos</div>
      </button>
    </div>
  </div>`;
  await renderNotificationBell();
}

function cursosPorNivelParaInspector(cursos) {
  const mapa = new Map();

  (cursos || []).forEach(c => {
      const clave = `${c.nivel || c.nombreCurso || 'Sin nivel'}|${c.anioEscolar || ''}`;
      const actual = mapa.get(clave);

      if (!actual || Number(c.idCurso) < Number(actual.idCurso)) {
          mapa.set(clave, {
              idCurso: c.idCurso,
              nombreCurso: c.nombreCurso,
              nivel: c.nivel || c.nombreCurso || 'Sin nivel',
              anioEscolar: c.anioEscolar
          });
      }
  });

  return Array.from(mapa.values()).sort((a, b) =>
      String(a.nivel).localeCompare(String(b.nivel), 'es', { numeric: true })
  );
}

async function renderInspectorAttendance() {
  document.getElementById('pageTitle').textContent = 'Asistencia del Colegio';
  document.getElementById('pageSubtitle').textContent = 'Registro de asistencia para todos los cursos (Bloques 1 y 2)';
  const cursos = cacheCursos.length ? cacheCursos : await InspectorApi.cursos();
  cacheCursos = cursos;
  const cursosInspector = cursosPorNivelParaInspector(cursos);

  document.getElementById('content').innerHTML = `
  <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div>
        <h3 class="font-bold text-gray-900 text-lg">📋 Registro de Asistencia por Curso</h3>
        <p class="text-xs text-gray-500">Selecciona un curso y un bloque (1 o 2). La asistencia se aplica a todo el día.</p>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha</label>
        <input type="date" id="attDate" value="${todayStr()}"
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Curso</label>
          <select id="attCurso" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none">
            <option value="">Selecciona un curso...</option>
            ${cursosInspector.map(c => {
                const etiqueta = `${c.nivel || c.nombreCurso}${c.anioEscolar ? ' · ' + c.anioEscolar : ''}`;
                return `<option value="${c.idCurso}">${escapeHtml(etiqueta)}</option>`;
            }).join('')}
          </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">Bloque</label>
        <div id="attBloquesBtns" class="flex flex-wrap gap-2">
          <button type="button" onclick="seleccionarBloqueInspector(1)" class="px-3 py-2 rounded-lg border text-xs font-semibold transition bg-indigo-600 text-white border-indigo-600">
            🕐 1ª hora (08:15 - 09:00)
          </button>
          <button type="button" onclick="seleccionarBloqueInspector(2)" class="px-3 py-2 rounded-lg border text-xs font-semibold transition bg-white text-gray-600 border-gray-200 hover:bg-indigo-50">
            🕐 2ª hora (09:00 - 09:45)
          </button>
        </div>
      </div>
    </div>
    <input type="hidden" id="attBloque" value="1"/>
  </div>

  <div id="attSeleccionInfo" class="mb-4"></div>

  <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm flex flex-wrap items-center gap-3">
    <div class="ml-auto flex flex-wrap gap-2">
      <button onclick="markAllPresent()"
        class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm">
        ✓ Todos Presente
      </button>
      <button onclick="saveAttendanceInspector()"
        class="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition shadow-sm">
        💾 Guardar Asistencia
      </button>
    </div>
  </div>
  <div id="attList"></div>`;

  document.getElementById('attDate').addEventListener('change', () => {
    validarHoraInspector();
    renderAttList();
  });
  document.getElementById('attCurso').addEventListener('change', () => {
    actualizarInfoSeleccionInspector();
    validarHoraInspector();
    renderAttList();
  });

  validarHoraInspector();
}

function seleccionarBloqueInspector(bloque) {
  const inp = document.getElementById('attBloque');
  if (inp) inp.value = String(bloque);
  const container = document.getElementById('attBloquesBtns');
  if (container) {
    container.innerHTML = [1, 2].map(b => {
      const activo = b === bloque;
      return `<button type="button" onclick="seleccionarBloqueInspector(${b})"
        class="px-3 py-2 rounded-lg border text-xs font-semibold transition ${activo ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50'}">
        🕐 ${b}ª hora (${b === 1 ? '08:15 - 09:00' : '09:00 - 09:45'})
      </button>`;
    }).join('');
  }
  actualizarInfoSeleccionInspector();
  renderAttList();
}

function actualizarInfoSeleccionInspector() {
  const info = document.getElementById('attSeleccionInfo');
  if (!info) return;

  const sel = document.getElementById('attCurso');
  if (!sel || !sel.value) {
      info.innerHTML = '';
      return;
  }

  const nombreCurso = sel.options[sel.selectedIndex]?.text || 'Curso seleccionado';
  const bloque = Number(document.getElementById('attBloque')?.value || 1);

  info.innerHTML = `
      <div class="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-center gap-3">
          <span class="text-2xl">📘</span>
          <div>
              <div class="font-bold text-cyan-900 text-sm">${escapeHtml(nombreCurso)}</div>
              <div class="text-xs text-cyan-700">
                  Bloque ${bloque} — La asistencia se aplicará a todo el día del curso seleccionado
              </div>
          </div>
      </div>
  `;
}

async function saveAttendanceInspector() {
  const idCurso = parseInt(document.getElementById('attCurso')?.value);
  const fecha = document.getElementById('attDate').value;
  const idBloque = parseInt(document.getElementById('attBloque')?.value || 1);
  if (!idCurso) { toast('❌ Selecciona un curso'); return; }
  const items = [];
  document.querySelectorAll('[data-sid]').forEach(row => {
    const sid = parseInt(row.dataset.sid);
    items.push({
      idEstudiante: sid,
      idCurso,
      fecha,
      estado: document.querySelector(`[data-estado="${sid}"]`)?.value || 'PRESENTE',
      observacion: undefined
    });
  });
  try {
    await InspectorApi.guardarAsistencia(items, { idCurso, fecha, idBloque });
    toast('✅ Asistencia guardada para todo el día');
    await renderAttList();
  } catch (e) {
    toast('❌ ' + (e.message || 'No fue posible guardar la asistencia'));
  }
}

function validarHoraInspector() {
  const fechaInput = document.getElementById('attDate');
  if (!fechaInput) return;

  const fecha = fechaInput.value;
  const hoy = new Date().toISOString().split('T')[0];
  const esHoy = fecha === hoy;

  let mensaje = '';
  let bloqueado = false;

  if (esHoy) {
      const ahora = new Date().toTimeString().slice(0, 5);
      const inicio = '08:15';
      const fin = '09:45';

      if (ahora < inicio) {
          mensaje = `⏳ La ventana para registrar asistencia nueva abre a las 08:15. Hora actual: ${ahora}. Solo puedes modificar asistencia ya registrada.`;
          bloqueado = true;
      } else if (ahora > fin) {
          mensaje = `🔒 Ventana para registrar asistencia nueva cerrada (08:15 a 09:45). Hora actual: ${ahora}. Solo puedes modificar asistencia ya registrada.`;
      }
  }

  let aviso = document.getElementById('avisoHoraInspector');

  if (!aviso) {
      aviso = document.createElement('div');
      aviso.id = 'avisoHoraInspector';

      const container = fechaInput.closest('.bg-white');
      if (container) container.appendChild(aviso);
  }

  if (mensaje) {
      aviso.innerHTML = `
          <div class="mt-3 px-3 py-2 rounded-lg text-xs font-semibold ${bloqueado ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}">
              ${mensaje}
          </div>
      `;
  } else {
      aviso.innerHTML = `
          <div class="mt-3 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
              ✅ Ventana activa para registrar asistencia nueva (08:15 a 09:45). Puedes modificar asistencia registrada durante todo el día.
          </div>
      `;
  }
}

async function renderInspectorHorarios() {
  document.getElementById('pageTitle').textContent = 'Horarios de Clases del Colegio';
  document.getElementById('pageSubtitle').textContent = 'Selecciona un curso para ver su horario completo';

  const cursos = cacheCursos.length ? cacheCursos : await InspectorApi.cursos();
  cacheCursos = cursos;

  const grupos = agruparCursosPorNivel(cursos);

  if (!grupos.length) {
      document.getElementById('content').innerHTML = `
          <div class="text-center py-12 text-gray-400">
              No hay cursos registrados
          </div>
      `;
      return;
  }

  document.getElementById('content').innerHTML = `
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                  <label class="block text-xs font-bold text-gray-500 uppercase mb-2">
                      Curso
                  </label>
                  <select
                      id="inspectorHorarioGrupo"
                      class="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                      <option value="">Selecciona un curso...</option>
                      ${grupos.map(grupo => `
                          <option value="${escapeHtml(obtenerClaveCursoGrupo(grupo.asignaturas[0]))}">
                              ${escapeHtml(grupo.nombre)} ${grupo.anioEscolar ? '· ' + escapeHtml(String(grupo.anioEscolar)) : ''}
                          </option>
                      `).join('')}
                  </select>
                  <p class="text-xs text-gray-400 mt-2">
                      Al seleccionar un curso se mostrará su horario completo como calendario semanal.
                  </p>
              </div>
          </div>
      </div>

      <div id="inspectorHorarioContenido"></div>
  `;

  const selector = document.getElementById('inspectorHorarioGrupo');

  selector.addEventListener('change', () => {
      renderInspectorHorarioGrupo(selector.value, grupos);
  });

    // Abrir automáticamente el primer curso disponible
    if (selector.options.length > 1) {
      selector.selectedIndex = 1;
      renderInspectorHorarioGrupo(selector.value, grupos);
  } else {
      renderInspectorHorarioGrupo('', grupos);
  }
}

async function renderInspectorHorarioGrupo(claveGrupo, grupos) {
  const container = document.getElementById('inspectorHorarioContenido');
  if (!container) return;

  if (!claveGrupo) {
      container.innerHTML = `
          <div class="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 shadow-sm">
              🕐 Selecciona un curso para visualizar su horario completo.
          </div>
      `;
      return;
  }

  const grupo = grupos.find(g => obtenerClaveCursoGrupo(g.asignaturas[0]) === claveGrupo);

  if (!grupo) {
      container.innerHTML = `
          <div class="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 shadow-sm">
              No se encontró información del curso seleccionado.
          </div>
      `;
      return;
  }

  container.innerHTML = `
      <div class="mb-4">
          <h3 class="font-bold text-gray-900 text-xl">
              Horario completo — ${escapeHtml(grupo.nombre)}
          </h3>
          <p class="text-sm text-gray-500">
              ${escapeHtml(grupo.nivel || '')}
              ${grupo.anioEscolar ? ' · ' + escapeHtml(String(grupo.anioEscolar)) : ''}
              · ${grupo.asignaturas.length} asignatura(s)
          </p>
      </div>

      ${horarioClasesHtml(grupo.asignaturas, `Curso ${grupo.nombre}`)}

      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mt-6">
          <h4 class="font-bold text-gray-900 text-sm uppercase mb-3">
              Asignaturas incluidas en este horario
          </h4>
          <div class="flex flex-wrap gap-2">
              ${grupo.asignaturas.map(c => `
                  <span class="px-3 py-1.5 bg-cyan-50 border border-cyan-100 text-cyan-700 rounded-lg text-xs font-bold">
                      📘 ${escapeHtml(c.asignatura || c.nombreCurso)}
                  </span>
              `).join('')}
          </div>
      </div>
  `;
}

// ════════════════════════════════════════════════════════
//  CALENDARIO DE ACTIVIDADES
//  ADMIN: crea / edita / elimina. Resto de roles: solo lectura.
// ════════════════════════════════════════════════════════
let calAnio = new Date().getFullYear();
let calMes = null;          // null = vista anual (12 meses) | 0-11 = mes ampliado
let calActividades = [];
let calEditId = null;
const CAL_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CAL_DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const calEsAdmin = () => currentUser && currentUser.rol === 'ADMIN';
const calISO = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const calHoy = () => { const d = new Date(); return calISO(d.getFullYear(), d.getMonth(), d.getDate()); };
const calActsDelDia = iso => calActividades.filter(a => a.fecha === iso);
const calFechaLarga = iso => new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

async function renderCalendario() {
  document.getElementById('pageTitle').textContent = 'Calendario de Actividades';
  document.getElementById('pageSubtitle').textContent = calEsAdmin()
    ? 'Planifica las actividades importantes del año'
    : 'Actividades importantes del establecimiento';
  calActividades = await CalendarioApi.listar(calAnio);
  pintarCalendario();
}

function pintarCalendario() {
  document.getElementById('content').innerHTML = calMes === null ? calHtmlAnio() : calHtmlMes();
}

async function calCambiarAnio(delta) {
  calAnio += delta;
  calMes = null;
  calActividades = await CalendarioApi.listar(calAnio);
  pintarCalendario();
}

function calAbrirMes(m) { calMes = m; pintarCalendario(); }
function calVolverAnio() { calMes = null; pintarCalendario(); }

async function calCambiarMes(delta) {
  let m = calMes + delta;
  let anioNuevo = calAnio;
  if (m < 0) { m = 11; anioNuevo--; }
  if (m > 11) { m = 0; anioNuevo++; }
  if (anioNuevo !== calAnio) {
    calAnio = anioNuevo;
    calActividades = await CalendarioApi.listar(calAnio);
  }
  calMes = m;
  pintarCalendario();
}

// ── Vista anual: los 12 meses ──
function calHtmlAnio() {
  const hoy = calHoy();
  const meses = CAL_MESES.map((nombre, m) => {
    const offset = (new Date(calAnio, m, 1).getDay() + 6) % 7;
    const dias = new Date(calAnio, m + 1, 0).getDate();
    let celdas = '<div></div>'.repeat(offset);
    for (let d = 1; d <= dias; d++) {
      const iso = calISO(calAnio, m, d);
      const hay = calActsDelDia(iso).length > 0;
      const esHoy = iso === hoy;
      celdas += `<div class="text-[11px] h-6 flex items-center justify-center rounded ${hay ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'} ${esHoy && !hay ? 'ring-1 ring-indigo-400' : ''}">${d}</div>`;
    }
    const prefijo = `${calAnio}-${String(m + 1).padStart(2, '0')}`;
    const total = calActividades.filter(a => a.fecha.startsWith(prefijo)).length;
    return `
      <button onclick="calAbrirMes(${m})" class="bg-white rounded-xl border border-gray-200 p-4 text-left shadow-sm hover:shadow-md hover:border-indigo-300 transition">
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-slate-900 text-sm">${CAL_MESES[m]}</span>
          ${total ? `<span class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${total}</span>` : ''}
        </div>
        <div class="grid grid-cols-7 gap-0.5 text-center mb-1">
          ${CAL_DIAS.map(d => `<div class="text-[9px] uppercase text-slate-400 font-semibold">${d[0]}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-0.5 text-center">${celdas}</div>
      </button>`;
  }).join('');

  return `
    <div class="flex items-center justify-between mb-6">
      <button onclick="calCambiarAnio(-1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">← ${calAnio - 1}</button>
      <h3 class="text-xl font-bold text-slate-900">${calAnio}</h3>
      <button onclick="calCambiarAnio(1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">${calAnio + 1} →</button>
    </div>
    <p class="text-xs text-slate-500 mb-4">Toca un mes para verlo en grande. Los días en azul tienen actividades.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">${meses}</div>`;
}

// ── Vista de un mes ampliado ──
function calHtmlMes() {
  const hoy = calHoy();
  const offset = (new Date(calAnio, calMes, 1).getDay() + 6) % 7;
  const dias = new Date(calAnio, calMes + 1, 0).getDate();
  let celdas = '<div class="hidden sm:block"></div>'.repeat(offset);
  for (let d = 1; d <= dias; d++) {
    const iso = calISO(calAnio, calMes, d);
    const acts = calActsDelDia(iso);
    const esHoy = iso === hoy;
    const chips = acts.slice(0, 2).map(a => `<div class="text-[10px] leading-tight bg-indigo-100 text-indigo-800 rounded px-1 py-0.5 truncate">${escapeHtml(a.titulo)}</div>`).join('');
    const mas = acts.length > 2 ? `<div class="text-[10px] text-indigo-600 font-semibold">+${acts.length - 2} más</div>` : '';
    celdas += `
      <button onclick="abrirDiaCalendario('${iso}')" class="min-h-[64px] sm:min-h-[96px] bg-white border ${esHoy ? 'border-indigo-500 ring-1 ring-indigo-300' : 'border-gray-200'} rounded-lg p-1.5 text-left hover:bg-indigo-50/50 transition flex flex-col gap-1">
        <span class="text-xs font-bold ${esHoy ? 'text-indigo-600' : 'text-slate-700'}">${d}</span>
        ${chips}${mas}
      </button>`;
  }

  const prefijo = `${calAnio}-${String(calMes + 1).padStart(2, '0')}`;
  const delMes = calActividades.filter(a => a.fecha.startsWith(prefijo));
  const lista = delMes.length
    ? delMes.map(a => `
        <div class="flex gap-3 items-start py-3 border-b border-gray-100 last:border-0">
          <div class="w-11 h-11 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">${Number(a.fecha.slice(8, 10))}</div>
          <div class="min-w-0">
            <div class="font-semibold text-sm text-slate-900">${escapeHtml(a.titulo)}</div>
            ${a.descripcion ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(a.descripcion)}</div>` : ''}
          </div>
        </div>`).join('')
    : '<p class="text-sm text-slate-400 text-center py-4">No hay actividades este mes.</p>';

  return `
    <div class="flex items-center justify-between mb-4 gap-2">
      <button onclick="calVolverAnio()" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">← Año ${calAnio}</button>
      <div class="flex items-center gap-2">
        <button onclick="calCambiarMes(-1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">‹</button>
        <h3 class="text-lg font-bold text-slate-900 min-w-[150px] text-center">${CAL_MESES[calMes]} ${calAnio}</h3>
        <button onclick="calCambiarMes(1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">›</button>
      </div>
    </div>
    ${calEsAdmin() ? '<p class="text-xs text-slate-500 mb-3">Toca un día para agregar o editar actividades.</p>' : '<p class="text-xs text-slate-500 mb-3">Toca un día para ver el detalle.</p>'}
    <div class="grid grid-cols-7 gap-1 mb-1">
      ${CAL_DIAS.map(d => `<div class="text-center text-[10px] sm:text-xs uppercase font-bold text-slate-400">${d}</div>`).join('')}
    </div>
    <div class="grid grid-cols-7 gap-1 mb-6">${celdas}</div>
    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h4 class="font-bold text-slate-900 mb-2">Actividades de ${CAL_MESES[calMes]}</h4>
      ${lista}
    </div>`;
}

// ── Modal de un día ──
function abrirDiaCalendario(iso) {
  calEditId = null;
  const acts = calActsDelDia(iso);
  const admin = calEsAdmin();

  const lista = acts.length
    ? acts.map(a => `
        <div class="p-3 bg-slate-50 border border-gray-200 rounded-lg flex justify-between gap-3">
          <div class="min-w-0">
            <div class="font-semibold text-sm text-slate-900">${escapeHtml(a.titulo)}</div>
            ${a.descripcion ? `<div class="text-xs text-slate-500 mt-1">${escapeHtml(a.descripcion)}</div>` : ''}
          </div>
          ${admin ? `<div class="flex gap-2 shrink-0">
            <button onclick="calEditar(${a.id})" class="text-xs text-indigo-600 font-semibold hover:underline">Editar</button>
            <button onclick="calEliminar(${a.id}, '${iso}')" class="text-xs text-rose-600 font-semibold hover:underline">Eliminar</button>
          </div>` : ''}
        </div>`).join('')
    : '<p class="text-sm text-slate-400 text-center py-2">No hay actividades este día.</p>';

  const form = admin ? `
    <form onsubmit="calGuardar(event, '${iso}')" class="space-y-3 pt-4 mt-4 border-t border-gray-100">
      <div id="calFormTitulo" class="text-xs font-bold text-gray-500 uppercase">Nueva actividad</div>
      <input id="calTitulo" type="text" maxlength="150" required placeholder="Ej: Reunión de apoderados"
             class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      <textarea id="calDescripcion" rows="2" maxlength="1000" placeholder="Detalle (opcional)"
             class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"></textarea>
      <div class="flex justify-end gap-2">
        <button type="button" id="calBtnCancelar" onclick="abrirDiaCalendario('${iso}')" class="hidden px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-lg">Cancelar edición</button>
        <button type="submit" id="calBtnGuardar" class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white">Agregar</button>
      </div>
    </form>` : '';

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-base capitalize">${calFechaLarga(iso)}</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
    </div>
    <div class="p-6">
      <div class="space-y-2">${lista}</div>
      ${form}
    </div>`;
  document.getElementById('modal').classList.remove('hidden');
}

function calEditar(id) {
  const a = calActividades.find(x => Number(x.id) === Number(id));
  if (!a) return;
  calEditId = Number(id);
  document.getElementById('calTitulo').value = a.titulo || '';
  document.getElementById('calDescripcion').value = a.descripcion || '';
  document.getElementById('calFormTitulo').textContent = 'Editando actividad';
  document.getElementById('calBtnGuardar').textContent = 'Guardar cambios';
  document.getElementById('calBtnCancelar').classList.remove('hidden');
  document.getElementById('calTitulo').focus();
}

async function calGuardar(e, iso) {
  e.preventDefault();
  if (!calEsAdmin()) return;
  const titulo = document.getElementById('calTitulo').value.trim();
  const descripcion = document.getElementById('calDescripcion').value.trim();
  if (!titulo) return;
  try {
    if (calEditId) await CalendarioApi.editar(calEditId, { fecha: iso, titulo, descripcion });
    else await CalendarioApi.crear({ fecha: iso, titulo, descripcion });
    calActividades = await CalendarioApi.listar(calAnio);
    pintarCalendario();
    abrirDiaCalendario(iso);
    toast('Actividad guardada');
  } catch (err) { toast(err.message || 'No se pudo guardar'); }
}

async function calEliminar(id, iso) {
  if (!calEsAdmin() || !confirm('¿Eliminar esta actividad?')) return;
  try {
    await CalendarioApi.eliminar(id);
    calActividades = await CalendarioApi.listar(calAnio);
    pintarCalendario();
    abrirDiaCalendario(iso);
    toast('Actividad eliminada');
  } catch (err) { toast(err.message || 'No se pudo eliminar'); }
}

// ════════════════════════════════════════════════════════
//  CALENDARIO DE EVALUACIONES
//  DOCENTE: crea / edita / elimina (solo sus cursos)
//  ADMIN y APODERADO: solo lectura
// ════════════════════════════════════════════════════════
let evAnio = new Date().getFullYear();
let evMes = null;            // null = vista anual | 0-11 = mes ampliado
let evLista = [];
let evEditId = null;
let evFiltroCurso = '';

const evEsDocente = () => currentUser && currentUser.rol === 'DOCENTE';
const evFiltradas = () => evFiltroCurso ? evLista.filter(a => String(a.idCurso) === String(evFiltroCurso)) : evLista;
const evDelDia = iso => evFiltradas().filter(a => a.fecha === iso);

async function renderCalendarioEvaluaciones() {
  document.getElementById('pageTitle').textContent = 'Calendario de Evaluaciones';
  document.getElementById('pageSubtitle').textContent = evEsDocente()
    ? 'Programa las pruebas y trabajos de tus cursos'
    : 'Evaluaciones programadas por los docentes';
  evLista = await EvaluacionesApi.listar(evAnio);
  evPintar();
}

function evPintar() {
  document.getElementById('content').innerHTML = evHtmlFiltro() + (evMes === null ? evHtmlAnio() : evHtmlMes());
}

function evOpcionesCurso() {
  const mapa = new Map();
  if (evEsDocente()) (cacheCursos || []).forEach(c => mapa.set(String(c.idCurso), c.nombreCurso));
  evLista.forEach(a => mapa.set(String(a.idCurso), a.nombreCurso));
  return [...mapa.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
}

function evHtmlFiltro() {
  const opciones = evOpcionesCurso();
  if (opciones.length < 2) return '';
  return `
    <div class="mb-4">
      <select onchange="evCambiarFiltro(this.value)" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-indigo-500">
        <option value="">Todos los cursos</option>
        ${opciones.map(([id, nombre]) => `<option value="${id}" ${String(evFiltroCurso) === id ? 'selected' : ''}>${escapeHtml(nombre)}</option>`).join('')}
      </select>
    </div>`;
}

function evCambiarFiltro(v) { evFiltroCurso = v; evPintar(); }

async function evCambiarAnio(delta) {
  evAnio += delta;
  evMes = null;
  evLista = await EvaluacionesApi.listar(evAnio);
  evPintar();
}

function evAbrirMes(m) { evMes = m; evPintar(); }
function evVolverAnio() { evMes = null; evPintar(); }

async function evCambiarMes(delta) {
  let m = evMes + delta;
  let anioNuevo = evAnio;
  if (m < 0) { m = 11; anioNuevo--; }
  if (m > 11) { m = 0; anioNuevo++; }
  if (anioNuevo !== evAnio) {
    evAnio = anioNuevo;
    evLista = await EvaluacionesApi.listar(evAnio);
  }
  evMes = m;
  evPintar();
}

// ── Vista anual: los 12 meses ──
function evHtmlAnio() {
  const hoy = calHoy();
  const meses = CAL_MESES.map((nombre, m) => {
    const offset = (new Date(evAnio, m, 1).getDay() + 6) % 7;
    const dias = new Date(evAnio, m + 1, 0).getDate();
    let celdas = '<div></div>'.repeat(offset);
    for (let d = 1; d <= dias; d++) {
      const iso = calISO(evAnio, m, d);
      const hay = evDelDia(iso).length > 0;
      const esHoy = iso === hoy;
      celdas += `<div class="text-[11px] h-6 flex items-center justify-center rounded ${hay ? 'bg-amber-500 text-white font-bold' : 'text-slate-600'} ${esHoy && !hay ? 'ring-1 ring-amber-400' : ''}">${d}</div>`;
    }
    const prefijo = `${evAnio}-${String(m + 1).padStart(2, '0')}`;
    const total = evFiltradas().filter(a => a.fecha.startsWith(prefijo)).length;
    return `
      <button onclick="evAbrirMes(${m})" class="bg-white rounded-xl border border-gray-200 p-4 text-left shadow-sm hover:shadow-md hover:border-amber-300 transition">
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-slate-900 text-sm">${CAL_MESES[m]}</span>
          ${total ? `<span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">${total}</span>` : ''}
        </div>
        <div class="grid grid-cols-7 gap-0.5 text-center mb-1">
          ${CAL_DIAS.map(d => `<div class="text-[9px] uppercase text-slate-400 font-semibold">${d[0]}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-0.5 text-center">${celdas}</div>
      </button>`;
  }).join('');

  return `
    <div class="flex items-center justify-between mb-6">
      <button onclick="evCambiarAnio(-1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">← ${evAnio - 1}</button>
      <h3 class="text-xl font-bold text-slate-900">${evAnio}</h3>
      <button onclick="evCambiarAnio(1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">${evAnio + 1} →</button>
    </div>
    <p class="text-xs text-slate-500 mb-4">Toca un mes para verlo en grande. Los días en naranjo tienen evaluaciones.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">${meses}</div>`;
}

// ── Vista de un mes ampliado ──
function evHtmlMes() {
  const hoy = calHoy();
  const offset = (new Date(evAnio, evMes, 1).getDay() + 6) % 7;
  const dias = new Date(evAnio, evMes + 1, 0).getDate();
  let celdas = '<div class="hidden sm:block"></div>'.repeat(offset);
  for (let d = 1; d <= dias; d++) {
    const iso = calISO(evAnio, evMes, d);
    const items = evDelDia(iso);
    const esHoy = iso === hoy;
    const chips = items.slice(0, 2).map(a => `
      <div class="text-[10px] leading-tight bg-amber-100 text-amber-900 rounded px-1 py-0.5">
        <div class="truncate font-semibold">${escapeHtml(a.titulo)}</div>
        <div class="truncate text-amber-700">${escapeHtml(a.nombreCurso || '')}</div>
      </div>`).join('');
    const mas = items.length > 2 ? `<div class="text-[10px] text-amber-600 font-semibold">+${items.length - 2} más</div>` : '';
    celdas += `
      <button onclick="evAbrirDia('${iso}')" class="min-h-[64px] sm:min-h-[100px] bg-white border ${esHoy ? 'border-amber-500 ring-1 ring-amber-300' : 'border-gray-200'} rounded-lg p-1.5 text-left hover:bg-amber-50/60 transition flex flex-col gap-1">
        <span class="text-xs font-bold ${esHoy ? 'text-amber-600' : 'text-slate-700'}">${d}</span>
        ${chips}${mas}
      </button>`;
  }

  const prefijo = `${evAnio}-${String(evMes + 1).padStart(2, '0')}`;
  const delMes = evFiltradas().filter(a => a.fecha.startsWith(prefijo));
  const lista = delMes.length
    ? delMes.map(a => `
        <div class="flex gap-3 items-start py-3 border-b border-gray-100 last:border-0">
          <div class="w-11 h-11 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">${Number(a.fecha.slice(8, 10))}</div>
          <div class="min-w-0">
            <div class="font-semibold text-sm text-slate-900">${escapeHtml(a.titulo)}</div>
            <div class="text-[11px] text-amber-700 font-medium">${escapeHtml(a.nombreCurso || '')}</div>
            ${a.descripcion ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(a.descripcion)}</div>` : ''}
          </div>
        </div>`).join('')
    : '<p class="text-sm text-slate-400 text-center py-4">No hay evaluaciones este mes.</p>';

  return `
    <div class="flex items-center justify-between mb-4 gap-2">
      <button onclick="evVolverAnio()" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">← Año ${evAnio}</button>
      <div class="flex items-center gap-2">
        <button onclick="evCambiarMes(-1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">‹</button>
        <h3 class="text-lg font-bold text-slate-900 min-w-[150px] text-center">${CAL_MESES[evMes]} ${evAnio}</h3>
        <button onclick="evCambiarMes(1)" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">›</button>
      </div>
    </div>
    <p class="text-xs text-slate-500 mb-3">${evEsDocente() ? 'Toca un día para agregar o editar evaluaciones.' : 'Toca un día para ver el detalle.'}</p>
    <div class="grid grid-cols-7 gap-1 mb-1">
      ${CAL_DIAS.map(d => `<div class="text-center text-[10px] sm:text-xs uppercase font-bold text-slate-400">${d}</div>`).join('')}
    </div>
    <div class="grid grid-cols-7 gap-1 mb-6">${celdas}</div>
    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h4 class="font-bold text-slate-900 mb-2">Evaluaciones de ${CAL_MESES[evMes]}</h4>
      ${lista}
    </div>`;
}

// ── Modal de un día ──
function evAbrirDia(iso) {
  evEditId = null;
  const docente = evEsDocente();
  const items = evDelDia(iso);

  const lista = items.length
    ? items.map(a => `
        <div class="p-3 bg-slate-50 border border-gray-200 rounded-lg flex justify-between gap-3">
          <div class="min-w-0">
            <div class="font-semibold text-sm text-slate-900">${escapeHtml(a.titulo)}</div>
            <div class="text-[11px] text-amber-700 font-medium">${escapeHtml(a.nombreCurso || '')}${a.puedeEditar ? '' : a.creadoPor ? ' · ' + escapeHtml(a.creadoPor) : ''}</div>
            ${a.descripcion ? `<div class="text-xs text-slate-500 mt-1">${escapeHtml(a.descripcion)}</div>` : ''}
          </div>
          ${docente && a.puedeEditar ? `<div class="flex gap-2 shrink-0">
            <button onclick="evEditar(${a.id})" class="text-xs text-indigo-600 font-semibold hover:underline">Editar</button>
            <button onclick="evEliminar(${a.id}, '${iso}')" class="text-xs text-rose-600 font-semibold hover:underline">Eliminar</button>
          </div>` : ''}
        </div>`).join('')
    : '<p class="text-sm text-slate-400 text-center py-2">No hay evaluaciones este día.</p>';

  const cursos = cacheCursos || [];
  const form = docente ? (cursos.length ? `
    <form onsubmit="evGuardar(event, '${iso}')" class="space-y-3 pt-4 mt-4 border-t border-gray-100">
      <div id="evFormTitulo" class="text-xs font-bold text-gray-500 uppercase">Nueva evaluación</div>
      <select id="evCurso" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-indigo-500 outline-none">
        ${cursos.map(c => `<option value="${c.idCurso}" ${String(evFiltroCurso) === String(c.idCurso) ? 'selected' : ''}>${escapeHtml(c.nombreCurso)}</option>`).join('')}
      </select>
      <input id="evTitulo" type="text" maxlength="150" required placeholder="Ej: Prueba 2"
             class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"/>
      <textarea id="evDescripcion" rows="3" maxlength="1000" placeholder="¿De qué trata? (contenidos, materiales, etc.)"
             class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 outline-none"></textarea>
      <div class="flex justify-end gap-2">
        <button type="button" id="evBtnCancelar" onclick="evAbrirDia('${iso}')" class="hidden px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-lg">Cancelar edición</button>
        <button type="submit" id="evBtnGuardar" class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white">Agregar</button>
      </div>
    </form>` : '<p class="text-xs text-slate-400 text-center pt-4 mt-4 border-t border-gray-100">No tienes cursos asignados para programar evaluaciones.</p>') : '';

  document.getElementById('modalContent').innerHTML = `
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-gray-900 text-base capitalize">${calFechaLarga(iso)}</h3>
      <button onclick="closeModal()" class="text-gray-400 text-xl hover:text-gray-600">×</button>
    </div>
    <div class="p-6">
      <div class="space-y-2">${lista}</div>
      ${form}
    </div>`;
  document.getElementById('modal').classList.remove('hidden');
}

function evEditar(id) {
  const a = evLista.find(x => Number(x.id) === Number(id));
  if (!a) return;
  evEditId = Number(id);
  document.getElementById('evCurso').value = String(a.idCurso);
  document.getElementById('evTitulo').value = a.titulo || '';
  document.getElementById('evDescripcion').value = a.descripcion || '';
  document.getElementById('evFormTitulo').textContent = 'Editando evaluación';
  document.getElementById('evBtnGuardar').textContent = 'Guardar cambios';
  document.getElementById('evBtnCancelar').classList.remove('hidden');
  document.getElementById('evTitulo').focus();
}

async function evGuardar(e, iso) {
  e.preventDefault();
  if (!evEsDocente()) return;
  const idCurso = Number(document.getElementById('evCurso').value);
  const titulo = document.getElementById('evTitulo').value.trim();
  const descripcion = document.getElementById('evDescripcion').value.trim();
  if (!idCurso || !titulo) return;
  try {
    if (evEditId) await EvaluacionesApi.editar(evEditId, { idCurso, fecha: iso, titulo, descripcion });
    else await EvaluacionesApi.crear({ idCurso, fecha: iso, titulo, descripcion });
    evLista = await EvaluacionesApi.listar(evAnio);
    evPintar();
    evAbrirDia(iso);
    toast('Evaluación guardada');
  } catch (err) { toast(err.message || 'No se pudo guardar'); }
}

async function evEliminar(id, iso) {
  if (!evEsDocente() || !confirm('¿Eliminar esta evaluación?')) return;
  try {
    await EvaluacionesApi.eliminar(id);
    evLista = await EvaluacionesApi.listar(evAnio);
    evPintar();
    evAbrirDia(iso);
    toast('Evaluación eliminada');
  } catch (err) { toast(err.message || 'No se pudo eliminar'); }
}

// ════════════════════════════════════════════════════════
//  SELECTOR DE ALUMNO (APODERADO CON VARIOS PUPILOS)
// ════════════════════════════════════════════════════════
function renderSelectorPupilo() {
  // Limpia selectores anteriores (escritorio y móvil)
  document.querySelectorAll('.pupilo-selector-box, #pupiloSelectorBox').forEach(el => el.remove());
  if (!currentUser || currentUser.rol !== 'APODERADO') return;

  const pupilos = ApoderadoApi.listarPupilos();
  if (pupilos.length < 2) return;   // con un solo alumno no se muestra

  const html = `
    <div class="pupilo-selector-box px-4 pb-4">
      <div class="rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-3">
        <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-2">
          <span>🎓</span><span>Alumno seleccionado</span>
        </div>
        <div class="relative">
          <select onchange="cambiarPupiloActivo(this.value)"
                  class="pupilo-select w-full appearance-none bg-slate-800 border border-slate-600 hover:border-indigo-400 text-white text-sm font-semibold rounded-lg pl-3 pr-8 py-2 outline-none focus:border-indigo-400 cursor-pointer transition">
            ${pupilos.map(p => {
              const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ');
              const sel = Number(p.idEstudiante) === Number(currentUser.idEstudiante) ? 'selected' : '';
              return `<option value="${p.idEstudiante}" ${sel} class="bg-slate-800 text-white">${escapeHtml(nombre)}</option>`;
            }).join('')}
          </select>
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs">▾</span>
        </div>
      </div>
    </div>`;

  // Barra lateral de escritorio: entre el menú y la tarjeta del usuario
  const navDesktop = document.getElementById('navMenu');
  if (navDesktop) navDesktop.insertAdjacentHTML('afterend', html);

  // Menú móvil: también entre el menú y el botón de cerrar sesión
  const navMovil = document.getElementById('navMenuMobile');
  if (navMovil) navMovil.insertAdjacentHTML('afterend', html);
}

async function cambiarPupiloActivo(id) {
  ApoderadoApi.seleccionarPupilo(id);
  // Mantiene sincronizados los selectores de escritorio y móvil
  document.querySelectorAll('.pupilo-select').forEach(s => { s.value = String(id); });
  if (typeof closeSidebar === 'function') closeSidebar();   // en móvil cierra el menú
  await render();   // vuelve a cargar la vista actual con el alumno elegido
}

// INICIALIZACIÓN

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('siga_token');

  if (token) {
    try {
      setToken(token);
      const user = await AuthApi.me();

      currentUser = user;

      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('app').classList.add('flex');

      await initApp();
    } catch (_) {
      setToken('');
    }
  }
});