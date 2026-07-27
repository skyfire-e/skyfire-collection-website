# skyfire Collection

Self-hosted gallery and collection manager for dice, miniatures, and tabletop items.

---

## Quick Start

```bash
cp .env.example .env
# edit .env — SESSION_SECRET (min 32 chars) + ADMIN_PASSWORD or ADMIN_PASSWORD_HASH
npm install
npm run dev     # http://localhost:3000
```

**Requirements:** Node.js >= 22

---

## Features

### Public

- **Homepage** — landing with links to sections
- **Dynamic section pages** — auto-generated from database-defined sections and categories
- **Gallery** — grid view with lightbox carousel, swipe support, keyboard navigation
- **Spreadsheet** — collapsible table view with CSV export (formula-injection safe)
- **Search** — real-time search with debounce across titles, authors, and metadata
- **Dark/light theme** — persisted to localStorage, server-configurable default
- **Responsive** — mobile, tablet, desktop layouts

### Admin

- **Item management** — add, edit, delete with inline image editor
- **Image editing** — crop, reorder, add, remove images (up to 10 per item)
- **Category management** — create/edit/delete sections, groups, and leaf categories (Cyrillic slug auto-generation)
- **Drag-and-drop reorder** — rearrange items within categories
- **Settings** — site name, default theme, default image, currency codes per section, column visibility per section
- **Activity log** — audit trail of all create/update/delete operations
- **Backfill tools** — normalize images, prices, and apply defaults
- **WAL checkpoint** — manual commit trigger for git-safe database state

### Security

- Argon2 password hashing (production) / timing-safe plaintext (development)
- Session-based auth with SQLite store, HTTP-only cookies, configurable TTL
- Rate limiting — write (60/15min), read (200/15min), login (10/15min)
- CSP, HSTS, X-Frame-Options, referrer policy via Helmet
- Origin/Referer CSRF protection
- Zod schema validation on all inputs
- Image magic byte verification + MIME filter + pixel limit (25M)
- Version concurrency control on item updates (optimistic locking)
- Prototype pollution blocking in category IDs
- Orphaned image cleanup on delete
- No vulnerable polyfill CDN — all dependencies locally installed

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Landing page with section links |
| `/gallery` | Gallery | Grid view with lightbox, filtering by section/category |
| `/spreadsheet` | Spreadsheet | Collapsible table + CSV export |
| `/dice` | Dice | Static dice section page |
| `/miniatures` | Miniatures | Static miniatures section page |
| `/miniatures/:group` | Subgroup | Nested category group page |
| `/:section` | Section | Dynamic section page from DB |
| `/:section/:groupId` | Subgroup | Dynamic subgroup page |
| `/admin` | Admin panel | Items, categories, spreadsheet, settings, activity log |
| `/health` | — | JSON health check |
| `/sitemap.xml` | — | Auto-generated sitemap |

---

## API

### Auth
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/login` | Same-origin + rate-limited |
| POST | `/api/auth/logout` | Same-origin |
| GET | `/api/auth/me` | Public |

### Items
| Method | Path | Auth | Query Params |
|---|---|---|---|
| GET | `/api/items` | Public | `?section=`, `?category=`, `?limit=`, `?offset=`, `?q=` |
| POST | `/api/items` | Admin | FormData with `images[]` |
| PUT | `/api/items/:id` | Admin | FormData with `version`, `imagesToRemove`, `finalOrder` |
| DELETE | `/api/items/:id` | Admin | — |
| POST | `/api/items/reorder` | Admin | `{ section, category, items: [id, ...] }` |

### Categories
| Method | Path | Auth |
|---|---|---|
| GET | `/api/categories` | Public |
| POST | `/api/categories` | Admin |
| DELETE | `/api/categories` | Admin |

### Other
| Method | Path | Auth | Description |
|---|---|---|---|
| GET/PUT | `/api/settings` | Public/Admin | App settings |
| POST | `/api/upload/default` | Admin | Upload default image |
| GET | `/api/spreadsheet/public` | Public | Structured spreadsheet data |
| GET | `/api/spreadsheet` | Admin | Flat items array |
| POST | `/api/backfill-defaults` | Admin | Apply default image to items without one |
| POST | `/api/backfill-images` | Admin | Copy `image` to `images[0]` |
| POST | `/api/backfill-prices` | Admin | Normalize string prices to numbers |
| POST | `/api/checkpoint` | Admin | Force WAL checkpoint |
| GET | `/api/audit` | Admin | Last 100 audit log entries |

---

## Architecture

```
server.js          — entry point, env validation, graceful shutdown
src/
  app.js           — Express setup, middleware, session store, error handler
  db.js            — SQLite (better-sqlite3), migrations, all queries
  helpers.js       — image processing (sharp), validation, utilities
  slugify.js       — Cyrillic → Latin transliteration
  errors.js        — ValidationError, VersionConflictError
  routes/          — Express route handlers
    auth.js        — login/logout/me
    items.js       — CRUD + reorder with image pipeline
    categories.js  — CRUD for sections, groups, leaf categories
    settings.js    — get/update settings
    upload.js      — default image upload
    spreadsheet.js — public + admin data endpoints
    backfill.js    — data normalization tools
    checkpoint.js  — WAL checkpoint
    pages.js       — static + dynamic page serving, sitemap
public/
  css/             — base.css (1000+ lines), gallery.css, admin.css
  js/              — ES modules: api.js, utils.js, toast.js, etc.
  vendor/          — Cropper.js (minified)
  .html files      — 9 pages including 404
```

**Frontend:** Vanilla ES modules, no framework. All state lives in module closures. Each page JS file has an `init*()` export called from the HTML.

**Database:** SQLite with WAL mode, normalized categories (sections + categories tables with FK), JSON `images` column, optimistic locking via `version` column. Migrations via `user_version` pragma.

**Images:** Uploaded → magic byte check → Sharp (rotate, resize 3000px max, JPEG quality 88) → thumbnail (400px, quality 80) → UUID filenames. Thumbnails prefixed `thumb-`.

---

## Configuration

See `.env.example` for all options. Key variables:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SESSION_SECRET` | Yes | — | Min 32 characters |
| `ADMIN_PASSWORD_HASH` | Production | — | Argon2 hash (preferred) |
| `ADMIN_PASSWORD` | Dev fallback | — | Plaintext (logs warning) |
| `PORT` | No | 3000 | HTTP listen port |
| `ALLOWED_ORIGINS` | No | `req.hostname` | CSV for CORS |
| `SITE_URL` | No | `req.hostname` | Used in sitemap.xml |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with `node --watch server.js` |
| `npm start` | Start server |
| `npm test` | Run 97+ tests (`node --test`) |
| `npm run lint` | ESLint on server + lib code |
| `npm run check` | Syntax check all backend files |
| `npm run ci` | lint + test sequentially |
| `node backup` | Create timestamped `.tar.gz` of data/ + uploads/ |
| `node gc-uploads --dry-run` | Find orphaned uploads |
| `node gc-uploads --quarantine` | Move orphans to `.quarantine/` |
| `node pull` | Git pull + auto npm install |

---

## License

MIT
