# Facebook Community Sharing Platform — Backend

NestJS + TypeScript + TypeORM (MySQL) API that implements the exact REST contract the `frontend/` app already expects (see `frontend/src/mocks/` — that mock layer was the spec for this backend).

## Tech Stack

- [NestJS](https://nestjs.com/) + TypeScript
- [TypeORM](https://typeorm.io/) with MySQL
- JWT auth (`@nestjs/jwt` + `@nestjs/passport`), bcrypt password hashing
- `class-validator` / `class-transformer` for request validation

## Getting Started

### Prerequisites

- Node.js 18+
- A running MySQL server — or Docker, to start one with the included compose file:
  ```bash
  docker compose up -d
  ```
  (creates a `fcsp` database with root password `root`, matching `.env.example`)

### Installation

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MySQL connection details and JWT secrets. The database named in `DB_DATABASE` must already exist (e.g. `CREATE DATABASE fcsp;`).

Set this for safer real deployments:

```dotenv
DB_SYNCHRONIZE=false
```

If you enable campaign AI verification, configure these as well:

```dotenv
OPENAI_API_KEY=your_openai_key
OPENAI_VISION_MODEL=gpt-4o-mini
AI_VERIFICATION_AUTO_APPROVE_THRESHOLD=0.85
```

For local development where you intentionally want TypeORM to auto-create/update tables:

```dotenv
DB_SYNCHRONIZE=true
```

### Run the API

```bash
npm run start:dev
```

Starts on `http://localhost:3000` (configurable via `PORT`). CORS is enabled for `CORS_ORIGIN` (defaults to the Vite dev server at `http://localhost:5173`).

### Build / typecheck / lint

```bash
npm run build
npm run typecheck
npm run lint
```

## Connecting the frontend

The frontend currently talks to an in-memory mock (`frontend/src/mocks/mockBaseQuery.ts`). To point it at this API instead, swap the `baseQuery` in `frontend/src/api/baseApi.ts` for RTK Query's `fetchBaseQuery({ baseUrl: 'http://localhost:3000' })`, attaching `Authorization: Bearer <accessToken>` from the auth slice. No feature API slice needs to change — the URLs, methods, and payload shapes already match.

## API overview

| Method | Path | Auth |
|---|---|---|
| POST | /auth/login | public |
| GET | /campaigns | public |
| GET | /campaigns/:id | public |
| POST | /campaigns | ADMIN |
| GET | /submissions | public |
| POST | /submissions | WORKER |
| POST | /submissions/:id/review | ADMIN |
| GET | /groups | public |
| GET | /groups/coverage | public |
| GET | /groups/library | WORKER |
| POST | /groups | WORKER |
| GET | /wallet/me | authenticated |
| GET | /wallet/withdrawals | authenticated |
| POST | /wallet/withdrawals | WORKER |
| POST | /wallet/withdrawals/:id/review | ADMIN |
| POST | /wallet/withdrawals/:id/complete | ADMIN |
| GET | /leaderboard | public (optional auth) |
| GET | /leaderboard/achievements | public (optional auth) |
| GET | /analytics/overview | public |
| GET | /admin/overview | ADMIN |
| GET | /admin/worker-performance | ADMIN |
