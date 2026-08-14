import { describe, expect, it } from 'vitest';
import {
	createInventoryType,
	deleteInventoryType,
	getInventoryType,
	listInventoryTypes,
	normalizeTypeDefinition,
	replaceInventoryType
} from './inventory-types';

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

type PreparedRecord = { sql: string; params: unknown[] };

function d1Result(results: unknown[] = [], changes = 0) {
	return {
		success: true,
		meta: {
			changed_db: changes > 0,
			changes,
			duration: 0,
			last_row_id: 0,
			rows_read: results.length,
			rows_written: changes,
			size_after: 0
		},
		results
	};
}

function createD1Double(options: {
	types?: TypeRow[];
	properties?: PropertyRow[];
	partTypeIds?: string[];
	batchChanges?: number;
	batchError?: Error;
	deleteError?: Error;
	deleteChanges?: number;
} = {}) {
	const types = options.types ?? [];
	const properties = options.properties ?? [];
	const prepared: PreparedRecord[] = [];
	const batches: PreparedRecord[][] = [];

	const prepare = (statementSql: string) => {
		let params: unknown[] = [];
		const statement = {
			__sql: statementSql,
			get __params() {
				return params;
			},
			bind: (...boundParams: unknown[]) => {
				params = boundParams;
				return statement;
			},
			raw: async () => {
				prepared.push({ sql: statementSql, params });
				if (/from [`"]inventory_types[`"]/.test(statementSql)) {
					const matching = params.length > 0 ? types.filter((row) => row.id === params[0]) : types;
					return matching.map((row) => [
						row.id,
						row.name,
						row.normalizedName,
						row.createdAt,
						row.updatedAt
					]);
				}
				if (/from [`"]inventory_type_properties[`"]/.test(statementSql)) {
					const typeIds = params.filter((param): param is string => typeof param === 'string');
					return properties
						.filter((row) => typeIds.length === 0 || typeIds.includes(row.inventoryTypeId))
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
				if (/from [`"]parts[`"]/.test(statementSql)) {
					return (options.partTypeIds ?? [])
						.filter((typeId) => typeId === params[0])
						.map((typeId) => [typeId]);
				}
				return [];
			},
			run: async () => {
				prepared.push({ sql: statementSql, params });
				if (options.deleteError) throw options.deleteError;
				return d1Result([], options.deleteChanges ?? 1);
			},
			all: async () => d1Result(),
			first: async () => null
		};
		return statement;
	};

	return {
		prepared,
		batches,
		d1: {
			prepare,
			batch: async (statements: Array<{ __sql: string; __params: unknown[] }>) => {
				const records = statements.map((statement) => ({
					sql: statement.__sql,
					params: [...statement.__params]
				}));
				batches.push(records);
				if (options.batchError) throw options.batchError;
				return records.map((_, index) =>
					d1Result([], index === records.length - 1 ? (options.batchChanges ?? 1) : 1)
				);
			},
			exec: async () => d1Result(),
			dump: async () => new ArrayBuffer(0)
		} as unknown as D1Database
	};
}

const storedType: TypeRow = {
	id: 'type-belt',
	name: 'Belt',
	normalizedName: 'belt',
	createdAt: '2026-08-14T10:00:00.000Z',
	updatedAt: '2026-08-14T12:00:00.000Z'
};

const storedWidth: PropertyRow = {
	id: 'property-width',
	inventoryTypeId: storedType.id,
	name: 'Width',
	normalizedName: 'width',
	kind: 'numeric',
	required: true,
	minimum: 1,
	maximum: 20,
	createdAt: '2026-08-14T10:00:00.000Z',
	updatedAt: '2026-08-14T10:00:00.000Z'
};

describe('inventory type definition normalization', () => {
	it('trims display names and derives Unicode-aware normalized names', () => {
		expect(
			normalizeTypeDefinition({
				name: '  Ångström Belt  ',
				properties: [
					{ name: '  TÉNSION  ', kind: 'numeric', required: true, minimum: 0 }
				]
			})
		).toEqual({
			name: 'Ångström Belt',
			normalizedName: 'ångström belt',
			properties: [
				{
					name: 'TÉNSION',
					normalizedName: 'ténsion',
					kind: 'numeric',
					required: true,
					minimum: 0,
					maximum: null
				}
			]
		});
	});

	it('rejects property names that collide after case normalization', () => {
		expect(() =>
			normalizeTypeDefinition({
				name: 'Belt',
				properties: [
					{ name: 'Width', kind: 'numeric', required: true },
					{ name: 'width', kind: 'numeric', required: false }
				]
			})
		).toThrowError(expect.objectContaining({ code: 'DUPLICATE_PROPERTY_NAME', status: 400 }));
	});

	it('rejects a present null property ID instead of treating it as an ID-less addition', () => {
		expect(() =>
			normalizeTypeDefinition({
				name: 'Belt',
				properties: [
					{ id: null, name: 'Width', kind: 'numeric', required: true }
				]
			})
		).toThrowError(
			expect.objectContaining({ code: 'INVALID_REQUEST', status: 400, field: 'properties[0].id' })
		);
	});

	it('rejects non-finite and inverted numeric bounds', () => {
		for (const property of [
			{ name: 'Width', kind: 'numeric', required: false, minimum: Number.NaN },
			{ name: 'Width', kind: 'numeric', required: false, maximum: Number.POSITIVE_INFINITY },
			{ name: 'Width', kind: 'numeric', required: false, minimum: 20, maximum: 10 }
		]) {
			expect(() => normalizeTypeDefinition({ name: 'Belt', properties: [property] })).toThrowError(
				expect.objectContaining({ code: 'INVALID_PROPERTY_BOUNDS', status: 400 })
			);
		}
	});

	it('rejects numeric bounds on text properties', () => {
		expect(() =>
			normalizeTypeDefinition({
				name: 'Belt',
				properties: [
					{ name: 'Material', kind: 'text', required: false, minimum: 0, maximum: 10 }
				]
			})
		).toThrowError(expect.objectContaining({ code: 'INVALID_PROPERTY_BOUNDS', status: 400 }));
	});
});

describe('inventory type lifecycle', () => {
	it('reads nested definitions with stable IDs, bounds, and timestamps', async () => {
		const database = createD1Double({ types: [storedType], properties: [storedWidth] });

		await expect(listInventoryTypes(database.d1)).resolves.toEqual([
			{
				...storedType,
				properties: [storedWidth]
			}
		]);
		await expect(getInventoryType(database.d1, storedType.id)).resolves.toEqual({
			...storedType,
			properties: [storedWidth]
		});
		await expect(getInventoryType(database.d1, 'missing')).resolves.toBeNull();
	});

	it('creates a complete definition in one D1 batch', async () => {
		const database = createD1Double();

		const created = await createInventoryType(database.d1, {
			name: ' Belt ',
			properties: [
				{ name: 'Material', kind: 'text', required: false },
				{ name: 'Width', kind: 'numeric', required: true, minimum: 1, maximum: 20 }
			]
		});

		expect(created).toMatchObject({
			name: 'Belt',
			normalizedName: 'belt',
			properties: [
				{ name: 'Material', normalizedName: 'material', minimum: null, maximum: null },
				{ name: 'Width', normalizedName: 'width', minimum: 1, maximum: 20 }
			]
		});
		expect(database.batches).toHaveLength(1);
		expect(database.batches[0]).toHaveLength(3);
		expect(database.prepared).toHaveLength(0);
	});

	it('maps normalized type-name uniqueness races to a structured conflict', async () => {
		const database = createD1Double({
			batchError: new Error('D1_ERROR: UNIQUE constraint failed: inventory_types.normalized_name')
		});

		await expect(
			createInventoryType(database.d1, { name: 'BELT', properties: [] })
		).rejects.toMatchObject({ code: 'DUPLICATE_TYPE_NAME', status: 409, field: 'name' });
	});

	it('rejects a supplied property ID that does not belong to the target type', async () => {
		const foreignProperty = { ...storedWidth, id: 'foreign-property', inventoryTypeId: 'type-other' };
		const database = createD1Double({
			types: [storedType],
			properties: [storedWidth, foreignProperty]
		});

		await expect(
			replaceInventoryType(database.d1, storedType.id, {
				name: 'Belt',
				updatedAt: storedType.updatedAt,
				properties: [
					{
						id: foreignProperty.id,
						name: foreignProperty.name,
						kind: foreignProperty.kind,
						required: false
					}
				]
			})
		).rejects.toMatchObject({ code: 'PROPERTY_NOT_FOUND', status: 404 });
		expect(database.batches).toHaveLength(0);
	});

	it('rejects changing the name or kind of a retained property', async () => {
		for (const changed of [
			{ name: 'Belt Width', kind: 'numeric' as const },
			{ name: 'Width', kind: 'text' as const }
		]) {
			const database = createD1Double({ types: [storedType], properties: [storedWidth] });

			await expect(
				replaceInventoryType(database.d1, storedType.id, {
					name: 'Belt',
					updatedAt: storedType.updatedAt,
					properties: [
						{
							id: storedWidth.id,
							name: changed.name,
							kind: changed.kind,
							required: false
						}
					]
				})
			).rejects.toMatchObject({ code: 'IMMUTABLE_PROPERTY', status: 409 });
			expect(database.batches).toHaveLength(0);
		}
	});

	it('atomically deletes omissions, edits mutable fields, and adds ID-less properties', async () => {
		const material: PropertyRow = {
			...storedWidth,
			id: 'property-material',
			name: 'Material',
			normalizedName: 'material',
			kind: 'text',
			required: false,
			minimum: null,
			maximum: null
		};
		const database = createD1Double({
			types: [storedType],
			properties: [storedWidth, material]
		});

		const replaced = await replaceInventoryType(database.d1, storedType.id, {
			name: 'Drive Belt',
			updatedAt: storedType.updatedAt,
			properties: [
				{
					id: storedWidth.id,
					name: storedWidth.name,
					kind: storedWidth.kind,
					required: false,
					minimum: 2,
					maximum: 25
				},
				{ name: 'Pitch', kind: 'numeric', required: true }
			]
		});

		expect(replaced).toMatchObject({
			id: storedType.id,
			name: 'Drive Belt',
			properties: [
				{ id: storedWidth.id, required: false, minimum: 2, maximum: 25 },
				{ name: 'Pitch', required: true }
			]
		});
		expect(database.batches).toHaveLength(1);
		const statements = database.batches[0];
		expect(statements.some(({ sql, params }) => /delete from/i.test(sql) && params.includes(material.id))).toBe(
			true
		);
		expect(statements.every(({ params }) => params.includes(storedType.updatedAt))).toBe(true);
	});

	it('leaves the definition untouched when optimistic replacement is stale', async () => {
		const database = createD1Double({
			types: [storedType],
			properties: [storedWidth],
			batchChanges: 0
		});

		await expect(
			replaceInventoryType(database.d1, storedType.id, {
				name: 'Drive Belt',
				updatedAt: storedType.updatedAt,
				properties: []
			})
		).rejects.toMatchObject({ code: 'TYPE_UPDATE_CONFLICT', status: 409 });
		expect(database.batches[0].every(({ params }) => params.includes(storedType.updatedAt))).toBe(
			true
		);
	});

	it('rejects a previously observed stale timestamp before preparing writes', async () => {
		const database = createD1Double({ types: [storedType], properties: [storedWidth] });

		await expect(
			replaceInventoryType(database.d1, storedType.id, {
				name: 'Drive Belt',
				updatedAt: '2026-08-14T11:00:00.000Z',
				properties: []
			})
		).rejects.toMatchObject({ code: 'TYPE_UPDATE_CONFLICT', status: 409 });
		expect(database.batches).toHaveLength(0);
	});

	it('protects types referenced by active or archived parts', async () => {
		const database = createD1Double({
			types: [storedType],
			partTypeIds: [storedType.id]
		});

		await expect(deleteInventoryType(database.d1, storedType.id)).rejects.toMatchObject({
			code: 'TYPE_IN_USE',
			status: 409
		});
	});

	it('maps a foreign-key deletion race to the same structured conflict', async () => {
		const database = createD1Double({
			types: [storedType],
			deleteError: new Error('D1_ERROR: FOREIGN KEY constraint failed')
		});

		await expect(deleteInventoryType(database.d1, storedType.id)).rejects.toMatchObject({
			code: 'TYPE_IN_USE',
			status: 409
		});
	});
});
