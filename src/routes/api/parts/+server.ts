import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createPart,
	getBoundDb,
	handleInventoryError,
	requireApiRole
} from '$lib/server/inventory';

export const POST: RequestHandler = async ({ platform, request }) => {
	try {
		requireApiRole(request, platform?.env, ['producer']);

		const part = await createPart(getBoundDb(platform), await request.json());
		return json({ part }, { status: 201 });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
