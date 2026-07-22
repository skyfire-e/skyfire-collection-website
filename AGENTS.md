# skyf1re Collection — Project Context

## Stack
- Node.js/Express backend, vanilla JS frontend, JSON file storage
- Static files in `public/`, data in `data/`, uploads in `uploads/`
- Server: `server.js`, runs on `localhost:3000`
- Git: GitHub (https://github.com/skyfire-e/skyfire-collection-website.git)
- Branches: `main` (stable), `test` (changes before merge)

## Current Data State
- `items.json` — 198 items across all Dice + Miniatures categories
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
- `/miniatures/warhammer/skaven` → 6 subcategories
- `/miniatures/warhammer/space-orks` → 7 subcategories
- `/gallery?section=...&category=...` → photo grid (lightbox + carousel)
- `/admin` → admin panel (add/edit/delete items, categories, settings)
- `/spreadsheet` → public spreadsheet with prices (по настройкам)

## Navigation Hierarchy
**Miniatures groups** (с подстраницами):
- Skaven → /miniatures/warhammer/skaven
  - Citadel Skaven, Old Citadel Skaven, Blood Bowl Skaven, Forgeworld Skaven, Punga Miniatures Skaven, 3d Prints Skaven
- Space Orks → /miniatures/warhammer/space-orks
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

## Implemented Fixes (from security/code review)
1. ✅ Пароль админа в `.env`, `users.json` удалён из git, в `.gitignore`
2. ✅ Session secret в `SESSION_SECRET` env, guard при старте
3. ✅ Stored XSS — `textContent` вместо `innerHTML`
4. ✅ Upload validation — MIME filter (JPEG/PNG/WebP), UUID filenames
5. ⬜ MemoryStore — не меняли (для одного сервера норм)
6. ⬜ Rate limit — не ставили (личный сайт)
7. ✅ Cookie: `httpOnly`, `sameSite: 'lax'`, `trust proxy`
8. ⬜ Sync IO — оставили (198 items ~200KB, не критично)
9. ✅ readJSON — логирует ошибки, fallback-параметр
10. ✅ Централизованный error handler (multer + generic)
11. ✅ Удаление категории — проверка на привязанные items
12. ✅ `safeUnlink` — чистка файлов при удалении item/фото
13. ✅ `crypto.randomUUID()` вместо `Date.now()` для ID
14. ✅ API validation — title required, section/category exist
15. ✅ Price — хранится как number, не string
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
