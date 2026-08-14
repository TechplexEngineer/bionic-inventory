# Inventory Types and Validated Metadata Design

## Goal

Implement the approved inventory-types product brief with API-managed type definitions, validated typed part writes, and type-aware API and dashboard filtering. Existing parts remain readable as legacy untyped records, and existing metadata remains stored without migration.

## Scope and Constraints

This design adds inventory-type CRUD, text and numeric property definitions, required and optional validation, inclusive numeric constraints, partial part editing, and faceted metadata filtering. Type and part management remain API-only. The dashboard remains a read surface.

Historical part classification, automatic metadata migration, validation of undefined metadata, metadata indexing, and changes to quantity transactions are outside this implementation. Archived parts continue to reference their types and therefore prevent those types from being deleted.

## Architecture

Type definitions use normalized relational tables while part values remain in the existing JSON metadata column. This preserves compatibility with existing records and undefined metadata while giving type and property definitions stable identities and enforceable constraints.

The implementation separates four responsibilities:

- type-definition normalization, validation, and lifecycle;
- part-metadata canonicalization and validation;
- inventory filter parsing and query construction;
- persistence plus route-level authorization and error mapping.

The dashboard and public API use the same domain query functions so their filtering behavior cannot diverge.

## Data Model

### Inventory types

An `inventory_types` table stores:

- stable UUID `id`;
- canonical display `name`;
- normalized name used for case-insensitive uniqueness;
- `created_at` and `updated_at` timestamps.

The normalized name is derived by the server and protected by a unique index. It is not a separately editable API field.

### Property definitions

An `inventory_type_properties` table stores:

- stable UUID `id`;
- parent `inventory_type_id` with a foreign key;
- canonical display `name`;
- normalized name used for case-insensitive uniqueness within the parent type;
- `kind`, constrained to `text` or `numeric`;
- `required` as a boolean value;
- nullable numeric `minimum` and `maximum` bounds;
- `created_at` and `updated_at` timestamps.

A unique index on the parent type and normalized name enforces property-name uniqueness. Text properties cannot carry numeric bounds. Numeric bounds must be finite, and a minimum cannot exceed a maximum.

Property name and kind are immutable after creation. Renaming a property or changing its kind is an explicit delete-and-add operation. Required status and numeric limits are editable.

### Parts

The existing `parts` table gains nullable `inventory_type_id` with a foreign key to `inventory_types`. The column remains nullable at the database level so migrated rows become legacy untyped parts without data rewriting. The part-creation API requires a valid type for every new record.

Part metadata remains a JSON object keyed by property name. Undefined metadata fields remain permitted and are not validated by a type definition.

## Type Lifecycle

Creating a type accepts its name and complete property definition. Updating a type atomically replaces its name and complete property definition.

Existing properties in an update carry their stable IDs. A retained property ID must preserve its name and kind, though its required status or numeric bounds may change. Omitting an existing ID deletes that definition. An entry without an ID creates a property. IDs belonging to another type or no existing property are rejected.

The server validates the complete proposed definition before writing. The type row and all property additions, edits, and deletions commit atomically, so clients never observe a partial definition.

Changing a definition does not inspect, rewrite, or reject stored parts. A part that no longer conforms becomes grandfathered and remains readable. Its next edit must produce a fully conforming record.

A type can be deleted only when no part references it. Archived parts count as references. An application-level reference check produces a useful conflict response, while the database foreign key is the final safeguard against races.

## Metadata Canonicalization and Validation

Every part create or edit loads the selected type and its current properties. Validation operates on the complete resulting record.

Defined metadata keys match property names case-insensitively. The server rewrites each matching key to the canonical spelling stored in the definition before persistence. For example, submitted `WIDTH` becomes `Width` when the definition uses `Width`. If multiple submitted keys collapse to one canonical name, such as `Width` and `width`, the request is rejected rather than choosing a value.

Undefined extra keys have no canonical spelling and remain exactly as submitted.

Validation then enforces:

- every required property is present;
- required text is not empty or whitespace-only;
- text values are JSON strings;
- numeric values are finite JSON numbers, including integers and decimals;
- numeric minimum and maximum constraints are inclusive;
- optional properties may be absent, but any supplied value must have the correct kind and satisfy its constraints.

Changing a part's type validates all metadata against the destination type after canonicalization. Old defined fields that are not part of the destination definition remain permitted extra metadata.

Part edits use partial-update semantics. The server merges the submitted fields with the stored part, canonicalizes and validates the complete result, then persists it. Consequently, any edit to a grandfathered nonconforming part fails unless the resulting record satisfies the current type definition.

## API Design

### Inventory types

- `GET /api/types` lists inventory types and their property definitions.
- `POST /api/types` creates a type and its complete property definition.
- `GET /api/types/:id` returns one type and its definition.
- `PUT /api/types/:id` atomically replaces the type name and complete definition.
- `DELETE /api/types/:id` deletes an unreferenced type.

Read access accepts consumer or producer credentials. Mutation requires producer credentials, following the existing role model.

Responses expose type and property IDs, canonical names, property kinds, required flags, numeric constraints, and timestamps. Clients use `updatedAt` as the optimistic-concurrency precondition for type replacement.

### Parts

`POST /api/parts` adds required `inventoryTypeId` and validates metadata. A new `PATCH /api/parts/:id` endpoint accepts partial changes to name, manufacturer part number, description, inventory type, and metadata. The patch includes the previously read `updatedAt` value as its concurrency precondition.

When `metadata` is present in a patch, it replaces the metadata object rather than recursively merging individual keys. Other omitted fields retain their stored values. This makes deletion of metadata keys explicit and avoids ambiguous deep-merge behavior.

The existing archive/unarchive API remains available for compatibility. Archiving does not bypass type validation rules for ordinary part edits and does not remove a type reference.

### Inventory filters

`GET /api/inventory` retains its existing search, manufacturer-number, ID, and archive parameters and adds `typeId=<type-id>`.

Metadata filters use stable property IDs:

- `meta[<property-id>][exact]=<value>` for text or numeric equality;
- `meta[<property-id>][contains]=<value>` for case-insensitive text containment;
- `meta[<property-id>][min]=<number>` for an inclusive numeric lower bound;
- `meta[<property-id>][max]=<number>` for an inclusive numeric upper bound.

Numeric ranges may contain either bound or both. All active metadata filters combine with AND. A part missing an optional filtered property does not match that filter.

Metadata filters require exactly one valid `typeId`. The server rejects properties outside the selected type, operators incompatible with the property kind, conflicting operators, repeated scalar parameters, non-finite numeric input, and a request whose minimum exceeds its maximum. Text comparisons ignore letter casing.

The server parses query parameters into one validated filter model before generating SQL. Dynamic JSON access is confined to the query layer, and user-supplied names or values are bound rather than interpolated into SQL.

## Faceted Values

`GET /api/inventory/facets` accepts the same search, archive, type, and metadata-filter parameters as the inventory endpoint. It returns distinct currently present values for text properties of the selected type.

Each property's facet query applies:

- the selected type;
- current full-text search;
- current archive visibility;
- existing non-metadata inventory filters;
- every other active metadata filter.

It omits only that property's own filter. This lets users see alternative values without losing the effect of the rest of the query. Facet values use the stored canonical property key, exclude missing and non-text values, collapse values case-insensitively, and return a deterministic display spelling and ordering.

Selecting a faceted value is equivalent to applying that property's exact text filter. Facets remain a separate endpoint so inventory responses stay compact and dashboard requests can refresh them independently.

## Dashboard

The server-rendered dashboard adds an inventory-type selector. Metadata controls are hidden until exactly one type is selected. Selecting a type loads its definition and renders:

- an exact/contains mode and text input for text properties;
- currently available faceted values for text properties;
- exact, minimum, and maximum inputs for numeric properties.

Active state is encoded in URL query parameters so a filtered view survives refresh and can be shared. Clearing the type also removes its metadata filters. Search, archive visibility, and metadata filters compose through the shared inventory query model.

The inventory table adds a Type column. Legacy records display `Untyped` in an unfiltered list and never appear when a type is selected. The type selector serves as the dashboard's required inventory-type list; no write-capable type or part management UI is added.

## Consistency and Errors

Expected client errors use structured JSON containing a stable error code, a human-readable message, and a field path when applicable.

- `400` covers malformed payloads and filters, missing required metadata, type mismatches, constraint failures, and canonical-key collisions.
- `404` covers unknown type, property, or part IDs.
- `409` covers normalized-name conflicts, immutable property edits, stale `updatedAt` preconditions, and referenced-type deletion.
- Existing `401` and `403` API-key behavior remains unchanged.
- `500` is reserved for unexpected application or storage failures.

Type-definition writes are atomic. Type and part edits use optimistic concurrency: the client supplies the last observed `updatedAt`, and the update succeeds only if it still matches. A mismatch returns `409` without overwriting newer data.

Unexpected failures are logged server-side without exposing SQL or internal details. Dashboard failures retain the URL state and show a general corrective or retry message.

## Testing

Domain tests cover:

- normalized type and property name uniqueness;
- property ID ownership and immutable names and kinds;
- delete-and-add behavior and numeric definition limits;
- canonical metadata keys and collision rejection;
- required, optional, whitespace, kind, finite-number, and inclusive-bound validation;
- preservation of undefined metadata;
- partial part updates, metadata replacement, type changes, and grandfathered records.

Query tests cover:

- exact and case-insensitive partial text filters;
- numeric equality and one-sided or two-sided ranges;
- AND composition and missing optional values;
- invalid type, property, operator, duplicate, and numeric parameters;
- legacy untyped and archived visibility;
- composition with existing full-text and inventory filters;
- faceted results with the current property's filter omitted and all others retained.

Route and persistence tests cover authorization, structured errors, atomic type replacement, optimistic concurrency, foreign-key deletion protection, and documented response contracts.

Migration tests prove that existing parts and metadata remain unchanged with a null type reference. Dashboard tests cover dynamic controls, URL persistence, clearing behavior, type labels, facets, empty results, error display, and accessible form labels.

An end-to-end acceptance path creates a type, rejects invalid parts, creates a conforming part, changes the definition, observes grandfathered visibility, edits the part back into conformance, filters it through the API and dashboard, and verifies that the referenced type cannot be deleted.

## Performance Boundary

The MVP queries metadata through SQLite JSON functions and introduces no per-property value index. Representative seeded tests establish baseline inventory and facet-query behavior. The filtering implementation remains isolated so an indexed value table can replace JSON querying later without changing public contracts.

If representative data shows that inventory or facet queries cannot meet the project's normal interactive response expectations, indexing metadata values becomes a separate design decision rather than an unplanned expansion of this feature.

## Delivery Boundary

Implementation includes schema migrations, domain services, API routes and documentation, dashboard filtering, and automated verification. It does not deploy migrations or application code to production unless separately requested.
