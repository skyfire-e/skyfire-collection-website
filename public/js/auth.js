import { API, checkAuth, isAdmin } from './api.js';

async function initAuth() {
  const adminBtn = document.getElementById('adminBtn');
  const authModal = document.getElementById('authModal');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authError = document.getElementById('authError');
  const adminActions = document.getElementById('adminActions');

  if (adminBtn) adminBtn.addEventListener('click', () => { if (authModal) authModal.classList.add('open'); });
  if (!authModal) return;

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.classList.remove('open');
  });

  loginBtn.addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    authError.textContent = '';
    try {
      const res = await API.post('/api/auth/login', { username, password });
      if (res.success) {
        authModal.classList.remove('open');
        await checkAuth();
        updateUI();
      } else {
        authError.textContent = 'Invalid credentials';
      }
    } catch (err) {
      authError.textContent = err.message || 'Login failed';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try { await API.post('/api/auth/logout'); } catch (e) { console.warn('Logout error:', e); }
    authModal.classList.remove('open');
    await checkAuth();
    updateUI();
  });

  function updateUI() {
    if (isAdmin()) {
      adminActions.classList.remove('hidden');
      loginBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
      document.getElementById('authTitle').textContent = 'Admin Panel';
      API.get('/api/settings').then(s => {
        const spreadsheetBtn = adminActions.querySelector('button:last-child');
        if (spreadsheetBtn) {
          if (s.showSpreadsheet !== false) spreadsheetBtn.classList.remove('hidden');
          else spreadsheetBtn.classList.add('hidden');
        }
      });
    } else {
      adminActions.classList.add('hidden');
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
      document.getElementById('authTitle').textContent = 'Admin Login';
    }
  }

  await checkAuth();
  updateUI();
}

initAuth();
