import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { inventoryTypes, inventoryTypeProperties, parts } from './schema';

const repositoryRoot = join(process.cwd());
const migrationsDirectory = join(repositoryRoot, 'drizzle');
const journalPath = join(migrationsDirectory, 'meta', '_journal.json');

function runD1(args: string[]) {
	return execFileSync('npx', ['wrangler', 'd1', 'execute', 'bionic-inventory', ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8'
	});
}

describe('inventory type schema', () => {
	it('exports normalized definitions and a nullable legacy part reference', () => {
		expect(getTableConfig(inventoryTypes).name).toBe('inventory_types');
		expect(getTableConfig(inventoryTypeProperties).name).toBe('inventory_type_properties');
		expect(parts.inventoryTypeId.notNull).toBe(false);
	});

	it('applies every journaled migration before inspecting the parts schema', () => {
		const persistenceDirectory = mkdtempSync(join(tmpdir(), 'bionic-inventory-migrations-'));
		const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
			entries: Array<{ tag: string }>;
		};

		try {
			for (const entry of journal.entries) {
				const migrationPath = join(migrationsDirectory, `${entry.tag}.sql`);
				expect(existsSync(migrationPath)).toBe(true);
				runD1(['--local', '--persist-to', persistenceDirectory, '--file', migrationPath]);
			}

			const result = JSON.parse(
				runD1([
					'--local',
					'--persist-to',
					persistenceDirectory,
					'--command',
					"PRAGMA table_info('parts')",
					'--json'
				])
			) as Array<{ results: Array<{ name: string }> }>;

			expect(result[0]?.results.map((column) => column.name)).toContain('archived_at');
		} finally {
			rmSync(persistenceDirectory, { recursive: true, force: true });
		}
	}, 15_000);
});
