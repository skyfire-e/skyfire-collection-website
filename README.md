# skyf1re Collection

Personal collection website for dice and miniatures — photo gallery with lightbox, spreadsheet, and admin panel.

## Features

- Photo grid with lightbox + carousel viewer
- Category browsing (Dice, Miniatures + subgroups)
- Public spreadsheet (configurable columns)
- Admin panel (CRUD items, categories, settings)
- Image upload with sharp pipeline (EXIF strip, resize, mozjpeg, thumbnails)
- Argon2 password hashing, CSRF protection, SQLite sessions
- CommanderHQ — admin spreadsheet tab

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express |
| Frontend | Vanilla JS, CSS |
| Storage | SQLite (`data/collection.db`, better-sqlite3) |
| Images | sharp (upload + thumbnails), Cropper.js (crop) |
| Validation | Zod (`lib/validate.js`, strict) |
| Auth | Argon2, express-session + SQLite store |

## Quick Start

```bash
# Prerequisites: Node.js 20+
npm install

# Create .env from example
cp .env.example .env
# Edit .env: set SESSION_SECRET (min 32 chars) and ADMIN_PASSWORD or ADMIN_PASSWORD_HASH

# Start (dev with --watch)
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | Yes | — | Session signing key (min 32 characters) |
| `ADMIN_USERNAME` | No | `admin` | Admin login name |
| `ADMIN_PASSWORD` | No* | — | Plain-text password (discouraged) |
| `ADMIN_PASSWORD_HASH` | No* | — | Argon2 hash of password |
| `PORT` | No | `3000` | Server port |
| `COOKIE_SECURE` | No | `NODE_ENV=production` | Force secure cookies |
| `TRUST_PROXY` | No | `false` | Set to `1` behind reverse proxy |

*Either `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` must be set.

Generate an Argon2 hash:

```bash
node -e "require('argon2').hash('your-password').then(h => console.log(h))"
```

## Scripts

| Command | Description |
|---|---|
| `npm start` | Production start |
| `npm run dev` | Dev mode with `--watch` |
| `npm run backup` | Backup data/ + uploads/ (WAL checkpoint before tar) |
| `npm run checkpoint` | WAL checkpoint + clear sessions (run before git commit) |
| `npm run deploy` | One-command deploy: checkpoint → git add → commit → push |
| `npm run gc:dry` | Find orphan files in uploads (dry run, no deletion) |
| `npm run gc:quarantine` | Move orphan files to uploads/.quarantine/ |
| `npm run gc` | Delete orphan files not referenced in DB |
| `npm test` | Run tests (in-memory SQLite, 59 tests) |
| `npm run lint` | ESLint check |
| `npm run check` | Syntax check all source files |

## Project Structure

```
server.js              — Entry point (env guard, listen, graceful shutdown)
src/
  app.js               — Express app (middleware → routes → error handler)
  db.js                — SQLite database (schema, CRUD, sessions, audit)
  errors.js            — ValidationError, VersionConflictError
  helpers.js           — Image processing, validation, file cleanup
  middleware.js         — Auth, CSRF, upload, rate limiting
  routes/              — auth, items, categories, settings, spreadsheet, upload, backfill, pages
lib/
  validate.js          — Zod schemas (strict)
data/collection.db     — SQLite database (items, categories, settings, sessions, audit)
uploads/               — Image files + thumbnails (tracked in git)
public/                — Static frontend (HTML, CSS, JS)
backups/               — Backup archives (gitignored)
```

## API Overview

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/items` | Public | List items (filter by section/category) |
| `POST /api/items` | Admin | Create item |
| `PUT /api/items/:id` | Admin | Update item |
| `DELETE /api/items/:id` | Admin | Delete item |
| `GET /api/categories` | Public | List categories |
| `POST/DELETE /api/categories` | Admin | CRUD categories |
| `GET /api/settings` | Public | Get settings |
| `PUT /api/settings` | Admin | Update settings |
| `POST /api/auth/login` | Public | Login |
| `GET /api/spreadsheet` | Admin | Full spreadsheet data |
| `GET /api/spreadsheet/public` | Public | Public spreadsheet |

## Fresh Deployment (Remote Server)

Полная процедура поднятия сайта с нуля на удалённом сервере. БД и uploads/ уже в git, поэтому данные не нужно копировать вручную — достаточно клонировать репозиторий.

### 1. Prerequisites

- **OS**: Linux (Ubuntu 22.04+ / Debian 12+)
- **Node.js**: 20+ (`node -v`)
- **git**, **npm**
- (Опционально) nginx/Caddy — reverse proxy для HTTPS и заголовков
- (Опционально) pm2 или systemd — автоперезапуск

Проверка версии Node:
```bash
node -v   # должно быть v20.x.x или выше
```

Если Node старый — поставить через NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone

```bash
git clone https://github.com/skyfire-e/skyfire-collection-website.git
cd skyfire-collection-website
git checkout test   # dev-ветка (main — стабильная, но сейчас синхронизированы)
```

> БД (`data/collection.db`, 610 items) и все изображения (`uploads/`, 616 файлов) уже в репозитории — ничего вручную копировать не нужно.

### 3. Install dependencies

```bash
npm install
```

`postinstall` автоматически создаст symlink на pre-commit hook (WAL-checkpoint перед коммитом).

> Если `sharp` или `better-sqlite3` падают при сборке — поставьте build tools:
> ```bash
> sudo apt install -y build-essential python3
> ```

### 4. Configure `.env`

```bash
cp .env.example .env
```

Отредактировать `.env`:

| Переменная | Обязательно | Значение для production |
|---|---|---|
| `SESSION_SECRET` | Да | Случайная строка ≥ 32 символа |
| `ADMIN_PASSWORD_HASH` | Да (prod) | Argon2-хеш пароля (plaintext в prod запрещён) |
| `ADMIN_USERNAME` | Нет | `admin` (или своё) |
| `PORT` | Нет | `3000` |
| `NODE_ENV` | Да | `production` |
| `COOKIE_SECURE` | Нет | Авто в production (можно `1`) |
| `TRUST_PROXY` | Нет | `1` если за nginx/Caddy |

Генерация `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Генерация `ADMIN_PASSWORD_HASH` (Argon2):
```bash
node -e "require('argon2').hash('your-password').then(h => console.log(h))"
```

Пример итогового `.env`:
```ini
PORT=3000
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$argon2id$v=19$m=65536,t=3,p=4$...
SESSION_SECRET=abc123def456...min32chars
TRUST_PROXY=1
```

### 5. Verify data integrity (опционально, но рекомендуется)

```bash
# Проверить, что БД открылась и данные на месте
node -e "
  const db = require('better-sqlite3')('data/collection.db');
  console.log('user_version:', db.pragma('user_version')[0].user_version);
  console.log('items:', db.prepare('SELECT COUNT(*) c FROM items').get().c);
  console.log('categories:', db.prepare('SELECT COUNT(*) c FROM categories').get().c);
  console.log('sections:', db.prepare('SELECT COUNT(*) c FROM sections').get().c);
  db.close();
"
```
Ожидание: `user_version: 4`, `items: 610`, `categories: 37`, `sections: 2`.

```bash
# Сверить количество файлов в uploads с ожидаемым
ls uploads/ | grep -v thumb- | grep -v '\.tmp' | wc -l   # ~616 файлов (без thumb-)
```

### 6. Smoke test перед запуском как сервис

```bash
npm run check        # syntax check всех исходников
npm test            # 59 тестов (in-memory DB, не трогает data/collection.db)
node server.js      # вручную, проверить http://<server-ip>:3000
```

Открыть в браузере:
- `http://<server-ip>:3000/` — главная
- `http://<server-ip>:3000/health` — должно вернуть `{"status":"ok"}`
- `http://<server-ip>:3000/admin` — логин (`ADMIN_USERNAME` + пароль)

Если всё ок — `Ctrl+C`, запускать как сервис.

### 7. Run as a service

**Вариант A — pm2 (проще):**
```bash
sudo npm i -g pm2
pm2 start server.js --name skyfire-collection
pm2 save
pm2 startup    # следовать инструкции для автозапуска
```

**Вариант B — systemd:**
```bash
sudo tee /etc/systemd/system/skyfire-collection.service > /dev/null <<'EOF'
[Unit]
Description=skyf1re Collection
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/path/to/skyfire-collection-website
EnvironmentFile=/path/to/skyfire-collection-website/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now skyfire-collection
sudo systemctl status skyfire-collection
```

### 8. Reverse proxy (nginx) — для HTTPS и домена

```nginx
server {
    listen 80;
    server_name your-domain.tld;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Потом HTTPS через certbot:
```bash
sudo certbot --nginx -d your-domain.tld
```

При наличии nginx — `TRUST_PROXY=1` в `.env` (для корректных IP в rate-limit и логах).

### 9. First backup

```bash
npm run backup   # архив в backups/skyfire-collection-YYYY-MM-DD.tar.gz
```

Настроить cron для регулярных бэкапов:
```bash
0 3 * * * cd /path/to/skyfire-collection-website && npm run backup >> backups/cron.log 2>&1
```

### 10. Post-deploy checklist

- [ ] `http://<server-ip>:3000/health` → `{"status":"ok"}`
- [ ] `/` грузится, 2 секции (Dice, Miniatures)
- [ ] `/admin` принимает логин, не показывает admin-UI до авторизации
- [ ] `/gallery?section=dice` — фото отображаются (значит uploads/ на месте)
- [ ] Логи `pm2 logs` / `journalctl -u skyfire-collection` — без ошибок
- [ ] `.env` в `.gitignore` (уже в репо, но проверить)
- [ ] `data/*.db-wal` и `data/*.db-shm` в `.gitignore` (уже в репо)

### Update existing deployment

```bash
git pull origin test      # или: npm run pull (shallow-clamp safe)
npm install               # если сменились зависимости
pm2 restart skyfire-collection   # или: sudo systemctl restart skyfire-collection
```

## Deployment

1. Set `NODE_ENV=production` and `COOKIE_SECURE=true`
2. Set `TRUST_PROXY=1` if behind nginx/Caddy
3. Use a process manager (pm2, systemd) for auto-restart
4. Schedule `npm run backup` via cron/task scheduler

## Data Safety

- SQLite WAL mode for concurrent reads
- Prepared statements (no SQL injection)
- Backup runs `wal_checkpoint(TRUNCATE)` for consistent snapshot
- Version field for optimistic conflict detection
- Audit log for all mutations
- In-memory DB for tests (no production data pollution)

## License

MIT
