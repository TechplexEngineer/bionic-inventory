import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? 'local-account-id',
		databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? '00000000-0000-0000-0000-000000000000',
		token: process.env.CLOUDFLARE_D1_TOKEN ?? 'local-d1-token'
	},
	verbose: true,
	strict: true
});
