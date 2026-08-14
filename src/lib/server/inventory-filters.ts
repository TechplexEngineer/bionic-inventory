import type { InventoryTypeProperty } from './inventory-types';
import { InventoryRouteError } from './inventory-errors';
import { getInventoryType } from './inventory-types';
import {
	getArrayQueryParam,
	getBooleanQueryParam,
	getSearchQuery,
	listFilteredInventory
} from './inventory';

export type MetadataFilterOperator = 'exact' | 'contains' | 'min' | 'max';

export interface MetadataFilter {
	propertyId: string;
	operator: MetadataFilterOperator;
	value: string | number;
}

export interface InventoryQuery {
	query?: string;
	mfgPartNumber?: string[];
	id?: string[];
	showArchived: boolean;
	typeId?: string;
	metadataFilters: MetadataFilter[];
}

export interface InventoryFacetValue {
	value: string;
	count: number;
}

export interface InventoryFacet {
	propertyId: string;
	values: InventoryFacetValue[];
}

export type FilterProperty = Pick<InventoryTypeProperty, 'id' | 'name' | 'kind'>;

const metadataKeyPattern = /^meta\[([^\[\]]+)\]\[(exact|contains|min|max)\]$/;

export function parseInventoryQuery(
	url: URL,
	properties: readonly FilterProperty[] = []
): InventoryQuery {
	const typeId = getInventoryTypeId(url);
	const propertyById = new Map(properties.map((property) => [property.id, property]));
	const metadataFilters: MetadataFilter[] = [];
	const seenOperators = new Map<string, Set<MetadataFilterOperator>>();

	for (const [key, rawValue] of url.searchParams) {
		if (!key.startsWith('meta[')) continue;

		const match = metadataKeyPattern.exec(key);
		if (!match) {
			throw invalidFilter(
				'Metadata filters must use meta[propertyId][exact|contains|min|max].',
				key
			);
		}
		if (!typeId) {
			throw invalidFilter('typeId is required when filtering metadata.', 'typeId');
		}

		const [, propertyId, rawOperator] = match;
		const operator = rawOperator as MetadataFilterOperator;
		const property = propertyById.get(propertyId);
		if (!property) {
			throw new InventoryRouteError(
				'PROPERTY_NOT_FOUND',
				'The metadata filter property does not belong to the selected inventory type.',
				404,
				key
			);
		}

		const operators = seenOperators.get(propertyId) ?? new Set<MetadataFilterOperator>();
		if (operators.has(operator)) {
			throw invalidFilter('Each metadata filter may be provided only once.', key);
		}
		if (
			(property.kind === 'text' && operator !== 'exact' && operator !== 'contains') ||
			(property.kind === 'numeric' && operator === 'contains')
		) {
			throw invalidFilter(`The ${operator} operator is not valid for ${property.kind} properties.`, key);
		}
		if (
			(property.kind === 'text' &&
				((operator === 'exact' && operators.has('contains')) ||
					(operator === 'contains' && operators.has('exact')))) ||
			(property.kind === 'numeric' &&
				((operator === 'exact' && (operators.has('min') || operators.has('max'))) ||
					(operator !== 'exact' && operators.has('exact'))))
		) {
			throw invalidFilter('Conflicting metadata filter operators were provided.', key);
		}

		let value: string | number = rawValue;
		if (property.kind === 'numeric') {
			if (rawValue.trim().length === 0) {
				throw invalidFilter('Numeric metadata filters require a finite number.', key);
			}
			value = Number(rawValue);
			if (!Number.isFinite(value)) {
				throw invalidFilter('Numeric metadata filters require a finite number.', key);
			}
		}

		operators.add(operator);
		seenOperators.set(propertyId, operators);
		metadataFilters.push({ propertyId, operator, value });
	}

	for (const [propertyId, operators] of seenOperators) {
		if (!operators.has('min') || !operators.has('max')) continue;
		const minimum = metadataFilters.find(
			(filter) => filter.propertyId === propertyId && filter.operator === 'min'
		)?.value;
		const maximum = metadataFilters.find(
			(filter) => filter.propertyId === propertyId && filter.operator === 'max'
		)?.value;
		if (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum) {
			throw invalidFilter('A metadata minimum cannot exceed its maximum.', `meta[${propertyId}]`);
		}
	}

	return {
		...(getSearchQuery(url) ? { query: getSearchQuery(url) } : {}),
		...(getArrayQueryParam(url, 'mfgPartNumber')
			? { mfgPartNumber: getArrayQueryParam(url, 'mfgPartNumber') }
			: {}),
		...(getArrayQueryParam(url, 'id') ? { id: getArrayQueryParam(url, 'id') } : {}),
		showArchived: getBooleanQueryParam(url, 'showArchived'),
		...(typeId ? { typeId } : {}),
		metadataFilters
	};
}

export function getInventoryTypeId(url: URL): string | undefined {
	const typeValues = url.searchParams.getAll('typeId');
	if (typeValues.length > 1) {
		throw invalidFilter('typeId must be provided at most once.', 'typeId');
	}
	return typeValues[0]?.trim() || undefined;
}

export async function listInventoryFacets(
	d1: D1Database,
	query: InventoryQuery
): Promise<InventoryFacet[]> {
	if (!query.typeId) {
		throw invalidFilter('typeId is required when listing inventory facets.', 'typeId');
	}

	const inventoryType = await getInventoryType(d1, query.typeId);
	if (!inventoryType) {
		throw new InventoryRouteError('TYPE_NOT_FOUND', 'Inventory type not found.', 404, 'typeId');
	}

	const facets: InventoryFacet[] = [];
	for (const property of inventoryType.properties) {
		if (property.kind !== 'text') continue;

		const parts = await listFilteredInventory(d1, {
			...query,
			metadataFilters: query.metadataFilters.filter(
				(filter) => filter.propertyId !== property.id
			)
		});
		const valuesByNormalizedValue = new Map<string, InventoryFacetValue>();

		for (const part of parts) {
			const value = part.metadata[property.name];
			if (typeof value !== 'string') continue;

			const normalizedValue = sqliteNoCaseKey(value);
			const existing = valuesByNormalizedValue.get(normalizedValue);
			if (!existing) {
				valuesByNormalizedValue.set(normalizedValue, { value, count: 1 });
				continue;
			}

			existing.count += 1;
			if (value < existing.value) existing.value = value;
		}

		facets.push({
			propertyId: property.id,
			values: [...valuesByNormalizedValue.values()].sort((left, right) =>
				compareFacetValues(left.value, right.value)
			)
		});
	}

	return facets;
}

function compareFacetValues(left: string, right: string): number {
	const normalizedLeft = sqliteNoCaseKey(left);
	const normalizedRight = sqliteNoCaseKey(right);
	if (normalizedLeft < normalizedRight) return -1;
	if (normalizedLeft > normalizedRight) return 1;
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function sqliteNoCaseKey(value: string): string {
	return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function invalidFilter(message: string, field: string): InventoryRouteError {
	return new InventoryRouteError('INVALID_REQUEST', message, 400, field);
}
