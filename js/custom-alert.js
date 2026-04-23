/* ============================================================
   AEUDJ — Custom Alert / Confirm / Prompt System
   All native browser dialogs replaced with themed modals
   ============================================================ */

(function () {
  // ─── Shared styles injected once ───────────────────────────
  const CSS = `
    .aeudj-overlay {
      position: fixed; inset: 0;
      background: rgba(2, 6, 23, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      padding: 1.25rem;
      opacity: 0;
      transition: opacity 0.25s ease;
      pointer-events: none;
    }
    .aeudj-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }
    .aeudj-dialog {
      background: linear-gradient(145deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98));
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1.75rem;
      padding: 2.25rem 2rem 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow:
        0 30px 80px rgba(0,0,0,0.6),
        0 0 0 1px rgba(255,255,255,0.04) inset;
      transform: scale(0.88) translateY(12px);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .aeudj-overlay.visible .aeudj-dialog {
      transform: scale(1) translateY(0);
    }
    .aeudj-icon-wrap {
      width: 64px; height: 64px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.25rem;
      font-size: 1.9rem;
    }
    .aeudj-icon-wrap.info    { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); }
    .aeudj-icon-wrap.warn    { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); }
    .aeudj-icon-wrap.danger  { background: rgba(239,68,68,0.12);  border: 1px solid rgba(239,68,68,0.3); }
    .aeudj-icon-wrap.success { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); }
    .aeudj-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 0.5rem;
      font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
      line-height: 1.35;
    }
    .aeudj-msg {
      color: #94a3b8;
      font-size: 0.9rem;
      line-height: 1.55;
      margin-bottom: 1.75rem;
      font-family: 'Inter', sans-serif;
    }
    .aeudj-input {
      width: 100%;
      background: rgba(15,23,42,0.8);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      color: #f8fafc;
      font-size: 0.95rem;
      outline: none;
      margin-bottom: 1.5rem;
      font-family: 'Inter', sans-serif;
      transition: border-color 0.2s;
    }
    .aeudj-input:focus { border-color: rgba(59,130,246,0.5); }
    .aeudj-input::placeholder { color: #475569; }
    .aeudj-btn-row {
      display: flex;
      gap: 0.65rem;
    }
    .aeudj-btn {
      flex: 1;
      padding: 0.8rem 1.25rem;
      border-radius: 0.9rem;
      border: none;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.01em;
    }
    .aeudj-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .aeudj-btn:active { filter: brightness(0.95); transform: translateY(0); }
    .aeudj-btn.primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      box-shadow: 0 4px 18px rgba(59,130,246,0.4);
    }
    .aeudj-btn.danger-btn {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 18px rgba(239,68,68,0.35);
    }
    .aeudj-btn.secondary {
      background: rgba(255,255,255,0.07);
      color: #94a3b8;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .aeudj-btn.secondary:hover { background: rgba(255,255,255,0.12); color: #f8fafc; }
    .aeudj-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 0 -2rem 1.75rem;
    }
  `;

  // Inject CSS once
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // ─── Helper: create / reuse overlay ────────────────────────
  function makeOverlay(id) {
    let ov = document.getElementById(id);
    if (!ov) {
      ov = document.createElement('div');
      ov.id = id;
      ov.className = 'aeudj-overlay';
      document.body.appendChild(ov);
    }
    return ov;
  }

  function show(ov) {
    requestAnimationFrame(() => {
      ov.style.display = 'flex';
      requestAnimationFrame(() => ov.classList.add('visible'));
    });
  }

  function hide(ov) {
    ov.classList.remove('visible');
    setTimeout(() => { ov.style.display = 'none'; }, 280);
  }

  const ICONS = {
    info:    '💬',
    warn:    '⚠️',
    danger:  '🗑️',
    success: '✅',
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
