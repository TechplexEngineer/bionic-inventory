import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const inventoryTypes = sqliteTable(
	'inventory_types',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		normalizedName: text('normalized_name').notNull(),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [uniqueIndex('inventory_types_normalized_name_idx').on(table.normalizedName)]
);

export const inventoryTypeProperties = sqliteTable(
	'inventory_type_properties',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		inventoryTypeId: text('inventory_type_id')
			.notNull()
			.references(() => inventoryTypes.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		normalizedName: text('normalized_name').notNull(),
		kind: text('kind').$type<'text' | 'numeric'>().notNull(),
		required: integer('required', { mode: 'boolean' }).notNull(),
		minimum: real('minimum'),
		maximum: real('maximum'),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('inventory_type_properties_type_name_idx').on(
			table.inventoryTypeId,
			table.normalizedName
		),
		check('inventory_type_properties_kind_check', sql`${table.kind} IN ('text', 'numeric')`),
		check(
			'inventory_type_properties_text_bounds_check',
			sql`${table.kind} <> 'text' OR (${table.minimum} IS NULL AND ${table.maximum} IS NULL)`
		),
		check(
			'inventory_type_properties_bounds_check',
			sql`${table.minimum} IS NULL OR ${table.maximum} IS NULL OR ${table.minimum} <= ${table.maximum}`
		)
	]
);

export const parts = sqliteTable(
	'parts',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		mfgPartNumber: text('mfg_part_number').notNull(),
		description: text('description').notNull().default(''),
		metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		inventoryTypeId: text('inventory_type_id').references(() => inventoryTypes.id, {
			onDelete: 'restrict'
		}),
		archivedAt: text('archived_at'),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('parts_mfg_part_number_idx').on(table.mfgPartNumber),
		index('parts_name_idx').on(table.name),
		index('parts_inventory_type_idx').on(table.inventoryTypeId),
		index('parts_archived_at_idx').on(table.archivedAt)
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
		keyHash: text('key_hash').notNull(),
		keyPrefix: text('key_prefix').notNull(),
		role: text('role').$type<'producer' | 'consumer'>().notNull(),
		createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
		revokedAt: text('revoked_at')
	},
	(table) => [
		uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
		index('api_keys_role_idx').on(table.role)
	]
);
