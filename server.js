require('dotenv').config();

if (!process.env.SESSION_SECRET) {
  console.error('Missing required env var: SESSION_SECRET');
  console.error('Create a .env file in the project root with this value.');
  process.exit(1);
}

if (process.env.ADMIN_PASSWORD === '') {
  console.error('ADMIN_PASSWORD cannot be empty. Use ADMIN_PASSWORD_HASH instead.');
  process.exit(1);
}

if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
  console.error('Missing required env vars: either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  console.error('Create a .env file in the project root with this value.');
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
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 5000;

const server = app.listen(PORT, () => {
  console.log('skyf1re Collection running at http://localhost:' + PORT);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use.');
    process.exit(1);
  }
  console.error('Server error:', err.message);
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(signal + ': shutting down');
  const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT);
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
  console.error('UNHANDLED REJECTION:', reason instanceof Error ? reason.stack : reason);
  shutdown('UNHANDLED_REJECTION');
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.stack);
  shutdown('UNCAUGHT_EXCEPTION');
});
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
