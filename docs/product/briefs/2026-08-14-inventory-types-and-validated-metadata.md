# Inventory Types and Validated Metadata — Product Requirements Brief

**Status:** Approved  
**Date:** 2026-08-14

## 1. Why

Bionic Inventory currently stores part-specific attributes as free-form metadata. This permits incomplete or invalid part records and does not provide type-aware inventory filtering.

The feature will let users define inventory types such as “Belt,” specify required and optional properties for each type, validate parts against those definitions, and filter inventory using the selected type’s properties in a McMaster-Carr-style experience.

## 2. Actors

- **ACT-1 — API writer:** A user with write access who manages inventory types and creates or edits parts.
- **ACT-2 — API reader:** A user with read access who retrieves types, parts, and filtered inventory.
- **ACT-3 — Dashboard user:** A user who browses parts, inventory types, and type-specific filters through the read-only dashboard.

## 3. Goals

- **GOAL-1:** API writers can define reusable inventory types and their metadata requirements.
- **GOAL-2:** Newly created and edited parts contain valid metadata for their assigned type.
- **GOAL-3:** API readers and dashboard users can narrow inventory using filters appropriate to one selected type.
- **GOAL-4:** Existing parts remain available without making historical-data migration part of this feature.
- **GOAL-5:** The first release is successful when users can create part types and filter parts using metadata fields that change according to the selected type.

## 4. Capabilities

- **CAP-1:** Create, view, edit, and delete inventory types through the API.
- **CAP-2:** Define text or numeric properties for an inventory type.
- **CAP-3:** Mark each defined property as required or optional.
- **CAP-4:** Define inclusive minimum and maximum limits for numeric properties.
- **CAP-5:** Assign an inventory type when creating a part.
- **CAP-6:** Edit a part’s inventory type and metadata.
- **CAP-7:** Validate new and edited parts against the current definition of their assigned type.
- **CAP-8:** List inventory types and their definitions through the read API and read-only dashboard.
- **CAP-9:** Filter parts by exactly one selected inventory type and its defined metadata properties.
- **CAP-10:** Offer exact, partial-text, and currently-present-value filtering for text properties.
- **CAP-11:** Offer exact-value and range filtering for numeric properties.

## 5. User Stories

- **US-1:** As an API writer, I want to define a “Belt” type with properties such as width, tooth count, and tooth pitch so belt records follow consistent requirements.
- **US-2:** As an API writer, I want invalid part submissions rejected so incomplete or incorrectly typed metadata does not enter the catalog.
- **US-3:** As an API writer, I want to revise a type’s definition as inventory requirements evolve.
- **US-4:** As an API writer, I want to update a part’s inventory type or metadata while preserving validation.
- **US-5:** As an API reader, I want to inspect available types and their definitions so API clients can construct valid requests and filters.
- **US-6:** As a dashboard user, I want to select a type and see relevant filters so I can find suitable parts efficiently.
- **US-7:** As an inventory user, I want existing parts to remain visible in the all-parts list even though migrating them is outside this feature.

## 6. Behaviors

- **BEH-1:** Creating a part without an inventory type is rejected.
- **BEH-2:** Creating or editing a part is rejected when a required property is absent.
- **BEH-3:** A required text property containing only whitespace is treated as missing.
- **BEH-4:** A property whose value does not match its defined text or numeric kind is rejected.
- **BEH-5:** Numeric values outside an applicable inclusive minimum or maximum are rejected.
- **BEH-6:** Metadata may contain additional properties not defined by the selected type.
- **BEH-7:** Changes to a type definition do not automatically modify or reject existing parts.
- **BEH-8:** A previously valid part may become nonconforming after its type definition changes, but remains stored and visible.
- **BEH-9:** Editing a nonconforming part requires the resulting record to satisfy the type’s current definition.
- **BEH-10:** Attempting to delete a type assigned to any part fails.
- **BEH-11:** Selecting one inventory type exposes filters for that type’s defined properties.
- **BEH-12:** Type-specific metadata filters are unavailable until exactly one type is selected.
- **BEH-13:** Multiple metadata filters use AND behavior; a displayed part must satisfy every applied filter.
- **BEH-14:** Exact and partial text matching ignore letter casing.
- **BEH-15:** A text property can be filtered by exact value, partial text, or a selectable value currently present among applicable parts.
- **BEH-16:** A numeric property can be filtered by an exact value or an inclusive minimum-and-maximum range.
- **BEH-17:** Type-specific filtering is available through both the read API and dashboard.
- **BEH-18:** The dashboard displays each part’s inventory type and provides a list of inventory types.
- **BEH-19:** Existing untyped parts appear in the unfiltered all-parts list but do not appear under a selected type unless they have been assigned that type.

## 7. Business Rules

- **BR-1:** Anyone with write API access may create, edit, or delete inventory types.
- **BR-2:** Users with read API access may list inventory types and view their property definitions.
- **BR-3:** Inventory-type names are unique without regard to letter casing.
- **BR-4:** Property names are unique within a type without regard to letter casing.
- **BR-5:** Every newly created part must have one inventory type.
- **BR-6:** A type property supports either text or numeric values.
- **BR-7:** Numeric values may be whole numbers or decimals.
- **BR-8:** Numeric minimum and maximum limits are optional and inclusive; a property may have either limit or both.
- **BR-9:** Defined properties may be required or optional.
- **BR-10:** Additional, undefined metadata properties are permitted.
- **BR-11:** Only properties defined by the selected inventory type are exposed as type-specific filters.
- **BR-12:** Inventory types assigned to existing parts cannot be deleted.
- **BR-13:** Type and part management remains API-only for the MVP; the dashboard remains read-only.

## 8. States

### Inventory type states

- **STATE-T1 — Unreferenced:** The type exists but is not assigned to any part. It may be viewed, edited, or deleted.
- **STATE-T2 — Referenced:** At least one part uses the type. It may be viewed or edited, but deletion must fail.
- **STATE-T3 — Deleted:** The formerly unreferenced type is no longer available for assignment or filtering.

### Part states

- **STATE-P1 — Typed and conforming:** The part satisfies the current definition of its assigned type.
- **STATE-P2 — Typed and grandfathered nonconforming:** A later type-definition change caused the existing part to stop conforming. It remains visible but must conform before an edit is accepted.
- **STATE-P3 — Legacy untyped:** A pre-feature part has no type. It remains visible in the all-parts list until handled outside this feature.

## 9. Edge Cases

- **EDGE-1:** Reject type names that differ from an existing name only by casing.
- **EDGE-2:** Reject duplicate property names within one type when they differ only by casing.
- **EDGE-3:** Reject invalid numeric limits where the minimum exceeds the maximum.
- **EDGE-4:** Accept numeric values equal to the configured minimum or maximum.
- **EDGE-5:** Treat an absent optional property as valid.
- **EDGE-6:** Treat an absent, empty, or whitespace-only required text property as invalid.
- **EDGE-7:** Preserve existing parts when a property becomes required or receives tighter limits.
- **EDGE-8:** Require full current validation when changing a part from one type to another.
- **EDGE-9:** Exclude parts missing a filtered optional property when they cannot satisfy the applied filter.
- **EDGE-10:** Reject filtering against a metadata property not defined by the selected type.
- **EDGE-11:** Reject type-specific metadata filters when no single inventory type has been selected.
- **EDGE-12:** Reject deletion of any type still referenced by a part.

## 10. Scope

### Included

- Inventory-type lifecycle through the API.
- Text and numeric property definitions.
- Required and optional properties.
- Inclusive numeric minimum and maximum validation.
- Mandatory type assignment for newly created parts.
- Part type and metadata editing.
- Validation during part creation and editing.
- Read API access to types and definitions.
- Dashboard display of part types and the inventory-type list.
- Dynamic type-specific filtering in the API and dashboard.
- Exact, partial, selectable-value, and numeric-range filters.

### Excluded

- Migration or automatic classification of existing parts.
- Dashboard forms for creating or editing types or parts.
- Automatic changes to existing parts after a type definition changes.
- Changes to inventory quantity transactions.
- Validation of additional metadata properties that are not defined by the assigned type.

## 11. Assumptions

No unconfirmed assumptions are included.

## 12. Open Questions

No product questions are currently deferred.

## 13. MVP Boundary

The MVP provides API-managed inventory types, validated typed part creation and editing, type visibility, and dynamic type-specific filtering through both the API and read-only dashboard.

Historical-data migration and write-capable dashboard interfaces remain outside the MVP.

## 14. Handoff Note

Use this approved brief as product input for `superpowers:brainstorming`. Determine the technical design separately before implementation planning or code changes.
