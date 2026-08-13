export type StockAlertLevel = 'low' | 'out';

export interface StockAlert {
	partId: string;
	partName: string;
	mfgPartNumber: string;
	inventoryType: string;
	beforeQuantity: number;
	afterQuantity: number;
	level: StockAlertLevel;
}

export interface SlackMessage {
	text: string;
}

const NOTIFIED_INVENTORY_TYPES = new Set([
	'BELT_9MM',
	'BELT_15MM',
	'GEAR',
	'SPROCKET'
]);

export function getStockAlert(
	beforeQuantity: number,
	afterQuantity: number
): StockAlertLevel | null {
	if (afterQuantity === 0 && beforeQuantity > 0) {
		return 'out';
	}

	if (
		beforeQuantity > 2 &&
		afterQuantity > 0 &&
		afterQuantity <= 2
	) {
		return 'low';
	}

	return null;
}

export function isNotifiedInventoryType(
	metadata: Record<string, unknown>
): boolean {
	const inventoryType = metadata.inventoryType;

	return (
		typeof inventoryType === 'string' &&
		NOTIFIED_INVENTORY_TYPES.has(inventoryType)
	);
}

export function buildSlackMessage(alert: StockAlert): SlackMessage {
	const heading =
		alert.level === 'out'
			? '🚨 Out of stock'
			: '⚠️ Low stock';

	const unitLabel =
		alert.afterQuantity === 1
			? 'unit'
			: 'units';

	return {
		text: [
			heading,
			'',
			alert.partName,
			alert.mfgPartNumber,
			'',
			`${alert.afterQuantity} ${unitLabel} remaining`,
			`Stock changed: ${alert.beforeQuantity} → ${alert.afterQuantity}`
		].join('\n')
	};
}
type FetchFunction = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Promise<Response>;

export async function sendSlackStockAlert(
	webhookUrl: string,
	alert: StockAlert,
	fetchFunction: FetchFunction = fetch
): Promise<void> {
	const response = await fetchFunction(webhookUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(buildSlackMessage(alert))
	});

	if (!response.ok) {
		throw new Error(`Slack webhook returned ${response.status}.`);
	}
}