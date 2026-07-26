const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { VersionConflictError } = require('./errors');
const { itemInputSchema, itemInputPartialSchema } = require('../lib/validate');

const ROOT = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.resolve(ROOT, 'uploads');
const TEMP_DIR = path.join(UPLOADS_DIR, '.tmp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function envBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const secureCookies = envBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production');

function safeUnlink(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return;
  const basename = path.basename(imgPath);
  const target = path.resolve(UPLOADS_DIR, basename);
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return;
  try { fs.unlinkSync(target); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
  const thumb = path.join(UPLOADS_DIR, 'thumb-' + basename);
  try { fs.unlinkSync(thumb); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  for (const f of Array.isArray(files) ? files : [files]) {
    try { fs.unlinkSync(f.path); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
  }
}

async function normalizeImage(file) {
  const id = crypto.randomUUID();
  const filename = id + '.jpg';
  const thumbFilename = 'thumb-' + id + '.jpg';
  const destination = path.join(UPLOADS_DIR, filename);
  const thumbDestination = path.join(UPLOADS_DIR, thumbFilename);
  try {
    const pipeline = sharp(file.path, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate();
    await Promise.all([
      pipeline.clone()
        .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(destination),
      pipeline.clone()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(thumbDestination)
    ]);
  } catch (err) {
    try { fs.unlinkSync(destination); } catch {}
    try { fs.unlinkSync(thumbDestination); } catch {}
    throw err;
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
    const p = [...ancestors, cat.label];
    if (cat.type === 'group' && cat.subcategories?.length) {
      return flattenCategories(cat.subcategories, p);
    }
    return [{
      id: cat.id,
      label: cat.label,
      path: p,
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

module.exports = {
  ROOT, UPLOADS_DIR, TEMP_DIR,
  envBoolean, secureCookies,
  safeUnlink, cleanupUploadedFiles,
  normalizeImage, findCategory, flattenCategories,
  validateItemInput, validateFinalOrder, parseJSONArray,
  validateVersion,
  toNumber
};
