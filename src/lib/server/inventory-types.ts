import { asc, eq, inArray } from 'drizzle-orm';
import { getDb } from './db';
import { inventoryTypeProperties, inventoryTypes, parts } from './db/schema';
import { InventoryRouteError } from './inventory-errors';

export type InventoryPropertyKind = 'text' | 'numeric';

export interface InventoryTypePropertyInput {
	id?: string;
	name: string;
	kind: InventoryPropertyKind;
	required: boolean;
	minimum?: number | null;
	maximum?: number | null;
}

export interface InventoryTypeDefinitionInput {
	name: string;
	properties: InventoryTypePropertyInput[];
	updatedAt?: string;
}

export interface NormalizedInventoryTypeProperty {
	id?: string;
	name: string;
	normalizedName: string;
	kind: InventoryPropertyKind;
	required: boolean;
	minimum: number | null;
	maximum: number | null;
}

export interface NormalizedInventoryTypeDefinition {
	name: string;
	normalizedName: string;
	properties: NormalizedInventoryTypeProperty[];
	updatedAt?: string;
}

export interface InventoryTypeProperty {
	id: string;
	inventoryTypeId: string;
	name: string;
	normalizedName: string;
	kind: InventoryPropertyKind;
	required: boolean;
	minimum: number | null;
	maximum: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface InventoryTypeDefinition {
	id: string;
	name: string;
	normalizedName: string;
	createdAt: string;
	updatedAt: string;
	properties: InventoryTypeProperty[];
}

export function normalizeTypeDefinition(payload: unknown): NormalizedInventoryTypeDefinition {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'Inventory type payload must be a JSON object.',
			400
		);
	}

	const name = normalizeRequiredString(payload.name, 'name');
	if (!Array.isArray(payload.properties)) {
		throw new InventoryRouteError('INVALID_REQUEST', 'properties must be an array.', 400, 'properties');
	}

	const seenNames = new Set<string>();
	const seenIds = new Set<string>();
	const properties = payload.properties.map((value, index): NormalizedInventoryTypeProperty => {
		const field = `properties[${index}]`;
		if (!isPlainObject(value)) {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				`${field} must be a JSON object.`,
				400,
				field
			);
		}

		const propertyName = normalizeRequiredString(value.name, `${field}.name`);
		const normalizedName = normalizeName(propertyName);
		if (seenNames.has(normalizedName)) {
			throw new InventoryRouteError(
				'DUPLICATE_PROPERTY_NAME',
				`Property names must be unique without regard to casing.`,
				400,
				`${field}.name`
			);
		}
		seenNames.add(normalizedName);

		let id: string | undefined;
		if (Object.hasOwn(value, 'id')) {
			id = normalizeRequiredString(value.id, `${field}.id`);
			if (seenIds.has(id)) {
				throw new InventoryRouteError(
					'INVALID_REQUEST',
					'Each property ID may appear only once.',
					400,
					`${field}.id`
				);
			}
			seenIds.add(id);
		}

		if (value.kind !== 'text' && value.kind !== 'numeric') {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				`${field}.kind must be text or numeric.`,
				400,
				`${field}.kind`
			);
		}
		if (typeof value.required !== 'boolean') {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				`${field}.required must be a boolean.`,
				400,
				`${field}.required`
			);
		}

		const minimum = normalizeBound(value.minimum, `${field}.minimum`);
		const maximum = normalizeBound(value.maximum, `${field}.maximum`);
		if (
			(value.kind === 'text' && (minimum !== null || maximum !== null)) ||
			(minimum !== null && maximum !== null && minimum > maximum)
		) {
			throw new InventoryRouteError(
				'INVALID_PROPERTY_BOUNDS',
				'Text properties cannot have bounds, and numeric minimum cannot exceed maximum.',
				400,
				field
			);
		}

		return {
			...(id ? { id } : {}),
			name: propertyName,
			normalizedName,
			kind: value.kind,
			required: value.required,
			minimum,
			maximum
		};
	});

	let updatedAt: string | undefined;
	if (payload.updatedAt != null) {
		updatedAt = normalizeRequiredString(payload.updatedAt, 'updatedAt');
		if (Number.isNaN(Date.parse(updatedAt))) {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				'updatedAt must be an ISO-8601 timestamp.',
				400,
				'updatedAt'
			);
		}
	}

	return {
		name,
		normalizedName: normalizeName(name),
		properties,
		...(updatedAt ? { updatedAt } : {})
	};
}

export async function listInventoryTypes(d1: D1Database): Promise<InventoryTypeDefinition[]> {
	const db = getDb(d1);
	const typeRows = await db
		.select({
			id: inventoryTypes.id,
			name: inventoryTypes.name,
			normalizedName: inventoryTypes.normalizedName,
			createdAt: inventoryTypes.createdAt,
			updatedAt: inventoryTypes.updatedAt
		})
		.from(inventoryTypes)
		.orderBy(asc(inventoryTypes.name));

	if (typeRows.length === 0) {
		return [];
	}

	const propertyRows = await selectProperties(d1, typeRows.map((row) => row.id));
	return typeRows.map((row) => ({
		...row,
		properties: propertyRows.filter((property) => property.inventoryTypeId === row.id)
	}));
}

export async function getInventoryType(
	d1: D1Database,
	id: string
): Promise<InventoryTypeDefinition | null> {
	const db = getDb(d1);
	const [typeRow] = await db
		.select({
			id: inventoryTypes.id,
			name: inventoryTypes.name,
			normalizedName: inventoryTypes.normalizedName,
			createdAt: inventoryTypes.createdAt,
			updatedAt: inventoryTypes.updatedAt
		})
		.from(inventoryTypes)
		.where(eq(inventoryTypes.id, id))
		.limit(1);

	if (!typeRow) {
		return null;
	}

	return {
		...typeRow,
		properties: await selectProperties(d1, [id])
	};
}

export async function createInventoryType(
	d1: D1Database,
	payload: unknown
): Promise<InventoryTypeDefinition> {
	const definition = normalizeTypeDefinition(payload);
	const id = crypto.randomUUID();
	const timestamp = new Date().toISOString();
	const properties = definition.properties.map((property) => ({
		...property,
		id: crypto.randomUUID(),
		inventoryTypeId: id,
		createdAt: timestamp,
		updatedAt: timestamp
	}));
	const statements = [
		d1
			.prepare(
				'INSERT INTO inventory_types (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(id, definition.name, definition.normalizedName, timestamp, timestamp),
		...properties.map((property) =>
			d1
				.prepare(
					'INSERT INTO inventory_type_properties (id, inventory_type_id, name, normalized_name, kind, required, minimum, maximum, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(
					property.id,
					id,
					property.name,
					property.normalizedName,
					property.kind,
					property.required ? 1 : 0,
					property.minimum,
					property.maximum,
					timestamp,
					timestamp
				)
		)
	];

	try {
		await d1.batch(statements);
	} catch (cause) {
		throw translateDefinitionConstraint(cause);
	}

	return {
		id,
		name: definition.name,
		normalizedName: definition.normalizedName,
		createdAt: timestamp,
		updatedAt: timestamp,
		properties
	};
}

export async function replaceInventoryType(
	d1: D1Database,
	id: string,
	payload: unknown
): Promise<InventoryTypeDefinition> {
	const definition = normalizeTypeDefinition(payload);
	if (!definition.updatedAt) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'updatedAt is required when replacing an inventory type.',
			400,
			'updatedAt'
		);
	}

	const existing = await getInventoryType(d1, id);
	if (!existing) {
		throw typeNotFound();
	}
	if (existing.updatedAt !== definition.updatedAt) {
		throw typeUpdateConflict();
	}

	const existingById = new Map(existing.properties.map((property) => [property.id, property]));
	const retainedIds = new Set<string>();
	for (const property of definition.properties) {
		if (!property.id) continue;
		const stored = existingById.get(property.id);
		if (!stored) {
			throw new InventoryRouteError(
				'PROPERTY_NOT_FOUND',
				'The supplied property ID does not belong to this inventory type.',
				404,
				'properties'
			);
		}
		if (stored.name !== property.name || stored.kind !== property.kind) {
			throw new InventoryRouteError(
				'IMMUTABLE_PROPERTY',
				'Retained property names and kinds cannot be changed; delete and add the property instead.',
				409,
				'properties'
			);
		}
		retainedIds.add(property.id);
	}

	const updatedAt = nextTimestamp(existing.updatedAt);
	const statements: D1PreparedStatement[] = [];
	for (const property of existing.properties) {
		if (!retainedIds.has(property.id)) {
			statements.push(
				d1
					.prepare(
						'DELETE FROM inventory_type_properties WHERE id = ? AND inventory_type_id = ? AND EXISTS (SELECT 1 FROM inventory_types WHERE id = ? AND updated_at = ?)'
					)
					.bind(property.id, id, id, definition.updatedAt)
			);
		}
	}

	const resultProperties: InventoryTypeProperty[] = [];
	for (const property of definition.properties) {
		if (property.id) {
			const stored = existingById.get(property.id)!;
			statements.push(
				d1
					.prepare(
						'UPDATE inventory_type_properties SET required = ?, minimum = ?, maximum = ?, updated_at = ? WHERE id = ? AND inventory_type_id = ? AND EXISTS (SELECT 1 FROM inventory_types WHERE id = ? AND updated_at = ?)'
					)
					.bind(
						property.required ? 1 : 0,
						property.minimum,
						property.maximum,
						updatedAt,
						property.id,
						id,
						id,
						definition.updatedAt
					)
			);
			resultProperties.push({
				...stored,
				required: property.required,
				minimum: property.minimum,
				maximum: property.maximum,
				updatedAt
			});
			continue;
		}

		const propertyId = crypto.randomUUID();
		statements.push(
			d1
				.prepare(
					'INSERT INTO inventory_type_properties (id, inventory_type_id, name, normalized_name, kind, required, minimum, maximum, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM inventory_types WHERE id = ? AND updated_at = ?)'
				)
				.bind(
					propertyId,
					id,
					property.name,
					property.normalizedName,
					property.kind,
					property.required ? 1 : 0,
					property.minimum,
					property.maximum,
					updatedAt,
					updatedAt,
					id,
					definition.updatedAt
				)
		);
		resultProperties.push({
			...property,
			id: propertyId,
			inventoryTypeId: id,
			createdAt: updatedAt,
			updatedAt
		});
	}

	statements.push(
		d1
			.prepare(
				'UPDATE inventory_types SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ? AND updated_at = ?'
			)
			.bind(definition.name, definition.normalizedName, updatedAt, id, definition.updatedAt)
	);

	let results: D1Result[];
	try {
		results = await d1.batch(statements);
	} catch (cause) {
		throw translateDefinitionConstraint(cause);
	}
	if (Number(results.at(-1)?.meta.changes ?? 0) === 0) {
		throw typeUpdateConflict();
	}

	return {
		id,
		name: definition.name,
		normalizedName: definition.normalizedName,
		createdAt: existing.createdAt,
		updatedAt,
		properties: resultProperties
	};
}

export async function deleteInventoryType(d1: D1Database, id: string): Promise<void> {
	const existing = await getInventoryType(d1, id);
	if (!existing) {
		throw typeNotFound();
	}

	const db = getDb(d1);
	const references = await db
		.select({ id: parts.id })
		.from(parts)
		.where(eq(parts.inventoryTypeId, id))
		.limit(1);
	if (references.length > 0) {
		throw typeInUse();
	}

	try {
		const result = await d1.prepare('DELETE FROM inventory_types WHERE id = ?').bind(id).run();
		if (Number(result.meta.changes ?? 0) === 0) {
			throw typeNotFound();
		}
	} catch (cause) {
		if (isForeignKeyError(cause)) {
			throw typeInUse();
		}
		throw cause;
	}
}

async function selectProperties(
	d1: D1Database,
	typeIds: string[]
): Promise<InventoryTypeProperty[]> {
	const db = getDb(d1);
	return db
		.select({
			id: inventoryTypeProperties.id,
			inventoryTypeId: inventoryTypeProperties.inventoryTypeId,
			name: inventoryTypeProperties.name,
			normalizedName: inventoryTypeProperties.normalizedName,
			kind: inventoryTypeProperties.kind,
			required: inventoryTypeProperties.required,
			minimum: inventoryTypeProperties.minimum,
			maximum: inventoryTypeProperties.maximum,
			createdAt: inventoryTypeProperties.createdAt,
			updatedAt: inventoryTypeProperties.updatedAt
		})
		.from(inventoryTypeProperties)
		.where(inArray(inventoryTypeProperties.inventoryTypeId, typeIds))
		.orderBy(asc(inventoryTypeProperties.name));
}

function translateDefinitionConstraint(cause: unknown): unknown {
	if (isTypeNameUniqueError(cause)) {
		return new InventoryRouteError(
			'DUPLICATE_TYPE_NAME',
			'An inventory type with that name already exists.',
			409,
			'name'
		);
	}
	if (isPropertyNameUniqueError(cause)) {
		return new InventoryRouteError(
			'DUPLICATE_PROPERTY_NAME',
			'Property names must be unique without regard to casing.',
			409,
			'properties'
		);
	}
	return cause;
}

function isTypeNameUniqueError(cause: unknown): boolean {
	return (
		cause instanceof Error &&
		/UNIQUE constraint failed: inventory_types\.normalized_name/i.test(cause.message)
	);
}

function isPropertyNameUniqueError(cause: unknown): boolean {
	return (
		cause instanceof Error &&
		/UNIQUE constraint failed: inventory_type_properties\.(inventory_type_id|normalized_name)/i.test(
			cause.message
		)
	);
}

function isForeignKeyError(cause: unknown): boolean {
	return cause instanceof Error && /FOREIGN KEY constraint failed/i.test(cause.message);
}

function typeNotFound(): InventoryRouteError {
	return new InventoryRouteError('TYPE_NOT_FOUND', 'Inventory type not found.', 404);
}

function typeUpdateConflict(): InventoryRouteError {
	return new InventoryRouteError(
		'TYPE_UPDATE_CONFLICT',
		'The inventory type changed after it was read.',
		409,
		'updatedAt'
	);
}

function typeInUse(): InventoryRouteError {
	return new InventoryRouteError(
		'TYPE_IN_USE',
		'Inventory types assigned to parts cannot be deleted.',
		409
	);
}

function nextTimestamp(previous: string): string {
	return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

function normalizeName(value: string): string {
	return value.toLocaleLowerCase();
}

function normalizeRequiredString(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			`${field} must be a non-empty string.`,
			400,
			field
		);
	}
	return value.trim();
}

function normalizeBound(value: unknown, field: string): number | null {
	if (value == null) {
		return null;
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new InventoryRouteError(
			'INVALID_PROPERTY_BOUNDS',
			`${field} must be a finite number or null.`,
			400,
			field
		);
	}
	return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
