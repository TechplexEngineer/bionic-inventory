import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { apiKeys, inventoryChanges, inventoryTypes, parts } from '$lib/server/db/schema';
import { InventoryRouteError, isMissingSchemaError } from './inventory-errors';
import type { InventoryPart } from './parts';

export { handleInventoryError, InventoryRouteError, isMissingSchemaError } from './inventory-errors';
export { createPart, normalizePartInput, updatePart } from './parts';
export type { InventoryPart, PartInput, PartPatchInput } from './parts';

export type ApiRole = 'producer' | 'consumer';

export interface ApiKeyItem {
	id: string;
	name: string;
	keyPrefix: string;
	role: ApiRole;
	createdAt: string;
	revokedAt: string | null;
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

export interface ListInventoryOptions {
	query?: string;
	mfgPartNumber?: string[];
	id?: string[];
	showArchived?: boolean;
}

type TokenEnv = object;

type PartSearchRow = {
	id: string;
	name: string;
	mfg_part_number: string;
	description: string;
	metadata: string | Record<string, unknown> | null;
	inventory_type_id: string | null;
	inventory_type_name: string | null;
	archived_at: string | null;
	updated_at: string;
	quantity: number | string | null;
};

export function getBoundDb(platform: App.Platform | undefined): D1Database {
	if (!platform?.env?.DB) {
		throw new InventoryRouteError('INTERNAL_ERROR', 'The D1 database binding is not configured.', 500);
	}

	return platform.env.DB;
}

export async function hashApiToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createApiToken(role: ApiRole): string {
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = '';
	for (const byte of randomBytes) {
		binary += String.fromCharCode(byte);
	}

	const randomValue = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
	return `bio_${role === 'producer' ? 'prod' : 'cons'}_${randomValue}`;
}

export async function listApiKeys(d1: D1Database): Promise<ApiKeyItem[]> {
	const db = getDb(d1);
	const rows = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			role: apiKeys.role,
			createdAt: apiKeys.createdAt,
			revokedAt: apiKeys.revokedAt
		})
		.from(apiKeys)
		.orderBy(desc(apiKeys.createdAt));

	return rows.map((row) => ({
		...row,
		role: row.role as ApiRole,
		revokedAt: row.revokedAt ?? null
	}));
}

export async function createApiKey(
	d1: D1Database,
	name: string,
	role: ApiRole
): Promise<{ item: ApiKeyItem; token: string }> {
	if (!name || name.trim().length === 0) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Key name is required.', 400);
	}
	if (role !== 'producer' && role !== 'consumer') {
		throw new InventoryRouteError('INVALID_REQUEST', 'Role must be producer or consumer.', 400);
	}

	const db = getDb(d1);
	const id = crypto.randomUUID();
	const token = createApiToken(role);
	const keyHash = await hashApiToken(token);
	const keyPrefix = token.slice(0, 18);
	const createdAt = new Date().toISOString();

	await db.insert(apiKeys).values({
		id,
		name: name.trim(),
		keyHash,
		keyPrefix,
		role,
		createdAt
	});

	return {
		item: {
			id,
			name: name.trim(),
			keyPrefix,
			role,
			createdAt,
			revokedAt: null
		},
		token
	};
}

export async function revokeApiKey(d1: D1Database, id: string): Promise<void> {
	const db = getDb(d1);
	await db
		.update(apiKeys)
		.set({ revokedAt: new Date().toISOString() })
		.where(eq(apiKeys.id, id));
}

export function getSearchQuery(url: URL): string | undefined {
	const query = url.searchParams.get('q')?.trim();
	return query ? query : undefined;
}

export function getArrayQueryParam(url: URL, paramName: string): string[] | undefined {
	const rawValues = url.searchParams.getAll(paramName);
	if (rawValues.length === 0) {
		return undefined;
	}

	const result: string[] = [];
	for (const raw of rawValues) {
		for (const item of raw.split(',')) {
			const trimmed = item.trim();
			if (trimmed && !result.includes(trimmed)) {
				result.push(trimmed);
			}
		}
	}

	return result.length > 0 ? result : undefined;
}

export function getBooleanQueryParam(url: URL, paramName: string): boolean {
	const rawValue = url.searchParams.get(paramName)?.trim().toLowerCase();
	if (!rawValue) {
		return false;
	}

	if (['1', 'true', 'yes', 'on'].includes(rawValue)) {
		return true;
	}

	if (['0', 'false', 'no', 'off'].includes(rawValue)) {
		return false;
	}

	throw new InventoryRouteError(
		'INVALID_REQUEST',
		`The "${paramName}" query parameter must be a boolean value.`,
		400
	);
}

export function getLimit(url: URL, fallback = 50, max = 200): number {
	const rawLimit = Number(url.searchParams.get('limit')?.trim() || fallback);

	if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'The "limit" query parameter must be a positive integer.',
			400
		);
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

export async function requireApiRole(
	request: Request,
	env: TokenEnv | undefined,
	allowedRoles: ApiRole[],
	d1?: D1Database
): Promise<ApiRole> {
	const token = extractApiToken(request);

	if (!token) {
		throw new InventoryRouteError('INVALID_REQUEST', 'API token required.', 401);
	}

	const producerTokens = parseConfiguredTokens(readOptionalEnvString(env, 'PRODUCER_API_TOKENS'));
	const consumerTokens = parseConfiguredTokens(readOptionalEnvString(env, 'CONSUMER_API_TOKENS'));

	let role: ApiRole | null = producerTokens.has(token)
		? 'producer'
		: consumerTokens.has(token)
			? 'consumer'
			: null;

	if (!role && d1) {
		try {
			const db = getDb(d1);
			const keyHash = await hashApiToken(token);
			const rows = await db
				.select({ role: apiKeys.role, revokedAt: apiKeys.revokedAt })
				.from(apiKeys)
				.where(eq(apiKeys.keyHash, keyHash))
				.limit(1);

			if (rows.length > 0 && !rows[0].revokedAt) {
				role = rows[0].role as ApiRole;
			}
		} catch (cause) {
			if (!isMissingSchemaError(cause)) {
				throw cause;
			}
		}
	}

	if (!role) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Invalid API token.', 401);
	}

	if (!allowedRoles.includes(role)) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'This API token is not allowed to perform that action.',
			403
		);
	}

	return role;
}

export function normalizeTransactionInput(payload: unknown): Required<TransactionInput> {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Transaction payload must be a JSON object.', 400);
	}

	const actor = normalizeString(payload.actor, 'actor');
	const note = normalizeOptionalString(payload.note, 'note') ?? null;
	const recordedAt = normalizeTimestamp(payload.recordedAt);
	const lines = payload.lines;

	if (!Array.isArray(lines) || lines.length === 0) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'lines must contain at least one inventory change.',
			400
		);
	}

	const normalizedLines = lines.map((line, index) => {
		if (!isPlainObject(line)) {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
				`lines[${index}] must be a JSON object.`,
				400
			);
		}

		const partId = normalizeString(line.partId, `lines[${index}].partId`);
		const quantityDelta = line.quantityDelta;

		if (
			typeof quantityDelta !== 'number' ||
			!Number.isInteger(quantityDelta) ||
			quantityDelta === 0
		) {
			throw new InventoryRouteError(
				'INVALID_REQUEST',
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

export function normalizePartArchiveInput(payload: unknown): { id: string; archived: boolean } {
	if (!isPlainObject(payload)) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Archive payload must be a JSON object.', 400);
	}

	const id = normalizeString(payload.id, 'id');

	if (typeof payload.archived !== 'boolean') {
		throw new InventoryRouteError('INVALID_REQUEST', 'archived must be a boolean.', 400);
	}

	return {
		id,
		archived: payload.archived
	};
}

export function buildFtsQuery(query: string): string {
	const tokens = query
		.trim()
		.split(/\s+/)
		.map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ''))
		.filter(Boolean);

	if (tokens.length === 0) {
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'Search query must contain letters or numbers.',
			400
		);
	}

	return tokens.map((token) => `${token}*`).join(' AND ');
}

export async function listInventory(
	d1: D1Database,
	options: ListInventoryOptions = {}
): Promise<InventoryPart[]> {
	if (options.query) {
		let results = await searchInventory(d1, options.query, options.showArchived);
		if (options.mfgPartNumber && options.mfgPartNumber.length > 0) {
			results = results.filter((p) => options.mfgPartNumber!.includes(p.mfgPartNumber));
		}
		if (options.id && options.id.length > 0) {
			results = results.filter((p) => options.id!.includes(p.id));
		}
		return results;
	}

	const db = getDb(d1);
	const quantityExpression = sql<number>`coalesce(sum(${inventoryChanges.quantityDelta}), 0)`;

	const conditions = [];
	if (options.mfgPartNumber && options.mfgPartNumber.length > 0) {
		conditions.push(inArray(parts.mfgPartNumber, options.mfgPartNumber));
	}
	if (options.id && options.id.length > 0) {
		conditions.push(inArray(parts.id, options.id));
	}
	if (!options.showArchived) {
		conditions.push(isNull(parts.archivedAt));
	}

	let queryBuilder = db
		.select({
			id: parts.id,
			name: parts.name,
			mfgPartNumber: parts.mfgPartNumber,
			description: parts.description,
			metadata: parts.metadata,
			inventoryTypeId: parts.inventoryTypeId,
			inventoryTypeName: inventoryTypes.name,
			archivedAt: parts.archivedAt,
			updatedAt: parts.updatedAt,
			quantity: quantityExpression
		})
		.from(parts)
		.leftJoin(inventoryTypes, eq(parts.inventoryTypeId, inventoryTypes.id))
		.leftJoin(inventoryChanges, eq(parts.id, inventoryChanges.partId));

	if (conditions.length > 0) {
		const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
		queryBuilder = queryBuilder.where(whereCondition) as typeof queryBuilder;
	}

	const rows = await queryBuilder
		.groupBy(
			parts.id,
			parts.name,
			parts.mfgPartNumber,
			parts.description,
			parts.metadata,
			parts.inventoryTypeId,
			inventoryTypes.name,
			parts.archivedAt,
			parts.updatedAt
		)
		.orderBy(asc(parts.name));

	return rows.map((row) => ({
		...row,
		archivedAt: row.archivedAt ?? null,
		metadata: row.metadata ?? {},
		quantity: Number(row.quantity)
	}));
}

export async function searchInventory(
	d1: D1Database,
	query: string,
	showArchived = false
): Promise<InventoryPart[]> {
	const statement = d1
		.prepare(
			`
				SELECT
					p.id,
					p.name,
					p.mfg_part_number,
					p.description,
					p.metadata,
					p.inventory_type_id,
					it.name AS inventory_type_name,
					p.archived_at,
					p.updated_at,
					COALESCE(SUM(ic.quantity_delta), 0) AS quantity
				FROM parts_fts
				JOIN parts p ON p.rowid = parts_fts.rowid
				LEFT JOIN inventory_types it ON it.id = p.inventory_type_id
				LEFT JOIN inventory_changes ic ON ic.part_id = p.id
				WHERE parts_fts MATCH ?
				${showArchived ? '' : 'AND p.archived_at IS NULL'}
				GROUP BY p.id, p.name, p.mfg_part_number, p.description, p.metadata,
					p.inventory_type_id, it.name, p.archived_at, p.updated_at
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
		inventoryTypeId: row.inventory_type_id,
		inventoryTypeName: row.inventory_type_name,
		archivedAt: row.archived_at ?? null,
		updatedAt: row.updated_at,
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

	const filteredQuery = options.partId
		? baseQuery.where(eq(inventoryChanges.partId, options.partId))
		: baseQuery;

	const rows = await filteredQuery
		.orderBy(desc(inventoryChanges.recordedAt), desc(inventoryChanges.createdAt))
		.limit(options.limit ?? 50);

	return rows.map((row) => ({
		...row,
		usedIn: row.usedIn ?? null,
		note: row.note ?? null
	}));
}

export async function setPartArchivedState(
	d1: D1Database,
	payload: unknown
): Promise<InventoryPart> {
	const input = normalizePartArchiveInput(payload);
	return setPartArchivedStateById(d1, input.id, input.archived);
}

export async function setPartArchivedStateById(
	d1: D1Database,
	id: string,
	archived: boolean
): Promise<InventoryPart> {
	const partId = normalizeString(id, 'id');
	const db = getDb(d1);
	const existing = await db.select({ id: parts.id }).from(parts).where(eq(parts.id, partId)).limit(1);

	if (existing.length === 0) {
		throw new InventoryRouteError('INVALID_REQUEST', 'Part not found.', 404);
	}

	const updatedAt = new Date().toISOString();
	await db
		.update(parts)
		.set({
			archivedAt: archived ? updatedAt : null,
			updatedAt
		})
		.where(eq(parts.id, partId));

	const [part] = await listInventory(d1, { id: [partId], showArchived: true });
	return part;
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
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			'One or more transaction lines reference an unknown part.',
			400
		);
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
		throw new InventoryRouteError(
			'INVALID_REQUEST',
			`${fieldName} must be a non-empty string.`,
			400
		);
	}

	return value.trim();
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
	if (value == null) {
		return undefined;
	}

	if (typeof value !== 'string') {
		throw new InventoryRouteError('INVALID_REQUEST', `${fieldName} must be a string.`, 400);
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
			'INVALID_REQUEST',
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

function readOptionalEnvString(env: TokenEnv | undefined, key: string): string | undefined {
	const value = (env as Record<string, unknown> | undefined)?.[key];
	return typeof value === 'string' ? value : undefined;
}
