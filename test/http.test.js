const { describe, it, before } = require('node:test');
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
    assert.ok(res.body.items.length > 0);
  });

  it('GET /api/items?section=dice — filters by section', async () => {
    const res = await supertest(app).get('/api/items?section=dice');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.items.every(i => i.section === 'dice'));
  });

  it('GET /api/items?section=dice&category=metal-dice — filters by section+category', async () => {
    const res = await supertest(app).get('/api/items?section=dice&category=metal-dice');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.items.every(i => i.section === 'dice' && i.category === 'metal-dice'));
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

describe('Search and pagination', () => {
  it('GET /api/items?q=Dragon — searches items by title', async () => {
    const res = await supertest(app).get('/api/items?q=Dragon');
    assert.strictEqual(res.status, 200);
    const items = res.body.items || res.body;
    assert.ok(items.length >= 1);
    assert.ok(items.some(i => i.title.includes('Dragon')));
  });

  it('GET /api/items?q=zzz_nonexistent — returns empty', async () => {
    const res = await supertest(app).get('/api/items?q=zzz_nonexistent');
    assert.strictEqual(res.status, 200);
    const items = res.body.items || res.body;
    assert.strictEqual(items.length, 0);
  });

  it('GET /api/items?limit=1 — paginates results', async () => {
    const res = await supertest(app).get('/api/items?limit=1');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    assert.strictEqual(res.body.items.length, 1);
    assert.ok(res.body.total >= 1);
    assert.strictEqual(res.body.limit, 1);
  });

  it('GET /api/items?limit=foo — returns 400', async () => {
    const res = await supertest(app).get('/api/items?limit=foo');
    assert.strictEqual(res.status, 400);
  });
});

describe('Reorder', () => {
  let agent;
  let itemA, itemB;

  before(async () => {
    agent = supertest.agent(app);
    await agent.post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
    itemA = await agent.post('/api/items')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .field('section', 'dice')
      .field('category', 'metal-dice')
      .field('title', 'Reorder A');
    itemB = await agent.post('/api/items')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .field('section', 'dice')
      .field('category', 'metal-dice')
      .field('title', 'Reorder B');
  });

  it('POST /api/items/reorder — reorders items', async () => {
    const res = await agent.post('/api/items/reorder')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ section: 'dice', category: 'metal-dice', items: [itemB.body.id, itemA.body.id] });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const items = await supertest(app).get('/api/items?section=dice&category=metal-dice');
    const reordered = items.body.items.filter(i => i.id === itemA.body.id || i.id === itemB.body.id);
    assert.strictEqual(reordered[0].id, itemB.body.id);
    assert.strictEqual(reordered[1].id, itemA.body.id);
  });

  it('POST /api/items/reorder — rejects missing params', async () => {
    const res = await agent.post('/api/items/reorder')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({});
    assert.strictEqual(res.status, 400);
  });
});

describe('Categories CRUD', () => {
  let agent;

  before(async () => {
    agent = supertest.agent(app);
    await agent.post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
  });

  it('POST /api/categories — creates a new leaf category', async () => {
    const res = await agent.post('/api/categories')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ section: 'dice', label: 'Plastic Dice', id: 'plastic-dice' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.dice.subcategories.some(c => c.id === 'plastic-dice'));
  });

  it('POST /api/categories — creates a group category', async () => {
    const res = await agent.post('/api/categories')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ section: 'dice', label: 'Special', id: 'special', isGroup: true });
    assert.strictEqual(res.status, 200);
    const group = res.body.dice.subcategories.find(c => c.id === 'special');
    assert.ok(group);
    assert.strictEqual(group.type, 'group');
  });

  it('POST /api/categories — rejects duplicate ID', async () => {
    const res = await agent.post('/api/categories')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ section: 'dice', label: 'Plastic Again', id: 'plastic-dice' });
    assert.strictEqual(res.status, 409);
  });

  it('DELETE /api/categories — deletes a leaf category', async () => {
    const res = await agent.delete('/api/categories?section=dice&id=plastic-dice')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    const cats = await supertest(app).get('/api/categories');
    assert.ok(!cats.body.dice.subcategories.some(c => c.id === 'plastic-dice'));
  });

  it('DELETE /api/categories — 409 when section has items', async () => {
    const res = await agent.delete('/api/categories?section=dice')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 409);
  });

  it('DELETE /api/categories — 404 for missing category', async () => {
    const res = await agent.delete('/api/categories?section=dice&id=nonexistent')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 404);
  });
});

describe('Backfill', () => {
  let agent;

  before(async () => {
    agent = supertest.agent(app);
    await agent.post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
  });

  it('POST /api/backfill-images — copies image to images[0]', async () => {
    const res = await agent.post('/api/backfill-images')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.updated >= 0);
  });

  it('POST /api/backfill-prices — normalizes prices', async () => {
    const res = await agent.post('/api/backfill-prices')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.updated >= 0);
  });

  it('POST /api/backfill-defaults — applies default images', async () => {
    const res = await agent.post('/api/backfill-defaults')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.updated >= 0);
  });
});

describe('CRUD (authenticated)', () => {
  let agent;

  before(async () => {
    agent = supertest.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
    assert.strictEqual(res.status, 200);
  });

  it('POST /api/items — creates item', async () => {
    const res = await agent
      .post('/api/items')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .field('section', 'dice')
      .field('category', 'metal-dice')
      .field('title', 'HTTP Test Item')
      .field('price', '25');
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.title, 'HTTP Test Item');
    assert.strictEqual(res.body.price, 25);
    assert.ok(res.body.id);
    // cleanup
    await agent
      .delete('/api/items/' + res.body.id)
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
  });

  it('PUT /api/items/:id — updates item', async () => {
    const res = await agent
      .put('/api/items/test-item-1')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .field('title', 'Updated Dragon')
      .field('version', '1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.title, 'Updated Dragon');
    assert.strictEqual(res.body.version, 2);
    // revert
    await agent
      .put('/api/items/test-item-1')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .field('title', 'Dragon')
      .field('version', '2');
  });

  it('DELETE /api/items/:id — deletes item', async () => {
    // create temp item to delete
    const created = await agent
      .post('/api/items')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .field('section', 'dice')
      .field('category', 'metal-dice')
      .field('title', 'Delete Me');
    const res = await agent
      .delete('/api/items/' + created.body.id)
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(db.getItem(created.body.id), null);
  });

  it('POST /api/settings — rejects unknown keys (strict mode)', async () => {
    const res = await agent
      .put('/api/settings')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ siteName: 'OK', unknownKey: 'leaked' });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /api/settings — accepts valid settings', async () => {
    const res = await agent
      .put('/api/settings')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ siteName: 'UpdatedName' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.siteName, 'UpdatedName');
    // restore
    await agent
      .put('/api/settings')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ siteName: 'TestSite' });
  });

  it('POST /api/auth/logout — logs out', async () => {
    const res = await agent
      .post('/api/auth/logout')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // re-login for subsequent tests
    await agent
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
  });
});

describe('Sitemap', () => {
  it('GET /sitemap.xml — returns XML', async () => {
    const res = await supertest(app).get('/sitemap.xml');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('<?xml'));
    assert.ok(res.text.includes('dice'));
  });
});

describe('Audit', () => {
  let agent;
  before(async () => {
    agent = supertest.agent(app);
    await agent
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
  });

  it('GET /api/audit — returns audit log', async () => {
    const res = await agent
      .get('/api/audit')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

describe('Checkpoint', () => {
  let agent;
  before(async () => {
    agent = supertest.agent(app);
    await agent
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
  });

  it('POST /api/checkpoint — runs checkpoint', async () => {
    const res = await agent
      .post('/api/checkpoint')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it('POST /api/checkpoint — returns 500 on DB error', async () => {
    const originalPragma = db.db.pragma;
    db.db.pragma = () => { throw new Error('DB is locked'); };
    try {
      const res = await agent
        .post('/api/checkpoint')
        .set('Origin', 'http://127.0.0.1:3000')
        .set('Host', '127.0.0.1:3000');
      assert.strictEqual(res.status, 500);
      assert.ok(res.body.error);
    } finally {
      db.db.pragma = originalPragma;
    }
  });
});

describe('Spreadsheet admin', () => {
  let agent;
  before(async () => {
    agent = supertest.agent(app);
    await agent
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000')
      .send({ username: 'admin', password: 'admin123' });
  });

  it('GET /api/spreadsheet — admin returns all items', async () => {
    const res = await agent
      .get('/api/spreadsheet')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Host', '127.0.0.1:3000');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  it('GET /api/spreadsheet — requires admin', async () => {
    const res = await supertest(app).get('/api/spreadsheet');
    assert.strictEqual(res.status, 401);
  });
});
