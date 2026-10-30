# skyfire Collection

Personal collection catalog for dice & miniatures: a lightweight self-hosted
website used as the collection's system of record. The git repository doubles
as the backup point — both the SQLite database and all images are tracked, so
`git push` = offsite backup of the entire collection.

**Stack:** Node.js + Express + better-sqlite3 (WAL), vanilla JS frontend
(no framework, no build step), Sharp for image processing, Cropper.js for
in-browser cropping.

**Requirements:** Node.js >= 22

---

## Quick start

```bash
npm install          # also installs the git pre-commit hook
cp .env.example .env # then edit: SESSION_SECRET + ADMIN_PASSWORD_HASH
npm run dev          # http://localhost:3000
```

Generate the admin password hash:

```bash
node -e "require('argon2').hash('YOUR_PASSWORD').then(h => console.log(h))"
```

All configuration lives in `.env` — see `.env.example` for every supported
variable (port, session, rate limits, upload limits, reverse-proxy options).

---

## How data is stored and backed up

| What | Where | In git |
|---|---|---|
| Items, categories, settings, audit log | `data/collection.db` (SQLite, WAL mode) | yes |
| Images + thumbnails | `uploads/` (normalized JPEG, max 3000px + 400px thumb) | yes |
| Sessions | same DB, `sessions` table | **never** (wiped by the pre-commit hook) |

A git **pre-commit hook** (installed automatically by `npm install`) wipes the
`sessions` table (auth sessions must not end up in a public repo), runs a WAL
checkpoint, verifies DB integrity (`quick_check`) and stages
`data/collection.db` on every commit — a committed repository always contains
the up-to-date database and never contains sessions. Side effect: the
signed-in admin is logged out after a commit that touches the DB. Backup
workflow is simply:

```bash
git add -A && git commit -m "collection update" && git push
```

Additionally `npm run backup` creates a self-contained
`backups/skyfire-backup-<date>.tar.gz` (verified DB snapshot + all uploads +
manifest), keeping the last 10 archives.

### Scheduled local backups (macOS)

```bash
npm run backup:schedule   # installs a launchd agent: daily backup at 21:00
```

The agent (`scripts/com.skyfire.collection-backup.plist`) runs
`node backup.js` daily; logs go to `/tmp/skyfire-backup.log`. Git push stays
manual on purpose: with more than one machine an automatic push can create
unmergeable conflicts in the binary DB.

### Repository size

Images live in git history forever (every crop/re-upload adds new blobs and
keeps the old ones). Check the pack size occasionally:

```bash
git count-objects -vH   # watch size-pack
```

Rule of thumb: fine below ~500 MB. If it ever grows past that, migrate
`uploads/` to Git LFS (`git lfs migrate import --include='uploads/*'`) —
note this rewrites history, so every clone (including a server using
`npm run pull`) must be re-cloned afterwards.

---

## Pages

| Route | Page |
|---|---|
| `/` | Home — section tiles |
| `/dice`, `/miniatures`, `/:section` | Section page — category tiles |
| `/miniatures/:group`, `/:section/:group` | Group page — subcategories + items filed at group root |
| `/gallery?section=&category=` | Item gallery with lightbox carousel |
| `/spreadsheet` | Read-only spreadsheet view (CommanderHQ), toggleable in settings |
| `/admin` | Admin panel (login required) |
| `/health`, `/sitemap.xml`, `/robots.txt` | Service endpoints |

## Admin features

- **Add items** — up to 10 images per item, drag-free multi-upload, automatic
  normalization to JPEG + thumbnail generation, per-section extra fields
  (Recaster / Combat Points / Status)
- **Edit in place** — from any gallery card: fields, moving to another
  section/category, image add/remove/reorder, in-browser crop (Cropper.js),
  optimistic locking via item versions
- **Categories** — sections, categories and one level of groups; create,
  rename, delete (with item checks), drag & drop / touch reorder
- **Spreadsheet tab** — full table with sums and CSV export
- **Settings** — site name, default theme, default image, spreadsheet
  visibility, currencies
- **Activity log** — recent create/update/delete/reorder actions
- **WAL checkpoint button** — flush the DB before committing manually

Anonymous visitors get read-only access (rate-limited); the signed-in owner
is exempt from rate limits.

## API overview

All mutating endpoints require an admin session + same-origin check.

```
POST   /api/auth/login | logout      GET /api/auth/me
GET    /api/items?section=&category=&q=&limit=&offset=
POST   /api/items                    PUT/DELETE /api/items/:id
POST   /api/items/reorder
GET    /api/categories               POST/PATCH/DELETE /api/categories
POST   /api/categories/reorder
GET/PUT /api/settings                POST /api/upload/default
GET    /api/spreadsheet/public       GET /api/spreadsheet (admin, CSV source)
GET    /api/audit                    POST /api/checkpoint
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with `node --watch` |
| `npm start` | Start server |
| `npm test` | Run the test suite (`node --test`, 140+ tests) |
| `npm run lint` | ESLint over server, src, lib, scripts, tests |
| `npm run check` | Syntax-check every backend file |
| `npm run ci` | lint + test |
| `npm run doctor` | DB integrity + image/thumbnail consistency report |
| `npm run checkpoint` | Manual WAL checkpoint + clear sessions |
| `npm run backup` | Create verified `.tar.gz` backup (DB + uploads) |
| `npm run backup:schedule` | Install daily 21:00 backup via launchd (macOS) |
| `npm run gc:dry` / `npm run gc` | Find / delete orphaned upload files |
| `npm run gc:quarantine` | Move orphans to `uploads/.quarantine/` instead |
| `npm run pull` | On a server: git pull + conditional npm install |
| `npm run format` | Prettier over all JS |

## Project structure

```
server.js            entry point (graceful shutdown, port binding)
src/app.js           Express app: helmet/CSP, sessions (SQLite store),
                     rate limits, static, routes, error handler
src/db.js            schema, migrations, all SQL, Unicode-aware search
src/helpers.js       image normalization, validation glue, path safety
src/middleware.js    auth guards, same-origin check, multer setup
src/routes/          auth, items, categories, settings, spreadsheet,
                     upload, pages, checkpoint, audit
lib/validate.js      zod schemas (items, categories, settings, reorder)
public/              static frontend: pages, js modules, css, Cropper.js
scripts/             doctor, pre-commit hook, hook installer
test/                unit + HTTP integration tests
```

## Security

- Argon2 password hashing, session regeneration on login
- Helmet with strict CSP (`script-src 'self'`, no inline scripts)
- Same-origin verification on all mutations
- Zod validation everywhere; image magic-byte checks; path-traversal-safe
  file deletion; rate limiting for anonymous traffic
- All user content rendered via `textContent` (no innerHTML XSS surface)

## CI

GitHub Actions on push/PR to `main`: syntax check, ESLint, full test suite
(Node 22).

## License

MIT

## Simracing showroom

`/simracing` renders a dedicated Three.js viewer for the `simracing` section.
DB migration v5 adds this section once; its label and presence still belong to
Categories in the admin panel. Other sections use their existing page templates.

- `public/data/simracing.json`: component catalog, reference prices, original
  currencies and source links. EUR/RUB is fixed at **90** by the owner; USD
  listings use the dated CBR USD/RUB snapshot, then divide by 90. Refresh
  prices explicitly; the page does not fetch live prices.
- `public/js/simracing/model.js`: original photo-based approximate geometry and
  named hotspot anchors in metres (X right, Y up, negative Z toward pedals).
- `public/js/simracing/viewer.js`: orbit controls, camera presets, lighting,
  projected DOM hotspots and interchangeable steering wheels.
- `public/js/simracing/seat.js`, `pedals.js`, `wheels.js`, `headset.js`: detailed original
  photo-based component models (BRIDE Low Max/OMP, Simucube pedals, GT Neo,
  NEO X-330R, Savu and Pimax Crystal Light).
- `public/js/simracing/page.js`: accessible equipment rows, component details,
  category filters and a price summary. Unpriced items remain available even if
  WebGL fails. Selecting a row scrolls to the scene and highlights that component
  with a green outline and subtle tint.

`npm install` runs `scripts/vendor-three.js` to prepare self-hosted browser
modules from the pinned Three.js dependency. Generated files in
`public/vendor/three/` are ignored by git. After installing with `--ignore-scripts`,
run `npm run vendor:three`. No CDN or relaxed CSP is required.

The local prototype contains 28 components and a 30 October 2026 price snapshot.
All 28 catalog components have prices: 17 catalog listings and 11 owner
fallbacks. `priceType` distinguishes `catalog`, `owner` and `unconfirmed`;
`ownerPriceRub` preserves the supplied baseline even when a catalog price wins;
it is null for Pimax because no owner purchase price was supplied.
Keep the exact product/bundle match and `priceCheckedAt` with each source.
Only the Savu preview remains unpriced (`null`, never zero). Scene points use
a fixed EUR 25 threshold; smaller accessories remain selectable in the list.
Summary totals the listed category in EUR and RUB, includes each wheel once,
and explicitly excludes components without confirmed prices.
Component prices are edited in the JSON for now; the
existing item editor does not edit the 3D component catalog.

To replace the installed GT Neo with Savu Pro, change
`configuration.installedWheel` from `"gt-neo"` to `"savu-pro"` in
`public/data/simracing.json`. Geometry, hotspot title, product link and price
metadata update together; the Simucube 3 Pro base is unaffected. The on-page
Steering wheel selector replaces the single `installed-wheel` model. The
unused wheel remains in the catalog as `spare-wheel` with `catalogOnly: true`;
it has no mesh, anchor or hotspot. `configuration.ownedWheels` distinguishes owned alternatives from
previews. Selection does not change ownership or the saved configuration;
Savu pricing remains unconfirmed until entered.

Pedals run Co-Pedal, ActivePedal Ultimate, ActivePedal Pro from the driver's
left to right. Ulanzi, DIMSIM button box and keyboard supports connect to the
frame, with Ulanzi and the button box alongside the steering base. The handbrake
sits beside the MOZA AB9. The front electronics shelf holds Fosi beneath the
Simucube Link Hub; ACASIS is lower on the same rail, farther toward the pedals.
The DIMSIM hooks attach to a plate bolted to the seat's left hinge.
