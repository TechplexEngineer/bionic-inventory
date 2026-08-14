import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildFtsQuery,
	createApiKey,
	extractApiToken,
	getArrayQueryParam,
	getBooleanQueryParam,
	getBoundDb,
	normalizePartInput,
	normalizePartArchiveInput,
	normalizeTransactionInput,
	parseConfiguredTokens,
	requireApiRole,
	listFilteredInventory
} from './inventory';
import { parseInventoryQuery, type FilterProperty } from './inventory-filters';
import type { InventoryTypeDefinition } from './inventory-types';

type StoredApiKey = {
	keyHash: string;
	role: 'producer' | 'consumer';
	revokedAt: string | null;
};

type RecordedStatement = {
	sql: string;
	params: unknown[];
};

function d1Result(results: Record<string, unknown>[] = []) {
	return {
		success: true,
		meta: {
			changed_db: false,
			changes: 0,
			duration: 0,
			last_row_id: 0,
			rows_read: 0,
			rows_written: 0,
			size_after: 0
		},
		results
	};
}

function createD1Double(storedKeys: StoredApiKey[] = []) {
	const statements: RecordedStatement[] = [];

	const prepare = (statementSql: string) => {
		let params: unknown[] = [];
		const statement = {
			bind: (...boundParams: unknown[]) => {
				params = boundParams;
				return statement;
			},
			run: async () => {
				statements.push({ sql: statementSql, params });
				return d1Result();
			},
			all: async () => {
				statements.push({ sql: statementSql, params });
				return d1Result();
			},
			raw: async () => {
				statements.push({ sql: statementSql, params });
				const key = storedKeys.find((storedKey) => storedKey.keyHash === params[0]);
				return key ? [[key.role, key.revokedAt]] : [];
			},
			first: async () => null
		};

		return statement;
	};

	return {
		statements,
		d1: {
			prepare,
			batch: async () => [],
			exec: async () => d1Result(),
			dump: async () => new ArrayBuffer(0)
		} as unknown as D1Database
	};
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('inventory helpers', () => {
	it('labels an unavailable database binding as an internal error', () => {
		expect(() => getBoundDb(undefined)).toThrowError(
			expect.objectContaining({ code: 'INTERNAL_ERROR', status: 500 })
		);
	});

	it('stores only a hash and a safe prefix when creating a D1 API key', async () => {
		const database = createD1Double();

		const created = await createApiKey(database.d1, 'Warehouse scanner', 'producer');
		const result = created as unknown as {
			item: { keyPrefix: string };
			token: string;
		};
		const inserted = database.statements.find((statement) =>
			statement.sql.toLowerCase().startsWith('insert into')
		);

		expect(result.token).toMatch(/^bio_prod_[A-Za-z0-9_-]+$/);
		expect(inserted?.params).toContainEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
		expect(inserted?.params).not.toContain(result.token);
		expect(result.item.keyPrefix).toBe(result.token.slice(0, 18));
	});

	it('authorizes active D1 keys by the hash of the submitted token', async () => {
		const token = 'bio_prod_active-token';
		const keyHash = await sha256Hex(token);
		const database = createD1Double([{ keyHash, role: 'producer', revokedAt: null }]);

		expect(
			await requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { 'x-api-token': token }
				}),
				{},
				['producer'],
				database.d1
			)
		).toBe('producer');
		expect(database.statements.at(-1)?.params).toEqual([keyHash, 1]);
	});

	it('rejects revoked and unknown D1 keys', async () => {
		const revokedToken = 'bio_prod_revoked-token';
		const database = createD1Double([
			{ keyHash: await sha256Hex(revokedToken), role: 'producer', revokedAt: '2026-08-11T12:00:00.000Z' }
		]);

		await expect(
			requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { authorization: `Bearer ${revokedToken}` }
				}),
				{},
				['producer'],
				database.d1
			)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { authorization: 'Bearer bio_prod_unknown-token' }
				}),
				{},
				['producer'],
				database.d1
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('rejects active D1 keys whose role is not allowed', async () => {
		const token = 'bio_prod_consumer-token';
		const database = createD1Double([
			{ keyHash: await sha256Hex(token), role: 'consumer', revokedAt: null }
		]);

		await expect(
			requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { 'x-api-token': token }
				}),
				{},
				['producer'],
				database.d1
			)
		).rejects.toMatchObject({ status: 403 });
	});

	it('parses array query parameters supporting repeating params and comma separation', () => {
		const url1 = new URL('https://example.com/api/inventory?mfgPartNumber=PULLEY-1&mfgPartNumber=GEAR-2');
		expect(getArrayQueryParam(url1, 'mfgPartNumber')).toEqual(['PULLEY-1', 'GEAR-2']);

		const url2 = new URL('https://example.com/api/inventory?mfgPartNumber=PULLEY-1,GEAR-2');
		expect(getArrayQueryParam(url2, 'mfgPartNumber')).toEqual(['PULLEY-1', 'GEAR-2']);

		const url3 = new URL('https://example.com/api/inventory?mfgPartNumber=PULLEY-1,GEAR-2&mfgPartNumber=BEARING-3');
		expect(getArrayQueryParam(url3, 'mfgPartNumber')).toEqual(['PULLEY-1', 'GEAR-2', 'BEARING-3']);

		const url4 = new URL('https://example.com/api/inventory');
		expect(getArrayQueryParam(url4, 'mfgPartNumber')).toBeUndefined();
	});

	it('parses boolean query parameters for archived filtering', () => {
		expect(getBooleanQueryParam(new URL('https://example.com/?showArchived=true'), 'showArchived')).toBe(
			true
		);
		expect(getBooleanQueryParam(new URL('https://example.com/?showArchived=0'), 'showArchived')).toBe(
			false
		);
		expect(getBooleanQueryParam(new URL('https://example.com/'), 'showArchived')).toBe(false);
		expect(() =>
			getBooleanQueryParam(new URL('https://example.com/?showArchived=maybe'), 'showArchived')
		).toThrow(/boolean value/i);
	});

	it('parses configured API tokens and authorizes producer access', async () => {
		const request = new Request('https://example.com/api/inventory', {
			headers: {
				authorization: ['Bearer', 'producer-token'].join(' ')
			}
		});

		expect(parseConfiguredTokens('producer-token, another-token')).toEqual(
			new Set(['producer-token', 'another-token'])
		);
		expect(
			await requireApiRole(
				request,
				{
					PRODUCER_API_TOKENS: 'producer-token',
					CONSUMER_API_TOKENS: 'consumer-token'
				},
				['producer']
			)
		).toBe('producer');
	});

	it('supports x-api-token headers for consumer requests', async () => {
		const request = new Request('https://example.com/api/history', {
			headers: {
				'x-api-token': 'consumer-token'
			}
		});

		expect(extractApiToken(request)).toBe('consumer-token');
		expect(
			await requireApiRole(
				request,
				{
					PRODUCER_API_TOKENS: 'producer-token',
					CONSUMER_API_TOKENS: 'consumer-token'
				},
				['consumer', 'producer']
			)
		).toBe('consumer');
	});

	it('normalizes part payloads with metadata', () => {
		expect(
			normalizePartInput({
				name: 'Timing Belt',
				mfgPartNumber: 'GT2-120',
				inventoryTypeId: ' belt-type ',
				description: '120 tooth timing belt',
				metadata: {
					teeth: 120,
					pitch: 'GT2',
					widthMm: 9
				}
			})
		).toEqual({
			name: 'Timing Belt',
			mfgPartNumber: 'GT2-120',
			inventoryTypeId: 'belt-type',
			description: '120 tooth timing belt',
			metadata: {
				teeth: 120,
				pitch: 'GT2',
				widthMm: 9
			}
		});
	});

	it('normalizes grouped inventory change payloads', () => {
		const payload = normalizeTransactionInput({
			actor: 'assembly-cell-1',
			recordedAt: '2026-08-08T10:00:00.000Z',
			note: 'Consumed for build order 42',
			lines: [
				{
					partId: 'gear-1',
					quantityDelta: -3,
					usedIn: 'Build Order 42'
				},
				{
					partId: 'belt-1',
					quantityDelta: 10
				}
			]
		});

		expect(payload).toEqual({
			actor: 'assembly-cell-1',
			recordedAt: '2026-08-08T10:00:00.000Z',
			note: 'Consumed for build order 42',
			lines: [
				{
					partId: 'gear-1',
					quantityDelta: -3,
					usedIn: 'Build Order 42'
				},
				{
					partId: 'belt-1',
					quantityDelta: 10,
					usedIn: null
				}
			]
		});
	});

	it('normalizes archive payloads for parts', () => {
		expect(
			normalizePartArchiveInput({
				id: 'part-1',
				archived: true
			})
		).toEqual({
			id: 'part-1',
			archived: true
		});
	});

	it('builds a prefix FTS query for part search', () => {
		expect(buildFtsQuery('timing belt 9mm')).toBe('timing* AND belt* AND 9mm*');
	});
});

describe('listFilteredInventory with local D1', () => {
	let miniflare: Miniflare;
	let d1: D1Database;

	const beltProperties: FilterProperty[] = [
		{ id: 'property-material', name: 'Material', kind: 'text' },
		{ id: 'property-color', name: 'Color', kind: 'text' },
		{ id: 'property-width', name: 'Width', kind: 'numeric' },
		{ id: 'property-teeth', name: 'Teeth', kind: 'numeric' }
	];
	const beltDefinition: InventoryTypeDefinition = {
		id: 'type-belt',
		name: 'Belt',
		normalizedName: 'belt',
		createdAt: '2026-08-14T12:00:00.000Z',
		updatedAt: '2026-08-14T12:00:00.000Z',
		properties: beltProperties.map((property) => ({
			...property,
			inventoryTypeId: 'type-belt',
			normalizedName: property.name.toLowerCase(),
			required: false,
			minimum: null,
			maximum: null,
			createdAt: '2026-08-14T12:00:00.000Z',
			updatedAt: '2026-08-14T12:00:00.000Z'
		}))
	};

	function query(search = '') {
		return parseInventoryQuery(
			new URL(`https://example.test/api/inventory${search ? `?${search}` : ''}`),
			beltProperties
		);
	}

	async function ids(search = '') {
		return (await listFilteredInventory(d1, query(search))).map((part) => part.id);
	}

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: 'export default { fetch() { return new Response("ok") } }',
			d1Databases: { DB: 'inventory-filter-test' }
		});
		d1 = (await miniflare.getD1Database('DB')) as unknown as D1Database;

		for (const migration of [
			'drizzle/0000_tired_natasha_romanoff.sql',
			'drizzle/0001_api_keys.sql',
			'drizzle/0002_archived_parts.sql',
			'drizzle/0003_inventory_types.sql'
		]) {
			for (const statement of (await readFile(migration, 'utf8')).split('--> statement-breakpoint')) {
				if (statement.trim()) await d1.prepare(statement).run();
			}
		}

		const timestamp = '2026-08-14T12:00:00.000Z';
		await d1.batch([
			d1
				.prepare(
					'INSERT INTO inventory_types (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
				)
				.bind('type-belt', 'Belt', 'belt', timestamp, timestamp),
			d1
				.prepare(
					'INSERT INTO inventory_types (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
				)
				.bind('type-bearing', 'Bearing', 'bearing', timestamp, timestamp),
			...beltProperties.map((property) =>
				d1
					.prepare(
						'INSERT INTO inventory_type_properties (id, inventory_type_id, name, normalized_name, kind, required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(
						property.id,
						'type-belt',
						property.name,
						property.name.toLowerCase(),
						property.kind,
						0,
						timestamp,
						timestamp
					)
			),
			d1
				.prepare(
					'INSERT INTO inventory_type_properties (id, inventory_type_id, name, normalized_name, kind, required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(
					'property-bearing-material',
					'type-bearing',
					'Material',
					'material',
					'text',
					0,
					timestamp,
					timestamp
				)
		]);

		const parts = [
			['part-legacy', 'Legacy Timing Belt', 'LEGACY-1', 'old stock', {}, null, null],
			[
				'part-nylon',
				'Timing Belt Alpha',
				'BELT-NYLON',
				'10mm drive belt',
				{ Material: 'NYLON', Color: 'Black', Width: 10, Teeth: 120 },
				'type-belt',
				null
			],
			[
				'part-rubber',
				'Timing Belt Beta',
				'BELT-RUBBER',
				'12.5mm drive belt',
				{ Material: 'Rubber', Color: 'black', Width: 12.5, Teeth: 80 },
				'type-belt',
				null
			],
			[
				'part-missing-width',
				'Spare Strap',
				'BELT-SPARE',
				'optional width absent',
				{ Material: 'Nylon', Color: 'Red' },
				'type-belt',
				null
			],
			[
				'part-string-width',
				'Imported Belt',
				'BELT-STRING',
				'grandfathered malformed numeric metadata',
				{ Material: 'Nylon', Width: '10' },
				'type-belt',
				null
			],
			[
				'part-archived',
				'Archived Timing Belt',
				'BELT-ARCHIVED',
				'archived stock',
				{ Material: 'Nylon', Width: 20 },
				'type-belt',
				'2026-08-14T13:00:00.000Z'
			],
			[
				'part-bearing',
				'Timing Bearing',
				'BEARING-1',
				'other type',
				{ Material: 'Nylon' },
				'type-bearing',
				null
			]
		] as const;

		await d1.batch(
			parts.map(([id, name, mfgPartNumber, description, metadata, typeId, archivedAt]) =>
				d1
					.prepare(
						'INSERT INTO parts (id, name, mfg_part_number, description, metadata, inventory_type_id, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(
						id,
						name,
						mfgPartNumber,
						description,
						JSON.stringify(metadata),
						typeId,
						archivedAt,
						timestamp,
						timestamp
					)
			)
		);
		await d1.batch([
			d1
				.prepare(
					'INSERT INTO inventory_changes (id, transaction_id, part_id, quantity_delta, actor, recorded_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.bind('change-1', 'transaction-1', 'part-nylon', 5, 'seed', timestamp, timestamp),
			d1
				.prepare(
					'INSERT INTO inventory_changes (id, transaction_id, part_id, quantity_delta, actor, recorded_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.bind('change-2', 'transaction-2', 'part-nylon', -2, 'seed', timestamp, timestamp)
		]);
	});

	afterAll(async () => {
		await miniflare.dispose();
	});

	it('preserves legacy visibility by default and limits a selected type to active rows of that type', async () => {
		expect(await ids()).toEqual([
			'part-string-width',
			'part-legacy',
			'part-missing-width',
			'part-bearing',
			'part-nylon',
			'part-rubber'
		]);
		expect(await ids('typeId=type-belt')).toEqual([
			'part-string-width',
			'part-missing-width',
			'part-nylon',
			'part-rubber'
		]);
	});

	it('matches text exact and contains filters without regard to case', async () => {
		expect(await ids('typeId=type-belt&meta[property-material][exact]=nylon')).toEqual([
			'part-string-width',
			'part-missing-width',
			'part-nylon'
		]);
		expect(await ids('typeId=type-belt&meta[property-material][contains]=Yl')).toEqual([
			'part-string-width',
			'part-missing-width',
			'part-nylon'
		]);
	});

	it('treats SQL LIKE metacharacters as literal text in contains filters', async () => {
		expect(
			await ids(`typeId=type-belt&meta[property-material][contains]=${encodeURIComponent('%')}`)
		).toEqual([]);
		expect(
			await ids(`typeId=type-belt&meta[property-material][contains]=${encodeURIComponent('_')}`)
		).toEqual([]);
	});

	it('uses an unbounded substring expression for contains values longer than D1 LIKE permits', async () => {
		let inventorySql = '';
		const observedD1 = {
			prepare(sql: string) {
				inventorySql = sql;
				return d1.prepare(sql);
			},
			batch: d1.batch.bind(d1),
			exec: d1.exec.bind(d1),
			dump: d1.dump.bind(d1)
		} as unknown as D1Database;
		const longValue = 'x'.repeat(80);

		await expect(
			listFilteredInventory(
				observedD1,
				query(`typeId=type-belt&meta[property-material][contains]=${longValue}`),
				beltDefinition
			)
		).resolves.toEqual([]);
		expect(inventorySql).toMatch(/instr\s*\(/i);
		expect(inventorySql).not.toMatch(/\slike\s/i);
	});

	it('matches numeric equality and inclusive integer or decimal bounds while excluding missing and non-numeric JSON values', async () => {
		expect(await ids('typeId=type-belt&meta[property-width][exact]=10')).toEqual(['part-nylon']);
		expect(await ids('typeId=type-belt&meta[property-width][min]=10')).toEqual([
			'part-nylon',
			'part-rubber'
		]);
		expect(await ids('typeId=type-belt&meta[property-width][max]=12.5')).toEqual([
			'part-nylon',
			'part-rubber'
		]);
		expect(
			await ids(
				'typeId=type-belt&meta[property-width][min]=10&meta[property-width][max]=12.5'
			)
		).toEqual(['part-nylon', 'part-rubber']);
	});

	it('combines metadata filters with AND and preserves quantity aggregation', async () => {
		const result = await listFilteredInventory(
			d1,
			query(
				'typeId=type-belt&meta[property-material][exact]=nylon&meta[property-width][min]=10'
			)
		);

		expect(result.map((part) => ({ id: part.id, quantity: part.quantity }))).toEqual([
			{ id: 'part-nylon', quantity: 3 }
		]);
	});

	it('composes type and metadata filters with full-text search and exact inventory filters', async () => {
		expect(
			await ids(
				'typeId=type-belt&q=timing&meta[property-material][exact]=nylon&mfgPartNumber=BELT-NYLON,BELT-RUBBER'
			)
		).toEqual(['part-nylon']);
		expect(await ids('typeId=type-belt&id=part-rubber')).toEqual(['part-rubber']);
	});

	it('accepts large ID and manufacturer lists without exceeding D1 binding limits', async () => {
		const ids = Array.from({ length: 150 }, (_, index) => `missing-part-${index}`);
		ids.push('part-nylon');
		const manufacturers = Array.from({ length: 150 }, (_, index) => `MISSING-${index}`);
		manufacturers.push('BELT-NYLON');

		await expect(
			listFilteredInventory(d1, {
				id: ids,
				mfgPartNumber: manufacturers,
				showArchived: false,
				metadataFilters: []
			})
		).resolves.toMatchObject([{ id: 'part-nylon' }]);
	});

	it('includes archived matches only when archive visibility is enabled', async () => {
		expect(
			await ids('typeId=type-belt&showArchived=true&meta[property-material][exact]=nylon')
		).toEqual([
			'part-archived',
			'part-string-width',
			'part-missing-width',
			'part-nylon'
		]);
	});
});
