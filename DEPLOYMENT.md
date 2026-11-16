# Deployment Guide

This guide covers local development and production deployment of Project Archive using Cloudflare Workers, D1, and R2.

## Requirements

- Node.js 20 or newer
- npm
- A Cloudflare account for production deployment

## 1. Installation

Install project dependencies:

```bash
npm install
```

## 2. Local Development

Local development uses Wrangler's emulated D1 and R2 storage. No Cloudflare account is required.

```bash
npm run db:migrate:local
npm run hash-password
```

The password script prompts for a password and generates the required authentication values.

Copy `.dev.vars.example` to `.dev.vars` and add the generated values.

Start the development server:

```bash
npm run dev
```

Application: `http://localhost:5173`

Admin dashboard: `http://localhost:5173/admin`

## 3. Cloudflare Configuration

Authenticate with Cloudflare:

```bash
npx wrangler login
```

### D1 Database

Create the production database:

```bash
npx wrangler d1 create project-archive-db
```

Copy the generated `database_id` into `wrangler.jsonc`, replacing the placeholder value.

### R2 Storage

Create the media bucket:

```bash
npx wrangler r2 bucket create project-archive-media
```

The bucket is private. Media is served through the application Worker at `/media/<key>`.

## 4. Database Migration

Apply the database migrations to the production database:

```bash
npm run db:migrate:remote
```

Run this whenever new database migrations need to be applied.

## 5. Configure Secrets

Generate authentication values:

```bash
npm run hash-password
```

Add both generated values to Cloudflare:

```bash
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
```

These secrets are required for administrator authentication.

Never commit `.dev.vars` or production secrets to version control.

## 6. Deploy

Deploy the application:

```bash
npm run deploy
```

The deployment script builds the frontend and Worker before publishing them.

Your application will be available at:

`https://project-archive.<your-subdomain>.workers.dev`

The Worker name and deployment configuration can be changed in `wrangler.jsonc`.

## 7. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local development |
| `npm run build` | Typecheck and build the application |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript checks |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run db:migrate:local` | Apply local D1 migrations |
| `npm run db:migrate:remote` | Apply production D1 migrations |
| `npm run hash-password` | Generate authentication secrets |

## 8. Testing

Optional local smoke tests are available:

- `scripts/api-test.sh`
- `scripts/browser-test.py`

The browser test requires Python Playwright and only accepts localhost URLs because it resets project data.

## 9. Important Notes

- Local and production databases are separate.
- Apply production migrations before deploying schema-dependent changes.
- Keep production secrets out of the repository.
- Back up important project data and uploaded media.
- The R2 bucket should remain private.
- Preview builds should be tested before production deployment.

---

For application details, features, architecture, and technology choices, see [README.md](README.md).