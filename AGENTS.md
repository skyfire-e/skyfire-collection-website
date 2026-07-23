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
- `items.json` — 438 items across all Dice + Miniatures categories
- `categories.json` — Dice (7 flat) + Miniatures (Skaven+SpaceOrks groups, 14 leaf)
- `uploads/` — 1000+ image files (все scraped фото + миграции)
- `settings.json` — defaultImage, siteName, showSpreadsheet, etc.
- Auth: `data/users.json` исключён из git, аутентификация через `.env`

## Space Orks — мигрированы из Google Sites (Jul 2026)

| Категория | Items | Карусели | Статус |
|-----------|-------|----------|--------|
| Citadel Orks | 62 | Boomdakka (7), Beastboss (2) | ✅ |
| Forgeworld Orks | 17 | Gargantuan Squiggoth (7), Kill Bursta (3) | ✅ |
| Old Citadel Orks | 20 | — | ✅ |
| Artel W | 11 | Iron Rider (2) | ✅ |
| Kromlech | 20 | Goblin Scrap Tank III (5) | ✅ |
| Various Studios | 5 | — | ✅ |
| 3d Printed Orks | 32 | — | ✅ |

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
  - Citadel Orks, Forgeworld Orks, Old Citadel Orks, Artel W, Kromlech, Various Studios, 3d Printed Orks

**Miniatures leaf** (прямо в галерею):
- Gloomspite Gitz, Adepta Sororitas, Orruk Warclans, Chaos Daemons, Soulblight Gravelords, Astra Militarum, Officio Assassinorum, Ogor Mawtribes, Maggotkin of Nurgle, Kharadron Overlords, Empire, High Elves, Stormcast Eternals, Terrain, Other

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

## Space Orks — Google Sites Migration Pattern

Все Space Orks категории мигрированы со страниц Google Sites через Puppeteer.

### Шаблон миграционного скрипта (`gitignore/migrate-*.js`)
```javascript
// 1. Puppeteer открывает страницу, скроллит для ленивой загрузки
// 2. Парсит все h2 с span.jgG6ef — из них извлекается номер + название
//    Регекс для названия: /^(\d+)[-–]?\d*\)?\s*(.*)/
//    - Обрабатывает "82-83) Title" (диапазон)
//    - Обрабатывает "114Title" (нет скобки после числа)
// 3. Для каждого h2 находится колонка (.parentElement до .LS81yb)
// 4. В той же колонке ищется изображение:
//    - Карусель: .mr3rhf → [style*="background-image"] → URL из url()
//    - Одиночное: .t3iYD img → img.src
// 5. Author: колонка → p → textContent
// 6. Отчистка author: remove (painted) через sanitizeAuthor()
// 7. Загрузка всех изображений через HTTPS с cookies
// 8. Запись items в items.json (atomic: tmp + rename)
// 9. Pre-flight валидация: category проверяется из categories.json
```

### Важные правила
1. **Category ID** всегда сверять с `categories.json` — скрипт падает если не найдено
2. **Section**: всегда `'miniatures'` для миниатюр
3. **Carousel vs standalone**: все фото карусели берутся только из `.mr3rhf`, ни одно из `imgUrls`
4. **Author**: очищается от `(painted)` через `sanitizeAuthor()`
5. **Title**: числа и скобки вроде "172) " удаляются регексом
6. **Структура DOM**: каждая секция `.yaqOZd` содержит 2 колонки (по 1 item в каждой),
   колонки — прямые дети `.LS81yb`. В одной колонке и изображение, и текст (h2 + p).

### Доступные скрипты миграции (`gitignore/`)
| Скрипт | Откуда | Категория | Фичи |
|--------|--------|-----------|------|
| `migrate-orks.js` | Google Sites → Citadel Orks | `citadel-orks` | imgUrls + carouselUrls mapping |
| `migrate-forgeworld.js` | Google Sites → Forgeworld Orks | `forgeworld-orks` | images[] from DOM direct |
| `migrate-oldcitadel.js` | Google Sites → Old Citadel Orks | `old-citadel-orks-oldhammer` | + cat validation, + split-number title |
| `migrate-artelw.js` | Google Sites → Artel W | `artel-w` | images[] from DOM |
| `migrate-kromlech.js` | Google Sites → Kromlech | `kromlech` | + sanitizeAuthor (painted) |
| `migrate-various.js` | Google Sites → Various Studios | `various-studios` | full template |

## Project Modules
- `lib/validate.js` — Zod schemas for settings/category/item validation
- `server.js` — Express app (all routes + middleware, to be split in P3)

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
- `GET /health` endpoint (before page routes)
- Graceful shutdown on SIGINT/SIGTERM
- `public/404.html` with status 404
- `gitignore/check-data.js` — 7965 integrity checks
- `withPending` helper in `api.js` + delete button
- Smoke test fixes (CSRF Origin + valid JPEG via sharp)
- Quarantine: 886 orphaned files to `uploads/.quarantine/`

### Iteration D — P1+P2 (Backup + Validation + UI hardening)
- **P1**: `gitignore/backup.js` (tar data/ + uploads/, excludes .tmp/.quarantine)
- **P1**: `npm i zod`, `lib/validate.js` — Zod schemas for settings/category/item
- **P2**: `image-editor.js` — innerHTML → createElement (eliminates stored XSS vector)
- **P2**: `revokeObjectURL` cleanup on crop/close/save (no blob: leaks)
- **P2**: Section dropdown populated from `/api/categories` (no hardcoded dice/miniatures)
- **P2**: `withPending` on addSection/addSubcat buttons

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
