#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(ROOT, 'data', 'collection.db');

function fail(message, error) {
  console.error(`[pre-commit] ${message}`);
  if (error) {
    console.error(error.stack || error.message || String(error));
  }
  process.exit(1);
}

function getWalSize() {
  const walPath = DB_FILE + '-wal';
  try {
    return fs.statSync(walPath).size;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

function isDatabaseStaged() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--', 'data/collection.db'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return output.trim() !== '';
}

function checkpointDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('[pre-commit] collection.db does not exist; skipping checkpoint');
    return;
  }

  let database;
  try {
    database = new Database(DB_FILE);
    database.pragma('busy_timeout = 5000');

    const checkpointResult = database.pragma('wal_checkpoint(TRUNCATE)');
    const quickCheck = database.pragma('quick_check', { simple: true });

    if (quickCheck !== 'ok') {
      throw new Error(`SQLite quick_check returned: ${String(quickCheck)}`);
    }

    console.log('[pre-commit] SQLite checkpoint completed:', JSON.stringify(checkpointResult));
  } finally {
    if (database) {
      database.close();
    }
  }
}

function stageDatabase() {
  execFileSync('git', ['add', '--', 'data/collection.db'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

try {
  const walSize = getWalSize();
  const dbStaged = isDatabaseStaged();

  if (walSize === 0 && !dbStaged) {
    console.log('[pre-commit] No database changes detected');
    process.exit(0);
  }

  checkpointDatabase();
  stageDatabase();
  console.log('[pre-commit] collection.db checked and staged');
} catch (error) {
  fail('Database checkpoint failed; commit was cancelled to avoid losing WAL data.', error);
}
