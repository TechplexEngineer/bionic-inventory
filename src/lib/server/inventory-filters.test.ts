import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { InventoryTypeDefinition, InventoryTypeProperty } from './inventory-types';
import { listInventoryFacets, parseInventoryQuery } from './inventory-filters';

type FilterProperty = Pick<InventoryTypeProperty, 'id' | 'name' | 'kind'>;

const textProperties: FilterProperty[] = [
	{ id: 'property-material', name: 'Material', kind: 'text' },
	{ id: 'property-color', name: 'Color', kind: 'text' }
];
const numericProperties: FilterProperty[] = [
	{ id: 'property-width', name: 'Width', kind: 'numeric' },
	{ id: 'property-teeth', name: 'Teeth', kind: 'numeric' }
];
const allProperties = [...textProperties, ...numericProperties];

function parse(search: string, properties: FilterProperty[] = allProperties) {
	return parseInventoryQuery(new URL(`https://example.test/api/inventory?${search}`), properties);
}

describe('parseInventoryQuery', () => {
	it('retains search, exact-list, and archive query behavior without a selected type', () => {
		expect(
			parseInventoryQuery(
				new URL(
					'https://example.test/api/inventory?q= timing%20belt &mfgPartNumber=A,B&mfgPartNumber=C&id=part-1&showArchived=yes'
				)
			)
		).toEqual({
			query: 'timing belt',
			mfgPartNumber: ['A', 'B', 'C'],
			id: ['part-1'],
			showArchived: true,
			metadataFilters: []
		});
	});

	it('parses the exact three-bracket metadata syntax', () => {
		expect(parse('typeId=type-belt&meta[property-material][exact]=Nylon')).toMatchObject({
			typeId: 'type-belt',
			metadataFilters: [
				{ propertyId: 'property-material', operator: 'exact', value: 'Nylon' }
			]
		});
	});

	it.each([
		'meta[property-width]=10',
		'meta[property-width][min][extra]=10',
		'meta[][min]=10',
		'meta[property-width][between]=10',
		'meta[property-width][min'
	])('rejects malformed metadata key %s', (keyAndValue) => {
		expect(() => parse(`typeId=type-belt&${keyAndValue}`)).toThrowError(
			expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 })
		);
	});

	it('ignores parameters outside the reserved meta bracket namespace', () => {
		expect(parseInventoryQuery(new URL('https://example.test/api/inventory?metadata=legacy'))).toEqual({
			showArchived: false,
			metadataFilters: []
		});
	});

	it('parses one-sided and inclusive two-sided numeric ranges', () => {
		expect(parse('typeId=type-belt&meta[property-width][min]=10').metadataFilters).toEqual([
			{ propertyId: 'property-width', operator: 'min', value: 10 }
		]);
		expect(parse('typeId=type-belt&meta[property-width][max]=20').metadataFilters).toEqual([
			{ propertyId: 'property-width', operator: 'max', value: 20 }
		]);
		expect(
			parse(
				'typeId=type-belt&meta[property-width][min]=10&meta[property-width][max]=20'
			).metadataFilters
		).toEqual([
			{ propertyId: 'property-width', operator: 'min', value: 10 },
			{ propertyId: 'property-width', operator: 'max', value: 20 }
		]);
	});

	it('keeps filters for distinct properties as an AND-ready list', () => {
		expect(
			parse(
				'typeId=type-belt&meta[property-material][exact]=Nylon&meta[property-width][min]=9'
			).metadataFilters
		).toEqual([
			{ propertyId: 'property-material', operator: 'exact', value: 'Nylon' },
			{ propertyId: 'property-width', operator: 'min', value: 9 }
		]);
	});

	it('requires exactly one non-empty typeId when metadata filters are present', () => {
		for (const search of [
			'meta[property-material][exact]=Nylon',
			'typeId=&meta[property-material][exact]=Nylon',
			'typeId=type-belt&typeId=type-other&meta[property-material][exact]=Nylon'
		]) {
			expect(() => parse(search)).toThrowError(
				expect.objectContaining({ code: 'INVALID_REQUEST', status: 400, field: 'typeId' })
			);
		}
	});

	it('rejects metadata properties outside the selected definition', () => {
		expect(() =>
			parse('typeId=type-belt&meta[property-unknown][exact]=Nylon')
		).toThrowError(expect.objectContaining({ code: 'PROPERTY_NOT_FOUND', status: 404 }));
	});

	it.each([
		['meta[property-material][min]=1', textProperties],
		['meta[property-material][max]=2', textProperties],
		['meta[property-width][contains]=1', numericProperties]
	])('rejects operators that do not match the property kind', (filter, properties) => {
		expect(() => parse(`typeId=type-belt&${filter}`, properties)).toThrowError(
			expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 })
		);
	});

	it('rejects repeated scalar metadata filters', () => {
		expect(() =>
			parse(
				'typeId=type-belt&meta[property-material][exact]=Nylon&meta[property-material][exact]=Rubber'
			)
		).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 }));
	});

	it('rejects simultaneous text exact and contains operators', () => {
		expect(() =>
			parse(
				'typeId=type-belt&meta[property-material][exact]=Nylon&meta[property-material][contains]=nyl'
			)
		).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 }));
	});

	it('rejects simultaneous numeric exact and range operators', () => {
		expect(() =>
			parse(
				'typeId=type-belt&meta[property-width][exact]=10&meta[property-width][min]=9'
			)
		).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 }));
	});

	it.each(['NaN', 'Infinity', '-Infinity', '1e309', ''])('rejects non-finite numeric value %j', (value) => {
		expect(() =>
			parse(`typeId=type-belt&meta[property-width][min]=${encodeURIComponent(value)}`)
		).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 }));
	});

	it('rejects a numeric minimum greater than its maximum', () => {
		expect(() =>
			parse(
				'typeId=type-belt&meta[property-width][min]=20&meta[property-width][max]=10'
			)
		).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', status: 400 }));
	});

	it('rejects more metadata predicates than fit safely within one D1 statement', () => {
		const properties = Array.from({ length: 21 }, (_, index) => ({
			id: `property-${index}`,
			name: `Property ${index}`,
			kind: 'text' as const
		}));
		const params = new URLSearchParams({ typeId: 'type-wide' });
		for (const property of properties) {
			params.set(`meta[${property.id}][exact]`, 'value');
		}

		expect(() => parseInventoryQuery(new URL(`https://example.test/?${params}`), properties))
			.toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', status: 400, field: 'meta' }));
	});
});

describe('listInventoryFacets with local D1', () => {
	let miniflare: Miniflare;
	let d1: D1Database;

	const facetProperties: FilterProperty[] = [
		{ id: 'property-material', name: 'Material', kind: 'text' },
		{ id: 'property-color', name: 'Color', kind: 'text' },
		{ id: 'property-width', name: 'Width', kind: 'numeric' }
	];
	const wideFacetProperties: FilterProperty[] = Array.from({ length: 16 }, (_, index) => ({
		id: `property-wide-${index}`,
		name: `Facet ${index}`,
		kind: 'text' as const
	}));

	function definition(
		id: string,
		name: string,
		properties: FilterProperty[]
	): InventoryTypeDefinition {
		const timestamp = '2026-08-14T12:00:00.000Z';
		return {
			id,
			name,
			normalizedName: name.toLowerCase(),
			createdAt: timestamp,
			updatedAt: timestamp,
			properties: [...properties].sort((left, right) =>
				left.name < right.name ? -1 : left.name > right.name ? 1 : 0
			).map((property) => ({
				...property,
				inventoryTypeId: id,
				normalizedName: property.name.toLowerCase(),
				required: false,
				minimum: null,
				maximum: null,
				createdAt: timestamp,
				updatedAt: timestamp
			}))
		};
	}

	function facetQuery(search: string) {
		return parseInventoryQuery(
			new URL(`https://example.test/api/inventory/facets?${search}`),
			facetProperties
		);
	}

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: 'export default { fetch() { return new Response("ok") } }',
			d1Databases: { DB: 'inventory-facet-test' }
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
			d1
				.prepare(
					'INSERT INTO inventory_types (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
				)
				.bind('type-wide', 'Wide', 'wide', timestamp, timestamp),
			...facetProperties.map((property) =>
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
			...wideFacetProperties.map((property) =>
				d1
					.prepare(
						'INSERT INTO inventory_type_properties (id, inventory_type_id, name, normalized_name, kind, required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(
						property.id,
						'type-wide',
						property.name,
						property.name.toLowerCase(),
						property.kind,
						0,
						timestamp,
						timestamp
					)
			)
		]);

		const parts = [
			['part-black-upper', 'Facet Belt Alpha', 'FACET-1', { Material: 'Nylon', Color: 'Black', Width: 10 }, 'type-belt', null],
			['part-black-lower', 'Facet Belt Beta', 'FACET-2', { Material: 'NYLON', Color: 'black', Width: 12 }, 'type-belt', null],
			['part-red', 'Facet Belt Gamma', 'FACET-3', { Material: 'Nylon', Color: 'Red', Width: 14 }, 'type-belt', null],
			['part-rubber', 'Facet Belt Delta', 'FACET-4', { Material: 'Rubber', Color: 'Black', Width: 16 }, 'type-belt', null],
			['part-search-excluded', 'Unrelated Component', 'FACET-5', { Material: 'Nylon', Color: 'Orange' }, 'type-belt', null],
			['part-archived', 'Facet Belt Archived', 'FACET-6', { Material: 'Nylon', Color: 'Green' }, 'type-belt', timestamp],
			['part-other-type', 'Facet Belt Bearing', 'FACET-7', { Material: 'Nylon', Color: 'Yellow' }, 'type-bearing', null],
			['part-missing', 'Facet Belt Missing', 'FACET-8', { Material: 'Nylon' }, 'type-belt', null],
			['part-non-text', 'Facet Belt Invalid', 'FACET-9', { Material: 'Nylon', Color: 7 }, 'type-belt', null],
			['part-id-excluded', 'Facet Belt ID Excluded', 'FACET-10', { Material: 'Nylon', Color: 'Cyan' }, 'type-belt', null],
			['part-mfg-excluded', 'Facet Belt MFG Excluded', 'FACET-11', { Material: 'Nylon', Color: 'Purple' }, 'type-belt', null],
			['part-umlaut-upper', 'Facet Belt Umlaut Upper', 'FACET-12', { Material: 'Nylon', Color: 'Ä' }, 'type-belt', null],
			['part-umlaut-lower', 'Facet Belt Umlaut Lower', 'FACET-13', { Material: 'Nylon', Color: 'ä' }, 'type-belt', null]
		] as const;

		await d1.batch(
			[
				...parts,
				[
					'part-wide',
					'Wide Facets',
					'WIDE-1',
					Object.fromEntries(wideFacetProperties.map((property) => [property.name, 'Present'])),
					'type-wide',
					null
				] as const
			].map(([id, name, mfgPartNumber, metadata, typeId, archivedAt]) =>
				d1
					.prepare(
						'INSERT INTO parts (id, name, mfg_part_number, description, metadata, inventory_type_id, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(
						id,
						name,
						mfgPartNumber,
						'facet fixture',
						JSON.stringify(metadata),
						typeId,
						archivedAt,
						timestamp,
						timestamp
					)
			)
		);
	});

	afterAll(async () => {
		await miniflare.dispose();
	});

	it('removes only each facet own filter while retaining every other inventory filter', async () => {
		const includedIds = [
			'part-black-upper',
			'part-black-lower',
			'part-red',
			'part-rubber',
			'part-search-excluded',
			'part-archived',
			'part-other-type',
			'part-missing',
			'part-non-text',
			'part-mfg-excluded',
			'part-umlaut-upper',
			'part-umlaut-lower'
		];
		const query = facetQuery(
			`typeId=type-belt&q=Belt&id=${includedIds.join(',')}&mfgPartNumber=${[
				'FACET-1',
				'FACET-2',
				'FACET-3',
				'FACET-4',
				'FACET-5',
				'FACET-6',
				'FACET-7',
				'FACET-8',
				'FACET-9',
				'FACET-10',
				'FACET-12',
				'FACET-13'
			].join(',')}&meta[property-color][exact]=Black&meta[property-material][exact]=Nylon`
		);

		expect(await listInventoryFacets(d1, query, definition('type-belt', 'Belt', facetProperties))).toEqual([
			{
				propertyId: 'property-color',
				values: [
					{ value: 'Black', count: 2 },
					{ value: 'Red', count: 1 },
					{ value: 'Ä', count: 1 },
					{ value: 'ä', count: 1 }
				]
			},
			{
				propertyId: 'property-material',
				values: [
					{ value: 'NYLON', count: 2 },
					{ value: 'Rubber', count: 1 }
				]
			}
		]);
	});

	it('returns 16 text facets with one grouped count query when the definition is already loaded', async () => {
		let prepareCount = 0;
		const countedD1 = {
			prepare(sql: string) {
				prepareCount += 1;
				return d1.prepare(sql);
			},
			batch: d1.batch.bind(d1),
			exec: d1.exec.bind(d1),
			dump: d1.dump.bind(d1)
		} as unknown as D1Database;
		const inventoryType = definition('type-wide', 'Wide', wideFacetProperties);
		const query = parseInventoryQuery(
			new URL('https://example.test/api/inventory/facets?typeId=type-wide'),
			wideFacetProperties
		);

		const startedAt = performance.now();
		const facets = await listInventoryFacets(countedD1, query, inventoryType);
		const durationMs = performance.now() - startedAt;

		expect(prepareCount).toBe(1);
		expect(facets).toHaveLength(16);
		expect(facets.every((facet) => facet.values[0]?.value === 'Present')).toBe(true);
		expect(durationMs).toBeLessThan(1_000);
	});
});
