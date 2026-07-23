const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-'));

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    console.error('Corrupted JSON in ' + file + ':', e.message);
    throw new Error('DataCorruptionError: ' + file);
  }
}

function writeJSONAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + require('crypto').randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw error;
  }
}

function safeUnlink(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

describe('readJSON', () => {
  const testFile = path.join(TMP_DIR, 'test.json');

  it('reads valid JSON file', () => {
    fs.writeFileSync(testFile, JSON.stringify({ a: 1 }), 'utf8');
    assert.deepStrictEqual(readJSON(testFile), { a: 1 });
  });

  it('returns null for missing file (ENOENT)', () => {
    const missing = path.join(TMP_DIR, 'missing.json');
    assert.strictEqual(readJSON(missing), null);
  });

  it('throws DataCorruptionError for invalid JSON', () => {
    fs.writeFileSync(testFile, '{bad json}', 'utf8');
    assert.throws(() => readJSON(testFile), /DataCorruptionError/);
  });

  it('reads arrays correctly', () => {
    fs.writeFileSync(testFile, JSON.stringify([1, 2, 3]), 'utf8');
    assert.deepStrictEqual(readJSON(testFile), [1, 2, 3]);
  });

  after(() => safeUnlink(testFile));
});

describe('writeJSONAtomic', () => {
  const testFile = path.join(TMP_DIR, 'atomic.json');

  it('writes data atomically', () => {
    writeJSONAtomic(testFile, { x: 42 });
    assert.strictEqual(fs.readFileSync(testFile, 'utf8'), '{\n  "x": 42\n}');
  });

  it('overwrites existing data', () => {
    writeJSONAtomic(testFile, { y: 99 });
    assert.deepStrictEqual(readJSON(testFile), { y: 99 });
  });

  it('does not leave temp files on success', () => {
    const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.tmp'));
    assert.strictEqual(tmpFiles.length, 0);
  });

  after(() => safeUnlink(testFile));
});

describe('corrupted file safety', () => {
  const testFile = path.join(TMP_DIR, 'corrupt-test.json');

  it('corrupted file throws, does not get overwritten by read', () => {
    fs.writeFileSync(testFile, '{valid: true}', 'utf8');
    assert.throws(() => readJSON(testFile));
    // File should still exist with original content
    assert.ok(fs.existsSync(testFile));
  });

  after(() => safeUnlink(testFile));
});
