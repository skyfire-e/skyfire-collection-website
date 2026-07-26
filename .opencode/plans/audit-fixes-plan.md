# Audit Fixes — Execution Plan

## Preparation
1. Read all files that need modification to get current content
2. Make edits in batches by file to minimize context usage
3. Run `npm test` and `npm run lint` after all fixes

---

## 🔴 CRITICAL (UX-breaking)

### Fix 1: Blank admin page after login
**File:** `public/js/auth.js:43-61`
**Change:** Add `document.body.classList.remove('hidden');` inside `updateUI()` when `isAdmin()` is true (line 44). Currently `main.js` removes `hidden` only on initial page load; after login via modal, the body stays hidden.
**Edit:**
```js
if (isAdmin()) {
  document.body.classList.remove('hidden');  // ← add this
  if (adminActions) adminActions.classList.remove('hidden');
  ...
```

---

### Fix 2: Lightbox keyboard nav breaks after first close
**File:** `public/js/gallery-page.js:114-121`
**Bug:** `closeLightbox()` calls `document.removeEventListener('keydown', onLightboxKeydown)` but the listener was only added once at line 331 (outside openLightbox). After one close, keyboard shortcuts are gone forever.
**Fix:** Remove the `removeEventListener` line (117-118). The `onLightboxKeydown` already guards with `if (!lightbox.classList.contains('open')) return;` so there's no leak.
**Edit:** Delete lines 117-118:
```js
// DELETE THESE TWO LINES:
if (lbFocusTrap) { lightbox.removeEventListener('keydown', lbFocusTrap); lbFocusTrap = null; }
```
Keep `lbFocusTrap = null;` but move it after.

---

### Fix 3: TOCTOU race in PUT /api/items
**File:** `src/routes/items.js:87-209` + `src/db.js:265-290`
**Bug:** `validateVersion(currentItem, req.body.version)` at line 96 reads the item, then async `Promise.all(files.map(normalizeImage))` at line 119 yields the event loop, then `db.updateItem(currentItem.id, merged)` at line 190 writes. Concurrent PUTs can overwrite each other.
**Fix:** 
1. In `src/db.js:updateItem()` — add a `WHERE version = @expectedVersion` clause and check if rows affected === 0 → throw VersionConflictError
2. Pass `currentItem.version` as `expectedVersion` parameter
3. Import VersionConflictError in db.js

**Edit (db.js):**
```js
// In updateItem(id, fields):
// Change WHERE id = @id → WHERE id = @id AND version = @expectedVersion
// Add expectedVersion param
// If db.prepare(...).run(params).changes === 0 → throw new VersionConflictError(...)
```
**Edit (items.js):**
```js
// Pass currentItem.version to updateItem as expectedVersion
```

---

### Fix 4: Search `total` returns page count, not total count
**File:** `src/routes/items.js:16-22`
**Bug:** `total: items.length` returns number of returned rows (up to limit), not total matches in DB.
**Fix:** Run a separate `SELECT COUNT(*)` query with same search terms, then return the real count.
**Edit (items.js):**
```js
if (q) {
  const parsedLimit = limit ? Math.min(parseInt(limit, 10), 200) : 50;
  const result = db.searchItems(q, parsedLimit);
  if (limit !== undefined) {
    return res.json({ items: result.items, total: result.total, limit: parsedLimit, offset: 0 });
  }
  return res.json(result.items);
}
```
**Edit (db.js:searchItems):** Return `{ items, total }` object instead of array. Add a separate COUNT query.

---

### Fix 5: Null author renders as "null" string
**Files:** `public/js/gallery-page.js:126,231`
**Bug:** `textContent = item.author` renders the string `"null"` when author is null
**Fix:** Use `item.author || ''`
**Edits:**
- Line 126: `lbAuthor.textContent = item.author || '';`
- Line 231: `authorDiv.textContent = item.author || '';`

---

## 🟡 HIGH (functional problems)

### Fix 6: requireSameOrigin port mismatch behind proxy
**File:** `src/middleware.js:28-29`
**Bug:** `new URL(source).host` strips port; `req.get('host')` may include port. Behind NGINX, Origin includes `:3000` but Host doesn't → comparison fails.
**Fix:** Use `req.hostname` (respects `trust proxy`):
```js
if (originHost !== req.hostname) return res.status(403)...;
```

---

### Fix 7: Cropper not initialized on cached images
**File:** `public/js/image-editor.js:184-200`
**Bug:** Setting `cropImg.src` to the same URL as current src doesn't re-fire `onload` in Chrome (cached images). Second crop on same image doesn't initialize Cropper.
**Fix:** Reset src to empty string before setting the new src:
```js
cropImg.onload = () => { ... };
cropImg.src = '';    // ← add this line
cropImg.src = imageSrc;  // existing line 200
```

---

### Fix 8: Shutdown skips WAL checkpoint with keep-alive
**File:** `server.js:27-41`
**Bug:** `server.close()` waits for keep-alive connections. If they don't close within 5s, `forceExit` kills the process before WAL checkpoint runs.
**Fix:** Add `server.closeIdleConnections()` before `server.close()` (Node 19+).
**Edit:**
```js
server.closeIdleConnections();  // ← add before server.close()
server.close(error => { ... });
```

---

### Fix 9: deploy.js guards against pushing to main
**File:** `deploy.js:49-50`
**Bug:** Pushes to current branch unconditionally. AGENTS.md says "NEVER merge to main".
**Fix:** Add guard:
```js
const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
if (branch === 'main') {
  console.error('⛔ Cannot deploy from main branch. Switch to test first.');
  process.exit(1);
}
```

---

### Fix 10: pull.js dep detection uses ORIG_HEAD
**File:** `pull.js:39-45`
**Bug:** `git diff HEAD~1` only checks last commit. If package.json changed 2 commits ago, npm install won't run.
**Fix:** Use `git diff ORIG_HEAD HEAD --name-only` (git creates ORIG_HEAD after pull).
**Edit:**
```js
function getChangedFiles() {
  try {
    return execSync('git diff ORIG_HEAD HEAD --name-only', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  } catch {
    return [];
  }
}
```

---

## 🟠 MEDIUM

### Fix 11: Limit parsing edge cases
**File:** `src/routes/items.js:27-32`
**Bug:** `limit=0` passes through (returns 0 items). `parseInt` on non-numeric returns NaN not caught comprehensively.
**Fix:**
```js
if (limit !== undefined) {
  const n = parseInt(limit, 10);
  if (isNaN(n) || n < 1) return res.status(400).json({ error: 'limit must be a positive integer' });
  parsedLimit = Math.min(n, 100);
  hasLimit = true;
}
```

---

### Fix 12: categories.js NEW_SECTION_MAGIC check order
**File:** `src/routes/categories.js:30-37`
**Bug:** `slugify(label)` runs before checking `parentId === NEW_SECTION_MAGIC`, so slug creation is wasted work (harmless but messy).
**Fix:** Move `catId` generation inside the else branch:
```js
const { section, label, id, parentId, isGroup } = result.data;

if (parentId === NEW_SECTION_MAGIC) {
  const catId = id || slugify(label);  // ← move here
  ...
} else if (...) {
  const catId = id || slugify(label);  // ← and here
  ...
}
```

---

### Fix 13: Cache settings in auth.js
**File:** `public/js/auth.js:49`
**Bug:** `API.get('/api/settings')` fires on every `updateUI()` (every modal open).
**Fix:** Cache settings response in a module-level variable, re-fetch only on login.
```js
let cachedSettings = null;
// ... in updateUI:
if (!cachedSettings) {
  API.get('/api/settings').then(s => { cachedSettings = s; ... });
} else {
  // use cachedSettings
}
// In login handler: cachedSettings = null; before checkAuth()
```

---

### Fix 14: Screen reader announcements for auth errors
**File:** `public/js/auth.js` + HTML files
**Bug:** Login error has no `role="alert"` or `aria-live`
**Fix:** Add `role="alert"` and `aria-live="polite"` to `#authError` element. Already checked — this is in the HTML templates, not JS. Add to all HTML files that have an auth modal.

---

### Fix 15: Make migrations idempotent
**File:** `src/db.js:87-170`
**Bug:** If a migration fails mid-way, schema is partially applied but `user_version` isn't updated. Restart fails on re-run.
**Fix:** Wrap each migration block in a `db.transaction()`. If the transaction succeeds, `user_version` is updated atomically.
```
if (currentVersion < 2) {
  db.transaction(() => {
    // ... migration steps ...
    db.pragma('user_version = 2');
  })();
}
if (currentVersion < 3) {
  db.transaction(() => {
    // ... migration steps ...
    db.pragma('user_version = 3');
  })();
}
```

---

## 🟢 QUALITY

### Fix 16: Extract thumbUrl to api.js
**Files:** `public/js/gallery-page.js:4-8`, `public/js/image-editor.js:22-25`, `public/js/topbar.js:3-7` (dup in 3 files)
**Fix:** Add `thumbUrl` export to `public/js/api.js`, import from there in all 3 files.

### Fix 17: Extract focus trap to shared function
**Files:** `public/js/image-editor.js:54`, `public/js/gallery-page.js:103`
**Fix:** Add `createFocusTrap(container)` to `public/js/api.js`, import in both files.

### Fix 18: Replace inline styles with CSS classes
**File:** `public/js/admin/items.js:341-406`
**Fix:** Move all `style.cssText` assignments to CSS classes in `public/css/admin.css`.

### Fix 19: Add missing aria-labels and theme-init.js
**Files:** `public/miniatures-subgroup.html`, `public/spreadsheet.html`, `public/404.html`
**Fix:** Add `aria-label` on themeBtn/adminBtn; add `<script src="/js/theme-init.js"></script>`.

### Fix 20: ESLint test config rules
**File:** `eslint.config.mjs:43-51`
**Fix:** Add `'no-unused-vars': ['warn', ...]` and `'eqeqeq': ['warn', 'smart']` to test config.

### Fix 21: Add `"private": true` to package.json
**File:** `package.json`
**Fix:** Add `"private": true` after `"main"`.

### Fix 22: `.prettierrc` add `endOfLine: "lf"`
**File:** `.prettierrc`
**Fix:** Add `"endOfLine": "lf"`.

---

## Verification Commands
After all fixes:
1. `npm run lint`
2. `npm test`
3. `npm run check`
