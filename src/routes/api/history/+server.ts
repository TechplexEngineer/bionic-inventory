import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBoundDb,
	getLimit,
	handleInventoryError,
	listHistory,
	requireApiRole
} from '$lib/server/inventory';

export const GET: RequestHandler = async ({ platform, request, url }) => {
	try {
		requireApiRole(request, platform?.env, ['consumer', 'producer']);

		const history = await listHistory(getBoundDb(platform), {
			partId: url.searchParams.get('partId')?.trim() || undefined,
			limit: getLimit(url, 100)
		});

		return json({ history });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
