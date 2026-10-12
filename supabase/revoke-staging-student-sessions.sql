-- Run as operator in the SQL editor after the staging student's password reset.
-- Revoke application sessions and provider refresh access for this user only.
begin;
update gethired_private.sessions
set revoked_at = coalesce(revoked_at, clock_timestamp())
where account_id in (
  select id from gethired_private.accounts
  where auth_user_id = 'c259219b-c881-4505-bf50-44251a93bf50'
);
delete from auth.refresh_tokens where session_id in (
  select id from auth.sessions where user_id = 'c259219b-c881-4505-bf50-44251a93bf50'
);
delete from auth.sessions where user_id = 'c259219b-c881-4505-bf50-44251a93bf50';
commit;
-- Previously issued JWTs may remain cryptographically valid until expiry;
-- GetHired also checks provider/session state and rejects revoked sessions.
