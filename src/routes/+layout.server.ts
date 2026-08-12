import type { LayoutServerLoad } from './$types';
import { verifyAdminSession } from '$lib/server/admin-auth';

const adminSessionCookie = 'admin_session';

export const load: LayoutServerLoad = async ({ cookies, platform }) => {
	const sessionSecret = platform?.env?.SESSION_SECRET ?? '';
	const isAdmin = await verifyAdminSession(cookies.get(adminSessionCookie), sessionSecret);

	return { isAdmin };
};
