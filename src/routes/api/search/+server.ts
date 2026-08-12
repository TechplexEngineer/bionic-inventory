import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBooleanQueryParam,
	getBoundDb,
	getSearchQuery,
	handleInventoryError,
	searchInventory,
	requireApiRole
} from '$lib/server/inventory';

export const GET: RequestHandler = async ({ platform, request, url }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['consumer', 'producer'], d1);

		const query = getSearchQuery(url);
		if (!query) {
			return json({ results: [] });
		}

		const results = await searchInventory(
			getBoundDb(platform),
			query,
			getBooleanQueryParam(url, 'showArchived')
		);
		return json({ results });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
