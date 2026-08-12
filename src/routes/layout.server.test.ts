import { describe, expect, it } from 'vitest';
import { createAdminSession } from '$lib/server/admin-auth';
import { load } from './+layout.server';

const sessionSecret = 'route-test-session-secret';
const legacyCookie = ['authentic', 'ated'].join('');

function createCookies(initialValue?: string) {
	return {
		cookies: {
			get: (name: string) => (name === 'admin_session' ? initialValue : undefined)
		}
	};
}

describe('root server layout administrator state', () => {
	it('reports a valid signed session as authenticated', async () => {
		const session = await createAdminSession(sessionSecret);
		const jar = createCookies(session);

		await expect(
			load({ cookies: jar.cookies, platform: { env: { SESSION_SECRET: sessionSecret } } } as never)
		).resolves.toEqual({ isAdmin: true });
	});

	it('reports a missing session as anonymous', async () => {
		const jar = createCookies();

		await expect(
			load({ cookies: jar.cookies, platform: { env: { SESSION_SECRET: sessionSecret } } } as never)
		).resolves.toEqual({ isAdmin: false });
	});

	it('reports forged and legacy literal sessions as anonymous', async () => {
		const session = await createAdminSession(sessionSecret);
		const forgedSession = `${session.slice(0, -1)}${session.endsWith('A') ? 'B' : 'A'}`;

		for (const cookie of [forgedSession, legacyCookie]) {
			const jar = createCookies(cookie);

			await expect(
				load({ cookies: jar.cookies, platform: { env: { SESSION_SECRET: sessionSecret } } } as never)
			).resolves.toEqual({ isAdmin: false });
		}
	});
});
