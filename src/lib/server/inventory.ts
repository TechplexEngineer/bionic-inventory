import { json } from '@sveltejs/kit';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { inventoryChanges, parts } from '$lib/server/db/schema';

export type ApiRole = 'producer' | 'consumer';

export interface InventoryPart {
	id: string;
	name: string;
	mfgPartNumber: string;
	description: string;
	metadata: Record<string, unknown>;
	quantity: number;
}

export interface InventoryHistoryEntry {
	id: string;
	transactionId: string;
	partId: string;
	partName: string;
	mfgPartNumber: string;
	quantityDelta: number;
	actor: string;
	usedIn: string | null;
	note: string | null;
	recordedAt: string;
}

export interface PartInput {
	name: string;
	mfgPartNumber: string;
	description?: string;
	metadata?: Record<string, unknown>;
}

export interface TransactionInput {
	actor: string;
	recordedAt?: string;
	note?: string | null;
	lines: Array<{
		partId: string;
		quantityDelta: number;
		usedIn?: string | null;
	}>;
}

type TokenEnv = object;

type PartSearchRow = {
	id: string;
	name: string;
	mfg_part_number: string;
	description: string;
	metadata: string | Record<string, unknown> | null;
	quantity: number | string | null;
};

class InventoryRouteError extends Error {
	constructor(
		message: string,
		public readonly status: number
	) {
		super(message);
	}
}

export function handleInventoryError(cause: unknown): Response {
	if (cause instanceof InventoryRouteError) {
		return json({ error: cause.message }, { status: cause.status });
	}

	if (cause instanceof SyntaxError) {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	if (isMissingSchemaError(cause)) {
		return json(
			{ error: 'The database schema has not been initialized. Run the D1 migration first.' },
			{ status: 503 }
		);
	}

	console.error(cause);
	return json({ error: 'Internal server error.' }, { status: 500 });
}

export function getBoundDb(platform: App.Platform | undefined): D1Database {
	if (!platform?.env?.DB) {
		throw new InventoryRouteError('The D1 database binding is not configured.', 500);
	}

	return platform.env.DB;
}

export function getSearchQuery(url: URL): string | undefined {
	const query = url.searchParams.get('q')?.trim();
	return query ? query : undefined;
}

export function getLimit(url: URL, fallback = 50, max = 200): number {
	const rawLimit = Number(url.searchParams.get('limit') ?? fallback);

	if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
		throw new InventoryRouteError('The "limit" query parameter must be a positive integer.', 400);
	}

	return Math.min(rawLimit, max);
}

export function extractApiToken(request: Request): string | null {
	const headerToken = request.headers.get('x-api-token')?.trim();
	if (headerToken) {
		return headerToken;
	}

	const authorization = request.headers.get('authorization');
	if (!authorization) {
		return null;
	}

	const [scheme, token] = authorization.trim().split(/\s+/, 2);
	if (scheme?.toLowerCase() !== 'bearer' || !token) {
		return null;
	}

	return token.trim();
}

export function parseConfiguredTokens(rawValue: string | undefined): Set<string> {
	return new Set(
		(rawValue ?? '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean)
	);
}

export function requireApiRole(
	request: Request,
	env: TokenEnv | undefined,
	allowedRoles: ApiRole[]
): ApiRole {
	const token = extractApiToken(request);

	if (!token) {
		throw new InventoryRouteError('API token required.', 401);
	}

	const producerTokens = parseConfiguredTokens(readOptionalEnvString(env, 'PRODUCER_API_TOKENS'));
	const consumerTokens = parseConfiguredTokens(readOptionalEnvString(env, 'CONSUMER_API_TOKENS'));

	const role: ApiRole | null = producerTokens.has(token)
		? 'producer'
		: consumerTokens.has(token)
			? 'consumer'
			: null;

	if (!role) {
		throw new InventoryRouteError('Invalid API token.', 401);
	}

	if (!allowedRoles.includes(role)) {
		throw new InventoryRouteError('This API token is not allowed to perform that action.', 403);
	}

	return role;
}

export function normalizePartInput(payload: unknown): Required<PartInput> {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError('Part payload must be a JSON object.', 400);
	}

	const name = normalizeString(payload.name, 'name');
	const mfgPartNumber = normalizeString(payload.mfgPartNumber, 'mfgPartNumber');
	const description = normalizeOptionalString(payload.description, 'description') ?? '';
	const metadata = payload.metadata ?? {};

	if (!isPlainObject(metadata)) {
		throw new InventoryRouteError('metadata must be a JSON object.', 400);
	}

	return {
		name,
		mfgPartNumber,
		description,
		metadata
	};
}

export function normalizeTransactionInput(payload: unknown): Required<TransactionInput> {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError('Transaction payload must be a JSON object.', 400);
	}

	const actor = normalizeString(payload.actor, 'actor');
	const note = normalizeOptionalString(payload.note, 'note') ?? null;
	const recordedAt = normalizeTimestamp(payload.recordedAt);
	const lines = payload.lines;

	if (!Array.isArray(lines) || lines.length === 0) {
		throw new InventoryRouteError('lines must contain at least one inventory change.', 400);
	}

	const normalizedLines = lines.map((line, index) => {
		if (!isPlainObject(line)) {
			throw new InventoryRouteError(`lines[${index}] must be a JSON object.`, 400);
		}

		const partId = normalizeString(line.partId, `lines[${index}].partId`);
		const quantityDelta = line.quantityDelta;

		if (
			typeof quantityDelta !== 'number' ||
			!Number.isInteger(quantityDelta) ||
			quantityDelta === 0
		) {
			throw new InventoryRouteError(
				`lines[${index}].quantityDelta must be a non-zero integer.`,
				400
			);
		}

		return {
			partId,
			quantityDelta,
			usedIn: normalizeOptionalString(line.usedIn, `lines[${index}].usedIn`) ?? null
		};
	});

	return {
		actor,
		recordedAt,
		note,
		lines: normalizedLines
	};
}

export function buildFtsQuery(query: string): string {
	const tokens = query
		.trim()
		.split(/\s+/)
		.map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ''))
		.filter(Boolean);

	if (tokens.length === 0) {
		throw new InventoryRouteError('Search query must contain letters or numbers.', 400);
	}

	return tokens.map((token) => `${token}*`).join(' AND ');
}

export async function listInventory(
	d1: D1Database,
	options: {
		query?: string;
	}
): Promise<InventoryPart[]> {
	if (options.query) {
		return searchInventory(d1, options.query);
	}

	const db = getDb(d1);
	const quantityExpression = sql<number>`coalesce(sum(${inventoryChanges.quantityDelta}), 0)`;
	const rows = await db
		.select({
			id: parts.id,
			name: parts.name,
			mfgPartNumber: parts.mfgPartNumber,
			description: parts.description,
			metadata: parts.metadata,
			quantity: quantityExpression
		})
		.from(parts)
		.leftJoin(inventoryChanges, eq(parts.id, inventoryChanges.partId))
		.groupBy(parts.id, parts.name, parts.mfgPartNumber, parts.description, parts.metadata)
		.orderBy(asc(parts.name));

	return rows.map((row) => ({
		...row,
		metadata: row.metadata ?? {},
		quantity: Number(row.quantity)
	}));
}

export async function searchInventory(d1: D1Database, query: string): Promise<InventoryPart[]> {
	const statement = d1
		.prepare(
			`
				SELECT
					p.id,
					p.name,
					p.mfg_part_number,
					p.description,
					p.metadata,
					COALESCE(SUM(ic.quantity_delta), 0) AS quantity
				FROM parts_fts
				JOIN parts p ON p.rowid = parts_fts.rowid
				LEFT JOIN inventory_changes ic ON ic.part_id = p.id
				WHERE parts_fts MATCH ?
				GROUP BY p.id, p.name, p.mfg_part_number, p.description, p.metadata
				ORDER BY p.name ASC
			`
		)
		.bind(buildFtsQuery(query));

	const result = await statement.all<PartSearchRow>();

	return (result.results ?? []).map((row) => ({
		id: row.id,
		name: row.name,
		mfgPartNumber: row.mfg_part_number,
		description: row.description,
		metadata: parseMetadata(row.metadata),
		quantity: Number(row.quantity ?? 0)
	}));
}

export async function listHistory(
	d1: D1Database,
	options: {
		partId?: string;
		limit?: number;
	}
): Promise<InventoryHistoryEntry[]> {
	const db = getDb(d1);
	const baseQuery = db
		.select({
			id: inventoryChanges.id,
			transactionId: inventoryChanges.transactionId,
			partId: inventoryChanges.partId,
			partName: parts.name,
			mfgPartNumber: parts.mfgPartNumber,
			quantityDelta: inventoryChanges.quantityDelta,
			actor: inventoryChanges.actor,
			usedIn: inventoryChanges.usedIn,
			note: inventoryChanges.note,
			recordedAt: inventoryChanges.recordedAt
		})
		.from(inventoryChanges)
		.innerJoin(parts, eq(inventoryChanges.partId, parts.id));

	const rows = options.partId
		? await baseQuery
				.where(eq(inventoryChanges.partId, options.partId))
				.orderBy(desc(inventoryChanges.recordedAt), desc(inventoryChanges.createdAt))
				.limit(options.limit ?? 50)
		: await baseQuery
				.orderBy(desc(inventoryChanges.recordedAt), desc(inventoryChanges.createdAt))
				.limit(options.limit ?? 50);

	return rows.map((row) => ({
		...row,
		usedIn: row.usedIn ?? null,
		note: row.note ?? null
	}));
}

export async function createPart(d1: D1Database, payload: unknown): Promise<InventoryPart> {
	const input = normalizePartInput(payload);
	const db = getDb(d1);
	const id = crypto.randomUUID();

	try {
		await db.insert(parts).values({
			id,
			name: input.name,
			mfgPartNumber: input.mfgPartNumber,
			description: input.description,
			metadata: input.metadata
		});
	} catch (cause) {
		if (isSqliteUniqueError(cause)) {
			throw new InventoryRouteError('A part with that manufacturer part number already exists.', 409);
		}

		throw cause;
	}

	return {
		id,
		name: input.name,
		mfgPartNumber: input.mfgPartNumber,
		description: input.description,
		metadata: input.metadata,
		quantity: 0
	};
}

export async function createTransaction(
	d1: D1Database,
	payload: unknown
): Promise<{
	transactionId: string;
	recordedAt: string;
	lineCount: number;
}> {
	const input = normalizeTransactionInput(payload);
	const db = getDb(d1);
	const transactionId = crypto.randomUUID();
	const uniquePartIds = [...new Set(input.lines.map((line) => line.partId))];
	const existingParts = await db
		.select({ id: parts.id })
		.from(parts)
		.where(inArray(parts.id, uniquePartIds));

	if (existingParts.length !== uniquePartIds.length) {
		throw new InventoryRouteError('One or more transaction lines reference an unknown part.', 400);
	}

	await db.insert(inventoryChanges).values(
		input.lines.map((line) => ({
			id: crypto.randomUUID(),
			transactionId,
			partId: line.partId,
			quantityDelta: line.quantityDelta,
			actor: input.actor,
			usedIn: line.usedIn,
			note: input.note,
			recordedAt: input.recordedAt
		}))
	);

	return {
		transactionId,
		recordedAt: input.recordedAt,
		lineCount: input.lines.length
	};
}

function normalizeString(value: unknown, fieldName: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new InventoryRouteError(`${fieldName} must be a non-empty string.`, 400);
	}

	return value.trim();
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
	if (value == null) {
		return undefined;
	}

	if (typeof value !== 'string') {
		throw new InventoryRouteError(`${fieldName} must be a string.`, 400);
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTimestamp(value: unknown): string {
	if (value == null) {
		return new Date().toISOString();
	}

	if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
		throw new InventoryRouteError(
			'recordedAt must be an ISO-8601 timestamp when it is provided.',
			400
		);
	}

	return new Date(value).toISOString();
}

function parseMetadata(value: string | Record<string, unknown> | null): Record<string, unknown> {
	if (!value) {
		return {};
	}

	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return isPlainObject(parsed) ? parsed : {};
		} catch {
			return {};
		}
	}

	return isPlainObject(value) ? value : {};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSqliteUniqueError(cause: unknown): boolean {
	return cause instanceof Error && cause.message.includes('UNIQUE constraint failed');
}

function readOptionalEnvString(env: TokenEnv | undefined, key: string): string | undefined {
	const value = (env as Record<string, unknown> | undefined)?.[key];
	return typeof value === 'string' ? value : undefined;
}

export function isMissingSchemaError(cause: unknown): boolean {
	return cause instanceof Error && /no such table|no such virtual table/i.test(cause.message);
}
