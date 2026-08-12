import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyAdminSession } from '$lib/server/admin-auth';
import {
	createApiKey,
	getBoundDb,
	listApiKeys,
	revokeApiKey,
	type ApiRole
} from '$lib/server/inventory';

const adminSessionCookie = 'admin_session';

async function hasAdminSession(
	cookies: { get(name: string): string | undefined },
	platform: App.Platform | undefined
): Promise<boolean> {
	return verifyAdminSession(
		cookies.get(adminSessionCookie),
		platform?.env?.SESSION_SECRET ?? ''
	);
}

export const load: PageServerLoad = async ({ cookies, platform }) => {
	if (!(await hasAdminSession(cookies, platform))) {
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
	} catch {
		return {
			databaseConfigured: true,
			databaseMessage: 'Could not load API keys. Ensure D1 migration has been executed.',
			keys: []
		};
	}
};

export const actions: Actions = {
	create: async ({ request, cookies, platform }) => {
		if (!(await hasAdminSession(cookies, platform))) {
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
		} catch {
			return fail(500, { createError: 'Failed to create API key.' });
		}
	},
	revoke: async ({ request, cookies, platform }) => {
		if (!(await hasAdminSession(cookies, platform))) {
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
		} catch {
			return fail(500, { revokeError: 'Failed to revoke API key.' });
		}
	}
};
