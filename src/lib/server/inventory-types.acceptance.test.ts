import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as listInventory } from '../../routes/api/inventory/+server';
import { GET as listFacets } from '../../routes/api/inventory/facets/+server';
import { POST as createPart, PUT as setPartArchived } from '../../routes/api/parts/+server';
import { PATCH as updatePart } from '../../routes/api/parts/[id]/+server';
import { POST as createType } from '../../routes/api/types/+server';
import { DELETE as deleteType, PUT as replaceType } from '../../routes/api/types/[id]/+server';

const producerToken = 'acceptance-producer-token';
const consumerToken = 'acceptance-consumer-token';

describe('inventory types migrated D1 acceptance path', () => {
	let miniflare: Miniflare;
	let d1: D1Database;
	let env: Record<string, unknown>;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: 'export default { fetch() { return new Response("ok") } }',
			d1Databases: { DB: 'inventory-types-acceptance' }
		});
		d1 = (await miniflare.getD1Database('DB')) as unknown as D1Database;
		env = {
			DB: d1,
			PRODUCER_API_TOKENS: producerToken,
			CONSUMER_API_TOKENS: consumerToken
		};

		await applyMigrations([
			'drizzle/0000_tired_natasha_romanoff.sql',
			'drizzle/0001_api_keys.sql',
			'drizzle/0002_archived_parts.sql'
		]);
		await d1
			.prepare(
				'INSERT INTO parts (id, name, mfg_part_number, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
			)
			.bind(
				'legacy-part',
				'Legacy Belt',
				'LEGACY-BELT',
				'Predates inventory types',
				JSON.stringify({ LegacyTag: 'keep-me' }),
				'2026-08-13T12:00:00.000Z',
				'2026-08-13T12:00:00.000Z'
			)
			.run();
		await applyMigrations(['drizzle/0003_inventory_types.sql']);
	});

	afterAll(async () => {
		await miniflare.dispose();
	});

	async function applyMigrations(paths: string[]) {
		for (const path of paths) {
			for (const statement of (await readFile(path, 'utf8')).split('--> statement-breakpoint')) {
				if (statement.trim()) await d1.prepare(statement).run();
			}
		}
	}

	function routeEvent(
		method: string,
		path: string,
		options: { body?: unknown; token?: string; id?: string } = {}
	) {
		const url = new URL(`https://example.test${path}`);
		const headers = new Headers({
			'x-api-token': options.token ?? producerToken
		});
		if (options.body !== undefined) headers.set('content-type', 'application/json');

		return {
			request: new Request(url, {
				method,
				headers,
				...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
			}),
			url,
			params: options.id ? { id: options.id } : {},
			platform: { env },
			route: { id: path },
			cookies: {} as any,
			fetch: fetch as any,
			getClientAddress: () => '127.0.0.1',
			locals: {},
			isDataRequest: false,
			isSubRequest: false,
			setHeaders: () => {}
		};
	}

	it('preserves legacy data and enforces the complete typed-part lifecycle through routes', async () => {
		const initialInventory = await listInventory(
			routeEvent('GET', '/api/inventory', { token: consumerToken }) as any
		);
		expect(initialInventory.status).toBe(200);
		expect(await initialInventory.json()).toMatchObject({
			inventory: [
				{
					id: 'legacy-part',
					metadata: { LegacyTag: 'keep-me' },
					inventoryTypeId: null,
					inventoryTypeName: null
				}
			]
		});

		const createTypeResponse = await createType(
			routeEvent('POST', '/api/types', {
				body: {
					name: 'Belt',
					properties: [
						{ name: 'Material', kind: 'text', required: true },
						{
							name: 'Width',
							kind: 'numeric',
							required: false,
							minimum: 1,
							maximum: 50
						}
					]
				}
			}) as any
		);
		expect(createTypeResponse.status).toBe(201);
		const createdType = ((await createTypeResponse.json()) as any).type;
		expect(createdType.name).toBe('Belt');

		const invalidPartResponse = await createPart(
			routeEvent('POST', '/api/parts', {
				body: {
					name: 'Invalid Belt',
					mfgPartNumber: 'BELT-INVALID',
					inventoryTypeId: createdType.id,
					metadata: { Material: 7 }
				}
			}) as any
		);
		expect(invalidPartResponse.status).toBe(400);
		expect(await invalidPartResponse.json()).toMatchObject({
			code: 'METADATA_INVALID_TYPE',
			field: 'metadata.Material'
		});

		const validPartResponse = await createPart(
			routeEvent('POST', '/api/parts', {
				body: {
					name: 'Nylon Timing Belt',
					mfgPartNumber: 'BELT-NYLON-12',
					inventoryTypeId: createdType.id,
					metadata: { MATERIAL: 'Nylon', width: 12, SupplierCode: 'A7' }
				}
			}) as any
		);
		expect(validPartResponse.status).toBe(201);
		const createdPart = ((await validPartResponse.json()) as any).part;
		expect(createdPart).toMatchObject({
			metadata: { Material: 'Nylon', Width: 12, SupplierCode: 'A7' },
			inventoryTypeId: createdType.id,
			inventoryTypeName: 'Belt'
		});

		const materialProperty = createdType.properties.find(
			(property: any) => property.name === 'Material'
		);
		const widthProperty = createdType.properties.find((property: any) => property.name === 'Width');
		const replaceTypeResponse = await replaceType(
			routeEvent('PUT', `/api/types/${createdType.id}`, {
				id: createdType.id,
				body: {
					name: 'Belt',
					updatedAt: createdType.updatedAt,
					properties: [
						{
							id: materialProperty.id,
							name: 'Material',
							kind: 'text',
							required: true
						},
						{
							id: widthProperty.id,
							name: 'Width',
							kind: 'numeric',
							required: true,
							minimum: 15,
							maximum: 50
						},
						{ name: 'Teeth', kind: 'numeric', required: true, minimum: 10 }
					]
				}
			}) as any
		);
		expect(replaceTypeResponse.status).toBe(200);
		const tightenedType = ((await replaceTypeResponse.json()) as any).type;
		const teethProperty = tightenedType.properties.find(
			(property: any) => property.name === 'Teeth'
		);

		const grandfatheredInventory = await listInventory(
			routeEvent('GET', `/api/inventory?typeId=${createdType.id}`, {
				token: consumerToken
			}) as any
		);
		expect(grandfatheredInventory.status).toBe(200);
		expect(
			((await grandfatheredInventory.json()) as any).inventory.map((part: any) => part.id)
		).toEqual([createdPart.id]);

		const unrelatedEditResponse = await updatePart(
			routeEvent('PATCH', `/api/parts/${createdPart.id}`, {
				id: createdPart.id,
				body: {
					description: 'Unrelated edit',
					updatedAt: createdPart.updatedAt
				}
			}) as any
		);
		expect(unrelatedEditResponse.status).toBe(400);
		expect(await unrelatedEditResponse.json()).toMatchObject({
			code: 'METADATA_REQUIRED',
			field: 'metadata.Teeth'
		});

		const repairResponse = await updatePart(
			routeEvent('PATCH', `/api/parts/${createdPart.id}`, {
				id: createdPart.id,
				body: {
					metadata: { material: 'Nylon', WIDTH: 16, teeth: 100 },
					updatedAt: createdPart.updatedAt
				}
			}) as any
		);
		expect(repairResponse.status).toBe(200);
		const repairedPart = ((await repairResponse.json()) as any).part;
		expect(repairedPart.metadata).toEqual({
			Material: 'Nylon',
			Width: 16,
			Teeth: 100
		});

		const inventoryFilterPath =
			`/api/inventory?typeId=${createdType.id}` +
			`&meta[${materialProperty.id}][contains]=nyl` +
			`&meta[${widthProperty.id}][min]=15` +
			`&meta[${widthProperty.id}][max]=16`;
		const inventoryStartedAt = performance.now();
		const filteredInventory = await listInventory(
			routeEvent('GET', inventoryFilterPath, { token: consumerToken }) as any
		);
		const inventoryDurationMs = performance.now() - inventoryStartedAt;
		expect(filteredInventory.status).toBe(200);
		expect(((await filteredInventory.json()) as any).inventory.map((part: any) => part.id)).toEqual(
			[repairedPart.id]
		);

		const facetStartedAt = performance.now();
		const facetsResponse = await listFacets(
			routeEvent(
				'GET',
				`/api/inventory/facets?typeId=${createdType.id}&meta[${teethProperty.id}][min]=100`,
				{ token: consumerToken }
			) as any
		);
		const facetDurationMs = performance.now() - facetStartedAt;
		expect(facetsResponse.status).toBe(200);
		expect(await facetsResponse.json()).toEqual({
			facets: [
				{
					propertyId: materialProperty.id,
					values: [{ value: 'Nylon', count: 1 }]
				}
			]
		});
		process.stdout.write(
			`Representative local D1 timings: inventory=${inventoryDurationMs.toFixed(2)}ms facets=${facetDurationMs.toFixed(2)}ms\n`
		);

		const activeDeleteResponse = await deleteType(
			routeEvent('DELETE', `/api/types/${createdType.id}`, {
				id: createdType.id
			}) as any
		);
		expect(activeDeleteResponse.status).toBe(409);
		expect(await activeDeleteResponse.json()).toMatchObject({
			code: 'TYPE_IN_USE'
		});

		const archiveResponse = await setPartArchived(
			routeEvent('PUT', '/api/parts', {
				body: { id: repairedPart.id, archived: true }
			}) as any
		);
		expect(archiveResponse.status).toBe(200);
		expect(((await archiveResponse.json()) as any).part.archivedAt).not.toBeNull();

		const archivedDeleteResponse = await deleteType(
			routeEvent('DELETE', `/api/types/${createdType.id}`, {
				id: createdType.id
			}) as any
		);
		expect(archivedDeleteResponse.status).toBe(409);
		expect(await archivedDeleteResponse.json()).toMatchObject({
			code: 'TYPE_IN_USE'
		});
	});
});
