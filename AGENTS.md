# Agent Notes

## Current Scope

- The active deliverable is the no-build static site in `docs/`, published with GitHub Pages from the `master` branch `/docs` folder.
- Do not treat local legacy prototype folders such as `miniprogram/`, `admin-web/`, `cloudfunctions/`, or `shared/` as part of the current shipped app unless the user explicitly asks to revive them.
- Keep the site directly openable from `docs/index.html`; do not introduce Vite, React, npm runtime dependencies, a backend, login, or real image hosting without a new plan.

## Architecture Rules

- Load order in `docs/index.html` must stay `core.js`, then `recipes.js`, then `app.js`.
- Put pure business logic in `docs/core.js`; it must keep working as both browser global `window.TasteworldCore` and CommonJS module for Node tests.
- Keep browser DOM/event/rendering code in `docs/app.js`.
- Keep recipe data in `docs/recipes.js` as `window.RECIPES` so local double-click usage still works.

## Verification

- Run `npm.cmd run verify` on Windows PowerShell if plain `npm run verify` is blocked by execution policy.
- At minimum, syntax-check `docs/core.js`, `docs/recipes.js`, and `docs/app.js` before publishing.
- After publishing, check GitHub Pages resources: `/`, `/core.js`, `/styles.css`, `/recipes.js`, and `/app.js`.

## Git Hygiene

- Existing untracked legacy prototype files may be present in the local workspace. Do not stage or delete them unless the user explicitly asks.
- The current published static app should only require tracked files in `docs/`, `test/`, `README.md`, `AGENTS.md`, `package.json`, and `.gitignore`.
