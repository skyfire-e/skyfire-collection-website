# skyf1re Collection — Project Context

## Stack
- Node.js/Express backend, vanilla JS frontend, **SQLite** database (better-sqlite3)
- Static files in `public/`, database in `data/collection.db`, uploads in `uploads/`
- Modules: `server.js` (entry) → `src/` (app, db, routes, middleware, helpers, errors)
- Validation: `lib/validate.js` (Zod schemas)
- Image processing: `sharp` (upload pipeline + thumbnails)
- Sessions: SQLite store (data/collection.db, sessions table)
- DB + uploads tracked in git; .env excluded

## Git
- GitHub: https://github.com/skyfire-e/skyfire-collection-website.git
- Branches: `main` (stable), `test` (changes before merge)
- ⚠️ NEVER merge to `main` without explicit user confirmation
- Tags: v1.5.1 latest (Iteration F)

## Working Tools
- Все скрипты (парсинг, миграция, проверка данных, smoke-test) лежат в `gitignore/`
- `gitignore/` в `.gitignore` — не попадает в репозиторий
- Скрипты: `backup.js`, `check-data.js`, `smoke-test.js`, `quarantine-orphans.js`, `backfill-defaults.js`, `backfill-images.js`

## Auth
- Username: `ADMIN_USERNAME` (default `admin`), Password: `ADMIN_PASSWORD` или `ADMIN_PASSWORD_HASH` (argon2) — в `.env`
- Session secret: `SESSION_SECRET` в `.env`
- `.env` в `.gitignore`, не попадает в репозиторий

## Current Data State
- `data/collection.db` — SQLite: 610 items (Dice: 145, Miniatures: 465) + categories + settings + sessions + audit
- `uploads/` — 616 images + 615 thumbnails (tracked in git)
- Old JSON files (items.json, categories.json, settings.json) — deleted after SQLite migration

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
Astra Militarum, Officio Assassinorum, Ogor Mawtribes, Maggotkin of Nurgle, Kharadron Overlords,
Empire of Man, High Elves, Stormcast Eternals, Terrain, Other

## Project Structure
```
server.js              — entry point (env guard, listen, graceful shutdown)
src/
  app.js               — Express app (middleware → routes → error handler)
  db.js                — SQLite database (better-sqlite3, schema, migration, CRUD)
  errors.js            — ValidationError, DataCorruptionError, VersionConflictError
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
  validate.js          — Zod schemas (settingsSchema, itemInputSchema)
gitignore/             — working tools (excluded from git)
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
- `GET /api/settings`, `PUT /api/settings` — settings (Zod-validated)
- `POST /api/upload/default` — upload default image
- `POST /api/backfill-defaults` — apply default image to items without photos
- `POST /api/backfill-images` — copy `image` → `images[0]` for items with empty images
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
- Session: regenerate на login, destroy на logout; SQLite session store

## Implemented Iterations

### Iteration A — P0 Security (Sharp + CSRF + XSS)
- Sharp upload pipeline (normalizeImage, EXIF strip, mozjpeg 88%, max 3000px)
- API wrapper (`response.ok`) в `api.js`
- CSRF same-origin middleware (`requireSameOrigin`)
- XSS fix: settings.js innerHTML → createElement/textContent

### Iteration B — P0 Stability (Atomic writes + Cookie)
- `readJSON` throws `DataCorruptionError` on corrupted files
- Strict `finalOrder` validation (checks `removedIndexes`)
- Candidate-based PUT with full replacement validation
- `writeJSONAtomic` cleans up `.tmp` on error
- `envBoolean()` helper for COOKIE_SECURE/TRUST_PROXY
- Cookie renamed to `skyfire.sid`, logout `clearCookie` with same options

### Iteration C — P0 Operations (Health + Graceful shutdown + Diagnostics)
- `GET /health` endpoint
- Graceful shutdown on SIGINT/SIGTERM
- `public/404.html` with status 404
- `gitignore/check-data.js` — 7965 integrity checks
- `withPending` helper in `api.js`
- Smoke test fixes (CSRF Origin + valid JPEG via sharp)
- Quarantine: 886 orphaned files to `uploads/.quarantine/`

### Iteration D — P1+P2+P3 (Backup + Validation + UI + Split)
- **P1**: `gitignore/backup.js` (tar data/ + uploads/, excludes .tmp/.quarantine)
- **P1**: `npm i zod`, `lib/validate.js` — Zod schemas for settings/category/item
- **P2**: `image-editor.js` — innerHTML→createElement (eliminates stored XSS vector)
- **P2**: `revokeObjectURL` cleanup on crop/close/save (no blob: leaks)
- **P2**: Section dropdown populated from `/api/categories` (no hardcoded dice/miniatures)
- **P2**: `withPending` on addSection/addSubcat buttons
- **P3**: server.js split into `src/` modules (routes, middleware, helpers, errors)

### Iteration E — P0+P1 (Argon2 + Mutex + SQLite sessions + Deps)
- **#8**: Argon2 password hashing (ADMIN_PASSWORD_HASH env var)
- **#11**: Write mutex (withDataLock) for concurrent write serialization
- **#13**: Empty category ID guard for non-Latin labels
- **#30**: Backfill routes restored (admin-protected)
- **#31**: File-based session store (persists across restarts)
- **#36**: Runtime deps cleanup (jimp, playwright, puppeteer-core → devDependencies)
- **#40**: uploads/* added to .gitignore

### Iteration F — P0+P1+P2 (Security hardening + Quality)
- **server.js**: env guard accepts ADMIN_PASSWORD_HASH without ADMIN_PASSWORD
- **P1**: Security headers via `helmet` (CSP, HSTS, XFO, X-Content-Type-Options)
- **P2**: Rate limiting on mutation endpoints (60 req / 15 min)
- **P2**: SRI integrity hashes for Cropper.js CDN assets (admin.html + gallery.html)
- **P2**: README.md with setup and deployment instructions
- **P2**: CI (GitHub Actions — lint, test, check)
- **P2**: AGENTS.md synced to actual code state

### Iteration G — Cleanup + Thumbnails + Hardening
- Removed unused exports: `booleanString`, `categoriesSchema`, `subcategorySchema`, `AUDIT_FILE`
- Removed duplicate route `POST /api/settings/upload/default` (kept `POST /api/upload/default`)
- Removed stale `data/users.json` from `.gitignore`
- `appendAudit` now uses `writeJSONAtomic` (was raw `writeFileSync`)
- SRI integrity hashes added to `gallery.html` for Cropper.js CDN
- Rate limiting added for public GET endpoints (`/api/auth/me`, `/api/spreadsheet/public` — 200 req/15 min)
- Thumbnail pipeline: `normalizeImage` generates `thumb-*.jpg` (400px) alongside full-size image
- `safeUnlink` now deletes both full-size and thumbnail on image removal
- Gallery frontend uses thumbnails for cards, falls back to full-size on error
- Tests import from `src/helpers.js` instead of duplicating functions
- CI: added `src/helpers.js` to syntax check + module load check, removed redundant step
- `git rm --cached` for 615 uploaded images (no longer in git), `uploads/.gitkeep` added

### Iteration H — SQLite Migration
- Installed `better-sqlite3`, created `src/db.js` with full schema (items, categories, settings, audit, sessions)
- Migrated all data from JSON → SQLite on first run (610 items, 2 sections, 6 settings)
- All routes rewritten to use SQLite instead of JSON files
- Sessions moved from `session-file-store` to SQLite store (sessions table)
- `helpers.js` cleaned: removed `readJSON`, `writeJSONAtomic`, `withDataLock`, `appendAudit` (all in db.js now)
- Old JSON files (items.json, categories.json, settings.json) deleted
- DB (`data/collection.db`) + uploads tracked in git; WAL/SHM temp files excluded
- Backfill buttons added to admin UI (Backfill Images, Backfill Prices)
- Tests rewritten: SQLite integration tests added (insert/delete/filter/settings/sessions)
- `session-file-store` dependency removed
- CI updated: `src/db.js` added to syntax check

## Known Gaps (from code review)
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
