#!/usr/bin/env node
/**
 * Safe commit + push: WAL checkpoint → clear sessions → git add → commit → push
 * Usage: node deploy.js "commit message"
 *        node deploy.js              (auto-generates message with timestamp)
 */
require('dotenv').config();
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');

const ROOT = path.resolve(__dirname);
const DB_FILE = path.join(ROOT, 'data', 'collection.db');

// 1. WAL checkpoint + clear sessions
console.log('📦 Running WAL checkpoint...');
const db = new Database(DB_FILE);
db.prepare('DELETE FROM sessions').run();
db.pragma('wal_checkpoint(TRUNCATE)');
const itemCount = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
db.close();
console.log('   Sessions cleared, WAL checkpoint done, ' + itemCount + ' items in DB');

// 2. Git add
console.log('📝 Staging files...');
execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });

// Check if there are staged changes
const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
if (!status) {
  console.log('✅ Nothing to commit — working tree clean');
  process.exit(0);
}

// 3. Commit
const msg = process.argv[2] || 'Auto-deploy: ' + new Date().toISOString().replace('T', ' ').slice(0, 19);
console.log('💾 Committing: "' + msg + '"');
execSync('git commit -m "' + msg + '"', { cwd: ROOT, stdio: 'pipe' });

// 4. Push
console.log('🚀 Pushing to origin...');
try {
  const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
  execSync('git push origin ' + branch, { cwd: ROOT, stdio: 'inherit' });
  console.log('✅ Deploy complete: ' + itemCount + ' items pushed to origin/' + branch);
} catch (err) {
  console.error('❌ Push failed. Run manually: git push origin ' + 
    execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim());
  process.exit(1);
}
