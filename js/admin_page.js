// Usamos el cliente global de Supabase cargado en el HTML
const supabase = window.supabase;

// Global state for Penalidades filtering
let allPenalidades = [];
let allFaltasHistorial = [];
let activePenTab = 'penalizados';
let histActiveDateIndex = 0;

if (!supabase) {
  console.error('Supabase client not found! Ensure the library is loaded in the HTML.');
}

// ── EmailJS CONFIG ──
const EMAILJS_SERVICE = 'service_afofocu';
const EMAILJS_TEMPLATE = 'template_ryyejnp';
const EMAILJS_PUBLIC = 'nFSfa8vIE5hozX8Ok';
// Inicializar EmailJS
if (window.emailjs) emailjs.init(EMAILJS_PUBLIC);

function getCycleDate() {
  const now = new Date();
  const hora = now.getHours();
  let targetDate = now;
  if (hora >= 22) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let currentUser = null;

// --- ÚNICO ESCUDO DE SEGURIDAD (REMEDIACIÓN E-1, E-2) ---
async function checkSecurity() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = 'index.html';
      return;
    }

    // Obtener perfil real desde la DB
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const rol = profile.rol || '';
    const isAdmin = rol.includes('admin') || rol.includes('desarrolladora') || rol.includes('administrador');

    if (error || !profile || !isAdmin) {
      console.error("Acceso denegado: Insuficientes privilegios");
      window.location.href = 'votar.html';
      return;
    }

    // Si todo está bien, guardamos al usuario y permitimos que la página cargue
    currentUser = profile;
    localStorage.setItem('aeudj_user', JSON.stringify(profile));

    // Iniciar la App después de la seguridad
    initAdminDashboard();
  } catch (err) {
    console.error("Security Check Error:", err);
    window.location.href = 'index.html';
  }
}

// Ejecutar verificación
checkSecurity();
// -------------------------------------------------

function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// State management
let currentVotos = [];
let staffData = [];
let staffFilter = 'todos';

async function initAdminDashboard() {
  // 1. Security Check (Doble verificación por si acaso)
  if (!currentUser || (!currentUser.rol.includes('admin') && !currentUser.rol.includes('desarrolladora') && !currentUser.rol.includes('administrador'))) {
    window.location.href = 'index.html';
    return;
  }

  // 2. Initial Setup
  const fechaEl = document.getElementById('fechaAdmin');
  if (fechaEl) fechaEl.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // 3. Navigation Setup
  initNavigation();

  // 4. Load Initial Data (Dashboard)
  loadDashboardData();
  initSessionControl();



  // 6. Real-Time Sync para Votos
  supabase.channel('admin-votos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votos' }, () => {
      const dash = document.getElementById('screen-dashboard');
      const votes = document.getElementById('screen-votos');
      const plist = document.getElementById('screen-pasarlista');
      if (dash && !dash.classList.contains('hidden')) loadDashboardData();
      if (votes && !votes.classList.contains('hidden')) loadVotosDetail();
      if (plist && !plist.classList.contains('hidden')) loadAdminLista();
    }).subscribe();

  // Sync para Penalidades y Faltas
  supabase.channel('admin-penalidades-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'penalidades' }, () => {
      const pen = document.getElementById('screen-penalidades');
      if (pen && !pen.classList.contains('hidden')) loadPenalidadesData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'faltas' }, () => {
      const pen = document.getElementById('screen-penalidades');
      if (pen && !pen.classList.contains('hidden')) loadPenalidadesData();
      // También logs si está visible
      const logs = document.getElementById('screen-logs');
      if (logs && !logs.classList.contains('hidden')) window.loadAuditData();
    }).subscribe();

  // 7. Setup Events
  initClickEvents();

  if (window.lucide) window.lucide.createIcons();
}

function initClickEvents() {
  // Global actions
  const btnRefreshScreen = document.getElementById('btnRefreshScreen');
  if (btnRefreshScreen) btnRefreshScreen.addEventListener('click', () => window.refreshCurrentScreen());

  const btnClearVotes = document.getElementById('btnClearVotes');
  if (btnClearVotes) btnClearVotes.addEventListener('click', () => window.clearTodayVotes());

  const btnGoToVotes = document.getElementById('btnGoToVotes');
  if (btnGoToVotes) btnGoToVotes.addEventListener('click', () => switchScreen('votos'));

  // Staff search
  const staffSearch = document.getElementById('staffSearchNew');
  if (staffSearch) staffSearch.addEventListener('input', () => window.filterStaffNew());

  // Staff filters
  const staffFilters = ['todos', 'administrador', 'voluntario', 'estudiante', 'chofer'];
  staffFilters.forEach(f => {
    const btn = document.getElementById(`tab-${f}`);
    if (btn) btn.addEventListener('click', () => window.setStaffFilterNew(f));
  });

  // Quick Add / Edit
  const toggleQAPassword = document.getElementById('toggleQAPassword');
  if (toggleQAPassword) {
    toggleQAPassword.addEventListener('click', () => {
      const p = document.getElementById('qa-password');
      if (p) {
        const isPass = p.type === 'password';
        p.type = isPass ? 'text' : 'password';
        toggleQAPassword.textContent = isPass ? '🙈' : '👁️';
      }
    });
  }

  const qaSubmitBtn = document.getElementById('qa-submit-btn');
  if (qaSubmitBtn) qaSubmitBtn.addEventListener('click', () => window.handleQuickAddStaff());

  const qaCancelBtn = document.getElementById('qa-cancel-btn');
  if (qaCancelBtn) qaCancelBtn.addEventListener('click', () => window.resetQuickAddForm());



  // Audit section
  const auditSearch = document.getElementById('auditSearch');
  if (auditSearch) auditSearch.addEventListener('input', () => window.filterAuditTable());

  const auditDatePick = document.getElementById('auditDatePick');
  if (auditDatePick) auditDatePick.addEventListener('change', () => window.loadAuditData());

  // Penalidades Search/Date
  const penSearch = document.getElementById('penSearch');
  if (penSearch) penSearch.addEventListener('input', () => window.filterPenalidades());
  const penDate = document.getElementById('penDate');
  if (penDate) penDate.addEventListener('change', () => window.filterPenalidades());
  const penShowOnlyPenalized = document.getElementById('penShowOnlyPenalized');
  if (penShowOnlyPenalized) penShowOnlyPenalized.addEventListener('change', () => window.filterPenalidades());
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const screen = item.dataset.screen;
      switchScreen(screen);

      // Update active state
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

async function switchScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.admin-screen').forEach(s => s.classList.add('hidden'));

  // Show target screen
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.remove('hidden');

  // Update Header Title
  const titles = {
    'dashboard': 'Dashboard Informativo',
    'votos': 'Listado de Pasajeros',
    'horarios': 'Gestión de Turnos',
    'staff': 'Gestión de Personal',
    'logs': 'Registro de Auditoría',
    'penalidades': 'Gestión de Penalidades',
    'pasarlista': 'Pase de Lista Activo'
  };
  const screenTitle = document.getElementById('screenTitle');
  if (screenTitle) screenTitle.textContent = titles[screenId] || 'Panel Administrativo';

  // Load specific screen data
  if (screenId === 'dashboard') loadDashboardData();
  if (screenId === 'votos') loadVotosDetail();
  if (screenId === 'horarios') loadHorariosData();
  if (screenId === 'staff') loadStaffData();
  if (screenId === 'penalidades') loadPenalidadesData();
  if (screenId === 'pasarlista') loadAdminLista();
  if (screenId === 'logs') window.loadAuditData();

  if (window.lucide) window.lucide.createIcons();
}

window.refreshCurrentScreen = () => {
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    const screenId = activeNav.dataset.screen;
    switchScreen(screenId);
  }
};

window.showAdminToast = (msg, type = 'success') => {
  const old = document.querySelector('.admin-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = `admin-toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'error' ? 'alert-triangle' : 'check-circle'}"></i>
    <span>${msg}</span>
  `;
  document.body.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  toast.offsetHeight;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 3500);
};

async function loadDashboardData() {
  try {
    const today = getCycleDate();

    // --- LÓGICA DE SESIÓN (Banner) ---
    const { data: config } = await supabase.from('voting_config').select('*').eq('id', 1).maybeSingle();
    const ahora = new Date();
    const hora = ahora.getHours();

    let currentSession = (hora >= 22 || hora < 10) ? 'manana' : 'tarde';
    let isManual = false;

    if (config && config.manual_override) {
      currentSession = config.active_session;
      isManual = true;
    }

    const display = document.getElementById('sessionDisplay');
    const statusText = document.getElementById('sessionStatusText');
    if (display) display.innerHTML = (currentSession === 'tarde') ? '🌙 Vespertina' : '☀️ Matutina';
    if (statusText) statusText.textContent = isManual ? 'MODO: MANUAL (FORZADO)' : 'MODO: AUTOMÁTICO';

    const { data: votos, error } = await supabase.from('votos').select('*').eq('fecha', today).order('horario');
    if (error) throw error;
    currentVotos = votos || [];

    let total = 0;
    let espera = 0;
    let totalCobrado = 0;

    const timeGroups = {};
    const listado = {};
    const groupCounters = {}; // Para el límite de 30

    currentVotos.forEach(v => {
      if (!listado[v.horario]) listado[v.horario] = [];
      listado[v.horario].push(v);

      if (!timeGroups[v.horario]) timeGroups[v.horario] = { confirmados: 0, espera: 0 };
      if (!groupCounters[v.horario]) groupCounters[v.horario] = 0;

      groupCounters[v.horario]++;
      const esEsperaVisual = v.en_espera || groupCounters[v.horario] > 30;

      if (esEsperaVisual) {
        espera++;
        timeGroups[v.horario].espera++;
      } else {
        total++;
        timeGroups[v.horario].confirmados++;

        const isMorning = v.horario.toUpperCase().includes('AM');
        const is3PM = v.horario.toUpperCase().includes('3:00 PM');
        if (isMorning || is3PM) {
          totalCobrado++;
        }
      }
    });

    const statTotalPasajeros = document.getElementById('statTotalPasajeros');
    const statWaitlistTotal = document.getElementById('statWaitlistTotal');
    const statIngresosReales = document.getElementById('statIngresosReales');

    if (statTotalPasajeros) statTotalPasajeros.textContent = total;
    if (statWaitlistTotal) statWaitlistTotal.textContent = espera;
    if (statIngresosReales) statIngresosReales.textContent = 'RD$ ' + (totalCobrado * 100).toLocaleString();

    renderDashboardChart(timeGroups);

    const container = document.getElementById('dashboardRecentActivity');
    if (!container) return;
    container.innerHTML = '';

    if (Object.keys(listado).length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2.5rem;color:#475569;"><p>No hay viajes activos hoy.</p></div>';
    } else {
      const IDA_KW = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
      const isIda = h => IDA_KW.some(k => h.includes(k));

      Object.entries(listado).forEach(([horario, paxList]) => {
        const ida = isIda(horario);
        const confirmados = paxList.filter(p => !p.en_espera).length;
        const enEspera = paxList.filter(p => p.en_espera).length;

        const group = document.createElement('div');
        group.className = 'pv-group';
        group.style.cursor = 'pointer';
        group.onclick = () => switchScreen('votos');

        const hdr = document.createElement('div');
        hdr.className = 'pv-group-hdr';
        const titleDiv = document.createElement('div');
        titleDiv.className = 'pv-group-title';
        titleDiv.textContent = horario;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'pv-group-meta';

        const dirPill = document.createElement('span');
        dirPill.className = `pv-dir-pill ${ida ? 'pv-dir-ida' : 'pv-dir-vuelta'}`;
        dirPill.textContent = ida ? '\u2197 IDA' : '\u2199 VUELTA';

        const countPill = document.createElement('span');
        countPill.className = 'pv-count-pill';
        countPill.textContent = `${paxList.length} persona${paxList.length !== 1 ? 's' : ''}`;

        metaDiv.appendChild(dirPill);
        metaDiv.appendChild(countPill);

        hdr.appendChild(titleDiv);
        hdr.appendChild(metaDiv);

        const body = document.createElement('div');
        body.style.cssText = 'padding:.6rem 1.15rem;display:flex;gap:.75rem;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.04);';

        if (confirmados > 0) {
          const c = document.createElement('span');
          c.style.cssText = 'font-size:.68rem;font-weight:800;background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.2);padding:.2rem .6rem;border-radius:999px;';
          c.textContent = '\u2713 ' + confirmados + ' Confirmado' + (confirmados !== 1 ? 's' : '');
          body.appendChild(c);
        }
        if (enEspera > 0) {
          const e = document.createElement('span');
          e.style.cssText = 'font-size:.68rem;font-weight:800;background:rgba(251,146,60,.1);color:#fb923c;border:1px solid rgba(251,146,60,.2);padding:.2rem .6rem;border-radius:999px;';
          e.textContent = '\u23f3 ' + enEspera + ' En Espera';
          body.appendChild(e);
        }

        group.appendChild(hdr);
        group.appendChild(body);
        container.appendChild(group);
      });
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    console.error("Dashboard Load Error:", e);
    const container = document.getElementById('dashboardRecentActivity');
    if (container) container.innerHTML = `<div style="text-align:center;padding:2.5rem;color:#f87171;"><p>Error al cargar datos: ${e.message}</p></div>`;
  }
}

function renderDashboardChart(timeGroups) {
  if (typeof Chart === 'undefined') return;
  const labels = [];
  const confirmed = [];
  const waitlist = [];
  let totalConfirmed = 0;
  let totalWaitlist = 0;

  Object.keys(timeGroups).forEach(h => {
    labels.push(h.split(' ')[0] + ' ' + (h.split(' ')[1] || ''));
    confirmed.push(timeGroups[h].confirmados);
    waitlist.push(timeGroups[h].espera);
    totalConfirmed += timeGroups[h].confirmados;
    totalWaitlist += timeGroups[h].espera;
  });

  const chartElBar = document.getElementById('horariosChart');
  if (chartElBar) {
    const ctxBar = chartElBar.getContext('2d');
    if (window.adminChart) window.adminChart.destroy();

    window.adminChart = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Confirmados', data: confirmed, backgroundColor: '#3b82f6', borderRadius: 8 },
          { label: 'En Espera', data: waitlist, backgroundColor: '#f59e0b', borderRadius: 8 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 11, weight: 'bold' } }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b' } },
          y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', stepSize: 1 } }
        }
      }
    });
  }

  const chartElDonut = document.getElementById('distributionChart');
  if (chartElDonut) {
    const ctxDonut = chartElDonut.getContext('2d');
    if (window.distChart) window.distChart.destroy();

    window.distChart = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Confirmados', 'En Espera'],
        datasets: [{
          data: [totalConfirmed, totalWaitlist],
          backgroundColor: ['#3b82f6', '#f59e0b'],
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 11, weight: 'bold' }, padding: 20 }
          }
        }
      }
    });
  }
}

let pvFilter = 'todos';
let pvAllVotos = [];

async function loadVotosDetail() {
  const container = document.getElementById('passengerListDetail');
  if (!container) return;
  container.innerHTML = '<div class="pv-empty"><div class="pv-spin"></div><p>Sincronizando...</p></div>';

  document.querySelectorAll('[data-pv-filter]:not(._pvwired)').forEach(btn => {
    btn.classList.add('_pvwired');
    btn.addEventListener('click', () => {
      pvFilter = btn.dataset.pvFilter;
      document.querySelectorAll('[data-pv-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderVotosDetail();
    });
  });

  const today = getCycleDate();
  const { data: votos, error } = await supabase
    .from('votos').select('*')
    .eq('fecha', today)
    .order('horario').order('created_at');

  if (error || !votos) {
    container.innerHTML = '<div class="pv-empty"><p>No hay pasajeros registrados hoy.</p></div>';
    return;
  }

  pvAllVotos = votos;
  renderVotosDetail();
}

function renderVotosDetail() {
  const container = document.getElementById('passengerListDetail');
  if (!container) return;

  const IDA_KW = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
  const isIda = h => IDA_KW.some(k => h.includes(k));

  let filtered = pvAllVotos;
  if (pvFilter === 'ida') filtered = pvAllVotos.filter(v => isIda(v.horario));
  if (pvFilter === 'vuelta') filtered = pvAllVotos.filter(v => !isIda(v.horario));

  const pvStatTotal = document.getElementById('pvStatTotal');
  const pvStatEspera = document.getElementById('pvStatEspera');
  const pvStatHorarios = document.getElementById('pvStatHorarios');

  // Calcular estadísticas basadas en el límite de 30 por horario
  let totalConfirmadosVisual = 0;
  let totalEsperaVisual = 0;
  const tempGroups = {};
  pvAllVotos.forEach(v => {
    if (!tempGroups[v.horario]) tempGroups[v.horario] = 0;
    tempGroups[v.horario]++;
    if (v.en_espera || tempGroups[v.horario] > 30) totalEsperaVisual++;
    else totalConfirmadosVisual++;
  });

  if (pvStatTotal) pvStatTotal.textContent = totalConfirmadosVisual || '-';
  if (pvStatEspera) pvStatEspera.textContent = totalEsperaVisual;
  if (pvStatHorarios) pvStatHorarios.textContent = new Set(pvAllVotos.map(v => v.horario)).size || '-';

  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = '<div class="pv-empty"><p>No hay pasajeros en este filtro.</p></div>';
    return;
  }

  const groups = {};
  filtered.forEach(v => {
    if (!groups[v.horario]) groups[v.horario] = [];
    groups[v.horario].push(v);
  });

  Object.entries(groups).forEach(([horario, passengers]) => {
    const ida = isIda(horario);

    const group = document.createElement('div');
    group.className = 'pv-group';

    const hdr = document.createElement('div');
    hdr.className = 'pv-group-hdr';
    hdr.innerHTML =
      '<div class="pv-group-title">' + sanitize(horario) + '</div>' +
      '<div class="pv-group-meta">' +
      '<span class="pv-dir-pill ' + (ida ? 'pv-dir-ida' : 'pv-dir-vuelta') + '">' + (ida ? '\u2197 IDA' : '\u2199 VUELTA') + '</span>' +
      '<span class="pv-count-pill">' + passengers.length + ' persona' + (passengers.length !== 1 ? 's' : '') + '</span>' +
      '<i data-lucide="chevron-down" class="pv-chevron open"></i>' +
      '</div>';

    const body = document.createElement('div');
    body.className = 'pv-body';

    passengers.forEach((p, idx) => {
      const t = new Date(p.created_at);
      let hours = t.getHours();
      const minutes = t.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;
      const row = document.createElement('div');
      row.className = 'pv-row';
      row.innerHTML =
        '<div class="pv-num">' + (idx + 1) + '</div>' +
        '<div class="pv-info">' +
        '<div class="pv-name"></div>' +
        '<div class="pv-mat"></div>' +
        '</div>' +
        '<div class="pv-status">' +
        '<div class="pv-point"></div>' +
        '<span class="pv-badge"></span>' +
        '<div class="pv-time"></div>' +
        '</div>';

      row.querySelector('.pv-name').textContent = p.nombre || 'Sin nombre';
      row.querySelector('.pv-mat').textContent = (p.matricula || '') + (p.universidad ? ' · ' + p.universidad : '');
      row.querySelector('.pv-time').textContent = time;

      const isWaitlist = p.en_espera || (idx >= 30);
      const badge = row.querySelector('.pv-badge');
      badge.className = 'pv-badge ' + (isWaitlist ? 'pv-badge-espera' : 'pv-badge-ok');
      badge.textContent = isWaitlist ? 'Espera' : 'Confirmado';

      const pointDiv = row.querySelector('.pv-point');
      if (p.punto_espera === 'camino') {
        const s = document.createElement('span');
        s.className = 'pv-badge pv-badge-camino';
        s.textContent = '🚶 Camino';
        pointDiv.appendChild(s);
      } else if (p.punto_espera === 'parada') {
        const s = document.createElement('span');
        s.className = 'pv-badge pv-badge-parada';
        s.textContent = '📍 Parada';
        pointDiv.appendChild(s);
      }
      body.appendChild(row);
    });

    hdr.addEventListener('click', () => {
      const ch = hdr.querySelector('.pv-chevron');
      const isOpen = ch.classList.contains('open');
      body.style.display = isOpen ? 'none' : 'flex';
      ch.classList.toggle('open', !isOpen);
    });

    group.appendChild(hdr);
    group.appendChild(body);
    container.appendChild(group);
  });

  if (window.lucide) window.lucide.createIcons();
}

async function loadStaffData() {
  const tbody = document.getElementById('staffTableBodyNew');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:3rem;opacity:0.5;font-weight:bold;letter-spacing:0.2em;">SINCRONIZANDO...</td></tr>';

  try {
    const [profilesRes, penRes, faltasRes] = await Promise.all([
      supabase.from('profiles').select('*').order('nombre'),
      supabase.from('penalidades').select('usuario_id, total_faltas'),
      supabase.from('faltas').select('usuario_id')
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (penRes.error) throw penRes.error;
    if (faltasRes.error) throw faltasRes.error;

    const penalidadesMap = {};
    (penRes.data || []).forEach(p => {
      if (p.usuario_id) penalidadesMap[p.usuario_id] = p.total_faltas;
    });

    const activeFaltasMap = {};
    (faltasRes.data || []).forEach(f => {
      if (f.usuario_id) activeFaltasMap[f.usuario_id] = (activeFaltasMap[f.usuario_id] || 0) + 1;
    });

    staffData = (profilesRes.data || []).map(u => {
      const activeCount = activeFaltasMap[u.id] || 0;
      const penCount = penalidadesMap[u.id] || 0;
      return {
        ...u,
        total_faltas: Math.max(penCount, activeCount)
      };
    });

    updateStaffCounts();
    renderStaffTableNew();
  } catch (error) {
    console.error('Error fetching staff data:', error);
    window.showAdminToast('Error al conectar con la base de datos', 'error');
  }
}

function updateStaffCounts() {
  const setTotal = (statId, tabId, count) => {
    const elStat = document.getElementById(statId);
    const elTab = document.getElementById(tabId);
    if (elStat) elStat.textContent = count;
    if (elTab) elTab.textContent = count;
  };

  const admins = staffData.filter(u => (u.rol || '').toLowerCase().includes('administrador')).length;
  const vols = staffData.filter(u => (u.rol || '').toLowerCase().includes('voluntario')).length;
  const ests = staffData.filter(u => (u.rol || '').toLowerCase().includes('estudiante')).length;
  const choferes = staffData.filter(u => (u.rol || '').toLowerCase().includes('chofer')).length;

  setTotal('staff-count-todos', 'tab-count-todos', staffData.length);
  setTotal('staff-count-admin', 'tab-count-admin', admins);
  setTotal('staff-count-voluntario', 'tab-count-voluntario', vols);
  setTotal('staff-count-estudiante', 'tab-count-estudiante', ests);
  setTotal('staff-count-chofer', 'tab-count-chofer', choferes);
}

window.setStaffFilterNew = (f) => {
  staffFilter = f;
  document.querySelectorAll('.staff-filter-tab').forEach(el => {
    el.className = 'staff-filter-tab';
  });
  const activeBtn = document.getElementById(`tab-${f}`);
  if (activeBtn) {
    activeBtn.className = 'staff-filter-tab active';
  }
  renderStaffTableNew();
};

window.filterStaffNew = () => {
  renderStaffTableNew();
};

async function renderStaffTableNew() {
  const tbody = document.getElementById('staffTableBodyNew');
  if (!tbody) return;

  const searchInput = document.getElementById('staffSearchNew');
  const search = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = staffData;
  if (staffFilter !== 'todos') {
    filtered = filtered.filter(u => (u.rol || '').toLowerCase().includes(staffFilter));
  }
  if (search) {
    filtered = filtered.filter(u =>
      (u.nombre || '').toLowerCase().includes(search) ||
      (u.matricula || '').toLowerCase().includes(search) ||
      (u.telefono || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:4rem;color:#94a3b8;">
        <div style="font-size:2rem;margin-bottom:1rem;opacity:0.3;">🔍</div>
        <p style="font-weight:600;font-size:0.9rem;">No se encontraron resultados para tu búsqueda</p>
      </td></tr>
    `;
    return;
  }

  const userData = localStorage.getItem('aeudj_user');
  const localUser = userData ? JSON.parse(userData) : {};
  const currentId = localUser?.id || null;

  tbody.innerHTML = filtered.map(u => {
    const isSelf = u.id === currentId;
    const initials = (u.nombre || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    let badgeClass = 'staff-badge-gray';
    let badgeLabel = 'Estudiante';
    let icon = '🎓';

    const rolText = (u.rol || '').toLowerCase();
    if (rolText.includes('administrador')) { badgeClass = 'staff-badge-amber'; badgeLabel = 'Admin'; icon = '🛡️'; }
    else if (rolText.includes('voluntario')) { badgeClass = 'staff-badge-blue'; badgeLabel = 'Voluntario'; icon = '🙋'; }
    else if (rolText.includes('chofer')) { badgeClass = 'staff-badge-indigo'; badgeLabel = 'Chofer'; icon = '🚌'; }

    const esComite = rolText.includes('comité') || rolText.includes('comite') || rolText.includes('miembro');
    const comiteBadge = esComite ? `<span style="background:rgba(236,72,153,0.15); color:#f472b6; padding:0.15rem 0.4rem; border-radius:0.3rem; font-size:0.65rem; font-weight:800; border:1px solid rgba(236,72,153,0.3); margin-top:0.3rem; display:inline-flex; align-items:center; gap:0.2rem;"><i data-lucide="star" style="width:10px;height:10px;"></i> COMITÉ</span>` : '';

    const charCode = initials.charCodeAt(0) || 65;
    const colors = ['linear-gradient(135deg,#3b82f6,#2563eb)', 'linear-gradient(135deg,#10b981,#059669)', 'linear-gradient(135deg,#f59e0b,#d97706)', 'linear-gradient(135deg,#8b5cf6,#6d28d9)', 'linear-gradient(135deg,#ec4899,#be185d)'];
    const avatarBg = colors[charCode % colors.length];

    const totalFaltas = u.total_faltas || 0;
    const clsFalta = totalFaltas >= 3 ? 'high' : totalFaltas >= 2 ? 'med' : 'low';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.75rem">
            <div class="staff-avatar-new" style="background:${avatarBg}">${initials}</div>
            <div>
              <div class="staff-name-new">${sanitize(u.nombre)}</div>
              <div class="staff-meta-new">${u.telefono ? `📞 ${sanitize(u.telefono)}` : 'Sin teléfono'}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:0.4rem; align-items:flex-start;">
             <span class="staff-badge ${badgeClass}">${icon} ${badgeLabel}</span>
             ${comiteBadge}
             <select 
               data-user-id="${u.id}"
               class="staff-role-select"
               style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:0.7rem; border-radius:4px; padding:2px 4px; outline:none; margin-top:0.3rem;"
             >
               <option value="estudiante" ${!rolText.includes('comit') && rolText.includes('estudiante') ? 'selected' : ''}>Estudiante</option>
               <option value="estudiante, comité" ${rolText.includes('comit') && rolText.includes('estudiante') ? 'selected' : ''}>Estudiante (Comité)</option>
               <option value="voluntario" ${!rolText.includes('comit') && rolText.includes('voluntario') ? 'selected' : ''}>Voluntario</option>
               <option value="voluntario, comité" ${rolText.includes('comit') && rolText.includes('voluntario') ? 'selected' : ''}>Voluntario (Comité)</option>
               <option value="administrador" ${!rolText.includes('comit') && rolText.includes('administrador') ? 'selected' : ''}>Administrador</option>
               <option value="administrador, comité" ${rolText.includes('comit') && rolText.includes('administrador') ? 'selected' : ''}>Administrador (Comité)</option>
               <option value="chofer" ${rolText.includes('chofer') ? 'selected' : ''}>Chofer</option>
             </select>
          </div>
        </td>
        <td><code style="font-size:.78rem;color:#94a3b8;background:rgba(0,0,0,.25);padding:.2rem .5rem;border-radius:.4rem;border:1px solid rgba(255,255,255,0.05);">${sanitize(u.matricula) || 'N/A'}</code></td>
        <td>
          <span class="falta-count ${clsFalta}">${totalFaltas} / 3</span>
        </td>
        <td>
          <div class="staff-row-actions" style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button class="staff-icon-btn btn-edit-user" data-user-id="${u.id}" style="color:#60a5fa;border:1px solid rgba(96,165,250,0.3);background:rgba(96,165,250,0.1);padding:0.4rem;border-radius:0.4rem;cursor:pointer;" title="Editar Datos">
              ✏️
            </button>
            <button class="staff-icon-btn danger btn-delete-user" data-user-id="${u.id}" style="color:#ef4444;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);padding:0.4rem;border-radius:0.4rem;cursor:pointer;" title="Eliminar Cuenta" ${isSelf ? 'disabled style="opacity:0.2;cursor:not-allowed;"' : ''}>
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Event Delegation for the table
  if (!tbody.dataset.wired) {
    tbody.dataset.wired = "true";
    tbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('staff-role-select')) {
        window.updateUserRoleNew(e.target.dataset.userId, e.target.value);
      }
    });
    tbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-user');
      const deleteBtn = e.target.closest('.btn-delete-user');
      if (editBtn) window.editUserNew(editBtn.dataset.userId);
      if (deleteBtn) window.deleteUserNew(deleteBtn.dataset.userId);
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

window.updateUserRoleNew = async (userId, newRole) => {
  window.showAdminToast('Actualizando rol...', 'info');
  const { data, error } = await supabase.from('profiles').update({ rol: newRole }).eq('id', userId).select();
  if (error) {
    window.showAdminToast('Error al actualizar', 'error');
  } else if (!data || data.length === 0) {
    window.showAdminToast('Permiso denegado (RLS) o usuario no encontrado', 'error');
  } else {
    window.showAdminToast('Rol actualizado correctamente', 'success');
    await loadStaffData();
  }
};

window.deleteUserNew = async (userId) => {
  if (typeof window.aeudjConfirm !== 'function') {
    if (!confirm('Esta acción es permanente. ¿Deseas eliminar esta cuenta?')) return;
  } else {
    const confirmed = await window.aeudjConfirm('Esta acción es permanente y no se puede deshacer. ¿Deseas eliminar esta cuenta?', {
      title: '¿Eliminar usuario?',
      type: 'danger',
      okText: 'Sí, eliminar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;
  }

  window.showAdminToast('Eliminando registros...', 'info');

  try {
    // 1. Borrar dependencias (penalidades, faltas, votos) para evitar errores de llave foránea
    await supabase.from('penalidades').delete().eq('usuario_id', userId);
    await supabase.from('faltas').delete().eq('usuario_id', userId);
    await supabase.from('votos').delete().eq('usuario_id', userId);

    // 2. Borrar el perfil público
    const { data, error } = await supabase.from('profiles').delete().eq('id', userId).select();

    if (error) {
      console.error('Delete error:', error);
      window.showAdminToast(error.message || 'Error al eliminar usuario', 'error');
    } else if (!data || data.length === 0) {
      window.showAdminToast('Permiso denegado por políticas de seguridad (RLS)', 'error');
    } else {
      window.showAdminToast('Usuario y sus registros eliminados correctamente', 'success');
      await loadStaffData();
    }
  } catch (err) {
    console.error('Process error:', err);
    window.showAdminToast('Error inesperado al limpiar registros', 'error');
  }
};

// ── HORARIOS ───────────────────────────────────────
let adminSelectedDay = 'Lunes';

async function loadHorariosData() {
  renderDayTabs();
  await renderAdminHorarioGrid();
}

function renderDayTabs() {
  const tabs = document.getElementById('adminDayTabs');
  if (!tabs) return;
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  tabs.innerHTML = days.map(d => {
    const active = adminSelectedDay === d;
    return `<button data-day="${d}" class="admin-day-tab" style="padding:0.4rem 1rem; border-radius:0.6rem; font-weight:800; font-size:0.72rem; border:none; cursor:pointer; white-space:nowrap; transition:all 0.15s; background:${active ? '#4f75ff' : 'transparent'}; color:${active ? '#fff' : '#6b7280'}; letter-spacing:0.03em;">${d}</button>`;
  }).join('');

  if (!tabs.dataset.wired) {
    tabs.dataset.wired = "true";
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-day-tab');
      if (btn) window.setAdminActiveDay(btn.dataset.day);
    });
  }
}

window.setAdminActiveDay = async (day) => {
  adminSelectedDay = day;
  renderDayTabs();
  const label = document.getElementById('adminActiveDayLabel');
  if (label) label.textContent = `Horarios del ${day}`;
  await renderAdminHorarioGrid();
}

async function renderAdminHorarioGrid() {
  const grid = document.getElementById('adminHorarioGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem 0;opacity:0.2;"><div class="spinner" style="margin:0 auto 1rem;"></div><p style="letter-spacing:0.4em;font-weight:900;">CARGANDO...</p></div>';

  let times = [
    { time: '7:00 AM', route: 'Jarabacoa → La Vega', dir: 'ida' },
    { time: '9:00 AM', route: 'Jarabacoa → La Vega', dir: 'ida' },
    { time: '12:10 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '1:00 PM', route: 'Jarabacoa → La Vega', dir: 'ida' },
    { time: '2:15 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '3:00 PM', route: 'Jarabacoa → La Vega', dir: 'ida' },
    { time: '4:10 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '5:00 PM', route: 'Jarabacoa → La Vega', dir: 'ida' },
    { time: '6:00 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '8:00 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '10:00 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
  ];

  if (adminSelectedDay === 'Sábado') {
    times = times.filter(t => t.time === '7:00 AM' || t.time === '12:10 PM');
  }

  const { data: allUsers } = await supabase.from('profiles').select('*').ilike('rol', '%voluntario%');
  const volunteers = allUsers || [];

  grid.innerHTML = '';

  times.forEach(t => {
    const fullText = `${t.time} ${t.route}`;
    const assigned = volunteers.filter(v => {
      try {
        const scheds = JSON.parse(v.horario_asignado || '{}');
        return scheds[adminSelectedDay] && scheds[adminSelectedDay].includes(fullText);
      } catch (e) {
        return v.dia_asignado === adminSelectedDay && v.horario_asignado === fullText;
      }
    });
    const isAssigned = assigned.length > 0;

    const isIda = t.dir === 'ida';
    const card = document.createElement('div');
    card.style.cssText = `background:#1e2a3a; border-radius:1rem; padding:1.2rem 1rem; display:flex; flex-direction:column; align-items:center; text-align:center; position:relative; transition:all 0.2s; cursor:pointer; border:2px solid ${isAssigned ? 'rgba(99,133,255,0.5)' : 'transparent'}; min-height:180px;`;
    card.onmouseenter = () => { if (!isAssigned) card.style.background = '#243044'; };
    card.onmouseleave = () => { if (!isAssigned) card.style.background = '#1e2a3a'; };

    const arrowIcon = isIda ? 'arrow-right' : 'arrow-left';
    const badgeBg = isIda ? 'rgba(99,133,255,0.2)' : 'rgba(138,99,255,0.2)';
    const badgeColor = isIda ? '#7fa3ff' : '#b99fff';
    const badgeLabel = isIda ? '↗ IDA' : '↙ VUELTA';

    card.innerHTML = `
      <div style="color:#7fa3ff; margin-bottom:0.5rem;">
        <i data-lucide="${arrowIcon}" style="width:20px;height:20px;"></i>
      </div>
      <div style="font-size:1.5rem; font-weight:900; color:#fff; margin-bottom:0.25rem; letter-spacing:-0.02em;">${t.time}</div>
      <div style="font-size:0.68rem; color:#6b7280; margin-bottom:0.6rem; font-weight:600;">${t.route}</div>
      <div style="background:${badgeBg}; color:${badgeColor}; font-size:0.62rem; font-weight:900; padding:0.2rem 0.65rem; border-radius:999px; margin-bottom:0.85rem; letter-spacing:0.05em;">${badgeLabel}</div>
      <div style="width:100%; margin-top:auto;">
        <select
          data-day="${adminSelectedDay}"
          data-time="${fullText}"
          class="volunteer-slot-select"
          style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.08); color:#fff; font-size:0.72rem; font-weight:700; padding:0.5rem 0.75rem; border-radius:0.6rem; outline:none; cursor:pointer; appearance:none; background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22rgba(255,255,255,0.35)%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22/></svg>'); background-repeat:no-repeat; background-position:right 0.6rem center; background-size:0.9em; padding-right:2rem;"
        >
          <option value="">— Voluntario —</option>
          ${volunteers.map(v => `<option value="${v.id}" ${isAssigned && assigned[0].id === v.id ? 'selected' : ''}>${v.nombre}</option>`).join('')}
        </select>
      </div>
      ${isAssigned ? `<div style="position:absolute;top:0.6rem;right:0.6rem;width:1.1rem;height:1.1rem;background:#4f75ff;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i data-lucide="check" style="width:10px;height:10px;color:#fff;"></i></div>` : ''}
    `;
    grid.appendChild(card);
  });

  // Event Delegation for the grid
  if (!grid.dataset.wired) {
    grid.dataset.wired = "true";
    grid.addEventListener('change', (e) => {
      if (e.target.classList.contains('volunteer-slot-select')) {
        window.assignVolunteerToSlot(e.target.dataset.day, e.target.dataset.time, e.target.value);
      }
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

window.assignVolunteerToSlot = async (day, time, volunteerId) => {
  const { data: allUsers, error: fetchErr } = await supabase.from('profiles').select('*').ilike('rol', '%voluntario%');
  if (fetchErr) {
    window.showAdminToast('Error de red', 'error');
    return;
  }

  const promises = [];

  for (const v of allUsers) {
    let scheds = {};
    try {
      scheds = JSON.parse(v.horario_asignado || '{}');
    } catch (e) {
      if (v.dia_asignado && v.horario_asignado && !v.horario_asignado.startsWith('{')) {
        scheds[v.dia_asignado] = [v.horario_asignado];
      }
    }

    if (!scheds[day]) scheds[day] = [];

    let changed = false;

    if (v.id !== volunteerId) {
      if (scheds[day].includes(time)) {
        scheds[day] = scheds[day].filter(t => t !== time);
        changed = true;
      }
    } else {
      if (!scheds[day].includes(time)) {
        scheds[day].push(time);
        changed = true;
      }
    }

    if (changed) {
      promises.push(
        supabase.from('profiles')
          .update({
            horario_asignado: JSON.stringify(scheds),
            dia_asignado: day
          })
          .eq('id', v.id)
      );
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }

  window.showAdminToast('Turno asignado correctamente', 'success');
  loadHorariosData();
};



window.clearTodayVotes = async function () {
  const isDeep = confirm('¿Quieres realizar una LIMPIEZA PROFUNDA?\n\n- "Aceptar": Borra Votos, Faltas y Penalidades (Reseteo Total).\n- "Cancelar": Solo borra los votos de hoy.');

  try {
    const today = getCycleDate();
    const { error: err1 } = await supabase.from('votos').delete().eq('fecha', today);
    if (err1) throw err1;

    if (isDeep) {
      const { error: err2 } = await supabase.from('faltas').delete().neq('id', 0);
      if (err2) throw err2;
      const { error: err3 } = await supabase.from('penalidades').delete().neq('id', 0);
      if (err3) throw err3;
      window.showAdminToast('¡SISTEMA RESETEADO TOTALMENTE!', 'success');
    } else {
      window.showAdminToast('Votos de hoy eliminados correctamente', 'success');
    }

    loadDashboardData();
    if (!document.getElementById('screen-votos').classList.contains('hidden')) loadVotosDetail();
    if (!document.getElementById('screen-penalidades').classList.contains('hidden')) loadPenalidadesData();
    if (!document.getElementById('screen-logs').classList.contains('hidden')) window.loadAuditData();

  } catch (e) {
    console.error("Reset error:", e);
    window.showAdminToast('Error en el reseteo', 'error');
  }
};

async function initSessionControl() {
  const toggle = document.getElementById('sessionOverrideToggle');
  const display = document.getElementById('sessionDisplay');
  const statusText = document.getElementById('sessionStatusText');

  if (!toggle) return;

  const { data } = await supabase.from('voting_config').select('*').eq('id', 1).maybeSingle();

  const isManual = data ? data.manual_override : (localStorage.getItem('aeudj_manual_session') === 'true');
  const session = data ? data.active_session : (localStorage.getItem('aeudj_active_session') || 'manana');

  toggle.checked = (session === 'tarde');
  if (statusText) statusText.textContent = isManual ? 'MODO: MANUAL (FORZADO)' : 'MODO: AUTOMÁTICO';
  if (display) display.innerHTML = (session === 'tarde') ? '🌙 Vespertina' : '☀️ Matutina';

  toggle.onchange = async () => {
    const isTarde = toggle.checked;
    const newSession = isTarde ? 'tarde' : 'manana';

    if (display) display.innerHTML = isTarde ? '🌙 Vespertina' : '☀️ Matutina';
    if (statusText) statusText.textContent = 'MODO: MANUAL (FORZADO)';

    localStorage.setItem('aeudj_manual_session', 'true');
    localStorage.setItem('aeudj_active_session', newSession);

    try {
      await supabase.from('voting_config').upsert({
        id: 1,
        manual_override: true,
        active_session: newSession
      });
      window.showAdminToast(`Sesión forzada a ${isTarde ? 'Vespertina' : 'Matutina'}`, 'info');
    } catch (e) {
      console.error("Error saving config:", e);
    }
  };
}

window.resetQuickAddForm = () => {
  const editId = document.getElementById('qa-edit-id');
  const title = document.getElementById('qa-title');
  const btn = document.getElementById('qa-submit-btn');
  const cancelBtn = document.getElementById('qa-cancel-btn');
  const passContainer = document.getElementById('qa-password-container');

  if (editId) editId.value = '';
  if (title) title.innerHTML = '➕ Agregar Personal';
  if (btn) {
    btn.innerHTML = '👤 Agregar al Directorio';
    btn.style.background = '';
    btn.style.color = '';
  }
  if (cancelBtn) cancelBtn.classList.add('hidden');
  if (passContainer) passContainer.style.display = 'block';

  const fields = ['qa-nombre', 'qa-telefono', 'qa-matricula', 'qa-password', 'qa-email'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });
  const rol = document.getElementById('qa-rol');
  if (rol) rol.value = 'estudiante';
};

window.editUserNew = async (id) => {
  const user = staffData.find(u => u.id === id);
  if (!user) return;

  const editId = document.getElementById('qa-edit-id');
  const title = document.getElementById('qa-title');
  const nombre = document.getElementById('qa-nombre');
  const tel = document.getElementById('qa-telefono');
  const mat = document.getElementById('qa-matricula');
  const email = document.getElementById('qa-email');
  const passContainer = document.getElementById('qa-password-container');

  if (editId) editId.value = id;
  if (title) title.innerHTML = '✏️ Editar Personal';
  if (nombre) nombre.value = user.nombre || '';
  if (tel) tel.value = user.telefono || '';
  if (mat) mat.value = user.matricula || '';
  if (email) email.value = user.email || '';

  if (passContainer) passContainer.style.display = 'none';

  const rolText = (user.rol || '').toLowerCase();
  const selectRol = document.getElementById('qa-rol');
  if (selectRol) {
    let matchedValue = 'estudiante';
    for (let i = 0; i < selectRol.options.length; i++) {
      if (selectRol.options[i].value === rolText) {
        matchedValue = rolText;
        break;
      }
    }
    selectRol.value = matchedValue;
  }

  const submitBtn = document.getElementById('qa-submit-btn');
  if (submitBtn) {
    submitBtn.innerHTML = '💾 Guardar Cambios';
    submitBtn.style.background = 'rgba(16,185,129,0.2)';
    submitBtn.style.color = '#34d399';
  }
  const cancelBtn = document.getElementById('qa-cancel-btn');
  if (cancelBtn) cancelBtn.classList.remove('hidden');

  const panel = document.getElementById('qa-panel-container');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.handleQuickAddStaff = async () => {
  const editIdEl = document.getElementById('qa-edit-id');
  const editId = editIdEl ? editIdEl.value : '';
  const isEditing = editId !== '';

  const btn = document.getElementById('qa-submit-btn');
  if (!btn) return;
  const ogText = btn.innerHTML;
  btn.innerHTML = '⏳ Procesando...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  try {
    const nombre = document.getElementById('qa-nombre').value.trim();
    const telefono = document.getElementById('qa-telefono').value.trim();
    const matricula = document.getElementById('qa-matricula').value.trim();
    const password = document.getElementById('qa-password') ? document.getElementById('qa-password').value.trim() : '';
    const rol = document.getElementById('qa-rol').value;
    const emailInput = document.getElementById('qa-email');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!nombre || !matricula) {
      throw new Error("Nombre y matrícula son obligatorios.");
    }

    if (isEditing) {
      const { data, error } = await supabase.from('profiles').update({
        nombre: nombre,
        telefono: telefono,
        matricula: matricula,
        email: email,
        rol: rol
      }).eq('id', editId).select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Bloqueado por RLS: No tienes permisos para editar otros perfiles.');
      }

      window.showAdminToast('Usuario actualizado correctamente', 'success');
      window.resetQuickAddForm();
      await loadStaffData();

    } else {
      if (!password) throw new Error("La contraseña es obligatoria para nuevos usuarios.");
      if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

      const correoUsar = email || `${matricula.replace(/\s+/g, '')}@aeudj.com`;

      const { data: currentSessionData } = await supabase.auth.getSession();
      const adminSession = currentSessionData?.session;

      const { data: auth, error: authErr } = await supabase.auth.signUp({
        email: correoUsar,
        password: password
      });

      if (authErr) throw authErr;

      const { error: profileErr } = await supabase.from('profiles').insert([
        { id: auth.user.id, nombre, matricula, telefono, rol, email: correoUsar, universidad: 'Indefinida' }
      ]);

      if (profileErr) throw profileErr;

      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        });
      }

      window.showAdminToast('Usuario creado correctamente', 'success');
      window.resetQuickAddForm();
      await loadStaffData();
    }

  } catch (err) {
    console.error(err);
    window.showAdminToast(err.message || 'Error en la operación', 'error');
  } finally {
    btn.innerHTML = ogText;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
};

window.downloadCajaReport = () => {
  const fecha = new Date().toLocaleDateString('es-ES');
  const ingresosEl = document.getElementById('statIngresosReales');
  const totalIngresos = ingresosEl ? ingresosEl.textContent : '0';
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Reporte de Caja - AEUDJ</title>
    <style>
      body { font-family: sans-serif; padding: 2rem; color: #333; }
      h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; }
      .caja { border: 1px solid #e2e8f0; background: #f8fafc; padding: 1.5rem; margin-top: 2rem; border-radius: 8px; }
      .valor { font-size: 2.5rem; font-weight: bold; color: #10b981; margin: 1rem 0; }
    </style>
    </head><body>
      <h1>Reporte Diario de Caja - AEUDJ</h1>
      <p><strong>Fecha:</strong> ${fecha}</p>
      <div class="caja">
        <p>Estimado de ingresos generados en los horarios matutinos y de 3:00 PM:</p>
        <div class="valor">${totalIngresos}</div>
        <p style="font-size:0.9rem;color:#64748b;">(Basado en los pasajeros que no están en lista de espera)</p>
      </div>
      <p style="margin-top:3rem; font-size:0.8rem; color:#94a3b8; text-align:center;">Documento generado automáticamente por el Panel Administrativo AEUDJ.</p>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 800);
};

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (e) { }
    localStorage.clear();
    window.location.href = 'index.html';
  });
}

// ── PENALIDADES ───────────────────────────────────────────────────────────────
let allPenalidadesCombined = [];
let penCurrentPage = 0;
let histCurrentPage = 0;
const PEN_PAGE_SIZE = 15;

async function loadPenalidadesData() {
  try {
    const { data: pens } = await supabase
      .from('penalidades').select('*').order('total_faltas', { ascending: false });
    const { data: faltas } = await supabase
      .from('faltas').select('*').order('created_at', { ascending: false });
    const { data: profiles } = await supabase
      .from('profiles').select('id, nombre, matricula, email').order('nombre');
    let histVotesArr = [];
    let start = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch, error: batchErr } = await supabase
        .from('votos')
        .select('*')
        .eq('se_monto', 0)
        .range(start, start + batchSize - 1);
      if (batchErr) throw batchErr;
      if (!batch || batch.length === 0) break;
      histVotesArr = histVotesArr.concat(batch);
      if (batch.length < batchSize) break;
      start += batchSize;
    }

    const penalArr = pens || [];
    const faltaArr = faltas || [];
    const profilesArr = profiles || [];

    const penalizados = penalArr.filter(p => p.penalizado).length;
    const levantadas = penalArr.filter(p => !p.penalizado && p.total_faltas === 0 && p.fecha_penalidad).length;

    const penStatPen = document.getElementById('penStatPen');
    const penStatFaltas = document.getElementById('penStatFaltas');
    const penStatLevantadas = document.getElementById('penStatLevantadas');
    if (penStatPen) penStatPen.textContent = penalizados;
    if (penStatFaltas) penStatFaltas.textContent = histVotesArr.length;
    if (penStatLevantadas) penStatLevantadas.textContent = levantadas;

    const badge = document.getElementById('penalBadge');
    if (badge) {
      if (penalizados > 0) {
        badge.textContent = penalizados;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    allPenalidades = pens || [];
    allFaltasHistorial = histVotesArr;

    const pensMap = {};
    allPenalidades.forEach(p => {
      if (p.usuario_id) pensMap[p.usuario_id] = p;
    });

    const activeFaltasCountMap = {};
    faltaArr.forEach(f => {
      const uid = f.usuario_id;
      if (uid) activeFaltasCountMap[uid] = (activeFaltasCountMap[uid] || 0) + 1;
    });

    const histFaltasCountMap = {};
    histVotesArr.forEach(f => {
      const uid = f.usuario_id;
      if (uid) histFaltasCountMap[uid] = (histFaltasCountMap[uid] || 0) + 1;
    });

    allPenalidadesCombined = profilesArr.map(prof => {
      const pEntry = pensMap[prof.id] || {};
      const dbActiveFaltas = activeFaltasCountMap[prof.id] || 0;
      const histFaltas = histFaltasCountMap[prof.id] || 0;
      
      const penalizado = pEntry.penalizado !== undefined ? pEntry.penalizado : (dbActiveFaltas >= 3);
      const activeFaltas = dbActiveFaltas;
      
      return {
        usuario_id: prof.id,
        nombre: prof.nombre,
        matricula: prof.matricula,
        email: prof.email || '',
        active_faltas: activeFaltas,
        historical_faltas: histFaltas,
        penalizado: penalizado,
        fecha_penalidad: pEntry.fecha_penalidad || null
      };
    }).sort((a, b) => b.active_faltas - a.active_faltas || b.historical_faltas - a.historical_faltas);

    penCurrentPage = 0;
    histCurrentPage = 0;
    window.filterPenalidades(); // Aplicar filtro inicial

    document.querySelectorAll('.pen-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.pen-tab').forEach(b => { b.classList.remove('active'); b.classList.remove('active-blue'); });
        const p1 = document.getElementById('penTab-penalizados');
        const p2 = document.getElementById('penTab-historial');
        if (p1) p1.classList.add('hidden');
        if (p2) p2.classList.add('hidden');
        activePenTab = btn.dataset.penTab;
        const target = document.getElementById(`penTab-${activePenTab}`);
        if (target) target.classList.remove('hidden');
        btn.classList.add(activePenTab === 'historial' ? 'active-blue' : 'active');
        window.filterPenalidades();
      };
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error cargando penalidades:', err);
  }
}

window.filterPenalidades = (resetPage = true) => {
  const query = document.getElementById('penSearch')?.value.toLowerCase() || '';
  const dateVal = document.getElementById('penDate')?.value || '';
  const showOnlyPenalized = document.getElementById('penShowOnlyPenalized')?.checked === true;

  if (activePenTab === 'penalizados') {
    if (resetPage) penCurrentPage = 0;
    const filtered = allPenalidadesCombined.filter(p => {
      if (showOnlyPenalized && !p.penalizado) return false;
      if (!showOnlyPenalized && p.active_faltas < 1 && p.historical_faltas < 1) return false;
      if (query) {
        return p.nombre?.toLowerCase().includes(query) || p.matricula?.toLowerCase().includes(query);
      }
      return true;
    });
    renderPenalizados(filtered);
  } else {
    // Filtrar inasistencias por la query de búsqueda
    const queryFiltered = allFaltasHistorial.filter(f => {
      if (!query) return true;
      return f.nombre?.toLowerCase().includes(query) || f.matricula?.toLowerCase().includes(query);
    });

    // Agrupar por fecha
    const groupedByDate = {};
    queryFiltered.forEach(f => {
      if (!f.fecha) return;
      if (!groupedByDate[f.fecha]) {
        groupedByDate[f.fecha] = [];
      }
      groupedByDate[f.fecha].push(f);
    });

    // Fechas únicas ordenadas descendentemente (más recientes primero)
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

    if (dateVal) {
      const targetIndex = sortedDates.indexOf(dateVal);
      if (targetIndex !== -1) {
        histActiveDateIndex = targetIndex;
      } else {
        histActiveDateIndex = -1;
      }
    } else {
      if (resetPage || histActiveDateIndex < 0 || histActiveDateIndex >= sortedDates.length) {
        histActiveDateIndex = sortedDates.length > 0 ? 0 : -1;
      }
    }

    let activeDateStr = 'Sin registros';
    let activeFaltas = [];
    if (histActiveDateIndex !== -1 && sortedDates.length > 0) {
      activeDateStr = sortedDates[histActiveDateIndex];
      activeFaltas = groupedByDate[activeDateStr] || [];
    } else if (dateVal) {
      activeDateStr = dateVal;
    }

    renderHistorial(activeFaltas, activeDateStr, histActiveDateIndex, sortedDates.length, sortedDates);
  }
};

function renderPenalizados(pens) {
  const container = document.getElementById('penalizadosTable');
  if (!container) return;
  if (!pens.length) {
    const showOnlyPenalized = document.getElementById('penShowOnlyPenalized')?.checked === true;
    container.innerHTML = showOnlyPenalized
      ? '<div class="empty-pen">✅ Ningún estudiante está penalizado actualmente.</div>'
      : '<div class="empty-pen">✅ No hay faltas registradas en el sistema.</div>';
    return;
  }

  const totalPages = Math.ceil(pens.length / PEN_PAGE_SIZE);
  penCurrentPage = Math.min(penCurrentPage, totalPages - 1);
  const start = penCurrentPage * PEN_PAGE_SIZE;
  const pageItems = pens.slice(start, start + PEN_PAGE_SIZE);

  let html = `<table class="pen-table">
    <thead><tr>
      <th>Nombre</th>
      <th>Matrícula</th>
      <th>Email</th>
      <th>Faltas Activas</th>
      <th>Historial</th>
      <th>Estado</th>
      <th>Fecha Pen.</th>
      <th>Acción</th>
    </tr></thead><tbody>`;

  pageItems.forEach(p => {
    const activeFaltas = p.active_faltas;
    const histFaltas = p.historical_faltas;
    const cls = activeFaltas >= 3 ? 'high' : activeFaltas >= 2 ? 'med' : 'low';
    const penalizado = p.penalizado;

    const showNotify = activeFaltas >= 2;

    html += `<tr>
        <td class="name-cell">${sanitize(p.nombre) || '---'}</td>
        <td class="mat-cell">${sanitize(p.matricula) || '---'}</td>
        <td style="font-size:0.78rem;color:#64748b;">${sanitize(p.email) || '---'}</td>
        <td>
          <div class="active-faltas-container">
            <span class="falta-count ${cls}">${activeFaltas} / 3</span>
            <div class="active-faltas-dots">
              <span class="active-falta-dot ${activeFaltas >= 1 ? 'active' : 'inactive'}"></span>
              <span class="active-falta-dot ${activeFaltas >= 2 ? 'active' : 'inactive'}"></span>
              <span class="active-falta-dot ${activeFaltas >= 3 ? 'pulse-red' : 'inactive'}"></span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size:0.82rem;font-weight:600;color:#94a3b8;background:rgba(255,255,255,0.03);padding:0.2rem 0.5rem;border-radius:0.4rem;border:1px solid rgba(255,255,255,0.05);">${histFaltas} ${histFaltas === 1 ? 'falta' : 'faltas'}</span>
        </td>
        <td><span class="pen-badge ${penalizado ? 'penalizado' : 'activo'}">${penalizado ? '🚫 Penalizado' : '✅ Activo'}</span></td>
        <td>
          <button class="btn-ver-faltas" data-uid="${p.usuario_id}" data-nombre="${sanitize(p.nombre)}" data-matricula="${sanitize(p.matricula)}" data-email="${sanitize(p.email)}" data-active-faltas="${activeFaltas}" style="background:rgba(255, 255, 255, 0.04); border:1px solid rgba(255,255,255,0.08); color:#fbbf24; padding:0.35rem 0.6rem; border-radius:0.5rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem; font-size:0.75rem; transition:all 0.2s;" title="Ver historial detallado de faltas">
            <i data-lucide="calendar" style="width:13px;height:13px;"></i>
            <span>${p.fecha_penalidad ? new Date(p.fecha_penalidad).toLocaleDateString('es-ES') : 'Ver Faltas'}</span>
          </button>
        </td>
        <td>
          <div class="flex gap-2">
            ${(penalizado || activeFaltas > 0)
        ? `<button class="btn-levantar" data-uid="${p.usuario_id}" data-nombre="${sanitize(p.nombre)}">
                  🔓 Levantar
                 </button>`
        : '<span style="color:#475569;font-size:0.75rem;opacity:0.5;">—</span>'
      }
            ${showNotify
        ? `<button class="btn-notificar" data-uid="${p.usuario_id}" data-nombre="${sanitize(p.nombre)}" data-email="${sanitize(p.email)}" data-faltas="${activeFaltas}">
                  ✉️ Notificar
                 </button>`
        : ''
      }
          </div>
        </td>
      </tr>`;
  });

  html += '</tbody></table>';

  if (totalPages > 1) {
    html += `<div class="pen-pagination">
      <button class="pen-page-btn" id="penPrevBtn" ${penCurrentPage === 0 ? 'disabled' : ''}>
        <i data-lucide="chevron-up"></i>
      </button>
      <span class="pen-page-info">Pág. ${penCurrentPage + 1} / ${totalPages} &nbsp;·&nbsp; ${pens.length} registros</span>
      <button class="pen-page-btn" id="penNextBtn" ${penCurrentPage >= totalPages - 1 ? 'disabled' : ''}>
        <i data-lucide="chevron-down"></i>
      </button>
    </div>`;
  }

  container.innerHTML = html;

  // Wire pagination
  const prevBtn = container.querySelector('#penPrevBtn');
  const nextBtn = container.querySelector('#penNextBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => { penCurrentPage--; window.filterPenalidades(false); });
  if (nextBtn) nextBtn.addEventListener('click', () => { penCurrentPage++; window.filterPenalidades(false); });

  // Wire ver faltas buttons (calendar)
  container.querySelectorAll('.btn-ver-faltas').forEach(btn => {
    btn.onclick = () => {
      const uid = btn.getAttribute('data-uid');
      const nombre = btn.getAttribute('data-nombre');
      const matricula = btn.getAttribute('data-matricula');
      const email = btn.getAttribute('data-email');
      const activeFaltas = btn.getAttribute('data-active-faltas');
      window.showFaltasDetalleModal(uid, nombre, matricula, email, parseInt(activeFaltas) || 0);
    };
  });

  container.querySelectorAll('.btn-levantar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const nombre = btn.dataset.nombre;
      let confirmed = false;
      if (typeof window.aeudjConfirm === 'function') {
        confirmed = await window.aeudjConfirm(`¿Confirmas que ${nombre} ya pagó la penalidad de sus faltas activas? Esto reiniciará su contador de faltas a 0.`);
      } else {
        confirmed = confirm(`¿Confirmas que ${nombre} ya pagó la penalidad de sus faltas activas?`);
      }
      if (!confirmed) return;
      btn.disabled = true;
      btn.textContent = 'Procesando...';
      await levantarPenalidad(uid);
      loadPenalidadesData();
    });
  });

  container.querySelectorAll('.btn-notificar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { uid, nombre, email, faltas } = btn.dataset;
      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Enviando...';
      if (window.lucide) window.lucide.createIcons();

      try {
        await enviarCorreoPenalidad({ nombre, email, matricula: '' }, faltas);
        window.showAdminToast(`Notificación enviada a ${nombre}`);
      } catch (err) {
        console.error(err);
        window.showAdminToast('Error al enviar notificación', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderHistorial(faltas, activeDate, activeIndex, totalDays, sortedDates) {
  const container = document.getElementById('historialTable');
  if (!container) return;

  let formattedDate = 'Sin registros';
  if (activeDate && activeDate !== 'Sin registros') {
    const d = new Date(activeDate + 'T12:00:00');
    formattedDate = d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  }

  const prevDisabled = activeIndex >= totalDays - 1 || totalDays <= 1;
  const nextDisabled = activeIndex <= 0 || totalDays <= 1;

  let tableHtml = '';
  if (!faltas || faltas.length === 0) {
    tableHtml = `
      <div class="logbook-empty-state">
        <div class="logbook-empty-icon">
          <i data-lucide="calendar-x" style="width:24px;height:24px;"></i>
        </div>
        <div style="font-weight:700;color:#94a3b8;font-size:0.95rem;margin-bottom:0.25rem;">No hay faltas registradas</div>
        <p style="font-size:0.8rem;color:#64748b;margin:0;max-width:280px;">Ningún estudiante tiene inasistencias reportadas en este día de viaje.</p>
      </div>
    `;
  } else {
    tableHtml = `
      <div class="logbook-table-container">
        <table class="logbook-table">
          <thead>
            <tr>
              <th style="width: 60px;">#</th>
              <th>Nombre</th>
              <th>Matrícula</th>
              <th>Horario de viaje</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${faltas.map((f, i) => `
              <tr>
                <td style="font-weight: 700; color: #fbbf24;">${i + 1}</td>
                <td style="font-weight: 700; color: #f8fafc;">${sanitize(f.nombre) || '—'}</td>
                <td><code style="font-size:0.78rem;color:#fbbf24;background:rgba(251,191,36,0.08);padding:0.15rem 0.4rem;border-radius:0.3rem;border:1px solid rgba(251,191,36,0.15);">${sanitize(f.matricula) || '—'}</code></td>
                <td style="color:#e2e8f0;font-size:0.82rem;">${sanitize(f.horario) || '—'}</td>
                <td style="font-size:0.78rem;color:#64748b;">${sanitize(f.email) || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const paginationInfo = totalDays > 0 ? `Día ${activeIndex + 1} de ${totalDays}` : 'Día 0 de 0';

  container.innerHTML = `
    <div class="logbook-card">
      <div class="logbook-header">
        <div class="logbook-title-area">
          <span class="logbook-subtitle">📖 LIBRO DE REGISTRO DE FALTAS</span>
          <span class="logbook-date-display">${formattedDate}</span>
        </div>
        <div class="logbook-nav">
          <button class="logbook-nav-btn" id="logbookPrevBtn" ${prevDisabled ? 'disabled' : ''} title="Día anterior">
            <i data-lucide="chevron-left" style="width:20px;height:20px;"></i>
          </button>
          <span class="logbook-nav-info">${paginationInfo}</span>
          <button class="logbook-nav-btn" id="logbookNextBtn" ${nextDisabled ? 'disabled' : ''} title="Día siguiente">
            <i data-lucide="chevron-right" style="width:20px;height:20px;"></i>
          </button>
        </div>
      </div>
      
      ${tableHtml}
    </div>
  `;

  const prevBtn = container.querySelector('#logbookPrevBtn');
  const nextBtn = container.querySelector('#logbookNextBtn');

  if (prevBtn) {
    prevBtn.onclick = () => {
      histActiveDateIndex++;
      const nextDate = sortedDates[histActiveDateIndex];
      const dateInput = document.getElementById('penDate');
      if (dateInput && nextDate) {
        dateInput.value = nextDate;
      }
      window.filterPenalidades(false);
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      histActiveDateIndex--;
      const nextDate = sortedDates[histActiveDateIndex];
      const dateInput = document.getElementById('penDate');
      if (dateInput && nextDate) {
        dateInput.value = nextDate;
      }
      window.filterPenalidades(false);
    };
  }

  if (window.lucide) window.lucide.createIcons();
}

async function levantarPenalidad(usuarioId) {
  try {
    const { data: activeRows, error: fetchErr } = await supabase
      .from('faltas')
      .select('id')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: true });

    if (fetchErr) throw fetchErr;

    const currentCount = activeRows ? activeRows.length : 0;
    const toDeleteCount = Math.min(3, currentCount);

    if (toDeleteCount > 0) {
      const idsToDelete = activeRows.slice(0, toDeleteCount).map(r => r.id);
      const { error: deleteErr } = await supabase
        .from('faltas')
        .delete()
        .in('id', idsToDelete);

      if (deleteErr) throw deleteErr;
    }

    const newCount = Math.max(0, currentCount - 3);
    const stillPenalized = newCount >= 3;

    const { error: updateErr } = await supabase
      .from('penalidades')
      .update({
        total_faltas: newCount,
        penalizado: stillPenalized,
        fecha_penalidad: stillPenalized ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('usuario_id', usuarioId);

    if (updateErr) throw updateErr;
  } catch (err) {
    console.error('Error levantando penalidad:', err);
    alert('Error al levantar la penalidad. Intenta de nuevo.');
  }
}

async function enviarCorreoPenalidad(p, totalFaltas) {
  if (!window.emailjs || EMAILJS_PUBLIC === 'TU_PUBLIC_KEY') {
    console.warn('EmailJS no configurado.');
    return;
  }
  try {
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_name: p.nombre,
      to_email: p.email,
      total_faltas: totalFaltas,
      fecha: new Date().toLocaleDateString('es-ES'),
    });
  } catch (e) {
    console.error('Error enviando email:', e);
    throw e;
  }
}

// ── PASE DE LISTA ADMIN ──────────────────────────────────
let adminListaData = [];
let adminListaFilter = 'todos';
let adminAttendanceState = {};

async function loadAdminLista() {
  const container = document.getElementById('adminListContainer');
  if (!container) return;
  container.innerHTML = '<div class="flex flex-col items-center justify-center py-10 opacity-50"><div class="spinner-small mb-4"></div><p class="text-sm font-bold uppercase tracking-widest text-white">Sincronizando...</p></div>';

  document.querySelectorAll('[data-vl-filter]:not(._vlwired)').forEach(btn => {
    btn.classList.add('_vlwired');
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-vl-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.filterAdminLista(btn.dataset.vlFilter);
    });
  });

  const today = getCycleDate();
  const { data, error } = await supabase
    .from('votos').select('*')
    .eq('fecha', today)
    .order('horario')
    .order('created_at');

  if (error) {
    container.innerHTML = `<div class="text-red-500 text-center py-4 font-bold">Error: ${error.message}</div>`;
    return;
  }

  adminListaData = data || [];

  const uniqueMap = new Map();
  const IDA_KW = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
  const getDir = h => IDA_KW.some(k => h.includes(k)) ? 'ida' : 'vuelta';

  adminListaData.forEach(v => {
    const key = `${v.matricula || v.usuario_id}-${getDir(v.horario)}`;
    if (!uniqueMap.has(key) || new Date(v.created_at) > new Date(uniqueMap.get(key).created_at)) {
      uniqueMap.set(key, v);
    }
  });
  adminListaData = Array.from(uniqueMap.values());

  adminListaData.forEach(v => {
    if (v.se_monto === 1) adminAttendanceState[v.id] = 'subio';
    else if (v.se_monto === 0) adminAttendanceState[v.id] = 'no-subio';
  });

  renderAdminLista();
}

window.filterAdminLista = (filter) => {
  adminListaFilter = filter;
  document.querySelectorAll('[id^="adminListFilter-"]').forEach(b => b.classList.remove('bg-blue-500/20', 'text-blue-400', 'border-blue-500/50'));
  const activeBtn = document.getElementById(`adminListFilter-${filter}`);
  if (activeBtn) activeBtn.classList.add('bg-blue-500/20', 'text-blue-400', 'border-blue-500/50');
  renderAdminLista();
};

function renderAdminLista() {
  const container = document.getElementById('adminListContainer');
  if (!container) return;

  const IDA_KEYWORDS = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
  const isIda = h => IDA_KEYWORDS.some(k => h.includes(k));

  let filtered = adminListaData;
  if (adminListaFilter === 'ida') filtered = adminListaData.filter(v => isIda(v.horario));
  if (adminListaFilter === 'vuelta') filtered = adminListaData.filter(v => !isIda(v.horario));

  const s1 = document.getElementById('adminListStatTotal');
  const s2 = document.getElementById('adminListStatPresentes');
  const s3 = document.getElementById('adminListStatHorarios');
  if (s1) s1.textContent = adminListaData.length || '–';
  if (s2) s2.textContent = Object.values(adminAttendanceState).filter(v => v === 'subio').length;
  if (s3) s3.textContent = new Set(adminListaData.map(v => v.horario)).size || '–';

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="pl-empty"><p>No hay pasajeros en este filtro.</p></div>';
    return;
  }

  const groups = {};
  filtered.forEach(v => {
    if (!groups[v.horario]) groups[v.horario] = [];
    groups[v.horario].push(v);
  });

  let pendingGroupsCount = 0;

  Object.entries(groups).forEach(([horario, passengers]) => {
    const completado = passengers.every(p => adminAttendanceState[p.id] !== undefined);
    if (completado) return;

    pendingGroupsCount++;
    const ida = isIda(horario);

    const group = document.createElement('div');
    group.className = 'pl-group';

    const hdr = document.createElement('div');
    hdr.className = 'pl-group-header';
    hdr.innerHTML = `
      <div class="pl-group-title">${sanitize(horario)}</div>
      <div class="pl-group-meta">
        <span class="pl-dir-pill ${ida ? 'pl-dir-ida' : 'pl-dir-vuelta'}">${ida ? '\u2197 IDA' : '\u2199 VUELTA'}</span>
        <span class="pl-count-pill">${passengers.length} persona${passengers.length !== 1 ? 's' : ''}</span>
        <i data-lucide="chevron-down" class="pl-chevron open"></i>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'pl-body';

    passengers.forEach((p, idx) => {
      const t = new Date(p.created_at);
      let hours = t.getHours();
      const minutes = t.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;
      const isSubio = adminAttendanceState[p.id] === 'subio';
      const isNoSubio = adminAttendanceState[p.id] === 'no-subio';

      const puntoEsperaBadge = p.punto_espera === 'camino'
        ? '<span style="font-size:0.58rem;font-weight:800;background:rgba(52,211,153,0.12);color:#34d399;border:1px solid rgba(52,211,153,0.3);padding:0.1rem 0.45rem;border-radius:999px;flex-shrink:0;">🚶 Camino</span>'
        : p.punto_espera === 'parada'
          ? '<span style="font-size:0.58rem;font-weight:800;background:rgba(59,130,246,0.12);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);padding:0.1rem 0.45rem;border-radius:999px;flex-shrink:0;">📍 Parada</span>'
          : '';

      const row = document.createElement('div');
      row.className = 'pl-row';
      row.innerHTML = `
        <div class="pl-num">${idx + 1}</div>
        <div class="pl-info">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <div class="pl-name">${sanitize(p.nombre) || 'Sin nombre'}</div>
            ${(p.en_espera || idx >= 30) ? '<span class="pl-espera-tag">Espera</span>' : ''}
            ${puntoEsperaBadge}
          </div>
          <div class="pl-mat">${sanitize(p.matricula) || ''}</div>
        </div>
        <div class="pl-time">${time}</div>
        <div class="pl-att-wrap">
          <button type="button" class="pl-att-btn pl-subio ${isSubio ? 'active' : ''}" data-id="${p.id}" data-action="subio">\u2705 Subi\u00f3</button>
          <button type="button" class="pl-att-btn pl-nosubio ${isNoSubio ? 'active' : ''}" data-id="${p.id}" data-action="no-subio">\u274c No subi\u00f3</button>
        </div>
      `;

      row.querySelectorAll('.pl-att-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (adminAttendanceState[p.id] === action) return;
          adminAttendanceState[p.id] = action;
          renderAdminLista();
          window.marcarAsistenciaAdmin(p, action);
        });
      });

      body.appendChild(row);
    });

    hdr.addEventListener('click', () => {
      const chevron = hdr.querySelector('.pl-chevron');
      const isOpen = chevron.classList.contains('open');
      body.style.display = isOpen ? 'none' : 'flex';
      if (chevron) chevron.classList.toggle('open', !isOpen);
    });

    group.appendChild(hdr);
    group.appendChild(body);
    container.appendChild(group);
  });

  if (pendingGroupsCount === 0 && Object.keys(groups).length > 0) {
    container.innerHTML = `
    <div style="text-align:center; padding: 3rem 1.5rem; background: rgba(16,185,129,0.1); border-radius: 1.5rem; border: 1px solid rgba(16,185,129,0.2); margin-top: 1rem;">
      <div style="width:60px; height:60px; margin: 0 auto 1.5rem; background: rgba(16,185,129,0.15); color: #34d399; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(16,185,129,0.2);">
        <i data-lucide="check-check" style="width:32px; height:32px;"></i>
      </div>
      <h2 style="font-size: 1.5rem; font-weight: 800; color: #34d399; margin-bottom: 0.5rem;">¡Todas las listas pasadas!</h2>
      <p style="color: #6ee7b7; font-size: 0.95rem; opacity: 0.8; max-width: 300px; margin: 0 auto;">No hay pasajeros pendientes. Los voluntarios o tú ya han completado el pase de lista de estos horarios.</p>
    </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

window.marcarAsistenciaAdmin = async (p, action) => {
  const subio = (action === 'subio');
  const se_monto = subio ? 1 : 0;
  try {
    const { data, error } = await supabase.from('votos').update({ se_monto }).eq('id', p.id).select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Bloqueado por RLS: No tienes permisos.');
    }
    if (!subio) {
      const { data: existing } = await supabase.from('faltas').select('id').eq('voto_id', p.id).maybeSingle();
      if (!existing) {
        await supabase.from('faltas').insert({
          usuario_id: p.usuario_id,
          voto_id: p.id,
          nombre: p.nombre,
          matricula: p.matricula,
          email: p.email || '',
          horario: p.horario,
          fecha: p.fecha,
        });
      }
    } else {
      await supabase.from('faltas').delete().eq('voto_id', p.id);
    }

    if (p.usuario_id) {
      const { count } = await supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('usuario_id', p.usuario_id);
      const penalizado = count >= 3;
      await supabase.from('penalidades').upsert({
        usuario_id: p.usuario_id,
        nombre: p.nombre,
        matricula: p.matricula,
        email: p.email || '',
        total_faltas: count,
        penalizado,
        fecha_penalidad: penalizado ? getCycleDate() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'usuario_id' });

      if (!subio) {
        window.showAdminToast(`Falta registrada a ${p.nombre}. Total: ${count}/3`, count >= 3 ? 'warning' : 'error');
      } else {
        window.showAdminToast(`Asistencia confirmada para ${p.nombre}`, 'success');
      }
    } else {
      if (!subio) window.showAdminToast(`Falta registrada a ${p.nombre}.`, 'error');
      else window.showAdminToast(`Asistencia confirmada para ${p.nombre}`, 'success');
    }

    // Actualizar estado local y UI
    adminAttendanceState[p.id] = action;
    renderAdminLista();
    loadDashboardData();
    // También recargar penalidades por si el admin cambia de pestaña
    loadPenalidadesData();
  } catch (err) {
    console.error(err);
    window.showAdminToast('Error al guardar asistencia', 'error');
  }
};

// ── AUDITORÍA ──────────────────────────────────────────
let auditActiveTab = 'votos';
let auditAllRows = [];

document.querySelectorAll('[data-audit-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    auditActiveTab = btn.dataset.auditTab;
    document.querySelectorAll('[data-audit-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.loadAuditData();
  });
});

const dp = document.getElementById('auditDatePick');
if (dp) dp.value = getCycleDate();

window.loadAuditData = async function () {
  const container = document.getElementById('auditTableContainer');
  if (!container) return;
  container.innerHTML = '<div class="audit-empty"><div class="audit-spinner"></div><p>Cargando registros…</p></div>';

  const dpEl = document.getElementById('auditDatePick');
  const dateVal = dpEl ? dpEl.value : getCycleDate();

  try {
    const [votosRes, penRes] = await Promise.all([
      supabase.from('votos').select('*').eq('fecha', dateVal).order('created_at', { ascending: false }),
      supabase.from('penalidades').select('id', { count: 'exact', head: true }).eq('penalizado', true),
    ]);
    if (votosRes.error) throw votosRes.error;

    const uniqueMap = new Map();
    const IDA_KW = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
    const getDir = h => IDA_KW.some(k => h.includes(k)) ? 'ida' : 'vuelta';

    (votosRes.data || []).forEach(r => {
      const key = `${r.matricula || r.usuario_id}-${getDir(r.horario)}`;
      if (!uniqueMap.has(key) || new Date(r.created_at) > new Date(uniqueMap.get(key).created_at)) {
        uniqueMap.set(key, r);
      }
    });
    const uniqueVotos = Array.from(uniqueMap.values());

    const totalReservas = uniqueVotos.length;
    const totalFaltasHoy = uniqueVotos.filter(v => v.se_monto === 0).length;

    const a1 = document.getElementById('auditStatVotos');
    const a2 = document.getElementById('auditStatFaltas');
    const a3 = document.getElementById('auditStatPenalidades');
    if (a1) a1.textContent = totalReservas;
    if (a2) a2.textContent = totalFaltasHoy;
    if (a3) a3.textContent = penRes.count ?? '–';

    let data = [];
    if (auditActiveTab === 'votos') {
      data = uniqueVotos;
    } else if (auditActiveTab === 'faltas') {
      data = uniqueVotos.filter(v => v.se_monto === 0);
    } else if (auditActiveTab === 'penalidades') {
      // Obtener todas las faltas agrupadas por estudiante (no solo los penalizados)
      const { data: faltasRows, error: fErr } = await supabase
        .from('faltas')
        .select('usuario_id, nombre, matricula, email, horario, fecha, created_at')
        .order('created_at', { ascending: false });
      if (fErr) throw fErr;

      // También obtener las filas de penalidades para saber quiénes están penalizados
      const { data: penRows } = await supabase
        .from('penalidades')
        .select('usuario_id, total_faltas, penalizado, fecha_penalidad, updated_at');
      const penMap = {};
      (penRows || []).forEach(p => { if (p.usuario_id) penMap[p.usuario_id] = p; });

      // Agrupar faltas por estudiante
      const grouped = {};
      (faltasRows || []).forEach(f => {
        const uid = f.usuario_id || f.matricula || f.nombre;
        if (!grouped[uid]) {
          grouped[uid] = {
            usuario_id: f.usuario_id,
            nombre: f.nombre,
            matricula: f.matricula,
            email: f.email,
            faltas_detalle: [],
            ultima_falta: f.created_at,
          };
        }
        grouped[uid].faltas_detalle.push(f);
        if (new Date(f.created_at) > new Date(grouped[uid].ultima_falta)) {
          grouped[uid].ultima_falta = f.created_at;
        }
      });

      // Convertir a array y cruzar con penalidades
      data = Object.values(grouped).map(g => {
        const pen = penMap[g.usuario_id] || {};
        const realCount = g.faltas_detalle.length;
        return {
          ...g,
          total_faltas: Math.max(pen.total_faltas || 0, realCount),
          penalizado: pen.penalizado || realCount >= 3,
          fecha_penalidad: pen.fecha_penalidad || null,
          updated_at: pen.updated_at || g.ultima_falta,
        };
      }).sort((a, b) => b.total_faltas - a.total_faltas);
    }

    auditAllRows = data;
    window.filterAuditTable();
    if (window.lucide) window.lucide.createIcons();

  } catch (err) {
    console.error('Error auditoría:', err);
    container.innerHTML = `<div class="audit-empty" style="color:#f87171;">Error: ${err.message}</div>`;
  }
};

window.filterAuditTable = function () {
  const searchEl = document.getElementById('auditSearch');
  const q = (searchEl ? searchEl.value : '').toLowerCase();
  const filtered = auditAllRows.filter(r =>
    (r.nombre || '').toLowerCase().includes(q) ||
    (r.matricula || '').toLowerCase().includes(q) ||
    (r.email || '').toLowerCase().includes(q)
  );
  renderAuditTable(filtered);
};

function renderAuditTable(rows) {
  const container = document.getElementById('auditTableContainer');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div class="audit-empty"><p>No hay registros para este filtro.</p></div>';
    return;
  }

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  let html = '<table class="audit-table"><thead><tr>';

  if (auditActiveTab === 'votos') {
    html += `<th>#</th><th>Pasajero</th><th>Horario</th><th>Estado</th><th>Registrado</th>`;
  } else if (auditActiveTab === 'faltas') {
    html += `<th>#</th><th>Pasajero</th><th>Horario</th><th>Fecha Viaje</th><th>Registrado</th>`;
  } else {
    html += `<th>#</th><th>Pasajero</th><th>Faltas Acum.</th><th>Estado</th><th>Última Act.</th>`;
  }

  html += '</tr></thead><tbody>';

  rows.forEach((r, i) => {
    if (auditActiveTab === 'penalidades') {
      html += `<tr class="audit-row-clickable" data-user-id="${r.usuario_id || ''}" data-nombre="${sanitize(r.nombre) || ''}" data-matricula="${sanitize(r.matricula) || ''}" data-email="${sanitize(r.email) || ''}" style="cursor:pointer;">`;
    } else {
      html += '<tr>';
    }
    if (auditActiveTab === 'votos') {
      const estado = r.se_monto === 1 ? '<span class="audit-badge activo">✓ Subió</span>'
        : r.se_monto === 0 ? '<span class="audit-badge falta">✗ No subió</span>'
          : '<span class="audit-badge voto">Pendiente</span>';
      html += `
        <td class="audit-time">${i + 1}</td>
        <td><div class="audit-name">${sanitize(r.nombre) || '—'}</div><div class="audit-mat">${sanitize(r.matricula) || ''}</div></td>
        <td class="audit-horario">${sanitize(r.horario) || '—'}</td>
        <td>${estado}</td>
        <td class="audit-time">${fmtDateTime(r.created_at)}</td>
      `;
    } else if (auditActiveTab === 'faltas') {
      html += `
        <td class="audit-time">${i + 1}</td>
        <td><div class="audit-name">${sanitize(r.nombre) || '—'}</div><div class="audit-mat">${sanitize(r.matricula) || ''}</div></td>
        <td class="audit-horario">${sanitize(r.horario) || '—'}</td>
        <td class="audit-time">${sanitize(r.fecha) || '—'}</td>
        <td class="audit-time">${fmtDateTime(r.created_at)}</td>
      `;
    } else {
      const faltasNum = r.total_faltas || 0;
      const color = faltasNum >= 3 ? '#f87171' : faltasNum >= 2 ? '#fbbf24' : '#34d399';
      const bgColor = faltasNum >= 3 ? 'rgba(239,68,68,0.1)' : faltasNum >= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
      const borderColor = faltasNum >= 3 ? 'rgba(239,68,68,0.25)' : faltasNum >= 2 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)';
      const penBadge = r.penalizado
        ? '<span class="audit-badge penalidad">🚫 Penalizado</span>'
        : faltasNum >= 2
          ? '<span class="audit-badge falta">⚠️ En riesgo</span>'
          : '<span class="audit-badge activo">✅ Activo</span>';
      html += `
        <td class="audit-time">${i + 1}</td>
        <td><div class="audit-name">${sanitize(r.nombre) || '—'}</div><div class="audit-mat">${sanitize(r.matricula) || ''}</div></td>
        <td><span style="display:inline-flex;align-items:center;justify-content:center;padding:0.25rem 0.75rem;border-radius:2rem;font-weight:800;font-size:0.82rem;background:${bgColor};border:1px solid ${borderColor};color:${color};">${faltasNum} / 3</span></td>
        <td>${penBadge}</td>
        <td class="audit-time">${fmtDateTime(r.updated_at)}</td>
      `;
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('.audit-row-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const { userId, nombre, matricula, email } = row.dataset;
      if (userId) {
        window.showFaltasDetalleModal(userId, nombre, matricula, email);
      }
    });
  });
}

window.showFaltasDetalleModal = async function (userId, nombre, matricula, email, activeFaltas) {
  const ov = document.createElement('div');
  ov.className = 'aeudj-overlay';
  ov.innerHTML = `
    <div class="aeudj-dialog" style="max-width: 500px; text-align: left; padding: 2rem; border-radius: 1.5rem; position: relative;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; gap:1rem;">
        <div>
          <h3 class="aeudj-title" style="margin:0; font-size:1.2rem; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif;">📅 Historial de Inasistencias</h3>
          <p style="font-size:0.8rem; color:#94a3b8; margin:4px 0 0 0;">${sanitize(nombre)} · <span style="font-family:monospace;">${sanitize(matricula)}</span></p>
        </div>
        <button id="modal-close-btn" style="background:none; border:none; color:#64748b; font-size:1.5rem; cursor:pointer; line-height:1; padding:0; outline:none;">&times;</button>
      </div>
      <div class="aeudj-divider" style="margin: 0 -2rem 1.25rem;"></div>
      
      <div style="margin-bottom:1.5rem;">
        <span style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:#64748b; letter-spacing:0.05em; display:block; margin-bottom:0.75rem;">Faltas Registradas (Historial)</span>
        <div id="modal-faltas-list" class="custom-scroll" style="max-height: 250px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius:0.75rem; background:rgba(0,0,0,0.15);">
          <div style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
            Cargando historial de faltas...
          </div>
        </div>
      </div>

      <div style="display:flex; gap:0.75rem; margin-top:1.5rem;" id="modal-actions-container">
        <button class="aeudj-btn secondary" id="modal-close-btn2" style="flex:1;">Cerrar</button>
        <button class="aeudj-btn secondary" disabled style="flex:1.2; opacity:0.4; cursor:not-allowed;">
          Cargando estado...
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  requestAnimationFrame(() => {
    ov.style.display = 'flex';
    requestAnimationFrame(() => ov.classList.add('visible'));
  });

  const closeOverlay = () => {
    ov.classList.remove('visible');
    setTimeout(() => { ov.remove(); }, 280);
  };

  ov.querySelector('#modal-close-btn').onclick = closeOverlay;
  ov.querySelector('#modal-close-btn2').onclick = closeOverlay;
  ov.onclick = (e) => { if (e.target === ov) closeOverlay(); };

  const listContainer = ov.querySelector('#modal-faltas-list');

  try {
    const [faltasRes, activeFaltasRes] = await Promise.all([
      supabase
        .from('votos')
        .select('*')
        .eq('usuario_id', userId)
        .eq('se_monto', 0)
        .order('fecha', { ascending: false })
        .order('horario', { ascending: false }),
      activeFaltas !== undefined
        ? Promise.resolve({ count: activeFaltas })
        : supabase
            .from('faltas')
            .select('id', { count: 'exact', head: true })
            .eq('usuario_id', userId)
    ]);

    if (faltasRes.error) throw faltasRes.error;
    if (activeFaltasRes.error) throw activeFaltasRes.error;

    const historicalFaltas = faltasRes.data || [];
    const activeCount = activeFaltasRes.count !== undefined ? activeFaltasRes.count : (activeFaltasRes.count || 0);

    if (!historicalFaltas || historicalFaltas.length === 0) {
      listContainer.innerHTML = '<div style="padding:2rem; text-align:center; color:#475569; font-size:0.85rem;">No hay faltas registradas en el historial de viajes.</div>';
    } else {
      let html = '';
      historicalFaltas.forEach((f, idx) => {
        const fechaViaje = f.fecha
          ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
          : '—';
        const registrado = f.created_at
          ? new Date(f.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '—';

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); gap:1rem;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span style="font-weight:700; color:#fbbf24; font-size:0.82rem;">#${idx + 1}</span>
              <div>
                <div style="font-size:0.85rem; color:#f8fafc; font-weight:600;">${sanitize(f.horario) || '—'}</div>
                <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Fecha viaje: ${fechaViaje}</div>
              </div>
            </div>
            <div style="text-align:right; font-size:0.75rem; color:#94a3b8; font-weight:600;">
              Reg: ${registrado}
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = html;
    }

    const actionsContainer = ov.querySelector('#modal-actions-container');
    if (actionsContainer) {
      if (activeCount > 0) {
        actionsContainer.innerHTML = `
          <button class="aeudj-btn secondary" id="modal-close-btn2" style="flex:1;">Cerrar</button>
          <button class="aeudj-btn primary" id="modal-levantar-btn" style="flex:1.2; background:linear-gradient(135deg, #10b981, #059669); box-shadow:0 4px 18px rgba(16,185,129,0.3);">
            🔓 Levantar (${activeCount}/3)
          </button>
        `;
      } else {
        actionsContainer.innerHTML = `
          <button class="aeudj-btn secondary" id="modal-close-btn2" style="flex:1;">Cerrar</button>
          <button class="aeudj-btn secondary" disabled style="flex:1.2; opacity:0.4; cursor:not-allowed;">
            ✅ Sin Faltas Activas
          </button>
        `;
      }

      actionsContainer.querySelector('#modal-close-btn2').onclick = closeOverlay;
      const btnLevantar = actionsContainer.querySelector('#modal-levantar-btn');
      if (btnLevantar) {
        btnLevantar.onclick = async () => {
          let confirmed = false;
          if (typeof window.aeudjConfirm === 'function') {
            confirmed = await window.aeudjConfirm(`¿Confirmas que ${nombre} ya pagó la penalidad de sus faltas activas? Esto reiniciará su contador de faltas a 0.`);
          } else {
            confirmed = confirm(`¿Confirmas que ${nombre} ya pagó la penalidad de sus faltas activas?`);
          }
          if (!confirmed) return;

          btnLevantar.disabled = true;
          btnLevantar.textContent = 'Procesando...';

          try {
            await levantarPenalidad(userId);
            window.showAdminToast(`Penalidad levantada para ${nombre}`, 'success');
            closeOverlay();
            window.loadAuditData();
            if (!document.getElementById('screen-penalidades').classList.contains('hidden')) {
              loadPenalidadesData();
            }
          } catch (err) {
            console.error(err);
            window.showAdminToast('Error al levantar la penalidad', 'error');
            btnLevantar.disabled = false;
            btnLevantar.textContent = `🔓 Levantar (${activeCount}/3)`;
          }
        };
      }
    }
  } catch (e) {
    console.error('Error fetching faltas:', e);
    listContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:#ef4444; font-size:0.85rem;">Error al cargar faltas: ${e.message}</div>`;
  }
};
