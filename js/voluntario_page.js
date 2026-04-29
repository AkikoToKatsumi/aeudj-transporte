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
  const isAdmin = rol.includes('admin') || rol.includes('desarrolladora') || rol.includes('comité');
  
  if (!profile || !isAdmin) {
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
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p style="margin-top:1rem;">Actualizando...</p></div>';

  try {
    const { data, error } = await supabase
      .from('votos').select('*')
      .eq('fecha', cycleDate)
      .order('horario', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    let fetchedVotos = data || [];
    const isAdmin = currentUser && (currentUser.rol.includes('admin') || currentUser.rol.includes('desarrolladora') || currentUser.rol.includes('comité'));
    
    if (!isAdmin && currentUser) {
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
    if (container) container.innerHTML = `<div class="empty-state"><p style="color:#f87171;">Error: ${err.message}</p></div>`;
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
        <i data-lucide="chevron-down" class="chevron open" style="width:16px;height:16px;"></i>
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
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <div class="row-mat"></div>
            <div class="badges-area" style="display:flex; gap:0.3rem;"></div>
          </div>
        </div>
        <div class="row-time"></div>
        <div class="attendance-btns">
          <button class="att-btn subio ${isSubio ? 'active' : ''}" data-id="${p.id}" data-action="subio">
            <i data-lucide="check"></i>
          </button>
          <button class="att-btn no-subio ${isNoSubio ? 'active' : ''}" data-id="${p.id}" data-action="no-subio">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
      
      row.querySelector('.row-name').textContent = p.nombre || 'Sin nombre';
      row.querySelector('.row-mat').textContent = p.matricula || '';
      row.querySelector('.row-time').textContent = time;
      
      const badgesArea = row.querySelector('.badges-area');
      if (p.en_espera) {
        const span = document.createElement('span');
        span.className = 'badge-espera';
        span.textContent = 'Espera';
        badgesArea.appendChild(span);
      }
      if (p.punto_espera === 'camino' || p.punto_espera === 'parada') {
        const pointSpan = document.createElement('span');
        pointSpan.style.cssText = 'font-size:0.6rem;font-weight:800;background:rgba(52,211,153,0.12);color:#34d399;border:1px solid rgba(52,211,153,0.3);padding:0.12rem 0.5rem;border-radius:999px;flex-shrink:0;';
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
          
          // Call renderList immediately to hide the group if it's completely finished
          renderList();

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
    notifyBar.innerHTML = `
       <button class="notify-btn"><i data-lucide="send"></i> En camino</button>
       <button class="notify-btn"><i data-lucide="map-pin"></i> Llegó</button>
       <button class="notify-btn"><i data-lucide="clock"></i> Saliendo</button>
       <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 0.2rem;"></div>
       <button class="notify-btn whatsapp"><i data-lucide="message-circle"></i> WhatsApp</button>
    `;
    
    const notifyBtns = notifyBar.querySelectorAll('.notify-btn');
    if (notifyBtns.length >= 4) {
      notifyBtns[0].onclick = (e) => window.sendTripNotification(horario, 'camino', e.currentTarget);
      notifyBtns[1].onclick = (e) => window.sendTripNotification(horario, 'llego', e.currentTarget);
      notifyBtns[2].onclick = (e) => window.sendTripNotification(horario, 'sale', e.currentTarget);
      notifyBtns[3].onclick = (e) => window.sendWhatsAppNotification(horario, e.currentTarget);
    }

    section.appendChild(header);
    section.appendChild(table);
    section.appendChild(notifyBar);
    container.appendChild(section);
  });

  if (Object.keys(groups).length === 0) {
    container.innerHTML = `
    <div style="text-align:center; padding: 4rem 1.5rem; opacity: 0.6;">
      <div style="width:60px; height:60px; margin: 0 auto 1.5rem; background: rgba(255,255,255,0.05); color: var(--text-muted); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border);">
        <i data-lucide="clipboard-x" style="width:32px; height:32px;"></i>
      </div>
      <h2 style="font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem;">Sin registros</h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 260px; margin: 0 auto;">No se han encontrado pasajeros registrados para los turnos de hoy.</p>
    </div>
    `;
  } else if (pendingGroupsCount === 0) {
    container.innerHTML = `
    <div style="text-align:center; padding: 3rem 1.5rem; background: rgba(16,185,129,0.1); border-radius: 1.5rem; border: 1px solid rgba(16,185,129,0.2); margin-top: 1rem;">
      <div style="width:60px; height:60px; margin: 0 auto 1.5rem; background: rgba(16,185,129,0.15); color: #34d399; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(16,185,129,0.2);">
        <i data-lucide="check-check" style="width:32px; height:32px;"></i>
      </div>
      <h2 style="font-size: 1.5rem; font-weight: 800; color: #34d399; margin-bottom: 0.5rem;">¡Excelente trabajo!</h2>
      <p style="color: #6ee7b7; font-size: 0.95rem; opacity: 0.8; max-width: 300px; margin: 0 auto;">Has completado el pase de lista para estos viajes. Ya no quedan pasajeros pendientes.</p>
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
      // 2. Register falta
      await supabase.from('faltas').insert({
        usuario_id: p.usuario_id,
        voto_id:    p.id,
        nombre:     p.nombre,
        matricula:  p.matricula,
        email:      p.email || '',
        horario:    p.horario,
        fecha:      p.fecha,
      });

      // 3. Count total faltas for this user
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

// ── NOTIFICACIONES ─────────────────────────────
window.sendTripNotification = async (horario, tipo, btn) => {
   const ogText = btn.innerHTML;
   btn.disabled = true;
   btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Enviando...';
   if (window.lucide) window.lucide.createIcons();

   try {
    const cycleDate = getCycleDate();
    const { data: vs, error: errVotos } = await supabase
      .from('votos')
      .select('email, usuario_id')
      .eq('fecha', cycleDate)
      .eq('horario', horario);

    if (errVotos) throw errVotos;

    let emails = (vs || []).map(v => v.email).filter(e => e && e.includes('@'));
    const missingUserIds = (vs || [])
      .filter(v => (!v.email || !v.email.includes('@')) && v.usuario_id)
      .map(v => v.usuario_id);
    
    if (missingUserIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('email')
        .in('id', missingUserIds);
      
      if (profs) {
        profs.forEach(p => {
          if (p.email && !emails.includes(p.email)) emails.push(p.email);
        });
      }
    }

    if (emails.length === 0) {
      throw new Error('No se encontraron correos para este viaje.');
    }

    const messages = {
      camino: { titulo: "🚌 El autobús va hacia la parada", msg: "Te informamos que el autobús ya está en camino hacia el punto de recogida para el viaje de las " + horario + "." },
      llego:  { titulo: "📍 El autobús ha llegado", msg: "¡Atención! El autobús del horario " + horario + " ya se encuentra en la parada. Por favor, acércate." },
      sale:   { titulo: "🚀 El autobús está saliendo", msg: "Última llamada: El autobús del horario " + horario + " está por salir o acaba de salir de la parada." }
    };

    const templateParams = {
      titulo: messages[tipo].titulo,
      mensaje: messages[tipo].msg,
      to_email: emails.join(',')
    };

    const response = await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, templateParams);
    if (response.status === 200) {
      showToast(`✅ Enviado a ${emails.length} personas`);
    } else {
      throw new Error('Error en EmailJS');
    }
  } catch(err) {
    console.error(err);
    showToast(err.message || 'Error en el envío', 'error');
  } finally {
    btn.innerHTML = ogText;
    btn.disabled = false;
    if (window.lucide) window.lucide.createIcons();
  }
};

window.sendWhatsAppNotification = (horario, btn) => {
   const msg = `🚌 *AEUDJ Transporte*\n\nInformamos que el autobús del horario *${horario}* ya se encuentra en proceso.\n\n¡Por favor estar atentos a la parada!`;
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
