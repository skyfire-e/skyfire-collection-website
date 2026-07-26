# План фиксов — skyfire Collection

## Фаза 1 — 🔴 Критические

### 1.1 Timing-safe сравнение пароля
- **Файл:** `src/routes/auth.js:21`
- **Что:** `process.env.ADMIN_PASSWORD === password` — timing attack
- **Фикс:** `crypto.timingSafeEqual()` с guard на разную длину

### 1.2 NaN guard в toNumber + Zod
- **Файлы:** `src/helpers.js:194-197`, `lib/validate.js:20`
- **Что:** `toNumber("abc")` → NaN, Zod не ловит
- **Фикс:** `toNumber()` возвращает NaN для невалидных строк; Zod отсекает NaN

### 1.3 Пустая секция → не 404
- **Файл:** `src/routes/pages.js:80-84`
- **Что:** секция без подкатегорий падает в next() → 404
- **Фикс:** удалить проверку `subcategories.length === 0`

### 1.4 try/catch в sitemap
- **Файл:** `src/routes/pages.js:47-51`
- **Что:** нет обработки ошибок БД
- **Фикс:** обернуть в try/catch → 503 при ошибке

---

## Фаза 2 — 🟠 Высокие

### 2.1 Запрет секций с именами STATIC_ROUTES
- **Файлы:** `src/routes/categories.js:43-47`, `src/routes/pages.js:9`
- **Что:** секции "admin", "gallery", etc. не работают
- **Фикс:** проверка при создании + вынести STATIC_ROUTES в helpers.js

### 2.2 Argon2 error logging
- **Файл:** `src/routes/auth.js:18`
- **Что:** пустой catch {} глотает ошибки
- **Фикс:** добавить console.error

### 2.3 alert() → toast-уведомления
- **Файлы:** `public/js/admin/items.js`, `public/js/image-editor.js`, `public/js/image-editor.js`, `public/js/toast.js` (новый), `public/css/base.css`
- **Что:** нативные alert() в админке
- **Фикс:** кастомные toast-уведомления

### 2.4 WAL checkpoint try/catch
- **Файлы:** `src/routes/checkpoint.js:8`, `server.js:57`
- **Что:** `wal_checkpoint(TRUNCATE)` может упасть
- **Фикс:** обернуть в try/catch

### 2.5 Цена "" vs null (Option B — полный фикс)
- **Файлы:** `lib/validate.js`, `src/routes/items.js:57,98`, `src/db.js:269,292,342`, frontend (×3)
- **Что:** пустое поле → 0 вместо null; неотличимо от "0"
- **Фикс:** " → null в БД, 0 → отображается как "0", null → пусто

### 2.6 ADMIN_PASSWORD trim guard
- **Файл:** `server.js:9`
- **Что:** пробелы пропускают пустую проверку
- **Фикс:** добавить .trim()

---

## Фаза 3 — 🟡 Средние

### 3.1 Выделить utils.js
- **Файлы:** `public/js/api.js` → `public/js/utils.js`
- **Что:** createFocusTrap, withPending, thumbUrl не API-логика
- **Фикс:** перенести в utils.js, обновить импорты

### 3.2 Устаревшая деструктуризация
- **Файл:** `public/js/admin/items.js:276-283`
- **Что:** `function (_ref) { ... }`
- **Фикс:** `([key, sec]) =>`

### 3.3 Транслитерация в отдельный модуль
- **Файлы:** `src/routes/categories.js:15-20` → `src/slugify.js`
- **Фикс:** вынести SLUG_MAP и slugify()

### 3.4 CSS дублирование @media
- **Файл:** `public/css/base.css:536,1006`
- **Фикс:** объединить блоки

### 3.5 safeJsonParse в helpers.js
- **Файлы:** `src/db.js:89-91`, `src/helpers.js`
- **Фикс:** перенести и переиспользовать

### 3.6 Комментарий rate limiters
- **Файл:** `src/app.js:55,74`
- **Фикс:** пояснить пересечение writeLimiter + readLimiter

---

## Фаза 4 — 🟢 Низкие

### 4.1 Исправить skyf1re → skyfire в AGENTS.md
- **Файл:** `AGENTS.md:1`

### 4.2 console.warn для #item-
- **Файл:** `public/js/gallery-page.js:349-359`
- **Фикс:** добавить warn если карточка не найдена

### 4.3 Scrollbar стили
- **Файл:** `public/css/base.css:160`
- **Фикс:** добавить @supports для WebKit

---

## Порядок выполнения

```
Фаза 1 → Фаза 2 → Фаза 3 → Фаза 4 → npm run ci + npm run check
```
