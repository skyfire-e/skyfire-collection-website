import { checkAuth, isAdmin } from '../api.js';
import { initAdminItems } from './items.js';
import { initAdminSettings } from './settings.js';

function showLogin() {
  const authModal = document.getElementById('authModal');
  if (authModal) authModal.classList.add('open');
  else location.href = '/#login';
}

checkAuth().then(() => {
  if (!isAdmin()) {
    showLogin();
    return;
  }
  document.body.classList.remove('hidden');
  initAdminSettings();
  initAdminItems();
}).catch(err => {
  console.error('Auth check failed:', err);
  showLogin();
});
