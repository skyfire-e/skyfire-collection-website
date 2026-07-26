const { Router } = require('express');
const argon2 = require('argon2');
const { loginLimiter, requireSameOrigin } = require('../middleware');
const { getSecureCookies } = require('../helpers');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_ROLE = 'admin';

const router = Router();

router.post('/login', requireSameOrigin, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  let valid = false;
  if (process.env.ADMIN_PASSWORD_HASH) {
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(process.env.ADMIN_PASSWORD_HASH, password || '');
    } catch { /* invalid hash format */ }
    valid = (username === ADMIN_USERNAME) && passwordValid;
  } else if (process.env.ADMIN_PASSWORD) {
    valid = (username === ADMIN_USERNAME) && (process.env.ADMIN_PASSWORD === password);
    console.warn('WARNING: Using plain-text password. Set ADMIN_PASSWORD_HASH in .env');
  } else {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.user = { username: ADMIN_USERNAME, role: ADMIN_ROLE };
    res.json({ success: true, user: { username: ADMIN_USERNAME, role: ADMIN_ROLE } });
  });
});

router.post('/logout', requireSameOrigin, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout error' });
    res.clearCookie('skyfire.sid', { httpOnly: true, secure: getSecureCookies(), sameSite: 'lax' });
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session?.user) return res.json({ user: req.session.user });
  res.json({ user: null });
});

module.exports = router;
