import { API, checkAuth, isAdmin } from './api.js';
import { createFocusTrap } from './utils.js';

async function initAuth() {
  const adminBtn = document.getElementById('adminBtn');
  const authModal = document.getElementById('authModal');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authError = document.getElementById('authError');
  const adminActions = document.getElementById('adminActions');
  let trapHandler = null;

  function openModal() {
    if (!authModal) return;
    authModal.classList.add('open');
    trapHandler = createFocusTrap(authModal);
    if (trapHandler) authModal.addEventListener('keydown', trapHandler);
    document.getElementById('loginUsername')?.focus();
  }

  function closeModal() {
    if (!authModal) return;
    authModal.classList.remove('open');
    if (trapHandler) { authModal.removeEventListener('keydown', trapHandler); trapHandler = null; }
  }

  if (adminBtn) adminBtn.addEventListener('click', openModal);
  if (!authModal) return;

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal.classList.contains('open')) closeModal();
  });

  async function doLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    authError.textContent = '';
    try {
      const res = await API.post('/api/auth/login', { username, password });
      if (res.success) {
        closeModal();
        // B4: /admin gates content on load-time auth check — reload to initialize the panel
        if (location.pathname === '/admin') { location.reload(); return; }
        await checkAuth();
        updateUI();
      } else {
        authError.textContent = 'Invalid credentials';
      }
    } catch (err) {
      authError.textContent = err.message || 'Login failed';
    }
  }

  loginBtn.addEventListener('click', doLogin);
  // Submit on Enter from either credential field
  for (const id of ['loginUsername', 'loginPassword']) {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
    });
  }

  logoutBtn.addEventListener('click', async () => {
    try { await API.post('/api/auth/logout'); } catch (e) { console.warn('Logout error:', e); }
    closeModal();
    // The admin panel is initialized for a signed-in user — reload to reset it
    if (location.pathname === '/admin') { location.reload(); return; }
    await checkAuth();
    updateUI();
  });

  function updateUI() {
    if (isAdmin()) {
      if (adminActions) adminActions.classList.remove('hidden');
      loginBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
      document.getElementById('authTitle').textContent = 'Admin Panel';
      API.get('/api/settings').then(s => {
        const spreadsheetBtn = adminActions ? adminActions.querySelector('[data-btn="spreadsheet"]') : null;
        if (spreadsheetBtn) {
          if (s.showSpreadsheet !== false) spreadsheetBtn.classList.remove('hidden');
          else spreadsheetBtn.classList.add('hidden');
        }
      }).catch(e => console.warn('Settings load failed:', e));
    } else {
      if (adminActions) adminActions.classList.add('hidden');
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
      document.getElementById('authTitle').textContent = 'Admin Login';
    }
  }

  await checkAuth();
  updateUI();
}

initAuth();
