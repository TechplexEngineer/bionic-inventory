import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventory = vi.hoisted(() => ({
	listInventory: vi.fn(),
	listFilteredInventory: vi.fn(),
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

vi.mock('$lib/server/inventory', () => inventory);
vi.mock('$lib/server/inventory-types', () => types);

import { GET } from './+server';

const typeDefinition = {
	id: 'type-belt',
	name: 'Belt',
	normalizedName: 'belt',
	createdAt: '2026-08-14T12:00:00.000Z',
	updatedAt: '2026-08-14T12:00:00.000Z',
	properties: [
		{
			id: 'property-material',
			inventoryTypeId: 'type-belt',
			name: 'Material',
			normalizedName: 'material',
			kind: 'text',
			required: false,
			minimum: null,
			maximum: null,
			createdAt: '2026-08-14T12:00:00.000Z',
			updatedAt: '2026-08-14T12:00:00.000Z'
		}
	]
};

function event(search: string) {
	const url = new URL(`https://example.test/api/inventory?${search}`);
	return {
		url,
		request: new Request(url, { headers: { 'x-api-token': 'consumer-token' } }),
		platform: { env: { DB: {} } }
	} as never;
}

beforeEach(() => {
	inventory.listInventory.mockReset();
	inventory.listFilteredInventory.mockReset().mockResolvedValue([{ id: 'part-1' }]);
	inventory.requireApiRole.mockClear();
	inventory.getBoundDb.mockClear();
	inventory.getSearchQuery.mockImplementation((url: URL) => url.searchParams.get('q') ?? undefined);
	inventory.getArrayQueryParam.mockImplementation((url: URL, name: string) => {
		const values = url.searchParams.getAll(name);
		return values.length > 0 ? values : undefined;
	});
	inventory.getBooleanQueryParam.mockImplementation(
		(url: URL, name: string) => url.searchParams.get(name) === 'true'
	);
	types.getInventoryType.mockReset().mockResolvedValue(typeDefinition);
});

describe('inventory API filters', () => {
	it('loads the selected definition before passing a validated metadata query to the shared reader', async () => {
		const response = await GET(
			event('typeId=type-belt&meta[property-material][contains]=nyl&showArchived=true')
		);

		expect(response.status).toBe(200);
		expect(types.getInventoryType).toHaveBeenCalledWith({ binding: 'd1' }, 'type-belt');
		expect(inventory.listFilteredInventory).toHaveBeenCalledWith(
			{ binding: 'd1' },
			{
				typeId: 'type-belt',
				showArchived: true,
				metadataFilters: [
					{ propertyId: 'property-material', operator: 'contains', value: 'nyl' }
				]
			}
		);
		expect(inventory.listInventory).not.toHaveBeenCalled();
	});

	it('returns a structured 404 before querying inventory when the selected type is unknown', async () => {
		types.getInventoryType.mockResolvedValueOnce(null);

		const response = await GET(event('typeId=missing'));

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ code: 'TYPE_NOT_FOUND', field: 'typeId' });
		expect(inventory.listFilteredInventory).not.toHaveBeenCalled();
	});
});
