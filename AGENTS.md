# skyf1re Collection — Project Context

## Stack
- Node.js/Express backend, vanilla JS frontend, **SQLite** database (better-sqlite3)
- Static files in `public/`, database in `data/collection.db`, uploads in `uploads/`
- Modules: `server.js` (entry) → `src/` (app, db, routes, middleware, helpers, errors)
- Validation: `lib/validate.js` (Zod schemas, `.strict()` on settings)
- Image processing: `sharp` (upload pipeline + thumbnails 400px)
- Sessions: SQLite store (data/collection.db, sessions table, 24h expiry)
- DB + uploads tracked in git; .env excluded

## Git
- GitHub: https://github.com/skyfire-e/skyfire-collection-website.git
- Branches: `main` (stable, merge commit `956a7a1`), `test` (current dev, `c8499f9`), `SQLmigrationTrue` (old, synced)
- ⚠️ NEVER merge to `main` without explicit user confirmation
- Deploy: `npm run deploy` (checkpoint → git add → commit → push to `test`)
- Pull: `npm run pull` (sync from GitHub, safe for shallow clones)

## Auth
- Username: `ADMIN_USERNAME` (default `admin`), Password: `ADMIN_PASSWORD` или `ADMIN_PASSWORD_HASH` (argon2) — в `.env`
- Session secret: `SESSION_SECRET` в `.env`
- `.env` в `.gitignore`, не попадает в репозиторий

## Current Data State
- `data/collection.db` — SQLite: 610 items (Dice: 145, Miniatures: 465) + categories + settings + sessions + audit
- `uploads/` — 616 images + 615 thumbnails (tracked in git)
- Old JSON files (items.json, categories.json, settings.json) — deleted after SQLite migration
- **All 465 miniatures have Command Points** (77 exact from Wahapedia AoS4/40K10, 388 estimated by analogy)
- DB schema version: `user_version = 4`

## Site Structure
| Route | Description |
|-------|-------------|
| `/` | Homepage — Dice / Miniatures buttons |
| `/dice` | Category grid → `/gallery?section=dice&category=...` |
| `/miniatures` | Category grid (groups→subgroup pages, leaf→gallery) |
| `/miniatures/skaven` | Skaven subgroup page (6 leaf categories) |
| `/miniatures/space-orks` | Space Orks subgroup page (7 leaf categories) |
| `/gallery` | Photo grid with lightbox + carousel |
| `/admin` | Admin panel (add/edit/delete items, categories, settings) |
| `/spreadsheet` | Public spreadsheet (show/hide per settings) |
| `/health` | Health check endpoint |

## Navigation — Leaf Miniatures Categories
Gloomspite Gitz, Adepta Sororitas, Orcs, Chaos Daemons, Soulblight Gravelords,
Astra Militarum, Officio Assassinorum, Oger Mawtribes, Maggotkin of Nurgle, Kharadron Overlords,
Empire of Man, High Elves, Stormcast Eternals, Terrain, Other

## Project Structure
```
server.js              — entry point (env guard, listen, graceful shutdown)
src/
  app.js               — Express app (middleware → routes → error handler)
  db.js                — SQLite database (better-sqlite3, schema, CRUD, sessions)
  errors.js            — ValidationError, VersionConflictError
  helpers.js           — normalizeImage, validate*, safeUnlink, findCategory, flattenCategories
  middleware.js         — requireAdmin, requireSameOrigin, loginLimiter, upload (multer)
  routes/
    auth.js            — /api/auth/login|logout|me
    categories.js      — CRUD /api/categories
    items.js           — CRUD /api/items
    settings.js        — GET|PUT /api/settings
    spreadsheet.js     — /api/spreadsheet (public + admin)
    upload.js          — POST /api/upload/default (default image + thumbnail pipeline)
    backfill.js        — POST /api/backfill-defaults|backfill-images|backfill-prices
    pages.js           — page routes + health + 404
lib/
  validate.js          — Zod schemas (settingsSchema strict, itemInputSchema)
data/collection.db     — SQLite database (items, categories, settings, sessions, audit)
uploads/               — image files + thumbnails (thumb-*.jpg) — tracked in git
public/                — static frontend (HTML, CSS, JS)
backups/               — backup archives (excluded from git)
```

## API Endpoints
- `GET /api/items?section=&category=` — items filter
- `POST /api/items` — create (multipart with images[])
- `PUT /api/items/:id` — update (multipart with images[])
- `DELETE /api/items/:id` — delete + clean up files
- `GET/POST/DELETE /api/categories` — CRUD categories
- `POST /api/auth/login|logout` — auth
- `GET /api/auth/me` — session check
- `GET /api/settings`, `PUT /api/settings` — settings (Zod-validated, strict)
- `POST /api/upload/default` — upload default image
- `POST /api/backfill-defaults` — apply default image to items without photos
- `POST /api/backfill-images` — copy `image` → `images[0]` for items with empty images
- `POST /api/backfill-prices` — normalize price to number
- `GET /api/spreadsheet` — admin full data
- `GET /api/spreadsheet/public` — public view

## Key Decisions
- Price скрыта от публики (showPublicSpreadsheet в settings; сейчас включено — цены видны публично)
- Show/hide Spreadsheet button — в настройках
- Если у item нет фото — показывается `/images/default.svg`
- Удаление категории блокируется, если есть items (409 Conflict)
- Backfill только ручной (кнопки "Backfill Default Image", "Backfill Images", "Backfill Prices" в Settings)
- Все items имеют `images[]`; `image` = cover (первый элемент)
- Categories: группы `type:"group"` + `subcategories[]`, листовые `{id, label}` — хранятся в SQLite (table: categories, column: data JSON)
- Cookie: `skyfire.sid`, httpOnly, sameSite:'lax', secure conditional
- CSRF: проверка Origin/Referer на mutation endpoints
- Session: regenerate на login, destroy на logout; SQLite session store (24h expiry)
- CommanderHQ — название админского spreadsheet-таба
- Rate limiting: write (60 req/15min, skip GET), read (200 req/15min)

## Implemented Iterations

### Iteration A — P0 Security (Sharp + CSRF + XSS)
- Sharp upload pipeline (normalizeImage, EXIF strip, mozjpeg 88%, max 3000px)
- API wrapper (`response.ok`) в `api.js`
- CSRF same-origin middleware (`requireSameOrigin`)
- XSS fix: settings.js innerHTML → createElement/textContent

### Iteration B — P0 Stability (Atomic writes + Cookie)
- Strict `finalOrder` validation (checks `removedIndexes`)
- Candidate-based PUT with full replacement validation
- `envBoolean()` helper for COOKIE_SECURE/TRUST_PROXY
- Cookie renamed to `skyfire.sid`, logout `clearCookie` with same options

### Iteration C — P0 Operations (Health + Graceful shutdown + Diagnostics)
- `GET /health` endpoint
- Graceful shutdown on SIGINT/SIGTERM
- `public/404.html` with status 404
- `withPending` helper in `api.js`

### Iteration D — P1+P2+P3 (Backup + Validation + UI + Split)
- `backup.js` (tar data/ + uploads/, excludes .tmp/.quarantine)
- `npm i zod`, `lib/validate.js` — Zod schemas for settings/category/item
- `image-editor.js` — innerHTML→createElement (eliminates stored XSS vector)
- `revokeObjectURL` cleanup on crop/close/save (no blob: leaks)
- Section dropdown populated from `/api/categories` (no hardcoded dice/miniatures)
- server.js split into `src/` modules (routes, middleware, helpers, errors)

### Iteration E — P0+P1 (Argon2 + Mutex + Sessions + Deps)
- Argon2 password hashing (ADMIN_PASSWORD_HASH env var)
- Empty category ID guard for non-Latin labels
- Backfill routes restored (admin-protected)

### Iteration F — P0+P1+P2 (Security hardening + Quality)
- Security headers via `helmet` (CSP, HSTS, XFO, X-Content-Type-Options)
- Rate limiting on mutation endpoints (60 req / 15 min)
- SRI integrity hashes for Cropper.js CDN assets (admin.html + gallery.html)
- README.md with setup and deployment instructions
- CI (GitHub Actions — syntax check, module load, tests)

### Iteration G — Cleanup + Thumbnails + Hardening
- Removed unused exports: `booleanString`, `categoriesSchema`, `subcategorySchema`, `AUDIT_FILE`
- Removed duplicate route `POST /api/settings/upload/default`
- SRI integrity hashes added to `gallery.html` for Cropper.js CDN
- Rate limiting added for public GET endpoints (`/api/auth/me`, `/api/spreadsheet/public` — 200 req/15 min)
- Thumbnail pipeline: `normalizeImage` generates `thumb-*.jpg` (400px) alongside full-size image
- `safeUnlink` deletes both full-size and thumbnail on image removal
- Gallery frontend uses thumbnails for cards, falls back to full-size on error

### Iteration H — SQLite Migration
- `better-sqlite3`, `src/db.js` with full schema (items, categories, settings, audit, sessions)
- Migrated all data from JSON → SQLite on first run (610 items, 2 sections, 6 settings)
- All routes rewritten to use SQLite instead of JSON files
- Sessions moved from `session-file-store` to SQLite store (sessions table)
- Old JSON files deleted; DB + uploads tracked in git
- Backfill buttons added to admin UI (Backfill Images, Backfill Prices)
- `session-file-store` dependency removed

### Iteration I — Critical Bug Fixes + Hardening
- **#1**: Fixed image loss in PUT /api/items — `originalMap` now uses original indices
- **#2**: CSP allows `blob:` in `imgSrc` (crop preview works)
- **#3**: Rate limiter skips GET/HEAD/OPTIONS (public browsing not throttled)
- **#4**: Sessions now expire after 24h (`cookie.maxAge` instead of `this.maxAge`)
- **#5**: Login error shown to user (try/catch in auth.js)
- **#6**: Tests use in-memory DB (`NODE_TEST_DB=1`), `settingsSchema.strict()`, `null = DELETE`
- **#7**: Backup runs `wal_checkpoint(TRUNCATE)` before tar (consistent snapshot)
- **#8**: Logout resets currentUser via checkAuth
- **#9**: Currency inputs: placeholder `USD`, hint `ISO 4217`, maxLength 3
- **#10**: Price inputs: `type="number"` (add + edit + admin)
- **#11**: Cancel crop loads next file in queue
- **#12**: Frontend try/catch on add/delete item, delete category
- **#13**: `javascript:history.back()` → `/`
- **#14**: Lightbox nav buttons moved inside viewport (left:10px/right:10px)
- **#16**: `settingsSchema.passthrough()` → `.strict()` (no testKey leak)
- **#17**: Admin page hidden until auth check passes (no flash)
- **#20**: CI module load check includes `src/db.js`
- `backups/` added to `.gitignore`
- `engines: { node: ">=20" }`, `license: MIT`, `allowScripts` removed
- Version → `1.6.0`

### Iteration J — Normalized Schema + Sorting + Search + UI
- DB migration v3: normalized `sections(id,label,sort_order)` + `categories(id,section_id,parent_id,label,type,sort_order)` with FK CASCADE
- DB migration v4: `sort_order` column on items for drag-and-drop reordering
- `reorderItems` with section/category scope (`WHERE section=? AND category=?`)
- `searchItems` with LIKE escaping (`%`, `_`, `\`)
- `getItemCount` for pagination metadata
- Pagination API: with limit → `{items,total,limit,offset}`, without → array (backward compatible)
- Dark/light theme toggle with `localStorage` + `defaultTheme` setting
- Compass SVG icon + nav drawer (site tree) + search modal with teleport + highlight animation
- Loading dots (ripple animation) in gallery and spreadsheet
- CSV export on spreadsheet page
- Activity log: admin tab, `GET /api/audit` (rotation max 1000)
- Drag-and-drop reordering: `POST /api/items/reorder`, `sort_order` in DB
- Orphan GC: `gc-uploads.js` (`npm run gc:dry`, `gc:quarantine`, `gc`)
- ESLint (flat config v9+) + Prettier, `npm run lint`, CI lint step
- 59 tests (unit + HTTP via supertest)
- `deploy.js`: one-step deploy (`execFileSync`, no shell injection)
- `pull.js`: GitHub sync (shallow-clamp safe), auto `npm install` on dep change
- `npm run checkpoint`: WAL checkpoint + session purge
- Favicon SVG, compass SVG icon
- SEO: meta description, OG tags, `robots.txt`, `sitemap.xml`
- Accessibility: role=dialog, focus-trap, aria-labels in lightbox/modal
- Compression (gzip) + logging (morgan)
- Cache-Control `max-age=1y, immutable` on `/uploads`
- Rate limiter skips GET/HEAD/OPTIONS
- `requireSameOrigin` on login + logout
- `settingsSchema.strict()` (no key leak)
- SESSION_SECRET length check on startup (>= 32)
- Plaintext password rejected in production (`NODE_ENV=production`)
- Graceful shutdown: `wal_checkpoint(TRUNCATE)` + `db.close()`
- Health endpoint: `SELECT 1` DB check
- All inline styles → CSS classes (56 styles → `base.css`/`admin.css`)
- CSP: `scriptSrc 'self'` (no unsafe-inline), `styleSrc 'self'` (no unsafe-inline), `imgSrc 'self' data: blob:`
- Unicode slug for category IDs (Cyrillic → Latin)
- Custom extra fields via `sectionsWithExtraFields`
- Category group creation via admin UI (`isGroup` flag)
- DB migration runner (`PRAGMA user_version`)
- Audit table rotation (max 1000)
- Removed: `getCurrentUser`, `DATA_DIR`, `gitignore/`, `DataCorruptionError`, `readJSON`, `writeJSONAtomic`, `withDataLock`, `migrateFromJSON`, `saveSettings`, `session-file-store`, `jimp`, `playwright`, `puppeteer`, `allowScripts`
- Version → `1.7.2`

### Iteration K — Command Points (all miniatures)
- 77 exact CP from Wahapedia AoS4/40K10 (Citadel Skaven, Gloomspite Gitz, Orruk Warclans, Astra Militarum, Adepta Sororitas, Officio Assassinorum, Chaos Daemons, Kharadron Overlords, Ogor Mawtribes, Empire)
- 388 estimated CP by analogy (Legends Skaven, Old Citadel Skaven, Forgeworld Skaven, 3D prints Skaven, Blood Bowl Skaven, Punga Miniatures, Other, Terrain=0)
- **All 465 miniatures now have Command Points** — 0 remaining without CP
- Blood Bowl Skaven: gold cost → points analogy (e.g. Rat Ogre 150K → 150 pts)
- Non-GW models (3D prints, Punga, First Legion): estimated by closest Citadel analogues
- Estimated CP not marked as estimated in DB (per user request)

## Known Gaps
| Issue | Priority | Status |
|-------|----------|--------|
| None | — | All major gaps resolved |

## Planned Features
- Telegram bot для загрузки позиций (бот принимает фото + подпись, пишет в `/api/items`)
  - Нужен токен от @BotFather
  - Пакет `node-telegram-bot-api`

## How to Restart Server
```bash
# macOS / Linux
kill $(lsof -t -i:3000) 2>/dev/null
cd /Users/skyfire/Documents/mySiteR
node server.js
```
