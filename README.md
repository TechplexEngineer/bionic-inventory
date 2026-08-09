# bionic-inventory

A SvelteKit inventory microservice for Cloudflare Workers backed by D1 and Drizzle ORM. The API is the only write surface; the Bootstrap 5 web UI is read-only and shows current inventory plus recent inventory history.

## Features

- Cloudflare Workers runtime with a D1 database binding
- Drizzle ORM schema for `parts` and `inventory_changes`
- Producer and consumer API token authorization
- Full-text search with SQLite FTS5 over part name, manufacturer part number, and description
- View-only Bootstrap 5 frontend for current inventory and transaction history
- Multi-line inventory transactions with optional `usedIn` context per consumed part

## Environment

Copy `.env.example` to `.env` and fill in your Cloudflare values when running Drizzle commands locally:

```bash
cp .env.example .env
```

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DATABASE_ID`
- `CLOUDFLARE_D1_TOKEN`
- `PRODUCER_API_TOKENS` - comma-separated write tokens
- `CONSUMER_API_TOKENS` - comma-separated read tokens

Update `wrangler.jsonc` with the real D1 database IDs before deploying locally, or provide `CLOUDFLARE_DATABASE_ID` to the GitHub Actions workflow.

## Local commands

```bash
npm install
npm run gen
npm run db:generate
npm run check
npm test
npm run dev
```

## GitHub Actions deployment

This repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that validates the app and deploys it to Cloudflare Workers on pushes to `main` or when manually triggered.

Add these repository secrets before enabling the workflow:

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers Scripts edit access and D1 edit access
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID for the target Workers account
- `CLOUDFLARE_DATABASE_ID` - D1 database ID used for the `DB` binding in `wrangler.jsonc`
- `PRODUCER_API_TOKENS` - comma-separated write tokens for the deployed Worker
- `CONSUMER_API_TOKENS` - comma-separated read tokens for the deployed Worker

The workflow injects the D1 database ID into `wrangler.jsonc` during the run and uploads the API token values to Cloudflare as Worker secrets before publishing.

## Database schema

- `parts` stores each unique part, description, and free-form JSON metadata.
- `inventory_changes` stores every increment or decrement with actor, recorded time, optional note, and optional `used_in`.
- `parts_fts` is an FTS5 virtual table maintained by triggers for API search.

## REST API

Write endpoints require a producer token. Read endpoints accept either a producer or consumer token.

Pass the token in the `Authorization` header or with `X-API-Token: <token>`.

### Create a part

`POST /api/parts`

```json
{
	"name": "20T GT2 Pulley",
	"mfgPartNumber": "PULLEY-GT2-20T",
	"description": "Aluminum timing pulley",
	"metadata": {
		"teeth": 20,
		"pitch": "GT2",
		"boreMm": 5
	}
}
```

### Record inventory changes

`POST /api/transactions`

```json
{
	"actor": "assembly-line-1",
	"recordedAt": "2026-08-08T10:00:00.000Z",
	"note": "Restocked inbound shipment",
	"lines": [
		{
			"partId": "part-id",
			"quantityDelta": 25
		},
		{
			"partId": "part-id-2",
			"quantityDelta": -2,
			"usedIn": "Order-1042"
		}
	]
}
```

### Read inventory

- `GET /api/inventory`
- `GET /api/inventory?q=gt2`
- `GET /api/search?q=gear`
- `GET /api/history?limit=100`
- `GET /api/history?partId=<part-id>`
