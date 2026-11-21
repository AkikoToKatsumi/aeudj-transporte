// Usamos el cliente global de Supabase cargado en el HTML
const supabase = window.supabase;

if (!supabase) {
  console.error('Supabase client not found! Ensure the library is loaded in the HTML.');
}

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
// Variable global para caché de tiempo
let cachedDRDate = null;
let lastTimeFetch = 0;

async function getDRDate() {
  const nowMs = Date.now();
  if (cachedDRDate && (nowMs - lastTimeFetch < 60000)) {
    return cachedDRDate;
  }
  try {
    const res = await fetch(window.location.href.split('?')[0] + '?_t=' + nowMs, { method: 'HEAD', cache: 'no-store' });
    const dateStr = res.headers.get('Date');
    if (dateStr) {
      const serverDate = new Date(dateStr);
      // UTC-4 para República Dominicana
      const drTimeMs = serverDate.getTime() - (4 * 60 * 60 * 1000);
      const drDate = new Date(drTimeMs);
      cachedDRDate = {
        year: drDate.getUTCFullYear(),
        month: drDate.getUTCMonth(),
        date: drDate.getUTCDate(),
        hours: drDate.getUTCHours()
      };
      lastTimeFetch = nowMs;
      return cachedDRDate;
    }
  } catch(e) {}
  
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    date: now.getDate(),
    hours: now.getHours()
  };
}

async function getCycleDate(group) {
  const dr = await getDRDate();
  
  let targetYear = dr.year;
  let targetMonth = dr.month;
  let targetDate = dr.date;
  
  // Matutina: voting at night for next morning → date is tomorrow
  if (group === 'manana' && dr.hours >= 22) {
    const d = new Date(Date.UTC(dr.year, dr.month, dr.date + 1));
    targetYear = d.getUTCFullYear();
    targetMonth = d.getUTCMonth();
    targetDate = d.getUTCDate();
  }
  
  const y = targetYear;
  const m = String(targetMonth + 1).padStart(2, '0');
  const dStr = String(targetDate).padStart(2, '0');
  return `${y}-${m}-${dStr}`;
}

async function getGroupFromTime() {
  const dr = await getDRDate();
  return (dr.hours >= 22 || dr.hours < 10) ? 'manana' : 'tarde';
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
  const group = await getGroupFromTime();
  return { group, override: false };
}

function showSessionBanner(group, override) {
  const banner  = document.getElementById('sessionBanner');
  const label   = document.getElementById('sessionLabel');
  const close   = document.getElementById('sessionClose');
  if (!banner) return;
  banner.classList.add('flex');
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
  statusMsg.style.color = color; // Dynamic color still allowed for now, but better use classes
  statusMsg.textContent = msg;
}

// ── SESSION ─────────────────────────────────────────────
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch(e) {}
    localStorage.clear();
    window.location.href = 'index.html';
  });
}

function loadSession() {
  try {
    const raw = localStorage.getItem('aeudj_user');
    if (raw && raw !== 'undefined') return JSON.parse(raw);
  } catch(e) {}
  return null;
}

// ── MENU SUPERIOR (Estudiante, Voluntario, Admin) ───────────────
function buildStaffMenu(user) {
  if (!user || !staffMenu) return;
  const rol = user.rol || '';
  const isAdmin = rol.includes('admin') || rol.includes('desarrolladora');
  const isVol   = rol.includes('voluntario') || rol.includes('desarrolladora') || rol.includes('comité');
  const isAyu   = rol.includes('ayudante') || rol.includes('desarrolladora');
  
  staffMenu.classList.add('visible');
  staffMenu.innerHTML = '';
  
  // 1. Estudiante (Visible for everyone)
  const aStudent = document.createElement('a');
  aStudent.href = 'estudiante.html';
  aStudent.className = 'btn-student';
  aStudent.textContent = '🎓 Portal del Estudiante';
  staffMenu.appendChild(aStudent);

  // 2. Ayudante
  if (isAyu) {
    const a = document.createElement('a');
    a.href = 'ayudante.html';
    a.className = 'btn-helper';
    a.style.cssText = 'background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); color: #67e8f9;';
    a.textContent = '🤝 Panel de Ayudante';
    staffMenu.appendChild(a);
  }

  // 3. Voluntario
  if (isVol) {
    const a = document.createElement('a');
    a.href = 'voluntario.html';
    a.className = 'btn-volunteer';
    a.textContent = '🟢 Panel de Voluntario';
    staffMenu.appendChild(a);
  }

  // 4. Admin
  if (isAdmin) {
    const a = document.createElement('a');
    a.href = 'admin.html';
    a.className = 'btn-admin';
    a.textContent = '🛡️ Panel de Administración';
    staffMenu.appendChild(a);
  }
}



function getHorarioDir(h) {
  const s = SCHEDULES.find(x => x.fullText === h);
  return s ? s.dir : ((h.includes('-> La Vega') || h.includes('→ La Vega')) ? 'ida' : 'vuelta');
}

function isHorarioExpiredForVoting(horario, fecha) {
  return typeof window.isScheduleExpired === 'function' && window.isScheduleExpired(horario, fecha, 0);
}

function isVoteLocked(v, fallbackDate) {
  if (!v) return false;
  return v.se_monto !== null || isHorarioExpiredForVoting(v.horario, v.fecha || fallbackDate);
}

function getLockedDirs(cycleDateStr) {
  const locked = new Set();
  (initialVotes || []).forEach(v => {
    if (v.fecha === cycleDateStr && isVoteLocked(v, cycleDateStr)) {
      locked.add(getHorarioDir(v.horario));
    }
  });
  return locked;
}

function updateSubmitState(cycleDateStr, visibleSchedules) {
  if (!submitBtn) return;
  const lockedDirs = getLockedDirs(cycleDateStr);
  const hasAvailableIda = visibleSchedules.some(s => s.dir === 'ida' && !isHorarioExpiredForVoting(s.fullText, cycleDateStr));
  const hasAvailableVuelta = visibleSchedules.some(s => s.dir === 'vuelta' && !isHorarioExpiredForVoting(s.fullText, cycleDateStr));

  const hasSelectedIda = selectedHorarios.some(h => getHorarioDir(h) === 'ida');
  const hasSelectedVuelta = selectedHorarios.some(h => getHorarioDir(h) === 'vuelta');

  const idaOk = !hasAvailableIda || lockedDirs.has('ida') || hasSelectedIda;
  const vueltaOk = !hasAvailableVuelta || lockedDirs.has('vuelta') || hasSelectedVuelta;

  submitBtn.disabled = !(selectedHorarios.length > 0 && idaOk && vueltaOk);
}

// ── RENDER HORARIOS ─────────────────────────────────────
async function renderHorarios(group) {
  if (!scheduleGrid) return;
  let visible = SCHEDULES.filter(s => s.group === group);

  // Si es Sábado (día 6), solo permitimos 7:00 AM y 12:10 PM
  const cycleDateStr = await getCycleDate(group);
  const dateParts = cycleDateStr.split('-');
  const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
  if (d.getDay() === 6) {
    visible = visible.filter(s => s.time === '7:00 AM' || s.time === '12:10 PM');
  }

  const lockedDirs = getLockedDirs(cycleDateStr);

  // ── PROTECCIÓN: Purgar selecciones inválidas, expiradas o de dirección ya pasada ──
  const validFullTexts = new Set(visible.map(s => s.fullText));
  const before = selectedHorarios.length;
  selectedHorarios = selectedHorarios.filter(h =>
    validFullTexts.has(h) &&
    !isHorarioExpiredForVoting(h, cycleDateStr) &&
    !lockedDirs.has(getHorarioDir(h))
  );
  if (selectedHorarios.length !== before) {
    console.warn(`⚠️ Se purgaron ${before - selectedHorarios.length} horario(s) inválidos o expirados para "${group}"`);
  }

  scheduleGrid.innerHTML = '';

  if (visible.length === 0) {
    scheduleGrid.innerHTML = '<p class="loading-text">No hay horarios disponibles en este momento.</p>';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const anyOpen = visible.some(s => !isHorarioExpiredForVoting(s.fullText, cycleDateStr) && !lockedDirs.has(s.dir));

  // Obtener conteo actual de cupos por horario (sin bloquear votación)
  const countsMap = {};
  try {
    const { data: dayVotes } = await supabase
      .from('votos')
      .select('horario, matricula, usuario_id')
      .eq('fecha', cycleDateStr);
    const seen = new Set();
    (dayVotes || []).forEach(v => {
      const hNorm = (v.horario || '').replace('->', '→').trim();
      const key = `${v.matricula || v.usuario_id}|${hNorm}`;
      if (!seen.has(key)) {
        seen.add(key);
        countsMap[hNorm] = (countsMap[hNorm] || 0) + 1;
      }
    });
  } catch (e) {
    console.warn('No se pudieron cargar conteos de cupos:', e);
  }

  visible.forEach(s => {
    const expired = isHorarioExpiredForVoting(s.fullText, cycleDateStr);
    const dirLocked = lockedDirs.has(s.dir);
    const disabled = expired || dirLocked;
    const isSelected = !disabled && selectedHorarios.includes(s.fullText);

    const hNorm = s.fullText.replace('->', '→').trim();
    const count = countsMap[hNorm] || 0;
    let quotaBadge = '';
    if (!expired) {
      const cls = count > 30 ? 'ts-quota-wait' : 'ts-quota-ok';
      quotaBadge = `<div class="ts-quota ${cls}">🪑 Asientos: ${count}/30</div>`;
    }

    const slot = document.createElement('div');
    slot.className = 'time-slot' + (isSelected ? ' selected' : '') + (disabled ? ' expired' : '');
    slot.dataset.dir      = s.dir;
    slot.dataset.fulltext = s.fullText;
    slot.innerHTML = `
      <div class="ts-icon">
        <i data-lucide="${s.dir === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
      </div>
      <div class="ts-time">${s.time}</div>
      <div class="ts-route">${s.route}</div>
      <span class="${s.dir === 'ida' ? 'tag-ida' : 'tag-vuelta'}">${s.dir === 'ida' ? '↗ Ida' : '↙ Vuelta'}</span>
      ${quotaBadge}
      ${expired ? '<div class="tag-expired">Cerrado · Ya pasó</div>' : (dirLocked ? '<div class="tag-expired">Turno ya registrado</div>' : '<div class="ts-check">✓</div>')}
    `;
    if (!disabled) {
      slot.addEventListener('click', () => toggleSlot(slot, s.fullText, s.dir, cycleDateStr, visible));
    } else {
      slot.addEventListener('click', () => {
        setStatus(
          expired
            ? `⏰ El horario de las ${s.time} ya pasó y está cerrado.`
            : `🔒 Ya tienes un viaje de ${s.dir === 'ida' ? 'ida' : 'vuelta'} registrado que no puede modificarse.`,
          '#fbbf24'
        );
      });
    }
    scheduleGrid.appendChild(slot);
  });

  if (!anyOpen) {
    setStatus('⏰ Todos los horarios de esta sesión ya pasaron.', '#fbbf24');
  }

  updateSubmitState(cycleDateStr, visible);
  if (window.lucide) window.lucide.createIcons();
}

function toggleSlot(el, fullText, dir, cycleDateStr, visibleSchedules) {
  const wasSelected = el.classList.contains('selected');

  // Limpiar selecciones previas de la misma dirección en el DOM
  document.querySelectorAll(`.time-slot.selected[data-dir="${dir}"]`).forEach(n => n.classList.remove('selected'));

  // Limpiar selecciones previas de la misma dirección en el array
  selectedHorarios = selectedHorarios.filter(h => getHorarioDir(h) !== dir);

  if (!wasSelected) {
    el.classList.add('selected');
    if (!selectedHorarios.includes(fullText)) {
      selectedHorarios.push(fullText);
    }
  }

  updateSubmitState(cycleDateStr, visibleSchedules);
}

// ── CONFIRMED VIEW ──────────────────────────────────────
function renderConfirmedView(votes) {
  if (!confirmedTrips) return;
  confirmedTrips.innerHTML = '';
  
  const uniqueMap = new Map();
  votes.forEach(v => {
    const dir = (v.horario.includes('-> La Vega') || v.horario.includes('→ La Vega')) ? 'ida' : 'vuelta';
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
      <div class="trip-icon ${dir}">
        <i data-lucide="${dir === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
      </div>
      <div class="trip-info">
        <div class="trip-label">${dir === 'ida' ? 'Salida' : 'Regreso'}</div>
        <div class="trip-time">${v.horario.split(' ').slice(0,2).join(' ')}</div>
        <div class="trip-route">${v.horario.split(' ').slice(2).join(' ')}</div>
      </div>
      <span class="trip-badge ${v.en_espera ? 'badge-espera' : 'badge-confirmed'}">${v.en_espera ? 'En espera' : 'Confirmado'}</span>
    `;
    confirmedTrips.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons();
}

async function showForm() {
  const { group, override } = await getActiveGroup();
  showSessionBanner(group, override);
  if (horarioForm) horarioForm.classList.remove('hidden');
  if (confirmedView) confirmedView.classList.remove('visible');
  const publicList = document.getElementById('publicListContainer');
  if (publicList) publicList.classList.add('hidden');
  await renderHorarios(group);
}

function showConfirmed(votes) {
  if (horarioForm) horarioForm.classList.add('hidden');
  if (confirmedView) confirmedView.classList.add('visible');
  const publicList = document.getElementById('publicListContainer');
  if (publicList) publicList.classList.remove('hidden');
  renderConfirmedView(votes);
}

// ── CHECK EXISTING VOTES ────────────────────────────────
async function checkYaVotado() {
  const { group, override } = await getActiveGroup();
  const cycleDate = await getCycleDate(group);
  showSessionBanner(group, override);
  try {
    const { data, error } = await supabase
      .from('votos')
      .select('*')
      .eq('usuario_id', currentUser.id)
      .eq('fecha', cycleDate);

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
      if (typeof window.autoMarkExpiredUnpassedVotes === 'function') {
        await window.autoMarkExpiredUnpassedVotes(dedupedData, currentUser.id);
      }
      const pendingVotes = dedupedData.filter(v => v.se_monto === null);
      
      if (pendingVotes.length > 0) {
        initialVotes = dedupedData;
        selectedHorarios = dedupedData.map(v => v.horario);
        showConfirmed(pendingVotes);
      } else {
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
  if (!pendingSubmitData) return;

  // ── PROTECCIÓN FINAL: Re-validar grupo activo y horarios no expirados antes de insertar ──
  const { group: currentGroup } = await getActiveGroup();
  const currentCycleDate = await getCycleDate(currentGroup);
  const allowedFT = new Set(SCHEDULES.filter(s => s.group === currentGroup).map(s => s.fullText));
  const lockedDirs = getLockedDirs(currentCycleDate);
  const invalid = selectedHorarios.filter(h =>
    !allowedFT.has(h) ||
    isHorarioExpiredForVoting(h, currentCycleDate) ||
    lockedDirs.has(getHorarioDir(h))
  );
  if (invalid.length > 0) {
    console.error('❌ Bloqueo final: horarios inválidos o cerrados:', invalid);
    setStatus('⚠️ Uno o más horarios seleccionados ya pasaron o no son válidos.', '#f87171');
    selectedHorarios = [];
    pendingSubmitData = null;
    if (submitBtn) submitBtn.disabled = false;
    setTimeout(() => showForm(), 1500);
    return;
  }

  const cycleDate = currentCycleDate;

  try {
    // Obtener votos actuales del usuario hoy para NO borrar/reinsertar listas ya pasadas o cerradas
    const { data: existingToday } = await supabase
      .from('votos')
      .select('*')
      .eq('usuario_id', currentUser.id)
      .eq('fecha', cycleDate);

    const editableIds = (existingToday || [])
      .filter(v => !isVoteLocked(v, cycleDate))
      .map(v => v.id);

    if (editableIds.length > 0) {
      await supabase.from('votos').delete().in('id', editableIds);
    }

    const rows = selectedHorarios.map(h => ({
      usuario_id: currentUser.id,
      horario: h,
      fecha: cycleDate,
      nombre: currentUser.nombre,
      matricula: currentUser.matricula,
      email: currentUser.email || `${currentUser.matricula}@aeudj.com`,
      punto_espera: puntoEspera
    }));

    const { data, error } = await supabase.from('votos').insert(rows).select();
    if (error) throw error;

    const lockedVotes = (existingToday || []).filter(v => isVoteLocked(v, cycleDate));
    initialVotes = [...lockedVotes, ...(data || [])];
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
      if (selectedHorarios.length < 1) {
        setStatus('Selecciona al menos un horario disponible.', '#f87171');
        return;
      }
      submitBtn.disabled = true;
      setStatus('Verificando sesión...');

      // ── PROTECCIÓN: Re-verificar grupo activo y horarios no expirados al momento del submit ──
      const { group } = await getActiveGroup();
      const cycleDate = await getCycleDate(group);
      const allowedSchedules = SCHEDULES.filter(s => s.group === group);
      const allowedFullTexts = new Set(allowedSchedules.map(s => s.fullText));
      const lockedDirs = getLockedDirs(cycleDate);

      const invalidSelections = selectedHorarios.filter(h =>
        !allowedFullTexts.has(h) ||
        isHorarioExpiredForVoting(h, cycleDate) ||
        lockedDirs.has(getHorarioDir(h))
      );
      if (invalidSelections.length > 0) {
        console.error('❌ Horarios inválidos o cerrados:', invalidSelections);
        setStatus('⚠️ Uno o más horarios seleccionados ya pasaron o no son válidos.', '#f87171');
        submitBtn.disabled = false;
        setTimeout(async () => {
          selectedHorarios = [];
          await showForm();
        }, 2000);
        return;
      }

      setStatus('Guardando tu selección...');

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
  if (actionModalContent) actionModalContent.innerHTML = '';
  if (btnActionModalBoth) btnActionModalBoth.classList.add('hidden');
  
  if (actionStr === 'antes') {
    if (actionModalTitle) actionModalTitle.textContent = 'Me fui antes';
    if (actionModalDesc) actionModalDesc.textContent = '¿Cuál de tus viajes de hoy realizaste antes de tiempo? (Esto liberará tu cupo para que otro lo use)';
  } else if (actionStr === 'otros') {
    if (actionModalTitle) actionModalTitle.textContent = 'Otros medios';
    if (actionModalDesc) actionModalDesc.textContent = '¿En cuál de estos viajes te irás por otros medios?';
    if (btnActionModalBoth) {
      btnActionModalBoth.classList.remove('hidden');
      btnActionModalBoth.onclick = () => executeAction('ambos');
    }
  } else if (actionStr === 'despues') {
    if (actionModalTitle) actionModalTitle.textContent = 'Iré después';
    if (actionModalDesc) actionModalDesc.textContent = '¿Cuál viaje deseas cambiar para irte más tarde?';
  }

  if (!initialVotes || initialVotes.length === 0) {
    if (actionModalContent) actionModalContent.innerHTML = '<p class="text-center text-red-400">No se encontraron viajes.</p>';
  } else {
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
      const locked = isVoteLocked(v, v.fecha);

      let btn = document.createElement('div');
      btn.className = 'trip-card ' + (locked ? 'opacity-50 cursor-not-allowed' : 'trip-card-interactive');

      btn.innerHTML = `
        <div class="trip-icon ${dir}">
          <i data-lucide="${dir === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
        </div>
        <div class="trip-info">
          <div class="trip-label ${dir === 'ida' ? 'trip-label-ida' : 'trip-label-vuelta'}">${dir === 'ida' ? 'Salida' : 'Regreso'}${locked ? ' · Ya pasó' : ''}</div>
          <div class="trip-time text-white">${time}</div>
          <div class="trip-route text-slate-400">${route}</div>
        </div>
      `;
      if (!locked) {
        btn.onclick = () => executeAction(v);
      }
      if (actionModalContent) actionModalContent.appendChild(btn);
    });
  }
  
  if (window.lucide) window.lucide.createIcons();
  actionModal.classList.remove('hidden');
}

async function executeAction(voteObj) {
  if (actionModal) actionModal.classList.add('hidden');
  
  const horarioToChange = voteObj === 'ambos' ? 'ambos' : voteObj.horario;
  let voteDate = '';
  if (voteObj === 'ambos') {
    const { group } = await getActiveGroup();
    voteDate = await getCycleDate(group);
  } else {
    voteDate = voteObj.fecha;
  }

  if (currentAction === 'despues') {
    isEditing = true;
    selectedHorarios = initialVotes
      .filter(v => !isVoteLocked(v, voteDate) && v.horario !== horarioToChange)
      .map(v => v.horario);
    showForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  try {
    if (horarioToChange === 'ambos') {
      const editableIds = (initialVotes || [])
        .filter(v => !isVoteLocked(v, voteDate))
        .map(v => v.id);
      if (editableIds.length > 0) {
        const { error } = await supabase.from('votos').delete().in('id', editableIds);
        if (error) throw error;
      }
      initialVotes = (initialVotes || []).filter(v => isVoteLocked(v, voteDate));
      selectedHorarios = [];
    } else {
      const { error } = await supabase
        .from('votos')
        .delete()
        .eq('usuario_id', currentUser.id)
        .eq('fecha', voteDate)
        .eq('horario', horarioToChange)
        .is('se_monto', null);
      if (error) throw error;
    }

    await checkYaVotado(); 
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
      selectedHorarios = (initialVotes || [])
        .filter(v => !isVoteLocked(v, v.fecha))
        .map(v => v.horario);
      showForm();
    };
}

// ── INIT ─────────────────────────────────────────────────
async function init() {
  console.log('🚀 Votar Page Initializing...');
  try {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    
    if (sessionErr) throw sessionErr;

    if (!session) {
      localStorage.clear();
      window.location.href = 'index.html';
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
      
    if (profileErr) {
      currentUser = loadSession();
      if (!currentUser) { 
        setStatus('No se pudo cargar el perfil. Por favor, inicia sesión de nuevo.', '#f87171');
        return; 
      }
    } else {
      currentUser = profile;
      localStorage.setItem('aeudj_user', JSON.stringify(profile));
    }

    buildStaffMenu(currentUser);
    await checkYaVotado();
    console.log('Init completed successfully');

  } catch (e) {
    console.error('CRITICAL INIT ERROR:', e);
    setStatus('Error crítico al cargar: ' + e.message, '#f87171');
  }
}

init();
