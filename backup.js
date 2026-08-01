#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { TarArchive } = require('archiver');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, 'backups');
const EXCLUDE_PATTERNS = [
  path.join('uploads', '.tmp'),
  path.join('uploads', '.quarantine')
];

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function shouldExclude(relativePath, entry) {
  if (entry.isDirectory() && (entry.name === '.tmp' || entry.name === '.quarantine')) {
    return true;
  }
  return EXCLUDE_PATTERNS.some(p => relativePath.startsWith(p + path.sep) || relativePath === p);
}

function collectFiles(dir, baseDir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Backup source directory does not exist: ${dir}`);
  }
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`Backup source is not a directory: ${dir}`);
  }
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, absolutePath);
    if (shouldExclude(relativePath, entry)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, baseDir));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
      continue;
    }
    console.warn(`Skipping unsupported filesystem entry: ${absolutePath}`);
  }
  return files;
}

async function createDatabaseSnapshot(sourcePath, snapshotPath) {
  let sourceDb;
  try {
    sourceDb = new Database(sourcePath, { fileMustExist: true });
    sourceDb.pragma('busy_timeout = 5000');
    await sourceDb.backup(snapshotPath);
  } finally {
    if (sourceDb) {
      sourceDb.close();
    }
  }
}

function verifyDatabaseSnapshot(snapshotPath) {
  let snapshotDb;
  try {
    snapshotDb = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    const result = snapshotDb.pragma('integrity_check', { simple: true });
    if (result !== 'ok') {
      throw new Error(`Snapshot integrity_check failed: ${String(result)}`);
    }
    const itemCount = snapshotDb.prepare('SELECT COUNT(*) AS count FROM items').get().count;
    return { integrity: result, itemCount };
  } finally {
    if (snapshotDb) {
      snapshotDb.close();
    }
  }
}

function getGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function createArchive({ outputPath, files, snapshotPath, snapshotData, root }) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = new TarArchive({ gzip: true });
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      output.destroy();
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (cleanupError) {
        console.error('Failed to remove incomplete archive:', cleanupError);
      }
      reject(error);
    }

    output.on('error', fail);
    archive.on('error', fail);

    output.on('close', () => {
      if (settled) return;
      settled = true;
      const size = fs.statSync(outputPath).size;
      if (size <= 0) {
        reject(new Error('Created backup archive is empty'));
        return;
      }
      resolve({ bytes: archive.pointer(), outputPath });
    });

    archive.pipe(output);

    archive.file(snapshotPath, { name: path.join('data', 'collection.db') });

    for (const file of files) {
      archive.file(file, { name: path.relative(root, file) });
    }

    const manifest = {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      baseCommit: snapshotData.commit,
      database: {
        path: 'data/collection.db',
        integrityCheck: snapshotData.integrity,
        itemCount: snapshotData.itemCount
      },
      uploads: {
        fileCount: files.length
      }
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.finalize();
  });
}

async function main() {
  const dbPath = path.join(ROOT, 'data', 'collection.db');
  if (!fs.existsSync(dbPath)) {
    console.error('collection.db does not exist; nothing to back up');
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skyfire-backup-'));
  let snapshotPath;

  try {
    snapshotPath = path.join(tempDir, 'collection.db');
    console.log('Creating database snapshot...');
    await createDatabaseSnapshot(dbPath, snapshotPath);

    console.log('Verifying snapshot...');
    const snapshotData = verifyDatabaseSnapshot(snapshotPath);
    snapshotData.commit = getGitCommit();
    console.log(`Snapshot verified: ${snapshotData.itemCount} items, integrity ${snapshotData.integrity}`);

    const date = new Date().toISOString().split('T')[0];
    let index = 0;
    let backupFile;
    do {
      const suffix = index === 0 ? '' : '.' + index;
      backupFile = path.join(BACKUP_DIR, 'skyfire-backup-' + date + suffix + '.tar.gz');
      index++;
    } while (fs.existsSync(backupFile));

    console.log('Collecting upload files...');

    const uploadFiles = collectFiles(path.join(ROOT, 'uploads'), ROOT);

    console.log(`Collected ${uploadFiles.length} upload files, creating archive...`);

    await createArchive({
      outputPath: backupFile,
      files: uploadFiles,
      snapshotPath,
      snapshotData,
      root: ROOT
    });

    console.log('Backup created: ' + backupFile);

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
    } catch (rotationError) {
      console.warn('Backup rotation warning:', rotationError.message);
    }
  } catch (error) {
    console.error('Backup failed:', error.message || error);
    process.exit(1);
  } finally {
    // The snapshot may leave -wal/-shm companions next to collection.db,
    // so remove the whole temp directory recursively (rmdir failed with
    // ENOTEMPTY on them before).
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Temporary file cleanup warning:', cleanupError.message);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { createDatabaseSnapshot, verifyDatabaseSnapshot, collectFiles, shouldExclude };
