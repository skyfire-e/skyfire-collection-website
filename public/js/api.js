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
      let message = data?.error || `Request failed with HTTP ${response.status}`;
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        message = 'Rate limit reached' + (retry ? ' — retry in ' + retry + 's' : '') +
          '. Sign in as admin to bypass the limit.';
      }
      const error = new Error(message);
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

// Per-page-load promise cache for endpoints requested by several modules at
// startup (topbar + nav + auth + page script). Any mutation to the same
// resource clears its cache entry. /api/auth/me is deliberately NOT cached:
// login/logout must always be reflected immediately.
const CACHEABLE = ['/api/categories', '/api/settings'];
const cache = new Map();

function cacheKey(url) {
  const clean = url.split('?')[0].replace(/\/$/, '');
  return CACHEABLE.includes(clean) ? clean : null;
}

// Mutations invalidate by prefix, so POST /api/categories/reorder also clears /api/categories
function invalidate(url) {
  const clean = url.split('?')[0];
  for (const key of cache.keys()) {
    if (clean === key || clean.startsWith(key + '/')) cache.delete(key);
  }
}

export const API = {
  get(url) {
    const key = cacheKey(url);
    if (!key) return request(url);
    if (!cache.has(key)) {
      const p = request(url);
      p.catch(() => cache.delete(key)); // don't cache failures
      cache.set(key, p);
    }
    return cache.get(key);
  },
  post(url, data) { invalidate(url); return request(url, buildOptions('POST', data)); },
  put(url, data) { invalidate(url); return request(url, buildOptions('PUT', data)); },
  del(url, data) { invalidate(url); return request(url, buildOptions('DELETE', data)); }
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


