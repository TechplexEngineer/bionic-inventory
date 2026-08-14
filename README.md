# bionic-inventory

A SvelteKit inventory microservice for Cloudflare Workers backed by D1 and Drizzle ORM. The Bootstrap 5 inventory dashboard is read-only and shows current inventory plus recent history; inventory writes use the API, while the authenticated `/keys` admin UI is a separate mutating surface for provisioning and revoking API keys.

## Features

- Cloudflare Workers runtime with a D1 database binding
- Drizzle ORM schema for `parts` and `inventory_changes`
- Secure, role-scoped API-key provisioning with administrator login
- Producer and consumer API token authorization, including optional legacy static tokens
- Full-text search with SQLite FTS5 over part name, manufacturer part number, and description
- Bootstrap 5 inventory dashboard with administrator archive / unarchive controls for parts
- Multi-line inventory transactions with optional `usedIn` context per consumed part

## Environment

Copy `.env.example` to `.env` and fill in your Cloudflare values when running Drizzle commands locally:

```bash
cp .env.example .env
```

- `ADMIN_PASSWORD` - required administrator password for `/login`
- `SESSION_SECRET` - required high-entropy secret used to sign administrator sessions
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DATABASE_ID`
- `CLOUDFLARE_D1_TOKEN`
- `PRODUCER_API_TOKENS` - optional comma-separated static write tokens
- `CONSUMER_API_TOKENS` - optional comma-separated static read tokens

Update `wrangler.jsonc` with the real D1 database IDs before deploying.

### Cloudflare production secrets

Set both administrator secrets with Wrangler before using `/login` or `/keys` in a deployed Worker. Each command prompts for the value, keeping it out of source control and `wrangler.jsonc`.

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Use a unique, high-entropy value for each secret. There is no development or production fallback password: if either secret is missing, administrator authentication is unavailable. The `CLOUDFLARE_*` values in `.env` are only for local Drizzle tooling; do not commit `.env`.

## Local commands

```bash
npm install
npm run gen
npm run db:generate
npm run check
npm test
npm run dev
```

### D1 migrations

Apply migrations to the local D1 emulator while developing:

```bash
npx wrangler d1 migrations apply bionic-inventory --local
```

Apply the same migrations to the configured remote D1 database only as a deliberate deployment operation, after reviewing the target account and database ID:

```bash
npx wrangler d1 migrations apply bionic-inventory --remote
```

`--local` and `--remote` use different databases and migration state. Do not substitute the remote command for local development, and do not run the remote command merely to test a migration.

## Database schema

- `parts` stores each unique part, description, and free-form JSON metadata.
- `parts.archived_at` soft-deletes parts without losing history; archived parts are hidden unless explicitly requested.
- `inventory_changes` stores every increment or decrement with actor, recorded time, optional note, and optional `used_in`.
- `parts_fts` is an FTS5 virtual table maintained by triggers for API search.
- `api_keys` stores provisioned keys by SHA-256 hash and a non-secret display prefix, with role, creation timestamp, and optional revocation timestamp. Raw API-key values are never stored in D1.

## Administrator key provisioning

Visit `/login` and authenticate with `ADMIN_PASSWORD`. A successful login creates an HttpOnly, signed `admin_session` cookie and redirects to `/keys`. That page can create producer or consumer keys, list their safe prefixes and status, and revoke keys. Signed-in administrators also get archive / unarchive controls on the main inventory dashboard. Use the Logout control to delete the administrator session and return to `/login`.

The complete raw token is displayed only once, immediately after creation. Copy and store it in an approved secret manager before leaving the confirmation. Later views expose only the prefix, so a lost token must be revoked and replaced.

Provisioned API keys are accepted in either `Authorization: Bearer <token>` or `X-API-Token: <token>`. A producer key can use write and read endpoints; a consumer key can use read endpoints only. Revoked keys are rejected.

## REST API

Write endpoints require a producer token. Read endpoints accept either a producer or consumer token. Tokens may be provisioned through `/keys`; for compatibility, the optional comma-separated `PRODUCER_API_TOKENS` and `CONSUMER_API_TOKENS` environment values remain valid as static tokens. Prefer provisioned keys for rotation and revocation; static tokens cannot be revoked from the UI.

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
- `GET /api/inventory?showArchived=true` — Include archived parts in the inventory listing.
- `GET /api/inventory?q=gt2` — Search inventory using full-text search.
- `GET /api/inventory?mfgPartNumber=PULLEY-GT2-20T&mfgPartNumber=GEAR-50T` — Filter inventory by specific manufacturer part numbers (supports repeating query parameters or comma-separated lists).
- `GET /api/inventory?id=<uuid-1>&id=<uuid-2>` — Filter inventory by specific part UUIDs (supports repeating query parameters or comma-separated lists).
- `GET /api/search?q=gear` — Catalog full-text search endpoint.
- `GET /api/search?q=gear&showArchived=true` — Search including archived parts.
- `GET /api/history?limit=100` — Inventory change transaction audit history.
- `GET /api/history?partId=<part-id>` — Filter change history for a specific part.

### Archive or unarchive a part

`PUT /api/parts`

#### Request Body Parameters

| Field | Type | Required / Optional | Description |
| --- | --- | --- | --- |
| `id` | `string` | **Required** | Existing part UUID string. |
| `archived` | `boolean` | **Required** | `true` archives the part; `false` restores it. |

```json
{
	"id": "c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a",
	"archived": true
}
```
