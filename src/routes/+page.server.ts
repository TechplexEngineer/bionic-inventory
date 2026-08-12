import type { PageServerLoad } from './$types';
import {
	getBoundDb,
	getSearchQuery,
	isMissingSchemaError,
	listHistory,
	listInventory
} from '$lib/server/inventory';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform?.env?.DB) {
		return {
			databaseConfigured: false,
			databaseReady: false,
			databaseMessage: 'Add your Cloudflare D1 binding to start using the inventory service.',
			query: getSearchQuery(url) ?? '',
			parts: [],
			history: []
		};
	}

	const d1 = getBoundDb(platform);
	const query = getSearchQuery(url);

	try {
		return {
			databaseConfigured: true,
			databaseReady: true,
			databaseMessage: '',
			query: query ?? '',
			parts: await listInventory(d1, { query }),
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
			parts: [],
			history: []
		};
	}
};
