const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { ValidationError, DataCorruptionError, VersionConflictError } = require('./errors');
const { itemInputSchema, itemInputPartialSchema } = require('../lib/validate');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const UPLOADS_DIR = path.resolve(ROOT, 'uploads');
const TEMP_DIR = path.join(UPLOADS_DIR, '.tmp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function envBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const secureCookies = envBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production');

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    console.error('Corrupted JSON in ' + file + ':', e.message);
    throw new DataCorruptionError(file);
  }
}

function writeJSONAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw error;
  }
}

function safeUnlink(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return;
  const target = path.resolve(UPLOADS_DIR, path.basename(imgPath));
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return;
  try { fs.unlinkSync(target); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  for (const f of Array.isArray(files) ? files : [files]) {
    try { fs.unlinkSync(f.path); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
  }
}

async function normalizeImage(file) {
  const filename = crypto.randomUUID() + '.jpg';
  const destination = path.join(UPLOADS_DIR, filename);
  try {
    await sharp(file.path, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(destination);
  } finally {
    try { fs.unlinkSync(file.path); } catch {}
  }
  return '/uploads/' + filename;
}

function findCategory(subcategories, targetId) {
  for (const cat of subcategories || []) {
    if (cat.id === targetId) return cat;
    const nested = findCategory(cat.subcategories, targetId);
    if (nested) return nested;
  }
  return null;
}

function flattenCategories(subcategories, ancestors = []) {
  return (subcategories || []).flatMap(cat => {
    const path = [...ancestors, cat.label];
    if (cat.type === 'group' && cat.subcategories?.length) {
      return flattenCategories(cat.subcategories, path);
    }
    return [{
      id: cat.id,
      label: cat.label,
      path,
      groupLabel: ancestors.length > 0 ? ancestors.join(' → ') : null
    }];
  });
}

function validateItemInput(body, cats, partial) {
  const schema = partial ? itemInputPartialSchema : itemInputSchema;
  const result = schema.safeParse(body);
  const errors = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(issue.message);
    }
  }

  const section = body.section !== undefined ? String(body.section).trim() : undefined;
  const category = body.category !== undefined ? String(body.category).trim() : undefined;

  if (!partial || body.section !== undefined) {
    if (section && !cats[section]) errors.push('Section "' + section + '" does not exist');
  }
  if (!partial || body.category !== undefined) {
    if (category && section && cats[section] && !findCategory(cats[section].subcategories, category)) {
      errors.push('Category "' + category + '" does not exist in section "' + section + '"');
    }
  }

  if (errors.length > 0) return { errors, data: null };
  return { errors: null, data: result.data };
}

function validateFinalOrder(order, oldImages, uploadedFiles, removedIndexes) {
  if (!Array.isArray(order)) return 'finalOrder must be an array';
  if (!order.every(Number.isInteger)) return 'finalOrder must contain integers';
  if (order.some(v => v < -1)) return 'finalOrder contains an invalid value';

  const existingIndexes = order.filter(v => v >= 0);
  if (new Set(existingIndexes).size !== existingIndexes.length) return 'Duplicate image indexes are not allowed';

  if (existingIndexes.some(idx => idx >= oldImages.length)) return 'finalOrder references a missing image';

  if (removedIndexes && existingIndexes.some(idx => removedIndexes.includes(idx))) {
    return 'finalOrder references a removed image';
  }

  const uploadSlots = order.filter(v => v === -1).length;
  if (uploadSlots !== uploadedFiles.length) return 'Uploaded files do not match finalOrder';

  if (order.length > 10) return 'Maximum 10 images allowed';
  return null;
}

function parseJSONArray(value, fieldName) {
  if (value === undefined) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error(fieldName + ' must be an array');
    return parsed;
  } catch (e) {
    const err = new Error(e.message || 'Invalid JSON for ' + fieldName);
    err.statusCode = 400;
    err.field = fieldName;
    throw err;
  }
}

function validateVersion(item, clientVersion) {
  if (clientVersion !== undefined && item.version !== undefined && Number(clientVersion) !== item.version) {
    throw new VersionConflictError();
  }
}

function appendAudit(entry) {
  const logs = (() => { try { return JSON.parse(require('fs').readFileSync(AUDIT_FILE, 'utf8')); } catch { return []; } })();
  logs.push({ timestamp: new Date().toISOString(), ...entry });
  try { require('fs').writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8'); } catch (e) { console.error('Audit write failed:', e.message); }
}

let writeQueue = Promise.resolve();

function withDataLock(operation) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.catch(() => {});
  return result;
}

module.exports = {
  ROOT, DATA_DIR, ITEMS_FILE, CATEGORIES_FILE, SETTINGS_FILE, AUDIT_FILE, UPLOADS_DIR, TEMP_DIR,
  envBoolean, secureCookies,
  readJSON, writeJSONAtomic,
  safeUnlink, cleanupUploadedFiles,
  normalizeImage, findCategory, flattenCategories,
  validateItemInput, validateFinalOrder, parseJSONArray,
  validateVersion, appendAudit,
  withDataLock
};
