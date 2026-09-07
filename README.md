# DaleChetney.github.io

Personal bin for tiny projects, but public!

A single-package TypeScript workspace. Each sub-project builds to its own route;
shared utilities live in `src/shared/`. Built with Vite, deployed to GitHub Pages
by GitHub Actions.

## Develop

```bash
corepack enable
yarn install
yarn dev        # dev server for every route
yarn test       # unit tests (watch)
yarn build      # build every route into dist/
yarn preview    # serve the built dist/
```

Also: `yarn typecheck`, `yarn lint`, `yarn format`.

## Add a sub-project

1. Create `src/<slug>/index.html` with `<script type="module" src="./main.ts">`
   and `src/<slug>/main.ts`.
2. Add a matching entry to `src/projects.ts` (the landing page reads it, and a
   test enforces that folders and manifest entries stay in sync).
3. Import shared helpers from `@shared/...`.

`yarn build` discovers the new `index.html` automatically and emits it at
`/<slug>/`.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` builds `dist/` and deploys it to
Pages. `dist/` is not committed. Pages "Source" is set to "GitHub Actions" in
repo settings.
