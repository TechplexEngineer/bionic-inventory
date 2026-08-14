import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPart } from '$lib/server/parts';
import {
	getBoundDb,
	handleInventoryError,
	requireApiRole,
	setPartArchivedState
} from '$lib/server/inventory';

export const POST: RequestHandler = async ({ platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		const part = await createPart(getBoundDb(platform), await request.json());
		return json({ part }, { status: 201 });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};

export const PUT: RequestHandler = async ({ platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		const part = await setPartArchivedState(getBoundDb(platform), await request.json());
		return json({ part });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
