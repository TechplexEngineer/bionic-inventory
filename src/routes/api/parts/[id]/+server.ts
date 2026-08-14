import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updatePart } from '$lib/server/parts';
import { getBoundDb, handleInventoryError, requireApiRole } from '$lib/server/inventory';

export const PATCH: RequestHandler = async ({ params, platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		const part = await updatePart(getBoundDb(platform), params.id, await request.json());
		return json({ part });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
