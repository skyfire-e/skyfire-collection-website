# toFix2 — Consolidated unique bug & error fixes (Audits 1–7)

Deduplicated list of all bugs/errors found across the 7 audits.
**Updated 2026-08-01 (post-v1.9.4):** every item verified against the actual code; statuses reflect reality, not audit claims.

**Status summary:** 43 original findings + 6 tooling gaps + 1 new →
**3 fixed in v1.9.3** · **9 fixed in v1.9.4** (incl. T1) · **5 were already fixed before the audits** · **4 false alarms** · **23 + 1 new + 5 tooling still open** (6 real, the rest low/optional).

---

## ✅ Fixed in v1.9.4 (commit `9ba87d1`, tag `v1.9.4`)

| Was # | Severity | Place | Fix applied | Verified |
|-------|----------|-------|-------------|----------|
| T1 | HIGH | `test/backup.test.js` (new) + `backup.js` | Backup smoke test: snapshot → integrity verify → `createArchive` (now exported) → `tar -xzf` extract → manifest + restored-DB assertions. Guards the exact archiver@8 regression class | 168/168 tests (was 166) |
| 10 | MED | `pull.js:24-37` | Aborts `git pull` when `collection.db` has uncommitted changes (binary merge conflict = corruption); `--force` escape hatch; other dirty files still warn-only | Logic table-tested: dirty DB → abort, `--force` → proceed, other files → warn, clean → proceed |
| 3 | MED | `src/app.js` | `strictTransportSecurity: FORCE_HTTPS ? { maxAge: 31536000, includeSubDomains: false } : false` — same env gate as the v1.9.3 CSP fix; `includeSubDomains` dropped per audit | Live: header absent by default, `max-age=31536000` with `FORCE_HTTPS=1` |
| 4 | MED | `public/js/auth.js:47,66-72` | Unconditional `location.reload()` after login and logout on every page (was `/admin`-only); comments warn against re-running init (double-bind) | Syntax-checked; manual login on gallery page shows edit buttons |
| 5 | MED-LOW | `api.js`, `image-editor.js`, `admin/settings.js` | `/api/upload/*` mutations clear cached `/api/settings`; exported `invalidateEditorSettings()` called after settings save | Syntax-checked; no circular import (image-editor imports only api/utils/toast) |
| 13 | LOW | `admin/settings.js:78` | `.toUpperCase()` on currency input — "usd" now passes `^[A-Z]{3}$` | Syntax-checked |
| 17 | LOW | `gallery-page.js:315` | `if (reorderMode) return;` guard before opening lightbox (mirrors section-pages.js guard) | Syntax-checked |
| 18 | LOW | `dnd.js` | 2D nearest-neighbor touch hit-test (`Math.hypot` on both axes; direction-aware insert via `compareDocumentPosition`) — horizontal moves in multi-column grids now work | Syntax-checked; **pending real-phone feel test** |
| 19 | LOW | `dnd.js` | `touchcancel` bound/unbound alongside `touchend` — interrupted gestures no longer leave stale drag state | Syntax-checked |

## ✅ Fixed in v1.9.3 (commit `0e90ff1`, tag `v1.9.3`)

| Was # | Severity | Place | Fix applied | Verified |
|-------|----------|-------|-------------|----------|
| 1 | CRITICAL | `backup.js:6,101` | `const { TarArchive } = require('archiver')` + `new TarArchive({ gzip: true })` (archiver@8 ESM breakage) | `npm run backup` OK (619 items, integrity ok, 1249 files); launchd job exit 1 → **0** |
| 2 | HIGH | `src/app.js:36` | `upgradeInsecureRequests: envBoolean(process.env.FORCE_HTTPS) ? [] : null` — note: helmet defaults include the directive, plain deletion would NOT remove it | CSP header live-checked with and without `FORCE_HTTPS=1`; LAN HTTP works |
| 6 | HIGH | `src/routes/pages.js:98-105,114` | `Object.prototype.hasOwnProperty.call(cats, …)` guards in `/:section/:groupId` and `/:section` | `/__proto__`, `/constructor/x`, `/toString` → 404; real pages → 200 |

## ✅ Already fixed before the audits (code verified — do not redo)

| Was # | Place | Evidence |
|-------|-------|----------|
| 11 | `src/routes/items.js:62-66,134-138` | Image-normalize orphans: `createdPaths` tracked per-file inside the map callback, unlinked in catch (comment documents the fix). Residual nit: `Promise.allSettled` would be airtight against a late-resolving sibling, but the reported scenario is handled |
| 28 | `public/js/admin/items.js:154-157,184-187` | Add Section / Add Subcategory catches both call `showToast(…, 'error')` |
| 30 | `src/db.js:570-571` | `cleanupTimer.unref()` present — no shutdown hang |
| 37 | `public/js/topbar.js:43` | Active-link match is boundary-delimited (`href + '/'`, `href + '?'`) — `/dice-store` can't highlight `/dice` |
| 41 | `src/routes/spreadsheet.js:12` | `showSpreadsheet === false` → 403 **before** building the response |

## ⚪ False alarms (verified NOT bugs — do nothing)

| Was # | Place | Why not a bug |
|-------|-------|---------------|
| 23 | `src/routes/checkpoint.js:7` + `middleware.js:35` | Fail-closed by design: missing Origin/Referer → 403. Working as intended |
| 24 | `src/routes/upload.js:14` | `if (!file) return 400` is the first statement — the flagged catch path is unreachable; even if reached, per-file try/catch swallows it |
| 32 | `server.js:3-28` | (a) "cannot be empty" message fires only when var is set-but-empty — accurate; (b) `SESSION_SECRET.length` protected by earlier exit at lines 3-7 |
| 42 | `test/http.test.js:151,157` | `res.body.items \|\| res.body` is intentional API-shape tolerance; no broken assertion exists |

---

## Table 1 — Open bugs & errors (23 remaining, all re-verified in code)

### Real fixes worth doing (6)

| # | Severity | File / place | Issue (verified evidence) | Suggested fix | Audit(s) |
|---|----------|--------------|---------------------------|---------------|----------|
| 7 | MED | `src/routes/items.js:36-49` | `/api/items` returns `price` verbatim to anonymous users (no gating anywhere in route), bypassing `showPublicSpreadsheet`. | Strip `price` for non-admin, or remove the setting | 4 |
| 8 | MED | `src/routes/items.js:242` | PUT responds with `merged` (spread from `currentItem`) — fresh `updatedAt` exists only in DB (`db.js:327-328`). | `res.json(db.getItem(id))` after update | 4 |
| 9 | MED | `.env` | Verified: `NODE_ENV=production` + `COOKIE_SECURE=0` simultaneously. Behind HTTPS proxy the session cookie would be rejected → login silently broken. | `NODE_ENV=development` locally, OR `COOKIE_SECURE=1` + `TRUST_PROXY=1` behind HTTPS | 5 |
| 12 | LOW | `src/app.js:132,136` | Both `readLimiter` mounts confirmed present — `/api/spreadsheet/public` counted twice per request. | Remove line 132 mount | 1, 2 |
| 15 | LOW | `src/db.js:218` | `likeClauses` = items fields + `c.label`/`pc.label` — no `s.label` despite `LEFT JOIN sections s`. Section renamed to Cyrillic unfindable by name. | Add `s.label` to `likeClauses` | 1 |
| 22 | LOW | `src/middleware.js:37-40` | Hostname-only comparison confirmed (port/scheme ignored) → another app on `samehost:9999` passes CSRF check; conversely proxies with differing Host can false-403. | Compare full host or explicit `ALLOWED_ORIGINS`; test with actual proxy (medium caution) | 2, 7 |

### UX polish / robustness (10)

| # | Severity | File / place | Issue (verified evidence) | Suggested fix | Audit(s) |
|---|----------|--------------|---------------------------|---------------|----------|
| 14 | LOW | `gallery-page.js:99` + `gallery.html:20` | `/gallery` no params: `<h1 id="pageTitle">` stays empty (title set only `if (category && …)`), no back-link, loads all items. | "All items" fallback; (optional) default `limit` | 1 |
| 16 | LOW | `spreadsheet-page.js:35-38` | CSV export uses raw ids as labels (`sectionMap[key] = { label: key }`). | Map via `/api/categories` | 1 |
| 20 | LOW | `items.js:298-306` | Reorder validates membership per-ID, not completeness (`min(1)` only in schema) → omitted items keep stale/duplicate `sort_order`. Frontend always sends full list — API-robustness only. | 400 on incomplete list, or auto-append missing IDs | 1, 2 |
| 21 | LOW | `spreadsheet-page.js:53-54` | `a.click(); URL.revokeObjectURL(a.href);` — synchronous revoke can abort download (Firefox). | `setTimeout(() => URL.revokeObjectURL(...), 1000)` | 2 |
| 25 | LOW | `src/helpers.js:185` | `Number("abc")` = NaN → mismatch → 409 instead of 400. Editor's 409-close flow unaffected by the fix. | `Number.isFinite` check → 400 | 1, 2 |
| 26 | LOW | `src/helpers.js:24` | `safeUnlink` bare-returns on non-`/uploads/` paths — silently hides malformed image paths. | Add a warn log | 7 |
| 27 | LOW | `items.js:273-284` | `failedToDelete` only `console.error`'d — no retry; files can remain until `npm run gc`. | Retry once or explicitly delegate to GC in comment | 7 |
| 29 | LOW | bulk error handling (public/js) | No `err.status === 404` distinction anywhere (grep: 0 matches) — "already deleted elsewhere" shows generic error. Partially mitigated by `withPending`. | Differentiate 404 in bulk delete/save handlers | 4 |
| 31 | LOW | `src/db.js:121` | Migration v3 detection still `sql LIKE '%data%'` — fragile substring match, but currently works. | Detect via `PRAGMA table_info` column list | 3, 6, 7 |
| 35 | LOW | `pull.js` (restart hints) | `:3000` hardcoded in restart hints; `PORT` env (set in `.env`) ignored. | `process.env.PORT \|\| 3000` | 2 |

### Config hygiene / optional (7)

| # | Severity | File / place | Issue (verified evidence) | Suggested fix | Audit(s) |
|---|----------|--------------|---------------------------|---------------|----------|
| 33 | LOW | `.env` | `ADMIN_PASSWORD` present alongside `ADMIN_PASSWORD_HASH` (names verified, values not read). Hash takes priority, but plaintext is a silent fallback if hash is ever removed. | Delete the `ADMIN_PASSWORD` line | 3, 4, 5, 6 |
| 34 | TRIVIAL | `scripts/…backup.plist:10,15` | Hardcoded `/opt/homebrew/bin/node` + WorkingDirectory. Fine for this Mac (job healthy, exit 0); breaks on Intel/Linux only. | Optional: generate plist | 3, 4, 6 |
| 36 | TRIVIAL | `gc-uploads.js:46-53`, `doctor.js:142-143` | Only `.jpg`/`.webp` scanned. **Verified theoretical**: normalize always outputs `.jpg`; uploads/ has 1248 `.jpg`, 0 `.png`. | Add `.png` for consistency | 2, 5 |
| 38 | TRIVIAL | `src/slugify.js:1` | `SLUG_MAP` covers Russian only; `і, ї, є, ґ` stripped to `-`. No Ukrainian data exists in DB. | Add mappings if ever needed | 3 |
| 39 | LOW | `public/css/gallery.css:115-123` | Property-for-property duplicate of `base.css:347-355` (same 7 declarations). | Delete the duplicate block | 3 |
| 40 | WONTFIX? | `src/app.js:15-18` | `public/api` shadow-warning runs at startup only — but the comment says "(startup only)", i.e. by design. | Leave, or re-check on interval | 7 |
| 43 | TRIVIAL | `README.md:141` | "140+ tests" — actual count now **168** (`npm test`). Technically true, understated. | Update to "168 tests" | 1, 5 |

### 🆕 Found during fix work (not in original audits)

| # | Severity | File / place | Issue | Suggested fix |
|---|----------|--------------|-------|---------------|
| N1 | LOW | `src/helpers.js:135-136` | Same `cats[section]` prototype pattern as the fixed #6, reachable via `POST /api/items` — items schema doesn't regex-restrict `section`, so admin-authenticated `section: "__proto__"` passes line 135 (truthy) and can 500 at `findCategory(undefined, …)`. Requires admin auth → low risk. | Same `hasOwnProperty` guard, or add slug regex to items schema `section` field |

## Table 2 — Tooling / CI gaps (5 remaining; T1 done in v1.9.4)

| # | Severity | Place | Issue (verified) | Suggested fix | Audit(s) |
|---|----------|-------|------------------|---------------|----------|
| T2 | MED | `eslint.config.mjs` + `package.json:21` | `public/js/` (ES modules, ~2400 lines) excluded from lint; config has no `sourceType: 'module'` block. | Add module block + browser/Cropper globals; include `public/js/` in lint script (audit 4 pre-ran it: no real errors, 10 unused-catch) | 4 |
| T3 | MED | `package.json:25` | `check` script lists src files explicitly — `src/slugify.js` missing; its syntax errors would pass CI. | Add it, or drop `check` entirely (see T5) | 5 |
| T4 | LOW | `.prettierrc` + `package.json:24` | Prettier config present but 40/40 files unformatted, no `--check` in CI — dead config. | One-time `npm run format` + `--check` in CI, or remove prettier | 4 |
| T5 | LOW | `package.json:25` | `check` duplicates what eslint already does (500-char one-liner). | Remove; keep `lint` + `test` | 4 |
| T6 | LOW | `package.json:24` | `format` glob covers `src/**, public/js/**, lib/**, test/**, *.js` — no `scripts/**`. | Add `'scripts/**/*.js'` | 5 |

---

## Cross-audit duplicates merged (provenance)

- CSP `upgrade-insecure-requests`: audits 2 + 4 → #2 ✅
- Duplicate rate-limiter mount: audits 1 (A2) + 2 → #12
- Partial reorder: audits 1 (C4) + 2 → #20
- 409 vs 400 for garbage version: audits 1 (C3) + 2 → #25
- `ADMIN_PASSWORD=admin` in `.env`: audits 3, 4, 5, 6 → #33
- Migration v3 `sql LIKE '%data%'`: audits 3, 6, 7 → #31
- launchd plist hardcoded paths: audits 3, 4, 6 → #34
- GC/doctor `.png` blind spot: audits 2 + 5 → #36
- Same-origin check weaknesses: audits 2 + 7 → #22
- README test count: audits 1 (A5) + 5 (DOC-01) → #43

## Explicitly NOT bugs (audits + verification confirmed — do not "fix")

- `nav.js` / `shared-modals.js` `innerHTML` with static markup (no user data, CSP-clean)
- `pages.js` route order `/:section/:groupId` before `/:section` — correct
- multer fileFilter errors → central handler → 400 — works
- WAL/SHM files in `data/` — handled by pre-commit checkpoint hook
- `ADMIN_PASSWORD` in tests — test-only value, in-memory DB
- `/api/auth/me` called 3–4× per page load — deliberate, harmless under current rate limits
- `db.js:482-484` FK-catch: dead code (items have no FK), but defensive — audit 1 says keep with comment; only the misleading message is worth a touch-up someday

## Reminders

- **Phone-test** touch reorder (fixes 18+19): move a card sideways within a row in the gallery; also check category-button reorder on section pages (shared `dnd.js`).
- **Restart the production server** if it's still running pre-1.9.4 code.
