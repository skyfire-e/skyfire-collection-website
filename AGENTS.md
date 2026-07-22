# skyf1re Collection — Project Context

## Stack
- Node.js/Express backend, vanilla JS frontend, JSON file storage
- Static files in `public/`, data in `data/`, uploads in `uploads/`
- Server: `server.js`, runs on `localhost:3000`

## Current State (after reset)
- `items.json` — Stone Dice: 6 items with 20 photos (carousel support via `images[]`)
- `categories.json` — Dice (7 flat) + Miniatures (Skaven+SpaceOrks groups, остальные flat)
- `uploads/` — 20 stone-dice images
- `backup_scraped/` — 555 images + items.json + categories.json (бекап скрапнутых данных)
- Сервер обновлён: `upload.array('images', 10)` вместо `upload.single('image')`
- Галерея: lightbox-карусель с dots для multi-image items
- Админка: `multiple` upload для добавления нескольких фото сразу

## Site Structure
- `/` → homepage with Dice / Miniatures buttons
- `/dice` → category grid → `/gallery?section=dice&category=...`
- `/miniatures` → category grid (groups link to subgroup pages, leaf link to gallery)
- `/miniatures/warhammer/skaven` → 6 subcategories
- `/miniatures/warhammer/space-orks` → 7 subcategories
- `/gallery?section=...&category=...` → photo grid
- `/admin` → admin panel (login: admin/admin123)

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
- После сброса — наполняем витрины с нуля вместе с пользователем

## Current Task
Наполняем витрины заново с помощью админки (вручную). Очередность:
1. Создать подстраницы Skaven и Space Orks ✅
2. Заполнено: Stone Dice (6 items, 20 photos) ✅
3. Продолжить — Metal Dice, Resin Dice, остальные категории

## Planned Features
- Telegram bot для загрузки позиций на сайт (бот принимает фото + подпись, пишет в `/api/items`)
  - Нужен токен от @BotFather
  - Пакет `node-telegram-bot-api`
  - Скрипт бота параллельно серверу или встроенный

## How to Restart Server
```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "C:\Program Files\nodejs\node.exe"
$psi.Arguments = "server.js"
$psi.WorkingDirectory = "C:\Users\Skyfire_e\Documents\OpenCode_Agent\mySite"
$psi.UseShellExecute = $true
$p = [System.Diagnostics.Process]::Start($psi)
```
