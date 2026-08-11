import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createApiKey,
	getBoundDb,
	listApiKeys,
	revokeApiKey,
	type ApiRole
} from '$lib/server/inventory';

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const session = cookies.get('admin_session');
	if (session !== 'authenticated') {
		throw redirect(303, '/login');
	}

	if (!platform?.env?.DB) {
		return {
			databaseConfigured: false,
			databaseMessage: 'Add your Cloudflare D1 binding to manage API keys.',
			keys: []
		};
	}

	try {
		const d1 = getBoundDb(platform);
		const keys = await listApiKeys(d1);
		return {
			databaseConfigured: true,
			databaseMessage: '',
			keys
		};
	} catch (cause) {
		return {
			databaseConfigured: true,
			databaseMessage: 'Could not load API keys. Ensure D1 migration has been executed.',
			keys: []
		};
	}
};

export const actions: Actions = {
	create: async ({ request, cookies, platform }) => {
		const session = cookies.get('admin_session');
		if (session !== 'authenticated') {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const role = data.get('role')?.toString() as ApiRole;

		if (!name.trim()) {
			return fail(400, { createError: 'API key name is required.' });
		}
		if (role !== 'producer' && role !== 'consumer') {
			return fail(400, { createError: 'Role must be producer or consumer.' });
		}

		try {
			const d1 = getBoundDb(platform);
			const newKey = await createApiKey(d1, name, role);
			return { createdKey: newKey };
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Failed to create API key.';
			return fail(400, { createError: message });
		}
	},
	revoke: async ({ request, cookies, platform }) => {
		const session = cookies.get('admin_session');
		if (session !== 'authenticated') {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const id = data.get('id')?.toString() || '';

		if (!id) {
			return fail(400, { revokeError: 'Key ID is required.' });
		}

		try {
			const d1 = getBoundDb(platform);
			await revokeApiKey(d1, id);
			return { revokedId: id };
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Failed to revoke API key.';
			return fail(400, { revokeError: message });
		}
	}
};
