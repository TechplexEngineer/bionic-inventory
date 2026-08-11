const encoder = new TextEncoder();
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

type AdminEnv = {
	ADMIN_PASSWORD?: unknown;
	SESSION_SECRET?: unknown;
};

type SessionPayload = {
	v: 1;
	exp: number;
	nonce: string;
};

export function requireAdminSecrets(env: AdminEnv): {
	adminPassword: string;
	sessionSecret: string;
} {
	const adminPassword = requireSecret(env.ADMIN_PASSWORD, 'ADMIN_PASSWORD');
	const sessionSecret = requireSecret(env.SESSION_SECRET, 'SESSION_SECRET');

	return { adminPassword, sessionSecret };
}

export async function verifyAdminPassword(password: string, env: AdminEnv): Promise<boolean> {
	const { adminPassword } = requireAdminSecrets(env);
	const [actualDigest, expectedDigest] = await Promise.all([
		sha256(password),
		sha256(adminPassword)
	]);

	return timingSafeEqual(actualDigest, expectedDigest);
}

export async function createAdminSession(secret: string, now = Date.now()): Promise<string> {
	const sessionSecret = requireSecret(secret, 'SESSION_SECRET');
	const payload: SessionPayload = {
		v: 1,
		exp: now + sessionLifetimeMs,
		nonce: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)))
	};
	const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
	const signature = await sign(encodedPayload, sessionSecret);

	return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export async function verifyAdminSession(
	cookie: string | null | undefined,
	secret: string,
	now = Date.now()
): Promise<boolean> {
	let encodedPayload: string;
	let encodedSignature: string;

	if (!cookie || cookie.split('.').length !== 2) {
		return false;
	}

	[encodedPayload, encodedSignature] = cookie.split('.');
	if (!encodedPayload || !encodedSignature) {
		return false;
	}

	try {
		const sessionSecret = requireSecret(secret, 'SESSION_SECRET');
		const payload = parseSessionPayload(base64UrlDecode(encodedPayload));
		if (!payload || payload.v !== 1 || payload.exp <= now) {
			return false;
		}

		const expectedSignature = await sign(encodedPayload, sessionSecret);
		return timingSafeEqual(base64UrlDecode(encodedSignature), expectedSignature);
	} catch {
		return false;
	}
}

function requireSecret(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${name} must be configured.`);
	}

	return value;
}

async function sha256(value: string): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function sign(value: string, secret: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left[index] ^ right[index];
	}

	return difference === 0;
}

function parseSessionPayload(bytes: Uint8Array): SessionPayload | null {
	const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
	if (typeof parsed !== 'object' || parsed === null) {
		return null;
	}

	const candidate = parsed as Record<string, unknown>;
	const exp = candidate.exp;
	const nonce = candidate.nonce;
	if (
		candidate.v !== 1 ||
		typeof exp !== 'number' ||
		!Number.isFinite(exp) ||
		typeof nonce !== 'string' ||
		nonce.length === 0
	) {
		return null;
	}

	return parsed as SessionPayload;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) {
		throw new Error('Invalid base64url value.');
	}

	const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	if (base64UrlEncode(bytes) !== value) {
		throw new Error('Non-canonical base64url value.');
	}

	return bytes;
}
