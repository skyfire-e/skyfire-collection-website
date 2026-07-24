const { describe, it } = require('node:test');
const assert = require('node:assert');

const { findCategory, flattenCategories, envBoolean, validateFinalOrder, parseJSONArray } = require('../src/helpers');
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
  it('flattens mixed groups and leaf categories', () => {
    const cats = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', type: 'group', subcategories: [
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' }
      ]}
    ];
    const flat = flattenCategories(cats);
    assert.strictEqual(flat.length, 3);
    assert.strictEqual(flat[0].id, 'a');
    assert.strictEqual(flat[1].id, 'b1');
    assert.strictEqual(flat[1].groupLabel, 'B');
    assert.strictEqual(flat[2].id, 'b2');
  });
  it('handles nested groups at depth 3', () => {
    const cats = [
      { id: 'x', label: 'X', type: 'group', subcategories: [
        { id: 'y', label: 'Y', type: 'group', subcategories: [
          { id: 'z', label: 'Z' }
        ]}
      ]}
    ];
    const flat = flattenCategories(cats);
    assert.strictEqual(flat.length, 1);
    assert.strictEqual(flat[0].id, 'z');
    assert.strictEqual(flat[0].groupLabel, 'X → Y');
  });
  it('returns empty for no categories', () => {
    assert.deepStrictEqual(flattenCategories([]), []);
  });
});

describe('validateFinalOrder', () => {
  const oldImages = ['/img/1.jpg', '/img/2.jpg', '/img/3.jpg'];

  it('accepts valid finalOrder', () => {
    assert.strictEqual(validateFinalOrder([0, 1, 2], oldImages, [], []), null);
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
    assert.strictEqual(validateFinalOrder([0, -1, 1], oldImages, ['/img/new.jpg'], []), null);
    assert.strictEqual(validateFinalOrder([0, -1, 1], oldImages, [], []), 'Uploaded files do not match finalOrder');
    assert.strictEqual(validateFinalOrder([0, -1, 1], oldImages, ['/img/a.jpg', '/img/b.jpg'], []), 'Uploaded files do not match finalOrder');
  });
  it('rejects more than 10 total images', () => {
    const manyImages = Array.from({ length: 15 }, (_, i) => '/img/' + i + '.jpg');
    const order = Array.from({ length: 11 }, (_, i) => i);
    assert.strictEqual(validateFinalOrder(order, manyImages, [], []), 'Maximum 10 images allowed');
  });
  it('rejects order referencing removed images', () => {
    assert.strictEqual(validateFinalOrder([0, 1], oldImages, [], [1]), 'finalOrder references a removed image');
  });
  it('handles empty order with uploads', () => {
    assert.strictEqual(validateFinalOrder([-1], oldImages, ['/img/new.jpg'], []), null);
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

describe('SQLite database', () => {
  it('has migrated items', () => {
    const items = db.allItems();
    assert.ok(items.length > 600);
  });
  it('has categories', () => {
    const cats = db.getCategories();
    assert.ok(cats.dice);
    assert.ok(cats.miniatures);
    assert.strictEqual(cats.dice.label, 'Dice');
  });
  it('has settings', () => {
    const settings = db.getSettings();
    assert.ok(settings.siteName);
    assert.ok(settings.defaultImage);
  });
  it('can filter items by section', () => {
    const dice = db.getItems('dice');
    assert.ok(dice.length > 0);
    assert.ok(dice.every(i => i.section === 'dice'));
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
  it('can update settings', () => {
    db.updateSettings({ testKey: 'testValue' });
    const settings = db.getSettings();
    assert.strictEqual(settings.testKey, 'testValue');
    db.updateSettings({ testKey: null });
  });
  it('can manage sessions', () => {
    db.setSession('test-sid', { user: { role: 'admin' } }, 60000);
    const session = db.getSession('test-sid');
    assert.ok(session);
    assert.strictEqual(session.user.role, 'admin');
    db.destroySession('test-sid');
    assert.strictEqual(db.getSession('test-sid'), null);
  });
});
