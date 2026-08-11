import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyAdminPassword } from '$lib/server/inventory';

export const load: PageServerLoad = async ({ cookies }) => {
	const session = cookies.get('admin_session');
	if (session === 'authenticated') {
		throw redirect(303, '/keys');
	}
	return {};
};

export const actions: Actions = {
	login: async ({ request, cookies, platform }) => {
		const data = await request.formData();
		const password = data.get('password')?.toString() || '';

		if (!verifyAdminPassword(password, platform?.env)) {
			return fail(400, { error: 'Invalid password. Please check your environment configured password.' });
		}

		cookies.set('admin_session', 'authenticated', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7
		});

		throw redirect(303, '/keys');
	},
	logout: async ({ cookies }) => {
		cookies.delete('admin_session', { path: '/' });
		throw redirect(303, '/login');
	}
};
