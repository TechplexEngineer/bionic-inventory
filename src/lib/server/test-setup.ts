import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Miniflare } from 'miniflare';

if (!process.env.XDG_CONFIG_HOME) {
	process.env.XDG_CONFIG_HOME = os.tmpdir();
}

export interface TestD1Context {
	d1: D1Database;
	dispose: () => Promise<void>;
}

export async function setupTestD1(): Promise<TestD1Context> {
	const mf = new Miniflare({
		modules: true,
		script: '',
		d1Databases: { DB: '00000000-0000-0000-0000-000000000000' },
		d1Persist: false
	});

	const d1 = await mf.getD1Database('DB');
	const schemaPath = path.resolve(process.cwd(), 'drizzle/0000_tired_natasha_romanoff.sql');
	const migrationSql = fs.readFileSync(schemaPath, 'utf8');

	const statements = migrationSql
		.split(/--> statement-breakpoint/g)
		.map((s) => s.trim())
		.filter(Boolean);

	const prepared = statements.map((stmt) => d1.prepare(stmt));
	await d1.batch(prepared);

	return {
		d1,
		dispose: async () => {
			await mf.dispose();
		}
	};
}
