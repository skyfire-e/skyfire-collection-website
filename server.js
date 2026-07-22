const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error('Missing required env vars: SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD');
  console.error('Create a .env file in the project root with these values.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials from .env
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- Data setup ---
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function writeJSONAtomic(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function writeJSONAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

function safeUnlink(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return;
  const target = path.resolve(UPLOADS_DIR, path.basename(imgPath));
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return;
  try { fs.unlinkSync(target); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  for (const f of Array.isArray(files) ? files : [files]) {
    try { fs.unlinkSync(f.path); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
  }
}

function validateItemInput(body, cats, partial) {
  const errors = [];
  const title = body.title !== undefined ? String(body.title).trim() : undefined;
  const section = body.section !== undefined ? String(body.section).trim() : undefined;
  const category = body.category !== undefined ? String(body.category).trim() : undefined;
  const price = body.price !== undefined ? String(body.price).trim() : undefined;

  if (!partial || body.title !== undefined) {
    if (!title) errors.push('Title is required and must be non-empty');
  }
  if (!partial || body.section !== undefined) {
    if (!section) errors.push('Section is required');
    else if (!cats[section]) errors.push('Section "' + section + '" does not exist');
  }
  if (!partial || body.category !== undefined) {
    if (!category) errors.push('Category is required');
    else if (section && cats[section]) {
      const exists = cats[section].subcategories.some(c => {
        if (c.id === category) return true;
        if (c.subcategories) return c.subcategories.some(sc => sc.id === category);
        return false;
      });
      if (!exists) errors.push('Category "' + category + '" does not exist in section "' + section + '"');
    }
  }
  if (!partial || body.price !== undefined) {
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) errors.push('Invalid price format');
  }

  return errors.length > 0 ? errors : null;
}

// Init data files (only items.json — auth via .env)
['items.json'].forEach(f => {
  const fp = path.join(DATA_DIR, f);
  if (!fs.existsSync(fp)) writeJSONAtomic(fp, []);
});

// Single admin user from .env
const users = [{ username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: 'admin' }];

// --- Middleware ---
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: !!process.env.HTTPS, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- Auth middleware ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.user?.role === 'admin') return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' }
});

// --- API Routes ---

// Auth
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.user = { username: user.username, role: user.role };
    res.json({ success: true, user: { username: user.username, role: user.role } });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout error' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
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

  writeJSONAtomic(CATEGORIES_FILE, cats);
  res.json(cats);
});

app.delete('/api/categories', requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const items = readJSON(ITEMS_FILE) || [];
  const { section, id, parentId } = req.body;

  if (!section || !cats[section]) return res.status(400).json({ error: 'Invalid section' });

  function collectIds(cat) {
    const ids = [cat.id];
    if (cat.subcategories) cat.subcategories.forEach(sc => ids.push(...collectIds(sc)));
    return ids;
  }

  let affectedCats = [];
  if (!id) {
    // Delete entire section — check ALL items in this section
    const sectionItems = items.filter(i => i.section === section);
    if (sectionItems.length > 0) {
      return res.status(409).json({
        error: `Cannot delete section "${section}": ${sectionItems.length} items still reference it`
      });
    }
  } else if (parentId) {
    // Delete nested subcategory within a group
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (!parent || !parent.subcategories) return res.status(400).json({ error: 'Parent not found' });
    const target = parent.subcategories.find(c => c.id === id);
    if (target) affectedCats = collectIds(target);
  } else {
    // Delete flat subcategory or group
    const target = cats[section].subcategories.find(c => c.id === id);
    if (target && target.type === 'group' && target.subcategories) {
      affectedCats = collectIds(target);
    } else {
      affectedCats = [id];
    }
  }

  if (affectedCats.length > 0) {
    const linked = items.filter(i => i.section === section && affectedCats.includes(i.category));
    if (linked.length > 0) {
      return res.status(409).json({
        error: `Cannot delete category: ${linked.length} items still reference it`
      });
    }
  }

  if (!id) {
    delete cats[section];
  } else if (parentId) {
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    parent.subcategories = parent.subcategories.filter(c => c.id !== id);
  } else {
    cats[section].subcategories = cats[section].subcategories.filter(c => c.id !== id);
  }

  writeJSONAtomic(CATEGORIES_FILE, cats);
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
  const cats = readJSON(CATEGORIES_FILE) || {};
  const settings = readJSON(SETTINGS_FILE) || {};
  const files = req.files || [];
  const images = files.map(f => '/uploads/' + f.filename);

  // Validation
  const errors = validateItemInput(req.body, cats);
  if (errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: errors }); }

  const newItem = {
    id: crypto.randomUUID(),
    section: req.body.section,
    category: req.body.category,
    title: req.body.title || 'Untitled',
    author: req.body.author || '',
    price: req.body.price || '',
    recaster: req.body.recaster || '',
    combatPoints: req.body.combatPoints || '',
    status: req.body.status || '',
    image: images.length > 0 ? images[0] : (settings.defaultImage || '/images/default.svg'),
    images: images,
    createdAt: new Date().toISOString()
  };
  items.push(newItem);
  try {
    writeJSONAtomic(ITEMS_FILE, items);
  } catch (err) {
    cleanupUploadedFiles(files);
    console.error('Failed to save items.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }
  res.json(newItem);
});

app.put('/api/items/:id', requireAdmin, upload.array('images', 10), (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const cats = readJSON(CATEGORIES_FILE) || {};
  const files = req.files || [];
  const idx = items.findIndex(i => i.id == req.params.id);
  if (idx === -1) { cleanupUploadedFiles(files); return res.status(404).json({ error: 'Not found' }); }

  const errors = validateItemInput(req.body, cats, { partial: true });
  if (errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: errors }); }

  if (req.body.title !== undefined) items[idx].title = String(req.body.title).trim();
  if (req.body.author !== undefined) items[idx].author = req.body.author;
  if (req.body.price !== undefined) items[idx].price = req.body.price;
  if (req.body.recaster !== undefined) items[idx].recaster = req.body.recaster;
  if (req.body.combatPoints !== undefined) items[idx].combatPoints = req.body.combatPoints;
  if (req.body.status !== undefined) items[idx].status = req.body.status;
  if (req.body.section !== undefined) items[idx].section = req.body.section;
  if (req.body.category !== undefined) items[idx].category = req.body.category;

  if (!Array.isArray(items[idx].images)) items[idx].images = [];
  const oldImages = [...items[idx].images];

  let removeIdx = [];
  if (req.body.imagesToRemove) {
    try { removeIdx = JSON.parse(req.body.imagesToRemove); } catch(e) { removeIdx = []; }
  }
  let finalOrder = [];
  if (req.body.finalOrder) {
    try { finalOrder = JSON.parse(req.body.finalOrder); } catch(e) { finalOrder = []; }
  }

  if (finalOrder.length > 0) {
    const originalMap = {};
    oldImages.forEach((img, i) => { originalMap[i] = img; });
    if (Array.isArray(removeIdx)) removeIdx.forEach(i => delete originalMap[i]);

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
  } else if (Array.isArray(removeIdx) && removeIdx.length > 0 && oldImages.length > 0) {
    removeIdx.sort((a, b) => b - a).forEach(i => {
      if (i >= 0 && i < oldImages.length) oldImages.splice(i, 1);
    });
    items[idx].images = oldImages;
    files.forEach(f => items[idx].images.push('/uploads/' + f.filename));
  } else if (files.length > 0) {
    items[idx].images = [...oldImages, ...files.map(f => '/uploads/' + f.filename)];
  }

  if (files.length > 0 || removeIdx.length > 0 || finalOrder.length > 0) {
    if (items[idx].images && items[idx].images.length > 0) {
      items[idx].image = items[idx].images[0];
    } else {
      items[idx].images = [];
      items[idx].image = readJSON(SETTINGS_FILE)?.defaultImage || '/images/default.svg';
    }
  }

  try {
    writeJSONAtomic(ITEMS_FILE, items);
  } catch (err) {
    cleanupUploadedFiles(files);
    console.error('Failed to save items.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }

  // After successful save, delete old images no longer referenced
  const newSet = new Set(items[idx].images);
  for (const img of oldImages) {
    if (!newSet.has(img)) {
      const stillReferenced = items.some((other, oi) => oi !== idx && (other.image === img || other.images?.includes(img)));
      if (!stillReferenced) safeUnlink(img);
    }
  }

  res.json(items[idx]);
});

app.delete('/api/items/:id', requireAdmin, (req, res) => {
  let items = readJSON(ITEMS_FILE) || [];
  const idx = items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const deletedItem = items[idx];
  const imagesToRemove = [deletedItem.image, ...(deletedItem.images || [])];
  items.splice(idx, 1);

  try {
    writeJSONAtomic(ITEMS_FILE, items);
  } catch (err) {
    console.error('Failed to save items.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }

  const uniquePaths = [...new Set(imagesToRemove.filter(Boolean))];
  for (const img of uniquePaths) {
    const stillReferenced = items.some(other => other.image === img || other.images?.includes(img));
    if (!stillReferenced) safeUnlink(img);
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
  if (changed > 0) writeJSONAtomic(ITEMS_FILE, items);
  res.json({ updated: changed, defaultImage: defaultImg });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(readJSON(SETTINGS_FILE));
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const settings = readJSON(SETTINGS_FILE) || {};
  if (req.body.defaultImage) settings.defaultImage = req.body.defaultImage;
  if (req.body.siteName) settings.siteName = req.body.siteName;
  if (req.body.showSpreadsheet !== undefined) settings.showSpreadsheet = req.body.showSpreadsheet;
  if (req.body.showPublicSpreadsheet !== undefined) settings.showPublicSpreadsheet = req.body.showPublicSpreadsheet;
  if (req.body.showMiniaturesColumns !== undefined) settings.showMiniaturesColumns = req.body.showMiniaturesColumns;
  if (req.body.currencies !== undefined) settings.currencies = req.body.currencies;
  writeJSONAtomic(SETTINGS_FILE, settings);
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
  try {
    writeJSONAtomic(SETTINGS_FILE, settings);
  } catch (err) {
    cleanupUploadedFiles([req.file]);
    console.error('Failed to save settings.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }
  res.json(settings);
});

// Backfill images array from image field for items that have photo but empty images[]
app.post('/api/backfill-images', requireAdmin, (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  let changed = 0;
  items.forEach(item => {
    const imgs = item.images;
    const hasImages = Array.isArray(imgs) ? imgs.some(i => i && !i.includes('default.svg')) : false;
    if (!hasImages && item.image && !item.image.includes('default.svg')) {
      item.images = [item.image];
      changed++;
    }
  });
  if (changed > 0) writeJSONAtomic(ITEMS_FILE, items);
  res.json({ updated: changed });
});

// Spreadsheet endpoint (admin only)
app.get('/api/spreadsheet', requireAdmin, (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  res.json(items);
});

// 404 for unknown API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
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
app.get('/miniatures/:group', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`skyf1re Collection running at http://localhost:${PORT}`);
});
