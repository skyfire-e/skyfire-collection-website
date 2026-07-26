import { checkAuth, isAdmin } from '../api.js';
import { initAdminItems } from './items.js';
import { initAdminSettings } from './settings.js';

function showLogin() {
  const authModal = document.getElementById('authModal');
  if (authModal) authModal.classList.add('open');
  else location.href = '/#login';
}

function showContent() {
  document.getElementById('authLoader')?.classList.add('hidden');
  document.getElementById('adminContent')?.classList.remove('hidden');
}

checkAuth().then(() => {
  if (!isAdmin()) {
    showContent();
    showLogin();
    return;
  }
  showContent();
  initAdminSettings();
  initAdminItems();
});
