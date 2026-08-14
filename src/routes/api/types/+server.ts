import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBoundDb, handleInventoryError, requireApiRole } from '$lib/server/inventory';
import { createInventoryType, listInventoryTypes } from '$lib/server/inventory-types';

export const GET: RequestHandler = async ({ platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['consumer', 'producer'], d1);

		const types = await listInventoryTypes(getBoundDb(platform));
		return json({ types });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};

export const POST: RequestHandler = async ({ platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		const type = await createInventoryType(getBoundDb(platform), await request.json());
		return json({ type }, { status: 201 });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
