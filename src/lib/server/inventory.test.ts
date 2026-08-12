import { describe, expect, it } from 'vitest';
import {
	buildFtsQuery,
	extractApiToken,
	normalizePartInput,
	normalizeTransactionInput,
	parseConfiguredTokens,
	requireApiRole
} from './inventory';

describe('inventory helpers', () => {
	it('parses configured API tokens and authorizes producer access', () => {
		const request = new Request('https://example.com/api/inventory', {
			headers: {
				authorization: ['Bearer', 'producer-token'].join(' ')
			}
		});

		expect(parseConfiguredTokens('producer-token, another-token')).toEqual(
			new Set(['producer-token', 'another-token'])
		);
		expect(
			requireApiRole(
				request,
				{
					PRODUCER_API_TOKENS: 'producer-token',
					CONSUMER_API_TOKENS: 'consumer-token'
				},
				['producer']
			)
		).toBe('producer');
	});

	it('supports x-api-token headers for consumer requests', () => {
		const request = new Request('https://example.com/api/history', {
			headers: {
				'x-api-token': 'consumer-token'
			}
		});

		expect(extractApiToken(request)).toBe('consumer-token');
		expect(
			requireApiRole(
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

	it('builds a prefix FTS query for part search', () => {
		expect(buildFtsQuery('timing belt 9mm')).toBe('timing* AND belt* AND 9mm*');
	});
});
