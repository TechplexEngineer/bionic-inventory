import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { inventoryTypes, inventoryTypeProperties, parts } from './schema';

describe('inventory type schema', () => {
	it('exports normalized definitions and a nullable legacy part reference', () => {
		expect(getTableConfig(inventoryTypes).name).toBe('inventory_types');
		expect(getTableConfig(inventoryTypeProperties).name).toBe('inventory_type_properties');
		expect(parts.inventoryTypeId.notNull).toBe(false);
	});
});
