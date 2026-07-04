# skill_search

AI Skill Pack Catalog is a standalone Vite web app for searching and reviewing a GitHub-derived catalog of AI skill pack candidates.

## What Is Included

- 1000 GitHub-derived catalog records in `src/data/ai-skill-packs.json`
- CurioshuLab logo and generated UI icon assets under `src/assets/`
- Search, filters, favorites, collection, compare, history, import-state demo, settings, theme, detail panel, pagination, and external GitHub links
- Production checks for static data safety, build health, browser behavior, responsive screenshots, and Vercel deployment settings

## Local Operation

```powershell
npm install --ignore-scripts
npm run validate
npm run web:dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173.

## Production Build

```powershell
npm run web:build
npm run start -- --port 4173 --strictPort
```

The static build is written to `dist/`.

## Vercel Production Deployment

This repository includes `vercel.json` for a static Vite deployment:

- Framework Preset: Vite
- Install Command: `npm ci --ignore-scripts`
- Build Command: `npm run web:build`
- Output Directory: `dist`
- SPA fallback: all paths rewrite to `/index.html`
- Security headers: CSP, Referrer-Policy, X-Content-Type-Options, Permissions-Policy
- Asset cache: immutable one-year cache for built assets

Before production deployment, run:

```powershell
npm ci --ignore-scripts
npm run validate
```

For Git integration, import this repository in Vercel and keep the project root at the repository root. For CLI deployment after `vercel link`, use:

```powershell
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

Do not commit `.vercel/project.json` or tokens. Use Vercel project settings or CI secrets for deployment credentials.


## Database Operation

The catalog is managed through a local SQLite database at `data/catalog.sqlite`.

```powershell
npm run db:init
npm run web:dev -- --port 5173 --strictPort
```

The app reads records from `/api/catalog` during local Vite development. The `データを更新` button calls `/api/refresh`, fetches the latest GitHub search results, stores them in SQLite, and refreshes the visible catalog.

Use this command for a manual refresh from the terminal:

```powershell
npm run db:refresh
```

`GITHUB_TOKEN` or `GH_TOKEN` can be set to raise GitHub API rate limits. The SQLite database file and WAL/SHM sidecar files are local runtime state and are not tracked by Git.

## Data Refresh

```powershell
$env:GITHUB_TOKEN = "<optional-token>"
npm run refresh:data
npm run validate
```

`refresh:data` reads only `GITHUB_TOKEN` or `GH_TOKEN` for GitHub API rate limits. Do not print tokens in logs.

## Security Notes

- External app links are restricted in code to `https://github.com/...` and `https://docs.github.com/...`.
- Links open with `rel="noopener noreferrer"`.
- Runtime dependencies are intentionally empty; Vite and Playwright are development-only.
- `node_modules/`, `dist/`, `output/`, and environment files are ignored.
- Vercel uploads exclude local build/test artifacts through `.vercelignore`.

## Verification Coverage

`npm run validate` runs:

- static production validation
- Vite production build
- Playwright browser smoke test covering visible controls and mobile layout

