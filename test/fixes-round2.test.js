// Regression tests for audit round 2 fixes (A1-A8)
// Separate file: runs in its own process => fresh rate-limiter state
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_TEST_DB = '1';
process.env.SESSION_SECRET = 'test-secret-for-fix-round2-minimum-32-chars';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.ADMIN_USERNAME = 'admin';

const supertest = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { VersionConflictError } = require('../src/errors');

const ORIGIN = { Origin: 'http://127.0.0.1:3000', Host: '127.0.0.1:3000' };
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const TEST_DEFAULT = '/uploads/test-a2-default-image.jpg';
const TEST_DEFAULT_FILE = path.join(UPLOADS_DIR, 'test-a2-default-image.jpg');

before(() => {
  db.saveCategories({
    dice: { label: 'Dice', subcategories: [{ id: 'metal-dice', label: 'Metal Dice' }] }
  });
});

after(() => {
  if (fs.existsSync(TEST_DEFAULT_FILE)) fs.unlinkSync(TEST_DEFAULT_FILE);
});

describe('A1: login must not crash on non-string password (plaintext mode)', () => {
  const cases = [
    ['null password', { username: 'admin', password: null }],
    ['missing password', { username: 'admin' }],
    ['numeric password', { username: 'admin', password: 12345 }],
    ['object password', { username: 'admin', password: { a: 1 } }]
  ];
  for (const [name, body] of cases) {
    it(name + ' returns 401, process survives', async () => {
      const res = await supertest(app).post('/api/auth/login').set(ORIGIN).send(body);
      assert.strictEqual(res.status, 401);
    });
  }

  it('multibyte password of same char-length returns 401 (no RangeError)', async () => {
    // 'admin123' is 8 chars; 'парол123' is 8 chars but more UTF-8 bytes
    const res = await supertest(app).post('/api/auth/login').set(ORIGIN)
      .send({ username: 'admin', password: 'парол123' });
    assert.strictEqual(res.status, 401);
  });
});

describe('A5: GET /api/items rejects non-string query params', () => {
  it('repeated q param (?q=a&q=b) returns 400, not 500', async () => {
    const res = await supertest(app).get('/api/items?q=a&q=b');
    assert.strictEqual(res.status, 400);
  });

  it('bracketed q param (?q[a]=1) returns 400, not 500', async () => {
    const res = await supertest(app).get('/api/items?q[a]=1');
    assert.strictEqual(res.status, 400);
  });

  it('array section param returns 400, not 500', async () => {
    const res = await supertest(app).get('/api/items?section=a&section=b');
    assert.strictEqual(res.status, 400);
  });

  it('plain string params still work', async () => {
    const res = await supertest(app).get('/api/items?section=dice');
    assert.strictEqual(res.status, 200);
  });
});

describe('A3: updateItem on deleted item throws VersionConflictError', () => {
  it('throws instead of silent success', () => {
    assert.throws(
      () => db.updateItem('no-such-id', { title: 'ghost', version: 2 }, 1),
      VersionConflictError
    );
  });
});

describe('Reorder accepts legacy (non-UUID) item IDs', () => {
  let agent;

  before(async () => {
    agent = supertest.agent(app);
    const res = await agent.post('/api/auth/login').set(ORIGIN)
      .send({ username: 'admin', password: 'admin123' });
    assert.strictEqual(res.status, 200);

    db.insertItem({
      id: '1784583148001', section: 'dice', category: 'metal-dice',
      title: 'Legacy One', author: '', price: null, recaster: '', combatPoints: '', status: '',
      image: '', images: [], version: 1, createdAt: new Date().toISOString()
    });
    db.insertItem({
      id: '1784583148002', section: 'dice', category: 'metal-dice',
      title: 'Legacy Two', author: '', price: null, recaster: '', combatPoints: '', status: '',
      image: '', images: [], version: 1, createdAt: new Date().toISOString()
    });
  });

  it('legacy timestamp IDs pass validation and reorder succeeds', async () => {
    const res = await agent.post('/api/items/reorder').set(ORIGIN)
      .send({ section: 'dice', category: 'metal-dice', items: ['1784583148002', '1784583148001'] });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it('garbage IDs are still rejected', async () => {
    const res = await agent.post('/api/items/reorder').set(ORIGIN)
      .send({ section: 'dice', category: 'metal-dice', items: ['../../etc/passwd'] });
    assert.strictEqual(res.status, 400);
  });
});

describe('A7: saveCategories maps tree errors to ValidationError (400, not 500)', () => {
  it('leaf with children throws ValidationError with status 400', () => {
    try {
      db.saveCategories({
        dice: { label: 'Dice', subcategories: [
          { id: 'bad-leaf', label: 'Bad Leaf', subcategories: [{ id: 'child', label: 'Child' }] }
        ]}
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert.match(err.message, /Leaf category/);
    }
  });

  it('nested groups throw ValidationError with status 400', () => {
    try {
      db.saveCategories({
        dice: { label: 'Dice', subcategories: [
          { id: 'g1', label: 'G1', type: 'group', subcategories: [
            { id: 'g2', label: 'G2', type: 'group', subcategories: [] }
          ]}
        ]}
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert.match(err.message, /Nested groups/);
    }
  });
});

describe('A2 + A6: admin flows', () => {
  let agent;

  before(async () => {
    agent = supertest.agent(app);
    const res = await agent.post('/api/auth/login').set(ORIGIN)
      .send({ username: 'admin', password: 'admin123' });
    assert.strictEqual(res.status, 200);
  });

  it('A6: PUT /api/settings rejects oversized siteName', async () => {
    const res = await agent.put('/api/settings').set(ORIGIN)
      .send({ siteName: 'x'.repeat(500) });
    assert.strictEqual(res.status, 400);
  });

  it('A6: PUT /api/settings rejects non-local defaultImage path', async () => {
    const res = await agent.put('/api/settings').set(ORIGIN)
      .send({ defaultImage: 'https://evil.example/x.jpg' });
    assert.strictEqual(res.status, 400);
  });

  it('A6: PUT /api/settings accepts valid local defaultImage', async () => {
    const res = await agent.put('/api/settings').set(ORIGIN)
      .send({ defaultImage: TEST_DEFAULT });
    assert.strictEqual(res.status, 200);
  });

  it('A2: deleting an item does not unlink the shared default image file', async () => {
    fs.writeFileSync(TEST_DEFAULT_FILE, 'fake-jpeg-bytes');
    db.updateSettings({ defaultImage: TEST_DEFAULT });

    db.insertItem({
      id: 'a2-item', section: 'dice', category: 'metal-dice',
      title: 'A2 Item', author: '', price: null, recaster: '', combatPoints: '', status: '',
      image: TEST_DEFAULT, images: [],
      version: 1, createdAt: new Date().toISOString()
    });

    const res = await agent.delete('/api/items/a2-item').set(ORIGIN).send({ version: 1 });
    assert.strictEqual(res.status, 200);
    assert.ok(fs.existsSync(TEST_DEFAULT_FILE), 'default image file must survive item deletion');
  });
});

describe('Category reorder: POST /api/categories/reorder', () => {
  let agent;

  before(async () => {
    agent = supertest.agent(app);
    const res = await agent.post('/api/auth/login').set(ORIGIN)
      .send({ username: 'admin', password: 'admin123' });
    assert.strictEqual(res.status, 200);

    db.saveCategories({
      dice: { label: 'Dice', subcategories: [
        { id: 'metal-dice', label: 'Metal Dice' },
        { id: 'stone-dice', label: 'Stone Dice' }
      ]},
      miniatures: { label: 'Miniatures', subcategories: [
        { id: 'skaven', label: 'Skaven', type: 'group', subcategories: [
          { id: 'citadel-skaven', label: 'Citadel Skaven' },
          { id: 'forgeworld-skaven', label: 'Forgeworld Skaven' }
        ]},
        { id: 'space-orks', label: 'Space Orks', type: 'group', subcategories: [
          { id: 'citadel-orks', label: 'Citadel Orks' }
        ]}
      ]}
    });
  });

  it('reorders top-level categories (groups swap: skaven <-> space-orks)', async () => {
    const res = await agent.post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'miniatures', items: ['space-orks', 'skaven'] });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const cats = db.getCategories();
    const order = cats.miniatures.subcategories.map(c => c.id);
    assert.deepStrictEqual(order, ['space-orks', 'skaven']);
  });

  it('reorders children inside a group via parentId', async () => {
    const res = await agent.post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'miniatures', parentId: 'skaven', items: ['forgeworld-skaven', 'citadel-skaven'] });
    assert.strictEqual(res.status, 200);

    const cats = db.getCategories();
    const group = cats.miniatures.subcategories.find(c => c.id === 'skaven');
    assert.deepStrictEqual(group.subcategories.map(c => c.id), ['forgeworld-skaven', 'citadel-skaven']);
  });

  it('rejects id that is not a direct sibling (child id at top level)', async () => {    const res = await agent.post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'miniatures', items: ['citadel-skaven'] });
    assert.strictEqual(res.status, 400);
  });

  it('rejects unknown section', async () => {
    const res = await agent.post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'nope', items: ['metal-dice'] });
    assert.strictEqual(res.status, 400);
  });

  it('rejects unknown parentId group', async () => {
    const res = await agent.post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'dice', parentId: 'not-a-group', items: ['metal-dice'] });
    assert.strictEqual(res.status, 400);
  });

  it('rejects garbage ids by format', async () => {
    const res = await agent.post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'dice', items: ['../../etc'] });
    assert.strictEqual(res.status, 400);
  });

  it('requires authentication', async () => {
    const res = await supertest(app).post('/api/categories/reorder').set(ORIGIN)
      .send({ section: 'dice', items: ['metal-dice', 'stone-dice'] });
    assert.strictEqual(res.status, 401);
  });

  it('reorder survives saveCategories rebuild (create a category after reorder)', async () => {
    // saveCategories rewrites all sort_order values from tree order —
    // relative order set by reorder must persist through category creation
    const res = await agent.post('/api/categories').set(ORIGIN)
      .send({ section: 'miniatures', label: 'Terrain' });
    assert.strictEqual(res.status, 200);

    const cats = db.getCategories();
    const order = cats.miniatures.subcategories.map(c => c.id);
    assert.deepStrictEqual(order, ['space-orks', 'skaven', 'terrain']);
  });
});

// Must stay last: saveCategories() rewrites the whole tree, so this block owns the
// final category state and would otherwise clash with the tests above.
describe('sort_order numbering is per sibling group (no cross-level collisions)', () => {
  it('saveCategories numbers top level and each group\'s children independently', () => {
    db.saveCategories({
      miniatures: { label: 'Miniatures', subcategories: [
        { id: 'skaven', label: 'Skaven', type: 'group', subcategories: [
          { id: 'citadel-skaven', label: 'Citadel Skaven' },
          { id: 'forgeworld-skaven', label: 'Forgeworld Skaven' }
        ]},
        { id: 'space-orks', label: 'Space Orks', type: 'group', subcategories: [
          { id: 'citadel-orks', label: 'Citadel Orks' }
        ]},
        { id: 'sort-probe', label: 'Sort Probe' }
      ]}
    });

    const rows = db.db.prepare(
      'SELECT id, parent_id, sort_order FROM categories WHERE section_id = ?'
    ).all('miniatures');
    const bySort = (a, b) => a.sort_order - b.sort_order;
    const topLevel = rows.filter(r => r.parent_id === null).sort(bySort);
    const skavenKids = rows.filter(r => r.parent_id === 'skaven').sort(bySort);

    // Each sibling set starts at 0 — mirrors what reorderCategories() writes,
    // so a reorder can no longer collide with saveCategories' numbering.
    assert.deepStrictEqual(topLevel.map(r => r.sort_order), [0, 1, 2]);
    assert.deepStrictEqual(topLevel.map(r => r.id), ['skaven', 'space-orks', 'sort-probe']);
    assert.deepStrictEqual(skavenKids.map(r => r.sort_order), [0, 1]);
    assert.deepStrictEqual(skavenKids.map(r => r.id), ['citadel-skaven', 'forgeworld-skaven']);
  });

  it('getCategories still returns the intended order after a reorder + rebuild cycle', () => {
    db.reorderCategories('miniatures', null, ['sort-probe', 'space-orks', 'skaven']);
    let order = db.getCategories().miniatures.subcategories.map(c => c.id);
    assert.deepStrictEqual(order, ['sort-probe', 'space-orks', 'skaven']);

    // A rebuild (triggered in production by creating/deleting a category) must preserve it
    db.saveCategories(db.getCategories());
    order = db.getCategories().miniatures.subcategories.map(c => c.id);
    assert.deepStrictEqual(order, ['sort-probe', 'space-orks', 'skaven']);
  });
});
