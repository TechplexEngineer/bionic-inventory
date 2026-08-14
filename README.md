# bionic-inventory

A SvelteKit inventory microservice for Cloudflare Workers backed by D1 and Drizzle ORM. The Bootstrap 5 inventory dashboard is read-only and shows current inventory plus recent history; inventory writes use the API, while the authenticated `/keys` admin UI is a separate mutating surface for provisioning and revoking API keys.

## Features

- Cloudflare Workers runtime with a D1 database binding
- Drizzle ORM schema for `parts` and `inventory_changes`
- Secure, role-scoped API-key provisioning with administrator login
- Producer and consumer API token authorization, including optional legacy static tokens
- Full-text search with SQLite FTS5 over part name, manufacturer part number, and description
- API-managed inventory types with text/numeric property definitions and optimistic concurrency
- Validated typed metadata plus stable-ID inventory filters and text facets
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

- `inventory_types` and `inventory_type_properties` store canonical type definitions and stable property IDs. Property names are unique within a type without regard to case.
- `parts` stores each unique part, its JSON metadata, and a nullable type reference. The reference is nullable only so rows created before the inventory-type migration remain readable; every new part created through the API requires a type.
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

Successful part responses include `inventoryTypeId`, `inventoryTypeName`, and `updatedAt` in addition to the existing part fields. A migrated legacy row reports both type fields as `null`. Expected client errors retain the human-readable `error` property and add a stable `code` plus `field` when a specific request path is responsible:

```json
{
	"error": "The part changed after it was read.",
	"code": "PART_UPDATE_CONFLICT",
	"field": "updatedAt"
}
```

### Inventory types

- `GET /api/types` — list types and their complete property definitions.
- `POST /api/types` — create a type; producer only.
- `GET /api/types/{id}` — read one complete type definition.
- `PUT /api/types/{id}` — atomically replace a type definition; producer only.
- `DELETE /api/types/{id}` — delete an unreferenced type; producer only.

Create a type with `name` and a complete `properties` array. Each property requires `name`, `kind` (`text` or `numeric`), and `required`. Numeric `minimum` and `maximum` constraints are inclusive and either bound may be omitted. Text properties cannot have bounds.

```json
{
	"name": "Belt",
	"properties": [
		{ "name": "Material", "kind": "text", "required": true },
		{ "name": "Width", "kind": "numeric", "required": false, "minimum": 1 }
	]
}
```

Responses assign stable IDs to the type and every property. A replacement includes the last observed type `updatedAt` and repeats IDs for properties it retains:

```json
{
	"name": "Belt",
	"updatedAt": "2026-08-14T12:00:00.000Z",
	"properties": [
		{
			"id": "material-property-uuid",
			"name": "Material",
			"kind": "text",
			"required": true
		},
		{ "name": "Teeth", "kind": "numeric", "required": true, "minimum": 10 }
	]
}
```

Retained properties cannot change name or kind. Omitting an existing property deletes it; an entry without an ID creates a new property with a new stable ID. A stale `updatedAt` returns `409` without overwriting the newer definition. Type replacement does not rewrite or reject existing parts. A type cannot be deleted while an active or archived part references it.

### Create a typed part

`POST /api/parts`

| Field             | Type     | Required / Optional | Default | Description                                                                                                     |
| ----------------- | -------- | ------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `name`            | `string` | **Required**        | —       | Non-empty part name (e.g. `"20T GT2 Pulley"`).                                                                  |
| `mfgPartNumber`   | `string` | **Required**        | —       | Unique manufacturer part number (e.g. `"PULLEY-GT2-20T"`). Must be unique across all catalog parts.             |
| `inventoryTypeId` | `string` | **Required**        | —       | Existing inventory type UUID used to validate metadata.                                                         |
| `description`     | `string` | **Optional**        | `""`    | Part description detailing specs or usage.                                                                      |
| `metadata`        | `object` | **Optional**        | `{}`    | Metadata validated against the selected type. It may be omitted only when that type has no required properties. |

```json
{
	"name": "Nylon Timing Belt",
	"mfgPartNumber": "BELT-NYLON-12",
	"inventoryTypeId": "belt-type-uuid",
	"metadata": {
		"material": "Nylon",
		"WIDTH": 12,
		"SupplierCode": "A7"
	}
}
```

Defined keys match without regard to case and are stored with the type's canonical spelling, so the example persists `Material` and `Width`. Multiple submitted keys that collapse to the same defined property are rejected. Required text must be nonblank; supplied text/numeric values must have the declared JSON kind and numeric values must satisfy current inclusive bounds. Undefined extra fields such as `SupplierCode` are allowed, remain unvalidated, and keep their submitted spelling.

### Edit a part

`PATCH /api/parts/{id}` accepts any subset of `name`, `mfgPartNumber`, `description`, `inventoryTypeId`, and `metadata`, plus the required last-observed `updatedAt`. Omitted ordinary fields keep their stored values. If `metadata` is present, it replaces the whole metadata object; it is not deep-merged.

```json
{
	"metadata": { "Material": "Nylon", "Width": 16, "Teeth": 100 },
	"updatedAt": "2026-08-14T12:00:00.000Z"
}
```

Changing `inventoryTypeId` validates the complete resulting metadata against the destination type. A stale part `updatedAt` returns `409` without overwriting newer data.

### Read and filter inventory

- `GET /api/inventory` — list active catalog parts with stock levels, including legacy untyped parts.
- `GET /api/inventory?showArchived=true` — include archived parts.
- `GET /api/inventory?q=gt2` — combine full-text search with inventory filters.
- `GET /api/inventory?mfgPartNumber=A&mfgPartNumber=B` — filter by repeated or comma-separated manufacturer part numbers.
- `GET /api/inventory?id=<uuid-1>&id=<uuid-2>` — filter by repeated or comma-separated part UUIDs.
- `GET /api/inventory?typeId=<type-uuid>` — show only active parts of one type; legacy untyped parts do not match.
- `GET /api/search?q=gear&showArchived=true` — use the compatibility catalog search endpoint.
- `GET /api/history?limit=100&partId=<part-id>` — read transaction audit history.

Metadata filters require exactly one valid `typeId` and use stable property IDs, not property names:

```text
meta[<property-id>][exact]=Nylon
meta[<property-id>][contains]=nyl
meta[<property-id>][exact]=12
meta[<property-id>][min]=10
meta[<property-id>][max]=20
```

`exact` and `contains` are case-insensitive for text. Numeric `exact`, inclusive `min`, and inclusive `max` accept decimals; a range may provide either side or both. All active metadata filters combine with AND, and a part missing an optional filtered property does not match. Operators incompatible with the property kind, repeated/conflicting operators, unknown property IDs, non-finite numbers, and `min > max` return structured client errors.

For example:

```text
GET /api/inventory?typeId=belt-type-uuid&meta[material-property-uuid][contains]=nyl&meta[width-property-uuid][min]=10
```

### Read text facets

`GET /api/inventory/facets` requires `typeId` and accepts the same `q`, `showArchived`, `mfgPartNumber`, `id`, and metadata filters as `/api/inventory`.

```text
GET /api/inventory/facets?typeId=belt-type-uuid&meta[width-property-uuid][min]=10
```

The response contains one entry per text property, using its stable property ID:

```json
{
	"facets": [
		{
			"propertyId": "material-property-uuid",
			"values": [
				{ "value": "Nylon", "count": 3 },
				{ "value": "Rubber", "count": 1 }
			]
		}
	]
}
```

Each facet keeps all current inventory and other-property metadata filters but omits its own property filter so alternative values remain available. Only present string values participate; values collapse without regard to ASCII casing.

### Legacy and grandfathered parts

The inventory-type migration does not rewrite existing metadata. Existing rows keep `inventoryTypeId: null` and remain visible in unfiltered inventory. New API-created parts cannot bypass type assignment or current metadata validation.

Changing a type can make an already stored part nonconforming. That grandfathered part remains readable and filterable, but its next `PATCH` must produce a complete record that satisfies the current definition—even if the requested edit concerns only an unrelated field.

### Record inventory changes

`POST /api/transactions`

| Field        | Type     | Required / Optional | Default      | Description                                                           |
| ------------ | -------- | ------------------- | ------------ | --------------------------------------------------------------------- |
| `actor`      | `string` | **Required**        | —            | Non-empty identifier of the user or system executing the transaction. |
| `lines`      | `array`  | **Required**        | —            | Non-empty array of line change objects (see Line Item Fields below).  |
| `recordedAt` | `string` | **Optional**        | Current Time | ISO-8601 timestamp string representing when the action occurred.      |
| `note`       | `string` | **Optional**        | `null`       | Optional reference note or audit comment.                             |

#### Transaction Line Item Fields (`lines[]`)

| Field           | Type      | Required / Optional | Description                                                        |
| --------------- | --------- | ------------------- | ------------------------------------------------------------------ |
| `partId`        | `string`  | **Required**        | Target part UUID string (must exist in catalog).                   |
| `quantityDelta` | `integer` | **Required**        | Non-zero change amount (+ to add stock, - to consume stock).       |
| `usedIn`        | `string`  | **Optional**        | Assembly, sales order, or project reference (e.g. `"Order-1042"`). |

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

### Archive or unarchive a part

`PUT /api/parts`

#### Request Body Parameters

| Field      | Type      | Required / Optional | Description                                    |
| ---------- | --------- | ------------------- | ---------------------------------------------- |
| `id`       | `string`  | **Required**        | Existing part UUID string.                     |
| `archived` | `boolean` | **Required**        | `true` archives the part; `false` restores it. |

```json
{
	"id": "c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a",
	"archived": true
}
```

This compatibility mutation does not require `updatedAt`; it only changes archive state. Archiving keeps the type reference, so it does not permit deletion of a referenced type.
