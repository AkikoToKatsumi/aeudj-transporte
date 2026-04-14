// ============================================
// AEUDJ TRANSPORTE - APLICACIÓN PRINCIPAL (SUPABASE VERSION)
// ============================================

import { supabase, transportSchedules, getCycleDate, formatDate } from './supabase-config.js';

// Variables globales
let currentUser = null;
let isAdmin = false;
let selectedHorarios = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
  // Verificar sesión con localStorage y verificar luego con Supabase Auth
  checkSession();
  
  const page = document.body.dataset.page;
  
  // Escuchar cambios de autenticación
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const user = session.user;
      if (!currentUser || currentUser.id !== user.id) {
        try {
           const { data, error } = await supabase
             .from('profiles')
             .select('*')
             .eq('id', user.id)
             .single();
             
           if (data) {
             currentUser = data;
             setSession(currentUser);
           }
        } catch(e) { console.error('Error fetching user config:', e); }
      }
      // Redirigir siempre a votar.html al cargar el home para que elijan su asiento primero
      if (page === 'index' && currentUser) {
         window.location.href = 'votar.html';
      }
    } else {
      clearSession();
      if (page === 'votar' || page === 'cambios' || page === 'admin' || page === 'voluntario') {
         window.location.href = 'index.html';
      }
    }
  });

  if (page) {
    initPage(page);
  }
});

// ============================================
// GESTIÓN DE SESIÓN
// ============================================
function checkSession() {
  const userData = localStorage.getItem('aeudj_user');
  const adminData = localStorage.getItem('aeudj_admin_session');
  
  if (userData) {
    currentUser = JSON.parse(userData);
  }
  
  if (adminData === 'true') {
    isAdmin = true;
  }
}

function setSession(user) {
  currentUser = user;
  localStorage.setItem('aeudj_user', JSON.stringify(user));
}

function setAdminSession() {
  isAdmin = true;
  localStorage.setItem('aeudj_admin_session', 'true');
}

function clearSession() {
  currentUser = null;
  isAdmin = false;
  localStorage.removeItem('aeudj_user');
  localStorage.removeItem('aeudj_admin_session');
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch(e) {}
  clearSession();
  window.location.href = 'index.html';
}

// ============================================
// INICIALIZACIÓN DE PÁGINAS
// ============================================
function initPage(page) {
  switch(page) {
    case 'index':
      initIndexPage();
      break;
    case 'votar':
      initVotarPage();
      break;
    case 'lista':
      initListaPage();
      break;
    case 'admin':
      initAdminPage();
      break;
    case 'voluntario':
      initVoluntarioPage();
      break;
    case 'gracias':
      initGraciasPage();
      break;
    case 'cambios':
      initCambiosPage();
      break;
    case 'no-subieron':
      initNoSubieronPage();
      break;
  }
}

// ============================================
// PÁGINA INDEX (LOGIN/REGISTRO)
// ============================================
function initIndexPage() {
  if (currentUser) {
    window.location.href = 'votar.html';
    return;
  }
  
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const errorDiv = document.getElementById('errorMsg');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const showLoginBtn = document.getElementById('showLoginBtn');

  if(showRegisterBtn) {
    showRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    });
  }

  if(showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  }

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    errorDiv.classList.add('hidden');
    
    const userInput = document.getElementById('userInput').value.trim().replace(/\s+/g, '');
    const pass = document.getElementById('passwordLogin').value.trim();
    
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      let matriculaLogin = userInput;
      let userDataLocal = null;
      
      // Buscar por matrícula o teléfono
      const { data: userByMat, error: errMat } = await supabase
        .from('profiles')
        .select('*')
        .eq('matricula', userInput)
        .maybeSingle();

      if (userByMat) {
        userDataLocal = userByMat;
      } else {
        const { data: userByTel, error: errTel } = await supabase
          .from('profiles')
          .select('*')
          .eq('telefono', userInput)
          .maybeSingle();
        
        if (userByTel) {
           userDataLocal = userByTel;
           matriculaLogin = userDataLocal.matricula;
        }
      }
      
      const pseudoEmail = `${matriculaLogin}@aeudj.com`;

      let authResult;
      // Intentar con pseudo-email
      authResult = await supabase.auth.signInWithPassword({
        email: pseudoEmail,
        password: pass
      });

      if (authResult.error) {
        // Intentar con email real si existe en el perfil
        if (userDataLocal && userDataLocal.email) {
          authResult = await supabase.auth.signInWithPassword({
            email: userDataLocal.email,
            password: pass
          });
        }
      }

      if (authResult.error) throw authResult.error;
      
      const user = authResult.data.user;
      
      const { data: userData, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userData) {
        // Auto-promover a administradora (ejemplo del código original)
        if (userData.matricula === '0000' && userData.rol !== 'administrador') {
          userData.rol = 'administrador';
          await supabase.from('profiles').update({ rol: 'administrador' }).eq('id', user.id);
        }
        
        setSession(userData);
        window.location.href = 'votar.html';
      } else {
        showError('Credenciales correctas, pero no se encontraron datos de usuario en la base de datos.');
      }
      
    } catch (error) {
      console.error('Error:', error);
      showError('Error al iniciar sesión. Verifica tu matrícula o contraseña.');
    }
    btn.disabled = false;
    btn.textContent = 'Entrar';
  });
  
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    errorDiv.classList.add('hidden');
    
    const matricula = document.getElementById('matricula').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    const universidad = document.getElementById('universidad').value;
    
    if (matricula.length < 3) {
      showError('Matrícula muy corta.');
      return;
    }
    
    if (pass.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    
    if (!validateEmail(email)) {
      showError('Correo inválido.');
      return;
    }
    
    const btn = registerForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
      // Verificar si la matrícula ya existe
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('matricula', matricula)
        .maybeSingle();
      
      if (existingUser) {
        showError('Esta matrícula ya está registrada. Usa "Iniciar sesión".');
        btn.disabled = false;
        btn.textContent = 'Registrar';
        return;
      }
      
      const pseudoEmail = `${matricula.replace(/\s+/g, '')}@aeudj.com`;
      
      // Registrar en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: pseudoEmail,
        password: pass
      });

      if (authErr) throw authErr;
      const user = authData.user;

      const newUser = {
        id: user.id,
        matricula,
        nombre,
        telefono,
        email,
        universidad,
        rol: matricula === '0000' ? 'administrador' : 'estudiante'
      };
      
      // Guardar en tabla de perfiles
      const { error: profileErr } = await supabase.from('profiles').insert(newUser);
      if (profileErr) throw profileErr;
      
      setSession(newUser);
      window.location.href = 'votar.html';
      
    } catch (error) {
      console.error('Error:', error);
      showError('Error al registrar: ' + (error.message || 'Error desconocido'));
    }
    btn.disabled = false;
    btn.textContent = 'Registrar';
  });

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
  }
}

// ============================================
// PÁGINA VOTAR
// ============================================
function initVotarPage() {
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }
  
  const staffMenu = document.getElementById('staffMenu');
  if (staffMenu && currentUser) {
    if (currentUser.rol === 'administrador') {
      staffMenu.innerHTML = `<a href="admin.html" class="btn p-3" style="background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #c4b5fd; text-shadow: 0 0 10px rgba(196,181,253,0.5); box-shadow: 0 0 15px rgba(139, 92, 246, 0.15); display: inline-block;">🛠️ Entrar al Panel de Administración</a>`;
      staffMenu.classList.remove('hidden');
    } else if (currentUser.rol === 'voluntario') {
      staffMenu.innerHTML = `<a href="voluntario.html" class="btn p-3" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; text-shadow: 0 0 10px rgba(110,231,183,0.5); box-shadow: 0 0 15px rgba(16, 185, 129, 0.15); display: inline-block;">📋 Entrar al Panel de Voluntario</a>`;
      staffMenu.classList.remove('hidden');
    }
  }
  
  const cycleDate = getCycleDate();
  const horarioForm = document.getElementById('horarioForm');
  const scheduleGrid = document.getElementById('scheduleGrid');
  const statusMsg = document.getElementById('status-message');
  
  checkYaVotado();
  
  async function checkYaVotado() {
    try {
      const { data: snapshot, error } = await supabase
        .from('votos')
        .select('*')
        .eq('usuario_id', currentUser.id)
        .eq('fecha', cycleDate);
      
      if (snapshot && snapshot.length > 0) {
        window.location.href = 'gracias.html?ya_votado=1';
        return;
      }
      
      renderHorarios();
      
    } catch (error) {
      console.error('Error al verificar voto:', error);
      statusMsg.textContent = 'Error al cargar. Intenta recargar la página.';
      statusMsg.className = 'text-center text-sm font-medium text-red-600 mt-4';
      renderHorarios();
    }
  }
  
  function renderHorarios() {
    scheduleGrid.innerHTML = '';
    
    transportSchedules.forEach(schedule => {
      const direction = schedule.route.includes('Jarabacoa → La Vega') ? 'ida' : 'vuelta';
      const icon = direction === 'ida' ? '🚌➡️' : '⬅️🚌';
      
      const slot = document.createElement('div');
      slot.className = 'time-slot';
      slot.dataset.direction = direction;
      slot.dataset.fulltext = schedule.fullText;
      slot.innerHTML = `
        <div class="time-icon">${icon}</div>
        <div class="time-text">${schedule.time}</div>
        <div class="time-route">${schedule.route}</div>
        <div class="checkmark hidden">✅</div>
      `;
      
      slot.addEventListener('click', () => toggleSlot(slot, schedule.fullText, direction));
      scheduleGrid.appendChild(slot);
    });
  }
  
  function toggleSlot(el, fullText, direction) {
    const prevSelected = document.querySelector(`.time-slot.selected[data-direction="${direction}"]`);
    if (prevSelected) {
      prevSelected.classList.remove('selected');
      prevSelected.querySelector('.checkmark').classList.add('hidden');
    }
    
    selectedHorarios = selectedHorarios.filter(h => {
      const hDirection = h.includes('Jarabacoa → La Vega') ? 'ida' : 'vuelta';
      return hDirection !== direction;
    });
    
    if (el.classList.contains('selected')) {
      el.classList.remove('selected');
      el.querySelector('.checkmark').classList.add('hidden');
      return;
    }
    
    el.classList.add('selected');
    el.querySelector('.checkmark').classList.remove('hidden');
    selectedHorarios.push(fullText);
    
    statusMsg.textContent = `✅ Viaje de ${direction === 'ida' ? 'ida' : 'vuelta'} seleccionado (${selectedHorarios.length}/2)`;
    statusMsg.className = 'text-center text-sm font-medium text-green-600 mt-4';
  }
  
  horarioForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (selectedHorarios.length === 0) {
      alert('Selecciona al menos un horario');
      return;
    }
    
    if (selectedHorarios.length > 2) {
      alert('Máximo 2 horarios permitidos');
      return;
    }
    
    const btn = horarioForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    try {
      const insertData = selectedHorarios.map(horario => ({
        usuario_id: currentUser.id,
        nombre: currentUser.nombre,
        universidad: currentUser.universidad,
        matricula: currentUser.matricula,
        telefono: currentUser.telefono || '',
        email: currentUser.email || '',
        horario: horario,
        fecha: cycleDate,
        se_monto: null,
        en_espera: false
      }));
      
      const { error } = await supabase.from('votos').insert(insertData);
      if (error) throw error;
      
      window.location.href = 'gracias.html';
      
    } catch (error) {
      console.error('ERROR:', error);
      alert('Error al guardar: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Confirmar Selección';
    }
  });
}

// ============================================
// PÁGINA LISTA
// ============================================
function initListaPage() {
  const cycleDate = getCycleDate();
  const container = document.getElementById('listContainer');
  const stickyMenu = document.getElementById('stickyMenu');
  const cambiosSection = document.getElementById('cambiosSection');
  
  if (currentUser) {
    cambiosSection.classList.remove('hidden');
  }
  
  loadLista();
  
  async function loadLista() {
    try {
      const { data: votos, error } = await supabase
        .from('votos')
        .select('*')
        .eq('fecha', cycleDate)
        .order('horario')
        .order('created_at');
      
      if (error) throw error;
      
      const listado = {};
      const listaEspera = {};
      
      votos.forEach(voto => {
        const datos = {
          nombre: voto.nombre,
          universidad: voto.universidad,
          createdAt: new Date(voto.created_at),
          enEspera: voto.en_espera,
          seMonto: voto.se_monto
        };
        
        if (voto.en_espera) {
          if (!listaEspera[voto.horario]) listaEspera[voto.horario] = [];
          listaEspera[voto.horario].push(datos);
        } else {
          if (!listado[voto.horario]) listado[voto.horario] = [];
          listado[voto.horario].push(datos);
        }
      });
      
      renderLista(listado, listaEspera);
      renderStickyMenu(Object.keys(listado));
      
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = '<p class="text-center text-gray-600">Error al cargar la lista.</p>';
    }
  }
  
  function renderLista(listado, listaEspera) {
    container.innerHTML = '';
    
    const horarios = Object.keys(listado).sort((a, b) => {
      return horarioAMinutos(a) - horarioAMinutos(b);
    });
    
    if (horarios.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-600">No hay pasajeros registrados hoy.</p>';
      return;
    }
    
    horarios.forEach(horario => {
      const personas = listado[horario];
      const espera = listaEspera[horario] || [];
      
      const card = document.createElement('div');
      card.className = 'card-horario';
      card.id = 'horario-' + hashString(horario);
      
      let html = `
        <h2 class="text-2xl font-bold text-blue-800 mb-6 text-center">${horario}</h2>
        <div class="passenger-list">
      `;
      
      personas.forEach((p, i) => {
        let statusIcon = '';
        if (p.seMonto === 1) statusIcon = ' ✅';
        else if (p.seMonto === 2) statusIcon = ' ⏰';
        else if (p.seMonto === 0) statusIcon = ' ❌';
        
        html += `
          <div class="passenger-item">
            <div class="flex items-center" style="gap: 1rem;">
              <span class="passenger-number">${i + 1}</span>
              <div class="passenger-info">
                <p class="passenger-name">${escapeHtml(p.nombre)}${statusIcon}
                  ${p.universidad ? `<span class="text-gray-600">(${escapeHtml(p.universidad)})</span>` : ''}
                </p>
              </div>
            </div>
            <span class="passenger-time">${formatTime(p.createdAt)}</span>
          </div>
        `;
      });
      
      html += '</div>';
      
      if (espera.length > 0) {
        html += `
          <div class="waiting-list">
            <h3 class="waiting-title">⏳ Lista de Espera</h3>
            <div class="passenger-list">
        `;
        
        espera.forEach((p, i) => {
          html += `
            <div class="passenger-item waiting-item">
              <div class="flex items-center" style="gap: 1rem;">
                <span class="passenger-number">${i + 1}</span>
                <div class="passenger-info">
                  <p class="passenger-name">${escapeHtml(p.nombre)}
                    <span class="waiting-badge">En espera</span>
                    ${p.universidad ? `<span class="text-gray-600">(${escapeHtml(p.universidad)})</span>` : ''}
                  </p>
                </div>
              </div>
              <span class="passenger-time">${formatTime(p.createdAt)}</span>
            </div>
          `;
        });
        
        html += '</div></div>';
      }
      
      card.innerHTML = html;
      container.appendChild(card);
    });
  }
  
  function renderStickyMenu(horarios) {
    if (horarios.length === 0) {
      stickyMenu.classList.add('hidden');
      return;
    }
    
    const buttonsDiv = stickyMenu.querySelector('.schedule-buttons');
    const select = stickyMenu.querySelector('.schedule-select');
    
    buttonsDiv.innerHTML = '';
    select.innerHTML = '<option value="">-- Selecciona un horario --</option>';
    
    horarios.sort((a, b) => horarioAMinutos(a) - horarioAMinutos(b));
    
    horarios.forEach(h => {
      const btn = document.createElement('a');
      btn.href = '#horario-' + hashString(h);
      btn.className = 'schedule-btn';
      btn.textContent = h.split(' ')[0] + ' ' + h.split(' ')[1];
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        irAHorario('#horario-' + hashString(h));
      });
      buttonsDiv.appendChild(btn);
      
      const option = document.createElement('option');
      option.value = '#horario-' + hashString(h);
      option.textContent = h;
      select.appendChild(option);
    });
  }
  
  window.irAHorario = function(ancla) {
    if (!ancla) return;
    const target = document.querySelector(ancla);
    if (target) {
      const offset = 100;
      const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };
}

// ============================================
// PÁGINA ADMIN
// ============================================
function initAdminPage() {
  const adminPanel = document.getElementById('adminPanel');
  
  if (!currentUser || currentUser.rol !== 'administrador') {
    window.location.href = 'index.html';
    return;
  }
  
  if (adminPanel) adminPanel.classList.remove('hidden');
  
  const cycleDate = getCycleDate();
  const container = document.getElementById('adminContainer');
  
  loadAdminData();
  loadVoluntariosMng();
  
  async function loadVoluntariosMng() {
     const volContainer = document.getElementById('voluntariosListContainer');
     if (!volContainer) return;

     try {
       const { data: users, error } = await supabase
         .from('profiles')
         .select('*')
         .order('nombre');
       
       if (error) throw error;
       
       let html = `<div class="overflow-x-auto"><table class="w-full text-left border-collapse min-w-full">
         <thead><tr style="background:#f1f5f9;">
           <th class="p-2 border" style="border-color:#cbd5e1;">Usuario</th>
           <th class="p-2 border" style="border-color:#cbd5e1;">Rol</th>
           <th class="p-2 border" style="border-color:#cbd5e1;">Horario Asignado (Vol)</th>
           <th class="p-2 border" style="border-color:#cbd5e1;">Acción</th>
         </tr></thead><tbody>`;
         
       users.forEach(u => {
         if (u.rol === 'administrador') return;
         
         const isVoluntario = u.rol === 'voluntario';
         let optHorarios = transportSchedules.map(h => {
             const selected = (u.horarios_asignados && u.horarios_asignados.includes(h.fullText)) ? 'selected' : '';
             return `<option value="${h.fullText}" ${selected}>${h.fullText}</option>`;
         }).join('');
         
         html += `<tr>
           <td class="p-2 border" style="border-color:#cbd5e1;">${escapeHtml(u.nombre)}<br><small style="color:#64748b;">${u.email}</small></td>
           <td class="p-2 border" style="border-color:#cbd5e1;">
             <select id="rol-${u.id}" class="form-select text-sm p-1" style="width:100%;">
               <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
               <option value="voluntario" ${isVoluntario ? 'selected' : ''}>Voluntario</option>
             </select>
           </td>
           <td class="p-2 border" style="border-color:#cbd5e1;">
             <select id="horarioAsig-${u.id}" class="form-select text-sm p-1" style="width:100%;">
               <option value="">-- Ninguno --</option>
               ${optHorarios}
             </select>
           </td>
           <td class="p-2 border" style="border-color:#cbd5e1;">
             <button onclick="guardarRolAdmin('${u.id}')" class="btn btn-primary btn-small" style="width:100%;">Guardar</button>
           </td>
         </tr>`;
       });
       
       html += `</tbody></table></div>`;
       volContainer.innerHTML = html;
     } catch (e) {
       console.error(e);
       volContainer.innerHTML = 'Error al cargar voluntarios.';
     }
  }

  window.guardarRolAdmin = async function(id) {
    const selRol = document.getElementById(`rol-${id}`).value;
    const selHorario = document.getElementById(`horarioAsig-${id}`).value;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          rol: selRol,
          horarios_asignados: (selRol === 'voluntario' && selHorario) ? [selHorario] : []
        })
        .eq('id', id);
      
      if (error) throw error;
      alert('Rol actualizado correctamente');
    } catch(e) {
      console.error(e);
      alert('Error updating user');
    }
  }
  
  async function loadAdminData() {
    try {
      const { data: votos, error } = await supabase
        .from('votos')
        .select('*')
        .eq('fecha', cycleDate)
        .order('horario')
        .order('created_at');
      
      if (error) throw error;
      
      const listado = {};
      const listaEspera = [];
      
      votos.forEach(voto => {
        if (voto.en_espera) {
          listaEspera.push(voto);
        } else {
          if (!listado[voto.horario]) listado[voto.horario] = [];
          listado[voto.horario].push(voto);
        }
      });
      
      renderAdminList(listado, listaEspera);
      
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = '<p class="text-center text-gray-600">Error al cargar datos.</p>';
    }
  }

  function renderAdminList(listado, listaEspera) {
    container.innerHTML = '';
    
    const horarios = Object.keys(listado).sort((a, b) => {
      return horarioAMinutos(a) - horarioAMinutos(b);
    });
    
    if (horarios.length === 0 && listaEspera.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-600">No hay votos hoy.</p>';
      return;
    }
    
    horarios.forEach(horario => {
      const personas = listado[horario];
      
      const card = document.createElement('div');
      card.className = 'card-horario';
      
      let html = `
        <h2 class="text-2xl font-bold text-blue-800 mb-6 text-center">${horario}</h2>
        <div class="passenger-list">
      `;
      
      personas.forEach(p => {
        html += renderAdminItem(p);
      });
      
      html += '</div>';
      card.innerHTML = html;
      container.appendChild(card);
    });
    
    if (listaEspera.length > 0) {
      const esperaCard = document.createElement('div');
      esperaCard.className = 'card-horario';
      esperaCard.style.background = '#fffbeb';
      esperaCard.style.border = '2px solid #fcd34d';
      
      let html = `
        <h2 class="text-2xl font-bold text-yellow-800 mb-6 text-center">⏳ Lista de Espera</h2>
        <div class="passenger-list">
      `;
      
      listaEspera.forEach(p => {
        html += renderAdminItem(p, true);
      });
      
      html += '</div>';
      esperaCard.innerHTML = html;
      container.appendChild(esperaCard);
    }
  }
  
  function renderAdminItem(p, isEspera = false) {
    let statusHtml = '';
    
    if (p.se_monto === null) {
      statusHtml = `
        <div class="action-btns">
          <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Subió</button>
          <button onclick="marcarVoto('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
        </div>
      `;
    } else if (p.se_monto === 1) {
      statusHtml = `
        <div class="action-btns">
          <span class="status-badge status-success">✅ Subió</span>
          <button onclick="marcarVoto('${p.id}', 2)" class="btn btn-warning btn-small">Llegó tarde</button>
        </div>
      `;
    } else if (p.se_monto === 2) {
      statusHtml = `
        <div class="action-btns">
          <span class="status-badge status-warning">⏰ Llegó tarde (Subió)</span>
          <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Marcar puntual</button>
          <button onclick="marcarVoto('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
        </div>
      `;
    } else {
      statusHtml = `
        <div class="action-btns">
          <span class="status-badge status-danger">❌ No subió</span>
          <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Subió</button>
          <button onclick="marcarVoto('${p.id}', 2)" class="btn btn-warning btn-small">Llegó tarde</button>
        </div>
      `;
    }
    
    return `
      <div class="passenger-item ${isEspera ? 'waiting-item' : ''}">
        <div class="flex items-center" style="gap: 1rem;">
          <span class="passenger-number" style="${isEspera ? 'background: #f59e0b;' : ''}">👤</span>
          <div class="passenger-info">
            <p class="passenger-name">${escapeHtml(p.nombre)}
              ${isEspera ? '<span class="waiting-badge">En espera</span>' : ''}
            </p>
            <p class="passenger-meta">${p.matricula} · ${p.telefono || 'N/A'} · ${p.email || 'N/A'}</p>
          </div>
        </div>
        ${statusHtml}
      </div>
    `;
  }
  
  window.marcarVoto = async function(id, val) {
    try {
      const { error } = await supabase
        .from('votos')
        .update({ se_monto: val })
        .eq('id', id);
      
      if (error) throw error;
      
      if (val === 0) {
        await moverDeEspera(id);
      }
      
      loadAdminData();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };
  
  async function moverDeEspera(votoId) {
    // Obtener datos del voto que se canceló
    const { data: voto, error: fetchErr } = await supabase
      .from('votos')
      .select('*')
      .eq('id', votoId)
      .single();
    
    if (fetchErr || !voto) return;
    
    // Buscar el primero en espera para ese horario/fecha
    const { data: esperaArr, error: qErr } = await supabase
      .from('votos')
      .select('*')
      .eq('fecha', voto.fecha)
      .eq('horario', voto.horario)
      .eq('en_espera', true)
      .order('created_at')
      .limit(1);
    
    if (esperaArr && esperaArr.length > 0) {
      const esperaDoc = esperaArr[0];
      await supabase
        .from('votos')
        .update({ en_espera: false })
        .eq('id', esperaDoc.id);
    }
  }
}

// ============================================
// PÁGINA VOLUNTARIO
// ============================================
function initVoluntarioPage() {
  if (!currentUser || currentUser.rol !== 'voluntario') {
    window.location.href = 'index.html';
    return;
  }

  const container = document.getElementById('voluntarioContainer');
  const horariosText = document.getElementById('horariosAsignadosText');
  const cycleDate = getCycleDate();
  
  const misHorarios = currentUser.horarios_asignados || [];
  
  if (misHorarios.length === 0) {
     if(horariosText) horariosText.textContent = "No tienes ningún horario asignado.";
     container.innerHTML = '<p class="text-center text-gray-600 mt-4">Contacta al administrador para que te asigne una ruta.</p>';
     return;
  }
  
  if(horariosText) horariosText.textContent = `Tu horario: ${misHorarios.join(', ')}`;
  
  loadVoluntarioData();
  
  async function loadVoluntarioData() {
    try {
      const { data: votos, error } = await supabase
        .from('votos')
        .select('*')
        .eq('fecha', cycleDate)
        .in('horario', misHorarios)
        .order('created_at');
      
      if (error) throw error;
      
      if (votos.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-600">No hay pasajeros anotados para tu horario hoy.</p>';
        return;
      }

      container.innerHTML = '';
      
      const card = document.createElement('div');
      card.className = 'card-horario';
      let html = `<h2 class="text-2xl font-bold text-blue-800 mb-6 text-center">Pasajeros (${votos.length})</h2><div class="passenger-list">`;
      
      votos.forEach((p, i) => {
        let statusHtml = '';
        if (p.se_monto === null) {
          statusHtml = `
            <div class="action-btns">
              <button onclick="marcarVotoVoluntario('${p.id}', 1)" class="btn btn-success btn-small">Subió</button>
              <button onclick="marcarVotoVoluntario('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
            </div>
          `;
        } else if (p.se_monto === 1) {
          statusHtml = `
            <div class="action-btns">
              <span class="status-badge status-success">✅ Subió</span>
              <button onclick="marcarVotoVoluntario('${p.id}', 2)" class="btn btn-warning btn-small">Llegó tarde</button>
            </div>
          `;
        } else if (p.se_monto === 2) {
          statusHtml = `
            <div class="action-btns">
              <span class="status-badge status-warning">⏰ Llegó tarde</span>
              <button onclick="marcarVotoVoluntario('${p.id}', 1)" class="btn btn-success btn-small">Puntual</button>
              <button onclick="marcarVotoVoluntario('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
            </div>
          `;
        } else {
          statusHtml = `
            <div class="action-btns">
              <span class="status-badge status-danger">❌ No subió</span>
              <button onclick="marcarVotoVoluntario('${p.id}', 1)" class="btn btn-success btn-small">Subió</button>
            </div>
          `;
        }

        html += `
          <div class="passenger-item">
            <div class="flex items-center" style="gap: 1rem;">
              <span class="passenger-number">${i+1}</span>
              <div class="passenger-info">
                <p class="passenger-name">${escapeHtml(p.nombre)}</p>
                <p class="passenger-meta">${p.matricula} · ${p.telefono || 'N/A'}</p>
              </div>
            </div>
            ${statusHtml}
          </div>
        `;
      });
      html += '</div>';
      card.innerHTML = html;
      container.appendChild(card);
      
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = '<p class="text-center text-gray-600">Error al cargar datos.</p>';
    }
  }

  window.marcarVotoVoluntario = async function(id, val) {
    try {
      const { error } = await supabase
        .from('votos')
        .update({ se_monto: val })
        .eq('id', id);
      
      if (error) throw error;
      loadVoluntarioData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };
}

// ============================================
// PÁGINA CAMBIOS
// ============================================
function initCambiosPage() {
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }
  
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get('tipo');
  
  if (!tipo) {
    window.location.href = 'lista.html';
    return;
  }
  
  const cycleDate = getCycleDate();
  const container = document.getElementById('cambiosContainer');
  
  container.innerHTML = '<div class="text-center"><p>Cargando...</p></div>';
  
  cargarDatos();
  
  async function cargarDatos() {
    try {
      const { data: votos, error } = await supabase
        .from('votos')
        .select('*')
        .eq('usuario_id', currentUser.id)
        .eq('fecha', cycleDate);
      
      if (error) throw error;
      
      if (!votos || votos.length === 0) {
        container.innerHTML = '<p class="text-center">No tienes votos hoy.</p>';
        return;
      }
      
      const vuelta = votos.find(v => v.horario && v.horario.includes('La Vega → Jarabacoa'));
      
      if (!vuelta) {
        container.innerHTML = '<p class="text-center">No tienes horario de vuelta.</p>';
        return;
      }
      
      if (tipo === 'otros') {
        const { error: delErr } = await supabase.from('votos').delete().eq('id', vuelta.id);
        if (delErr) throw delErr;
        
        await supabase.from('cambios_audit').insert({
          usuario_id: currentUser.id,
          matricula: currentUser.matricula,
          tipo: 'otros',
          fecha: cycleDate
        });
        window.location.href = 'gracias.html?cambio=1';
        return;
      }
      
      mostrarSelector(tipo, vuelta.horario, vuelta.id);
      
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = '<p class="text-center text-red-600">Error: ' + error.message + '</p>';
    }
  }
  
  function mostrarSelector(tipo, horarioActual, votoId) {
    const parseHorario = (h) => {
      const match = h.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return null;
      let horas = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && horas !== 12) horas += 12;
      if (ampm === 'AM' && horas === 12) horas = 0;
      return horas * 60 + mins;
    };
    
    const minutosActual = parseHorario(horarioActual);
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    
    const disponibles = [];
    
    transportSchedules.forEach(s => {
      if (!s.route.includes('La Vega → Jarabacoa')) return;
      const min = parseHorario(s.fullText);
      let yaPaso = false;
      const hoy = new Date().toISOString().split('T')[0];
      if (hoy === cycleDate) {
        yaPaso = min < minutosAhora;
      }
      
      if (tipo === 'antes') {
        if (min < minutosActual && !yaPaso) disponibles.push(s.fullText);
      } else if (tipo === 'despues') {
        if (min > minutosActual) disponibles.push(s.fullText);
      }
    });
    
    if (disponibles.length === 0) {
      transportSchedules.forEach(s => {
        if (!s.route.includes('La Vega → Jarabacoa')) return;
        const min = parseHorario(s.fullText);
        if (tipo === 'antes' && min < minutosActual) disponibles.push(s.fullText);
        else if (tipo === 'despues' && min > minutosActual) disponibles.push(s.fullText);
      });
    }
    
    let html = `
      <div class="card" style="padding: 1.5rem;">
        <h2 class="text-center mb-4">Horario ${tipo === 'antes' ? 'anterior' : 'posterior'}</h2>
        <p class="text-center text-gray-600 mb-4">Actual: <strong>${horarioActual}</strong></p>
    `;
    
    if (disponibles.length === 0) {
      html += `
        <p class="text-center text-orange-600 mb-4">No hay horarios ${tipo === 'antes' ? 'anteriores' : 'posteriores'} disponibles.</p>
        <button onclick="window.location.href='lista.html'" class="btn btn-gray" style="width: 100%;">Volver</button>
      `;
    } else {
      html += `
        <select id="nuevoHorario" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 0.5rem; font-size: 16px;">
          <option value="">-- Selecciona --</option>
          ${disponibles.map(h => `<option value="${h}">${h}</option>`).join('')}
        </select>
        <button id="btnGuardar" class="btn btn-primary" style="width: 100%; margin-bottom: 0.5rem; padding: 0.75rem; font-size: 16px;">Guardar</button>
        <button onclick="window.location.href='lista.html'" class="btn btn-gray" style="width: 100%; padding: 0.75rem; font-size: 16px;">Cancelar</button>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    if (disponibles.length > 0) {
      document.getElementById('btnGuardar').addEventListener('click', async () => {
        const nuevo = document.getElementById('nuevoHorario').value;
        if (!nuevo) {
          alert('Selecciona un horario');
          return;
        }
        
        const btn = document.getElementById('btnGuardar');
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        
        try {
          const { error: upErr } = await supabase
            .from('votos')
            .update({
              horario: nuevo,
              se_monto: null,
              created_at: new Date().toISOString()
            })
            .eq('id', votoId);
          
          if (upErr) throw upErr;
          
          await supabase.from('cambios_audit').insert({
            usuario_id: currentUser.id,
            matricula: currentUser.matricula,
            tipo: tipo,
            nuevo_horario: nuevo,
            fecha: cycleDate
          });
          
          window.location.href = 'lista.html?cambio=1';
          
        } catch (err) {
          console.error('Error:', err);
          alert('Error: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Guardar';
        }
      });
    }
  }
}

// ============================================
// PÁGINA NO SUBIERON
// ============================================
function initNoSubieronPage() {
  const adminSession = localStorage.getItem('aeudj_admin_session');
  if (adminSession !== 'true') {
    window.location.href = 'admin.html';
    return;
  }
  
  const cycleDate = getCycleDate();
  const container = document.getElementById('noSubieronContainer');
  
  loadNoSubieron();
  
  async function loadNoSubieron() {
    try {
      const { data: snapshot, error } = await supabase
        .from('votos')
        .select('*')
        .eq('fecha', cycleDate)
        .eq('se_monto', 0);
      
      if (error) throw error;
      
      const personas = snapshot || [];
      personas.sort((a, b) => horarioAMinutos(a.horario) - horarioAMinutos(b.horario));
      
      if (personas.length === 0) {
        container.innerHTML = `<div class="text-center"><p class="text-green-700 text-lg">¡Todos subieron! 🎉</p></div>`;
        return;
      }
      
      let html = '<div class="card">';
      html += `<h3 class="text-lg font-bold text-red-700 mb-4">Total: ${personas.length} persona(s)</h3>`;
      
      personas.forEach(p => {
        html += `
          <div class="passenger-item" style="background: #fef2f2; border: 1px solid #fecaca; margin-bottom: 0.5rem; padding: 1rem; border-radius: 0.5rem;">
            <div style="flex: 1;">
              <p class="passenger-name" style="font-weight: 600;">${escapeHtml(p.nombre)}</p>
              <p class="passenger-meta">📞 ${p.telefono || 'N/A'} · 🚌 ${p.horario}</p>
            </div>
            <button onclick="marcarComoSubio('${p.id}')" class="btn btn-success btn-small">Subió</button>
          </div>
        `;
      });
      
      html += '</div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  window.marcarComoSubio = async function(id) {
    try {
      await supabase.from('votos').update({ se_monto: 1 }).eq('id', id);
      loadNoSubieron();
    } catch (error) {
      console.error(error);
    }
  };
}

// ============================================
// UTILIDADES
// ============================================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function horarioAMinutos(horario) {
  try {
    const match = horario.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    const periodo = match[3].toUpperCase();
    if (periodo === 'PM' && horas !== 12) horas += 12;
    else if (periodo === 'AM' && horas === 12) horas = 0;
    return horas * 60 + minutos;
  } catch (e) {
    return 0;
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// ============================================
// FUNCIONES GLOBALES
// ============================================
window.logout = logout;
window.notificarAccion = async function(tipo) {
  if (!currentUser || currentUser.rol !== 'administrador') return;
  if (!confirm(`¿Estás seguro/a de enviar la notificación?`)) return;

  try {
    const btn = event.target;
    btn.disabled = true;
    
    let correos = [];
    if (tipo === 'apertura') {
       const { data: users } = await supabase.from('profiles').select('email');
       users.forEach(u => u.email && correos.push(u.email));
    } else {
       const { data: vs } = await supabase.from('votos').select('email').eq('fecha', getCycleDate());
       vs.forEach(v => v.email && !correos.includes(v.email) && correos.push(v.email));
    }

    if (correos.length === 0) {
      alert("No hay correos.");
      btn.disabled = false;
      return;
    }

    const templateParams = {
      titulo: tipo === 'apertura' ? "¡Lista Abierta!" : (tipo === 'llegada' ? "🚌 El autobús ha llegado" : "💨 El autobús está saliendo"),
      mensaje: "Mensaje de notificación de transporte AEUDJ.",
      destinatarios: correos.join(',')
    };

    await emailjs.send('service_afofocu', 'template_e2cqbex', templateParams);
    alert(`Enviado a ${correos.length} personas.`);
    btn.disabled = false;
  } catch(error) {
     console.error(error);
     alert("Error: " + error.message);
  }
};