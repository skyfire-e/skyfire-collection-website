#!/usr/bin/env node
/**
 * Orphan file GC — finds and removes uploaded images not referenced in DB.
 * Usage: node gc-uploads.js [--dry-run] [--quarantine]
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DRY_RUN = process.argv.includes('--dry-run');
const QUARANTINE = process.argv.includes('--quarantine');
const QUARANTINE_DIR = path.join(UPLOADS_DIR, '.quarantine');

if (QUARANTINE && !fs.existsSync(QUARANTINE_DIR)) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
}

const db = new Database(path.join(__dirname, 'data', 'collection.db'));
db.pragma('busy_timeout = 5000');
db.pragma('query_only = true');
const dbModule = require('./src/db');
const items = dbModule.allItems();
const settings = dbModule.getSettings();

const referenced = new Set();
for (const item of items) {
  if (item.image && item.image.startsWith('/uploads/')) {
    referenced.add(path.basename(item.image));
    referenced.add('thumb-' + path.basename(item.image));
  }
  for (const img of (item.images || [])) {
    if (img && img.startsWith('/uploads/')) {
      referenced.add(path.basename(img));
      referenced.add('thumb-' + path.basename(img));
    }
  }
}
if (settings.defaultImage && settings.defaultImage.startsWith('/uploads/')) {
  referenced.add(path.basename(settings.defaultImage));
  referenced.add('thumb-' + path.basename(settings.defaultImage));
}

const files = fs.readdirSync(UPLOADS_DIR).filter(f =>
  (f.endsWith('.jpg') || f.endsWith('.webp')) &&
  !f.startsWith('.') &&
  !f.startsWith('thumb-')  // check thumbs separately
);

const thumbs = fs.readdirSync(UPLOADS_DIR).filter(f =>
  f.startsWith('thumb-') && (f.endsWith('.jpg') || f.endsWith('.webp'))
);

let orphans = 0;
let orphanBytes = 0;

function handleOrphan(file) {
  const fullPath = path.join(UPLOADS_DIR, file);
  const size = fs.statSync(fullPath).size;
  orphans++;
  orphanBytes += size;

  if (DRY_RUN) {
    console.log('[DRY] Orphan: ' + file + ' (' + (size / 1024).toFixed(1) + ' KB)');
    return;
  }

  if (QUARANTINE) {
    fs.renameSync(fullPath, path.join(QUARANTINE_DIR, file));
    console.log('Quarantined: ' + file);
  } else {
    fs.unlinkSync(fullPath);
    console.log('Deleted: ' + file);
  }
}

for (const file of files) {
  if (!referenced.has(file)) handleOrphan(file);
}
for (const thumb of thumbs) {
  const original = thumb.replace('thumb-', '');
  if (!referenced.has(thumb) && !referenced.has(original)) handleOrphan(thumb);
}

console.log('\n' + (DRY_RUN ? '[DRY RUN] ' : '') + 'Orphans found: ' + orphans + ' (' + (orphanBytes / 1024 / 1024).toFixed(2) + ' MB)');
if (!DRY_RUN && orphans > 0) {
  console.log(QUARANTINE ? 'Moved to quarantine.' : 'Deleted.');
}
