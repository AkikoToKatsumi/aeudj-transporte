// custom-alert.js
window.originalAlert = window.alert;
window.alert = function(msg) {
  let modal = document.getElementById('aeudj-custom-alert');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'aeudj-custom-alert';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity 0.3s;pointer-events:none;';
    modal.innerHTML = `
      <div style="background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.2);padding:2rem;border-radius:1.5rem;text-align:center;max-width:400px;width:100%;transform:scale(0.9);transition:transform 0.3s;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="width:60px;height:60px;border-radius:50%;background:rgba(59,130,246,0.1);color:#60a5fa;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;border:1px solid rgba(59,130,246,0.3);">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <p id="aeudj-alert-msg" style="color:#f8fafc;font-size:1.1rem;margin-bottom:1.5rem;font-weight:600;line-height:1.4;"></p>
        <button id="aeudj-alert-ok" style="background:linear-gradient(135deg, #3b82f6, #2563eb);color:white;border:none;padding:0.75rem 2rem;border-radius:0.75rem;font-weight:bold;cursor:pointer;width:100%;font-size:1rem;box-shadow:0 4px 15px rgba(59,130,246,0.35);">Aceptar</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('aeudj-alert-ok').onclick = () => {
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      modal.children[0].style.transform = 'scale(0.9)';
    };
  }
  document.getElementById('aeudj-alert-msg').textContent = msg;
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.children[0].style.transform = 'scale(1)';
};

window.originalConfirm = window.confirm;
window.aeudjConfirm = function(msg) {
  return new Promise((resolve) => {
    let modal = document.getElementById('aeudj-custom-confirm');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'aeudj-custom-confirm';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity 0.3s;pointer-events:none;';
      modal.innerHTML = `
        <div style="background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.2);padding:2rem;border-radius:1.5rem;text-align:center;max-width:400px;width:100%;transform:scale(0.9);transition:transform 0.3s;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(245,158,11,0.1);color:#fbbf24;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;border:1px solid rgba(245,158,11,0.3);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <p id="aeudj-confirm-msg" style="color:#f8fafc;font-size:1.1rem;margin-bottom:1.5rem;font-weight:600;line-height:1.4;"></p>
          <div style="display:flex;gap:0.75rem;">
            <button id="aeudj-confirm-cancel" style="background:rgba(255,255,255,0.1);color:#f8fafc;border:1px solid rgba(255,255,255,0.2);padding:0.75rem 1rem;border-radius:0.75rem;font-weight:bold;cursor:pointer;flex:1;">Cancelar</button>
            <button id="aeudj-confirm-ok" style="background:linear-gradient(135deg, #f59e0b, #d97706);color:white;border:none;padding:0.75rem 1rem;border-radius:0.75rem;font-weight:bold;cursor:pointer;flex:1;box-shadow:0 4px 15px rgba(245,158,11,0.35);">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    document.getElementById('aeudj-confirm-msg').textContent = msg;
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.children[0].style.transform = 'scale(1)';
    
    document.getElementById('aeudj-confirm-ok').onclick = () => {
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      modal.children[0].style.transform = 'scale(0.9)';
      resolve(true);
    };
    document.getElementById('aeudj-confirm-cancel').onclick = () => {
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      modal.children[0].style.transform = 'scale(0.9)';
      resolve(false);
    };
  });
};
