const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { VersionConflictError, ValidationError } = require('./errors');
const { itemInputSchema } = require('../lib/validate');

const ROOT = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.resolve(ROOT, 'uploads');
const TEMP_DIR = path.join(UPLOADS_DIR, '.tmp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function envBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function getSecureCookies() {
  return envBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production');
}

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

function hasBytes(buffer, offset, bytes) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (offset < 0 || buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function checkImageMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(12);
  let bytesRead;
  try {
    bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (bytesRead < 4) {
    throw new ValidationError('File does not appear to be a valid JPEG, PNG or WebP image');
  }
  const isJpeg = hasBytes(buffer, 0, [0xFF, 0xD8, 0xFF]);
  const isPng = hasBytes(buffer, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const isWebP = bytesRead >= 12 && hasBytes(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(buffer, 8, [0x57, 0x45, 0x42, 0x50]);
  if (!isJpeg && !isPng && !isWebP) {
    throw new ValidationError('File does not appear to be a valid JPEG, PNG or WebP image');
  }
}

async function normalizeImage(file) {
  const id = crypto.randomUUID();
  const filename = id + '.jpg';
  const thumbFilename = 'thumb-' + id + '.jpg';
  const destination = path.join(UPLOADS_DIR, filename);
  const thumbDestination = path.join(UPLOADS_DIR, thumbFilename);
  try {
    checkImageMagicBytes(file.path);
    const pipeline = sharp(file.path, { failOn: 'error', limitInputPixels: 25_000_000 })
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
    const groupLabel = ancestors.length > 0 ? ancestors.join(' → ') : null;
    if (cat.type === 'group') {
      // The group itself can hold items directly (its "root"), in addition to its children
      const ownEntry = { id: cat.id, label: cat.label, path: p, groupLabel };
      const childEntries = cat.subcategories?.length ? flattenCategories(cat.subcategories, p) : [];
      return [ownEntry, ...childEntries];
    }
    return [{ id: cat.id, label: cat.label, path: p, groupLabel }];
  });
}

function validateItemInput(body, cats) {
  const result = itemInputSchema.safeParse(body);
  const errors = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(issue.message);
    }
  }

  const section = body.section !== undefined ? String(body.section).trim() : undefined;
  const category = body.category !== undefined ? String(body.category).trim() : undefined;

  if (section && !cats[section]) errors.push('Section "' + section + '" does not exist');
  if (category && section && cats[section] && !findCategory(cats[section].subcategories, category)) {
    errors.push('Category "' + category + '" does not exist in section "' + section + '"');
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

  const removed = removedIndexes || [];
  if (existingIndexes.some(idx => removed.includes(idx))) {
    return 'finalOrder references a removed image';
  }

  const uploadSlots = order.filter(v => v === -1).length;
  if (uploadSlots !== uploadedFiles.length) return 'Uploaded files do not match finalOrder';

  if (order.length > 10) return 'Maximum 10 images allowed';

  const allOldIndexes = new Set(oldImages.keys());
  const accounted = new Set([...existingIndexes, ...removed]);
  if (allOldIndexes.size !== accounted.size ||
      [...allOldIndexes].some(idx => !accounted.has(idx))) {
    return 'All existing images must be accounted for in finalOrder or removedIndexes';
  }

  return null;
}

function parseJSONArray(value, fieldName) {
  if (value === undefined) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error(fieldName + ' must be an array');
    return parsed;
  } catch (e) {
    throw new ValidationError(e.message || 'Invalid JSON for ' + fieldName);
  }
}

function validateVersion(item, clientVersion) {
  if (clientVersion !== undefined && item.version !== undefined && Number(clientVersion) !== item.version) {
    throw new VersionConflictError();
  }
}

/**
 * Parse a JSON string, returning the fallback on any error.
 * @param {string} value
 * @param {*} fallback
 */
function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

// Reserved top-level paths that can never be used as section IDs
const STATIC_ROUTES = ['admin', 'gallery', 'dice', 'miniatures', 'spreadsheet', 'health', 'css', 'js', 'images', 'uploads', 'vendor'];

module.exports = {
  ROOT, UPLOADS_DIR, TEMP_DIR,
  envBoolean, getSecureCookies,
  safeUnlink, cleanupUploadedFiles,
  normalizeImage, findCategory, flattenCategories,
  validateItemInput, validateFinalOrder, parseJSONArray,
  validateVersion,
  checkImageMagicBytes, hasBytes,
  STATIC_ROUTES,
  safeJsonParse
};
