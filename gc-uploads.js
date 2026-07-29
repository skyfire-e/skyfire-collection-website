#!/usr/bin/env node
/**
 * Orphan file GC — finds and removes uploaded images not referenced in DB.
 * Usage: node gc-uploads.js [--dry-run] [--quarantine]
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DRY_RUN = process.argv.includes('--dry-run');
const QUARANTINE = process.argv.includes('--quarantine');
const QUARANTINE_DIR = path.join(UPLOADS_DIR, '.quarantine');

if (QUARANTINE && !fs.existsSync(QUARANTINE_DIR)) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
}

const appDb = require('./src/db');
const items = appDb.allItems();
const settings = appDb.getSettings();

const referenced = new Set();
function addReference(imgPath) {
  const base = path.basename(imgPath);
  referenced.add(base);
  referenced.add('thumb-' + base);
  // Legacy: scripts/backfill-thumbnails.js always wrote thumb-<name>.jpg,
  // even for .webp/.png originals — keep those thumbs too.
  referenced.add('thumb-' + base.replace(/\.[^.]+$/, '') + '.jpg');
}
for (const item of items) {
  if (item.image && item.image.startsWith('/uploads/')) {
    addReference(item.image);
  }
  for (const img of (item.images || [])) {
    if (img && img.startsWith('/uploads/')) {
      addReference(img);
    }
  }
}
if (settings.defaultImage && settings.defaultImage.startsWith('/uploads/')) {
  addReference(settings.defaultImage);
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
appDb.db.close();
