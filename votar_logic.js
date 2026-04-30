import { supabase, transportSchedules, getCycleDate, formatDate } from './supabase-config.js?v=200';

alert('SISTEMA ACTIVADO âœ…');
console.log('ðŸš€ AEUDJ App Iniciada');

// Variables globales
let currentUser = null;
let isAdmin = false;
let selectedHorarios = [];
const cycleDate = getCycleDate(); // Definida globalmente para todas las funciones
let currentAdminStats = null; // Para compartir datos con el modal

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
// INICIALIZACIN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
 // Inicializar Iconos Lucide
 refreshIcons();

 // Verificar sesin con localStorage y verificar luego con Supabase Auth
 checkSession();
 
 const page = document.body.dataset.page;
 console.log('Pgina detectada:', page);
 
 // Escuchar cambios de autenticacin
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
 
 // Auto-promover a desarrolladora si es la matrcula de Gabriela
 if (currentUser.matricula === '20230105' && currentUser.rol !== 'desarrolladora') {
 currentUser.rol = 'desarrolladora';
 supabase.from('profiles').update({ rol: 'desarrolladora' }).eq('id', user.id).then();
 }
 
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
// GESTIN DE SESIN
// ============================================
function checkSession() {
  try {
    const userData = localStorage.getItem('aeudj_user');
    
    if (userData && userData !== 'undefined') {
      currentUser = JSON.parse(userData);
      // El rol se verifica desde el objeto de usuario recuperado de la DB
      if (currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'desarrolladora' || currentUser.rol === 'administrador')) {
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
// INICIALIZACIN DE PGINAS
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
// PGINA INDEX (LOGIN/REGISTRO)
// ============================================
function initIndexPage() {
 refreshIcons();
 if (currentUser) {
 window.location.href = 'votar.html';
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

 if (typeof initPasswordToggle === 'function') initPasswordToggle();
 
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
 
 const userInput = document.getElementById('userInput').value.trim().replace(/\s+/g, '');
 const pass = document.getElementById('passwordLogin').value.trim();
 
 const btn = loginForm.querySelector('button[type="submit"]');
 if (btn) {
 btn.disabled = true;
 btn.textContent = 'Verificando...';
 }

    try {
      const rawInput = userInput;
      const cleanInput = rawInput.replace(/[\s-]+/g, ''); // Sin espacios ni guiones
      let userData = null;
      let authEmail = null;

      console.log('Tentando login para:', rawInput, 'Clean:', cleanInput);

      if (rawInput.includes('@')) {
        authEmail = rawInput;
      } else {
        // 1. Buscar en perfiles (puede fallar por RLS)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .or(`matricula.eq.${rawInput},telefono.eq.${rawInput},matricula.eq.${cleanInput}`)
          .maybeSingle();

        if (profile) {
          userData = profile;
          authEmail = profile.email;
        } else {
          // 2. Fallback: Buscar en tabla pública de votos para recuperar el email
          const { data: lastVote } = await supabase
            .from('votos')
            .select('email')
            .or(`matricula.eq.${rawInput},matricula.eq.${cleanInput}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          authEmail = (lastVote && lastVote.email) ? lastVote.email : `${cleanInput}@aeudj.com`;
        }
      }

      // Intento A: Auth con email encontrado
      let authResult = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: pass
      });

      // Intento B: Si falló el A, probar el pseudo-email por si acaso
      const pseudo = `${cleanInput}@aeudj.com`;
      if (authResult.error && authEmail !== pseudo) {
        console.log('Fallo con email recuperado, probando pseudo-email...');
        const secondAuth = await supabase.auth.signInWithPassword({
          email: pseudo,
          password: pass
        });
        if (!secondAuth.error) authResult = secondAuth;
      }

      if (authResult.error) {
        console.error('Auth error:', authResult.error);
        if (authResult.error.message.includes('Invalid login credentials')) {
          throw new Error('La matrícula o contraseña son incorrectas.');
        }
        throw authResult.error;
      }
      
      const user = authResult.data.user;
      
      if (!userData) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        userData = p;
      }

      if (userData) {
 // Auto-promover a administradora/desarrolladora (ejemplo del cdigo original)
 if (userData.matricula === '0000' && userData.rol !== 'administrador') {
 userData.rol = 'administrador';
 await supabase.from('profiles').update({ rol: 'administrador' }).eq('id', user.id);
 }
 
 if (userData.matricula === '20230105' && userData.rol !== 'desarrolladora') {
 userData.rol = 'desarrolladora';
 // Actualizacin silenciosa (si el RLS lo bloquea, an retendr el rol en su sesin actual)
 supabase.from('profiles').update({ rol: 'desarrolladora' }).eq('id', user.id).then();
 }
 
 setSession(userData);
 window.location.href = 'votar.html';
 } else {
 showError('Credenciales correctas, pero no se encontraron datos de usuario en la base de datos.');
 }
 
 } catch (error) {
 console.error('Error:', error);
 showError('Error al iniciar sesin. Verifica tu matrcula o contrasea.');
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
 showError('Matrcula muy corta.');
 return;
 }
 
 if (pass.length < 6) {
 showError('La contrasea debe tener al menos 6 caracteres.');
 return;
 }
 
 if (!validateEmail(email)) {
 showError('Correo invlido.');
 return;
 }
 
 const btn = registerForm.querySelector('button[type="submit"]');
 btn.disabled = true;
 btn.textContent = 'Registrando...';

 try {
 // Verificar si la matrcula ya existe
 const { data: existingUser } = await supabase
 .from('profiles')
 .select('id')
 .eq('matricula', matricula)
 .maybeSingle();
 
 if (existingUser) {
 showError('Esta matrcula ya est registrada. Usa "Iniciar sesin".');
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
 rol: matricula === '0000' ? 'administrador' : (matricula === '20230105' ? 'desarrolladora' : 'estudiante')
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
}


// ============================================
// PGINA VOTAR
// ============================================
function initVotarPage() {
 if (!currentUser) {
 window.location.href = 'index.html';
 return;
 }
 
 const staffMenu = document.getElementById('staffMenu');
 if (staffMenu && currentUser) {
 staffMenu.innerHTML = ''; // Limpiar para evitar duplicados en recargas de SPA
    if (currentUser.rol === 'administrador' || currentUser.rol === 'desarrolladora') {
      staffMenu.innerHTML += `<a href="admin.html" class="btn-admin-entry"> Entrar al Panel de Administración</a>`;
      staffMenu.classList.remove('hidden');
    }
    if (currentUser.rol === 'voluntario' || currentUser.rol === 'desarrolladora') {
      staffMenu.innerHTML += `<a href="voluntario.html" class="btn-voluntario-entry"> Entrar al Panel de Voluntario</a>`;
      staffMenu.classList.remove('hidden');
    }
 }
 
 const cycleDate = getCycleDate();
 const horarioForm = document.getElementById('horarioForm');
 const scheduleGrid = document.getElementById('scheduleGrid');
 const statusMsg = document.getElementById('status-message');
 let isEditing = false;
 let initialVotes = []; // Guardar para no borrar lo que no cambia
 
 checkYaVotado();
 
 async function checkYaVotado() {
 try {
 const { data: snapshot, error } = await supabase
 .from('votos')
 .select('*')
 .eq('usuario_id', currentUser.id)
 .eq('fecha', cycleDate);
 
 if (snapshot && snapshot.length > 0) {
 isEditing = true;
 initialVotes = snapshot;
 selectedHorarios = snapshot.map(v => v.horario);
 const submitBtn = horarioForm.querySelector('button[type="submit"]');
 if (submitBtn) submitBtn.textContent = 'Actualizar Seleccin';
 
 const msg = document.createElement('p');
 msg.className = 'text-center text-sm text-gray-400 mt-4';
 msg.innerHTML = ` Tienes ${initialVotes.length} horarios registrados. Puedes cambiarlos si deseas.`;
 const statusMsgEl = document.getElementById('status-message');
 if (statusMsgEl) statusMsgEl.parentNode.insertBefore(msg, statusMsgEl);
 else horarioForm.appendChild(msg);
 }
 
 renderHorarios();
 
 } catch (error) {
 console.error('Error al verificar voto:', error);
 statusMsg.textContent = 'Error al cargar. Intenta recargar la pgina.';
 statusMsg.className = 'text-center text-sm font-medium text-red-600 mt-4';
 renderHorarios();
 }
 }
 
 function renderHorarios() {
 scheduleGrid.innerHTML = '';
 
 // Nueva lgica de visibilidad por grupos
 const ahora = new Date();
 const hora = ahora.getHours();
 
 // Grupo Maana: 10 PM a 9:59 AM
 // Grupo Tarde: 10 AM a 9:59 PM
 const currentGroup = (hora >= 22 || hora < 10) ? 'maana' : 'tarde';
 
 const visibleSchedules = transportSchedules.filter(s => s.group === currentGroup);
 
 visibleSchedules.forEach(schedule => {
 const direction = schedule.route.includes('Jarabacoa La Vega') ? 'ida' : 'vuelta';
 const icon = direction === 'ida' ? '' : '';
 const isSelected = selectedHorarios.includes(schedule.fullText);
 
 const slot = document.createElement('div');
 slot.className = `time-slot ${isSelected ? 'selected' : ''}`;
 slot.dataset.direction = direction;
 slot.dataset.fulltext = schedule.fullText;
 slot.innerHTML = `
 <div class="time-icon">${icon}</div>
 <div class="time-text">${schedule.time}</div>
 <div class="time-route">${schedule.route}</div>
 <div class="checkmark ${isSelected ? '' : 'hidden'}"></div>
 `;
 
 slot.addEventListener('click', () => toggleSlot(slot, schedule.fullText, direction));
 scheduleGrid.appendChild(slot);
 });
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
      // LLAMADA A LA EDGE FUNCTION (Lógica protegida)
      const { data, error } = await supabase.functions.invoke('registrar-voto', {
        body: { 
          horarios: selectedHorarios,
          fecha: cycleDate 
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      console.log('Voto registrado vía servidor:', data);
      window.location.href = 'gracias.html?v=324';
      
    } catch (error) {
      console.error('ERROR AL VOTAR:', error);
      alert('Error en el servidor: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Confirmar Selección';
    }
  });
}
