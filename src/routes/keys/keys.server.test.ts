import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSession, verifyAdminSession } from '$lib/server/admin-auth';

const inventory = vi.hoisted(() => ({
	createApiKey: vi.fn(),
	getBoundDb: vi.fn(),
	listApiKeys: vi.fn(),
	revokeApiKey: vi.fn()
}));

vi.mock('$lib/server/inventory', () => ({
	createApiKey: inventory.createApiKey,
	getBoundDb: inventory.getBoundDb,
	listApiKeys: inventory.listApiKeys,
	revokeApiKey: inventory.revokeApiKey
}));

import { actions as keyActions, load as loadKeys } from './+page.server';
import { actions as loginActions, load as loadLogin } from '../login/+page.server';

const secrets = {
	ADMIN_PASSWORD: 'correct-administrator-password',
	SESSION_SECRET: 'keys-route-session-secret'
};
const legacyCookie = ['authentic', 'ated'].join('');

function createCookies(initialValue?: string) {
	let value = initialValue;
	let setName: string | undefined;
	let setOptions: Record<string, unknown> | undefined;
	let deleted = false;
	let deletedName: string | undefined;
	let deleteOptions: Record<string, unknown> | undefined;

	return {
		cookies: {
			get: (name: string) => (name === 'admin_session' ? value : undefined),
			set: (name: string, nextValue: string, options: Record<string, unknown>) => {
				value = nextValue;
				setName = name;
				setOptions = options;
			},
			delete: (name: string, options: Record<string, unknown>) => {
				value = undefined;
				deleted = true;
				deletedName = name;
				deleteOptions = options;
			}
		},
		get value() {
			return value;
		},
		get setOptions() {
			return setOptions;
		},
		get setName() {
			return setName;
		},
		get deleted() {
			return deleted;
		},
		get deletedName() {
			return deletedName;
		},
		get deleteOptions() {
			return deleteOptions;
		}
	};
}

function formRequest(values: Record<string, string>): Request {
	const form = new FormData();
	for (const [name, value] of Object.entries(values)) {
		form.set(name, value);
	}

	return new Request('https://inventory.example.test', { method: 'POST', body: form });
}

async function validSession(): Promise<string> {
	return createAdminSession(secrets.SESSION_SECRET);
}

beforeEach(() => {
	inventory.getBoundDb.mockReset().mockReturnValue({});
	inventory.listApiKeys.mockReset().mockResolvedValue([]);
	inventory.createApiKey.mockReset().mockResolvedValue({
		item: {
			id: 'key-1',
			name: 'Warehouse scanner',
			keyPrefix: 'bio_prod_display-',
			role: 'producer',
			createdAt: '2026-08-11T12:00:00.000Z',
			revokedAt: null
		},
		token: 'bio_prod_one-time-secret'
	});
	inventory.revokeApiKey.mockReset().mockResolvedValue(undefined);
});

describe('administrator login routes', () => {
	it('creates a verifiable signed cookie after a successful login', async () => {
		const jar = createCookies();

		await expect(
			loginActions.login({
				request: formRequest({ password: secrets.ADMIN_PASSWORD }),
				cookies: jar.cookies,
				platform: { env: secrets },
				url: new URL('https://inventory.example.test/login')
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/keys' });

		expect(jar.value).not.toBe(legacyCookie);
		await expect(verifyAdminSession(jar.value, secrets.SESSION_SECRET)).resolves.toBe(true);
		expect(jar.setName).toBe('admin_session');
		expect(jar.setOptions).toEqual({
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7
		});
	});

	it('keeps remote HTTP cookies secure and relaxes only local HTTP development', async () => {
		for (const [url, expectedSecure] of [
			['http://inventory.example.test/login', true],
			['http://localhost:5173/login', false],
			['http://127.0.0.1:5173/login', false]
		] as const) {
			const jar = createCookies();

			await expect(
				loginActions.login({
					request: formRequest({ password: secrets.ADMIN_PASSWORD }),
					cookies: jar.cookies,
					platform: { env: secrets },
					url: new URL(url)
				} as never)
			).rejects.toMatchObject({ status: 303, location: '/keys' });
			expect(jar.setOptions?.secure).toBe(expectedSecure);
		}
	});

	it('fails closed with a sanitized error when secrets are missing', async () => {
		const jar = createCookies();
		const result = await loginActions.login({
			request: formRequest({ password: 'admin' }),
			cookies: jar.cookies,
			platform: { env: {} },
			url: new URL('https://inventory.example.test/login')
		} as never);

		expect(result).toEqual({
			status: 500,
			data: { error: 'Administrator authentication is not configured.' }
		});
		expect(jar.value).toBeUndefined();
	});

	it('redirects only a valid signed session away from login', async () => {
		const validJar = createCookies(await validSession());
		await expect(
			loadLogin({ cookies: validJar.cookies, platform: { env: secrets } } as never)
		).rejects.toMatchObject({ status: 303, location: '/keys' });

		for (const cookie of [undefined, legacyCookie]) {
			const anonymousJar = createCookies(cookie);
			await expect(
				loadLogin({ cookies: anonymousJar.cookies, platform: { env: secrets } } as never)
			).resolves.toEqual({});
		}
	});

	it('deletes the session through the POST logout action', async () => {
		const jar = createCookies(await validSession());

		await expect(loginActions.logout({ cookies: jar.cookies } as never)).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
		expect(jar.deleted).toBe(true);
		expect(jar.deletedName).toBe('admin_session');
		expect(jar.deleteOptions).toEqual({ path: '/' });
		expect(jar.value).toBeUndefined();
		await expect(verifyAdminSession(jar.value, secrets.SESSION_SECRET)).resolves.toBe(false);
	});
});

describe('API key route guards', () => {
	it('rejects a missing or forged session from the protected load', async () => {
		for (const cookie of [undefined, legacyCookie]) {
			const jar = createCookies(cookie);

			await expect(
				loadKeys({ cookies: jar.cookies, platform: { env: secrets } } as never)
			).rejects.toMatchObject({ status: 303, location: '/login' });
		}
	});

	it('rejects a missing or forged session from create', async () => {
		for (const cookie of [undefined, legacyCookie]) {
			const jar = createCookies(cookie);

			await expect(
				keyActions.create({
					request: formRequest({ name: 'Scanner', role: 'producer' }),
					cookies: jar.cookies,
					platform: { env: secrets }
				} as never)
			).rejects.toMatchObject({ status: 303, location: '/login' });
		}
	});

	it('rejects a missing or forged session from revoke', async () => {
		for (const cookie of [undefined, legacyCookie]) {
			const jar = createCookies(cookie);

			await expect(
				keyActions.revoke({
					request: formRequest({ id: 'key-1' }),
					cookies: jar.cookies,
					platform: { env: secrets }
				} as never)
			).rejects.toMatchObject({ status: 303, location: '/login' });
		}
	});

	it('returns the token only in the successful create action response', async () => {
		const jar = createCookies(await validSession());
		const result = await keyActions.create({
			request: formRequest({ name: 'Warehouse scanner', role: 'producer' }),
			cookies: jar.cookies,
			platform: { env: { ...secrets, DB: {} } }
		} as never);

		expect(result).toEqual({
			createdKey: {
				item: {
					id: 'key-1',
					name: 'Warehouse scanner',
					keyPrefix: 'bio_prod_display-',
					role: 'producer',
					createdAt: '2026-08-11T12:00:00.000Z',
					revokedAt: null
				},
				token: 'bio_prod_one-time-secret'
			}
		});
	});

	it('does not expose internal exception details from key actions', async () => {
		const jar = createCookies(await validSession());
		inventory.createApiKey.mockRejectedValueOnce(
			new Error('SESSION_SECRET=do-not-return-this-value')
		);
		inventory.revokeApiKey.mockRejectedValueOnce(
			new Error('ADMIN_PASSWORD=do-not-return-this-value')
		);

		const createResult = await keyActions.create({
			request: formRequest({ name: 'Warehouse scanner', role: 'producer' }),
			cookies: jar.cookies,
			platform: { env: { ...secrets, DB: {} } }
		} as never);
		const revokeResult = await keyActions.revoke({
			request: formRequest({ id: 'key-1' }),
			cookies: jar.cookies,
			platform: { env: { ...secrets, DB: {} } }
		} as never);

		expect(createResult).toEqual({
			status: 500,
			data: { createError: 'Failed to create API key.' }
		});
		expect(revokeResult).toEqual({
			status: 500,
			data: { revokeError: 'Failed to revoke API key.' }
		});
	});
});
