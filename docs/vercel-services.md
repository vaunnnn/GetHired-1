# Vercel services deployment

Deploy this repository as one project with the project root at the repository root.
Use Node.js 22.x. The root `vercel.json` builds Next.js and Express independently,
including their shared contracts workspace. Allow the API service to access files
outside `apps/api` so its build can use the root lockfile and `packages/contracts`.

The API install uses npm's workspace discovery to locate the root lockfile.
Do not add `--prefix ../..`: the install can already run from the repository root,
which makes that relative prefix point outside the checkout. Build and development
commands select packages by workspace name instead of assuming a working directory.

## Routing and bindings

- `gethired-staging-api` is the Next.js frontend, despite its retained suggested name.
- All public paths go to Next.js, including `/api` and `/api/*`.
- Next.js forwards API requests and server-rendered session checks to internal
  service `api` through the runtime-only `API_SERVICE_URL` binding.
- Express retains its `/api/*` routes. Do not route public `/api/*` directly to
  Express: those requests would bypass the Next.js gateway that supplies credentials
  and trusted client IPs. There is no reverse service call or reverse binding.
- Never manually configure `API_SERVICE_URL`. `API_BASE_URL` remains a fallback
  for standalone development or the older separate-host deployment.

The gateway secret and existing authorization checks remain required for bound calls.
Binding URLs are read only during requests, never in builds or middleware.

## Environment

Set the existing application variables in Vercel for each intended environment:

- `APP_ORIGIN`: the exact browser-facing HTTPS origin for that environment.
- `API_GATEWAY_SECRET`: the same random 64-character hex secret for both services.
- `API_INGRESS_IP_HEADER=x-vercel-forwarded-for`: for Vercel's managed ingress;
  verify the forwarding boundary as described in `backend-b2-staging.md`.
- `AUTH_TRUSTED_IP_HEADER=x-gethired-client-ip`: Express trusts the authenticated gateway.
- `API_LOG_DESTINATION=stdout` and optionally `API_MAX_BODY_BYTES=65536`.
- `AUTH_ENABLED=true` only after database migrations and auth setup are complete.
  Supply `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_ALGORITHMS`,
  `DATABASE_URL`, and `AUTH_COOKIE_SECRET` from `apps/api/.env.example`.
  Disabled auth intentionally returns 503 for authentication and readiness.

Do not set `API_BASE_URL` in the Vercel project. A binding supports internal HTTP
without `API_ALLOW_PRIVATE_HTTP`; the standalone fallback retains that check.
Do not expose server settings using `NEXT_PUBLIC_*`.
Database migrations and maintenance remain separate operational tasks; see the
existing B2/B3 deployment guides. Their Render hosting instructions describe the
older topology, not this services deployment.

## Validation

With Node.js 22, npm, and a current Vercel CLI installed:

```sh
npm ci --include=dev
npm run typecheck
npm test
npm run build
npm run build:api
vercel dev -L
```

Provide the application variables above through the local development environment;
`vercel dev` injects the service binding itself. For local HTTP use a matching
`APP_ORIGIN` (for example `http://localhost:3000`). Check `/`, `/api/health/live`,
login, session refresh, and logout through the single frontend origin. With auth
disabled, liveness should return 200 and auth/readiness should return 503.
Then validate a Vercel preview using its configured HTTPS `APP_ORIGIN`, including
client-IP forwarding and cookies, before promoting it.

References: [Services](https://vercel.com/docs/services),
[bindings](https://vercel.com/docs/services/bindings),
[Express](https://vercel.com/docs/frameworks/backend/express).
