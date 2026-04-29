// Usamos el cliente global de Supabase cargado en el HTML
const supabase = window.supabase;

if (!supabase) {
  console.error('Supabase client not found! Ensure the library is loaded in the HTML.');
}

// EmailJS
const EMAILJS_SERVICE  = 'service_afofocu';
const EMAILJS_TEMPLATE = 'template_ryyejnp';
const EMAILJS_PUBLIC   = 'nFSfa8vIE5hozX8Ok';
if (window.emailjs) emailjs.init(EMAILJS_PUBLIC);

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

function showToast(msg, type = 'success') {
   const t = document.getElementById('toast');
   if (!t) return;
   t.textContent = msg;
   t.className = `toast show ${type === 'error' ? 'error' : ''}`;
   setTimeout(() => t.classList.remove('show'), 3000);
}

// Helper for sorting horarios
function horarioAMinutos(horarioStr) {
  const timeMatch = horarioStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return 0;
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

async function checkSecurity() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }
  
  const rol = profile.rol || '';
  if (!profile || (!rol.includes('chofer') && !rol.includes('admin_chofer') && !rol.includes('desarrolladora'))) {
    console.warn("Acceso denegado: Rol insuficiente");
    window.location.href = 'votar.html';
    return;
  }
}
checkSecurity();

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

async function loadData() {
  const cycleDate = getCycleDate();
  const fechaBadge = document.getElementById('fechaBadge');
  if (fechaBadge) fechaBadge.textContent = formatDate(cycleDate);
  const container = document.getElementById('horarios-container');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p style="margin-top:1rem;">Actualizando...</p></div>';

  try {
    const { data: votos, error } = await supabase
      .from('votos')
      .select('*')
      .eq('fecha', cycleDate)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    let totalViajeros = 0;
    let totalEspera = 0;
    const groups = {};

    (votos || []).forEach(v => {
      if (!groups[v.horario]) {
        groups[v.horario] = { confirmados: [], espera: [], todos_pasados: true };
      }
      
      if (v.en_espera) {
        groups[v.horario].espera.push(v);
      } else {
        groups[v.horario].confirmados.push(v);
      }

      if (v.se_monto === null) {
        groups[v.horario].todos_pasados = false;
      }
    });

    const activeHorarios = Object.keys(groups).filter(h => !groups[h].todos_pasados);

    activeHorarios.forEach(h => {
      totalViajeros += groups[h].confirmados.length + groups[h].espera.length;
      totalEspera += groups[h].espera.length;
    });

    const statTotal = document.getElementById('stat-total-hoy');
    const statTurnos = document.getElementById('stat-turnos-hoy');
    if (statTotal) statTotal.textContent = totalViajeros;
    if (statTurnos) statTurnos.textContent = activeHorarios.length;

    container.innerHTML = '';
    container.innerHTML = '';

    if (activeHorarios.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay viajes programados o activos para hoy.</p></div>';
    } else {
      const sortedHorarios = activeHorarios.sort((a, b) => horarioAMinutos(a) - horarioAMinutos(b));

      sortedHorarios.forEach(horario => {
        const group = groups[horario];
        const ida = isIda(horario);
        const section = document.createElement('div');
        section.className = 'horario-section';

        const numConfirmados = group.confirmados.length;
        const numEspera = group.espera.length;
        const allPassengers = [...group.confirmados, ...group.espera];

        section.innerHTML = `
          <div class="horario-header">
            <span class="dir-badge ${ida ? 'dir-ida' : 'dir-vuelta'}">${ida ? '↗ Salida' : '↙ Regreso'}</span>
            <div class="horario-title">${horario}</div>
            <div class="horario-stats">
              <div class="h-stat confirmados">
                <div class="h-stat-num">${numConfirmados}</div>
                <div class="h-stat-label">Confirmados</div>
              </div>
              <div class="h-stat ${numEspera > 0 ? 'espera' : ''}">
                <div class="h-stat-num">${numEspera}</div>
                <div class="h-stat-label">En Espera</div>
              </div>
            </div>
          </div>
          <button class="passenger-list-btn" id="btn-list-${encodeURIComponent(horario)}">
            Ver Pasajeros <i data-lucide="chevron-down"></i>
          </button>
          <div class="passenger-list-content" id="content-list-${encodeURIComponent(horario)}"></div>
          <div class="notify-bar">
           <button class="notify-btn"><i data-lucide="send"></i> En camino</button>
           <button class="notify-btn"><i data-lucide="map-pin"></i> Llegó</button>
           <button class="notify-btn"><i data-lucide="clock"></i> Saliendo</button>
           <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 0.2rem;"></div>
           <button class="notify-btn whatsapp"><i data-lucide="message-circle"></i> WhatsApp</button>
        </div>
        ` : ''}
      `;

      if (allPassengers.length > 0) {
        const listContent = section.querySelector('.passenger-list-content');
        allPassengers.forEach((p, idx) => {
          const row = document.createElement('div');
          row.className = 'p-row';
          row.innerHTML = `
            <div class="p-num">${idx + 1}</div>
            <div class="p-name ${p.en_espera ? 'text-amber-400' : 'text-slate-200'}">${p.nombre || 'Sin nombre'}</div>
            ${p.en_espera ? '<div class="badge-espera">Lista de Espera</div>' : ''}
          `;
          listContent.appendChild(row);
        });

        const listBtn = section.querySelector('.passenger-list-btn');
        listBtn.onclick = () => {
          listBtn.classList.toggle('open');
          listContent.classList.toggle('open');
        };
        
        const notifyBtns = section.querySelectorAll('.notify-btn');
        if (notifyBtns.length >= 4) {
          notifyBtns[0].onclick = (e) => window.sendTripNotification(horario, 'camino', e.currentTarget);
          notifyBtns[1].onclick = (e) => window.sendTripNotification(horario, 'llego', e.currentTarget);
          notifyBtns[2].onclick = (e) => window.sendTripNotification(horario, 'sale', e.currentTarget);
          notifyBtns[3].onclick = (e) => window.sendWhatsAppNotification(horario, e.currentTarget);
        }
      }

        container.appendChild(section);
      });
    }

    if (window.lucide) window.lucide.createIcons();
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
  } catch(err) {
    const container = document.getElementById('horarios-container');
    if (container) container.innerHTML = `<div class="empty-state"><p style="color:#f87171;">Error: ${err.message}</p></div>`;
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
  }
}

window.sendTripNotification = async (horario, tipo, btn) => {
   const ogText = btn.innerHTML;
   btn.disabled = true;
   btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Enviando...';
   if (window.lucide) window.lucide.createIcons();

   try {
    const cycleDate = getCycleDate();
    // 1. Obtener votos del horario
    const { data: vs, error: errVotos } = await supabase
      .from('votos')
      .select('email, usuario_id')
      .eq('fecha', cycleDate)
      .eq('horario', horario);

    if (errVotos) throw errVotos;

    // 2. Coleccionar emails de los votos
    let emails = (vs || []).map(v => v.email).filter(e => e && e.includes('@'));

    // 3. Si faltan emails, buscarlos en perfiles por usuario_id (solo si el ID es válido)
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
      throw new Error('No se encontraron correos para este viaje. Verifica que los estudiantes tengan su correo en su perfil.');
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

    console.log('Enviando a:', templateParams.to_email);
    const response = await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, templateParams);
    
    if (response.status === 200) {
      showToast(`✅ Enviado a ${emails.length} personas`);
    } else {
      throw new Error('Respuesta inesperada de EmailJS');
    }

  } catch(err) {
    console.error('Error detallado:', err);
    const errorMsg = err.text || err.message || 'Error desconocido';
    alert('Detalle del error: ' + errorMsg);
    showToast('Error en el envío', 'error');
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

const reloadFab = document.getElementById('reloadFab');
if (reloadFab) reloadFab.onclick = loadData;

// Realtime
supabase
  .channel('votos-chofer')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'votos' },
    () => { loadData(); }
  )
  .subscribe();

if (window.lucide) window.lucide.createIcons();
loadData();
