import { describe, expect, it } from 'vitest';
import {
	createAdminSession,
	requireAdminSecrets,
	verifyAdminPassword,
	verifyAdminSession
} from './admin-auth';

const configuredSecrets = {
	ADMIN_PASSWORD: 'correct-horse-battery-staple',
	SESSION_SECRET: 'session-signing-secret'
};

const now = Date.parse('2026-08-11T12:00:00.000Z');
const sevenDays = 7 * 24 * 60 * 60 * 1000;

describe('administrator authentication', () => {
	it('rejects missing administrator and session secrets', () => {
		expect(() => requireAdminSecrets({})).toThrow('ADMIN_PASSWORD');
		expect(() => requireAdminSecrets({ ADMIN_PASSWORD: 'configured' })).toThrow(
			'SESSION_SECRET'
		);
	});

	it('does not allow the legacy admin password without configuration', async () => {
		await expect(verifyAdminPassword('admin', {})).rejects.toThrow('ADMIN_PASSWORD');
	});

	it('accepts only the configured administrator password', async () => {
		await expect(verifyAdminPassword('correct-horse-battery-staple', configuredSecrets)).resolves.toBe(
			true
		);
		await expect(verifyAdminPassword('incorrect-password', configuredSecrets)).resolves.toBe(false);
	});

	it('accepts a valid signed session', async () => {
		const session = await createAdminSession(configuredSecrets.SESSION_SECRET, now);

		expect(session.split('.')).toHaveLength(2);
		await expect(verifyAdminSession(session, configuredSecrets.SESSION_SECRET, now)).resolves.toBe(true);
	});

	it('rejects a tampered signed session', async () => {
		const session = await createAdminSession(configuredSecrets.SESSION_SECRET, now);
		const [payload, signature] = session.split('.');
		const tampered = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;

		await expect(verifyAdminSession(tampered, configuredSecrets.SESSION_SECRET, now)).resolves.toBe(
			false
		);
	});

	it('rejects a non-canonical signature encoding', async () => {
		const session = await createAdminSession(configuredSecrets.SESSION_SECRET, now);
		const [payload, signature] = session.split('.');
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
		const finalCharacterIndex = alphabet.indexOf(signature.at(-1)!);
		const nonCanonicalSignature = `${signature.slice(0, -1)}${alphabet[finalCharacterIndex ^ 1]}`;

		await expect(
			verifyAdminSession(`${payload}.${nonCanonicalSignature}`, configuredSecrets.SESSION_SECRET, now)
		).resolves.toBe(false);
	});

	it('rejects an expired signed session', async () => {
		const session = await createAdminSession(configuredSecrets.SESSION_SECRET, now);

		await expect(
			verifyAdminSession(session, configuredSecrets.SESSION_SECRET, now + sevenDays)
		).resolves.toBe(false);
	});
});
