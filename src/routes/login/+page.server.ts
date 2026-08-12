import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createAdminSession,
	requireAdminSecrets,
	verifyAdminPassword,
	verifyAdminSession
} from '$lib/server/admin-auth';

const adminSessionCookie = 'admin_session';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

function isLocalHttpDevelopment(url: URL): boolean {
	return (
		url.protocol === 'http:' &&
		(url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
	);
}

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const sessionSecret = platform?.env?.SESSION_SECRET ?? '';
	if (await verifyAdminSession(cookies.get(adminSessionCookie), sessionSecret)) {
		throw redirect(303, '/keys');
	}
	return {};
};

export const actions: Actions = {
	login: async ({ request, cookies, platform, url }) => {
		const data = await request.formData();
		const password = data.get('password')?.toString() || '';
		let adminPassword: string;
		let sessionSecret: string;

		try {
			({ adminPassword, sessionSecret } = requireAdminSecrets(platform?.env ?? {}));
		} catch {
			return fail(500, { error: 'Administrator authentication is not configured.' });
		}

		if (
			!(await verifyAdminPassword(password, {
				ADMIN_PASSWORD: adminPassword,
				SESSION_SECRET: sessionSecret
			}))
		) {
			return fail(400, { error: 'Invalid password.' });
		}

		const session = await createAdminSession(sessionSecret);
		cookies.set(adminSessionCookie, session, {
			path: '/',
			httpOnly: true,
			secure: !isLocalHttpDevelopment(url),
			sameSite: 'lax',
			maxAge: sessionMaxAgeSeconds
		});

		throw redirect(303, '/keys');
	},
	logout: async ({ cookies }) => {
		cookies.delete(adminSessionCookie, { path: '/' });
		throw redirect(303, '/login');
	}
};
