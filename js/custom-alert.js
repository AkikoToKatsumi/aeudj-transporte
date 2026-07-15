/* ============================================================
   AEUDJ — Custom Alert / Confirm / Prompt System
   All native browser dialogs replaced with themed modals
   ============================================================ */

(function () {
  // Inject CSS stylesheet link
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = 'css/custom-alert.css';
  document.head.appendChild(linkEl);
  // ─── Helper: create fresh overlay (remove old) ─────────────
  function makeOverlay(id) {
    const old = document.getElementById(id);
    if (old) old.remove();

    const ov = document.createElement('div');
    ov.id = id;
    ov.className = 'aeudj-overlay';
    ov.style.display = 'none';
    document.body.appendChild(ov);
    return ov;
  }

  function show(ov) {
    ov.style.display = 'flex';
    // Force reflow so transition can trigger
    ov.offsetHeight;
    ov.classList.add('visible');
  }

  function hide(ov) {
    ov.classList.remove('visible');
    setTimeout(() => { ov.remove(); }, 280);
  }

  const ICONS = {
    info:    '💬',
    warn:    '⚠️',
    danger:  '🗑️',
    success: '✅',
    user:    '👤',
  };

  // ─── ALERT ──────────────────────────────────────────────────
  window.alert = function (msg, type = 'info', title = 'Aviso') {
    const ov = makeOverlay('aeudj-alert-ov');
    const iconType = type === 'error' ? 'danger' : type;
    ov.innerHTML = `
      <div class="aeudj-dialog">
        <div class="aeudj-icon-wrap ${iconType}">${ICONS[iconType] || ICONS.info}</div>
        <div class="aeudj-title">${title}</div>
        <div class="aeudj-divider"></div>
        <p class="aeudj-msg">${msg}</p>
        <div class="aeudj-btn-row">
          <button class="aeudj-btn primary" id="aeudj-alert-ok">Aceptar</button>
        </div>
      </div>`;
    show(ov);
    document.getElementById('aeudj-alert-ok').onclick = () => hide(ov);
    // Close on backdrop click
    ov.onclick = (e) => { if (e.target === ov) hide(ov); };
  };

  // ─── CONFIRM ────────────────────────────────────────────────
  window.aeudjConfirm = function (msg, { title = '¿Estás seguro?', type = 'warn', okText = 'Confirmar', cancelText = 'Cancelar' } = {}) {
    return new Promise((resolve) => {
      const ov = makeOverlay('aeudj-confirm-ov');
      const btnClass = type === 'danger' ? 'danger-btn' : 'primary';
      const iconType = type;
      ov.innerHTML = `
        <div class="aeudj-dialog">
          <div class="aeudj-icon-wrap ${iconType}">${ICONS[iconType] || ICONS.warn}</div>
          <div class="aeudj-title">${title}</div>
          <div class="aeudj-divider"></div>
          <p class="aeudj-msg">${msg}</p>
          <div class="aeudj-btn-row">
            <button class="aeudj-btn secondary" id="aeudj-confirm-cancel">${cancelText}</button>
            <button class="aeudj-btn ${btnClass}"  id="aeudj-confirm-ok">${okText}</button>
          </div>
        </div>`;
      show(ov);

      document.getElementById('aeudj-confirm-ok').onclick = () => { hide(ov); resolve(true); };
      document.getElementById('aeudj-confirm-cancel').onclick = () => { hide(ov); resolve(false); };
      ov.onclick = (e) => { if (e.target === ov) { hide(ov); resolve(false); } };
    });
  };

  // Backwards-compat: native confirm() → aeudjConfirm
  window.confirm = function (msg) {
    // Return true synchronously for legacy code that doesn't await,
    // but also trigger our modal (best-effort)
    window.aeudjConfirm(msg);
    return true; // legacy callers should be updated to await aeudjConfirm
  };

  // ─── PROMPT ─────────────────────────────────────────────────
  window.prompt = function (msg, defaultVal = '') {
    return new Promise((resolve) => {
      const ov = makeOverlay('aeudj-prompt-ov');
      ov.innerHTML = `
        <div class="aeudj-dialog">
          <div class="aeudj-icon-wrap info">✏️</div>
          <div class="aeudj-title">Ingresa un valor</div>
          <div class="aeudj-divider"></div>
          <p class="aeudj-msg">${msg}</p>
          <input class="aeudj-input" id="aeudj-prompt-input" type="text" value="${defaultVal}" placeholder="Escribe aquí...">
          <div class="aeudj-btn-row">
            <button class="aeudj-btn secondary" id="aeudj-prompt-cancel">Cancelar</button>
            <button class="aeudj-btn primary"    id="aeudj-prompt-ok">Aceptar</button>
          </div>
        </div>`;
      show(ov);

      const input = document.getElementById('aeudj-prompt-input');
      setTimeout(() => input.focus(), 300);

      const confirm = () => { hide(ov); resolve(input.value); };
      document.getElementById('aeudj-prompt-ok').onclick = confirm;
      document.getElementById('aeudj-prompt-cancel').onclick = () => { hide(ov); resolve(null); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { hide(ov); resolve(null); } });
      ov.onclick = (e) => { if (e.target === ov) { hide(ov); resolve(null); } };
    });
  };

})();
