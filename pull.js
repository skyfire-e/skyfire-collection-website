#!/usr/bin/env node
/**
 * Pull from GitHub: fetch → merge → install deps if needed → restart hint
 * Usage: node pull.js
 * Run this on the remote server after pushing from another machine.
 */
const { execSync, execFileSync } = require('child_process');
const path = require('path');

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 22) {
  console.error('Node.js >= 22 required, current: ' + process.version);
  process.exit(1);
}

const ROOT = path.resolve(__dirname);

console.log('⬇️  Fetching from origin...');
execSync('git fetch origin', { cwd: ROOT, stdio: 'inherit' });

const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
console.log('📍 Current branch: ' + branch);

const status = execSync('git status --porcelain -uno', { cwd: ROOT, encoding: 'utf8' }).trim();
if (status) {
  console.log('⚠️  Local uncommitted changes detected — pulling may cause conflicts');
  // collection.db is a tracked BINARY file: pulling while it has local changes
  // can end in a binary merge conflict that corrupts the database. Abort.
  const dbDirty = status.split('\n').some(line => line.includes('collection.db'));
  if (dbDirty && !process.argv.includes('--force')) {
    console.error('❌ data/collection.db has uncommitted local changes — aborting pull.');
    console.error('   Commit it first (WAL checkpoint + git commit), or re-run with:');
    console.error('   node pull.js --force');
    process.exit(1);
  }
}

console.log('📥 Pulling...');
try {
  execFileSync('git', ['pull', 'origin', branch], { cwd: ROOT, stdio: 'inherit' });
} catch (err) {
  console.error('❌ Pull failed. Check for conflicts:');
  console.error(err.stderr || err.message);
  process.exit(1);
}

// Check what changed (safe for shallow clones)
function getChangedFiles() {
  try {
    return execSync('git diff ORIG_HEAD HEAD --name-only', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  } catch {
    return [];
  }
}
const changedFiles = getChangedFiles();
const lockChanged = changedFiles.some(f => f.includes('package-lock.json') || f.includes('package.json'));

if (lockChanged) {
  console.log('📦 Dependencies changed, running npm install...');
  execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
}

const dbChanged = changedFiles.some(f => f.includes('collection.db'));

if (dbChanged) {
  console.log('💾 Database updated from remote');
}

console.log('');
console.log('✅ Pull complete. Restart the server:');
if (process.platform === 'win32') {
  console.log('   netstat -ano | findstr :3000');
  console.log('   taskkill /PID <PID> /F');
  console.log('   node server.js');
} else {
  console.log('   kill $(lsof -t -i:3000) 2>/dev/null; node server.js');
}
console.log('');
console.log('   Or if using pm2:');
console.log('   pm2 restart skyfire');
