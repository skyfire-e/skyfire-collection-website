#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, 'backups');
const EXCLUDE_PATTERNS = [path.join('uploads', '.tmp'), path.join('uploads', '.quarantine')];

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
db.pragma('busy_timeout = 5000');
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();

function isExcluded(entryPath) {
  return EXCLUDE_PATTERNS.some(p => entryPath.startsWith(p + path.sep) || entryPath === p);
}

function collectFiles(dir, baseDir) {
  const entries = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      if (isExcluded(relPath)) continue;
      if (entry.isDirectory()) {
        entries.push(...collectFiles(fullPath, baseDir));
      } else {
        entries.push(fullPath);
      }
    }
  } catch {}
  return entries;
}

const output = fs.createWriteStream(backupFile);
const archive = archiver('tar', { gzip: true });
archive.pipe(output);

const dataFiles = collectFiles(path.join(ROOT, 'data'), ROOT);
for (const file of dataFiles) {
  archive.file(file, { name: path.relative(ROOT, file) });
}

const uploadFiles = collectFiles(path.join(ROOT, 'uploads'), ROOT);
for (const file of uploadFiles) {
  archive.file(file, { name: path.relative(ROOT, file) });
}

archive.finalize();

output.on('close', () => {
  console.log('Backup: ' + backupFile);

  const MAX_BACKUPS = 10;
  try {
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
  } catch {}
});

archive.on('error', (err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
