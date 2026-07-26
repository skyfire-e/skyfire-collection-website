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
- Branches: `main` (stable), `test` (current dev)
- ⚠️ NEVER merge to `main` without explicit user confirmation
- Deploy: `npm run deploy` (checkpoint → git add → commit → push to `test`)
- Pull: `npm run pull` (sync from GitHub, safe for shallow clones)
- ⚠️ `data/collection.db` меняется при каждом добавлении/редактировании/удалении позиций — это нормально. **НЕ возвращать** файл БД к состоянию из git и **НЕ игнорировать** его изменения. DB-файл коммитится и пушится как есть, вместе с остальными изменениями.

## Auth
- Username: `ADMIN_USERNAME` (default `admin`), Password: `ADMIN_PASSWORD` или `ADMIN_PASSWORD_HASH` (argon2) — в `.env`
- Session secret: `SESSION_SECRET` в `.env`
- `.env` в `.gitignore`, не попадает в репозиторий

## Site Structure
| Route | Description |
|-------|-------------|
| `/` | Homepage — Dice / Miniatures buttons |
| `/:section` | Section category grid (dynamic from DB) → `/gallery?section=&category=` for leaf, `/:section/:groupId` for groups |
| `/:section/:groupId` | Subgroup page (dynamic from DB, leaf categories → `/gallery?section=&category=`) |
| `/gallery` | Photo grid with lightbox + carousel, drag-and-drop reorder (admin), search highlight |
| `/admin` | Admin panel (CRUD items, categories, settings, spreadsheet, activity log) |
| `/spreadsheet` | Public spreadsheet with collapsible sections, CSV export |
| `/health` | Health check endpoint (DB + uptime) |
| `/sitemap.xml` | Dynamic XML sitemap |

## Features
- **Gallery**: lightbox with carousel, touch swipe, keyboard nav, dot indicators, lazy thumbnails
- **Search**: modal with real-time search across title/author/recaster/status/section/category, highlight animation
- **Nav drawer**: compass icon, site tree from DB, current page highlight
- **Theme**: dark/light toggle, persisted in localStorage, configurable default
- **Categories**: dynamic tree (sections → groups → leaf), managed via admin UI
- **Items**: pagination, sorting via drag-and-drop reorder, version-based optimistic locking, extra fields (recaster/combatPoints/status) per section
- **Spreadsheet**: public view with collapsible categories, per-section currency, configurable columns, CSV export
- **Admin**: tabs (add item, categories, spreadsheet, settings, activity log), image editor with crop, multi-image reorder
- **Security**: Argon2 password hashing, CSRF via Origin/Referer check, Helmet CSP, rate limiting (write 60/15min, login 10/15min, read 200/15min), SRI for CDN assets
- **Operations**: WAL checkpoint, backup (tar.gz, rotation), orphan file GC (dry-run/quarantine/delete), health endpoint, graceful shutdown

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
    items.js           — CRUD /api/items, search, pagination, reorder
    settings.js        — GET|PUT /api/settings
    spreadsheet.js     — /api/spreadsheet (public + admin)
    upload.js          — POST /api/upload/default (default image + thumbnail pipeline)
    backfill.js        — POST /api/backfill-defaults|backfill-images|backfill-prices + GET /api/audit
    checkpoint.js      — POST /api/checkpoint
    pages.js           — page routes + health + sitemap + 404
lib/
  validate.js          — Zod schemas (settingsSchema strict, itemInputSchema, categoryInputSchema)
data/collection.db     — SQLite database (items, categories, settings, sessions, audit)
uploads/               — image files + thumbnails (thumb-*.jpg) — tracked in git
public/                — static frontend (HTML, CSS, JS)
backups/               — backup archives (excluded from git)
```

## API Endpoints
- `GET /api/items?section=&category=&limit=&offset=&q=` — items filter with search/pagination
- `POST /api/items` — create (multipart with images[])
- `PUT /api/items/:id` — update (multipart with images[], version required)
- `DELETE /api/items/:id` — delete + clean up files
- `POST /api/items/reorder` — drag-and-drop reorder (requires section, category, items[])
- `GET/POST/DELETE /api/categories` — CRUD categories (tree, groups, sections)
- `POST /api/auth/login|logout` — auth with same-origin CSRF
- `GET /api/auth/me` — session check
- `GET /api/settings`, `PUT /api/settings` — settings (Zod-validated, strict)
- `POST /api/upload/default` — upload default image
- `POST /api/backfill-defaults` — apply default image to items without photos
- `POST /api/backfill-images` — copy `image` → `images[0]` for items with empty images
- `POST /api/backfill-prices` — normalize price to number
- `GET /api/spreadsheet` — admin full data
- `GET /api/spreadsheet/public` — public view (respects showSpreadsheet/showPublicSpreadsheet)
- `GET /api/audit` — activity log (admin, max 100)
- `POST /api/checkpoint` — WAL checkpoint + session purge
- `GET /health` — health check (status + uptime + db)
- `GET /sitemap.xml` — dynamic XML sitemap

## Key Decisions
- Price скрыта от публики (showPublicSpreadsheet в settings; сейчас включено — цены видны публично)
- Show/hide Spreadsheet button — в настройках
- Если у item нет фото — показывается `/images/default.svg`
- Удаление категории блокируется, если есть items (409 Conflict)
- Backfill только ручной (кнопки "Backfill Default Image", "Backfill Images", "Backfill Prices" в Settings)
- Все items имеют `images[]`; `image` = cover (первый элемент)
- Categories: нормализованные таблицы `sections(id,label,sort_order)` + `categories(id,section_id,parent_id,label,type,sort_order)` с FK CASCADE. Итоговое дерево собирается в `getCategories()`
- Cookie: `skyfire.sid`, httpOnly, sameSite:'lax', secure conditional
- CSRF: проверка Origin/Referer на mutation endpoints (включая login/logout)
- Session: regenerate на login, destroy на logout; SQLite session store (24h expiry)
- CommanderHQ — название админского spreadsheet-таба
- Rate limiting: write (60 req/15min, skip GET), login (10 req/15min), read (200 req/15min)
- PUT /api/items требует поле version (optimistic locking)
- Темы: dark/light, сохраняется в localStorage, defaultTheme в settings

## Scripts
| Command | Description |
|---------|-------------|
| `npm start` | Production start |
| `npm run dev` | Dev mode with `--watch` |
| `npm run backup` | Backup data/ + uploads/ (WAL checkpoint before tar, rotation 10) |
| `npm run checkpoint` | WAL checkpoint + clear sessions |
| `npm run deploy` | One-command deploy: checkpoint → git add → commit → push |
| `npm run pull` | Git pull + auto npm install on dep change |
| `npm run gc:dry` | Find orphan files in uploads (dry run) |
| `npm run gc:quarantine` | Move orphan files to uploads/.quarantine/ |
| `npm run gc` | Delete orphan files not referenced in DB |
| `npm test` | Run tests (in-memory SQLite) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier formatting |
| `npm run check` | Syntax check all source files |
| `npm run ci` | Lint + test |

## Known Issues
- CSP допускает `cdnjs.cloudflare.com` (Cropper.js) — риск компрометации CDN, смягчено SRI-хешами
- Нет лицензионного файла LICENSE в репозитории (в package.json заявлен MIT)
- Нет тестов для: upload pipeline, rate limiting

## Remote Fresh Deploy

Подробная процедура — в `README.md`. Краткая выжимка для агента:
1. **Prerequisites**: Node 20+, git, npm
2. **Clone**: `git clone https://github.com/skyfire-e/skyfire-collection-website.git && cd skyfire-collection-website && git checkout test`
3. **Install**: `npm install`
4. **`.env`**: `cp .env.example .env`, заполнить `SESSION_SECRET` (≥32 chars), `ADMIN_PASSWORD_HASH` (argon2, обязателен в production), `NODE_ENV=production`
5. **Smoke test**: `node server.js` → проверить `/`, `/health`, `/admin`. `Ctrl+C`
6. **Service**: pm2 (`pm2 start server.js --name skyfire-collection`) или systemd
7. **Reverse proxy** (nginx): `proxy_pass http://127.0.0.1:3000` + HTTPS через certbot
8. **Backup**: `npm run backup`, cron: `0 3 * * * cd /path && npm run backup`

### Важно
- В production **plaintext `ADMIN_PASSWORD` запрещён** — только `ADMIN_PASSWORD_HASH` (проверка в `server.js:14`)
- `SESSION_SECRET` < 32 chars → `process.exit(1)` (проверка в `server.js:9`)
- DB и uploads в git — после `git clone` данные уже на месте, миграций не требуется
- `data/collection.db-wal` и `-shm` в `.gitignore`, **не коммитить** — pre-commit hook сам делает `wal_checkpoint(TRUNCATE)` если WAL непустой
