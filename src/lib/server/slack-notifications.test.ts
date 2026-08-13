import { describe, expect, it, vi} from 'vitest';

import {
	buildSlackMessage,
	getStockAlert,
	isNotifiedInventoryType,
	sendSlackStockAlert
} from './slack-notifications';

describe('getStockAlert', () => {
	it('does not alert above the low-stock threshold', () => {
		expect(getStockAlert(4, 3)).toBeNull();
	});

	it('alerts when stock drops from 3 to 2', () => {
		expect(getStockAlert(3, 2)).toBe('low');
	});

	it('alerts when stock crosses the threshold from 3 to 1', () => {
		expect(getStockAlert(3, 1)).toBe('low');
	});

	it('does not repeat the low-stock alert below the threshold', () => {
		expect(getStockAlert(2, 1)).toBeNull();
	});

	it('alerts when stock reaches zero', () => {
		expect(getStockAlert(1, 0)).toBe('out');
	});

	it('sends only the out-of-stock alert when stock drops directly to zero', () => {
		expect(getStockAlert(3, 0)).toBe('out');
	});

	it('does not alert when an out-of-stock part is restocked', () => {
		expect(getStockAlert(0, 5)).toBeNull();
	});

	it('alerts again after a restocked part crosses the low-stock threshold', () => {
		expect(getStockAlert(5, 2)).toBe('low');
	});

	it('sends only the out-of-stock alert after a direct drop to zero', () => {
		expect(getStockAlert(5, 0)).toBe('out');
	});

	it('does not alert when quantity increases while stock is low', () => {
		expect(getStockAlert(1, 2)).toBeNull();
	});

	it('does not alert when quantity does not change', () => {
		expect(getStockAlert(2, 2)).toBeNull();
	});
});

describe('isNotifiedInventoryType', () => {
	it.each([
		'BELT_9MM',
		'BELT_15MM',
		'GEAR',
		'SPROCKET'
	])('allows the %s inventory category', (inventoryType) => {
		expect(
			isNotifiedInventoryType({
				inventoryType
			})
		).toBe(true);
	});

	it('rejects inventory categories outside the notification list', () => {
		expect(
			isNotifiedInventoryType({
				inventoryType: 'BEARING'
			})
		).toBe(false);
	});

	it('rejects missing inventory type metadata', () => {
		expect(isNotifiedInventoryType({})).toBe(false);
	});

	it('rejects non-string inventory type metadata', () => {
		expect(
			isNotifiedInventoryType({
				inventoryType: 123
			})
		).toBe(false);
	});
});
describe('buildSlackMessage', () => {
	it('builds a low-stock Slack message', () => {
		const message = buildSlackMessage({
			partId: 'part-b9-1250',
			partName: '9mm Belt 1250mm',
			mfgPartNumber: 'B9-1250',
			inventoryType: 'BELT_9MM',
			beforeQuantity: 3,
			afterQuantity: 2,
			level: 'low'
		});

		expect(message.text).toContain('Low stock');
		expect(message.text).toContain('9mm Belt 1250mm');
		expect(message.text).toContain('B9-1250');
		expect(message.text).toContain('2 units remaining');
		expect(message.text).toContain('3 → 2');
	});

	it('builds an out-of-stock Slack message', () => {
		const message = buildSlackMessage({
			partId: 'part-gr-48',
			partName: 'Gear 48T',
			mfgPartNumber: 'GR-48',
			inventoryType: 'GEAR',
			beforeQuantity: 1,
			afterQuantity: 0,
			level: 'out'
		});

		expect(message.text).toContain('Out of stock');
		expect(message.text).toContain('Gear 48T');
		expect(message.text).toContain('GR-48');
		expect(message.text).toContain('0 units remaining');
		expect(message.text).toContain('1 → 0');
	});

	it('uses singular unit wording when one unit remains', () => {
		const message = buildSlackMessage({
			partId: 'part-sp-22',
			partName: 'Sprocket 22T',
			mfgPartNumber: 'SP-22',
			inventoryType: 'SPROCKET',
			beforeQuantity: 3,
			afterQuantity: 1,
			level: 'low'
		});

		expect(message.text).toContain('1 unit remaining');
		expect(message.text).not.toContain('1 units remaining');
	});
});
describe('sendSlackStockAlert', () => {
	const alert = {
		partId: 'part-b9-1250',
		partName: '9mm Belt 1250mm',
		mfgPartNumber: 'B9-1250',
		inventoryType: 'BELT_9MM',
		beforeQuantity: 3,
		afterQuantity: 2,
		level: 'low' as const
	};

	it('posts the alert to the Slack webhook', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('ok', { status: 200 })
		);

		await sendSlackStockAlert(
			'https://example.com/slack-webhook',
			alert,
			fetchMock
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.com/slack-webhook',
			expect.objectContaining({
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				}
			})
		);

		const [, options] = fetchMock.mock.calls[0];
		const body = JSON.parse(options.body as string);

		expect(body.text).toContain('Low stock');
		expect(body.text).toContain('B9-1250');
		expect(body.text).toContain('2 units remaining');
	});

	it('throws when Slack rejects the webhook request', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('invalid_payload', { status: 500 })
		);

		await expect(
			sendSlackStockAlert(
				'https://example.com/slack-webhook',
				alert,
				fetchMock
			)
		).rejects.toThrow('Slack webhook returned 500.');
	});
});