// T1: backup smoke test. The full `npm run backup` pipeline (snapshot →
// verify → archive → extract) is exercised against a miniature copy of the
// real layout in a temp dir. Regression context: archiver@8's switch to ESM
// named exports made createArchive throw "archiver is not a function" — the
// daily launchd backup silently failed for 2 days while CI stayed green,
// because nothing imported backup.js in tests.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const Database = require('better-sqlite3');

const {
  createDatabaseSnapshot,
  verifyDatabaseSnapshot,
  collectFiles,
  createArchive
} = require('../backup.js');

let tmp;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  // Miniature copy of the real repo layout: data/collection.db + uploads/
  fs.mkdirSync(path.join(tmp, 'data'));
  fs.mkdirSync(path.join(tmp, 'uploads', '.tmp'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'uploads', '.quarantine'), { recursive: true });
  const db = new Database(path.join(tmp, 'data', 'collection.db'));
  db.exec('CREATE TABLE items (id TEXT PRIMARY KEY, title TEXT)');
  db.prepare('INSERT INTO items VALUES (?, ?)').run('a', 'Item A');
  db.prepare('INSERT INTO items VALUES (?, ?)').run('b', 'Item B');
  db.close();
  fs.writeFileSync(path.join(tmp, 'uploads', 'photo.jpg'), 'fake-jpeg');
  fs.writeFileSync(path.join(tmp, 'uploads', '.tmp', 'junk.jpg'), 'tmp-junk');
  fs.writeFileSync(path.join(tmp, 'uploads', '.quarantine', 'bad.jpg'), 'quarantined');
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Backup smoke test', () => {
  it('collectFiles excludes uploads/.tmp and uploads/.quarantine', () => {
    const files = collectFiles(path.join(tmp, 'uploads'), tmp);
    assert.deepStrictEqual(
      files.map(f => path.relative(tmp, f)),
      [path.join('uploads', 'photo.jpg')]
    );
  });

  it('snapshot → verify → archive → extract round-trip', async () => {
    const snapshotPath = path.join(tmp, 'snapshot.db');
    await createDatabaseSnapshot(path.join(tmp, 'data', 'collection.db'), snapshotPath);

    const snapshotData = verifyDatabaseSnapshot(snapshotPath);
    assert.strictEqual(snapshotData.integrity, 'ok');
    assert.strictEqual(snapshotData.itemCount, 2);
    snapshotData.commit = null;

    // The regression guard: this call is where "archiver is not a function" threw
    const outputPath = path.join(tmp, 'test-backup.tar.gz');
    const files = collectFiles(path.join(tmp, 'uploads'), tmp);
    const result = await createArchive({ outputPath, files, snapshotPath, snapshotData, root: tmp });
    assert.ok(result.bytes > 0, 'archive should report written bytes');
    assert.ok(fs.statSync(outputPath).size > 0, 'archive file should not be empty');

    // Extract with the system tar (same tool a real restore would use)
    const extractDir = path.join(tmp, 'extracted');
    fs.mkdirSync(extractDir);
    execFileSync('tar', ['-xzf', outputPath, '-C', extractDir]);

    const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.formatVersion, 1);
    assert.strictEqual(manifest.database.itemCount, 2);
    assert.strictEqual(manifest.database.integrityCheck, 'ok');
    assert.strictEqual(manifest.uploads.fileCount, 1);

    assert.strictEqual(
      fs.readFileSync(path.join(extractDir, 'uploads', 'photo.jpg'), 'utf8'),
      'fake-jpeg'
    );

    // The restored DB must be a valid SQLite file with the original rows
    const restored = new Database(path.join(extractDir, 'data', 'collection.db'), { readonly: true });
    assert.strictEqual(restored.pragma('integrity_check', { simple: true }), 'ok');
    assert.strictEqual(restored.prepare('SELECT COUNT(*) AS c FROM items').get().c, 2);
    restored.close();
  });
});
