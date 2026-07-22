import { API, checkAuth, isAdmin, getCurrentUser } from './api.js';

export async function initAuth() {
  const adminBtn = document.getElementById('adminBtn');
  const authModal = document.getElementById('authModal');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authError = document.getElementById('authError');
  const adminActions = document.getElementById('adminActions');

  adminBtn.addEventListener('click', () => authModal.classList.add('open'));

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.classList.remove('open');
  });

  loginBtn.addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const res = await API.post('/api/auth/login', { username, password });
    if (res.success) {
      authModal.classList.remove('open');
      await checkAuth();
      updateUI();
    } else {
      authError.textContent = 'Invalid credentials';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await API.post('/api/auth/logout');
    authModal.classList.remove('open');
    updateUI();
  });

  function updateUI() {
    if (isAdmin()) {
      adminActions.style.display = 'flex';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      document.getElementById('authTitle').textContent = 'Admin Panel';
      API.get('/api/settings').then(s => {
        const spreadsheetBtn = adminActions.querySelector('button:last-child');
        if (spreadsheetBtn) spreadsheetBtn.style.display = s.showSpreadsheet !== false ? '' : 'none';
      });
    } else {
      adminActions.style.display = 'none';
      loginBtn.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
      document.getElementById('authTitle').textContent = 'Admin Login';
    }
  }

  await checkAuth();
  updateUI();
}

initAuth();
