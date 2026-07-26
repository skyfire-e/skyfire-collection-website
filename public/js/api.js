const REQUEST_TIMEOUT = 30000;

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  options.signal = controller.signal;
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    let data;
    try {
      data = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = new Error(data?.error || `Request failed with HTTP ${response.status}`);
      error.status = response.status;
      error.details = data?.details;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function buildOptions(method, data) {
  const opts = { method };
  if (data) {
    opts.headers = data instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    opts.body = data instanceof FormData ? data : JSON.stringify(data);
  }
  return opts;
}

export const API = {
  get(url) { return request(url); },
  post(url, data) { return request(url, buildOptions('POST', data)); },
  put(url, data) { return request(url, buildOptions('PUT', data)); },
  del(url, data) { return request(url, buildOptions('DELETE', data)); }
};

let currentUser = null;

export async function checkAuth() {
  try {
    const data = await API.get('/api/auth/me');
    currentUser = data.user;
    return currentUser;
  } catch {
    currentUser = null;
    return null;
  }
}

export function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

export function thumbUrl(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return imgPath;
  const name = imgPath.split('/').pop().replace(/\.[^.]+$/, '.jpg');
  return '/uploads/thumb-' + name;
}

export function createFocusTrap(container) {
  const focusable = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return null;
  return function(e) {
    if (e.key !== 'Tab') return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}

export async function withPending(button, operation) {
  const prev = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving\u2026';
  try {
    return await operation();
  } finally {
    button.disabled = false;
    button.textContent = prev;
  }
}
