import { supabase, transportSchedules, getCycleDate, formatDate, SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

alert('SISTEMA ACTIVADO ✅');
console.log('🚀 AEUDJ App Iniciada');

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
 const adminData = localStorage.getItem('aeudj_admin_session');
 
 if (userData && userData !== 'undefined') {
 currentUser = JSON.parse(userData);
 }
 
 if (adminData === 'true') {
 isAdmin = true;
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
 let matriculaLogin = userInput;

 let userDataLocal = null;
 
 // Buscar por matrcula o telfono
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
 staffMenu.innerHTML += `<a href="admin.html" class="btn p-3 mb-2" style="background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #c4b5fd; text-shadow: 0 0 10px rgba(196,181,253,0.5); box-shadow: 0 0 15px rgba(139, 92, 246, 0.15); display: inline-block; width: 100%; border-radius: 12px; font-weight: bold; margin-bottom: 0.75rem;"> Entrar al Panel de Administracin</a>`;
 staffMenu.classList.remove('hidden');
 }
 if (currentUser.rol === 'voluntario' || currentUser.rol === 'desarrolladora') {
 staffMenu.innerHTML += `<a href="voluntario.html" class="btn p-3" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; text-shadow: 0 0 10px rgba(110,231,183,0.5); box-shadow: 0 0 15px rgba(16, 185, 129, 0.15); display: inline-block; width: 100%; border-radius: 12px; font-weight: bold;"> Entrar al Panel de Voluntario</a>`;
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
 
 // Si ya estaba seleccionado, simplemente queramos apagarlo, as que salimos.
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
 
 if (selectedHorarios.length !== 2) {
 alert('Debes seleccionar exactamente 2 horarios: uno de ida y uno de vuelta.');
 return;
 }
 
 const btn = horarioForm.querySelector('button[type="submit"]');
 btn.disabled = true;
 btn.textContent = 'Guardando...';
 
 try {
 // 1. Identificar qu cambi
 const currentHorarios = selectedHorarios;
 const hViejos = initialVotes.map(v => v.horario);
 
 const toDeleteIds = initialVotes.filter(v => !currentHorarios.includes(v.horario)).map(v => v.id);
 const toInsertHorarios = currentHorarios.filter(h => !hViejos.includes(h));

 // 2. Borrar SOLO los horarios que el usuario ya NO quiere
 if (toDeleteIds.length > 0) {
 const { error: delErrFull } = await supabase.from('votos').delete().in('id', toDeleteIds);
 if (delErrFull) {
 console.error("Error al borrar:", delErrFull);
 throw new Error('Fallo al borrar horarios anteriores: ' + delErrFull.message);
 }
 
 const horariosEliminados = initialVotes.filter(v => toDeleteIds.includes(v.id));
 for (const v of horariosEliminados) {
 if (window.promoverDeEspera) {
 await window.promoverDeEspera(v.fecha, v.horario);
 }
 }
 }

 // 3. Insertar SOLO los nuevos horarios (calculando lista de espera)
 if (toInsertHorarios.length > 0) {
 const dataToInsert = [];
 
 for (const hor of toInsertHorarios) {
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
 en_espera: enEspera,
 created_at: new Date().toISOString()
 });
 }
 
 const { error: insErr } = await supabase.from('votos').insert(dataToInsert);
 if (insErr) throw insErr;
 }
 
 window.location.href = 'gracias.html';
 
 } catch (error) {
 console.error('ERROR:', error);
 alert('Error al guardar: ' + error.message);
 btn.disabled = false;
 btn.textContent = 'Confirmar Seleccin';
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
// PGINA LISTA
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
 if (p.seMonto === 1) statusIcon = ' ';
 else if (p.seMonto === 2) statusIcon = ' ';
 else if (p.seMonto === 0) statusIcon = ' ';
 
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
 <h3 class="waiting-title"> Lista de Espera</h3>
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
 
 if (!currentUser || (currentUser.rol !== 'administrador' && currentUser.rol !== 'desarrolladora')) {
 window.location.href = 'index.html';
 return;
 }
 
 if (adminPanel) adminPanel.classList.remove('hidden');

 // Mostrar herramientas de desarrolladora si aplica (Solo Gabriela)
 const devTools = document.getElementById('devToolsSection');
 if (devTools && currentUser && currentUser.rol === 'desarrolladora') {
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
 // Versin compacta para la cuadrcula
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

 // Versin original (fallback o para listas largas si se requiere)
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
// PGINA VOLUNTARIO
// ============================================
function initVoluntarioPage() {
 if (!currentUser || (currentUser.rol !== 'voluntario' && currentUser.rol !== 'desarrolladora')) {
 window.location.href = 'index.html';
 return;
 }

 const container = document.getElementById('voluntarioContainer');
 const horariosText = document.getElementById('horariosAsignadosText');
 const cycleDate = getCycleDate();
 
 const misHorarios = currentUser.rol === 'desarrolladora' ? transportSchedules.map(s => s.fullText) : (currentUser.horarios_asignados || []);
 
 if (misHorarios.length === 0) {
 if(horariosText) horariosText.textContent = "No tienes ningn horario asignado.";
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

 const horariosActivos = misHorarios.filter(h => isHorarioActivo(h, currentUser.rol === 'desarrolladora'));

 if (horariosActivos.length === 0) {
 container.innerHTML = `
 <div class="col-span-full text-center p-8 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
 <p class="text-xl text-slate-300 font-medium mb-2">An no es hora de pasar lista.</p>
 <p class="text-slate-500 text-sm">Las listas aparecen automticamente 10 minutos antes de la hora de salida.</p>
 </div>
 `;
 return;
 }

 horariosActivos.forEach(horario => {
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
 // Y se mantiene visible hasta 1 hora despus (ej: 2:00)
 return (currentMinutes >= hMinutes - 10) && (currentMinutes <= hMinutes + 60);
}

}

// ============================================
// PGINA CAMBIOS
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
 container.innerHTML = '<div class="card p-6 text-center"><p class="mb-4">No tienes votos registrados para hoy.</p><a href="lista.html" class="btn btn-gray">Volver</a></div>';
 return;
 }
 
 if (votos.length > 1) {
 // Mostrar seleccin de cul voto quiere cambiar
 let html = `
 <div class="card p-6">
 <h2 class="text-xl font-bold mb-4 text-center">Qu viaje deseas cambiar?</h2>
 <div class="space-y-3">
 `;
 
 votos.forEach(v => {
 html += `
 <button onclick="seleccionarVotoParaCambio('${v.id}')" class="btn btn-primary btn-block text-left" style="height: auto; padding: 1rem;">
 <span class="block font-bold">${v.horario}</span>
 </button>
 `;
 });
 
 html += `
 </div>
 <button onclick="window.location.href='lista.html'" class="btn btn-gray btn-block mt-4">Cancelar</button>
 </div>
 `;
 container.innerHTML = html;
 
 window.seleccionarVotoParaCambio = (id) => {
 const v = votos.find(x => String(x.id) === String(id));
 procesarCambioParaVoto(v);
 };
 } else {
 procesarCambioParaVoto(votos[0]);
 }
 
 } catch (error) {
 console.error('Error:', error);
 container.innerHTML = '<p class="text-center text-red-600">Error: ' + error.message + '</p>';
 }
 }

 async function procesarCambioParaVoto(voto) {
 if (tipo === 'otros' || tipo === 'antes') {
 try {
 container.innerHTML = '<div class="text-center"><p>Procesando cancelacin...</p></div>';
 const { error: delErr } = await supabase.from('votos').delete().eq('id', voto.id);
 if (delErr) throw delErr;
 
 if (window.promoverDeEspera) {
 await window.promoverDeEspera(voto.fecha, voto.horario);
 }
 
 await supabase.from('cambios_audit').insert({
 usuario_id: currentUser.id,
 matricula: currentUser.matricula,
 tipo: tipo,
 horario_anterior: voto.horario,
 fecha: cycleDate
 });
 window.location.href = 'gracias.html?cambio=1';
 } catch (e) {
 alert('Error: ' + e.message);
 cargarDatos();
 }
 return;
 }
 
 mostrarSelector(tipo, voto);
 }
 
 function mostrarSelector(tipo, voto) {
 const horarioActual = voto.horario;
 const parseHorario = (h) => {
 const match = h.match(/(\d+):(\d+)\s*(AM|PM)/i);
 if (!match) return 0;
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
 
 // IMPORTANTE: Filtrar solo horarios de la MISMA RUTA (ida o vuelta)
 const isIda = horarioActual.includes('Jarabacoa La Vega');
 const ruta = isIda ? 'Jarabacoa La Vega' : 'La Vega Jarabacoa';

 const disponibles = [];
 
 transportSchedules.forEach(s => {
 if (!s.route.includes(ruta)) return;
 const min = parseHorario(s.fullText);
 
 // Regla de negocio: "Me ir despus" => todos los posteriores
 if (tipo === 'despues') {
 if (min > minutosActual) disponibles.push(s.fullText);
 }
 });
 
 let html = `
 <div class="card p-6">
 <h2 class="text-xl font-bold mb-4 text-center">Cambio a horario ${tipo === 'antes' ? 'anterior' : 'posterior'}</h2>
 <p class="text-center text-gray-400 mb-4">Actual: <span class="text-blue-400 font-bold">${horarioActual}</span></p>
 `;
 
 if (disponibles.length === 0) {
 html += `
 <p class="text-center text-orange-400 mb-4">No hay horarios ${tipo === 'antes' ? 'anteriores' : 'posteriores'} disponibles.</p>
 <button onclick="window.location.href='lista.html'" class="btn btn-gray btn-block">Volver</button>
 `;
 } else {
 html += `
 <select id="nuevoHorario" class="form-select mb-4">
 <option value="">-- Selecciona nuevo horario --</option>
 ${disponibles.map(h => `<option value="${h}">${h}</option>`).join('')}
 </select>
 <button id="btnGuardarCambio" class="btn btn-primary btn-block mb-3">Guardar Cambio</button>
 <button onclick="window.location.href='lista.html'" class="btn btn-gray btn-block">Cancelar</button>
 `;
 }
 
 html += '</div>';
 container.innerHTML = html;
 
 if (disponibles.length > 0) {
 document.getElementById('btnGuardarCambio').addEventListener('click', async () => {
 const nuevo = document.getElementById('nuevoHorario').value;
 if (!nuevo) { alert('Selecciona un horario'); return; }
 
 const btn = document.getElementById('btnGuardarCambio');
 btn.disabled = true;
 btn.textContent = 'Procesando...';
 
 try {
 // Lgica de capacidad (mximo 30) para el nuevo puesto
 const { count, error: countErr } = await supabase
 .from('votos')
 .select('*', { count: 'exact', head: true })
 .eq('horario', nuevo)
 .eq('fecha', cycleDate)
 .eq('en_espera', false);
 
 if (countErr) throw countErr;
 
 const enEspera = count >= 30;

 // Primero borramos el viejo para liberar el puesto (dispara trigger de promocin si aplica)
 const { error: delErr } = await supabase.from('votos').delete().eq('id', voto.id);
 if (delErr) {
 console.error('Del Error:', delErr);
 throw new Error('Fallo al borrar el voto original: ' + delErr.message);
 }
 
 if (window.promoverDeEspera) {
 await window.promoverDeEspera(voto.fecha, voto.horario);
 }

 // Insertamos el nuevo
 const { error: insErr } = await supabase.from('votos').insert({
 usuario_id: currentUser.id,
 nombre: currentUser.nombre,
 universidad: currentUser.universidad,
 matricula: currentUser.matricula,
 telefono: currentUser.telefono || '',
 email: currentUser.email || '',
 horario: nuevo,
 fecha: cycleDate,
 se_monto: null,
 en_espera: enEspera,
 created_at: new Date().toISOString()
 });
 
 if (insErr) throw insErr;
 
 await supabase.from('cambios_audit').insert({
 usuario_id: currentUser.id,
 matricula: currentUser.matricula,
 tipo: tipo,
 horario_anterior: horarioActual,
 nuevo_horario: nuevo,
 fecha: cycleDate
 });
 
 window.location.href = 'lista.html?cambio=1';
 
 } catch (err) {
 console.error('Error:', err);
 alert('Error: ' + err.message);
 btn.disabled = false;
 btn.textContent = 'Guardar Cambio';
 }
 });
 }
 }
}

// ============================================
// PGINA NO SUBIERON
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
 <button onclick="marcarComoSubio('${p.id}')" class="btn btn-success btn-small">Subi</button>
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
 if (!confirm(`Ests seguro/a de enviar la notificacin?`)) return;

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

 await emailjs.send('service_afofocu', 'template_e2cqbex', templateParams);
 alert(`Enviado a ${correos.length} personas.`);
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

function escapeHtml(text) {
 if (!text) return '';
 const div = document.createElement('div');
 div.textContent = text;
 return div.innerHTML;
}
