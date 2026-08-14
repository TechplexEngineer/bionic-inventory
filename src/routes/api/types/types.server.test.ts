import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryRouteError } from '$lib/server/inventory-errors';

const lifecycle = vi.hoisted(() => ({
	listInventoryTypes: vi.fn(),
	getInventoryType: vi.fn(),
	createInventoryType: vi.fn(),
	replaceInventoryType: vi.fn(),
	deleteInventoryType: vi.fn()
}));

vi.mock('$lib/server/inventory-types', () => lifecycle);

import { GET as listTypes, POST as createType } from './+server';
import { DELETE as deleteType, GET as getType, PUT as replaceType } from './[id]/+server';

const sampleType = {
	id: 'type-belt',
	name: 'Belt',
	normalizedName: 'belt',
	createdAt: '2026-08-14T10:00:00.000Z',
	updatedAt: '2026-08-14T12:00:00.000Z',
	properties: []
};

function event(
	method: string,
	token: string,
	options: { body?: string; id?: string } = {}
) {
	const url = new URL(`https://inventory.example.test/api/types/${options.id ?? ''}`);
	return {
		request: new Request(url, {
			method,
			headers: {
				'x-api-token': token,
				...(options.body ? { 'content-type': 'application/json' } : {})
			},
			...(options.body ? { body: options.body } : {})
		}),
		url,
		params: { id: options.id ?? '' },
		platform: {
			env: {
				DB: {},
				PRODUCER_API_TOKENS: 'producer-token',
				CONSUMER_API_TOKENS: 'consumer-token'
			}
		}
	} as never;
}

beforeEach(() => {
	lifecycle.listInventoryTypes.mockReset().mockResolvedValue([sampleType]);
	lifecycle.getInventoryType.mockReset().mockResolvedValue(sampleType);
	lifecycle.createInventoryType.mockReset().mockResolvedValue(sampleType);
	lifecycle.replaceInventoryType.mockReset().mockResolvedValue(sampleType);
	lifecycle.deleteInventoryType.mockReset().mockResolvedValue(undefined);
});

describe('inventory type API authorization and responses', () => {
	it.each(['consumer-token', 'producer-token'])('allows %s to list and read definitions', async (token) => {
		const listResponse = await listTypes(event('GET', token));
		const itemResponse = await getType(event('GET', token, { id: sampleType.id }));

		expect(listResponse.status).toBe(200);
		await expect(listResponse.json()).resolves.toEqual({ types: [sampleType] });
		expect(itemResponse.status).toBe(200);
		await expect(itemResponse.json()).resolves.toEqual({ type: sampleType });
	});

	it('requires producer access before parsing a write payload', async () => {
		const response = await createType(event('POST', 'consumer-token', { body: '{not-json' }));

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
		expect(lifecycle.createInventoryType).not.toHaveBeenCalled();
	});

	it('rejects consumer replacement and deletion before lifecycle writes', async () => {
		const replaceResponse = await replaceType(
			event('PUT', 'consumer-token', { id: sampleType.id, body: '{not-json' })
		);
		const deleteResponse = await deleteType(
			event('DELETE', 'consumer-token', { id: sampleType.id })
		);

		expect(replaceResponse.status).toBe(403);
		expect(deleteResponse.status).toBe(403);
		expect(lifecycle.replaceInventoryType).not.toHaveBeenCalled();
		expect(lifecycle.deleteInventoryType).not.toHaveBeenCalled();
	});

	it('creates a definition with a 201 response', async () => {
		const payload = { name: 'Belt', properties: [] };
		const response = await createType(
			event('POST', 'producer-token', { body: JSON.stringify(payload) })
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({ type: sampleType });
		expect(lifecycle.createInventoryType).toHaveBeenCalledWith({}, payload);
	});

	it('returns a structured 404 for an unknown item read', async () => {
		lifecycle.getInventoryType.mockResolvedValueOnce(null);

		const response = await getType(event('GET', 'consumer-token', { id: 'missing' }));

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: 'Inventory type not found.',
			code: 'TYPE_NOT_FOUND'
		});
	});

	it('maps normalized-name and stale-update conflicts', async () => {
		lifecycle.createInventoryType.mockRejectedValueOnce(
			new InventoryRouteError(
				'DUPLICATE_TYPE_NAME',
				'An inventory type with that name already exists.',
				409,
				'name'
			)
		);
		lifecycle.replaceInventoryType.mockRejectedValueOnce(
			new InventoryRouteError(
				'TYPE_UPDATE_CONFLICT',
				'The inventory type changed after it was read.',
				409,
				'updatedAt'
			)
		);

		const createResponse = await createType(
			event('POST', 'producer-token', { body: JSON.stringify({ name: 'BELT', properties: [] }) })
		);
		const replaceResponse = await replaceType(
			event('PUT', 'producer-token', {
				id: sampleType.id,
				body: JSON.stringify({
					name: 'Belt',
					properties: [],
					updatedAt: sampleType.updatedAt
				})
			})
		);

		expect(createResponse.status).toBe(409);
		await expect(createResponse.json()).resolves.toMatchObject({
			code: 'DUPLICATE_TYPE_NAME',
			field: 'name'
		});
		expect(replaceResponse.status).toBe(409);
		await expect(replaceResponse.json()).resolves.toMatchObject({
			code: 'TYPE_UPDATE_CONFLICT',
			field: 'updatedAt'
		});
	});

	it('passes one complete definition to atomic replacement', async () => {
		const payload = {
			name: 'Drive Belt',
			updatedAt: sampleType.updatedAt,
			properties: [{ id: 'property-width', name: 'Width', kind: 'numeric', required: false }]
		};

		const response = await replaceType(
			event('PUT', 'producer-token', { id: sampleType.id, body: JSON.stringify(payload) })
		);

		expect(response.status).toBe(200);
		expect(lifecycle.replaceInventoryType).toHaveBeenCalledWith({}, sampleType.id, payload);
	});

	it('returns the referenced-deletion conflict and otherwise deletes with 204', async () => {
		lifecycle.deleteInventoryType.mockRejectedValueOnce(
			new InventoryRouteError(
				'TYPE_IN_USE',
				'Inventory types assigned to parts cannot be deleted.',
				409
			)
		);

		const conflict = await deleteType(event('DELETE', 'producer-token', { id: sampleType.id }));
		const deleted = await deleteType(event('DELETE', 'producer-token', { id: sampleType.id }));

		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toMatchObject({ code: 'TYPE_IN_USE' });
		expect(deleted.status).toBe(204);
		expect(await deleted.text()).toBe('');
	});
});
