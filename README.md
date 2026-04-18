# Sales Management System

SalesOps is a full-stack sales/team management platform with JWT auth, role-based access control, task workflows, invoice operations, media uploads, chat, reports, and dashboards.

## Architecture

- `sales-mgmt/`: React + TypeScript frontend (Vite).
- `api/`: serverless-compatible backend handlers.
- `api/_lib/`: shared backend utilities (auth, DB, mail, etc.).
- `scripts/`: database bootstrap and migration helpers.
- Data layer: Supabase/PostgreSQL.

## Core Features

- Auth (`/api/auth?action=...`) with first-login password change flow.
- Role-based routing and protected backend endpoints.
- Tasks, products, categories, users.
- Invoices (create, mark paid, email, PDF).
- Uploads with metadata and map visualization.
- Chat (without in-memory typing presence).
- Reports and dashboard analytics endpoints.

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project

### Install

```bash
npm install
cd sales-mgmt && npm install
```

### Environment variables

- Copy `.env.example` to `.env` and fill with real values.
- Never commit real credentials.

```bash
cp .env.example .env
```

### Database

```bash
npm run db:init
npm run db:analytics
npm run db:add-password-flag
```

## Development

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Local API proxy target from Vite: `http://127.0.0.1:4000`

## Key Scripts

### Root

- `npm run dev`: run backend + frontend.
- `npm run db:init`: create/align core DB tables.
- `npm run db:analytics`: install analytics RPC functions.
- `npm run db:add-password-flag`: add/backfill `has_changed_initial_password`.
- `npm run security:scan-secrets`: fail if likely committed secrets are detected.

### Frontend (`sales-mgmt`)

- `npm run dev`
- `npm run build`
- `npm test`

## API Overview

### Auth

- `POST /api/auth?action=login`
- `POST /api/auth?action=change-password`
- `POST /api/auth?action=forgot-password`
- `POST /api/auth?action=reset-password`
- `GET /api/auth?action=me`

### Core resources

- `/api/users`
- `/api/tasks`
- `/api/products`
- `/api/categories`
- `/api/invoices`
- `/api/uploads`
- `/api/chats`
- `/api/reports` (via `general?type=reports` in current implementation)
- `/api/dashboard?view=...`

## CI/CD

`Jenkinsfile` now enforces:

- strict linting (no `|| true` bypass),
- frontend tests (`sales-mgmt`),
- secret scanning (`npm run security:scan-secrets`),
- frontend build before deploy.

## Security Notes

- Rotate any credential that was ever exposed.
- Keep only placeholders in `.env.example`.
- Use Vercel/Supabase managed environment variables for deployment.
