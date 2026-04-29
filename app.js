



console.log('🚀 AEUDJ App Iniciada');

// Variables globales
let currentUser = null;
let isAdmin = false;
let selectedHorarios = [];
let isEditing = false;
let initialVotes = [];
let pageInitialized = false;
let currentAdminStats = null;
let horarioForm, scheduleGrid, statusMsg, confirmedView;

function refreshIcons() {
 try {
 if (window.lucide) {
 window.lucide.createIcons();
 }
 } catch (e) {
 console.error('Error loading Lucide icons:', e);
 }
}

// ============================================
// INICIALIZACIÓN
// ============================================
async function initApp() {
  refreshIcons();
  checkSession();

  const page = document.body.dataset.page;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.clear();
      window.location.href = 'index.html';
    };
  }

  if (page) {
    pageInitialized = true;
    initPage(page);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const user = session.user;
      if (!currentUser || currentUser.id !== user.id) {
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (data) {
            currentUser = data;
            setSession(currentUser);
          }
        } catch(e) { console.error('Error fetching profile:', e); }
      }

      if (page === 'index' && currentUser) {
        if (currentUser.rol === 'chofer' || currentUser.rol === 'admin_chofer') {
          window.location.href = 'choferes.html';
        } else {
          window.location.href = 'votar.html';
        }
      }

      if (!pageInitialized && page) {
        pageInitialized = true;
        initPage(page);
      }
    } else {
      clearSession();
      if (['votar', 'cambios', 'admin', 'voluntario', 'choferes'].includes(page)) {
        window.location.href = 'index.html';
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ============================================
// GESTIÓN DE SESIÓN
// ============================================
function checkSession() {
  try {
    const userData = localStorage.getItem('aeudj_user');
    
    if (userData && userData !== 'undefined') {
      currentUser = JSON.parse(userData);
      // El rol se verifica desde el objeto de usuario recuperado de la DB
      if (currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'desarrolladora')) {
        isAdmin = true;
      }
    }
  } catch (e) {
    console.error('Error loading session:', e);
    clearSession();
  }
}

function setSession(user) {
 currentUser = user;
 localStorage.setItem('aeudj_user', JSON.stringify(user));
}

function setAdminSession() {
  // Ya no guardamos 'true' en localStorage porque es vulnerable.
  // La sesión de admin se determinará por el campo 'rol' del perfil en la DB.
  isAdmin = true;
}

function clearSession() {
 currentUser = null;
 isAdmin = false;
 localStorage.removeItem('aeudj_user');
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
    case 'gracias':
      initGraciasPage();
      break;
    case 'no-subieron':
      initNoSubieronPage();
      break;
  }
}

function initGraciasPage() {
  refreshIcons();
  console.log('Página de gracias cargada.');
  // El redireccionamiento se maneja vía meta tag en el HTML.
}

// ============================================
// PÁGINA INDEX (LOGIN/REGISTRO)
// ============================================
function initIndexPage() {
 refreshIcons();
 if (currentUser) {
    if (currentUser.rol === 'chofer' || currentUser.rol === 'admin_chofer') {
      window.location.href = 'choferes.html';
    } else {
      window.location.href = 'votar.html';
    }
   return;
 }
 
 const loginForm = document.getElementById('loginForm');
 const registerForm = document.getElementById('registerForm');
 const errorDiv = document.getElementById('errorMsg');
 const showRegisterBtn = document.getElementById('showRegisterBtn');
 const showLoginBtn = document.getElementById('showLoginBtn');

  if(showRegisterBtn && loginForm && registerForm) {
  showRegisterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  });
  }

 if(showLoginBtn && loginForm && registerForm) {
 showLoginBtn.addEventListener('click', (e) => {
 e.preventDefault();
 registerForm.classList.add('hidden');
 loginForm.classList.remove('hidden');
 if (window.lucide) window.lucide.createIcons();
 });
 }

 // Implement password toggles
 const toggleLogin = document.getElementById('togglePasswordLogin');
 const passLogin = document.getElementById('passwordLogin');
 if (toggleLogin && passLogin) {
   toggleLogin.addEventListener('click', () => {
     const isPass = passLogin.type === 'password';
     passLogin.type = isPass ? 'text' : 'password';
     toggleLogin.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}"></i>`;
     if (window.lucide) window.lucide.createIcons();
   });
 }

 const toggleReg = document.getElementById('togglePasswordReg');
 const passReg = document.getElementById('password');
 if (toggleReg && passReg) {
   toggleReg.addEventListener('click', () => {
     const isPass = passReg.type === 'password';
     passReg.type = isPass ? 'text' : 'password';
     toggleReg.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}"></i>`;
     if (window.lucide) window.lucide.createIcons();
   });
 }
 
 const showError = (msg) => {
 if (errorDiv) {
 errorDiv.textContent = msg;
 errorDiv.classList.remove('hidden');
 } else {
 alert(msg);
 }
 };

 if (loginForm) {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (errorDiv) errorDiv.classList.add('hidden');
    
    const rawInput = document.getElementById('userInput').value.trim();
    const cleanInput = rawInput.replace(/[\s-]+/g, ''); // Sin espacios ni guiones para el pseudo-email
    const pass = document.getElementById('passwordLogin').value.trim();
    
    const btn = loginForm.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verificando...';
    }

    try {
      let authEmail = null;
      let userData = null;

      // Normalización para búsqueda y auth
      const cleanInput = rawInput.replace(/[\s-]+/g, ''); 

      console.log('Tentando login para:', rawInput, 'Clean:', cleanInput);

      // 1. Si el input ya parece un email, lo usamos directamente
      if (rawInput.includes('@')) {
        authEmail = rawInput;
      } else {
        // 2. Intentar buscar el perfil para saber el email real
        const { data: profile, error: searchError } = await supabase
          .from('profiles')
          .select('*')
          .or(`matricula.eq.${rawInput},telefono.eq.${rawInput},matricula.eq.${cleanInput}`)
          .maybeSingle();
        
        if (profile) {
          userData = profile;
          authEmail = profile.email; // Usamos el email real del perfil
          console.log('Perfil encontrado. Email:', authEmail);
        } else {
          // 2.1 Si no hay perfil (por RLS o no existe), buscamos en la tabla de votos (que es pública)
          console.log('Perfil no accesible. Buscando en historial de votos...');
          const { data: lastVote } = await supabase
            .from('votos')
            .select('email')
            .or(`matricula.eq.${rawInput},matricula.eq.${cleanInput}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (lastVote && lastVote.email) {
            authEmail = lastVote.email;
            console.log('Email recuperado de votos:', authEmail);
          } else {
            // 2.2 Fallback final al pseudo-email
            authEmail = `${cleanInput}@aeudj.com`;
            console.log('Sin historial, usando pseudo-email:', authEmail);
          }
        }
      }

      // Intento de login principal
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: pass,
      });

      // Si falla y el authEmail era el real, probamos el pseudo-email por si acaso
      let finalAuth = authData;
      let finalErr = authErr;

      if (finalErr && !rawInput.includes('@')) {
        const pseudoFallback = `${cleanInput}@aeudj.com`;
        if (authEmail !== pseudoFallback) {
          console.log('Fallo con email recuperado, intentando pseudo-email...');
          const { data: secondAuth, error: secondErr } = await supabase.auth.signInWithPassword({
            email: pseudoFallback,
            password: pass,
          });
          if (!secondErr) {
            finalAuth = secondAuth;
            finalErr = null;
          }
        }
      }

      if (finalErr) {
        console.error('Error final en Auth:', finalErr);
        if (finalErr.message.includes('Invalid login credentials')) {
          throw new Error('La matrícula o contraseña son incorrectas.');
        }
        throw finalErr;
      }

      if (finalErr) {
        console.error('Error final en Auth:', finalErr);
        if (finalErr.message.includes('Invalid login credentials')) {
          throw new Error('La matrícula o contraseña son incorrectas.');
        }
        throw finalErr;
      }

      if (!userData) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', finalAuth.user.id).single();
        userData = p;
      }

      if (userData) {
        await finishLogin(userData, finalAuth.user);
      } else {
        showError('Usuario validado, pero no se encontró su perfil.');
      }

    } catch (error) {
      console.error('Error detallado de login:', error);
      showError(error.message || 'Error al iniciar sesión.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    }
  });

  async function finishLogin(profile, user) {
    setSession(profile);
    window.location.href = (profile.rol === 'chofer' || profile.rol === 'admin_chofer') ? 'choferes.html' : 'votar.html';
  }
}

  if (registerForm) {
  
  registerForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (errorDiv) errorDiv.classList.add('hidden');
 
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
 
  const pseudoEmail = `${matricula.replace(/[\s-]+/g, '')}@aeudj.com`;
 
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
 rol: 'estudiante'
 };
 
 // Guardar en tabla de perfiles
 const { error: profileErr } = await supabase.from('profiles').insert(newUser);
 if (profileErr) throw profileErr;
 
 setSession(newUser);
 if (newUser.rol === 'chofer' || newUser.rol === 'admin_chofer') {
   window.location.href = 'choferes.html';
 } else {
   window.location.href = 'votar.html';
 }
 
 } catch (error) {
 console.error('Error:', error);
 showError('Error al registrar: ' + (error.message || 'Error desconocido'));
 }
 btn.disabled = false;
 btn.textContent = 'Registrar';
 });
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
 staffMenu.innerHTML = ''; // Limpiar para evitar duplicados en recargas de SPA
 if (currentUser.rol.includes('admin') || currentUser.rol.includes('desarrolladora')) {
 staffMenu.innerHTML += `<a href="admin.html" class="btn p-3 mb-2" style="background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #c4b5fd; text-shadow: 0 0 10px rgba(196,181,253,0.5); box-shadow: 0 0 15px rgba(139, 92, 246, 0.15); display: inline-block; width: 100%; border-radius: 12px; font-weight: bold; margin-bottom: 0.75rem;"> Entrar al Panel de Administración</a>`;
 staffMenu.classList.remove('hidden');
 }
   if (currentUser.rol.includes('voluntario') || currentUser.rol.includes('desarrolladora')) {
 staffMenu.innerHTML += `<a href="voluntario.html" class="btn p-3" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; text-shadow: 0 0 10px rgba(110,231,183,0.5); box-shadow: 0 0 15px rgba(16, 185, 129, 0.15); display: inline-block; width: 100%; border-radius: 12px; font-weight: bold;"> Entrar al Panel de Voluntario</a>`;
 staffMenu.classList.remove('hidden');
 }
 }
 
  const cycleDate = getCycleDate();
  horarioForm = document.getElementById('horarioForm');
  scheduleGrid = document.getElementById('scheduleGrid');
  statusMsg = document.getElementById('status-message');
  confirmedView = document.getElementById('confirmedView');

  // El listener de logout ahora se asigna en DOMContentLoaded para rapidez
 
  // FALLBACK DE EMERGENCIA: Si en 3 segundos no ha cargado, forzar render
  const safetyTimeout = setTimeout(() => {
    if (horarioForm && !horarioForm.classList.contains('hidden') && scheduleGrid.innerHTML.includes('Cargando')) {
      console.log('⚠️ Rescue Triggered: Fallback render');
      renderHorarios();
    }
  }, 3000);

  checkYaVotado().then(() => clearTimeout(safetyTimeout));

  async function checkYaVotado() {
    try {
      const { data: snapshot, error } = await supabase
        .from('votos')
        .select('*')
        .eq('usuario_id', currentUser.id)
        .eq('fecha', cycleDate)
        .gt('id', 40);
      
      if (snapshot && snapshot.length > 0) {
        // Filtrar solo los votos pendientes (aún no se ha pasado lista)
        const pendingVotes = snapshot.filter(v => v.se_monto === null);

        if (pendingVotes.length > 0) {
          initialVotes = [...pendingVotes];
          selectedHorarios = pendingVotes.map(v => v.horario);
          
          if (horarioForm) horarioForm.classList.add('hidden');
          if (confirmedView) {
            confirmedView.classList.remove('hidden');
            renderConfirmedView(pendingVotes);
          }
          const submitBtn = horarioForm?.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.textContent = 'Actualizar Selección';
        } else {
          // Todos los viajes de hoy ya fueron completados (se_monto no es null).
          // Mostrar el form limpio para que puedan reservar de nuevo si lo necesitan.
          initialVotes = [];
          selectedHorarios = [];
          if (horarioForm) {
            horarioForm.classList.remove('hidden');
            const submitBtn = horarioForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Confirmar Selección';
          }
          if (confirmedView) confirmedView.classList.add('hidden');
          renderHorarios();
        }
      } else {
        initialVotes = [];
        selectedHorarios = [];
        if (horarioForm) {
          horarioForm.classList.remove('hidden');
          const submitBtn = horarioForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.textContent = 'Confirmar Selección';
        }
        if (confirmedView) confirmedView.classList.add('hidden');
        renderHorarios();
      }
    } catch (error) {
      console.error('Error al verificar voto:', error);
      renderHorarios();
    }
  }

  function renderConfirmedView(votes) {
    const container = document.querySelector('.confirmed-schedules-list');
    if (!container) return;
    container.innerHTML = '';
    votes.forEach(v => {
      const direction = (v.horario && v.horario.includes('Jarabacoa')) ? 'ida' : 'vuelta';
      const div = document.createElement('div');
      div.className = 'confirmed-schedule-card';
      div.innerHTML = `
        <div class="confirm-icon p-3 rounded-full ${direction === 'ida' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}">
          <i data-lucide="${direction === 'ida' ? 'arrow-right' : 'arrow-left'}"></i>
        </div>
        <div style="flex:1">
          <p class="text-xs uppercase tracking-tighter text-gray-500 font-bold">${direction === 'ida' ? 'Salida' : 'Regreso'}</p>
          <p class="text-xl font-bold text-white">${v.horario.split(' ')[0]} ${v.horario.split(' ')[1]}</p>
          <p class="text-[10px] text-gray-400 font-mono">${v.horario.split(' ').slice(2).join(' ')}</p>
        </div>
        ${v.en_espera ? '<div class="text-orange-400 text-[10px] font-bold border border-orange-400/30 px-2 py-1 rounded bg-orange-400/5">LISTA ESPERA</div>' : '<div class="text-green-400 text-[10px] font-bold border border-green-400/30 px-2 py-1 rounded bg-green-400/5">CONFIRMADO</div>'}
      `;
      container.appendChild(div);
    });
    if (window.lucide) window.lucide.createIcons();
  }

  document.getElementById('btnMeFuiAntes')?.addEventListener('click', () => {
    window.location.href = 'cambios.html?tipo=antes';
  });

  document.getElementById('btnIreDespues')?.addEventListener('click', () => {
    window.location.href = 'cambios.html?tipo=despues';
  });

  document.getElementById('btnOtrosMedios')?.addEventListener('click', () => {
    window.location.href = 'cambios.html?tipo=otros';
  });
  document.getElementById('btnCambiarHorario')?.addEventListener('click', () => {
    isEditing = true;
    if (horarioForm) horarioForm.classList.remove('hidden');
    document.getElementById('confirmedView')?.classList.add('hidden');
    renderHorarios();
  });

 
  async function renderHorarios() {
    if (!scheduleGrid) return;
    scheduleGrid.innerHTML = '<div class="col-span-full text-center py-10 opacity-50">Cargando horarios...</div>';
    
    // Nueva lógica de visibilidad por grupos
    const ahora = new Date();
    const hora = ahora.getHours();
    
    // 1. Intentar obtener configuración forzada desde Supabase
    let currentGroup = (hora >= 22 || hora < 10) ? 'manana' : 'tarde';
    try {
      const { data: config } = await supabase.from('voting_config').select('*').eq('id', 1).single();
      if (config && config.manual_override) {
        currentGroup = config.active_session;
        console.log("Sesión forzada por Admin:", currentGroup);
      }
    } catch(e) {
      console.warn("Usando detección automática de sesión");
    }

    scheduleGrid.innerHTML = '';
    const visibleSchedules = transportSchedules.filter(s => s.group === currentGroup);
 
  visibleSchedules.forEach(schedule => {
  const direction = schedule.route.includes('Jarabacoa -> La Vega') ? 'ida' : 'vuelta';
  const iconName = direction === 'ida' ? 'arrow-right' : 'arrow-left';
  const isSelected = selectedHorarios.includes(schedule.fullText);
 
 const slot = document.createElement('div');
 slot.className = `time-slot ${isSelected ? 'selected' : ''}`;
 slot.dataset.direction = direction;
 slot.dataset.fulltext = schedule.fullText;
  slot.innerHTML = `
  <div class="time-icon"><i data-lucide="${iconName}"></i></div>
  <div class="time-text">${schedule.time}</div>
  <div class="time-route">${schedule.route}</div>
  <div class="checkmark ${isSelected ? '' : 'hidden'}"></div>
  `;
 
 slot.addEventListener('click', () => toggleSlot(slot, schedule.fullText, direction));
    scheduleGrid.appendChild(slot);
  });
  if (window.lucide) window.lucide.createIcons();
  }
 
 function toggleSlot(el, fullText, direction) {
 const prevSelectedList = document.querySelectorAll(`.time-slot.selected[data-direction="${direction}"]`);
 
 // Si el usuario hizo clic en el que ya estaba seleccionado (y es el nico), se deselecciona.
 // Si hay varios seleccionados por estado residual, los limpiamos todos primero de la vista.
 const isCurrentlySelected = el.classList.contains('selected');
 
 prevSelectedList.forEach(node => {
 node.classList.remove('selected');
 node.querySelector('.checkmark').classList.add('hidden');
 });
 
 selectedHorarios = selectedHorarios.filter(h => {
 const hDirection = h.includes('Jarabacoa La Vega') ? 'ida' : 'vuelta';
 return hDirection !== direction;
 });
 
 // Si ya estaba seleccionado, simplemente queríamos apagarlo, así que salimos.
 if (isCurrentlySelected && prevSelectedList.length === 1) {
 return;
 }
 
 // Si no, lo encendemos.
 el.classList.add('selected');
 el.querySelector('.checkmark').classList.remove('hidden');
 selectedHorarios.push(fullText);
 
 statusMsg.textContent = ` Viaje de ${direction === 'ida' ? 'ida' : 'vuelta'} seleccionado (${selectedHorarios.length}/2)`;
 statusMsg.className = 'text-center text-sm font-medium text-green-600 mt-4';
 }
 
 horarioForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (selectedHorarios.length === 0 || selectedHorarios.length > 2) {
      alert('Debes seleccionar al menos 1 horario (y máximo 2: ida y vuelta).');
      return;
    }
    
    // Hard validation: ensure ida is before vuelta
    const ida = selectedHorarios.find(h => h.includes('Jarabacoa La Vega'));
    const vuelta = selectedHorarios.find(h => h.includes('La Vega Jarabacoa'));
    
    if (ida && vuelta) {
      const pIda = horarioAMinutos(ida);
      const pVuelta = horarioAMinutos(vuelta);
      if (pVuelta <= pIda) {
        alert('Error: El viaje de regreso debe ser posterior al de ida.');
        return;
      }
    }

    const btn = horarioForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      // Eliminar SOLO LOS VOTOS PENDIENTES de hoy para no borrar el historial de los que ya subieron
      const { error: clearErr } = await supabase
        .from('votos')
        .delete()
        .eq('usuario_id', currentUser.id)
        .eq('fecha', cycleDate)
        .is('se_monto', null);
      
      if (clearErr) throw clearErr;

      const dataToInsert = [];
      for (const hor of selectedHorarios) {
        // Double check capacity
        const { count, error: countErr } = await supabase
          .from('votos')
          .select('*', { count: 'exact', head: true })
          .eq('horario', hor)
          .eq('fecha', cycleDate)
          .eq('en_espera', false);
        
        if (countErr) throw countErr;
        const enEspera = count >= 30;

        dataToInsert.push({
          usuario_id: currentUser.id,
          nombre: currentUser.nombre,
          universidad: currentUser.universidad,
          matricula: currentUser.matricula,
          telefono: currentUser.telefono || '',
          email: currentUser.email || '',
          horario: hor,
          fecha: cycleDate,
          se_monto: null,
          en_espera: enEspera
          // SE ELIMINA created_at: el servidor lo generará automáticamente (E-4 FIX)
        });
      }
      
      const { error: insErr } = await supabase.from('votos').insert(dataToInsert);
      if (insErr) throw insErr;
      
      window.location.href = 'gracias.html?v=324';
    } catch (error) {
      console.error('ERROR:', error);
      alert('Error al guardar: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Confirmar Seleccion';
    }
  });
}

// Lgica de visualizacin de contrasea
function initPasswordToggle() {
 const setupToggle = (btnId, inputId) => {
 const toggleBtn = document.getElementById(btnId);
 const passwordInput = document.getElementById(inputId);
 if (!toggleBtn || !passwordInput) return;

 toggleBtn.addEventListener('click', () => {
 const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
 passwordInput.setAttribute('type', type);
 
 const icon = toggleBtn.querySelector('i');
 if (icon) {
 icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
 if (window.lucide) window.lucide.createIcons();
 }
 });
 };

 setupToggle('togglePasswordLogin', 'passwordLogin');
 setupToggle('togglePasswordReg', 'password');
}

// ============================================
// PÁGINA LISTA
// ============================================
async function initListaPage() {
 const listContainer = document.getElementById('listContainer');
 const btnVolverInicio = document.getElementById('btnVolverInicio');

 if (btnVolverInicio) {
 btnVolverInicio.addEventListener('click', () => {
 window.logout();
 });
 }
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
   const { data: rawVotos, error } = await supabase.functions.invoke('obtener-lista-segura');
  
  if (error) throw error;

  // Deduplicación para la lista segura
  const uniqueMap = new Map();
  const isIda = h => h.includes('Jarabacoa -> La Vega') || h.includes('Jarabacoa \u2192 La Vega');
  
  (rawVotos || []).forEach(v => {
    const key = `${v.matricula || v.usuario_id}-${isIda(v.horario) ? 'ida' : 'vuelta'}`;
    if (!uniqueMap.has(key) || new Date(v.created_at) > new Date(uniqueMap.get(key).created_at)) {
      uniqueMap.set(key, v);
    }
  });
  const votos = Array.from(uniqueMap.values());
  
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
 if (p.seMonto === 1) statusIcon = ' ';
 else if (p.seMonto === 2) statusIcon = ' ';
 else if (p.seMonto === 0) statusIcon = ' ';
 
 html += `
 <div class="passenger-item">
            <div class="flex items-center" style="gap: 1rem;">
              <span class="passenger-number">${i + 1}</span>
              <div class="passenger-info">
                <div class="flex items-baseline" style="gap: 0.5rem;">
                  <span class="passenger-name">${escapeHtml(p.nombre)}${statusIcon}</span>
                  ${p.universidad ? `<span class="text-[10px] text-gray-500 font-medium">| ${escapeHtml(p.universidad)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="passenger-time" style="margin-left: auto; font-weight: 700; color: #3b82f6;">
              ${formatTime(p.createdAt)}
            </div>
          </div>
 `;
 });
 
 html += '</div>';
 
 if (espera.length > 0) {
 html += `
 <div class="waiting-list">
 <h3 class="waiting-title"> Lista de Espera</h3>
 <div class="passenger-list">
 `;
 
 espera.forEach((p, i) => {
 html += `
 <div class="passenger-item waiting-item">
 <div class="flex items-center" style="gap: 1rem;">
 <span class="passenger-number">${i + 1}</span>
          <div class="passenger-info">
            <div class="flex items-baseline gap-2">
              <span class="passenger-name">${escapeHtml(p.nombre)}</span>
              <span class="waiting-badge">En espera</span>
            </div>
            ${p.universidad ? `<span class="text-[10px] text-gray-500 font-medium">| ${escapeHtml(p.universidad)}</span>` : ''}
          </div>
        </div>
        <div class="passenger-time">
          <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          <span>${formatTime(p.createdAt)}</span>
        </div>
      </div>
 `;
 });
 
 html += '</div></div>';
 }
 
 card.innerHTML = html;
 container.appendChild(card);
 });
 }

 // Fin de funciones de desarrollo

 
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
// PGINA ADMIN
// ============================================
function initAdminPage() {
 const adminPanel = document.getElementById('adminPanel');
 
 if (!currentUser || (!currentUser.rol.includes('admin') && !currentUser.rol.includes('desarrolladora'))) {
 window.location.href = 'index.html';
 return;
 }
 
 if (adminPanel) adminPanel.classList.remove('hidden');

 // Mostrar herramientas de desarrolladora si aplica (Solo Gabriela)
 const devTools = document.getElementById('devToolsSection');
 if (devTools && currentUser && currentUser.rol.includes('desarrolladora')) {
 devTools.classList.remove('hidden');
 }
 
 loadAdminData();
 loadVoluntariosMng();
 initCreateStaff();
 
 function initCreateStaff() {
 const form = document.getElementById('createStaffForm');
 const status = document.getElementById('staffStatus');
 if (!form) return;

 form.addEventListener('submit', async (e) => {
 e.preventDefault();
 status.classList.remove('hidden');
 status.textContent = 'Procesando...';
 status.className = 'text-center text-sm mt-2 text-blue-400';

 const matricula = document.getElementById('staffMatricula').value.trim();
 const nombre = document.getElementById('staffNombre').value.trim();
 const telefono = document.getElementById('staffTelefono').value.trim();
 const emailInput = document.getElementById('staffEmail').value.trim();
 const password = document.getElementById('staffPassword').value;
 const rol = document.getElementById('staffRol').value;

 // Generar email pseudo si no hay uno real
 const email = emailInput || `${matricula}@aeudj.com`;

 try {
 // Crear cliente aislado para no cerrar la sesin del admin
 const tempClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
 auth: { persistSession: false }
 });

 const { data: authData, error: authErr } = await tempClient.auth.signUp({
 email,
 password,
 options: {
 data: { nombre, matricula, telefono, rol, universidad: 'AEUDJ' }
 }
 });

 if (authErr) throw authErr;

 // Crear/Actualizar perfil
 const { error: profErr } = await supabase.from('profiles').insert([{
 id: authData.user.id,
 nombre,
 matricula,
 telefono,
 email,
 rol,
 universidad: 'AEUDJ'
 }]);

 if (profErr) {
 // Si fall el perfil pero la cuenta se cre, al menos avisamos
 console.error('Error perfil:', profErr);
 }

 status.textContent = ' Usuario creado exitosamente.';
 status.className = 'text-center text-sm mt-2 text-green-400';
 form.reset();
 loadVoluntariosMng(); // Recargar lista
 } catch (err) {
 console.error(err);
 status.textContent = ' Error: ' + err.message;
 status.className = 'text-center text-sm mt-2 text-red-400';
 }
 });
 }
 
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
 <th class="p-2 border" style="border-color:#cbd5e1;">Accin</th>
 </tr></thead><tbody>`;
 
 users.forEach(u => {
 const rol = u.rol || '';
 if (rol.includes('admin')) return;
 
 const isVoluntario = rol.includes('voluntario') || rol.includes('comité');
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
 
  // --- LÓGICA DE CONTROL DE SESIÓN (FORZADO) ---
  window.initAdminPage = function() {
    initSessionToggle(); // Inicializar el interruptor
    loadAdminData();
    refreshIcons();
  };
  
  window.initSessionToggle = function() {
    const toggle = document.getElementById('sessionOverrideToggle');
    if (!toggle) return;

    // Cargar estado inicial
    const override = localStorage.getItem('aeudj_session_override');
    toggle.checked = (override === 'tarde');
    updateSessionUI(toggle.checked);

    toggle.addEventListener('change', (e) => {
      const isTarde = e.target.checked;
      localStorage.setItem('aeudj_session_override', isTarde ? 'tarde' : 'manana');
      updateSessionUI(isTarde);
      showAdminToast(`Sesión forzada a: ${isTarde ? 'Vespertina' : 'Matutina'}`, 'info');
    });
  };

  function updateSessionUI(isTarde) {
    const display = document.getElementById('sessionDisplay');
    const status = document.getElementById('sessionStatusText');
    if (display) display.innerHTML = isTarde ? '🌙 Vespertina' : '☀️ Matutina';
    if (status) status.innerHTML = 'MODO MANUAL (FORZADO)';
  }

  window.clearTodayVotes = async function() {
    return; // Función anulada temporalmente

    if (!confirm('¿Estás seguro de borrar TODOS los votos de hoy? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('votos').delete().eq('fecha', cycleDate);
      if (error) throw error;
      alert('Datos de hoy eliminados correctamente.');
      loadAdminData();
    } catch(e) {
      console.error(e);
      alert('Error al limpiar datos.');
    }
  };

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
 
 // Estadsticas para el Dashboard
 const stats = {
 totalPasajeros: 0,
 enEspera: 0,
 ingresosReales: 0,
 ingresosEstimados: 0,
 cuposTotales: transportSchedules.length * 30,
 porHorario: {}
 };

 // Inicializar porHorario con 0
 transportSchedules.forEach(s => {
 stats.porHorario[s.fullText] = { 
 count: 0, 
 precio: getPrecio(s.fullText),
 confirmados: [],
 enEspera: []
 };
 });

 votos.forEach(voto => {
 const precio = getPrecio(voto.horario);
 const horData = stats.porHorario[voto.horario];
 
 if (!horData) return; // Por si acaso hay un horario hurfano

 if (voto.en_espera) {
 horData.enEspera.push(voto);
 stats.enEspera++;
 } else {
 horData.confirmados.push(voto);
 horData.count++;
 stats.totalPasajeros++;
 
 // Contabilidad
 stats.ingresosEstimados += precio;
 if (voto.se_monto === 1) {
 stats.ingresosReales += precio;
 }
 }
 });
 
 renderDashboard(stats);
 renderAdminList(stats.porHorario);
 
 } catch (error) {
 console.error('Error:', error);
 container.innerHTML = '<p class="text-center text-gray-600">Error al cargar datos.</p>';
 }
 }

 function getPrecio(horarioText) {
 // Regla: 1, 2, 5, 6, 8, 10 PM -> 125. Otros -> 100.
 const h = horarioText.toLowerCase();
 if (h.includes('1:00 pm') || h.includes('2:15 pm') || h.includes('5:00 pm') || h.includes('6:00 pm') || h.includes('8:00 pm') || h.includes('10:00 pm')) {
 return 125;
 }
 return 100;
 }

 let occupancyChartInstance = null;

 function renderDashboard(stats) {
 const dashboard = document.getElementById('adminDashboard');
 if (!dashboard) return;
 dashboard.classList.remove('hidden');

 // Actualizar Tarjetas
 document.getElementById('statTotalPasajeros').textContent = stats.totalPasajeros;
 document.getElementById('statEsperaPasajeros').textContent = `${stats.enEspera} en lista de espera`;
 document.getElementById('statIngresosReales').textContent = `RD$ ${stats.ingresosReales.toLocaleString()}`;
 document.getElementById('statIngresosEstimados').textContent = `Estimado: RD$ ${stats.ingresosEstimados.toLocaleString()}`;
 
 // Nueva tarjeta de lista de espera total
 const statWaitlist = document.getElementById('statWaitlistTotal');
 if (statWaitlist) statWaitlist.textContent = stats.enEspera;

 currentAdminStats = stats; // Guardar para el modal

 // Preparar datos para el grfico
 const labels = transportSchedules.map(s => s.time);
 const dataOcupacion = transportSchedules.map(s => stats.porHorario[s.fullText].count);
 const backgroundColors = dataOcupacion.map(count => {
 if (count >= 28) return 'rgba(239, 68, 68, 0.7)'; // Peligro (Rojo)
 if (count >= 20) return 'rgba(245, 158, 11, 0.7)'; // Medio (Naranja)
 return 'rgba(59, 130, 246, 0.7)'; // Bajo (Azul)
 });

 const ctx = document.getElementById('occupancyChart').getContext('2d');
 
 if (occupancyChartInstance) {
 occupancyChartInstance.destroy();
 }

 occupancyChartInstance = new Chart(ctx, {
 type: 'bar',
 data: {
 labels: labels,
 datasets: [{
 label: 'Estudiantes',
 data: dataOcupacion,
 backgroundColor: backgroundColors,
 borderRadius: 8,
 borderWidth: 0
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: { display: false },
 tooltip: {
 callbacks: {
 footer: (items) => {
 const label = items[0].label;
 const schedule = transportSchedules.find(s => s.time === label);
 if (schedule) {
 const sData = stats.porHorario[schedule.fullText];
 return `Precio: RD$ ${sData.precio}\nTotal: RD$ ${(sData.count * sData.precio).toLocaleString()}`;
 }
 }
 }
 }
 },
 scales: {
 y: {
 beginAtZero: true,
 max: 35,
 grid: { color: 'rgba(255,255,255,0.05)' },
 ticks: { color: '#94a3b8' }
 },
 x: {
 grid: { display: false },
 ticks: { color: '#94a3b8' }
 }
 }
 }
 });
 }

 function renderAdminList(porHorario) {
 const container = document.getElementById('adminContainer');
 if (!container) return;
 
 container.innerHTML = '';
 container.className = 'admin-passenger-grid';
 
 const horarios = Object.keys(porHorario).sort((a, b) => {
 return horarioAMinutos(a) - horarioAMinutos(b);
 });
 
 if (horarios.length === 0) {
 container.innerHTML = '<p class="text-center text-gray-600 w-full col-span-full">No hay votos hoy.</p>';
 return;
 }
 
 horarios.forEach(horario => {
 const data = porHorario[horario];
 if (data.confirmados.length === 0 && data.enEspera.length === 0) return;

 const card = document.createElement('div');
 card.className = 'card-horario-compact';
 
 const recaudado = data.confirmados.filter(p => p.se_monto === 1).length * data.precio;

 let html = `
 <div class="horario-header">
 <h2 class="text-xl font-bold text-blue-400 mb-1"> Pasajeros ${horario}</h2>
 <p class="text-xs text-slate-400 font-medium uppercase tracking-wider">
 ${data.confirmados.length} Confirmados | <span class="text-emerald-400">RD$ ${recaudado.toLocaleString()}</span>
 </p>
 </div>
 <div class="compact-passenger-list custom-scroll">
 `;
 
 // Lista de confirmados
 data.confirmados.forEach(p => {
 html += renderAdminItem(p, false, true);
 });
 
 // Lista de espera para este horario
 if (data.enEspera.length > 0) {
 html += `<div class="waitlist-divider">Lista de Espera (${data.enEspera.length})</div>`;
 data.enEspera.forEach(p => {
 html += renderAdminItem(p, true, true);
 });
 }
 
 html += '</div>';
 card.innerHTML = html;
 container.appendChild(card);
 });
 }
 
 function renderAdminItem(p, isEspera = false, isCompact = false) {
 if (isCompact) {
 // Versión compacta para la cuadrícula
 const statusClass = p.se_monto === 1 ? 'border-emerald-500/30' : (p.se_monto === 0 ? 'border-rose-500/30' : '');
 const bgClass = p.se_monto === 1 ? 'bg-emerald-500/10' : (p.se_monto === 0 ? 'bg-rose-500/10' : 'bg-slate-800/40');
 
 let actions = '';
 if (!isEspera && p.se_monto === null) {
 actions = `
 <div class="flex gap-1">
 <button onclick="marcarVoto(${p.id}, 1)" class="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-md transition-colors" title="S subi">
 <span style="font-size:0.8rem;"></span>
 </button>
 <button onclick="marcarVoto(${p.id}, 0)" class="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 rounded-md transition-colors" title="No subi">
 <span style="font-size:0.8rem;"></span>
 </button>
 </div>
 `;
 } else if (p.se_monto !== null) {
 actions = `<span class="text-xs font-bold uppercase ${p.se_monto === 1 ? 'text-emerald-400' : 'text-rose-400'}">${p.se_monto === 1 ? 'SUBI' : 'NO SUBI'}</span>`;
 }

 return `
 <div class="compact-passenger-item border ${statusClass} ${bgClass}">
 <div class="flex flex-col flex-1 min-w-0 pr-2">
 <span class="compact-name truncate">${escapeHtml(p.nombre)}</span>
 <span class="compact-meta truncate">${escapeHtml(p.universidad || 'S/U')} ${escapeHtml(p.matricula)}</span>
 </div>
 <div class="flex items-center shrink-0">
 ${actions}
 </div>
 </div>
 `;
 }

 // Versión original (fallback o para listas largas si se requiere)
 let statusHtml = '';
 if (p.se_monto === null) {
 statusHtml = `
 <div class="action-btns">
 <button onclick="marcarVoto(${p.id}, 1)" class="btn btn-success btn-small">Confirmar</button>
 <button onclick="marcarVoto(${p.id}, 0)" class="btn btn-danger btn-small">No subi</button>
 </div>
 `;
 } else if (p.se_monto === 2) {
 statusHtml = `
 <div class="action-btns">
 <span class="status-badge status-warning"> Lleg tarde (Subi)</span>
 <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Marcar puntual</button>
 <button onclick="marcarVoto('${p.id}', 0)" class="btn btn-danger btn-small">No subi</button>
 </div>
 `;
 } else {
 statusHtml = `
 <div class="action-btns">
 <span class="status-badge status-danger"> No subi</span>
 <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Subi</button>
 <button onclick="marcarVoto('${p.id}', 2)" class="btn btn-warning btn-small">Lleg tarde</button>
 </div>
 `;
 }
 
 return `
 <div class="passenger-item ${isEspera ? 'waiting-item' : ''}">
 <div class="flex items-center" style="gap: 1rem;">
 <span class="passenger-number" style="${isEspera ? 'background: #f59e0b;' : ''}"></span>
 <div class="passenger-info">
 <p class="passenger-name">${escapeHtml(p.nombre)}
 ${isEspera ? '<span class="waiting-badge">En espera</span>' : ''}
 </p>
 <p class="passenger-meta">${p.matricula} ${p.telefono || 'N/A'} ${p.email || 'N/A'}</p>
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
 // Obtener datos del voto que se cancel
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
 if (!currentUser || (!currentUser.rol.includes('admin') && !currentUser.rol.includes('desarrolladora') && !currentUser.rol.includes('comité'))) {
 window.location.href = 'index.html';
 return;
 }

 const container = document.getElementById('voluntarioContainer');
 const horariosText = document.getElementById('horariosAsignadosText');
 const cycleDate = getCycleDate();
 
  const misHorarios = (currentUser.rol.includes('admin') || currentUser.rol.includes('desarrolladora') || currentUser.rol.includes('comité')) ? transportSchedules.map(s => s.fullText) : (currentUser.horarios_asignados || []);
 
 if (misHorarios.length === 0) {
 if(horariosText) horariosText.textContent = "No tienes ningún horario asignado.";
 if(container) container.innerHTML = '<p class="text-center text-gray-600 mt-4">Contacta al administrador para que te asigne una ruta.</p>';
 return;
 }
 
 if(horariosText) horariosText.textContent = `Tus horarios asignados: ${misHorarios.join(', ')}`;
 
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
 
 if (!container) return;
 container.innerHTML = '';
 container.className = 'admin-passenger-grid'; // Reutilizar la cuadrcula del admin
 
 const listadoPorHorario = {};
 votos.forEach(v => {
 if (!listadoPorHorario[v.horario]) {
 listadoPorHorario[v.horario] = { confirmados: [], enEspera: [], precio: getPrecio(v.horario) };
 }
 if (v.en_espera) listadoPorHorario[v.horario].enEspera.push(v);
 else listadoPorHorario[v.horario].confirmados.push(v);
 });

  const horariosActivos = misHorarios.filter(h => isHorarioActivo(h, currentUser.rol.includes('admin') || currentUser.rol.includes('comité')));

 if (horariosActivos.length === 0) {
 container.innerHTML = `
 <div class="col-span-full text-center p-8 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
 <p class="text-xl text-slate-300 font-medium mb-2">Aún no es hora de pasar lista.</p>
 <p class="text-slate-500 text-sm">Las listas aparecen automáticamente 10 minutos antes de la hora de salida.</p>
 </div>
 `;
 return;
 }

 // Filtrar los horarios que ya están 100% completados
 const horariosPendientes = horariosActivos.filter(horario => {
   const data = listadoPorHorario[horario];
   if (!data || data.confirmados.length === 0) return true; // Mostrar si está vacío para que vean que no hay nadie
   const completado = data.confirmados.every(p => p.se_monto !== null);
   return !completado;
 });

 if (horariosPendientes.length === 0) {
   container.innerHTML = `
   <div class="col-span-full text-center p-10 bg-emerald-900/20 rounded-3xl border border-emerald-500/20">
     <div class="w-20 h-20 mx-auto bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-5 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
       <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
     </div>
     <p class="text-2xl text-emerald-400 font-bold mb-2">¡Excelente trabajo!</p>
     <p class="text-emerald-500/70 text-sm max-w-md mx-auto">Has completado el pase de lista para todos tus viajes activos. Ya no quedan pasajeros pendientes de confirmación.</p>
   </div>
   `;
   return;
 }

 horariosPendientes.forEach(horario => {
 const data = listadoPorHorario[horario] || { confirmados: [], enEspera: [], precio: getPrecio(horario) };
 
 const card = document.createElement('div');
 card.className = 'card-horario-compact';
 
 const recaudado = data.confirmados.filter(p => p.se_monto === 1).length * data.precio;

 let html = `
 <div class="horario-header">
 <h2 class="text-xl font-bold text-blue-400 mb-1"> Pasajeros ${horario}</h2>
 <p class="text-xs text-slate-400 font-medium uppercase tracking-wider">
 ${data.confirmados.length} Estudiantes | <span class="text-emerald-400">RD$ ${recaudado.toLocaleString()}</span>
 </p>
 </div>
 <div class="compact-passenger-list custom-scroll">
 `;
 
 data.confirmados.forEach(p => {
 html += renderAdminItem(p, false, true); // Reutilizar item del admin
 });

 if (data.enEspera.length > 0) {
 html += `<div class="waitlist-divider">Lista de Espera (${data.enEspera.length})</div>`;
 data.enEspera.forEach(p => {
 html += renderAdminItem(p, true, true);
 });
 }
 
 html += '</div>';
 card.innerHTML = html;
 container.appendChild(card);
 });
 
 } catch (error) {
 console.error('Error:', error);
 if(container) container.innerHTML = '<p class="text-center text-gray-600">Error al cargar datos.</p>';
 }
 }

 // Sobrescribir marcarVoto para que funcione en el contexto de voluntario si es necesario
 // o simplemente usar marcarVoto global si ya est definido.
}

function horarioAMinutos(horarioStr) {
 if (!horarioStr) return 0;
 try {
 const mainPart = horarioStr.split(' ')[0]; // E.g., "1:00"
 const period = horarioStr.includes('PM') ? 'PM' : 'AM';
 let [horas, minutos] = mainPart.split(':').map(Number);
 
 if (period === 'PM' && horas !== 12) horas += 12;
 if (period === 'AM' && horas === 12) horas = 0;
 
 return horas * 60 + minutos;
 } catch(e) { return 0; }
}

function isHorarioActivo(horarioStr, ignoraTiempo = false) {
 if (ignoraTiempo) return true;
 
 const hMinutes = horarioAMinutos(horarioStr);
 const now = new Date();
 const currentMinutes = now.getHours() * 60 + now.getMinutes();

 // El horario se activa 10 minutos antes (ej: 12:50 para las 1:00)
 // Y se mantiene visible hasta 1 hora después (ej: 2:00)
 return (currentMinutes >= hMinutes - 10) && (currentMinutes <= hMinutes + 60);
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
  let userVotes = [];

  cargarDatos();
  
  async function cargarDatos() {
    try {
      container.innerHTML = '<div class="text-center py-10"><div class="spinner mx-auto mb-4"></div><p class="text-gray-400">Consultando tus horarios...</p></div>';
      
      const { data, error } = await supabase
        .from('votos')
        .select('*')
        .eq('usuario_id', currentUser.id)
        .eq('fecha', cycleDate);
      
      if (error) throw error;
      userVotes = data;
      
      if (!userVotes || userVotes.length === 0) {
        container.innerHTML = `
          <div class="glass-card card p-8 text-center">
            <i data-lucide="info" class="w-12 h-12 text-blue-400 mx-auto mb-4"></i>
            <h2 class="text-xl font-bold text-white mb-2">No tienes viajes registrados</h2>
            <p class="text-gray-400 mb-6">Parece que no tienes reservas para el ciclo de hoy.</p>
            <a href="votar.html" class="btn-premium btn-block">Ir a reservar</a>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      
      renderStep1();
      
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = '<p class="text-center text-red-400">Error al cargar datos. Intenta recargar la página.</p>';
    }
  }

  function renderStep1() {
    let title = '';
    let description = '';
    let icon = '';

    if (tipo === 'despues') {
      title = '¿Qué viaje quieres mover?';
      description = 'Selecciona el horario que deseas cambiar por uno posterior.';
      icon = 'clock';
    } else if (tipo === 'otros') {
      title = '¿Qué viaje quieres cancelar?';
      description = 'Selecciona los viajes que NO realizarás hoy por otros medios.';
      icon = 'car';
    } else {
      title = '¿Qué viaje quieres liberar?';
      description = 'Selecciona los viajes que ya realizaste o que deseas liberar.';
      icon = 'check-circle';
    }

    let html = `
      <div class="glass-card card p-8 animate-fade-in">
        <div class="text-center mb-8">
          <div class="p-4 bg-blue-500/10 rounded-full w-fit mx-auto mb-4">
            <i data-lucide="${icon}" class="w-8 h-8 text-blue-400"></i>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">${title}</h2>
          <p class="text-gray-400 text-sm">${description}</p>
        </div>

        <div class="space-y-3 mb-8">
    `;

    userVotes.forEach(v => {
      const isIda = v.horario.includes('Jarabacoa -> La Vega');
      html += `
        <div class="cambio-item p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-4" onclick="handleChoice('${v.id}')">
          <div class="p-2 rounded-lg ${isIda ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}">
            <i data-lucide="${isIda ? 'arrow-right' : 'arrow-left'}" class="w-5 h-5"></i>
          </div>
          <div class="flex-1">
            <p class="text-xs uppercase font-bold text-gray-500">${isIda ? 'Salida' : 'Regreso'}</p>
            <p class="text-lg font-bold text-white">${v.horario.split(' ')[0]} ${v.horario.split(' ')[1]}</p>
          </div>
          <i data-lucide="${tipo === 'despues' ? 'chevron-right' : 'trash-2'}" class="w-5 h-5 text-gray-400"></i>
        </div>
      `;
    });

    if (tipo === 'otros' || tipo === 'antes') {
      html += `
        <div class="cambio-item p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-all cursor-pointer flex items-center gap-4" onclick="handleAllChoice()">
          <div class="p-2 rounded-lg bg-rose-500/20 text-rose-400">
            <i data-lucide="x-circle" class="w-5 h-5"></i>
          </div>
          <div class="flex-1">
            <p class="text-xs uppercase font-bold text-gray-500">Global</p>
            <p class="text-lg font-bold text-white">Todos los viajes</p>
          </div>
          <i data-lucide="trash-2" class="w-5 h-5 text-rose-400"></i>
        </div>
      `;
    }

    html += `
        </div>
        <button onclick="window.location.href='votar.html'" class="btn-pill-outline btn-block text-gray-400">Cancelar</button>
      </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

    window.handleChoice = (id) => {
      const v = userVotes.find(x => String(x.id) === String(id));
      if (tipo === 'despues') {
        renderStep2(v);
      } else {
        ejecutarBorrado([id]);
      }
    };

    window.handleAllChoice = () => {
      const ids = userVotes.map(v => v.id);
      ejecutarBorrado(ids);
    };
  }

  function renderStep2(votoOriginal) {
    const horarioActual = votoOriginal.horario;
    const isIda = horarioActual.includes('Jarabacoa -> La Vega');
    const ruta = isIda ? 'Jarabacoa -> La Vega' : 'La Vega -> Jarabacoa';
    
    // Filtrar horarios posteriores
    const actualMinutes = horarioAMinutos(horarioActual);
    const disponibles = transportSchedules.filter(s => {
      if (!s.route.includes(ruta)) return false;
      return horarioAMinutos(s.fullText) > actualMinutes;
    });

    let html = `
      <div class="glass-card card p-8 animate-fade-in">
        <div class="text-center mb-8">
          <h2 class="text-2xl font-bold text-white mb-2">Nuevo Horario</h2>
          <p class="text-gray-400 text-sm">Cambiando: <span class="text-blue-400 font-bold">${horarioActual}</span></p>
        </div>

        <div class="space-y-3 mb-8">
    `;

    if (disponibles.length === 0) {
      html += `<p class="text-center text-orange-400 p-4 bg-orange-400/10 rounded-xl">No hay horarios posteriores disponibles hoy.</p>`;
    } else {
      disponibles.forEach(s => {
        html += `
          <div class="cambio-item p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all cursor-pointer flex items-center justify-between" onclick="confirmarNuevoHorario('${s.fullText}', '${votoOriginal.id}')">
            <div>
              <p class="text-lg font-bold text-white">${s.time}</p>
              <p class="text-xs text-gray-500">${s.route}</p>
            </div>
            <i data-lucide="check" class="w-5 h-5 text-green-400"></i>
          </div>
        `;
      });
    }

    html += `
        </div>
        <button onclick="renderStep1()" class="btn-pill-outline btn-block">Atrás</button>
      </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

    window.confirmarNuevoHorario = async (nuevoH, oldId) => {
      try {
        container.innerHTML = '<div class="text-center py-10"><div class="spinner mx-auto mb-4"></div><p class="text-gray-400">Actualizando tu reserva...</p></div>';
        
        // 1. Borrar el anterior
        const vOld = userVotes.find(x => String(x.id) === String(oldId));
        await supabase.from('votos').delete().eq('id', oldId);
        
        // 2. Liberar cupo
        if (window.promoverDeEspera) await window.promoverDeEspera(vOld.fecha, vOld.horario);
        
        // 3. Insertar el nuevo
        const { count } = await supabase.from('votos').select('*', { count: 'exact', head: true }).eq('horario', nuevoH).eq('fecha', cycleDate).eq('en_espera', false);
        const enEspera = count >= 30;

        await supabase.from('votos').insert([{
          usuario_id: currentUser.id,
          nombre: currentUser.nombre,
          universidad: currentUser.universidad,
          matricula: currentUser.matricula,
          telefono: currentUser.telefono || '',
          email: currentUser.email || '',
          horario: nuevoH,
          fecha: cycleDate,
          se_monto: null,
          en_espera: enEspera,
          created_at: new Date().toISOString()
        }]);

        window.location.href = 'gracias.html?cambio=1';
      } catch (e) {
        alert('Error al cambiar horario: ' + e.message);
        renderStep1();
      }
    };
  }

  async function ejecutarBorrado(ids) {
    if (!confirm('¿Estás seguro de cancelar estos viajes? Esto liberará tus cupos.')) return;
    
    try {
      container.innerHTML = '<div class="text-center py-10"><div class="spinner mx-auto mb-4"></div><p class="text-gray-400">Liberando asientos...</p></div>';
      
      for (const id of ids) {
        const v = userVotes.find(x => String(x.id) === String(id));
        await supabase.from('votos').delete().eq('id', id);
        if (window.promoverDeEspera) await window.promoverDeEspera(v.fecha, v.horario);
      }
      
      window.location.href = 'gracias.html?cambio=1';
    } catch (e) {
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
  const fechaEl = document.getElementById('fechaNoSubieron');
  if (fechaEl) fechaEl.textContent = formatDate(cycleDate);
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
        container.innerHTML = `<div class="text-center"><p class="text-green-700 text-lg">Todos subieron! </p></div>`;
        return;
      }
      
      let html = '<div class="card">';
      html += `<h3 class="text-lg font-bold text-red-700 mb-4">Total: ${personas.length} persona(s)</h3>`;
      
      personas.forEach(p => {
        html += `
        <div class="passenger-item" style="background: #fef2f2; border: 1px solid #fecaca; margin-bottom: 0.5rem; padding: 1rem; border-radius: 0.5rem;">
          <div style="flex: 1;">
            <p class="passenger-name" style="font-weight: 600;">${escapeHtml(p.nombre)}</p>
            <p class="passenger-meta"> ${p.telefono || 'N/A'} ${p.horario}</p>
          </div>
          <button data-id="${p.id}" class="btn btn-success btn-small btn-subi">Subi</button>
        </div>
        `;
      });
      
      html += '</div>';
      container.innerHTML = html;

      // Event Delegation
      if (!container.dataset.wired) {
        container.dataset.wired = "true";
        container.addEventListener('click', (e) => {
          if (e.target.classList.contains('btn-subi')) {
            window.marcarComoSubio(e.target.dataset.id);
          }
        });
      }
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
window.handleLogin = async function(userInput, pass) {
    try {
      let emailToAuth = userInput;
      if (!userInput.includes('@')) {
        emailToAuth = `${userInput}@aeudj.com`;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password: pass,
      });

      if (error) throw error;
      const user = data.user;
      return user;
    } catch (e) {
      throw e;
    }
};

window.notificarAccion = async function(tipo) {
 if (!currentUser || (!currentUser.rol.includes('admin') && !currentUser.rol.includes('desarrolladora'))) return;
 
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
 titulo: tipo === 'apertura' ? "Lista Abierta!" : (tipo === 'llegada' ? " El autobs ha llegado" : " El autobs est saliendo"),
 mensaje: "Mensaje de notificacin de transporte AEUDJ.",
 destinatarios: correos.join(',')
 };

 await emailjs.send('service_afofocu', 'template_ryyejnp', templateParams);
 console.log(`Enviado a ${correos.length} personas.`);
 btn.disabled = false;
 } catch(error) {
 console.error(error);
 alert("Error: " + error.message);
 }
};

window.promoverDeEspera = async function(fecha, horario) {
 try {
 const { data: esperaArr } = await supabase
 .from('votos')
 .select('*')
 .eq('fecha', fecha)
 .eq('horario', horario)
 .eq('en_espera', true)
 .order('created_at')
 .limit(1);
 
 if (esperaArr && esperaArr.length > 0) {
 await supabase
 .from('votos')
 .update({ en_espera: false })
 .eq('id', esperaArr[0].id);
 }
 } catch (err) {
 console.error('Error al promover lista espera:', err);
 }
};

// ============================================
// MODAL DE LISTA DE ESPERA
// ============================================
window.abrirModalEspera = function() {
 const modal = document.getElementById('modalEspera');
 const body = document.getElementById('modalEsperaBody');
 if (!modal || !body || !currentAdminStats) return;

 let html = '';
 const data = currentAdminStats.porHorario;
 
 const horarios = Object.keys(data).sort((a,b) => horarioAMinutos(a) - horarioAMinutos(b));
 let hayEsperaTotal = false;

 horarios.forEach(h => {
 const horData = data[h];
 if (horData.enEspera.length > 0) {
 hayEsperaTotal = true;
 html += `
 <div class="waitlist-modal-group">
 <div class="waitlist-modal-title">
 <span> ${h}</span>
 <span style="background:rgba(245, 158, 11, 0.2); color:#f59e0b; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem;">
 ${horData.enEspera.length} esperando
 </span>
 </div>
 <div class="space-y-2">
 `;
 
 horData.enEspera.forEach(p => {
 const horaRegistro = new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
 html += `
 <div class="waitlist-modal-item">
 <div>
 <div class="font-semibold text-slate-100">${escapeHtml(p.nombre)}</div>
 <div class="text-xs text-slate-400">${p.universidad || 'N/A'} ${p.matricula}</div>
 </div>
 <div class="text-right">
 <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Registrado</div>
 <div style="font-size: 0.8rem; font-weight: 600; color: #3b82f6;">${horaRegistro}</div>
 </div>
 </div>
 `;
 });
 
 html += `</div></div>`;
 }
 });

 if (!hayEsperaTotal) {
 html = `
 <div class="text-center py-10">
 <div class="text-5xl mb-4"></div>
 <p class="text-slate-300 font-medium">No hay nadie en espera en este momento.</p>
 <p class="text-slate-500 text-sm">Todos los estudiantes tienen cupo asegurado.</p>
 </div>
 `;
 }

 body.innerHTML = html;
 modal.classList.remove('hidden');
 document.body.style.overflow = 'hidden';
};

window.cerrarModalEspera = function() {
 const modal = document.getElementById('modalEspera');
 if (modal) modal.classList.add('hidden');
 document.body.style.overflow = '';
};


