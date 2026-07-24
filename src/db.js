const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'collection.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
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
    version INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_items_section ON items(section);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_section_category ON items(section, category);

  CREATE TABLE IF NOT EXISTS categories (
    section_id TEXT NOT NULL,
    section_label TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (section_id)
  );

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

// --- Items ---
function getItems(section, category) {
  let query = 'SELECT * FROM items';
  const params = [];
  if (section) { query += ' WHERE section = ?'; params.push(section); }
  if (category) { query += (section ? ' AND' : ' WHERE') + ' category = ?'; params.push(category); }
  const rows = db.prepare(query).all(...params);
  return rows.map(rowToItem);
}

function getItem(id) {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(String(id));
  return row ? rowToItem(row) : null;
}

function insertItem(item) {
  db.prepare('INSERT INTO items (id, section, category, title, author, price, recaster, combatPoints, status, image, images, version, createdAt) VALUES (@id, @section, @category, @title, @author, @price, @recaster, @combatPoints, @status, @image, @images, @version, @createdAt)').run({
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
    createdAt: item.createdAt || ''
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
    images: JSON.parse(row.images || '[]'),
    version: row.version,
    createdAt: row.createdAt
  };
}

// --- Categories ---
function getCategories() {
  const rows = db.prepare('SELECT * FROM categories').all();
  const result = {};
  for (const row of rows) {
    result[row.section_id] = JSON.parse(row.data);
  }
  return result;
}

function saveCategories(cats) {
  const del = db.prepare('DELETE FROM categories');
  const insert = db.prepare('INSERT INTO categories (section_id, section_label, data) VALUES (@section_id, @section_label, @data)');
  const tx = db.transaction(() => {
    del.run();
    for (const [sectionId, section] of Object.entries(cats)) {
      insert.run({ section_id: sectionId, section_label: section.label || sectionId, data: JSON.stringify(section) });
    }
  });
  tx();
}

// --- Settings ---
function getSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = JSON.parse(row.value);
  }
  return result;
}

function updateSettings(partial) {
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(partial)) {
      insert.run({ key, value: JSON.stringify(value) });
    }
  });
  tx();
}

// --- Audit ---
function appendAudit(entry) {
  db.prepare('INSERT INTO audit (timestamp, action, data) VALUES (?, ?, ?)').run(
    new Date().toISOString(),
    entry.action || 'unknown',
    JSON.stringify(entry)
  );
}

// --- Sessions ---
function getSession(sid) {
  const row = db.prepare('SELECT * FROM sessions WHERE sid = ?').get(sid);
  if (!row) return null;
  if (row.expires && row.expires < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    return null;
  }
  try { return JSON.parse(row.data); } catch { return null; }
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
  getItems, getItem, insertItem, updateItem, deleteItem, allItems,
  getCategories, saveCategories,
  getSettings, updateSettings,
  appendAudit,
  getSession, setSession, destroySession
};
