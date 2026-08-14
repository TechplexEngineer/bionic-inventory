import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryRouteError } from '$lib/server/inventory-errors';

const partWrites = vi.hoisted(() => ({
	updatePart: vi.fn()
}));

vi.mock('$lib/server/parts', () => partWrites);

import { PATCH } from './[id]/+server';

const samplePart = {
	id: 'part-1',
	name: 'Timing Belt',
	mfgPartNumber: 'GT2-120',
	description: '',
	metadata: { Width: 12 },
	inventoryTypeId: 'type-belt',
	inventoryTypeName: 'Belt',
	quantity: 0,
	archivedAt: null,
	updatedAt: '2026-08-14T12:00:00.001Z'
};

function event(token: string, body: string) {
	return {
		request: new Request('https://inventory.example.test/api/parts/part-1', {
			method: 'PATCH',
			headers: { 'x-api-token': token, 'content-type': 'application/json' },
			body
		}),
		params: { id: samplePart.id },
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
	partWrites.updatePart.mockReset().mockResolvedValue(samplePart);
});

describe('part PATCH API', () => {
	it('authorizes producers and passes the path ID with the partial payload', async () => {
		const payload = {
			metadata: { Width: 12 },
			updatedAt: '2026-08-14T12:00:00.000Z'
		};

		const response = await PATCH(event('producer-token', JSON.stringify(payload)));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ part: samplePart });
		expect(partWrites.updatePart).toHaveBeenCalledWith({}, samplePart.id, payload);
	});

	it('rejects consumers before parsing the write payload', async () => {
		const response = await PATCH(event('consumer-token', '{not-json'));

		expect(response.status).toBe(403);
		expect(partWrites.updatePart).not.toHaveBeenCalled();
	});

	it('maps optimistic conflicts through the shared error handler', async () => {
		partWrites.updatePart.mockRejectedValueOnce(
			new InventoryRouteError(
				'PART_UPDATE_CONFLICT',
				'The part changed after it was read.',
				409,
				'updatedAt'
			)
		);

		const response = await PATCH(
			event(
				'producer-token',
				JSON.stringify({ updatedAt: '2026-08-14T12:00:00.000Z' })
			)
		);

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: 'The part changed after it was read.',
			code: 'PART_UPDATE_CONFLICT',
			field: 'updatedAt'
		});
	});
});
