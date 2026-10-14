# Hosted B3/B4 verification — 2026-10-13

Target: https://gethired-1.vercel.app. Used user-provided test accounts in isolated
headless Chrome contexts, through the site's public Next.js gateway. Credentials
and session cookies are not included in this report. No deployment or database
configuration was changed.

## Passed on the live deployment

- Student and administrator login through the actual login form; `/api/auth/me`
  returned the expected role for each account.
- Student access to the admin company API returned 403; the admin page displayed
  access denied. The administrator was denied the student dashboard and personal
  bookmarks API.
- Student and administrator company-list APIs returned 200.
- Removing the test browser's access cookie and navigating two tabs exercised real
  hosted refresh recovery. This simulates a missing access token, not naturally
  elapsed token/session expiry or a measured single-refresh assertion.
- Admin company creation returned 201. Editing, activation, and deactivation
  returned 200. Student detail requests returned 200 when active and 404 when
  inactive.
- A student bookmark survived logout and a fresh UI login. Removal succeeded.
- UI logout propagated to the other student tab. Replaying the pre-logout cookies
  against `/api/auth/me` returned 401, confirming server-side session invalidation.

Company and bookmark operations above used browser-origin API requests. They do
not constitute verification of every admin form, filter, upload control, or card.

## Live failures

1. A focus-triggered session check still sets the workspace inert and displays
   the blocking “Checking your session” overlay. The local `SessionProvider.tsx`
   fix and local browser regression test have not been verified as deployed.
2. Uploading the existing site logo as a valid PNG to
   `POST /api/admin/company-images` returned **503 SERVICE_UNAVAILABLE**.
   Request ID: `bf3986b5-23b9-48c5-91fa-a61f9404f3f7`.
   Check the API logs for that request and verify `SUPABASE_STORAGE_SECRET_KEY`,
   `COMPANY_IMAGE_BUCKET`, the bucket setup, and Storage connectivity using
   `backend-b4-integration.md`. The response alone does not establish which
   configuration or upstream operation failed. Image attachment and delivery
   could not be verified.

## Cleanup

- Removed the test bookmark and signed out the automated test sessions.
- Left the clearly labeled `ZZ TEST B4 acceptance ...` company inactive:
  `9dd40ca0-b419-4a66-8c05-5c909d69b683`. The API has no company-delete endpoint;
  the record and its audit history remain visible to admins, hidden from students.
- The unsuccessful image upload may have reserved a pending image row/object;
  inspect the normal image-cleanup job if the request reached Storage.

## Still unverified on hosted infrastructure

- Naturally elapsed JWT, idle, and absolute session expiry; account deactivation,
  role change, and administrative revocation. No account was deactivated.
- Bookmark privacy between two students (only one student account supplied).
- Persistence across a backend restart, separate-connection race tests, Storage
  write denial, image attachment/delivery, and orphan-cleanup behavior listed in
  the B4 integration guide. No backend restart was performed.
- Exact migration history was not queried directly. Earlier readiness checks
  passed, and the tested auth/company/bookmark operations worked against the live
  database.

**Conclusion:** substantial hosted B3 and B4 behavior now has direct evidence,
but neither milestone should be described as fully accepted while these failures
and outstanding hosted checks remain.
