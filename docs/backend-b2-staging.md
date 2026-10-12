# B2 staging foundation

Status: repository foundation implemented; user reports hosted preflight and both
migrations and database login creation succeeded. Live service connectivity was
verified on 2026-10-12; full hosted acceptance remains pending (see section 5).
Frontend host confirmed: Vercel. API host: Render. Database and identity: Supabase.

Staging is an isolated test environment, with synthetic accounts and separate secrets
from eventual production. A Supabase project supplies PostgreSQL and Auth; a Render
web service runs `apps/api`; Vercel runs Next.js and the existing same-origin proxy.
On 2026-10-05 the user reported creating Supabase and Render resources and successfully
running the preflight and both migrations in Supabase's SQL editor. This is user-reported
setup evidence. Runtime connectivity was subsequently verified; full hosted
acceptance has not yet been completed.

| Resource | URL/status |
| --- | --- |
| Supabase | `https://vbddvogwnyvgeejaxpgv.supabase.co` |
| Render API | `https://gethired-113w.onrender.com` |
| Vercel frontend | `https://gethired-gold.vercel.app` |
| Session pooler | `aws-0-ap-southeast-1.pooler.supabase.com:5432` |

The user also reported creating both restricted logins. Runtime pooler username:
`gethired_api_login.vbddvogwnyvgeejaxpgv`; maintenance pooler username:
`gethired_cleanup_login.vbddvogwnyvgeejaxpgv`. Passwords remain private. Hosted
environment settings and effective login privileges still require verification.

Local validation: 43 API tests plus eight proxy tests pass; full typecheck and API
production build pass. This session used installed Node 24.14.1; deployment remains
pinned to Node 22.22.0, so repeat validation on that runtime before rollout. Hosted
schema, ingress, provider and multi-connection checks below remain unverified.

## Repository deliverables

- `GET /api/health/ready`: public GET only, checks enabled configuration, database,
  schema marker `202610050001`, runtime account read access and provider bridge.
  Returns minimal `200` or safe `503`; no database diagnostics. Probes share one
  in-flight operation per process, use the existing five-connection pool and
  five-second acquisition timeout, and two-second SQL statement deadlines inside
  a read-only transaction. It does not check Auth HTTP availability or email delivery.
- `supabase/preflight.sql`: read-only hosted column/privilege check before migration.
- `202610050001_b2_operations.sql`: schema marker and maintenance-only, bounded
  expired-counter pruning; cleanup execution granted to a separate maintenance role.
- `apps/api/src/jobs/maintenance.ts`: one-shot worker; retries happen on the next
  scheduled run. Errors omit credentials. Runtime sessions remain revoked even
  when provider cleanup fails. Existing cleanup batches use `SKIP LOCKED`.
- `render.yaml`: reviewable API and five-minute cleanup schedule, manual deployment,
  private environment values. **The template selects paid Starter resources in
  Singapore; review cost and region before creating it.** No migration credential
  is supplied to either service and no migrations run at API startup.

## 1. Create and configure isolated Supabase

Create a project such as `gethired-staging`, preferably near the API region. Keep
real student data out of it. Save its URL and publishable key to the API environment
only. Configure an active ES256 signing key, JWT expiry of 900 seconds and email
verification. Use the exact HTTPS Vercel staging origin for Auth's site/redirect
configuration; do not allow arbitrary preview origins. SMTP and email flows need
live verification before B5; B2 test users can be created through the Auth dashboard.

Use the dashboard's Connect panel to obtain the database host. Prefer a direct
connection, or the session pooler on IPv4-only networks. Use a restricted login,
not `postgres`, for the API. Keep verified TLS enabled; this client does not accept
URL query options. The API pool has a maximum of five connections per instance;
maintenance adds one. Include overlapping deployments and provider connections in
the project connection budget. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Preflight and migrate as operator

Use the Supabase SQL editor or an operator session whose credentials are never
installed on Vercel or the API. Run `supabase/preflight.sql` first and retain success
evidence. It checks exact referenced columns and operator access, but does not prove
provider refresh behavior. Review actual column types/constraints and ensure Auth's
session cleanup semantics remain compatible. Stop if the preflight fails.

Apply these files once, in order, recording each successful filename in the deployment
record (the first migration is not idempotent; do not rerun it on an existing schema):

1. `supabase/migrations/202609290001_phase3_auth.sql`
2. `supabase/migrations/202610050001_b2_operations.sql`

Keep `gethired_private` out of exposed schemas and Realtime. Then create separate
logins using strong, unique passwords through the operator session:

```sql
create role gethired_api_login login inherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls password '<generated runtime password>';
grant gethired_runtime to gethired_api_login;
create role gethired_cleanup_login login inherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls password '<different generated maintenance password>';
grant gethired_maintenance to gethired_cleanup_login;
```

Do not commit filled-in SQL. On a session pooler, follow Supabase's login/project
suffix format. Verify the actual runtime login cannot execute either cleanup
function, modify accounts, or read `auth` tables; verify the cleanup login cannot
read application accounts. The grants in tests are a local baseline, not evidence
of all effective privileges on your hosted project.

## 3. Provision test identities

In the staging Supabase Auth dashboard, create one verified administrator and one
verified student using addresses you control and unique passwords. Do not insert
passwords directly into `auth.users`. Copy each generated Auth UUID. As operator,
create matching private accounts; for the student, add the complete profile in the
same transaction. Example (replace all example values before running):

```sql
begin;
insert into gethired_private.accounts(auth_user_id, email, display_name, role, status)
values ('<admin auth UUID>', '<controlled admin email>', 'Staging Admin', 'admin', 'active');
with account as (
  insert into gethired_private.accounts(auth_user_id, email, display_name, role, status)
  values ('<student auth UUID>', '<eight-digit ID>@usc.edu.ph', 'Staging Student', 'student', 'active')
  returning id
)
insert into gethired_private.student_profiles
  (account_id, student_number, first_name, last_name, course, year_level)
select id, '<eight-digit ID>', 'Staging', 'Student', 'BSCS', '4' from account;
commit;
```

This operator-only test setup does not implement public signup or bypass verification
for real students. Prepare an unmapped verified Auth identity and an inactive account
for negative acceptance checks as well.

## 4. Configure Render and Vercel

Review `render.yaml`, then connect the repository in Render. Use repository root,
Node from `.node-version`, build `npm ci --include=dev && npm run build:api`, start
`npm run start:api`, and health path `/api/health/ready`. Enter secret values in
Render's dashboard. Set `DATABASE_URL` to the runtime login. Only the cron job gets
`MAINTENANCE_DATABASE_URL` using the cleanup login. Generate distinct 64-hex gateway
and cookie secrets; the cookie secret must stay stable across API instances.
Set `APP_ORIGIN` to the stable Vercel HTTPS staging origin, without a path.
See [Render Blueprint settings](https://render.com/docs/blueprint-spec).

Keep `NODE_ENV=production`. The explicit `--include=dev` installs TypeScript and
the Node/Express/pg type definitions needed during compilation; otherwise npm omits
them in production. For services created manually, update the Build Command in
Render's dashboard as well as this repository's Blueprint.

### Database TLS certificate trust

If readiness reports `stage: connect`, `reason: database_tls_failed`, the TLS
handshake failed before database login. One possible cause is a missing trusted
Supabase root certificate. Download the project's server root certificate from
Supabase Database Settings. In Render's Environment section, add a Secret File
named `supabase-ca.crt` containing the complete PEM certificate, including its
BEGIN/END CERTIFICATE lines. Set `NODE_EXTRA_CA_CERTS=/etc/secrets/supabase-ca.crt`
and redeploy. Apply the same setting and file to the maintenance service when created.

Node reads this variable at process startup and extends its default trusted roots;
the current pg configuration sets `rejectUnauthorized: true` without overriding
`ca`, so no application change is needed. Keep TLS verification enabled and retain
the existing DATABASE_URL without SSL query parameters. If the same diagnostic
persists, verify the certificate file, expiry, hostname and deployed startup logs
before assuming the database credentials are wrong.

References: [Supabase SSL](https://supabase.com/docs/guides/platform/ssl-enforcement),
[Render secret files](https://render.com/docs/configure-environment-variables),
[Node extra CA certificates](https://nodejs.org/api/cli.html#node_extra_ca_certsfile).

Import the same repository in Vercel as Next.js with repository root and
`npm run build`. Select Node 22.x. Scope these server-only variables to staging:

| Variable | Value |
| --- | --- |
| `API_BASE_URL` | Render API HTTPS origin, no `/api` suffix |
| `API_GATEWAY_SECRET` | Same gateway secret as Render |
| `API_INGRESS_IP_HEADER` | `x-vercel-forwarded-for` |
| `API_ALLOW_PRIVATE_HTTP` | `false` |

Do not put database, cookie, or Supabase administrative secrets on Vercel. Use the
existing Next.js API route, not an external rewrite that bypasses its protections.
Vercel documents its client-IP headers and overwrite behavior in
[request headers](https://vercel.com/docs/headers/request-headers). This configuration
assumes traffic enters Vercel directly. Verify the deployed header cannot be spoofed
before recording ingress acceptance; custom upstream proxies need a separate review.
Use one stable staging URL: a different preview origin will fail the exact-origin check.

## 5. Live acceptance record (partial)

On 2026-10-12 direct HTTP checks confirmed Render live/ready 200, direct auth
without gateway 403, Vercel readiness 200, CSRF bootstrap 200 with a Secure,
HttpOnly, SameSite=Lax, Path=/ browser cookie and no Domain, and unauthenticated
me 401. Initial Vercel requests returned 503 while Render was slow to respond;
retries passed. This verifies service connectivity, required schema/runtime reads
and gateway rejection, not credential login or the remaining checks below.

B3 is now implemented locally; see [integration and deployment](backend-b3-integration.md).
The following checklist remains the full hosted acceptance target.

The deployed B2 screens use mock login until B3 is deployed. Exercise the API via a browser test client
on the Vercel staging origin: first GET `/api/auth/csrf`, retain browser cookies and
send `X-CSRF-Token` on mutations, then login → me → refresh → logout. Do not log tokens,
passwords or cookies. Record deployment revisions, timestamps and pass/fail evidence.

- Direct API live/ready GET succeed; direct auth without gateway returns 403.
- Proxy responses preserve individual production `__Host-` cookies with Secure,
  HttpOnly, SameSite=Lax, Path=/ and no Domain; logout deletes all session cookies.
- Both test roles can log in; unknown/unmapped/inactive identities fail. Wrong Origin,
  missing CSRF and forged gateway/client-IP headers are rejected or overwritten.
- Send forged `x-forwarded-for`, `x-vercel-forwarded-for` and `x-gethired-client-ip`
  from the same client. Verify only the actual ingress address determines the limiter
  bucket using temporary restricted diagnostics; remove diagnostics after testing.
- Deactivate the test account through the operator session. Existing me/refresh fail
  even during a simulated Auth HTTP outage; reactivation requires fresh login.
- Test two simultaneous refreshes over separate PostgreSQL connections. Embedded
  PostgreSQL tests serialize a single connection and cannot prove hosted row locking.
- Force a cleanup failure in staging, verify local revocation persists, restore
  connectivity and confirm scheduled cleanup drains queued records and prunes expired
  counters without deleting active ones.
- A missing schema or database outage returns safe readiness 503; restoration returns
  200. Restart/redeploy preserves accounts and sessions.

Do not mark B2 complete until hosted checks pass. Resolve the dependency advisory
recorded in B1 before public rollout. Roll back matched frontend/API revisions while
retaining additive migrations; never delete provider or application data to roll back.
