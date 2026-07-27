const { describe, it } = require('node:test');
const assert = require('node:assert');

process.env.NODE_TEST_DB = '1';

const db = require('../src/db');
const { runDoctor } = require('../scripts/doctor');

describe('Doctor script', () => {
  it('runDoctor completes without throwing', () => {
    const issues = runDoctor(db.db);
    assert.ok(Array.isArray(issues));
    assert.ok(issues.length > 0);
    const errors = issues.filter(i => i.severity === 'error');
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
  });
});
