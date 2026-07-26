const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WAL_FILE = path.join(ROOT, 'data', 'collection.db-wal');

const fs = require('fs');
if (fs.existsSync(WAL_FILE)) {
  try {
    const stats = fs.statSync(WAL_FILE);
    if (stats.size > 0) {
      console.log('  SQLite WAL is not checkpointed (' + stats.size + ' bytes pending), running checkpoint...');
      execFileSync('node', ['-e', "const db=require('better-sqlite3')('data/collection.db'); db.pragma('wal_checkpoint(TRUNCATE)'); db.close();"], { cwd: ROOT, stdio: 'pipe' });
      execFileSync('git', ['diff', '--quiet', '--', 'data/collection.db'], { cwd: ROOT, stdio: 'pipe' });
      try { execFileSync('git', ['add', 'data/collection.db'], { cwd: ROOT, stdio: 'pipe' }); } catch {}
      console.log('  Checkpoint done, collection.db re-staged');
    }
  } catch {}
}
