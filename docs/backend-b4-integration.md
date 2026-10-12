# B4 companies, images, and bookmarks

Implemented locally on 2026-10-12. Hosted migration, Storage setup, deployment,
and hosted acceptance have **not** been performed by this implementation task.

## Delivered

- All nine B4 endpoints in the backend plan, using existing session, gateway,
  CSRF, permission, safe-envelope, and transaction checks. Resource IDs are UUIDs.
- Company search across name/industry/location/specializations; AND-combined
  filters, OR-selected specializations; stable name/UUID sorting; page size
  20 by default and at most 100. Unknown and duplicate scalar query fields fail.
- Administrator create/edit/status operations and append-only audit events in
  the same transaction. Students cannot write company records or upload images.
- Owner-scoped, idempotent bookmark save/remove. Inactive companies return 404
  to student detail requests; their stored bookmarks are hidden from lists and
  totals and reappear after reactivation. Company records have no `saved` field.
- One multipart `file`, at most 2 MiB plus 16 KiB total multipart overhead,
  JPEG/PNG/WebP only, at most 4096 pixels per dimension. Animated/multipage images
  are rejected. Sharp fully decodes and re-encodes to WebP without metadata;
  normalized output must also fit 2 MiB. Supplied MIME type must match decoding.
  Ordinary requests retain the 64 KiB limit. API multipart parsing is streaming;
  the frontend proxy buffers only up to the separate bounded upload limit.
- Pending image reservations precede Storage writes, so crashes and uncertain
  external results are discoverable. Only ready image IDs may be attached.
  A separate cleanup command marks unattached images older than 24 hours,
  removes Storage objects, and removes rows. Failed deletions retain retryable
  tombstones; attachment and cleanup lock the same image rows.
- Both dashboards use live company APIs, with server filtering/pagination,
  loading/empty/error states and refresh controls. Student saves derive from
  own bookmarks; no local-storage company authority. Home pages saved companies;
  Explore loads bookmark IDs through paginated own reads to show off-page saves.
  Admin forms upload cropped files, then associate the returned image ID.
  Arbitrary image-URL inputs have been removed. No mock partners are seeded.

`packages/contracts/src/companies.ts` is the fixed shared taxonomy and niche
mapping. Specializations must come from its documented options. Niche rules
match the configured industry OR the configured specialization pattern. The
other filters combine with that result using AND. Browser and API use the same
taxonomy; options do not change with the current result page.

Company create requires name (1–160), industry/type (1–120), location (1–250),
1–30 specializations, integer slots (0–100000), description (0–5000), website
(0–500), email (0–254), phone (0–80), and hours (0–250). Empty contact strings are
allowed. Website values normalize to HTTP(S) URLs; credentials are forbidden.
`imageId` is optional or null (remove image); status defaults to active.
PATCH accepts a nonempty subset. Missing images use the local brand placeholder.

## Deployment sequence

1. Apply the pending B3 migration if necessary, then
   `supabase/migrations/202610120002_b4_companies.sql` using the operator account.
   The API readiness marker is now `202610120002`; old application versions
   remain compatible with these additive tables.
2. Run `supabase/company-image-storage.sql` in the intended Supabase project.
   This provisions the dedicated public `company-images` bucket, permits only
   normalized WebP up to 2 MiB, and denies direct anon/authenticated operations
   through a restrictive Storage policy. Public image delivery remains enabled.
   Review any existing bucket mismatch explicitly; the script fails rather than
   silently changing its configuration.
3. Set `SUPABASE_STORAGE_SECRET_KEY` only on the API and image-cleanup worker.
   Use a Supabase secret API key or legacy service-role key, never a publishable
   key. Set `COMPANY_IMAGE_BUCKET=company-images` and the existing `SUPABASE_URL`.
   The Next.js environment must never receive this privileged key. Without
   Storage configuration uploads return a safe 503; ordinary companies still work.
4. Deploy the API and frontend together after both builds and tests pass.
   Existing company views use plain `img` elements, so no additional Next Image
   remote host configuration is required. API image URLs come only from Storage.
5. Configure the hourly image-cleanup job from `render.yaml`, with the separate
   `MAINTENANCE_DATABASE_URL` login holding `gethired_maintenance` membership.
   Run `npm run cleanup:company-images --workspace @gethired/api` after building.
   Each run handles at most 100 old unattached images. A failed removal is retried
   on the next run; nonzero exit and fixed counters identify failures. Review
   the separate worker's hosting cost before provisioning it.

No mutation is automatically replayed after a timeout. Refetch before retrying
an uncertain company creation; an upload that was accepted but not attached is
eventually cleaned. Browser image uploads have a 30-second request deadline;
the proxy has a 25-second upstream deadline. Validate these budgets under the
selected hosting topology before release.

## Verification

- `npm run typecheck`, `npm run build:api`, `npm run build`.
- `npm test`: existing auth/authorization/transport tests plus B4 embedded
  PostgreSQL tests for visibility, owner privacy, idempotency, filtering, audit
  rollback, image state/attachment, runtime grants and cleanup retry.
- Upload tests verify byte/part limits, invalid MIME/decoding, dimensions,
  metadata removal, and valid JPEG/PNG/WebP. Proxy tests prove only image POSTs
  receive the larger body budget. Storage adapter tests check upload/delete
  paths and sanitized upstream failures.
- `npm run test:browser` (set `CHROME_PATH` if needed): isolated production
  Next.js/Chrome fixture covers live company browsing, save/reload persistence,
  administrator edits/status, existing session/refresh/logout, and outage UI.
  This fixture does not prove hosted Supabase behavior.

Hosted acceptance still needs real admin/student accounts: create a company
with a valid image, refetch from a student, bookmark from one of two students,
restart the API, verify persistence/privacy, deactivate/reactivate, and verify
invalid uploads and direct Storage writes are rejected. Exercise simultaneous
bookmark/deactivation and image-attachment/cleanup on separate PostgreSQL
connections; PGlite tests serialize one connection. Confirm cleanup deletes an
old orphan but retains an attached image, and inspect Storage delivery and logs.

Implementation references: [Sharp metadata](https://sharp.pixelplumbing.com/api-input/),
[Busboy limits](https://github.com/mscdex/busboy), and
[Supabase Storage upload](https://supabase.com/docs/reference/javascript/storage-from-upload).
