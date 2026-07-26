import { API } from '../api.js';
import { showToast } from '../toast.js';

export async function loadSettings() {
  let settings;
  try {
    settings = await API.get('/api/settings');
  } catch (err) {
    console.error('Failed to load settings:', err);
    showToast('Failed to load settings', 'error');
    return;
  }
  document.getElementById('setSiteName').value = settings.siteName || '';
  document.getElementById('setDefaultTheme').value = settings.defaultTheme || 'dark';
  document.getElementById('currentDefaultImg').textContent = settings.defaultImage || 'not set';
  document.getElementById('setShowSpreadsheet').checked = settings.showSpreadsheet !== false;
  document.getElementById('setShowPublicSpreadsheet').checked = settings.showPublicSpreadsheet !== false;
  const mc = settings.showMiniaturesColumns || {};
  document.getElementById('setShowRecaster').checked = mc.recaster || false;
  document.getElementById('setShowCombatPoints').checked = mc.combatPoints || false;
  document.getElementById('setShowStatus').checked = mc.status || false;
  renderCurrencySettings(settings.currencies || {});
}

async function renderCurrencySettings(currencies) {
  let cats;
  try { cats = await API.get('/api/categories'); } catch { cats = {}; }
  const container = document.getElementById('currencySettings');
  container.innerHTML = '';
  Object.entries(cats).forEach(([key, sec]) => {
    const row = document.createElement('div');
    row.className = 'currency-row';
    const labelEl = document.createElement('label');
    labelEl.className = 'currency-label';
    labelEl.textContent = sec.label;
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.id = 'cur_' + key;
    inputEl.value = currencies[key] || '';
    inputEl.placeholder = 'USD';
    inputEl.className = 'currency-input';
    inputEl.maxLength = 3;
    const hint = document.createElement('span');
    hint.className = 'currency-hint';
    hint.textContent = 'ISO 4217';
    row.append(labelEl, inputEl, hint);
    container.appendChild(row);
  });
}

export function initAdminSettings() {
  document.getElementById('backfillBtn').addEventListener('click', async () => {
    try {
      const res = await API.post('/api/backfill-defaults');
      showToast('Updated ' + res.updated + ' items with default image: ' + res.defaultImage, 'success');
    } catch (err) {
      console.error('Backfill failed:', err);
      showToast('Backfill failed: ' + (err.message || 'Unknown error'), 'error');
    }
  });

  document.getElementById('backfillImagesBtn').addEventListener('click', async () => {
    try {
      const res = await API.post('/api/backfill-images');
      showToast('Updated ' + res.updated + ' items: image → images[0]', 'success');
    } catch (err) {
      console.error('Backfill images failed:', err);
      showToast('Backfill failed: ' + (err.message || 'Unknown error'), 'error');
    }
  });

  document.getElementById('backfillPricesBtn').addEventListener('click', async () => {
    try {
      const res = await API.post('/api/backfill-prices');
      showToast('Updated ' + res.updated + ' items: price normalized to number', 'success');
    } catch (err) {
      console.error('Backfill prices failed:', err);
      showToast('Backfill failed: ' + (err.message || 'Unknown error'), 'error');
    }
  });

  document.getElementById('checkpointBtn').addEventListener('click', async () => {
    try {
      await API.post('/api/checkpoint');
      showToast('WAL checkpoint done — DB is ready for commit', 'success');
    } catch (err) {
      console.error('Checkpoint failed:', err);
      showToast('Checkpoint failed: ' + (err.message || 'Unknown error'), 'error');
    }
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    try {
      const fileInput = document.getElementById('setDefaultImage');
      if (fileInput.files[0]) {
        const imgFd = new FormData();
        imgFd.append('image', fileInput.files[0]);
        await API.post('/api/upload/default', imgFd);
        fileInput.value = '';
      }
      const currencies = {};
      document.querySelectorAll('#currencySettings .currency-row').forEach(row => {
        const input = row.querySelector('input');
        const sectionId = input.id.replace('cur_', '');
        if (input.value.trim()) currencies[sectionId] = input.value.trim();
      });
      await API.put('/api/settings', {
        siteName: document.getElementById('setSiteName').value,
        defaultTheme: document.getElementById('setDefaultTheme').value,
        showSpreadsheet: document.getElementById('setShowSpreadsheet').checked,
        showPublicSpreadsheet: document.getElementById('setShowPublicSpreadsheet').checked,
        showMiniaturesColumns: {
          recaster: document.getElementById('setShowRecaster').checked,
          combatPoints: document.getElementById('setShowCombatPoints').checked,
          status: document.getElementById('setShowStatus').checked,
        },
        currencies: currencies,
      });
      showToast('Settings saved!', 'success');
      loadSettings();
    } catch (err) {
      console.error('Save settings failed:', err);
      showToast('Save settings failed: ' + (err.message || 'Unknown error'), 'error');
    }
  });
}
