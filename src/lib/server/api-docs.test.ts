import { describe, expect, it } from 'vitest';
import { getApiDocumentation, getOpenApiSpec } from './api-docs';
import { renderApiDocHtml } from './api-docs-html';
import { GET } from '../../routes/api/+server';

describe('API Documentation Endpoint with Scalar', () => {
	it('returns structured API documentation object with all public routes', () => {
		const docs = getApiDocumentation();

		expect(docs.title).toBe('Bionic Inventory API');
		expect(docs.baseUrl).toBe('/api');
		expect(docs.description).toContain('/keys');
		expect(docs.description).toContain('D1');
		expect(docs.authentication.description).toContain('primary authentication method');
		expect(docs.authentication.description).toContain('optional compatibility');
		expect(docs.authentication.headers.length).toBeGreaterThanOrEqual(2);
		expect(docs.authentication.roles).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'producer',
					compatibilityEnvVar: 'PRODUCER_API_TOKENS'
				}),
				expect.objectContaining({
					name: 'consumer',
					compatibilityEnvVar: 'CONSUMER_API_TOKENS'
				})
			])
		);

		const endpointPaths = docs.endpoints.map((ep) => `${ep.method} ${ep.path}`);
		expect(endpointPaths).toContain('GET /api/inventory');
		expect(endpointPaths).toContain('GET /api/search');
		expect(endpointPaths).toContain('GET /api/history');
		expect(endpointPaths).toContain('POST /api/parts');
		expect(endpointPaths).toContain('PUT /api/parts');
		expect(endpointPaths).toContain('PATCH /api/parts/{id}');
		expect(endpointPaths).toContain('POST /api/transactions');
		expect(endpointPaths).toContain('GET /api/types');
		expect(endpointPaths).toContain('POST /api/types');
		expect(endpointPaths).toContain('GET /api/types/{id}');
		expect(endpointPaths).toContain('PUT /api/types/{id}');
		expect(endpointPaths).toContain('DELETE /api/types/{id}');
		expect(endpointPaths).toContain('GET /api/inventory/facets');

		const inventoryEp = docs.endpoints.find((e) => e.path === '/api/inventory');
		const paramNames = inventoryEp?.parameters?.map((p) => p.name);
		expect(paramNames).toContain('q');
		expect(paramNames).toContain('mfgPartNumber');
		expect(paramNames).toContain('id');
		expect(paramNames).toContain('showArchived');
	});

	it('documents inventory type lifecycle and optimistic mutation contracts', () => {
		const spec = getOpenApiSpec() as any;

		expect(spec.paths['/types'].get).toBeDefined();
		expect(spec.paths['/types'].post).toBeDefined();
		expect(spec.paths['/types/{id}'].get).toBeDefined();
		expect(spec.paths['/types/{id}'].put).toBeDefined();
		expect(spec.paths['/types/{id}'].delete).toBeDefined();
		expect(spec.paths['/parts/{id}'].patch).toBeDefined();
		expect(spec.paths['/inventory/facets'].get).toBeDefined();

		const createPart = spec.paths['/parts'].post.requestBody.content['application/json'].schema;
		expect(createPart.required).toEqual(['name', 'mfgPartNumber', 'inventoryTypeId']);

		const replaceType =
			spec.paths['/types/{id}'].put.requestBody.content['application/json'].schema;
		expect(replaceType.required).toEqual(['name', 'properties', 'updatedAt']);
		expect(replaceType.properties.updatedAt.format).toBe('date-time');

		const patchPart =
			spec.paths['/parts/{id}'].patch.requestBody.content['application/json'].schema;
		expect(patchPart.required).toEqual(['updatedAt']);
		expect(patchPart.properties.updatedAt.format).toBe('date-time');
		expect(patchPart.properties.metadata.description).toContain(
			'replaces the complete metadata object'
		);
	});

	it('documents stable property IDs, metadata filters, structured errors, and typed parts', () => {
		const spec = getOpenApiSpec() as any;
		const schemas = spec.components.schemas;

		expect(schemas.InventoryTypeProperty.required).toContain('id');
		expect(schemas.InventoryTypeProperty.properties.id.description).toContain('Stable');
		expect(schemas.StructuredError.required).toEqual(['error', 'code']);
		expect(schemas.StructuredError.properties.field.type).toBe('string');
		expect(spec.paths['/types'].post.responses['400'].content['application/json'].schema.$ref).toBe(
			'#/components/schemas/StructuredError'
		);

		for (const path of ['/inventory', '/inventory/facets']) {
			const metadataParameter = spec.paths[path].get.parameters.find(
				(parameter: any) => parameter.name === 'meta[propertyId][operator]'
			);
			expect(metadataParameter.examples).toMatchObject({
				exact: { value: 'meta[property-id][exact]=Nylon' },
				contains: { value: 'meta[property-id][contains]=nyl' },
				minimum: { value: 'meta[property-id][min]=10' },
				maximum: { value: 'meta[property-id][max]=20' }
			});
		}

		for (const field of ['inventoryTypeId', 'inventoryTypeName', 'metadata', 'updatedAt']) {
			expect(schemas.InventoryPart.properties[field]).toBeDefined();
		}
	});

	it('disables curl URL globbing for every raw bracket-filter example', () => {
		const bracketFilterExamples = getApiDocumentation().endpoints
			.map((endpoint) => endpoint.curlExample)
			.filter((example) => example.includes('meta['));

		expect(bracketFilterExamples.length).toBeGreaterThan(0);
		for (const example of bracketFilterExamples) {
			expect(example).toMatch(/^curl --globoff\b/);
		}
	});

	it('generates valid OpenAPI 3.1 spec object with request body schemas', () => {
		const spec = getOpenApiSpec() as any;

		expect(spec.openapi).toBe('3.1.0');
		expect(spec.info.title).toBe('Bionic Inventory API');
		expect(spec.info.description).toContain('/keys');
		expect(spec.info.description).toContain('D1');
		expect(spec.paths['/inventory'].get).toBeDefined();
		expect(spec.paths['/search'].get).toBeDefined();
		expect(spec.paths['/history'].get).toBeDefined();
		expect(spec.paths['/parts'].post).toBeDefined();
		expect(spec.paths['/parts'].put).toBeDefined();
		expect(spec.paths['/transactions'].post).toBeDefined();
		expect(spec.components.securitySchemes['x-api-token']).toBeDefined();

		// Request body schema assertions for /parts POST
		const partsPostSchema =
			spec.paths['/parts'].post.requestBody.content['application/json'].schema;
		expect(partsPostSchema.type).toBe('object');
		expect(partsPostSchema.required).toEqual(['name', 'mfgPartNumber', 'inventoryTypeId']);
		expect(partsPostSchema.properties.name).toBeDefined();
		expect(partsPostSchema.properties.mfgPartNumber).toBeDefined();
		expect(partsPostSchema.properties.description).toBeDefined();

		const partsPutSchema = spec.paths['/parts'].put.requestBody.content['application/json'].schema;
		expect(partsPutSchema.type).toBe('object');
		expect(partsPutSchema.required).toEqual(['id', 'archived']);
		expect(partsPutSchema.properties.archived.type).toBe('boolean');

		// Request body schema assertions for /transactions POST
		const txPostSchema =
			spec.paths['/transactions'].post.requestBody.content['application/json'].schema;
		expect(txPostSchema.type).toBe('object');
		expect(txPostSchema.required).toEqual(['actor', 'lines']);
		expect(txPostSchema.properties.lines.type).toBe('array');
		expect(txPostSchema.properties.lines.items.required).toEqual(['partId', 'quantityDelta']);
	});

	it('renders responsive HTML documentation page containing essential elements and badges', () => {
		const docs = getApiDocumentation();
		const html = renderApiDocHtml(docs);

		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('Bionic Inventory API Documentation');
		expect(html).toContain('x-api-token');
		expect(html).toContain('Authorization');
		expect(html).toContain('primary authentication method');
		expect(html).toContain('Optional compatibility env');
		expect(html).toContain('PRODUCER_API_TOKENS');
		expect(html).toContain('/api/inventory');
		expect(html).toContain('Required');
		expect(html).toContain('Optional');
	});

	it('returns OpenAPI 3.1 JSON spec from GET /api when requested with format=openapi', async () => {
		const request = new Request('https://example.com/api?format=openapi', {
			headers: { accept: '*/*' }
		});
		const event = {
			request,
			url: new URL('https://example.com/api?format=openapi'),
			params: {},
			platform: undefined,
			route: { id: '/api' },
			cookies: {} as any,
			fetch: fetch as any,
			getClientAddress: () => '127.0.0.1',
			locals: {},
			isDataRequest: false,
			isSubRequest: false,
			setHeaders: () => {}
		};

		const response = await GET(event as any);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');

		const body = (await response.json()) as any;
		expect(body.openapi).toBe('3.1.0');
		expect(body.info.title).toBe('Bionic Inventory API');
		expect(body.paths['/inventory']).toBeDefined();
	});

	it('returns Scalar API Reference HTML from GET /api for standard browser requests', async () => {
		const request = new Request('https://example.com/api', {
			headers: {
				accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});
		const event = {
			request,
			url: new URL('https://example.com/api'),
			params: {},
			platform: undefined,
			route: { id: '/api' },
			cookies: {} as any,
			fetch: fetch as any,
			getClientAddress: () => '127.0.0.1',
			locals: {},
			isDataRequest: false,
			isSubRequest: false,
			setHeaders: () => {}
		};

		const response = await GET(event as any);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');

		const html = await response.text();
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('Bionic Inventory API Reference');
		expect(html).toContain('data-url="/api?format=openapi"');
		expect(html).toContain('https://cdn.jsdelivr.net/npm/@scalar/api-reference');
	});

	it('configures Scalar API Reference to hide client button and scalar branding', async () => {
		const request = new Request('https://example.com/api', {
			headers: { accept: 'text/html' }
		});
		const event = {
			request,
			url: new URL('https://example.com/api'),
			params: {},
			platform: undefined,
			route: { id: '/api' },
			cookies: {} as any,
			fetch: fetch as any,
			getClientAddress: () => '127.0.0.1',
			locals: {},
			isDataRequest: false,
			isSubRequest: false,
			setHeaders: () => {}
		};

		const response = await GET(event as any);
		const html = await response.text();

		expect(html).toContain('hideClientButton');
		expect(html).toContain('customCss');
	});
});
