import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestD1, type TestD1Context } from './test-setup';
import {
	createPart,
	createTransaction,
	listHistory,
	listInventory,
	searchInventory
} from './inventory';

describe('Miniflare local D1 inventory integration tests', () => {
	let testCtx: TestD1Context;

	beforeAll(async () => {
		testCtx = await setupTestD1();
	});

	afterAll(async () => {
		if (testCtx) {
			await testCtx.dispose();
		}
	});

	it('creates parts in local D1 and lists them', async () => {
		const part1 = await createPart(testCtx.d1, {
			name: '20T GT2 Pulley',
			mfgPartNumber: 'PULLEY-GT2-20T',
			description: 'Aluminum 5mm bore timing pulley',
			metadata: { teeth: 20, pitch: 'GT2', boreMm: 5 }
		});

		expect(part1.id).toBeDefined();
		expect(part1.name).toBe('20T GT2 Pulley');
		expect(part1.quantity).toBe(0);

		const part2 = await createPart(testCtx.d1, {
			name: '6mm GT2 Timing Belt',
			mfgPartNumber: 'BELT-GT2-6MM',
			description: 'Neoprene rubber timing belt',
			metadata: { widthMm: 6, pitch: 'GT2' }
		});

		expect(part2.id).toBeDefined();

		const allParts = await listInventory(testCtx.d1, {});
		expect(allParts).toHaveLength(2);
		expect(allParts.map((p) => p.mfgPartNumber)).toContain('PULLEY-GT2-20T');
		expect(allParts.map((p) => p.mfgPartNumber)).toContain('BELT-GT2-6MM');
	});

	it('prevents duplicate manufacturer part numbers', async () => {
		await expect(
			createPart(testCtx.d1, {
				name: 'Duplicate Pulley',
				mfgPartNumber: 'PULLEY-GT2-20T',
				description: 'Duplicate test'
			})
		).rejects.toThrow('A part with that manufacturer part number already exists.');
	});

	it('records inventory transactions and calculates stock levels', async () => {
		const partsList = await listInventory(testCtx.d1, {});
		const pulley = partsList.find((p) => p.mfgPartNumber === 'PULLEY-GT2-20T')!;
		const belt = partsList.find((p) => p.mfgPartNumber === 'BELT-GT2-6MM')!;

		const restockTx = await createTransaction(testCtx.d1, {
			actor: 'warehouse-receiver',
			note: 'Inbound restock shipment #101',
			lines: [
				{ partId: pulley.id, quantityDelta: 50 },
				{ partId: belt.id, quantityDelta: 100 }
			]
		});

		expect(restockTx.transactionId).toBeDefined();
		expect(restockTx.lineCount).toBe(2);

		let updatedParts = await listInventory(testCtx.d1, {});
		let updatedPulley = updatedParts.find((p) => p.id === pulley.id)!;
		let updatedBelt = updatedParts.find((p) => p.id === belt.id)!;

		expect(updatedPulley.quantity).toBe(50);
		expect(updatedBelt.quantity).toBe(100);

		// Record a consumption transaction
		const consumeTx = await createTransaction(testCtx.d1, {
			actor: 'assembly-station-2',
			note: 'Build order #402',
			lines: [
				{ partId: pulley.id, quantityDelta: -4, usedIn: 'Build-402' },
				{ partId: belt.id, quantityDelta: -2, usedIn: 'Build-402' }
			]
		});

		expect(consumeTx.transactionId).toBeDefined();

		updatedParts = await listInventory(testCtx.d1, {});
		updatedPulley = updatedParts.find((p) => p.id === pulley.id)!;
		updatedBelt = updatedParts.find((p) => p.id === belt.id)!;

		expect(updatedPulley.quantity).toBe(46);
		expect(updatedBelt.quantity).toBe(98);
	});

	it('searches parts via SQLite FTS5 index', async () => {
		const searchResults = await searchInventory(testCtx.d1, 'pulley aluminum');
		expect(searchResults).toHaveLength(1);
		expect(searchResults[0].mfgPartNumber).toBe('PULLEY-GT2-20T');
	});

	it('retrieves transaction history log and filters by partId', async () => {
		const partsList = await listInventory(testCtx.d1, {});
		const pulley = partsList.find((p) => p.mfgPartNumber === 'PULLEY-GT2-20T')!;

		const fullHistory = await listHistory(testCtx.d1, { limit: 10 });
		expect(fullHistory.length).toBeGreaterThanOrEqual(4);

		const pulleyHistory = await listHistory(testCtx.d1, { partId: pulley.id });
		expect(pulleyHistory).toHaveLength(2);
		expect(pulleyHistory.every((entry) => entry.partId === pulley.id)).toBe(true);
	});
});
