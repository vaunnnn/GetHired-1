# B5 student registry and onboarding

Implemented locally on 2026-10-13. Hosted migrations, Supabase Auth/SMTP settings,
email delivery, deployment and hosted concurrency acceptance remain pending.
No production accounts, email recipients or remote configuration were changed.

## Delivered contracts

All mutations use the existing gateway, Origin, browser binding, CSRF, size limit,
safe error envelope and request logging. Administrator routes additionally require
an active administrator session with `students:manage`. IDs are UUIDs, not student numbers.

| Route under `/api` | Body or query | Success data |
| --- | --- | --- |
| `POST /auth/signup` | `firstName`, `lastName`, `email`, `course`, `yearLevel`, `password` | 202 `{ message, challengeId }` |
| `POST /auth/signup/resend` | `challengeId` | 202 `{ message, challengeId }` |
| `POST /auth/signup/verify` | `challengeId`, `code`, **`newPassword`** | 200 `{ accountReady: true, status: "active" }` |
| `POST /auth/invitations/accept` | `tokenHash`, `newPassword` | 200 `{ accountReady: true }` |
| `POST /auth/password-reset/request` | `email` | 202 `{ message, challengeId }` |
| `POST /auth/password-reset/verify` | `challengeId`, `code` | 200 `{ verified: true }`, recovery-only HttpOnly cookie |
| `POST /auth/password-reset/complete` | `newPassword` | 200 `{ passwordUpdated: true }`, clears browser credentials |
| `GET /admin/students` | `q`, `course`, `status`, `page`, `pageSize` | `Student[]`, pagination metadata |
| `POST /admin/students` | Student profile fields, excluding password | 201 pending `Student` |
| `PATCH /admin/students/{id}` | Nonempty subset: first/last name, course, year, status | 200 `Student` |
| `POST /admin/students/{id}/invitations` | `{}` | 202 `{ message }` |

`Student` exposes `id`, `studentNumber`, `firstName`, `lastName`, `email`, `course`,
`yearLevel`, and `status`. Email/student number are immutable through PATCH.
Status changes allow active↔inactive; administrators cannot activate an unverified
pending account. Deactivation revokes sessions and pending setup proofs. There is
no student deletion or generated/default password endpoint.

The shared course/year lists live in `packages/contracts/src/students.ts`.
Names are 1–100 trimmed characters, student email is exactly eight digits followed
by `@usc.edu.ph` after normalization, and passwords are 12–128 characters without
trimming. Recovery accepts any valid account email, including administrators.
Codes accept 6–10 digits to accommodate the configured provider OTP length.
Search treats `%` and `_` literally; all filters combine with AND. Pagination
defaults to 20 and caps at 100, ordered by last name, first name, UUID.

**B0 contract amendment:** verification resubmits `newPassword`, retained only in
the current signup component's memory. Supabase deliberately does not replace a
password on repeated unverified signup. Setting the user's chosen password only
after ownership verification prevents an earlier identity reservation from
activating with a different person's password. The application never persists a
password, password hash, or password-bearing retry payload. Reloading signup
requires starting again. See [Supabase signup implementation](https://github.com/supabase/auth/blob/master/internal/api/signup.go).

## State, recovery and external failures

- Public signup stores a temporary profile in a short-lived operation. It creates
  the unique account/profile mapping only after ownership proof. Administrator
  entries are durable pending accounts with nullable provider identity. A signup
  claiming a registry entry preserves its administrator-entered academic profile.
  Superseded/expired temporary profiles are erased; they cannot permanently reserve
  a student number. Existing active/inactive accounts cannot be overwritten by signup.
- One email-level transaction lock serializes operation creation. A 60-second
  durable lease serializes delivery/verification across processes; mutations check
  the lease again before committing provider results. Starts during a lease return
  the same generic public response without interfering with the active operation.
- Challenges bind purpose, browser nonce, email, provider identity and the specific
  issued proof. Five verification attempts are allowed. Resend supersedes the old
  operation. IP limits are 30 requests/15 minutes; target limits are 5/15 minutes;
  administrator invitations are limited to 3/student/15 minutes.
- Signup, resend and recovery starts return the same 202 shape for eligible and
  ineligible accounts. Responses never contain provider identity or delivery errors.
  Wrong/expired signup or invitation proof returns `INVALID_VERIFICATION_CODE`;
  recovery proof/grant returns `INVALID_RECOVERY_CODE`.
- The adapter uses `signup`, `invite`, or `recovery` verification independently.
  An already confirmed but unprovisioned identity uses a newly sent recovery proof
  for verified claiming; it never activates based on provider metadata or email alone.
  Invitations for those identities use the invitation branch of the recovery template.
- The restricted `setup_provider_snapshot(operationId)` bridge reads only the
  provider identity/token state for an unexpired operation. It binds the operation
  to the issued token via HMAC. **No bearer token hash is persisted in plaintext.**
  OTP matching currently follows Supabase's SHA-224(email + code) algorithm; this
  is a provider-schema compatibility dependency, not a replacement identity issuer.
  Verification still calls Supabase's `/verify` endpoint with the stored proof type.
  [Provider digest implementation](https://github.com/supabase/auth/blob/master/internal/crypto/crypto.go),
  [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp).
- A matched proof is recorded as `verifying` before the external call. If Supabase
  consumes it but the response/application write is lost, the same bound proof can
  reconcile an already confirmed identity only when the provider token is consumed.
  An unverified email or a first request against confirmed provider state is insufficient.
  Completed/superseded operations cannot be replayed. Retrying verification for an
  unfinished operation is idempotent only in the same browser with the same proof.
- Verification sessions are setup-only: no access/refresh application cookies or
  application session rows. Local provider logout is attempted and durable cleanup
  stores the session ID. Temporary returned provider credentials use AES-256-GCM,
  authenticated with the operation ID, and are erased at completion/expiry.
  Maintenance also discovers provider sessions without an application session after
  a lost verification response, so abandoned setup does not bypass cleanup.
- Password completion commits a credential barrier and session revocations before
  calling the provider. If the provider call or final DB write fails, login remains
  blocked. Retry with the same bound grant and password; if it expires, request a
  new recovery code (or new signup/invitation for a pending account). Never unblock
  an account manually just because a provider password request timed out.
- Final completion revokes all application and provider sessions and then removes
  the login barrier. A credential generation captured before password login rejects
  a login that straddles reset/deactivation. Fresh sign-in is always required.
- `queued` deliveries retry up to five times with increasing delay, within operation
  expiry. If initial provider creation failed before an identity existed, a fresh
  signup must supply the password again; the worker cannot reconstruct it. Provider
  send acceptance is not proof of mailbox delivery; monitor the SMTP provider too.

## Deployment

1. Run `supabase/preflight.sql` as the migration operator. Apply pending B3/B4
   migrations, then `202610130001_b5_onboarding.sql`. Readiness now requires
   `202610130001`. The new API must not run against the old schema; deploy API and
   frontend together after migration. Do not roll back to an API that ignores the
   credential barrier while any account is blocked.
2. Configure the API and onboarding worker with `SUPABASE_AUTH_SECRET_KEY` (server
   secret key or legacy service-role key), a new random 32-byte hex
   `AUTH_SETUP_ENCRYPTION_KEY`, and `AUTH_SETUP_TTL_SECONDS=600`. The encryption key
   must differ from `AUTH_COOKIE_SECRET`; share it across API/worker instances.
   Never put these settings in Next.js or any `NEXT_PUBLIC_` variable. Rotation
   invalidates outstanding challenges/grants; users must restart their requests.
3. Enable email signup and **require email confirmation** in Supabase. Keep provider
   JWT expiry at the existing 900 seconds. Set shared email OTP expiry to **600
   seconds**, matching the API; this setting also affects invitations/recovery.
   Configure a 6-digit (or supported 6–10 digit) OTP. Direct Supabase identities
   still have no app access without verified profile mapping and an app session.
4. Configure production-capable custom SMTP, verified sender/domain and delivery
   limits in Supabase. Paste the templates from `supabase/email-templates` into
   Confirm signup, Invite user and Reset password. If choosing another TTL, update
   all template duration text too. Supabase's default SMTP is restricted and unsuitable
   for production recipients. [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp),
   [email OTP settings](https://supabase.com/docs/guides/auth/auth-email-passwordless).
5. Set Supabase Site URL to the exact `APP_ORIGIN` (no trailing slash). Allowlist only
   the intended `/invite` and `/password-reset` URLs. Invitation tokens use a URL
   fragment that the browser removes immediately; GET never consumes a proof.
   Do not use the default auto-consuming `ConfirmationURL` in these templates.
   Confirm the recovery template's exact `.RedirectTo` comparison on hosted Supabase.
6. Deploy the configured API and frontend. `render.yaml` includes the minute-based
   onboarding retry job using the API's restricted database credential; it does not
   deploy automatically. The existing maintenance job now prunes expired onboarding
   payloads and performs provider session cleanup with its separate maintenance role.

Operator-only delivery view (never log raw rows, email addresses or provider credentials):

```sql
select id, purpose, state, attempts, send_attempts, available_at, expires_at
from gethired_private.onboarding_operations
where state in ('queued', 'failed', 'verifying', 'verified')
order by created_at;
```

Alert on failed/expired deliveries, stuck verified operations, credential barriers,
and SMTP bounces. The HTTP response intentionally does not expose these distinctions.

## Acceptance

Validation completed locally: `npm run typecheck`, API/frontend production builds,
80 regression tests (63 API, 17 frontend/proxy), all 18 production-topology smoke
checks, and the B3/B4/B5 headless Chrome smoke suite. The browser suite covers
registry create/edit/invitation, signup including rejected OTP, password reset,
invitation acceptance and removal of the token fragment, plus existing session and
company/bookmark workflows. Provider calls and email delivery remain fixtures.

Local tests execute all migrations and runtime grants in embedded PostgreSQL;
provider calls use explicit fixtures. They cover invalid inputs, browser/purpose
binding, replacement and expiration, attempt limits, invitation/signup convergence,
registry authorization/audit, inactive-account denial, response-loss reconciliation,
failed password barriers, fresh-login generation checks, full session revocation,
encrypted credential isolation and pruning. Embedded PostgreSQL serializes one
connection; hosted multi-connection races and real emails require staging acceptance.

Before enabling onboarding publicly, verify on staging:

1. Signup confirmation, invitation and recovery templates deliver and every proof
   matches the snapshot bridge and configured expiry. If Auth changes its token
   algorithm, storage format or schema, keep onboarding disabled until adapted.
2. New signup → OTP → fresh login; unknown/existing requests remain generic; expired
   and superseded codes fail. Verify initial signup against a preexisting unverified
   identity installs the verified user's chosen password.
3. Invitation → set password → fresh login, including already confirmed provider
   identities with pending application records. GET/email link scanning cannot activate.
4. Concurrent signup/invitation/resend in separate API processes produces one profile,
   preserves registry fields and does not let a stale lease finish a newer operation.
5. Two-device reset invalidates both devices and a login begun before the reset.
   Inject provider timeout and application write failure; retry and expiry/restart
   recover without releasing the credential barrier early.
6. Deactivation during setup/reset cannot reactivate the account. Verify delivery
   retries, expired-payload pruning and provider-session cleanup with real worker credentials.
