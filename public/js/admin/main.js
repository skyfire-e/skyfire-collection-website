import { checkAuth, isAdmin } from '../api.js';
import { initAdminItems } from './items.js';
import { initAdminSettings } from './settings.js';

checkAuth().then(() => {
  if (!isAdmin()) {
    location.href = '/';
    return;
  }
  document.body.classList.remove('hidden');
  initAdminSettings();
  initAdminItems();
});
