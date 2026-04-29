import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── CONFIG ──────────────────────────────────────────────
const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SCHEDULES = [
  { time: '7:00 AM',  route: 'Jarabacoa → La Vega',  fullText: '7:00 AM Jarabacoa -> La Vega',  group: 'manana', dir: 'ida'    },
  { time: '9:00 AM',  route: 'Jarabacoa → La Vega',  fullText: '9:00 AM Jarabacoa -> La Vega',  group: 'manana', dir: 'ida'    },
  { time: '12:10 PM', route: 'La Vega → Jarabacoa',  fullText: '12:10 PM La Vega -> Jarabacoa', group: 'manana', dir: 'vuelta' },
  { time: '12:10 PM', route: 'La Vega → Jarabacoa',  fullText: '12:10 PM La Vega -> Jarabacoa', group: 'tarde',  dir: 'vuelta' },
  { time: '1:00 PM',  route: 'Jarabacoa → La Vega',  fullText: '1:00 PM Jarabacoa -> La Vega',  group: 'tarde',  dir: 'ida'    },
  { time: '2:15 PM',  route: 'La Vega → Jarabacoa',  fullText: '2:15 PM La Vega -> Jarabacoa',  group: 'tarde',  dir: 'vuelta' },
  { time: '3:00 PM',  route: 'Jarabacoa → La Vega',  fullText: '3:00 PM Jarabacoa -> La Vega',  group: 'tarde',  dir: 'ida'    },
  { time: '4:10 PM',  route: 'La Vega → Jarabacoa',  fullText: '4:10 PM La Vega -> Jarabacoa',  group: 'tarde',  dir: 'vuelta' },
  { time: '5:00 PM',  route: 'Jarabacoa → La Vega',  fullText: '5:00 PM Jarabacoa -> La Vega',  group: 'tarde',  dir: 'ida'    },
  { time: '6:00 PM',  route: 'La Vega → Jarabacoa',  fullText: '6:00 PM La Vega -> Jarabacoa',  group: 'tarde',  dir: 'vuelta' },
  { time: '8:00 PM',  route: 'La Vega → Jarabacoa',  fullText: '8:00 PM La Vega -> Jarabacoa',  group: 'tarde',  dir: 'vuelta' },
  { time: '10:00 PM', route: 'La Vega → Jarabacoa',  fullText: '10:00 PM La Vega -> Jarabacoa', group: 'tarde',  dir: 'vuelta' },
];

// ── STATE ───────────────────────────────────────────────
let currentUser = null;
let selectedHorarios = [];
let initialVotes = [];
let isEditing = false;

// ── DOM REFS ────────────────────────────────────────────
const horarioForm   = document.getElementById('horarioForm');
const scheduleGrid  = document.getElementById('scheduleGrid');
const confirmedView = document.getElementById('confirmedView');
const confirmedTrips= document.getElementById('confirmedTrips');
const submitBtn     = document.getElementById('submitBtn');
const statusMsg     = document.getElementById('statusMsg');
const staffMenu     = document.getElementById('staffMenu');
const logoutBtn     = document.getElementById('logoutBtn');

// ── HELPERS ─────────────────────────────────────────────
function getCycleDate(group) {
  const now  = new Date();
  const hora = now.getHours();
  let targetDate = now;
  // Matutina: voting at night for next morning → date is tomorrow
  if (group === 'manana' && hora >= 22) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getGroupFromTime() {
  const h = new Date().getHours();
  return (h >= 22 || h < 10) ? 'manana' : 'tarde';
}

async function getActiveGroup() {
  try {
    const { data } = await supabase
      .from('voting_config')
      .select('manual_override, active_session')
      .eq('id', 1)
      .single();
    if (data && data.manual_override && data.active_session) {
      return { group: data.active_session, override: true };
    }
  } catch(e) {}
  return { group: getGroupFromTime(), override: false };
}

function showSessionBanner(group, override) {
  const banner  = document.getElementById('sessionBanner');
  const label   = document.getElementById('sessionLabel');
  const close   = document.getElementById('sessionClose');
  if (!banner) return;
  banner.style.display = 'flex';
  if (override) {
    banner.className = 'session-banner override';
    label.textContent = '🔓 Sesión forzada por administrador';
    close.textContent = `Horarios de ${group === 'manana' ? 'mañana' : 'tarde/noche'}`;
  } else if (group === 'manana') {
    banner.className = 'session-banner manana';
    label.textContent = '🌙 Encuesta Matutina';
    close.textContent = 'Cierra a las 10:00 AM';
  } else {
    banner.className = 'session-banner tarde';
    label.textContent = '☀️ Encuesta Vespertina';
    close.textContent = 'Cierra a las 10:00 PM';
  }
}

function setStatus(msg, color = '#60a5fa') {
  if (!statusMsg) return;
  statusMsg.style.color = color;
  statusMsg.textContent = msg;
}

// ── SESSION ─────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.clear();
      window.location.href = 'index.html';
    };
}

function loadSession() {
  try {
    const raw = localStorage.getItem('aeudj_user');
    if (raw && raw !== 'undefined') return JSON.parse(raw);
  } catch(e) {}
  return null;
}

// ── STAFF MENU ──────────────────────────────────────────
function buildStaffMenu(user) {
  if (!user || !user.rol || !staffMenu) return;
  const rol = user.rol;
  const isAdmin = rol.includes('admin') || rol.includes('desarrolladora');
  const isVol   = rol.includes('voluntario') || rol.includes('desarrolladora') || rol.includes('comité');
  if (!isAdmin && !isVol) return;
  staffMenu.classList.add('visible');
  staffMenu.innerHTML = '';
  if (isAdmin) {
    const a = document.createElement('a');
    a.href = 'admin.html';
    a.className = 'btn-admin';
    a.textContent = '🛡️ Panel de Administración';
    staffMenu.appendChild(a);
  }
  if (isVol) {
    const a = document.createElement('a');
    a.href = 'voluntario.html';
    a.className = 'btn-volunteer';
    a.textContent = '🟢 Panel de Voluntario';
    staffMenu.appendChild(a);
  }
}

// ── RENDER HORARIOS ─────────────────────────────────────
function renderHorarios(group) {
  if (!scheduleGrid) return;
  let visible = SCHEDULES.filter(s => s.group === group);

  // Si es Sábado (día 6), solo permitimos 7:00 AM y 12:10 PM
  const dateParts = getCycleDate(group).split('-');
  const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
  if (d.getDay() === 6) {
    visible = visible.filter(s => s.time === '7:00 AM' || s.time === '12:10 PM');
  }

  scheduleGrid.innerHTML = '';

  if (visible.length === 0) {
    scheduleGrid.innerHTML = '<p class="loading-text">No hay horarios disponibles en este momento.</p>';
    return;
  }

  visible.forEach(s => {
    const isSelected = selectedHorarios.includes(s.fullText);
    const slot = document.createElement('div');
    slot.className = 'time-slot' + (isSelected ? ' selected' : '');
    slot.dataset.dir      = s.dir;
    slot.dataset.fulltext = s.fullText;
    slot.innerHTML = `
      <div class="ts-icon">
        <i data-lucide="${s.dir === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
      </div>
      <div class="ts-time">${s.time}</div>
      <div class="ts-route">${s.route}</div>
      <span class="${s.dir === 'ida' ? 'tag-ida' : 'tag-vuelta'}">${s.dir === 'ida' ? '↗ Ida' : '↙ Vuelta'}</span>
      <div class="ts-check">✓</div>
    `;
    slot.addEventListener('click', () => toggleSlot(slot, s.fullText, s.dir));
    scheduleGrid.appendChild(slot);
  });

  if (window.lucide) window.lucide.createIcons();
}

function toggleSlot(el, fullText, dir) {
  // Limpiar selecciones previas de la misma dirección en el DOM
  document.querySelectorAll(\`.time-slot.selected[data-dir="\${dir}"]\`).forEach(n => n.classList.remove('selected'));
  
  // Limpiar selecciones previas de la misma dirección en el array
  selectedHorarios = selectedHorarios.filter(h => {
    const s = SCHEDULES.find(x => x.fullText === h);
    const direction = s ? s.dir : ((h.includes('-> La Vega') || h.includes('→ La Vega')) ? 'ida' : 'vuelta');
    return direction !== dir;
  });

  const wasSelected = el.classList.contains('selected');
  if (!wasSelected) {
    el.classList.add('selected');
    // Solo agregar si no existe ya (doble seguridad)
    if (!selectedHorarios.includes(fullText)) {
      selectedHorarios.push(fullText);
    }
  }

  // Enable submit only if one ida + one vuelta
  const hasIda    = selectedHorarios.some(h => { const s = SCHEDULES.find(x=>x.fullText===h); return s && s.dir==='ida'; });
  const hasVuelta = selectedHorarios.some(h => { const s = SCHEDULES.find(x=>x.fullText===h); return s && s.dir==='vuelta'; });
  if (submitBtn) submitBtn.disabled = !(hasIda && hasVuelta);
}

// ── CONFIRMED VIEW ──────────────────────────────────────
function renderConfirmedView(votes) {
  if (!confirmedTrips) return;
  confirmedTrips.innerHTML = '';
  
  // Deduplicación para la vista de confirmación
  const uniqueMap = new Map();
  votes.forEach(v => {
    const dir = (v.horario.includes('-> La Vega') || v.horario.includes('→ La Vega')) ? 'ida' : 'vuelta';
    // Si no existe o este es más reciente
    if (!uniqueMap.has(dir) || new Date(v.created_at) > new Date(uniqueMap.get(dir).created_at)) {
      uniqueMap.set(dir, v);
    }
  });
  const dedupedVotes = Array.from(uniqueMap.values());

  dedupedVotes.forEach(v => {
    const s = SCHEDULES.find(x => x.fullText === v.horario);
    const dir = s ? s.dir : (v.horario.includes('Jarabacoa') ? 'ida' : 'vuelta');
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.innerHTML = `
      <div class="trip-icon \${dir}">
        <i data-lucide="\${dir === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
      </div>
      <div class="trip-info">
        <div class="trip-label">\${dir === 'ida' ? 'Salida' : 'Regreso'}</div>
        <div class="trip-time">\${v.horario.split(' ').slice(0,2).join(' ')}</div>
        <div class="trip-route">\${v.horario.split(' ').slice(2).join(' ')}</div>
      </div>
      <span class="trip-badge \${v.en_espera ? 'badge-espera' : 'badge-confirmed'}">\${v.en_espera ? 'En espera' : 'Confirmado'}</span>
    `;
    confirmedTrips.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons();
}

async function showForm() {
  const { group, override } = await getActiveGroup();
  showSessionBanner(group, override);
  if (horarioForm) horarioForm.style.display = 'block';
  if (confirmedView) confirmedView.classList.remove('visible');
  const publicList = document.getElementById('publicListContainer');
  if (publicList) publicList.classList.add('hidden');
  renderHorarios(group);
}

function showConfirmed(votes) {
  if (horarioForm) horarioForm.style.display = 'none';
  if (confirmedView) confirmedView.classList.add('visible');
  const publicList = document.getElementById('publicListContainer');
  if (publicList) publicList.classList.remove('hidden');
  renderConfirmedView(votes);
}

// ── CHECK EXISTING VOTES ────────────────────────────────
async function checkYaVotado() {
  const { group, override } = await getActiveGroup();
  const cycleDate = getCycleDate(group);
  showSessionBanner(group, override);
  try {
    const { data, error } = await supabase
      .from('votos')
      .select('*')
      .eq('usuario_id', currentUser.id)
      .eq('fecha', cycleDate)
      .gt('id', 40);

    if (error) throw error;

    if (data && data.length > 0) {
      const uniqueMap = new Map();
      data.forEach(v => {
        const dir = (v.horario.includes('-> La Vega') || v.horario.includes('→ La Vega')) ? 'ida' : 'vuelta';
        if (!uniqueMap.has(dir) || new Date(v.created_at) > new Date(uniqueMap.get(dir).created_at)) {
          uniqueMap.set(dir, v);
        }
      });
      const dedupedData = Array.from(uniqueMap.values());

      // Filtrar solo los viajes que aún no se han pasado (donde se_monto es null)
      const pendingVotes = dedupedData.filter(v => v.se_monto === null);
      
      if (pendingVotes.length > 0) {
        initialVotes = dedupedData;
        selectedHorarios = dedupedData.map(v => v.horario);
        showConfirmed(pendingVotes);
      } else {
        // Si ya viajó en todos sus horarios, mostrar el formulario (para el próximo ciclo)
        showForm();
      }
    } else {
      initialVotes = [];
      selectedHorarios = [];
      showForm();
    }
  } catch(err) {
    console.error('Error verificando voto:', err);
    showForm();
  }
}

// ── PUNTO DE ESPERA ─────────────────────────────────────
let pendingSubmitData = null;  // { group, cycleDate }

const btnCamino = document.getElementById('btnEsperaCamino');
const btnParada = document.getElementById('btnEsperaParada');

if (btnCamino) btnCamino.addEventListener('click', () => confirmarConEspera('camino'));
if (btnParada) btnParada.addEventListener('click',  () => confirmarConEspera('parada'));

async function confirmarConEspera(puntoEspera) {
  const modal = document.getElementById('esperaModal');
  if (modal) modal.classList.add('hidden');
  const { cycleDate } = pendingSubmitData;

  try {
    // Delete old votes for today
    await supabase.from('votos').delete()
      .eq('usuario_id', currentUser.id)
      .eq('fecha', cycleDate);

    // Insert new votes WITH punto_espera
    const rows = selectedHorarios.map(h => ({
      usuario_id: currentUser.id,
      horario: h,
      fecha: cycleDate,
      nombre: currentUser.nombre,
      matricula: currentUser.matricula,
      email: currentUser.email || \`\${currentUser.matricula}@aeudj.com\`,
      punto_espera: puntoEspera
    }));

    const { data, error } = await supabase.from('votos').insert(rows).select();
    if (error) throw error;

    initialVotes = data;
    setStatus('✅ ¡Horarios confirmados!', '#34d399');
    setTimeout(() => showConfirmed(data), 800);

  } catch(err) {
    console.error('Error guardando voto:', err);
    setStatus('Error al guardar. Intenta de nuevo.', '#f87171');
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ── SUBMIT ───────────────────────────────────────────────
if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (selectedHorarios.length < 2) {
        setStatus('Selecciona un viaje de ida y uno de vuelta.', '#f87171');
        return;
      }
      submitBtn.disabled = true;
      setStatus('Guardando tu selección...');
      const { group } = await getActiveGroup();
      const cycleDate = getCycleDate(group);

      // Guardar datos pendientes y mostrar modal de espera
      pendingSubmitData = { group, cycleDate };
      const modal = document.getElementById('esperaModal');
      if (modal) modal.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    });
}

// ── ACTION MODAL LOGIC ──────────────────────────────────
const actionModal = document.getElementById('actionModal');
const actionModalTitle = document.getElementById('actionModalTitle');
const actionModalDesc = document.getElementById('actionModalDesc');
const actionModalContent = document.getElementById('actionModalContent');
const btnActionModalBoth = document.getElementById('btnActionModalBoth');
const closeActionModal = document.getElementById('closeActionModal');
let currentAction = null;

if (closeActionModal) {
    closeActionModal.onclick = () => {
      if (actionModal) actionModal.classList.add('hidden');
    };
}

function openActionModal(actionStr) {
  if (!actionModal) return;
  currentAction = actionStr;
  actionModalContent.innerHTML = '';
  btnActionModalBoth.classList.add('hidden');
  
  if (actionStr === 'antes') {
    actionModalTitle.textContent = 'Me fui antes';
    actionModalDesc.textContent = '¿Cuál de tus viajes de hoy realizaste antes de tiempo? (Esto liberará tu cupo para que otro lo use)';
  } else if (actionStr === 'otros') {
    actionModalTitle.textContent = 'Otros medios';
    actionModalDesc.textContent = '¿En cuál de estos viajes te irás por otros medios?';
    btnActionModalBoth.classList.remove('hidden');
    btnActionModalBoth.onclick = () => executeAction('ambos');
  } else if (actionStr === 'despues') {
    actionModalTitle.textContent = 'Iré después';
    actionModalDesc.textContent = '¿Cuál viaje deseas cambiar para irte más tarde?';
  }

  if (!initialVotes || initialVotes.length === 0) {
    actionModalContent.innerHTML = '<p style="text-align:center;color:#f87171;">No se encontraron viajes.</p>';
  } else {
    // Safeguard deduplication
    const uniqueMap = new Map();
    initialVotes.forEach(v => {
      const dir = (v.horario.includes('-> La Vega') || v.horario.includes('→ La Vega')) ? 'ida' : 'vuelta';
      if (!uniqueMap.has(dir) || new Date(v.created_at) > new Date(uniqueMap.get(dir).created_at)) {
        uniqueMap.set(dir, v);
      }
    });
    const dedupedVotes = Array.from(uniqueMap.values());

    dedupedVotes.forEach(v => {
      let s = SCHEDULES.find(x => x.fullText === v.horario);
      let dir = s ? s.dir : (v.horario.includes('Jarabacoa') ? 'ida' : 'vuelta');
      let parts = v.horario.split(' ');
      let time = parts.slice(0, 2).join(' ');
      let route = parts.slice(2).join(' ');
      
      let btn = document.createElement('div');
      btn.className = 'trip-card';
      btn.style.cursor = 'pointer';
      btn.style.width = '100%';
      btn.style.transition = 'all 0.2s';
      btn.style.background = 'rgba(59,130,246,0.1)';
      btn.style.border = '1px solid rgba(59,130,246,0.3)';
      
      btn.onmouseover = () => { btn.style.background = 'rgba(59,130,246,0.2)'; btn.style.transform = 'translateY(-2px)'; };
      btn.onmouseout = () => { btn.style.background = 'rgba(59,130,246,0.1)'; btn.style.transform = 'none'; };
      
      btn.innerHTML = \`
        <div class="trip-icon \${dir}">
          <i data-lucide="\${dir === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
        </div>
        <div class="trip-info">
          <div class="trip-label" style="color:#93c5fd;">\${dir === 'ida' ? 'Salida' : 'Regreso'}</div>
          <div class="trip-time" style="color:white;">\${time}</div>
          <div class="trip-route" style="color:#cbd5e1;">\${route}</div>
        </div>
      \`;
      btn.onclick = () => executeAction(v);
      actionModalContent.appendChild(btn);
    });
  }
  
  if (window.lucide) window.lucide.createIcons();
  actionModal.classList.remove('hidden');
}

async function executeAction(voteObj) {
  if (actionModal) actionModal.classList.add('hidden');
  
  const horarioToChange = voteObj === 'ambos' ? 'ambos' : voteObj.horario;
  const voteDate = voteObj === 'ambos' ? (await (async () => {
    const { group } = await getActiveGroup();
    return getCycleDate(group);
  })()) : voteObj.fecha;

  if (currentAction === 'despues') {
    isEditing = true;
    selectedHorarios = initialVotes.map(v => v.horario).filter(h => h !== horarioToChange);
    showForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  try {
    let query = supabase.from('votos').delete().eq('usuario_id', currentUser.id).eq('fecha', voteDate);
    if (horarioToChange !== 'ambos') {
       query = query.eq('horario', horarioToChange);
    }
    
    const { error } = await query;
    if (error) throw error;

    if (horarioToChange === 'ambos') {
      initialVotes = [];
      selectedHorarios = [];
    }

    await checkYaVotado(); 
    console.log('Operación realizada con éxito');
  } catch (e) {
    console.error(e);
    alert("Error al procesar: " + e.message);
  }
}

const btnAntes = document.getElementById('btnMeFuiAntes');
const btnDespues = document.getElementById('btnIreDespues');
const btnOtros = document.getElementById('btnOtrosMedios');
const btnCambiar = document.getElementById('btnCambiarHorario');

if (btnAntes) btnAntes.onclick = () => openActionModal('antes');
if (btnDespues) btnDespues.onclick = () => openActionModal('despues');
if (btnOtros) btnOtros.onclick = () => openActionModal('otros');
if (btnCambiar) {
    btnCambiar.onclick = () => {
      isEditing = true;
      selectedHorarios = [...initialVotes.map(v => v.horario)];
      showForm();
    };
}

// ── INIT ─────────────────────────────────────────────────
async function init() {
  // 1. Get current session from Supabase
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  // 2. Fetch LATEST profile to reflect any role changes
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
      
    if (error || !profile) {
      // If profile not found but session exists, try using local storage as fallback or redirect
      const local = loadSession();
      if (!local) { window.location.href = 'index.html'; return; }
      currentUser = local;
    } else {
      currentUser = profile;
      localStorage.setItem('aeudj_user', JSON.stringify(profile));
    }
  } catch (e) {
    currentUser = loadSession();
    if (!currentUser) { window.location.href = 'index.html'; return; }
  }

  buildStaffMenu(currentUser);
  await checkYaVotado();
}

init();
