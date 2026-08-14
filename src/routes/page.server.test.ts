import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventory = vi.hoisted(() => ({
	getArrayQueryParam: vi.fn((url: URL, name: string) => {
		const values = url.searchParams
			.getAll(name)
			.flatMap((value) => value.split(','))
			.map((value) => value.trim())
			.filter(Boolean);
		return values.length > 0 ? [...new Set(values)] : undefined;
	}),
	getBooleanQueryParam: vi.fn(
		(url: URL, name: string) => url.searchParams.get(name) === '1'
	),
	getBoundDb: vi.fn(() => ({ binding: 'd1' })),
	getSearchQuery: vi.fn((url: URL) => url.searchParams.get('q')?.trim() || undefined),
	isMissingSchemaError: vi.fn(() => false),
	listFilteredInventory: vi.fn(),
	listHistory: vi.fn(),
	listInventory: vi.fn(),
	setPartArchivedStateById: vi.fn()
}));
const inventoryTypes = vi.hoisted(() => ({ listInventoryTypes: vi.fn() }));
const inventoryFilters = vi.hoisted(() => ({
	getInventoryTypeId: vi.fn(),
	listInventoryFacets: vi.fn(),
	parseInventoryQuery: vi.fn()
}));

vi.mock('$lib/server/inventory', () => inventory);
vi.mock('$lib/server/inventory-types', () => inventoryTypes);
vi.mock('$lib/server/inventory-filters', () => inventoryFilters);

import { load } from './+page.server';

const timestamp = '2026-08-14T12:00:00.000Z';
const materialProperty = {
	id: 'property-material',
	inventoryTypeId: 'type-belt',
	name: 'Material',
	normalizedName: 'material',
	kind: 'text' as const,
	required: false,
	minimum: null,
	maximum: null,
	createdAt: timestamp,
	updatedAt: timestamp
};
const beltType = {
	id: 'type-belt',
	name: 'Belt',
	normalizedName: 'belt',
	createdAt: timestamp,
	updatedAt: timestamp,
	properties: [materialProperty]
};
const bearingType = {
	id: 'type-bearing',
	name: 'Bearing',
	normalizedName: 'bearing',
	createdAt: timestamp,
	updatedAt: timestamp,
	properties: []
};
const types = [bearingType, beltType];
const filters = {
	query: 'drive',
	showArchived: true,
	typeId: 'type-belt',
	metadataFilters: [
		{ propertyId: 'property-material', operator: 'contains' as const, value: 'nyl' }
	]
};
const parts = [{ id: 'part-1' }];
const history = [{ id: 'history-1' }];
const facets = [{ propertyId: 'property-material', values: [{ value: 'Nylon', count: 2 }] }];

function event(search = '') {
	return {
		platform: { env: { DB: {} } },
		url: new URL(`https://example.test/${search}`)
	};
}

beforeEach(() => {
	inventory.getBoundDb.mockClear();
	inventory.isMissingSchemaError.mockReset().mockReturnValue(false);
	inventory.listFilteredInventory.mockReset().mockResolvedValue(parts);
	inventory.listHistory.mockReset().mockResolvedValue(history);
	inventory.listInventory.mockReset().mockResolvedValue(parts);
	inventoryTypes.listInventoryTypes.mockReset().mockResolvedValue(types);
	inventoryFilters.getInventoryTypeId.mockReset().mockReturnValue('type-belt');
	inventoryFilters.parseInventoryQuery.mockReset().mockReturnValue(filters);
	inventoryFilters.listInventoryFacets.mockReset().mockResolvedValue(facets);
});

describe('dashboard server load', () => {
	it('uses the selected definition and one parsed model for inventory and facet reads', async () => {
		const loadEvent = event(
			'?q=drive&typeId=type-belt&meta[property-material][contains]=nyl&showArchived=1'
		);

		const result = await load(loadEvent as never);

		expect(inventoryTypes.listInventoryTypes).toHaveBeenCalledWith({ binding: 'd1' });
		expect(inventoryFilters.getInventoryTypeId).toHaveBeenCalledWith(loadEvent.url);
		expect(inventoryFilters.parseInventoryQuery).toHaveBeenCalledWith(
			loadEvent.url,
			beltType.properties
		);
		expect(inventory.listFilteredInventory).toHaveBeenCalledWith(
			{ binding: 'd1' },
			filters,
			beltType
		);
		expect(inventoryFilters.listInventoryFacets).toHaveBeenCalledWith(
			{ binding: 'd1' },
			filters,
			beltType
		);
		expect(result).toMatchObject({
			databaseConfigured: true,
			databaseReady: true,
			inventoryTypes: types,
			selectedType: beltType,
			filters,
			facets,
			parts,
			history,
			query: 'drive',
			showArchived: true
		});
	});

	it('does not request facets when no inventory type is selected', async () => {
		const untypedFilters = { query: 'legacy', showArchived: false, metadataFilters: [] };
		inventoryFilters.getInventoryTypeId.mockReturnValueOnce(undefined);
		inventoryFilters.parseInventoryQuery.mockReturnValueOnce(untypedFilters);

		const result = await load(event('?q=legacy') as never);

		expect(inventoryFilters.parseInventoryQuery).toHaveBeenCalledWith(
			expect.any(URL),
			undefined
		);
		expect(inventoryFilters.listInventoryFacets).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			selectedType: null,
			filters: untypedFilters,
			facets: [],
			query: 'legacy',
			showArchived: false
		});
	});

	it('preserves parsed URL and selected-type state when a dashboard read fails', async () => {
		inventory.listFilteredInventory.mockRejectedValueOnce(new Error('D1 unavailable'));

		const result = await load(event('?q=drive&typeId=type-belt&showArchived=1') as never);

		expect(result).toMatchObject({
			databaseConfigured: true,
			databaseReady: false,
			query: 'drive',
			showArchived: true,
			inventoryTypes: types,
			selectedType: beltType,
			filters,
			facets: [],
			parts: [],
			history: []
		});
	});

	it('preserves complete raw URL filter state when the database binding is absent', async () => {
		const result = await load({
			platform: undefined,
			url: new URL(
				'https://example.test/?q=legacy&mfgPartNumber=A,B&mfgPartNumber=C&id=part-1&typeId=type-belt&meta[property-material][exact]=Nylon&meta[property-width][min]=5&showArchived=1'
			)
		} as never);

		expect(result).toMatchObject({
			databaseConfigured: false,
			databaseReady: false,
			query: 'legacy',
			showArchived: true,
			inventoryTypes: [],
			selectedType: null,
			filters: {
				query: 'legacy',
				mfgPartNumber: ['A', 'B', 'C'],
				id: ['part-1'],
				showArchived: true,
				typeId: 'type-belt',
				metadataFilters: [
					{ propertyId: 'property-material', operator: 'exact', value: 'Nylon' },
					{ propertyId: 'property-width', operator: 'min', value: '5' }
				]
			},
			facets: [],
			parts: [],
			history: []
		});
		expect(inventoryTypes.listInventoryTypes).not.toHaveBeenCalled();
	});

	it('preserves complete raw URL filter state when listing types fails before parsing', async () => {
		inventoryTypes.listInventoryTypes.mockRejectedValueOnce(new Error('D1 unavailable'));
		const url =
			'?q=drive&mfgPartNumber=BELT-10&id=part-1&typeId=type-belt&meta[property-material][contains]=nyl&showArchived=1';

		const result = await load(event(url) as never);

		expect(result).toMatchObject({
			databaseConfigured: true,
			databaseReady: false,
			inventoryTypes: [],
			selectedType: null,
			filters: {
				query: 'drive',
				mfgPartNumber: ['BELT-10'],
				id: ['part-1'],
				showArchived: true,
				typeId: 'type-belt',
				metadataFilters: [
					{ propertyId: 'property-material', operator: 'contains', value: 'nyl' }
				]
			},
			facets: [],
			parts: [],
			history: []
		});
		expect(inventoryFilters.parseInventoryQuery).not.toHaveBeenCalled();
		expect(inventory.listFilteredInventory).not.toHaveBeenCalled();
	});
});
