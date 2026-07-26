# skyf1re Collection

Personal collection website for dice and miniatures — photo gallery with lightbox, spreadsheet, and admin panel.

## Features

- Photo grid with lightbox + carousel viewer (touch swipe, keyboard nav, dot indicators)
- Search modal with real-time search across title/author/recaster/status/section/category, highlight animation
- Category browsing (sections → groups → leaf categories, dynamic from DB)
- Nav drawer with site tree from DB, current page highlight
- Dark/light theme toggle, persisted in localStorage, configurable default
- Public spreadsheet with collapsible sections, per-section currency, configurable columns, CSV export
- Admin panel: tabs (add item, categories, CommanderHQ spreadsheet, settings, activity log)
- Image upload with sharp pipeline (EXIF strip, resize, mozjpeg, thumbnails 400px)
- Image editor with Cropper.js crop, multi-image upload and reorder (drag)
- Drag-and-drop reorder in gallery (admin), version-based optimistic locking
- Pagination with search, per-section extra fields (recaster/combatPoints/status)
- Argon2 password hashing, CSRF protection, SQLite sessions, rate limiting
- Orphan file GC (dry-run/quarantine/delete), WAL checkpoint, backup (tar.gz, rotation 10)
- One-command deploy (`npm run deploy`), safe pull (`npm run pull`)

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

## Project Structure

```
server.js              — Entry point (env guard, listen, graceful shutdown)
src/
  app.js               — Express app (middleware → routes → error handler)
  db.js                — SQLite database (schema, CRUD, sessions, audit)
  errors.js            — ValidationError, VersionConflictError
  helpers.js           — Image processing, validation, file cleanup
  middleware.js         — Auth, CSRF, upload, rate limiting
  routes/              — auth, items, categories, settings, spreadsheet, upload, backfill, checkpoint, pages
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
| `GET /api/items` | Public | List items (filter by section/category, pagination, search) |
| `POST /api/items` | Admin | Create item (multipart with images[]) |
| `PUT /api/items/:id` | Admin | Update item (multipart, requires version) |
| `DELETE /api/items/:id` | Admin | Delete item |
| `POST /api/items/reorder` | Admin | Drag-and-drop reorder (section, category, items[]) |
| `GET /api/categories` | Public | List category tree |
| `POST/DELETE /api/categories` | Admin | CRUD categories |
| `GET /api/settings` | Public | Get settings |
| `PUT /api/settings` | Admin | Update settings |
| `POST /api/auth/login` | Public | Login (same-origin CSRF) |
| `POST /api/auth/logout` | Public | Logout |
| `GET /api/auth/me` | Public | Session check |
| `GET /api/spreadsheet` | Admin | Full spreadsheet data |
| `GET /api/spreadsheet/public` | Public | Public spreadsheet |
| `GET /api/audit` | Admin | Activity log (max 100) |
| `POST /api/upload/default` | Admin | Upload default image |
| `POST /api/backfill-defaults` | Admin | Apply default image to items without photos |
| `POST /api/backfill-images` | Admin | Copy `image` → `images[0]` |
| `POST /api/backfill-prices` | Admin | Normalize price to number |
| `POST /api/checkpoint` | Admin | WAL checkpoint + session purge |
| `GET /health` | Public | Health check (status + uptime + db) |
| `GET /sitemap.xml` | Public | Dynamic XML sitemap |

## Deployment

### Quick deploy (one command)
```bash
npm run deploy   # checkpoint → git add → commit → push to current branch
```

### Fresh Deployment (Remote Server)

1. Node 20+, git, npm
2. `git clone https://github.com/skyfire-e/skyfire-collection-website.git && cd skyfire-collection-website && git checkout test`
3. `npm install`
4. `cp .env.example .env` — fill `SESSION_SECRET` (≥32 chars), `ADMIN_PASSWORD_HASH` (argon2, required in production), `NODE_ENV=production`
5. Service via pm2 or systemd
6. nginx reverse proxy for HTTPS (certbot)
7. Schedule `npm run backup` via cron

### Update existing
```bash
npm run pull                   # fetch + merge + auto npm install on dep change
pm2 restart skyfire-collection  # or: systemctl restart skyfire-collection
```

### Production notes
- `ADMIN_PASSWORD_HASH` required in production (plaintext `ADMIN_PASSWORD` rejected)
- `SESSION_SECRET` must be ≥ 32 characters
- `data/collection.db-wal` and `-shm` in `.gitignore` — pre-commit hook auto-checkpoints WAL
- DB + uploads in git — after clone data is already in place, no manual copy needed

## Data Safety

- SQLite WAL mode for concurrent reads
- Prepared statements (no SQL injection)
- Backup runs `wal_checkpoint(TRUNCATE)` for consistent snapshot
- Version field for optimistic conflict detection
- Audit log for all mutations
- Orphan file GC (dry-run/quarantine/delete)
- In-memory DB for tests (no production data pollution)
- ⚠️ `data/collection.db` меняется при каждом изменении коллекции через админку. Файл БД отслеживается в git, коммитится и пушится вместе с остальными изменениями. **Не возвращать** БД к состоянию из репозитория и не игнорировать её изменения — это рабочие данные, которые должны синхронизироваться как есть.

## License

MIT
