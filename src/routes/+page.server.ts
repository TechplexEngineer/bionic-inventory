import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyAdminSession } from '$lib/server/admin-auth';
import {
	getArrayQueryParam,
	getBooleanQueryParam,
	getBoundDb,
	getSearchQuery,
	isMissingSchemaError,
	listHistory,
	listFilteredInventory,
	setPartArchivedStateById
} from '$lib/server/inventory';
import { listInventoryTypes, type InventoryTypeDefinition } from '$lib/server/inventory-types';
import {
	getInventoryTypeId,
	listInventoryFacets,
	parseInventoryQuery,
	type InventoryQuery,
	type MetadataFilterOperator
} from '$lib/server/inventory-filters';

const adminSessionCookie = 'admin_session';
const rawMetadataFilterPattern = /^meta\[([^\[\]]+)\]\[(exact|contains|min|max)\]$/;

function getRawInventoryQuery(url: URL, query: string | undefined, showArchived: boolean): InventoryQuery {
	const metadataFilters: InventoryQuery['metadataFilters'] = [];
	for (const [key, value] of url.searchParams) {
		const match = rawMetadataFilterPattern.exec(key);
		if (!match) continue;
		metadataFilters.push({
			propertyId: match[1],
			operator: match[2] as MetadataFilterOperator,
			value
		});
	}

	const mfgPartNumber = getArrayQueryParam(url, 'mfgPartNumber');
	const id = getArrayQueryParam(url, 'id');
	const typeId = url.searchParams.get('typeId')?.trim();
	return {
		...(query ? { query } : {}),
		...(mfgPartNumber ? { mfgPartNumber } : {}),
		...(id ? { id } : {}),
		showArchived,
		...(typeId ? { typeId } : {}),
		metadataFilters
	};
}

async function hasAdminSession(
	cookies: { get(name: string): string | undefined },
	platform: App.Platform | undefined
): Promise<boolean> {
	return verifyAdminSession(cookies.get(adminSessionCookie), platform?.env?.SESSION_SECRET ?? '');
}

export const load: PageServerLoad = async ({ platform, url }) => {
	const query = getSearchQuery(url);
	const showArchived = getBooleanQueryParam(url, 'showArchived');
	const fallbackFilters = getRawInventoryQuery(url, query, showArchived);

	if (!platform?.env?.DB) {
		return {
			databaseConfigured: false,
			databaseReady: false,
			databaseMessage: 'Add your Cloudflare D1 binding to start using the inventory service.',
			query: query ?? '',
			showArchived,
			inventoryTypes: [],
			selectedType: null,
			filters: fallbackFilters,
			facets: [],
			parts: [],
			history: []
		};
	}

	const d1 = getBoundDb(platform);
	let inventoryTypes: InventoryTypeDefinition[] = [];
	let selectedType: InventoryTypeDefinition | null = null;
	let filters = fallbackFilters;

	try {
		inventoryTypes = await listInventoryTypes(d1);
		const selectedTypeId = getInventoryTypeId(url);
		selectedType = inventoryTypes.find((inventoryType) => inventoryType.id === selectedTypeId) ?? null;
		filters = parseInventoryQuery(url, selectedType?.properties);
		const [parts, history, facets] = await Promise.all([
			listFilteredInventory(d1, filters, selectedType),
			listHistory(d1, { limit: 100 }),
			selectedType ? listInventoryFacets(d1, filters, selectedType) : Promise.resolve([])
		]);

		return {
			databaseConfigured: true,
			databaseReady: true,
			databaseMessage: '',
			query: query ?? '',
			showArchived,
			inventoryTypes,
			selectedType,
			filters,
			facets,
			parts,
			history
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
			inventoryTypes,
			selectedType,
			filters,
			facets: [],
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
