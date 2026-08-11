# Implementation Plan - Environment Password Login & Dynamic API Key Provisioning

This plan details the addition of password-based admin authentication (using an environment variable password) and a secure web interface for generating and managing API keys stored in D1.

## User Review Required

> [!IMPORTANT]
> - **Environment Variable**: The admin password will be read from `ADMIN_PASSWORD` (or `PASSWORD` fallback) in `platform.env` / process environment. A default fallback (e.g. `admin`) will be used in development if no environment variable is provided.
> - **Session Management**: Successful login sets an HttpOnly cookie (`admin_session`), authorizing access to the API key management page (`/keys` or `/login` when logged in).
> - **Database Schema Migration**: A new table `api_keys` will be created in Cloudflare D1 via Drizzle ORM to persist dynamic API keys alongside existing static env tokens.

## Open Questions

None at present.

## Proposed Changes

### Database Layer

#### [MODIFY] [schema.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/lib/server/db/schema.ts)
- Add `apiKeys` table definition with fields: `id`, `name`, `key`, `role`, `createdAt`, `revokedAt`.

#### [NEW] [0001_api_keys.sql](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/drizzle/0001_api_keys.sql)
- SQL migration script creating `api_keys` table and indexes (`api_keys_key_idx`, `api_keys_role_idx`).

---

### Application Logic & API Authorization

#### [MODIFY] [inventory.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/lib/server/inventory.ts)
- Add helper functions to list, create, and revoke API keys from D1.
- Update `requireApiRole` to be `async` and query the `api_keys` table in D1 when `d1` database binding is provided, falling back to configured `PRODUCER_API_TOKENS` and `CONSUMER_API_TOKENS`.
- Add password verification logic comparing submitted password to `ADMIN_PASSWORD` / `PASSWORD` in environment.

---

### Web UI & Routes

#### [NEW] [login/+page.svelte](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/login/+page.svelte)
#### [NEW] [login/+page.server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/login/+page.server.ts)
- Render password login form.
- Form action verifies password against `ADMIN_PASSWORD` from environment.
- On success, sets `admin_session` cookie and redirects to API key management route (`/keys`).

#### [NEW] [keys/+page.svelte](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/keys/+page.svelte)
#### [NEW] [keys/+page.server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/keys/+page.server.ts)
- Password-protected admin route for API keys management.
- Allow generating new API keys with custom name and role selection (`producer` vs `consumer`).
- Displays newly generated secret key with copy helper.
- Lists active/revoked API keys with option to revoke keys.

#### [MODIFY] [+layout.svelte](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/+layout.svelte)
- Add top navigation bar with links for "Inventory", "API Keys" / "Login", and Logout option.

---

### REST API Endpoints

#### [MODIFY] [inventory/+server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/api/inventory/+server.ts)
#### [MODIFY] [parts/+server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/api/parts/+server.ts)
#### [MODIFY] [history/+server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/api/history/+server.ts)
#### [MODIFY] [search/+server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/api/search/+server.ts)
#### [MODIFY] [transactions/+server.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/routes/api/transactions/+server.ts)
- Update `requireApiRole` calls to use `await requireApiRole(request, platform?.env, allowedRoles, platform?.env?.DB ? getBoundDb(platform) : undefined)`.

---

### Documentation & Tests

#### [MODIFY] [inventory.test.ts](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/src/lib/server/inventory.test.ts)
- Add test coverage for API key validation (env tokens and database keys) and password verification.

#### [MODIFY] [.env.example](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/.env.example) & [README.md](file:///home/techplex/.gemini/antigravity/worktrees/bionic-inventory/secure_api_key_provisioning/README.md)
- Document `ADMIN_PASSWORD` variable and login / API key creation feature.

## Verification Plan

### Automated Tests
- Run `npx vitest --run` to verify unit tests for API key verification, token parsing, and password auth helpers.

### Manual Verification
- Test password login with correct environment password vs invalid password.
- Test creating a new `producer` and `consumer` API key from the login-protected `/keys` page.
- Test sending GET / POST requests to `/api/inventory` or `/api/parts` with the newly generated API key in `Authorization: Bearer <key>` or `X-API-Token` header.
