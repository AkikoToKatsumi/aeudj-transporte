// Usamos el cliente global de Supabase
const supabase = window.supabase;

const SCHEDULES_IDA = ['Jarabacoa -> La Vega','Jarabacoa → La Vega'];

function isIda(horario) {
  return SCHEDULES_IDA.some(s => horario.includes(s));
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

function formatDate(d) {
  const [y,m,day] = d.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} de ${months[parseInt(m)-1]} de ${y}`;
}

async function loadData() {
  const cycleDate = getCycleDate();
  const fechaBadge = document.getElementById('fechaBadge');
  if (fechaBadge) fechaBadge.textContent = formatDate(cycleDate);
  const container = document.getElementById('listContainer');
  if (!container) return;

  try {
    let { data: votos, error } = await supabase
      .from('votos').select('*')
      .eq('fecha', cycleDate)
      .order('horario', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // ── DEDUPLICACIÓN ──
    const uniqueVotosMap = new Map();
    
    votos.forEach(v => {
      const personId = v.matricula || v.usuario_id;
      const direction = isIda(v.horario) ? 'ida' : 'vuelta';
      const key = `${personId}-${direction}`;
      
      if (!uniqueVotosMap.has(key) || new Date(v.created_at) > new Date(uniqueVotosMap.get(key).created_at)) {
        uniqueVotosMap.set(key, v);
      }
    });
    
    votos = Array.from(uniqueVotosMap.values()).filter(v => v.se_monto === null);

    container.innerHTML = '';

    if (!votos || votos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="check-circle" style="display:block; color:#34d399; margin: 0 auto 1rem; width: 48px; height: 48px;"></i>
          <p>No hay listas pendientes o todas las listas de hoy ya fueron pasadas. ¡Buen viaje!</p>
        </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Stats
    const totalUniq = new Set(votos.map(v=>v.usuario_id)).size;
    const idaCount  = votos.filter(v=>isIda(v.horario)).length;
    const vueltaCount = votos.length - idaCount;
    const statTotal = document.getElementById('statTotal');
    const statIda = document.getElementById('statIda');
    const statVuelta = document.getElementById('statVuelta');
    const summaryBar = document.getElementById('summaryBar');
    
    if (statTotal) statTotal.textContent = totalUniq;
    if (statIda) statIda.textContent = idaCount;
    if (statVuelta) statVuelta.textContent = vueltaCount;
    if (summaryBar) summaryBar.style.display = 'flex';

    // Group by horario
    const groups = {};
    votos.forEach(v => {
      if (!groups[v.horario]) groups[v.horario] = [];
      groups[v.horario].push(v);
    });

    Object.entries(groups).forEach(([horario, pasajeros]) => {
      const ida = isIda(horario);
      const section = document.createElement('div');
      section.className = 'horario-section';
      section.innerHTML = `
        <div class="section-header">
          <div>
            <div class="section-title">${horario}</div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <span class="section-direction ${ida ? 'dir-ida' : 'dir-vuelta'}">${ida ? '↗ Ida' : '↙ Vuelta'}</span>
            <span class="section-count">${pasajeros.length} persona${pasajeros.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="passenger-list" id="list-${encodeURIComponent(horario)}"></div>
      `;
      container.appendChild(section);

      const listEl = section.querySelector('.passenger-list');
      pasajeros.forEach((p, idx) => {
        const t = new Date(p.created_at);
        let hours = t.getHours();
        const minutes = t.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const time = `${hours}:${minutes} ${ampm}`;
        
        const row = document.createElement('div');
        row.className = 'passenger-row';
        
        row.innerHTML = `
          <div class="passenger-num">${idx + 1}</div>
          <div class="passenger-main">
            <div class="passenger-info">
              <div class="passenger-name">${p.nombre || 'Sin nombre'}</div>
              <div class="passenger-meta">${p.matricula || ''} • ${p.universidad || ''}</div>
            </div>
            <div class="passenger-status">
              <span class="badge-base badge-confirmado">
                <i data-lucide="check" style="width:10px;height:10px;"></i> CONFIRMADO
              </span>
              <div class="badges-area" style="display:flex; gap:0.3rem;"></div>
              <div class="passenger-time">${time}</div>
            </div>
          </div>
        `;
        
        const badgesArea = row.querySelector('.badges-area');
        if (p.punto_espera === 'camino' || p.punto_espera === 'parada') {
          const isCamino = p.punto_espera === 'camino';
          const pointSpan = document.createElement('span');
          pointSpan.className = `badge-base ${isCamino ? 'badge-camino' : 'badge-point'}`;
          pointSpan.innerHTML = `
            <i data-lucide="${isCamino ? 'person-standing' : 'map-pin'}" style="width:10px;height:10px;"></i> 
            ${isCamino ? 'Camino' : 'Parada'}
          `;
          badgesArea.appendChild(pointSpan);
        }
        
        listEl.appendChild(row);
      });
    });

    if (window.lucide) window.lucide.createIcons();

  } catch(err) {
    container.innerHTML = `<div class="empty-state"><p style="color:#f87171;">Error al cargar: ${err.message}</p></div>`;
  }
}

const reloadBtn = document.getElementById('reloadBtn');
if (reloadBtn) {
  reloadBtn.onclick = async (e) => {
    const btn = e.currentTarget;
    const icon = btn.querySelector('svg');
    if(icon) icon.classList.add('spin-animation');
    
    const container = document.getElementById('listContainer');
    if (container) container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p style="margin-top:1rem;">Actualizando...</p></div>`;
    
    await loadData();
    
    if(icon) icon.classList.remove('spin-animation');
  };
}

if (window.lucide) window.lucide.createIcons();
loadData();

// ── TIEMPO REAL ─────────────────────────────────────
const cycleDateRT = getCycleDate();

supabase
  .channel('votos-lista')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'votos', filter: `fecha=eq.${cycleDateRT}` },
    () => { loadData(); }
  )
  .subscribe();
