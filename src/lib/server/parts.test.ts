import { describe, expect, it } from 'vitest';
import { createPart, updatePart } from './parts';

type TypeRow = {
	id: string;
	name: string;
	normalizedName: string;
	createdAt: string;
	updatedAt: string;
};

type PropertyRow = {
	id: string;
	inventoryTypeId: string;
	name: string;
	normalizedName: string;
	kind: 'text' | 'numeric';
	required: boolean;
	minimum: number | null;
	maximum: number | null;
	createdAt: string;
	updatedAt: string;
};

type PartRow = {
	id: string;
	name: string;
	mfgPartNumber: string;
	description: string;
	metadata: Record<string, unknown> | string;
	inventoryTypeId: string | null;
	archivedAt: string | null;
	updatedAt: string;
	quantity: number;
};

type RecordedStatement = { sql: string; params: unknown[] };

function d1Result(changes = 0) {
	return {
		success: true,
		meta: {
			changed_db: changes > 0,
			changes,
			duration: 0,
			last_row_id: 0,
			rows_read: 0,
			rows_written: changes,
			size_after: 0
		},
		results: []
	};
}

function createD1Double(options: {
	types?: TypeRow[];
	properties?: PropertyRow[];
	parts?: PartRow[];
	updateChanges?: number;
	writeError?: Error;
} = {}) {
	const types = options.types ?? [];
	const properties = options.properties ?? [];
	const partRows = options.parts ?? [];
	const writes: RecordedStatement[] = [];

	const prepare = (statementSql: string) => {
		let params: unknown[] = [];
		const statement = {
			bind: (...boundParams: unknown[]) => {
				params = boundParams;
				return statement;
			},
			raw: async () => {
				if (/from [`"]inventory_types[`"]/.test(statementSql)) {
					return types
						.filter((row) => row.id === params[0])
						.map((row) => [row.id, row.name, row.normalizedName, row.createdAt, row.updatedAt]);
				}
				if (/from [`"]inventory_type_properties[`"]/.test(statementSql)) {
					return properties
						.filter((row) => params.includes(row.inventoryTypeId))
						.map((row) => [
							row.id,
							row.inventoryTypeId,
							row.name,
							row.normalizedName,
							row.kind,
							row.required ? 1 : 0,
							row.minimum,
							row.maximum,
							row.createdAt,
							row.updatedAt
						]);
				}
				return [];
			},
			first: async () => {
				if (!/from parts/i.test(statementSql)) return null;
				return partRows.find((row) => row.id === params[0]) ?? null;
			},
			run: async () => {
				writes.push({ sql: statementSql, params: [...params] });
				if (options.writeError) throw options.writeError;
				return d1Result(/update parts/i.test(statementSql) ? (options.updateChanges ?? 1) : 1);
			},
			all: async () => d1Result()
		};
		return statement;
	};

	return {
		writes,
		d1: {
			prepare,
			batch: async () => [],
			exec: async () => d1Result(),
			dump: async () => new ArrayBuffer(0)
		} as unknown as D1Database
	};
}

const beltType: TypeRow = {
	id: 'type-belt',
	name: 'Belt',
	normalizedName: 'belt',
	createdAt: '2026-08-14T10:00:00.000Z',
	updatedAt: '2026-08-14T11:00:00.000Z'
};

const pulleyType: TypeRow = {
	...beltType,
	id: 'type-pulley',
	name: 'Pulley',
	normalizedName: 'pulley'
};

const widthProperty: PropertyRow = {
	id: 'property-width',
	inventoryTypeId: beltType.id,
	name: 'Width',
	normalizedName: 'width',
	kind: 'numeric',
	required: true,
	minimum: 1,
	maximum: 20,
	createdAt: beltType.createdAt,
	updatedAt: beltType.updatedAt
};

const materialProperty: PropertyRow = {
	...widthProperty,
	id: 'property-material',
	inventoryTypeId: pulleyType.id,
	name: 'Material',
	normalizedName: 'material',
	kind: 'text',
	minimum: null,
	maximum: null
};

const storedPart: PartRow = {
	id: 'part-1',
	name: 'Timing Belt',
	mfgPartNumber: 'GT2-120',
	description: 'Original description',
	metadata: { Width: 10, legacy: 'preserve unless metadata is supplied' },
	inventoryTypeId: beltType.id,
	archivedAt: null,
	updatedAt: '2026-08-14T12:00:00.000Z',
	quantity: 7
};

describe('typed part creation', () => {
	it('requires an inventory type', async () => {
		const database = createD1Double();

		await expect(
			createPart(database.d1, { name: 'Timing Belt', mfgPartNumber: 'GT2-120' })
		).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400, field: 'inventoryTypeId' });
		expect(database.writes).toHaveLength(0);
	});

	it('rejects an unknown inventory type', async () => {
		const database = createD1Double();

		await expect(
			createPart(database.d1, {
				name: 'Timing Belt',
				mfgPartNumber: 'GT2-120',
				inventoryTypeId: 'missing'
			})
		).rejects.toMatchObject({ code: 'TYPE_NOT_FOUND', status: 404, field: 'inventoryTypeId' });
		expect(database.writes).toHaveLength(0);
	});

	it('rejects explicit null metadata even when the type has no required properties', async () => {
		const database = createD1Double({ types: [beltType] });

		await expect(
			createPart(database.d1, {
				name: 'Timing Belt',
				mfgPartNumber: 'GT2-120',
				inventoryTypeId: beltType.id,
				metadata: null
			})
		).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400, field: 'metadata' });
		expect(database.writes).toHaveLength(0);
	});

	it('canonicalizes metadata and persists the normalized type reference', async () => {
		const database = createD1Double({ types: [beltType], properties: [widthProperty] });

		const created = await createPart(database.d1, {
			name: ' Timing Belt ',
			mfgPartNumber: ' GT2-120 ',
			inventoryTypeId: ' type-belt ',
			metadata: { width: 12 }
		});

		expect(created).toMatchObject({
			name: 'Timing Belt',
			mfgPartNumber: 'GT2-120',
			inventoryTypeId: beltType.id,
			inventoryTypeName: beltType.name,
			metadata: { Width: 12 },
			quantity: 0,
			archivedAt: null,
			updatedAt: expect.any(String)
		});
		expect(database.writes).toHaveLength(1);
		expect(database.writes[0].params).toContain(beltType.id);
		expect(database.writes[0].params).toContain(JSON.stringify({ Width: 12 }));
	});

	it('keeps manufacturer part number conflicts compatible', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			writeError: new Error('D1_ERROR: UNIQUE constraint failed: parts.mfg_part_number')
		});

		await expect(
			createPart(database.d1, {
				name: 'Timing Belt',
				mfgPartNumber: 'GT2-120',
				inventoryTypeId: beltType.id,
				metadata: { Width: 12 }
			})
		).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 409 });
	});

	it('maps a type-deletion race during insertion to an unknown type', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			writeError: new Error('D1_ERROR: FOREIGN KEY constraint failed')
		});

		await expect(
			createPart(database.d1, {
				name: 'Timing Belt',
				mfgPartNumber: 'GT2-120',
				inventoryTypeId: beltType.id,
				metadata: { Width: 12 }
			})
		).rejects.toMatchObject({ code: 'TYPE_NOT_FOUND', status: 404, field: 'inventoryTypeId' });
	});
});

describe('optimistic partial part editing', () => {
	it('replaces metadata wholesale instead of deep merging it', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			parts: [storedPart]
		});

		await expect(
			updatePart(database.d1, storedPart.id, {
				metadata: { width: 12 },
				updatedAt: storedPart.updatedAt
			})
		).resolves.toMatchObject({ metadata: { Width: 12 } });
		expect(database.writes.at(-1)?.params).toContain(JSON.stringify({ Width: 12 }));
	});

	it('merges omitted ordinary fields from the stored part', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			parts: [storedPart]
		});

		const updated = await updatePart(database.d1, storedPart.id, {
			description: 'Updated description',
			updatedAt: storedPart.updatedAt
		});

		expect(updated).toMatchObject({
			name: storedPart.name,
			mfgPartNumber: storedPart.mfgPartNumber,
			description: 'Updated description',
			metadata: storedPart.metadata,
			inventoryTypeId: beltType.id,
			inventoryTypeName: beltType.name,
			quantity: storedPart.quantity,
			archivedAt: storedPart.archivedAt
		});
	});

	it('validates existing metadata against the destination type', async () => {
		const database = createD1Double({
			types: [beltType, pulleyType],
			properties: [widthProperty, materialProperty],
			parts: [storedPart]
		});

		await expect(
			updatePart(database.d1, storedPart.id, {
				inventoryTypeId: pulleyType.id,
				updatedAt: storedPart.updatedAt
			})
		).rejects.toMatchObject({ code: 'METADATA_REQUIRED', field: 'metadata.Material' });
		expect(database.writes).toHaveLength(0);
	});

	it('validates the full result when editing a grandfathered invalid record', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			parts: [{ ...storedPart, metadata: { legacy: true } }]
		});

		await expect(
			updatePart(database.d1, storedPart.id, {
				name: 'Renamed Belt',
				updatedAt: storedPart.updatedAt
			})
		).rejects.toMatchObject({ code: 'METADATA_REQUIRED', field: 'metadata.Width' });
		expect(database.writes).toHaveLength(0);
	});

	it('rejects a stale timestamp observed before the write', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			parts: [storedPart]
		});

		await expect(
			updatePart(database.d1, storedPart.id, {
				name: 'Renamed Belt',
				updatedAt: '2026-08-14T11:59:59.000Z'
			})
		).rejects.toMatchObject({ code: 'PART_UPDATE_CONFLICT', status: 409, field: 'updatedAt' });
		expect(database.writes).toHaveLength(0);
	});

	it('reports an update race when the guarded write changes no row', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			parts: [storedPart],
			updateChanges: 0
		});

		await expect(
			updatePart(database.d1, storedPart.id, {
				name: 'Renamed Belt',
				updatedAt: storedPart.updatedAt
			})
		).rejects.toMatchObject({ code: 'PART_UPDATE_CONFLICT', status: 409, field: 'updatedAt' });
		expect(database.writes.at(-1)?.params.slice(-2)).toEqual([
			storedPart.id,
			storedPart.updatedAt
		]);
	});

	it('maps a destination-type deletion race during update to an unknown type', async () => {
		const database = createD1Double({
			types: [beltType],
			properties: [widthProperty],
			parts: [storedPart],
			writeError: new Error('D1_ERROR: FOREIGN KEY constraint failed')
		});

		await expect(
			updatePart(database.d1, storedPart.id, {
				metadata: { Width: 12 },
				updatedAt: storedPart.updatedAt
			})
		).rejects.toMatchObject({ code: 'TYPE_NOT_FOUND', status: 404, field: 'inventoryTypeId' });
	});
});
