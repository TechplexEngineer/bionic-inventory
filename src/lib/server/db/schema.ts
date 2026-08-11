import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const parts = sqliteTable(
	'parts',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		mfgPartNumber: text('mfg_part_number').notNull(),
		description: text('description').notNull().default(''),
		metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('parts_mfg_part_number_idx').on(table.mfgPartNumber),
		index('parts_name_idx').on(table.name)
	]
);

export const inventoryChanges = sqliteTable(
	'inventory_changes',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		transactionId: text('transaction_id').notNull(),
		partId: text('part_id')
			.notNull()
			.references(() => parts.id, { onDelete: 'cascade' }),
		quantityDelta: integer('quantity_delta').notNull(),
		actor: text('actor').notNull(),
		usedIn: text('used_in'),
		note: text('note'),
		recordedAt: text('recorded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('inventory_changes_part_idx').on(table.partId),
		index('inventory_changes_transaction_idx').on(table.transactionId),
		index('inventory_changes_recorded_at_idx').on(table.recordedAt)
	]
);

export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		key: text('key').notNull(),
		role: text('role').$type<'producer' | 'consumer'>().notNull(),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		revokedAt: text('revoked_at')
	},
	(table) => [
		uniqueIndex('api_keys_key_idx').on(table.key),
		index('api_keys_role_idx').on(table.role)
	]
);

