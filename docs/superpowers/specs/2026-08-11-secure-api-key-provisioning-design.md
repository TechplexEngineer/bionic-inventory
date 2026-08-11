# Secure API Key Provisioning Completion Design

## Goal

Complete the existing API key provisioning work so administrators can authenticate securely, create and revoke D1-backed API keys, and use those keys with the inventory API without storing reusable secrets in plaintext.

## Scope

- Rebase `secure_api_key_provisioning` onto the current `main` branch.
- Replace the forgeable admin cookie with a signed, expiring session.
- Require explicit production secrets and remove the implicit `admin` password.
- Store hashes of generated API keys and reveal each secret only once.
- Complete authenticated navigation and logout behavior.
- Add automated coverage for the security and D1 authorization paths.
- Update the D1 migration, generated types, documentation, and environment examples.

Preview deployments, multi-admin accounts, password reset flows, and server-side session revocation are outside this change.

## Authentication and Sessions

`ADMIN_PASSWORD` and `SESSION_SECRET` are required runtime secrets. Login fails closed with a configuration error when either is absent. Local development must provide both explicitly through the normal local environment mechanism; there is no known default password.

After a successful password check, the server creates a stateless session payload containing a version, expiration timestamp, and cryptographically random nonce. The payload is authenticated with HMAC-SHA-256 using `SESSION_SECRET`. The cookie is HttpOnly, Secure outside local HTTP development, SameSite=Lax, path-scoped to `/`, and expires after seven days.

Every protected page load and form action verifies the signature and expiration. Invalid, malformed, expired, or tampered cookies are rejected. Logout deletes the cookie. Password verification uses a timing-safe comparison after normalizing both values into fixed-length digests.

## API Key Lifecycle

Generated API keys retain a recognizable `bio_prod_` or `bio_cons_` prefix and use cryptographically random bytes for the secret portion. The complete token is returned only by the create action and shown once in the UI.

D1 stores:

- a stable key ID;
- administrator-provided display name;
- SHA-256 token hash with a uniqueness constraint;
- a short non-secret display prefix;
- role (`producer` or `consumer`);
- creation timestamp;
- optional revocation timestamp.

Key listings never return the reusable token. Authorization hashes the submitted token and queries by hash. Revoked keys are rejected. Static `PRODUCER_API_TOKENS` and `CONSUMER_API_TOKENS` remain supported for compatibility.

Because the `api_keys` migration has not been deployed as part of this branch, migration `0001_api_keys.sql` will be corrected in place rather than adding a follow-up migration that preserves insecure plaintext storage.

## Routes and UI

The root layout receives authenticated session state from a server load. Navigation shows Inventory and either Login or API Keys plus Logout. Logout is a POST action.

`/login` redirects authenticated users to `/keys`. `/keys` and every create/revoke action require a valid signed session. The key table shows metadata, status, and the display prefix only. A newly created token appears in a one-time success panel with a copy control.

Configuration and database failures are reported without exposing secrets or internal exception details.

## API Authorization

All five inventory endpoints continue awaiting `requireApiRole`. The helper first checks configured static tokens, then queries D1 by the SHA-256 hash when a database binding is available. Producer-only and consumer-or-producer role rules remain unchanged. Missing schema errors preserve the existing compatibility behavior for static tokens while unknown tokens fail with HTTP 401.

## Testing and Verification

Test-first coverage will prove:

- missing admin/session secrets fail closed;
- correct and incorrect passwords behave as expected;
- signed sessions accept valid cookies and reject malformed, tampered, and expired cookies;
- generated keys are returned once but persisted only as hashes;
- active D1 keys authorize their assigned roles;
- revoked and unknown keys are rejected;
- role restrictions return the existing authorization error;
- navigation data distinguishes authenticated and anonymous users.

Final verification consists of regenerated Worker types, `npm run check`, `npm test`, `npm run build`, migration validation against a local D1 database, and manual route/API smoke tests using locally configured secrets. No production migration or deployment is part of this implementation unless separately requested.
