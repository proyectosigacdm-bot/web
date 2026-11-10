# AGENTS.md

<!-- BACKEND:START -->
## Backend (Neon / PostgreSQL + Express)

This project uses [Neon](https://neon.tech) (serverless PostgreSQL) as its database and an Express server (`server.js`) as its API backend.

- **Database:** Neon PostgreSQL, connection string loaded from `DATABASE_URL` in `.env.local`.
- **Server:** `server.js` exposes a REST API under `/api` and manages authentication with token-based sessions.
- **Client:** `@neondatabase/serverless` is used to query the database.

Key patterns:

- Database queries use the `q(text, values)` helper in `server.js` (parameterized, `$1`, `$2`, ...).
- Never hardcode or commit credentials; keep `DATABASE_URL` in `.env.local`.
- Run the server with `npm run dev` (or `npm start`).
<!-- BACKEND:END -->
