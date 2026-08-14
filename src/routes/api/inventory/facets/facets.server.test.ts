import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryRouteError } from '$lib/server/inventory-errors';

const inventory = vi.hoisted(() => ({
	requireApiRole: vi.fn().mockResolvedValue('consumer'),
	getBoundDb: vi.fn(() => ({ binding: 'd1' })),
	handleInventoryError: vi.fn((cause: unknown) => {
		const error = cause as { message: string; code: string; status: number; field?: string };
		return Response.json(
			{ error: error.message, code: error.code, ...(error.field ? { field: error.field } : {}) },
			{ status: error.status }
		);
	}),
	getArrayQueryParam: vi.fn(),
	getBooleanQueryParam: vi.fn(),
	getSearchQuery: vi.fn()
}));
const types = vi.hoisted(() => ({ getInventoryType: vi.fn() }));
const filters = vi.hoisted(() => ({
	getInventoryTypeId: vi.fn(),
	parseInventoryQuery: vi.fn(),
	listInventoryFacets: vi.fn()
}));

vi.mock('$lib/server/inventory', () => inventory);
vi.mock('$lib/server/inventory-types', () => types);
vi.mock('$lib/server/inventory-filters', () => filters);

import { GET } from './+server';

const typeDefinition = {
	id: 'type-belt',
	properties: [{ id: 'property-color', name: 'Color', kind: 'text' }]
};
const query = {
	typeId: 'type-belt',
	showArchived: false,
	metadataFilters: []
};
const facets = [{ propertyId: 'property-color', values: [{ value: 'Black', count: 2 }] }];

function event(search: string, token = 'consumer-token') {
	const url = new URL(`https://example.test/api/inventory/facets?${search}`);
	return {
		url,
		request: new Request(url, { headers: { 'x-api-token': token } }),
		platform: {
			env: {
				DB: {},
				CONSUMER_API_TOKENS: 'consumer-token',
				PRODUCER_API_TOKENS: 'producer-token'
			}
		}
	} as never;
}

beforeEach(() => {
	inventory.requireApiRole.mockReset().mockResolvedValue('consumer');
	inventory.getBoundDb.mockClear();
	filters.getInventoryTypeId.mockReset().mockReturnValue('type-belt');
	filters.parseInventoryQuery.mockReset().mockReturnValue(query);
	filters.listInventoryFacets.mockReset().mockResolvedValue(facets);
	types.getInventoryType.mockReset().mockResolvedValue(typeDefinition);
});

describe('inventory facets API', () => {
	it('requests authorization for both consumer and producer roles before listing facets', async () => {
		const response = await GET(event('typeId=type-belt&q=Facet'));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ facets });
		expect(inventory.requireApiRole).toHaveBeenCalledWith(
			expect.any(Request),
			expect.any(Object),
			['consumer', 'producer'],
			{ binding: 'd1' }
		);
		expect(types.getInventoryType).toHaveBeenCalledWith({ binding: 'd1' }, 'type-belt');
		expect(filters.parseInventoryQuery).toHaveBeenCalledWith(
			expect.any(URL),
			typeDefinition.properties
		);
		expect(filters.listInventoryFacets).toHaveBeenCalledWith(
			{ binding: 'd1' },
			query,
			typeDefinition
		);
	});

	it('requires typeId before querying facet values', async () => {
		filters.getInventoryTypeId.mockReturnValueOnce(undefined);

		const response = await GET(event('q=Facet'));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'typeId is required when listing inventory facets.',
			code: 'INVALID_REQUEST',
			field: 'typeId'
		});
		expect(filters.listInventoryFacets).not.toHaveBeenCalled();
	});

	it('returns structured type and query validation errors without querying facets', async () => {
		types.getInventoryType.mockResolvedValueOnce(null);
		const missingType = await GET(event('typeId=missing'));

		expect(missingType.status).toBe(404);
		await expect(missingType.json()).resolves.toMatchObject({
			code: 'TYPE_NOT_FOUND',
			field: 'typeId'
		});
		expect(filters.listInventoryFacets).not.toHaveBeenCalled();

		types.getInventoryType.mockResolvedValueOnce(typeDefinition);
		filters.parseInventoryQuery.mockImplementationOnce(() => {
			throw new InventoryRouteError('INVALID_REQUEST', 'Invalid facet filter.', 400, 'meta');
		});
		const invalidQuery = await GET(event('typeId=type-belt&meta[bad]=value'));

		expect(invalidQuery.status).toBe(400);
		await expect(invalidQuery.json()).resolves.toMatchObject({
			code: 'INVALID_REQUEST',
			field: 'meta'
		});
		expect(filters.listInventoryFacets).not.toHaveBeenCalled();
	});
});
