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

function getWalSize(dbFile = DB_FILE) {
  const walPath = dbFile + '-wal';
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

function isDatabaseModified() {
  const output = execFileSync('git', ['diff', '--name-only', '--', 'data/collection.db'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return output.trim() !== '';
}

function checkpointDatabase(dbFile = DB_FILE, { busyTimeout = 5000 } = {}) {
  if (!fs.existsSync(dbFile)) {
    console.log('[pre-commit] collection.db does not exist; skipping checkpoint');
    return;
  }

  let database;
  try {
    database = new Database(dbFile);
    database.pragma(`busy_timeout = ${busyTimeout}`);

    // Never commit auth sessions to the repository: the DB is pushed to a
    // public GitHub repo, and a live admin sid does not belong in a backup.
    // Side effect: the signed-in admin is logged out after each commit that
    // touches the DB — an accepted trade-off (see security review B1).
    try {
      database.prepare('DELETE FROM sessions').run();
    } catch (error) {
      // Old snapshots may predate the sessions table — that is fine.
      if (!/no such table: sessions/.test(error.message)) throw error;
    }

    const checkpointResult = database.pragma('wal_checkpoint(TRUNCATE)');
    // wal_checkpoint does NOT throw when it cannot complete: it returns
    // { busy: 1 } if another connection (e.g. the running server) holds a
    // read lock. Committing in that state would stage a stale .db file that
    // is missing everything still in the WAL — including the session wipe
    // above. Fail loudly instead: stop the server (or retry) and commit again.
    const checkpointRow = Array.isArray(checkpointResult) ? checkpointResult[0] : checkpointResult;
    if (checkpointRow && checkpointRow.busy === 1) {
      throw new Error(
        'WAL checkpoint could not complete (database busy: ' + JSON.stringify(checkpointRow) + '). ' +
        'Another connection is holding a lock — stop the server and retry the commit.'
      );
    }
    const walSizeAfter = getWalSize(dbFile);
    if (walSizeAfter !== 0) {
      throw new Error(
        'WAL file is still ' + walSizeAfter + ' bytes after checkpoint — ' +
        'the staged collection.db would be stale. Stop the server and retry the commit.'
      );
    }
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

function hasSessions(dbFile = DB_FILE) {
  if (!fs.existsSync(dbFile)) return false;
  let database;
  try {
    database = new Database(dbFile, { readonly: true });
    return database.prepare('SELECT COUNT(*) AS c FROM sessions').get().c > 0;
  } catch {
    return false; // no sessions table or unreadable — nothing to clean
  } finally {
    if (database) database.close();
  }
}

if (require.main === module) {
  try {
    const walSize = getWalSize();
    const dbChanged = isDatabaseStaged() || isDatabaseModified();
    const sessionsPresent = hasSessions();

    if (walSize === 0 && !dbChanged && !sessionsPresent) {
      console.log('[pre-commit] No database changes detected');
      process.exit(0);
    }

    checkpointDatabase();
    stageDatabase();
    console.log('[pre-commit] collection.db checked and staged');
  } catch (error) {
    fail('Database checkpoint failed; commit was cancelled to avoid losing WAL data.', error);
  }
}

module.exports = { checkpointDatabase, getWalSize, hasSessions };
