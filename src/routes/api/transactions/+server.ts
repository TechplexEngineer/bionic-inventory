import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createTransaction,
	getBoundDb,
	handleInventoryError,
	requireApiRole
} from '$lib/server/inventory';

export const POST: RequestHandler = async ({ platform, request }) => {
	try {
		const d1 = platform?.env?.DB ? getBoundDb(platform) : undefined;
		await requireApiRole(request, platform?.env, ['producer'], d1);

		const transaction = await createTransaction(getBoundDb(platform), await request.json());
		return json({ transaction }, { status: 201 });
	} catch (cause) {
		return handleInventoryError(cause);
	}
};
