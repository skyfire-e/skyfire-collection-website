const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_TEST_DB = '1';
process.env.SESSION_SECRET = 'test-secret-for-http-tests-minimum-32-chars';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.ADMIN_USERNAME = 'admin';

const supertest = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

before(() => {
  db.saveCategories({
    dice: { label: 'Dice', subcategories: [
      { id: 'metal-dice', label: 'Metal Dice' },
      { id: 'stone-dice', label: 'Stone Dice' }
    ]},
    miniatures: { label: 'Miniatures', subcategories: [
      { id: 'skaven', label: 'Skaven', type: 'group', subcategories: [
        { id: 'citadel-skaven', label: 'Citadel Skaven' }
      ]}
    ]}
  });
  db.updateSettings({ siteName: 'TestSite', showSpreadsheet: true, showPublicSpreadsheet: true });
  db.updateSettings({ sectionsWithExtraFields: ['miniatures'] });
  db.insertItem({
    id: 'test-item-1', section: 'dice', category: 'metal-dice',
    title: 'Dragon', author: 'GW', price: 40, recaster: '', combatPoints: '', status: '',
    image: '/uploads/test.jpg', images: ['/uploads/test.jpg'],
    version: 1, createdAt: '2026-01-01T00:00:00Z'
  });
});

describe('Auth', () => {
  it('GET /api/auth/me — no session returns null user', async () => {
    const res = await supertest(app).get('/api/auth/me');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user, null);
  });

  it('POST /api/auth/login — wrong password returns 401', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'wrong' });
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/auth/login — correct password returns success', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'admin');
  });
});

describe('Items', () => {
  it('GET /api/items — returns items', async () => {
    const res = await supertest(app).get('/api/items');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length > 0);
  });

  it('GET /api/items?section=dice — filters by section', async () => {
    const res = await supertest(app).get('/api/items?section=dice');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.every(i => i.section === 'dice'));
  });

  it('GET /api/items?section=dice&category=metal-dice — filters by section+category', async () => {
    const res = await supertest(app).get('/api/items?section=dice&category=metal-dice');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.every(i => i.section === 'dice' && i.category === 'metal-dice'));
  });
});

describe('Categories', () => {
  it('GET /api/categories — returns tree', async () => {
    const res = await supertest(app).get('/api/categories');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.dice);
    assert.ok(res.body.miniatures);
    assert.strictEqual(res.body.dice.label, 'Dice');
  });
});

describe('Settings', () => {
  it('GET /api/settings — returns settings', async () => {
    const res = await supertest(app).get('/api/settings');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.siteName, 'TestSite');
  });

  it('GET /api/settings — strict schema: no leaked keys', async () => {
    const res = await supertest(app).get('/api/settings');
    const allowed = ['siteName', 'defaultImage', 'defaultTheme', 'showSpreadsheet', 'showPublicSpreadsheet', 'showMiniaturesColumns', 'sectionsWithExtraFields', 'currencies'];
    for (const key of Object.keys(res.body)) {
      assert.ok(allowed.includes(key), 'Unexpected key leaked: ' + key);
    }
  });
});

describe('Spreadsheet', () => {
  it('GET /api/spreadsheet/public — returns public data', async () => {
    const res = await supertest(app).get('/api/spreadsheet/public');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length > 0);
  });
});

describe('Health', () => {
  it('GET /health — returns ok with db check', async () => {
    const res = await supertest(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.db, 'ok');
  });
});

describe('404', () => {
  it('GET /api/nonexistent — returns 404 JSON', async () => {
    const res = await supertest(app).get('/api/nonexistent');
    assert.strictEqual(res.status, 404);
    assert.ok(res.body.error);
  });
});

describe('CSRF protection', () => {
  it('POST /api/items without Origin — rejected', async () => {
    const res = await supertest(app)
      .post('/api/items')
      .field('section', 'dice')
      .field('category', 'metal-dice')
      .field('title', 'Test');
    assert.strictEqual(res.status, 403);
  });
});
