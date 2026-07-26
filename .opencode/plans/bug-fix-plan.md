# Bug Fix Plan — skyf1re Collection v1.8.0

## Приоритеты и порядок работ

**Главный принцип:** Ни один фикс не должен ломать существующее поведение. Каждый фикс проверяется:
1. Существующие тесты (`npm test`) — все 86 должны проходить
2. Lint (`npm run lint`) — чистый
3. Ручная проверка затронутой функциональности
4. Проверка что не сломалось ничего рядом (regression)

**Порядок работ:**
- Фаза 1: Критические баги (1-7)
- Фаза 2: Высокие (8-17)
- Фаза 3: Средние (18-29)
- Фаза 4: Низкие (30-46)

Фазы идут последовательно, внутри фазы пункты можно делать параллельно если они не пересекаются.

---

## ФАЗА 1 — Критические (7 шт.)

---

### 1. Prototype pollution через `id` категории

**Где:** `src/routes/categories.js:35-38` + `lib/validate.js:31`

**Проблема:** `id` категории не проверяется на опасные имена (`__proto__`, `constructor`, `prototype`). При записи `cats["__proto__"]` происходит замена прототипа объекта.

**Фикс:**
1. В `lib/validate.js` `categoryInputSchema.id`:
   - Заменить `.optional()` на `.optional().refine(val => !val || !['__proto__', 'constructor', 'prototype'].includes(val), 'Invalid category ID')`
   - Добавить `.min(1)` после `.trim()` для `.trim().min(1).max(50)`
2. В `src/routes/categories.js` после деструктуризации `req.body` добавить проверку `if (catId && ['__proto__', 'constructor', 'prototype'].includes(catId)) return res.status(400).json({ error: 'Invalid category ID' })`
3. В `src/routes/categories.js` DELETE handler: добавить валидацию `req.query.section` и `req.query.id` тем же списком

**Тесты:** Написать тест в `test/` — POST /api/categories с id=`__proto__` должен вернуть 400. Проверить что существующие тесты проходят (в тестах нет таких кейсов).

**Риски:** Минимальные — просто дополнительная валидация.

---

### 2. Multi-file upload через crop полностью сломан

**Где:** `public/js/image-editor.js:202-220`

**Проблема:** `closeCrop()` обнуляет `cropQueue = []` и ревокает все object URLs. Вызывается ДО того как `loadNextFile()` успевает прочитать оставшиеся файлы. После crop первого файла очередь пуста, остальные файлы теряются.

**Фикс:**
```js
// В loadNextFile(), внутри reader.onload:
reader.onload = (e) => {
  const remainingQueue = cropQueue.slice(); // сохраняем до closeCrop
  closeCrop();
  openCrop(e.target.result, { fileQueue: remainingQueue, slotIdx: undefined });
};
```

**Дополнительно:** `closeCrop()` не должна ревокать object URLs для файлов, которые ещё ждут обработки. Нужно разделить: ревокать только URL текущего (только что закроропленного) изображения, а не всей очереди.

**Тесты:** Мануально — загрузить 3+ файла через админ-панель, убедиться что все обрабатываются. Regression — единичная загрузка не сломалась.

**Риски:** Средние. Меняется логика очередности обработки. Нужно внимательно проследить цепочку closeCrop → loadNextFile → openCrop.

---

### 3. Дети категорий теряются при сортировке

**Где:** `src/db.js:362-378` (в `getCategories`)

**Проблема:** Категории сортируются по `sort_order`. Если у родителя `sort_order` больше чем у ребёнка, ребёнок обрабатывается первым, родитель ещё не добавлен в `sec.subcategories`, ребёнок молча отбрасывается.

**Фикс:** Нужен двухпроходный алгоритм:

```js
// Вместо однопроходного find внутри цикла:
const catMap = new Map();
const topLevel = [];
for (const cat of cats) {
  const entry = { id: cat.id, label: cat.label, subcategories: [] };
  catMap.set(cat.id, entry);
}
for (const cat of cats) {
  if (cat.parent_id) {
    const parent = catMap.get(cat.parent_id);
    if (parent) parent.subcategories.push(catMap.get(cat.id));
  } else {
    topLevel.push(catMap.get(cat.id));
  }
}
sec.subcategories = topLevel;
```

**Важно:** `sort_order` должен сохраняться для каждого уровня. В первом проходе `cats` уже отсортированы, а мапы в JS сохраняют порядок вставки.

**Тесты:** Написать юнит-тест для `getCategories` с разным порядком sort_order. Проверить что существующие тесты (findCategory, flattenCategories) не сломаны.

**Риски:** Средние. Меняется логика построения дерева. Может повлиять на всё, что использует `getCategories()` — навигация, страницы, категории в админке, spreadsheet.

---

### 4. Backfill без транзакции — частичное обновление

**Где:** `src/routes/backfill.js:10-52`

**Проблема:** Все три backfill-операции итерируют items и вызывают `db.updateItem()` вне транзакции. При сбое часть items обновится, часть нет.

**Фикс:** Оборачивать каждую backfill-операцию в `db.transaction()`:

```js
const tx = db.db.transaction((items) => {
  for (const item of items) {
    db.updateItem(item.id, { image: defaultImage }, item.version);
  }
  db.appendAudit('backfill', `Applied default image to ${items.length} items`);
});
tx(items);
```

**Дополнительно:** Исправить HTTP status при VersionConflictError — должно быть 409, не 500. Использовать `next(err)` вместо сворачивания в res.status(500).

**Тесты:** Тесты backfill уже есть (3 штуки). Добавить проверку что после вызова backfill все items обновлены корректно.

**Риски:** Низкие. Транзакции в better-sqlite3 работают атомарно.

---

### 5. Session `touch()` не обновляет `expires`

**Где:** `src/app.js:95-100`

**Проблема:** `SQLiteStore.prototype.touch` обновляет только `data`, но не `expires`. Сессия истекает ровно через 24ч после создания.

**Фикс:**
```js
SQLiteStore.prototype.touch = function(sid, sessionData, cb) {
  try {
    const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || SESSION_MAX_AGE;
    dbInstance.prepare('UPDATE sessions SET data = ?, expires = ? WHERE sid = ?')
      .run(JSON.stringify(sessionData), Date.now() + maxAge, sid);
    cb(null);
  } catch (err) { cb(err); }
};
```

**Тесты:** В `test/test-db.js` уже есть тест для session expiry. Добавить проверку что `touch()` обновляет `expires`.

**Риски:** Низкие.

---

### 6. `.trim()` после `.min(1)` — пробелы проходят валидацию

**Где:** `lib/validate.js:17-19, 30`

**Проблема:** Порядок chain в Zod: `.min(1)` проверяет ДО `.trim()`. Строка из 3 пробелов имеет длину 3, проходит min(1), затем trim() делает её пустой.

**Фикс:** Поменять порядок у всех четырёх полей:

- **Было:** `.min(1).max(N).trim()` → **Стало:** `.trim().min(1).max(N)`

Затронутые поля:
- `itemInputSchema.title` (line 17)
- `itemInputSchema.section` (line 18)
- `itemInputSchema.category` (line 19)
- `categoryInputSchema.label` (line 30)

**Тесты:** В `test/test-validate.js` уже есть тесты для `validateItemInput`. Добавить кейс с `title: "   "` — должен выдавать ошибку.

**Риски:** Низкие.

---

### 7. Sitemap — относительные URL вместо абсолютных

**Где:** `src/routes/pages.js:23-36`

**Проблема:** `generateSitemap()` генерирует `<loc>/gallery?section=...</loc>` — относительные URL.

**Фикс:** Читать `process.env.SITE_URL`, если не задан — определять из запроса.

```js
// В роуте:
const baseUrl = process.env.SITE_URL || `https://${req.hostname}`;
const urls = generateSitemap(categories, baseUrl);
```

В `generateSitemap()` добавить параметр `baseUrl` и префиксировать все `loc`.

**Тесты:** curl /sitemap.xml — проверить что URL начинаются с `http(s)://`.

**Риски:** Низкие.

---

## ФАЗА 2 — Высокие (10 шт.)

---

### 8. `unhandledRejection/uncaughtException` не вызывают shutdown

**Где:** `server.js:44-51`

**Проблема:** `process.on('unhandledRejection')` и `process.on('uncaughtException')` вызывают `process.exit(1)` без graceful shutdown.

**Фикс:** Заменить на вызов `shutdown('UNHANDLED_REJECTION')` / `shutdown('UNCAUGHT_EXCEPTION')`. Добавить guard-флаг в `shutdown()` чтобы избежать двойного вызова.

**Тесты:** Сложно тестировать. Проверить линтером.

**Риски:** Средние.

---

### 9. Пустой `ADMIN_PASSWORD` пропускает guard

**Где:** `server.js:3-7`

**Проблема:** `!process.env.ADMIN_PASSWORD === true` для пустой строки, guard пропускает.

**Фикс:**
```js
if (process.env.ADMIN_PASSWORD === '') {
  console.error('ADMIN_PASSWORD cannot be empty. Use ADMIN_PASSWORD_HASH instead.');
  process.exit(1);
}
```

**Риски:** Минимальные.

---

### 10. Нет null-check на DOM элементы в gallery-page.js

**Где:** `public/js/gallery-page.js:285-325`

**Проблема:** 6+ вызовов `getElementById().addEventListener()` без проверки на null.

**Фикс:** Обернуть каждый вызов в `if (el) el.addEventListener(...)` или использовать helper:
```js
function safeListen(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}
```

**Тесты:** Визуально — галерея работает.

**Риски:** Низкие.

---

### 11. Infinite error loop если slot.src === undefined

**Где:** `public/js/image-editor.js:118-125`

**Фикс:**
```js
img.src = thumbUrl(slot.src) || '/images/default.svg';
```

**Риски:** Низкие.

---

### 12. `saveReorder` шлёт null section/category

**Где:** `public/js/gallery-page.js:478`

**Фикс:**
```js
async function saveReorder() {
  if (!section || !category) return;
  // ...rest
}
```

**Риски:** Низкие.

---

### 13. Если fetch /api/categories упал — админ-панель пустая

**Где:** `public/js/admin/items.js:8`

**Фикс:**
```js
let categoriesData = {};
try {
  categoriesData = await API.get('/api/categories');
} catch (e) {
  console.error('Failed to load categories:', e);
  showNotification('Failed to load categories', 'error');
}
```

**Риски:** Низкие.

---

### 14. `archiver` в devDependencies

**Где:** `package.json`

**Фикс:** Переместить `archiver` в `dependencies`.

**Риски:** Минимальные.

---

### 15. 5 страниц без `theme-init.js`

**Где:** `public/index.html`, `gallery.html`, `admin.html`, `dice.html`, `miniatures.html`

**Фикс:** Добавить `<script src="/js/theme-init.js" defer></script>` в `<head>` каждого из 5 файлов.

**Риски:** Минимальные.

---

### 16. Нет null-check на `spreadsheetContainer`

**Где:** `public/js/spreadsheet-page.js:73`

**Фикс:**
```js
const container = document.getElementById('spreadsheetContainer');
if (!container) { console.error('Spreadsheet container not found'); return; }
```

**Риски:** Минимальные.

---

### 17. `fontSrc` позволяет шрифты с любого HTTPS

**Где:** `src/app.js:25`

**Фикс:** Сменить на `['\'self\'', 'data:']` или явно указать нужные хосты.

**Риски:** Низкие.

---

## ФАЗА 3 — Средние (12 шт.)

---

### 18. Селектор `button:last-child` в auth.js

**Где:** `public/js/auth.js:54`

**Фикс:** Добавить `data-btn="spreadsheet"` в HTML и искать по нему.

**Риски:** Низкие.

---

### 19. `offset=0` игнорируется в getItems

**Где:** `src/db.js:195`

**Фикс:** `if (offset !== undefined && offset !== null)`.

**Риски:** Низкие.

---

### 20. `fields.version - 1` может быть NaN

**Где:** `src/db.js:307`

**Фикс:**
```js
expectedVersion: expectedVersion !== undefined ? expectedVersion : (typeof fields.version === 'number' ? fields.version - 1 : undefined),
```

**Риски:** Низкие.

---

### 21. `saveCategories` — полная перезапись, нет optimistic locking

**Где:** `src/db.js:382-415`

**Фикс:** (Отложить) Рефакторинг: diff-based update вместо DELETE+INSERT.

**Риски:** Высокие. Можно отложить.

---

### 22. Static files до API роутов

**Где:** `src/app.js:117 vs 130-136`

**Фикс:** Добавить warning при старте если `public/api/` существует. И/или переместить статику после API.

**Риски:** Средние.

---

### 23. Error handler без `res.headersSent`

**Где:** `src/app.js:150-165`

**Фикс:**
```js
if (res.headersSent) { return next(error); }
```

**Риски:** Низкие.

---

### 24. CSRF использует `req.hostname`

**Где:** `src/middleware.js:29`

**Фикс:** Добавить ALLOWED_ORIGINS из .env.

**Риски:** Низкие.

---

### 25. Нет `:focus` стилей — a11y

**Где:** `public/css/base.css`

**Фикс:**
```css
:focus-visible { outline: 2px solid var(--primary, #4a90d9); outline-offset: 2px; }
```

**Риски:** Минимальные.

---

### 26. Нет error handler на `app.listen()`

**Где:** `server.js:23`

**Фикс:**
```js
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') { console.error(`Port ${PORT} is already in use.`); process.exit(1); }
  console.error('Server error:', err.message); process.exit(1);
});
```

**Риски:** Минимальные.

---

### 27. `limitInputPixels` слишком высокий

**Где:** `src/helpers.js:47`

**Фикс:** Сменить на `25_000_000`.

**Риски:** Низкие.

---

### 28. `logs.length` без `Array.isArray()`

**Где:** `public/js/admin/items.js:412`

**Фикс:**
```js
if (!Array.isArray(logs)) { console.error('Invalid audit log response:', logs); return; }
```

**Риски:** Минимальные.

---

### 29. В admin.html нет `#authModal`

**Где:** `public/admin.html`

**Фикс:** Добавить authModal как на других страницах.

**Риски:** Минимальные.

---

## ФАЗА 4 — Низкие (17 шт.)

### 30. `VersionConflictError` игнорирует message
**Где:** `src/errors.js:4-6`
**Фикс:** `constructor(message) { super(message || 'default message'); ... }`

### 31. `parseJSONArray` кидает `Error`, не `ValidationError`
**Где:** `src/helpers.js:156-157`
**Фикс:** `throw new ValidationError(...)`

### 32. "Command Points" вместо "Combat Points"
**Где:** `lib/validate.js:23`
**Фикс:** Исправить строку.

### 33. `parentId` без `.trim()`
**Где:** `lib/validate.js:33`
**Фикс:** Добавить `.trim()`.

### 34. Утечка версии item в 400 ошибке
**Где:** `src/routes/items.js:97`
**Фикс:** Убрать `Current version: ${currentItem.version}`.

### 35. `localStorage` падает в private browsing (nav.js)
**Где:** `public/js/nav.js:2`
**Фикс:** Обернуть в try-catch.

### 36. Lightbox overflow на мобильных
**Где:** `public/css/base.css:629-633`
**Фикс:** `.lightbox-image-wrap img { max-width: 100%; }`

### 37. Нет `<meta name="description">`
**Где:** `public/404.html`, `section-page.html`, `miniatures-subgroup.html`
**Фикс:** Добавить тег.

### 38. Нет `role="link"` на навигационных кнопках
**Где:** Все HTML файлы
**Фикс:** `role="link"` или `<a>` вместо `<button>`.

### 39. Два обработчика Escape
**Где:** `topbar.js:132` + `gallery-page.js:319`
**Фикс:** Оставить или централизовать — низкий приоритет.

### 40. Force timeout 5000ms hardcoded
**Где:** `server.js:29`
**Фикс:** `const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 5000;`

### 41. Session TTL hardcoded
**Где:** `src/app.js:80,112`
**Фикс:** `const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000;`

### 42. Upload limits hardcoded
**Где:** `src/middleware.js:13`
**Фикс:** Читать из env.

### 43. `toNumber` не отличает "" от 0
**Где:** `src/helpers.js:167-171`
**Фикс:** Добавить JSDoc, не менять логику.

### 44. `flattenCategories` возвращает пустые группы
**Где:** `src/helpers.js:78-91`
**Фикс:** `if (!cat.subcategories?.length) continue;`

### 45. `localStorage` в theme-init.js
**Где:** `public/js/theme-init.js:2`
**Фикс:** Same as #35.

### 46. `engines.node` несовместим
**Где:** `package.json`
**Фикс:** `"node": ">=22"`

---

## Порядок выполнения

```
Фаза 1 (Критические) → Фаза 2 (Высокие) → Фаза 3 (Средние) → Фаза 4 (Низкие)
```

Каждый фикс коммитится отдельно. После каждой фазы — `npm test && npm run lint`.
