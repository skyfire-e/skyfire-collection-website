// API helpers and auth state
const API = {
  async get(url) {
    const r = await fetch(url);
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
    return r.json();
  },
  async put(url, data) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
    return r.json();
  },
  async del(url, data) {
    const opts = { method: 'DELETE' };
    if (data) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(data);
    }
    const r = await fetch(url, opts);
    return r.json();
  }
};

let currentUser = null;

async function checkAuth() {
  const data = await API.get('/api/auth/me');
  currentUser = data.user;
  return currentUser;
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}
