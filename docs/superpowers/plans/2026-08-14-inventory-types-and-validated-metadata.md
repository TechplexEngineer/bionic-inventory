# Inventory Types and Validated Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API-managed inventory types, validated typed part writes, and type-specific faceted filtering to the API and read-only dashboard while preserving legacy untyped parts.

**Architecture:** Store type and property definitions in normalized D1 tables, retain part values in the existing JSON metadata column, and share one validated inventory-query model between API routes and the dashboard. Keep pure definition/metadata/filter rules in focused modules, with database operations and SvelteKit route adapters layered on top.

**Tech Stack:** TypeScript 6, SvelteKit 2, Svelte 5, Cloudflare Workers and D1/SQLite JSON1, Drizzle ORM 0.45, Bootstrap 5, Vitest 4.

## Global Constraints

- Existing parts and their JSON metadata must remain unchanged and become legacy untyped rows after migration.
- New parts require one valid inventory type; the database column remains nullable only for legacy compatibility.
- Property names match case-insensitively and defined keys are persisted with the definition's canonical spelling.
- Property name and kind are immutable; either change requires delete-and-add with a new property ID.
- Undefined metadata keys remain permitted, unvalidated, and spelled exactly as submitted.
- Type updates are atomic and type/part edits require an `updatedAt` optimistic-concurrency precondition.
- Type and part management remain API-only; the dashboard remains read-only.
- Metadata filters require exactly one type, combine with AND, and use stable property IDs.
- Do not deploy migrations or application code to production as part of this plan.

---

## File Structure

- `src/lib/server/db/schema.ts`: Drizzle tables, indexes, relations, and part type foreign key.
- `drizzle/0003_inventory_types.sql` plus `drizzle/meta/*`: generated D1 migration and metadata.
- `src/lib/server/inventory-errors.ts`: structured domain error and SvelteKit response mapping.
- `src/lib/server/inventory-types.ts`: type contracts, definition normalization, and type CRUD persistence.
- `src/lib/server/metadata-validation.ts`: pure canonicalization and part metadata validation.
- `src/lib/server/inventory-filters.ts`: URL parsing, validated filter model, JSON predicates, inventory listing, and facets.
- `src/lib/server/parts.ts`: typed part create and partial-update persistence.
- `src/lib/server/inventory.ts`: existing auth, API keys, history, archive operations, and compatibility exports; delegate changed inventory/part behavior to focused modules.
- `src/routes/api/types/+server.ts`, `src/routes/api/types/[id]/+server.ts`: type collection and item routes.
- `src/routes/api/parts/[id]/+server.ts`: partial part update route.
- `src/routes/api/inventory/+server.ts`, `src/routes/api/inventory/facets/+server.ts`: validated inventory and facet reads.
- `src/routes/+page.server.ts`, `src/routes/+page.svelte`: server-rendered type selector and dynamic filters.
- `src/lib/server/api-docs.ts`, `README.md`: public contracts and examples.

### Task 1: Schema and legacy-safe migration

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0003_inventory_types.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0003_snapshot.json`
- Create: `src/lib/server/db/schema.test.ts`

**Interfaces:**
- Produces: `inventoryTypes`, `inventoryTypeProperties`, and nullable `parts.inventoryTypeId` Drizzle exports used by all later persistence tasks.
- Produces constraints: `inventory_types_normalized_name_idx`, `inventory_type_properties_type_name_idx`, property kind/bounds checks, and `ON DELETE RESTRICT` part references.

- [ ] **Step 1: Write a failing schema contract test**

```ts
import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { inventoryTypes, inventoryTypeProperties, parts } from './schema';

describe('inventory type schema', () => {
	it('exports normalized definitions and a nullable legacy part reference', () => {
		expect(getTableConfig(inventoryTypes).name).toBe('inventory_types');
		expect(getTableConfig(inventoryTypeProperties).name).toBe('inventory_type_properties');
		expect(parts.inventoryTypeId.notNull).toBe(false);
	});
});
```

- [ ] **Step 2: Run the schema test and confirm it fails**

Run: `npm run test:unit -- --run src/lib/server/db/schema.test.ts`

Expected: FAIL because the two table exports and part column do not exist.

- [ ] **Step 3: Add the Drizzle schema**

Define the tables with UUID text primary keys, canonical and normalized names, `text|numeric` kind typing, integer required flag, nullable real-number bounds, timestamps, foreign keys, and the unique indexes named above. Add nullable `inventoryTypeId` to `parts` with `onDelete: 'restrict'` and an index.

```ts
export const inventoryTypes = sqliteTable('inventory_types', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	normalizedName: text('normalized_name').notNull(),
	createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

- [ ] **Step 4: Generate and inspect the migration**

Run: `npm run db:generate`

Expected: creates `0003_inventory_types.sql` without rebuilding or rewriting existing part metadata. Inspect it to confirm the new part column has no `NOT NULL` clause and the foreign key restricts deletion.

- [ ] **Step 5: Add/verify SQL checks and run schema verification**

Ensure the generated migration constrains `kind IN ('text', 'numeric')`, prevents text properties from carrying numeric limits, and prevents `minimum > maximum`. Then run:

```bash
npm run test:unit -- --run src/lib/server/db/schema.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit the schema slice**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/schema.test.ts drizzle
git commit -m "feat: add inventory type schema"
```

### Task 2: Structured errors and pure metadata validation

**Files:**
- Create: `src/lib/server/inventory-errors.ts`
- Create: `src/lib/server/metadata-validation.ts`
- Create: `src/lib/server/metadata-validation.test.ts`
- Modify: `src/lib/server/inventory.ts`

**Interfaces:**
- Produces: `InventoryRouteError(code: string, message: string, status: number, field?: string)` and `handleInventoryError(cause): Response`.
- Produces: `PropertyDefinition` and `canonicalizeAndValidateMetadata(metadata, properties): Record<string, unknown>`.

- [ ] **Step 1: Write failing metadata and error tests**

Cover canonical spelling, duplicate case variants, required whitespace text, optional absence, wrong JSON kinds, finite numeric values, inclusive minimum/maximum, and untouched undefined keys.

```ts
expect(canonicalizeAndValidateMetadata(
	{ WIDTH: 10, VendorCode: 'A7' },
	[{ id: 'p1', name: 'Width', normalizedName: 'width', kind: 'numeric', required: true, minimum: 10, maximum: 20 }]
)).toEqual({ Width: 10, VendorCode: 'A7' });

expect(() => canonicalizeAndValidateMetadata(
	{ Width: 10, width: 11 }, properties
)).toThrowError(expect.objectContaining({ code: 'METADATA_KEY_COLLISION', field: 'metadata.width' }));
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm run test:unit -- --run src/lib/server/metadata-validation.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement structured error mapping**

Move the existing error class/handler out of `inventory.ts`, preserve existing `{ error }` compatibility, and add `code` plus optional `field`:

```ts
return json(
	{ error: cause.message, code: cause.code, ...(cause.field ? { field: cause.field } : {}) },
	{ status: cause.status }
);
```

Re-export from `inventory.ts` so current routes keep working.

- [ ] **Step 4: Implement canonicalization and validation**

Index definitions by normalized name, detect duplicate incoming keys before rewriting, retain extra keys, and validate supplied defined values. Treat only absent properties as absent; for required text also reject `value.trim().length === 0`. Reject `NaN` and infinities with `Number.isFinite`.

- [ ] **Step 5: Run focused and regression tests**

```bash
npm run test:unit -- --run src/lib/server/metadata-validation.test.ts src/lib/server/inventory.test.ts
npm run check
```

Expected: PASS with current route error behavior preserved plus structured fields.

- [ ] **Step 6: Commit the validation slice**

```bash
git add src/lib/server/inventory-errors.ts src/lib/server/metadata-validation.ts src/lib/server/metadata-validation.test.ts src/lib/server/inventory.ts
git commit -m "feat: validate typed part metadata"
```

### Task 3: Inventory type definition lifecycle

**Files:**
- Create: `src/lib/server/inventory-types.ts`
- Create: `src/lib/server/inventory-types.test.ts`
- Create: `src/routes/api/types/+server.ts`
- Create: `src/routes/api/types/[id]/+server.ts`
- Create: `src/routes/api/types/types.server.test.ts`

**Interfaces:**
- Produces: `listInventoryTypes`, `getInventoryType`, `createInventoryType`, `replaceInventoryType`, and `deleteInventoryType`.
- Consumes: schema exports from Task 1 and `InventoryRouteError` from Task 2.
- Request definition: `{ name, properties: Array<{ id?: string; name: string; kind: 'text'|'numeric'; required: boolean; minimum?: number|null; maximum?: number|null }>, updatedAt?: string }`.

- [ ] **Step 1: Write failing pure normalization tests**

Test trimmed names, Unicode-aware lowercase normalization, case-insensitive duplicate properties, invalid bounds, bounds on text, foreign property IDs, immutable retained names/kinds, and omission-as-delete.

```ts
expect(() => normalizeTypeDefinition({
	name: 'Belt',
	properties: [
		{ name: 'Width', kind: 'numeric', required: true },
		{ name: 'width', kind: 'numeric', required: false }
	]
})).toThrowError(expect.objectContaining({ code: 'DUPLICATE_PROPERTY_NAME' }));
```

- [ ] **Step 2: Run the definition tests and confirm failure**

Run: `npm run test:unit -- --run src/lib/server/inventory-types.test.ts`

Expected: FAIL because lifecycle functions do not exist.

- [ ] **Step 3: Implement reads, creation, and atomic replacement**

Use D1/Drizzle reads for nested definitions. For create and replace, validate first and use `d1.batch()` for the type/property statements. Replacement must compare `updatedAt`, verify every supplied ID belongs to the target, reject retained name/kind changes, delete omitted IDs, update mutable fields, and add ID-less definitions.

- [ ] **Step 4: Implement protected deletion**

Query both active and archived parts by `inventoryTypeId`; return `TYPE_IN_USE` with `409` when any exists. Translate the foreign-key race failure to the same structured conflict.

- [ ] **Step 5: Add authenticated route tests and handlers**

Test consumer/producer reads, producer-only writes, `201` creation, `404` item reads, `409` normalized-name and stale-update conflicts, atomic replacement, and referenced deletion. Route handlers must call `requireApiRole` before parsing/writing.

- [ ] **Step 6: Run type tests and regressions**

```bash
npm run test:unit -- --run src/lib/server/inventory-types.test.ts src/routes/api/types/types.server.test.ts
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit the type lifecycle**

```bash
git add src/lib/server/inventory-types.ts src/lib/server/inventory-types.test.ts src/routes/api/types
git commit -m "feat: add inventory type API"
```

### Task 4: Typed part creation and partial editing

**Files:**
- Create: `src/lib/server/parts.ts`
- Create: `src/lib/server/parts.test.ts`
- Modify: `src/routes/api/parts/+server.ts`
- Create: `src/routes/api/parts/[id]/+server.ts`
- Modify: `src/lib/server/inventory.ts`
- Modify: `src/lib/server/inventory.test.ts`

**Interfaces:**
- Produces: `createPart(d1, payload)` and `updatePart(d1, id, payload)` returning `InventoryPart` with `inventoryTypeId`, `inventoryTypeName`, and `updatedAt`.
- Consumes: `getInventoryType` and `canonicalizeAndValidateMetadata`.
- Patch contract: `{ name?, mfgPartNumber?, description?, inventoryTypeId?, metadata?, updatedAt }`; when present, `metadata` replaces the complete object.

- [ ] **Step 1: Write failing part service tests**

Test required type creation, unknown types, canonical metadata persistence, metadata replacement rather than deep merge, partial ordinary-field merging, destination-type validation, full validation of grandfathered records, and stale `updatedAt`.

```ts
await expect(updatePart(d1, 'part-1', {
	metadata: { Width: 12 },
	updatedAt: '2026-08-14T12:00:00.000Z'
})).resolves.toMatchObject({ metadata: { Width: 12 } });
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm run test:unit -- --run src/lib/server/parts.test.ts`

Expected: FAIL because the service does not exist and creation lacks type validation.

- [ ] **Step 3: Implement typed creation**

Require and normalize `inventoryTypeId`, load the definition, canonicalize/validate metadata, insert the type reference, and return type identity plus `updatedAt`. Keep manufacturer number conflict behavior.

- [ ] **Step 4: Implement optimistic partial editing**

Load the stored part, merge only supplied top-level fields, replace metadata wholesale when supplied, load the resulting type, validate the full result, and issue an update guarded by both `id` and the submitted `updatedAt`. Return `PART_UPDATE_CONFLICT` when no row changes.

- [ ] **Step 5: Add the PATCH route and update compatibility exports**

Authorize producers, pass the path ID and JSON body to `updatePart`, and map errors through the shared handler. Keep the collection route's existing archive/unarchive operation intact and re-export moved functions from `inventory.ts` for current callers.

- [ ] **Step 6: Run focused, route, and regression tests**

```bash
npm run test:unit -- --run src/lib/server/parts.test.ts src/lib/server/inventory.test.ts
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit typed part writes**

```bash
git add src/lib/server/parts.ts src/lib/server/parts.test.ts src/lib/server/inventory.ts src/lib/server/inventory.test.ts src/routes/api/parts
git commit -m "feat: enforce inventory types on part writes"
```

### Task 5: Validated metadata filter model and inventory queries

**Files:**
- Create: `src/lib/server/inventory-filters.ts`
- Create: `src/lib/server/inventory-filters.test.ts`
- Modify: `src/routes/api/inventory/+server.ts`
- Modify: `src/lib/server/inventory.ts`
- Modify: `src/lib/server/inventory.test.ts`

**Interfaces:**
- Produces: `parseInventoryQuery(url, properties?): InventoryQuery` and `listFilteredInventory(d1, query): Promise<InventoryPart[]>`.
- `InventoryQuery` contains existing `query`, `mfgPartNumber`, `id`, `showArchived`, optional `typeId`, and `metadataFilters: Array<{ propertyId, operator, value }>`.
- Consumes type definitions and returns `InventoryPart` including type identity and `updatedAt`.

- [ ] **Step 1: Write failing parser tests**

Test the exact bracket syntax, one-sided/two-sided numeric ranges, AND composition, required `typeId`, unknown properties, kind/operator mismatch, repeated scalars, simultaneous text exact/contains, simultaneous numeric exact/range, non-finite values, and minimum greater than maximum.

```ts
const parsed = parseInventoryQuery(new URL(
	'https://example.test/api/inventory?typeId=t1&meta[p1][min]=10&meta[p1][max]=20'
), numericProperties);
expect(parsed.metadataFilters).toEqual([
	{ propertyId: 'p1', operator: 'min', value: 10 },
	{ propertyId: 'p1', operator: 'max', value: 20 }
]);
```

- [ ] **Step 2: Run parser tests and confirm failure**

Run: `npm run test:unit -- --run src/lib/server/inventory-filters.test.ts`

Expected: FAIL because the filter module does not exist.

- [ ] **Step 3: Implement strict URL parsing**

Parse only `meta[<uuid>][exact|contains|min|max]`, reject malformed `meta[...]` keys, load the selected definition before validating metadata filters, and retain the existing query parameter behavior for non-metadata filters.

- [ ] **Step 4: Write failing query integration tests**

Seed a local test D1 database with typed, legacy, archived, missing-optional, mixed-case text, integer, and decimal metadata. Assert exact/contains/range behavior, inclusive bounds, missing-value exclusion, AND composition, legacy visibility, type selection, archive visibility, and composition with full-text search.

- [ ] **Step 5: Implement bound JSON predicates**

Build queries from the validated property definitions. Use SQLite JSON functions with bound JSON paths and bound values; never interpolate user input. Compare text with `COLLATE NOCASE`, ensure numeric predicates check `json_type(...) IN ('integer','real')`, and keep the inventory quantity aggregation correct.

- [ ] **Step 6: Route all inventory reads through the shared model**

Update `/api/inventory` and dashboard-compatible exports. Ensure selected-type queries exclude legacy and other-type rows, while unfiltered queries still show legacy parts.

- [ ] **Step 7: Run focused and full verification**

```bash
npm run test:unit -- --run src/lib/server/inventory-filters.test.ts src/lib/server/inventory.test.ts
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit filtering**

```bash
git add src/lib/server/inventory-filters.ts src/lib/server/inventory-filters.test.ts src/lib/server/inventory.ts src/lib/server/inventory.test.ts src/routes/api/inventory/+server.ts
git commit -m "feat: filter inventory by typed metadata"
```

### Task 6: Faceted text values

**Files:**
- Modify: `src/lib/server/inventory-filters.ts`
- Modify: `src/lib/server/inventory-filters.test.ts`
- Create: `src/routes/api/inventory/facets/+server.ts`
- Create: `src/routes/api/inventory/facets/facets.server.test.ts`

**Interfaces:**
- Produces: `listInventoryFacets(d1, query): Promise<Array<{ propertyId: string; values: Array<{ value: string; count: number }> }>>`.
- Consumes the exact `InventoryQuery` from Task 5; for each property, omits filters whose `propertyId` equals that facet property and retains every other filter.

- [ ] **Step 1: Write failing facet tests**

Seed text values with case variants and parts excluded by search, archive visibility, type, and other metadata filters. Assert that own-filter removal exposes alternatives, other filters remain active, missing/non-text values are excluded, values collapse case-insensitively, counts are correct, and ordering is deterministic.

```ts
expect(await listInventoryFacets(d1, query)).toContainEqual({
	propertyId: 'color-id',
	values: [{ value: 'Black', count: 2 }, { value: 'Red', count: 1 }]
});
```

- [ ] **Step 2: Run facet tests and confirm failure**

Run: `npm run test:unit -- --run src/lib/server/inventory-filters.test.ts src/routes/api/inventory/facets/facets.server.test.ts`

Expected: FAIL because facet behavior and route do not exist.

- [ ] **Step 3: Implement facet queries**

For each text property, reuse the base query and all filters except that property's own filter. Group values case-insensitively, select a deterministic spelling (lowest case-insensitive then binary value), count matching parts, and order by display value case-insensitively.

- [ ] **Step 4: Implement and test the authenticated route**

Accept consumer or producer credentials, parse through `parseInventoryQuery`, require `typeId`, return `{ facets }`, and use structured errors for invalid requests.

- [ ] **Step 5: Run focused and regression verification**

```bash
npm run test:unit -- --run src/lib/server/inventory-filters.test.ts src/routes/api/inventory/facets/facets.server.test.ts
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit facets**

```bash
git add src/lib/server/inventory-filters.ts src/lib/server/inventory-filters.test.ts src/routes/api/inventory/facets
git commit -m "feat: add inventory metadata facets"
```

### Task 7: Read-only dashboard filters

**Files:**
- Modify: `src/routes/+page.server.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `src/routes/layout.server.test.ts`
- Create: `src/routes/page.server.test.ts`
- Create: `src/routes/page.svelte.test.ts`

**Interfaces:**
- Consumes: `listInventoryTypes`, `parseInventoryQuery`, `listFilteredInventory`, and `listInventoryFacets`.
- Page data adds `inventoryTypes`, `selectedType`, `filters`, and `facets`; every filter remains serialized in the URL.

- [ ] **Step 1: Write failing page-load tests**

Mock the shared services and assert the load returns all types, resolves the selected definition, passes one parsed filter model to inventory/facet reads, preserves error URL state, and does not request facets without a selected type.

- [ ] **Step 2: Run page-load tests and confirm failure**

Run: `npm run test:unit -- --run src/routes/page.server.test.ts`

Expected: FAIL because the load lacks type/filter/facet data.

- [ ] **Step 3: Implement the shared server load**

Load types, parse the URL against the selected definition, fetch parts and facets, and return serializable filter state. Retain current missing-database/schema messaging and history loading.

- [ ] **Step 4: Write failing component behavior tests**

Install the test-only DOM tooling and add a `client` Vitest project for `src/**/*.svelte.test.ts`:

```bash
npm install --save-dev @testing-library/svelte jsdom
```

```ts
{
	extends: './vite.config.ts',
	test: {
		name: 'client',
		environment: 'jsdom',
		include: ['src/**/*.svelte.test.ts']
	}
}
```

Render representative page data with `@testing-library/svelte` and assert type selection, hidden controls without one type, exact/contains controls, facet links, numeric exact/min/max inputs, canonical query names, clearing type-dependent parameters, Type column, and `Untyped` labels.

- [ ] **Step 5: Implement accessible Bootstrap controls**

Use one GET form, labels tied to every select/input, property IDs in names, and links/buttons that preserve unrelated search/archive parameters. Choosing a facet writes an exact filter. Clearing the type removes all `meta[...]` parameters.

- [ ] **Step 6: Run dashboard and full verification**

```bash
npm run test:unit -- --run src/routes/page.server.test.ts src/routes/page.svelte.test.ts src/routes/layout.server.test.ts
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit dashboard behavior**

```bash
git add package.json package-lock.json vite.config.ts src/routes/+page.server.ts src/routes/+page.svelte src/routes/page.server.test.ts src/routes/page.svelte.test.ts src/routes/layout.server.test.ts
git commit -m "feat: add dashboard metadata filters"
```

### Task 8: API documentation and acceptance verification

**Files:**
- Modify: `src/lib/server/api-docs.ts`
- Modify: `src/lib/server/api-docs.test.ts`
- Modify: `README.md`
- Create: `src/lib/server/inventory-types.acceptance.test.ts`

**Interfaces:**
- Documents every public request, response, filter syntax, structured error, optimistic-concurrency field, and legacy behavior implemented in Tasks 1–7.
- Acceptance test uses only public service/route contracts, not private normalization helpers.

- [ ] **Step 1: Write failing OpenAPI contract tests**

Assert paths for `/types`, `/types/{id}`, `/parts/{id}`, and `/inventory/facets`; required `inventoryTypeId` on part creation; `updatedAt` on mutations; stable property IDs; bracket filter examples; structured error schema; and typed part response fields.

- [ ] **Step 2: Run documentation tests and confirm failure**

Run: `npm run test:unit -- --run src/lib/server/api-docs.test.ts`

Expected: FAIL because the new contracts are absent.

- [ ] **Step 3: Update generated API documentation and README examples**

Document create/read/replace/delete types, typed creation, partial editing with whole-object metadata replacement, filter and facet calls, grandfathered behavior, case canonicalization, one-sided ranges, and legacy untyped visibility. Remove statements that metadata is wholly free-form or optional for new typed parts.

- [ ] **Step 4: Write the end-to-end acceptance test**

Against a migrated local D1 database: preserve a pre-migration untyped part; create `Belt`; reject invalid metadata; create a valid typed part; tighten the type; confirm the part remains visible; reject an unrelated partial edit while nonconforming; repair it; exercise text facet and numeric range filtering; reject type deletion while the part is active and archived.

- [ ] **Step 5: Run the complete verification suite**

```bash
npm test
npm run check
npm run build
git diff --check
```

Expected: all commands exit 0. Confirm the acceptance test records representative inventory/facet query timing without asserting a brittle wall-clock threshold.

- [ ] **Step 6: Review migration and working tree**

Run: `git status --short && git diff --stat HEAD~7..HEAD`

Expected: only intended feature, generated migration, test, UI, and documentation files are present; no production deployment or remote migration has occurred.

- [ ] **Step 7: Commit documentation and acceptance coverage**

```bash
git add README.md src/lib/server/api-docs.ts src/lib/server/api-docs.test.ts src/lib/server/inventory-types.acceptance.test.ts
git commit -m "docs: document inventory types and filters"
```

## Final Review Checklist

- [ ] Every product capability and approved design rule maps to at least one automated test above.
- [ ] Existing API-key, inventory transaction, archive, search, history, and dashboard tests still pass.
- [ ] Existing part metadata is unchanged by migration and legacy rows remain visible without a type filter.
- [ ] New part writes cannot bypass type assignment or current metadata validation.
- [ ] Type replacement and part editing cannot silently overwrite concurrent changes.
- [ ] All metadata SQL uses validated property definitions and bound paths/values.
- [ ] API and dashboard produce identical filter and facet semantics.
- [ ] No production migration, deployment, unrelated refactor, or dashboard write surface is included.
