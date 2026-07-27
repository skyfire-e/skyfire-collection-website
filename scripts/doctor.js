#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const fs = require('fs');

function runDoctor(database) {
  const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
  const issues = [];

  function report(category, severity, message) {
    issues.push({ category, severity, message });
    const icon = severity === 'error' ? '\u2716' : severity === 'warning' ? '\u26a0' : '\u2139';
    console.log(`  ${icon} [${category}] ${message}`);
  }

  function heading(text) {
    console.log(`\n## ${text}`);
  }

  function getSettings() {
    try {
      const row = database.prepare('SELECT value FROM settings WHERE key = ?').get('defaultImage');
      return row ? row.value : null;
    } catch {
      return null;
    }
  }

  heading('Database integrity');
  try {
    const quickCheck = database.pragma('quick_check', { simple: true });
    if (quickCheck === 'ok') {
      report('integrity', 'info', 'quick_check passed');
    } else {
      report('integrity', 'error', 'quick_check failed: ' + String(quickCheck));
    }
  } catch (err) {
    report('integrity', 'error', 'Could not run integrity check: ' + err.message);
  }

  heading('Section/category references');
  try {
    const allItems = database.prepare('SELECT * FROM items').all();
    const catsRaw = database.prepare('SELECT * FROM categories').all();
    const sections = {};
    for (const row of catsRaw) {
      if (!sections[row.section_id]) sections[row.section_id] = {};
      sections[row.section_id][row.id] = row;
    }
    let categoryIssues = 0;
    for (const item of allItems) {
      if (item.section && !sections[item.section]) {
        report('category-ref', 'error', `Item "${item.id}" references unknown section "${item.section}"`);
        categoryIssues++;
      }
      if (item.category && sections[item.section] && !sections[item.section][item.category]) {
        report('category-ref', 'warning', `Item "${item.id}" references unknown category "${item.category}" in section "${item.section}"`);
        categoryIssues++;
      }
    }
    if (categoryIssues === 0) {
      report('category-ref', 'info', `All ${allItems.length} items reference valid sections and categories`);
    }
  } catch (err) {
    report('category-ref', 'error', 'Could not check references: ' + err.message);
  }

  heading('Image file references');
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      report('images', 'info', 'No uploads directory — skipping image file checks');
    } else {
      const allItems = database.prepare('SELECT id, image, images FROM items').all();
      const onDisk = new Set(fs.readdirSync(UPLOADS_DIR));
      const referenced = new Set();
      let missingFiles = 0;
      let missingThumbs = 0;

      for (const item of allItems) {
        let imgArr;
        try { imgArr = JSON.parse(item.images || '[]'); } catch { imgArr = []; }
        const paths = [item.image, ...imgArr].filter(Boolean);
        for (const p of paths) {
          if (p.startsWith('/uploads/')) {
            const basename = path.basename(p);
            referenced.add(basename);
            if (!onDisk.has(basename)) {
              report('images', 'error', `Item "${item.id}" references missing file: ${basename}`);
              missingFiles++;
            }
            const thumb = 'thumb-' + basename;
            if (!onDisk.has(thumb)) {
              report('images', 'warning', `Missing thumbnail for: ${basename}`);
              missingThumbs++;
            }
          }
        }
      }

      if (missingFiles === 0) report('images', 'info', `All ${referenced.size} referenced image files exist on disk`);
      if (missingThumbs === 0) report('images', 'info', 'All thumbnails present');
    }
  } catch (err) {
    report('images', 'error', 'Could not check image files: ' + err.message);
  }

  heading('Orphaned files');
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      report('orphans', 'info', 'No uploads directory — skipping orphan check');
    } else {
      const allItems = database.prepare('SELECT image, images FROM items').all();
      const settings = getSettings();
      const referenced = new Set();
      for (const item of allItems) {
        let imgArr;
        try { imgArr = JSON.parse(item.images || '[]'); } catch { imgArr = []; }
        const paths = [item.image, ...imgArr].filter(Boolean);
        for (const p of paths) {
          if (p.startsWith('/uploads/')) {
            referenced.add(path.basename(p));
            referenced.add('thumb-' + path.basename(p));
          }
        }
      }
      if (settings && settings.startsWith('/uploads/')) {
        referenced.add(path.basename(settings));
        referenced.add('thumb-' + path.basename(settings));
      }
      const files = fs.readdirSync(UPLOADS_DIR).filter(f =>
        !f.startsWith('.') && (f.endsWith('.jpg') || f.endsWith('.webp'))
      );
      let orphanCount = 0;
      for (const file of files) {
        if (!referenced.has(file)) {
          report('orphans', 'warning', `Orphaned file: ${file}`);
          orphanCount++;
        }
      }
      if (orphanCount === 0) report('orphans', 'info', 'No orphaned files');
    }
  } catch (err) {
    report('orphans', 'error', 'Could not check orphans: ' + err.message);
  }

  return issues;
}

if (require.main === module) {
  const Database = require('better-sqlite3');
  const ROOT = path.resolve(__dirname, '..');
  const DB_FILE = path.join(ROOT, 'data', 'collection.db');

  if (!fs.existsSync(DB_FILE)) {
    console.error('Database not found at', DB_FILE);
    process.exit(2);
  }

  let db;
  try {
    db = new Database(DB_FILE, { readonly: true });
  } catch (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }

  const issues = runDoctor(db);
  db.close();

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  console.log('\n## Summary');
  console.log(`  Errors:   ${errors}`);
  console.log(`  Warnings: ${warnings}`);
  console.log(`  Info:     ${issues.filter(i => i.severity === 'info').length}`);

  if (errors > 0) {
    console.log('\n\u2716 Some checks failed');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n\u26a0 Passed with warnings');
    process.exit(0);
  } else {
    console.log('\n\u2714 All checks passed');
    process.exit(0);
  }
}

module.exports = { runDoctor };
