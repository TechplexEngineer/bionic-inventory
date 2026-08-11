# Cloudflare Main-Branch CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Cloudflare Workers Builds to build and deploy `bionic-inventory` automatically after every push to GitHub's `main` branch.

**Architecture:** Cloudflare's native GitHub integration will connect `TechplexEngineer/bionic-inventory` to the existing `bionic-inventory` Worker. Workers Builds will run the repository's production build and Wrangler deployment commands using a Cloudflare-managed build token; repository configuration remains the source of truth.

**Tech Stack:** GitHub, Cloudflare Workers Builds, Wrangler 4, npm, SvelteKit, D1

## Global Constraints

- Production branch: `main`.
- Build command: `npm run build`.
- Deploy command: `npx wrangler deploy`.
- Non-production branch builds: disabled.
- Do not automate D1 migrations.
- Do not add GitHub Actions or store Cloudflare API credentials in GitHub.
- Preserve Worker name `bionic-inventory`, URL `https://bionic-inventory.techplex.workers.dev`, and D1 database `305c793c-b1d9-4fd1-abe8-3e417162340b`.

---

### Task 1: Validate and Publish Repository Deployment Configuration

**Files:**
- Modify: `wrangler.jsonc`
- Create: `docs/superpowers/plans/2026-08-11-cloudflare-main-ci.md`

**Interfaces:**
- Consumes: existing Worker name and D1 database identifiers.
- Produces: a local `main` commit whose Wrangler configuration can deploy the existing production Worker.

- [ ] **Step 1: Verify the deployment configuration**

Run:

```bash
node -e "const fs=require('node:fs'); const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8')); if(config.name!=='bionic-inventory') throw new Error('wrong Worker name'); const db=config.d1_databases?.find((item)=>item.binding==='DB'); if(db?.database_id!=='305c793c-b1d9-4fd1-abe8-3e417162340b') throw new Error('wrong D1 database');"
```

Expected: exit status 0.

- [ ] **Step 2: Run repository verification**

Run:

```bash
npm run check
npm test
npm run build
```

Expected: static checks report no diagnostics, all tests pass, and the production build exits successfully.

- [ ] **Step 3: Verify Wrangler's deployment bundle**

Run:

```bash
npx wrangler deploy --dry-run
```

Expected: the binding list contains `env.DB (305c793c-b1d9-4fd1-abe8-3e417162340b)`.

- [ ] **Step 4: Commit the production binding and implementation plan**

Run:

```bash
git diff --check
git add wrangler.jsonc docs/superpowers/plans/2026-08-11-cloudflare-main-ci.md
git commit -m "ci: prepare Cloudflare Workers Builds"
```

Expected: the commit includes the D1 binding update and this plan without adding `.agents/` or `.vscode/`.

### Task 2: Connect Cloudflare Workers Builds

**Files:**
- Modify: Cloudflare Worker `bionic-inventory` build settings
- Test: Cloudflare Workers Builds configuration and build history

**Interfaces:**
- Consumes: GitHub repository `TechplexEngineer/bionic-inventory`, existing Worker `bionic-inventory`, and the prepared local deployment commit.
- Produces: a production build trigger for pushes to `main`.

- [ ] **Step 1: Connect the repository**

Use the Cloudflare Workers Builds connection for the existing `bionic-inventory` Worker and select GitHub repository `TechplexEngineer/bionic-inventory`. If the Cloudflare Workers & Pages GitHub App requires owner authorization, stop for that one-time interactive authorization before continuing.

Expected: the Worker reports the connected Git provider and repository.

- [ ] **Step 2: Configure the production trigger**

Set these exact build settings:

```text
Production branch: main
Root directory: /
Build command: npm run build
Deploy command: npx wrangler deploy
Non-production branch builds: disabled
Build caching: enabled
```

Expected: Cloudflare saves a production trigger scoped to `main` and uses its managed build token.

### Task 3: Verify Automatic Production Deployment

**Files:**
- Test: Cloudflare build history and deployed Worker URL

**Interfaces:**
- Consumes: configured Workers Builds trigger and the local deployment commit.
- Produces: evidence that Git pushes deploy the production Worker.

- [ ] **Step 1: Push `main` to trigger the build**

Run:

```bash
git push origin main
```

Expected: the local `main` commits are published to `TechplexEngineer/bionic-inventory` and trigger the production build.

- [ ] **Step 2: Monitor the first build**

Expected: dependency installation, `npm run build`, and `npx wrangler deploy` all complete successfully.

- [ ] **Step 3: Verify build provenance**

Confirm the successful Cloudflare build records branch `main` and the expected Git commit SHA.

Expected: the active deployment version is linked to the pushed `main` commit.

- [ ] **Step 4: Smoke-test production**

Run:

```bash
curl --fail --silent --show-error --location --output /dev/null --write-out 'status=%{http_code}\n' https://bionic-inventory.techplex.workers.dev
```

Expected: `status=200`.

- [ ] **Step 5: Verify repository state**

Run:

```bash
git status --short
git log -1 --oneline
```

Expected: tracked deployment changes are committed; unrelated `.agents/` and `.vscode/` entries remain untouched.
