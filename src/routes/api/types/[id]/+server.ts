import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryRouteError } from '$lib/server/inventory-errors';
import { getBoundDb, handleInventoryError, requireApiRole } from '$lib/server/inventory';
import {
	deleteInventoryType,
	getInventoryType,
	replaceInventoryType
} from '$lib/server/inventory-types';

export const GET: RequestHandler = async ({ params, platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['consumer', 'producer'], d1);

		const type = await getInventoryType(getBoundDb(platform), params.id);
		if (!type) {
			throw new InventoryRouteError('TYPE_NOT_FOUND', 'Inventory type not found.', 404);
		}
		return json({ type });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};

export const PUT: RequestHandler = async ({ params, platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		const type = await replaceInventoryType(
			getBoundDb(platform),
			params.id,
			await request.json()
		);
		return json({ type });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};

export const DELETE: RequestHandler = async ({ params, platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		await deleteInventoryType(getBoundDb(platform), params.id);
		return new Response(null, { status: 204 });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
