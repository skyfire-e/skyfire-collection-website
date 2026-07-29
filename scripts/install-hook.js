#!/usr/bin/env node
// Installs scripts/pre-commit.js as the .git/hooks/pre-commit hook.
// Called from "npm install" (postinstall). Safe to re-run; never fails the install.
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production') process.exit(0);

const ROOT = path.resolve(__dirname, '..');
const hooksDir = path.join(ROOT, '.git', 'hooks');
const hookPath = path.join(hooksDir, 'pre-commit');
const target = path.join(ROOT, 'scripts', 'pre-commit.js');

try {
  if (!fs.existsSync(hooksDir)) process.exit(0); // not a git checkout (e.g. tarball install)
  fs.chmodSync(target, 0o755);
  fs.rmSync(hookPath, { force: true }); // also removes a stale/dangling symlink
  try {
    // Relative to .git/hooks/ -> repo root scripts/
    fs.symlinkSync(path.join('..', '..', 'scripts', 'pre-commit.js'), hookPath);
  } catch {
    // e.g. Windows without symlink permissions
    fs.copyFileSync(target, hookPath);
  }
  fs.chmodSync(hookPath, 0o755);
  console.log('[install-hook] pre-commit hook installed');
} catch (err) {
  console.warn('[install-hook] could not install pre-commit hook:', err.message);
}
