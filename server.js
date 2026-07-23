require('dotenv').config();

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error('Missing required env vars: SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD');
  console.error('Create a .env file in the project root with these values.');
  process.exit(1);
}

const app = require('./src/app');
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('skyf1re Collection running at http://localhost:' + PORT);
});

function shutdown(signal) {
  console.log(signal + ': shutting down');
  server.close(error => {
    if (error) { console.error(error); process.exit(1); }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
