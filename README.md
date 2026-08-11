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

Update `wrangler.jsonc` with the real D1 database IDs before deploying.

## Local commands

```bash
npm install
npm run gen
npm run db:generate
npm run check
npm test
npm run dev
```

## Database schema

- `parts` stores each unique part, description, and free-form JSON metadata.
- `inventory_changes` stores every increment or decrement with actor, recorded time, optional note, and optional `used_in`.
- `parts_fts` is an FTS5 virtual table maintained by triggers for API search.

## REST API

Write endpoints require a producer token (`PRODUCER_API_TOKENS`). Read endpoints accept either a producer or consumer token (`CONSUMER_API_TOKENS`).

Pass the token in the `Authorization` header (`Authorization: Bearer <token>`) or with `X-API-Token: <token>`.

### Create a part

`POST /api/parts`

#### Request Body Parameters

| Field | Type | Required / Optional | Default | Description |
| --- | --- | --- | --- | --- |
| `name` | `string` | **Required** | — | Non-empty part name (e.g. `"20T GT2 Pulley"`). |
| `mfgPartNumber` | `string` | **Required** | — | Unique manufacturer part number (e.g. `"PULLEY-GT2-20T"`). Must be unique across all catalog parts. |
| `description` | `string` | **Optional** | `""` | Part description detailing specs or usage. |
| `metadata` | `object` | **Optional** | `{}` | Free-form JSON object for custom key-value metadata. |

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

#### Request Body Parameters

| Field | Type | Required / Optional | Default | Description |
| --- | --- | --- | --- | --- |
| `actor` | `string` | **Required** | — | Non-empty identifier of the user or system executing the transaction. |
| `lines` | `array` | **Required** | — | Non-empty array of line change objects (see Line Item Fields below). |
| `recordedAt` | `string` | **Optional** | Current Time | ISO-8601 timestamp string representing when the action occurred. |
| `note` | `string` | **Optional** | `null` | Optional reference note or audit comment. |

#### Transaction Line Item Fields (`lines[]`)

| Field | Type | Required / Optional | Description |
| --- | --- | --- | --- |
| `partId` | `string` | **Required** | Target part UUID string (must exist in catalog). |
| `quantityDelta` | `integer` | **Required** | Non-zero change amount (+ to add stock, - to consume stock). |
| `usedIn` | `string` | **Optional** | Assembly, sales order, or project reference (e.g. `"Order-1042"`). |

```json
{
	"actor": "assembly-line-1",
	"recordedAt": "2026-08-08T10:00:00.000Z",
	"note": "Restocked inbound shipment",
	"lines": [
		{
			"partId": "c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a",
			"quantityDelta": 25
		},
		{
			"partId": "a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d",
			"quantityDelta": -2,
			"usedIn": "Order-1042"
		}
	]
}
```

### Read inventory

- `GET /api/inventory` — List all catalog parts with stock levels.
- `GET /api/inventory?q=gt2` — Search inventory using full-text search.
- `GET /api/inventory?mfgPartNumber=PULLEY-GT2-20T&mfgPartNumber=GEAR-50T` — Filter inventory by specific manufacturer part numbers (supports repeating query parameters or comma-separated lists).
- `GET /api/inventory?id=<uuid-1>&id=<uuid-2>` — Filter inventory by specific part UUIDs (supports repeating query parameters or comma-separated lists).
- `GET /api/search?q=gear` — Catalog full-text search endpoint.
- `GET /api/history?limit=100` — Inventory change transaction audit history.
- `GET /api/history?partId=<part-id>` — Filter change history for a specific part.
