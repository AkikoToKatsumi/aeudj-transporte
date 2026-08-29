// ── EmailJS CONFIG ──
const EMAILJS_SERVICE  = 'service_afofocu';
const EMAILJS_TEMPLATE = 'template_ryyejnp';
const EMAILJS_PUBLIC   = 'nFSfa8vIE5hozX8Ok';
// Inicializar EmailJS
if (window.emailjs) emailjs.init(EMAILJS_PUBLIC);

// Usamos el cliente global de Supabase cargado en el HTML
const supabase = window.supabase;

if (!supabase) {
  console.error('Supabase client not found! Ensure the library is loaded in the HTML.');
}

const IDA_KEYWORDS = ['Jarabacoa -> La Vega', 'Jarabacoa → La Vega'];
function isIda(h) { return IDA_KEYWORDS.some(k => h.includes(k)); }
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
function formatDate(d) {
  const [y,m,day] = d.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} de ${months[parseInt(m)-1]} de ${y}`;
}

let allVotos = [];
let activeFilter = 'todos';
// attendance: { votoId -> 'subio' | 'no-subio' }
const attendanceState = {};

// Toast helper
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3200);
}

// Auth check
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

const btnRefresh = document.getElementById('btnRefresh');
if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    loadData();
    showToast('Datos actualizados', 'success');
  });
}

let currentUser = null;
try {
  const raw = localStorage.getItem('aeudj_user');
  if (raw && raw !== 'undefined') currentUser = JSON.parse(raw);
} catch(e) {}

async function checkSecurity() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }
  
  const { data: profile } = await supabase.from('profiles').select('rol, dia_asignado, horario_asignado').eq('id', user.id).single();
  if (profile) {
    currentUser = { ...currentUser, ...profile };
  }
  const rol = profile.rol || '';
  const isAuthorized = rol.includes('admin') || rol.includes('desarrolladora') || rol.includes('comité') || rol.includes('voluntario');
  
  if (!profile || !isAuthorized) {
    console.error("Acceso denegado: Insuficientes privilegios");
    window.location.href = 'votar.html';
    return;
  }

  // Show admin link if developer/admin
  const adminLink = document.getElementById('adminLink');
  if (adminLink && (profile.rol.includes('admin') || profile.rol.includes('desarrolladora'))) {
    adminLink.style.display = 'inline-flex';
  }
}
checkSecurity();

async function loadData() {
  const cycleDate = getCycleDate();
  const fechaBadge = document.getElementById('currentDate');
  if (fechaBadge) fechaBadge.textContent = formatDate(cycleDate);
  const container = document.getElementById('horariosContainer');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p class="mt-4">Actualizando...</p></div>';

  try {
    const { data, error } = await supabase
      .from('votos').select('*')
      .eq('fecha', cycleDate)
      .order('horario', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    let fetchedVotos = data || [];
    const isAdmin = currentUser && (currentUser.rol.includes('admin') || currentUser.rol.includes('desarrolladora') || currentUser.rol.includes('comité'));
    const isVolunteer = currentUser && currentUser.rol.includes('voluntario');
    
    // Si no es admin ni voluntario con acceso total, filtramos por su horario asignado
    if (!isAdmin && !isVolunteer && currentUser) {
      // Determinar qué día de la semana es (Lunes, Martes, etc.)
      const d = new Date(cycleDate + 'T12:00:00'); 
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = days[d.getDay()];
      
      let allowedSchedules = [];
      try {
        const scheds = JSON.parse(currentUser.horario_asignado || '{}');
        allowedSchedules = scheds[dayName] || [];
      } catch(e) {
        // Fallback para el formato de texto simple antiguo
        if (currentUser.dia_asignado === dayName) {
          allowedSchedules = [currentUser.horario_asignado];
        }
      }
      
      // Filtrar la lista general para que solo vea sus turnos asignados
      fetchedVotos = fetchedVotos.filter(v => allowedSchedules.includes(v.horario));
    }
    
    allVotos = fetchedVotos;
    // Sincronizar estado local con DB usando la columna correcta (se_monto)
    allVotos.forEach(v => {
      if (v.se_monto === 1) attendanceState[v.id] = 'subio';
      else if (v.se_monto === 0) attendanceState[v.id] = 'no-subio';
    });
    
    renderList();
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
  } catch(err) {
    const container = document.getElementById('horariosContainer');
    if (container) container.innerHTML = `<div class="empty-state"><p class="text-red-400">Error: ${err.message}</p></div>`;
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
  }
}

function renderList() {
  const container = document.getElementById('horariosContainer');
  if (!container) return;
  let filtered = allVotos;
  if (activeFilter === 'ida')    filtered = allVotos.filter(v => isIda(v.horario));
  if (activeFilter === 'vuelta') filtered = allVotos.filter(v => !isIda(v.horario));

  const statTotal = document.getElementById('statTotal');
  const statPresentes = document.getElementById('statPresentes');
  const statTurnos = document.getElementById('statTurnos');

  if (statTotal) statTotal.textContent = allVotos.length;
  if (statPresentes) statPresentes.textContent = Object.values(attendanceState).filter(v => v === 'subio').length;
  if (statTurnos) statTurnos.textContent = new Set(allVotos.map(v=>v.horario)).size;

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay pasajeros en este filtro.</p></div>';
    return;
  }

  const groups = {};
  filtered.forEach(v => {
    if (!groups[v.horario]) groups[v.horario] = [];
    groups[v.horario].push(v);
  });

  let pendingGroupsCount = 0;

  Object.entries(groups).forEach(([horario, passengers]) => {
    // Ocultar el grupo si ya fue pasado por completo
    const completado = passengers.every(p => attendanceState[p.id] !== undefined);
    if (completado) return;

    pendingGroupsCount++;
    
    const ida = isIda(horario);
    const section = document.createElement('div');
    section.className = 'horario-section glass-card';

    const header = document.createElement('div');
    header.className = 'horario-header';
    header.innerHTML = `
      <div class="horario-title">${horario}</div>
      <div class="horario-meta">
        <span class="dir-badge ${ida ? 'dir-ida' : 'dir-vuelta'}">${ida ? '↗ Ida' : '↙ Vuelta'}</span>
        <span class="count-badge">${passengers.length} persona${passengers.length!==1?'s':''}</span>
        <i data-lucide="chevron-down" class="chevron open icon-small"></i>
      </div>
    `;

    const table = document.createElement('div');
    table.className = 'passenger-table';

    passengers.forEach((p, idx) => {
      const t = new Date(p.created_at);
      let hours = t.getHours();
      const minutes = t.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;
      const isSubio   = attendanceState[p.id] === 'subio';
      const isNoSubio = attendanceState[p.id] === 'no-subio';

      const row = document.createElement('div');
      row.className = 'passenger-row';
      row.innerHTML = `
        <div class="row-num">${idx+1}</div>
        <div class="row-info">
          <div class="row-name"></div>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="row-mat"></div>
            <div class="flex gap-2 badges-area"></div>
          </div>
        </div>
        <div class="row-time"></div>
        <div class="attendance-btns">
          <button type="button" class="att-btn subio ${isSubio ? 'active' : ''}" data-id="${p.id}" data-action="subio">\u2705 Subi\u00f3</button>
          <button type="button" class="att-btn no-subio ${isNoSubio ? 'active' : ''}" data-id="${p.id}" data-action="no-subio">\u274c No subi\u00f3</button>
        </div>
      `;
      
      row.querySelector('.row-name').textContent = p.nombre || 'Sin nombre';
      row.querySelector('.row-mat').textContent = p.matricula || '';
      row.querySelector('.row-time').textContent = time;
      
      const badgesArea = row.querySelector('.badges-area');
      const isWaitlist = p.en_espera || (idx >= 30);
      
      if (isWaitlist) {
        const span = document.createElement('span');
        span.className = 'badge-espera';
        span.textContent = 'Espera';
        badgesArea.appendChild(span);
      }
      if (p.punto_espera === 'camino' || p.punto_espera === 'parada') {
        const pointSpan = document.createElement('span');
        pointSpan.className = 'badge-point-espera';
        pointSpan.textContent = p.punto_espera === 'camino' ? '🚶 Camino' : '📍 Parada';
        badgesArea.appendChild(pointSpan);
      }


      // Attendance events
      row.querySelectorAll('.att-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const prev   = attendanceState[p.id];
          if (prev === action) return; // already marked

          // Update local state immediately
          attendanceState[p.id] = action;
          
          // Update UI manually to prevent collapsing the list
          row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // Update the Presentes counter
          const statPresentes = document.getElementById('statPresentes');
          if (statPresentes) {
            statPresentes.textContent = Object.values(attendanceState).filter(v => v === 'subio').length;
          }

          // Save to Supabase (in background)
          marcarAsistencia(p, action);
        });
      });

      table.appendChild(row);
    });

    // Collapsible
    header.addEventListener('click', () => {
      const chevron = header.querySelector('.chevron');
      const isOpen = table.classList.toggle('open');
      chevron.classList.toggle('open', isOpen);
    });

    const notifyBar = document.createElement('div');
    notifyBar.className = 'notify-bar';
    notifyBar.style.justifyContent = 'center';
    notifyBar.innerHTML = `
       <button class="notify-btn whatsapp"><i data-lucide="message-circle"></i> Enviar aviso por WhatsApp</button>
    `;
    
    const notifyBtns = notifyBar.querySelectorAll('.notify-btn');
    if (notifyBtns.length > 0) {
      notifyBtns[0].onclick = (e) => window.sendWhatsAppNotification(horario);
    }

    section.appendChild(header);
    section.appendChild(table);
    section.appendChild(notifyBar);
    container.appendChild(section);
  });

  if (Object.keys(groups).length === 0) {
    container.innerHTML = `
    <div class="empty-state-container">
      <div class="empty-state-icon">
        <i data-lucide="clipboard-x" class="icon-medium"></i>
      </div>
      <h2 class="empty-state-title">Sin registros</h2>
      <p class="empty-state-desc">No se han encontrado pasajeros registrados para los turnos de hoy.</p>
    </div>
    `;
  } else if (pendingGroupsCount === 0) {
    container.innerHTML = `
    <div class="success-state-container">
      <div class="success-state-icon">
        <i data-lucide="check-check" class="icon-medium"></i>
      </div>
      <h2 class="success-state-title">¡Excelente trabajo!</h2>
      <p class="success-state-desc">Has completado el pase de lista para estos viajes. Ya no quedan pasajeros pendientes.</p>
    </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderList();
  });
});

const reloadFab = document.getElementById('reloadFab');
if (reloadFab) reloadFab.onclick = loadData;

if (window.lucide) window.lucide.createIcons();
loadData();

// ── VERIFICAR Y OTORGAR PUNTOS POR LISTA COMPLETA ─────────
async function verificarYOtorgarPuntosHorarioCompleto(horario, fecha) {
  let volId = currentUser?.id;
  if (!volId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) volId = user.id;
    } catch(e) {}
  }
  if (!volId) return;

  try {
    // 1. Obtener todos los pasajeros registrados en este horario y fecha
    const { data: votosHorario, error } = await supabase
      .from('votos')
      .select('id, se_monto')
      .eq('horario', horario)
      .eq('fecha', fecha);

    if (error || !votosHorario || votosHorario.length === 0) return;

    // 2. Verificar que TODOS hayan sido marcados (se_monto === 1 o se_monto === 0, no null)
    const todosMarcados = votosHorario.every(v => v.se_monto === 1 || v.se_monto === 0);
    const motivo = `Pase de lista completo - ${horario} (${fecha})`;

    if (todosMarcados) {
      // 3. Verificar si ya se otorgaron los puntos para este horario de hoy
      const { data: existingPoint } = await supabase
        .from('puntos_log')
        .select('id')
        .eq('motivo', motivo)
        .maybeSingle();

      if (!existingPoint) {
        // Otorgar los 3 puntos por completar la lista
        const { error: insErr } = await supabase.from('puntos_log').insert({
          voluntario_id: volId,
          puntos: 3,
          motivo: motivo
        });
        if (!insErr) {
          console.log(`✅ +3 puntos otorgados al voluntario por completar la lista de ${horario}`);
          showToast(`🎉 ¡Lista completada al 100%! +3 puntos ganados`, 'success');
        }
      }
    } else {
      // Si falta alguien por marcar, no se tienen los puntos de esta lista
      await supabase.from('puntos_log').delete().eq('motivo', motivo);
    }
  } catch (err) {
    console.error('Error al verificar lista completa:', err);
  }
}

// ── MARCAR ASISTENCIA ──────────────────────────────────
async function marcarAsistencia(p, action) {
  const subio = (action === 'subio');
  const se_monto = subio ? 1 : 0;
  try {
    // 1. Update votos.se_monto
    const { data, error } = await supabase.from('votos').update({ se_monto }).eq('id', p.id).select();
    
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Bloqueado por RLS: No tienes permisos para modificar este registro en la base de datos.');
    }

      if (!subio) {
        // 2. Register falta if it doesn't exist
        const { data: existing } = await supabase.from('faltas').select('id').eq('voto_id', p.id).maybeSingle();
        if (!existing) {
          await supabase.from('faltas').insert({
            usuario_id: p.usuario_id,
            voto_id:    p.id,
            nombre:     p.nombre,
            matricula:  p.matricula,
            email:      p.email || '',
            horario:    p.horario,
            fecha:      p.fecha,
          });
        }
      } else {
        // Remove falta if they switched from no-subio to subio
        await supabase.from('faltas').delete().eq('voto_id', p.id);
      }

      // Verificar si la lista de este horario se ha completado al 100% para otorgar los 3 puntos
      await verificarYOtorgarPuntosHorarioCompleto(p.horario, p.fecha);

      // 3. Count total faltas for this user
      if (p.usuario_id) {
        const { count } = await supabase
          .from('faltas')
          .select('id', { count: 'exact', head: true })
          .eq('usuario_id', p.usuario_id);

        // 4. Upsert in penalidades
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

        if (!subio) {
          // 5. Send email if just hit 3
          if (penalizado && count === 3) {
            await enviarCorreoPenalidad(p, count);
            showToast(`⚠️ ${p.nombre} penalizado/a con ${count} faltas. Correo enviado.`, 'warning');
          } else {
            showToast(`Falta registrada. Total: ${count}/3`, count >= 2 ? 'warning' : 'error');
          }
        } else {
          showToast('✅ Asistencia confirmada y +3 puntos', 'success');
        }
      } else {
        if (!subio) showToast(`Falta registrada.`, 'error');
        else showToast('✅ Asistencia confirmada y +3 puntos', 'success');
      }
  } catch(err) {
    console.error('Error marcando asistencia:', err);
    showToast('Error al guardar. Intenta de nuevo.', 'error');
  }
}





async function enviarCorreoPenalidad(p, totalFaltas) {
  if (!window.emailjs || EMAILJS_PUBLIC === 'TU_PUBLIC_KEY') {
    console.warn('EmailJS no configurado. Configura EMAILJS_SERVICE, EMAILJS_TEMPLATE y EMAILJS_PUBLIC.');
    return;
  }
  try {
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_name:      p.nombre,
      to_email:     p.email,
      matricula:    p.matricula,
      total_faltas: totalFaltas,
      fecha:        new Date().toLocaleDateString('es-ES'),
    });
  } catch(e) {
    console.error('Error enviando email:', e);
  }
}

window.sendWhatsAppNotification = (horario) => {
   const msg = `🚌 *AEUDJ Transporte*\n\nInformamos que el autobús del horario *${horario}* está saliendo. Por favor, estén listos en su parada.`;
   const encoded = encodeURIComponent(msg);
   window.open(`https://wa.me/?text=${encoded}`, '_blank');
};

// Realtime
supabase
  .channel('votos-voluntario')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'votos' },
    () => { loadData(); }
  )
  .subscribe();

// ══════════════════════════════════════════════
// MODAL DE DISPONIBILIDAD DE HORARIOS
// ══════════════════════════════════════════════

const SCHEDULES = [
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

let volAllVolunteers = [];
let volCurrentUserId = null;

// Abrir / cerrar modal
document.getElementById('btnHorarios')?.addEventListener('click', () => openHorariosModal());
document.getElementById('closeModalHorarios')?.addEventListener('click', () => closeHorariosModal());
document.getElementById('modalHorarios')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalHorarios')) closeHorariosModal();
});

function openHorariosModal() {
  const modal = document.getElementById('modalHorarios');
  if (!modal) return;

  // Update subtitle with today's readable date
  const sub = modal.querySelector('.vol-modal-subtitle');
  if (sub) {
    const today = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);
    sub.textContent = `📆 ${todayFormatted} — Selecciona los horarios que puedes cubrir hoy`;
  }

  modal.classList.remove('hidden');
  loadVolScheduleGrid();
  if (window.lucide) window.lucide.createIcons();
}

function closeHorariosModal() {
  document.getElementById('modalHorarios')?.classList.add('hidden');
}

async function loadVolScheduleGrid() {
  const grid = document.getElementById('volHorarioGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="vol-grid-loading"><div class="spinner" style="width:30px;height:30px;"></div></div>';

  const todayKey = getCycleDate();

  try {
    // 1. Get current auth user
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error('No autenticado');
    volCurrentUserId = user.id;

    // 2. Always fetch current user's own profile first (RLS always allows self-read)
    const { data: myProfile, error: myErr } = await supabase
      .from('profiles')
      .select('id, nombre, horario_asignado')
      .eq('id', volCurrentUserId)
      .single();

    if (myErr) throw myErr;

    // 3. Try to fetch other volunteers (may be restricted by RLS for some users)
    const { data: others } = await supabase
      .from('profiles')
      .select('id, nombre, horario_asignado')
      .ilike('rol', '%voluntario%')
      .neq('id', volCurrentUserId); // exclude self, already loaded

    // 4. Merge: own profile always included, others if available
    volAllVolunteers = [
      ...(myProfile ? [myProfile] : []),
      ...(others || []),
    ];

    renderVolSlots(volAllVolunteers, todayKey);
  } catch (err) {
    console.error('Error cargando horarios:', err);
    grid.innerHTML = `<div class="vol-grid-loading" style="color:#f87171;flex-direction:column;gap:0.5rem;">
      <span>⚠️ Error al cargar horarios</span>
      <span style="font-size:0.72rem;opacity:0.6;">${err.message || 'Intenta de nuevo'}</span>
    </div>`;
  }
}

function getAssignedForSlot(volunteers, dateKey, timeStr) {
  return volunteers.filter(v => {
    if (!v.horario_asignado) return false;
    try {
      const scheds = typeof v.horario_asignado === 'string'
        ? JSON.parse(v.horario_asignado)
        : v.horario_asignado;
      return Array.isArray(scheds[dateKey]) && scheds[dateKey].includes(timeStr);
    } catch { return false; }
  });
}

function renderVolSlots(volunteers, dateKey) {
  const grid = document.getElementById('volHorarioGrid');
  if (!grid) return;
  grid.innerHTML = '';

  SCHEDULES.forEach(slot => {
    const timeStr  = `${slot.time} ${slot.route}`;
    const assigned = getAssignedForSlot(volunteers, dateKey, timeStr);
    const isIda    = slot.dir === 'ida';
    const isMine   = assigned.some(v => v.id === volCurrentUserId);
    const isTaken  = assigned.length > 0 && !isMine;

    const card = document.createElement('div');
    card.className = `vol-slot-card ${isMine ? 'mine' : isTaken ? 'taken' : 'empty'}`;

    const assigneeName = assigned.length > 0
      ? assigned.map(v => v.nombre?.split(' ')[0] || 'Voluntario').join(', ')
      : null;

    card.innerHTML = `
      <div class="vol-slot-time">${slot.time}</div>
      <div class="vol-slot-route">${slot.route}</div>
      <div class="vol-slot-dir ${isIda ? 'ida' : 'vuelta'}">${isIda ? '↗ IDA' : '↙ VUELTA'}</div>
      <div class="vol-slot-volunteer ${isMine ? 'mine-name' : isTaken ? 'other-name' : 'empty-name'}">
        ${isMine ? '✅ Tú' : isTaken ? `👤 ${assigneeName}` : '— Sin cubrir'}
      </div>
      ${isMine ? `
        <div class="vol-slot-mine-badge"><i data-lucide="check" style="width:12px;height:12px;color:#fff;"></i></div>
        <button class="vol-slot-action release" data-time="${timeStr}">Liberar turno</button>
      ` : !isTaken ? `
        <button class="vol-slot-action take" data-time="${timeStr}">Tomar turno</button>
      ` : ''}
    `;

    const btn = card.querySelector('.vol-slot-action');
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        const action = btn.classList.contains('take') ? 'take' : 'release';
        await updateVolunteerSlot(dateKey, timeStr, action);
        await loadVolScheduleGrid();
        if (window.lucide) window.lucide.createIcons();
      });
    }

    grid.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

async function updateVolunteerSlot(dateKey, timeStr, action) {
  if (!volCurrentUserId) return;

  const myProfile = volAllVolunteers.find(v => v.id === volCurrentUserId);
  if (!myProfile) return;

  let scheds = {};
  try {
    if (myProfile.horario_asignado) {
      scheds = typeof myProfile.horario_asignado === 'string'
        ? JSON.parse(myProfile.horario_asignado)
        : { ...myProfile.horario_asignado };
    }
  } catch { scheds = {}; }

  if (!scheds[dateKey]) scheds[dateKey] = [];

  if (action === 'take') {
    if (!scheds[dateKey].includes(timeStr)) scheds[dateKey].push(timeStr);
    showToast('✅ Turno tomado', 'success');
  } else {
    scheds[dateKey] = scheds[dateKey].filter(t => t !== timeStr);
    showToast('Turno liberado', 'success');
  }

  const { error } = await supabase.from('profiles')
    .update({ horario_asignado: JSON.stringify(scheds) })
    .eq('id', volCurrentUserId);

  if (error) {
    console.error('Error guardando turno:', error);
    showToast('Error al guardar', 'error');
  }
}

// ══════════════════════════════════════════════
// MODAL DE TABLA DE POSICIONES (RANKING)
// ══════════════════════════════════════════════

// Abrir / cerrar modal de ranking
document.getElementById('btnRanking')?.addEventListener('click', () => openRankingModal());
document.getElementById('closeModalRanking')?.addEventListener('click', () => closeRankingModal());
document.getElementById('modalRanking')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalRanking')) closeRankingModal();
});

function openRankingModal() {
  const modal = document.getElementById('modalRanking');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    loadRankingData();
  }
}

function closeRankingModal() {
  const modal = document.getElementById('modalRanking');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Cargar y calcular puntos para el ranking
async function loadRankingData() {
  const podioDiv = document.getElementById('rankingPodio');
  const listaDiv = document.getElementById('rankingLista');
  if (!podioDiv || !listaDiv) return;

  podioDiv.innerHTML = '<div class="rank-spinner" style="margin:auto;"><div style="width:32px;height:32px;border:3px solid rgba(251,191,36,0.3);border-top-color:#fbbf24;border-radius:50%;animation:spin 0.8s linear infinite;"></div></div>';
  listaDiv.innerHTML = '';

  try {
    // 1. Obtener todos los perfiles de voluntarios/admins
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, nombre, rol, email, matricula');

    if (profErr) throw profErr;

    // Filtrar para mostrar a TODOS los que tengan rol de voluntario, comité o admin
    const volunteerProfiles = (profiles || []).filter(u => {
      const r = (u.rol || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return r.includes('voluntario') || r.includes('comite') || r.includes('admin') || r.includes('desarrolladora') || r.includes('administrador');
    });

    // 2. Obtener la suma de puntos agrupada de la tabla puntos_log
    const { data: logs, error: logsErr } = await supabase
      .from('puntos_log')
      .select('voluntario_id, puntos, motivo');

    if (logsErr) throw logsErr;

    // Calcular puntos y cantidad de listas completadas por voluntario
    const pointsMap = {};
    const listCountMap = {};
    let totalSeasonPoints = 0;

    (logs || []).forEach(log => {
      pointsMap[log.voluntario_id] = (pointsMap[log.voluntario_id] || 0) + log.puntos;
      totalSeasonPoints += Math.max(0, log.puntos);
      if (log.motivo && log.motivo.startsWith('Pase de lista')) {
        listCountMap[log.voluntario_id] = (listCountMap[log.voluntario_id] || 0) + 1;
      }
    });

    // 3. Crear lista de ranking y ordenar: por puntos descendente, y en empate por nombre
    const rankingList = volunteerProfiles.map(vol => {
      const parts = (vol.nombre || 'Voluntario').trim().split(/\s+/);
      const iniciales = parts.length >= 2 
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : (parts[0].slice(0, 2)).toUpperCase();

      return {
        id: vol.id,
        nombre: vol.nombre || 'Sin nombre',
        puntos: pointsMap[vol.id] || 0,
        listCount: listCountMap[vol.id] || 0,
        iniciales: iniciales
      };
    }).sort((a, b) => (b.puntos - a.puntos) || a.nombre.localeCompare(b.nombre));

    // 4. Filtrar solo los voluntarios que ya tienen puntos ganados (> 0)
    const activeRanked = rankingList.filter(v => v.puntos > 0);

    podioDiv.innerHTML = '';
    const top1 = activeRanked[0] || null;
    const top2 = activeRanked[1] || null;
    const top3 = activeRanked[2] || null;
    const rest = activeRanked.slice(3);

    // Slot 2 (2do lugar - izquierda)
    const slot2El = document.createElement('div');
    slot2El.className = 'rank-podium-slot slot-2';
    if (top2) {
      slot2El.innerHTML = `
        <div class="p-avatar">${top2.iniciales}<span class="rank-flag">🥈</span></div>
        <div class="p-name">${top2.nombre}</div>
        <div class="p-sub">2° lugar</div>
        <div class="p-pts">${top2.puntos} pts</div>
      `;
    } else {
      slot2El.innerHTML = `
        <div class="p-avatar">—</div>
        <div class="p-name" style="color:#8b93a1">Sin datos</div>
        <div class="p-sub">2° lugar</div>
        <div class="p-pts" style="background:rgba(255,255,255,0.04); color:#8b93a1">— pts</div>
      `;
    }
    podioDiv.appendChild(slot2El);

    // Slot 1 (1er lugar - centro)
    const slot1El = document.createElement('div');
    slot1El.className = 'rank-podium-slot slot-1';
    if (top1) {
      slot1El.innerHTML = `
        <div class="p-avatar">${top1.iniciales}<span class="rank-flag">🥇</span></div>
        <div class="p-name">${top1.nombre}</div>
        <div class="p-sub">1° lugar</div>
        <div class="p-pts">${top1.puntos} pts</div>
      `;
    } else {
      slot1El.innerHTML = `
        <div class="p-avatar">—</div>
        <div class="p-name" style="color:#8b93a1">Sin datos</div>
        <div class="p-sub">1° lugar</div>
        <div class="p-pts" style="background:rgba(255,255,255,0.04); color:#8b93a1">— pts</div>
      `;
    }
    podioDiv.appendChild(slot1El);

    // Slot 3 (3er lugar - derecha)
    const slot3El = document.createElement('div');
    slot3El.className = 'rank-podium-slot slot-3';
    if (top3) {
      slot3El.innerHTML = `
        <div class="p-avatar">${top3.iniciales}<span class="rank-flag">🥉</span></div>
        <div class="p-name">${top3.nombre}</div>
        <div class="p-sub">3° lugar</div>
        <div class="p-pts">${top3.puntos} pts</div>
      `;
    } else {
      slot3El.innerHTML = `
        <div class="p-avatar">—</div>
        <div class="p-name" style="color:#8b93a1">Sin datos</div>
        <div class="p-sub">3° lugar</div>
        <div class="p-pts" style="background:rgba(255,255,255,0.04); color:#8b93a1">— pts</div>
      `;
    }
    podioDiv.appendChild(slot3El);

    // 5. Renderizar lista restante (4to lugar en adelante)
    listaDiv.innerHTML = '';
    rest.forEach((item, idx) => {
      const pos = idx + 4;
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `
        <div class="rank-num">${pos}</div>
        <div class="rank-row-avatar">${item.iniciales}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${item.nombre}</div>
          <div class="rank-row-sub">${item.listCount} listas completadas</div>
        </div>
        <div class="rank-row-pts">${item.puntos} pts</div>
      `;
      listaDiv.appendChild(row);
    });

    // 6. Nota de temporada
    const emptyNote = document.getElementById('rankingEmptyNote');
    if (emptyNote) {
      emptyNote.style.display = (totalSeasonPoints === 0) ? 'block' : 'none';
    }

  } catch (err) {
    console.error('Error cargando ranking:', err);
    listaDiv.innerHTML = `<div style="color:#e2694b; text-align:center; padding:2rem; font-size:0.82rem; grid-column:1/-1;">⚠️ Error: ${err.message || 'No se pudo cargar el ranking'}</div>`;
  }
}