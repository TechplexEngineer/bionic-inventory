import { getInventoryType } from './inventory-types';
import { InventoryRouteError } from './inventory-errors';
import { canonicalizeAndValidateMetadata } from './metadata-validation';

export interface InventoryPart {
	id: string;
	name: string;
	mfgPartNumber: string;
	description: string;
	metadata: Record<string, unknown>;
	inventoryTypeId: string | null;
	inventoryTypeName: string | null;
	quantity: number;
	archivedAt: string | null;
	updatedAt: string;
}

export interface PartInput {
	name: string;
	mfgPartNumber: string;
	description?: string;
	inventoryTypeId: string;
	metadata?: Record<string, unknown>;
}

export interface PartPatchInput {
	name?: string;
	mfgPartNumber?: string;
	description?: string;
	inventoryTypeId?: string;
	metadata?: Record<string, unknown>;
	updatedAt: string;
}

type StoredPart = Omit<InventoryPart, 'inventoryTypeName'>;

type PartRow = Omit<StoredPart, 'metadata'> & {
	metadata: Record<string, unknown> | string | null;
};

export function normalizePartInput(payload: unknown): Required<PartInput> {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Part payload must be a JSON object.', 400);
	}

	const metadata = Object.hasOwn(payload, 'metadata') ? payload.metadata : {};
	if (!isPlainObject(metadata)) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'metadata must be a JSON object.',
			400,
			'metadata'
		);
	}

	return {
		name: normalizeRequiredString(payload.name, 'name'),
		mfgPartNumber: normalizeRequiredString(payload.mfgPartNumber, 'mfgPartNumber'),
		description: normalizeDescription(payload.description),
		inventoryTypeId: normalizeRequiredString(payload.inventoryTypeId, 'inventoryTypeId'),
		metadata
	};
}

export async function createPart(d1: D1Database, payload: unknown): Promise<InventoryPart> {
	const input = normalizePartInput(payload);
	const inventoryType = await requireInventoryType(d1, input.inventoryTypeId);
	const metadata = canonicalizeAndValidateMetadata(input.metadata, inventoryType.properties);
	const id = crypto.randomUUID();
	const timestamp = new Date().toISOString();

	try {
		await d1
			.prepare(
				'INSERT INTO parts (id, name, mfg_part_number, description, metadata, inventory_type_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
			)
			.bind(
				id,
				input.name,
				input.mfgPartNumber,
				input.description,
				JSON.stringify(metadata),
				inventoryType.id,
				timestamp,
				timestamp
			)
			.run();
	} catch (cause) {
		throw translatePartWriteError(cause);
	}

	return {
		id,
		name: input.name,
		mfgPartNumber: input.mfgPartNumber,
		description: input.description,
		metadata,
		inventoryTypeId: inventoryType.id,
		inventoryTypeName: inventoryType.name,
		quantity: 0,
		archivedAt: null,
		updatedAt: timestamp
	};
}

export async function updatePart(
	d1: D1Database,
	id: string,
	payload: unknown
): Promise<InventoryPart> {
	const partId = normalizeRequiredString(id, 'id');
	const patch = normalizePartPatch(payload);
	const existing = await loadPart(d1, partId);
	if (!existing) {
		throw new InventoryRouteError('PART_NOT_FOUND', 'Part not found.', 404);
	}
	if (existing.updatedAt !== patch.updatedAt) {
		throw partUpdateConflict();
	}

	const inventoryTypeId = patch.inventoryTypeId ?? existing.inventoryTypeId;
	if (!inventoryTypeId) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'inventoryTypeId must be a non-empty string.',
			400,
			'inventoryTypeId'
		);
	}
	const inventoryType = await requireInventoryType(d1, inventoryTypeId);
	const metadata = canonicalizeAndValidateMetadata(
		patch.metadata ?? existing.metadata,
		inventoryType.properties
	);
	const updatedAt = nextTimestamp(existing.updatedAt);
	const updated: InventoryPart = {
		...existing,
		name: patch.name ?? existing.name,
		mfgPartNumber: patch.mfgPartNumber ?? existing.mfgPartNumber,
		description: patch.description ?? existing.description,
		metadata,
		inventoryTypeId: inventoryType.id,
		inventoryTypeName: inventoryType.name,
		updatedAt
	};

	let result: D1Result;
	try {
		result = await d1
			.prepare(
				'UPDATE parts SET name = ?, mfg_part_number = ?, description = ?, metadata = ?, inventory_type_id = ?, updated_at = ? WHERE id = ? AND updated_at = ?'
			)
			.bind(
				updated.name,
				updated.mfgPartNumber,
				updated.description,
				JSON.stringify(updated.metadata),
				updated.inventoryTypeId,
				updated.updatedAt,
				partId,
				patch.updatedAt
			)
			.run();
	} catch (cause) {
		throw translatePartWriteError(cause);
	}
	if (Number(result.meta.changes ?? 0) === 0) {
		throw partUpdateConflict();
	}

	return updated;
}

function normalizePartPatch(payload: unknown): PartPatchInput {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Part payload must be a JSON object.', 400);
	}

	const updatedAt = normalizeRequiredString(payload.updatedAt, 'updatedAt');
	if (Number.isNaN(Date.parse(updatedAt))) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'updatedAt must be an ISO-8601 timestamp.',
			400,
			'updatedAt'
		);
	}

	let metadata: Record<string, unknown> | undefined;
	if (Object.hasOwn(payload, 'metadata')) {
		if (!isPlainObject(payload.metadata)) {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				'metadata must be a JSON object.',
				400,
				'metadata'
			);
		}
		metadata = payload.metadata;
	}

	return {
		...(Object.hasOwn(payload, 'name')
			? { name: normalizeRequiredString(payload.name, 'name') }
			: {}),
		...(Object.hasOwn(payload, 'mfgPartNumber')
			? { mfgPartNumber: normalizeRequiredString(payload.mfgPartNumber, 'mfgPartNumber') }
			: {}),
		...(Object.hasOwn(payload, 'description')
			? { description: normalizeDescription(payload.description, true) }
			: {}),
		...(Object.hasOwn(payload, 'inventoryTypeId')
			? { inventoryTypeId: normalizeRequiredString(payload.inventoryTypeId, 'inventoryTypeId') }
			: {}),
		...(metadata ? { metadata } : {}),
		updatedAt
	};
}

async function requireInventoryType(d1: D1Database, id: string) {
	const inventoryType = await getInventoryType(d1, id);
	if (!inventoryType) {
		throw inventoryTypeNotFound();
	}
	return inventoryType;
}

async function loadPart(d1: D1Database, id: string): Promise<StoredPart | null> {
	const row = await d1
		.prepare(
			`SELECT
				p.id,
				p.name,
				p.mfg_part_number AS mfgPartNumber,
				p.description,
				p.metadata,
				p.inventory_type_id AS inventoryTypeId,
				p.archived_at AS archivedAt,
				p.updated_at AS updatedAt,
				COALESCE(SUM(ic.quantity_delta), 0) AS quantity
			FROM parts p
			LEFT JOIN inventory_changes ic ON ic.part_id = p.id
			WHERE p.id = ?
			GROUP BY p.id, p.name, p.mfg_part_number, p.description, p.metadata,
				p.inventory_type_id, p.archived_at, p.updated_at`
		)
		.bind(id)
		.first<PartRow>();

	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		mfgPartNumber: row.mfgPartNumber,
		description: row.description,
		metadata: parseMetadata(row.metadata),
		inventoryTypeId: row.inventoryTypeId,
		quantity: Number(row.quantity),
		archivedAt: row.archivedAt ?? null,
		updatedAt: row.updatedAt
	};
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

function normalizeDescription(value: unknown, present = false): string {
	if (value == null && !present) return '';
	if (typeof value !== 'string') {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'description must be a string.',
			400,
			'description'
		);
	}
	return value.trim();
}

function parseMetadata(value: Record<string, unknown> | string | null): Record<string, unknown> {
	if (typeof value === 'string') {
		try {
			const parsed: unknown = JSON.parse(value);
			return isPlainObject(parsed) ? parsed : {};
		} catch {
			return {};
		}
	}
	return isPlainObject(value) ? value : {};
}

function translatePartWriteError(cause: unknown): unknown {
	if (cause instanceof Error && /FOREIGN KEY constraint failed/i.test(cause.message)) {
		return inventoryTypeNotFound();
	}
	if (cause instanceof Error && /UNIQUE constraint failed: parts\.mfg_part_number/i.test(cause.message)) {
		return new InventoryRouteError(
			'INVALID_REQUEST',
			'A part with that manufacturer part number already exists.',
			409,
			'mfgPartNumber'
		);
	}
	return cause;
}

function inventoryTypeNotFound(): InventoryRouteError {
	return new InventoryRouteError(
		'TYPE_NOT_FOUND',
		'Inventory type not found.',
		404,
		'inventoryTypeId'
	);
}

function partUpdateConflict(): InventoryRouteError {
	return new InventoryRouteError(
		'PART_UPDATE_CONFLICT',
		'The part changed after it was read.',
		409,
		'updatedAt'
	);
}

function nextTimestamp(previous: string): string {
	return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
