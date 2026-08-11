import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getArrayQueryParam,
	getBoundDb,
	getSearchQuery,
	handleInventoryError,
	listInventory,
	requireApiRole
} from '$lib/server/inventory';

export const GET: RequestHandler = async ({ platform, request, url }) => {
	try {
		requireApiRole(request, platform?.env, ['consumer', 'producer']);

		const inventory = await listInventory(getBoundDb(platform), {
			query: getSearchQuery(url),
			mfgPartNumber: getArrayQueryParam(url, 'mfgPartNumber'),
			id: getArrayQueryParam(url, 'id')
		});

		return json({ inventory });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
