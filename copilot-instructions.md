# MeiteiMart Repository Instructions

## Structure

- This is a private npm-workspaces monorepo. Run npm install and workspace commands from the repository root.
- Keep independently deployable portals under `apps/`, the Express service under `services/api/`, and cross-application code under `packages/`.
- Preserve existing working portal and API behavior when making structural or documentation changes.

## Existing conventions

- JavaScript uses ES modules. The API is organized by feature under `services/api/src/modules/`; keep route, controller, and Mongoose model responsibilities local to their feature.
- Reuse `@meiteimart/shared` for roles, permissions, status values, categories, socket event names, and existing utilities rather than duplicating constants.
- Web applications use Vite and read browser-exposed settings from `VITE_*` variables. Expo app configuration exposes the mobile API origin through `extra.apiUrl`.
- Keep runtime secrets server-side. Never add real credentials to tracked files, frontend variables, examples, or documentation.

## Validation

- After changing a web portal, run its root build script, such as `npm run build:admin`.
- After changing API code, use `node --check` on touched JavaScript files and verify the relevant workspace command. Starting the API requires a reachable MongoDB and required environment values.
- After changing a shared package, validate every affected consumer that has a build script.
- Do not commit generated `dist/` output, dependency directories, or local `.env` files.