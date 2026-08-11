# Cloudflare Main-Branch CI Design

## Goal

Connect the existing `bionic-inventory` Cloudflare Worker to the GitHub repository `TechplexEngineer/bionic-inventory` so every push to `main` automatically builds and deploys the production Worker.

## Architecture

Use Cloudflare Workers Builds and its native GitHub integration. Configure `main` as the production branch, `npm run build` as the build command, and `npx wrangler deploy` as the deploy command. Disable non-production branch builds.

Cloudflare will manage the build token. No Cloudflare API token will be stored as a GitHub Actions secret, and no GitHub Actions workflow will be added.

## Production Configuration

The repository's `wrangler.jsonc` remains the deployment source of truth. Its Worker name must remain `bionic-inventory`, and its production D1 binding must reference database `305c793c-b1d9-4fd1-abe8-3e417162340b`.

The pending D1 configuration change must be committed and pushed to `main` before the first automated build so Cloudflare does not deploy the placeholder database binding.

## Scope

- Enable automatic production builds and deployments only for pushes to `main`.
- Do not enable builds or previews for non-production branches.
- Do not automate D1 migrations.
- Do not add or manage production secrets.
- Preserve the existing Worker URL and D1 data.

## Verification

Before pushing, run `npm run check`, `npm test`, and `npm run build`. After connecting the repository and pushing the configuration commit, verify that Workers Builds completes successfully and that `https://bionic-inventory.techplex.workers.dev` returns HTTP 200.
