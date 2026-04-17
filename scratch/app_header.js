import { supabase, transportSchedules, getCycleDate, formatDate, SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js?v=305';

alert('SISTEMA ACTIVADO ✅');
console.log('🚀 AEUDJ App Iniciada');

// Variables globales
let currentUser = null;
let isAdmin = false;
let selectedHorarios = [];
const cycleDate = getCycleDate();
let currentAdminStats = null;

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
document.addEventListener('DOMContentLoaded', async function () {
  refreshIcons();
  checkSession();
  
  const page = document.body.dataset.page;
  console.log('Pagina detectada:', page);
  
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const user = session.user;
      if (!currentUser || currentUser.id !== user.id) {
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (data) {
            currentUser = data;
            if (currentUser.matricula === '20230105' && currentUser.rol !== 'desarrolladora') {
              currentUser.rol = 'desarrolladora';
              supabase.from('profiles').update({ rol: 'desarrolladora' }).eq('id', user.id).then();
            }
            setSession(currentUser);
          }
        } catch (e) { console.error('Error fetching user config:', e); }
      }
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
  } catch (e) { }
  clearSession();
  window.location.href = 'index.html';
}

// ============================================
// INICIALIZACIN DE PGINAS
// ============================================
function initPage(page) {
  switch (page) {
    case 'index': initIndexPage(); break;
    case 'votar': initVotarPage(); break;
    case 'lista': initListaPage(); break;
    case 'admin': initAdminPage(); break;
    case 'voluntario': initVoluntarioPage(); break;
    case 'gracias': initGraciasPage(); break;
    case 'cambios': initCambiosPage(); break;
    case 'no-subieron': initNoSubieronPage(); break;
  }
}
