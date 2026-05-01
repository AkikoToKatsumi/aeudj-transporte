// Usamos el cliente global de Supabase cargado en el HTML
const supabase = window.supabase;

if (!supabase) {
  console.error('Supabase client not found! Ensure the library is loaded in the HTML.');
}

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
      if(dash && !dash.classList.contains('hidden')) loadDashboardData();
      if(votes && !votes.classList.contains('hidden')) loadVotosDetail();
      if(plist && !plist.classList.contains('hidden')) loadAdminLista();
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

  const btnRefreshStaff = document.getElementById('btnRefreshStaff');
  if (btnRefreshStaff) btnRefreshStaff.addEventListener('click', () => window.refreshCurrentScreen());

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

  const btnRefreshAudit = document.getElementById('btnRefreshAudit');
  if (btnRefreshAudit) btnRefreshAudit.addEventListener('click', () => window.loadAuditData());
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

    currentVotos.forEach(v => {
      if (!listado[v.horario]) listado[v.horario] = [];
      listado[v.horario].push(v);

      if (!timeGroups[v.horario]) timeGroups[v.horario] = { confirmados: 0, espera: 0 };
      if (v.en_espera) {
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
      const isIda  = h => IDA_KW.some(k => h.includes(k));

      Object.entries(listado).forEach(([horario, paxList]) => {
        const ida         = isIda(horario);
        const confirmados = paxList.filter(p => !p.en_espera).length;
        const enEspera    = paxList.filter(p =>  p.en_espera).length;

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
  } catch(e) {
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
  const isIda  = h => IDA_KW.some(k => h.includes(k));

  let filtered = pvAllVotos;
  if (pvFilter === 'ida')    filtered = pvAllVotos.filter(v =>  isIda(v.horario));
  if (pvFilter === 'vuelta') filtered = pvAllVotos.filter(v => !isIda(v.horario));

  const pvStatTotal    = document.getElementById('pvStatTotal');
  const pvStatEspera   = document.getElementById('pvStatEspera');
  const pvStatHorarios = document.getElementById('pvStatHorarios');
  if (pvStatTotal)    pvStatTotal.textContent    = pvAllVotos.filter(v => !v.en_espera).length || '-';
  if (pvStatEspera)   pvStatEspera.textContent   = pvAllVotos.filter(v =>  v.en_espera).length;
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
      const row  = document.createElement('div');
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
      
      const badge = row.querySelector('.pv-badge');
      badge.className = 'pv-badge ' + (p.en_espera ? 'pv-badge-espera' : 'pv-badge-ok');
      badge.textContent = p.en_espera ? 'Espera' : 'Confirmado';

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
  if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;opacity:0.5;font-weight:bold;letter-spacing:0.2em;">SINCRONIZANDO...</td></tr>';

  const { data, error } = await supabase.from('profiles').select('*').order('nombre');
  if (error) {
    console.error('Error fetching staff:', error);
    window.showAdminToast('Error al conectar con la base de datos', 'error');
    return;
  }
  
  staffData = data || [];
  updateStaffCounts();
  renderStaffTableNew();
}

function updateStaffCounts() {
  const setTotal = (statId, tabId, count) => {
    const elStat = document.getElementById(statId);
    const elTab  = document.getElementById(tabId);
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
      <tr><td colspan="4" style="text-align:center;padding:4rem;color:#94a3b8;">
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
    if(rolText.includes('administrador')) { badgeClass = 'staff-badge-amber'; badgeLabel = 'Admin'; icon = '🛡️'; }
    else if(rolText.includes('voluntario')) { badgeClass = 'staff-badge-blue'; badgeLabel = 'Voluntario'; icon = '🙋'; }
    else if(rolText.includes('chofer')) { badgeClass = 'staff-badge-indigo'; badgeLabel = 'Chofer'; icon = '🚌'; }

    const esComite = rolText.includes('comité') || rolText.includes('comite') || rolText.includes('miembro');
    const comiteBadge = esComite ? `<span style="background:rgba(236,72,153,0.15); color:#f472b6; padding:0.15rem 0.4rem; border-radius:0.3rem; font-size:0.65rem; font-weight:800; border:1px solid rgba(236,72,153,0.3); margin-top:0.3rem; display:inline-flex; align-items:center; gap:0.2rem;"><i data-lucide="star" style="width:10px;height:10px;"></i> COMITÉ</span>` : '';

    const charCode = initials.charCodeAt(0) || 65;
    const colors = ['linear-gradient(135deg,#3b82f6,#2563eb)', 'linear-gradient(135deg,#10b981,#059669)', 'linear-gradient(135deg,#f59e0b,#d97706)', 'linear-gradient(135deg,#8b5cf6,#6d28d9)', 'linear-gradient(135deg,#ec4899,#be185d)'];
    const avatarBg = colors[charCode % colors.length];

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
  
  window.showAdminToast('Eliminando...', 'info');
  const { data, error } = await supabase.from('profiles').delete().eq('id', userId).select();
  
  if (error) {
    console.error('Delete error:', error);
    window.showAdminToast(error.message || 'Error al eliminar usuario', 'error');
  } else if (!data || data.length === 0) {
    window.showAdminToast('Permiso denegado por políticas de seguridad (RLS)', 'error');
  } else {
    window.showAdminToast('Usuario eliminado correctamente', 'success');
    await loadStaffData();
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
    { time: '7:00 AM',  route: 'Jarabacoa → La Vega', dir: 'ida'    },
    { time: '9:00 AM',  route: 'Jarabacoa → La Vega', dir: 'ida'    },
    { time: '12:10 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '1:00 PM',  route: 'Jarabacoa → La Vega', dir: 'ida'    },
    { time: '2:15 PM',  route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '3:00 PM',  route: 'Jarabacoa → La Vega', dir: 'ida'    },
    { time: '4:10 PM',  route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '5:00 PM',  route: 'Jarabacoa → La Vega', dir: 'ida'    },
    { time: '6:00 PM',  route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '8:00 PM',  route: 'La Vega → Jarabacoa', dir: 'vuelta' },
    { time: '10:00 PM', route: 'La Vega → Jarabacoa', dir: 'vuelta' },
  ];

  if (adminSelectedDay === 'Sábado') {
    times = times.filter(t => t.time === '7:00 AM' || t.time === '12:10 PM');
  }

  const { data: allUsers } = await supabase.from('profiles').select('*').eq('rol', 'voluntario');
  const volunteers = allUsers || [];
  
  grid.innerHTML = '';
  
  times.forEach(t => {
    const fullText = `${t.time} ${t.route}`;
    const assigned = volunteers.filter(v => {
      try {
        const scheds = JSON.parse(v.horario_asignado || '{}');
        return scheds[adminSelectedDay] && scheds[adminSelectedDay].includes(fullText);
      } catch(e) {
        return v.dia_asignado === adminSelectedDay && v.horario_asignado === fullText;
      }
    });
    const isAssigned = assigned.length > 0;
    
    const isIda = t.dir === 'ida';
    const card = document.createElement('div');
    card.style.cssText = `background:#1e2a3a; border-radius:1rem; padding:1.2rem 1rem; display:flex; flex-direction:column; align-items:center; text-align:center; position:relative; transition:all 0.2s; cursor:pointer; border:2px solid ${isAssigned ? 'rgba(99,133,255,0.5)' : 'transparent'}; min-height:180px;`;
    card.onmouseenter = () => { if(!isAssigned) card.style.background = '#243044'; };
    card.onmouseleave = () => { if(!isAssigned) card.style.background = '#1e2a3a'; };

    const arrowIcon = isIda ? 'arrow-right' : 'arrow-left';
    const badgeBg   = isIda ? 'rgba(99,133,255,0.2)' : 'rgba(138,99,255,0.2)';
    const badgeColor= isIda ? '#7fa3ff' : '#b99fff';
    const badgeLabel= isIda ? '↗ IDA' : '↙ VUELTA';

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
  const { data: allUsers, error: fetchErr } = await supabase.from('profiles').select('*').eq('rol', 'voluntario');
  if (fetchErr) {
    window.showAdminToast('Error de red', 'error');
    return;
  }

  const promises = [];
  
  for (const v of allUsers) {
    let scheds = {};
    try {
      scheds = JSON.parse(v.horario_asignado || '{}');
    } catch(e) {
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



window.clearTodayVotes = async function() {
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
    if(!document.getElementById('screen-votos').classList.contains('hidden')) loadVotosDetail();
    if(!document.getElementById('screen-penalidades').classList.contains('hidden')) loadPenalidadesData();
    if(!document.getElementById('screen-logs').classList.contains('hidden')) window.loadAuditData();
    
  } catch(e) {
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
    } catch(e) {
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
  if(!user) return;
  
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

    if(!nombre || !matricula) {
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
      if(!password) throw new Error("La contraseña es obligatoria para nuevos usuarios.");
      if(password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

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

  } catch(err) {
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
      } catch(e) {}
      localStorage.clear();
      window.location.href = 'index.html';
    });
}

// ── PENALIDADES ───────────────────────────────────────────────────────────────
async function loadPenalidadesData() {
  try {
    const { data: pens } = await supabase
      .from('penalidades').select('*').order('total_faltas', { ascending: false });
    const { data: faltas } = await supabase
      .from('faltas').select('*').order('created_at', { ascending: false });

    const penalArr = pens || [];
    const faltaArr = faltas || [];

    const penalizados  = penalArr.filter(p => p.penalizado).length;
    const levantadas   = penalArr.filter(p => !p.penalizado && p.total_faltas === 0 && p.fecha_penalidad).length;
    
    const penStatPen = document.getElementById('penStatPen');
    const penStatFaltas = document.getElementById('penStatFaltas');
    const penStatLevantadas = document.getElementById('penStatLevantadas');
    if (penStatPen) penStatPen.textContent = penalizados;
    if (penStatFaltas) penStatFaltas.textContent = faltaArr.length;
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

    renderPenalizados(penalArr);
    renderHistorial(faltaArr);

    document.querySelectorAll('.pen-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.pen-tab').forEach(b => { b.classList.remove('active'); b.classList.remove('active-blue'); });
        const p1 = document.getElementById('penTab-penalizados');
        const p2 = document.getElementById('penTab-historial');
        if (p1) p1.classList.add('hidden');
        if (p2) p2.classList.add('hidden');
        const tab = btn.dataset.penTab;
        const target = document.getElementById(`penTab-${tab}`);
        if (target) target.classList.remove('hidden');
        btn.classList.add(tab === 'historial' ? 'active-blue' : 'active');
      };
    });

    if (window.lucide) window.lucide.createIcons();
  } catch(err) {
    console.error('Error cargando penalidades:', err);
  }
}

function renderPenalizados(pens) {
  const container = document.getElementById('penalizadosTable');
  if (!container) return;
  if (!pens.length) {
    container.innerHTML = '<div class="empty-pen">✅ No hay estudiantes penalizados.</div>';
    return;
  }

  let html = `<table class="pen-table">
    <thead><tr>
      <th>Nombre</th>
      <th>Matrícula</th>
      <th>Email</th>
      <th>Faltas</th>
      <th>Estado</th>
      <th>Fecha Pen.</th>
      <th>Acción</th>
    </tr></thead><tbody>`;

  pens.forEach(p => {
    const faltas = p.total_faltas;
    const cls = faltas >= 3 ? 'high' : faltas >= 2 ? 'med' : 'low';
    const penalizado = p.penalizado;
    const fecha = p.fecha_penalidad ? new Date(p.fecha_penalidad).toLocaleDateString('es-ES') : '---';

    html += `<tr>
      <td class="name-cell">${sanitize(p.nombre) || '---'}</td>
      <td class="mat-cell">${sanitize(p.matricula) || '---'}</td>
      <td style="font-size:0.78rem;color:#64748b;">${sanitize(p.email) || '---'}</td>
      <td><span class="falta-count ${cls}">${faltas} / 3</span></td>
      <td><span class="pen-badge ${penalizado ? 'penalizado' : 'activo'}">${penalizado ? '🚫 Penalizado' : '✅ Activo'}</span></td>
      <td style="font-size:0.78rem;">${fecha}</td>
      <td>${penalizado
        ? `<button class="btn-levantar" data-uid="${p.usuario_id}" data-nombre="${p.nombre}">
            🔓 Levantar
           </button>`
        : '<span style="color:#475569;font-size:0.75rem;opacity:0.5;">—</span>'
      }</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('.btn-levantar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid    = btn.dataset.uid;
      const nombre = btn.dataset.nombre;
      let confirmed = false;
      if (typeof window.aeudjConfirm === 'function') {
          confirmed = await window.aeudjConfirm(`¿Confirmas que ${nombre} ya pagó la penalidad? Esto reiniciará su contador de faltas a 0.`);
      } else {
          confirmed = confirm(`¿Confirmas que ${nombre} ya pagó la penalidad?`);
      }
      if (!confirmed) return;
      btn.disabled = true;
      btn.textContent = 'Procesando...';
      await levantarPenalidad(uid);
      loadPenalidadesData();
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderHistorial(faltas) {
  const container = document.getElementById('historialTable');
  if (!container) return;
  if (!faltas.length) {
    container.innerHTML = '<div class="empty-pen">No hay faltas registradas.</div>';
    return;
  }

  let html = `<table class="pen-table">
    <thead><tr>
      <th>Nombre</th>
      <th>Matrícula</th>
      <th>Horario</th>
      <th>Fecha</th>
      <th>Registrado</th>
    </tr></thead><tbody>`;

  faltas.forEach(f => {
    const registrado = new Date(f.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    html += `<tr>
      <td class="name-cell">${sanitize(f.nombre) || '—'}</td>
      <td class="mat-cell">${sanitize(f.matricula) || '—'}</td>
      <td style="font-size:0.8rem;">${sanitize(f.horario) || '—'}</td>
      <td style="font-size:0.8rem;">${sanitize(f.fecha) || '—'}</td>
      <td style="font-size:0.75rem;color:#64748b;">${registrado}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

async function levantarPenalidad(usuarioId) {
  try {
    await supabase.from('penalidades').update({
      total_faltas:    0,
      penalizado:      false,
      fecha_penalidad: null,
      updated_at:      new Date().toISOString(),
    }).eq('usuario_id', usuarioId);

    await supabase.from('faltas').delete().eq('usuario_id', usuarioId);
  } catch(err) {
    console.error('Error levantando penalidad:', err);
    alert('Error al levantar la penalidad. Intenta de nuevo.');
  }
}

// ── PASE DE LISTA ADMIN ──────────────────────────────────
let adminListaData = [];
let adminListaFilter = 'todos';
let adminAttendanceState = {};

async function loadAdminLista() {
  const container = document.getElementById('adminListContainer');
  if(!container) return;
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

  if(error) {
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
    if(v.se_monto === 1) adminAttendanceState[v.id] = 'subio';
    else if(v.se_monto === 0) adminAttendanceState[v.id] = 'no-subio';
  });
  
  renderAdminLista();
}

window.filterAdminLista = (filter) => {
  adminListaFilter = filter;
  document.querySelectorAll('[id^="adminListFilter-"]').forEach(b => b.classList.remove('bg-blue-500/20', 'text-blue-400', 'border-blue-500/50'));
  const activeBtn = document.getElementById(`adminListFilter-${filter}`);
  if(activeBtn) activeBtn.classList.add('bg-blue-500/20', 'text-blue-400', 'border-blue-500/50');
  renderAdminLista();
};

function renderAdminLista() {
  const container = document.getElementById('adminListContainer');
  if (!container) return;

  const IDA_KEYWORDS = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
  const isIda = h => IDA_KEYWORDS.some(k => h.includes(k));

  let filtered = adminListaData;
  if (adminListaFilter === 'ida')    filtered = adminListaData.filter(v => isIda(v.horario));
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
      const isSubio   = adminAttendanceState[p.id] === 'subio';
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
            ${p.en_espera ? '<span class="pl-espera-tag">Espera</span>' : ''}
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
      const isOpen  = chevron.classList.contains('open');
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
      await supabase.from('faltas').insert({
        usuario_id: p.usuario_id,
        voto_id:    p.id,
        nombre:     p.nombre,
        matricula:  p.matricula,
        email:      p.email || '',
        horario:    p.horario,
        fecha:      p.fecha,
      });
      const { count } = await supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('usuario_id', p.usuario_id);
      const penalizado = count >= 3;
      await supabase.from('penalidades').upsert({
        usuario_id:      p.usuario_id,
        nombre:          p.nombre,
        matricula:       p.matricula,
        email:           p.email || '',
        total_faltas:    count,
        penalizado,
        fecha_penalidad: penalizado ? getCycleDate() : null,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'usuario_id' });
      window.showAdminToast(`Falta registrada a ${p.nombre}. Total: ${count}/3`, count >= 3 ? 'warning' : 'error');
    } else {
      window.showAdminToast(`Asistencia confirmada para ${p.nombre}`, 'success');
    }
  } catch(err) {
    console.error(err);
    window.showAdminToast('Error al guardar asistencia', 'error');
  }
};

// ── AUDITORÍA ──────────────────────────────────────────
let auditActiveTab = 'votos';
let auditAllRows   = [];

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

window.loadAuditData = async function() {
  const container = document.getElementById('auditTableContainer');
  if (!container) return;
  container.innerHTML = '<div class="audit-empty"><div class="audit-spinner"></div><p>Cargando registros…</p></div>';

  const dpEl = document.getElementById('auditDatePick');
  const dateVal = dpEl ? dpEl.value : getCycleDate();

  try {
    const [votosRes, faltasRes, penRes] = await Promise.all([
      supabase.from('votos').select('id', { count: 'exact', head: true }).eq('fecha', dateVal),
      supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('fecha', dateVal),
      supabase.from('penalidades').select('id', { count: 'exact', head: true }).eq('penalizado', true),
    ]);

    const a1 = document.getElementById('auditStatVotos');
    const a2 = document.getElementById('auditStatFaltas');
    const a3 = document.getElementById('auditStatPenalidades');
    if (a1) a1.textContent = votosRes.count ?? '–';
    if (a2) a2.textContent = faltasRes.count ?? '–';
    if (a3) a3.textContent = penRes.count ?? '–';

    let data = [];
    if (auditActiveTab === 'votos') {
      const { data: resRows, error } = await supabase
        .from('votos').select('*')
        .eq('fecha', dateVal)
        .order('created_at', { ascending: false });
      if (error) throw error;
      let rows = resRows || [];

      const uniqueMap = new Map();
      const IDA_KW = ['Jarabacoa -> La Vega', 'Jarabacoa \u2192 La Vega'];
      const getDir = h => IDA_KW.some(k => h.includes(k)) ? 'ida' : 'vuelta';
      
      rows.forEach(r => {
        const key = `${r.matricula || r.usuario_id}-${getDir(r.horario)}`;
        if (!uniqueMap.has(key) || new Date(r.created_at) > new Date(uniqueMap.get(key).created_at)) {
          uniqueMap.set(key, r);
        }
      });
      data = Array.from(uniqueMap.values());
    } else if (auditActiveTab === 'faltas') {
      const { data: rows, error } = await supabase
        .from('faltas').select('*')
        .eq('fecha', dateVal)
        .order('created_at', { ascending: false });
      if (error) throw error;
      data = rows || [];
    } else if (auditActiveTab === 'penalidades') {
      const { data: rows, error } = await supabase
        .from('penalidades').select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      data = rows || [];
    }

    auditAllRows = data;
    window.filterAuditTable();
    if (window.lucide) window.lucide.createIcons();

  } catch(err) {
    console.error('Error auditoría:', err);
    container.innerHTML = `<div class="audit-empty" style="color:#f87171;">Error: ${err.message}</div>`;
  }
};

window.filterAuditTable = function() {
  const searchEl = document.getElementById('auditSearch');
  const q = (searchEl ? searchEl.value : '').toLowerCase();
  const filtered = auditAllRows.filter(r =>
    (r.nombre    || '').toLowerCase().includes(q) ||
    (r.matricula || '').toLowerCase().includes(q) ||
    (r.email     || '').toLowerCase().includes(q)
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
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short' }) +
           ' ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
  };

  let html = '<table class="audit-table"><thead><tr>';

  if (auditActiveTab === 'votos') {
    html += `<th>#</th><th>Pasajero</th><th>Horario</th><th>Estado</th><th>Registrado</th>`;
  } else if (auditActiveTab === 'faltas') {
    html += `<th>#</th><th>Pasajero</th><th>Horario</th><th>Fecha Viaje</th><th>Registrado</th>`;
  } else {
    html += `<th>#</th><th>Pasajero</th><th>Total Faltas</th><th>Estado</th><th>Última Actualización</th>`;
  }

  html += '</tr></thead><tbody>';

  rows.forEach((r, i) => {
    html += '<tr>';
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
      const penBadge = r.penalizado
        ? '<span class="audit-badge penalidad">🚫 Penalizado</span>'
        : '<span class="audit-badge activo">✅ Activo</span>';
      html += `
        <td class="audit-time">${i + 1}</td>
        <td><div class="audit-name">${sanitize(r.nombre) || '—'}</div><div class="audit-mat">${sanitize(r.matricula) || ''}</div></td>
        <td><span style="font-weight:800;color:${color};">${faltasNum}</span><span style="color:#475569;font-size:.7rem;"> / 3</span></td>
        <td>${penBadge}</td>
        <td class="audit-time">${fmtDateTime(r.updated_at)}</td>
      `;
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}
