import { checkAuth, isAdmin } from '../api.js';
import { initAdminItems } from './items.js';
import { initAdminSettings } from './settings.js';

function showLogin() {
  // B4: hide the spinner so the login modal isn't stacked on "Loading admin panel..."
  document.getElementById('authLoader')?.classList.add('hidden');
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
    showLogin();
    return;
  }
  showContent();
  initAdminSettings();
  initAdminItems();
});
