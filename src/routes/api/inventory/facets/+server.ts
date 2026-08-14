import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBoundDb, handleInventoryError, requireApiRole } from '$lib/server/inventory';
import { InventoryRouteError } from '$lib/server/inventory-errors';
import { getInventoryType } from '$lib/server/inventory-types';
import {
	getInventoryTypeId,
	listInventoryFacets,
	parseInventoryQuery
} from '$lib/server/inventory-filters';

export const GET: RequestHandler = async ({ platform, request, url }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['consumer', 'producer'], d1);
		const database = getBoundDb(platform);
		const typeId = getInventoryTypeId(url);
		if (!typeId) {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				'typeId is required when listing inventory facets.',
				400,
				'typeId'
			);
		}

		const inventoryType = await getInventoryType(database, typeId);
		if (!inventoryType) {
			throw new InventoryRouteError('TYPE_NOT_FOUND', 'Inventory type not found.', 404, 'typeId');
		}

		const query = parseInventoryQuery(url, inventoryType.properties);
		const facets = await listInventoryFacets(database, query);
		return json({ facets });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
