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
| `npm test` | Run tests (in-memory SQLite) |
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
