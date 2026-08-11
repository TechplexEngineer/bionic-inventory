import { describe, expect, it } from 'vitest';
import { getApiDocumentation, getOpenApiSpec } from './api-docs';
import { renderApiDocHtml } from './api-docs-html';
import { GET } from '../../routes/api/+server';

describe('API Documentation Endpoint with Scalar', () => {
	it('returns structured API documentation object with all 5 routes', () => {
		const docs = getApiDocumentation();

		expect(docs.title).toBe('Bionic Inventory API');
		expect(docs.baseUrl).toBe('/api');
		expect(docs.authentication.headers.length).toBeGreaterThanOrEqual(2);
		expect(docs.authentication.roles).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'producer' }),
				expect.objectContaining({ name: 'consumer' })
			])
		);

		const endpointPaths = docs.endpoints.map((ep) => `${ep.method} ${ep.path}`);
		expect(endpointPaths).toContain('GET /api/inventory');
		expect(endpointPaths).toContain('GET /api/search');
		expect(endpointPaths).toContain('GET /api/history');
		expect(endpointPaths).toContain('POST /api/parts');
		expect(endpointPaths).toContain('POST /api/transactions');

		const inventoryEp = docs.endpoints.find((e) => e.path === '/api/inventory');
		const paramNames = inventoryEp?.parameters?.map((p) => p.name);
		expect(paramNames).toContain('q');
		expect(paramNames).toContain('mfgPartNumber');
		expect(paramNames).toContain('id');
	});

	it('generates valid OpenAPI 3.1 spec object with request body schemas', () => {
		const spec = getOpenApiSpec() as any;

		expect(spec.openapi).toBe('3.1.0');
		expect(spec.info.title).toBe('Bionic Inventory API');
		expect(spec.paths['/inventory'].get).toBeDefined();
		expect(spec.paths['/search'].get).toBeDefined();
		expect(spec.paths['/history'].get).toBeDefined();
		expect(spec.paths['/parts'].post).toBeDefined();
		expect(spec.paths['/transactions'].post).toBeDefined();
		expect(spec.components.securitySchemes['x-api-token']).toBeDefined();

		// Request body schema assertions for /parts POST
		const partsPostSchema = spec.paths['/parts'].post.requestBody.content['application/json'].schema;
		expect(partsPostSchema.type).toBe('object');
		expect(partsPostSchema.required).toEqual(['name', 'mfgPartNumber']);
		expect(partsPostSchema.properties.name).toBeDefined();
		expect(partsPostSchema.properties.mfgPartNumber).toBeDefined();
		expect(partsPostSchema.properties.description).toBeDefined();

		// Request body schema assertions for /transactions POST
		const txPostSchema = spec.paths['/transactions'].post.requestBody.content['application/json'].schema;
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
			headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
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
});
