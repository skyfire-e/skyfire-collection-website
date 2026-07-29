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
