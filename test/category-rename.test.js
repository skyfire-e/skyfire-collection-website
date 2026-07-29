const { describe, it, before } = require('node:test');
const assert = require('node:assert');

process.env.NODE_TEST_DB = '1';
process.env.SESSION_SECRET = 'test-secret-for-rename-tests-min-32-char';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.ADMIN_USERNAME = 'admin';

const supertest = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

const ORIGIN = 'http://127.0.0.1';
let agent;

before(async () => {
  db.saveCategories({
    dice: { label: 'Dice', subcategories: [
      { id: 'metal-dice', label: 'Metal Dice' }
    ]},
    miniatures: { label: 'Miniatures', subcategories: [
      { id: 'skaven', label: 'Skaven', type: 'group', subcategories: [
        { id: 'citadel-skaven', label: 'Citadel Skaven' }
      ]}
    ]}
  });
  db.insertItem({
    id: 'rename-item-1', section: 'dice', category: 'metal-dice',
    title: 'Dragon', author: '', price: null, recaster: '', combatPoints: '', status: '',
    image: '', images: [], version: 1
  });
  agent = supertest.agent(app);
  const login = await agent.post('/api/auth/login').set('Origin', ORIGIN)
    .send({ username: 'admin', password: 'admin123' });
  assert.strictEqual(login.status, 200);
});

describe('U3: PATCH /api/categories (rename labels)', () => {
  it('renames a top-level category, id and item references stay intact', async () => {
    const res = await agent.patch('/api/categories').set('Origin', ORIGIN)
      .send({ section: 'dice', id: 'metal-dice', label: 'Metal & Alloy Dice' });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    const cat = res.body.dice.subcategories.find(c => c.id === 'metal-dice');
    assert.strictEqual(cat.label, 'Metal & Alloy Dice');
    // item still resolves through the same id
    const item = db.getItem('rename-item-1');
    assert.strictEqual(item.category, 'metal-dice');
  });

  it('renames a section label', async () => {
    const res = await agent.patch('/api/categories').set('Origin', ORIGIN)
      .send({ section: 'dice', label: 'Dice & Gems' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.dice.label, 'Dice & Gems');
  });

  it('renames a nested category inside a group', async () => {
    const res = await agent.patch('/api/categories').set('Origin', ORIGIN)
      .send({ section: 'miniatures', id: 'citadel-skaven', parentId: 'skaven', label: 'Citadel (old)' });
    assert.strictEqual(res.status, 200);
    const group = res.body.miniatures.subcategories.find(c => c.id === 'skaven');
    assert.strictEqual(group.subcategories[0].label, 'Citadel (old)');
    assert.strictEqual(group.type, 'group', 'group structure survives the round-trip');
  });

  it('rename round-trip preserves order and structure', () => {
    const cats = db.getCategories();
    assert.deepStrictEqual(Object.keys(cats), ['dice', 'miniatures'], 'section order preserved');
    const group = cats.miniatures.subcategories.find(c => c.id === 'skaven');
    assert.ok(group && group.type === 'group' && group.subcategories.length === 1);
  });

  it('404 for unknown section / category / parent', async () => {
    for (const body of [
      { section: 'nope', label: 'X' },
      { section: 'dice', id: 'nope', label: 'X' },
      { section: 'miniatures', id: 'citadel-skaven', parentId: 'nope', label: 'X' }
    ]) {
      const res = await agent.patch('/api/categories').set('Origin', ORIGIN).send(body);
      assert.strictEqual(res.status, 404, JSON.stringify(body));
    }
  });

  it('400 for empty label and dangerous ids', async () => {
    for (const body of [
      { section: 'dice', id: 'metal-dice', label: '' },
      { section: '__proto__', label: 'X' },
      { section: 'dice', id: '__proto__', label: 'X' }
    ]) {
      const res = await agent.patch('/api/categories').set('Origin', ORIGIN).send(body);
      assert.strictEqual(res.status, 400, JSON.stringify(body));
    }
  });

  it('401 without an admin session', async () => {
    const res = await supertest(app).patch('/api/categories').set('Origin', ORIGIN)
      .send({ section: 'dice', label: 'X' });
    assert.strictEqual(res.status, 401);
  });
});
