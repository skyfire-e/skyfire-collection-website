const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const date = new Date().toISOString().split('T')[0];
let index = 0;
let backupFile;
do {
  const suffix = index === 0 ? '' : '.' + index;
  backupFile = path.join(BACKUP_DIR, 'skyfire-backup-' + date + suffix + '.tar.gz');
  index++;
} while (fs.existsSync(backupFile));

const dbPath = path.join(ROOT, 'data', 'collection.db');
const db = new Database(dbPath);
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();

const opts = [
  '-czf',
  path.join(BACKUP_DIR, path.basename(backupFile)),
  '--exclude', path.join('uploads', '.tmp', '*'),
  '--exclude', path.join('uploads', '.quarantine', '*'),
  '-C', ROOT,
  'data',
  'uploads'
];

execSync('tar ' + opts.map(o => '"' + o + '"').join(' '), { stdio: 'inherit' });
console.log('Backup: ' + backupFile);

const MAX_BACKUPS = 10;
const backups = fs.readdirSync(BACKUP_DIR)
  .filter(f => f.startsWith('skyfire-backup-') && f.endsWith('.tar.gz'))
  .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
if (backups.length > MAX_BACKUPS) {
  for (const old of backups.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.name));
    console.log('Removed old backup: ' + old.name);
  }
}
