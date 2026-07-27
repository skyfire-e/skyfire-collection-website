#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function main() {
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) return false;
    if (f.startsWith('thumb-')) return false;
    if (f.startsWith('.')) return false;
    return true;
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const fullPath = path.join(UPLOADS_DIR, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const thumbName = 'thumb-' + path.parse(file).name + '.jpg';
    const thumbPath = path.join(UPLOADS_DIR, thumbName);

    if (fs.existsSync(thumbPath)) {
      skipped++;
      if (VERBOSE) console.log('[SKIP] ' + thumbName + ' already exists');
      continue;
    }

    if (DRY_RUN) {
      console.log('[DRY] Would create: ' + thumbName + ' (from ' + file + ')');
      created++;
      continue;
    }

    try {
      await sharp(fullPath, { failOn: 'error', limitInputPixels: 25_000_000 })
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(thumbPath);
      console.log('[OK] Created: ' + thumbName + ' (' + file + ')');
      created++;
    } catch (err) {
      console.error('[ERR] Failed: ' + file + ' - ' + err.message);
      errors++;
    }
  }

  console.log('\nDone: ' + created + ' created, ' + skipped + ' skipped, ' + errors + ' errors');
  if (DRY_RUN) console.log('[DRY RUN] No files were modified');
}

main().catch(err => { console.error(err); process.exit(1); });
