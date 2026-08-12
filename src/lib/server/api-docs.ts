export interface ApiParameterDoc {
	name: string;
	in: 'query' | 'header' | 'body';
	type: string;
	required: boolean;
	description: string;
	default?: string;
}

export interface ApiFieldDoc {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

export interface ApiEndpointDoc {
	id: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
		version: '1.0.0',
		description:
			'RESTful microservice API for managing bionic inventory parts, multi-part stock transactions, full-text search, and historical activity tracking. Provisioned D1-backed API keys from /keys are the primary authentication method; static environment tokens remain available as optional compatibility credentials.',
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
					description: 'Full read and write access for inventory management systems and automated tools.',
					permissions: [
						'GET /api/inventory - View all parts and stock levels',
						'GET /api/search - Full-text search parts catalog',
						'GET /api/history - View transaction audit history',
						'POST /api/parts - Create new inventory parts',
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
					'Retrieves tracked inventory parts along with their computed current stock quantity (sum of all transaction deltas). Archived parts are hidden by default and can be included with the showArchived filter.',
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
									archivedAt: null,
									quantity: 42
								}
							]
						}
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.' }
					}
				],
				curlExample: `curl -H "x-api-token: your-consumer-token" "https://example.com/api/inventory"`,
				javascriptExample: `const response = await fetch('/api/inventory', {
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
									archivedAt: null,
									quantity: 42
								}
							]
						}
					},
					{
						status: 400,
						description: 'Search query does not contain valid search tokens.',
						example: { error: 'Search query must contain letters or numbers.' }
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.' }
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
						example: { error: 'The "limit" query parameter must be a positive integer.' }
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.' }
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
					'Registers a new part in the catalog. Requires a unique manufacturer part number (`mfgPartNumber`).',
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
							name: 'metadata',
							type: 'object',
							required: false,
							description: 'Free-form JSON object for additional custom metadata.'
						}
					],
					example: {
						name: '20T GT2 Pulley',
						mfgPartNumber: 'PULLEY-GT2-20T',
						description: 'Aluminum timing pulley with 5mm bore',
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
								archivedAt: null,
								quantity: 0
							}
						}
					},
					{
						status: 400,
						description: 'Invalid JSON payload or missing required fields.',
						example: { error: 'mfgPartNumber must be a non-empty string.' }
					},
					{
						status: 409,
						description: 'Conflict: Manufacturer part number already exists.',
						example: { error: 'A part with that manufacturer part number already exists.' }
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.' }
					},
					{
						status: 403,
						description: 'Token does not have producer role.',
						example: { error: 'This API token is not allowed to perform that action.' }
					}
				],
				curlExample: `curl -X POST "https://example.com/api/parts" \\
  -H "x-api-token: your-producer-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "20T GT2 Pulley",
    "mfgPartNumber": "PULLEY-GT2-20T",
    "description": "Aluminum timing pulley",
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
					'Marks an existing part as archived instead of deleting it, or clears the archived flag to unarchive it.',
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
								archivedAt: '2026-08-12T10:00:00.000Z',
								quantity: 42
							}
						}
					},
					{
						status: 400,
						description: 'Invalid archive request body.',
						example: { error: 'archived must be a boolean.' }
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.' }
					},
					{
						status: 403,
						description: 'Token does not have producer role.',
						example: { error: 'This API token is not allowed to perform that action.' }
					},
					{
						status: 404,
						description: 'Part was not found.',
						example: { error: 'Part not found.' }
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
						example: { error: 'One or more transaction lines reference an unknown part.' }
					},
					{
						status: 401,
						description: 'Missing or invalid API token.',
						example: { error: 'API token required.' }
					},
					{
						status: 403,
						description: 'Token does not have producer role.',
						example: { error: 'This API token is not allowed to perform that action.' }
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
			}
		}));

		const responses: Record<string, unknown> = {};
		for (const r of ep.responses) {
			responses[String(r.status)] = {
				description: r.description,
				content: {
					'application/json': {
						example: r.example
					}
				}
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
			}
		}
	};
}

function buildRequestBodySchema(ep: ApiEndpointDoc): Record<string, unknown> {
	if (!ep.requestBody) return {};

	if (ep.id === 'post-parts') {
		return {
			type: 'object',
			required: ['name', 'mfgPartNumber'],
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
				metadata: {
					type: 'object',
					description: 'Optional free-form JSON object for custom attributes and properties.'
				}
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
