const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const { checkpointDatabase, hasSessions } = require('../scripts/pre-commit');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'precommit-test-'));
const TMP_DB = path.join(TMP_DIR, 'collection.db');

function createTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
  const db = new Database(TMP_DB);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER);
  `);
  db.prepare('INSERT INTO items (id, title) VALUES (?, ?)').run('i1', 'Item');
  db.prepare('INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)')
    .run('live-admin-sid', JSON.stringify({ user: { role: 'admin' } }), Date.now() + 86400000);
  db.close();
}

after(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('pre-commit checkpoint', () => {
  it('B1: removes all sessions before the DB is staged for commit', () => {
    createTestDb();
    assert.strictEqual(hasSessions(TMP_DB), true, 'fixture must start with a session');

    checkpointDatabase(TMP_DB);

    const db = new Database(TMP_DB, { readonly: true });
    const sessionCount = db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c;
    const itemCount = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
    db.close();

    assert.strictEqual(sessionCount, 0, 'sessions must never be committed');
    assert.strictEqual(itemCount, 1, 'collection data must be preserved');
    assert.strictEqual(hasSessions(TMP_DB), false);
  });

  it('B1: checkpoint truncates the WAL file', () => {
    createTestDb();
    checkpointDatabase(TMP_DB);
    const walPath = TMP_DB + '-wal';
    const walSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
    assert.strictEqual(walSize, 0, 'WAL must be empty after checkpoint');
  });

  it('B1: does not fail on a DB without a sessions table', () => {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(TMP_DB + suffix, { force: true });
    }
    const db = new Database(TMP_DB);
    db.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
    db.close();

    assert.doesNotThrow(() => checkpointDatabase(TMP_DB));
    assert.strictEqual(hasSessions(TMP_DB), false);
  });

  it('B1: hasSessions is false for a missing DB file', () => {
    assert.strictEqual(hasSessions(path.join(TMP_DIR, 'nope.db')), false);
  });

  it('B1: fails loudly when the checkpoint cannot complete (busy reader)', () => {
    createTestDb();

    // A second connection holding an open read snapshot prevents the WAL from
    // being truncated — exactly what happens when the server is running.
    const reader = new Database(TMP_DB);
    const iterator = reader.prepare('SELECT * FROM items').iterate();
    iterator.next(); // acquires and holds the read lock

    try {
      assert.throws(
        () => checkpointDatabase(TMP_DB, { busyTimeout: 100 }),
        /busy|stale/i,
        'a busy checkpoint must abort the commit instead of staging a stale DB'
      );
    } finally {
      iterator.return();
      reader.close();
    }

    // With the reader gone the same checkpoint must succeed.
    assert.doesNotThrow(() => checkpointDatabase(TMP_DB));
  });
});
