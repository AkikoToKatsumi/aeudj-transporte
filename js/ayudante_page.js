// ── PANEL AYUDANTE - CONTROL DE ASISTENCIA ──

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
  const [y, m, day] = d.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} de ${months[parseInt(m)-1]} de ${y}`;
}

let allVotos = [];
let activeFilter = 'todos';
// attendance: { votoId -> 'subio' | 'no-subio' }
const attendanceState = {};

// Toast helper
function showToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;padding:0.75rem 1.25rem;background:#0f172a;color:#fff;border-radius:0.75rem;border:1px solid rgba(255,255,255,0.1);z-index:9999;transition:all 0.3s;display:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3200);
}

// Auth check
const logoutBtn = document.getElementById('logoutBtn');
window.logout = async () => {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch(e) {}
  localStorage.clear();
  window.location.href = 'index.html';
};
if (logoutBtn) {
  logoutBtn.addEventListener('click', window.logout);
}

const btnRefresh = document.getElementById('btnRefresh');
window.refreshData = () => {
  loadData();
  showToast('Datos actualizados', 'success');
};
if (btnRefresh) {
  btnRefresh.addEventListener('click', window.refreshData);
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
  
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (profile) {
    currentUser = { ...currentUser, ...profile };
  }
  const rol = (profile && profile.rol) ? profile.rol.toLowerCase() : '';
  const isAuthorized = rol.includes('ayudante') || rol.includes('voluntario') || rol.includes('admin') || rol.includes('desarrolladora') || rol.includes('comité');
  
  if (!profile || !isAuthorized) {
    console.error("Acceso denegado: Insuficientes privilegios");
    window.location.href = 'votar.html';
    return;
  }
}
checkSecurity();

async function loadData() {
  const cycleDate = getCycleDate();
  const fechaBadge = document.getElementById('currentDate');
  if (fechaBadge) fechaBadge.textContent = formatDate(cycleDate);
  const container = document.getElementById('horariosContainer');
  if (!container) return;
  container.innerHTML = '<div class="empty-state" style="text-align:center;padding:3rem;"><div class="spinner" style="margin:0 auto 1rem;"></div><p class="mt-4" style="color:#94a3b8;">Actualizando viajes...</p></div>';

  try {
    const { data, error } = await supabase
      .from('votos').select('*')
      .eq('fecha', cycleDate)
      .order('horario', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    allVotos = data || [];

    // Sincronizar estado local con la base de datos
    allVotos.forEach(v => {
      if (v.se_monto === 1) attendanceState[v.id] = 'subio';
      else if (v.se_monto === 0) attendanceState[v.id] = 'no-subio';
    });
    
    renderList();
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
  } catch(err) {
    const container = document.getElementById('horariosContainer');
    if (container) container.innerHTML = `<div class="empty-state" style="text-align:center;padding:2rem;"><p style="color:#f87171;">Error al cargar datos: ${err.message}</p></div>`;
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

  if (statTotal) statTotal.textContent = allVotos.length;
  if (statPresentes) statPresentes.textContent = Object.values(attendanceState).filter(v => v === 'subio').length;

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="text-align:center;padding:3rem;color:#64748b;"><p>No hay pasajeros registrados en este filtro.</p></div>';
    return;
  }

  const groups = {};
  filtered.forEach(v => {
    if (!groups[v.horario]) groups[v.horario] = [];
    groups[v.horario].push(v);
  });

  let pendingGroupsCount = 0;

  Object.entries(groups).forEach(([horario, passengers]) => {
    // Si ya fueron marcados todos en el grupo localmente, los ocultamos de la vista activa
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
    table.className = 'passenger-table open';

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
          </div>
        </div>
        <div class="row-time"></div>
        <div class="attendance-btns">
          <button type="button" class="att-btn subio ${isSubio ? 'active' : ''}" data-id="${p.id}" data-action="subio">✅ Subió</button>
          <button type="button" class="att-btn no-subio ${isNoSubio ? 'active' : ''}" data-id="${p.id}" data-action="no-subio">❌ No subió</button>
        </div>
      `;
      
      row.querySelector('.row-name').textContent = p.nombre || 'Sin nombre';
      row.querySelector('.row-mat').textContent = p.matricula || '';
      row.querySelector('.row-time').textContent = time;

      // Eventos de asistencia
      row.querySelectorAll('.att-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const prev   = attendanceState[p.id];
          if (prev === action) return;

          // Actualizar estado local
          attendanceState[p.id] = action;
          
          row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const statPresentes = document.getElementById('statPresentes');
          if (statPresentes) {
            statPresentes.textContent = Object.values(attendanceState).filter(v => v === 'subio').length;
          }

          // Guardar asistencia en Supabase sin asignar puntos de voluntario
          marcarAsistencia(p, action);
        });
      });

      table.appendChild(row);
    });

    // Colapsable
    header.addEventListener('click', () => {
      const chevron = header.querySelector('.chevron');
      const isOpen = table.classList.toggle('open');
      if (chevron) chevron.classList.toggle('open', isOpen);
    });

    section.appendChild(header);
    section.appendChild(table);
    container.appendChild(section);
  });

  if (Object.keys(groups).length === 0) {
    container.innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;color:#64748b;">
      <i data-lucide="clipboard-x" style="width:48px;height:48px;margin-bottom:1rem;opacity:0.5;"></i>
      <h2 style="font-size:1.25rem;font-weight:700;color:#f8fafc;margin-bottom:0.5rem;">Sin registros</h2>
      <p>No se han encontrado pasajeros registrados para los viajes de hoy.</p>
    </div>
    `;
  } else if (pendingGroupsCount === 0) {
    container.innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;color:#34d399;">
      <i data-lucide="check-check" style="width:48px;height:48px;margin-bottom:1rem;"></i>
      <h2 style="font-size:1.25rem;font-weight:700;color:#f8fafc;margin-bottom:0.5rem;">¡Pase de lista completado!</h2>
      <p style="color:#94a3b8;">Has verificado a todos los pasajeros de estos turnos.</p>
    </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

// Eventos de Filtros
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderList();
  });
});

if (window.lucide) window.lucide.createIcons();
loadData();

// ── MARCAR ASISTENCIA (SIN PUNTOS DE VOLUNTARIO) ──────────────────────────────────
async function marcarAsistencia(p, action) {
  const subio = (action === 'subio');
  const se_monto = subio ? 1 : 0;
  try {
    // 1. Actualizar votos.se_monto
    const { data, error } = await supabase.from('votos').update({ se_monto }).eq('id', p.id).select();
    
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('No tienes permisos para modificar este registro.');
    }

    if (!subio) {
      // 2. Registrar falta si no existe
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
      // Eliminar falta si cambiaron de no-subió a subió
      await supabase.from('faltas').delete().eq('voto_id', p.id);
    }

    // 3. Contar total de faltas y actualizar penalidades
    if (p.usuario_id) {
      const { count } = await supabase
        .from('faltas')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', p.usuario_id);

      const faltasCount = count || 0;
      let estado = 'limpio';
      if (faltasCount >= 3) estado = 'suspendido';
      else if (faltasCount > 0) estado = 'advertencia';

      await supabase.from('penalidades').upsert({
        usuario_id:    p.usuario_id,
        nombre:        p.nombre,
        matricula:     p.matricula,
        cant_faltas:   faltasCount,
        estado:        estado,
        updated_at:    new Date().toISOString()
      }, { onConflict: 'usuario_id' });
    }

  } catch(err) {
    console.error('Error al actualizar asistencia:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
}
