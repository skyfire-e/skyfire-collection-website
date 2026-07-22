const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Load .env file if present (no dotenv dependency needed)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    });
  }
} catch(e) { /* ignore */ }

const app = express();
const PORT = process.env.PORT || 3000;

// --- Data setup ---
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { console.error('Cannot read ' + path.basename(file) + ':', err.message); return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
// Safe file deletion under uploads/
function safeUnlink(imgPath) {
  if (!imgPath || typeof imgPath !== 'string') return;
  if (!imgPath.startsWith('/uploads/')) return;
  const full = path.join(__dirname, imgPath);
  try { fs.unlinkSync(full); }
  catch (e) { if (e.code !== 'ENOENT') console.error('Failed to delete', imgPath, e.message); }
}

// Init data files
['items.json'].forEach(f => {
  const fp = path.join(DATA_DIR, f);
  if (!fs.existsSync(fp)) writeJSON(fp, []);
});

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('SESSION_SECRET is not set. Generate one with: openssl rand -hex 32');
  process.exit(1);
}

app.set('trust proxy', 1);
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File upload ---
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = file.mimetype === 'image/jpeg' ? '.jpg' : file.mimetype === 'image/png' ? '.png' : '.webp';
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG/PNG/WebP allowed'));
  }
});

// --- Auth middleware ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.user?.role === 'admin') return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- API Routes ---

// Auth
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    return res.status(500).json({ error: 'Server not configured' });
  }
  if (username === adminUser && password === adminPass) {
    req.session.user = { username: adminUser, role: 'admin' };
    return res.json({ success: true, user: { username: adminUser, role: 'admin' } });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session?.user) return res.json({ user: req.session.user });
  res.json({ user: null });
});

// Categories
app.get('/api/categories', (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  res.json(cats);
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const { section, label, id, parentId } = req.body;

  if (!label) return res.status(400).json({ error: 'Label is required' });

  const catId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (parentId === '__new_section__') {
    // Create new top-level section
    if (cats[catId]) return res.status(400).json({ error: 'Section already exists' });
    cats[catId] = { label, subcategories: [] };
  } else if (parentId && section && cats[section]) {
    // Add subcategory under a group within the section
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (parent && parent.subcategories) {
      parent.subcategories.push({ id: catId, label });
    } else {
      return res.status(400).json({ error: 'Parent not found or not a group' });
    }
  } else if (section && cats[section]) {
    // Add flat subcategory to section root
    cats[section].subcategories.push({ id: catId, label });
  } else {
    return res.status(400).json({ error: 'Invalid target' });
  }

  writeJSON(CATEGORIES_FILE, cats);
  res.json(cats);
});

app.delete('/api/categories', requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const items = readJSON(ITEMS_FILE) || [];
  const { section, id, parentId } = req.body;

  if (!section || !cats[section]) return res.status(400).json({ error: 'Invalid section' });

  // Collect all category IDs that will be affected
  let affectedCats = [];
  if (!id) {
    // Deleting entire section — affect all subcategories
    const flatten = (subs) => { subs.forEach(c => { affectedCats.push(c.id); if (c.subcategories) flatten(c.subcategories); }); };
    flatten(cats[section].subcategories || []);
  } else if (parentId) {
    affectedCats = [id];
  } else {
    affectedCats = [id];
  }

  // Check if any items reference these categories
  const orphaned = items.filter(i => i.section === section && affectedCats.includes(i.category));
  if (orphaned.length > 0) {
    return res.status(400).json({
      error: 'Cannot delete: ' + orphaned.length + ' item(s) still reference this category',
      orphanedCount: orphaned.length
    });
  }

  if (!id) {
    delete cats[section];
  } else if (parentId) {
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (!parent || !parent.subcategories) return res.status(400).json({ error: 'Parent not found' });
    parent.subcategories = parent.subcategories.filter(c => c.id !== id);
  } else {
    cats[section].subcategories = cats[section].subcategories.filter(c => c.id !== id);
  }

  writeJSON(CATEGORIES_FILE, cats);
  res.json(cats);
});

// Items
app.get('/api/items', (req, res) => {
  let items = readJSON(ITEMS_FILE) || [];
  const { section, category } = req.query;
  if (section) items = items.filter(i => i.section === section);
  if (category) items = items.filter(i => i.category === category);
  res.json(items);
});

app.post('/api/items', requireAdmin, upload.array('images', 10), (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const cats = readJSON(CATEGORIES_FILE);
  const settings = readJSON(SETTINGS_FILE) || {};

  // Basic validation
  if (!req.body.title || !req.body.title.trim()) return res.status(400).json({ error: 'Title is required' });
  const section = req.body.section;
  const category = req.body.category;
  if (section && (!cats || !cats[section])) return res.status(400).json({ error: 'Invalid section' });
  if (category && section && cats) {
    const sec = cats[section];
    const valid = sec.subcategories ? sec.subcategories.some(c => c.id === category || (c.subcategories && c.subcategories.some(sc => sc.id === category))) : false;
    if (!valid) return res.status(400).json({ error: 'Invalid category for section' });
  }

  const files = req.files || [];
  const images = files.map(f => '/uploads/' + f.filename);
  const priceNum = parseFloat(req.body.price);
  const newItem = {
    id: crypto.randomUUID(),
    section: section,
    category: category,
    title: req.body.title.trim(),
    author: req.body.author || '',
    price: isNaN(priceNum) ? '' : priceNum,
    recaster: req.body.recaster || '',
    combatPoints: req.body.combatPoints || '',
    status: req.body.status || '',
    image: images.length > 0 ? images[0] : (settings.defaultImage || '/images/default.svg'),
    images: images,
    createdAt: new Date().toISOString()
  };
  items.push(newItem);
  writeJSON(ITEMS_FILE, items);
  res.json(newItem);
});

app.put('/api/items/:id', requireAdmin, upload.array('images', 10), (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const idx = items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (req.body.title !== undefined) items[idx].title = req.body.title;
  if (req.body.author !== undefined) items[idx].author = req.body.author;
  if (req.body.price !== undefined) items[idx].price = req.body.price;
  if (req.body.recaster !== undefined) items[idx].recaster = req.body.recaster;
  if (req.body.combatPoints !== undefined) items[idx].combatPoints = req.body.combatPoints;
  if (req.body.status !== undefined) items[idx].status = req.body.status;
  if (req.body.section !== undefined) items[idx].section = req.body.section;
  if (req.body.category !== undefined) items[idx].category = req.body.category;
  // Normalize images field (handle legacy {} case)
  if (!Array.isArray(items[idx].images)) items[idx].images = [];
  const oldImages = [...items[idx].images]; // snapshot for disk cleanup
  // Handle image removal + reorder via finalOrder
  const files = req.files || [];
  let removeIdx = [];
  if (req.body.imagesToRemove) {
    try { removeIdx = JSON.parse(req.body.imagesToRemove); } catch(e) { removeIdx = []; }
  }
  let finalOrder = [];
  if (req.body.finalOrder) {
    try { finalOrder = JSON.parse(req.body.finalOrder); } catch(e) { finalOrder = []; }
  }

  if (finalOrder.length > 0) {
    // Rebuild images array from finalOrder
    const images = items[idx].images || [];
    const originalMap = {};
    images.forEach((img, i) => { originalMap[i] = img; });

    // Mark removed indices as deleted from the map
    if (Array.isArray(removeIdx)) {
      removeIdx.forEach(i => delete originalMap[i]);
    }

    let fileIdx = 0;
    const newImages = [];
    for (const entry of finalOrder) {
      if (entry >= 0 && originalMap[entry] !== undefined) {
        newImages.push(originalMap[entry]);
      } else if (entry === -1 && fileIdx < files.length) {
        newImages.push('/uploads/' + files[fileIdx++].filename);
      }
    }
    items[idx].images = newImages;
  } else if (Array.isArray(removeIdx) && removeIdx.length > 0 && items[idx].images) {
    // Legacy path: remove only (no reorder)
    removeIdx.sort((a, b) => b - a).forEach(i => {
      if (i >= 0 && i < items[idx].images.length) items[idx].images.splice(i, 1);
    });
    // Append any uploaded files
    files.forEach(f => {
      if (!items[idx].images) items[idx].images = [];
      items[idx].images.push('/uploads/' + f.filename);
    });
  } else if (files.length > 0) {
    // Just append new files
    if (!items[idx].images) items[idx].images = [];
    files.forEach(f => items[idx].images.push('/uploads/' + f.filename));
  }

  // Clean up removed image files from disk
  if (Array.isArray(items[idx].images)) {
    const newSet = new Set(items[idx].images);
    oldImages.forEach(img => { if (!newSet.has(img)) safeUnlink(img); });
  }

  // Update cover image
  if (items[idx].images && items[idx].images.length > 0) {
    items[idx].image = items[idx].images[0];
  } else {
    items[idx].images = [];
    items[idx].image = readJSON(SETTINGS_FILE)?.defaultImage || '/images/default.svg';
  }
  writeJSON(ITEMS_FILE, items);
  res.json(items[idx]);
});

app.delete('/api/items/:id', requireAdmin, (req, res) => {
  let items = readJSON(ITEMS_FILE) || [];
  const idx = items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const removed = items[idx];
  items.splice(idx, 1);
  writeJSON(ITEMS_FILE, items);
  // Delete orphaned image files
  if (removed) {
    (removed.images || []).forEach(safeUnlink);
    if (removed.image && !removed.image.includes('default.svg')) safeUnlink(removed.image);
  }
  res.json({ success: true });
});

// Backfill default images for all items without photos
app.post('/api/backfill-defaults', requireAdmin, (req, res) => {
  const settings = readJSON(SETTINGS_FILE) || {};
  const defaultImg = settings.defaultImage || '/images/default.svg';
  const items = readJSON(ITEMS_FILE) || [];
  let changed = 0;
  items.forEach(item => {
    const imgs = item.images;
    const hasImages = Array.isArray(imgs) ? imgs.length > 0 : false;
    if (!hasImages) {
      item.image = defaultImg;
      item.images = [];
      changed++;
    }
  });
  if (changed > 0) writeJSON(ITEMS_FILE, items);
  res.json({ updated: changed, defaultImage: defaultImg });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(readJSON(SETTINGS_FILE));
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const settings = readJSON(SETTINGS_FILE) || {};
  const oldDefault = settings.defaultImage;
  if (req.body.defaultImage) settings.defaultImage = req.body.defaultImage;
  if (req.body.siteName) settings.siteName = req.body.siteName;
  if (req.body.showSpreadsheet !== undefined) settings.showSpreadsheet = req.body.showSpreadsheet;
  if (req.body.showPublicSpreadsheet !== undefined) settings.showPublicSpreadsheet = req.body.showPublicSpreadsheet;
  if (req.body.showMiniaturesColumns !== undefined) settings.showMiniaturesColumns = req.body.showMiniaturesColumns;
  if (req.body.currencies !== undefined) settings.currencies = req.body.currencies;
  writeJSON(SETTINGS_FILE, settings);
  // Backfill: update existing items that have no images
  if (oldDefault !== settings.defaultImage) {
    const items = readJSON(ITEMS_FILE) || [];
    let changed = 0;
    items.forEach(item => {
      const imgs = item.images;
      const hasImages = Array.isArray(imgs) ? imgs.length > 0 : false;
      if (!hasImages) {
        item.image = settings.defaultImage;
        item.images = [];
        changed++;
      }
    });
    if (changed > 0) writeJSON(ITEMS_FILE, items);
  }
  res.json(settings);
});

// Public spreadsheet endpoint (no auth required)
app.get('/api/spreadsheet/public', (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const cats = readJSON(CATEGORIES_FILE) || {};
  const settings = readJSON(SETTINGS_FILE) || {};
  const showPrices = settings.showPublicSpreadsheet !== false;
  const currencies = settings.currencies || {};

  const result = [];
  for (const [sectionId, section] of Object.entries(cats)) {
    const sectionData = { id: sectionId, label: section.label, subcategories: [], sum: 0, totalItems: 0, currency: currencies[sectionId] || '' };
    const showColumns = settings.showMiniaturesColumns || {};

    // Flatten subcategories including nested group children
    const flatSubs = [];
    section.subcategories.forEach(c => {
      if (c.type === 'group' && c.subcategories) {
        c.subcategories.forEach(sc => {
          flatSubs.push({ id: sc.id, label: sc.label, groupLabel: c.label });
        });
      } else {
        flatSubs.push({ id: c.id, label: c.label, groupLabel: null });
      }
    });

    flatSubs.forEach(sub => {
      const subItems = items.filter(i => i.section === sectionId && i.category === sub.id);
      const subSum = showPrices ? subItems.reduce((acc, i) => acc + (parseFloat(i.price) || 0), 0) : 0;
      sectionData.subcategories.push({
        id: sub.id,
        label: sub.label,
        groupLabel: sub.groupLabel,
        items: subItems.map(i => ({
          title: i.title,
          author: i.author,
          price: showPrices ? i.price : undefined,
          recaster: showColumns.recaster ? i.recaster : undefined,
          combatPoints: showColumns.combatPoints ? i.combatPoints : undefined,
          status: showColumns.status ? i.status : undefined,
        })),
        sum: subSum,
      });
      sectionData.sum += subSum;
      sectionData.totalItems += subItems.length;
    });

    sectionData.showPrices = showPrices;
    if (sectionId === 'miniatures') sectionData.showColumns = showColumns;
    result.push(sectionData);
  }
  res.json(result);
});

app.post('/api/upload/default', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const settings = readJSON(SETTINGS_FILE) || {};
  settings.defaultImage = '/uploads/' + req.file.filename;
  writeJSON(SETTINGS_FILE, settings);
  // Backfill: update existing items that have no images
  const items = readJSON(ITEMS_FILE) || [];
  let changed = 0;
  items.forEach(item => {
    if (!Array.isArray(item.images) || item.images.length === 0) {
      item.image = settings.defaultImage;
      item.images = [];
      changed++;
    }
  });
  if (changed > 0) writeJSON(ITEMS_FILE, items);
  res.json(settings);
});

// Spreadsheet endpoint (admin only)
app.get('/api/spreadsheet', requireAdmin, (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  res.json(items);
});

// --- Page routes ---
const pages = {
  '/': 'index.html',
  '/dice': 'dice.html',
  '/miniatures': 'miniatures.html',
  '/gallery': 'gallery.html',
  '/admin': 'admin.html',
  '/spreadsheet': 'spreadsheet.html'
};

app.get(Object.keys(pages), (req, res) => {
  const page = pages[req.path];
  if (page) res.sendFile(path.join(__dirname, 'public', page));
});

// Subgroup pages for miniatures
app.get('/miniatures/warhammer/:group', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'miniatures-subgroup.html'));
});

// Dynamic subgroup page for any section group (e.g., /trading-cards/pokemon)
app.get('/:section/:groupId', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = readJSON(CATEGORIES_FILE);
  if (cats[req.params.section]) {
    return res.sendFile(path.join(__dirname, 'public', 'miniatures-subgroup.html'));
  }
  next();
});

// Dynamic section page for any top-level category (e.g., /trading-cards)
app.get('/:section', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = readJSON(CATEGORIES_FILE);
  if (cats[req.params.section]) {
    return res.sendFile(path.join(__dirname, 'public', 'section-page.html'));
  }
  next();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Error handling ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 10MB)' });
  }
  if (err.message && err.message.includes('Only JPEG/PNG/WebP allowed')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`skyf1re Collection running at http://localhost:${PORT}`);
});
