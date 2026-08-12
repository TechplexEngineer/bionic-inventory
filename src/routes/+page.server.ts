import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyAdminSession } from '$lib/server/admin-auth';
import {
	getBooleanQueryParam,
	getBoundDb,
	getSearchQuery,
	isMissingSchemaError,
	listHistory,
	listInventory,
	setPartArchivedStateById
} from '$lib/server/inventory';

const adminSessionCookie = 'admin_session';

async function hasAdminSession(
	cookies: { get(name: string): string | undefined },
	platform: App.Platform | undefined
): Promise<boolean> {
	return verifyAdminSession(cookies.get(adminSessionCookie), platform?.env?.SESSION_SECRET ?? '');
}

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform?.env?.DB) {
		return {
			databaseConfigured: false,
			databaseReady: false,
			databaseMessage: 'Add your Cloudflare D1 binding to start using the inventory service.',
			query: getSearchQuery(url) ?? '',
			showArchived: getBooleanQueryParam(url, 'showArchived'),
			parts: [],
			history: []
		};
	}

	const d1 = getBoundDb(platform);
	const query = getSearchQuery(url);
	const showArchived = getBooleanQueryParam(url, 'showArchived');

	try {
		return {
			databaseConfigured: true,
			databaseReady: true,
			databaseMessage: '',
			query: query ?? '',
			showArchived,
			parts: await listInventory(d1, { query, showArchived }),
			history: await listHistory(d1, { limit: 100 })
		};
	} catch (cause) {
		return {
			databaseConfigured: true,
			databaseReady: false,
			databaseMessage: isMissingSchemaError(cause)
				? 'Run the D1 migration before using the app so the parts, inventory log, and FTS tables exist.'
				: 'The inventory data could not be loaded. Verify your D1 binding, schema, and local database state.',
			query: query ?? '',
			showArchived,
			parts: [],
			history: []
		};
	}
};

export const actions: Actions = {
	archive: async ({ request, cookies, platform }) => {
		if (!(await hasAdminSession(cookies, platform))) {
			return fail(403, { archiveError: 'Administrator access is required.' });
		}

		const id = (await request.formData()).get('id')?.toString() ?? '';
		if (!id) {
			return fail(400, { archiveError: 'Part ID is required.' });
		}

		try {
			await setPartArchivedStateById(getBoundDb(platform), id, true);
			return { archivedId: id };
		} catch (cause) {
			const status =
				typeof cause === 'object' && cause !== null && 'status' in cause && typeof cause.status === 'number'
					? cause.status
					: 500;
			return fail(status, {
				archiveError:
					cause instanceof Error && cause.message ? cause.message : 'Failed to archive the part.'
			});
		}
	},
	unarchive: async ({ request, cookies, platform }) => {
		if (!(await hasAdminSession(cookies, platform))) {
			return fail(403, { archiveError: 'Administrator access is required.' });
		}

		const id = (await request.formData()).get('id')?.toString() ?? '';
		if (!id) {
			return fail(400, { archiveError: 'Part ID is required.' });
		}

		try {
			await setPartArchivedStateById(getBoundDb(platform), id, false);
			return { unarchivedId: id };
		} catch (cause) {
			const status =
				typeof cause === 'object' && cause !== null && 'status' in cause && typeof cause.status === 'number'
					? cause.status
					: 500;
			return fail(status, {
				archiveError:
					cause instanceof Error && cause.message ? cause.message : 'Failed to unarchive the part.'
			});
		}
	}
};
