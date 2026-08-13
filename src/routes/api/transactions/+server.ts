import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import {
	createTransaction,
	getBoundDb,
	getInventoryPartsByIds,
	handleInventoryError,
	normalizeTransactionInput,
	requireApiRole
} from '$lib/server/inventory';

import {
	getStockAlert,
	isNotifiedInventoryType,
	sendSlackStockAlert,
	type StockAlert
} from '$lib/server/slack-notifications';

export const POST: RequestHandler = async ({ platform, request }) => {
	try {
		const d1 = platform?.env?.DB
			? getBoundDb(platform)
			: undefined;

		await requireApiRole(
			request,
			platform?.env,
			['producer'],
			d1
		);

		const payload = await request.json();
		const input = normalizeTransactionInput(payload);
		const database = getBoundDb(platform);

		const partIds = [
			...new Set(input.lines.map((line) => line.partId))
		];

		const beforeParts = await getInventoryPartsByIds(
			database,
			partIds
		);

		const transaction = await createTransaction(
			database,
			payload
		);

		const afterParts = await getInventoryPartsByIds(
			database,
			partIds
		);

		const webhookUrl =
			platform?.env?.SLACK_WEBHOOK_URL;

		if (webhookUrl) {
			const beforeById = new Map(
				beforeParts.map((part) => [
					part.id,
					part
				])
			);

			for (const after of afterParts) {
				const before = beforeById.get(after.id);

				if (!before) {
					continue;
				}

				if (!isNotifiedInventoryType(after.metadata)) {
					continue;
				}

				const level = getStockAlert(
					before.quantity,
					after.quantity
				);

				if (!level) {
					continue;
				}

				const inventoryType =
					typeof after.metadata.inventoryType === 'string'
						? after.metadata.inventoryType
						: '';

				const alert: StockAlert = {
					partId: after.id,
					partName: after.name,
					mfgPartNumber: after.mfgPartNumber,
					inventoryType,
					beforeQuantity: before.quantity,
					afterQuantity: after.quantity,
					level
				};

				try {
					await sendSlackStockAlert(
						webhookUrl,
						alert
					);
				} catch (error) {
					console.error(
						'Slack stock notification failed.',
						error
					);
				}
			}
		}

		return json(
			{ transaction },
			{ status: 201 }
		);
	} catch (cause) {
		return handleInventoryError(cause);
	}
};