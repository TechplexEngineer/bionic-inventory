# SvelteKit 2.70.2 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the project's declared SvelteKit dependency to the latest stable release, 2.70.2, and verify the application remains healthy.

**Architecture:** This is a dependency-metadata-only upgrade. Update the direct dependency declaration and npm lockfile without modifying application source or adopting the SvelteKit 3 prerelease line, then validate the existing SvelteKit/Cloudflare application with its standard checks.

**Tech Stack:** npm, SvelteKit 2.70.2, Svelte 5, Vite 8, Vitest, Cloudflare Wrangler

## Global Constraints

- Set `@sveltejs/kit` to `^2.70.2`.
- Do not update unrelated direct dependencies.
- Do not adopt SvelteKit 3 prereleases.
- Preserve existing application behavior and Cloudflare deployment configuration.

---

### Task 1: Update and Verify SvelteKit

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: existing checks and tests under `src/`

**Interfaces:**
- Consumes: npm's `@sveltejs/kit@2.70.2` package metadata and the existing dependency graph.
- Produces: a direct dependency range of `^2.70.2` with a consistent npm lockfile resolving SvelteKit 2.70.2.

- [ ] **Step 1: Establish the baseline**

Run:

```bash
npm run check
npm test
npm run build
```

Expected: all three commands exit with status 0 before dependency metadata changes.

- [ ] **Step 2: Update the direct SvelteKit dependency**

Run:

```bash
npm install --save-dev @sveltejs/kit@^2.70.2
```

Expected: `package.json` declares `"@sveltejs/kit": "^2.70.2"`; `package-lock.json` remains consistent and resolves `node_modules/@sveltejs/kit` to version `2.70.2`.

- [ ] **Step 3: Inspect dependency scope**

Run:

```bash
git diff -- package.json package-lock.json
npm ls @sveltejs/kit --depth=0
```

Expected: the manifest change is limited to the SvelteKit range, lockfile changes are attributable to that update, and npm reports `@sveltejs/kit@2.70.2`.

- [ ] **Step 4: Run static validation**

Run:

```bash
npm run check
```

Expected: exit status 0 with no Svelte or TypeScript errors.

- [ ] **Step 5: Run unit tests**

Run:

```bash
npm test
```

Expected: exit status 0 with all tests passing.

- [ ] **Step 6: Run the production build**

Run:

```bash
npm run build
```

Expected: exit status 0 and a successful Cloudflare-targeted SvelteKit build.

- [ ] **Step 7: Review and commit the upgrade**

Run:

```bash
git diff --check
git status --short
git add package.json package-lock.json
git commit -m "chore: update SvelteKit to 2.70.2"
```

Expected: no whitespace errors; only the intended dependency files are included in the upgrade commit.
