const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.NODE_TEST_DB = '1';

const { findCategory, flattenCategories, envBoolean, validateFinalOrder, parseJSONArray, safeUnlink, validateVersion, validateItemInput, checkImageMagicBytes, hasBytes } = require('../src/helpers');
const { VersionConflictError } = require('../src/errors');
const db = require('../src/db');

describe('envBoolean', () => {
  it('returns fallback for undefined', () => {
    assert.strictEqual(envBoolean(undefined), false);
    assert.strictEqual(envBoolean(undefined, true), true);
  });
  it('accepts truthy strings', () => {
    assert.strictEqual(envBoolean('1'), true);
    assert.strictEqual(envBoolean('true'), true);
    assert.strictEqual(envBoolean('yes'), true);
    assert.strictEqual(envBoolean('on'), true);
  });
  it('rejects falsy strings', () => {
    assert.strictEqual(envBoolean('0'), false);
    assert.strictEqual(envBoolean('false'), false);
    assert.strictEqual(envBoolean('no'), false);
    assert.strictEqual(envBoolean('off'), false);
  });
});

describe('findCategory', () => {
  const cats = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', type: 'group', subcategories: [
      { id: 'b1', label: 'B1' },
      { id: 'b2', label: 'B2', type: 'group', subcategories: [
        { id: 'b2a', label: 'B2A' }
      ]}
    ]},
    { id: 'c', label: 'C' }
  ];

  it('finds root-level category', () => {
    assert.ok(findCategory(cats, 'a'));
    assert.strictEqual(findCategory(cats, 'a').label, 'A');
  });
  it('finds nested category (depth 2)', () => {
    assert.ok(findCategory(cats, 'b1'));
    assert.strictEqual(findCategory(cats, 'b1').label, 'B1');
  });
  it('finds nested category (depth 3)', () => {
    assert.ok(findCategory(cats, 'b2a'));
    assert.strictEqual(findCategory(cats, 'b2a').label, 'B2A');
  });
  it('returns null for missing category', () => {
    assert.strictEqual(findCategory(cats, 'missing'), null);
  });
  it('handles empty array', () => {
    assert.strictEqual(findCategory([], 'x'), null);
  });
});

describe('flattenCategories', () => {
  it('flattens mixed groups and leaf categories, including an entry for the group itself (its root, for direct items)', () => {
    const cats = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', type: 'group', subcategories: [
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' }
      ]}
    ];
    const flat = flattenCategories(cats);
    assert.strictEqual(flat.length, 4);
    assert.strictEqual(flat[0].id, 'a');
    assert.strictEqual(flat[1].id, 'b');
    assert.strictEqual(flat[1].groupLabel, null);
    assert.strictEqual(flat[2].id, 'b1');
    assert.strictEqual(flat[2].groupLabel, 'B');
    assert.strictEqual(flat[3].id, 'b2');
  });
  it('handles nested groups at depth 3, including own-root entries for each group level', () => {
    const cats = [
      { id: 'x', label: 'X', type: 'group', subcategories: [
        { id: 'y', label: 'Y', type: 'group', subcategories: [
          { id: 'z', label: 'Z' }
        ]}
      ]}
    ];
    const flat = flattenCategories(cats);
    assert.strictEqual(flat.length, 3);
    assert.strictEqual(flat[0].id, 'x');
    assert.strictEqual(flat[0].groupLabel, null);
    assert.strictEqual(flat[1].id, 'y');
    assert.strictEqual(flat[1].groupLabel, 'X');
    assert.strictEqual(flat[2].id, 'z');
    assert.strictEqual(flat[2].groupLabel, 'X → Y');
  });
  it('returns empty for no categories', () => {
    assert.deepStrictEqual(flattenCategories([]), []);
  });
  it('group with no children still gets its own entry (can hold items even if empty of subcategories)', () => {
    const cats = [{ id: 'g', label: 'G', type: 'group', subcategories: [] }];
    const flat = flattenCategories(cats);
    assert.strictEqual(flat.length, 1);
    assert.strictEqual(flat[0].id, 'g');
  });
});

describe('validateFinalOrder', () => {
  const oldImages = ['/img/1.jpg', '/img/2.jpg', '/img/3.jpg'];

  it('accepts valid finalOrder', () => {
    assert.strictEqual(validateFinalOrder([0, 1, 2], oldImages, [], []), null);
  });
  it('accepts order with new image + all old', () => {
    assert.strictEqual(validateFinalOrder([-1, 0, 1, 2], oldImages, ['/img/new.jpg'], []), null);
  });
  it('rejects order that silently drops old images', () => {
    assert.strictEqual(validateFinalOrder([-1], oldImages, ['/img/new.jpg'], []),
      'All existing images must be accounted for in finalOrder or removedIndexes');
  });
  it('accepts order that removes all old and adds new', () => {
    assert.strictEqual(validateFinalOrder([-1], oldImages, ['/img/new.jpg'], [0, 1, 2]), null);
  });
  it('rejects duplicate indexes', () => {
    assert.strictEqual(validateFinalOrder([0, 0, 1], oldImages, [], []), 'Duplicate image indexes are not allowed');
  });
  it('rejects out-of-range index', () => {
    assert.strictEqual(validateFinalOrder([0, 999], oldImages, [], []), 'finalOrder references a missing image');
  });
  it('rejects non-integer', () => {
    assert.strictEqual(validateFinalOrder([0, 1.5], oldImages, [], []), 'finalOrder must contain integers');
  });
  it('rejects negative values below -1', () => {
    assert.strictEqual(validateFinalOrder([0, -2], oldImages, [], []), 'finalOrder contains an invalid value');
  });
  it('validates upload slot count matches files', () => {
    assert.strictEqual(validateFinalOrder([0, -1, 1, 2], oldImages, ['/img/new.jpg'], []), null);
    assert.strictEqual(validateFinalOrder([0, -1, 1, 2], oldImages, [], []), 'Uploaded files do not match finalOrder');
    assert.strictEqual(validateFinalOrder([0, -1, 1, 2], oldImages, ['/img/a.jpg', '/img/b.jpg'], []), 'Uploaded files do not match finalOrder');
  });
  it('rejects more than 10 total images', () => {
    const manyImages = Array.from({ length: 15 }, (_, i) => '/img/' + i + '.jpg');
    const order = Array.from({ length: 11 }, (_, i) => i);
    assert.strictEqual(validateFinalOrder(order, manyImages, [], []), 'Maximum 10 images allowed');
  });
  it('rejects order referencing removed images', () => {
    assert.strictEqual(validateFinalOrder([0, 1], oldImages, [], [1]), 'finalOrder references a removed image');
  });
  it('handles order replacing all with new', () => {
    assert.strictEqual(validateFinalOrder([-1], oldImages, ['/img/new.jpg'], [0, 1, 2]), null);
  });
  it('rejects non-array input', () => {
    assert.strictEqual(validateFinalOrder('not-array', oldImages, [], []), 'finalOrder must be an array');
  });
});

describe('parseJSONArray', () => {
  it('parses valid JSON array', () => {
    assert.deepStrictEqual(parseJSONArray('[1,2,3]', 'test'), [1, 2, 3]);
  });
  it('returns empty array for undefined', () => {
    assert.deepStrictEqual(parseJSONArray(undefined, 'test'), []);
  });
  it('throws for non-array JSON', () => {
    assert.throws(() => parseJSONArray('"string"', 'test'), /must be an array/);
  });
  it('throws for invalid JSON', () => {
    assert.throws(() => parseJSONArray('{bad json}', 'test'), /JSON/);
  });
});

describe('SQLite database (in-memory)', () => {
  beforeEach(() => {
    db.db.exec('DELETE FROM items');
    db.db.exec('DELETE FROM categories');
    db.db.exec('DELETE FROM sections');
    db.db.exec('DELETE FROM settings');
    db.db.exec('DELETE FROM audit');
    db.db.exec('DELETE FROM sessions');
  });

  it('starts empty', () => {
    assert.strictEqual(db.allItems().length, 0);
  });
  it('can insert and delete item', () => {
    const testId = 'test-' + Date.now();
    db.insertItem({
      id: testId, section: 'dice', category: 'metal-dice',
      title: 'Test', author: '', price: 0, recaster: '',
      combatPoints: '', status: '', image: '', images: [],
      version: 1, createdAt: new Date().toISOString()
    });
    assert.ok(db.getItem(testId));
    db.deleteItem(testId);
    assert.strictEqual(db.getItem(testId), null);
  });
  it('can filter items by section', () => {
    db.insertItem({
      id: 'test-dice', section: 'dice', category: 'metal-dice',
      title: 'Dice', author: '', price: 0, recaster: '',
      combatPoints: '', status: '', image: '', images: [],
      version: 1, createdAt: ''
    });
    db.insertItem({
      id: 'test-mini', section: 'miniatures', category: 'skaven',
      title: 'Mini', author: '', price: 0, recaster: '',
      combatPoints: '', status: '', image: '', images: [],
      version: 1, createdAt: ''
    });
    const dice = db.getItems('dice');
    assert.strictEqual(dice.length, 1);
    assert.strictEqual(dice[0].section, 'dice');
    db.deleteItem('test-dice');
    db.deleteItem('test-mini');
  });
  it('can save and get categories', () => {
    db.saveCategories({ dice: { label: 'Dice', subcategories: [] } });
    const cats = db.getCategories();
    assert.ok(cats.dice);
    assert.strictEqual(cats.dice.label, 'Dice');
  });
  it('can update settings (null = delete)', () => {
    db.updateSettings({ siteName: 'TestSite' });
    assert.strictEqual(db.getSettings().siteName, 'TestSite');
    db.updateSettings({ siteName: null });
    assert.strictEqual(db.getSettings().siteName, undefined);
  });
  it('can manage sessions', () => {
    db.setSession('test-sid', { user: { role: 'admin' } }, 60000);
    const session = db.getSession('test-sid');
    assert.ok(session);
    assert.strictEqual(session.user.role, 'admin');
    db.destroySession('test-sid');
    assert.strictEqual(db.getSession('test-sid'), null);
  });
  it('expired sessions are cleaned up', () => {
    db.setSession('expired-sid', { user: {} }, -1);
    assert.strictEqual(db.getSession('expired-sid'), null);
  });
  it('audit log works', () => {
    db.appendAudit({ action: 'test.action', id: '123' });
    const count = db.db.prepare('SELECT COUNT(*) as c FROM audit').get().c;
    assert.strictEqual(count, 1);
  });

  it('searches items by title', () => {
    db.saveCategories({ dice: { label: 'Dice', subcategories: [{ id: 'metal-dice', label: 'Metal Dice' }] } });
    db.insertItem({ id: 'search-1', section: 'dice', category: 'metal-dice', title: 'Dragon Sword', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    const result = db.searchItems('Dragon', 10);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.items[0].title, 'Dragon Sword');
  });

  it('search returns empty for no match', () => {
    const result = db.searchItems('zzz_nonexistent_zzz', 10);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.items.length, 0);
  });

  it('search returns sectionLabel and categoryLabel', () => {
    db.saveCategories({ dice: { label: 'Dice', subcategories: [{ id: 'metal-dice', label: 'Metal Dice' }] } });
    db.insertItem({ id: 'search-label', section: 'dice', category: 'metal-dice', title: 'Label Test', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    const result = db.searchItems('Label', 10);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.items[0].sectionLabel, 'Dice');
    assert.strictEqual(result.items[0].categoryLabel, 'Metal Dice');
  });

  it('reorderItems updates sort_order', () => {
    db.insertItem({ id: 'reorder-a', section: 'dice', category: 'metal-dice', title: 'A', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    db.insertItem({ id: 'reorder-b', section: 'dice', category: 'metal-dice', title: 'B', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    db.reorderItems('dice', 'metal-dice', ['reorder-b', 'reorder-a']);
    const items = db.getItems('dice', 'metal-dice');
    assert.strictEqual(items[0].id, 'reorder-b');
    assert.strictEqual(items[1].id, 'reorder-a');
  });

  it('getItemCount returns correct count', () => {
    db.insertItem({ id: 'count-1', section: 'dice', category: 'metal-dice', title: 'C1', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    db.insertItem({ id: 'count-2', section: 'dice', category: 'metal-dice', title: 'C2', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    assert.strictEqual(db.getItemCount('dice', 'metal-dice'), 2);
    assert.strictEqual(db.getItemCount('dice'), 2);
    assert.strictEqual(db.getItemCount('dice', 'nonexistent'), 0);
  });

  it('countImageReferences returns correct count', () => {
    db.insertItem({ id: 'ref-1', section: 'dice', category: 'metal-dice', title: 'R1', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '/uploads/img.jpg', images: ['/uploads/img.jpg'], version: 1, createdAt: '' });
    db.insertItem({ id: 'ref-2', section: 'dice', category: 'metal-dice', title: 'R2', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '', images: [], version: 1, createdAt: '' });
    assert.strictEqual(db.countImageReferences('/uploads/img.jpg', 'ref-1'), 0);
    db.insertItem({ id: 'ref-3', section: 'dice', category: 'metal-dice', title: 'R3', author: '', price: 0, recaster: '', combatPoints: '', status: '', image: '/uploads/img.jpg', images: [], version: 1, createdAt: '' });
    assert.strictEqual(db.countImageReferences('/uploads/img.jpg', 'ref-1'), 1);
  });
});

describe('safeUnlink', () => {
  const fs = require('fs');
  const path = require('path');
  const { UPLOADS_DIR } = require('../src/helpers');

  it('deletes a file in uploads', () => {
    const name = 'safeunlink-test-' + Date.now() + '.jpg';
    const file = path.join(UPLOADS_DIR, name);
    fs.writeFileSync(file, 'x');
    safeUnlink('/uploads/' + name);
    assert.ok(!fs.existsSync(file));
  });
  it('removes thumbnail alongside full-size', () => {
    const name = 'safeunlink-thumb-test-' + Date.now() + '.jpg';
    const full = path.join(UPLOADS_DIR, name);
    const thumb = path.join(UPLOADS_DIR, 'thumb-' + name);
    fs.writeFileSync(full, 'x');
    fs.writeFileSync(thumb, 'x');
    safeUnlink('/uploads/' + name);
    assert.ok(!fs.existsSync(full));
    assert.ok(!fs.existsSync(thumb));
  });
  it('ignores non-uploads paths', () => {
    safeUnlink('/etc/passwd');
    safeUnlink('http://example.com/img.jpg');
  });
  it('ignores empty/null', () => {
    safeUnlink(null);
    safeUnlink('');
    safeUnlink(undefined);
  });
});

describe('validateVersion', () => {
  it('passes when clientVersion is undefined', () => {
    assert.doesNotThrow(() => validateVersion({ version: 1 }, undefined));
  });
  it('passes when item.version is undefined', () => {
    assert.doesNotThrow(() => validateVersion({}, 1));
  });
  it('passes when versions match', () => {
    assert.doesNotThrow(() => validateVersion({ version: 2 }, 2));
  });
  it('throws VersionConflictError on mismatch', () => {
    assert.throws(() => validateVersion({ version: 3 }, 2), VersionConflictError);
  });
});

describe('checkImageMagicBytes', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  it('accepts a valid JPEG', () => {
    const f = path.join(os.tmpdir(), 'test-jpg-' + Date.now() + '.jpg');
    fs.writeFileSync(f, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
    assert.doesNotThrow(() => checkImageMagicBytes(f));
    fs.unlinkSync(f);
  });
  it('accepts a valid PNG (full 8-byte signature)', () => {
    const f = path.join(os.tmpdir(), 'test-png-' + Date.now() + '.png');
    fs.writeFileSync(f, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    assert.doesNotThrow(() => checkImageMagicBytes(f));
    fs.unlinkSync(f);
  });
  it('accepts a valid WebP (RIFF + size + WEBP)', () => {
    const f = path.join(os.tmpdir(), 'test-webp-' + Date.now() + '.webp');
    const riffHeader = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
    const fileSize = Buffer.alloc(4); // 4 bytes size (arbitrary)
    const webpHeader = Buffer.from([0x57, 0x45, 0x42, 0x50]); // WEBP
    fs.writeFileSync(f, Buffer.concat([riffHeader, fileSize, webpHeader]));
    assert.doesNotThrow(() => checkImageMagicBytes(f));
    fs.unlinkSync(f);
  });
  it('rejects WebP without RIFF header', () => {
    const f = path.join(os.tmpdir(), 'test-bad-webp-' + Date.now() + '.webp');
    const wrong = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    fs.writeFileSync(f, wrong);
    assert.throws(() => checkImageMagicBytes(f), /JPEG, PNG or WebP/);
    fs.unlinkSync(f);
  });
  it('rejects WebP without WEBP fourCC', () => {
    const f = path.join(os.tmpdir(), 'test-bad-webp2-' + Date.now() + '.webp');
    const wrong = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    fs.writeFileSync(f, wrong);
    assert.throws(() => checkImageMagicBytes(f), /JPEG, PNG or WebP/);
    fs.unlinkSync(f);
  });
  it('rejects file shorter than 12 bytes for WebP check', () => {
    const f = path.join(os.tmpdir(), 'test-short-' + Date.now() + '.bin');
    fs.writeFileSync(f, Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]));
    assert.throws(() => checkImageMagicBytes(f), /JPEG, PNG or WebP/);
    fs.unlinkSync(f);
  });
  it('rejects non-image bytes', () => {
    const f = path.join(os.tmpdir(), 'test-txt-' + Date.now() + '.txt');
    fs.writeFileSync(f, 'not an image');
    assert.throws(() => checkImageMagicBytes(f), /JPEG, PNG or WebP/);
    fs.unlinkSync(f);
  });
  it('rejects file with less than 4 bytes', () => {
    const f = path.join(os.tmpdir(), 'test-tiny-' + Date.now() + '.bin');
    fs.writeFileSync(f, Buffer.from([0x00, 0x00]));
    assert.throws(() => checkImageMagicBytes(f), /JPEG, PNG or WebP/);
    fs.unlinkSync(f);
  });
});

describe('validateItemInput', () => {
  const cats = {
    dice: { label: 'Dice', subcategories: [{ id: 'metal-dice', label: 'Metal Dice' }] }
  };
  it('accepts valid input', () => {
    const result = validateItemInput({ title: 'Test', section: 'dice', category: 'metal-dice', price: 10 }, cats);
    assert.strictEqual(result.errors, null);
    assert.strictEqual(result.data.title, 'Test');
  });
  it('rejects missing title', () => {
    const result = validateItemInput({ section: 'dice', category: 'metal-dice' }, cats);
    assert.ok(result.errors);
  });
  it('rejects invalid section', () => {
    const result = validateItemInput({ title: 'X', section: 'nope', category: 'metal-dice' }, cats);
    assert.ok(result.errors);
  });
  it('rejects invalid category', () => {
    const result = validateItemInput({ title: 'X', section: 'dice', category: 'nope' }, cats);
    assert.ok(result.errors);
  });
  it('accepts partial update', () => {
    const result = validateItemInput({ title: 'Updated' }, cats, true);
    assert.strictEqual(result.errors, null);
  });
});
