// ============================================
// AEUDJ TRANSPORTE - APLICACIÓN PRINCIPAL
// ============================================

import { db, auth, transportSchedules, getCycleDate, formatDate } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Variables globales
let currentUser = null;
let isAdmin = false;
let selectedHorarios = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // Verificar sesión con localStorage y verificar luego con Firebase Auth
  checkSession();
  
  const page = document.body.dataset.page;
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (!currentUser || currentUser.id !== user.uid) {
        try {
           const docRef = doc(db, 'usuarios', user.uid);
           const docSnap = await getDoc(docRef);
           if (docSnap.exists()) {
             currentUser = docSnap.data();
             currentUser.id = user.uid;
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
    await signOut(auth);
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
      
      // Consultar si es un teléfono primero
      const qTel = query(collection(db, 'usuarios'), where('telefono', '==', userInput));
      const snapTel = await getDocs(qTel);
      if (!snapTel.empty) {
         matriculaLogin = snapTel.docs[0].data().matricula;
      }
      
      const pseudoEmail = `${matriculaLogin}@aeudj.com`;

      const userCredential = await signInWithEmailAndPassword(auth, pseudoEmail, pass);
      const user = userCredential.user;
      
      const docRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        userData.id = user.uid;
        // Redirigir a votar sin importar el rango para que pueda agendarse en el bus.
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
      const checkMat = query(collection(db, 'usuarios'), where('matricula', '==', matricula));
      const matSnapshot = await getDocs(checkMat);
      
      if (!matSnapshot.empty) {
        showError('Esta matrícula ya está registrada. Usa "Iniciar sesión".');
        btn.disabled = false;
        btn.textContent = 'Registrar';
        return;
      }
      
      const pseudoEmail = `${matricula.replace(/\s+/g, '')}@aeudj.com`;
      const userCred = await createUserWithEmailAndPassword(auth, pseudoEmail, pass);
      const user = userCred.user;

      const newUser = {
        matricula,
        nombre,
        telefono,
        email,
        universidad,
        rol: matricula === '20230105' ? 'administrador' : 'estudiante',
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'usuarios', user.uid), newUser);
      newUser.id = user.uid;
      
      setSession(newUser);
      window.location.href = 'votar.html';
      
    } catch (error) {
      console.error('Error:', error);
      if (error.code === 'auth/email-already-in-use') {
        showError('Este correo ya está registrado en otra cuenta.');
      } else {
        showError('Error al registrar: ' + error.message);
      }
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
      const q = query(
        collection(db, 'votos'),
        where('usuarioId', '==', currentUser.id)
      );
      const snapshot = await getDocs(q);
      
      const yaVotoHoy = snapshot.docs.some(doc => {
        const data = doc.data();
        return data.fecha === cycleDate;
      });
      
      if (yaVotoHoy) {
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
      for (const horario of selectedHorarios) {
        const docData = {
          usuarioId: currentUser.id,
          nombre: currentUser.nombre,
          universidad: currentUser.universidad,
          matricula: currentUser.matricula,
          telefono: currentUser.telefono || '',
          email: currentUser.email || '',
          horario: horario,
          fecha: cycleDate,
          seMonto: null,
          enEspera: false,
          createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'votos'), docData);
      }
      
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
      const q = query(
        collection(db, 'votos'),
        where('fecha', '==', cycleDate),
        orderBy('horario'),
        orderBy('createdAt')
      );
      const snapshot = await getDocs(q);
      
      const votos = [];
      snapshot.forEach(doc => {
        votos.push({ id: doc.id, ...doc.data() });
      });
      
      const listado = {};
      const listaEspera = {};
      
      votos.forEach(voto => {
        const datos = {
          nombre: voto.nombre,
          universidad: voto.universidad,
          createdAt: voto.createdAt?.toDate?.() || new Date(),
          enEspera: voto.enEspera,
          seMonto: voto.seMonto
        };
        
        if (voto.enEspera) {
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
       const q = query(collection(db, 'usuarios'), orderBy('nombre'));
       const snap = await getDocs(q);
       
       let html = `<div class="overflow-x-auto"><table class="w-full text-left border-collapse min-w-full">
         <thead><tr style="background:#f1f5f9;">
           <th class="p-2 border" style="border-color:#cbd5e1;">Usuario</th>
           <th class="p-2 border" style="border-color:#cbd5e1;">Rol</th>
           <th class="p-2 border" style="border-color:#cbd5e1;">Horario Asignado (Vol)</th>
           <th class="p-2 border" style="border-color:#cbd5e1;">Acción</th>
         </tr></thead><tbody>`;
         
       snap.forEach(docSnap => {
         const u = docSnap.data();
         if (u.rol === 'administrador') return;
         
         const isVoluntario = u.rol === 'voluntario';
         let optHorarios = transportSchedules.map(h => {
             const selected = (u.horariosAsignados && u.horariosAsignados.includes(h.fullText)) ? 'selected' : '';
             return `<option value="${h.fullText}" ${selected}>${h.fullText}</option>`;
         }).join('');
         
         html += `<tr>
           <td class="p-2 border" style="border-color:#cbd5e1;">${escapeHtml(u.nombre)}<br><small style="color:#64748b;">${u.email}</small></td>
           <td class="p-2 border" style="border-color:#cbd5e1;">
             <select id="rol-${docSnap.id}" class="form-select text-sm p-1" style="width:100%;">
               <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
               <option value="voluntario" ${isVoluntario ? 'selected' : ''}>Voluntario</option>
             </select>
           </td>
           <td class="p-2 border" style="border-color:#cbd5e1;">
             <select id="horarioAsig-${docSnap.id}" class="form-select text-sm p-1" style="width:100%;">
               <option value="">-- Ninguno --</option>
               ${optHorarios}
             </select>
           </td>
           <td class="p-2 border" style="border-color:#cbd5e1;">
             <button onclick="guardarRolAdmin('${docSnap.id}')" class="btn btn-primary btn-small" style="width:100%;">Guardar</button>
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
      await updateDoc(doc(db, 'usuarios', id), {
         rol: selRol,
         horariosAsignados: selRol === 'voluntario' && selHorario ? [selHorario] : []
      });
      alert('Rol actualizado correctamente');
    } catch(e) {
      console.error(e);
      alert('Error updating user');
    }
  }
  
  async function loadAdminData() {
    try {
      const q = query(
        collection(db, 'votos'),
        where('fecha', '==', cycleDate),
        orderBy('horario'),
        orderBy('createdAt')
      );
      const snapshot = await getDocs(q);
      
      const votos = [];
      snapshot.forEach(doc => {
        votos.push({ id: doc.id, ...doc.data() });
      });
      
      const listado = {};
      const listaEspera = [];
      
      votos.forEach(voto => {
        if (voto.enEspera) {
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
    
    if (p.seMonto === null) {
      statusHtml = `
        <div class="action-btns">
          <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Subió</button>
          <button onclick="marcarVoto('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
        </div>
      `;
    } else if (p.seMonto === 1) {
      statusHtml = `
        <div class="action-btns">
          <span class="status-badge status-success">✅ Subió</span>
          <button onclick="marcarVoto('${p.id}', 2)" class="btn btn-warning btn-small">Llegó tarde</button>
        </div>
      `;
    } else if (p.seMonto === 2) {
      // Llegó tarde - se considera que subió, con opción de revertir
      statusHtml = `
        <div class="action-btns">
          <span class="status-badge status-warning">⏰ Llegó tarde (Subió)</span>
          <button onclick="marcarVoto('${p.id}', 1)" class="btn btn-success btn-small">Marcar puntual</button>
          <button onclick="marcarVoto('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
        </div>
      `;
    } else {
      // No subió (0)
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
      await updateDoc(doc(db, 'votos', id), {
        seMonto: val
      });
      
      // Si marcó como "No subió" (0), mover de lista de espera
      if (val === 0) {
        await moverDeEspera(id);
      }
      
      // Recargar para mostrar cambios
      loadAdminData();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };
  
  async function moverDeEspera(votoId) {
    const votoDoc = await getDoc(doc(db, 'votos', votoId));
    if (!votoDoc.exists()) return;
    
    const voto = votoDoc.data();
    
    const q = query(
      collection(db, 'votos'),
      where('fecha', '==', voto.fecha),
      where('horario', '==', voto.horario),
      where('enEspera', '==', true),
      orderBy('createdAt'),
      limit(1)
    );
    const esperaSnapshot = await getDocs(q);
    
    if (!esperaSnapshot.empty) {
      const esperaDoc = esperaSnapshot.docs[0];
      await updateDoc(doc(db, 'votos', esperaDoc.id), {
        enEspera: false
      });
    }
  }
}

// ============================================
// PÁGINA GRACIAS
// ============================================
function initGraciasPage() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.has('ya_votado')) {
    const yaVotadoMsg = document.getElementById('yaVotadoMsg');
    if (yaVotadoMsg) yaVotadoMsg.classList.remove('hidden');
  }
  
  if (params.has('bloqueado')) {
    const bloqueadoMsg = document.getElementById('bloqueadoMsg');
    if (bloqueadoMsg) bloqueadoMsg.classList.remove('hidden');
  }
  
  setTimeout(() => {
    window.location.href = 'lista.html';
  }, 3000);
}

// ============================================
// PÁGINA CAMBIOS - CORREGIDA PARA MÓVILES
// ============================================
function initCambiosPage() {
  console.log('=== INICIANDO CAMBIOS ===');
  
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
  
  if (!container) {
    console.error('ERROR: No existe cambiosContainer');
    return;
  }
  
  container.innerHTML = '<div class="text-center"><p>Cargando...</p></div>';
  
  cargarDatos();
  
  async function cargarDatos() {
    try {
      const q = query(
        collection(db, 'votos'),
        where('usuarioId', '==', currentUser.id),
        where('fecha', '==', cycleDate)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        container.innerHTML = '<p class="text-center">No tienes votos hoy.</p>';
        return;
      }
      
      const votos = [];
      snapshot.forEach(doc => {
        votos.push({ id: doc.id, ...doc.data() });
      });
      
      const vuelta = votos.find(v => v.horario && v.horario.includes('La Vega → Jarabacoa'));
      
      if (!vuelta) {
        container.innerHTML = '<p class="text-center">No tienes horario de vuelta.</p>';
        return;
      }
      
      if (tipo === 'otros') {
        await deleteDoc(doc(db, 'votos', vuelta.id));
        await addDoc(collection(db, 'cambios'), {
          usuarioId: currentUser.id,
          matricula: currentUser.matricula,
          tipo: 'otros',
          fecha: cycleDate,
          createdAt: serverTimestamp()
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
    console.log('Horario actual:', horarioActual);
    console.log('Tipo:', tipo);
    
    // CORRECCIÓN: Parse manual robusto para horario actual
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
    
    // CORRECCIÓN: Obtener hora actual de forma compatible
    const ahora = new Date();
    // Usar hora local del dispositivo explícitamente
    const horasLocal = ahora.getHours();
    const minsLocal = ahora.getMinutes();
    const minutosAhora = horasLocal * 60 + minsLocal;
    
    console.log('Hora local del móvil:', horasLocal + ':' + minsLocal);
    console.log('Minutos actual (vuelta):', minutosActual);
    console.log('Minutos ahora:', minutosAhora);
    
    const disponibles = [];
    
    transportSchedules.forEach(s => {
      if (!s.route.includes('La Vega → Jarabacoa')) return;
      
      const min = parseHorario(s.fullText);
      
      // CORRECCIÓN: En móviles, a veces la hora está mal calculada
      // Vamos a ser más permisivos y solo comparar con el horario actual
      // sin verificar si ya pasó la hora (eso lo haremos opcional)
      
      let yaPaso = false;
      
      // Solo verificar si ya pasó si estamos en el mismo día
      // Comparar fechas para evitar problemas de zona horaria
      const hoy = new Date().toISOString().split('T')[0];
      const fechaVoto = cycleDate;
      
      if (hoy === fechaVoto) {
        yaPaso = min < minutosAhora;
      }
      
      console.log('Evaluando:', s.fullText, 'min:', min, 'ya pasó:', yaPaso);
      
      if (tipo === 'antes') {
        // Para "antes": horario menor al actual Y que no haya pasado
        if (min < minutosActual && !yaPaso) {
          disponibles.push(s.fullText);
          console.log('  -> AGREGADO antes');
        }
      } else if (tipo === 'despues') {
        // Para "después": horario mayor al actual (sin importar si pasó)
        // o si es el mismo día, que no haya pasado
        if (min > minutosActual) {
          disponibles.push(s.fullText);
          console.log('  -> AGREGADO después');
        }
      }
    });
    
    // CORRECCIÓN: Si no hay disponibles, mostrar todos los del tipo sin filtro de hora
    // Esto es para debug y para casos donde la hora del móvil esté mal
    if (disponibles.length === 0) {
      console.log('Sin horarios con filtro estricto, intentando filtro permisivo...');
      
      transportSchedules.forEach(s => {
        if (!s.route.includes('La Vega → Jarabacoa')) return;
        const min = parseHorario(s.fullText);
        
        if (tipo === 'antes' && min < minutosActual) {
          disponibles.push(s.fullText);
        } else if (tipo === 'despues' && min > minutosActual) {
          disponibles.push(s.fullText);
        }
      });
    }
    
    console.log('Total disponibles:', disponibles.length);
    
    // Renderizar
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
      const btn = document.getElementById('btnGuardar');
      
      const guardar = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        
        const select = document.getElementById('nuevoHorario');
        const nuevo = select.value;
        
        if (!nuevo) {
          alert('Selecciona un horario');
          return;
        }
        
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        
        try {
          // Nuevo timestamp para ir al final
          await updateDoc(doc(db, 'votos', votoId), {
            horario: nuevo,
            seMonto: null,
            createdAt: serverTimestamp()
          });
          
          await addDoc(collection(db, 'cambios'), {
            usuarioId: currentUser.id,
            matricula: currentUser.matricula,
            tipo: tipo,
            nuevoHorario: nuevo,
            fecha: cycleDate,
            createdAt: serverTimestamp()
          });
          
          window.location.href = 'lista.html?cambio=1';
          
        } catch (err) {
          console.error('Error:', err);
          alert('Error: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Guardar';
        }
      };
      
      // Eventos para móvil y desktop
      btn.addEventListener('click', guardar);
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        guardar();
      }, { passive: false });
    }
  }
}
// ============================================
// PÁGINA NO SUBIERON - CORREGIDA
// ============================================
function initNoSubieronPage() {
  // Verificar sesión de admin correctamente
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
      // Consulta simplificada para evitar índices compuestos
      const q = query(
        collection(db, 'votos'),
        where('fecha', '==', cycleDate)
      );
      
      const snapshot = await getDocs(q);
      
      // Filtrar en memoria los que no subieron (seMonto === 0)
      const personas = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.seMonto === 0) {
          personas.push({ id: doc.id, ...data });
        }
      });
      
      // Ordenar por horario
      personas.sort((a, b) => horarioAMinutos(a.horario) - horarioAMinutos(b.horario));
      
      if (personas.length === 0) {
        container.innerHTML = `
          <div class="text-center">
            <p class="text-green-700 text-lg">¡Todos subieron! 🎉</p>
            <p class="text-gray-600 mt-2">No hay personas para contactar</p>
          </div>
        `;
        return;
      }
      
      let html = '<div class="card">';
      html += `<h3 class="text-lg font-bold text-red-700 mb-4">Total: ${personas.length} persona(s)</h3>`;
      
      personas.forEach(p => {
        html += `
          <div class="passenger-item" style="background: #fef2f2; border: 1px solid #fecaca; margin-bottom: 0.5rem; padding: 1rem; border-radius: 0.5rem;">
            <div style="flex: 1;">
              <p class="passenger-name" style="font-weight: 600; color: #1f2937;">${escapeHtml(p.nombre)}</p>
              <p class="passenger-meta" style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">
                📞 ${p.telefono || 'N/A'} · ✉️ ${p.email || 'N/A'}
              </p>
              <p class="passenger-meta" style="color: #dc2626; font-size: 0.875rem; margin-top: 0.25rem;">
                🚌 ${p.horario} · 🆔 ${p.matricula}
              </p>
            </div>
            <button onclick="marcarComoSubio('${p.id}')" class="btn btn-success btn-small" style="margin-left: 1rem;">
              Subió
            </button>
          </div>
        `;
      });
      
      html += '</div>';
      container.innerHTML = html;
      
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = `
        <div class="text-center text-red-600">
          <p>Error al cargar datos.</p>
          <p class="text-sm mt-2">${error.message}</p>
          <button onclick="location.reload()" class="btn btn-gray mt-4">Reintentar</button>
        </div>
      `;
    }
  }
  
  // Función para marcar como que sí subió desde la página de no subieron
  window.marcarComoSubio = async function(id) {
    try {
      await updateDoc(doc(db, 'votos', id), {
        seMonto: 1
      });
      alert('Marcado como "Subió" correctamente');
      loadNoSubieron(); // Recargar lista
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar: ' + error.message);
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
  if (typeof date === 'string') date = new Date(date);
  if (date.toDate) date = date.toDate(); // Firebase timestamp
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function horarioAMinutos(horario) {
  try {
    // Extraer hora y minutos del formato "7:00 AM" o "2:15 PM"
    const match = horario.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    
    let horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    const periodo = match[3].toUpperCase();
    
    // Convertir a formato 24 horas
    if (periodo === 'PM' && horas !== 12) {
      horas += 12;
    } else if (periodo === 'AM' && horas === 12) {
      horas = 0;
    }
    
    return horas * 60 + minutos;
  } catch (e) {
    console.error('Error en horarioAMinutos:', e, horario);
    return 0;
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
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
  
  const misHorarios = currentUser.horariosAsignados || [];
  
  if (misHorarios.length === 0) {
     if(horariosText) horariosText.textContent = "No tienes ningún horario asignado.";
     container.innerHTML = '<p class="text-center text-gray-600 mt-4">Contacta al administrador para que te asigne una ruta.</p>';
     return;
  }
  
  if(horariosText) horariosText.textContent = `Tu horario: ${misHorarios.join(', ')}`;
  
  loadVoluntarioData();
  
  async function loadVoluntarioData() {
    try {
      const q = query(
        collection(db, 'votos'),
        where('fecha', '==', cycleDate),
        where('horario', 'in', misHorarios),
        orderBy('createdAt')
      );
      const snapshot = await getDocs(q);
      
      const votos = [];
      snapshot.forEach(doc => {
        votos.push({ id: doc.id, ...doc.data() });
      });
      
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
        if (p.seMonto === null) {
          statusHtml = `
            <div class="action-btns">
              <button onclick="marcarVotoVoluntario('${p.id}', 1)" class="btn btn-success btn-small">Subió</button>
              <button onclick="marcarVotoVoluntario('${p.id}', 0)" class="btn btn-danger btn-small">No subió</button>
            </div>
          `;
        } else if (p.seMonto === 1) {
          statusHtml = `
            <div class="action-btns">
              <span class="status-badge status-success">✅ Subió</span>
              <button onclick="marcarVotoVoluntario('${p.id}', 2)" class="btn btn-warning btn-small">Llegó tarde</button>
            </div>
          `;
        } else if (p.seMonto === 2) {
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
      await updateDoc(doc(db, 'votos', id), {
        seMonto: val
      });
      loadVoluntarioData(); // Reload
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };
}

// ============================================
// FUNCIONES GLOBALES
// ============================================
window.logout = logout;
window.irAHorario = function(ancla) {
  if (!ancla) return;
  const target = document.querySelector(ancla);
  if (target) {
    const offset = 100;
    const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
  }
};

window.notificarAccion = async function(tipo) {
  if (!currentUser || currentUser.rol !== 'administrador') return;
  
  if (!confirm(`¿Estás seguro/a de enviar la notificación por correo de tipo: ${tipo}?`)) return;

  try {
    const btn = event.target;
    const oldText = btn.textContent;
    btn.textContent = 'Enviando...';
    btn.disabled = true;
    
    let correos = [];
    if (tipo === 'apertura') {
       const usersSnap = await getDocs(collection(db, 'usuarios'));
       usersSnap.forEach(u => {
          if (u.data().email) correos.push(u.data().email);
       });
    } else {
       const cycleDate = getCycleDate();
       const vQuery = query(collection(db, 'votos'), where('fecha', '==', cycleDate));
       const vSnap = await getDocs(vQuery);
       vSnap.forEach(v => {
          if (v.data().email && !correos.includes(v.data().email)) {
             correos.push(v.data().email);
          }
       });
    }

    if (correos.length === 0) {
      alert("No hay correos registrados para esta acción.");
      btn.textContent = oldText;
      btn.disabled = false;
      return;
    }

    let titulo = "";
    let mensaje = "";
    if (tipo === 'apertura') {
      titulo = "¡Lista Abierta! Anótate en el transporte";
      mensaje = "La lista para anotarse en el transporte de la AEUDJ ya está abierta. Ingresa a la página para reservar tu asiento.";
    } else if (tipo === 'llegada') {
      titulo = "🚌 El autobús ha llegado";
      mensaje = "El autobús ya llegó al punto de partida. Por favor acércate a la puerta para abordar.";
    } else if (tipo === 'salida') {
      titulo = "💨 El autobús está saliendo";
      mensaje = "¡Atención! El autobús está saliendo pronto. Apresúrate o perderás tu asiento.";
    }

    const templateParams = {
      titulo: titulo,
      mensaje: mensaje,
      destinatarios: correos.join(',')
    };

    // Activar envío real de EmailJS
    await emailjs.send('service_afofocu', 'template_e2cqbex', templateParams);
    
    alert(`¡Éxito! Se enviaron las notificaciones a ${correos.length} estudiantes correctamente vía correo electrónico.`);
    
    btn.textContent = oldText;
    btn.disabled = false;
    
  } catch(error) {
     console.error(error);
     alert("Error al enviar notificaciones: " + error.message);
  }
};