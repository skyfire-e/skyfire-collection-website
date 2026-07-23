const { Router } = require('express');
const { loginLimiter } = require('../middleware');
const { secureCookies } = require('../helpers');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const users = [{ username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: 'admin' }];

const router = Router();

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.user = { username: user.username, role: user.role };
    res.json({ success: true, user: { username: user.username, role: user.role } });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout error' });
    res.clearCookie('skyfire.sid', { httpOnly: true, secure: secureCookies, sameSite: 'lax' });
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session?.user) return res.json({ user: req.session.user });
  res.json({ user: null });
});

module.exports = router;
