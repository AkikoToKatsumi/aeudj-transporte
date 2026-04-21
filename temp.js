
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

    const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const currentUser = JSON.parse(localStorage.getItem('aeudj_user') || 'null');
    if (!currentUser || (currentUser.rol !== 'administrador' && currentUser.rol !== 'desarrolladora')) {
      window.location.href = 'index.html';
    }
    
    // State management
    let currentVotos = [];
    let currentStaff = [];

    document.addEventListener('DOMContentLoaded', async () => {
      // 1. Security Check
      if (!currentUser || (currentUser.rol !== 'administrador' && currentUser.rol !== 'desarrolladora')) {
        window.location.href = 'index.html';
        return;
      }

      // 2. Initial Setup
      document.getElementById('fechaAdmin').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      // 3. Navigation Setup
      initNavigation();
      
      // 4. Load Initial Data (Dashboard)
      loadDashboardData();
      initSessionControl();

      // 5. Setup Forms
      initForms();

      if (window.lucide) window.lucide.createIcons();
    });

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
        'penalidades': 'Gestión de Penalidades'
      };
      document.getElementById('screenTitle').textContent = titles[screenId] || 'Panel Administrativo';

      // Load specific screen data
      if (screenId === 'dashboard') loadDashboardData();
      if (screenId === 'votos') loadVotosDetail();
      if (screenId === 'horarios') loadHorariosData();
      if (screenId === 'staff') loadStaffData();
      if (screenId === 'penalidades') loadPenalidadesData();
      
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
      // Remove any existing toast
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

      // Trigger reflow for animation
      toast.offsetHeight;
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
      }, 3500);
    };

    async function loadDashboardData() {
      const today = new Date().toISOString().split('T')[0];
      const { data: votos, error } = await supabase.from('votos').select('*').eq('fecha', today).gt('id', 40).order('horario');
      
      if (error) { console.error(error); return; }
      currentVotos = votos;

      let total = 0;
      let espera = 0;
      
      const container = document.getElementById('dashboardRecentActivity');
      container.innerHTML = '';

      const timeGroups = {};
      const listado = {};

      votos.forEach(v => {
        if (!listado[v.horario]) listado[v.horario] = [];
        listado[v.horario].push(v);

        if (!timeGroups[v.horario]) timeGroups[v.horario] = { confirmados: 0, espera: 0 };
        if (v.en_espera) {
           espera++;
           timeGroups[v.horario].espera++;
        } else {
           total++;
           timeGroups[v.horario].confirmados++;
        }
      });

      // Stats Update
      document.getElementById('statTotalPasajeros').textContent = total;
      document.getElementById('statWaitlistTotal').textContent = espera;
      document.getElementById('statIngresosReales').textContent = 'RD$ ' + (total * 100).toLocaleString();

      // Chart Update
      renderDashboardChart(timeGroups);

      // Travel List (Aestética Votar.html)
      Object.keys(listado).forEach(h => {
        const card = document.createElement('div');
        card.className = 'p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 transition-all cursor-pointer group';
        card.onclick = () => switchScreen('votos');
        
        const tripIda = h.includes('La Vega');
        
        card.innerHTML = `
          <div class="flex items-center justify-between mb-4">
            <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
               <i data-lucide="${tripIda ? 'arrow-right' : 'arrow-left'}" class="w-5 h-5"></i>
            </div>
            <span class="text-[9px] font-black px-2 py-1 rounded bg-white/5 text-gray-500 uppercase">${h.split(' ')[0]} ${h.split(' ')[1] || ''}</span>
          </div>
          <div>
            <h4 class="font-bold text-white text-base leading-tight">${h.split(' ').slice(2).join(' ')}</h4>
            <div class="flex gap-2 mt-3">
              <span class="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/10">${listado[h].filter(p => !p.en_espera).length} LISTO</span>
              ${listado[h].filter(p => p.en_espera).length > 0 ? `<span class="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/10">${listado[h].filter(p => p.en_espera).length} ESPERA</span>` : ''}
            </div>
          </div>
        `;
        container.appendChild(card);
      });
      if (window.lucide) window.lucide.createIcons();
    }

    function renderDashboardChart(timeGroups) {
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

      // 1. Bar Chart: Demand per schedule
      const ctxBar = document.getElementById('horariosChart').getContext('2d');
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

      // 2. Donut Chart: Overall distribution
      const ctxDonut = document.getElementById('distributionChart').getContext('2d');
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

    async function loadVotosDetail() {
      const container = document.getElementById('passengerListDetail');
      container.innerHTML = '<div class="spinner mx-auto"></div>';
      
      const today = new Date().toISOString().split('T')[0];
      const { data: votos } = await supabase.from('votos').select('*').eq('fecha', today).gt('id', 40).order('horario');
      
      if (!votos || votos.length === 0) {
        container.innerHTML = '<p class="text-center py-10 text-gray-500">No hay pasajeros registrados hoy.</p>';
        return;
      }

      container.innerHTML = '';
      const grouped = {};
      votos.forEach(v => {
        if (!grouped[v.horario]) grouped[v.horario] = [];
        grouped[v.horario].push(v);
      });

      Object.keys(grouped).forEach(horario => {
        const section = document.createElement('div');
        section.className = 'glass-card-sub p-6 rounded-2xl border border-white/5 bg-white/2 mb-6';
        section.innerHTML = `
          <div class="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
            <h4 class="font-bold text-white text-lg">${horario}</h4>
            <span class="text-sm font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">${grouped[horario].length} pasajeros</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${grouped[horario].map((p, idx) => `
              <div class="p-3 bg-black/20 rounded-xl border border-white/5 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">${idx+1}</div>
                <div>
                  <p class="text-sm font-bold text-white leading-none">${p.nombre}</p>
                  <p class="text-[10px] text-gray-500 mt-1 uppercase">${p.en_espera ? 'Lista Espera' : 'Confirmado'}</p>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(section);
      });
    }

    let staffData = [];
    let staffFilter = 'todos';

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

      const admins = staffData.filter(u => u.rol === 'administrador').length;
      const vols = staffData.filter(u => u.rol === 'voluntario').length;
      const ests = staffData.filter(u => u.rol === 'estudiante').length;

      setTotal('staff-count-todos', 'tab-count-todos', staffData.length);
      setTotal('staff-count-admin', 'tab-count-admin', admins);
      setTotal('staff-count-voluntario', 'tab-count-voluntario', vols);
      setTotal('staff-count-estudiante', 'tab-count-estudiante', ests);
      
      const dateLbl = document.getElementById('staff-current-date');
      if(dateLbl) {
        const d = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateLbl.textContent = `Transporte activo · ${d.toLocaleDateString('es-ES', options)}`;
      }
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
        filtered = filtered.filter(u => u.rol === staffFilter);
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

      const session = supabase.auth.session ? supabase.auth.session() : null;
      const localUser = JSON.parse(localStorage.getItem('aeudj_user') || '{}');
      const currentId = session?.user?.id || localUser?.id || null;

      tbody.innerHTML = filtered.map(u => {
        const isSelf = u.id === currentId;
        const initials = (u.nombre || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        let badgeClass = 'staff-badge-gray';
        let badgeLabel = 'Estudiante';
        let icon = '🎓';
        
        if(u.rol === 'administrador') { badgeClass = 'staff-badge-amber'; badgeLabel = 'Admin'; icon = '🛡️'; }
        if(u.rol === 'voluntario') { badgeClass = 'staff-badge-blue'; badgeLabel = 'Voluntario'; icon = '🙋'; }

        // Color based on initials (deterministic)
        const charCode = initials.charCodeAt(0) || 65;
        const colors = [
          'linear-gradient(135deg,#3b82f6,#2563eb)',
          'linear-gradient(135deg,#10b981,#059669)',
          'linear-gradient(135deg,#f59e0b,#d97706)',
          'linear-gradient(135deg,#8b5cf6,#6d28d9)',
          'linear-gradient(135deg,#ec4899,#be185d)'
        ];
        const avatarBg = colors[charCode % colors.length];

        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:.75rem">
                <div class="staff-avatar-new" style="background:${avatarBg}">${initials}</div>
                <div>
                  <div class="staff-name-new">${u.nombre}</div>
                  <div class="staff-meta-new">${u.telefono ? `📞 ${u.telefono}` : 'Sin teléfono'}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="display:flex; flex-direction:column; gap:0.4rem; align-items:flex-start;">
                 <span class="staff-badge ${badgeClass}">${icon} ${badgeLabel}</span>
                 <select 
                   onchange="window.updateUserRoleNew('${u.id}', this.value)"
                   style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:0.7rem; border-radius:4px; padding:2px 4px; outline:none;"
                 >
                   <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Cambiar a Estudiante</option>
                   <option value="voluntario" ${u.rol === 'voluntario' ? 'selected' : ''}>Cambiar a Voluntario</option>
                   <option value="administrador" ${u.rol === 'administrador' ? 'selected' : ''}>Cambiar a Admin</option>
                 </select>
              </div>
            </td>
            <td><code style="font-size:.78rem;color:#94a3b8;background:rgba(0,0,0,.25);padding:.2rem .5rem;border-radius:.4rem;border:1px solid rgba(255,255,255,0.05);">${u.matricula || 'N/A'}</code></td>
            <td>
              <div class="staff-row-actions">
                <button class="staff-icon-btn danger" title="Eliminar Cuenta" onclick="window.deleteUserNew('${u.id}')" ${isSelf ? 'disabled style="opacity:0.2;cursor:not-allowed;"' : ''}>
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    window.updateUserRoleNew = async (userId, newRole) => {
      window.showAdminToast('Actualizando rol...', 'info');
      const { error } = await supabase.from('profiles').update({ rol: newRole }).eq('id', userId);
      if (error) {
         window.showAdminToast('Error al actualizar', 'error');
      } else {
         window.showAdminToast('Rol actualizado correctamente', 'success');
         await loadStaffData();
      }
    };

    window.deleteUserNew = async (userId) => {
      const confirmMsg = '¿Estás seguro de eliminar esta cuenta permanentemente?';
      if (!confirm(confirmMsg)) return;
      
      window.showAdminToast('Eliminando...', 'info');
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      
      if (error) {
        console.error('Delete error:', error);
        window.showAdminToast(error.message || 'Error al eliminar usuario', 'error');
      } else {
        window.showAdminToast('Usuario eliminado correctamente', 'success');
        await loadStaffData();
      }
    };

    window.handleQuickAddStaff = async () => {
      const btn = document.querySelector('.staff-btn-add-full');
      const ogText = btn.innerHTML;
      btn.innerHTML = '⏳ Procesando...';
      btn.disabled = true;
      btn.style.opacity = '0.7';

      try {
        const nombre = document.getElementById('qa-nombre').value.trim();
        const telefono = document.getElementById('qa-telefono').value.trim();
        const matricula = document.getElementById('qa-matricula').value.trim();
        const password = document.getElementById('qa-password').value;
        const rol = document.getElementById('qa-rol').value;

        if (!nombre || !matricula || !password) {
          throw new Error('Nombre, matrícula y contraseña son obligatorios');
        }
        if (password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres');
        }

        const pseudoEmail = `${matricula.toLowerCase()}@aeudj.com`;
        
        // GUARDAR SESIÓN DEL ADMIN
        const { data: currentSessionData } = await supabase.auth.getSession();
        const adminSession = currentSessionData?.session;

        // CREAR NUEVO USUARIO
        const { data: auth, error: authErr } = await supabase.auth.signUp({ 
          email: pseudoEmail, 
          password: password 
        });

        if (authErr) throw authErr;

        // INSERTAR PERFIL
        const { error: profileErr } = await supabase.from('profiles').insert([
          { id: auth.user.id, nombre, matricula, telefono, rol }
        ]);

        if (profileErr) throw profileErr;

        // RESTAURAR SESIÓN DEL ADMIN
        if (adminSession) {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token
          });
        }

        window.showAdminToast('Personal agregado al directorio', 'success');
        
        // Limpiar formulario
        document.getElementById('qa-nombre').value = '';
        document.getElementById('qa-telefono').value = '';
        document.getElementById('qa-matricula').value = '';
        document.getElementById('qa-password').value = '';
        document.getElementById('qa-rol').value = 'estudiante';

        await loadStaffData();
      } catch(err) {
        console.error("Error al crear usuario:", err);
        window.showAdminToast(err.message, 'error');
        
        // Intentar restaurar sesión en caso de error después del signUp
        try {
          const { data: currentSessionData } = await supabase.auth.getSession();
          if (currentSessionData && !currentSessionData.session) {
             const adminUser = JSON.parse(localStorage.getItem('aeudj_user'));
             if(adminUser) {
                window.location.href = 'index.html'; // Forzar login si se perdió la sesión
             }
          }
        } catch(e) {}
      } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    };


    // ── HORARIOS HIGH-FIDELITY REDESIGN ───────────────────────────────────────
    let adminSelectedDay = 'Lunes';

    async function loadHorariosData() {
      renderDayTabs();
      await renderAdminHorarioGrid();
    }

    function renderDayTabs() {
      const tabs = document.getElementById('adminDayTabs');
      const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      tabs.innerHTML = days.map(d => {
        const active = adminSelectedDay === d;
        return `<button onclick="window.setAdminActiveDay('${d}')" style="padding:0.4rem 1rem; border-radius:0.6rem; font-weight:800; font-size:0.72rem; border:none; cursor:pointer; white-space:nowrap; transition:all 0.15s; background:${active ? '#4f75ff' : 'transparent'}; color:${active ? '#fff' : '#6b7280'}; letter-spacing:0.03em;">${d}</button>`;
      }).join('');
    }

    window.setAdminActiveDay = async (day) => {
      adminSelectedDay = day;
      renderDayTabs();
      document.getElementById('adminActiveDayLabel').textContent = `Horarios del ${day}`;
      await renderAdminHorarioGrid();
    }

    async function renderAdminHorarioGrid() {
      const grid = document.getElementById('adminHorarioGrid');
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem 0;opacity:0.2;"><div class="spinner" style="margin:0 auto 1rem;"></div><p style="letter-spacing:0.4em;font-weight:900;">CARGANDO...</p></div>';

      const times = [
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

      const { data: allUsers } = await supabase.from('profiles').select('*');
      const volunteers = (allUsers || []).filter(u => u.rol === 'voluntario');
      
      grid.innerHTML = '';
      
      times.forEach(t => {
        const fullText = `${t.time} ${t.route}`;
        const assigned = volunteers.filter(v => v.dia_asignado === adminSelectedDay && v.horario_asignado === fullText);
        const isAssigned = assigned.length > 0;
        
        // Card styled exactly like the student schedule picker
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
              onchange="window.assignVolunteerToSlot('${adminSelectedDay}', '${fullText}', this.value)"
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

      if (window.lucide) window.lucide.createIcons();
    }

    window.closeHorarioModal = () => {
      // Ya no usamos modal, pero mantengo la función por si acaso
      loadHorariosData();
    };

    window.assignVolunteerToSlot = async (day, time, volunteerId) => {
      if (!volunteerId) return;

      const { error } = await supabase.from('profiles')
        .update({ dia_asignado: day, horario_asignado: time })
        .eq('id', volunteerId);

      if (error) {
        console.error('Error assigning slot:', error);
        window.showAdminToast(error.message || 'Error al asignar turno', 'error');
      } else {
        window.showAdminToast('Turno asignado correctamente', 'success');
        loadHorariosData();
      }
    };

    function initForms() {
      const form = document.getElementById('createStaffForm');
      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('staffStatus');
        status.textContent = 'Procesando...';
        status.className = 'mt-4 p-5 rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.2em] bg-blue-500/10 text-blue-400 border border-blue-500/20';
        status.classList.remove('hidden');

        try {
          const nombre = document.getElementById('staffNombre').value;
          const matricula = document.getElementById('staffMatricula').value;
          const password = document.getElementById('staffPassword').value;
          const rol = document.getElementById('staffRol').value;

          const pseudoEmail = `${matricula}@aeudj.com`;
          
          const { data: auth, error: authErr } = await supabase.auth.signUp({ 
            email: pseudoEmail, 
            password: password 
          });

          if (authErr) throw authErr;

          const { error: profileErr } = await supabase.from('profiles').insert([
            { id: auth.user.id, nombre, matricula, rol }
          ]);

          if (profileErr) throw profileErr;

          status.textContent = 'Usuario registrado con éxito';
          status.className = 'mt-4 p-5 rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.2em] bg-green-500/10 text-green-400 border border-green-500/20';
          
          setTimeout(() => {
            window.hideAddStaffModal();
            loadStaffData();
          }, 1500);

        } catch (err) {
          status.textContent = err.message || 'Error en el registro';
          status.className = 'mt-4 p-5 rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.2em] bg-red-500/10 text-red-400 border border-red-500/20';
        }
      });
    }

    // ── SESSION CONTROL ──────────────────────────────────────────────────────────
    async function initSessionControl() {
      const toggle = document.getElementById('sessionOverrideToggle');
      const select = document.getElementById('sessionManualSelect');
      const status = document.getElementById('sessionStatusText');

      try {
        const { data } = await supabase.from('voting_config').select('*').eq('id', 1).single();
        if (data) {
          toggle.checked = data.manual_override;
          select.value = data.active_session || 'manana';
          select.disabled = !data.manual_override;
          status.textContent = data.manual_override ? 'Modo: MANUAL (Forzado)' : 'Modo: AUTOMÁTICO (Hora)';
          status.className = `text-[10px] mt-2 ${data.manual_override ? 'text-purple-400' : 'text-gray-500'}`;
        }
      } catch(e) { console.error('Error loading session config:', e); }

      toggle.onchange = async () => {
        const manual = toggle.checked;
        select.disabled = !manual;
        status.textContent = manual ? 'Modo: MANUAL (Forzado)' : 'Modo: AUTOMÁTICO (Hora)';
        status.className = `text-[10px] mt-2 ${manual ? 'text-purple-400' : 'text-gray-500'}`;
        
        await supabase.from('voting_config').update({ 
          manual_override: manual,
          active_session: select.value 
        }).eq('id', 1);
      };

      select.onchange = async () => {
        await supabase.from('voting_config').update({ 
          active_session: select.value 
        }).eq('id', 1);
      };
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'index.html';
    });

    // ── PENALIDADES ───────────────────────────────────────────────────────────────
    async function loadPenalidadesData() {
      try {
        // Load penalidades
        const { data: pens } = await supabase
          .from('penalidades').select('*').order('total_faltas', { ascending: false });
        
        // Load historial de faltas
        const { data: faltas } = await supabase
          .from('faltas').select('*').order('created_at', { ascending: false });

        const penalArr = pens || [];
        const faltaArr = faltas || [];

        // Update stats
        const penalizados  = penalArr.filter(p => p.penalizado).length;
        const levantadas   = penalArr.filter(p => !p.penalizado && p.total_faltas === 0 && p.fecha_penalidad).length;
        document.getElementById('penStatPen').textContent       = penalizados;
        document.getElementById('penStatFaltas').textContent    = faltaArr.length;
        document.getElementById('penStatLevantadas').textContent = levantadas;

        // Badge in sidebar
        const badge = document.getElementById('penalBadge');
        if (penalizados > 0) {
          badge.textContent = penalizados;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }

        renderPenalizados(penalArr);
        renderHistorial(faltaArr);

        // Tab switching
        document.querySelectorAll('.pen-tab').forEach(btn => {
          btn.onclick = () => {
            document.querySelectorAll('.pen-tab').forEach(b => { b.classList.remove('active'); b.classList.remove('active-blue'); });
            document.getElementById('penTab-penalizados').classList.add('hidden');
            document.getElementById('penTab-historial').classList.add('hidden');
            const tab = btn.dataset.penTab;
            document.getElementById(`penTab-${tab}`).classList.remove('hidden');
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
          <td class="name-cell">${p.nombre || '---'}</td>
          <td class="mat-cell">${p.matricula || '---'}</td>
          <td style="font-size:0.78rem;color:#64748b;">${p.email || '---'}</td>
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

      // Attach levantar handlers
      container.querySelectorAll('.btn-levantar').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid    = btn.dataset.uid;
          const nombre = btn.dataset.nombre;
          if (!confirm(`¿Confirmas que ${nombre} ya pagó la penalidad? Esto reiniciará su contador de faltas a 0.`)) return;
          btn.disabled = true;
          btn.textContent = 'Procesando...';
          await levantarPenalidad(uid);
          loadPenalidadesData(); // Reload
        });
      });

      if (window.lucide) window.lucide.createIcons();
    }

    function renderHistorial(faltas) {
      const container = document.getElementById('historialTable');
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
          <td class="name-cell">${f.nombre || '—'}</td>
          <td class="mat-cell">${f.matricula || '—'}</td>
          <td style="font-size:0.8rem;">${f.horario || '—'}</td>
          <td style="font-size:0.8rem;">${f.fecha || '—'}</td>
          <td style="font-size:0.75rem;color:#64748b;">${registrado}</td>
        </tr>`;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    async function levantarPenalidad(usuarioId) {
      try {
        // Reset counter and mark as NOT penalized
        await supabase.from('penalidades').update({
          total_faltas:    0,
          penalizado:      false,
          fecha_penalidad: null,
          updated_at:      new Date().toISOString(),
        }).eq('usuario_id', usuarioId);

        // Also delete their fault history (clean slate after paying)
        await supabase.from('faltas').delete().eq('usuario_id', usuarioId);

      } catch(err) {
        console.error('Error levantando penalidad:', err);
        alert('Error al levantar la penalidad. Intenta de nuevo.');
      }
    }
  
