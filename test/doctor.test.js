const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_TEST_DB = '1';

const db = require('../src/db');
const { runDoctor } = require('../scripts/doctor');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const DOCTOR_DEFAULT_FILE = path.join(UPLOADS_DIR, 'test-doctor-default.jpg');

after(() => {
  if (fs.existsSync(DOCTOR_DEFAULT_FILE)) fs.unlinkSync(DOCTOR_DEFAULT_FILE);
});

describe('Doctor script', () => {
  it('runDoctor completes without throwing', () => {
    const issues = runDoctor(db.db);
    assert.ok(Array.isArray(issues));
    assert.ok(issues.length > 0);
    const errors = issues.filter(i => i.severity === 'error');
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
  });

  it('A8: defaultImage from settings is not reported as orphan', () => {
    // Settings values are stored JSON-encoded — doctor must parse before basename check
    db.updateSettings({ defaultImage: '/uploads/test-doctor-default.jpg' });
    fs.writeFileSync(DOCTOR_DEFAULT_FILE, 'fake-jpeg-bytes');

    const issues = runDoctor(db.db);
    const orphanReports = issues.filter(i =>
      i.category === 'orphans' && i.message.includes('test-doctor-default.jpg')
    );
    assert.strictEqual(orphanReports.length, 0,
      'defaultImage must be recognized as referenced: ' + JSON.stringify(orphanReports));
  });

  it('B2: items in a section without categories are not "unknown section" errors', () => {
    // A section can legitimately exist with zero categories; doctor must take
    // valid sections from the sections table, not derive them from categories.
    db.db.prepare('INSERT INTO sections (id, label, sort_order) VALUES (?, ?, ?)')
      .run('empty-section', 'Empty Section', 99);
    db.insertItem({
      id: 'doctor-b2-item',
      section: 'empty-section',
      category: 'some-cat',
      title: 'Doctor B2 fixture'
    });

    try {
      const issues = runDoctor(db.db);
      const sectionErrors = issues.filter(i =>
        i.category === 'category-ref' && i.severity === 'error' && i.message.includes('empty-section')
      );
      assert.strictEqual(sectionErrors.length, 0,
        'existing empty section must not be an error: ' + JSON.stringify(sectionErrors));

      // The dangling category is still reported — as a warning, not an error.
      const catWarnings = issues.filter(i =>
        i.category === 'category-ref' && i.severity === 'warning' && i.message.includes('doctor-b2-item')
      );
      assert.strictEqual(catWarnings.length, 1, JSON.stringify(catWarnings));
    } finally {
      db.deleteItem('doctor-b2-item');
      db.db.prepare('DELETE FROM sections WHERE id = ?').run('empty-section');
    }
  });
});
