import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBoundDb,
	getSearchQuery,
	handleInventoryError,
	listInventory,
	requireApiRole
} from '$lib/server/inventory';

export const GET: RequestHandler = async ({ platform, request, url }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['consumer', 'producer'], d1);

		const inventory = await listInventory(getBoundDb(platform), {
			query: getSearchQuery(url)
		});

		return json({ inventory });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
