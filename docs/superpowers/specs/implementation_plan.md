# Implementation Plan - Secure API Key Provisioning

## Final implementation

The application provides administrator-authenticated provisioning and revocation of role-scoped API keys stored in Cloudflare D1. This document records the implemented security behavior; it replaces the earlier proposal and its unsafe development-password fallback.

### Administrator authentication

- `ADMIN_PASSWORD` and `SESSION_SECRET` are both required Cloudflare Worker secrets. No default password, `PASSWORD` alias, or process-environment fallback is accepted.
- `/login` checks `ADMIN_PASSWORD`; a successful login creates a signed, HttpOnly, SameSite=Lax `admin_session` cookie with a seven-day lifetime. The cookie is marked Secure except during local HTTP development.
- `/keys` requires a valid signed session. The layout exposes Login for anonymous users and a Logout control for authenticated administrators. Logout deletes the session cookie and redirects to `/login`.

### Provisioned key storage and authorization

- The `api_keys` D1 table is created by `drizzle/0001_api_keys.sql`. It stores `id`, `name`, `key_hash`, `key_prefix`, `role`, `created_at`, and `revoked_at`, with indexes on the key hash and role.
- New producer and consumer tokens use cryptographically random values. D1 retains only a SHA-256 hash and non-secret prefix; the raw token is returned and displayed once at creation, then cannot be recovered from the UI or database.
- Active provisioned tokens are authorized from either `Authorization: Bearer <token>` or `X-API-Token: <token>`. Producer tokens can access producer and consumer endpoints; consumer tokens can access consumer endpoints. Revoked keys are rejected.
- Existing comma-separated `PRODUCER_API_TOKENS` and `CONSUMER_API_TOKENS` environment values remain supported for static-token compatibility. Static tokens are not shown, rotated, or revoked through `/keys`.

### Operator setup and migration workflow

Configure the two Worker secrets interactively, without adding values to source control:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Use the local command while developing or validating schema changes:

```bash
npx wrangler d1 migrations apply bionic-inventory --local
```

Use the remote command only for an intentional deployment after confirming the Cloudflare account and target database:

```bash
npx wrangler d1 migrations apply bionic-inventory --remote
```

The local and remote D1 instances have independent data and migration history. Do not run the remote command as a substitute for local validation.

## Completed verification

- Applied the D1 migrations locally and confirmed `0001_api_keys.sql` creates the hash, prefix, role, creation, and revocation columns.
- Regenerated `worker-configuration.d.ts` with Wrangler from clean ignored output.
- Ran `npm run check`, `npm test`, `npm run build`, and `git diff --check` sequentially; each completed successfully for this branch.
