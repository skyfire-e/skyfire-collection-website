// Global error boundary
window.addEventListener('error', function(e) {
  console.error('Uncaught error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
  e.preventDefault();
});

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


