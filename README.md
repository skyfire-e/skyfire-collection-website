# skyf1re Collection

Личная коллекция дайсов и миниатюр — фото-галерея с админ-панелью, таблицей, поиском и сортировкой.

## Tech Stack

Node.js/Express, vanilla JS frontend, JSON file storage, Sharp для обработки изображений.

## Quick Start

```bash
git clone https://github.com/skyfire-e/skyfire-collection-website.git
cd skyfire-collection-website
npm install
cp .env.example .env
# отредактировать .env (ADMIN_PASSWORD, SESSION_SECRET)
npm start
```

Открыть `http://localhost:3000`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Default 3000 |
| `ADMIN_USERNAME` | No | Default `admin` |
| `ADMIN_PASSWORD` | Yes* | Plain-text пароль |
| `ADMIN_PASSWORD_HASH` | No* | Argon2 hash (рекомендуется) |
| `SESSION_SECRET` | Yes | Минимум 32 символа |
| `COOKIE_SECURE` | No | `true`/`false` для secure cookie |
| `TRUST_PROXY` | No | `1` если за reverse proxy |
| `NODE_ENV` | No | `production` включает secure cookie по умолчанию |

\* Либо ADMIN_PASSWORD, либо ADMIN_PASSWORD_HASH обязателен.

## Scripts

| Команда | Описание |
|---------|----------|
| `npm start` | Запуск сервера |
| `npm run dev` | Запуск с --watch |

Скрипты миграции и проверки данных: `gitignore/backup.js`, `gitignore/check-data.js`.

## Project Structure

```
server.js              — точка входа
src/
  app.js               — Express приложение
  helpers.js           — JSON I/O, валидация, утилиты
  middleware.js         — Auth, CSRF, upload
  routes/              — API роуты
  errors.js            — ValidationError, DataCorruptionError
lib/validate.js        — Zod схемы
data/                  — JSON хранилище
uploads/               — изображения
public/                — фронтенд (HTML, CSS, JS)
```

## API

См. `AGENTS.md` для полного списка эндпоинтов.

## Backup

```bash
node gitignore/backup.js
```

Создаёт архив `backups/backup-YYYY-MM-DD.tar.gz` с data/ и uploads/.
