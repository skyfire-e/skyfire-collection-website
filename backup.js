const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

const opts = [
  '-czf',
  '"' + backupFile + '"',
  '--exclude "uploads/.tmp/*"',
  '--exclude "uploads/.quarantine/*"',
  '--exclude "data/sessions/*"',
  '-C',
  '"' + ROOT + '"',
  'data',
  'uploads'
].join(' ');

execSync('tar ' + opts, { stdio: 'inherit', shell: true });
console.log('Backup: ' + backupFile);
