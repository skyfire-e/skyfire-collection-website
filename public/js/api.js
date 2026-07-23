async function request(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with HTTP ${response.status}`);
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }
  return data;
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
  const data = await API.get('/api/auth/me');
  currentUser = data.user;
  return currentUser;
}

export function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

export function getCurrentUser() {
  return currentUser;
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
