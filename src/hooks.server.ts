import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import os from 'node:os';

if (!process.env.XDG_CONFIG_HOME) {
	process.env.XDG_CONFIG_HOME = os.tmpdir();
}

let platformProxyPromise: ReturnType<typeof import('wrangler').getPlatformProxy> | null = null;

export const handle: Handle = async ({ event, resolve }) => {
	if (dev) {
		if (!platformProxyPromise) {
			const { getPlatformProxy } = await import('wrangler');
			platformProxyPromise = getPlatformProxy({
				configPath: './wrangler.jsonc',
				persist: true
			});
		}

		const proxy = await platformProxyPromise;
		event.platform = proxy as unknown as App.Platform;
	}

	return resolve(event);
};
