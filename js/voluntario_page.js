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
          showToast('✅ Asistencia confirmada', 'success');
        }
      } else {
        if (!subio) showToast(`Falta registrada.`, 'error');
        else showToast('✅ Asistencia confirmada', 'success');
      }
  } catch(err) {
    console.error('Error marcando asistencia:', err);
    showToast('Error al guardar. Intenta de nuevo.', 'error');
  }
}

// ── ENVIAR CORREO (EmailJS) ────────────────────────────
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
