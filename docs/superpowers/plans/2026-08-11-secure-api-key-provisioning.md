# Secure API Key Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete secure administrator login and D1-backed API key provisioning with signed sessions, one-time token display, hashed storage, revocation, and production-ready verification.

**Architecture:** Put authentication primitives in a focused server module while inventory authorization consumes token hashes through the existing Drizzle/D1 boundary. A root server layout exposes verified session state to navigation; protected loads and actions use the same signed-cookie verifier. Existing static API tokens remain compatible.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Cloudflare Workers Web Crypto, D1, Drizzle ORM, Vitest, Wrangler.

## Global Constraints

- `ADMIN_PASSWORD` and `SESSION_SECRET` are required; no known default password is permitted.
- Sessions use HMAC-SHA-256, expire after seven days, and are checked on every protected load/action.
- Generated API key plaintext is returned exactly once and never stored in D1.
- D1 stores a SHA-256 token hash and a non-secret display prefix.
- Static producer and consumer environment tokens remain supported.
- No production migration or deployment is included.

---

### Task 1: Rebase and establish a current baseline

**Files:**
- Reconcile: files changed by `main` and `secure_api_key_provisioning`
- Regenerate: `worker-configuration.d.ts`

**Interfaces:**
- Consumes: current `origin/main` and the approved design commit.
- Produces: feature changes replayed on current main with current generated types.

- [ ] **Step 1: Fetch and rebase**

Run `git fetch origin main`, then `git rebase origin/main`. Preserve current-main API documentation, SvelteKit, D1 deployment, and CI changes while retaining provisioning behavior.

- [ ] **Step 2: Regenerate Worker types cleanly**

Move any ignored `.svelte-kit` directory to a uniquely named directory under `/tmp`, then run:

```bash
XDG_CONFIG_HOME=/tmp/bionic-secure-api-wrangler npx wrangler types
```

- [ ] **Step 3: Run baseline verification**

Run `XDG_CONFIG_HOME=/tmp/bionic-secure-api-wrangler npm run check` and `npm test`. Existing tests must pass before behavior changes.

- [ ] **Step 4: Commit tracked reconciliation changes**

```bash
git add worker-configuration.d.ts
git commit -m "chore: reconcile provisioning branch with main"
```

---

### Task 2: Add fail-closed passwords and signed sessions

**Files:**
- Create: `src/lib/server/admin-auth.ts`
- Create: `src/lib/server/admin-auth.test.ts`
- Modify: `src/app.d.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `verifyAdminPassword(password, env): Promise<boolean>`, `createAdminSession(secret, now?): Promise<string>`, `verifyAdminSession(cookie, secret, now?): Promise<boolean>`, and `requireAdminSecrets(env): { adminPassword; sessionSecret }`.
- Consumes: Workers Web Crypto and environment bindings.

- [ ] **Step 1: Write failing tests**

Add tests that require missing secrets to throw, prevent `admin` from authenticating without configuration, accept the configured password, accept a valid signed session, and reject a tampered or expired session. Use fixed timestamps and literal expectations.

- [ ] **Step 2: Verify RED**

Run `npx vitest run src/lib/server/admin-auth.test.ts`. Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement minimal authentication helpers**

Digest password inputs to fixed-length SHA-256 byte arrays before timing-safe byte comparison. Sign a base64url JSON payload `{ v: 1, exp, nonce }` with HMAC-SHA-256. Reject absent secrets, malformed segments, bad signatures, wrong versions, and expired payloads.

- [ ] **Step 4: Verify GREEN**

Run `npx vitest run src/lib/server/admin-auth.test.ts`. Expected: all authentication tests pass.

- [ ] **Step 5: Add typed bindings and examples**

Declare `ADMIN_PASSWORD` and `SESSION_SECRET` in application environment types and list them in `.env.example` with empty values.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/admin-auth.ts src/lib/server/admin-auth.test.ts src/app.d.ts .env.example
git commit -m "feat: add signed administrator sessions"
```

---

### Task 3: Store API key hashes and authorize D1 keys

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `drizzle/0001_api_keys.sql`
- Modify: `src/lib/server/inventory.ts`
- Modify: `src/lib/server/inventory.test.ts`

**Interfaces:**
- Produces: `hashApiToken(token): Promise<string>`, `createApiKey(d1, name, role): Promise<{ item: ApiKeyItem; token: string }>`, and `ApiKeyItem.keyPrefix`.
- Consumes: existing `getDb`, Drizzle D1 queries, and `requireApiRole` callers.

- [ ] **Step 1: Write failing persistence and authorization tests**

Use a controlled D1 test double with complete D1-style responses. Assert that generated tokens match `/^bio_prod_[A-Za-z0-9_-]+$/`, inserted hashes match `/^[0-9a-f]{64}$/`, inserted values contain no plaintext `key`, and `keyPrefix` equals the first 18 token characters. Test active, revoked, unknown, and role-restricted D1 keys.

- [ ] **Step 2: Verify RED**

Run `npx vitest run src/lib/server/inventory.test.ts`. Expected: FAIL because plaintext keys are still stored and queried.

- [ ] **Step 3: Implement hashed persistence**

Change the table and migration to `key_hash` and `key_prefix`. Generate 32 random bytes, base64url-encode them, hash the complete displayed token, store only its hash/prefix, and hash submitted D1 tokens before querying.

- [ ] **Step 4: Verify GREEN**

Run `npx vitest run src/lib/server/inventory.test.ts`. Expected: all active, revoked, unknown, and role tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/0001_api_keys.sql src/lib/server/inventory.ts src/lib/server/inventory.test.ts
git commit -m "feat: store and authorize hashed API keys"
```

---

### Task 4: Protect routes and finish authenticated navigation

**Files:**
- Create: `src/routes/+layout.server.ts`
- Create: `src/routes/+layout.server.test.ts`
- Create: `src/routes/keys/keys.server.test.ts`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/login/+page.server.ts`
- Modify: `src/routes/keys/+page.server.ts`
- Modify: `src/routes/keys/+page.svelte`

**Interfaces:**
- Consumes: Task 2 session helpers and Task 3 `{ item, token }` creation result.
- Produces: layout data `{ isAdmin: boolean }`, verified route guards, and POST logout.

- [ ] **Step 1: Write failing route tests**

Test that layout state is authenticated only for a valid signed cookie and that missing/tampered cookies are anonymous. Test that protected create and revoke actions reject a missing or forged cookie.

- [ ] **Step 2: Verify RED**

Run `npx vitest run src/routes/+layout.server.test.ts src/routes/keys/keys.server.test.ts`. Expected: FAIL because signed route guards do not exist.

- [ ] **Step 3: Implement route guards and actions**

Create signed cookies after login; verify cookies in login/key loads and all key actions. Delete the cookie on logout. Report configuration failures without returning secret values.

- [ ] **Step 4: Implement session-aware UI**

Show Inventory plus Login anonymously. Show API Keys plus a POST Logout form when authenticated. Display only `keyPrefix` in listings and only the one-time `token` after creation.

- [ ] **Step 5: Verify GREEN**

Run the route test command again. Expected: all route and layout tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+layout.server.ts src/routes/+layout.server.test.ts src/routes/+layout.svelte src/routes/login/+page.server.ts src/routes/keys
git commit -m "feat: secure API key management routes"
```

---

### Task 5: Documentation, migration validation, and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/implementation_plan.md`
- Regenerate: `worker-configuration.d.ts`

**Interfaces:**
- Consumes: all prior task behavior.
- Produces: operator instructions and a verified branch.

- [ ] **Step 1: Update documentation**

Document both Cloudflare secrets, one-time key display, hashed storage, the local/remote migration commands, login/logout, and static-token compatibility. Update the original implementation plan to describe the final secure behavior and completed verification.

- [ ] **Step 2: Validate the migration locally**

Run `npx wrangler d1 migrations apply bionic-inventory --local`. Confirm `0001_api_keys.sql` applies and creates hash/prefix, role, creation, and revocation columns.

- [ ] **Step 3: Regenerate Worker types cleanly**

Move ignored generated output to `/tmp`, then run `XDG_CONFIG_HOME=/tmp/bionic-secure-api-wrangler npx wrangler types`.

- [ ] **Step 4: Run full verification sequentially**

Run:

```bash
XDG_CONFIG_HOME=/tmp/bionic-secure-api-wrangler npm run check
npm test
XDG_CONFIG_HOME=/tmp/bionic-secure-api-wrangler npm run build
git diff --check
```

Expected: zero Svelte diagnostics, all tests pass, the production build succeeds, and no whitespace errors are reported.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/implementation_plan.md worker-configuration.d.ts
git commit -m "docs: complete API key provisioning setup"
```

- [ ] **Step 6: Audit branch state**

Run `git status --short`, `git log --oneline origin/main..HEAD`, and `git diff --stat origin/main...HEAD`. Only pre-existing untracked `.agents/` and `.vscode/` directories may remain.
