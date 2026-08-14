import { json } from '@sveltejs/kit';

export class InventoryRouteError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly status: number,
		public readonly field?: string
	) {
		super(message);
	}
}

export function handleInventoryError(cause: unknown): Response {
	if (cause instanceof InventoryRouteError) {
		return json(
			{ error: cause.message, code: cause.code, ...(cause.field ? { field: cause.field } : {}) },
			{ status: cause.status }
		);
	}

	if (cause instanceof SyntaxError) {
		return json({ error: 'Request body must be valid JSON.', code: 'INVALID_JSON' }, { status: 400 });
	}

	if (isMissingSchemaError(cause)) {
		return json(
			{
				error: 'The database schema has not been initialized. Run the D1 migration first.',
				code: 'SCHEMA_NOT_INITIALIZED'
			},
			{ status: 503 }
		);
	}

	console.error(cause);
	return json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, { status: 500 });
}

export function isMissingSchemaError(cause: unknown): boolean {
	return cause instanceof Error && /no such table|no such virtual table/i.test(cause.message);
}
