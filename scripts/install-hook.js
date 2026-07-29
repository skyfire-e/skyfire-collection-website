#!/usr/bin/env node
// Installs scripts/pre-commit.js as the git pre-commit hook.
// Called from "npm install" (postinstall). Safe to re-run; never fails the install.
// B6 fix: resolves the hooks dir via git (works in worktrees, where .git is a
// file) and never overwrites a hook we did not install ourselves.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.env.NODE_ENV === 'production') process.exit(0);

const ROOT = path.resolve(__dirname, '..');
const target = path.join(ROOT, 'scripts', 'pre-commit.js');

let hooksDir;
try {
  const rel = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  hooksDir = path.resolve(ROOT, rel);
} catch {
  process.exit(0); // not a git checkout (e.g. tarball install) or git missing
}

const hookPath = path.join(hooksDir, 'pre-commit');

// A hook is "ours" if it's a symlink to scripts/pre-commit.js (even a stale
// one) or a copy of our script. Anything else (husky shim, hand-written hook)
// must not be silently destroyed.
function classifyExistingHook() {
  let stats;
  try {
    stats = fs.lstatSync(hookPath);
  } catch (err) {
    if (err.code === 'ENOENT') return 'absent';
    throw err;
  }
  if (stats.isSymbolicLink()) {
    const linkTarget = path.resolve(path.dirname(hookPath), fs.readlinkSync(hookPath));
    return linkTarget === target ? 'ours' : 'foreign';
  }
  try {
    return fs.readFileSync(hookPath, 'utf8').includes('[pre-commit]') ? 'ours' : 'foreign';
  } catch {
    return 'foreign';
  }
}

try {
  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
  fs.chmodSync(target, 0o755);

  const existing = classifyExistingHook();
  if (existing === 'foreign') {
    console.warn('[install-hook] A pre-commit hook not managed by this project already exists at ' + hookPath);
    console.warn('[install-hook] Not overwriting it. Make it run "node scripts/pre-commit.js" manually,');
    console.warn('[install-hook] or remove it and re-run "npm install".');
    process.exit(0);
  }
  if (existing === 'ours') fs.rmSync(hookPath, { force: true }); // also removes a stale/dangling symlink

  try {
    fs.symlinkSync(path.relative(hooksDir, target), hookPath);
  } catch {
    // e.g. Windows without symlink permissions
    fs.copyFileSync(target, hookPath);
  }
  fs.chmodSync(hookPath, 0o755);
  console.log('[install-hook] pre-commit hook installed');
} catch (err) {
  console.warn('[install-hook] could not install pre-commit hook:', err.message);
}
