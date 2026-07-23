# skyf1re Collection — Project Context

## Stack
- Node.js/Express backend, vanilla JS frontend, JSON file storage
- Static files in `public/`, data in `data/`, uploads in `uploads/`
- Modules: `server.js` (entry) → `src/` (app, routes, middleware, helpers, errors)
- Validation: `lib/validate.js` (Zod schemas)
- Image processing: `sharp` (upload pipeline)

## Git
- GitHub: https://github.com/skyfire-e/skyfire-collection-website.git
- Branches: `main` (stable), `test` (changes before merge)
- ⚠️ NEVER merge to `main` without explicit user confirmation
- Tags: v1.4.1 latest (Iteration D + P3 split)

## Working Tools
- Все скрипты (парсинг, миграция, проверка данных, smoke-test) лежат в `gitignore/`
- `gitignore/` в `.gitignore` — не попадает в репозиторий
- Скрипты: `backup.js`, `check-data.js`, `smoke-test.js`, `quarantine-orphans.js`

## Auth
- Username: `ADMIN_USERNAME` (default `admin`), Password: `ADMIN_PASSWORD` — оба в `.env`
- Session secret: `SESSION_SECRET` в `.env`
- `.env` в `.gitignore`, не попадает в репозиторий

## Current Data State
- `items.json` — ~440 items across Dice + Miniatures categories
- `categories.json` — Dice (7 flat) + Miniatures (Skaven+SpaceOrks groups, ~14 leaf + other leaf categories)
- `uploads/` — 1000+ image files
- `settings.json` — defaultImage, siteName, showSpreadsheet, showMiniaturesColumns, currencies

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
Gloomspite Gitz, Adepta Sororitas, Orruk Warclans, Chaos Daemons, Soulblight Gravelords,
Astra Militarum, Officio Assassinorum, Ogor Mawtribes, Maggotkin of Nurgle, Kharadron Overlords,
Empire, High Elves, Stormcast Eternals, Terrain, Other

## Project Structure
```
server.js              — entry point (env guard, listen, graceful shutdown)
src/
  app.js               — Express app (middleware → routes → error handler)
  errors.js            — ValidationError, DataCorruptionError
  helpers.js           — readJSON, writeJSONAtomic, normalizeImage, validate*, etc.
  middleware.js         — requireAdmin, requireSameOrigin, loginLimiter, upload (multer)
  routes/
    auth.js            — /api/auth/login|logout|me
    categories.js      — CRUD /api/categories
    items.js           — CRUD /api/items
    settings.js        — GET|PUT /api/settings
    spreadsheet.js     — /api/spreadsheet (public + admin)
    upload.js          — POST /api/upload/default
    pages.js           — page routes + health + 404
lib/
  validate.js          — Zod schemas (settingsSchema, categoriesSchema, itemInputSchema)
gitignore/             — working tools (excluded from git)
data/                  — JSON storage (items, categories, settings)
uploads/               — image files
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
- Price скрыта от публики (showPublicSpreadsheet в settings)
- Show/hide Spreadsheet button — в настройках
- Если у item нет фото — показывается `/images/default.svg`
- Удаление категории блокируется, если есть items (409 Conflict)
- Backfill только ручной (кнопка "Backfill Default Image")
- Все items имеют `images[]`; `image` = cover (первый элемент)
- Categories JSON: группы `type:"group"` + `subcategories[]`, листовые `{id, label}`
- Cookie: `skyfire.sid`, httpOnly, sameSite:'lax', secure conditional
- CSRF: проверка Origin/Referer на mutation endpoints
- Session: regenerate на login, destroy на logout

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

## Known Gaps (from code review)
| Issue | Priority | Status |
|-------|----------|--------|
| Argon2 password hashing | Low | Not done (plain ===, .env защищён) |
| Optimistic locking (versioning) | Low | Not done (один сервер, без race conditions) |
| Cyrillic category → empty ID | Low | Not done (можно указать ID вручную) |
| Recursive spreadsheet flatten | Low | Not done (работает для 2 уровней) |
| Runtime deps cleanup (jimp, playwright) | Medium | Not done (в production deps) |
| Multi-file crop (File[] queue) | Low | Partially done (cropQueue + revoke) |
| uploads/ in Git (LFS or .gitkeep) | Medium | Not done (1000+ файлов в истории) |
| README.md + CI | Medium | Not done |
| MemoryStore → SQLite | Low | Not done (ок для одного сервера) |
| Migration endpoints → npm scripts | Low | Not done (auth-защищены) |

## Planned Features
- Telegram bot для загрузки позиций (бот принимает фото + подпись, пишет в `/api/items`)
  - Нужен токен от @BotFather
  - Пакет `node-telegram-bot-api`

## How to Restart Server
```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "C:\Program Files\nodejs\node.exe"
$psi.Arguments = "server.js"
$psi.WorkingDirectory = "C:\Users\Skyfire_e\Documents\OpenCode_Agent\mySite"
$psi.UseShellExecute = $true
$p = [System.Diagnostics.Process]::Start($psi)
```
