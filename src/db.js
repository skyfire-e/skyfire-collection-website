const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const TEST_DB = process.env.NODE_TEST_DB === '1';
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

let db;
if (TEST_DB) {
  db = new Database(':memory:');
} else {
  const DB_FILE = path.join(DATA_DIR, 'collection.db');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    price REAL DEFAULT 0,
    recaster TEXT DEFAULT '',
    combatPoints TEXT DEFAULT '',
    status TEXT DEFAULT '',
    image TEXT DEFAULT '',
    images TEXT DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    createdAt TEXT DEFAULT '',
    updatedAt TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_items_section ON items(section);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_section_category ON items(section, category);

  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    parent_id TEXT,
    label TEXT NOT NULL,
    type TEXT DEFAULT 'leaf',
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (section_id, id),
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_categories_section ON categories(section_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    data TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires INTEGER
  );
`);

// --- Migrations ---
function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

const currentVersion = db.pragma('user_version', { simple: true });

if (currentVersion < 1) {
  db.pragma('user_version = 1');
}
if (currentVersion < 2) {
  const hasExtraFields = db.prepare('SELECT 1 FROM settings WHERE key = ?').get('sectionsWithExtraFields');
  if (!hasExtraFields) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'sectionsWithExtraFields',
      JSON.stringify(['miniatures'])
    );
  }
  db.pragma('user_version = 2');
}
if (currentVersion < 3) {
  // v3: add updatedAt column to items
  const hasUpdatedAt = db.prepare('PRAGMA table_info(items)').all().some(c => c.name === 'updatedAt');
  if (!hasUpdatedAt) {
    db.prepare('ALTER TABLE items ADD COLUMN updatedAt TEXT DEFAULT \'\'').run();
  }
  db.prepare('UPDATE items SET updatedAt = createdAt WHERE updatedAt = \'\' OR updatedAt IS NULL').run();
  db.exec('CREATE INDEX IF NOT EXISTS idx_items_updatedAt ON items(updatedAt)');

  // v3: normalize categories — migrate from old JSON `categories` table to normalized `sections` + `categories`
  const oldTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories' AND sql LIKE '%data%'").get();
  if (oldTableExists) {
    // Create new normalized categories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories_new (
        id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        parent_id TEXT,
        label TEXT NOT NULL,
        type TEXT DEFAULT 'leaf',
        sort_order INTEGER DEFAULT 0,
        PRIMARY KEY (section_id, id),
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      );
    `);

    const oldCats = db.prepare('SELECT section_id, section_label, data FROM categories').all();
    const insertSection = db.prepare('INSERT OR IGNORE INTO sections (id, label, sort_order) VALUES (?, ?, ?)');
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories_new (id, section_id, parent_id, label, type, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

    let order = 0;
    for (const row of oldCats) {
      insertSection.run(row.section_id, row.section_label || row.section_id, order++);
      const data = safeJsonParse(row.data, { label: row.section_label, subcategories: [] });
      let catOrder = 0;
      for (const cat of (data.subcategories || [])) {
        if (cat.type === 'group' && cat.subcategories) {
          insertCat.run(cat.id, row.section_id, null, cat.label, 'group', catOrder++);
          for (const sc of cat.subcategories) {
            insertCat.run(sc.id, row.section_id, cat.id, sc.label, 'leaf', catOrder++);
          }
        } else {
          insertCat.run(cat.id, row.section_id, null, cat.label, 'leaf', catOrder++);
        }
      }
    }

    // Replace old table
    db.prepare('DROP TABLE categories').run();
    db.exec('ALTER TABLE categories_new RENAME TO categories');
    db.exec('CREATE INDEX IF NOT EXISTS idx_categories_section ON categories(section_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)');
  }

  db.pragma('user_version = 3');
}

// Future migrations: add blocks here
// if (currentVersion < 4) { ... db.pragma('user_version = 4'); }

// --- Items ---
function getItems(section, category, limit, offset) {
  let query = 'SELECT * FROM items';
  const params = [];
  if (section) { query += ' WHERE section = ?'; params.push(section); }
  if (category) { query += (section ? ' AND' : ' WHERE') + ' category = ?'; params.push(category); }
  query += ' ORDER BY createdAt DESC';
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset) { query += ' OFFSET ?'; params.push(offset); }
  }
  const rows = db.prepare(query).all(...params);
  return rows.map(rowToItem);
}

function getItemCount(section, category) {
  let query = 'SELECT COUNT(*) as c FROM items';
  const params = [];
  if (section) { query += ' WHERE section = ?'; params.push(section); }
  if (category) { query += (section ? ' AND' : ' WHERE') + ' category = ?'; params.push(category); }
  return db.prepare(query).get(...params).c;
}

function getItem(id) {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(String(id));
  return row ? rowToItem(row) : null;
}

function insertItem(item) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO items (id, section, category, title, author, price, recaster, combatPoints, status, image, images, version, createdAt, updatedAt) VALUES (@id, @section, @category, @title, @author, @price, @recaster, @combatPoints, @status, @image, @images, @version, @createdAt, @updatedAt)').run({
    id: String(item.id),
    section: item.section,
    category: item.category,
    title: item.title,
    author: item.author || '',
    price: Number(item.price) || 0,
    recaster: item.recaster || '',
    combatPoints: item.combatPoints || '',
    status: item.status || '',
    image: item.image || '',
    images: JSON.stringify(item.images || []),
    version: item.version || 1,
    createdAt: item.createdAt || now,
    updatedAt: now
  });
}

function updateItem(id, fields) {
  const sets = [];
  const params = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'images') {
      sets.push('images = @images');
      params.images = JSON.stringify(v);
    } else if (k === 'price') {
      sets.push('price = @price');
      params.price = Number(v) || 0;
    } else if (k === 'version') {
      sets.push('version = @version');
      params.version = v;
    } else if (['section', 'category', 'title', 'author', 'recaster', 'combatPoints', 'status', 'image'].includes(k)) {
      sets.push(k + ' = @' + k);
      params[k] = v;
    }
  }
  if (sets.length === 0) return;
  sets.push('updatedAt = @updatedAt');
  params.updatedAt = new Date().toISOString();
  params.id = String(id);
  db.prepare('UPDATE items SET ' + sets.join(', ') + ' WHERE id = @id').run(params);
}

function deleteItem(id) {
  db.prepare('DELETE FROM items WHERE id = ?').run(String(id));
}

function allItems() {
  return db.prepare('SELECT * FROM items').all().map(rowToItem);
}

function rowToItem(row) {
  return {
    id: row.id,
    section: row.section,
    category: row.category,
    title: row.title,
    author: row.author,
    price: row.price,
    recaster: row.recaster,
    combatPoints: row.combatPoints,
    status: row.status,
    image: row.image,
    images: safeJsonParse(row.images, []),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt
  };
}

// --- Categories (normalized: sections + categories tables, assembled to tree) ---
function getCategories() {
  const sections = db.prepare('SELECT * FROM sections ORDER BY sort_order').all();
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const result = {};
  for (const sec of sections) {
    result[sec.id] = { label: sec.label, subcategories: [] };
  }
  for (const cat of cats) {
    const sec = result[cat.section_id];
    if (!sec) continue;
    if (cat.parent_id) {
      const parent = sec.subcategories.find(c => c.id === cat.parent_id);
      if (parent) {
        if (!parent.subcategories) parent.subcategories = [];
        parent.subcategories.push({ id: cat.id, label: cat.label });
      }
    } else {
      if (cat.type === 'group') {
        sec.subcategories.push({ id: cat.id, label: cat.label, type: 'group', subcategories: [] });
      } else {
        sec.subcategories.push({ id: cat.id, label: cat.label });
      }
    }
  }
  return result;
}

function saveCategories(cats) {
  const delCats = db.prepare('DELETE FROM categories');
  const delSections = db.prepare('DELETE FROM sections');
  const insertSection = db.prepare('INSERT INTO sections (id, label, sort_order) VALUES (?, ?, ?)');
  const insertCat = db.prepare('INSERT INTO categories (id, section_id, parent_id, label, type, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    delCats.run();
    delSections.run();
    let secOrder = 0;
    for (const [sectionId, section] of Object.entries(cats)) {
      insertSection.run(sectionId, section.label || sectionId, secOrder++);
      let catOrder = 0;
      for (const cat of (section.subcategories || [])) {
        if (cat.type === 'group' && cat.subcategories) {
          insertCat.run(cat.id, sectionId, null, cat.label, 'group', catOrder++);
          for (const sc of cat.subcategories) {
            insertCat.run(sc.id, sectionId, cat.id, sc.label, 'leaf', catOrder++);
          }
        } else {
          insertCat.run(cat.id, sectionId, null, cat.label, 'leaf', catOrder++);
        }
      }
    }
  });
  tx();
}

// --- Settings ---
function getSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = safeJsonParse(row.value, null);
  }
  return result;
}

function updateSettings(partial) {
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
  const del = db.prepare('DELETE FROM settings WHERE key = ?');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(partial)) {
      if (value === null) { del.run(key); continue; }
      insert.run({ key, value: JSON.stringify(value) });
    }
  });
  tx();
}

// --- Audit ---
const AUDIT_MAX_ROWS = 1000;

function appendAudit(entry) {
  db.prepare('INSERT INTO audit (timestamp, action, data) VALUES (?, ?, ?)').run(
    new Date().toISOString(),
    entry.action || 'unknown',
    JSON.stringify(entry)
  );
  db.prepare('DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY id DESC LIMIT ?)').run(AUDIT_MAX_ROWS);
}

// --- Sessions ---
function getSession(sid) {
  const row = db.prepare('SELECT * FROM sessions WHERE sid = ?').get(sid);
  if (!row) return null;
  if (row.expires && row.expires < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    return null;
  }
  try { return safeJsonParse(row.data, null); } catch { return null; }
}

function setSession(sid, data, maxAge) {
  const expires = maxAge ? Date.now() + maxAge : null;
  db.prepare('INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)').run(sid, JSON.stringify(data), expires);
}

function destroySession(sid) {
  db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
}

function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires IS NOT NULL AND expires < ?').run(Date.now());
}

const cleanupTimer = setInterval(cleanupSessions, 3600000);
cleanupTimer.unref();

module.exports = {
  db,
  getItems, getItemCount, getItem, insertItem, updateItem, deleteItem, allItems,
  getCategories, saveCategories,
  getSettings, updateSettings,
  appendAudit,
  getSession, setSession, destroySession
};
