# skyf1re Collection — Project Context

## Stack
- Node.js/Express backend, vanilla JS frontend, JSON file storage
- Static files in `public/`, data in `data/`, uploads in `uploads/`
- Server: `server.js`, runs on `localhost:3000`
- Git: GitHub (https://github.com/skyfire-e/skyfire-collection-website.git)
- Branches: `main` (stable), `test` (changes before merge)
- ⚠️ NEVER merge to `main` without explicit user confirmation

## Working Tools
- Все скрипты для парсинга, миграции, черновики и временные файлы лежат в `gitignore/`
- `gitignore/` добавлен в `.gitignore` — не попадает в репозиторий
- Это наши рабочие инструменты, пока делаем сайт; корень проекта чистый

## Current Data State
- `items.json` — 240 items across all Dice + Miniatures categories
- `categories.json` — Dice (7 flat) + Miniatures (Skaven+SpaceOrks groups, остальные flat)
- `uploads/` — 555+ image files (все scraped фото)
- `settings.json` — defaultImage, siteName, showSpreadsheet, etc.
- Auth: `data/users.json` исключён из git, аутентификация через `.env`

## Auth
- Username: `ADMIN_USERNAME` (default `admin`), Password: `ADMIN_PASSWORD` — оба в `.env`
- `.env` в `.gitignore`, не попадает в репозиторий
- Session secret: `SESSION_SECRET` в `.env`

## Site Structure
- `/` → homepage with Dice / Miniatures buttons
- `/dice` → category grid → `/gallery?section=dice&category=...`
- `/miniatures` → category grid (groups link to subgroup pages, leaf link to gallery)
- `/miniatures/skaven` → 6 subcategories
- `/miniatures/space-orks` → 7 subcategories
- `/gallery?section=...&category=...` → photo grid (lightbox + carousel)
- `/admin` → admin panel (add/edit/delete items, categories, settings)
- `/spreadsheet` → public spreadsheet with prices (по настройкам)

## Navigation Hierarchy
**Miniatures groups** (с подстраницами):
- Skaven → /miniatures/skaven
  - Citadel Skaven, Old Citadel Skaven, Blood Bowl Skaven, Forgeworld Skaven, Punga Miniatures Skaven, 3d Prints Skaven
- Space Orks → /miniatures/space-orks
  - Citadel Orks, Forgeworld Orks, Old Citadel Orks (oldhammer), Artel W, Kromlech, Various Studios, 3d Printed Orks

**Miniatures leaf** (прямо в галерею):
- Gloomspite Gitz (AoS), Adepta Sororitas (40k), Orruk Warclans (AoS), Chaos Daemons, Soulblight Gravelords (AoS), Astra Militarum (40k), Officio Assassinorum, Ogor Mawtribes, Maggotkin of Nurgle, Kharadron Overlords, Empire, High Elves, Stormcast Eternals, Terrain, Other

## Categories JSON Format
Группы имеют `type: "group"` и вложенный `subcategories`. Листовые — просто `{id, label}`.

## Key Decisions
- Price колонка скрыта от публики, видна только в Spreadsheet админа
- Show/hide Spreadsheet button — в настройках Settings
- Если у item нет фото — показывается `/images/default.svg`
- Удаление категории блокируется, если есть items в ней
- Автоматический backfill при смене defaultImage **удалён** — только ручная кнопка "Backfill Default Image"
- Все items имеют `images[]` — при создании фото пишутся в массив, `image` = cover

## Iteration 2 — Applied (Jul 2026)
- ✅ writeJSONAtomic — temp + rename, защита от битого JSON
- ✅ cleanupUploadedFiles при ошибках валидации и сбоях записи (POST/PUT/DELETE/upload/default)
- ✅ safeUnlink с проверкой пути + проверка ссылок от других items перед удалением
- ✅ PUT/DELETE: сохранение JSON → потом удаление старых файлов

## Iteration 3 — Applied (Jul 2026)
- ✅ 404 для неизвестных `/api/*` (перед page routes)
- ✅ Rate limit на `/api/auth/login` (express-rate-limit, 10/15min)
- ✅ Session regeneration на login + destroy callback + clearCookie на logout

## Iteration 4 — Applied (Jul 2026)
- ✅ Удалён `style.css` — дубликат `base.css`
- ✅ `trust proxy` + `secure: !!process.env.HTTPS` conditional
- ✅ Price validation — уже была в validateItemInput (Iteration 1)

## Implemented Fixes (from security/code review)
1. ✅ Пароль админа в `.env`, `users.json` удалён из git, в `.gitignore`
2. ✅ Session secret в `SESSION_SECRET` env, guard при старте
3. ✅ Stored XSS — `textContent` вместо `innerHTML` (Jul 2026 — gallery + admin spreadsheet)
4. ✅ Upload validation — MIME filter (JPEG/PNG/WebP), UUID filenames (Jul 2026 — crypto.randomUUID)
5. ⬜ MemoryStore — не меняли (для одного сервера норм)
6. ✅ Rate limit — express-rate-limit, 10/15min на login (Jul 2026)
7. ✅ Cookie: `httpOnly`, `sameSite: 'lax'`, `trust proxy` (Jul 2026 — trust proxy + HTTPS conditional)
8. ⬜ Sync IO — оставили (198 items ~200KB, не критично)
9. ✅ readJSON — логирует ошибки, fallback-параметр
10. ✅ Централизованный error handler (multer + generic)
11. ✅ Удаление категории — проверка на привязанные items (Jul 2026 — серверная проверка + 409)
12. ✅ `safeUnlink` — чистка файлов при удалении item/фото
13. ✅ `crypto.randomUUID()` вместо `Date.now()` для ID (Jul 2026 — multer + item IDs)
14. ✅ API validation — title, section, category, price (Jul 2026 — POST + PUT, validateItemInput)
15. ⬜ Price — хранится как number (пока строка, конвертируется в spreadsheet)
16. ⬜ Рефакторинг HTML (модули) — не делали, возможен

## Known Issues & Fixes Applied
- **Backfill bug**: у 190 items было `images: []` при наличии `image`. Исправлено: `POST /api/backfill-images` скопировал `image` → `images[0]`. Авто-backfill убран. Модалка теперь показывает `image` если `images` пуст.
- **PUT handler**: не затирает `image` дефолткой, если фото не менялись.

## API Endpoints
- `GET /api/items?section=&category=` — items filter
- `POST /api/items` — create (multipart with images[])
- `PUT /api/items/:id` — update (multipart with images[])
- `DELETE /api/items/:id` — delete + clean up files
- `GET/POST/DELETE /api/categories` — CRUD categories
- `POST /api/auth/login|logout` — auth
- `GET /api/settings`, `PUT /api/settings` — settings
- `POST /api/upload/default` — upload default image (no backfill)
- `POST /api/backfill-defaults` — apply default image to items without photos
- `POST /api/backfill-images` — copy `image` → `images[0]` for items with empty images
- `GET /api/spreadsheet` — admin full data
- `GET /api/spreadsheet/public` — public view

## Planned Features
- Telegram bot для загрузки позиций (бот принимает фото + подпись, пишет в `/api/items`)
  - Нужен токен от @BotFather
  - Пакет `node-telegram-bot-api`

## Prioritized Fix Queue (from code review Jul 2026)

Execute in order, 3 per iteration, test between iterations.

### Iteration 1 — Security & Data Integrity
1. **PUT /api/items/:id — валидация + UUID filenames**
   - multer filename: `Date.now()` → `crypto.randomUUID()`
   - PUT: валидировать title (required, non-empty), section (exists), category (exists в секции)
   - Вынести общую валидацию в `validateItemInput(body, cats)`

2. **DELETE /api/categories — проверка items на сервере**
   - Перед удалением категории считать items с этой category/section
   - Рекурсивно собирать все дочерние ID для групп
   - Возвращать `409 Conflict` если есть привязанные items

3. **innerHTML → textContent / createElement (XSS)**
   - `gallery-page.js`: `renderItems` переписать на createElement, `textContent` для title/author
   - `admin/items.js`: spreadsheet rows — createElement вместо innerHTML

### Iteration 2 — File Handling & API Cleanup
4. **writeJSON → atomic (temp + rename)**
   - Писать во временный файл, затем `fs.renameSync`
   - `writeJSONAtomic(file, data)`

5. **cleanupUploadedFiles при ошибке валидации**
   - Удалять `req.files` если POST/PUT вернул 400/404
   - Helper `function cleanupUploadedFiles(files)`

6. **Удаление старых фото после успешной записи JSON**
   - В PUT: сохранить JSON → потом удалять старые файлы

### Iteration 3 — Auth Hardening & Routing
7. **404 для неизвестных `/api/*`**
   - Перед catch-all `app.use('/api', (req, res) => res.status(404).json(...))`

8. **Rate limit на `/api/auth/login`**
   - Пакет `express-rate-limit`, 10 попыток за 15 мин

9. **Session regeneration на login + logout callback**
   - `req.session.regenerate()` при логине
   - `req.session.destroy(callback)` при логауте

### Iteration 4 — Housekeeping
10. **Удалить `style.css`** — дубликат `base.css`
11. **Cookie → `secure: true` conditional** — проверять `req.headers['x-forwarded-proto']`
12. **Price validation в POST/PUT** — `/^\d+(\.\d{1,2})?$/`, reject невалидные

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
