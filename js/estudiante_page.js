// ============================================
// LÓGICA DEL PORTAL DEL ESTUDIANTE
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Asegurarnos de que los íconos se rendericen
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Verificar sesión (currentUser viene de app.js)
  // Como app.js carga antes, currentUser debería estar disponible si hay sesión.
  // Pero por si acaso, leemos de localStorage si es necesario.
  let sessionUser = currentUser;
  if (!sessionUser) {
    const localUser = localStorage.getItem('aeudj_user');
    if (localUser) {
      sessionUser = JSON.parse(localUser);
    } else {
      window.location.href = 'index.html';
      return;
    }
  }

  // Poblar datos del perfil
  document.getElementById('stNombre').textContent = sessionUser.nombre || 'Estudiante';
  document.getElementById('stMatricula').textContent = `Matrícula: ${sessionUser.matricula}`;
  document.getElementById('stEmail').textContent = `Correo: ${sessionUser.email || 'No registrado'}`;

  // Cargar estado de auditoría (Faltas y Penalidades)
  await cargarEstadoAuditoria(sessionUser);

  // Configurar toggle de contraseña
  const toggleBtn = document.getElementById('toggleNewPassword');
  const passInput = document.getElementById('newPassword');
  
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passInput.setAttribute('type', type);
      toggleBtn.innerHTML = `<i data-lucide="${type === 'password' ? 'eye' : 'eye-off'}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Manejar el cambio de contraseña
  const form = document.getElementById('changePasswordForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPassword = passInput.value.trim();
      if (newPassword.length < 6) {
        window.alert('La contraseña debe tener al menos 6 caracteres.', 'error', 'Error');
        return;
      }

      const btn = document.getElementById('btnChangePassword');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Actualizando...';

      try {
        const { data, error } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (error) throw error;

        // Limpiar input y mostrar éxito
        passInput.value = '';
        window.alert('Tu contraseña ha sido actualizada correctamente.', 'success', '¡Éxito!');
      } catch (err) {
        console.error('Error cambiando contraseña:', err);
        window.alert('Error al actualizar la contraseña: ' + (err.message || 'Desconocido'), 'error', 'Error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // Manejar botón de logout
  const btnLogout = document.getElementById('logoutBtn');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if(typeof logout === 'function') {
        logout();
      } else {
        localStorage.clear();
        window.location.href = 'index.html';
      }
    });
  }
});

async function cargarEstadoAuditoria(user) {
  try {
    const [{ count: faltasCount }, { data: pEntry }] = await Promise.all([
      supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('usuario_id', user.id),
      supabase.from('penalidades').select('*').eq('usuario_id', user.id).maybeSingle()
    ]);
    
    // Si no hay faltas en la tabla faltas ni en penalidades, el valor es estrictamente 0
    let activeFaltas = 0;
    if (faltasCount !== null && faltasCount !== undefined && faltasCount > 0) {
      activeFaltas = faltasCount;
    } else if (pEntry && pEntry.total_faltas > 0) {
      activeFaltas = pEntry.total_faltas;
    }

    const penActivas = Math.floor(activeFaltas / 3);
    const penalizado = penActivas > 0 || (pEntry?.penalizado === true && activeFaltas >= 3);

    const elFaltas = document.getElementById('stFaltas');
    const elPenalidades = document.getElementById('stPenalidades');
    const banner = document.getElementById('stBannerEstado');

    elFaltas.textContent = activeFaltas;
    elPenalidades.textContent = penActivas;

    // Cambiar clases visuales según estado
    if (activeFaltas > 0) {
      elFaltas.className = 'status-value high';
    } else {
      elFaltas.className = 'status-value low';
    }

    if (penActivas > 0) {
      elPenalidades.className = 'status-value high';
    } else {
      elPenalidades.className = 'status-value low';
    }

    if (penalizado) {
      banner.className = 'status-banner bad';
      banner.innerHTML = `<i data-lucide="alert-triangle" class="status-icon"></i><span>Estás penalizado (${activeFaltas} faltas). Tienes restricciones de reserva.</span>`;
    } else {
      banner.className = 'status-banner good';
      banner.innerHTML = `<i data-lucide="check-circle" class="status-icon"></i><span>Estado Activo y sin restricciones.</span>`;
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    console.error('Error al cargar auditoría:', error);
  }
}
