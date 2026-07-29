const { describe, it, before } = require('node:test');
const assert = require('node:assert');

process.env.NODE_TEST_DB = '1';
process.env.SESSION_SECRET = 'test-secret-for-default-image-tests-32ch';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.ADMIN_USERNAME = 'admin';

const supertest = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

const CUSTOM_DEFAULT = '/uploads/custom-default.jpg';
const ORIGIN = 'http://127.0.0.1';

let agent;

function makeItem(id, image, images) {
  db.insertItem({
    id, section: 'dice', category: 'metal-dice',
    title: 'Item ' + id, author: '', price: null,
    recaster: '', combatPoints: '', status: '',
    image, images, version: 1
  });
}

before(async () => {
  db.saveCategories({
    dice: { label: 'Dice', subcategories: [{ id: 'metal-dice', label: 'Metal Dice' }] }
  });
  db.updateSettings({ defaultImage: CUSTOM_DEFAULT });

  // Legacy row: real photo in `image`, images[] never backfilled
  makeItem('legacy-item', '/uploads/legacy-real.jpg', []);
  makeItem('legacy-item-2', '/uploads/legacy-real-2.jpg', []);
  // Photo-less item created while a custom default image is configured
  makeItem('no-photo-item', CUSTOM_DEFAULT, []);
  makeItem('no-photo-item-2', CUSTOM_DEFAULT, []);

  agent = supertest.agent(app);
  const login = await agent.post('/api/auth/login').set('Origin', ORIGIN)
    .send({ username: 'admin', password: 'admin123' });
  assert.strictEqual(login.status, 200);
});

describe('B2: default image vs legacy image in item edits', () => {
  it('legacy item: finalOrder [0] resolves the legacy `image` as images[0]', async () => {
    const res = await agent.put('/api/items/legacy-item').set('Origin', ORIGIN)
      .field('title', 'Item legacy-item')
      .field('finalOrder', JSON.stringify([0]))
      .field('version', '1');
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.deepStrictEqual(res.body.images, ['/uploads/legacy-real.jpg']);
    assert.strictEqual(res.body.image, '/uploads/legacy-real.jpg');

    const stored = db.getItem('legacy-item');
    assert.deepStrictEqual(stored.images, ['/uploads/legacy-real.jpg'], 'self-healed images[]');
  });

  it('legacy item: removing the legacy photo falls back to the default image', async () => {
    const res = await agent.put('/api/items/legacy-item-2').set('Origin', ORIGIN)
      .field('title', 'Item legacy-item-2')
      .field('imagesToRemove', JSON.stringify([0]))
      .field('version', '1');
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.deepStrictEqual(res.body.images, []);
    assert.strictEqual(res.body.image, CUSTOM_DEFAULT);
  });

  it('photo-less item with custom default: plain save (finalOrder []) succeeds', async () => {
    // This is what the fixed editor sends: the default image is not a slot
    const res = await agent.put('/api/items/no-photo-item').set('Origin', ORIGIN)
      .field('title', 'Renamed')
      .field('finalOrder', JSON.stringify([]))
      .field('version', '1');
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.title, 'Renamed');
    assert.strictEqual(res.body.image, CUSTOM_DEFAULT, 'default image untouched');
    assert.deepStrictEqual(res.body.images, [], 'default must not leak into images[]');
  });

  it('photo-less item with custom default: finalOrder [0] is still rejected', async () => {
    // The default image is not a photo — referencing it as one is a client error
    const res = await agent.put('/api/items/no-photo-item-2').set('Origin', ORIGIN)
      .field('title', 'Item no-photo-item-2')
      .field('finalOrder', JSON.stringify([0]))
      .field('version', '1');
    assert.strictEqual(res.status, 400, JSON.stringify(res.body));
  });
});
