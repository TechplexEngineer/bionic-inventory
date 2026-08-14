import { describe, expect, it } from 'vitest';
import type { InventoryTypeProperty } from './inventory-types';
import { parseInventoryQuery } from './inventory-filters';

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
});
