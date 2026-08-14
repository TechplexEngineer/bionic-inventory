export interface ApiParameterDoc {
	name: string;
	in: 'query' | 'header' | 'path' | 'body';
	type: string;
	required: boolean;
	description: string;
	default?: string;
	examples?: Record<string, { value: string }>;
}

export interface ApiFieldDoc {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

export interface ApiEndpointDoc {
	id: string;
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path: string;
	title: string;
	description: string;
	allowedRoles: Array<'producer' | 'consumer'>;
	parameters?: ApiParameterDoc[];
	requestBody?: {
		description: string;
		contentType: string;
		fields: ApiFieldDoc[];
		example: Record<string, unknown>;
	};
	responses: Array<{
		status: number;
		description: string;
		example: Record<string, unknown>;
	}>;
	curlExample: string;
	javascriptExample: string;
}

export interface ApiDocumentation {
	title: string;
	version: string;
	description: string;
	baseUrl: string;
	authentication: {
		description: string;
		headers: Array<{
			name: string;
			example: string;
			description: string;
		}>;
		roles: Array<{
			name: 'producer' | 'consumer';
			compatibilityEnvVar: string;
			description: string;
			permissions: string[];
		}>;
	};
	endpoints: ApiEndpointDoc[];
}

export function getApiDocumentation(): ApiDocumentation {
	return {
		title: 'Bionic Inventory API',
		version: '2.0.0',
		description:
			'RESTful microservice API for managing typed bionic inventory parts, validated metadata, inventory type definitions, faceted filters, multi-part stock transactions, full-text search, and historical activity tracking. Existing untyped parts remain visible for legacy compatibility. Provisioned D1-backed API keys from /keys are the primary authentication method; static environment tokens remain available as optional compatibility credentials.',
		baseUrl: '/api',
		authentication: {
			description:
				'Provision producer and consumer API keys in the administrator UI at /keys. Only key hashes and safe prefixes are stored in D1, and these provisioned keys are the primary authentication method. The PRODUCER_API_TOKENS and CONSUMER_API_TOKENS environment variables provide optional compatibility for legacy static tokens.',
			headers: [
				{
					name: 'x-api-token',
					example: 'x-api-token: your-producer-token',
					description: 'Pass the raw API token in the x-api-token HTTP header.'
				},
				{
					name: 'Authorization',
					example: 'Authorization: Bearer your-producer-token',
					description: 'Pass the token as a Bearer token in the standard HTTP Authorization header.'
				}
			],
			roles: [
				{
					name: 'producer',
					compatibilityEnvVar: 'PRODUCER_API_TOKENS',
					description:
						'Full read and write access for inventory management systems and automated tools.',
					permissions: [
						'GET /api/inventory - View all parts and stock levels',
						'GET /api/inventory/facets - List text metadata facet values',
						'GET /api/search - Full-text search parts catalog',
						'GET /api/history - View transaction audit history',
						'GET /api/types and /api/types/{id} - Read inventory type definitions',
						'POST, PUT, DELETE /api/types - Manage inventory type definitions',
						'POST /api/parts - Create new inventory parts',
						'PATCH /api/parts/{id} - Edit a part with optimistic concurrency',
						'PUT /api/parts - Archive or unarchive existing parts',
						'POST /api/transactions - Record stock changes (additions/consumption)'
					]
				},
				{
					name: 'consumer',
					compatibilityEnvVar: 'CONSUMER_API_TOKENS',
					description: 'Read-only access for reporting, dashboards, and inquiry services.',
					permissions: [
						'GET /api/inventory - View all parts and stock levels',
						'GET /api/inventory/facets - List text metadata facet values',
						'GET /api/types and /api/types/{id} - Read inventory type definitions',
						'GET /api/search - Full-text search parts catalog',
						'GET /api/history - View transaction audit history'
					]
				}
			]
		},
		endpoints: [
			{
				id: 'get-inventory',
				method: 'GET',
				path: '/api/inventory',
				title: 'List Inventory Parts',
				description:
					'Retrieves tracked inventory parts along with their computed current stock quantity (sum of all transaction deltas). Existing untyped rows remain visible when no type is selected and expose null type fields. Archived parts are hidden by default. Metadata filters require exactly one typeId, use stable property IDs, combine with AND, and exclude parts missing the filtered property.',
				allowedRoles: ['producer', 'consumer'],
				parameters: [
					{
						name: 'q',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Search query string. Matches part name, manufacturer part number, or description using full-text search.'
					},
					{
						name: 'mfgPartNumber',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Filter by manufacturer part number(s). Supports repeating query parameters (e.g. ?mfgPartNumber=PN1&mfgPartNumber=PN2) or comma-separated lists.'
					},
					{
						name: 'id',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Filter by part ID UUID(s). Supports repeating query parameters (e.g. ?id=uuid1&id=uuid2) or comma-separated lists.'
					},
					{
						name: 'showArchived',
						in: 'query',
						type: 'boolean',
						required: false,
						description:
							'Include archived parts in the response. Supports true/false, 1/0, yes/no, or on/off.'
					},
					{
						name: 'typeId',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Filter by one inventory type UUID. Required exactly once when any metadata filter is supplied.'
					},
					{
						name: 'meta[propertyId][operator]',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Filter metadata by stable property ID. Text supports exact or case-insensitive contains. Numeric supports exact and inclusive min/max; either range bound may be omitted. Conflicting or repeated scalar operators are rejected.',
						examples: metadataFilterExamples()
					}
				],
				responses: [
					{
						status: 200,
						description: 'List of inventory parts retrieved successfully.',
						example: {
							inventory: [
								{
									id: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
									name: '20T GT2 Pulley',
									mfgPartNumber: 'PULLEY-GT2-20T',
									description: 'Aluminum timing pulley with 5mm bore',
									metadata: { teeth: 20, pitch: 'GT2', boreMm: 5 },
									inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
									inventoryTypeName: 'Pulley',
									archivedAt: null,
									updatedAt: '2026-08-14T12:00:00.000Z',
									quantity: 42
								}
							]
						}
					},
					{
						status: 400,
						description: 'A metadata filter is malformed or incompatible with its property.',
						example: {
							error: 'Metadata filters must use meta[propertyId][exact|contains|min|max].',
							code: 'INVALID_REQUEST',
							field: 'meta[invalid]'
						}
					},
					{
						status: 404,
						description: 'The selected inventory type or property ID was not found.',
						example: {
							error: 'Inventory type not found.',
							code: 'TYPE_NOT_FOUND',
							field: 'typeId'
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.', code: 'INVALID_REQUEST' }
					}
				],
				curlExample: `curl -H "x-api-token: your-consumer-token" "https://example.com/api/inventory?typeId=type-uuid&meta[property-uuid][contains]=nyl"`,
				javascriptExample: `const response = await fetch('/api/inventory', {
  headers: { 'x-api-token': 'your-consumer-token' }
});
const data = await response.json();`
			},
			{
				id: 'get-inventory-facets',
				method: 'GET',
				path: '/api/inventory/facets',
				title: 'List Inventory Metadata Facets',
				description:
					'Returns distinct currently present values for each text property of the selected type. Every facet keeps search, archive, exact inventory, and other-property metadata filters while omitting only its own property filter. Values collapse without regard to ASCII casing and include matching counts.',
				allowedRoles: ['producer', 'consumer'],
				parameters: [
					{
						name: 'typeId',
						in: 'query',
						type: 'string',
						required: true,
						description: 'Inventory type UUID whose text properties should be faceted.'
					},
					{
						name: 'q',
						in: 'query',
						type: 'string',
						required: false,
						description: 'Full-text search applied before facet counts are calculated.'
					},
					{
						name: 'mfgPartNumber',
						in: 'query',
						type: 'string',
						required: false,
						description: 'Repeated or comma-separated manufacturer part number filter.'
					},
					{
						name: 'id',
						in: 'query',
						type: 'string',
						required: false,
						description: 'Repeated or comma-separated part UUID filter.'
					},
					{
						name: 'showArchived',
						in: 'query',
						type: 'boolean',
						required: false,
						description: 'Include archived parts when calculating facet values.'
					},
					{
						name: 'meta[propertyId][operator]',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Uses the same stable-ID exact, contains, min, and max syntax and validation as GET /inventory.',
						examples: metadataFilterExamples()
					}
				],
				responses: [
					{
						status: 200,
						description: 'Text metadata facets retrieved successfully.',
						example: {
							facets: [
								{
									propertyId: 'property-uuid',
									values: [
										{ value: 'Nylon', count: 3 },
										{ value: 'Rubber', count: 1 }
									]
								}
							]
						}
					},
					structuredError(
						400,
						'A required filter is missing or invalid.',
						'INVALID_REQUEST',
						'typeId'
					),
					structuredError(
						404,
						'The selected type or property was not found.',
						'TYPE_NOT_FOUND',
						'typeId'
					),
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST')
				],
				curlExample: `curl -H "x-api-token: your-consumer-token" "https://example.com/api/inventory/facets?typeId=type-uuid&meta[property-uuid][exact]=Nylon"`,
				javascriptExample: `const response = await fetch('/api/inventory/facets?typeId=type-uuid', {
  headers: { 'x-api-token': 'your-consumer-token' }
});
const data = await response.json();`
			},
			{
				id: 'get-search',
				method: 'GET',
				path: '/api/search',
				title: 'Search Inventory Catalog',
				description:
					'Performs full-text search (SQLite FTS5) across part names, manufacturer part numbers, and descriptions. Query tokens are prefix-matched. Archived parts are hidden unless showArchived is enabled.',
				allowedRoles: ['producer', 'consumer'],
				parameters: [
					{
						name: 'q',
						in: 'query',
						type: 'string',
						required: false,
						description:
							'Search query string (letters and numbers). Returns empty list if query is missing.'
					},
					{
						name: 'showArchived',
						in: 'query',
						type: 'boolean',
						required: false,
						description:
							'Include archived parts in search results. Supports true/false, 1/0, yes/no, or on/off.'
					}
				],
				responses: [
					{
						status: 200,
						description: 'Matching parts retrieved successfully.',
						example: {
							results: [
								{
									id: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
									name: '20T GT2 Pulley',
									mfgPartNumber: 'PULLEY-GT2-20T',
									description: 'Aluminum timing pulley with 5mm bore',
									metadata: { teeth: 20, pitch: 'GT2', boreMm: 5 },
									inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
									inventoryTypeName: 'Pulley',
									archivedAt: null,
									updatedAt: '2026-08-14T12:00:00.000Z',
									quantity: 42
								}
							]
						}
					},
					{
						status: 400,
						description: 'Search query does not contain valid search tokens.',
						example: {
							error: 'Search query must contain letters or numbers.',
							code: 'INVALID_REQUEST'
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.', code: 'INVALID_REQUEST' }
					}
				],
				curlExample: `curl -H "Authorization: Bearer your-consumer-token" "https://example.com/api/search?q=gt2"`,
				javascriptExample: `const response = await fetch('/api/search?q=gt2', {
  headers: { 'Authorization': 'Bearer your-consumer-token' }
});
const data = await response.json();`
			},
			{
				id: 'get-history',
				method: 'GET',
				path: '/api/history',
				title: 'List Inventory Change History',
				description:
					'Retrieves historical audit entries for inventory stock changes ordered by recorded time descending.',
				allowedRoles: ['producer', 'consumer'],
				parameters: [
					{
						name: 'partId',
						in: 'query',
						type: 'string',
						required: false,
						description: 'Optional part ID UUID to filter history entries for a specific part.'
					},
					{
						name: 'limit',
						in: 'query',
						type: 'number',
						required: false,
						default: '100',
						description: 'Maximum number of history records to return (1-200, default 100).'
					}
				],
				responses: [
					{
						status: 200,
						description: 'History records retrieved successfully.',
						example: {
							history: [
								{
									id: 'e8d2a1f0-3b4c-4d5e-9f6a-7b8c9d0e1f2a',
									transactionId: 't9a8b7c6-d5e4-4f3a-8b2c-1d0e9f8a7b6c',
									partId: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
									partName: '20T GT2 Pulley',
									mfgPartNumber: 'PULLEY-GT2-20T',
									quantityDelta: -2,
									actor: 'assembly-line-1',
									usedIn: 'Order-1042',
									note: 'Restocked inbound shipment',
									recordedAt: '2026-08-08T10:00:00.000Z'
								}
							]
						}
					},
					{
						status: 400,
						description: 'Invalid limit parameter.',
						example: {
							error: 'The "limit" query parameter must be a positive integer.',
							code: 'INVALID_REQUEST'
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.', code: 'INVALID_REQUEST' }
					}
				],
				curlExample: `curl -H "x-api-token: your-consumer-token" "https://example.com/api/history?limit=50"`,
				javascriptExample: `const response = await fetch('/api/history?limit=50', {
  headers: { 'x-api-token': 'your-consumer-token' }
});
const data = await response.json();`
			},
			{
				id: 'post-parts',
				method: 'POST',
				path: '/api/parts',
				title: 'Create Part',
				description:
					'Registers a new typed part. Every new part requires a valid inventoryTypeId, and metadata is canonicalized and validated against the current definition. Undefined extra metadata keys remain allowed.',
				allowedRoles: ['producer'],
				requestBody: {
					description: 'JSON object describing the new part.',
					contentType: 'application/json',
					fields: [
						{
							name: 'name',
							type: 'string',
							required: true,
							description: 'Non-empty string part name.'
						},
						{
							name: 'mfgPartNumber',
							type: 'string',
							required: true,
							description: 'Unique manufacturer part number string.'
						},
						{
							name: 'description',
							type: 'string',
							required: false,
							description: 'Optional part description (defaults to empty string).'
						},
						{
							name: 'inventoryTypeId',
							type: 'string',
							required: true,
							description: 'Existing inventory type UUID used to validate metadata.'
						},
						{
							name: 'metadata',
							type: 'object',
							required: false,
							description:
								'JSON object validated against the selected type. Required defined fields must be present; defined keys are canonicalized without regard to case; extra undefined keys are preserved.'
						}
					],
					example: {
						name: '20T GT2 Pulley',
						mfgPartNumber: 'PULLEY-GT2-20T',
						description: 'Aluminum timing pulley with 5mm bore',
						inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
						metadata: {
							teeth: 20,
							pitch: 'GT2',
							boreMm: 5
						}
					}
				},
				responses: [
					{
						status: 201,
						description: 'Part created successfully.',
						example: {
							part: {
								id: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
								name: '20T GT2 Pulley',
								mfgPartNumber: 'PULLEY-GT2-20T',
								description: 'Aluminum timing pulley with 5mm bore',
								metadata: { teeth: 20, pitch: 'GT2', boreMm: 5 },
								inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
								inventoryTypeName: 'Pulley',
								archivedAt: null,
								updatedAt: '2026-08-14T12:00:00.000Z',
								quantity: 0
							}
						}
					},
					{
						status: 400,
						description: 'Invalid JSON payload or missing required fields.',
						example: {
							error: 'mfgPartNumber must be a non-empty string.',
							code: 'INVALID_REQUEST',
							field: 'mfgPartNumber'
						}
					},
					{
						status: 404,
						description: 'The selected inventory type was not found.',
						example: {
							error: 'Inventory type not found.',
							code: 'TYPE_NOT_FOUND',
							field: 'inventoryTypeId'
						}
					},
					{
						status: 409,
						description: 'Conflict: Manufacturer part number already exists.',
						example: {
							error: 'A part with that manufacturer part number already exists.',
							code: 'INVALID_REQUEST',
							field: 'mfgPartNumber'
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.', code: 'INVALID_REQUEST' }
					},
					{
						status: 403,
						description: 'Token does not have producer role.',
						example: {
							error: 'This API token is not allowed to perform that action.',
							code: 'INVALID_REQUEST'
						}
					}
				],
				curlExample: `curl -X POST "https://example.com/api/parts" \\
  -H "x-api-token: your-producer-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "20T GT2 Pulley",
    "mfgPartNumber": "PULLEY-GT2-20T",
    "description": "Aluminum timing pulley",
	"inventoryTypeId": "type-uuid-here",
    "metadata": { "teeth": 20, "pitch": "GT2" }
  }'`,
				javascriptExample: `const response = await fetch('/api/parts', {
  method: 'POST',
  headers: {
    'x-api-token': 'your-producer-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '20T GT2 Pulley',
    mfgPartNumber: 'PULLEY-GT2-20T',
    description: 'Aluminum timing pulley',
	inventoryTypeId: 'type-uuid-here',
    metadata: { teeth: 20, pitch: 'GT2' }
  })
});
const data = await response.json();`
			},
			{
				id: 'put-parts',
				method: 'PUT',
				path: '/api/parts',
				title: 'Archive or Unarchive Part',
				description:
					"Marks an existing part as archived instead of deleting it, or clears the archived flag to unarchive it. This legacy compatibility mutation does not require updatedAt and does not remove the part's inventory type reference.",
				allowedRoles: ['producer'],
				requestBody: {
					description: 'JSON object identifying the part and desired archived state.',
					contentType: 'application/json',
					fields: [
						{
							name: 'id',
							type: 'string',
							required: true,
							description: 'Existing part UUID.'
						},
						{
							name: 'archived',
							type: 'boolean',
							required: true,
							description: 'Set to true to archive the part, or false to unarchive it.'
						}
					],
					example: {
						id: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
						archived: true
					}
				},
				responses: [
					{
						status: 200,
						description: 'Part archive state updated successfully.',
						example: {
							part: {
								id: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
								name: '20T GT2 Pulley',
								mfgPartNumber: 'PULLEY-GT2-20T',
								description: 'Aluminum timing pulley with 5mm bore',
								metadata: { teeth: 20, pitch: 'GT2', boreMm: 5 },
								inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
								inventoryTypeName: 'Pulley',
								archivedAt: '2026-08-12T10:00:00.000Z',
								updatedAt: '2026-08-14T12:00:00.000Z',
								quantity: 42
							}
						}
					},
					{
						status: 400,
						description: 'Invalid archive request body.',
						example: {
							error: 'archived must be a boolean.',
							code: 'INVALID_REQUEST'
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.', code: 'INVALID_REQUEST' }
					},
					{
						status: 403,
						description: 'Token does not have producer role.',
						example: {
							error: 'This API token is not allowed to perform that action.',
							code: 'INVALID_REQUEST'
						}
					},
					{
						status: 404,
						description: 'Part was not found.',
						example: { error: 'Part not found.', code: 'INVALID_REQUEST' }
					}
				],
				curlExample: `curl -X PUT "https://example.com/api/parts" \\
  -H "x-api-token: your-producer-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "part-uuid-here",
    "archived": true
  }'`,
				javascriptExample: `const response = await fetch('/api/parts', {
  method: 'PUT',
  headers: {
    'x-api-token': 'your-producer-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'part-uuid-here',
    archived: true
  })
});
const data = await response.json();`
			},
			{
				id: 'patch-part',
				method: 'PATCH',
				path: '/api/parts/{id}',
				title: 'Edit Part',
				description:
					'Partially edits a part while validating the complete resulting record against its current or destination type. updatedAt is the required optimistic-concurrency precondition. Omitted ordinary fields keep stored values; supplied metadata replaces the whole metadata object rather than deep merging. A grandfathered nonconforming part remains readable but any edit must repair the complete record.',
				allowedRoles: ['producer'],
				parameters: [pathIdParameter('Part UUID to edit.')],
				requestBody: {
					description: 'Partial part fields plus the last observed updatedAt value.',
					contentType: 'application/json',
					fields: [
						{
							name: 'name',
							type: 'string',
							required: false,
							description: 'Replacement part name.'
						},
						{
							name: 'mfgPartNumber',
							type: 'string',
							required: false,
							description: 'Replacement unique manufacturer part number.'
						},
						{
							name: 'description',
							type: 'string',
							required: false,
							description: 'Replacement description.'
						},
						{
							name: 'inventoryTypeId',
							type: 'string',
							required: false,
							description:
								'Destination inventory type UUID; existing metadata must conform if metadata is omitted.'
						},
						{
							name: 'metadata',
							type: 'object',
							required: false,
							description:
								'When supplied, replaces the complete metadata object and is canonicalized and validated.'
						},
						{
							name: 'updatedAt',
							type: 'string',
							required: true,
							description: 'ISO-8601 timestamp last read by the client.'
						}
					],
					example: {
						metadata: { Material: 'Nylon', Width: 12 },
						updatedAt: '2026-08-14T12:00:00.000Z'
					}
				},
				responses: [
					{
						status: 200,
						description: 'Part updated successfully.',
						example: { part: inventoryPartExample() }
					},
					structuredError(
						400,
						'The resulting typed part is invalid.',
						'METADATA_REQUIRED',
						'metadata.Material'
					),
					structuredError(404, 'The part or destination type was not found.', 'PART_NOT_FOUND'),
					structuredError(
						409,
						'The part changed after the client read it.',
						'PART_UPDATE_CONFLICT',
						'updatedAt'
					),
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST'),
					structuredError(403, 'Token does not have producer role.', 'INVALID_REQUEST')
				],
				curlExample: `curl -X PATCH "https://example.com/api/parts/part-uuid" \\
  -H "x-api-token: your-producer-token" -H "Content-Type: application/json" \\
  -d '{"metadata":{"Material":"Nylon","Width":12},"updatedAt":"2026-08-14T12:00:00.000Z"}'`,
				javascriptExample: `await fetch('/api/parts/part-uuid', {
  method: 'PATCH',
  headers: { 'x-api-token': 'your-producer-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ metadata: { Material: 'Nylon', Width: 12 }, updatedAt })
});`
			},
			{
				id: 'list-types',
				method: 'GET',
				path: '/api/types',
				title: 'List Inventory Types',
				description:
					'Lists every inventory type with its complete property definition and stable property IDs.',
				allowedRoles: ['producer', 'consumer'],
				responses: [
					{
						status: 200,
						description: 'Inventory types retrieved successfully.',
						example: { types: [inventoryTypeExample()] }
					},
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST')
				],
				curlExample: `curl -H "x-api-token: your-consumer-token" "https://example.com/api/types"`,
				javascriptExample: `const { types } = await (await fetch('/api/types', { headers: { 'x-api-token': token } })).json();`
			},
			{
				id: 'create-type',
				method: 'POST',
				path: '/api/types',
				title: 'Create Inventory Type',
				description:
					'Creates a case-insensitively unique type and complete property definition. Text properties cannot have bounds; numeric bounds are inclusive and may be one-sided. Property IDs are assigned by the server.',
				allowedRoles: ['producer'],
				requestBody: typeDefinitionRequest(false),
				responses: [
					{
						status: 201,
						description: 'Inventory type created successfully.',
						example: { type: inventoryTypeExample() }
					},
					structuredError(
						400,
						'The type definition is invalid.',
						'INVALID_PROPERTY_BOUNDS',
						'properties[0]'
					),
					structuredError(
						409,
						'A case-insensitively equivalent type name already exists.',
						'DUPLICATE_TYPE_NAME',
						'name'
					),
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST'),
					structuredError(403, 'Token does not have producer role.', 'INVALID_REQUEST')
				],
				curlExample: typeCreateCurlExample(),
				javascriptExample: typeCreateJavascriptExample()
			},
			{
				id: 'get-type',
				method: 'GET',
				path: '/api/types/{id}',
				title: 'Get Inventory Type',
				description: 'Returns one inventory type and its complete property definition.',
				allowedRoles: ['producer', 'consumer'],
				parameters: [pathIdParameter('Inventory type UUID to read.')],
				responses: [
					{
						status: 200,
						description: 'Inventory type retrieved successfully.',
						example: { type: inventoryTypeExample() }
					},
					structuredError(404, 'Inventory type was not found.', 'TYPE_NOT_FOUND'),
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST')
				],
				curlExample: `curl -H "x-api-token: your-consumer-token" "https://example.com/api/types/type-uuid"`,
				javascriptExample: `const { type } = await (await fetch('/api/types/type-uuid', { headers: { 'x-api-token': token } })).json();`
			},
			{
				id: 'replace-type',
				method: 'PUT',
				path: '/api/types/{id}',
				title: 'Replace Inventory Type',
				description:
					'Atomically replaces the type name and complete property definition. updatedAt is the required optimistic-concurrency precondition. Retained properties include their stable IDs and cannot change name or kind; omission deletes a property and an entry without an ID creates one. Existing parts are not rewritten or rejected and may become grandfathered.',
				allowedRoles: ['producer'],
				parameters: [pathIdParameter('Inventory type UUID to replace.')],
				requestBody: typeDefinitionRequest(true),
				responses: [
					{
						status: 200,
						description: 'Inventory type replaced successfully.',
						example: { type: inventoryTypeExample() }
					},
					structuredError(
						400,
						'The complete replacement definition is invalid.',
						'INVALID_REQUEST',
						'properties'
					),
					structuredError(
						404,
						'The type or retained property ID was not found.',
						'PROPERTY_NOT_FOUND',
						'properties'
					),
					structuredError(
						409,
						'The type changed after it was read or an immutable property field changed.',
						'TYPE_UPDATE_CONFLICT',
						'updatedAt'
					),
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST'),
					structuredError(403, 'Token does not have producer role.', 'INVALID_REQUEST')
				],
				curlExample: `curl -X PUT "https://example.com/api/types/type-uuid" -H "x-api-token: your-producer-token" -H "Content-Type: application/json" --data @type.json`,
				javascriptExample: `await fetch('/api/types/type-uuid', { method: 'PUT', headers: { 'x-api-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(definition) });`
			},
			{
				id: 'delete-type',
				method: 'DELETE',
				path: '/api/types/{id}',
				title: 'Delete Inventory Type',
				description:
					'Deletes an unreferenced type. Any active or archived part reference blocks deletion; archiving never releases the reference.',
				allowedRoles: ['producer'],
				parameters: [pathIdParameter('Inventory type UUID to delete.')],
				responses: [
					{
						status: 204,
						description: 'Inventory type deleted successfully.',
						example: {}
					},
					structuredError(404, 'Inventory type was not found.', 'TYPE_NOT_FOUND'),
					structuredError(409, 'Active or archived parts still reference the type.', 'TYPE_IN_USE'),
					structuredError(401, 'Missing or invalid API token.', 'INVALID_REQUEST'),
					structuredError(403, 'Token does not have producer role.', 'INVALID_REQUEST')
				],
				curlExample: `curl -X DELETE -H "x-api-token: your-producer-token" "https://example.com/api/types/type-uuid"`,
				javascriptExample: `await fetch('/api/types/type-uuid', { method: 'DELETE', headers: { 'x-api-token': token } });`
			},
			{
				id: 'post-transactions',
				method: 'POST',
				path: '/api/transactions',
				title: 'Record Inventory Transaction',
				description:
					'Records an atomic inventory transaction with one or more quantity changes (increments or decrements). All target parts must exist in the database.',
				allowedRoles: ['producer'],
				requestBody: {
					description: 'JSON object containing transaction actor, optional note, and change lines.',
					contentType: 'application/json',
					fields: [
						{
							name: 'actor',
							type: 'string',
							required: true,
							description: 'Non-empty identifier of the user or system performing the operation.'
						},
						{
							name: 'recordedAt',
							type: 'string',
							required: false,
							description: 'ISO-8601 timestamp string (defaults to current server timestamp).'
						},
						{
							name: 'note',
							type: 'string',
							required: false,
							description: 'Optional note or reference comment for the transaction.'
						},
						{
							name: 'lines',
							type: 'array',
							required: true,
							description:
								'Array of line objects. Must contain at least one line item.\nEach line object:\n- `partId` (string, required): Target part UUID.\n- `quantityDelta` (integer, required): Non-zero change amount (+ to add, - to consume).\n- `usedIn` (string, optional): Assembly or order reference.'
						}
					],
					example: {
						actor: 'assembly-line-1',
						recordedAt: '2026-08-08T10:00:00.000Z',
						note: 'Restocked inbound shipment and consumed assembly parts',
						lines: [
							{
								partId: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
								quantityDelta: 25
							},
							{
								partId: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d',
								quantityDelta: -2,
								usedIn: 'Order-1042'
							}
						]
					}
				},
				responses: [
					{
						status: 201,
						description: 'Transaction recorded successfully.',
						example: {
							transaction: {
								transactionId: 't9a8b7c6-d5e4-4f3a-8b2c-1d0e9f8a7b6c',
								recordedAt: '2026-08-08T10:00:00.000Z',
								lineCount: 2
							}
						}
					},
					{
						status: 400,
						description: 'Invalid transaction payload or unknown part ID.',
						example: {
							error: 'One or more transaction lines reference an unknown part.',
							code: 'INVALID_REQUEST'
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.', code: 'INVALID_REQUEST' }
					},
					{
						status: 403,
						description: 'Token does not have producer role.',
						example: {
							error: 'This API token is not allowed to perform that action.',
							code: 'INVALID_REQUEST'
						}
					}
				],
				curlExample: `curl -X POST "https://example.com/api/transactions" \\
  -H "x-api-token: your-producer-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "actor": "assembly-line-1",
    "note": "Restocked inbound shipment",
    "lines": [
      { "partId": "part-uuid-here", "quantityDelta": 25 }
    ]
  }'`,
				javascriptExample: `const response = await fetch('/api/transactions', {
  method: 'POST',
  headers: {
    'x-api-token': 'your-producer-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    actor: 'assembly-line-1',
    note: 'Restocked inbound shipment',
    lines: [
      { partId: 'part-uuid-here', quantityDelta: 25 }
    ]
  })
});
const data = await response.json();`
			}
		]
	};
}

export function getOpenApiSpec(): Record<string, unknown> {
	const docs = getApiDocumentation();
	const paths: Record<string, Record<string, unknown>> = {};

	for (const ep of docs.endpoints) {
		const relativePath = ep.path.replace(/^\/api/, '');
		if (!paths[relativePath]) {
			paths[relativePath] = {};
		}

		const parameters = (ep.parameters || []).map((p) => ({
			name: p.name,
			in: p.in,
			required: p.required,
			description: p.description,
			schema: {
				type: p.type === 'number' ? 'integer' : p.type,
				...(p.default ? { default: p.default } : {})
			},
			...(p.examples ? { examples: p.examples } : {})
		}));

		const responses: Record<string, unknown> = {};
		for (const r of ep.responses) {
			const schema = responseSchema(ep.id, r.status);
			responses[String(r.status)] = {
				description: r.description,
				...(r.status === 204
					? {}
					: {
							content: {
								'application/json': {
									...(schema ? { schema } : {}),
									example: r.example
								}
							}
						})
			};
		}

		const operation: Record<string, unknown> = {
			summary: ep.title,
			description: ep.description,
			operationId: ep.id,
			tags: [ep.path.split('/')[2] || 'general'],
			security: [{ 'x-api-token': [] }, { bearerAuth: [] }],
			responses
		};

		if (parameters.length > 0) {
			operation.parameters = parameters;
		}

		if (ep.requestBody) {
			operation.requestBody = {
				description: ep.requestBody.description,
				required: true,
				content: {
					'application/json': {
						schema: buildRequestBodySchema(ep),
						example: ep.requestBody.example
					}
				}
			};
		}

		paths[relativePath][ep.method.toLowerCase()] = operation;
	}

	return {
		openapi: '3.1.0',
		info: {
			title: docs.title,
			version: docs.version,
			description: docs.description
		},
		servers: [
			{
				url: '/api',
				description: 'Bionic Inventory API Server'
			}
		],
		paths,
		components: {
			securitySchemes: {
				'x-api-token': {
					type: 'apiKey',
					in: 'header',
					name: 'x-api-token',
					description: 'Pass your API token in the x-api-token header'
				},
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					description: 'Pass your API token as a Bearer token in the Authorization header'
				}
			},
			schemas: openApiSchemas()
		}
	};
}

function buildRequestBodySchema(ep: ApiEndpointDoc): Record<string, unknown> {
	if (!ep.requestBody) return {};

	if (ep.id === 'post-parts') {
		return {
			type: 'object',
			required: ['name', 'mfgPartNumber', 'inventoryTypeId'],
			properties: {
				name: {
					type: 'string',
					description: 'Non-empty string part name (e.g. "20T GT2 Pulley").'
				},
				mfgPartNumber: {
					type: 'string',
					description: 'Unique manufacturer part number string (e.g. "PULLEY-GT2-20T").'
				},
				description: {
					type: 'string',
					description: 'Optional part description (defaults to empty string).'
				},
				inventoryTypeId: {
					type: 'string',
					format: 'uuid',
					description: 'Existing inventory type UUID used to validate metadata.'
				},
				metadata: {
					type: 'object',
					additionalProperties: true,
					description:
						'Optional metadata validated against the selected type; undefined extra keys remain permitted.'
				}
			}
		};
	}

	if (ep.id === 'patch-part') {
		return {
			type: 'object',
			required: ['updatedAt'],
			properties: {
				name: { type: 'string' },
				mfgPartNumber: { type: 'string' },
				description: { type: 'string' },
				inventoryTypeId: { type: 'string', format: 'uuid' },
				metadata: {
					type: 'object',
					additionalProperties: true,
					description:
						'When supplied, replaces the complete metadata object rather than deep merging it.'
				},
				updatedAt: {
					type: 'string',
					format: 'date-time',
					description:
						'Last observed part timestamp used as an optimistic-concurrency precondition.'
				}
			}
		};
	}

	if (ep.id === 'create-type' || ep.id === 'replace-type') {
		return {
			type: 'object',
			required:
				ep.id === 'replace-type' ? ['name', 'properties', 'updatedAt'] : ['name', 'properties'],
			properties: {
				name: {
					type: 'string',
					description: 'Case-insensitively unique display name.'
				},
				properties: {
					type: 'array',
					items: { $ref: '#/components/schemas/InventoryTypePropertyInput' }
				},
				...(ep.id === 'replace-type'
					? {
							updatedAt: {
								type: 'string',
								format: 'date-time',
								description:
									'Last observed type timestamp used as an optimistic-concurrency precondition.'
							}
						}
					: {})
			}
		};
	}

	if (ep.id === 'post-transactions') {
		return {
			type: 'object',
			required: ['actor', 'lines'],
			properties: {
				actor: {
					type: 'string',
					description: 'Non-empty identifier of the user or system executing the transaction.'
				},
				recordedAt: {
					type: 'string',
					format: 'date-time',
					description: 'ISO-8601 timestamp string (defaults to current server timestamp).'
				},
				note: {
					type: 'string',
					nullable: true,
					description: 'Optional reference note or comment.'
				},
				lines: {
					type: 'array',
					minItems: 1,
					description: 'Non-empty array of transaction line objects.',
					items: {
						type: 'object',
						required: ['partId', 'quantityDelta'],
						properties: {
							partId: {
								type: 'string',
								format: 'uuid',
								description: 'Target part UUID string.'
							},
							quantityDelta: {
								type: 'integer',
								description: 'Non-zero integer change (+ to add stock, - to consume stock).'
							},
							usedIn: {
								type: 'string',
								nullable: true,
								description: 'Optional assembly or order reference.'
							}
						}
					}
				}
			}
		};
	}

	const required = ep.requestBody.fields.filter((f) => f.required).map((f) => f.name);
	const properties: Record<string, unknown> = {};
	for (const f of ep.requestBody.fields) {
		properties[f.name] = {
			type: f.type,
			description: f.description
		};
	}

	return {
		type: 'object',
		...(required.length > 0 ? { required } : {}),
		properties
	};
}

function metadataFilterExamples(): Record<string, { value: string }> {
	return {
		exact: { value: 'meta[property-id][exact]=Nylon' },
		contains: { value: 'meta[property-id][contains]=nyl' },
		minimum: { value: 'meta[property-id][min]=10' },
		maximum: { value: 'meta[property-id][max]=20' }
	};
}

function pathIdParameter(description: string): ApiParameterDoc {
	return {
		name: 'id',
		in: 'path',
		type: 'string',
		required: true,
		description
	};
}

function structuredError(
	status: number,
	description: string,
	code: string,
	field?: string
): ApiEndpointDoc['responses'][number] {
	return {
		status,
		description,
		example: { error: description, code, ...(field ? { field } : {}) }
	};
}

function inventoryTypeExample(): Record<string, unknown> {
	return {
		id: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
		name: 'Belt',
		normalizedName: 'belt',
		createdAt: '2026-08-14T12:00:00.000Z',
		updatedAt: '2026-08-14T12:00:00.000Z',
		properties: [
			{
				id: '4cf9691e-d690-4efc-b3b6-1784f63e6209',
				inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
				name: 'Material',
				normalizedName: 'material',
				kind: 'text',
				required: true,
				minimum: null,
				maximum: null,
				createdAt: '2026-08-14T12:00:00.000Z',
				updatedAt: '2026-08-14T12:00:00.000Z'
			},
			{
				id: '6ffbb065-141b-46d6-b64e-b506b44552be',
				inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
				name: 'Width',
				normalizedName: 'width',
				kind: 'numeric',
				required: false,
				minimum: 1,
				maximum: 100,
				createdAt: '2026-08-14T12:00:00.000Z',
				updatedAt: '2026-08-14T12:00:00.000Z'
			}
		]
	};
}

function inventoryPartExample(): Record<string, unknown> {
	return {
		id: 'c1f7b8e2-4a5d-4e2b-9f1a-8c3d7e5f2b0a',
		name: 'Timing Belt',
		mfgPartNumber: 'BELT-NYLON-12',
		description: '12mm nylon timing belt',
		metadata: { Material: 'Nylon', Width: 12 },
		inventoryTypeId: '4d79bf21-22ef-44d9-905c-60f2370f74d7',
		inventoryTypeName: 'Belt',
		quantity: 0,
		archivedAt: null,
		updatedAt: '2026-08-14T12:00:00.000Z'
	};
}

function typeDefinitionRequest(replacement: boolean): NonNullable<ApiEndpointDoc['requestBody']> {
	return {
		description: replacement
			? 'Complete replacement definition including stable IDs for retained properties and the last observed updatedAt.'
			: 'Complete initial type and property definition. Property IDs are generated by the server.',
		contentType: 'application/json',
		fields: [
			{
				name: 'name',
				type: 'string',
				required: true,
				description: 'Case-insensitively unique type name.'
			},
			{
				name: 'properties',
				type: 'array',
				required: true,
				description:
					'Complete property array. Each entry has optional stable id on replacement, name, text or numeric kind, required boolean, and optional one-sided numeric minimum/maximum.'
			},
			...(replacement
				? [
						{
							name: 'updatedAt',
							type: 'string',
							required: true,
							description: 'ISO-8601 timestamp last read by the client.'
						}
					]
				: [])
		],
		example: {
			name: 'Belt',
			properties: [
				{
					...(replacement ? { id: '4cf9691e-d690-4efc-b3b6-1784f63e6209' } : {}),
					name: 'Material',
					kind: 'text',
					required: true
				},
				{
					name: 'Width',
					kind: 'numeric',
					required: false,
					minimum: 1,
					maximum: 100
				}
			],
			...(replacement ? { updatedAt: '2026-08-14T12:00:00.000Z' } : {})
		}
	};
}

function typeCreateCurlExample(): string {
	return `curl -X POST "https://example.com/api/types" \\
  -H "x-api-token: your-producer-token" -H "Content-Type: application/json" \\
  -d '{"name":"Belt","properties":[{"name":"Material","kind":"text","required":true},{"name":"Width","kind":"numeric","required":false,"minimum":1}]}'`;
}

function typeCreateJavascriptExample(): string {
	return `await fetch('/api/types', {
  method: 'POST',
  headers: { 'x-api-token': token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Belt', properties: [{ name: 'Material', kind: 'text', required: true }] })
});`;
}

function responseSchema(operationId: string, status: number): Record<string, unknown> | undefined {
	if (status >= 400) return { $ref: '#/components/schemas/StructuredError' };
	if (operationId === 'get-inventory') {
		return objectEnvelope('inventory', {
			type: 'array',
			items: { $ref: '#/components/schemas/InventoryPart' }
		});
	}
	if (operationId === 'get-search') {
		return objectEnvelope('results', {
			type: 'array',
			items: { $ref: '#/components/schemas/InventoryPart' }
		});
	}
	if (operationId === 'get-inventory-facets') {
		return objectEnvelope('facets', {
			type: 'array',
			items: { $ref: '#/components/schemas/InventoryFacet' }
		});
	}
	if (operationId === 'list-types') {
		return objectEnvelope('types', {
			type: 'array',
			items: { $ref: '#/components/schemas/InventoryType' }
		});
	}
	if (['create-type', 'get-type', 'replace-type'].includes(operationId)) {
		return objectEnvelope('type', {
			$ref: '#/components/schemas/InventoryType'
		});
	}
	if (['post-parts', 'put-parts', 'patch-part'].includes(operationId)) {
		return objectEnvelope('part', {
			$ref: '#/components/schemas/InventoryPart'
		});
	}
	return undefined;
}

function objectEnvelope(name: string, schema: Record<string, unknown>): Record<string, unknown> {
	return { type: 'object', required: [name], properties: { [name]: schema } };
}

function openApiSchemas(): Record<string, unknown> {
	const timestamp = { type: 'string', format: 'date-time' };
	return {
		StructuredError: {
			type: 'object',
			required: ['error', 'code'],
			properties: {
				error: { type: 'string', description: 'Human-readable error message.' },
				code: {
					type: 'string',
					description: 'Stable machine-readable error code.'
				},
				field: {
					type: 'string',
					description: 'Request field or query path associated with the error.'
				}
			}
		},
		InventoryTypePropertyInput: {
			type: 'object',
			required: ['name', 'kind', 'required'],
			properties: {
				id: {
					type: 'string',
					format: 'uuid',
					description: 'Stable ID required only when retaining a property during replacement.'
				},
				name: { type: 'string' },
				kind: { type: 'string', enum: ['text', 'numeric'] },
				required: { type: 'boolean' },
				minimum: {
					type: ['number', 'null'],
					description: 'Inclusive numeric lower bound; may be used without maximum.'
				},
				maximum: {
					type: ['number', 'null'],
					description: 'Inclusive numeric upper bound; may be used without minimum.'
				}
			}
		},
		InventoryTypeProperty: {
			type: 'object',
			required: [
				'id',
				'inventoryTypeId',
				'name',
				'normalizedName',
				'kind',
				'required',
				'minimum',
				'maximum',
				'createdAt',
				'updatedAt'
			],
			properties: {
				id: {
					type: 'string',
					format: 'uuid',
					description:
						'Stable property ID used in replacement payloads and metadata filter brackets.'
				},
				inventoryTypeId: { type: 'string', format: 'uuid' },
				name: {
					type: 'string',
					description: 'Canonical metadata key spelling.'
				},
				normalizedName: { type: 'string', readOnly: true },
				kind: { type: 'string', enum: ['text', 'numeric'] },
				required: { type: 'boolean' },
				minimum: { type: ['number', 'null'] },
				maximum: { type: ['number', 'null'] },
				createdAt: timestamp,
				updatedAt: timestamp
			}
		},
		InventoryType: {
			type: 'object',
			required: ['id', 'name', 'normalizedName', 'createdAt', 'updatedAt', 'properties'],
			properties: {
				id: { type: 'string', format: 'uuid' },
				name: { type: 'string' },
				normalizedName: { type: 'string', readOnly: true },
				createdAt: timestamp,
				updatedAt: timestamp,
				properties: {
					type: 'array',
					items: { $ref: '#/components/schemas/InventoryTypeProperty' }
				}
			}
		},
		InventoryPart: {
			type: 'object',
			required: [
				'id',
				'name',
				'mfgPartNumber',
				'description',
				'metadata',
				'inventoryTypeId',
				'inventoryTypeName',
				'quantity',
				'archivedAt',
				'updatedAt'
			],
			properties: {
				id: { type: 'string', format: 'uuid' },
				name: { type: 'string' },
				mfgPartNumber: { type: 'string' },
				description: { type: 'string' },
				metadata: { type: 'object', additionalProperties: true },
				inventoryTypeId: {
					type: ['string', 'null'],
					format: 'uuid',
					description: 'Null only for migrated legacy parts.'
				},
				inventoryTypeName: {
					type: ['string', 'null'],
					description: 'Null only for migrated legacy parts.'
				},
				quantity: { type: 'integer' },
				archivedAt: { type: ['string', 'null'], format: 'date-time' },
				updatedAt: timestamp
			}
		},
		InventoryFacet: {
			type: 'object',
			required: ['propertyId', 'values'],
			properties: {
				propertyId: { type: 'string', format: 'uuid' },
				values: {
					type: 'array',
					items: {
						type: 'object',
						required: ['value', 'count'],
						properties: {
							value: { type: 'string' },
							count: { type: 'integer' }
						}
					}
				}
			}
		}
	};
}
