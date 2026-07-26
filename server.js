require('dotenv').config();

if (!process.env.SESSION_SECRET || (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH)) {
  console.error('Missing required env vars: SESSION_SECRET and either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  console.error('Create a .env file in the project root with these values.');
  process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET must be at least 32 characters long.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD_HASH) {
  console.error('ADMIN_PASSWORD_HASH is required in production. ADMIN_PASSWORD (plaintext) is only allowed in development.');
  process.exit(1);
}

const app = require('./src/app');
const db = require('./src/db');
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('skyf1re Collection running at http://localhost:' + PORT);
});

function shutdown(signal) {
  console.log(signal + ': shutting down');
  const forceExit = setTimeout(() => process.exit(1), 5000);
  server.closeIdleConnections();
  server.close(error => {
    clearTimeout(forceExit);
    try {
      db.db.pragma('wal_checkpoint(TRUNCATE)');
      db.db.close();
    } catch (e) {
      console.error('DB close error:', e.message);
    }
    if (error) { console.error(error); process.exit(1); }
    process.exit(0);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
