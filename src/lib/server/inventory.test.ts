import { describe, expect, it } from 'vitest';
import {
	buildFtsQuery,
	createApiKey,
	extractApiToken,
	getArrayQueryParam,
	getBooleanQueryParam,
	getBoundDb,
	normalizePartInput,
	normalizePartArchiveInput,
	normalizeTransactionInput,
	parseConfiguredTokens,
	requireApiRole
} from './inventory';

type StoredApiKey = {
	keyHash: string;
	role: 'producer' | 'consumer';
	revokedAt: string | null;
};

type RecordedStatement = {
	sql: string;
	params: unknown[];
};

function d1Result(results: Record<string, unknown>[] = []) {
	return {
		success: true,
		meta: {
			changed_db: false,
			changes: 0,
			duration: 0,
			last_row_id: 0,
			rows_read: 0,
			rows_written: 0,
			size_after: 0
		},
		results
	};
}

function createD1Double(storedKeys: StoredApiKey[] = []) {
	const statements: RecordedStatement[] = [];

	const prepare = (statementSql: string) => {
		let params: unknown[] = [];
		const statement = {
			bind: (...boundParams: unknown[]) => {
				params = boundParams;
				return statement;
			},
			run: async () => {
				statements.push({ sql: statementSql, params });
				return d1Result();
			},
			all: async () => {
				statements.push({ sql: statementSql, params });
				return d1Result();
			},
			raw: async () => {
				statements.push({ sql: statementSql, params });
				const key = storedKeys.find((storedKey) => storedKey.keyHash === params[0]);
				return key ? [[key.role, key.revokedAt]] : [];
			},
			first: async () => null
		};

		return statement;
	};

	return {
		statements,
		d1: {
			prepare,
			batch: async () => [],
			exec: async () => d1Result(),
			dump: async () => new ArrayBuffer(0)
		} as unknown as D1Database
	};
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('inventory helpers', () => {
	it('labels an unavailable database binding as an internal error', () => {
		expect(() => getBoundDb(undefined)).toThrowError(
			expect.objectContaining({ code: 'INTERNAL_ERROR', status: 500 })
		);
	});

	it('stores only a hash and a safe prefix when creating a D1 API key', async () => {
		const database = createD1Double();

		const created = await createApiKey(database.d1, 'Warehouse scanner', 'producer');
		const result = created as unknown as {
			item: { keyPrefix: string };
			token: string;
		};
		const inserted = database.statements.find((statement) =>
			statement.sql.toLowerCase().startsWith('insert into')
		);

		expect(result.token).toMatch(/^bio_prod_[A-Za-z0-9_-]+$/);
		expect(inserted?.params).toContainEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
		expect(inserted?.params).not.toContain(result.token);
		expect(result.item.keyPrefix).toBe(result.token.slice(0, 18));
	});

	it('authorizes active D1 keys by the hash of the submitted token', async () => {
		const token = 'bio_prod_active-token';
		const keyHash = await sha256Hex(token);
		const database = createD1Double([{ keyHash, role: 'producer', revokedAt: null }]);

		expect(
			await requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { 'x-api-token': token }
				}),
				{},
				['producer'],
				database.d1
			)
		).toBe('producer');
		expect(database.statements.at(-1)?.params).toEqual([keyHash, 1]);
	});

	it('rejects revoked and unknown D1 keys', async () => {
		const revokedToken = 'bio_prod_revoked-token';
		const database = createD1Double([
			{ keyHash: await sha256Hex(revokedToken), role: 'producer', revokedAt: '2026-08-11T12:00:00.000Z' }
		]);

		await expect(
			requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { authorization: `Bearer ${revokedToken}` }
				}),
				{},
				['producer'],
				database.d1
			)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { authorization: 'Bearer bio_prod_unknown-token' }
				}),
				{},
				['producer'],
				database.d1
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('rejects active D1 keys whose role is not allowed', async () => {
		const token = 'bio_prod_consumer-token';
		const database = createD1Double([
			{ keyHash: await sha256Hex(token), role: 'consumer', revokedAt: null }
		]);

		await expect(
			requireApiRole(
				new Request('https://example.com/api/inventory', {
					headers: { 'x-api-token': token }
				}),
				{},
				['producer'],
				database.d1
			)
		).rejects.toMatchObject({ status: 403 });
	});

	it('parses array query parameters supporting repeating params and comma separation', () => {
		const url1 = new URL('https://example.com/api/inventory?mfgPartNumber=PULLEY-1&mfgPartNumber=GEAR-2');
		expect(getArrayQueryParam(url1, 'mfgPartNumber')).toEqual(['PULLEY-1', 'GEAR-2']);

		const url2 = new URL('https://example.com/api/inventory?mfgPartNumber=PULLEY-1,GEAR-2');
		expect(getArrayQueryParam(url2, 'mfgPartNumber')).toEqual(['PULLEY-1', 'GEAR-2']);

		const url3 = new URL('https://example.com/api/inventory?mfgPartNumber=PULLEY-1,GEAR-2&mfgPartNumber=BEARING-3');
		expect(getArrayQueryParam(url3, 'mfgPartNumber')).toEqual(['PULLEY-1', 'GEAR-2', 'BEARING-3']);

		const url4 = new URL('https://example.com/api/inventory');
		expect(getArrayQueryParam(url4, 'mfgPartNumber')).toBeUndefined();
	});

	it('parses boolean query parameters for archived filtering', () => {
		expect(getBooleanQueryParam(new URL('https://example.com/?showArchived=true'), 'showArchived')).toBe(
			true
		);
		expect(getBooleanQueryParam(new URL('https://example.com/?showArchived=0'), 'showArchived')).toBe(
			false
		);
		expect(getBooleanQueryParam(new URL('https://example.com/'), 'showArchived')).toBe(false);
		expect(() =>
			getBooleanQueryParam(new URL('https://example.com/?showArchived=maybe'), 'showArchived')
		).toThrow(/boolean value/i);
	});

	it('parses configured API tokens and authorizes producer access', async () => {
		const request = new Request('https://example.com/api/inventory', {
			headers: {
				authorization: ['Bearer', 'producer-token'].join(' ')
			}
		});

		expect(parseConfiguredTokens('producer-token, another-token')).toEqual(
			new Set(['producer-token', 'another-token'])
		);
		expect(
			await requireApiRole(
				request,
				{
					PRODUCER_API_TOKENS: 'producer-token',
					CONSUMER_API_TOKENS: 'consumer-token'
				},
				['producer']
			)
		).toBe('producer');
	});

	it('supports x-api-token headers for consumer requests', async () => {
		const request = new Request('https://example.com/api/history', {
			headers: {
				'x-api-token': 'consumer-token'
			}
		});

		expect(extractApiToken(request)).toBe('consumer-token');
		expect(
			await requireApiRole(
				request,
				{
					PRODUCER_API_TOKENS: 'producer-token',
					CONSUMER_API_TOKENS: 'consumer-token'
				},
				['consumer', 'producer']
			)
		).toBe('consumer');
	});

	it('normalizes part payloads with metadata', () => {
		expect(
			normalizePartInput({
				name: 'Timing Belt',
				mfgPartNumber: 'GT2-120',
				inventoryTypeId: ' belt-type ',
				description: '120 tooth timing belt',
				metadata: {
					teeth: 120,
					pitch: 'GT2',
					widthMm: 9
				}
			})
		).toEqual({
			name: 'Timing Belt',
			mfgPartNumber: 'GT2-120',
			inventoryTypeId: 'belt-type',
			description: '120 tooth timing belt',
			metadata: {
				teeth: 120,
				pitch: 'GT2',
				widthMm: 9
			}
		});
	});

	it('normalizes grouped inventory change payloads', () => {
		const payload = normalizeTransactionInput({
			actor: 'assembly-cell-1',
			recordedAt: '2026-08-08T10:00:00.000Z',
			note: 'Consumed for build order 42',
			lines: [
				{
					partId: 'gear-1',
					quantityDelta: -3,
					usedIn: 'Build Order 42'
				},
				{
					partId: 'belt-1',
					quantityDelta: 10
				}
			]
		});

		expect(payload).toEqual({
			actor: 'assembly-cell-1',
			recordedAt: '2026-08-08T10:00:00.000Z',
			note: 'Consumed for build order 42',
			lines: [
				{
					partId: 'gear-1',
					quantityDelta: -3,
					usedIn: 'Build Order 42'
				},
				{
					partId: 'belt-1',
					quantityDelta: 10,
					usedIn: null
				}
			]
		});
	});

	it('normalizes archive payloads for parts', () => {
		expect(
			normalizePartArchiveInput({
				id: 'part-1',
				archived: true
			})
		).toEqual({
			id: 'part-1',
			archived: true
		});
	});

	it('builds a prefix FTS query for part search', () => {
		expect(buildFtsQuery('timing belt 9mm')).toBe('timing* AND belt* AND 9mm*');
	});
});
